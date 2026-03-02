// ============================================
// CLASSIFIER SERVICE - Deterministic Rules Engine
// ============================================
// No AI. Just keyword matching, regex patterns, and domain rules.
// RBI complaint categories are FIXED by regulation.

import { pool } from '../config/database';
import crypto from 'crypto';

interface ClassificationResult {
  category_id: string | null;
  category_code: string | null;
  category_name: string | null;
  department: string | null;
  default_sla_days: number;
  priority: string;
  confidence: 'high' | 'medium' | 'low' | 'unclassified';
  matched_rules: Array<{ pattern: string; weight: number; rule_type: string }>;
}

interface DedupResult {
  is_duplicate: boolean;
  match_type: string | null;
  existing_obligation_id: string | null;
  confidence: 'exact' | 'high' | 'medium' | null;
}

// ============================================
// CLASSIFIER - Deterministic Rules Engine
// ============================================

export async function classifyComplaint(
  title: string,
  description: string,
  senderEmail?: string,
  channel?: string
): Promise<ClassificationResult> {
  
  const text = `${title} ${description}`.toLowerCase();
  const senderDomain = senderEmail?.split('@')[1]?.toLowerCase() || '';

  // Get all active rules
  const rulesResult = await pool.query(`
    SELECT cr.*, cc.code, cc.name, cc.department, cc.default_sla_days, cc.priority
    FROM classification_rules cr
    JOIN complaint_categories cc ON cc.id = cr.category_id
    WHERE cr.is_active = true AND cc.is_active = true
    ORDER BY cr.weight DESC
  `);

  const rules = rulesResult.rows;
  const categoryScores: Map<string, { 
    score: number; 
    category: any; 
    matches: Array<{ pattern: string; weight: number; rule_type: string }> 
  }> = new Map();

  for (const rule of rules) {
    let matched = false;

    switch (rule.rule_type) {
      case 'keyword':
        // Simple keyword match
        if (text.includes(rule.pattern.toLowerCase())) {
          matched = true;
        }
        break;

      case 'regex':
        // Regex pattern match
        try {
          const regex = new RegExp(rule.pattern, 'i');
          if (regex.test(text)) {
            matched = true;
          }
        } catch (e) {
          // Invalid regex, skip
        }
        break;

      case 'sender_domain':
        // Match sender email domain
        if (senderDomain === rule.pattern.toLowerCase()) {
          matched = true;
        }
        break;

      case 'channel':
        // Match by ingestion channel
        if (channel?.toLowerCase() === rule.pattern.toLowerCase()) {
          matched = true;
        }
        break;
    }

    if (matched) {
      const categoryId = rule.category_id;
      const existing = categoryScores.get(categoryId) || { 
        score: 0, 
        category: rule, 
        matches: [] 
      };
      
      existing.score += rule.weight;
      existing.matches.push({ 
        pattern: rule.pattern, 
        weight: rule.weight, 
        rule_type: rule.rule_type 
      });
      
      categoryScores.set(categoryId, existing);
    }
  }

  // Find best match
  let bestCategoryId: string | null = null;
  let bestData: { score: number; category: any; matches: Array<{ pattern: string; weight: number; rule_type: string }> } | null = null;
  let highestScore = 0;

  for (const [categoryId, data] of categoryScores) {
    if (data.score > highestScore) {
      highestScore = data.score;
      bestCategoryId = categoryId;
      bestData = data;
    }
  }

  if (!bestCategoryId || !bestData) {
    return {
      category_id: null,
      category_code: null,
      category_name: null,
      department: null,
      default_sla_days: 15, // Default SLA
      priority: 'medium',
      confidence: 'unclassified',
      matched_rules: []
    };
  }

  // Determine confidence based on score
  let confidence: 'high' | 'medium' | 'low';
  if (highestScore >= 80) {
    confidence = 'high';
  } else if (highestScore >= 50) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Access the category data from the first matched rule (all rules for same category have same category info)
  const categoryInfo = bestData.category;

  return {
    category_id: bestCategoryId,
    category_code: categoryInfo.code,
    category_name: categoryInfo.name,
    department: categoryInfo.department,
    default_sla_days: categoryInfo.default_sla_days,
    priority: categoryInfo.priority,
    confidence,
    matched_rules: bestData.matches
  };
}


// ============================================
// DEDUPLICATION - Hash-based Fingerprinting
// ============================================

export function generateFingerprint(value: string): string {
  return crypto.createHash('sha256').update(value.toLowerCase().trim()).digest('hex');
}

