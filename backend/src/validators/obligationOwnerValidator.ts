// Obligation Owner Validator - Input validation for owner assignment
import { body, param, ValidationChain } from 'express-validator';

export const obligationOwnerValidators = {
  assign: (): ValidationChain[] => [
    body('obligation_id')
      .isUUID()
      .withMessage('Valid obligation ID is required'),
    body('user_id')
      .isUUID()
      .withMessage('Valid user ID is required')
  ],

  getHistory: (): ValidationChain[] => [
    param('obligationId')
      .isUUID()
      .withMessage('Valid obligation ID is required')
  ],

  getActive: (): ValidationChain[] => [
    param('obligationId')
      .isUUID()
      .withMessage('Valid obligation ID is required')
  ]
};
