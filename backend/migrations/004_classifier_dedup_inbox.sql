-- ============================================
-- MIGRATION 004: Classifier, Deduplication, Unified Inbox
-- ============================================
-- No AI. Just rules, hashes, and queries.

-- ============================================
-- 1. CLASSIFICATION RULES ENGINE
-- ============================================
-- RBI/NBFC complaint categories are FIXED by regulation
-- This is a deterministic lookup, not "intelligence"

CREATE TABLE IF NOT EXISTS complaint_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    default_sla_days INTEGER NOT NULL DEFAULT 15,
    escalation_sla_days INTEGER NOT NULL DEFAULT 7,
    department VARCHAR(100),
    priority VARCHAR(20) DEFAULT 'medium',
    regulation_reference VARCHAR(200),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Keyword rules for auto-classification
CREATE TABLE IF NOT EXISTS classification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES complaint_categories(id) ON DELETE CASCADE,
    rule_type VARCHAR(20) NOT NULL, -- 'keyword', 'regex', 'sender_domain', 'channel'
    pattern VARCHAR(500) NOT NULL,
    weight INTEGER DEFAULT 10, -- Higher weight = stronger match
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add classification fields to obligations
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'obligations' AND column_name = 'category_id') THEN
        ALTER TABLE obligations ADD COLUMN category_id UUID REFERENCES complaint_categories(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'obligations' AND column_name = 'classification_confidence') THEN
        ALTER TABLE obligations ADD COLUMN classification_confidence VARCHAR(20) DEFAULT 'unclassified';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'obligations' AND column_name = 'classification_source') THEN
        ALTER TABLE obligations ADD COLUMN classification_source VARCHAR(50) DEFAULT 'manual';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'obligations' AND column_name = 'department') THEN
        ALTER TABLE obligations ADD COLUMN department VARCHAR(100);
    END IF;
END$$;

-- Insert standard NBFC/RBI complaint categories
INSERT INTO complaint_categories (code, name, description, default_sla_days, escalation_sla_days, department, priority, regulation_reference) VALUES
('GRIEVANCE', 'Customer Grievance', 'Formal grievance requiring redressal', 15, 7, 'Customer Service', 'high', 'RBI/2021-22/31'),
('SERVICE_REQUEST', 'Service Request', 'Standard service request', 7, 3, 'Operations', 'medium', NULL),
('QUERY', 'General Query', 'Information request or clarification', 3, 1, 'Customer Service', 'low', NULL),
('FRAUD', 'Fraud Complaint', 'Suspected fraud or unauthorized transaction', 7, 2, 'Fraud & Risk', 'critical', 'RBI/2017-18/154'),
('LOAN_DISPUTE', 'Loan/EMI Dispute', 'Dispute related to loan terms, EMI, interest', 15, 5, 'Collections', 'high', 'RBI/2021-22/31'),
('RECOVERY', 'Recovery Harassment', 'Complaint about recovery agents or practices', 7, 2, 'Collections', 'critical', 'RBI/2022-23/26'),
('INSURANCE', 'Insurance Related', 'Insurance claim or premium dispute', 15, 7, 'Insurance', 'medium', 'IRDAI/2020/45'),
('KYC', 'KYC/Documentation', 'KYC verification or document issues', 7, 3, 'Operations', 'medium', NULL),
('DIGITAL', 'Digital/App Issue', 'Mobile app, website, or digital service issue', 5, 2, 'Technology', 'medium', NULL),
('ESCALATION', 'Escalated Complaint', 'Complaint escalated from lower level or regulator', 3, 1, 'Senior Management', 'critical', 'RBI/2021-22/31'),
('REGULATORY', 'Regulatory Query', 'Query from RBI, SEBI, or other regulator', 2, 1, 'Compliance', 'critical', NULL),
('OMBUDSMAN', 'Ombudsman Reference', 'Complaint via RBI Ombudsman', 7, 3, 'Compliance', 'critical', 'RBI/2021-22/112')
ON CONFLICT (code) DO NOTHING;

