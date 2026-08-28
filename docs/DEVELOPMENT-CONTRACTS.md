# DEVELOPMENT-CONTRACTS.md

> Canonical engineering contract for the Clinic AI Platform.
> Version: 0.1.0
> Status: Draft; open development decisions remain.

## 1. Purpose

This document standardizes how engineers may implement the production-ready
multi-tenant healthcare platform. It applies to all four full-stack team
members and to Codex-assisted development.

It is an engineering contract, not a product specification. It derives
implementation obligations from `docs/product/system-definition.md`,
`docs/architecture/architecture-decisions.md`, `docs/DATA-MODEL.MD`,
`docs/API-CONTRACTS.md`, `docs/SECURITY.md`, and `docs/AI-SAFETY.md`.
Those documents remain authoritative for product scope, architecture, data,
API, security, and AI safety decisions respectively.

## 2. Engineering Principles

- Develop production-first: security, reliability, observability, and
  recovery are part of feature work.
- Preserve explicit domain boundaries and public contracts.
- Apply least privilege and secure-by-default behavior.
- Treat tenant isolation as a system invariant, not caller convention.
- Prefer testable, deterministic logic for critical business operations.
- Make small, reviewable, backward-compatible changes.
- Keep behavior explicit and observable with request/correlation IDs,
  metrics, logs, traces, and audit events where required.
- Do not guess when requirements or architectural decisions are unresolved;
  record the issue and obtain the required owner decision.

## 3. Monorepo Structure

Architecture defines this conceptual Nx structure:

```text
apps/
├── web
├── api
└── workers

libs/
├── identity
├── tenant
├── patient
├── doctor
├── appointment
├── clinical
├── billing
├── notification
├── audit
├── ai
└── shared
```

Domain libraries own their domain logic, application contracts, and
infrastructure adapters. `apps/web` is a client, `apps/api` is the API
boundary, and `apps/workers` handles approved asynchronous work. The AI
subsystem remains behind its AI Gateway and explicit tools.

The exact Nx project graph, library naming, and detailed folder structure
are not finalized; they are recorded under Open Development Decisions.

## 4. Nx Boundary Rules

Dependency direction is presentation/API → application → domain, with
infrastructure implementing required interfaces. A domain may consume
another domain's public application contract, never its internal repository
or database table.

| Source Domain | Allowed Dependency | Forbidden Dependency |
|---|---|---|
| Web/API | Public application/domain contracts and shared primitives | Direct database, private domain internals |
| Identity/Tenant | Shared primitives and approved platform contracts | Patient/Clinical private internals |
| Patient | Shared primitives and approved Identity/Tenant contracts | Clinical database tables or private repositories |
| Doctor/Appointment | Public Patient/Identity/Tenant contracts | Clinical database tables or private repositories |
| Clinical | Public Patient/Appointment/Identity contracts | Other domain database tables |
| AI | Public Patient/Clinical/Appointment contracts through tools | Any database, private repository, arbitrary service |
| Audit | Approved event contracts and shared primitives | Unrestricted domain data access |
| Workers | Public application commands and shared job contracts | Bypassing authorization or domain services |
| Shared | Stable primitives/contracts/infrastructure abstractions | Domain business logic or domain-specific shortcuts |

Circular dependencies are prohibited. Nx constraints should fail invalid
imports in CI. Public APIs must be deliberate, small, and documented.

## 5. Domain Ownership

| Domain | Owner | Primary Module | Database Ownership | API Ownership |
|---|---|---|---|---|
| Identity, authentication, roles, permissions | Engineer A | Identity & Security | `users`, `memberships` | Identity endpoints |
| Tenant / Location | Engineer A | Tenant | `tenants`, `locations` | Tenant/location endpoints |
| Patient | Engineer B | Patient | `patients` | Patient endpoints |
| Clinical / Encounter | Engineer B | Clinical | `encounters`, `medical_records`, `medical_record_versions`, `patient_allergies` | Clinical endpoints |
| Doctor | Engineer C | Doctor Operations | `departments`, `doctors`, `doctor_working_shifts` | Doctor endpoints |
| Appointment | Engineer C | Appointment | `appointments` | Appointment endpoints |
| AI / RAG / drafts | Engineer D | AI Platform | `ai_conversations`, `ai_messages`, `ai_drafts`, `knowledge_documents`, `knowledge_chunks` | AI/RAG endpoints |
| Audit | Engineer A | Audit | `audit_events` | Internal audit capability |
| Shared platform | Engineer A schema owner | Shared/Platform | `idempotency_keys`, `outbox_events` | Internal infrastructure |
| Billing | Engineer C | Billing | `invoices`, `payment_webhook_events` | Post-MVP |
| Notification | Engineer C | Notification | No approved MVP table | Post-MVP |

The Data Model marks prescriptions, lab results, clinical files, doctor
ratings, invoices, and payment webhook events Post-MVP. Cross-domain changes
require review by every affected owner.

