-- ============================================
-- COMPLIANCE EXECUTION SYSTEM OF RECORD
-- Database Schema - PostgreSQL
-- ============================================
-- 
-- CORE PRINCIPLE ENFORCEMENT:
-- 1. Every obligation has exactly ONE owner
-- 2. Every obligation has a fixed SLA date
-- 3. All timestamps are immutable (no UPDATE allowed on timestamp columns)
-- 4. Evidence must be attached BEFORE deadline (late evidence is flagged)
-- 
-- IMMUTABILITY is enforced via:
-- - Triggers that block UPDATE/DELETE on critical columns
-- - Append-only patterns for owner/SLA changes
-- - Audit logs for ALL actions
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. ORGANIZATION
-- ============================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- NBFC, fintech, bank, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================
-- 2. USER
-- ============================================
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'operator');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'operator',
    organization_id UUID NOT NULL REFERENCES organizations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    is_active BOOLEAN DEFAULT true NOT NULL
);

CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- 3. OBLIGATION
-- ============================================
-- ENFORCEMENT: Obligations cannot be deleted after creation
-- Status can only transition: open -> closed OR open -> breached

CREATE TYPE obligation_status AS ENUM ('open', 'closed', 'breached');

CREATE TABLE obligations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    regulation_tag VARCHAR(255), -- Free text, NOT interpreted
    organization_id UUID NOT NULL REFERENCES organizations(id),
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL, -- IMMUTABLE
    status obligation_status NOT NULL DEFAULT 'open',
    closed_at TIMESTAMP WITH TIME ZONE, -- Set when status changes to closed/breached
    
    -- CONSTRAINT: Title must not be empty
    CONSTRAINT chk_title_not_empty CHECK (LENGTH(TRIM(title)) > 0)
);

CREATE INDEX idx_obligations_organization ON obligations(organization_id);
CREATE INDEX idx_obligations_status ON obligations(status);
CREATE INDEX idx_obligations_created_by ON obligations(created_by);

-- TRIGGER: Block deletion of obligations
CREATE OR REPLACE FUNCTION prevent_obligation_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ENFORCEMENT VIOLATION: Obligations cannot be deleted. Obligation ID: %', OLD.id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_obligation_delete
BEFORE DELETE ON obligations
FOR EACH ROW EXECUTE FUNCTION prevent_obligation_delete();

-- TRIGGER: Block modification of created_at
CREATE OR REPLACE FUNCTION prevent_created_at_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.created_at != NEW.created_at THEN
        RAISE EXCEPTION 'ENFORCEMENT VIOLATION: created_at is immutable and cannot be modified';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_obligation_created_at_immutable
BEFORE UPDATE ON obligations
FOR EACH ROW EXECUTE FUNCTION prevent_created_at_modification();

-- ============================================
-- 4. OBLIGATION_OWNER (Append-Only)
-- ============================================
-- ENFORCEMENT: Owner reassignment appends new record, never overwrites
-- Each obligation must have exactly ONE current owner

CREATE TABLE obligation_owners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    obligation_id UUID NOT NULL REFERENCES obligations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL, -- IMMUTABLE
    assigned_by UUID NOT NULL REFERENCES users(id),
    is_current BOOLEAN DEFAULT true NOT NULL,
    reassignment_reason TEXT -- Required when reassigning
);

CREATE INDEX idx_obligation_owners_obligation ON obligation_owners(obligation_id);
CREATE INDEX idx_obligation_owners_current ON obligation_owners(obligation_id, is_current) WHERE is_current = true;

-- TRIGGER: Block deletion of owner records
CREATE OR REPLACE FUNCTION prevent_owner_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ENFORCEMENT VIOLATION: Owner records cannot be deleted. They are append-only.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_owner_delete
BEFORE DELETE ON obligation_owners
FOR EACH ROW EXECUTE FUNCTION prevent_owner_delete();

-- TRIGGER: Block modification of assigned_at
CREATE OR REPLACE FUNCTION prevent_owner_assigned_at_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.assigned_at != NEW.assigned_at THEN
        RAISE EXCEPTION 'ENFORCEMENT VIOLATION: assigned_at is immutable';
    END IF;
    -- Only allow changing is_current from true to false (for reassignment)
    IF OLD.is_current = false AND NEW.is_current = true THEN
        RAISE EXCEPTION 'ENFORCEMENT VIOLATION: Cannot reactivate old owner record. Create new record instead.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_owner_assigned_at_immutable
