import { Router } from 'express';
import { ObligationOwnerController } from '../controllers/obligationOwnerController';
import { authenticate, requireRole } from '../middlewares/auth';
import { handleValidation } from '../validators/validationMiddleware';
import { obligationOwnerValidators } from '../validators/obligationOwnerValidator';

const router = Router();
const controller = new ObligationOwnerController({
  obligationOwnerService: {} as any,
  obligationOwnerRepository: {} as any,
  auditRepository: {} as any
});

// GET /api/obligation-owners/:obligationId
router.get(
  '/:obligationId',
  authenticate,
  obligationOwnerValidators.getActive(),
  handleValidation,
  controller.getActive
);

// POST /api/obligation-owners/assign
router.post(
  '/assign',
  authenticate,
  requireRole('SuperAdmin', 'Admin'),
  obligationOwnerValidators.assign(),
  handleValidation,
  controller.assign
);

// GET /api/obligation-owners/:obligationId/history
router.get(
  '/:obligationId/history',
  authenticate,
  obligationOwnerValidators.getHistory(),
  handleValidation,
  controller.getHistory
);

export default router;