export async function checkDuplicate(
  organizationId: string,
  options: {
    messageId?: string;
    threadId?: string;
    senderIdentifier?: string;  // email or phone
    contentHash?: string;
    externalRefId?: string;
    timeWindowMinutes?: number;
  }
): Promise<DedupResult> {
  
  const { 
    messageId, 
    threadId, 
    senderIdentifier, 
    contentHash, 
    externalRefId,
    timeWindowMinutes = 30 
  } = options;

  // 1. Exact message-id match (email)
  if (messageId) {
    const hash = generateFingerprint(messageId);
    const result = await pool.query(`
      SELECT df.obligation_id 
      FROM dedup_fingerprints df
      JOIN obligations o ON o.id = df.obligation_id
      WHERE df.fingerprint_hash = $1 
        AND df.fingerprint_type = 'message_id'
        AND o.organization_id = $2
      LIMIT 1
    `, [hash, organizationId]);

    if (result.rows.length > 0) {
      return {
        is_duplicate: true,
        match_type: 'message_id',
        existing_obligation_id: result.rows[0].obligation_id,
        confidence: 'exact'
      };
    }
  }

  // 2. Thread-id match (email thread grouping)
  if (threadId) {
    const hash = generateFingerprint(threadId);
    const result = await pool.query(`
      SELECT df.obligation_id 
      FROM dedup_fingerprints df
      JOIN obligations o ON o.id = df.obligation_id
      WHERE df.fingerprint_hash = $1 
        AND df.fingerprint_type = 'thread_id'
        AND o.organization_id = $2
      LIMIT 1
    `, [hash, organizationId]);

    if (result.rows.length > 0) {
      return {
        is_duplicate: true,
        match_type: 'thread_id',
        existing_obligation_id: result.rows[0].obligation_id,
        confidence: 'exact'
      };
    }
  }

  // 3. External reference ID match (API/CRM)
  if (externalRefId) {
    const result = await pool.query(`
      SELECT id FROM obligations 
      WHERE external_reference_id = $1 
        AND organization_id = $2
      LIMIT 1
    `, [externalRefId, organizationId]);

    if (result.rows.length > 0) {
      return {
        is_duplicate: true,
        match_type: 'external_ref',
        existing_obligation_id: result.rows[0].id,
        confidence: 'exact'
      };
    }
  }

  // 4. Sender + time window match (WhatsApp, repeat messages)
  if (senderIdentifier) {
    const hash = generateFingerprint(senderIdentifier);
    const result = await pool.query(`
      SELECT df.obligation_id 
      FROM dedup_fingerprints df
      JOIN obligations o ON o.id = df.obligation_id
      WHERE df.fingerprint_hash = $1 
        AND df.fingerprint_type = 'sender_time'
        AND o.organization_id = $2
        AND df.created_at > NOW() - INTERVAL '${timeWindowMinutes} minutes'
      ORDER BY df.created_at DESC
      LIMIT 1
    `, [hash, organizationId]);

    if (result.rows.length > 0) {
      return {
        is_duplicate: true,
        match_type: 'sender_time_window',
        existing_obligation_id: result.rows[0].obligation_id,
        confidence: 'high'
      };
    }
  }

  // 5. Content hash match (exact duplicate content)
  if (contentHash) {
    const result = await pool.query(`
      SELECT df.obligation_id 
      FROM dedup_fingerprints df
      JOIN obligations o ON o.id = df.obligation_id
      WHERE df.fingerprint_hash = $1 
        AND df.fingerprint_type = 'content_hash'
        AND o.organization_id = $2
        AND df.created_at > NOW() - INTERVAL '24 hours'
      LIMIT 1
    `, [contentHash, organizationId]);

    if (result.rows.length > 0) {
      return {
        is_duplicate: true,
        match_type: 'content_hash',
        existing_obligation_id: result.rows[0].obligation_id,
        confidence: 'high'
      };
    }
  }

  return {
    is_duplicate: false,
    match_type: null,
    existing_obligation_id: null,
    confidence: null
  };
}

