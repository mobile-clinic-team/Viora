# PREP-009 — Domain Dependency Slices

Status: SLICES COMPLETE — PARALLEL PREPARATION RECORDED; INTEGRATION
READINESS IS NOT CLAIMED

This artifact separates the preparation and integration dependencies for the
Patient, Doctor, Appointment, Clinical, and AI domains. It preserves the
approved public boundaries, tenant/security gates, migration order, and
post-MVP scope. It does not implement domain code, migrations, endpoints,
providers, or runtime tests.

## Scope and acceptance criterion

PREP-009 is owned by Engineers B/C/D with Engineer A and affected owners. The
purpose is to make parallel preparation explicit while preventing a blocked
domain from being treated as implementation-ready. Each slice records its
inputs, public outputs, security obligations, next dependencies, and blocked
integration work.

## Shared gates for every slice

| Gate | Required condition | Evidence source |
|---|---|---|
| G-01 Identity/context | Authenticated actor, active membership, and server-derived tenant context | AUTH-001 / Security / API Contracts |
| G-02 Authorization | Endpoint-specific least privilege, resource relationship, default deny, and IDOR protection | AUTH-002 / Security |
| G-03 Tenant isolation | Tenant A/B direct and indirect cases pass before domain integration | PREP-007 / S2 checkpoint |
| G-04 Shared platform | Audit, idempotency, outbox, and context propagation are available for applicable mutations | PREP-005 / PLAT-001 / AUD-001 |
| G-05 Contracts | Public domain/API contracts and Data Model status/lifecycle rules are stable | API Contracts / Data Model |
| G-06 Validation | Allowlisted input/output, canonical errors, pagination, OCC, and retry rules are explicit | API Contracts |
| G-07 Evidence | Relevant unit, integration, API, authorization, tenant, and migration tests are defined | PREP-007 / PREP-008 |

No slice may bypass G-01 through G-03. Mutation slices additionally require
the applicable G-04 and G-06 behavior. AI slices require all shared gates plus
the AI Gateway, Tool Gateway, RAG, safety, and human-approval boundaries.

## Dependency graph

```text
Identity / Tenant / Authorization
              │
       ┌──────┴──────┐
       ▼             ▼
   Patient       Doctor / Shift
       └──────┬──────┘
              ▼
        Appointment
              │
              ▼
      Encounter / Clinical
              │
       ┌──────┴──────┐
       ▼             ▼
   Audit/shared    AI Gateway
   platform       │
                  ▼
             Context / RAG / Tools
                  │
                  ▼
          Draft → Human Approval
```

Patient and Doctor preparation can proceed in parallel after access contracts
are accepted. Appointment integration requires both. Clinical preparation can
define types and public interfaces after Patient, but encounter integration is
blocked on Appointment. AI preparation may define provider-neutral boundaries,
but Gateway/RAG/tool integration is blocked until access, domain reads, audit,
and clinical contracts are available.

## Patient slice — Engineer B

| Area | Preparation boundary | Depends on | Produces for dependents | Integration status |
|---|---|---|---|---|
| Types/lifecycle | Tenant-scoped patient identity, status, allowed fields, optional user link | G-01, Data Model patient rules | Patient domain types and invariants | Can prepare |
| Repository port | Tenant-scoped create/read/update/search ports; no global patient lookup | G-01, G-02, G-03 | Public application queries/commands | Blocked until AUTH-002/TEN-001 evidence |
| API contract | Create/read/update/search, field allowlists, pagination, canonical errors | API-PAT-001..004, G-05/G-06 | Stable Patient API surface | Contract review required |
| Authorization | Self-ownership, care/operational relationship, role, need-to-know, field filtering | G-02 | Per-operation policy checks | Must be tested per endpoint |
| Tenant tests | A cannot read/update/search B; mixed tenant references fail closed | PREP-007 | S2 evidence for Patient | Execution not claimed |
| Audit/idempotency | Creation, sensitive access, important mutations, retry-sensitive writes | G-04 | Audit metadata and replay contract | Runtime persistence deferred |
| Dependents | Appointment patient reference; Clinical encounter/record context; AI authorized read tool | Patient public contract | Validated patient reference | Appointment/Clinical/AI integration later |

Patient slice must not add cross-tenant matching, automatic identity merging,
clinical content, prescriptions, files, or undocumented fields.

## Doctor and Department/Shift slice — Engineer C

| Area | Preparation boundary | Depends on | Produces for dependents | Integration status |
|---|---|---|---|---|
| Types/lifecycle | Tenant-scoped department, doctor profile, and working-shift rules | G-01, Data Model doctor rules | Doctor/shift types and invariants | Can prepare |
| Repository port | Tenant/resource-scoped profile, shift, and availability reads | G-01, G-02, G-03 | Public Doctor/Shift queries | Blocked until access evidence |
| API contract | Doctor list/read/update and shift list with approved filters/cursors | API-DOC-001..004, G-05/G-06 | Stable scheduling inputs | Contract review required |
| Scheduling rules | Shift boundaries, overlap policy, location relation, advisory availability | Data Model scheduling direction | Availability input for Appointment | Booking authority remains mutation transaction |
| Authorization | Profile/shift access by role, tenant, relationship, and scheduling permission | G-02 | Per-operation access policy | Must be tested per endpoint |
| Tenant tests | A cannot read B doctor, shift, department, or location-linked resource | PREP-007 | S2 evidence for Doctor | Execution not claimed |
| Dependents | Appointment doctor/location/shift validation; AI appointment assistance reads | Doctor public contract | Validated scheduling references | Appointment/AI integration later |

