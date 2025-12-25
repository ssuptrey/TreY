// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Middleware to verify JWT token and attach user to request
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'AUTHENTICATION_REQUIRED',
        message: 'No valid authentication token provided' 
      });
    }

    const token = authHeader.substring(7);
    
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ 
        error: 'INVALID_TOKEN',
        message: 'Token is invalid or expired' 
      });
    }

    // Fetch user from database to ensure they still exist and are active
    const userQuery = `
      SELECT u.id, u.email, u.name, u.role, u.organization_id, u.is_active,
             o.name as organization_name, o.type as organization_type
      FROM users u
      JOIN organizations o ON u.organization_id = o.id
      WHERE u.id = $1
    `;
    
    const result = await pool.query(userQuery, [decoded.userId]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ 
        error: 'USER_NOT_FOUND',
        message: 'User no longer exists' 
      });
    }

    const user = result.rows[0];
    
    if (!user.is_active) {
      return res.status(401).json({ 
        error: 'USER_INACTIVE',
        message: 'User account is inactive' 
      });
    }

    // Attach user and request metadata to req object
    req.user = user;
    req.ipAddress = req.ip || req.connection.remoteAddress;
    req.userAgent = req.headers['user-agent'];
    
    next();
  } catch (error) {
    console.error('[AUTH] Error:', error);
    return res.status(500).json({ 
      error: 'AUTH_ERROR',
      message: 'Authentication error' 
    });
  }
}

/**
 * Middleware to check if user has required role
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Must be authenticated' 
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'INSUFFICIENT_PERMISSIONS',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}` 
      });
    }

    next();
  };
}

/**
 * Middleware to ensure user can only access their organization's data
 */
function requireSameOrganization(paramName = 'organizationId') {
  return (req, res, next) => {
    const orgId = req.params[paramName] || req.body[paramName] || req.query[paramName];
    
    if (orgId && orgId !== req.user.organization_id) {
      return res.status(403).json({ 
        error: 'ORGANIZATION_MISMATCH',
        message: 'You can only access data from your own organization' 
      });
    }

    next();
  };
}

module.exports = {
  authenticate,
  requireRole,
  requireSameOrganization,
  JWT_SECRET
};
