// Repository Index - Export all repositories
import { Pool } from 'pg';
import { UserRepository } from './userRepository';
import { ObligationRepository } from './obligationRepository';
import { SLARepository } from './slaRepository';
import { EvidenceRepository } from './evidenceRepository';
import { AuditRepository } from './auditRepository';
import { OrganizationRepository } from './organizationRepository';
import { ObligationOwnerRepository } from './obligationOwnerRepository';

export class Repositories {
  public users: UserRepository;
  public obligations: ObligationRepository;
  public slas: SLARepository;
  public evidence: EvidenceRepository;
  public audit: AuditRepository;
  public organizations: OrganizationRepository;
  public obligationOwners: ObligationOwnerRepository;

  constructor(pool: Pool) {
    this.users = new UserRepository(pool);
    this.obligations = new ObligationRepository(pool);
    this.slas = new SLARepository(pool);
    this.evidence = new EvidenceRepository(pool);
    this.audit = new AuditRepository(pool);
    this.organizations = new OrganizationRepository(pool);
    this.obligationOwners = new ObligationOwnerRepository(pool);
  }
}

export {
  UserRepository,
  ObligationRepository,
  SLARepository,
  EvidenceRepository,
  AuditRepository,
  OrganizationRepository,
  ObligationOwnerRepository
};
