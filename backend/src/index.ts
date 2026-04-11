// ============================================
// COMPLIANCE EXECUTION SYSTEM - MAIN SERVER
// ============================================
// System of Record for Compliance Execution
// 
// CORE PRINCIPLE ENFORCEMENT:
// 1. Every obligation has exactly ONE owner
// 2. Every obligation has a fixed SLA date
// 3. All timestamps are immutable
// 4. Evidence must be attached BEFORE deadline
// 5. ALL actions generate audit logs - NO EXCEPTIONS

import dotenv from 'dotenv';
dotenv.config();

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// Import routes (will be converted to TypeScript)
import authRoutes from './routes/auth';
import obligationsRoutes from './routes/obligations';
import slaRoutes from './routes/sla';
import evidenceRoutes from './routes/evidence';
import exportRoutes from './routes/export';
import usersRoutes from './routes/users';
import alertsRoutes from './routes/alerts';
import auditRoutes from './routes/audit';
import organizationsRoutes from './routes/organizations';
import obligationOwnersRoutes from './routes/obligation-owners';

// Import cron jobs
import { startSLAAlertJob } from './jobs/slaAlertJob';

const app: Express = express();
const PORT: number = parseInt(process.env.PORT || '3001', 10);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting - Per rulebook: 100 req / 15 min general, 5 req / 15 min auth
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
});

// Apply rate limiting
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (for debugging)
app.use((req: Request, _res: Response, next: NextFunction): void => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (_req: Request, res: Response): void => {
  res.json({ 
    status: 'healthy',
    service: 'Compliance Execution System',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/obligations', obligationsRoutes);
app.use('/api/sla', slaRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/alerts', alertsRoutes);app.use('/api/audit', auditRoutes);
app.use('/api/organizations', organizationsRoutes);
app.use('/api/obligation-owners', obligationOwnersRoutes);
// Error handling middleware
interface ErrorWithMessage extends Error {
  message: string;
}

app.use((err: ErrorWithMessage, _req: Request, res: Response, _next: NextFunction): void => {
  console.error('[ERROR]', err);
  
  // Check for enforcement violations
  if (err.message && err.message.includes('ENFORCEMENT VIOLATION')) {
    res.status(400).json({
      error: 'ENFORCEMENT_VIOLATION',
      message: err.message
    });
    return;
  }
  
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' 
      ? 'An internal error occurred' 
      : err.message
  });
});

// 404 handler
app.use((_req: Request, res: Response): void => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, (): void => {
  console.log('============================================');
  console.log('COMPLIANCE EXECUTION SYSTEM - BACKEND');
  console.log('============================================');
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
  console.log('ENFORCEMENT RULES ACTIVE:');
  console.log('- Obligations cannot be deleted');
  console.log('- Owners are append-only (reassignment creates new record)');
  console.log('- SLAs are append-only (extensions create new record)');
  console.log('- Evidence is immutable after upload');
  console.log('- Late evidence is automatically flagged');
  console.log('- ALL actions generate audit logs');
  console.log('============================================');
  
  // Start SLA alert cron job
  console.log('');
  console.log('STARTING BACKGROUND JOBS...');
  startSLAAlertJob();
  console.log('============================================');
});

export default app;
