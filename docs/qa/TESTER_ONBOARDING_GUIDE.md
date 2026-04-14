# TreY - Tester Onboarding & QA Guide

Welcome to the TreY QA phase! Your primary goal is to try and break the application, find logical loopholes, and ensure the UI/UX makes sense for a real enterprise user.

## 1. Environment Details
*   **Frontend URL:** https://trey-frontend.onrender.com
*   **Backend URL:** https://trey-backend.onrender.com (API - you won't need to visit this directly)

*Note: The backend goes to sleep after 15 minutes of inactivity. **The very first login request might take 30-50 seconds.** Please be patient. After it wakes up, it will be lightning fast.*

## 2. Test Accounts (Pre-Seeded)
We have populated the database with a mock company ("Acme Fintech Corp") and several users with strict Role-Based Access Control (RBAC).

| Role | Email | Password | What to test for this role |
| :--- | :--- | :--- | :--- |
| **Admin (CISO)** | ciso@acme.com | demo123 | Full visibility. Can see all obligations across the company, re-assign owners, and view the SLA Heatmap. |
| **Manager (SecEng)** | seceng@acme.com | demo123 | Can only see obligations assigned to them or their department. Can upload evidence and close tasks. |
| **Operator (HR)** | hr@acme.com | demo123 | The most restricted view. Basic task completion and evidence upload only. |

## 3. Your Testing Script (The "Happy Path")
Before trying to break things, please verify the core flow works perfectly:

1.  **Login:** Log in as `seceng@acme.com`.
2.  **Dashboard:** Verify you can see your assigned obligations.
3.  **Action:** Click on an "Open" obligation.
4.  **Upload:** Upload a dummy PDF or image as evidence.
5.  **Audit:** Refresh the obligation and verify the new evidence appears in the timeline and the Audit Log registered your action.
6.  **Status Check:** Ensure the obligation status updated appropriately.
7.  **Logout & Switch:** Log out, log in as `ciso@acme.com` and verify you can see the updates the SecEng just made.

## 4. How to Report Bugs & Use the Jira Board
Our Jira board is strictly organized into these columns: **TO-DO**, **DEV IN PROGRESS**, **REVIEW**, **TEST**, and **DONE**.

As a Tester, your workflow is:
1. **Pick up tickets** that are currently sitting in the **TEST** column.
2. **If a test PASSES**, move the ticket forward to **DONE**.
3. **If a test FAILS (Bug found)**, move the ticket back to **TO-DO** (to fail it back to the developer) and add a comment with these exact details:

*   **Title:** Clear description (e.g., "[BUG] Upload button unclickable on mobile")
*   **Role Used:** Which account were you logged into?
*   **Steps to Reproduce:**
    1. Clicked X
    2. Navigated to Y
    3. Uploaded Z
*   **Expected Result:** "The file should upload and appear in the list."
*   **Actual Result:** "The screen turned white and threw a 500 error."
*   **Screenshot/Video:** (Crucial for UI bugs)