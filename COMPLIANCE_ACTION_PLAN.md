# COMPLIANCE ACTION PLAN
**Rulebook Compliance Checklist**

Last Updated: December 26, 2025
Status: IN PROGRESS

This document outlines all required actions to bring the project into full compliance with the rulebook specifications (`rulebook/system.md`, `rulebook/backend.md`, `rulebook/frontend.md`, `rulebook/database.md`).

---

## PROGRESS SUMMARY

### Completed Items
- [x] TypeScript setup for backend (tsconfig.json, type definitions)
- [x] TypeScript setup for frontend (tsconfig.json, type definitions)
- [x] Backend folder structure (controllers, repositories, validators, types)
- [x] Frontend folder structure (hooks, utils, styles, types)
- [x] Repository layer created (7 repository files)
- [x] Controller layer created (10 controller files)
- [x] Validators created (7 validator files)
- [x] Core TypeScript files converted (config, services, jobs, utils, middlewares)
- [x] Frontend TypeScript files converted (api, context, hooks, utils, types)
- [x] Renamed middleware to middlewares

### Remaining Items
- [ ] Convert remaining route files from .js to .ts
- [ ] Convert remaining frontend page/component files from .js to .tsx
- [ ] Wire up controllers to routes (update routes to use controllers)
- [ ] Delete old .js files after verification
- [ ] Full testing and verification

---

## 🔴 CRITICAL VIOLATIONS (P0 - Must Fix)

### 1. TypeScript Migration Required
**Rule Violated:** "Strict TypeScript everywhere" (system.md)  
**Current State:** Entire project uses JavaScript (.js files)  
**Impact:** Violates mandatory tech stack requirement

**Action Items:**
- [ ] Install TypeScript in backend: `npm install --save-dev typescript @types/node @types/express @types/jsonwebtoken @types/bcrypt @types/pg @types/multer @types/uuid`
- [ ] Create `backend/tsconfig.json` with strict mode enabled
- [ ] Rename all `.js` files to `.ts` in backend/src
- [ ] Add proper type definitions for all functions, parameters, and return types
- [ ] Fix all TypeScript compilation errors
- [ ] Update `package.json` scripts to use `ts-node` or compile step
- [ ] Install TypeScript in frontend: `npm install --save-dev typescript @types/react @types/react-dom @types/react-router-dom`
- [ ] Create `frontend/tsconfig.json` for React
- [ ] Rename all `.js` files to `.tsx` or `.ts` in frontend/src
- [ ] Add type definitions for React components, props, and state
- [ ] Fix all TypeScript compilation errors in frontend

**Estimated Effort:** 3-5 days

---

### 2. Backend Folder Structure Violations
**Rule Violated:** "No deviations" from mandatory structure (backend.md)  
**Current State:** Missing required folders  
**Impact:** Architectural non-compliance

**Required Structure:**
```
/src
    /controllers    ❌ MISSING
    /services       ✅ EXISTS
    /repositories   ❌ MISSING
    /middlewares    ✅ EXISTS (but named 'middleware' - should be plural)
    /routes         ✅ EXISTS
    /validators     ❌ MISSING
    /jobs           ✅ EXISTS
    /config         ✅ EXISTS
    /utils          ✅ EXISTS
```

**Action Items:**
- [ ] Create `backend/src/controllers/` folder
- [ ] Create `backend/src/repositories/` folder
- [ ] Create `backend/src/validators/` folder
- [ ] Rename `backend/src/middleware/` to `backend/src/middlewares/`
- [ ] Refactor code to implement Controllers → Services → Repositories pattern (see Section 3)

**Estimated Effort:** 1-2 days (structure creation + refactoring)

---

### 3. Architectural Pattern Violation
**Rule Violated:** "Controllers → Services → Repositories pattern" (system.md)  
**Current State:** Routes directly call services, no controller layer, no repository layer  
**Impact:** Business logic mixed with route handlers, database queries in services

