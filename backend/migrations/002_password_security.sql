-- ============================================
-- PASSWORD SECURITY ENHANCEMENT MIGRATION
-- ============================================
-- Adds password expiry and history tracking for NBFC compliance

-- Add password security columns to users table
ALTER TABLE users
ADD COLUMN password_expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '90 days'),
ADD COLUMN password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN force_password_change BOOLEAN DEFAULT false,
ADD COLUMN failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN account_locked_until TIMESTAMP,
ADD COLUMN password_history JSONB DEFAULT '[]'::jsonb;

-- Create index for password expiry checks
CREATE INDEX idx_users_password_expires ON users(password_expires_at) 
WHERE password_expires_at IS NOT NULL;

-- Create index for locked accounts
CREATE INDEX idx_users_locked ON users(account_locked_until) 
WHERE account_locked_until IS NOT NULL;

-- ============================================
-- TRIGGER: Update password_changed_at on password change
-- ============================================
CREATE OR REPLACE FUNCTION update_password_changed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if password actually changed
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    NEW.password_changed_at = CURRENT_TIMESTAMP;
    NEW.password_expires_at = CURRENT_TIMESTAMP + INTERVAL '90 days';
    NEW.force_password_change = false;
    NEW.failed_login_attempts = 0;
    NEW.account_locked_until = NULL;
    
    -- Add old password to history (keep last 5)
    NEW.password_history = (
      SELECT jsonb_agg(elem)
      FROM (
        SELECT elem
        FROM jsonb_array_elements_text(NEW.password_history) elem
        UNION ALL
        SELECT OLD.password_hash
        ORDER BY elem DESC
        LIMIT 5
      ) subq
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_password_changed_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  WHEN (NEW.password_hash IS DISTINCT FROM OLD.password_hash)
  EXECUTE FUNCTION update_password_changed_at();

-- ============================================
-- FUNCTION: Check if password is expired
-- ============================================
CREATE OR REPLACE FUNCTION is_password_expired(user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  expires_at TIMESTAMP;
BEGIN
  SELECT password_expires_at INTO expires_at
  FROM users
  WHERE id = user_id;
  
  RETURN expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Lock account after failed login attempts
-- ============================================
CREATE OR REPLACE FUNCTION increment_failed_login(user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  new_attempts INTEGER;
BEGIN
  UPDATE users
  SET 
    failed_login_attempts = failed_login_attempts + 1,
    account_locked_until = CASE 
      WHEN failed_login_attempts + 1 >= 5 THEN CURRENT_TIMESTAMP + INTERVAL '30 minutes'
      ELSE account_locked_until
    END
  WHERE id = user_id
  RETURNING failed_login_attempts INTO new_attempts;
  
  RETURN new_attempts;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- FUNCTION: Reset failed login attempts on successful login
-- ============================================
CREATE OR REPLACE FUNCTION reset_failed_login(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE users
  SET 
    failed_login_attempts = 0,
    account_locked_until = NULL
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- AUDIT LOG: Track password changes
-- ============================================
CREATE OR REPLACE FUNCTION audit_password_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    INSERT INTO audit_logs (
      action,
      entity_type,
      entity_id,
      user_id,
      details
    ) VALUES (
      'PASSWORD_CHANGED',
      'USER',
      NEW.id,
      NEW.id,
      jsonb_build_object(
        'expires_at', NEW.password_expires_at,
        'forced_change', OLD.force_password_change
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_password_change
  AFTER UPDATE ON users
  FOR EACH ROW
  WHEN (NEW.password_hash IS DISTINCT FROM OLD.password_hash)
  EXECUTE FUNCTION audit_password_change();

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON COLUMN users.password_expires_at IS 'When password expires (90 days for NBFC compliance)';
COMMENT ON COLUMN users.password_changed_at IS 'When password was last changed';
COMMENT ON COLUMN users.force_password_change IS 'Force user to change password on next login';
COMMENT ON COLUMN users.failed_login_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN users.account_locked_until IS 'Account locked until this timestamp (after 5 failed attempts)';
COMMENT ON COLUMN users.password_history IS 'JSONB array of last 5 password hashes to prevent reuse';