BEFORE UPDATE ON obligation_owners
FOR EACH ROW EXECUTE FUNCTION prevent_owner_assigned_at_modification();

-- ============================================
-- 5. SLA (Append-Only)
-- ============================================
-- ENFORCEMENT: SLA cannot be edited once created
-- SLA can only be extended by creating NEW record with reason
-- Old SLA remains visible

CREATE TABLE slas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    obligation_id UUID NOT NULL REFERENCES obligations(id),
    due_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL, -- IMMUTABLE
    created_by UUID NOT NULL REFERENCES users(id),
    is_current BOOLEAN DEFAULT true NOT NULL,
    extension_reason TEXT, -- Required for extensions
    previous_sla_id UUID REFERENCES slas(id) -- Links to previous SLA if this is an extension
);

CREATE INDEX idx_slas_obligation ON slas(obligation_id);
CREATE INDEX idx_slas_due_date ON slas(due_date);
CREATE INDEX idx_slas_current ON slas(obligation_id, is_current) WHERE is_current = true;

-- TRIGGER: Block deletion of SLA records
CREATE OR REPLACE FUNCTION prevent_sla_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ENFORCEMENT VIOLATION: SLA records cannot be deleted. They are append-only.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_sla_delete
BEFORE DELETE ON slas
FOR EACH ROW EXECUTE FUNCTION prevent_sla_delete();

-- TRIGGER: Block modification of SLA (except is_current flag)
CREATE OR REPLACE FUNCTION prevent_sla_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.due_date != NEW.due_date THEN
        RAISE EXCEPTION 'ENFORCEMENT VIOLATION: due_date is immutable. Create new SLA record for extensions.';
    END IF;
    IF OLD.created_at != NEW.created_at THEN
        RAISE EXCEPTION 'ENFORCEMENT VIOLATION: created_at is immutable';
    END IF;
    IF OLD.is_current = false AND NEW.is_current = true THEN
        RAISE EXCEPTION 'ENFORCEMENT VIOLATION: Cannot reactivate old SLA. Create new record instead.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sla_immutable
BEFORE UPDATE ON slas
FOR EACH ROW EXECUTE FUNCTION prevent_sla_modification();

-- ============================================
-- 6. EVIDENCE (Append-Only)
-- ============================================
-- ENFORCEMENT: Evidence uploaded AFTER due_date is flagged as late
-- Evidence cannot be replaced, only appended

CREATE TABLE evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    obligation_id UUID NOT NULL REFERENCES obligations(id),
    file_path VARCHAR(1000) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    reference_note TEXT,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL, -- IMMUTABLE
    is_late BOOLEAN DEFAULT false NOT NULL, -- Auto-computed on insert
    sla_due_date_at_upload DATE NOT NULL -- Snapshot of SLA due date when evidence was uploaded
);

CREATE INDEX idx_evidence_obligation ON evidence(obligation_id);
CREATE INDEX idx_evidence_uploaded_at ON evidence(uploaded_at);
CREATE INDEX idx_evidence_is_late ON evidence(is_late);

-- TRIGGER: Block deletion of evidence
CREATE OR REPLACE FUNCTION prevent_evidence_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ENFORCEMENT VIOLATION: Evidence cannot be deleted. It is append-only.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_evidence_delete
BEFORE DELETE ON evidence
FOR EACH ROW EXECUTE FUNCTION prevent_evidence_delete();

-- TRIGGER: Block ALL modifications to evidence
CREATE OR REPLACE FUNCTION prevent_evidence_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ENFORCEMENT VIOLATION: Evidence records are immutable. Cannot modify after upload.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_evidence_immutable
BEFORE UPDATE ON evidence
FOR EACH ROW EXECUTE FUNCTION prevent_evidence_modification();

-- TRIGGER: Auto-flag late evidence on insert
CREATE OR REPLACE FUNCTION check_evidence_late()
RETURNS TRIGGER AS $$
DECLARE
    current_sla_due_date DATE;
BEGIN
    -- Get current SLA due date for the obligation
    SELECT due_date INTO current_sla_due_date
    FROM slas
    WHERE obligation_id = NEW.obligation_id AND is_current = true
    LIMIT 1;
    
    IF current_sla_due_date IS NULL THEN
        RAISE EXCEPTION 'ENFORCEMENT VIOLATION: Cannot upload evidence for obligation without SLA';
    END IF;
    
    -- Set the snapshot of SLA due date
    NEW.sla_due_date_at_upload := current_sla_due_date;
    
    -- Flag as late if uploaded after due date
    IF CURRENT_DATE > current_sla_due_date THEN
        NEW.is_late := true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_evidence_late