## 6. Team of Four

| Member | Primary Domain | Secondary Responsibility | Shared Responsibilities |
|---|---|---|---|
| Engineer A | Identity & Security | Tenant, Location, Membership, Roles, Permissions, Audit, shared schema | Security, tests, observability, documentation, review |
| Engineer B | Patient & Clinical | Encounter, clinical documentation, medical record workflows | Security, tests, observability, documentation, review |
| Engineer C | Operations | Doctor, Appointment, Calendar, Check-in, Queue, Billing, Notification | Security, tests, observability, documentation, review |
| Engineer D | AI Platform | Gateway, Agent Runtime, Tools, Context, Memory, RAG, drafts, evaluation, safety | AI integration, security, tests, observability, documentation, review |

Ownership coordinates work; it does not prohibit collaboration. The owner
reviews changes to their domain, while affected owners review cross-domain
contracts and migrations.

## 7. Shared Code Rules

Shared libraries may contain only genuine cross-domain behavior, stable
primitives, common contracts, validation, errors, logging/observability
abstractions, or approved infrastructure interfaces.

- Domain business rules belong in the owning domain.
- Shared types must be stable and intentionally generic.
- Shared validation may define reusable primitives, not domain policy.
- Common errors must preserve the canonical API error model.
- Common API contracts must not hide domain-specific authorization.
- Shared infrastructure must expose narrow interfaces and preserve tenant,
  actor, audit, and failure context.
- `shared` must not become a dumping ground or a bypass around Nx rules.

## 8. Database Ownership

The domain owner owns the schema semantics and migration review for each
domain table. Engineer A owns the schema of shared `idempotency_keys` and
`outbox_events`; other domains may write rows within their own transaction
but must not modify shared schema without review.

| Table | Domain Owner | Migration Owner |
|---|---|---|
| `users` | Engineer A | Engineer A |
| `memberships` | Engineer A | Engineer A |
| `tenants` | Engineer A | Engineer A |
| `locations` | Engineer A | Engineer A |
| `patients` | Engineer B | Engineer B |
| `departments` | Engineer C | Engineer C |
| `doctors` | Engineer C | Engineer C |
| `doctor_working_shifts` | Engineer C | Engineer C |
| `doctor_ratings` | Engineer C | Engineer C, Post-MVP |
| `appointments` | Engineer C | Engineer C |
| `encounters` | Engineer B | Engineer B |
| `medical_records` | Engineer B | Engineer B |
| `medical_record_versions` | Engineer B | Engineer B |
| `prescriptions` | Engineer B | Engineer B, Post-MVP |
| `prescription_items` | Engineer B | Engineer B, Post-MVP |
| `patient_allergies` | Engineer B | Engineer B |
| `lab_results` | Engineer B | Engineer B, Post-MVP |
| `clinical_files` | Engineer B | Engineer B, Post-MVP (approved out of MVP) |
| `ai_conversations` | Engineer D | Engineer D |
| `ai_messages` | Engineer D | Engineer D |
| `ai_drafts` | Engineer D | Engineer D |
| `knowledge_documents` | Engineer D | Engineer D |
| `knowledge_chunks` | Engineer D | Engineer D |
| `invoices` | Engineer C | Engineer C, Post-MVP |
| `payment_webhook_events` | Engineer C | Engineer C, Post-MVP |
| `idempotency_keys` | Engineer A schema owner | Engineer A |
| `outbox_events` | Engineer A schema owner | Engineer A |
| `audit_events` | Engineer A | Engineer A |

Every schema change requires migration review, affected-owner review, data
integrity analysis, and appropriate tests. Destructive changes require
explicit approval.

## 9. Migration Rules

- All production schema changes use versioned migrations; no manual
  production schema edits.
- Prefer forward-compatible expand/contract changes where appropriate.
- Separate additive changes, backfills, code adoption, and cleanup when a
  single deployment would create incompatibility.
- Analyze rollback and partial-failure behavior before applying a migration.
- Keep data migrations bounded, observable, resumable where practical, and
  safe for retries.
- Review foreign keys, indexes, uniqueness, tenant scope, and query impact.
- Treat large-table operations as production availability risks.
- Never remove or weaken tenant, audit, idempotency, or clinical integrity
  constraints merely to make a migration easier.
- Migration uses the approved hybrid risk strategy: transactional for small
  additive low-lock changes, and expand/contract for breaking, large-table,
  high-lock, index-heavy, or vector changes. Every migration requires
  preflight, owner review, verification, and rollback/forward-fix planning.

## 10. API Implementation Rules

`docs/API-CONTRACTS.md` is the canonical API contract. Engineers must:

- assign each endpoint to its owning domain;
- validate transport input and enforce application authorization;
- establish tenant context from authenticated membership;
- use the canonical response/error shapes and HTTP semantics;
- implement idempotency for specified retry-sensitive mutations;
- use allowlisted filtering/sorting/pagination;
- preserve `/api/v1` compatibility and document intentional breaking
  changes before introducing a new version;