**Required Architecture:**
```
Route Handler (Express)
    ↓
Controller (Request/Response handling, validation coordination)
    ↓
Service (Business logic)
    ↓
Repository (Database queries only)
    ↓
Database
```

**Action Items:**
- [ ] **Create Controllers** (one per route module):
  - [ ] `authController.ts` - Handle login, register, password change
  - [ ] `obligationsController.ts` - Handle obligation CRUD operations
  - [ ] `slaController.ts` - Handle SLA creation and extensions
  - [ ] `evidenceController.ts` - Handle evidence uploads
  - [ ] `usersController.ts` - Handle user management
  - [ ] `exportController.ts` - Handle PDF/ZIP exports
  - [ ] `alertsController.ts` - Handle alert triggers

- [ ] **Create Repositories** (database access layer):
  - [ ] `authRepository.ts` - User authentication queries
  - [ ] `obligationsRepository.ts` - Obligation CRUD queries
  - [ ] `slaRepository.ts` - SLA queries
  - [ ] `evidenceRepository.ts` - Evidence queries
  - [ ] `usersRepository.ts` - User management queries
  - [ ] `auditRepository.ts` - Audit log queries
  - [ ] `organizationsRepository.ts` - Organization queries

- [ ] **Refactor Existing Services** (remove direct DB access):
  - [ ] `auditService.ts` - Use auditRepository
  - [ ] `alertService.ts` - Use obligationsRepository, slaRepository
  - [ ] Move all `pool.query()` calls from services to repositories

- [ ] **Update Routes** (call controllers instead of services):
  - [ ] `routes/auth.js` → import and use authController
  - [ ] `routes/obligations.js` → import and use obligationsController
  - [ ] `routes/sla.js` → import and use slaController
  - [ ] `routes/evidence.js` → import and use evidenceController
  - [ ] `routes/users.js` → import and use usersController
  - [ ] `routes/export.js` → import and use exportController
  - [ ] `routes/alerts.js` → import and use alertsController

- [ ] **Rule:** "No business logic in controllers" - Controllers only handle:
  - Request parameter extraction
  - Input validation coordination
  - Calling appropriate service methods
  - Formatting responses (success/error)

**Estimated Effort:** 4-6 days

---

### 4. Frontend Folder Structure Violations
**Rule Violated:** Mandatory structure (frontend.md)  
**Current State:** Missing required folders  
**Impact:** Structure non-compliance

**Required Structure:**
```
/src
    /pages          ✅ EXISTS
    /components     ✅ EXISTS
    /hooks          ❌ MISSING
    /context        ✅ EXISTS
    /api            ✅ EXISTS
    /utils          ❌ MISSING (might exist, need to verify)
    /styles         ❌ MISSING
```

**Action Items:**
- [ ] Create `frontend/src/hooks/` folder
- [ ] Create `frontend/src/utils/` folder (if not exists)
- [ ] Create `frontend/src/styles/` folder
- [ ] Move `App.css` to `frontend/src/styles/App.css`
- [ ] Update imports in `App.js` to reflect new location
- [ ] Create any custom hooks currently inline in components and move to `/hooks`

**Estimated Effort:** 1 day

---

## 🟡 CODE QUALITY IMPROVEMENTS (P1 - Should Fix)

### 5. Input Validation with Validators
**Rule:** Separate validators folder (backend.md)  
**Current State:** Validation likely scattered or using express-validator inline

**Action Items:**
- [ ] Create validator files:
  - [ ] `validators/authValidator.ts` - Login, register, password rules
  - [ ] `validators/obligationValidator.ts` - Obligation creation rules
  - [ ] `validators/slaValidator.ts` - SLA creation and extension rules
  - [ ] `validators/evidenceValidator.ts` - File upload validation
  - [ ] `validators/userValidator.ts` - User management validation

- [ ] Use express-validator chain pattern
- [ ] Controllers should call validators before service layer
- [ ] Return 400 with clear validation errors

