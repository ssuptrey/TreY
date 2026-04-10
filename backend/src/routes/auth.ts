import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { AuthService } from '../services/authService';
import { authenticate } from '../middlewares/auth';
import { pool } from '../config/database';
import { AuditRepository } from '../repositories/auditRepository';

const router = Router();
const authService = new AuthService();
const auditRepository = new AuditRepository(pool);
const authController = new AuthController({ authService, auditRepository });

router.post('/register', authController.register);
router.post('/login', authController.login);
/* @ts-ignore */
router.get('/me', authenticate, authController.me);
/* @ts-ignore */
router.post('/logout', authenticate, authController.logout);

export default router;
