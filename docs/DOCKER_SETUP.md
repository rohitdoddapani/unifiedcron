# Docker Setup Guide

This guide will help you set up UnifiedCron using Docker Compose for easy self-hosting.

## Prerequisites

- Docker Engine 20.10+ installed
- Docker Compose 2.0+ installed
- At least 2GB of available RAM
- At least 5GB of available disk space

### Verify Installation

```bash
docker --version
docker compose version
```

## Quick Start

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone <repository-url>
   cd unifiedcron
   ```

2. **Set up environment variables**:
   ```bash
   cp docker-compose.env.example .env
   # Edit .env with your configuration
   ```

3. **Generate encryption key** (if not set):
   ```bash
   # Generate a secure key
   openssl rand -base64 32
   # Add it to .env file as ENCRYPTION_KEY
   ```

4. **Start all services**:
   ```bash
   docker compose up -d
   ```

5. **Wait for services to be healthy** (about 30-60 seconds):
   ```bash
   docker compose ps
   ```

6. **Access the application**:
   - Frontend: http://localhost:3000
   - API: http://localhost:3001
   - Health check: http://localhost:3001/health

## Environment Configuration

Edit the `.env` file with your settings:

### Required Variables

- `ENCRYPTION_KEY`: 32-byte base64 encoded key for encrypting credentials
  ```bash
  openssl rand -base64 32
  ```

### Database Configuration

- `POSTGRES_USER`: Database username (default: `unifiedcron`)
- `POSTGRES_PASSWORD`: Database password (default: `unifiedcron`)
- `POSTGRES_DB`: Database name (default: `unifiedcron`)
- `POSTGRES_PORT`: External port (default: `5432`)

### Service Ports

- `API_PORT`: API server port (default: `3001`)
- `WEB_PORT`: Frontend port (default: `3000`)
- `NEXT_PUBLIC_API_URL`: Frontend API URL (default: `http://localhost:3001`)

### Optional Variables

- `NODE_ENV`: Environment mode (default: `production`)
- `DISABLE_MONITORING`: Set to `true` to disable monitoring (default: disabled)

## Service Architecture

```
┌─────────────┐
│   Web UI    │  :3000
│  (Next.js)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│     API     │  :3001
│  (Express)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ PostgreSQL  │  :5432
└─────────────┘
```

## Common Commands

### Start Services
```bash
docker compose up -d
```

### Stop Services
```bash
docker compose down
```

### View Logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f web
docker compose logs -f postgres
```

### Restart a Service
```bash
docker compose restart api
```

### Check Service Status
```bash
docker compose ps
```

### Access Database
```bash
docker compose exec postgres psql -U unifiedcron -d unifiedcron
```

### Run Database Migrations Manually
```bash
docker compose exec api node packages/database/dist/migrate.js
```

## Data Persistence

Database data is stored in a Docker volume named `postgres_data`. To persist data:

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect unifiedcron_postgres_data

# Backup database
docker compose exec postgres pg_dump -U unifiedcron unifiedcron > backup.sql

# Restore database
docker compose exec -T postgres psql -U unifiedcron unifiedcron < backup.sql
```

## Troubleshooting

### Services Won't Start

1. **Check logs**:
   ```bash
   docker compose logs
   ```

2. **Verify ports are available**:
   ```bash
   lsof -i :3000
   lsof -i :3001
   lsof -i :5432
   ```

3. **Check disk space**:
   ```bash
   df -h
   ```

### Database Connection Issues

1. **Wait for database to be ready**:
   ```bash
   docker compose logs postgres
   ```
   Look for: `database system is ready to accept connections`

2. **Test database connection**:
   ```bash
   docker compose exec postgres pg_isready -U unifiedcron
   ```

3. **Check environment variables**:
   ```bash
   docker compose exec api env | grep DATABASE
   ```

### Frontend Can't Connect to API

1. **Verify API is healthy**:
   ```bash
   curl http://localhost:3001/health
   ```

2. **Check NEXT_PUBLIC_API_URL**:
   - Should match your API URL
   - For Docker Compose, use `http://localhost:3001` or your server's IP

3. **Check CORS settings** in API logs

### Encryption Key Issues

1. **Verify ENCRYPTION_KEY is set**:
   ```bash
   docker compose exec api env | grep ENCRYPTION_KEY
   ```

2. **Generate a new key** if needed:
   ```bash
   openssl rand -base64 32
   ```

3. **Update and restart**:
   ```bash
   # Update .env file
   docker compose down
   docker compose up -d
   ```

## Production Considerations

### Security

1. **Change default passwords** in `.env`
2. **Use strong encryption key** (32+ bytes)
3. **Enable HTTPS** via reverse proxy (nginx/traefik)
4. **Restrict database access** (don't expose port 5432 publicly)
5. **Regular backups** of database volume

### Performance

1. **Adjust resource limits** in `docker-compose.yml`:
   ```yaml
   services:
     api:
       deploy:
         resources:
           limits:
             cpus: '1'
             memory: 512M
   ```

2. **Enable database connection pooling** for high load

3. **Use a managed PostgreSQL** for production

### Reverse Proxy Setup (Optional)

Example nginx configuration:

```nginx
server {
    listen 80;
    server_name unifiedcron.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Maintenance

### Update Application

```bash
git pull
docker compose build
docker compose up -d
```

### Clean Up

```bash
# Stop and remove containers
docker compose down

# Remove volumes (WARNING: deletes data)
docker compose down -v

# Remove images
docker compose down --rmi all
```

### Health Checks

All services include health checks. Monitor with:

```bash
docker compose ps
```

Healthy services show `healthy` status.

## Support

For issues and questions:
- Check the logs: `docker compose logs`
- Review the [Supabase Setup Guide](./SUPABASE_SETUP.md)
- Open an issue on GitHub
