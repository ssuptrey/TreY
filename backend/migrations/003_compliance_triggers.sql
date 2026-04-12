-- ============================================
-- RULEBOOK DB VERIFICATION MIGRATION
-- ============================================

-- 1. Ensure only ONE active owner per obligation
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_owner ON obligation_owners(obligation_id) WHERE is_active = true;

-- 2. Ensure SLA extensions create a NEW row: handled by existing trg_sla_immutable which only allows is_current to change

-- 3. Automatic Audit Logging via Database Triggers for mutations
-- This guarantees NO application bypass can mutate rows without an audit log being written
CREATE OR REPLACE FUNCTION audit_table_mutations() RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details)
        VALUES ('DB_INSERT', TG_TABLE_NAME, NEW.id, NULL, row_to_json(NEW));
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_logs (action, entity_type, entity_id, user_id, details)
        VALUES ('DB_UPDATE', TG_TABLE_NAME, NEW.id, NULL, jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW)));
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply to main entities to enforce rulebook "Generate Audit Logs for all INSERT/UPDATEs automatically"
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_obligations') THEN
        CREATE TRIGGER trg_audit_obligations
        AFTER INSERT OR UPDATE ON obligations
        FOR EACH ROW EXECUTE FUNCTION audit_table_mutations();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_slas') THEN
        CREATE TRIGGER trg_audit_slas
        AFTER INSERT OR UPDATE ON slas
        FOR EACH ROW EXECUTE FUNCTION audit_table_mutations();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_owners') THEN
        CREATE TRIGGER trg_audit_owners
        AFTER INSERT OR UPDATE ON obligation_owners
        FOR EACH ROW EXECUTE FUNCTION audit_table_mutations();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_evidence') THEN
        CREATE TRIGGER trg_audit_evidence
        AFTER INSERT OR UPDATE ON evidence
        FOR EACH ROW EXECUTE FUNCTION audit_table_mutations();
    END IF;
END $$;