**Estimated Effort:** 2-3 days

---

### 6. Type Definitions & Interfaces
**Rule:** "Strict TypeScript everywhere" (system.md)

**Action Items:**
- [ ] Create `backend/src/types/` folder for shared types
- [ ] Define interfaces for all domain models:
  - [ ] `types/User.ts`
  - [ ] `types/Organization.ts`
  - [ ] `types/Obligation.ts`
  - [ ] `types/SLA.ts`
  - [ ] `types/Evidence.ts`
  - [ ] `types/AuditLog.ts`
  - [ ] `types/ObligationOwner.ts`

- [ ] Define request/response types:
  - [ ] `types/requests.ts`
  - [ ] `types/responses.ts`

- [ ] Use strict TypeScript compiler options:
  ```json
  {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
  ```

**Estimated Effort:** 2-3 days

---

## 🟢 VERIFICATION TASKS (P2 - Validate)

### 7. Security Rules Compliance
**Rule:** All security requirements (backend.md)

**Verify:**
- [x] bcrypt(10) for password hashing ✅ (verified in code)
- [ ] Password expiry 90 days - **CHECK IF IMPLEMENTED**
- [ ] Password history in JSONB - **CHECK DATABASE SCHEMA**
- [ ] Account lockout after failed attempts - **CHECK IF IMPLEMENTED**
- [ ] Strict RBAC middleware - **VERIFY IN AUTH MIDDLEWARE**
- [x] Rate limiting (100 req/15 min general, 5 req/15 min auth) ✅ (verified)

**Action Items:**
- [ ] Review auth middleware for RBAC enforcement
- [ ] Verify password expiry logic exists
- [ ] Confirm password history check on password change
- [ ] Test account lockout mechanism

**Estimated Effort:** 1-2 days

---

### 8. Database Triggers Compliance
**Rule:** All enforcement triggers mandatory (database.md)

**Verify These Triggers Exist:**
- [ ] Prevent DELETE on obligations
- [ ] Prevent DELETE on evidence
- [ ] Prevent DELETE on SLAs
- [ ] Prevent DELETE on obligation_owners
- [ ] Prevent UPDATE on evidence
- [ ] Prevent UPDATE to created_at fields
- [ ] Ensure only one active owner per obligation
- [ ] SLA extension creates new row (no updates)
- [ ] Auto-flag late evidence (upload_time > SLA deadline)
- [ ] Write audit logs for all INSERT/UPDATE

**Action Items:**
- [ ] Review `migrations/001_initial_schema.sql` for all triggers
- [ ] Test each trigger manually
- [ ] Document any missing triggers
- [ ] Create migration for missing triggers

**Estimated Effort:** 1 day

---

### 9. Scope Compliance Check
**Rule:** "If a feature is not explicitly listed → DO NOT BUILD IT" (system.md)

**Verify NO Banned Features Exist:**
- [x] ❌ No regulation interpretation ✅
- [x] ❌ No AI advisors, GPT features ✅
- [x] ❌ No circular-mapping ✅
- [x] ❌ No workflow engines ✅
- [x] ❌ No OCR ✅
- [x] ❌ No dashboards with insights ✅
- [x] ❌ No mobile apps ✅
- [x] ❌ No microservices ✅
- [x] ❌ No extra tables beyond 7 ✅
- [x] ❌ No timestamp editing ✅
- [x] ❌ No evidence editing ✅
- [x] ❌ No deletion of critical data ✅

**Status:** ✅ COMPLIANT - No banned features detected

---

### 10. API Endpoints Compliance
**Rule:** Only approved endpoints (backend.md)

**Verify Implementation of Required Endpoints:**

**Auth Module:**
- [ ] POST /auth/login
- [ ] POST /auth/refresh
- [ ] POST /auth/change-password
- [ ] POST /auth/force-password-reset

**Organizations Module:**
- [ ] POST /organizations
- [ ] GET /organizations

