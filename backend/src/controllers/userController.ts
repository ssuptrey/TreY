// User Controller - Request/Response handling for user management
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/requests';

interface UserControllerDeps {
  userService: any;
  userRepository: any;
  auditRepository: any;
}

export class UserController {
  private userService: any;
  private userRepository: any;
  private auditRepository: any;

  constructor(deps: UserControllerDeps) {
    this.userService = deps.userService;
    this.userRepository = deps.userRepository;
    this.auditRepository = deps.auditRepository;
  }

  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const adminId = req.user?.id;

      if (!adminId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { email, password, full_name, organization_id, role } = req.body;

      const result = await this.userService.create({
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

      await this.auditRepository.create({
        user_id: adminId,
        action: 'USER_CREATED',
        resource_type: 'user',
        resource_id: result.user.id,
        metadata: { email, role, organization_id }
      });

      res.status(201).json({
        success: true,
        data: result.user,
        message: 'User created successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const organizationId = req.user?.organization_id;

      if (!organizationId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const users = await this.userRepository.findByOrganization(organizationId);

      // Remove sensitive fields
      const sanitizedUsers = users.map((user: any) => ({
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        is_locked: user.is_locked,
        created_at: user.created_at
      }));

      res.json({
        success: true,
        data: sanitizedUsers
      });
    } catch (error) {
      next(error);
    }
  };

  lock = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const adminId = req.user?.id;

      if (!adminId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      await this.userRepository.lockUser(id);

      await this.auditRepository.create({
        user_id: adminId,
        action: 'USER_LOCKED',
        resource_type: 'user',
        resource_id: id,
        metadata: { locked_by: adminId }
      });

      res.json({
        success: true,
        message: 'User locked successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  unlock = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const adminId = req.user?.id;

      if (!adminId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      await this.userRepository.unlockUser(id);

      await this.auditRepository.create({
        user_id: adminId,
        action: 'USER_UNLOCKED',
        resource_type: 'user',
        resource_id: id,
        metadata: { unlocked_by: adminId }
      });

      res.json({
        success: true,
        message: 'User unlocked successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  updateRole = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      const adminId = req.user?.id;

      if (!adminId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const validRoles = ['admin', 'manager', 'operator'];
      if (!validRoles.includes(role)) {
        res.status(400).json({ success: false, error: 'Invalid role' });
        return;
      }

      await this.userRepository.updateRole(id, role);

      await this.auditRepository.create({
        user_id: adminId,
        action: 'USER_ROLE_UPDATED',
        resource_type: 'user',
        resource_id: id,
        metadata: { new_role: role, updated_by: adminId }
      });

      res.json({
        success: true,
        message: 'User role updated successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  getPasswordRules = async (_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Password rules per rulebook
      res.json({
        success: true,
        data: {
          min_length: 12,
          require_uppercase: true,
          require_lowercase: true,
          require_number: true,
          require_special: true,
          expiry_days: 90,
          history_count: 5,
          lockout_attempts: 5
        }
      });
    } catch (error) {
      next(error);
    }
  };
}
