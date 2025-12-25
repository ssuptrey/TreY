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

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');

// Import routes
const authRoutes = require('./routes/auth');
const obligationsRoutes = require('./routes/obligations');
const slaRoutes = require('./routes/sla');
const evidenceRoutes = require('./routes/evidence');
const exportRoutes = require('./routes/export');
const usersRoutes = require('./routes/users');
const alertsRoutes = require('./routes/alerts');

// Import cron jobs
const { startSLAAlertJob } = require('./jobs/slaAlertJob');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
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
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
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
app.use('/api/alerts', alertsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  
  // Check for enforcement violations
  if (err.message && err.message.includes('ENFORCEMENT VIOLATION')) {
    return res.status(400).json({
      error: 'ENFORCEMENT_VIOLATION',
      message: err.message
    });
  }
  
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' 
      ? 'An internal error occurred' 
      : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: 'Endpoint not found'
  });
});

// Start server
app.listen(PORT, () => {
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

module.exports = app;
