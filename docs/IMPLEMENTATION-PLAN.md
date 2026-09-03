# IMPLEMENTATION-PLAN.md

> Canonical execution plan for the Clinic AI Platform.
> Version: 0.1.0
> Status: Draft; implementation blockers are resolved or scoped, with
> production-release dependencies tracked separately.

## 1. Executive Summary

Implement the smallest complete clinic workflow in dependency order:
engineering foundation, approved infrastructure, identity/tenant access,
patient and doctor foundations, appointment, clinical workflow, AI Gateway
and RAG, human approval, integration, hardening, and release.

Security and tenant isolation are implemented at the point each capability
is introduced, not deferred to final QA. Database changes follow the
conceptual migration order in `DATA-MODEL.MD`. The four engineers work in
parallel only after shared contracts and dependencies are ready. AI begins
only after identity, tenant isolation, authorization, domain services, audit,
and the Tool Gateway exist.

No unresolved provider, role, clinical-status, concurrency, retention, or
other blocking decision may be silently chosen. Production implementation of
an affected capability waits for the decision owner.

## 2. Source-of-Truth Hierarchy

Implementation decisions are governed by the lifecycle order:

1. `docs/product/system-definition.md` — product scope, workflows, users,
   roles, MVP, and ownership.
2. `docs/architecture/architecture-decisions.md` — architecture, boundaries,
   runtime, Nx, AI, reliability, and ownership.
3. `docs/DATA-MODEL.MD` — entities, relationships, statuses, constraints,
   migrations, and data ownership.
4. `docs/API-CONTRACTS.md` — public API behavior and endpoint surface.
5. `docs/SECURITY.md` — protection and security enforcement requirements.
6. `docs/AI-SAFETY.md` — AI capabilities, tools, safety, and governance.
7. `docs/DEVELOPMENT-CONTRACTS.md` — implementation and review rules.
8. This plan — sequencing and execution only; it cannot change the above.

If two documents conflict, the conflict becomes a BLOCKING DECISION before
the affected implementation proceeds. This plan does not rewrite prior
documents or select an unresolved option.

## 3. Current Project State

- Product: multi-tenant clinic management platform with controlled AI
  assistance and human accountability.
- MVP workflow: identity/tenant → patient → appointment/check-in → encounter
  and clinical record → AI assistance/draft → human approval.
- MVP domains: Identity, Tenant/Location, Patient, Doctor Operations,
  Appointment, Clinical, AI/RAG, and internal Audit capability.
- Roles: `PATIENT`, `DOCTOR`, Nurse/Clinical Staff, Receptionist,
  `CLINIC_ADMIN`, `SUPER_ADMIN`; Nurse/Clinical Staff and Receptionist are
  separate application roles using endpoint-specific least privilege and
  default deny.
- Architecture: Nx modular monolith with `apps/web`, `apps/api`,
  `apps/workers`, domain libraries, PostgreSQL, Redis, object storage,
  workers, AI Gateway, and RAG abstraction.
- Data: tenant-scoped resources; application/repository tenant consistency;
  immutable finalized clinical versions with amendment/version workflow.
- API: `/api/v1`, canonical errors, tenant/resource authorization,
  idempotency for retry-sensitive mutations, and no generic finalized-record
  overwrite.
- Security: least privilege, IDOR protection, minimum necessary PHI,
  encryption requirements, auditability, secret isolation, and fail-closed
  sensitive operations.
- AI: explicit tools through Gateway, authorized minimum context, RAG
  filtering, drafts, human approval, no direct database access.
- Development: owner review, versioned migrations, testing at every layer,
  scoped Codex tasks, and no invented APIs/entities/roles.

Billing, Notification, prescriptions, lab results, doctor ratings, and
clinical files are Post-MVP as stated by the approved source decisions.

## 4. Team Structure

| Member | Primary Domain | Secondary Responsibility | Shared Responsibilities |
|---|---|---|---|
| Engineer A | Identity & Security | Tenant, Location, Membership, Roles, Permissions, Audit, shared schema | Security, tests, observability, documentation, review |
| Engineer B | Patient & Clinical | Encounter, clinical documentation, medical records | Security, tests, observability, documentation, review |
| Engineer C | Operations | Doctor, Appointment, Calendar, Check-in, Queue, Billing, Notification | Security, tests, observability, documentation, review |
| Engineer D | AI Platform | Gateway, tools, context, memory, RAG, drafts, evaluation, safety | AI integration, security, tests, observability, documentation, review |

## 5. Implementation Phases

| Phase | Objective | Primary exit |
|---|---|---|
| 0 | Engineering foundation | Nx boundaries, checks, local workflow, and task process ready |
| 1 | Approved infrastructure foundation | Environment, data, observability, and worker boundaries ready |
| 2 | Identity and access | Authenticated tenant context and authorization ready |
| 3 | Core domain foundations | Patient, Doctor, and core contracts ready |
| 4 | Appointment/clinical workflow | Appointment, encounter, and immutable clinical workflow ready |
| 5 | AI foundation | Gateway, context, audit, and RAG boundary ready |
| 6 | AI MVP features | Approved AI reads, summaries, drafts, and approval ready |
| 7 | Cross-domain integration | End-to-end MVP workflow integrated |
| 8 | Security hardening | Security controls and abuse protections validated |
| 9 | Testing/reliability | Full test, retry, failure, and recovery evidence ready |
| 10 | Production readiness | Deployment, backup, monitoring, rollback, and release gate ready |
| 11 | MVP release | Approved MVP released and verified |

## 6. Phase 0 — Engineering Foundation

| Task | Owner | Dependencies | Deliverable | Acceptance criteria |
|---|---|---|---|---|
| Confirm conceptual Nx apps/libs and project graph | Team/Architecture | Blocking DEV-001 | Approved graph decision | Imports and public boundaries are documented; no invented paths are required |
| Establish TypeScript/lint/format/test entry points | Engineer A | Graph decision | Repository checks | Existing configuration is followed; no checks are disabled |
| Establish environment/configuration contract | Engineer A | Security decisions | `docs/CONFIGURATION-AND-SECRETS.md` local/test configuration contract | Secrets are externalized; environments are isolated; production delivery remains release-scoped |
| Establish Git/PR/documentation workflow | Team | DEV-003 | Review workflow | Required owner/security/tenant checks are described |
| Establish CI check plan | Engineer A/C | DEV-002 | `docs/CI-CHECK-INVENTORY.md` | Lint, type check, unit, integration, API, build, security, dependency, Nx, and PR-gate checks are mapped with applicability and blocking status |

No application domain implementation starts until Nx boundaries, secure
configuration handling, and the required decision gates are accepted.

## 7. Phase 1 — Infrastructure Foundation

Implement only approved infrastructure boundaries; do not select unresolved
providers.

1. PostgreSQL connectivity and protected environment access.
2. Redis/cache boundary only as supporting infrastructure, never source of
   truth or authorization.
3. Private object-storage boundary, although clinical files remain Post-MVP.
4. Structured logging, request/correlation IDs, metrics, traces, and audit
   event transport.
5. Queue/outbox/worker boundary for AI, document, search, and future
   notification processing, preserving tenant and actor context.
