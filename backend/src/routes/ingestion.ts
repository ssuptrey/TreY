// ============================================
// INGESTION ROUTES - Real Working Channels
// ============================================
// CSV Import, Email Webhook, WhatsApp Webhook, Public API
// Now with: Classification Rules Engine + Deduplication

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middlewares/auth';
import { AuthenticatedRequest } from '../types/requests';
import classifierService from '../services/classifierService';

const router = Router();

// Database connection - use shared pool from config
import { pool } from '../config/database';

// Multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ============================================
// 1. CSV BULK IMPORT - Fully Working
// ============================================
router.post('/csv', authenticate, upload.single('file'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const organizationId = req.user?.organization_id;

    if (!userId || !organizationId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      res.status(400).json({ success: false, error: 'CSV must have header row and at least one data row' });
      return;
    }

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    
    // Required columns
    const titleIndex = headers.findIndex(h => h === 'title' || h === 'complaint' || h === 'subject');
    const descriptionIndex = headers.findIndex(h => h === 'description' || h === 'details' || h === 'body');
    const dueDateIndex = headers.findIndex(h => h === 'due_date' || h === 'deadline' || h === 'sla_date');
    const regulationIndex = headers.findIndex(h => h === 'regulation' || h === 'regulation_tag' || h === 'circular');
    const ownerEmailIndex = headers.findIndex(h => h === 'owner_email' || h === 'owner' || h === 'assigned_to');
    const sourceIndex = headers.findIndex(h => h === 'source' || h === 'channel' || h === 'origin');
    const externalIdIndex = headers.findIndex(h => h === 'external_id' || h === 'complaint_id' || h === 'reference');

    if (titleIndex === -1) {
      res.status(400).json({ 
        success: false, 
        error: 'CSV must have a "title" or "complaint" or "subject" column',
        headers: headers
      });
      return;
    }

    const client = await pool.connect();
    const results = {
      total: 0,
      success: 0,
      failed: 0,
      errors: [] as string[],
      created: [] as any[]
    };

    try {
      await client.query('BEGIN');

      // Process each row
      for (let i = 1; i < lines.length; i++) {
        results.total++;
        
        try {
          // Parse CSV row (handle quoted values)
          const row = parseCSVRow(lines[i]);
          
          const title = row[titleIndex]?.trim();
          if (!title) {
            results.failed++;
            results.errors.push(`Row ${i + 1}: Missing title`);
            continue;
          }

          const description = descriptionIndex >= 0 ? row[descriptionIndex]?.trim() : '';
          const regulationTag = regulationIndex >= 0 ? row[regulationIndex]?.trim() : null;
          const source = sourceIndex >= 0 ? row[sourceIndex]?.trim() : 'csv_import';
          const externalId = externalIdIndex >= 0 ? row[externalIdIndex]?.trim() : null;

          // Parse due date
          let dueDate: Date | null = null;
          if (dueDateIndex >= 0 && row[dueDateIndex]) {
            const dateStr = row[dueDateIndex].trim();
            dueDate = new Date(dateStr);
            if (isNaN(dueDate.getTime())) {
              // Try DD/MM/YYYY format
              const parts = dateStr.split(/[\/\-]/);
              if (parts.length === 3) {
                dueDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
              }
            }
            if (isNaN(dueDate.getTime())) {
              dueDate = null;
            }
          }

          // Find owner by email
          let ownerId: string | null = null;
          if (ownerEmailIndex >= 0 && row[ownerEmailIndex]) {
            const ownerEmail = row[ownerEmailIndex].trim().toLowerCase();
            const ownerResult = await client.query(
              'SELECT id FROM users WHERE LOWER(email) = $1 AND organization_id = $2',
              [ownerEmail, organizationId]
            );
            if (ownerResult.rows.length > 0) {
              ownerId = ownerResult.rows[0].id;
            }
          }

          // Check for duplicates (external_id based)
          if (externalId) {
            const dupCheck = await classifierService.checkDuplicate(organizationId, {
              externalRefId: externalId
            });
            if (dupCheck.is_duplicate) {
              results.failed++;
              results.errors.push(`Row ${i + 1}: Duplicate (external_id ${externalId} already exists)`);
              continue;
            }
          }

          // Auto-classify the complaint
          const classification = await classifierService.classifyComplaint(
            title,
            description,
            undefined,
            'csv'
          );

          // Create obligation with classification
          const obligationId = uuidv4();
          await client.query(`
            INSERT INTO obligations (id, title, description, regulation_tag, organization_id, created_by, status, ingestion_source, external_reference_id, category_id, classification_confidence, classification_source, department, priority)
            VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8, $9, $10, 'auto', $11, $12)
          `, [
            obligationId, 
            title, 
            description, 
            regulationTag, 
            organizationId, 
            userId, 
            source, 
            externalId,
            classification.category_id,
            classification.confidence,
            classification.department,
            classification.priority
          ]);

          // Create SLA - use category default if no due date provided
          const slaDays = dueDate ? 0 : classification.default_sla_days;
          const finalDueDate = dueDate || new Date(Date.now() + slaDays * 24 * 60 * 60 * 1000);
          
          await client.query(`
            INSERT INTO slas (id, obligation_id, due_date, created_by, is_current)
            VALUES ($1, $2, $3, $4, true)
          `, [uuidv4(), obligationId, finalDueDate.toISOString().split('T')[0], userId]);

          // Assign owner if found
          if (ownerId) {
            await client.query(`
              INSERT INTO obligation_owners (id, obligation_id, user_id, assigned_by, is_current)
              VALUES ($1, $2, $3, $4, true)
            `, [uuidv4(), obligationId, ownerId, userId]);
          }

          // Store fingerprints for future deduplication
          await classifierService.storeFingerprints(obligationId, 'csv', {
            contentHash: classifierService.generateFingerprint(`${title}${description}`)
          });

          // Log ingestion
          await client.query(`
            INSERT INTO ingestion_logs (id, channel, source_identifier, obligation_id, raw_payload, status, processed_at)
            VALUES ($1, 'csv', $2, $3, $4, 'success', NOW())
          `, [uuidv4(), req.file?.originalname || 'upload.csv', obligationId, JSON.stringify({ row: i, title, category: classification.category_code })]);

          results.success++;
          results.created.push({ 
            id: obligationId, 
            title, 
            row: i + 1,
            category: classification.category_code,
            confidence: classification.confidence
          });

        } catch (rowError: any) {
          results.failed++;
          results.errors.push(`Row ${i + 1}: ${rowError.message}`);
        }
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        message: `Imported ${results.success} of ${results.total} obligations`,
        data: results
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error: any) {
    console.error('[Ingestion] CSV import error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to parse CSV row with quoted values
function parseCSVRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
}


// ============================================
// 2. EMAIL WEBHOOK - SendGrid/Mailgun Compatible
// ============================================
// Configure in SendGrid: Inbound Parse → POST to https://yourapi.com/api/ingestion/email
// Configure in Mailgun: Routes → forward to https://yourapi.com/api/ingestion/email

router.post('/email', upload.any(), async (req: Request, res: Response): Promise<void> => {
  try {
    // SendGrid format
    const from = req.body.from || req.body.sender;
    const to = req.body.to || req.body.recipient;
    const subject = req.body.subject || '(No Subject)';
    const text = req.body.text || req.body['body-plain'] || '';
    const html = req.body.html || req.body['body-html'] || '';
    
    // Extract organization from recipient email
    // Format: complaints-{org_id}@yourdomain.com or just parse domain
    const orgMatch = to?.match(/complaints-([a-f0-9-]+)@/i);
    let organizationId = orgMatch ? orgMatch[1] : null;

    // If no org in email, try to find by sender domain
    if (!organizationId && from) {
      const senderDomain = from.match(/@([^>]+)/)?.[1];
      if (senderDomain) {
        const orgResult = await pool.query(
          `SELECT id FROM organizations WHERE email_domain = $1 LIMIT 1`,
          [senderDomain]
        );
        if (orgResult.rows.length > 0) {
          organizationId = orgResult.rows[0].id;
        }
      }
    }

    // Get system user for this org or default admin
    let createdBy: string | null = null;
    if (organizationId) {
      const userResult = await pool.query(
        `SELECT id FROM users WHERE organization_id = $1 AND role = 'admin' LIMIT 1`,
        [organizationId]
      );
      if (userResult.rows.length > 0) {
        createdBy = userResult.rows[0].id;
      }
    }

    if (!organizationId || !createdBy) {
      // Log failed ingestion
      await pool.query(`
        INSERT INTO ingestion_logs (id, channel, source_identifier, raw_payload, status, error_message, processed_at)
        VALUES ($1, 'email', $2, $3, 'failed', 'Could not determine organization', NOW())
      `, [uuidv4(), from, JSON.stringify({ from, to, subject })]);

      res.status(200).json({ success: false, error: 'Unknown organization' });
      return;
    }

    // Extract email identifiers for deduplication
    const messageId = req.body['message-id'] || req.body['Message-Id'] || req.body.messageId;
    const threadId = req.body['in-reply-to'] || req.body['In-Reply-To'] || req.body.references;

    // Check for duplicates
    const dupCheck = await classifierService.checkDuplicate(organizationId, {
      messageId,
      threadId,
      senderIdentifier: from,
      timeWindowMinutes: 60 // 1 hour window for email
    });

    if (dupCheck.is_duplicate) {
      // Log as duplicate but don't create new obligation
      await pool.query(`
        INSERT INTO ingestion_logs (id, channel, source_identifier, obligation_id, raw_payload, status, error_message, processed_at)
        VALUES ($1, 'email', $2, $3, $4, 'duplicate', $5, NOW())
      `, [uuidv4(), from, dupCheck.existing_obligation_id, JSON.stringify({ from, subject, messageId }), `Duplicate: ${dupCheck.match_type}`]);

      console.log(`[Ingestion] Email duplicate detected: ${subject} → matches ${dupCheck.existing_obligation_id}`);
      
      res.status(200).json({ 
        success: true, 
        duplicate: true,
        existing_obligation_id: dupCheck.existing_obligation_id,
        match_type: dupCheck.match_type
      });
      return;
    }

    const description = text || html.replace(/<[^>]*>/g, '') || '';
    
    // Auto-classify the complaint
    const classification = await classifierService.classifyComplaint(
      subject,
      description,
      from,
      'email'
    );

    // Create obligation with classification
    const obligationId = uuidv4();
    
    await pool.query(`
      INSERT INTO obligations (id, title, description, organization_id, created_by, status, ingestion_source, external_reference_id, message_id, thread_id, category_id, classification_confidence, classification_source, department, priority)
      VALUES ($1, $2, $3, $4, $5, 'open', 'email', $6, $7, $8, $9, $10, 'auto', $11, $12)
    `, [
      obligationId, 
      subject, 
      description.substring(0, 2000), 
      organizationId, 
      createdBy, 
      from,
      messageId,
      threadId,
      classification.category_id,
      classification.confidence,
      classification.department,
      classification.priority
    ]);

    // SLA based on category or default 15 days
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + classification.default_sla_days);
    
    await pool.query(`
      INSERT INTO slas (id, obligation_id, due_date, created_by, is_current)
      VALUES ($1, $2, $3, $4, true)
    `, [uuidv4(), obligationId, dueDate.toISOString().split('T')[0], createdBy]);

    // Store fingerprints for future deduplication
    await classifierService.storeFingerprints(obligationId, 'email', {
      messageId,
      threadId,
      senderIdentifier: from,
      contentHash: classifierService.generateFingerprint(`${subject}${description}`)
    });

    // Handle attachments
    const files = req.files as Express.Multer.File[];
    if (files && files.length > 0) {
      for (const file of files) {
        const evidenceId = uuidv4();
        const filePath = `uploads/evidence/${obligationId}/${evidenceId}-${file.originalname}`;
        
        // In production, save to disk or S3
        // For now, just log it
        await pool.query(`
          INSERT INTO evidence (id, obligation_id, file_name, file_path, file_size, uploaded_by, is_late)
          VALUES ($1, $2, $3, $4, $5, $6, false)
        `, [evidenceId, obligationId, file.originalname, filePath, file.size, createdBy]);
      }
    }

    // Log successful ingestion
    await pool.query(`
      INSERT INTO ingestion_logs (id, channel, source_identifier, obligation_id, raw_payload, status, processed_at)
      VALUES ($1, 'email', $2, $3, $4, 'success', NOW())
    `, [uuidv4(), from, obligationId, JSON.stringify({ from, to, subject, category: classification.category_code, attachments: files?.length || 0 })]);

    console.log(`[Ingestion] Email processed: ${subject} → Obligation ${obligationId} [${classification.category_code || 'unclassified'}]`);

    // SendGrid/Mailgun expect 200 OK
    res.status(200).json({ 
      success: true, 
      obligation_id: obligationId,
      category: classification.category_code,
      confidence: classification.confidence,
      message: 'Email processed successfully'
    });

  } catch (error: any) {
    console.error('[Ingestion] Email processing error:', error);
    res.status(200).json({ success: false, error: error.message });
  }
});


// ============================================
// 3. WHATSAPP WEBHOOK - Twilio/Meta Compatible
// ============================================
// Configure in Twilio: Messaging → Webhook → POST to https://yourapi.com/api/ingestion/whatsapp
// Configure in Meta: WhatsApp Business → Webhooks → POST to https://yourapi.com/api/ingestion/whatsapp

// Webhook verification (Meta requires this)
router.get('/whatsapp', (req: Request, res: Response): void => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'compliance_verify_token';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Ingestion] WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

// Incoming message handler
router.post('/whatsapp', async (req: Request, res: Response): Promise<void> => {
  try {
    let from: string;
    let message: string;
    let messageId: string;

    // Detect format: Twilio vs Meta
    if (req.body.entry) {
      // Meta WhatsApp Cloud API format
      const entry = req.body.entry?.[0];
      const changes = entry?.changes?.[0];
      const messageData = changes?.value?.messages?.[0];
      
      if (!messageData) {
        res.status(200).json({ success: true, message: 'No message in payload' });
        return;
      }

      from = messageData.from;
      message = messageData.text?.body || messageData.caption || '';
      messageId = messageData.id;
      
      // Note: Media handling (messageData.image, messageData.document) available for future implementation
    } else {
      // Twilio format
      from = req.body.From?.replace('whatsapp:', '') || req.body.WaId;
      message = req.body.Body || '';
      messageId = req.body.MessageSid || req.body.SmsMessageSid;
      // Note: Twilio media available at req.body.MediaUrl0 for future implementation
    }

    if (!from || !message) {
      res.status(200).json({ success: true, message: 'Incomplete message' });
      return;
    }

    // Find organization by phone mapping or use default
    const orgResult = await pool.query(
      `SELECT o.id, u.id as admin_id 
       FROM organizations o 
       JOIN users u ON u.organization_id = o.id AND u.role = 'admin'
       WHERE o.whatsapp_number = $1 OR o.id = (SELECT organization_id FROM whatsapp_mappings WHERE phone_number = $2)
       LIMIT 1`,
      [from, from]
    );

    let organizationId: string;
    let createdBy: string;

    if (orgResult.rows.length > 0) {
      organizationId = orgResult.rows[0].id;
      createdBy = orgResult.rows[0].admin_id;
    } else {
      // Use default organization (first one)
      const defaultOrg = await pool.query(
        `SELECT o.id, u.id as admin_id 
         FROM organizations o 
         JOIN users u ON u.organization_id = o.id AND u.role = 'admin'
         LIMIT 1`
      );
      
      if (defaultOrg.rows.length === 0) {
        res.status(200).json({ success: false, error: 'No organization configured' });
        return;
      }
      
      organizationId = defaultOrg.rows[0].id;
      createdBy = defaultOrg.rows[0].admin_id;
    }

    // Check for duplicates - WhatsApp has 30 minute window for same sender
    const dupCheck = await classifierService.checkDuplicate(organizationId, {
      messageId,
      senderIdentifier: from,
      timeWindowMinutes: 30 // 30 minute window for WhatsApp
    });

    if (dupCheck.is_duplicate) {
      // Log as duplicate
      await pool.query(`
        INSERT INTO ingestion_logs (id, channel, source_identifier, obligation_id, raw_payload, status, error_message, processed_at)
        VALUES ($1, 'whatsapp', $2, $3, $4, 'duplicate', $5, NOW())
      `, [uuidv4(), from, dupCheck.existing_obligation_id, JSON.stringify({ from, message: message.substring(0, 200) }), `Duplicate: ${dupCheck.match_type}`]);

      console.log(`[Ingestion] WhatsApp duplicate: ${from} → matches ${dupCheck.existing_obligation_id}`);
      
      res.status(200).json({ 
        success: true, 
        duplicate: true,
        existing_obligation_id: dupCheck.existing_obligation_id
      });
      return;
    }

    const title = message.length > 100 ? message.substring(0, 100) + '...' : message;

    // Auto-classify the complaint
    const classification = await classifierService.classifyComplaint(
      title,
      message,
      undefined,
      'whatsapp'
    );

    // Create obligation with classification
    const obligationId = uuidv4();
    
    await pool.query(`
      INSERT INTO obligations (id, title, description, organization_id, created_by, status, ingestion_source, external_reference_id, message_id, category_id, classification_confidence, classification_source, department, priority)
      VALUES ($1, $2, $3, $4, $5, 'open', 'whatsapp', $6, $7, $8, $9, 'auto', $10, $11)
    `, [
      obligationId, 
      `WhatsApp: ${title}`, 
      message, 
      organizationId, 
      createdBy, 
      from,
      messageId,
      classification.category_id,
      classification.confidence,
      classification.department,
      classification.priority
    ]);

    // SLA based on category - WhatsApp typically faster (7 days default or less)
    const slaDays = Math.min(classification.default_sla_days, 7);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + slaDays);
    
    await pool.query(`
      INSERT INTO slas (id, obligation_id, due_date, created_by, is_current)
      VALUES ($1, $2, $3, $4, true)
    `, [uuidv4(), obligationId, dueDate.toISOString().split('T')[0], createdBy]);

    // Store fingerprints for future deduplication
    await classifierService.storeFingerprints(obligationId, 'whatsapp', {
      messageId,
      senderIdentifier: from,
      contentHash: classifierService.generateFingerprint(message)
    });

    // Log ingestion with category
    await pool.query(`
      INSERT INTO ingestion_logs (id, channel, source_identifier, obligation_id, raw_payload, status, processed_at)
      VALUES ($1, 'whatsapp', $2, $3, $4, 'success', NOW())
    `, [uuidv4(), from, obligationId, JSON.stringify({ from, message: message.substring(0, 500), messageId, category: classification.category_code })]);

    console.log(`[Ingestion] WhatsApp processed: ${from} → Obligation ${obligationId} [${classification.category_code || 'unclassified'}]`);

    res.status(200).json({ 
      success: true, 
      obligation_id: obligationId,
      category: classification.category_code,
      confidence: classification.confidence
    });

  } catch (error: any) {
    console.error('[Ingestion] WhatsApp processing error:', error);
    res.status(200).json({ success: false, error: error.message });
  }
});


// ============================================
// 4. PUBLIC API - For External Systems
// ============================================
// API key authentication for external systems

router.post('/api/complaint', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (!apiKey) {
      res.status(401).json({ success: false, error: 'API key required' });
      return;
    }

    // Validate API key and get organization
    const keyResult = await pool.query(
      `SELECT ak.organization_id, u.id as user_id 
       FROM api_keys ak 
       JOIN users u ON u.organization_id = ak.organization_id AND u.role = 'admin'
       WHERE ak.key_hash = $1 AND ak.is_active = true
       LIMIT 1`,
      [apiKey] // In production, hash the key before comparing
    );

    if (keyResult.rows.length === 0) {
      res.status(401).json({ success: false, error: 'Invalid API key' });
      return;
    }

    const organizationId = keyResult.rows[0].organization_id;
    const createdBy = keyResult.rows[0].user_id;

    // Validate request body
    const { title, description, due_date, regulation_tag, source, external_id, owner_email, priority } = req.body;

    if (!title) {
      res.status(400).json({ success: false, error: 'Title is required' });
      return;
    }

    // Find owner if provided
    let ownerId: string | null = null;
    if (owner_email) {
      const ownerResult = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = $1 AND organization_id = $2',
        [owner_email.toLowerCase(), organizationId]
      );
      if (ownerResult.rows.length > 0) {
        ownerId = ownerResult.rows[0].id;
      }
    }

    // Create obligation
    const obligationId = uuidv4();
    
    await pool.query(`
      INSERT INTO obligations (id, title, description, regulation_tag, organization_id, created_by, status, ingestion_source, external_reference_id, priority)
      VALUES ($1, $2, $3, $4, $5, $6, 'open', $7, $8, $9)
    `, [obligationId, title, description || '', regulation_tag, organizationId, createdBy, source || 'api', external_id, priority || 'medium']);

    // Create SLA
    let dueDate: Date;
    if (due_date) {
      dueDate = new Date(due_date);
    } else {
      dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 15);
    }
    
    await pool.query(`
      INSERT INTO slas (id, obligation_id, due_date, created_by, is_current)
      VALUES ($1, $2, $3, $4, true)
    `, [uuidv4(), obligationId, dueDate.toISOString().split('T')[0], createdBy]);

    // Assign owner
    if (ownerId) {
      await pool.query(`
        INSERT INTO obligation_owners (id, obligation_id, user_id, assigned_by, is_current)
        VALUES ($1, $2, $3, $4, true)
      `, [uuidv4(), obligationId, ownerId, createdBy]);
    }

    // Log ingestion
    await pool.query(`
      INSERT INTO ingestion_logs (id, channel, source_identifier, obligation_id, raw_payload, status, processed_at)
      VALUES ($1, 'api', $2, $3, $4, 'success', NOW())
    `, [uuidv4(), source || 'external_api', obligationId, JSON.stringify(req.body)]);

    res.status(201).json({
      success: true,
      data: {
        obligation_id: obligationId,
        title,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'open'
      },
      message: 'Complaint created successfully'
    });

  } catch (error: any) {
    console.error('[Ingestion] API error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// ============================================
// 5. INGESTION LOGS - View Recent Imports
// ============================================
router.get('/logs', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organization_id;
    const limit = parseInt(req.query.limit as string) || 50;
    const channel = req.query.channel as string;

    let query = `
      SELECT il.*, o.title as obligation_title
      FROM ingestion_logs il
      LEFT JOIN obligations o ON o.id = il.obligation_id
      WHERE o.organization_id = $1 OR il.obligation_id IS NULL
    `;
    const params: any[] = [organizationId];

    if (channel) {
      query += ` AND il.channel = $${params.length + 1}`;
      params.push(channel);
    }

    query += ` ORDER BY il.processed_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);

    // Get summary stats
    const statsResult = await pool.query(`
      SELECT 
        channel,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'success') as success,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM ingestion_logs il
      LEFT JOIN obligations o ON o.id = il.obligation_id
      WHERE o.organization_id = $1 OR il.obligation_id IS NULL
      AND il.processed_at > NOW() - INTERVAL '30 days'
      GROUP BY channel
    `, [organizationId]);

    res.json({
      success: true,
      data: {
        logs: result.rows,
        stats: statsResult.rows
      }
    });

  } catch (error: any) {
    console.error('[Ingestion] Logs error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// ============================================
// 6. FORWARD-TO-CREATE - Email Forwarding
// ============================================
// Users forward emails to create+{user_token}@yourdomain.com
// This endpoint handles those forwarded emails

router.post('/forward', upload.any(), async (req: Request, res: Response): Promise<void> => {
  try {
    // Extract message-id for demo logging
    const messageId = req.body['Message-Id'] || req.body['message-id'] || req.body.messageId || `msg-${Date.now()}`;
    console.log(`[Forward-Ingestion] Received message-id: ${messageId}`);
    
    const to = req.body.to || req.body.recipient || '';
    
    // Extract user token from email address
    // Format: create+{user_id_short}@domain.com
    const tokenMatch = to.match(/create\+([a-zA-Z0-9]+)@/i);
    
    if (!tokenMatch) {
      console.log(`[Forward-Ingestion] Invalid forward address: ${to}`);
      res.status(200).json({ success: false, error: 'Invalid forward address' });
      return;
    }

    const userToken = tokenMatch[1];
    
    // Find user by forward token
    const userResult = await pool.query(
      `SELECT id, organization_id FROM users WHERE forward_token = $1`,
      [userToken]
    );

    if (userResult.rows.length === 0) {
      res.status(200).json({ success: false, error: 'Unknown user token' });
      return;
    }

    const userId = userResult.rows[0].id;
    const organizationId = userResult.rows[0].organization_id;

    // Parse forwarded email
    const subject = req.body.subject || '(No Subject)';
    const text = req.body.text || req.body['body-plain'] || '';
    const from = req.body.from || req.body.sender || 'forwarded';

    // Create obligation
    const obligationId = uuidv4();
    // Generate short obligation number for demo display (OY-XXXXX format)
    const obligationNumber = `OY-${obligationId.substring(0, 5).toUpperCase()}`;
    
    // Try to extract original sender from forwarded content
    const originalSenderMatch = text.match(/From:\s*([^\n]+)/i);
    const originalSender = originalSenderMatch ? originalSenderMatch[1].trim() : from;

    console.log(`[Forward-Ingestion] Processing email: "${subject.substring(0, 50)}..."`);
    
    // Add small delay for natural "processing feel" during demos (800-1000ms)
    await new Promise(resolve => setTimeout(resolve, 850));

    await pool.query(`
      INSERT INTO obligations (id, title, description, organization_id, created_by, status, ingestion_source, external_reference_id)
      VALUES ($1, $2, $3, $4, $5, 'open', 'forward', $6)
    `, [obligationId, subject.replace(/^(Fwd:|Fw:|Forward:)\s*/i, ''), text.substring(0, 2000), organizationId, userId, originalSender]);

    // SLA - 15 days
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 15);
    
    await pool.query(`
      INSERT INTO slas (id, obligation_id, due_date, created_by, is_current)
      VALUES ($1, $2, $3, $4, true)
    `, [uuidv4(), obligationId, dueDate.toISOString().split('T')[0], userId]);

    // Assign to the user who forwarded
    await pool.query(`
      INSERT INTO obligation_owners (id, obligation_id, user_id, assigned_by, is_current)
      VALUES ($1, $2, $3, $4, true)
    `, [uuidv4(), obligationId, userId, userId]);

    // Handle attachments
    const files = req.files as Express.Multer.File[];
    if (files && files.length > 0) {
      for (const file of files) {
        const evidenceId = uuidv4();
        await pool.query(`
          INSERT INTO evidence (id, obligation_id, file_name, file_path, file_size, uploaded_by, is_late)
          VALUES ($1, $2, $3, $4, $5, $6, false)
        `, [evidenceId, obligationId, file.originalname, `uploads/${obligationId}/${file.originalname}`, file.size, userId]);
      }
    }

    // Log
    await pool.query(`
      INSERT INTO ingestion_logs (id, channel, source_identifier, obligation_id, raw_payload, status, processed_at)
      VALUES ($1, 'forward', $2, $3, $4, 'success', NOW())
    `, [uuidv4(), `user:${userId}`, obligationId, JSON.stringify({ subject, from: originalSender })]);

    console.log(`[Forward-Ingestion] ✓ Obligation created #${obligationNumber} (${obligationId})`);

    res.status(200).json({ success: true, obligation_id: obligationId, obligation_number: obligationNumber });

  } catch (error: any) {
    console.error('[Ingestion] Forward processing error:', error);
    res.status(200).json({ success: false, error: error.message });
  }
});


