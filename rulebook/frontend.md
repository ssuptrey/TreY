# FRONTEND SPECIFICATION (React + TypeScript)

======================================================
ALLOWED SCREENS
======================================================

1. Login
2. Register
3. Dashboard (summary only)
4. Obligations List
5. Obligation Detail
    - SLA history
    - Owner history
    - Evidence list
    - Evidence uploader
    - Audit logs
6. Create Obligation
7. User Management (Admin only)

No extra screens.  
No insights, no analytics, no AI hints.

======================================================
STATE MANAGEMENT
======================================================

- React Context for auth
- Local state for forms
- No Redux, no MobX unless explicitly required

======================================================
API HANDLING
======================================================

- Axios instance with interceptors
- Auto logout on token expiry
- Error boundaries for UI stability

======================================================
UI RULES
======================================================

- Simple, functional UI
- No animations or transitions
- No charts unless explicitly exported
- No fancy dashboards

======================================================
FRONTEND FILE STRUCTURE
======================================================

/src
    /pages
    /components
    /hooks
    /context
    /api
    /utils
    /styles

Must follow this structure.
