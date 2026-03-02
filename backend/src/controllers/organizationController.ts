// Organization Controller - Request/Response handling for organization operations
import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/requests';

interface OrganizationControllerDeps {
  organizationRepository: any;
  auditRepository: any;
}

export class OrganizationController {
  private organizationRepository: any;
  private auditRepository: any;

  constructor(deps: OrganizationControllerDeps) {
    this.organizationRepository = deps.organizationRepository;
    this.auditRepository = deps.auditRepository;
  }

  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' });
        return;
      }

      const { name } = req.body;

      // Check if organization already exists
      const existing = await this.organizationRepository.findByName(name);
      if (existing) {
        res.status(400).json({ success: false, error: 'Organization already exists' });
        return;
      }

      const organization = await this.organizationRepository.create(name);

      await this.auditRepository.create({
        user_id: userId,
        action: 'ORGANIZATION_CREATED',
        resource_type: 'organization',
        resource_id: organization.id,
        metadata: { name }
      });

      res.status(201).json({
        success: true,
        data: organization,
        message: 'Organization created successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  list = async (_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const organizations = await this.organizationRepository.findAll();

      res.json({
        success: true,
        data: organizations
      });
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      const organization = await this.organizationRepository.findById(id);

      if (!organization) {
        res.status(404).json({ success: false, error: 'Organization not found' });
        return;
      }

      res.json({
        success: true,
        data: organization
      });
    } catch (error) {
      next(error);
    }
  };
}