6. AI provider boundary and managed Secrets Manager/KMS secret delivery through
   workload identity; provider secrets remain isolated to the Gateway/adapter.
7. RAG abstraction; vector implementation follows the already preferred
   PostgreSQL + pgvector direction, while embedding model/dimension remains
   blocking.

Exit requires no credentials in source/logs, isolated environments,
observable failure paths, and approved providers/secret/key decisions.

## 8. Phase 2 — Identity and Access Foundation

Engineer A implements, in order:

1. `users` identity lifecycle and account status handling.
2. `tenants` and `locations` ownership/context.
3. `memberships` and active membership resolution.
4. Separate Nurse/Clinical Staff and Receptionist application-role contracts;
   finalize permissions without inventing them.
5. External identity-provider integration through the provider-neutral
   application boundary using the approved hybrid access-token and rotating
   refresh-token strategy; OIDC adapter, JWT validation, claim mapping,
   account-status synchronization, and application-side revocation are
   guardrails. The 15-minute access token and 7-day rotating refresh session
   are approved. Standard recovery is provider-managed through the application
   callback/handoff flow; recovery exceptions require re-authentication or
   step-up MFA, bounded authorization, and audit. Final provider-contract
   terms remain open.
6. Server-side tenant context and authorization pipeline.
7. Identity/authorization audit events and security signals.
8. API identity/membership endpoints from API Contracts.

Identity and authorization must be complete before sensitive Patient,
Appointment, Clinical, or AI endpoints are implemented.

## 9. Domain Implementation Order

| Order | Domain | Why this order | Dependencies | Owner |
|---|---|---|---|---|
| 1 | Identity/Tenant/Location | Establishes actor and tenant context | Phase 0-1 and auth decisions | A |
| 2 | Patient | Required by appointments and clinical context | Identity/Tenant | B |
| 3 | Doctor/Department/Shifts | Required provider and scheduling resource | Identity/Tenant | C |
| 4 | Appointment | Core operational workflow and scheduling | Patient + Doctor + authorization | C |
| 5 | Encounter/Clinical | Requires patient, appointment, doctor, and access control | Appointment + Patient + auth | B |
| 6 | Audit/shared platform | Cross-cutting evidence and retry support | Identity/context + transaction boundaries | A with all owners |
| 7 | AI Gateway/RAG | Requires authorized application capabilities | Identity, domains, audit, security | D |
| 8 | AI MVP features | Uses stable reads, drafts, and human approval | Gateway + RAG + Clinical | D/B |

Billing, Notification, files, labs, prescriptions, and ratings remain
Post-MVP and are not allowed to expand the MVP critical path.

## Shared Platform Dependency Order

Shared capabilities are cross-cutting infrastructure, not a later standalone
domain milestone. They must be available before any dependent mutation or
event-producing workflow is implemented:

1. **Tenant context** — derive the authenticated actor's valid tenant
   membership and carry tenant/resource context through application services.
2. **Authorization** — enforce role/permission and resource authorization at
   the application boundary before repository access or mutation.
3. **Idempotency** — provide tenant/actor-scoped replay protection for
   retry-sensitive mutations, including the documented same-key/same-payload
   and same-key/different-payload behavior.
4. **Audit** — provide the event contract, redaction rules, actor/tenant
   attribution, and feature integration for sensitive reads and mutations.
5. **Outbox** — provide the post-commit event contract and tenant/originating
   actor context before workflows publish asynchronous work.
6. **Dependent mutations** — only after the relevant shared capabilities and
   domain decisions are approved may Patient, Doctor, Appointment, Clinical,
   or AI mutations proceed.

The shared capabilities may be reviewed or prepared in parallel after their
prerequisites are available, but they are not considered implementation-ready
until their required decisions, migrations, contracts, and tests are approved.
No task is marked `READY` by this ordering section while its corresponding
blocker remains `OPEN`. This section is consistent with the migration order in
Section 11 and the dependency graph in Section 22.

## 10. Domain Implementation Template

For each applicable domain, use this sequence:

1. Define domain types and public contracts.
2. Define/confirm Data Model mapping and status/lifecycle rules.
3. Prepare reviewed versioned migration.
4. Implement repository/data access with tenant scope.
5. Implement domain/application services and business invariants.
6. Add transport/domain validation.
7. Add authorization and ownership/relationship checks.
8. Implement only documented API operations.
9. Add audit events and redaction.
10. Add unit, integration, API, authorization, and tenant tests.
11. Integrate with dependent public contracts.
12. Add logs, metrics, traces, request IDs, and failure behavior.

Skip steps only when genuinely inapplicable; record the reason in the task.

## 11. Database Implementation Plan

| Migration Order | Domain | Tables | Dependencies | Owner | Risk |
|---|---|---|---|---|---|
| 001 | Shared foundation | `extensions (btree_gist)` | None | A | Extension/environment availability |
| 002 | Tenant | `tenants`, `locations` | 001 | A | Tenant root integrity |
| 003 | Identity | `users`, `memberships` | 002 | A | Authentication/membership access |
| 004 | Shared platform | `idempotency_keys` | 002, 003 | A | Retry identity, actor/tenant scope |
| 005 | Audit | `audit_events` | 002, 003 | A | Sensitive-event evidence |
| 006 | Patient | `patients` | 002, 003 as applicable | B | PHI and tenant scope |
| 007 | Doctor | `departments`, `doctors`, `doctor_working_shifts` | 002, 003 | C | Provider/location relationships |
| 008 | Shared platform | `outbox_events` | 002, 003 | A | Reliable post-commit events |
| 009 | Appointment | `appointments` | 006, 007, 008 | C | Double booking/concurrency |
| 010 | Clinical | `encounters`, `medical_records`, `medical_record_versions`, `patient_allergies` | 006, 007, 009 | B | Immutable history/PHI |
| 011 | AI | `ai_conversations`, `ai_messages`, `ai_drafts`, `knowledge_documents`, `knowledge_chunks` | 002, 006, 010 | D | Retention/RAG governance |
| 012 | Files | `clinical_files` | 006, 010 | B | Post-MVP and private storage |
| 013 | Billing | `invoices`, `payment_webhook_events` | 002, 006, 009 | C | Post-MVP/payment integrity |
| 014 | Constraints/indexes | Approved indexes and constraints | Prior migrations/ERD | A + affected owners | Performance and migration safety |

The order is conceptual and may change only after final ERD/decisions. No
migration is created by this plan. Cross-domain foreign-key or constraint
changes require affected-owner review.

## 12. API Implementation Plan

| API Area | Domain | Dependencies | Owner | Phase |
|---|---|---|---|---|
| Current user/memberships | Identity | Auth, membership | A | 2 |
| Tenant/location | Tenant | Auth, tenant context | A | 2 |
| Patient create/read/update/search | Patient | Tenant auth, patient repository | B | 3 |
| Doctor/profile/shift/availability | Doctor | Tenant auth, schedules | C | 3 |
| Appointment create/read/list/update/cancel/check-in/availability | Appointment | Patient, Doctor, idempotency | C | 4 |
| Encounter and medical record workflow | Clinical | Patient, appointment, authorization | B | 4 |
| Allergy authorized read | Clinical | Patient authorization | B | 4 |
| AI conversation/messages/drafts/review/approve/reject | AI | Gateway, clinical context, audit | D | 6 |
| Knowledge search | RAG | Retrieval authorization and embedding decision | D | 5-6 |
| Audit | Audit | Internal event contracts | A | 2 onward |

