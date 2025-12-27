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
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { closePool } from '@unifiedcron/database';
import { connectionsRouter } from './routes/connections';
import { jobsRouter } from './routes/jobs';
import { alertsRouter } from './routes/alerts';
import { healthRouter } from './routes/health';
import { usersRouter } from './routes/users';
import { authRouter } from './routes/auth';
import { errorHandler } from './middleware/errorHandler';

// Log environment status (without exposing secrets)
console.log('📝 Environment loaded:', {
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_PORT: process.env.API_PORT || 3001,
  HAS_ENCRYPTION_KEY: !!process.env.ENCRYPTION_KEY,
  HAS_DATABASE_URL: !!process.env.DATABASE_URL
});

if (!process.env.ENCRYPTION_KEY) {
  console.error('❌ ERROR: ENCRYPTION_KEY is required but not found in environment');
  console.error('   Make sure .env.local exists in the project root with ENCRYPTION_KEY set');
  process.exit(1);
}

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check routes
app.use('/health', healthRouter);

// Authentication routes (public)
app.use('/api/auth', authRouter);

// API routes
app.use('/api/users', usersRouter);
app.use('/api/connections', connectionsRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/alerts', alertsRouter);

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

app.listen(PORT, () => {
  console.log(`🚀 UnifiedCron API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

export default app;
