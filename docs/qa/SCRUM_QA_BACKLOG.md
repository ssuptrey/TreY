# TreY - Scrum QA Testing Backlog & Workflow

This document serves as the official Scrum backlog for the QA phase, perfectly aligned with our Jira format. It outlines the workflow between the Developer and Tester and provides a comprehensive list of test tickets.

## 🔄 The Dev-to-QA Scrum Workflow (Jira Board Setup)

Our Jira board strictly uses the following 5 columns, as configured for this project:
1. **TO-DO** (New tasks and bugs waiting for the developer to work on)
2. **DEV IN PROGRESS** (The developer is actively writing the code/fixes)
3. **REVIEW** (Code is written and waiting for a peer/technical review)
4. **TEST** (The code is deployed and waiting for the QA Tester to verify it)
5. **DONE** (Fully verified and locked by QA)

**As a QA Tester, your workflow is:**
* You only pick up tickets sitting in the **TEST** column.
* If a ticket passes all Acceptance Criteria, drag it to **DONE**.
* If a ticket fails, create a Bug ticket (or move the failed task) back to **TO-DO** so the developer sees it again.

---

## 📋 Comprehensive QA Tickets (Copy directly to Jira)

### Epic 1: Role-Based Access Control (RBAC) & Security
**Epic Description:** Goal: Ensure users can only see and do what their role permits.

**Type:** Story
**Title:** Verify Operator (HR) Limitations
**Description:**
```text
*Goal:* Ensure the HR role has the most restricted view and cannot perform unauthorized actions.

*Acceptance Criteria:*
* Log in as hr@acme.com.
* Verify cannot see tasks assigned to SecEng or CISO.
* Verify cannot see the "SLA Heatmap" or global dashboard metrics.
* Verify cannot reassign owners (button should be hidden or throw an error).
* Verify cannot extend SLAs.
```

**Type:** Story
**Title:** Verify Manager (SecEng) Limitations
**Description:**
```text
*Goal:* Ensure the SecEng role can only manage their specific department's tasks.

*Acceptance Criteria:*
* Log in as seceng@acme.com.
* Verify can see their own assigned tasks.
* Verify can reassign tasks to other valid users.
* Verify cannot view HR's isolated tasks.
```

**Type:** Story
**Title:**  
**Description:**
```text
*Goal:* Ensure the CISO role has full oversight of the entire company's compliance posture.

*Acceptance Criteria:*
* Log in as ciso@acme.com.
* Verify can see every obligation in the company on the dashboard.
* Verify all charts and metrics populate with global data.
```

**Type:** Story
**Title:** Verify Application Session Security
**Description:**
```text
*Goal:* Ensure users cannot bypass authentication blocks or use expired sessions.

*Acceptance Criteria:*
* Leave the browser open for hours or manually delete the JWT token from local storage.
* Verify the app forces a re-login when the token expires/is missing.
* Verify navigating directly to logged-in URLs (e.g., /dashboard) without a token redirects back to /login.
```

### Epic 2: Form & Input Validation (The "Skip & Mess Up" Tests)
**Epic Description:** Goal: Try to submit bad data to break the UI or database.

**Type:** Story
**Title:** Validate Required Fields Protection
**Description:**
```text
*Goal:* Ensure users cannot skip mandatory audit trail fields.

*Acceptance Criteria:*
* Open an obligation and attempt to reassign an owner or extend an SLA.
* Leave the "Reason" field completely blank.
* Verify the form prevents submission.
* Verify the UI shows a clear red error message: "Reason is required".
```

**Type:** Story
**Title:** Validate Absurd SLA Date Inputs
**Description:**
```text
*Goal:* Prevent logical errors in deadline management.

*Acceptance Criteria:*
* Attempt to extend an SLA to a date in the past (e.g., yesterday).
* Verify the calendar input blocks past dates, or the server rejects it with a clear validation error.
```

**Type:** Story
**Title:** Validate Evidence Upload Restrictions
**Description:**
```text
*Goal:* Protect the server from massive or malicious files.

*Acceptance Criteria:*
* Attempt to upload a 50MB file or an executable (.exe).
* Verify the frontend blocks the upload (max 10MB limit) and shows a warning badge.
```

**Type:** Story
**Title:** Validate Malicious Text Inputs (XSS/Overflow)
**Description:**
```text
*Goal:* Ensure the UI doesn't break and the database isn't corrupted by extreme text inputs.

*Acceptance Criteria:*
* Paste massive amounts of text (10,000 words) or symbols (<script>alert(1)</script>) into the Reference Note or Reason fields.
* Verify the text is safely truncated or properly sanitized.
* Verify the UI layout (especially the Audit Log timeline) does not visually break.
```

### Epic 3: Business Logic & Workflow Constraints
**Epic Description:** Goal: Ensure the compliance rules are strictly enforced.

**Type:** Story
**Title:** Verify "Late Upload" Flag Logic
**Description:**
```text
*Goal:* Ensure the system correctly identifies and punishes late evidence submissions.

*Acceptance Criteria:*
* Find an obligation that is legally past its SLA date.
* Upload evidence to it.
* Verify the Audit log registers the action strictly as EVIDENCE_LATE_UPLOAD and flags it with a warning.
```

**Type:** Story
**Title:** Verify Reassignment Logic Constraints
**Description:**
```text
*Goal:* Prevent useless or looping reassignments.

*Acceptance Criteria:*
* Attempt to reassign a task to the person who *already* owns it.
* Verify the dropdown hides the current owner, or the backend rejects the reassignment with an error.
```

**Type:** Story
**Title:** Verify The Immutability Lock (Auto-Close)
**Description:**
```text
*Goal:* Ensure a task permanently locks once evidence is provided.

*Acceptance Criteria:*
* Upload evidence to trigger the automatic "Closed" status.
* Verify the UI completely removes the buttons to Upload more evidence, Reassign, or Change Status.
* Verify the task cannot be forced open again.
```

### Epic 4: Audit Trail Integrity
**Epic Description:** Goal: The system must perfectly remember every action without fail.

**Type:** Story
**Title:** Verify Audit Parsing and Chronology
**Description:**
```text
*Goal:* Ensure the Decision Record strictly and accurately maps events.

*Acceptance Criteria:*
* Perform rapid-fire actions: Extend SLA, Reassign Owner, Upload Evidence.
* Verify the Decision Record panel perfectly maps all three events in chronological order.
* Verify the correct icons, reasons, and exact timestamps map correctly to the action taken.
```

**Type:** Story
**Title:** Verify Deletion Immunity (Append-Only)
**Description:**
```text
*Goal:* Guarantee that compliance records can never be erased.

*Acceptance Criteria:*
* Attempt to delete uploaded evidence or remove a line from the audit log.
* Verify there is absolutely no UI button, API route, or method for a user (even CISO) to delete history.
```

---

## 🐛 Bug Reporting Template (For Tester)
When a test fails, create a new Ticket in the **To Do** (or **In QA**) column using this exact template:

**Type:** Bug
**Title:** [BUG] Clear description of the issue
**Description:**
*   **Role Used:** (e.g., HR, CISO, SecEng)
*   **Steps to Reproduce:**
    1. Opened Task ID 123.
    2. Clicked Reassign.
    3. Left reason blank.
    4. Hit submit.
*   **Expected Result:** Red validation error should block submission.
*   **Actual Result:** Submitted an empty reason to the DB and crashed the audit log UI.
*   **Screenshot/Video Link:** [Insert Link]
