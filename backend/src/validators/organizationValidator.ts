// Organization Validator - Input validation for organization endpoints
import { body, param, ValidationChain } from 'express-validator';

export const organizationValidators = {
  create: (): ValidationChain[] => [
    body('name')
      .trim()
      .isLength({ min: 2, max: 200 })
      .withMessage('Organization name must be between 2 and 200 characters')
  ],

  getById: (): ValidationChain[] => [
    param('id')
      .isUUID()
      .withMessage('Valid organization ID is required')
  ]
};
