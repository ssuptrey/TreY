// Obligation Validator - Input validation for obligation endpoints
import { body, param, ValidationChain } from 'express-validator';

export const obligationValidators = {
  create: (): ValidationChain[] => [
    body('title')
      .trim()
      .isLength({ min: 3, max: 200 })
      .withMessage('Title must be between 3 and 200 characters'),
    body('description')
      .trim()
      .isLength({ min: 10, max: 5000 })
      .withMessage('Description must be between 10 and 5000 characters'),
    body('owner_id')
      .isUUID()
      .withMessage('Valid owner ID is required'),
    body('sla_deadline')
      .isISO8601()
      .withMessage('Valid ISO 8601 date is required for SLA deadline')
      .custom((value) => {
        const deadline = new Date(value);
        const now = new Date();
        if (deadline <= now) {
          throw new Error('SLA deadline must be in the future');
        }
        return true;
      })
  ],

  getById: (): ValidationChain[] => [
    param('id')
      .isUUID()
      .withMessage('Valid obligation ID is required')
  ],

  updateStatus: (): ValidationChain[] => [
    param('id')
      .isUUID()
      .withMessage('Valid obligation ID is required'),
    body('status')
      .isIn(['pending', 'in_progress', 'completed', 'overdue'])
      .withMessage('Status must be pending, in_progress, completed, or overdue')
  ]
};