-- Insert keyword classification rules
INSERT INTO classification_rules (category_id, rule_type, pattern, weight) VALUES
-- FRAUD keywords
((SELECT id FROM complaint_categories WHERE code = 'FRAUD'), 'keyword', 'fraud', 100),
((SELECT id FROM complaint_categories WHERE code = 'FRAUD'), 'keyword', 'unauthorized', 80),
((SELECT id FROM complaint_categories WHERE code = 'FRAUD'), 'keyword', 'stolen', 90),
((SELECT id FROM complaint_categories WHERE code = 'FRAUD'), 'keyword', 'hacked', 90),
((SELECT id FROM complaint_categories WHERE code = 'FRAUD'), 'keyword', 'phishing', 85),
((SELECT id FROM complaint_categories WHERE code = 'FRAUD'), 'keyword', 'otp misuse', 95),

-- RECOVERY keywords
((SELECT id FROM complaint_categories WHERE code = 'RECOVERY'), 'keyword', 'harassment', 100),
((SELECT id FROM complaint_categories WHERE code = 'RECOVERY'), 'keyword', 'recovery agent', 90),
((SELECT id FROM complaint_categories WHERE code = 'RECOVERY'), 'keyword', 'threatening', 95),
((SELECT id FROM complaint_categories WHERE code = 'RECOVERY'), 'keyword', 'calling repeatedly', 80),
((SELECT id FROM complaint_categories WHERE code = 'RECOVERY'), 'keyword', 'abusive', 90),
((SELECT id FROM complaint_categories WHERE code = 'RECOVERY'), 'keyword', 'third party contact', 85),

-- LOAN_DISPUTE keywords
((SELECT id FROM complaint_categories WHERE code = 'LOAN_DISPUTE'), 'keyword', 'emi', 70),
((SELECT id FROM complaint_categories WHERE code = 'LOAN_DISPUTE'), 'keyword', 'interest rate', 80),
((SELECT id FROM complaint_categories WHERE code = 'LOAN_DISPUTE'), 'keyword', 'foreclosure', 75),
((SELECT id FROM complaint_categories WHERE code = 'LOAN_DISPUTE'), 'keyword', 'prepayment', 70),
((SELECT id FROM complaint_categories WHERE code = 'LOAN_DISPUTE'), 'keyword', 'noc', 65),
((SELECT id FROM complaint_categories WHERE code = 'LOAN_DISPUTE'), 'keyword', 'loan statement', 60),

-- GRIEVANCE keywords
((SELECT id FROM complaint_categories WHERE code = 'GRIEVANCE'), 'keyword', 'grievance', 100),
((SELECT id FROM complaint_categories WHERE code = 'GRIEVANCE'), 'keyword', 'formal complaint', 90),
((SELECT id FROM complaint_categories WHERE code = 'GRIEVANCE'), 'keyword', 'escalate', 80),
((SELECT id FROM complaint_categories WHERE code = 'GRIEVANCE'), 'keyword', 'compensation', 75),
((SELECT id FROM complaint_categories WHERE code = 'GRIEVANCE'), 'keyword', 'legal action', 85),

-- QUERY keywords
((SELECT id FROM complaint_categories WHERE code = 'QUERY'), 'keyword', 'how to', 70),
((SELECT id FROM complaint_categories WHERE code = 'QUERY'), 'keyword', 'please explain', 65),
((SELECT id FROM complaint_categories WHERE code = 'QUERY'), 'keyword', 'what is', 60),
((SELECT id FROM complaint_categories WHERE code = 'QUERY'), 'keyword', 'enquiry', 70),

-- DIGITAL keywords
((SELECT id FROM complaint_categories WHERE code = 'DIGITAL'), 'keyword', 'app not working', 90),
((SELECT id FROM complaint_categories WHERE code = 'DIGITAL'), 'keyword', 'website error', 80),
((SELECT id FROM complaint_categories WHERE code = 'DIGITAL'), 'keyword', 'login issue', 75),
((SELECT id FROM complaint_categories WHERE code = 'DIGITAL'), 'keyword', 'unable to login', 75),
((SELECT id FROM complaint_categories WHERE code = 'DIGITAL'), 'keyword', 'technical issue', 70),

