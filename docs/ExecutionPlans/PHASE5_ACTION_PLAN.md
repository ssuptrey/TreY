# PHASE 5: GO-TO-MARKET & PRODUCTION READINESS
**Status:** In Progress
**Goal:** Transition from a functional local MVP into a public-facing, marketable product while simultaneously hardening the infrastructure for real-world enterprise use.

This phase is split into two concurrent tracks: **Marketing/Growth** and **Engineering**.

---

## TRACK A: MARKETING & OUTREACH (THE DEMO STRATEGY)
*To be executed immediately to build a waitlist and secure design partners.*

### Step 1: The "Perfect Mock Data" Script
Before recording anything, the app needs to look like a bustling enterprise environment.
*   **Action:** Build a comprehensive `seed.ts` script.
*   **Content:** Generate dummy data mimicking a real SOC 2 or ISO 27001 audit.
*   **Elements to include:** 3-5 users, 50+ obligations (some overdue, some pending), a fully populated SLA Heatmap, and realistic evidence files ("AWS_Architecture_Diagram.pdf").

### Step 2: Demo Video #1 - "Chaos to Clarity" (The Hook)
*   **Target Audience:** Compliance Managers, CISOs, Founders.
*   **The Problem Showcased:** Tracking hundreds of spreadsheet rows and chasing people on Slack.
*   **The TreY Solution:** Open the dashboard. Show the **SLA Heatmap**, the clear "at-risk" indicators, and the real-time completion metrics. 
*   **Length:** 60-90 seconds. 
*   **LinkedIn Hook:** "Still tracking your SOC 2 compliance in a 400-row spreadsheet? There is a better way. Meet TreY's SLA Heatmap."

### Step 3: Demo Video #2 - "The 1-Click Auditor Handoff" (The Value)
*   **Target Audience:** Security Engineers and External Auditors.
*   **The Problem Showcased:** Downloading files from Google Drive, zipping them manually, and organizing them in folders for auditors.
*   **The TreY Solution:** Go to an obligation, show the full audit trail/timeline, click the **Export ZIP/PDF** button, and show the beautifully generated compliance package.
*   **Length:** 45-60 seconds.
*   **LinkedIn Hook:** "Auditors don't want screenshots inside Word docs. Give them a perfectly structured ZIP file in one click with TreY."

### Step 4: Demo Video #3 - "Accountability That Works" (The Engagement)
*   **Target Audience:** Non-security staff (Engineers, HR) who are assigned compliance tasks.
*   **The Problem Showcased:** Forgetting to upload evidence until the day before the audit.
*   **The TreY Solution:** Show the automated email notification, click the "Magic Link", log in seamlessly, upload a file, and watch the SLA clock stop.
*   **Length:** 60 seconds.

---

## TRACK B: ENGINEERING & PROD READINESS
*To be executed concurrently so that when people ask to use the beta, the platform is ready.*

### Step 1: Cloud Database Migration
*   **Current State:** Local PostgreSQL.
*   **Action:** Provision a managed cloud database (e.g., Neon, Supabase, or AWS RDS). Update `migrations/` and run them against the remote DB.

### Step 2: Environment & Secrets Management
*   **Current State:** Hardcoded API URLs, weak local JWT secrets.
*   **Action:** Centralize all configuration into `.env` files. Ensure secrets (Database URIs, JWT tokens, AWS S3 keys for file storage) are secure and git-ignored.

### Step 3: File Storage Strategy (S3 Integration)
*   **Current State:** Evidence files are uploaded to the local `uploads/` folder (wiped on server restart/deployment).
*   **Action:** Connect an AWS S3 bucket (or Cloudflare R2) to the backend so uploaded evidence persists securely in the cloud.

### Step 4: Infrastructure Deployment
*   **Backend (Node/Express):** Deploy to Render, Heroku, or AWS App Runner. Configure CORS to only accept requests from the frontend.
*   **Frontend (React):** Deploy to Vercel or Netlify. Connect it to a custom domain (e.g., `app.trey-compliance.com`).

### Step 5: Security Hardening (The "Trust" Factor)
*   **Action:** Implement Rate Limiting (prevent brute force logins), Helmet.js (secure HTTP headers), and rigorous input sanitization. This is critical for a compliance app.

### Step 6: CI/CD Pipeline Setup
*   **Action:** Set up GitHub Actions. Every time code is pushed to `main`, the pipeline must run the Jest test suite (the one we just fixed!). If tests pass, it triggers an auto-deploy to the cloud.

### Step 7: Monitoring, Analytics & Logging
*   **Action:** Integrate Sentry (for catching backend/frontend crashes before users report them) and structured logging (Winston) so you can debug production issues easily.
