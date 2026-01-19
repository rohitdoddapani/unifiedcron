# UnifiedCron Development Guide

This guide will help you set up and develop UnifiedCron locally.

## Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm
- PostgreSQL database
- Git

## Quick Start

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd unifiedcron
   chmod +x scripts/setup.sh
   ./scripts/setup.sh
   ```

2. **Configure environment**:
   ```bash
   cp env.example .env.local
   # Edit .env.local with your database URL and other settings
   ```

3. **Set up database**:
   ```bash
   # Make sure PostgreSQL is running
   createdb unifiedcron
   
   # Run migrations
   pnpm db:migrate
   ```

4. **Start development servers**:
   ```bash
   pnpm dev
   ```

This will start:
- Frontend at http://localhost:3000
- API at http://localhost:3001
- Background worker (in a separate terminal)

## Project Structure

```
unifiedcron/
├── apps/
│   ├── web/          # Next.js frontend
│   ├── api/          # Express.js backend
│   └── worker/       # Background worker
├── packages/
│   ├── shared/       # Shared types and utilities
│   ├── database/     # Database schema and client
│   └── integrations/ # Platform-specific parsers
├── docs/            # Documentation
└── scripts/         # Setup and utility scripts
```

## Development Commands

```bash
# Install dependencies
pnpm install

# Start all development servers
pnpm dev

# Start individual services
pnpm dev:web     # Frontend only
pnpm dev:api     # API only  
pnpm dev:worker  # Worker only

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint

# Type check
pnpm type-check

# Database migrations
pnpm db:migrate
```

## Platform Integration

### Supabase
1. Run the SQL in `docs/supabase-setup.sql` in your Supabase SQL editor
2. Get your project URL and anonymous key from Supabase dashboard
3. Add connection in UnifiedCron with these credentials

### GitHub Actions
1. Create a Personal Access Token with `repo` scope
2. Add connection with repository name (owner/repo) and token

### Vercel/Netlify
1. These require GitHub integration for automatic discovery
2. Add GitHub connection first, then Vercel/Netlify can parse config files

### n8n
1. Get your n8n instance URL and API key
2. Add connection with base URL and API key

## API Endpoints

### Connections
- `GET /api/connections` - List connections
- `POST /api/connections` - Create connection
- `GET /api/connections/:id` - Get connection
- `PUT /api/connections/:id` - Update connection
- `DELETE /api/connections/:id` - Delete connection
- `POST /api/connections/:id/test` - Test connection

### Jobs
- `GET /api/jobs` - List jobs
- `GET /api/jobs/:id` - Get job details
- `POST /api/jobs/:connectionId/refresh` - Refresh jobs
- `GET /api/jobs/:id/runs` - Get job runs
- `GET /api/jobs/:id/stats` - Get job statistics

### Alerts
- `GET /api/alerts` - List alerts
- `GET /api/alerts/:id` - Get alert
- `PATCH /api/alerts/:id/resolve` - Resolve alert
- `GET /api/alerts/stats/overview` - Get alert statistics

## Database Schema

### Tables
- `users` - User accounts
- `connections` - Platform connections (encrypted config)
- `jobs` - Normalized cron jobs
- `jobRuns` - Job execution history
- `alerts` - Failure alerts and notifications

### Views
- `job_details` - Jobs with connection and statistics

## Security

- All connection credentials are encrypted using AES-256-GCM
- Database uses camelCase column names
- API includes proper error handling and validation
- Frontend uses secure HTTP practices

## Monitoring

The background worker runs every 5 minutes to:
1. Check Supabase job runs for failures
2. Create alerts for failed jobs
3. Clean up old data
4. Update job statistics

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running
- Check DATABASE_URL in .env.local
- Verify database exists and user has permissions

### Platform Connection Issues
- Verify credentials are correct
- Check platform-specific setup requirements
- Review API rate limits

### Build Issues
- Clear node_modules and reinstall: `rm -rf node_modules && pnpm install`
- Check Node.js version compatibility
- Ensure all packages are built: `pnpm build`

## Environment Variables

Required:
- `DATABASE_URL` - PostgreSQL connection string
- `ENCRYPTION_KEY` - 32-byte base64 key for encrypting secrets

Optional:
- `API_PORT` - API server port (default: 3001)
- `NODE_ENV` - Environment (development/production)
- `NEXT_PUBLIC_API_URL` - Frontend API URL
- `TEST_*` - Test credentials for development

## License

MIT License - see LICENSE file for details