**Users Module:**
- [ ] POST /users
- [ ] PUT /users/:id/lock
- [ ] PUT /users/:id/unlock
- [ ] PUT /users/:id/roles
- [ ] GET /users/password-rules

**Obligations Module:**
- [ ] POST /obligations
- [ ] GET /obligations
- [ ] GET /obligations/:id

**SLAs Module:**
- [ ] POST /slas
- [ ] POST /slas/extend

**Obligation Owners Module:**
- [ ] POST /obligation-owners (append-only)

**Evidence Module:**
- [ ] POST /evidence (immutable)
- [ ] GET /evidence

**Audit Module:**
- [ ] GET /audit/logs
- [ ] GET /audit/export

**Action Items:**
- [ ] Create route coverage checklist
- [ ] Implement any missing endpoints
- [ ] Remove any endpoints not in the approved list

**Estimated Effort:** 2-3 days (if endpoints missing)

---

## 📋 MIGRATION PLAN

### Phase 1: TypeScript Migration (Week 1)
1. Setup TypeScript configuration
2. Install all type definitions
3. Convert backend files to TypeScript
4. Convert frontend files to TypeScript
5. Fix compilation errors

### Phase 2: Backend Restructuring (Week 2)
1. Create missing folders (controllers, repositories, validators)
2. Create repository layer with database queries
3. Refactor services to use repositories
4. Create controllers for route handling
5. Update routes to use controllers
6. Rename middleware to middlewares

### Phase 3: Frontend Restructuring (Week 2)
1. Create missing folders (hooks, utils, styles)
2. Move styles to styles folder
3. Extract custom hooks to hooks folder
4. Organize utility functions

### Phase 4: Validators Implementation (Week 3)
1. Create all validator files
2. Implement validation chains
3. Integrate validators in controllers

### Phase 5: Testing & Verification (Week 3-4)
1. Test all API endpoints
2. Verify database triggers
3. Security compliance verification
4. End-to-end testing

---

## ✅ COMPLIANCE CHECKLIST SUMMARY

### Must Fix (P0 - Blocks Production)
- [ ] Migrate entire codebase to TypeScript
- [ ] Create controllers layer
- [ ] Create repositories layer
- [ ] Create validators layer
- [ ] Implement Controllers → Services → Repositories pattern
- [ ] Rename middleware to middlewares
- [ ] Create frontend hooks folder
- [ ] Create frontend styles folder

### Should Fix (P1 - Quality)
- [ ] Implement comprehensive input validation
- [ ] Create strict type definitions
- [ ] Verify all security rules implemented

### Validate (P2 - Verification)
- [ ] Verify database triggers
- [ ] Verify API endpoints coverage
- [ ] Confirm scope compliance (no banned features)

---

## 🎯 TOTAL ESTIMATED EFFORT

- **TypeScript Migration:** 3-5 days
- **Backend Restructuring:** 4-6 days
- **Frontend Restructuring:** 1 day
- **Validators Implementation:** 2-3 days
- **Testing & Verification:** 3-5 days

**Total:** 13-20 business days (~3-4 weeks)

---

## 📝 NOTES

1. **Breaking Changes:** TypeScript migration may reveal hidden bugs - good thing!
2. **Database:** No changes needed - triggers already compliant
3. **Features:** No banned features detected - scope is clean
4. **Priority:** TypeScript + Folder Structure are blockers for "strict compliance"

---

## 🚀 RECOMMENDED APPROACH

**Option A: Big Bang (3-4 weeks)**
- Stop all feature work
- Fix all violations in one go
- Ship compliant version

**Option B: Incremental (6-8 weeks)**
- Migrate to TypeScript first (1-2 weeks)
- Add folders & restructure backend (2-3 weeks)
- Add validators (1 week)
- Testing (1 week)
- Continue feature work in parallel

**Recommendation:** Option A for full compliance, Option B if feature delivery is critical.

---

**Last Updated:** December 26, 2025  
**Next Review:** After TypeScript migration completion
