# Authentication Installation Guide

This guide will help you set up authentication for UnifiedCron.

## Quick Start

### 1. Install Dependencies

```bash
# From project root
cd apps/web
pnpm add next-auth@beta bcryptjs
pnpm add -D @types/bcryptjs

cd ../api
pnpm add bcryptjs jsonwebtoken
pnpm add -D @types/bcryptjs @types/jsonwebtoken

cd ../..
```

### 2. Run Database Migration

```bash
cd packages/database
pnpm build
node dist/migrate-auth.js
```

### 3. Update Environment Variables

Add to `.env.local`:

```bash
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# JWT Secret (can reuse ENCRYPTION_KEY)
JWT_SECRET=$(openssl rand -base64 32)

# Optional: OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Frontend OAuth (for UI buttons)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_GITHUB_CLIENT_ID=your-github-client-id
```

### 4. Restart Servers

```bash
pnpm dev
```

## What's Included

- ✅ Email/Password authentication
- ✅ OAuth support (Google, GitHub) - optional
- ✅ Session management with NextAuth.js
- ✅ Protected routes
- ✅ User menu in header
- ✅ Sign in/Sign up pages

## Next Steps

1. Visit `/auth/signin` to create an account
2. Sign in with email/password or OAuth
3. All routes are now protected by default

For detailed documentation, see `docs/AUTHENTICATION.md`.