-- REGULATORY/OMBUDSMAN - sender domain rules
((SELECT id FROM complaint_categories WHERE code = 'REGULATORY'), 'sender_domain', 'rbi.org.in', 100),
((SELECT id FROM complaint_categories WHERE code = 'REGULATORY'), 'sender_domain', 'sebi.gov.in', 100),
((SELECT id FROM complaint_categories WHERE code = 'OMBUDSMAN'), 'sender_domain', 'cms.rbi.org.in', 100),
((SELECT id FROM complaint_categories WHERE code = 'OMBUDSMAN'), 'keyword', 'ombudsman', 100),
((SELECT id FROM complaint_categories WHERE code = 'OMBUDSMAN'), 'keyword', 'cms reference', 95);

CREATE INDEX IF NOT EXISTS idx_classification_rules_category ON classification_rules(category_id);
CREATE INDEX IF NOT EXISTS idx_classification_rules_type ON classification_rules(rule_type);
CREATE INDEX IF NOT EXISTS idx_obligations_category ON obligations(category_id);


-- ============================================
-- 2. DEDUPLICATION SYSTEM
-- ============================================
-- Hash-based matching. No AI. Just fingerprints.

CREATE TABLE IF NOT EXISTS dedup_fingerprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fingerprint_hash VARCHAR(64) NOT NULL, -- SHA256 hash
    fingerprint_type VARCHAR(30) NOT NULL, -- 'message_id', 'thread_id', 'sender_time', 'external_ref', 'content_hash'
    obligation_id UUID NOT NULL REFERENCES obligations(id) ON DELETE CASCADE,
    source_channel VARCHAR(50),
    raw_identifier TEXT, -- Original value before hashing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(fingerprint_hash, fingerprint_type)
);

-- Potential duplicates queue for human review
CREATE TABLE IF NOT EXISTS potential_duplicates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    new_obligation_id UUID NOT NULL REFERENCES obligations(id) ON DELETE CASCADE,
    existing_obligation_id UUID NOT NULL REFERENCES obligations(id) ON DELETE CASCADE,
    match_type VARCHAR(50) NOT NULL, -- 'exact', 'sender_time_window', 'content_similarity', 'thread'
    match_confidence VARCHAR(20) DEFAULT 'high', -- 'high', 'medium', 'low'
    resolution VARCHAR(20) DEFAULT 'pending', -- 'pending', 'merged', 'not_duplicate', 'ignored'
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add duplicate tracking to obligations
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'obligations' AND column_name = 'is_duplicate') THEN
        ALTER TABLE obligations ADD COLUMN is_duplicate BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'obligations' AND column_name = 'parent_obligation_id') THEN
        ALTER TABLE obligations ADD COLUMN parent_obligation_id UUID REFERENCES obligations(id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'obligations' AND column_name = 'message_id') THEN
        ALTER TABLE obligations ADD COLUMN message_id VARCHAR(500);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'obligations' AND column_name = 'thread_id') THEN
        ALTER TABLE obligations ADD COLUMN thread_id VARCHAR(500);
    END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_dedup_fingerprints_hash ON dedup_fingerprints(fingerprint_hash);
CREATE INDEX IF NOT EXISTS idx_dedup_fingerprints_obligation ON dedup_fingerprints(obligation_id);
CREATE INDEX IF NOT EXISTS idx_potential_duplicates_resolution ON potential_duplicates(resolution);
CREATE INDEX IF NOT EXISTS idx_obligations_parent ON obligations(parent_obligation_id);


-- ============================================
-- 3. UNIFIED INBOX VIEW
-- ============================================
-- One query to rule them all. This is what ops teams actually need.

CREATE OR REPLACE VIEW unified_inbox AS
SELECT 
    o.id,
    o.title,
    o.description,
    o.status,
    o.priority,
    o.created_at,
    o.ingestion_source AS channel,
    o.external_reference_id,
    
    -- Category
    cc.code AS category_code,
    cc.name AS category_name,
    cc.department,
    o.classification_confidence,
    
    -- SLA
    s.due_date,
    s.due_date - CURRENT_DATE AS days_remaining,
    CASE 
        WHEN s.due_date < CURRENT_DATE THEN 'breached'
        WHEN s.due_date = CURRENT_DATE THEN 'due_today'
        WHEN s.due_date <= CURRENT_DATE + 2 THEN 'at_risk'
        ELSE 'on_track'
    END AS sla_status,
    
    -- Owner
    u.name AS owner_name,
    u.email AS owner_email,
    
    -- Organization
    org.name AS organization_name,
    
    -- Duplicate flag
    o.is_duplicate,
    o.parent_obligation_id,
    
    -- Counts
    (SELECT COUNT(*) FROM evidence e WHERE e.obligation_id = o.id) AS evidence_count
    
