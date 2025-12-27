import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || process.env.ENCRYPTION_KEY || 'change-me-in-production';

export interface AuthRequest extends Request {
  userId?: string;
  user?: {
    id: string;
    email: string;
  };
}

/**
 * Middleware to authenticate API requests
 * Supports both JWT tokens (Bearer) and session-based auth (for NextAuth)
 */
export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  // Try JWT token first (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      req.userId = decoded.userId;
      req.user = {
        id: decoded.userId,
        email: decoded.email,
      };
      return next();
    } catch (error) {
      // Token invalid, continue to check session
    }
  }

  // Try session-based auth (NextAuth session cookie)
  // This would require parsing the session cookie, which is complex
  // For now, we'll require JWT tokens for API access
  // Frontend should get the token from NextAuth session

  return res.status(401).json({
    success: false,
    error: 'Authentication required',
  });
}

/**
 * Optional authentication - doesn't fail if no auth provided
 * Useful for endpoints that work with or without auth
 */
export function optionalAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
      req.userId = decoded.userId;
      req.user = {
        id: decoded.userId,
        email: decoded.email,
      };
    } catch (error) {
      // Token invalid, continue without auth
    }
  }
  next();
}

