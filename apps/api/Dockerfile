# Multi-stage build for API service
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/integrations/package.json ./packages/integrations/package.json
COPY apps/api/package.json ./apps/api/package.json

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
COPY apps/api/src ./apps/api/src
COPY apps/api/tsconfig.json ./apps/api/tsconfig.json

# Build shared packages
WORKDIR /app/packages/shared
RUN pnpm build

WORKDIR /app/packages/database
RUN pnpm build

WORKDIR /app/packages/integrations
RUN pnpm build

# Build API
WORKDIR /app/apps/api
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
COPY apps/api/package.json ./apps/api/package.json

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built packages
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/database/dist ./packages/database/dist
COPY --from=build /app/packages/integrations/dist ./packages/integrations/dist
COPY --from=build /app/packages/database/src/schema.sql ./packages/database/src/schema.sql

# Copy built API
COPY --from=build /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the API
CMD ["node", "dist/index.js"]
