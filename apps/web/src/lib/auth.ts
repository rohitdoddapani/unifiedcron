import type { NextAuthConfig } from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { query } from '@unifiedcron/database';
import bcrypt from 'bcryptjs';

// Ensure environment variables are available
// Next.js automatically loads .env.local from the app root (apps/web/)
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

if (!NEXTAUTH_SECRET) {
  console.error('❌ ERROR: NEXTAUTH_SECRET or AUTH_SECRET environment variable is required');
  console.error('   Add NEXTAUTH_SECRET to your apps/web/.env.local file (or root .env.local)');
  console.error('   Current env check:', {
    hasNEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
    hasAUTH_SECRET: !!process.env.AUTH_SECRET,
    nodeEnv: process.env.NODE_ENV,
  });
}

// Note: This adapter requires the database to have the auth schema migrated
// Run: cd packages/database && pnpm build && node dist/migrate-auth.js

// Custom adapter for NextAuth using our PostgreSQL database
export const authAdapter: Adapter = {
  async createUser(user) {
    const result = await query(
      'INSERT INTO users (email, name, "emailVerified", image) VALUES ($1, $2, $3, $4) RETURNING id, email, name, "emailVerified", image, "createdAt"',
      [user.email, user.name, user.emailVerified || false, user.image]
    );
    return {
      id: result.rows[0].id,
      email: result.rows[0].email,
      name: result.rows[0].name,
      emailVerified: result.rows[0].emailVerified,
      image: result.rows[0].image,
    };
  },
  async getUser(id) {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return null;
    const user = result.rows[0];
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      image: user.image,
    };
  },
  async getUserByEmail(email) {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return null;
    const user = result.rows[0];
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      image: user.image,
    };
  },
  async getUserByAccount({ providerAccountId, provider }) {
    const result = await query(
      `SELECT u.* FROM users u 
       INNER JOIN accounts a ON u.id = a."userId" 
       WHERE a.provider = $1 AND a."providerAccountId" = $2`,
      [provider, providerAccountId]
    );
    if (result.rows.length === 0) return null;
    const user = result.rows[0];
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      image: user.image,
    };
  },
  async updateUser(user) {
    const result = await query(
      'UPDATE users SET email = $1, name = $2, "emailVerified" = $3, image = $4 WHERE id = $5 RETURNING *',
      [user.email, user.name, user.emailVerified, user.image, user.id]
    );
    const updated = result.rows[0];
    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      emailVerified: updated.emailVerified,
      image: updated.image,
    };
  },
  async linkAccount(account) {
    await query(
      `INSERT INTO accounts ("userId", type, provider, "providerAccountId", refresh_token, access_token, expires_at, token_type, scope, id_token, session_state)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        account.userId,
        account.type,
        account.provider,
        account.providerAccountId,
        account.refresh_token,
        account.access_token,
        account.expires_at,
        account.token_type,
        account.scope,
        account.id_token,
        account.session_state,
      ]
    );
    return account;
  },
  async createSession({ sessionToken, userId, expires }) {
    const result = await query(
      'INSERT INTO sessions ("sessionToken", "userId", expires) VALUES ($1, $2, $3) RETURNING *',
      [sessionToken, userId, expires]
    );
    return {
      sessionToken: result.rows[0].sessionToken,
      userId: result.rows[0].userId,
      expires: result.rows[0].expires,
    };
  },
  async getSessionAndUser(sessionToken) {
    const result = await query(
      `SELECT s.*, u.* FROM sessions s 
       INNER JOIN users u ON s."userId" = u.id 
       WHERE s."sessionToken" = $1`,
      [sessionToken]
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return {
      session: {
        sessionToken: row.sessionToken,
        userId: row.userId,
        expires: row.expires,
      },
      user: {
        id: row.id,
        email: row.email,
        name: row.name,
        emailVerified: row.emailVerified,
        image: row.image,
      },
    };
  },
  async updateSession({ sessionToken, ...session }) {
    const result = await query(
      'UPDATE sessions SET "userId" = $1, expires = $2 WHERE "sessionToken" = $3 RETURNING *',
      [session.userId, session.expires, sessionToken]
    );
    if (result.rows.length === 0) return null;
    return {
      sessionToken: result.rows[0].sessionToken,
      userId: result.rows[0].userId,
      expires: result.rows[0].expires,
    };
  },
  async deleteSession(sessionToken) {
    await query('DELETE FROM sessions WHERE "sessionToken" = $1', [sessionToken]);
  },
};

export const authOptions: NextAuthConfig = {
  // Note: When using CredentialsProvider, we use JWT strategy instead of database adapter
  // The adapter is still used for OAuth providers (Google, GitHub)
  // adapter: authAdapter, // Commented out because CredentialsProvider requires JWT
  providers: [
    // Email/Password authentication
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        
        if (!email || !password) {
          // Return null instead of throwing to prevent redirect to error page
          // The error will be caught by signIn callback
          return null;
        }

        try {
          // Find user by email
          const userResult = await query('SELECT * FROM users WHERE email = $1', [email]);
          if (userResult.rows.length === 0) {
            return null;
          }

          const user = userResult.rows[0];
          
          // Check if user has a password (email/password account)
          if (!user.passwordHash) {
            return null;
          }

          // Verify password
          const isValid = await bcrypt.compare(password, user.passwordHash);
          if (!isValid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            emailVerified: user.emailVerified,
            image: user.image,
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      },
    }),
    // Google OAuth (if configured)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    // GitHub OAuth (if configured)
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? [
          GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  session: {
    strategy: 'jwt', // Credentials provider requires JWT strategy
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error', // This should be a page route, not an API route
  },
  callbacks: {
    async jwt({ token, user }) {
      // When user signs in, add user ID to the token
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      // Add user ID from token to session
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  secret: NEXTAUTH_SECRET || 'development-secret-change-in-production',
};

