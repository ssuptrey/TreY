import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { SLAController } from '../controllers/slaController';

const router = Router();
const slaController = new SLAController();

router.post('/:obligationId/extend', authenticate, slaController.extend);
router.get('/:obligationId/history', authenticate, slaController.getHistory);
router.get('/dashboard/risk', authenticate, slaController.getDashboardRisk);

export default router;