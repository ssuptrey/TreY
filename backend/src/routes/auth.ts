import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticate, requireRole } from '../middlewares/auth';
import { authValidators } from '../validators/authValidator';
import { handleValidation } from '../validators/validationMiddleware';

import { AuthService } from '../services/authService';

const router = Router();

const authController = new AuthController({
  authService: new AuthService(),
  auditRepository: {} as any
});

router.post('/register', authenticate, requireRole('admin', 'system_admin'), authValidators.register, handleValidation, authController.register);
router.post('/login', authValidators.login, handleValidation, authController.login);
router.post('/change-password', authenticate, authValidators.changePassword, handleValidation, authController.changePassword);
router.post('/refresh', authController.refreshToken);
router.post('/force-password-reset', authenticate, requireRole('admin', 'system_admin'), authController.forcePasswordReset);
router.get('/me', authenticate, authController.getCurrentUser);

export default router;
