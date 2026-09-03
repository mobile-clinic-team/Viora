# PREP-005 — Migration Dependency and Ownership Reconciliation

Status: AUDIT COMPLETE — PROPOSED ORDER RECORDED; IMPLEMENTATION READINESS IS
NOT CLAIMED

This artifact reconciles the conceptual migration order against the Data Model,
API Contracts, Development Contracts, and the shared platform dependency order.
It does not create migrations, change source-of-truth contracts, choose an
unresolved provider, or claim database/runtime readiness.

## Scope and acceptance criterion

PREP-005 is the preparation task for migration dependencies across tenant,
identity, audit, idempotency, outbox, and MVP domain tables. The review must
confirm prerequisites, ownership, tenant integrity, constraints, and rollback
considerations before migration implementation begins.

## Evidence reviewed

| Source | Relevant evidence |
|---|---|
| `docs/DATA-MODEL.MD` sections 4–13 | Tenant, identity, patient, doctor, appointment, encounter, and clinical relationships |
| `docs/DATA-MODEL.MD` sections 16, 39, 43–50 | Idempotency uniqueness, audit fields, tenant integrity, ownership, transactions, and outbox model |
| `docs/DATA-MODEL.MD` section 53 | Existing conceptual migration order |
| `docs/API-CONTRACTS.md` sections 21–23 | OCC, idempotency, audit, and outbox-backed operation requirements |
| `docs/DEVELOPMENT-CONTRACTS.md` sections 38–49 | Cross-domain review, definition of done, migration safety, and transaction boundaries |
| `docs/IMPLEMENTATION-PLAN.md` sections 9, 11, and 42 | Shared dependency order, conceptual migration plan, and PREP-005 acceptance criteria |
| `docs/prep/PREP-001-CONFLICT-REGISTER.md` | Open conflicts C-003 through C-007 and C-009 / blockers B-002 through B-004 |

## Dependency reconciliation

The existing plan places `outbox_events` at migration 008, after Patient and
Doctor tables. This conflicts with the shared platform dependency order: the
outbox boundary must exist before dependent mutations publish post-commit
events. The reconciled conceptual order therefore moves the outbox migration
before domain mutations. This is planning evidence only; final numbering still
requires ERD and migration-owner review.

| Proposed order | Tables / boundary | Prerequisites | Owner | Rationale |
|---:|---|---|---|---|
| 001 | `extensions` (`btree_gist`) | None | Engineer A / schema owners | Required PostgreSQL capability for scheduling constraints |
| 002 | `tenants`, `locations` | 001 | Engineer A | Location FK requires tenant root |
| 003 | `users`, `memberships` | 002 | Engineer A | Membership requires user and tenant identity |
| 004 | `idempotency_keys` | 002, 003 | Engineer A / Shared Platform | Key identity is tenant- and actor-scoped; unique key is `(tenant_id, actor_id, endpoint, key)` |
| 005 | `audit_events` | 002, 003 | Engineer A / Audit | Audit attribution needs tenant and actor context; resource references remain application-owned |
| 006 | `outbox_events` | 002, 003 | Engineer A / Shared Platform | Outbox must be available before domain transactions emit events |
| 007 | `patients` | 002, 003 | Engineer B | Tenant root and optional user identity are available |
| 008 | `departments`, `doctors`, `doctor_working_shifts` | 002, 003 | Engineer C | Doctor relationships require tenant, user, department, and location foundations |
| 009 | `appointments` | 006–008 | Engineer C | Requires patient, doctor, location, scheduling constraints, idempotency, and outbox boundary |
| 010 | `encounters`, `medical_records`, `medical_record_versions`, `patient_allergies` | 007, 008, 009 | Engineer B | Clinical workflow requires patient, doctor, appointment, and immutable-version prerequisites |
| 011 | `ai_conversations`, `ai_messages`, `ai_drafts`, `knowledge_documents`, `knowledge_chunks` | 002, 007, 010 | Engineer D / affected owners | AI persistence follows authorized clinical context and shared audit/outbox boundaries |
| 012 | `clinical_files` | 007, 010 | Engineer B | Post-MVP; keep outside the MVP critical path |
| 013 | `invoices`, `payment_webhook_events` | 002, 007, 009 | Engineer C | Post-MVP; provider/webhook decisions remain separate |
| 014 | Approved indexes and constraints | Prior tables and final ERD | Engineer A + affected owners | Apply only reviewed constraints/indexes after dependency order is stable |

