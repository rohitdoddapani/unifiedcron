import { Router, IRouter } from 'express';
import { query } from '@unifiedcron/database';

const router: IRouter = Router();

// Basic health check
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Database health check
router.get('/database', async (req, res) => {
  try {
    await query('SELECT 1 as healthy');
    res.json({
      status: 'ok',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

router.get('/metrics', async (req, res) => {
  try {
    const [alertCounts, deliveryCounts] = await Promise.all([
      query(
        `SELECT status, COUNT(*)::int as count
         FROM alerts
         GROUP BY status`
      ),
      query(
        `SELECT status, COUNT(*)::int as count
         FROM notification_deliveries
         GROUP BY status`
      ),
    ]);

    res.json({
      status: 'ok',
      metrics: {
        alerts: alertCounts.rows,
        deliveries: deliveryCounts.rows,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    // Metrics should never take down health endpoint.
    res.status(200).json({
      status: 'ok',
      metrics: {
        alerts: [],
        deliveries: [],
      },
      warning: error instanceof Error ? error.message : 'metrics unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

export { router as healthRouter };
