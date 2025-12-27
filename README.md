# UnifiedCron

UnifiedCron is a self-hostable developer tool that centralizes cron jobs into one dashboard. Currently focused on Supabase, with more platforms coming soon.

## Features

- **Self-Hostable**: Run entirely on your infrastructure with Docker Compose
- **Supabase Support**: Discover and monitor pg_cron jobs from your Supabase databases
- **Unified Dashboard**: View all your scheduled jobs in one place
- **Secure**: Encrypted credential storage with read-only access patterns
- **Discovery-First**: Focus on discovering and organizing your cron jobs (monitoring coming soon)

## Current Status

🚧 **Beta Release** - Currently supports **Supabase only**. Other platforms (GitHub Actions, Vercel, Netlify, n8n) will be added incrementally in future releases.

## Quick Start with Docker Compose (Recommended)

### Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+

### Setup

1. **Clone the repository**:
```bash
git clone <repository-url>
cd unifiedcron
```

2. **Set up environment variables**:
```bash
cp docker-compose.env.example .env
# Edit .env with your configuration
# Generate encryption key: openssl rand -base64 32
```

3. **Start all services**:
```bash
docker compose up -d
```

4. **Access the application**:
   - Frontend: http://localhost:3000
   - API: http://localhost:3001

See [Docker Setup Guide](./docs/DOCKER_SETUP.md) for detailed instructions.

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm or npm
- PostgreSQL (or a local Supabase instance)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd unifiedcron
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp env.example .env.local
# Edit .env.local with your configuration
```

4. Set up the database:
```bash
pnpm db:migrate
```

5. Start development servers:
```bash
pnpm dev
```

This will start:
- Frontend at http://localhost:3000
- API at http://localhost:3001

See [Development Guide](./docs/DEVELOPMENT.md) for more details.

## Architecture

```
┌─────────────┐
│   Web UI    │  (Next.js)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│     API     │  (Express.js)
└──────┬──────┘
       │
       ├──► Supabase (pg_cron discovery)
       │
       ▼
┌─────────────┐
│ PostgreSQL  │  (UnifiedCron DB)
└─────────────┘
```

## Supported Platforms

### ✅ Supabase (pg_cron) - Available Now
- Reads from `cron.job` and `cron.job_run_details` via public views
- Requires project URL and anonymous key
- Discover all active cron jobs from your Supabase databases
- See [Supabase Setup Guide](./docs/SUPABASE_SETUP.md) for detailed instructions

### 🚧 Coming Soon
- **GitHub Actions**: Parse `.github/workflows/*.yml` files for cron schedules
- **Vercel**: Read scheduled functions from `vercel.json`
- **Netlify**: Read scheduled functions from `netlify.toml`
- **n8n**: Connect via REST API to discover workflows with Cron nodes

## Getting Started with Supabase

1. **Set up database views** in your Supabase project (see [Supabase Setup Guide](./docs/SUPABASE_SETUP.md))
2. **Get your credentials**: Project URL and Anonymous Key from Supabase dashboard
3. **Connect in UnifiedCron**: Add connection via the Connections page
4. **Discover jobs**: Refresh jobs to see all your cron schedules

## Security

- **Self-Hosted**: Run on your own infrastructure - no data leaves your servers
- **Encrypted Storage**: All credentials are encrypted before storage (AES-256-GCM)
- **Read-Only Access**: Uses read-only access patterns (Supabase anon key with limited permissions)
- **No Secrets in Logs**: Secrets are never logged or exposed in API responses
- **Isolated Environment**: Docker Compose ensures services communicate securely

## Development

### Project Structure

```
unifiedcron/
├── apps/
│   ├── web/          # Next.js frontend
│   ├── api/          # Express.js backend
│   └── worker/       # Background worker
├── packages/
│   ├── database/     # Database schema and migrations
│   ├── shared/       # Shared types and utilities
│   └── integrations/ # Platform-specific parsers
└── docs/            # Documentation
```

### Available Scripts

- `pnpm dev` - Start all development servers
- `pnpm build` - Build all applications
- `pnpm test` - Run tests
- `pnpm lint` - Run linting
- `pnpm type-check` - Run TypeScript type checking

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