No undocumented endpoint is added. Billing, files, notifications,
prescriptions, labs, and ratings are not MVP API work.

### MVP API Operation Traceability

The API contract contains 37 MVP endpoint operations. Each operation is
mapped below to a concrete implementation task; the task must not start
until all listed dependencies and blocking decisions are complete.

| Operation | Task ID | Domain | Owner | Dependencies | Acceptance criteria |
|---|---|---|---|---|---|
| `GET /api/v1/me` | API-ID-001 | Identity | A | AUTH-001 | Returns only authenticated user's permitted identity |
| `GET /api/v1/me/memberships` | API-ID-002 | Identity | A | AUTH-001 | Returns only caller's valid memberships |
| `GET /api/v1/tenants/{tenant_id}` | API-TEN-001 | Tenant | A | TEN-001 | Membership-scoped tenant response |
| `PATCH /api/v1/tenants/{tenant_id}` | API-TEN-002 | Tenant | A | TEN-001, BLOCK-004 | Authorized update, concurrency-safe |
| `GET /api/v1/tenants/{tenant_id}/locations` | API-TEN-003 | Tenant | A | TEN-001 | Tenant-scoped allowlisted paginated list using the approved cursor contract |
| `POST /api/v1/tenants/{tenant_id}/locations` | API-TEN-004 | Tenant | A | TEN-001, PLAT-001 | Authorized idempotent creation |
| `POST /api/v1/patients` | API-PAT-001 | Patient | B | PAT-001, PLAT-001 | Tenant-scoped creation and audit |
| `GET /api/v1/patients/{patient_id}` | API-PAT-002 | Patient | B | PAT-001, AUTH-002 | Ownership/relationship and field filtering pass |
| `PATCH /api/v1/patients/{patient_id}` | API-PAT-003 | Patient | B | PAT-001, BLOCK-004 | Allowed fields only; stale update rejected |
| `GET /api/v1/patients` | API-PAT-004 | Patient | B | PAT-001 | Allowlisted search and approved pagination isolation pass |
| `GET /api/v1/doctors` | API-DOC-001 | Doctor | C | DOC-001 | Tenant/permission-scoped list using the approved cursor contract |
| `GET /api/v1/doctors/{doctor_id}` | API-DOC-002 | Doctor | C | DOC-001 | Tenant/resource authorization passes |
| `GET /api/v1/doctors/{doctor_id}/shifts` | API-DOC-003 | Doctor | C | DOC-001 | Authorized shift list and approved filters/pagination pass |
| `PATCH /api/v1/doctors/{doctor_id}` | API-DOC-004 | Doctor | C | DOC-001, BLOCK-004 | Allowlisted profile update is authorized |
| `POST /api/v1/appointments` | API-APPT-001 | Appointment | C | PAT-002, DOC-001, PLAT-001, BLOCK-004 | Idempotent create and double-booking protection pass |
| `GET /api/v1/appointments/{appointment_id}` | API-APPT-002 | Appointment | C | APPT-001 | Tenant/resource access and audit pass |
| `GET /api/v1/appointments` | API-APPT-003 | Appointment | C | APPT-001 | Allowlisted filters and approved pagination isolation pass |
| `PATCH /api/v1/appointments/{appointment_id}` | API-APPT-004 | Appointment | C | APPT-001, BLOCK-004 | Valid reschedule/update and stale conflict pass |
| `POST /api/v1/appointments/{appointment_id}/cancel` | API-APPT-005 | Appointment | C | APPT-001, BLOCK-002 | Valid cancellation transition and audit pass |
| `POST /api/v1/appointments/{appointment_id}/check-in` | API-APPT-006 | Appointment | C | APPT-001, BLOCK-002 | Authorized check-in transition and audit pass |
| `GET /api/v1/appointments/availability` | API-APPT-007 | Appointment | C | DOC-001, APPT-001 | Advisory availability uses shifts and active appointments |
| Explicit `NO_SHOW` application transition command | API-APPT-008 | Appointment | C | APPT-001, BLOCK-002 | Explicit command, authorization, validation, idempotency, audit, and negative tests pass |
| `POST /api/v1/encounters` | API-CLIN-001 | Clinical | B | PAT-002, APPT-001 | Tenant-consistent encounter creation passes |
| `GET /api/v1/encounters/{encounter_id}` | API-CLIN-002 | Clinical | B | CLIN-001 | Authorized clinical read and audit pass |
| `POST /api/v1/encounters/{encounter_id}/medical-records` | API-CLIN-003 | Clinical | B | CLIN-001, PLAT-001 | Draft version creation is immutable/audited |
| `GET /api/v1/medical-records/{medical_record_id}` | API-CLIN-004 | Clinical | B | CLIN-001 | Current authorized version is field-filtered |
| `POST /api/v1/medical-records/{medical_record_id}/review` | API-CLIN-005 | Clinical | B | CLIN-002 | Canonical `IN_REVIEW` status and transition enforced |
| `POST /api/v1/medical-records/{medical_record_id}/finalize` | API-CLIN-006 | Clinical | B | CLIN-002 | Authorized finalize locks current version |
| `POST /api/v1/medical-records/{medical_record_id}/amendments` | API-CLIN-007 | Clinical | B | CLIN-002, PLAT-001 | Amendment creates version with reason/audit |
| `GET /api/v1/patients/{patient_id}/allergies` | API-CLIN-008 | Clinical | B | PAT-002, CLIN-001 | Authorized tenant-scoped allergy read |
| `POST /api/v1/ai/conversations` | API-AI-001 | AI | D | AI-001, AUTH-002 | Authorized tenant/context conversation created |
| `POST /api/v1/ai/conversations/{conversation_id}/messages` | API-AI-002 | AI | D | API-AI-001, AI-001, PLAT-001 | Validated message and safe response/async result |
| `GET /api/v1/ai/conversations/{conversation_id}` | API-AI-003 | AI | D | API-AI-001 | Authorized access using the approved pagination contract |
| `POST /api/v1/ai/drafts` | API-AI-004 | AI | D | AI-001, CLIN-001, PLAT-001 | Draft-only output with audit and authorization |
| `POST /api/v1/ai/drafts/{draft_id}/review` | API-AI-005 | AI | D | API-AI-004 | Human reviewer moves draft to review |
| `POST /api/v1/ai/drafts/{draft_id}/approve` | API-AI-006 | AI | D/B | API-AI-005, CLIN-002 | Human approval gates application handoff |
| `POST /api/v1/ai/drafts/{draft_id}/reject` | API-AI-007 | AI | D | API-AI-005 | Authorized rejection is audited |
| `POST /api/v1/ai/knowledge/search` | API-RAG-001 | RAG | D | AI-001, BLOCK-005 | Tenant/status/permission-filtered results using approved pagination |

## 13. Security Implementation Plan

