# Multi-stage build for Worker service
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy workspace and package files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/integrations/package.json ./packages/integrations/package.json
COPY apps/worker/package.json ./apps/worker/package.json

# Dependencies stage - install all dependencies
FROM base AS deps
RUN pnpm install --frozen-lockfile

# Build stage
FROM deps AS build

# Copy source files after dependencies are installed
COPY packages/shared/src ./packages/shared/src
COPY packages/shared/tsconfig.json ./packages/shared/tsconfig.json
COPY packages/database/src ./packages/database/src
COPY packages/database/tsconfig.json ./packages/database/tsconfig.json
COPY packages/integrations/src ./packages/integrations/src
COPY packages/integrations/tsconfig.json ./packages/integrations/tsconfig.json
COPY apps/worker/src ./apps/worker/src
COPY apps/worker/tsconfig.json ./apps/worker/tsconfig.json

# Build shared packages
WORKDIR /app/packages/shared
RUN pnpm build

WORKDIR /app/packages/database
RUN pnpm build

WORKDIR /app/packages/integrations
RUN pnpm build

# Build Worker
WORKDIR /app/apps/worker
RUN pnpm build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files for production install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/integrations/package.json ./packages/integrations/package.json
COPY apps/worker/package.json ./apps/worker/package.json

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built packages
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/database/dist ./packages/database/dist
COPY --from=build /app/packages/integrations/dist ./packages/integrations/dist

# Copy built Worker
COPY --from=build /app/apps/worker/dist ./apps/worker/dist

WORKDIR /app/apps/worker

# Start the worker
CMD ["node", "dist/index.js"]
