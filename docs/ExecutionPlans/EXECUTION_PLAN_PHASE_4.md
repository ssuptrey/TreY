# PHASE 4: EXECUTION & MVP COMPLETION PLAN

**Date:** April 10, 2026
**Context:** TypeScript migration (Phases 1-3) is complete. The system architecture has been established. This plan outlines the exact priority sequence to get the system fully operational and production-ready.

---

## PRIORITY 1: CORE API RESTORATION (The "Plumbing")
**Status:** ✅ COMPLETED
**Why it's first:** Although we created all the TypeScript controllers, repositories, and validators, the Express routes are still disconnected. The API is currently non-functional until the routes route traffic to these new controllers.

**Tasks:**
- [x] 1. Update `backend/src/routes/auth.ts` -> Connect to `authController.ts`
- [x] 2. Update `backend/src/routes/obligations.ts` -> Connect to `obligationController.ts`
- [x] 3. Update `backend/src/routes/evidence.ts` -> Connect to `evidenceController.ts`
- [x] 4. Update `backend/src/routes/sla.ts` -> Connect to `slaController.ts`
- [x] 5. Connect remaining routes (alerts, audit, export, ingestion, organizations, users).
- [x] 6. Verify Express initialization in `backend/src/index.ts`.

---

## PRIORITY 2: THE SLA ALERT SYSTEM (MVP Blocker)
**Status:** ✅ COMPLETED
**Why it's second:** This is listed as the P0 Blocker in `PRODUCTION_READINESS.md`. Without automated SLA breach warnings, the system fails its primary objective as an enforcement tool.

**Tasks:**
- [x] 1. Implement `backend/src/services/alertService.ts` (SMTP setup via nodemailer).
- [x] 2. Implement `backend/src/jobs/slaAlertJob.ts` (node-cron job running at 9 AM IST).
- [x] 3. Connect alerts to the `audit_logs` table to ensure an immutable record of every alert sent.

---

## PRIORITY 3: SECURITY & COMPLIANCE LOCKDOWN
**Status:** ✅ COMPLETED
**Why it's third:** Before ingesting any real NBFC data, the application must be fortified against abuse.

**Tasks:**
- [x] 1. Implement global API Rate Limiting (100 req/15min) and strict Auth Rate Limiting (5 req/15min).
- [x] 2. Enforce JWT expiry to 8 hours and implement standard Helmet security headers.
- [x] 3. Validate that database-level triggers (preventing `DELETE` and timestamp updates) are perfectly intact via a check script.
- [x] 4. Implement strict Password Policy (12+ chars, expiry, history) if not already inside validators.

---

## PRIORITY 4: FRONTEND INTEGRATION & VERIFICATION
**Status:** ✅ COMPLETED
**Why it's last:** The frontend components (now in `.tsx`) need a stable and secure backend API to render the SLA Risk Dashboard and Notification Panels reliably.

**Tasks:**
- [x] 1. Verify `frontend/src/api/index.ts` perfectly aligns with the new TypeScript backend routes.
- [x] 2. End-to-End test of the Obligation lifecycle (Create -> Assign -> Add Evidence -> Close).
- [x] 3. Verify "Late Evidence" logic displays properly on the React dashboard.

---

## ENFORCEMENT RULES FOR IMPLEMENTATION:
- **No scope creep.** Stick strictly to the tasks above.
- **Maintain immutability.** If we touch the database, it must remain append-only.
- **Regulator-grade code.** Handle every error gracefully and log it to the audit system.
