# Jira / Trello Setup for Sprint 5 (GTM & Prod Readiness)

To keep things perfectly professional and organized while you record your video and your tester works, copy these exact setups into your ticket management system.

## The Board Columns
Keep it simple. You only need 5 columns:
1. **Backlog** (Ideas, Future Sprints)
2. **To Do** (Sprint 5 Approved Tasks)
3. **In Progress** (What you are coding right now)
4. **In QA** (What the tester is verifying)
5. **Done** (Live in Production)

---

## Tickets to Create IMMEDIATELY (Sprint 5)
*Copy and paste these directly into your tracker.*

### Ticket 1: Epic: Marketing & Founder Outreach
**Type:** Task
**Title:** Record and Post LinkedIn Demo Video
**Description:**
*   **Goal:** Generate initial waitlist buzz and secure design partners by showcasing TreY's value proposition against manual spreadsheets.
*   **Acceptance Criteria:**
    *   Dry run of the live Render links completed.
    *   Record a 90-120 second video following the `LINKEDIN_DEMO_PLAYBOOK.md` script.
    *   Edit video (Crop URL/taskbar, add auto-captions via CapCut, add zoom-ins on mobile-critical text).
    *   Post to LinkedIn at 8:15AM or 1:15PM local time using the pre-written caption.
    *   Actively manage comments for the first 60 minutes to maximize algorithm reach.

### Ticket 2: Epic: QA & Bug Fixing
**Type:** Task
**Title:** Onboard Functional Tester
**Description:**
*   **Goal:** Provide a structured environment for the QA tester to find bugs without overwhelming engineering with unstructured feedback.
*   **Acceptance Criteria:**
    *   Create a dedicated Bug Tracking board (or define a specific label/epic for bugs on this board).
    *   Send the tester the newly created `TESTER_ONBOARDING_GUIDE.md` and the live URLs.
    *   Ensure they understand the 30-50 second Render "cold start" delay to prevent false positive bug reports.
    *   Instruct them to follow the "Happy Path" testing script first.

### Ticket 3: Epic: Engineering (Prod Readiness/Phase 5)
**Type:** Story
**Title:** Migrate File Storage to AWS S3 (or Cloudflare R2)
**Description:**
*   **Goal:** Evidence files uploaded to Render currently disappear when the server restarts or goes to sleep because the ephemeral disk is wiped. We need persistent cloud storage.
*   **Acceptance Criteria:**
    *   Provision an S3 bucket (or R2 bucket).
    *   Update backend `/api/evidence/upload` route to upload directly to the bucket instead of the local `/uploads` folder.
    *   Return the public (or presigned) URL to the database.
*   **Priority:** HIGH (This is the most critical technical gap right now).

### Ticket 4: Epic: Engineering (Prod Readiness/Phase 5)
**Type:** Story
**Title:** Centralize Environment Variables and DevOps
**Description:**
*   **Goal:** Secure all sensitive strings (DB URL, JWT Secret, S3 Keys) and establish a proper CI/CD mindset.
*   **Acceptance Criteria:**
    *   Ensure `.env` is comprehensively included in `.gitignore`.
    *   Set up a strong, unique `JWT_SECRET` in the Render dashboard (it shouldn't be 'your_jwt_secret_key_here' in prod).
    *   (Optional) Configure a simple GitHub Action to run the Jest test suite on PRs to `main`.

### Ticket 5: Epic: QA Feedback loop
**Type:** Bug Template
**Title:** [BUG] Placeholder for Incoming Bugs
**Description:**
*   *Tester to fill this out based on the rules in the guide.*
    *   **Role Used:** 
    *   **Steps to Reproduce:**
    *   **Expected Result:**
    *   **Actual Result:**
    *   **Screenshot Link:**