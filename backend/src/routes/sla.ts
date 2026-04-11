import { Router } from 'express';
import { SLAController } from '../controllers/slaController';
import { authenticate } from '../middlewares/auth';
import { slaValidators } from '../validators/slaValidator';
import { handleValidation } from '../validators/validationMiddleware';

const router = Router();

const slaController = new SLAController({
  slaService: {} as any,
  slaRepository: {} as any,
  auditRepository: {} as any
});

router.post('/', authenticate, slaValidators.create(), handleValidation, slaController.create);
router.post('/extend', authenticate, slaValidators.extend(), handleValidation, slaController.extend);
router.get('/obligation/:obligationId', authenticate, slaController.getByObligation);
router.get('/active', authenticate, slaController.getActive);

export default router;