| Security Control | Implemented In | Owner | Required Before |
|---|---|---|---|
| Authentication/session validation | Identity foundation/API | A | Any protected endpoint |
| Membership/tenant context | Identity/Tenant services | A | Any tenant resource |
| Authorization/IDOR checks | Every application service | A + domain owner | Each domain endpoint |
| Input/output validation/filtering | API + domain services | API/domain owner | Each endpoint |
| Secrets/config isolation | Phase 0-1 | A/Operations | Any external credential |
| Tenant-aware repositories/cache/jobs | Each domain integration | Domain owner | Each tenant resource |
| Audit events/redaction | Shared/Audit + feature | A + feature owner | Each sensitive operation |
| Idempotency/retry safety | Shared + mutation | A + feature owner | Appointment/AI mutations |
| AI Gateway/tool authorization | Phase 5 | D + A/affected owner | Any AI feature |
| Human approval gate | Clinical/AI services | B + D | AI clinical draft |
| Rate limits/abuse controls | API/Gateway | A/D | Production exposure |
| Encryption/key policy | Infrastructure | Security/Operations | Production data/provider use |
| File/webhook controls | Post-MVP feature | B/C | File/Billing release |

Identity, tenant context, authorization, input validation, and audit are
blocking prerequisites for sensitive domain implementation.

## 14. Tenant Isolation Implementation

Checkpoints must exist in every phase:

- API derives tenant from authenticated membership.
- Application services carry actor/tenant/resource context.
- Repositories scope every tenant-owned query and mutation.
- Cache keys include tenant scope and never grant authorization.
- Jobs/outbox events preserve tenant and originating actor context.
- Files remain private and backend-authorized.
- Search/RAG index and retrieval apply tenant/status/permission filters.
- AI context and tool results are tenant/resource filtered.
- Audit events include tenant and actor references without unnecessary PHI.

Tenant A versus Tenant B tests run before each domain integration, not only
in Phase 9. A resource lookup by ID alone is a defect.

## 15. Clinical Data Implementation

Implement Patient before Appointment/Clinical. Then implement:

1. Encounter creation and lifecycle.
2. Medical record plus initial draft version.
3. Clinical note/history read and authorized write.
4. Review and finalize workflow.
5. Immutable finalized version enforcement.
6. Amendment creates a new version with reason and authorship.
7. Required clinical access/mutation audit events.
8. Allergy authorized read in MVP; other clinical entities retain their
   documented Post-MVP status.

Never implement generic overwrite semantics for finalized records. Use the
canonical `IN_REVIEW` status before finalization.

## 16. AI Implementation Plan

AI work is blocked until these exist:

1. Identity and authenticated tenant context.
2. Tenant isolation in application/repository access.
3. Authorization and resource relationships.
4. Patient/Clinical/Appointment public domain services.
5. Documented API boundaries.
6. Audit event path and redaction.
7. AI safety rules and failure behavior.
8. Tool Gateway with explicit contracts.
9. Approved guarded AI profile: read/summarization/draft-first, tenant-scoped
   knowledge by default, default-deny writes, and fail-closed sensitive paths.

Then execute:

```text
AI Foundation → Context Assembly → Retrieval/RAG → Tool Gateway
→ Approved Tools → Human Approval → AI MVP Features → Safety Testing
```

AI is never a direct database client or privileged actor.

## 17. AI Tool Implementation Order

| Tool | Read/Write | Domain | Required Permission | Approval | Dependencies | Owner |
|---|---|---|---|---|---|---|
| `get_patient` | Read | Patient | Authorized patient access | No for read | Patient service, auth, audit | D/B |
| `get_recent_encounters` | Read | Clinical | Authorized clinical access | No for read | Encounter/record service | D/B |
| `get_medications` | Read | Clinical | Authorized clinical access | No for read | Approved medication capability | D/B |
| `get_allergies` | Read | Clinical | Authorized clinical access | No for read | Allergy read API | D/B |
| `search_knowledge` | Read | RAG | Knowledge retrieval permission | No, unless downstream clinical use | RAG boundary/governance | D |
| `draft_clinical_note` | Draft | Clinical/AI | Draft-generation permission | Mandatory | Encounter context, AI draft model, human gate | D/B |
| `create_appointment` | Conditional write | Appointment | Appointment-create permission | Product/workflow decision required | Patient/Doctor/availability/idempotency | D/C |

These are the tools already named by the AI architecture/safety documents;
they are not implemented or granted by this plan. No generic tool is allowed.

## 18. RAG Implementation

RAG implementation dependencies are:

1. Tenant and document authorization model.
2. Approved document status and global/tenant governance.
3. Ingestion and metadata contract.
4. Safe chunking and source attribution.
5. Approved embedding model/dimension (`1536`) and re-embedding plan for any future change.
6. PostgreSQL + pgvector abstraction already preferred for MVP, with no
   public vector implementation details.
7. Retrieval filtering by tenant/status/permission.
8. Malicious-document and prompt-injection handling.
9. Archive/deletion propagation.
10. Cross-tenant, stale, malicious, and authorization tests.

No RAG work may expose Tenant B content to Tenant A or treat document text as
instructions.

## 19. Human Approval Workflow

Implement the approval path after AI drafts and Clinical Service are ready:

```text
AI Draft → Human Review → Approval/Rejection
→ Application Validation → Clinical Application Service → Final Mutation
```

The server enforces reviewer identity, tenant/resource authorization,
approvable draft state, authorship, timestamps, idempotency, and audit. UI
state or model instructions are not enforcement. Rejection remains a
terminal/accountable outcome according to the approved draft lifecycle.

## 20. Cross-Domain Features

| Feature | Domains | Primary Owner | Supporting Owners | Dependencies |
|---|---|---|---|---|
| Staff membership/onboarding | Identity, Tenant | A | Product/affected owners | Auth and role decision |
| Patient registration | Patient, Identity/Tenant, Audit | B | A | Tenant context, permissions |
| Appointment scheduling | Appointment, Patient, Doctor, Shared | C | A, B | Availability, idempotency, constraints |
| Check-in/queue view | Appointment, Patient | C | B | Appointment status/authorization |
| Clinical encounter | Clinical, Patient, Appointment, Doctor | B | A, C | Authorized references |
| AI patient/clinical assistance | AI, Patient, Clinical, Identity, Audit | D | A, B | Gateway, context, tools |
| AI appointment assistance | AI, Appointment, Patient, Doctor | D | B, C | `create_appointment` decision |
| Human-approved clinical draft | AI, Clinical, Audit | B/D | A | Approval/status decision |

All cross-domain work uses public application contracts, never internal
repositories or database access.

## 21. Parallel Work Plan

