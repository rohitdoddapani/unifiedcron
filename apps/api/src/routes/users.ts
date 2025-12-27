import { Router, IRouter } from 'express';
import { getDefaultUserId } from '../utils/user';

const router: IRouter = Router();

// Get or create default user (for development/MVP)
router.get('/default', async (req, res, next) => {
  try {
    const userId = await getDefaultUserId();
    res.json({
      success: true,
      userId,
      email: 'admin@unifiedcron.com',
      name: 'Development Admin'
    });
  } catch (error) {
    next(error);
  }
});

export { router as usersRouter };
