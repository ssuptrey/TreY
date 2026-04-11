import { Router } from 'express';
import { ObligationController } from '../controllers/obligationController';
import { authenticate } from '../middlewares/auth';
import { obligationValidators } from '../validators/obligationValidator';
import { handleValidation } from '../validators/validationMiddleware';

const router = Router();

const obligationController = new ObligationController({
  obligationService: {} as any,
  obligationRepository: {} as any,
  auditRepository: {} as any
});

router.post('/', authenticate, obligationValidators.create(), handleValidation, obligationController.create);
router.get('/', authenticate, obligationController.list);
router.get('/:id', authenticate, obligationController.getById);
router.get('/dashboard', authenticate, obligationController.getDashboard);
router.put('/:id/status', authenticate, obligationValidators.updateStatus(), handleValidation, obligationController.updateStatus);

export default router;