FROM obligations o
LEFT JOIN complaint_categories cc ON cc.id = o.category_id
LEFT JOIN slas s ON s.obligation_id = o.id AND s.is_current = true
LEFT JOIN obligation_owners oo ON oo.obligation_id = o.id AND oo.is_current = true
LEFT JOIN users u ON u.id = oo.user_id
LEFT JOIN organizations org ON org.id = o.organization_id
WHERE o.is_duplicate = false OR o.is_duplicate IS NULL
ORDER BY 
    CASE o.priority 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
    END,
    o.created_at DESC;

-- Inbox stats view
CREATE OR REPLACE VIEW inbox_stats AS
SELECT 
    org.id AS organization_id,
    org.name AS organization_name,
    COUNT(*) AS total_open,
    COUNT(*) FILTER (WHERE s.due_date < CURRENT_DATE) AS breached,
    COUNT(*) FILTER (WHERE s.due_date = CURRENT_DATE) AS due_today,
    COUNT(*) FILTER (WHERE s.due_date BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 2) AS at_risk,
    COUNT(*) FILTER (WHERE o.category_id IS NULL) AS unclassified,
    COUNT(*) FILTER (WHERE oo.user_id IS NULL) AS unassigned,
    COUNT(*) FILTER (WHERE o.ingestion_source = 'email') AS from_email,
    COUNT(*) FILTER (WHERE o.ingestion_source = 'whatsapp') AS from_whatsapp,
    COUNT(*) FILTER (WHERE o.ingestion_source = 'api') AS from_api,
    COUNT(*) FILTER (WHERE o.ingestion_source = 'csv') AS from_csv
FROM obligations o
LEFT JOIN slas s ON s.obligation_id = o.id AND s.is_current = true
LEFT JOIN obligation_owners oo ON oo.obligation_id = o.id AND oo.is_current = true
LEFT JOIN organizations org ON org.id = o.organization_id
WHERE o.status = 'open' 
  AND (o.is_duplicate = false OR o.is_duplicate IS NULL)
GROUP BY org.id, org.name;

-- Pending classification queue
CREATE OR REPLACE VIEW classification_queue AS
SELECT 
    o.id,
    o.title,
    o.description,
    o.ingestion_source AS channel,
    o.created_at,
    o.external_reference_id
FROM obligations o
WHERE o.category_id IS NULL
  AND o.status = 'open'
  AND (o.is_duplicate = false OR o.is_duplicate IS NULL)
ORDER BY o.created_at DESC;

-- Potential duplicates queue
CREATE OR REPLACE VIEW duplicate_review_queue AS
SELECT 
    pd.id AS review_id,
    pd.match_type,
    pd.match_confidence,
    pd.created_at AS flagged_at,
    
    -- New obligation
    o1.id AS new_id,
    o1.title AS new_title,
    o1.ingestion_source AS new_channel,
    o1.created_at AS new_created_at,
    
    -- Existing obligation
    o2.id AS existing_id,
    o2.title AS existing_title,
    o2.ingestion_source AS existing_channel,
    o2.status AS existing_status,
    o2.created_at AS existing_created_at
    
FROM potential_duplicates pd
JOIN obligations o1 ON o1.id = pd.new_obligation_id
JOIN obligations o2 ON o2.id = pd.existing_obligation_id
WHERE pd.resolution = 'pending'
ORDER BY pd.created_at DESC;

COMMENT ON VIEW unified_inbox IS 'Single queue view of all complaints across all channels';
COMMENT ON VIEW inbox_stats IS 'Dashboard statistics for the unified inbox';
COMMENT ON VIEW classification_queue IS 'Obligations pending category assignment';
COMMENT ON VIEW duplicate_review_queue IS 'Potential duplicates awaiting human review';
