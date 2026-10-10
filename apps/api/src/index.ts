// Load environment variables FIRST, before any other imports that need them
import dotenv from 'dotenv';

// Load environment variables
// Look for .env.local in the project root (two levels up from apps/api/src)
const path = require('path');
const rootPath = path.resolve(__dirname, '../../..');

// Try .env.local first (for development), then fall back to .env
if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
  dotenv.config({ path: path.join(rootPath, '.env.local') });
}
dotenv.config({ path: path.join(rootPath, '.env') }); // Fallback
dotenv.config(); // Also try local .env file

// Now import everything else AFTER environment is loaded
import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { closePool } from '@unifiedcron/database';
import { connectionsRouter } from './routes/connections';
import { jobsRouter } from './routes/jobs';
import { alertsRouter } from './routes/alerts';
import { healthRouter } from './routes/health';
import { usersRouter } from './routes/users';
import { authRouter } from './routes/auth';
import { notificationsRouter } from './routes/notifications';
import { errorHandler } from './middleware/errorHandler';
import { authenticate } from './middleware/auth';
import { NotificationService } from './services/NotificationService';
import { randomUUID } from 'crypto';
import { logEvent } from '@unifiedcron/shared';

// Log environment status (without exposing secrets)
console.log('📝 Environment loaded:', {
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_PORT: process.env.API_PORT || 3001,
  HAS_ENCRYPTION_KEY: !!process.env.ENCRYPTION_KEY,
  HAS_DATABASE_URL: !!process.env.DATABASE_URL,
  HAS_JWT_SECRET: !!process.env.JWT_SECRET,
});

if (!process.env.ENCRYPTION_KEY) {
  console.error('❌ ERROR: ENCRYPTION_KEY is required but not found in environment');
  console.error('   Make sure .env.local exists in the project root with ENCRYPTION_KEY set');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error('❌ ERROR: JWT_SECRET is required but not found in environment');
  process.exit(1);
}

const app: Application = express();
const PORT = process.env.API_PORT || 3001;
const configuredOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : process.env.NODE_ENV === 'production'
    ? [
        process.env.FRONTEND_URL || 'https://dashboard.unifiedcron.com',
        'https://dashboard.unifiedcron.com',
        'https://unifiedcron.com',
      ]
    : ['http://localhost:3000', 'http://localhost:3002'];

const normalizeOrigin = (origin: string) => origin.replace(/\/$/, '');
const allowedOrigins = configuredOrigins.map(normalizeOrigin);

console.log('🌐 CORS allowed origins:', allowedOrigins);

// Middleware
app.use(helmet());
app.use((req, res, next) => {
  const started = Date.now();
  const requestId = randomUUID();
  res.setHeader('x-request-id', requestId);
  res.on('finish', () => logEvent('info', 'api.request', {
    requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - started,
  }));
  next();
});
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    const normalizedOrigin = normalizeOrigin(origin);
    if (allowedOrigins.includes(normalizedOrigin)) {
      callback(null, true);
      return;
    }

    const error = new Error('Not allowed by CORS');
    error.name = 'ForbiddenError';
    callback(error);
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check routes
app.use('/health', healthRouter);

// Authentication routes (public)
app.use('/api/auth', authRouter);

// API routes
app.use('/api/users', authenticate, usersRouter);
app.use('/api/connections', authenticate, connectionsRouter);
app.use('/api/jobs', authenticate, jobsRouter);
app.use('/api/alerts', authenticate, alertsRouter);
app.use('/api/notifications', authenticate, notificationsRouter);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  await closePool();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  await closePool();
  process.exit(0);
});

new NotificationService().encryptLegacySecrets().then(() => app.listen(PORT, () => {
  console.log(`🚀 UnifiedCron API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
})).catch(error => {
  logEvent('error', 'api.startup_failed', { name: error instanceof Error ? error.name : 'Error' });
  process.exit(1);
});

export default app;
