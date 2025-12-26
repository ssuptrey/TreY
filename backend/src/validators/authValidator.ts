// Auth Validator - Input validation for authentication endpoints
import { body, ValidationChain } from 'express-validator';

export const authValidators = {
  login: (): ValidationChain[] => [
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],

  register: (): ValidationChain[] => [
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

  changePassword: (): ValidationChain[] => [
    body('current_password')
      .notEmpty()
      .withMessage('Current password is required'),
    body('new_password')
      .isLength({ min: 12 })
      .withMessage('New password must be at least 12 characters')
      .matches(/[A-Z]/)
      .withMessage('Password must contain at least one uppercase letter')
      .matches(/[a-z]/)
      .withMessage('Password must contain at least one lowercase letter')
      .matches(/[0-9]/)
      .withMessage('Password must contain at least one number')
      .matches(/[!@#$%^&*(),.?":{}|<>]/)
      .withMessage('Password must contain at least one special character')
      .custom((value, { req }) => {
        if (value === req.body.current_password) {
          throw new Error('New password must be different from current password');
        }
        return true;
      })
  ],

  refreshToken: (): ValidationChain[] => [
    body('refresh_token')
      .notEmpty()
      .withMessage('Refresh token is required')
  ],

  forcePasswordReset: (): ValidationChain[] => [
    body('user_id')
      .isUUID()
      .withMessage('Valid user ID is required')
  ]
};
