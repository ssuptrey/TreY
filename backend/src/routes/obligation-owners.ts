import { Router } from 'express';
import { ObligationOwnerController } from '../controllers/obligationOwnerController';
import { authenticate, requireRole } from '../middlewares/auth';
// import { handleValidation } from '../validators/validationMiddleware';

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
  controller.getActive
);

// POST /api/obligation-owners/assign
router.post(
  '/assign',
  authenticate,
  requireRole('SuperAdmin', 'Admin'),
  controller.assign
);

// GET /api/obligation-owners/:obligationId/history
router.get(
  '/:obligationId/history',
  authenticate,
  controller.getHistory
);

export default router;