- return only authorized, minimum-necessary fields;
- emit required audit events;
- update the API contract before adding or changing endpoint behavior.

No endpoint may contradict the API contract or silently expose a Post-MVP
resource.

## 11. API ↔ Domain Service Boundary

The required layering is:

```text
Controller/API → Application Service → Domain Logic → Repository/Infrastructure
```

Controllers translate transport concerns only. Application services
orchestrate authorization, tenant context, idempotency, transactions, and
domain operations. Domain logic owns invariants. Repositories/infrastructure
perform approved persistence or external access.

Forbidden paths include Controller → Database, Controller → private domain
internals, AI → Database, and one domain → another domain's tables.

## 12. Database Access Rules

Raw database access belongs only in the owning domain's persistence layer.
API, web, AI, and unrelated domains must not query the database directly.
Repositories must apply tenant scope and resource checks as required;
tenant safety cannot depend solely on caller discipline.

AI always uses the Tool Gateway and authorized application/domain contracts.
Workers use application commands and retain actor/tenant context.

## 13. Tenant Isolation Development Rules

Every engineer must establish identity, tenant, authorization, and resource
access before sensitive operations. A lookup by ID alone is never sufficient.

Tenant-aware implementation is required for:

- queries and mutations;
- cache keys, TTLs, and invalidation;
- object/file access;
- background jobs and outbox processing;
- search and RAG indexing/retrieval;
- AI context and tool results;
- audit events and administrative views.

Tenant A tests must prove that Tenant A cannot read, modify, delete, search,
retrieve, or infer Tenant B resources through direct or indirect endpoints.

## 14. Security Development Rules

Developers must derive implementation controls from `docs/SECURITY.md`:

- authenticate before protected access and distinguish `401` from `403`;
- enforce resource-level authorization and IDOR protection;
- validate body/path/query/header/file/webhook inputs server-side;
- filter outputs and errors to prevent excessive disclosure;
- keep secrets out of Git, source, logs, traces, metrics, and responses;
- minimize PHI in logs and audit metadata;
- use approved encryption and key/secret boundaries without inventing a
  provider;
- make cache and file access tenant-aware and authorization-gated;
- verify future webhook signatures and replay protection;
- apply rate limits and bounded pagination/search/AI inputs.

## 15. AI Development Rules

AI implementation must follow `docs/AI-SAFETY.md` and the AI Gateway
architecture. AI must not directly access databases, bypass domain services,
authorization, tenant isolation, human approval, or auditability; execute
arbitrary code; invoke arbitrary tools; or directly finalize sensitive
clinical actions.

AI output is untrusted. Application logic must independently validate
identity, tenant, permissions, resource scope, schema, business rules,
approval state, and side effects.

For MVP, AI development is limited to read, summarization, and draft-first
capabilities. Write tools are default-deny; knowledge is tenant-only; tool
permissions use explicit capability classes; AI actor, tenant, and policy
context must be propagated through the Gateway; sensitive operations fail
closed; and AI audit records use metadata
and policy-controlled redacted content rather than mandatory raw prompt/
response retention.

External LLM/Embedding Providers may be used only through controlled AI
Gateway adapters; provider-specific APIs must not enter domain code or public
contracts.
The approved MVP model/provider profile is Managed External LLM plus Managed
Embedding. Model identifiers, embedding dimensions, retention, tool
permissions, and provider limits remain explicit follow-up decisions.
The MVP model strategy is one primary generative/embedding pair without
automatic fallback. The approved pair is `gpt-4o-2024-08-06` and
`text-embedding-3-small` at dimension `1536`. Model changes require
compatibility review, and embedding dimension changes require migration or
re-embedding planning.
AI conversations, drafts, embeddings, knowledge data, provider metadata, and
audit metadata must follow the minimum-necessary, category-specific lifecycle;
raw prompt/response content is not retained by default. Exact lifecycle
values require the approved Product/Compliance policy.
The approved MVP retention baseline is 30 days for conversation/message data,
7 days for unapproved drafts, immediate approved-draft content purge after
audit capture, 0-day default raw prompt/context retention, and 90-day
applicable AI metadata retention. Cleanup must preserve Legal Hold and
immutable `audit_events` evidence.
Cleanup code must evaluate Legal Hold inheritance through canonical tenant,
explicitly supported resource, and document mappings; it must not introduce a
`clinical_resources` table. Unknown mappings fail closed and hold skips are
written to `audit_events`. MVP knowledge mappings are limited to typed,
authorization-aware links to `patients` and `medical_records`. Golden Dataset
ownership is joint between Clinical and AI; it must be versioned and managed in
an approved environment without real PHI outside approved controls. Evaluation
failure blocks AI MVP release.
Cleanup code must evaluate Legal Hold inheritance through canonical tenant,
explicitly supported resource, and document mappings; it must not introduce a
`clinical_resources` table. Unknown mappings fail closed and hold skips are
written to `audit_events`.
AI MVP work must satisfy the Strict Clinical Safety Gate before release:
versioned Golden Dataset evaluation, 100% redaction for classified sensitive
fields, context recall and precision of at least 85%, faithfulness/hallucination
failure below 2%, and regression evaluation for model changes. Latency targets
remain TBD and are measured operationally; provider evidence remains open.