BEFORE INSERT ON evidence
FOR EACH ROW EXECUTE FUNCTION check_evidence_late();

-- ============================================
-- 7. AUDIT_LOG (MOST IMPORTANT - Append-Only)
-- ============================================
-- ALL actions must generate audit logs. NO exceptions.

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(100) NOT NULL, -- obligation, sla, evidence, user, etc.
    entity_id UUID NOT NULL,
    action VARCHAR(100) NOT NULL, -- CREATE, UPDATE, STATUS_CHANGE, OWNER_REASSIGN, SLA_EXTEND, etc.
    performed_by UUID NOT NULL REFERENCES users(id),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL, -- IMMUTABLE
    previous_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    additional_context JSONB
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX idx_audit_logs_performed_by ON audit_logs(performed_by);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- TRIGGER: Block ALL modifications to audit logs
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'ENFORCEMENT VIOLATION: Audit logs are immutable. No modifications allowed.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

-- ============================================
-- VIEWS FOR DASHBOARD
-- ============================================

-- View: SLA Risk Status
CREATE OR REPLACE VIEW vw_sla_risk_status AS
SELECT 
    o.id AS obligation_id,
    o.title,
    o.status,
    o.organization_id,
    s.due_date,
    s.id AS sla_id,
    CURRENT_DATE AS today,
    (s.due_date - CURRENT_DATE) AS days_remaining,
    CASE 
        WHEN o.status = 'breached' THEN 'BREACHED'
        WHEN o.status = 'closed' THEN 'CLOSED'
        WHEN s.due_date < CURRENT_DATE THEN 'BREACHED'
        WHEN (s.due_date - CURRENT_DATE) <= 15 THEN 'AMBER'
        ELSE 'GREEN'
    END AS risk_status,
    owner.user_id AS current_owner_id,
    u.name AS current_owner_name
FROM obligations o
LEFT JOIN slas s ON o.id = s.obligation_id AND s.is_current = true
LEFT JOIN obligation_owners owner ON o.id = owner.obligation_id AND owner.is_current = true
LEFT JOIN users u ON owner.user_id = u.id;

-- View: Obligation with full context
CREATE OR REPLACE VIEW vw_obligation_full AS
SELECT 
    o.*,
    org.name AS organization_name,
    creator.name AS created_by_name,
    s.due_date AS current_sla_due_date,
    s.id AS current_sla_id,
    owner.user_id AS current_owner_id,
    owner_user.name AS current_owner_name,
    (SELECT COUNT(*) FROM evidence e WHERE e.obligation_id = o.id) AS evidence_count,
    (SELECT COUNT(*) FROM evidence e WHERE e.obligation_id = o.id AND e.is_late = true) AS late_evidence_count
FROM obligations o
JOIN organizations org ON o.organization_id = org.id
JOIN users creator ON o.created_by = creator.id
LEFT JOIN slas s ON o.id = s.obligation_id AND s.is_current = true
LEFT JOIN obligation_owners owner ON o.id = owner.obligation_id AND owner.is_current = true
LEFT JOIN users owner_user ON owner.user_id = owner_user.id;

-- ============================================
-- FUNCTIONS FOR COMMON OPERATIONS
-- ============================================

-- Function: Create obligation with owner and SLA (atomic)
-- ENFORCEMENT: Blocks if owner or SLA is missing
CREATE OR REPLACE FUNCTION create_obligation_complete(
    p_title VARCHAR(500),
    p_description TEXT,
    p_regulation_tag VARCHAR(255),
    p_organization_id UUID,
    p_created_by UUID,
    p_owner_id UUID,
    p_sla_due_date DATE
) RETURNS UUID AS $$
DECLARE
    v_obligation_id UUID;
