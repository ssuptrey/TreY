import { Router } from 'express';
import { UserController } from '../controllers/userController';
import { authenticate, requireRole } from '../middlewares/auth';
import { userValidators } from '../validators/userValidator';
import { handleValidation } from '../validators/validationMiddleware';

const router = Router();

const userController = new UserController({
  userService: {} as any,
  userRepository: {} as any,
  auditRepository: {} as any
});

router.post('/', authenticate, requireRole('admin', 'system_admin'), userValidators.create(), handleValidation, userController.create);
router.get('/', authenticate, requireRole('admin', 'system_admin', 'manager'), userController.list);
router.put('/:id/lock', authenticate, requireRole('admin', 'system_admin'), userValidators.lock(), handleValidation, userController.lock);
router.put('/:id/unlock', authenticate, requireRole('admin', 'system_admin'), userValidators.unlock(), handleValidation, userController.unlock);
router.put('/:id/roles', authenticate, requireRole('admin', 'system_admin'), userValidators.updateRole(), handleValidation, userController.updateRole);
router.get('/password-rules', authenticate, userController.getPasswordRules);

export default router;
