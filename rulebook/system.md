# SYSTEM RULES - DO NOT OVERRIDE

This document defines the complete scope of the NBFC Compliance Execution Platform.  
Nothing outside this file is allowed.

======================================================
WHAT NOT TO BUILD (STRICT BANS)
======================================================

[BANNED] No regulation interpretation  
[BANNED] No AI advisors, GPT features, predictive features  
[BANNED] No circular-mapping or compliance logic automation  
[BANNED] No workflow engines  
[BANNED] No OCR or text extraction  
[BANNED] No dashboards with insights  
[BANNED] No mobile apps, desktop apps, electron apps  
[BANNED] No microservices, Kafka, queues, over-engineering  
[BANNED] No extra tables beyond approved seven tables  
[BANNED] No timestamp editing  
[BANNED] No evidence editing  
[BANNED] No deletion of obligations, evidence, SLAs, owners  

If a feature is not explicitly listed - DO NOT BUILD IT.

======================================================
WHAT TO BUILD (APPROVED SCOPE)
======================================================

1. Authentication + Security
- JWT auth (access & refresh)
- bcrypt(10) hashing
- Password expiry (90 days)
- Password history
- Account lockout
- Role-based access: Admin, Manager, Operator

2. Core Features
- Obligations system
- Single-owner enforced
- Append-only ownership history
- SLA creation + extension (append-only)
- Evidence upload (immutable)
- Late evidence auto-flagging
- Audit logging (append-only)

3. NBFC Integration Layer (Phase 0)
- A small local agent (Node/Python)
- Collects raw data files (CSV, SFTP, logs)
- Sends sanitized JSON to backend
- No ML/interpretation

4. Export Layer
- CSV export
- ZIP bundling of evidence
- PDF reports

5. Alerts
- Daily SLA alert cron (9 AM)
- SMTP-based notifications

======================================================
TECH STACK (MANDATORY)
======================================================

Backend: Node.js + Express + TypeScript  
Frontend: React + TypeScript  
Database: PostgreSQL (UUID + triggers)  
Storage: /uploads/ with UUID filenames  
Security: Helmet, rate-limiting, validation  

======================================================
RULES FOR ALL CODE
======================================================

- Strict TypeScript everywhere  
- Controllers → Services → Repositories pattern  
- No business logic in controllers  
- Immutable data model  
- All user actions create audit logs  
- No silent failures  
- No undefined architecture deviations  

======================================================
IF USER REQUESTS ANYTHING OUTSIDE THIS FILE
======================================================

Ask for confirmation BEFORE generating.
