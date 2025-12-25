# Compliance Execution System

## System of Record for Compliance Execution

This is a B2B SaaS MVP for tracking compliance obligations with strict enforcement of immutability, accountability, and audit trails.

**This is NOT compliance interpretation software.** This system does not interpret regulations, auto-map circulars, or suggest compliance actions.

---

## Core Principle

Every compliance obligation must have:
1. A single owner
2. A fixed SLA date
3. Immutable timestamps
4. Evidence attached BEFORE deadline

**If any of these principles are violated, the system blocks the action.**

---

## Tech Stack

- **Backend:** Node.js + Express
- **Database:** PostgreSQL
- **Frontend:** React
- **Auth:** JWT-based email/password

---

## Project Structure

```
├── backend/
│   ├── package.json
│   ├── migrations/
│   │   └── 001_initial_schema.sql    # PostgreSQL schema with enforcement triggers
│   └── src/
│       ├── index.js                   # Express server entry point
│       ├── config/
│       │   └── database.js            # PostgreSQL connection pool
│       ├── middleware/
│       │   └── auth.js                # JWT authentication middleware
│       ├── routes/
│       │   ├── auth.js                # Login/register/logout
│       │   ├── obligations.js         # CRUD for obligations
│       │   ├── sla.js                 # SLA management
│       │   ├── evidence.js            # Evidence upload
│       │   ├── export.js              # PDF/ZIP export
│       │   └── users.js               # User management
│       └── services/
│           └── auditService.js        # Centralized audit logging
│
└── frontend/
    ├── package.json
    ├── public/
    │   └── index.html
    └── src/
        ├── index.js
        ├── App.js
        ├── App.css
        ├── api/
        │   └── index.js               # API client
        ├── context/
        │   └── AuthContext.js         # Auth state management
        ├── components/
        │   └── Layout.js              # App layout with nav
        └── pages/
            ├── Login.js
            ├── Register.js
            ├── Dashboard.js           # SLA Risk Dashboard
            ├── Obligations.js         # Obligations list
            ├── CreateObligation.js    # Create obligation form
            └── ObligationDetail.js    # Full obligation view
```

---

## Setup Instructions

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### 1. Database Setup

```bash
# Create database
createdb compliance_execution

# Run migrations
psql -d compliance_execution -f backend/migrations/001_initial_schema.sql
```

### 2. Backend Setup

```bash
cd backend
npm install

# Create .env file (optional)
echo "DB_HOST=localhost
DB_PORT=5432
DB_NAME=compliance_execution
DB_USER=postgres
DB_PASSWORD=postgres
JWT_SECRET=your-secret-key-change-in-production
PORT=3001" > .env

# Start server
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
npm install

# Start development server
npm start
```

The frontend runs on http://localhost:3000
The backend runs on http://localhost:3001

---

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user & organization |
| POST | `/api/auth/login` | Login with email/password |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Logout |

### Obligations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/obligations` | List all obligations |
| POST | `/api/obligations` | Create obligation (with owner + SLA) |
| GET | `/api/obligations/:id` | Get obligation with full history |
| PATCH | `/api/obligations/:id/status` | Update status (open→closed/breached) |
| POST | `/api/obligations/:id/reassign` | Reassign owner (append-only) |

### SLA

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sla/:obligationId/extend` | Extend SLA (append-only) |
| GET | `/api/sla/:obligationId/history` | Get SLA history |
| GET | `/api/sla/dashboard/risk` | Get risk dashboard data |

### Evidence

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/evidence/:obligationId` | List evidence |
| POST | `/api/evidence/:obligationId` | Upload evidence (multipart) |
| GET | `/api/evidence/:obligationId/:evidenceId/download` | Download file |

### Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/export/obligation/:id/pdf` | Export as PDF |
| GET | `/api/export/obligation/:id/zip` | Export as ZIP with files |
| GET | `/api/export/all/zip` | Export all obligations |

