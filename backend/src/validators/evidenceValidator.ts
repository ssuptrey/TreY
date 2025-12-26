// Evidence Validator - Input validation for evidence endpoints
import { body, param, ValidationChain } from 'express-validator';

// Allowed file types for evidence uploads
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv'
];

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const evidenceValidators = {
  upload: (): ValidationChain[] => [
    body('obligation_id')
      .isUUID()
      .withMessage('Valid obligation ID is required')
  ],

  listByObligation: (): ValidationChain[] => [
    param('obligationId')
      .isUUID()
      .withMessage('Valid obligation ID is required')
  ],

  download: (): ValidationChain[] => [
    param('id')
      .isUUID()
      .withMessage('Valid evidence ID is required')
  ]
};

// File validation middleware (to be used with Multer)
export const validateFile = (file: Express.Multer.File | undefined): { valid: boolean; error?: string } => {
  if (!file) {
    return { valid: false, error: 'No file uploaded' };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return { 
      valid: false, 
      error: `File type not allowed. Allowed types: PDF, JPEG, PNG, GIF, DOC, DOCX, XLS, XLSX, TXT, CSV` 
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size exceeds maximum limit of 10MB' };
  }

  return { valid: true };
};

export const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.doc', '.docx', '.xls', '.xlsx', '.txt', '.csv'];
export { MAX_FILE_SIZE, ALLOWED_MIME_TYPES };