Doctor slice must not introduce multi-location `doctor_locations`, ratings,
billing, notification, or a booking authority separate from the Appointment
mutation transaction.

## Appointment slice — Engineer C

| Area | Preparation boundary | Depends on | Produces for dependents | Integration status |
|---|---|---|---|---|
| Types/lifecycle | `PENDING`, `CONFIRMED`, `CHECKED_IN`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_SHOW` | Patient + Doctor contracts; approved status decisions | Appointment state machine | Blocked on Patient/Doctor |
| Create/update | Tenant-consistent patient, doctor, location, shift, time, reason, and creator references | PAT-002, DOC-001, G-04, G-06 | Authoritative scheduling mutation | Blocked |
| Concurrency | PostgreSQL scheduling constraints plus application transaction and OCC | PREP-005, BLOCK-004, approved pagination/concurrency rules | Double-booking and stale-update evidence | Runtime not claimed |
| Read/list | Tenant/resource authorization, allowlisted filters, cursors, field filtering | G-02, G-03, G-06 | Operational appointment reads | Blocked |
| Commands | Cancel, check-in, availability, and explicit application-level NO_SHOW transition | APPT-001, BLOCK-002/NO_SHOW decision reconciliation | Valid transitions and audit events | Blocked |
| Idempotency/audit | Create, reschedule, commands, replay conflict, transition audit | G-04, PLAT-001, AUD-001 | Retry-safe transaction boundary | Persistent runtime deferred |
| Dependents | Encounter creation and clinical context; optional approved AI appointment read/tool | Appointment public contract | Validated encounter reference | Clinical/AI integration later |

Availability is advisory and never replaces the authoritative create or
reschedule transaction. Appointment operations must not silently retry stale
clinical/scheduling decisions or allow AI text to authorize a mutation.

## Clinical slice — Engineer B

| Area | Preparation boundary | Depends on | Produces for dependents | Integration status |
|---|---|---|---|---|
| Encounter | Tenant-consistent patient, appointment, doctor, status, and timestamps | Patient + Appointment + Doctor contracts | Encounter public type and lifecycle | Integration blocked on Appointment |
| Medical record | Record ownership, current version reference, draft/review/finalized/amended states | Encounter contract, Data Model clinical rules | Clinical record query/command ports | Types can prepare |
| Versioning | Append-only `medical_record_versions`; finalized versions immutable | Clinical lifecycle and audit | Safe amendment/finalization model | Runtime blocked |
| API contract | Encounter/record reads, draft creation, review, finalize, amendment, allergy read | API-CLIN-001..008, G-05/G-06 | Stable Clinical API surface | Contract review required |
| Authorization | Treating doctor, authorized clinical staff, relationship, need-to-know, field filtering | G-02, S3 | Clinical access policy | Tests required |
| Audit/idempotency | Sensitive access, record mutation, review/finalize/amendment, author and reason | G-04, AUD-001, PLAT-001 | Attributable clinical evidence | Runtime deferred |
| AI handoff | AI draft only; `IN_REVIEW`, current-version/OCC revalidation, human approval | AI-002/003, S5 | Controlled application handoff | Blocked on AI Gateway + Clinical |

Clinical slice must not overwrite finalized records, add undocumented clinical
entities, expose full histories by default, or allow AI output to finalize a
record without the server-side human approval workflow.

## AI and RAG slice — Engineer D with B/A

| Area | Preparation boundary | Depends on | Produces for dependents | Integration status |
|---|---|---|---|---|
| Gateway | Provider-neutral AI request boundary; application owns auth, tenant, context, validation, persistence, and audit | G-01..G-04, AI decisions | AI Gateway contract | Boundary can prepare; runtime blocked |
| Tool Gateway | Explicit allowlist, strict input/output schema, actor/tenant/resource checks, side-effect declaration | AUTH-002, domain public contracts | Safe tool contracts | Blocked on domain interfaces |
| Context | Minimum-necessary, purpose-limited, tenant/resource/permission-filtered context | Patient/Clinical reads, G-03, AI safety | Context assembly contract | Blocked on authorized reads |
| RAG | Tenant/status/permission filtering, typed links, untrusted document handling, cursor isolation | AI Gateway, knowledge contract, BLOCK-005 | Retrieval abstraction and isolation evidence | Blocked |
| Read tools | Authorized patient/clinical/appointment/doctor reads only | Patient, Clinical, Appointment, Doctor contracts | Tool capabilities for AI MVP | Blocked |
| Draft workflow | Draft-only clinical output, review/approve/reject, no direct finalization | Clinical `IN_REVIEW`, AI-007, S5 | Human-approved handoff | Blocked |
| Safety/evaluation | Injection, leakage, malformed output, uncertainty, tool abuse, failure, resource bounds | PREP-008, Golden Dataset, AI safety decisions | Regression evidence requirements | Execution not claimed |
| Provider boundary | Self-hosted Dify behind Gateway; controlled external model adapters; no direct DB/provider access | BLOCK-005 | Deployment/provider interface | Provider evidence remains release dependency |

AI must not access PostgreSQL, Redis, arbitrary storage, filesystem, SQL,
shell, secrets, unrestricted services, or another tenant. Model output,
retrieved documents, and user instructions never grant permission. Appointment
mutation autonomy remains a production decision boundary; clinical drafts
remain human-approved.

## Cross-domain handoff contracts

| Handoff | Required inputs | Required guarantees | Receiving slice |
|---|---|---|---|
| Identity → all domains | Authenticated actor, active membership, tenant, permissions, request ID | Context is server-derived and revalidated on retry/re-fetch | All |
| Patient → Appointment | Authorized patient reference and tenant | No mixed-tenant scheduling reference | Appointment |
| Doctor → Appointment | Authorized doctor/location/shift and advisory availability | Availability is not booking authority | Appointment |
| Appointment → Clinical | Authorized appointment/patient/doctor reference and status | Tenant consistency and valid encounter relationship | Clinical |
| Patient/Clinical → AI | Minimum necessary authorized context and purpose | No raw/unscoped database access; no B context | AI |
| AI → Clinical | Validated draft, source/context metadata, authorized human action | `IN_REVIEW`, OCC revalidation, immutable finalization, audit | Clinical |
| Any mutation → Audit/Outbox | Tenant, originating actor/system, resource, request/correlation context | Post-commit event semantics, redaction, retry safety | Shared Platform |

## Parallel work plan and blockers

| Work item | Can prepare in parallel? | Integration blocker |
|---|---|---|
| Patient types/public contract | Yes, after access contract review | AUTH-002/TEN-001 evidence and tenant tests |
| Doctor/shift types/public contract | Yes, after access contract review | AUTH-002/TEN-001 evidence and scheduling decisions |
| Clinical types/version invariants | Partially, after Patient contract | Appointment public contract and clinical lifecycle tests |
| Appointment public contract | Partially, after Patient and Doctor references are stable | Patient/Doctor integration, idempotency/OCC runtime, pagination/concurrency decisions |
| Audit/idempotency/outbox integration | Contract preparation can proceed | Persistent schema/transaction enforcement and owner review |
| AI Gateway/tool boundary | Provider-neutral preparation only | AUTH-002, audit, domain public interfaces, AI safety/provider evidence |
| RAG abstraction | Contract preparation only | AI Gateway, embedding/governance evidence, tenant/status/permission tests |
| AI clinical draft/approval | No runtime integration yet | AI read tools, Clinical version workflow, S5 approval evidence |

## Definition of ready for implementation

A slice is implementation-ready only when its prerequisite task/decision,
public contract, tenant/authorization behavior, affected-owner review, and
required evidence plan are accepted. This document does not mark any blocked
runtime domain ready. In particular:

- `PAT-001`, `PAT-002`, and `DOC-001` remain dependent on access foundation
  evidence recorded by the Implementation Plan.
- `APPT-001..003` remain dependent on Patient/Doctor contracts, shared
  idempotency/outbox runtime, and concurrency/pagination decisions.
- `CLIN-001..002` remain dependent on Appointment and immutable clinical
  workflow evidence.
- `AI-001`, `RAG-001`, and `AI-002` remain dependent on authorization, audit,
  domain contracts, and AI safety gates.
- `AI-003` remains dependent on AI read tools, Clinical workflow, and approved
  human approval/escalation evidence.

## Scope guard

- Domain implementation or runtime test changes: NO
- API handlers, repositories, database, migrations, ORM, or fixtures: NO
- AI provider, Gateway, Tool Gateway, RAG, worker, or storage implementation: NO
- Architecture, security, AI-safety, Data Model, or API policy changes: NO
- Secrets, credentials, PHI, and production data: NO

## Acceptance criteria

- [x] Patient, Doctor, Appointment, Clinical, and AI dependency slices are listed.
- [x] Parallel preparation is separated from blocked integration work.
- [x] Shared identity, authorization, tenant, audit, idempotency, outbox, and evidence gates are recorded.
- [x] Cross-domain handoff contracts and ownership are documented.
- [x] AI Gateway, RAG, tool, draft, and human-approval dependencies are preserved.
- [x] Post-MVP boundaries and unresolved runtime dependencies are not expanded.
- [x] No runtime implementation or policy change is added.
- [ ] Affected domain, Security, Clinical, AI, and Architecture owners review the slices.

