import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticate } from '../middlewares/auth';
import { authValidators } from '../validators/authValidator';
import { handleValidation } from '../validators/validationMiddleware';

const router = Router();

const authController = new AuthController({
  authService: {} as any,
  auditRepository: {} as any
});

router.post('/register', authValidators.register, handleValidation, authController.register);
router.post('/login', authValidators.login, handleValidation, authController.login);
router.post('/change-password', authenticate, authValidators.changePassword, handleValidation, authController.changePassword);
router.post('/refresh', authController.refreshToken);
router.post('/force-password-reset', authenticate, authController.forcePasswordReset);
router.get('/me', authenticate, authController.getCurrentUser);

export default router;
