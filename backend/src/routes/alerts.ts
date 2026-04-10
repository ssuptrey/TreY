import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { AlertController } from '../controllers/alertController';
import * as alertService from '../services/alertService';

const router = Router();
const alertController = new AlertController({ alertService });

router.get('/:obligationId/history', authenticate, alertController.getHistory);
router.post('/:obligationId/manual', authenticate, alertController.sendManual);
router.post('/trigger-job', authenticate, alertController.triggerJob);

export default router;