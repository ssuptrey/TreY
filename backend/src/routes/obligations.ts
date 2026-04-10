import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { ObligationController } from '../controllers/obligationController';

const router = Router();
const obligationController = new ObligationController();

router.post('/', authenticate, obligationController.create);
router.get('/', authenticate, obligationController.list);
router.get('/:id', authenticate, obligationController.getById);
router.patch('/:id/status', authenticate, obligationController.updateStatus);
router.post('/:id/reassign', authenticate, obligationController.reassignOwner);

export default router;