| Phase | Member 1 (A) | Member 2 (B) | Member 3 (C) | Member 4 (D) | Shared/Blocking |
|---|---|---|---|---|---|
| 0 | Foundation/checks (READY after DEV decisions) | Review domain contracts | Review operations contracts | Review AI boundary | Nx graph and CI decisions |
| 1 | Auth/secrets/observability boundary | Patient/clinical infra review | DB/worker/runtime review | Self-hosted Dify Gateway boundary; remaining AI governance follow-ups | Providers and environments |
| 2 | Identity/Tenant (PRIMARY) | BLOCKED on auth | BLOCKED on auth | BLOCKED on auth | S1: access foundation |
| 3 | Audit/shared contracts (REVIEW) | Patient (READY after Phase 2) | Doctor/shifts (READY after Phase 2) | BLOCKED on domain interfaces | S2: tenant tests |
| 4 | Auth/audit support | Clinical types/repository prep (PARALLEL after Patient); encounter integration BLOCKED on Appointment | Appointment (after Patient/Doctor) | BLOCKED until clinical contracts | S3: workflow integration |
| 5 | Authorization/audit review | Clinical public interfaces | Appointment public interfaces | AI Gateway/RAG (after prerequisites) | S4: Tool Gateway |
| 6 | Security review | Draft approval integration | Appointment AI support only if approved | AI tools/features | S5: human approval |
| 7 | Cross-domain audit | Clinical integration | Scheduling integration | AI integration | Contract/migration review |
| 8 | Security hardening | Clinical/PHI hardening | abuse/concurrency hardening | AI safety hardening | S6: security validation |
| 9 | Authorization/tenant tests | Clinical/E2E tests | reliability/appointment tests | AI safety/provider tests | Full test evidence |
| 10-11 | Release/security owner | Clinical sign-off | Operations/release sign-off | AI safety sign-off | MVP gate |

States mean: `BLOCKED` requires a prerequisite decision, `READY` can begin,
`PARALLEL` is safe alongside other work, and `REVIEW` requires affected-owner
review before proceeding.

## 22. Dependency Graph

```text
Open blocking decisions
        ↓
Engineering/Nx foundation
        ↓
Approved environment + PostgreSQL/observability boundaries
        ↓
Identity + Tenant + Membership + Authorization (BLOCKED until auth/role decisions)
        ↓
Patient (BLOCKED on access foundation) ─────┐
        ↓              │
Doctor/Shift (PARALLEL after access) ───────┤
        ↓              ↓
Idempotency + Audit + Outbox (REVIEW/READY after identity; migrations 004/005/008)
        ↓              ↓
Appointment (BLOCKED on authorization/concurrency) → Encounter (BLOCKED on Appointment)
                                                       → Clinical Record/Approval/Amendment
        ↓
AI Gateway (BLOCKED on prerequisites) → Context → RAG → Approved Tools → AI MVP Features
                                      ↓
                               Human Approval
                                      ↓
                         Integration → Hardening → Release
```

Critical path is blocking decisions → access foundation → Patient/Doctor →
Appointment/Clinical → AI Gateway/approval → integration and release checks.
Audit, idempotency, and outbox must be available before the dependent
mutations/events, even though their feature work can be reviewed in parallel.

## 23. Critical Path

| Step | Task | Dependency | Owner | Why Critical |
|---|---|---|---|---|
| 1 | Resolve auth/role/concurrency/status/provider blockers | Product/architecture decisions | A/B/C/D | Unsafe to implement affected paths without them |
| 2 | Establish Nx, CI, environments, and boundaries | Step 1 where applicable | A/team | Prevents structural rework |
| 3 | Implement identity, membership, tenant context, authorization | Steps 1-2 | A | All sensitive APIs depend on it |
| 4 | Implement Patient contract/repository/API/tests | Step 3 | B | Appointment and Clinical dependency |
| 5 | Implement Doctor/shifts | Step 3 | C | Scheduling dependency |
| 6 | Implement appointment transaction/idempotency/concurrency | Steps 4-5 | C | Core operational workflow |
| 7 | Implement encounter/immutable clinical workflow | Steps 4, 6 | B | AI clinical context and approval dependency |
| 8 | Implement audit/idempotency/outbox/observability integration | Steps 3-7 incrementally; migrations 004, 005, 008 | A/all | Evidence, retry safety, and reliable async behavior |
| 9 | Implement AI Gateway/RAG/tools | Steps 3, 7-8 and AI decisions | D | AI must not bypass boundaries |
| 10 | Integrate AI drafts/human approval/E2E | Step 9 | B/D | Required AI MVP safety path |
| 11 | Hardening, recovery, release gate | Steps 1-10 | All | Production readiness |

## 24. MVP Task Breakdown

| Task ID | Title | Phase | Owner | Dependencies | Status |
|---|---|---:|---|---|---|
| FOUND-001 | Approve Nx project graph and public boundaries | 0 | Team/A | DEV-001 | APPROVED — DESIGN RECORDED |
| FOUND-002 | Establish local/test configuration and secret rules | 0-1 | A | SEC-007/DEV-009 | IN REVIEW |
| FOUND-003 | Establish CI check inventory and PR gates | 0 | A/C | DEV-002 | IN REVIEW |
| AUTH-001 | Implement provider-neutral user/membership/tenant context boundary | 2 | A | FOUND-001, approved identity-context decision | READY FOR PLAN APPROVAL |
| AUTH-002 | Implement authorization and IDOR policy tests | 2 | A | AUTH-001, permission matrix | COMPLETED — MERGED TO MAIN |
| TEN-001 | Implement tenant/location APIs and tests | 2 | A | AUTH-001/002, canonical TEN-001 ADR-01..06 | COMPLETED — MERGED TO MAIN |
| PAT-001 | Implement tenant-scoped Patient types/repository | 3 | B | AUTH-002, TEN-001 | READY |
| PAT-002 | Implement Patient API create/read/update/search | 3 | B | PAT-001 | BLOCKED |
| DOC-001 | Implement Doctor/Department/Shift capabilities | 3 | C | AUTH-002, TEN-001 | BLOCKED |
| APPT-001 | Implement appointment create/list/read/update/cancel | 4 | C | PAT-002, DOC-001, PLAT-001, pagination decision | BLOCKED |
| APPT-002 | Implement availability/check-in/status transitions and explicit `NO_SHOW` command | 4 | C | APPT-001, BLOCK-002 | BLOCKED |
| APPT-003 | Implement appointment idempotency/double-booking tests | 4 | C/A | APPT-001, PLAT-001, concurrency decision | BLOCKED |
| CLIN-001 | Implement encounter and clinical record/version model | 4 | B | PAT-002, APPT-001 | BLOCKED |
| CLIN-002 | Implement review/finalize/amendment immutability workflow | 4 | B | CLIN-001, `IN_REVIEW` lifecycle contract | BLOCKED |
| AUD-001 | Implement audit event contract and feature integration | 2-4 | A/all | AUTH-001, migration 005 | BLOCKED |
| PLAT-001 | Implement idempotency and outbox shared contracts/schema integration | 2-4 | A/all | AUTH-001, migrations 004/008 | BLOCKED |
| AI-001 | Implement AI Gateway/tool contract boundary | 5 | D | AUTH-002, AUD-001, AI decisions | BLOCKED |
| RAG-001 | Implement approved retrieval abstraction and isolation tests | 5-6 | D | AI-001, embedding/governance decisions | BLOCKED |
| AI-002 | Implement read-only Patient/Clinical tools | 6 | D/B | AI-001, PAT-002, CLIN-001 | BLOCKED |
| AI-003 | Implement clinical draft and human approval workflow | 6 | D/B | AI-002, CLIN-002, approved AI-007 workflow, approved AI-006 escalation policy | READY AFTER DEPENDENCIES |
| INT-001 | Integrate end-to-end MVP workflow | 7 | All | Domain/API tasks | BLOCKED |
| SEC-001 | Execute security/tenant/AI hardening suite | 8-9 | A/all | INT-001 | BLOCKED |
| REL-001 | Complete reliability/recovery/release gate | 9-10 | All | SEC-001, RPO/RTO decisions | BLOCKED |

