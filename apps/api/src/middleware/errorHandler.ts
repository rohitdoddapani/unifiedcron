import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@unifiedcron/shared';
import { logEvent } from '@unifiedcron/shared';
import { ZodError } from '@unifiedcron/shared';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  logEvent('error', 'api.error', { name: error.name, path: req.path, method: req.method });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const response: ApiResponse = {
    success: false,
    error: isDevelopment ? error.message : 'Internal server error'
  };

  // Handle specific error types
  if (error instanceof ZodError) {
    res.status(400).json({ success: false, error: error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') });
  } else if (error.name === 'WebhookValidationError') {
    res.status(400).json({ success: false, error: error.message });
  } else if (error.name === 'ValidationError') {
    res.status(400).json(response);
  } else if (error.name === 'UnauthorizedError') {
    res.status(401).json(response);
  } else if (error.name === 'ForbiddenError') {
    res.status(403).json(response);
  } else if (error.name === 'NotFoundError') {
    res.status(404).json(response);
  } else {
    res.status(500).json(response);
  }
}
