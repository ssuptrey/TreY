// User Validator - Input validation for user management endpoints
import { body, param, ValidationChain } from 'express-validator';

export const userValidators = {
  create: (): ValidationChain[] => [
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 12 })
      .withMessage('Password must be at least 12 characters')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number')
      .matches(/[!@#$%^&*(),.?":{}|<>]/)
      .withMessage('Password must contain at least one special character'),
    body('full_name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Full name must be between 2 and 100 characters'),
    body('organization_id')
      .isUUID()
      .withMessage('Valid organization ID is required'),
    body('role')
      .isIn(['admin', 'manager', 'operator'])
      .withMessage('Role must be admin, manager, or operator')
  ],

  lock: (): ValidationChain[] => [
    param('id')
      .isUUID()
      .withMessage('Valid user ID is required')
  ],

  unlock: (): ValidationChain[] => [
    param('id')
      .isUUID()
      .withMessage('Valid user ID is required')
  ],

  updateRole: (): ValidationChain[] => [
    param('id')
      .isUUID()
      .withMessage('Valid user ID is required'),
    body('role')
      .isIn(['admin', 'manager', 'operator'])
      .withMessage('Role must be admin, manager, or operator')
  ]
};