Each task is small enough for one focused Codex session after dependencies
are complete. No Post-MVP task is included.

### AUTH-001 Scope Boundary

AUTH-001 establishes provider-neutral identity and tenant-context contracts,
identity domain invariants, the platform context abstraction, and the public
identity application boundary needed to establish a valid actor and membership
context. It must fail closed for missing identity, invalid membership, or a
tenant identifier that is not supported by the actor's verified membership.

AUTH-001 does not implement a provider SDK or provider-specific adapter,
tenant/location management APIs, a full authorization or IDOR policy engine,
database schema/migrations/repositories, or any Patient, Doctor, Appointment,
Clinical, or AI functionality. Tests use deterministic synthetic data and
verify authenticated, unauthenticated, invalid-membership, cross-tenant, and
provider-payload isolation cases. The implementation must use the approved
Nx public boundaries and expose no credentials, tokens, ORM types, or
provider-specific claims through public contracts.

### PAT-001 Scope Boundary

PAT-001 establishes tenant-scoped Patient contracts and the Patient repository
port. Every repository lookup and list contract must require `tenantId` and
must not make cross-tenant discovery possible. The task adds deterministic
tests for tenant-scope invariants and repository contract behavior using
synthetic data only.

PAT-001 does not add HTTP handlers or routes, Patient create/read/update/search
application behavior, database migrations or a concrete database adapter,
authorization policy beyond the existing shared boundary, audit integration,
or any Clinical, Appointment, Doctor, or AI capability. Those remain in
PAT-002 and their separately scoped dependent tasks.

## 25. Task Granularity

Tasks must have one clear owner, bounded files/modules, explicit dependencies,
and a testable completion condition. Split broad work by contract, repository,
service, endpoint, security test, or integration boundary. Do not assign a
task such as “build patient management” without these boundaries.

## 26. Codex Execution Plan

Codex receives Task ID, context, relevant documents, owner, dependencies,
allowed scope, expected changes, acceptance criteria, and tests. It must not
start while a dependency is incomplete.

Codex stops and reports when documentation conflicts, a required decision is
unresolved, a boundary is unclear, an API is missing, the Data Model is
ambiguous, or a security/AI requirement cannot be satisfied. It must not
invent a solution to unblock itself.

## 27. Codex Task Template

```text
TASK ID:
TITLE:
OWNER:
DOMAIN:
PHASE:

OBJECTIVE:
CONTEXT:
READ FIRST:
-
DEPENDENCIES:
-
ALLOWED SCOPE:
-
FORBIDDEN SCOPE:
-
REQUIREMENTS:
-
SECURITY:
-
AI SAFETY:
-
TESTS:
-
ACCEPTANCE CRITERIA:
-
EXPECTED OUTPUT:
-
```

## 28. Test Implementation Order

| Test Layer | Starts In Phase | Required Before |
|---|---:|---|
| Unit | 0/each domain | Domain service completion |
| Integration | 1-2 | Repository/domain integration |
| Database/migration | 1/each schema | Migration review/application |
| Authorization | 2 | Any sensitive endpoint |
| Tenant isolation | 2/each domain | Each domain integration |
| API | 2/each API area | Endpoint completion |
| AI safety | 5 | Any AI feature release |
| End-to-end | 7 | MVP release gate |

## 29. Security Checkpoints

- **S1 — Identity/access:** authentication, membership, authorization, and
  `401`/`403` behavior verified before sensitive endpoints.
- **S2 — Tenant isolation:** direct/indirect Tenant A/B tests pass across
  API, repositories, cache, jobs, search, and audit.
- **S3 — Clinical protection:** PHI filtering, immutability, amendments,
  authorship, and audit verified.
- **S4 — Tool Gateway:** allowlist, permission, tenant scope, validation,
  output filtering, timeout, and audit verified.
- **S5 — Human approval:** AI drafts cannot become final without server-side
  authorized human approval.
- **S6 — Pre-production:** secrets, encryption, rate limits, logging,
  recovery, monitoring, and release evidence verified.

## 30. Integration Checkpoints

After each major domain group, integrate public contracts, run affected
tests, verify migrations/constraints, authorization, tenant isolation,
observability, idempotency, and error behavior. Do not accumulate all
integration work until the end.

## 31. Definition of Done

Use `DEVELOPMENT-CONTRACTS.md`: code/contract behavior is implemented,
tests pass, security and tenant isolation are validated, API/Data Model are
respected, audit and observability exist, migrations are reviewed,
backward compatibility is considered, documentation is updated, and the
affected owner has reviewed the change.

## 32. Milestone Definition

| Milestone | Goal | Included tasks | Dependencies | Owners | Exit criteria | Risks |
|---|---|---|---|---|---|---|
| M0 Foundation | Ready to develop safely | FOUND-001..003 | Blocking decisions | Team | Boundaries/checks/config contract approved | Nx/CI decisions |
| M1 Access | Secure tenant context | AUTH-001..002, TEN-001, AUD-001 | M0, auth/role decisions | A | Auth, membership, authorization, audit tests pass | Identity decisions |
| M2 Core domains | Patient/Doctor ready | PAT-001..002, DOC-001 | M1 | B/C | Tenant-scoped APIs and tests pass | Cross-domain coupling |
| M3 Workflow | Appointment/Clinical ready | APPT-001..003, CLIN-001..002 | M2, status/concurrency decisions | B/C | Scheduling and immutable clinical flow pass | Double booking/PHI |
| M4 AI foundation | Safe AI boundary | AI-001, RAG-001 | M1, M3, AI decisions | D | Gateway/RAG isolation tests pass | Provider/governance |
| M5 AI MVP | Safe AI features | AI-002..003 | M4, approval decision | B/D | Draft/review/approval and safety tests pass | AI misuse |
| M6 Integrated MVP | Complete workflow | INT-001 | M5 | All | E2E flow and contracts pass | Integration defects |
| M7 Release | Production-ready MVP | SEC-001, REL-001 | M6, release decisions | All | Release gate, recovery, monitoring, rollback evidence | Open operations decisions |

## 33. MVP Release Gate

MVP is production-ready only when:

- approved product workflow is functionally complete;
- identity, authorization, tenant isolation, IDOR, and PHI controls pass;
- Patient, Appointment, Encounter, Clinical Record, AI Draft, and Audit
  integrity is verified;
- API contracts, errors, idempotency, and compatibility pass;
- AI Gateway, RAG filtering, output validation, human approval, and fail
  closed behavior pass;
- database constraints/migrations and immutable history are verified;
- performance/availability targets are approved, not invented;
- logs, metrics, traces, alerts, audit, backups, restore, deployment, and
  rollback are ready;
- no blocking decision remains open for the released capability.

