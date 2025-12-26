// ============================================
// PASSWORD VALIDATION UTILITY
// ============================================
// Enforces strong password policies for NBFC security standards

export interface PasswordConfig {
  MIN_LENGTH: number;
  REQUIRE_UPPERCASE: boolean;
  REQUIRE_LOWERCASE: boolean;
  REQUIRE_NUMBER: boolean;
  REQUIRE_SPECIAL: boolean;
  SPECIAL_CHARS: string;
  MAX_REPEATED_CHARS: number;
  COMMON_PASSWORDS: string[];
}

export const PASSWORD_CONFIG: PasswordConfig = {
  MIN_LENGTH: 12,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBER: true,
  REQUIRE_SPECIAL: true,
  SPECIAL_CHARS: '!@#$%^&*()_+-=[]{}|;:,.<>?',
  MAX_REPEATED_CHARS: 3,
  COMMON_PASSWORDS: [
    'password', 'password123', 'admin123', 'welcome123',
    'company123', 'user1234', 'test1234', 'qwerty123',
    '12345678', '123456789', '1234567890', 'abc123456'
  ]
};

export interface PasswordValidationResult {
  valid: boolean;
  errors: string[];
}

export interface PasswordStrengthResult {
  score: number;
  strength: 'Weak' | 'Moderate' | 'Strong' | 'Very Strong';
}

/**
 * Validates password against security requirements
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];

  // Check minimum length
  if (!password || password.length < PASSWORD_CONFIG.MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_CONFIG.MIN_LENGTH} characters long`);
  }

  // Check for uppercase letters
  if (PASSWORD_CONFIG.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Check for lowercase letters
  if (PASSWORD_CONFIG.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Check for numbers
  if (PASSWORD_CONFIG.REQUIRE_NUMBER && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Check for special characters
  if (PASSWORD_CONFIG.REQUIRE_SPECIAL) {
    const specialRegex = new RegExp(`[${PASSWORD_CONFIG.SPECIAL_CHARS.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]`);
    if (!specialRegex.test(password)) {
      errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
    }
  }

  // Check for repeated characters
  const repeatedRegex = new RegExp(`(.)\\1{${PASSWORD_CONFIG.MAX_REPEATED_CHARS},}`);
  if (repeatedRegex.test(password)) {
    errors.push(`Password cannot contain more than ${PASSWORD_CONFIG.MAX_REPEATED_CHARS} repeated characters in a row`);
  }

  // Check against common passwords (case-insensitive)
  if (PASSWORD_CONFIG.COMMON_PASSWORDS.includes(password.toLowerCase())) {
    errors.push('Password is too common. Please choose a stronger password');
  }

  // Check for sequential characters (123, abc, etc.)
  if (hasSequentialChars(password)) {
    errors.push('Password cannot contain sequential characters (e.g., 123, abc)');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Checks if password contains sequential characters
 */
function hasSequentialChars(password: string): boolean {
  const sequences = ['0123456789', 'abcdefghijklmnopqrstuvwxyz'];
  const lowerPassword = password.toLowerCase();

  for (const sequence of sequences) {
    for (let i = 0; i < sequence.length - 3; i++) {
      const seq = sequence.substring(i, i + 4);
      const reverseSeq = seq.split('').reverse().join('');
      
      if (lowerPassword.includes(seq) || lowerPassword.includes(reverseSeq)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Validates password against history (prevent reuse)
 */
export async function validatePasswordHistory(
  newPassword: string, 
  passwordHistory: string[], 
  compareFunc: (password: string, hash: string) => Promise<boolean>
): Promise<boolean> {
  if (!passwordHistory || passwordHistory.length === 0) {
    return true;
  }

  // Check against last 5 passwords
  const recentPasswords = passwordHistory.slice(-5);
  
  for (const oldHash of recentPasswords) {
    const isReused = await compareFunc(newPassword, oldHash);
    if (isReused) {
      return false;
    }
  }

  return true;
}

/**
 * Calculates password strength score (0-100)
 */
export function calculatePasswordStrength(password: string): PasswordStrengthResult {
  let score = 0;

  // Length bonus (up to 40 points)
  score += Math.min(password.length * 2, 40);

  // Character variety (up to 40 points)
  if (/[a-z]/.test(password)) score += 10;
  if (/[A-Z]/.test(password)) score += 10;
  if (/[0-9]/.test(password)) score += 10;
  if (/[^a-zA-Z0-9]/.test(password)) score += 10;

  // No repeated characters (10 points)
  if (!/(.)\1{2,}/.test(password)) score += 10;

  // No sequential characters (10 points)
  if (!hasSequentialChars(password)) score += 10;

  let strength: PasswordStrengthResult['strength'] = 'Weak';
  if (score >= 80) strength = 'Very Strong';
  else if (score >= 60) strength = 'Strong';
  else if (score >= 40) strength = 'Moderate';

  return { score, strength };
}

/**
 * Generates password requirements message for users
 */
export function getPasswordRequirements(): string {
  return `Password must:
- Be at least ${PASSWORD_CONFIG.MIN_LENGTH} characters long
- Contain at least one uppercase letter (A-Z)
- Contain at least one lowercase letter (a-z)
- Contain at least one number (0-9)
- Contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
- Not contain more than ${PASSWORD_CONFIG.MAX_REPEATED_CHARS} repeated characters in a row
- Not contain sequential characters (e.g., 123, abc)
- Not be a common password`;
}
