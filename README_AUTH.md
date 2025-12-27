# Authentication System

UnifiedCron now includes a complete authentication system that works for both self-hosted and cloud deployments.

## Features

✅ **Email/Password Authentication** - Traditional sign up and login  
✅ **OAuth Support** - Google and GitHub (optional, configurable)  
✅ **Session Management** - Secure session handling with NextAuth.js  
✅ **Protected Routes** - Automatic route protection  
✅ **User Management** - User menu in header with sign out  

## Quick Setup

1. **Install dependencies:**
   ```bash
   cd apps/web && pnpm add next-auth@beta bcryptjs && pnpm add -D @types/bcryptjs
   cd ../api && pnpm add bcryptjs jsonwebtoken && pnpm add -D @types/bcryptjs @types/jsonwebtoken
   ```

2. **Run database migration:**
   ```bash
   cd packages/database && pnpm build && node dist/migrate-auth.js
   ```

3. **Add environment variables to `.env.local`:**
   ```bash
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=$(openssl rand -base64 32)
   JWT_SECRET=$(openssl rand -base64 32)
   ```

4. **Restart servers:**
   ```bash
   pnpm dev
   ```

5. **Visit `/auth/signin` to create an account**

## Architecture

### Frontend (Next.js)
- **NextAuth.js** - Handles authentication, sessions, and OAuth
- **Middleware** - Protects routes automatically
- **Session Provider** - Wraps app to provide session context
- **Sign In Page** - Login/register UI

### Backend (Express API)
- **JWT Tokens** - For API authentication
- **bcrypt** - Password hashing
- **Auth Middleware** - Protects API routes
- **Auth Routes** - Register, login, get current user

### Database
- **Users table** - Extended with password hash, email verification
- **Sessions table** - NextAuth session storage
- **Accounts table** - OAuth provider accounts
- **Verification tokens** - Email verification and password reset

## Files Created/Modified

### New Files
- `packages/database/src/auth-schema.sql` - Database schema for auth
- `packages/database/src/migrate-auth.ts` - Migration script
- `apps/web/src/lib/auth.ts` - NextAuth configuration
- `apps/web/src/app/api/auth/[...nextauth]/route.ts` - NextAuth API route
- `apps/web/src/app/auth/signin/page.tsx` - Sign in page
- `apps/web/src/components/providers/SessionProvider.tsx` - Session provider
- `apps/web/src/components/auth/UserMenu.tsx` - User menu component
- `apps/web/src/middleware.ts` - Route protection middleware
- `apps/web/src/lib/api-client.ts` - Updated API client with auth
- `apps/api/src/routes/auth.ts` - Auth API routes
- `apps/api/src/middleware/auth.ts` - Auth middleware

### Modified Files
- `apps/web/src/app/layout.tsx` - Added SessionProvider and UserMenu
- `apps/api/src/index.ts` - Added auth router
- `packages/database/src/schema.sql` - (No changes, auth is separate migration)
- `env.example` - Added auth environment variables

## Usage

### For End Users
1. Navigate to any page - you'll be redirected to `/auth/signin` if not logged in
2. Click "Don't have an account? Sign up" to create an account
3. Sign in with email/password or OAuth (if configured)
4. Access all features - connections, jobs, etc.
5. Click "Sign Out" in header to logout

### For Developers

#### Protecting API Routes
```typescript
import { authenticate } from '../middleware/auth';

router.get('/protected', authenticate, async (req, res) => {
  // req.userId is available
  res.json({ userId: req.userId });
});
```

#### Using Session in Components
```typescript
'use client';
import { useSession } from 'next-auth/react';

export function MyComponent() {
  const { data: session, status } = useSession();
  
  if (status === 'loading') return <div>Loading...</div>;
  if (!session) return <div>Please sign in</div>;
  
  return <div>Hello {session.user?.email}</div>;
}
```

## Configuration

### Required Environment Variables
- `NEXTAUTH_URL` - Your app URL (http://localhost:3000 for dev)
- `NEXTAUTH_SECRET` - Secret for NextAuth (generate with `openssl rand -base64 32`)
- `JWT_SECRET` - Secret for JWT tokens (can reuse ENCRYPTION_KEY)

### Optional OAuth Variables
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - For Google OAuth
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` - For GitHub OAuth
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` - For Google button in UI
- `NEXT_PUBLIC_GITHUB_CLIENT_ID` - For GitHub button in UI

## Migration from Default User

The default user system (`admin@unifiedcron.com`) is still available for development, but new users should register accounts. Existing data can be migrated by updating `userId` in the database.

## Security Notes

- Passwords are hashed with bcrypt (10 rounds)
- Sessions stored in database (not cookies)
- JWT tokens expire after 30 days
- HTTPS required in production
- Never commit `.env.local` to version control

## Documentation

For detailed setup instructions, see:
- `docs/AUTHENTICATION.md` - Complete authentication guide
- `INSTALL_AUTH.md` - Quick installation steps

