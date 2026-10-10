import { Router, IRouter } from 'express';
import { AlertService } from '../services/AlertService';
import { AuthRequest } from '../middleware/auth';

const router: IRouter = Router();
const alertService = new AlertService();
const DISABLE_MONITORING = process.env.DISABLE_MONITORING === 'true';
const ALLOWED_ALERT_TYPES = new Set(['failure']);
const ALLOWED_ALERT_STATUSES = new Set(['open', 'resolved']);

// Get alert statistics
router.get('/stats/overview', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const stats = await alertService.getAlertStats(userId);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

// Get all alerts for a user
router.get('/', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const type = req.query.type as string;
    const status = req.query.status as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (DISABLE_MONITORING) {
      return res.json({
        success: true,
        data: [],
        message: 'Monitoring is currently disabled. Alert functionality will be available in a future release.'
      });
    }

    if (type && !ALLOWED_ALERT_TYPES.has(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alert type. Supported values: failure',
      });
    }

    if (status && !ALLOWED_ALERT_STATUSES.has(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid alert status. Supported values: open, resolved',
      });
    }

    const alerts = await alertService.getAlerts(userId, { type, status, limit, offset });
    
    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    next(error);
  }
});

// Get a specific alert
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthRequest).userId!;

    const alert = await alertService.getAlert(id, userId);
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    next(error);
  }
});

// Mark alert as read/resolved
router.patch('/:id/resolve', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthRequest).userId!;
    const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';

    const alert = await alertService.resolveAlert(id, userId, {
      source: 'manual',
      reason: reason || undefined,
      resolvedByUserId: userId,
    });
    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    res.json({
      success: true,
      data: alert
    });
  } catch (error) {
    next(error);
  }
});

export { router as alertsRouter };
