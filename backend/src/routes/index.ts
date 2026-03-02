// ============================================
// ROUTES INDEX
// ============================================
// Central export for all route modules

import authRoutes from './auth';
import obligationsRoutes from './obligations';
import slaRoutes from './sla';
import evidenceRoutes from './evidence';
import exportRoutes from './export';
import usersRoutes from './users';
import alertsRoutes from './alerts';
import ingestionRoutes from './ingestion';

export {
  authRoutes,
  obligationsRoutes,
  slaRoutes,
  evidenceRoutes,
  exportRoutes,
  usersRoutes,
  alertsRoutes,
  ingestionRoutes
};
