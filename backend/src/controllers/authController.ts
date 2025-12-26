// Auth Controller - Request/Response handling for authentication
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/requests';

// Controller interface for dependency injection
interface AuthControllerDeps {
  authService: any;
  auditRepository: any;
}

export class AuthController {
  private authService: any;
  private auditRepository: any;

  constructor(deps: AuthControllerDeps) {
    this.authService = deps.authService;
    this.auditRepository = deps.auditRepository;
  }

  login = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      
      const result = await this.authService.login(email, password);
      
      if (!result.success) {
        res.status(401).json({ success: false, error: result.error });
        return;
      }

      res.json({
        success: true,
        data: {
          token: result.token,
          user: result.user
        }
      });
    } catch (error) {
      next(error);
    }
  };

  register = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password, full_name, organization_id, role } = req.body;
      
      const result = await this.authService.register({
        email,
        password,
        full_name,
        organization_id,
        role
      });

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      res.status(201).json({
        success: true,
        data: result.user,
        message: 'User registered successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { current_password, new_password } = req.body;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const result = await this.authService.changePassword(userId, current_password, new_password);

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      await this.auditRepository.create({
        user_id: userId,
        action: 'PASSWORD_CHANGED',
        resource_type: 'user',
        resource_id: userId,
        metadata: { changed_at: new Date().toISOString() }
      });

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  refreshToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refresh_token } = req.body;
      
      const result = await this.authService.refreshToken(refresh_token);

      if (!result.success) {
        res.status(401).json({ success: false, error: result.error });
        return;
      }

      res.json({
        success: true,
        data: { token: result.token }
      });
    } catch (error) {
      next(error);
    }
  };

  forcePasswordReset = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user_id } = req.body;
      const adminId = req.user?.id;

      if (!adminId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const result = await this.authService.forcePasswordReset(user_id);

      if (!result.success) {
        res.status(400).json({ success: false, error: result.error });
        return;
      }

      await this.auditRepository.create({
        user_id: adminId,
        action: 'FORCE_PASSWORD_RESET',
        resource_type: 'user',
        resource_id: user_id,
        metadata: { forced_by: adminId }
      });

      res.json({
        success: true,
        message: 'Password reset forced successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  getCurrentUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      res.json({
        success: true,
        data: req.user
      });
    } catch (error) {
      next(error);
    }
  };
}
