# POSTGRESQL DATABASE SPECIFICATION

======================================================
TABLES
======================================================

1. organizations
2. users
3. obligations
4. obligation_owners (append-only)
5. slas (append-only)
6. evidence (immutable)
7. audit_logs (immutable)

======================================================
PRIMARY KEYS
======================================================

- UUID v4 on all tables

======================================================
TIMESTAMPS
======================================================

- created_at (immutable)
- updated_at (auto update except evidence)

======================================================
ENFORCEMENT TRIGGERS (MANDATORY)
======================================================

1. Prevent DELETE on obligations
2. Prevent DELETE on evidence
3. Prevent DELETE on SLAs
4. Prevent DELETE on obligation owners
5. Prevent UPDATE on evidence
6. Prevent UPDATE to created_at fields
7. Ensure only one active owner per obligation
8. SLA extension → insert new row (no updates)
9. Auto-flag late evidence (upload_time > SLA deadline)
10. Write audit logs for all INSERT/UPDATE

======================================================
AUDIT LOG RULES
======================================================

Each log must include:
- user_id
- action
- resource_type
- resource_id
- metadata JSON
- timestamp

Immutable forever.

======================================================
PASSWORD HISTORY (users table)
======================================================

password_history JSONB:
[
  {
    "changed_at": "...",
    "hash": "..."
  }
]

No reuse allowed.
