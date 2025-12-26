// Validation Middleware - Handle validation results
import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationError } from 'express-validator';

export const handleValidation = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error: ValidationError) => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg
    }));

    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: formattedErrors
    });
    return;
  }
  
  next();
};
