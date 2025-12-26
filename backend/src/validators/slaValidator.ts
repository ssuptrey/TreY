// SLA Validator - Input validation for SLA endpoints
import { body, param, ValidationChain } from 'express-validator';

export const slaValidators = {
  create: (): ValidationChain[] => [
    body('obligation_id')
      .isUUID()
      .withMessage('Valid obligation ID is required'),
    body('deadline')
      .isISO8601()
      .withMessage('Valid ISO 8601 date is required for deadline')
      .custom((value) => {
        const deadline = new Date(value);
        const now = new Date();
        if (deadline <= now) {
          throw new Error('Deadline must be in the future');
        }
        return true;
      })
  ],

  extend: (): ValidationChain[] => [
    body('obligation_id')
      .isUUID()
      .withMessage('Valid obligation ID is required'),
    body('new_deadline')
      .isISO8601()
      .withMessage('Valid ISO 8601 date is required for new deadline')
      .custom((value) => {
        const deadline = new Date(value);
        const now = new Date();
        if (deadline <= now) {
          throw new Error('New deadline must be in the future');
        }
        return true;
      }),
    body('extension_reason')
      .trim()
      .isLength({ min: 10, max: 1000 })
      .withMessage('Extension reason must be between 10 and 1000 characters')
  ],

  getByObligation: (): ValidationChain[] => [
    param('obligationId')
      .isUUID()
      .withMessage('Valid obligation ID is required')
  ]
};
