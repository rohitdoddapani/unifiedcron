import dotenv from 'dotenv';
import cron from 'node-cron';
import http from 'http';
import { closePool, query } from '@unifiedcron/database';
import { logEvent } from '@unifiedcron/shared';
import { MonitoringService } from './services/MonitoringService';
import { NotificationService } from './services/NotificationService';

dotenv.config();
const disabled = process.env.DISABLE_MONITORING === 'true';
const port = Number(process.env.WORKER_PORT || 3003);
const monitoring = new MonitoringService();
const notifications = new NotificationService();
let monitoringRunning = false;
let dispatchRunning = false;
let dispatchStatus = 'idle';
let lastDispatchAt: string | null = null;
let stopping = false;

async function monitor() {
  if (stopping || disabled || monitoringRunning) return;
  monitoringRunning = true;
  const started = Date.now();
  try {
    await monitoring.monitorSupabaseJobs();
    logEvent('info', 'monitoring.cycle', { durationMs: Date.now() - started, snapshot: await monitoring.getHealthSnapshot() });
  } catch (error) {
    logEvent('error', 'monitoring.failed', { name: error instanceof Error ? error.name : 'Error' });
  } finally { monitoringRunning = false; }
}

async function dispatch() {
  if (stopping || dispatchRunning) return;
  dispatchRunning = true;
  lastDispatchAt = new Date().toISOString();
  try {
    await notifications.reconcileAlerts();
    await notifications.processPendingDeliveries();
    dispatchStatus = 'success';
  } catch (error) {
    dispatchStatus = 'error';
    logEvent('error', 'webhook.dispatch_failed', { name: error instanceof Error ? error.name : 'Error' });
  } finally { dispatchRunning = false; }
}

const monitorTask = cron.schedule('*/5 * * * *', monitor);
const cleanupTask = cron.schedule('0 2 * * *', async () => {
  if (!disabled && !stopping) {
    try { await monitoring.cleanupOldData(); }
    catch { logEvent('error', 'monitoring.cleanup_failed'); }
  }
});
const dispatchTimer = setInterval(dispatch, 15_000);
void monitor();
void dispatch();

const healthServer = http.createServer(async (req, res) => {
  if (req.url !== '/health' && req.url !== '/metrics') {
    res.writeHead(404); res.end(); return;
  }
  try {
    await query('SELECT 1');
    const snapshot = await monitoring.getHealthSnapshot();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', monitoringDisabled: disabled, snapshot,
      dispatch: { status: dispatchStatus, lastRunAt: lastDispatchAt, running: dispatchRunning }, timestamp: new Date().toISOString() }));
  } catch {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', database: 'unavailable' }));
  }
});
healthServer.listen(port, () => logEvent('info', 'worker.started', { port, monitoringDisabled: disabled, dispatchIntervalSeconds: 15 }));

async function shutdown() {
  if (stopping) return;
  stopping = true;
  monitorTask.stop(); cleanupTask.stop(); clearInterval(dispatchTimer);
  healthServer.close();
  const deadline = Date.now() + 90_000;
  while ((dispatchRunning || monitoringRunning) && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await closePool();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