export async function storeFingerprints(
  obligationId: string,
  channel: string,
  options: {
    messageId?: string;
    threadId?: string;
    senderIdentifier?: string;
    contentHash?: string;
  }
): Promise<void> {
  const { messageId, threadId, senderIdentifier, contentHash } = options;

  const inserts: Array<{ type: string; hash: string; raw: string }> = [];

  if (messageId) {
    inserts.push({ 
      type: 'message_id', 
      hash: generateFingerprint(messageId), 
      raw: messageId 
    });
  }

  if (threadId) {
    inserts.push({ 
      type: 'thread_id', 
      hash: generateFingerprint(threadId), 
      raw: threadId 
    });
  }

  if (senderIdentifier) {
    inserts.push({ 
      type: 'sender_time', 
      hash: generateFingerprint(senderIdentifier), 
      raw: senderIdentifier 
    });
  }

  if (contentHash) {
    inserts.push({ 
      type: 'content_hash', 
      hash: contentHash, 
      raw: '(content)' 
    });
  }

  for (const fp of inserts) {
    await pool.query(`
      INSERT INTO dedup_fingerprints (fingerprint_hash, fingerprint_type, obligation_id, source_channel, raw_identifier)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (fingerprint_hash, fingerprint_type) DO NOTHING
    `, [fp.hash, fp.type, obligationId, channel, fp.raw]);
  }
}

export async function flagPotentialDuplicate(
  newObligationId: string,
  existingObligationId: string,
  matchType: string,
  confidence: string
): Promise<void> {
  await pool.query(`
    INSERT INTO potential_duplicates (new_obligation_id, existing_obligation_id, match_type, match_confidence)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT DO NOTHING
  `, [newObligationId, existingObligationId, matchType, confidence]);
}


// ============================================
// APPLY CLASSIFICATION TO OBLIGATION
// ============================================

export async function classifyAndStoreObligation(
  obligationId: string,
  title: string,
  description: string,
  senderEmail?: string,
  channel?: string
): Promise<ClassificationResult> {
  
  const classification = await classifyComplaint(title, description, senderEmail, channel);

  if (classification.category_id) {
    await pool.query(`
      UPDATE obligations 
      SET category_id = $1,
          classification_confidence = $2,
          classification_source = 'auto',
          department = $3,
          priority = $4
      WHERE id = $5
    `, [
      classification.category_id,
      classification.confidence,
      classification.department,
      classification.priority,
      obligationId
    ]);
  }

  return classification;
}


// ============================================
// GET UNIFIED INBOX
// ============================================

export async function getUnifiedInbox(
  organizationId: string,
  filters?: {
    status?: string;
    category?: string;
    channel?: string;
    slaStatus?: string;
    department?: string;
    ownerId?: string;
    unassignedOnly?: boolean;
    unclassifiedOnly?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<{ items: any[]; total: number; stats: any }> {
  
  let query = `
    SELECT * FROM unified_inbox 
    WHERE organization_name = (SELECT name FROM organizations WHERE id = $1)
  `;
  const params: any[] = [organizationId];
  let paramIndex = 2;

  if (filters?.status) {
    query += ` AND status = $${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }

  if (filters?.category) {
    query += ` AND category_code = $${paramIndex}`;
    params.push(filters.category);
    paramIndex++;
  }

  if (filters?.channel) {
    query += ` AND channel = $${paramIndex}`;
    params.push(filters.channel);
    paramIndex++;
  }

  if (filters?.slaStatus) {
    query += ` AND sla_status = $${paramIndex}`;
    params.push(filters.slaStatus);
    paramIndex++;
  }

  if (filters?.department) {
    query += ` AND department = $${paramIndex}`;
    params.push(filters.department);
    paramIndex++;
  }

  if (filters?.ownerId) {
    query += ` AND owner_email = (SELECT email FROM users WHERE id = $${paramIndex})`;
    params.push(filters.ownerId);
    paramIndex++;
  }

  if (filters?.unassignedOnly) {
    query += ` AND owner_name IS NULL`;
  }

  if (filters?.unclassifiedOnly) {
    query += ` AND category_code IS NULL`;
  }

  // Count total
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
  const countResult = await pool.query(countQuery, params);
  const total = parseInt(countResult.rows[0].count, 10);

  // Add pagination
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  query += ` LIMIT ${limit} OFFSET ${offset}`;

  const result = await pool.query(query, params);

  // Get stats
  const statsResult = await pool.query(
    `SELECT * FROM inbox_stats WHERE organization_id = $1`,
    [organizationId]
  );

  return {
    items: result.rows,
    total,
    stats: statsResult.rows[0] || {}
  };
}


export default {
  classifyComplaint,
  classifyAndStoreObligation,
  checkDuplicate,
  storeFingerprints,
  flagPotentialDuplicate,
  generateFingerprint,
  getUnifiedInbox
};