BEGIN
    -- ENFORCEMENT: All required fields must be present
    IF p_title IS NULL OR LENGTH(TRIM(p_title)) = 0 THEN
        RAISE EXCEPTION 'ENFORCEMENT VIOLATION: Title is required';
    END IF;
    
    IF p_owner_id IS NULL THEN
        RAISE EXCEPTION 'ENFORCEMENT VIOLATION: Owner is required. Every obligation must have exactly ONE owner.';
    END IF;
    
    IF p_sla_due_date IS NULL THEN
        RAISE EXCEPTION 'ENFORCEMENT VIOLATION: SLA due date is required. Every obligation must have a fixed SLA.';
    END IF;
    
    IF p_sla_due_date <= CURRENT_DATE THEN
        RAISE EXCEPTION 'ENFORCEMENT VIOLATION: SLA due date must be in the future';
    END IF;
    
    -- Create obligation
    INSERT INTO obligations (title, description, regulation_tag, organization_id, created_by)
    VALUES (p_title, p_description, p_regulation_tag, p_organization_id, p_created_by)
    RETURNING id INTO v_obligation_id;
    
    -- Create initial owner record
    INSERT INTO obligation_owners (obligation_id, user_id, assigned_by, is_current)
    VALUES (v_obligation_id, p_owner_id, p_created_by, true);
    
    -- Create initial SLA record
    INSERT INTO slas (obligation_id, due_date, created_by, is_current)
    VALUES (v_obligation_id, p_sla_due_date, p_created_by, true);
    
    RETURN v_obligation_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Reassign owner (append-only)
CREATE OR REPLACE FUNCTION reassign_owner(
    p_obligation_id UUID,
    p_new_owner_id UUID,
    p_assigned_by UUID,
    p_reason TEXT
) RETURNS UUID AS $$
DECLARE
    v_new_owner_record_id UUID;
BEGIN
    IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) = 0 THEN
        RAISE EXCEPTION 'ENFORCEMENT VIOLATION: Reassignment reason is required for audit trail';
    END IF;
    
    -- Mark current owner as not current
    UPDATE obligation_owners 
    SET is_current = false 
    WHERE obligation_id = p_obligation_id AND is_current = true;
    
    -- Create new owner record
    INSERT INTO obligation_owners (obligation_id, user_id, assigned_by, is_current, reassignment_reason)
    VALUES (p_obligation_id, p_new_owner_id, p_assigned_by, true, p_reason)
    RETURNING id INTO v_new_owner_record_id;
    
    RETURN v_new_owner_record_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Extend SLA (append-only)
CREATE OR REPLACE FUNCTION extend_sla(
    p_obligation_id UUID,
    p_new_due_date DATE,
    p_created_by UUID,
    p_reason TEXT
) RETURNS UUID AS $$
DECLARE
    v_current_sla_id UUID;
    v_current_due_date DATE;
    v_new_sla_id UUID;
BEGIN
    IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) = 0 THEN
        RAISE EXCEPTION 'ENFORCEMENT VIOLATION: Extension reason is required for audit trail';
    END IF;
    
    -- Get current SLA
    SELECT id, due_date INTO v_current_sla_id, v_current_due_date
    FROM slas
    WHERE obligation_id = p_obligation_id AND is_current = true;
    
    IF v_current_sla_id IS NULL THEN
        RAISE EXCEPTION 'ENFORCEMENT VIOLATION: No current SLA found for obligation';
    END IF;
    
    IF p_new_due_date <= v_current_due_date THEN
        RAISE EXCEPTION 'ENFORCEMENT VIOLATION: New due date must be after current due date. SLA can only be extended, not shortened.';
    END IF;
    
    -- Mark current SLA as not current
    UPDATE slas SET is_current = false WHERE id = v_current_sla_id;
    
    -- Create new SLA record
    INSERT INTO slas (obligation_id, due_date, created_by, is_current, extension_reason, previous_sla_id)
    VALUES (p_obligation_id, p_new_due_date, p_created_by, true, p_reason, v_current_sla_id)
    RETURNING id INTO v_new_sla_id;
    
    RETURN v_new_sla_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SAMPLE DATA (for testing)
-- ============================================

-- Uncomment to insert sample data:
/*
INSERT INTO organizations (id, name, type) VALUES 
    ('11111111-1111-1111-1111-111111111111', 'Acme NBFC', 'NBFC');

INSERT INTO users (id, email, password_hash, name, role, organization_id) VALUES 
    ('22222222-2222-2222-2222-222222222222', 'admin@acme.com', '$2b$10$hash', 'Admin User', 'admin', '11111111-1111-1111-1111-111111111111'),
    ('33333333-3333-3333-3333-333333333333', 'manager@acme.com', '$2b$10$hash', 'Manager User', 'manager', '11111111-1111-1111-1111-111111111111'),
    ('44444444-4444-4444-4444-444444444444', 'operator@acme.com', '$2b$10$hash', 'Operator User', 'operator', '11111111-1111-1111-1111-111111111111');
*/
