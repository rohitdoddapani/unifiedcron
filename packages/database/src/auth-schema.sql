-- Authentication Schema Additions
-- Run this migration to add authentication support to existing databases

-- Add password hash and email verification to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS "passwordHash" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "emailVerificationToken" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "emailVerificationExpires" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "passwordResetToken" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "passwordResetExpires" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "image" VARCHAR(255);

-- Sessions table for NextAuth.js
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionToken" VARCHAR(255) UNIQUE NOT NULL,
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Accounts table for OAuth providers (Google, GitHub, etc.)
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'oauth', 'email', etc.
  provider VARCHAR(50) NOT NULL, -- 'google', 'github', 'credentials', etc.
  "providerAccountId" VARCHAR(255) NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at INTEGER,
  token_type VARCHAR(50),
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider, "providerAccountId")
);

-- Verification tokens for email verification and password reset
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions("userId");
CREATE INDEX IF NOT EXISTS idx_sessions_sessionToken ON sessions("sessionToken");
CREATE INDEX IF NOT EXISTS idx_accounts_userId ON accounts("userId");
CREATE INDEX IF NOT EXISTS idx_accounts_provider ON accounts(provider, "providerAccountId");
CREATE INDEX IF NOT EXISTS idx_verification_tokens_identifier ON verification_tokens(identifier);

