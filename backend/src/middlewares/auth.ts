// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';

export const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Extend Express Request type
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  organization_id: string;
  is_active: boolean;
  organization_name?: string;
  organization_type?: string;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
  ipAddress?: string;
  userAgent?: string;
}

interface JwtPayload {
  userId: string;
}

/**
 * Middleware to verify JWT token and attach user to request
 */
export async function authenticate(
  req: AuthRequest, 
  res: Response, 
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ 
        error: 'AUTHENTICATION_REQUIRED',
        message: 'No valid authentication token provided' 
      });
      return;
    }

    const token = authHeader.substring(7);
    
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch (err) {
      res.status(401).json({ 
        error: 'INVALID_TOKEN',
        message: 'Token is invalid or expired' 
      });
      return;
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
      res.status(401).json({ 
        error: 'USER_NOT_FOUND',
        message: 'User no longer exists' 
      });
      return;
    }

    const user = result.rows[0] as AuthenticatedUser;
    
    if (!user.is_active) {
      res.status(401).json({ 
        error: 'USER_INACTIVE',
        message: 'User account is inactive' 
      });
      return;
    }

    // Attach user and request metadata to req object
    req.user = user;
    req.ipAddress = req.ip || (req.socket?.remoteAddress ?? undefined);
    req.userAgent = req.headers['user-agent'];
    
    next();
  } catch (error) {
    console.error('[AUTH] Error:', error);
    res.status(500).json({ 
      error: 'AUTH_ERROR',
      message: 'Authentication error' 
    });
  }
}

/**
 * Middleware to check if user has required role
 * RBAC: Admin > Manager > Operator
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ 
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Must be authenticated' 
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ 
        error: 'INSUFFICIENT_PERMISSIONS',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}` 
      });
      return;
    }

    next();
  };
}

/**
 * Middleware to ensure user can only access their organization's data
 */
export function requireSameOrganization(paramName: string = 'organizationId') {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const orgId = req.params[paramName] || req.body[paramName] || req.query[paramName];
    
    if (orgId && orgId !== req.user?.organization_id) {
      res.status(403).json({ 
        error: 'ORGANIZATION_MISMATCH',
        message: 'You can only access data from your own organization' 
      });
      return;
    }

    next();
  };
}
