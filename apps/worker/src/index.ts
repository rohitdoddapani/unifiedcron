import dotenv from 'dotenv';
import cron from 'node-cron';
import { closePool } from '@unifiedcron/database';
import { MonitoringService } from './services/MonitoringService';

// Load environment variables
dotenv.config();

const DISABLE_MONITORING = process.env.DISABLE_MONITORING === 'true';
const monitoringService = new MonitoringService();

console.log('🚀 UnifiedCron Worker starting...');

if (DISABLE_MONITORING) {
  console.log('⚠️  Monitoring is disabled (DISABLE_MONITORING=true)');
  console.log('📝 Discovery-only mode: Jobs can be discovered but monitoring is disabled');
  console.log('💡 Monitoring features will be enabled in a future release');
} else {
  // Schedule monitoring tasks
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log('🔄 Starting monitoring cycle...');
    try {
      await monitoringService.monitorSupabaseJobs();
      console.log('✅ Monitoring cycle completed');
    } catch (error) {
      console.error('❌ Monitoring cycle failed:', error);
    }
  });

  // Cleanup old data daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('🧹 Starting cleanup cycle...');
    try {
      await monitoringService.cleanupOldData();
      console.log('✅ Cleanup cycle completed');
    } catch (error) {
      console.error('❌ Cleanup cycle failed:', error);
    }
  });

  console.log('📊 Monitoring Supabase jobs every 5 minutes');
  console.log('🧹 Cleanup scheduled daily at 2 AM');
}

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

console.log('✅ Worker started successfully');
console.log('📊 Monitoring Supabase jobs every 5 minutes');
console.log('🧹 Cleanup scheduled daily at 2 AM');

// Keep the process alive
process.stdin.resume();
