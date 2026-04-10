import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/requests';

interface AuthControllerDeps {
  authService: any;
  auditRepository?: any;
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
      const result = await this.authService.login(email, password, req.ip, req.headers['user-agent']);
      if (!result.success) { res.status(401).json(result); return; }
      res.json(result);
    } catch (error) { next(error); }
  };

  register = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.register(req.body);
      if (!result.success) { res.status(400).json(result); return; }
      res.status(201).json(result);
    } catch (error) { next(error); }
  };

  changePassword = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { current_password, new_password } = req.body;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
      const result = await this.authService.changePassword(userId, current_password, new_password);
      if (!result.success) { res.status(400).json(result); return; }
      
      if (this.auditRepository) {
        await this.auditRepository.create({
          user_id: userId,
          action: 'PASSWORD_CHANGED',
          resource_type: 'user',
          resource_id: userId,
          metadata: { changed_at: new Date().toISOString() }
        });
      }
      res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) { next(error); }
  };

  refreshToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refresh_token } = req.body;
      const result = await this.authService.refreshToken(refresh_token);
      if (!result.success) { res.status(401).json(result); return; }
      res.json({ success: true, data: { token: result.token } });
    } catch (error) { next(error); }
  };

  forcePasswordReset = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user_id } = req.body;
      const adminId = req.user?.id;
      if (!adminId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }
      const result = await this.authService.forcePasswordReset(user_id);
      if (!result.success) { res.status(400).json(result); return; }
      
      if (this.auditRepository) {
        await this.auditRepository.create({
          user_id: adminId,
          action: 'FORCE_PASSWORD_RESET',
          resource_type: 'user',
          resource_id: user_id,
          metadata: { forced_by: adminId }
        });
      }
      res.json({ success: true, message: 'Password reset forced' });
    } catch (error) { next(error); }
  };

  me = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({
        user: {
          id: req.user!.id,
          email: req.user!.email,
          name: req.user!.name,
          role: req.user!.role,
          organizationId: req.user!.organization_id,
          organizationName: req.user!.organization_name,
          organizationType: req.user!.organization_type
        }
      });
    } catch (error) { next(error); }
  };

  logout = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.authService.logout(req.user!.id, req.ip, req.headers['user-agent']);
      if (!result.success) { res.status(500).json(result); return; }
      res.json({ message: 'Logged out successfully' });
    } catch (error) { next(error); }
  };
}
