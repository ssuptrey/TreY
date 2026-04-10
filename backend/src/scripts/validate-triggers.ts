import { pool } from '../config/database';

async function validateTriggers() {
  console.log('--- STARTING TRIGGER VALIDATION ---');
  try {
    const client = await pool.connect();
    const triggerQuery = "SELECT event_object_table, trigger_name, event_manipulation FROM information_schema.triggers WHERE trigger_schema = 'public'";
    const res = await client.query(triggerQuery);
    const triggers = res.rows;
    const expectedTriggers = ['prevent_obligation_delete', 'trg_prevent_sla_delete', 'trg_prevent_evidence_delete', 'trg_prevent_audit_log_modification'];
    for (const expected of expectedTriggers) {
      const found = triggers.find(t => t.trigger_name === expected);
      if (found) { console.log("[PASS] Trigger found:", expected, "on", found.event_object_table, "for", found.event_manipulation); } else { console.error("[FAIL] Trigger missing:", expected); }
    }
    client.release();
    console.log('--- VALIDATION COMPLETE ---');
    process.exit(0);
  } catch (e) { console.error('Validation failed:', e); process.exit(1); }
}
validateTriggers();