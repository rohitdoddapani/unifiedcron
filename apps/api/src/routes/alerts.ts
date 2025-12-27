import { Router, IRouter } from 'express';
import { AlertService } from '../services/AlertService';

const router: IRouter = Router();
const alertService = new AlertService();
const DISABLE_MONITORING = process.env.DISABLE_MONITORING === 'true' || process.env.NODE_ENV === 'development';

// Get all alerts for a user
router.get('/', async (req, res, next) => {
  try {
    const userId = req.query.userId as string;
    const type = req.query.type as string;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    if (DISABLE_MONITORING) {
      return res.json({
        success: true,
        data: [],
        message: 'Monitoring is currently disabled. Alert functionality will be available in a future release.'
      });
    }

    const alerts = await alertService.getAlerts(userId, { type, limit, offset });
    
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
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

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
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const alert = await alertService.resolveAlert(id, userId);
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

// Get alert statistics
router.get('/stats/overview', async (req, res, next) => {
  try {
    const userId = req.query.userId as string;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    const stats = await alertService.getAlertStats(userId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

export { router as alertsRouter };