## 16. Tool Development Rules

Every AI tool requires explicit registration and a reviewed contract:

- stable narrow name and purpose;
- allowed originating actor/permission;
- tenant and resource scope;
- input and output schema;
- read/draft/write behavior;
- business-state and human-approval requirements;
- audit event requirements;
- timeout, retry, rate-limit, and failure behavior;
- output filtering and minimum necessary data.

No generic unrestricted `execute()`, `run()`, `query()`, or `admin()` tool
is permitted. Tool implementations are not created by this document.

## 17. Clinical Data Development Rules

Finalized clinical record versions are immutable. Developers must implement
amendments/versioning, preserve the original, retain authorship/timestamps,
and emit audit events. Generic overwrite semantics such as
`PUT /medical-records/{id}` must not be introduced.

Clinical content generated by AI is a draft until authorized human review,
approval, application validation, and Clinical Service persistence. AI cannot
approve itself or directly finalize a record/prescription.

## 18. Error Handling

All APIs use the canonical error structure from API Contracts:

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "The operation conflicts with the current state.",
    "details": {},
    "request_id": "..."
  }
}
```

Map validation, authorization, not-found, conflict, idempotency conflict,
rate-limit, and unexpected errors consistently. Never expose stack traces,
SQL/database errors, secrets, internal topology, or cross-tenant existence.

## 19. Validation

Validation occurs at multiple layers:

- **Transport:** types, required fields, nullability, UUIDs, timestamps,
  enums, headers, limits, and unexpected fields.
- **Authorization:** identity, membership, role/permission, tenant,
  ownership, relationship, and operation constraints.
- **Domain:** lifecycle, scheduling, clinical immutability, idempotency,
  and other business invariants.
- **Persistence:** constraints, uniqueness, referential integrity, and
  tenant-safe writes.

Collection APIs use the shared opaque Base64URL/JSON cursor utility with
server-enforced `default_size = 20` and `max_size = 100`, stable allowlisted
keyset ordering, deterministic tie-breaking, and `400
INVALID_PAGINATION_CURSOR` for invalid cursors. Cursor tenant binding is
validated server-side.

Frontend validation improves UX only; critical rules are enforced server-side.

## 20. Transaction Rules

Transactions represent coherent business operations. Appointment creation
must validate patient/provider/availability and create the appointment
atomically with idempotency protection; outbox work occurs after commit.
Rescheduling must protect the scheduling resource. Clinical finalization and
amendments must preserve version and approval invariants. Future billing
operations must protect webhook uniqueness and state transitions.

External side effects must not be unnecessarily included in the primary
transaction. Distributed transactions are not established by the
architecture and must not be introduced without an explicit decision.

## 21. Concurrency

Appointment creation/rescheduling must prevent double booking through the
approved scheduling/resource constraints and safe transaction behavior.
Retries must not duplicate operations. Clinical amendments must preserve
versions and reject stale or invalid state. Future payment transitions must
protect event uniqueness and processing state.

The `CONFIRMED -> NO_SHOW` transition must be implemented as an explicit
application command with role/permission authorization, transition validation,
idempotency, audit coverage, and negative authorization tests. The command
must not be exposed as an unrestricted generic status mutation; AI access is
forbidden unless separately approved through the AI Tool Gateway.

The database/application concurrency direction and public stale/conflict
semantics are approved. Canonical mutable MVP resources use monotonic
`BIGINT` versions; mutations must validate a strong `If-Match` ETag after
authorization. Stale versions return `412 Precondition Failed`, while
PostgreSQL scheduling conflicts return `409 Conflict`. Resource JSON does not
expose `version` by default. `medical_record_versions` remains append-only/
immutable and is outside the OCC update path. Appointment reschedule/cancel
and clinical amendment/approval do not automatically retry after `412`;
patient/profile and tenant metadata may retry at most once only when explicitly
idempotent; AI write and approval operations do not automatically retry.
Retry/re-fetch flows must re-run authentication, authorization, and tenant
checks, while `409 Conflict` requires explicit business resolution.

## 22. Idempotency

Implement the API contract's opaque `Idempotency-Key` for retry-sensitive
mutations. State is scoped by `(tenant_id, actor_id, key)` and records a
request hash and original result reference.

- Same key and same request returns the original result.
- Same key and different request returns `409 IDEMPOTENCY_CONFLICT`.
- Concurrent retries cannot create duplicates.
- Expiration follows the approved domain-specific TTL policy: bounded windows
  for synchronous mutations and completion-plus-grace retention for
  outbox-backed operations. Expired keys are new requests and must pass current
  security and OCC checks.
- Appointment mutations and future payment/webhook operations receive
  particular review.

Other domains writing shared idempotency rows must not change the shared
schema.

## 23. Background Jobs

Architecture includes workers for AI, notifications, document processing,
and search/indexing. Jobs must:

- have an owning module and explicit command contract;
- carry tenant, originating actor/system context, resource scope, and
  correlation/request ID;
- be idempotent and retry-safe;
- preserve authorization decisions rather than assuming worker privilege;
- use timeouts, observable status, and safe failure behavior;
- avoid duplicate side effects through outbox/idempotency rules;
- use dead-letter handling when the final queue design supports it.

Notification processing is a stub/no-op for MVP; full notification behavior
is Post-MVP. Queue technology and dead-letter implementation remain open.

## 24. Cache Rules

Redis is supporting infrastructure, never source of truth or authorization.
Cache implementations must use tenant-aware collision-resistant keys,
explicit TTLs, safe invalidation after membership/permission/resource
changes, bounded values, and authorization checks on cache hits.

Sensitive clinical content and credentials must not be cached without an
approved policy. A cache hit must never bypass the source-of-truth tenant
and permission checks.

## 25. File Handling Rules

Clinical files are Post-MVP under the approved Product decision. If enabled in
a future phase,
developers must authorize tenant/patient/encounter access before metadata or
bytes, validate type/MIME/extension/size/content/checksum, isolate private
storage keys, prevent traversal, apply malware scanning policy, never
execute uploads, and audit access/archive/deletion.

Clients must not control arbitrary storage paths or credentials. File scope,
limits, scanning, and retention remain open.

## 26. Audit Implementation

Sensitive operations must emit the audit events required by SECURITY.md and
API Contracts, including authentication, authorization failures, patient and
clinical access, appointment mutations, amendments/finalization, AI tool
operations, approvals/rejections, privileged changes, and future file/
billing operations.

Audit records preserve actor, tenant, action, resource reference, result,
request/correlation ID, and timestamp. Developers must not silently omit
events, mutate historical audit records, or put unnecessary PHI in logs or
audit metadata.

## 27. Observability

Production changes must provide appropriate structured logs, metrics,
traces, request/correlation IDs, domain-operation metrics, AI tool metrics,
security signals, and audit events. Correlation must be preservable across
API request, database operation, outbox/job, worker, AI request, and audit
event.

Logs are redacted and metadata-first; secrets, tokens, and unnecessary PHI
are prohibited. No observability vendor is selected.

## 28. Testing Strategy

| Test layer | Required validation |
|---|---|
| Unit | Domain invariants, validation, deterministic business logic |
| Integration | Repositories, persistence, tenant predicates, module contracts |
| API | HTTP contract, auth, errors, filtering, idempotency, response minimization |
| Database | Constraints, migrations, uniqueness, clinical integrity |
| Authorization | Roles, permissions, ownership, relationships, privileged access |
| Tenant isolation | Direct and indirect Tenant A/B access attempts |
| AI safety | Injection, tools, context, output, approval, failure, leakage |
| End-to-end | Login → patient → appointment → encounter → AI → human review/final record |

Tests must include negative paths, retries, malformed input, concurrent
operations, and failure behavior, not only happy paths.

## 29. Mandatory Tenant Isolation Tests

For every tenant-scoped domain, tests must prove Tenant A cannot:

- read, modify, or delete Tenant B resources;
- obtain Tenant B data through IDs, list/search/filter, or error behavior;
- retrieve Tenant B files, cache entries, jobs, AI context, or RAG documents;
- infer protected Tenant B existence through unauthorized responses.

Coverage includes Patient, Appointment, Clinical, Identity/Tenant access,
AI/RAG, storage, background jobs, and audit views where exposed.

## 30. Authorization Testing

Every sensitive endpoint tests:

- unauthenticated user;
- authenticated user without the required permission;
- authorized user;
- wrong tenant;
- insufficient role;
- failed ownership/relationship check;
- privileged operation without explicit privilege.

The approved permission policy is endpoint-specific least privilege with
default deny. Tests must cover every documented operation permission and prove
that an unspecified operation is rejected.

Tests must demonstrate that role alone is not sufficient and that AI/model
text cannot grant authorization.

## 31. AI Safety Testing

AI features require tests for direct/indirect prompt injection, malicious
documents, unauthorized tools, cross-tenant access, IDOR, sensitive-data
leakage, malformed output, tool abuse/loops, human approval bypass,
finalized-record mutation, provider failure, timeout, and fail-closed
behavior. Implementation is incomplete when the feature works but these
invariants are untested.

## 32. Code Quality

Code must be readable, deterministic where business critical, small enough
to review, and free of dead code or unexplained bypasses. Follow repository
linting, formatting, naming, complexity, and documentation configuration
when it exists. Do not invent configuration values or suppress checks to
make a change pass.

Comments explain non-obvious constraints and security rationale; they do not
replace contracts or tests.

## 33. TypeScript Rules

TypeScript is used where established by the repository. Engineers must use
strict typing as configured, avoid `any` except for an explicitly reviewed
boundary, separate transport DTOs from domain models, model nullability
explicitly, use discriminated unions where they clarify states, and define
typed domain/API errors.

Existing repository configuration takes precedence; this document does not
introduce a new framework or compiler configuration.

## 34. Dependency Management

Dependencies require an owning module, a justified purpose, security review,
and compatibility assessment. Avoid unnecessary packages and duplicate
utilities. Version and update dependencies through the repository's approved
workflow, review transitive risk, and preserve Nx project boundaries.

The package manager, update cadence, and dependency automation are open
development decisions if not already established.

## 35. Code Review

Every PR is reviewed for correctness, architecture, security, tenant
isolation, tests, API contract compatibility, data-model compatibility,
auditability, and backward compatibility. AI changes additionally require
AI safety, tool scope, context minimization, approval, and failure review.

Changes to a domain, schema, public API, security boundary, shared library,
or architecture require review by the affected owner(s).

## 36. Git / Branching

Changes must be reviewable, scoped, and traceable through the repository's
approved branch/PR workflow. PRs describe purpose, affected domains,
security/tenant impact, migrations, tests, and rollback considerations.

Branch naming, commit conventions, merge strategy, and long-lived-branch
policy are not established by the project documents and remain open; no
rigid convention is invented here.

## 37. Change Ownership

| Change Type | Required Owner Review |
|---|---|
| Domain logic | Domain owner |
| Database schema | Domain owner + all affected owners |
| API contract | API/domain owner + affected owners |
| Security | Engineer A/security owner + affected owner |
| AI behavior/tool | Engineer D + affected domain owner |
| Shared library | All affected owners |
| Architecture | Architecture owner/team agreement |

## 38. Cross-Domain Changes

When a feature crosses domains, engineers must identify all affected owners,
confirm scope, update contracts first, use public interfaces, avoid private
imports/table access, coordinate migrations, preserve tenant/actor context,
and add integration-boundary tests. A cross-domain change is not complete
until each affected owner has reviewed its contract and security impact.

## 39. Definition of Done

A feature is complete only when applicable items are satisfied:

- requirements and approved scope implemented;
- API Contract and Data Model respected;
- authorization and tenant isolation implemented and tested;
- audit requirements implemented;
- unit, integration, API, security, and AI-safety tests added as applicable;
- observability and safe error handling added;
- security and affected-owner review completed;
- migration reviewed, forward compatibility considered, and rollback risk
  understood;
- documentation and traceability updated;
- backward compatibility and Post-MVP boundaries considered.

## 40. Feature Development Workflow

1. Read the relevant preceding documents.
2. Confirm approved scope and identify unresolved decisions.
3. Identify domain owner and all affected domains.
4. Update API/data/security/AI contracts first when required.
5. Design the smallest compatible change.
6. Implement within approved boundaries.
7. Add and run relevant tests, including negative tenant/auth paths.
8. Perform security and AI-safety review where applicable.
9. Perform integration and affected-owner review.
10. Open PR with evidence, risks, and migration notes.
11. Merge only after required checks/reviews pass.
12. Verify deployment behavior and observability.

Ambiguous requirements must pause implementation and be recorded as an open
decision rather than guessed.

## 41. Codex Development Rules

Codex must read relevant documentation before modifying code, respect domain
ownership and Nx boundaries, avoid inventing APIs/tables/roles, preserve
authorization and tenant isolation, keep changes scoped, run relevant tests,
and report failures honestly.

Codex must not silently rewrite architecture, API contracts, or schema;
modify unrelated modules; remove security controls; disable tests; bypass
lint/type checks; or introduce cross-domain imports without justification and
owner review. Architecture-document changes require explicit user
instruction.

## 42. Codex Task Contract

Every implementation task should provide:

```text
Task:
Context:
Relevant Documents:
Domain:
Owner:
Allowed Files:
Forbidden Files:
Expected Behavior:
API Contract:
Data Model:
Security Requirements:
AI Safety Requirements:
Tests Required:
Acceptance Criteria:
```

Codex must report ambiguity, scope changes, failed checks, and unresolved
decisions instead of silently resolving them.

## 43. File Ownership

| Path/Module | Owner | Allowed Changes | Review Required |
|---|---|---|---|
| `apps/web` | Affected domain owner | Client behavior using approved API contracts | Domain/API owner |
| `apps/api` | Affected API/domain owner | Transport orchestration and contract implementation | API, security, affected owner |
| `apps/workers` | Owning worker/domain owner | Approved jobs with preserved context | Domain and operations owner |
| `libs/identity`, `tenant` | Engineer A | Identity/tenant capabilities | Engineer A/security |
| `libs/patient`, `clinical` | Engineer B | Patient/clinical capabilities | Engineer B + affected owner |
| `libs/doctor`, `appointment` | Engineer C | Doctor/operations capabilities | Engineer C + affected owner |
| `libs/ai` | Engineer D | AI Gateway, tools, context, RAG, drafts | Engineer D + affected owner |
| `libs/audit`, `shared` | Engineer A schema/security owner | Narrow cross-domain contracts/primitives | All affected owners |

These paths are conceptual Architecture paths; the exact Nx project graph
remains open.

## 44. Shared Infrastructure

Authentication uses the approved Auth0-style Managed CIAM OIDC/OAuth2 target
boundary and
hybrid 15-minute access-token/7-day rotating-refresh-session strategy with
replay detection. Refresh tokens rotate on every use and replay revokes the
token family. The application owns tenant context, roles, permissions, and
session revocation; the provider owns credentials, MFA, and key rotation. MFA
is required for Staff, Admin, and privileged clinical operations. Standard
recovery is provider-managed through the application callback/handoff flow;
recovery exceptions require re-authentication or step-up MFA, explicit
authorization, bounded scope, and audit. Vendor-specific SDKs and payloads
stay inside the adapter.
Authentication, authorization, logging, configuration, audit, idempotency,
outbox, AI Gateway, storage, cache, and database infrastructure are shared
boundaries. Changes require the owning team plus affected-domain review.
Shared infrastructure must preserve tenant and actor context, avoid domain
business logic, and expose narrow contracts.

## 45. Environment Management

The environments are local, test, staging, and production. Each environment
must isolate credentials, configuration, database access, and data. Real
production healthcare data must not be used in local/test development unless
explicitly authorized by policy. Production access is privileged, audited,
and never embedded in source or committed configuration.

Exact deployment, secret-delivery, and environment promotion mechanisms are
open. Self-hosted Dify is the approved AI platform direction, but it must be
integrated only through the AI Gateway and Tool Gateway.

## 46. Test Data

Development and test data must be synthetic, isolated, non-sensitive,
reproducible, and tenant-aware. Real patient data must not be copied into
development/test environments. Fixtures must cover multiple tenants and
negative authorization cases without containing secrets or PHI.

## 47. Migration Safety

Migrations are production changes. Require owner review, affected-domain
review, backward-compatibility analysis, tenant/data-integrity checks,
performance assessment, rollback consideration, and verification. Destructive
migrations require explicit approval. No developer may manually change the
production schema.

Data-lifecycle implementation is gated by the Product/Compliance-owned,
category-specific data governance policy. Clinical history is immutable;
export and deletion use authorized workflows; and AI audit data uses shared
audit metadata rather than mandatory raw prompt/response retention. Retention,
deletion/anonymization, export, residency, audit, AI-data, and backup behavior
may be prepared behind interfaces, but irreversible or production-specific
semantics require the published approved policy.

## 48. Release Readiness

Before release, verify tests and automated checks pass, migrations are
reviewed, security and tenant isolation checks pass, API compatibility is
understood, observability is available, rollback is understood, and AI
safety tests pass for affected features. Unresolved blocking decisions must
prevent release of the affected capability.

Implementation may proceed under the approved production-policy guardrails:
environment/secret isolation, migration rollback contracts, failure-safe
dependency behavior, test/observability interfaces, and explicit operational
ownership. SLO, RPO/RTO, backup retention/restoration targets, rate limits,
quotas, alert thresholds, provider/topology, and incident-response values are
production-release blockers until approved.

## 49. Development Invariants

1. No cross-tenant access.
2. No direct AI database access.
3. No API endpoint bypasses authorization.
4. No domain bypasses another domain's public boundary.
5. No secrets in Git, source, logs, or responses.
6. No finalized clinical-record overwrite where immutability applies.
7. No sensitive operation without required auditability.
8. No undocumented API behavior or invented endpoint.
9. No production feature without appropriate tests.
10. No Codex-generated architectural change without explicit approval.
11. No retry-sensitive mutation without the required idempotency behavior.
12. No AI-generated clinical content becomes authoritative without the
    required human/application approval gate.

## 50. Traceability

| Development Rule | Architecture | Data Model | API Contract | Security | AI Safety |
|---|---|---|---|---|---|
| Domain/Nx boundaries | Sections 60-62 | Sections 47-49, 68 | Sections 26-27 | Sections 3, 12 | Sections 8, 31-32 |
| Tenant isolation | Sections 10-12, 61 | Sections 2, 8-9, 43, 62-64 | Sections 5-6, 25 | Sections 7, 9 | Sections 16-18 |
| Clinical integrity | Sections 20-21 | Sections 17-22 | Sections 12-13, 21 | Section 19 | Sections 11, 30 |
| AI boundary | Sections 22-34 | Sections 29-34, 59-60 | Sections 14-15 | Sections 15-18 | Sections 1-11 |
| Idempotency/concurrency | Sections 42-44 | Sections 15-16, 38, 45 | Sections 11, 21-22 | Sections 9, 26-27 | Sections 26-28 |
| Audit/logging | Section 35 | Sections 39-40 | Section 23 | Sections 21-24 | Sections 23-24 |
| Migration ownership/safety | Sections 59, 63 | Sections 53-54 | Section 26 | Section 12 | Not applicable |
| Testing/release | Sections 54, 58, 65-66 | Sections 57-58 | Section 31 | Section 35 | Sections 34-35 |

## 51. Open Development Decisions

# Open Development Decisions

| ID | Decision | Why it matters | Affected domain | Affected document | Blocking level | Owner |
|---|---|---|---|---|---|---|
| DEV-001 | Nx project graph and dependency direction | Hybrid modular backend with isolated AI/Tool Gateway, approved Shared Platform primitives, public cross-domain contracts, and Nx ownership constraints are approved; exact folder names remain implementation detail | All | Architecture Section 60; this document | Resolved for MVP | Architecture owner/team |
| DEV-002 | CI/CD implementation and boundary-check strategy | Required to enforce lint, types, tests, security, and Nx constraints | All | Architecture Section 58 | Required before production | Team/Operations |
| DEV-003 | Branching, commit, merge, and code-ownership conventions | Determines review and release traceability | All | Not yet decided | Required before team scale | Team |
| DEV-004 | Testing framework and integration-test environment | Determines repeatable security/tenant/AI verification | All | Architecture testing sections | Required before implementation | Team |
| DEV-005 | Migration workflow, deployment sequencing, and rollback automation | Approved hybrid risk-based migration strategy with preflight, compatibility, verification and rollback/forward-fix controls | Database domains | Architecture Section 59; Data Model Section 54 | Resolved for MVP | Engineer A + affected owner |
| DEV-006 | Public conflict, stale-update, and retry semantics | Approved OCC, domain-specific retry, idempotency and security re-check controls prevent stale writes and unsafe retries | Appointment/Clinical/Tenant/AI | API Contract; Architecture Gate | Resolved for MVP | Engineers B/C |
| DEV-007 | Background queue/dead-letter implementation | Determines retry, failure, and job isolation behavior | Workers/AI/Notification | Architecture Sections 42, 54 | Required before worker production | Operations/Engineer D |
| DEV-008 | Observability platform and retention | Determines detection, tracing, and operational response | All | Architecture Section 55; Security | Required before production | Security/Operations |
| DEV-009 | Environment promotion and secret-delivery mechanism | Prevents credential/data leakage across environments | Infrastructure/All | Security; Architecture | Blocking for production | Security/Operations |
| DEV-010 | Dependency management/update and code-ownership mechanism | Determines supply-chain and review control | All | This document | Required before production | Team |
| DEV-011 | Final permission matrix for separate Nurse/Clinical Staff and Receptionist roles | Endpoint-specific least privilege and default deny are approved | Identity/Patient/Clinical/Appointment | System Definition; Data Model; API Contract; Security | Resolved for MVP | Engineer A/Product |
| DEV-012 | Clinical approval workflow using canonical status `IN_REVIEW` | Authorized clinician review/edit/approve with step-up MFA, OCC revalidation, stale-draft handling, and audit provenance are approved | Clinical/AI | Architecture; Data Model; API Contract; AI Safety | Resolved for MVP | Engineer B/Product |
| DEV-013 | Final Managed CIAM contract and provider assurance | Auth0-style Managed CIAM target, 15-minute access token, 7-day rotating refresh session, MFA scope, replay-family revocation, account-status guardrails, provider-managed recovery, and application-enforced step-up exceptions are approved; final provider contract, region/residency, and service-level terms remain open | Identity/All | Architecture; Security; API Contract | Required before production | Engineer A/Security |
| DEV-014 | AI provider, model, retention, tool scope, autonomy and escalation decisions | MVP AI boundaries, model/retention, tool classes, tenant-only knowledge and risk-tiered escalation are approved; provider evidence remains release dependency | AI/RAG | Architecture; Security; AI Safety | Resolved for MVP | Engineer D/Product/Security |

## 52. Final Cross-Document Validation

Cross-check completed against `system-definition.md`,
`architecture-decisions.md`, `DATA-MODEL.MD`, `API-CONTRACTS.md`,
`SECURITY.md`, and `AI-SAFETY.md`.

Validated: domains, four-team ownership, conceptual Nx boundaries, database
ownership, API ownership, tenant isolation, roles, clinical immutability,
human approval, AI boundaries, security invariants, MVP/Post-MVP scope,
testing obligations, and migration ownership.

The contract intentionally does not resolve the open Nx graph, CI/CD,
branching, testing framework, migration automation, queue implementation,
observability, environment, dependency, authentication, final role permissions,
clinical status, AI governance, concurrency, or other decisions listed
above. No previous document was modified.
