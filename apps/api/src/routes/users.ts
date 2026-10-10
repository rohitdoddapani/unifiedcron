import { Router, IRouter } from 'express';
import { query } from '@unifiedcron/database';
import { AuthRequest } from '../middleware/auth';

const router: IRouter = Router();

router.get('/me', async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const result = await query(
      'SELECT id, email, name, "emailVerified", image, "createdAt" FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

export { router as usersRouter };
