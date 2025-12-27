# Authentication Setup Guide

UnifiedCron supports multiple authentication methods for both self-hosted and cloud deployments.

## Authentication Methods

### 1. Email/Password Authentication
- Traditional email and password registration/login
- Works for both self-hosted and cloud deployments
- Passwords are hashed using bcrypt

### 2. OAuth Providers (Optional)
- **Google OAuth**: Sign in with Google account
- **GitHub OAuth**: Sign in with GitHub account
- Can be enabled/disabled via environment variables

## Setup Instructions

### Step 1: Install Dependencies

```bash
# Install frontend dependencies
cd apps/web
pnpm add next-auth@beta bcryptjs
pnpm add -D @types/bcryptjs

# Install backend dependencies
cd ../api
pnpm add bcryptjs jsonwebtoken
pnpm add -D @types/bcryptjs @types/jsonwebtoken

# Return to root
cd ../..
```

### Step 2: Run Database Migration

Add authentication tables to your database:

```bash
cd packages/database
pnpm build
node dist/migrate-auth.js
```

This will create:
- `sessions` table (for NextAuth session management)
- `accounts` table (for OAuth provider accounts)
- `verification_tokens` table (for email verification)
- Additional columns on `users` table (password hash, email verification, etc.)

### Step 3: Configure Environment Variables

Add to your `.env.local` file:

```bash
# Required for authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here  # Generate with: openssl rand -base64 32
JWT_SECRET=your-jwt-secret-here   # Can be same as ENCRYPTION_KEY

# Optional: OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Frontend (for OAuth buttons)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_GITHUB_CLIENT_ID=your-github-client-id
```

### Step 4: Generate Secrets

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate JWT_SECRET (or reuse ENCRYPTION_KEY)
openssl rand -base64 32
```

### Step 5: Set Up OAuth Providers (Optional)

#### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Client Secret to `.env.local`

#### GitHub OAuth

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Set Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
4. Copy Client ID and Client Secret to `.env.local`

### Step 6: Restart Development Servers

```bash
# Stop existing servers (Ctrl+C)
# Then restart
pnpm dev
```

## Usage

### For Users

1. **Sign Up**: Navigate to `/auth/signin` and click "Don't have an account? Sign up"
2. **Sign In**: Use email/password or OAuth providers
3. **Sign Out**: Click the "Sign Out" button in the header

### For Developers

#### Protecting API Routes

```typescript
import { authenticate } from '../middleware/auth';

router.get('/protected', authenticate, async (req, res) => {
  // req.userId is available here
  res.json({ userId: req.userId });
});
```

#### Using Session in Frontend

```typescript
import { useSession } from 'next-auth/react';

function MyComponent() {
  const { data: session, status } = useSession();
  
  if (status === 'loading') return <div>Loading...</div>;
  if (!session) return <div>Not authenticated</div>;
  
  return <div>Hello {session.user?.email}</div>;
}
```

## Migration from Default User

If you have existing data with the default user system:

1. The default user (`admin@unifiedcron.com`) will still work for development
2. New users can register and will have their own connections/jobs
3. To migrate existing data to a new user:
   - Create a new account
   - Update `userId` in connections/jobs tables (or use SQL migration)

## Security Notes

- **Never commit** `.env.local` to version control
- Use strong `NEXTAUTH_SECRET` and `JWT_SECRET` in production
- Enable HTTPS in production
- Consider rate limiting for auth endpoints
- Passwords are hashed with bcrypt (10 rounds)

## Troubleshooting

### "Invalid credentials" error
- Check that user exists in database
- Verify password hash is correct
- Ensure bcrypt is working correctly

### OAuth not working
- Verify redirect URIs match exactly
- Check environment variables are set
- Ensure OAuth app credentials are correct

### Session not persisting
- Check `NEXTAUTH_SECRET` is set
- Verify database connection
- Check browser cookies are enabled

## Production Deployment

For production:

1. Set `NEXTAUTH_URL` to your production domain
2. Use strong, unique secrets
3. Enable HTTPS
4. Configure CORS properly
5. Set up proper session storage (database sessions are used by default)
6. Consider adding email verification
7. Add rate limiting to prevent brute force attacks

