# Deployment Guide

This guide covers production and self-host deployments using the split Compose files.

## Self-Host (End Users)

Use the self-host compose file, which excludes `landing` and `docs`:

```bash
cp docker-compose.env.example .env
# Edit .env with your configuration

docker compose -f docker-compose.selfhost.yml up -d
```

Services:
- Web UI: http://localhost:3000
- API: http://localhost:3001

## Production (Hetzner)

The production compose file includes `landing` in addition to core services:

```bash
cp docker-compose.env.example .env
# Edit .env with your configuration

docker compose -f docker-compose.prod.yml up -d
```

Notes:
- `docker-compose.prod.yml` expects the external `proxy` network to exist.
- Configure your reverse proxy (nginx/traefik) to route:
  - `unifiedcron.com` → landing (port 3002)
  - `dashboard.unifiedcron.com` → web (port 3000)
  - `api.unifiedcron.com` → api (port 3001)

## Docs Site (Nextra + Vercel)

Docs are hosted separately from the application containers.

1. Set the Vercel project root to `docs-site/`.
2. Use the default Next.js build settings.
3. Set the domain to `docs.unifiedcron.com`.

Source markdown lives in `docs/` and is mirrored into the Nextra site under `docs-site/pages/`.
