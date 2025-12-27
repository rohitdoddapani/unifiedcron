import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '@unifiedcron/shared';

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('API Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const response: ApiResponse = {
    success: false,
    error: isDevelopment ? error.message : 'Internal server error'
  };

  // Handle specific error types
  if (error.name === 'ValidationError') {
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
