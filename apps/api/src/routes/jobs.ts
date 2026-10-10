import { Router, IRouter } from 'express';
import { JobService } from '../services/JobService';
import { AuthRequest } from '../middleware/auth';

const router: IRouter = Router();
const jobService = new JobService();

// Get all jobs for a user
router.get('/', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const platform = req.query.platform as string;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const jobs = await jobService.getJobs(userId, { platform, limit, offset });
    
    res.json({
      success: true,
      data: jobs
    });
  } catch (error) {
    next(error);
  }
});

// Get a specific job
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthRequest).userId!;

    const job = await jobService.getJob(id, userId);
    if (!job) {
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    res.json({
      success: true,
      data: job
    });
  } catch (error) {
    next(error);
  }
});

// Refresh jobs for a connection
router.post('/:connectionId/refresh', async (req, res, next) => {
  try {
    const { connectionId } = req.params;
    const userId = (req as AuthRequest).userId!;

    const result = await jobService.refreshJobs(connectionId, userId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get job runs for a specific job
router.get('/:id/runs', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthRequest).userId!;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const runs = await jobService.getJobRuns(id, userId, { limit, offset });
    
    res.json({
      success: true,
      data: runs
    });
  } catch (error) {
    next(error);
  }
});

// Get job statistics
router.get('/:id/stats', async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthRequest).userId!;

    const stats = await jobService.getJobStats(id, userId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

export { router as jobsRouter };