// ============================================
// 7. UNIFIED INBOX - The Single Queue
// ============================================
// One view for all complaints from all channels

router.get('/inbox', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organization_id;
    
    if (!organizationId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const filters = {
      status: req.query.status as string,
      category: req.query.category as string,
      channel: req.query.channel as string,
      slaStatus: req.query.sla_status as string,
      department: req.query.department as string,
      ownerId: req.query.owner_id as string,
      unassignedOnly: req.query.unassigned === 'true',
      unclassifiedOnly: req.query.unclassified === 'true',
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0
    };

    const result = await classifierService.getUnifiedInbox(organizationId, filters);

    res.json({
      success: true,
      data: result.items,
      total: result.total,
      stats: result.stats,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        hasMore: filters.offset + result.items.length < result.total
      }
    });

  } catch (error: any) {
    console.error('[Inbox] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// ============================================
// 8. CLASSIFICATION QUEUE - Needs Category
// ============================================
router.get('/queue/classify', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organization_id;
    
    const result = await pool.query(`
      SELECT * FROM classification_queue
      WHERE id IN (
        SELECT o.id FROM obligations o 
        WHERE o.organization_id = $1
      )
      LIMIT 50
    `, [organizationId]);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// ============================================
// 9. DUPLICATE REVIEW QUEUE
// ============================================
router.get('/queue/duplicates', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const organizationId = req.user?.organization_id;
    
    const result = await pool.query(`
      SELECT drq.* FROM duplicate_review_queue drq
      JOIN obligations o ON o.id = drq.new_id
      WHERE o.organization_id = $1
      LIMIT 50
    `, [organizationId]);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });

  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// ============================================
// 10. RESOLVE DUPLICATE
// ============================================
router.post('/duplicates/:id/resolve', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { id } = req.params;
    const { resolution, notes } = req.body; // 'merged', 'not_duplicate', 'ignored'

    if (!['merged', 'not_duplicate', 'ignored'].includes(resolution)) {
      res.status(400).json({ success: false, error: 'Invalid resolution' });
      return;
    }

    // Update duplicate record
    await pool.query(`
      UPDATE potential_duplicates 
      SET resolution = $1, resolved_by = $2, resolved_at = NOW(), notes = $3
      WHERE id = $4
    `, [resolution, userId, notes, id]);

    // If merged, mark the new obligation as duplicate
    if (resolution === 'merged') {
      const dupResult = await pool.query(
        'SELECT new_obligation_id, existing_obligation_id FROM potential_duplicates WHERE id = $1',
        [id]
      );
      
      if (dupResult.rows.length > 0) {
        await pool.query(`
          UPDATE obligations 
          SET is_duplicate = true, parent_obligation_id = $1
          WHERE id = $2
        `, [dupResult.rows[0].existing_obligation_id, dupResult.rows[0].new_obligation_id]);
      }
    }

    res.json({ success: true, message: 'Duplicate resolved' });

  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// ============================================
// 11. MANUAL CLASSIFICATION
// ============================================
router.post('/classify/:obligationId', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { obligationId } = req.params;
    const { category_code } = req.body;

    // Get category by code
    const categoryResult = await pool.query(
      'SELECT id, department, priority, default_sla_days FROM complaint_categories WHERE code = $1',
      [category_code]
    );

    if (categoryResult.rows.length === 0) {
      res.status(400).json({ success: false, error: 'Invalid category code' });
      return;
    }

    const category = categoryResult.rows[0];

    // Update obligation
    await pool.query(`
      UPDATE obligations 
      SET category_id = $1, 
          classification_confidence = 'high',
          classification_source = 'manual',
          department = $2,
          priority = $3
      WHERE id = $4
    `, [category.id, category.department, category.priority, obligationId]);

    res.json({ 
      success: true, 
      message: 'Classification updated',
      category: category_code,
      department: category.department
    });

  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// ============================================
// 12. GET CATEGORIES (for dropdowns)
// ============================================
router.get('/categories', authenticate, async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT code, name, description, default_sla_days, department, priority, regulation_reference
      FROM complaint_categories
      WHERE is_active = true
      ORDER BY name
    `);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});


// ============================================
// 13. DEMO FORWARD - For Video Demos
// ============================================
// Authenticated endpoint that simulates receiving a forwarded email
// Used for demos when real email infrastructure isn't set up yet
// Trigger via hidden keyboard shortcut in frontend

interface DemoEmailPayload {
  subject: string;
  body: string;
  from_email?: string;
}

// Pre-loaded demo complaints for one-click demo
const DEMO_COMPLAINTS = [
  {
    subject: "KYC update request pending for 7 days",
    body: `Dear Team,

I submitted my KYC documents on 15th January but my account is still showing "KYC Pending" status. 
My EMI payment is getting delayed because of this.

Customer ID: NBFC-2024-78432
Mobile: 9876543210

Please resolve this urgently.

Thanks,
Rajesh Kumar`,
    from_email: "rajesh.kumar@gmail.com"
  },
  {
    subject: "Incorrect interest charged on loan EMI",
    body: `Hi,

I noticed that my last EMI deduction was ₹15,450 instead of the agreed ₹14,200.
This is the third month where extra amount has been deducted.

Loan Account: LN-2023-445566
Total overcharge: ₹3,750

Please refund the excess amount immediately.

Regards,
Priya Sharma`,
    from_email: "priya.sharma@outlook.com"
  },
  {
    subject: "Harassment by collection agent",
    body: `To Whom It May Concern,

Your collection agent Mr. Vikram called me 15 times yesterday and used abusive language.
He also threatened to visit my office and inform my colleagues about the loan.

This is a clear violation of RBI guidelines on fair collection practices.
I am recording all calls and will escalate to RBI if this continues.

Loan ID: PL-2024-112233
Agent Name: Vikram (as per his introduction)

Immediate action required.

- Amit Patel`,
    from_email: "amit.patel@company.com"
  }
];

router.post('/demo-forward', authenticate, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const organizationId = req.user?.organization_id;

    if (!userId || !organizationId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    // Get complaint data - either from request body or use specified/random demo complaint
    let { subject, body, from_email, complaintIndex }: DemoEmailPayload & { complaintIndex?: number } = req.body;
    
    // If no content provided, use specified index or random demo complaint
    if (!subject || !body) {
      let selectedDemo;
      if (typeof complaintIndex === 'number' && complaintIndex >= 0 && complaintIndex < DEMO_COMPLAINTS.length) {
        selectedDemo = DEMO_COMPLAINTS[complaintIndex];
        console.log(`[Forward-Ingestion] Using demo complaint #${complaintIndex + 1}: "${selectedDemo.subject}"`);
      } else {
        selectedDemo = DEMO_COMPLAINTS[Math.floor(Math.random() * DEMO_COMPLAINTS.length)];
        console.log(`[Forward-Ingestion] Using random demo complaint: "${selectedDemo.subject}"`);
      }
      subject = selectedDemo.subject;
      body = selectedDemo.body;
      from_email = selectedDemo.from_email;
    }

    const messageId = `demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`[Forward-Ingestion] Received message-id: <${messageId}>`);
    console.log(`[Forward-Ingestion] Processing email: "${subject.substring(0, 50)}..."`);

    // Create obligation with demo processing delay for natural feel
    const obligationId = uuidv4();
    const obligationNumber = `OY-${obligationId.substring(0, 5).toUpperCase()}`;

    // Small delay for "processing feel" during demo (800ms)
    await new Promise(resolve => setTimeout(resolve, 800));

    await pool.query(`
      INSERT INTO obligations (id, title, description, organization_id, created_by, status, ingestion_source, external_reference_id)
      VALUES ($1, $2, $3, $4, $5, 'open', 'email', $6)
    `, [obligationId, subject, body.substring(0, 2000), organizationId, userId, from_email || 'demo@forward.trey.in']);

    // SLA - 7 days for demo
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    
    await pool.query(`
      INSERT INTO slas (id, obligation_id, due_date, created_by, is_current)
      VALUES ($1, $2, $3, $4, true)
    `, [uuidv4(), obligationId, dueDate.toISOString().split('T')[0], userId]);

    // Log ingestion
    await pool.query(`
      INSERT INTO ingestion_logs (id, channel, source_identifier, obligation_id, raw_payload, status, processed_at)
      VALUES ($1, 'email', $2, $3, $4, 'success', NOW())
    `, [uuidv4(), from_email || 'demo@forward.trey.in', obligationId, JSON.stringify({ subject, from: from_email, demo: true })]);

    console.log(`[Forward-Ingestion] ✓ Obligation created #${obligationNumber} (${obligationId})`);

    res.status(201).json({ 
      success: true, 
      obligation_id: obligationId,
      obligation_number: obligationNumber,
      title: subject,
      message: 'Email forwarded successfully - obligation created'
    });

  } catch (error: any) {
    console.error('[Forward-Ingestion] Demo forward error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get list of demo complaints (for demo control panel)
router.get('/demo-complaints', authenticate, async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  res.json({
    success: true,
    data: DEMO_COMPLAINTS.map((c, i) => ({
      id: i,
      subject: c.subject,
      preview: c.body.substring(0, 100) + '...',
      from: c.from_email
    }))
  });
});


export default router;
