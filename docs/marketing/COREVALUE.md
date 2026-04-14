# CORE VALUE: COMPLIANCE EXECUTION, NOT COMPLIANCE INTERPRETATION

This entire repository exists for one purpose:

Build a system that makes compliance **time-locked**, **owner-locked**, and **evidence-locked**, so audits become retrieval instead of panic.

The system is NOT allowed to interpret regulations.
The system is NOT allowed to make decisions on behalf of users.
The system is NOT allowed to be "smart."

We solve only ONE problem:
> Compliance work gets delayed because ownership, timelines, and evidence are not enforced.

We fix that by making it impossible to violate those three principles.

==============================
NON-NEGOTIABLE PRODUCT PILLARS
==============================

1. **Immutability First**
   - Every critical action must generate a permanent audit log.
   - Nothing can be edited silently.
   - No destructive updates.

2. **Single Ownership**
   - Every obligation MUST have exactly one owner at all times.
   - Ownership changes must append history, not overwrite.

3. **Strict SLA Enforcement**
   - SLAs cannot be edited.
   - SLA extensions must create new records with reasons.
   - Evidence submitted after SLA date must be flagged as late.

4. **Evidence or It Didn't Happen**
   - Tasks are not "done" without evidence.
   - Evidence cannot be replaced, only appended.
   - Evidence timestamps must be automatic and immutable.

5. **Audit-Ready at All Times**
   - One-click export of obligations + SLA + evidence + audit logs.
   - System must always be inspection-ready.
   - No feature is allowed to break audit-readiness.

==============================
WHAT THIS PRODUCT IS NOT
==============================

To avoid scope creep, the system must NEVER:

- Interpret RBI or government regulations  
- Parse legal circulars  
- Suggest compliance steps  
- Auto-classify regulatory obligations  
- Use AI to predict, decide, or automate compliance  
- Create approval workflows or multi-branch flowcharts  
- Become a generic project management tool  
- Include dashboards that aren't tied to SLA risk  
- Become an ERP or task tool  

If any feature idea touches the above:  
**Reject it immediately. It does not belong in this product.**

==============================
ALLOWED CORE FEATURE SET (MVP)
==============================

1. Obligation creation (title, owner, SLA)
2. Obligation details (owner history, SLA history, evidence, audit log)
3. Evidence uploads (append-only)
4. SLA risk dashboard (Green / Amber / Red)
5. Audit export (PDF / ZIP)
6. Alerts for SLA deadlines (basic, non-automated)
7. User roles and access control (admin, manager, operator)

That's it.  
No more, no less.

==============================
ENGINEERING PRINCIPLES
==============================

- "Correctness > Convenience."  
- "Append-only > Editable."  
- "Simple > Fancy."  
- "Transparency > Intelligence."  
- "Boring tech > Clever tech."  
- "Ship small, ship fast, ship real."

==============================
FUNDAMENTAL QUESTION FOR ANY FEATURE
==============================

Before adding anything, ask:

> "Does this make compliance **more enforceable**, **more inspectable**, or **more immutable**?"

If the answer is NOT a hard "yes,"  
**Do not build it.**

==============================
THE ONE SENTENCE NORTH STAR
==============================

> A system of record for compliance execution, where tasks cannot escape ownership, deadlines, or evidence.

Every commit MUST align with this.
Every engineer MUST follow this.
Every feature MUST reinforce this.

Deviation is not allowed.
