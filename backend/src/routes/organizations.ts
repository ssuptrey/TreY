import { Router } from 'express';
import { OrganizationController } from '../controllers/organizationController';
import { authenticate, requireRole } from '../middlewares/auth';
import { handleValidation } from '../validators/validationMiddleware';
import { organizationValidators } from '../validators/organizationValidator';

const router = Router();
const controller = new OrganizationController({
  organizationRepository: {} as any,
  auditRepository: {} as any
});

// GET /api/organizations
router.get(
  '/',
  authenticate,
  controller.list
);

// GET /api/organizations/:id
router.get(
  '/:id',
  authenticate,
  organizationValidators.getById(),
  handleValidation,
  controller.getById
);

// POST /api/organizations
router.post(
  '/',
  authenticate,
  requireRole('SuperAdmin'),
  organizationValidators.create(),
  handleValidation,
  controller.create
);

export default router;