No compliance certification is claimed.

## 34. Production Readiness

| Area | Required evidence |
|---|---|
| Infrastructure | Approved environment, PostgreSQL/Redis/storage/worker boundaries |
| Security/secrets | Auth, permissions, encryption, secret isolation, rate limits |
| Database/migrations | Reviewed forward-compatible migrations, constraints, integrity checks |
| Backups/recovery | Protected backups, restore test, approved RPO/RTO |
| Monitoring/logging | Structured telemetry, request IDs, security signals, audit |
| API | Contract, error, compatibility, idempotency, filtering tests |
| Reliability | Timeout/retry/failure behavior without duplicates |
| AI | Gateway, tool authorization, safety tests, provider failure handling |
| Tenant isolation | Direct/indirect Tenant A/B evidence |
| Deployment | Promotion, rollback, incident readiness |

SLO/SLI, RPO/RTO, providers, alert thresholds, and exact rate limits are
OPEN DECISIONS until approved.

## 35. Risk Register

| Risk ID | Risk | Probability | Impact | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|
| R-001 | Unresolved auth/role/status decisions cause rework | High | High | Resolve before affected implementation | A/Product | Open |
| R-002 | Tenant isolation defect | Medium | Critical | Cross-tenant tests at every phase/layer | A + all | Open |
| R-003 | Domain coupling/private imports | Medium | High | Nx constraints/public contracts/review | Team | Open |
| R-004 | Appointment double booking | Medium | High | Scheduling constraints, transaction, idempotency tests | C | Open |
| R-005 | Clinical overwrite or approval bypass | Low/Medium | Critical | Immutable version workflow and server-side gate | B/D | Open |
| R-006 | AI prompt/tool abuse or PHI leakage | Medium | Critical | Gateway, minimum context, red-team tests, fail closed | D/A | Open |
| R-007 | Migration/index performance risk | Medium | High | Expand/contract, review, realistic tests | A/owner | Open |
| R-008 | Infrastructure/provider decision delay | High | High | Keep blocked work explicit; no provider guessing | A/Operations | Open |
| R-009 | Codex modifies unrelated scope | Medium | Medium | Task contract, allowed files, review, tests | Team | Open |
| R-010 | Incomplete recovery/monitoring | Medium | High | Release checklist and restore/alert evidence | Operations | Open |

## 36. Blocking Decisions

# Blocking Decisions

| ID | Decision | Why Blocking | Affected Phase | Affected Team Member | Affected Documents | Owner | Status |
|---|---|---|---|---|---|---|---|
| BLOCK-001 | Specific authentication provider/session/token/recovery details | Auth0-style Managed CIAM OIDC/OAuth2 target profile, 15-minute access token, 7-day rotating refresh session, replay-family revocation, MFA scope, application-side revocation, account-status guardrails, provider-managed recovery, and application-enforced step-up exceptions are approved; final provider contract, region/residency, and service-level terms remain release dependencies | 0-2 | A/all | Architecture, Security, API | A/Security | Resolved for implementation — release terms open |
| BLOCK-002 | Final permission matrix for separate Nurse/Clinical Staff and Receptionist roles | Endpoint-specific least privilege and default deny are approved; implementation must use documented permissions and deny unspecified operations | 2-4 | A/B/C | System, Data, API, Security | Product/A | Resolved |
| BLOCK-003 | Clinical lifecycle uses canonical `IN_REVIEW` | Status naming conflict resolved; remaining workflow implementation must use the approved value | 4-6 | B/D | Architecture, Data, API, AI Safety | Product/B | Resolved |
| BLOCK-004 | Public conflict and stale-update semantics | Strong `If-Match`/ETag semantics, monotonic `BIGINT` coverage for canonical mutable MVP resources, immutable `medical_record_versions` boundary, and domain-specific retry policy are approved; implementation must enforce no-auto-retry for appointment/clinical/AI approval mutations, one-retry allowlist for explicitly idempotent patient/profile and tenant metadata mutations, and security-context re-checks | 4, 7-9 | B/C | Architecture, API, Development | Architecture/B/C | Resolved |
| BLOCK-005 | AI platform/provider/model/retention/RAG governance | Self-hosted Dify, controlled LLM/Embedding adapters, pinned model pair, guarded MVP profile, lifecycle, safety thresholds, Legal Hold, typed knowledge mapping, tenant-only knowledge, capability classes, actor context, bounded controls and risk-tiered escalation are approved; provider evidence and exact production limit values remain release dependencies | 1, 5-6 | D/A | Architecture, Security, AI Safety | Product/D/Security | Resolved for implementation — release terms open |
| BLOCK-006 | Secrets/key/cloud architecture | Managed Secrets Manager/KMS, workload-identity delivery, selective classified-PHI field/envelope encryption, key-version metadata, rotation/revocation and provider-secret isolation are approved; exact cloud topology remains operational/release detail | 1, 8-10 | A/Operations | Architecture, Security | Security/Operations | Resolved for MVP |
| BLOCK-007 | Compliance/residency/retention/deletion | MVP-scoped governance boundary and Product/Compliance ownership are approved; clinical retention values, residency, export/deletion/anonymization scope, audit policy and backup targets remain production-release dependencies | 1, 8-10 | All | System, Architecture, Security | Product/Compliance | Resolved for MVP — release values open |
| BLOCK-008 | Clinical file MVP scope | Clinical files are approved out of MVP; file schema, storage, APIs, workers, and AI ingestion are deferred to Post-MVP | 1, 8 | B/D | System, Data, API, Security, AI Safety | Product | Resolved |
| BLOCK-009 | Uniform opaque cursor with server-enforced governance | Pagination contract is approved; affected APIs must implement and test the standard | 0, 3-7 | A/B/C/D | API Contract; Development Contract | API/Architecture owner | Resolved |
| BLOCK-010 | Authority for the `NO_SHOW` appointment transition | Explicit application command and its authorization/test boundary are approved | 4 | C | Data Model Section 14; API Contract appointment transitions | Product/Engineer C | Resolved |
| BLOCK-011 | Production policy boundary | Implementation guardrails are approved; SLO, RPO/RTO, backup retention/restoration, rate limits/quotas, alert thresholds, provider/topology, and incident-response values remain production-release blockers | 1, 8-10 | All | Architecture, Security, Development Contracts | Operations/Security/Product | Approved — release values open |

## 37. Open Implementation Decisions

# Open Implementation Decisions

- Exact Nx project graph and final paths.
- CI/CD workflow implementation and dependency/security automation after the FOUND-003 inventory is reviewed.
- Branch, commit, merge, and code-ownership conventions.
- Testing frameworks and integration environment.
- Migration deployment/rollback automation.
- Queue technology, retry policy, and dead-letter implementation.
- Observability vendor, retention, and alert thresholds.
- Environment promotion and secret-delivery mechanism.
- Dependency update cadence and ownership tooling.
- Non-blocking CI, observability, dependency, and release-automation details after their prerequisites are approved.

The approved pagination contract is `BLOCK-009`. Affected collection API tasks
may implement that contract; mutation tasks must enforce the approved retry
policy in `BLOCK-004`. Other open implementation decisions are non-blocking
only where the affected implementation can proceed without violating a
blocking security, data, or architectural decision.

