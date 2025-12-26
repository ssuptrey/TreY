# BACKEND SPECIFICATION (Node.js + Express + TypeScript)

======================================================
API MODULES
======================================================

1. /auth
- login
- refresh
- change-password
- force-password-reset

2. /organizations
- create org
- list orgs

3. /users
- create user
- lock/unlock user
- update roles
- password rules

4. /obligations
- create obligation
- list obligations
- fetch obligation details

5. /slas
- create SLA
- extend SLA

6. /obligation-owners
- assign owner (append-only)

7. /evidence
- upload evidence (immutable)
- list evidence

8. /audit
- fetch logs
- export logs

======================================================
SECURITY RULES
======================================================

- bcrypt(10)
- Password expiry 90 days
- Password history JSONB
- Lockout after failed attempts
- Strict RBAC middleware
- Rate limiting:
  • 100 req / 15 min general  
  • 5 req / 15 min auth

======================================================
NODE PROJECT STRUCTURE (MANDATORY)
======================================================

/src
    /controllers
    /services
    /repositories
    /middlewares
    /routes
    /validators
    /jobs
    /config
    /utils

No deviations.

======================================================
FILE UPLOAD RULES
======================================================

- Use Multer
- Store in /uploads
- UUID filenames
- After upload: evidence becomes immutable

======================================================
NBFC AGENT API ENDPOINTS (Phase 0)
======================================================

POST /agent/sync/obligations  
POST /agent/sync/users  
POST /agent/sync/evidence  

Agent sends:
{
  "organization_id": "...",
  "payload": [...]
}

Backend validates and ingests.
No logic beyond sanitization + append-only insertion.

======================================================
CRON JOBS
======================================================

Daily at 09:00 AM:
- Find SLA deadlines within 3 days
- Send email alerts