---

## Enforcement Rules

### Database-Level Enforcement (via PostgreSQL triggers)

1. **Obligations cannot be deleted**
   - Trigger: `trg_prevent_obligation_delete`
   - Any DELETE attempt raises an exception

2. **created_at is immutable**
   - Trigger: `trg_obligation_created_at_immutable`
   - Any UPDATE to created_at raises an exception

3. **Owner records are append-only**
   - Trigger: `trg_prevent_owner_delete`
   - Old owners cannot be deleted or modified
   - Reassignment creates a new record

4. **SLA records are append-only**
   - Trigger: `trg_sla_immutable`
   - Due dates cannot be changed
   - Extensions create new records

5. **Evidence is completely immutable**
   - Trigger: `trg_evidence_immutable`
   - Cannot UPDATE or DELETE evidence
   - New evidence is append-only

6. **Late evidence is auto-flagged**
   - Trigger: `trg_check_evidence_late`
   - If upload date > SLA due date, `is_late = true`

7. **Audit logs are immutable**
   - Trigger: `trg_audit_log_immutable`
   - Cannot UPDATE or DELETE any audit log

### Application-Level Enforcement

1. **Obligation creation requires owner + SLA**
   - API returns 400 if missing

2. **Owner reassignment requires reason**
   - Cannot reassign without audit reason

3. **SLA extension requires reason**
   - Cannot extend without audit reason
   - New date must be after current date

4. **All actions create audit logs**
   - Every API mutation logs to `audit_logs` table
   - Includes previous/new values, timestamp, user

---

## SLA Risk Dashboard

Color-coded status:

| Color | Condition |
|-------|-----------|
| 🟢 GREEN | >15 days remaining |
| 🟡 AMBER | 1-15 days remaining |
| 🔴 RED | Breached or overdue |
| ⚪ CLOSED | Obligation closed |

---

## Audit Log Schema

```sql
audit_logs (
  id UUID PRIMARY KEY,
  entity_type VARCHAR,      -- 'obligation', 'sla', 'evidence', etc.
  entity_id UUID,           -- ID of the affected entity
  action VARCHAR,           -- 'OBLIGATION_CREATE', 'SLA_EXTEND', etc.
  performed_by UUID,        -- User who performed action
  timestamp TIMESTAMP,      -- Immutable
  previous_value JSONB,     -- State before change
  new_value JSONB,          -- State after change
  ip_address INET,          -- Request IP
  user_agent TEXT           -- Request user agent
)
```

---

## What This System Does NOT Do

- ❌ Interpret RBI regulations
- ❌ Auto-map circulars to obligations
- ❌ Suggest compliance actions
- ❌ Use AI/ML for any purpose
- ❌ Build workflows or approval chains
- ❌ Send notifications (beyond simple SLA reminders)
- ❌ Provide compliance advice

**This is a system of record. It enforces data integrity and provides audit trails.**

---

## Design Philosophy

1. **Immutability > UX polish**
   - Data integrity is more important than convenience

2. **Append-only > Updates**
   - History is never lost

3. **Correctness > Speed**
   - Enforcement triggers may slow operations; that's acceptable

4. **Simple UI > Fancy design**
   - Boring, functional, reliable

---

## Environment Variables

### Backend

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | localhost | PostgreSQL host |
| `DB_PORT` | 5432 | PostgreSQL port |
| `DB_NAME` | compliance_execution | Database name |
| `DB_USER` | postgres | Database user |
| `DB_PASSWORD` | postgres | Database password |
| `JWT_SECRET` | (required) | Secret for JWT signing |
| `PORT` | 3001 | API server port |
| `UPLOAD_DIR` | ./uploads | Evidence file storage |

### Frontend

| Variable | Default | Description |
|----------|---------|-------------|
| `REACT_APP_API_URL` | http://localhost:3001/api | Backend API URL |

---

## License

MIT