## 38. MVP VS POST-MVP

### MVP

Identity/Tenant/Location, Patient, Doctor/Department/Shifts, Appointment and
check-in/derived queue, Encounter, basic clinical history/notes, immutable
clinical record workflow, AI assistant retrieval/summaries, approved RAG,
clinical drafts with human approval, internal Audit, idempotency, outbox,
security, tenant isolation, and required observability/testing.

### POST-MVP

Billing/invoices/payments/webhooks, Notification/email/SMS, prescriptions,
lab results, doctor ratings, clinical file APIs/storage/workers and AI file
ingestion,
advanced integrations, cross-tenant patient matching/merging, autonomous
clinical actions, and broader AI autonomy.

The plan schedules no Post-MVP feature before MVP completion.

## 39. Traceability Matrix

| Task/Milestone | System Definition | Architecture | Data Model | API Contract | Security | AI Safety | Development Contract |
|---|---|---|---|---|---|---|---|
| M0 / FOUND | Sections 29-33 | 58-62 | 54, 57 | 2-3, 27 | 9, 35-36 | 33-34 | 3-4, 32-35 |
| M1 / AUTH/TEN | 4-6, 12, 25 | 10-18, 63 | 4-7, 62-64 | 4-8 | 4-7, 9 | 7, 16-17 | 5, 12-14 |
| M2 / PAT/DOC | 5, 25, 30 | 7, 63 | 8-12 | 9-10, 26-27 | 7-9 | 5, 31 | 5, 8, 17 |
| M3 / APPT/CLIN | 6, 11, 25 | 19-21, 42-44 | 13-22, 49 | 11-13, 21-22 | 7-9, 19 | 10-14, 30 | 10-22 |
| M4-M5 / AI/RAG | 7-11 | 22-34 | 29-34, 59-60 | 14-15 | 15-18 | 1-30 | 15-16, 31 |
| M6 / Integration | 6-7, 14 | 35, 42-44, 63-65 | 39-40, 57-58 | 23-29 | 21-25, 35 | 23-24, 34-36 | 26-31, 38 |
| M7 / Release | 15-18, 23-28 | 51-59, 65-66 | 54, 56-58 | 20-25 | 29-35 | 26-30, 34-36 | 39, 47-48 |

## 40. Final Cross-Document Validation

Validated against all seven preceding documents: domain count/names,
four-person ownership, MVP scope, database tables and migration order, API
endpoints, roles, tenant model, clinical lifecycle, AI capabilities and
forbidden actions, human approval, security controls, Nx boundaries, and
migration ownership.

The unresolved conflicts are not silently changed: final permissions for
separate Nurse/Clinical Staff and Receptionist roles, authentication/MFA,
concurrency, AI model/embedding/retention/knowledge/tool governance,
retention/compliance release dependencies remain explicitly separated from
implementation decisions. Clinical file scope is
approved as Post-MVP. The self-hosted Dify platform direction and its Gateway
boundary are approved.

## 41. Final Implementation Order

0. **Foundation:** Team/A; resolve foundation blockers; approve Nx graph,
   checks, environments, and documentation workflow. Exit: safe repository
   process and boundaries.
1. **Infrastructure:** A/C/D; deploy only approved PostgreSQL, cache,
   storage, worker, telemetry, and secret boundaries. Exit: isolated,
   observable environments.
2. **Identity/access:** A; implement users, tenants, memberships,
   authorization, tenant context, and audit. Exit: S1 passes.
3. **Core domains:** B/C; implement Patient and Doctor/Shift contracts,
   repositories, APIs, and tenant tests in parallel. Exit: S2 passes.
4. **Workflow:** C then B; implement Appointment, then Encounter and
   immutable Clinical workflow. Exit: scheduling, clinical, and S3 tests pass.
5. **AI foundation:** D with A/B; implement the self-hosted Dify adapter behind
   the AI Gateway, context, RAG boundary, and audit only after remaining AI
   governance prerequisites. Exit: S4 passes.
6. **AI MVP:** D/B; implement approved read tools, summaries, drafts, and
   human approval. Exit: S5 and AI safety suite pass.
7. **Integration:** All; integrate end-to-end workflow, outbox/jobs,
   contracts, observability, and negative tests. Exit: MVP E2E passes.
8. **Hardening:** A/all; run security, tenant, concurrency, abuse, failure,
   backup, and restore validation. Exit: S6 passes.
9. **Production readiness:** All; approve monitoring, rate limits, rollback,
   RPO/RTO, deployment, and incident readiness. Exit: release gate passes.
10. **MVP release:** All; release only after every blocking decision for the
    shipped scope is closed and verify post-release signals.

Tomorrow morning, begin with the blocking-decision review and FOUND-001 to
FOUND-003. No sensitive application coding should begin until Phase 0 and
the identity/security blockers are accepted.

## 42. First 10 Executable Tasks

Because production-release dependencies remain open, the first executable work is
preparatory and documentation/review-only. No sensitive domain code is
claimed as executable yet.

| Task ID | Owner | Task | Dependencies | Acceptance Criteria |
|---|---|---|---|---|
| PREP-001 | Team | Reconcile all seven source-of-truth documents and maintain the blocker register | None | Every conflict is recorded with owner, impact, and affected phase |
| PREP-002 | Team/A | Validate the conceptual Nx project graph against the repository | None | No new path is invented; allowed/forbidden boundaries are confirmed |
| PREP-003 | A/C | Inventory CI checks and PR gates without creating CI configuration | None | Lint, type, unit, integration, API, build, security, and dependency checks are mapped |
| PREP-004 | A | Define environment/configuration requirements without selecting providers | PREP-001 | Local/test/staging/production data and secret boundaries are documented |
| PREP-005 | A/all | Reconcile migration dependencies including audit, outbox, and idempotency | PREP-001 | Corrected conceptual order and ownership are reviewed against Data Model/API |
| PREP-006 | A/API owner | Map all 37 MVP API operations to task IDs and blockers | PREP-001 | Every endpoint has domain, owner, dependencies, and acceptance criteria |
| PREP-007 | A/all | Prepare Tenant A versus Tenant B test matrix | PREP-001 | Direct/indirect API, repository, cache, job, RAG, AI, and audit cases are listed |
| PREP-008 | A/D | Prepare security and AI safety checkpoint evidence matrix | PREP-001 | S1-S6 and AI Gateway/human-approval evidence requirements are mapped |
| PREP-009 | B/C/D | Prepare domain dependency slices for Patient, Doctor, Appointment, Clinical, and AI | PREP-005/006 | Parallel preparation is separated from blocked integration work |
| PREP-010 | Team/owners | Prepare decision packets for BLOCK-001 through BLOCK-010 | PREP-001 | Each blocking decision has proposed evidence, owner, and explicit approval status; no option is silently selected |

After these preparatory tasks and blocker resolutions, the first implementation
tasks are `FOUND-001`, `FOUND-002`, `FOUND-003`, `AUTH-001`, `AUTH-002`,
`TEN-001`, `PAT-001`, `DOC-001`, `PAT-002`, and `APPT-001`.
