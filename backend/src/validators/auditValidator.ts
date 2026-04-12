import { query, param, ValidationChain } from 'express-validator';

export const auditValidators = {
  getLogs: (): ValidationChain[] => [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('entityType').optional().isString().trim().notEmpty().withMessage('Entity type must be a valid string'),
    query('action').optional().isString().trim().notEmpty().withMessage('Action must be a valid string'),
    query('startDate').optional().isISO8601().withMessage('Start date must be a valid ISO8601 date'),
    query('endDate').optional().isISO8601().withMessage('End date must be a valid ISO8601 date'),
  ],

  getLogsByResource: (): ValidationChain[] => [
    param('resourceType').isString().trim().notEmpty().withMessage('Resource type is required'),
    param('resourceId').isUUID().withMessage('Valid resource ID is required')
  ]
};
