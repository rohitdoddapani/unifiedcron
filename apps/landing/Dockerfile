# Multi-stage build for Next.js landing page
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy workspace and package files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/landing/package.json ./apps/landing/package.json

# Dependencies stage - install all dependencies
FROM base AS deps
RUN pnpm install --frozen-lockfile

# Build stage
FROM deps AS build

# Copy source files after dependencies are installed
COPY apps/landing ./apps/landing

# Build Next.js app
WORKDIR /app/apps/landing
RUN pnpm build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built application
COPY --from=build /app/apps/landing/.next/standalone ./
COPY --from=build /app/apps/landing/.next/static ./apps/landing/.next/static

# Expose port
EXPOSE 3002

ENV PORT=3002
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3002', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["node", "apps/landing/server.js"]
