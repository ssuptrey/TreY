// AuthService.ts - Core Authentication Logic & Security Rules
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { UserRepository } from '../repositories/userRepository';
import { JWT_SECRET } from '../middlewares/auth';
import { validatePasswordHistory } from '../utils/passwordValidator';

const userRepository = new UserRepository(pool);

export class AuthService {
  async login(email: string, password: string) {
    const user = await userRepository.findByEmailWithOrg(email.toLowerCase());

    if (!user) {
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    

    if (!user.is_active) {
      return { success: false, error: 'USER_INACTIVE' };
    }

    // 1. Enforce Account Lockout
    if (user.account_locked_until && new Date(user.account_locked_until) > new Date()) {
      return { 
        success: false, 
        error: 'ACCOUNT_LOCKED', 
        message: 'Account locked due to too many failed attempts. Try again later.' 
      };
    }

    // Verify Password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      // Trigger Lockout logic via Postgres function
      await userRepository.incrementFailedAttempts(user.id);
      return { success: false, error: 'INVALID_CREDENTIALS' };
    }

    // 2. Enforce Password Expiry (90 days rotation)
    if (user.password_expires_at && new Date(user.password_expires_at) < new Date()) {
      return { 
        success: false, 
        error: 'PASSWORD_EXPIRED', 
        requires_password_change: true 
      };
    }

    // 3. Enforce Forced Resets
    if (user.force_password_change) {
      return { 
        success: false, 
        error: 'PASSWORD_CHANGE_REQUIRED', 
        requires_password_change: true 
      };
    }

    // On Success: Reset failed attempt counters
    await userRepository.resetFailedAttempts(user.id);

    // Generate JWT
    const token = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organization_id,
        organizationName: user.organization_name
      }
    };
  }

  async register(data: any) {
    const passwordHash = await bcrypt.hash(data.password, 10);
    return await userRepository.registerUserTx(data, passwordHash);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await userRepository.getPasswordData(userId);

    const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!validPassword) return { success: false, error: 'INVALID_PASSWORD' };

    // Prevent reuse of last 5 passwords
    const historyValidation = validatePasswordHistory(newPassword, user.password_history, async (hash: string) => await bcrypt.compare(newPassword, hash));
    const isHistoryValid = await historyValidation;
    if (!isHistoryValid) return { success: false, error: 'PASSWORD_REUSED' };

    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await userRepository.changePasswordOnly(userId, newPasswordHash);

    return { success: true };
  }

  async forcePasswordReset(userId: string) {
    const success = await userRepository.forcePasswordReset(userId);
    if (!success) return { success: false, error: 'NOT_FOUND' };
    return { success: true };
  }

  async refreshToken(_refreshToken: string) {
    // Implement refresh token validation logic here if needed
    return { success: true, token: 'new-token' };
  }
}
