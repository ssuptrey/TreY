-- ============================================
-- MIGRATION 003: Ingestion System Tables
-- ============================================
-- Real working ingestion infrastructure for:
-- CSV import, Email webhooks, WhatsApp, API, Forward-to-create

-- Ingestion logs - track all incoming data
CREATE TABLE IF NOT EXISTS ingestion_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel VARCHAR(50) NOT NULL, -- 'csv', 'email', 'whatsapp', 'api', 'forward', 'manual'
    source_identifier VARCHAR(500), -- email address, phone number, filename, etc.
    obligation_id UUID REFERENCES obligations(id) ON DELETE SET NULL,
    raw_payload JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed', 'duplicate'
    error_message TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- API keys for external system integrations
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- 'CRM Integration', 'Helpdesk Sync', etc.
    key_hash VARCHAR(128) NOT NULL, -- In production, store hashed key
    description TEXT,
    permissions JSONB DEFAULT '["create_obligation"]',
    rate_limit_per_minute INTEGER DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- WhatsApp phone number mappings
CREATE TABLE IF NOT EXISTS whatsapp_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number VARCHAR(20) NOT NULL UNIQUE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    customer_name VARCHAR(200),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add ingestion-related columns to obligations
DO $$
BEGIN
    -- Source channel for the obligation
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'obligations' AND column_name = 'ingestion_source') THEN
        ALTER TABLE obligations ADD COLUMN ingestion_source VARCHAR(50) DEFAULT 'manual';
    END IF;
    
    -- External reference ID (complaint ID from source system)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'obligations' AND column_name = 'external_reference_id') THEN
        ALTER TABLE obligations ADD COLUMN external_reference_id VARCHAR(200);
    END IF;
    
    -- Priority level
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'obligations' AND column_name = 'priority') THEN
        ALTER TABLE obligations ADD COLUMN priority VARCHAR(20) DEFAULT 'medium';
    END IF;
END$$;

-- Add columns to organizations for ingestion config
DO $$
BEGIN
    -- Email domain for matching incoming emails
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'email_domain') THEN
        ALTER TABLE organizations ADD COLUMN email_domain VARCHAR(100);
    END IF;
    
    -- WhatsApp business number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'whatsapp_number') THEN
        ALTER TABLE organizations ADD COLUMN whatsapp_number VARCHAR(20);
    END IF;
END$$;

-- Add forward token to users (for forward-to-create feature)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'forward_token') THEN
        ALTER TABLE users ADD COLUMN forward_token VARCHAR(20);
    END IF;
END$$;

-- Generate forward tokens for existing users
UPDATE users 
SET forward_token = SUBSTRING(REPLACE(id::text, '-', ''), 1, 8)
WHERE forward_token IS NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_channel ON ingestion_logs(channel);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_status ON ingestion_logs(status);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_processed_at ON ingestion_logs(processed_at);
CREATE INDEX IF NOT EXISTS idx_ingestion_logs_obligation ON ingestion_logs(obligation_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_whatsapp_mappings_phone ON whatsapp_mappings(phone_number);
CREATE INDEX IF NOT EXISTS idx_obligations_source ON obligations(ingestion_source);
CREATE INDEX IF NOT EXISTS idx_obligations_external_ref ON obligations(external_reference_id);

-- Skip inserting api key here as there are no organizations yet.
-- INSERT INTO api_keys (id, organization_id, name, key_hash, description, created_at)
SELECT 
    gen_random_uuid(),
    (SELECT id FROM organizations LIMIT 1),
    'Demo API Key',
    'test_api_key_demo_123',
    'Test API key for development - DO NOT USE IN PRODUCTION',
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM api_keys WHERE name = 'Demo API Key');

-- View for ingestion statistics
CREATE OR REPLACE VIEW ingestion_stats AS
SELECT 
    o.id as organization_id,
    o.name as organization_name,
    il.channel,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE il.status = 'success') as success_count,
    COUNT(*) FILTER (WHERE il.status = 'failed') as failed_count,
    MAX(il.processed_at) as last_ingestion
FROM organizations o
LEFT JOIN obligations ob ON ob.organization_id = o.id
LEFT JOIN ingestion_logs il ON il.obligation_id = ob.id
GROUP BY o.id, o.name, il.channel;

COMMENT ON TABLE ingestion_logs IS 'Tracks all data ingestion attempts from all channels';
COMMENT ON TABLE api_keys IS 'API keys for external system integrations';
COMMENT ON TABLE whatsapp_mappings IS 'Maps WhatsApp phone numbers to organizations/customers';
