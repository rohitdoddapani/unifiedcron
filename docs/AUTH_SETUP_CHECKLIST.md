# Authentication Setup Checklist

## Quick Fix for "MissingSecret" Error

If you're seeing the error: `MissingSecret: Please define a 'secret'`, you need to add `NEXTAUTH_SECRET` to your `.env.local` file.

### Step 1: Generate a Secret

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

### Step 2: Add to `.env.local`

Add the generated secret to your `.env.local` file in the project root:

```bash
# Add this line (replace with your generated secret)
NEXTAUTH_SECRET=your-generated-secret-here

# Also make sure you have:
NEXTAUTH_URL=http://localhost:3000
```

### Step 3: Restart Your Dev Server

```bash
# Stop your current server (Ctrl+C)
# Then restart
pnpm dev
```

## Complete Environment Variables Checklist

Make sure your `.env.local` file has all these variables:

```bash
# Database
DATABASE_URL=postgres://your-username@localhost:5432/unifiedcron

# Encryption
ENCRYPTION_KEY=your-32-byte-base64-key

# NextAuth (REQUIRED)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-generated-secret-here

# Optional: OAuth providers
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# API
API_PORT=3001
NODE_ENV=development

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Quick Secret Generation Commands

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate ENCRYPTION_KEY (if you don't have one)
openssl rand -base64 32
```

**Important:** Never commit `.env.local` to version control - it contains sensitive secrets!