## Ownership and transaction rules

- Engineer A owns shared schema review for `idempotency_keys`, `audit_events`,
  and `outbox_events`; affected domain owners review changes that run in their
  transactions.
- Each domain owns its tables and business invariants. A domain may reference
  another domain by ID but must use public application contracts for behavior.
- The business-operation owner owns the local transaction. Cross-domain work
  must prefer a local transaction plus an outbox event over a distributed
  transaction.
- Tenant consistency is enforced by application/repository logic and
  integration tests for MVP; the migration must not silently introduce
  composite-FK scope beyond the approved Data Model decision.
- Avoid unrestricted `ON DELETE CASCADE` for clinical entities. Deletion,
  retention, and legal-hold behavior remain policy-gated.
- Every migration requires deterministic clean-database execution, required
  indexes/constraints, backward-compatibility analysis, tenant/data-integrity
  checks, owner review, and rollback or forward-fix evidence.

## Constraint and dependency checks

- `locations.tenant_id` references `tenants.id`; tenant deletion remains
  restricted while locations are linked.
- `memberships` requires `UNIQUE(user_id, tenant_id)`.
- Patient, doctor, appointment, clinical, AI, audit, idempotency, and outbox
  records preserve tenant context; cross-tenant relationships must be rejected
  at the application/repository boundary.
- Appointment overlap protection depends on the approved PostgreSQL scheduling
  constraint direction and must be validated together with transaction and
  idempotency behavior.
- `medical_record_versions` is append-only and must not be handled as a normal
  optimistic-concurrency update target.
- `idempotency_keys` must preserve same-key/same-payload replay and reject
  same-key/different-payload requests; persistence and transaction coupling are
  runtime work, not proven by the existing contract-only library.
- `outbox_events` must preserve tenant/originating actor context, retry state,
  and post-commit processing semantics without publishing before commit.

## Open decisions and risks

PREP-005 records these items without silently choosing a source-of-truth value:

| Item | Current evidence | Required resolution |
|---|---|---|
| Outbox terminal status | Data Model lists `PROCESSED`; other contract prose uses `COMPLETED` / processed language | Shared Platform owner must select one canonical persisted status and update affected contracts |
| Outbox envelope and uniqueness | Required context is distributed across API, security, development, and platform contracts | Review the minimum envelope, uniqueness, payload/redaction, retry, and dead-letter rules |
| Queue/provider behavior | Architecture defines a boundary but does not approve a concrete provider/runtime here | Keep migration provider-neutral; resolve queue/dead-letter behavior in the later platform decision |
| Idempotency expiry | API contract requires operation-class TTL and outbox completion grace, while exact values are operational | Keep `expires_at` and completion linkage in the schema design; approve values before production |
| Final numbering | Data Model says conceptual order and allows renumbering after ERD approval | Architecture/schema owners approve final migration names and dependency graph |

These correspond to PREP-001 conflicts C-003, C-004, C-005, C-006, C-007,
and C-009, and blockers B-002 through B-004.

## Scope guard

- Database migrations / ORM changes: NO
- Schema or source-of-truth contract changes: NO
- Provider, queue, worker, or dead-letter implementation: NO
- Runtime idempotency, outbox, audit, or transaction enforcement: NO
- Destructive data operation or production schema change: NO
- New table, endpoint, entity, role, provider, or owner: NO

## Acceptance criteria

- [x] Existing migration dependencies are compared with the Data Model and API Contracts.
- [x] Audit, idempotency, and outbox prerequisites are explicitly ordered before dependent domain mutations.
- [x] Table ownership and transaction ownership are recorded.
- [x] Tenant integrity, key constraints, immutability, and migration safety requirements are recorded.
- [x] Open outbox/idempotency/queue decisions are preserved rather than silently resolved.
- [x] No migration or runtime implementation is added.
- [ ] Affected schema/domain owners review and approve the proposed conceptual order.
