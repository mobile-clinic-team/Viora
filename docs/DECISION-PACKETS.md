# Decision Packets

This document turns the current implementation blockers into reviewable
decision packets. It is a proposal and traceability artifact only. It does not
approve a decision, change source-of-truth documents, or authorize application
implementation.

Repository note: `docs/architecture/ARCHITECTURE.md` was requested as a source
document but is not present. The available architecture source used here is
`docs/architecture/architecture-decisions.md`.

# DEC-001 — Authentication, Session, MFA, and Tenant Context

## Status

APPROVED

## Problem

The system requires authenticated actors, explicit tenant membership, server-
side authorization, session security, recovery, revocation, and security
signals. The repository does not select an authentication provider, session or
token representation, MFA policy, recovery lifecycle, or final mechanism for
establishing active tenant context.

Already established:

- Protected APIs require an authenticated request.
- Tenant context is based on a valid membership and must be carried through the
  application boundary.
- Authorization is server-side and precedes sensitive access or mutation.
- Authentication and security events require appropriate audit/security
  signals.

Still open:

- Provider.
- Session/token strategy and lifecycle.
- MFA requirement and recovery/exception behavior.
- Revocation, expiry, lockout, and account recovery behavior.
- Exact tenant-context establishment and switching behavior.

## Evidence

- `docs/product/system-definition.md` — Authentication, authorization,
  security requirements, Member A ownership, and Open Decisions.
- `docs/architecture/architecture-decisions.md` — Identity/security and
  production architecture decisions.
- `docs/API-CONTRACTS.md` — Sections 4–6, authentication, tenant context, and
  authorization; API-001.
- `docs/SECURITY.md` — Sections 4–6 and Section 40, identity, authentication,
  authorization, and open security decisions.
- `docs/DEVELOPMENT-CONTRACTS.md` — Sections 14 and 51.
- `docs/IMPLEMENTATION-PLAN.md` — Sections 6, 13, 22, and 36; `BLOCK-001`.
- `docs/DECISION-LOG.md` — DEC-001 is `APPROVED`; provider/session/token/MFA
  details remain open.

## Why This Blocks Implementation

Identity, protected APIs, tenant context, authorization, IDOR prevention,
background-job identity, and sensitive Patient/Clinical/Appointment/AI work
depend on this decision.

## Options

### Option A — External identity provider behind an application boundary

- Description: Select a project-approved external authentication provider and
  integrate it behind an application identity boundary.
- Advantages: Provider-managed identity lifecycle and reduced application
  ownership of credential flows.
- Disadvantages: Provider dependency and provider-specific session, MFA,
  recovery, residency, and logging behavior.
- Implementation impact: Add a provider-neutral identity adapter and explicit
  mapping from authenticated identity to membership/tenant context.
- Security impact: Provider controls and application controls must be reviewed
  together, including revocation, MFA, account recovery, and audit signals.
- Data-model impact: User and membership semantics remain application-owned;
  external subject identifiers must be handled consistently.
- API impact: Authentication requirements, failure behavior, and identity
  representation must be finalized without exposing provider internals.
- AI impact: AI actor and tenant context can use the same authenticated
  application context.
- Operational impact: Provider availability, configuration, secret delivery,
  monitoring, and failure behavior must be defined.

### Option B — Application-controlled authentication lifecycle

- Description: Implement the authentication lifecycle within the application
  using project-approved identity and session components.
- Advantages: Direct control over lifecycle, integration, and tenant-context
  behavior.
- Disadvantages: The project owns more credential, recovery, MFA, revocation,
  monitoring, and security risk.
- Implementation impact: Identity services must define the complete lifecycle
  before protected endpoint implementation.
- Security impact: Credential handling, session protection, MFA, lockout,
  recovery, revocation, and anomaly controls require explicit review.
- Data-model impact: Application-owned identity/session state may require
  additional documented persistence semantics.
- API impact: Session/token representation and authentication errors must be
  explicitly documented.
- AI impact: AI tools still receive only application-created actor and tenant
  context.
- Operational impact: The team owns availability, rotation, incident response,
  and recovery of the authentication lifecycle.

## Recommended Option

Technical recommendation: use a provider-neutral application identity boundary,
regardless of whether Option A or Option B is selected. This preserves the
current architecture's separation between authentication and domain services.

Provider, MFA policy, session/token choice, and recovery policy require human
Product/Security/Architecture decision.

## Consequences

The approved choice must update identity contracts, authentication behavior,
tenant-context rules, security controls, test fixtures, environment/secrets
requirements, and all affected implementation-plan dependencies.

## Approval

- Decision owner: Engineer A with Security/Architecture and project-owner approval
- Status: APPROVED
- Approved by: Human / Project Owner
- Approved at: 2026-08-28
- Notes:

# DEC-002 — STAFF, Nurse, and Receptionist Role Mapping

## Status

APPROVED

## Problem

The product describes Nurse/Clinical Staff and Receptionist as user types. The
role-structure decision is now approved: Nurse/Clinical Staff and Receptionist
are separate application roles. The final permission matrix and resource-level
authorization remain to be defined.

## Evidence

- `docs/product/system-definition.md` — Nurse/Clinical Staff, Receptionist,
  onboarding, and authorization model.
- `docs/DATA-MODEL.MD` — Section 7, Role Model.
- `docs/API-CONTRACTS.md` — Section 6 and endpoint authorization rules.
- `docs/SECURITY.md` — Section 6, Authorization.
- `docs/DEVELOPMENT-CONTRACTS.md` — Sections 5 and 30.
- `docs/IMPLEMENTATION-PLAN.md` — Sections 4, 6, 13, 24, and 36;
  `BLOCK-002`.
- `docs/DECISION-LOG.md` — DEC-002 is `APPROVED`; its permission-matrix
  follow-up remains open.

## Why This Blocks Implementation

Role-specific permissions, staff onboarding, endpoint guards, audit actor
classification, and authorization tests still require the final permission
matrix.

## Options

### Option A — Separate Nurse and Receptionist application roles

- Description: Represent Nurse/Clinical Staff and Receptionist as separate
  application roles.
- Advantages: Explicit policy names and direct endpoint authorization rules.
- Disadvantages: More role definitions and possible role proliferation.
- Implementation impact: Update role enums, membership assignment, guards, and
  authorization test matrices.
- Security impact: Least privilege is explicit, but every role needs complete
  review to avoid omissions.
- Data-model impact: Role persistence and membership constraints must represent
  the selected roles.
- API impact: Membership and authorization responses must expose the approved
  role representation.
- AI impact: AI tools must allow only the approved role/permission set.
- Operational impact: Onboarding, role changes, access review, and audit
  reporting must handle separate roles.

### Option B — Generic STAFF role with permission-based differentiation

- Description: Keep `STAFF` as the broad role and distinguish Nurse/Clinical
  Staff from Receptionist through explicit permissions.
- Advantages: Preserves the existing generic role and supports least privilege
  through a permission matrix.
- Disadvantages: Permission configuration and review become more complex.
- Implementation impact: Implement permission evaluation and explicit staff
  permission profiles.
- Security impact: Incorrect permission assignment could over-authorize staff;
  negative tests are essential.
- Data-model impact: The role model can remain `STAFF`, with documented
  permission assignment semantics.
- API impact: Endpoint contracts must refer to permissions rather than relying
  only on role names.
- AI impact: Tool authorization must evaluate the resulting permissions and
  never use `STAFF` alone as model authority.
- Operational impact: Onboarding and access reviews must maintain permission
  profiles.

### Option C — STAFF with an explicit user-type/subrole attribute

- Description: Keep `STAFF` as the broad role and add an explicit Nurse/
  Receptionist subtype.
- Advantages: Retains the generic role while preserving the product user type.
- Disadvantages: Introduces a new subtype model and precedence rules that are
  not currently established.
- Implementation impact: Requires a documented subtype, assignment, migration,
  and policy model.
- Security impact: Role/subrole/permission precedence must be unambiguous.
- Data-model impact: Adds a subtype representation and invariants.
- API impact: Membership and authorization responses need a stable subtype
  representation.
- AI impact: Tool permissions must define whether role, subtype, or permission
  is authoritative.
- Operational impact: Onboarding, reporting, and access review gain another
  lifecycle dimension.

## Recommended Option

The role structure is approved. The final permission matrix requires Product,
Security, and affected-owner review.

## Consequences

The approved model must update product user types, role persistence, permission
matrices, API authorization requirements, Security rules, AI tool permissions,
tests, and implementation tasks.

## Approval

- Decision owner: Product owner with Engineer A and affected domain owners
- Status: APPROVED
- Approved by: Human / Project Owner
- Approved at: 2026-08-28
- Notes:

# DEC-003 — Canonical Clinical Lifecycle Status

## Status

APPROVED

## Problem

The source documents previously used both `REVIEW` and `IN_REVIEW` for the
clinical intermediate state. The approved canonical representation is now
`IN_REVIEW`; review remains the name of the transition action where applicable.

## Evidence

- `docs/architecture/architecture-decisions.md` — clinical lifecycle and human
  review decisions.
- `docs/DATA-MODEL.MD` — Sections 20–22, versions, immutability, and status.
- `docs/API-CONTRACTS.md` — clinical review, finalize, and amendment operations.
- `docs/AI-SAFETY.md` — Sections 11–13 and 29, human approval and output
  classification.
- `docs/SECURITY.md` — Section 19, Clinical Record Integrity.
- `docs/DEVELOPMENT-CONTRACTS.md` — Section 17, clinical data rules.
- `docs/IMPLEMENTATION-PLAN.md` — Sections 15, 19, 24, and 36;
  `BLOCK-003`.
- `docs/DECISION-LOG.md` — DEC-003 is `APPROVED`.

## Why This Blocks Implementation

The database enum, API transitions, clinical immutability, AI draft approval,
audit events, and clinical integrity tests need one canonical state model.

## Options

### Option A — Canonical intermediate state `REVIEW`

- Description: Use `REVIEW` consistently in the database, API, application
  services, AI approval mapping, and documentation.
- Advantages: Matches the Architecture lifecycle wording.
- Disadvantages: Requires aligning the current Data Model enum and any API/AI
  references using `IN_REVIEW`.
- Implementation impact: Update enum, transition validation, service logic, and
  tests.
- Security impact: Review/finalize authorization checks gain one unambiguous
  state target.
- Data-model impact: The canonical enum and transition constraints must be
  updated consistently.
- API impact: Review/finalize responses and request semantics use one value.
- AI impact: AI draft review/approval must map to the same approved lifecycle
  semantics where applicable.
- Operational impact: Audit queries, monitoring, support tooling, and reporting
  use one state name.

### Option B — Canonical intermediate state `IN_REVIEW`

- Description: Use `IN_REVIEW` consistently across the database, API,
  application services, AI approval mapping, and documentation.
- Advantages: Matches the current Data Model enum.
- Disadvantages: Requires aligning Architecture lifecycle wording and related
  API/AI references.
- Implementation impact: Update lifecycle diagrams, transition validation,
  service logic, and tests.
- Security impact: Review/finalize authorization checks gain one unambiguous
  state target.
- Data-model impact: Preserves the current enum spelling as the canonical value.
- API impact: Review/finalize responses and request semantics use one value.
- AI impact: AI draft review/approval must map to the same approved lifecycle
  semantics where applicable.
- Operational impact: Audit queries, monitoring, support tooling, and reporting
  use one state name.

## Recommended Option

Technical recommendation: use `IN_REVIEW` consistently and prohibit
translation at individual endpoint or domain boundaries. This was selected by
Human / Project Owner.

## Consequences

The approved value must be propagated to Architecture, Data Model, API
Contracts, AI Safety, Security, Development Contracts, tests, and the
Implementation Plan.

## Approval

- Decision owner: Product owner with Engineer B and Architecture/AI Safety review
- Status: APPROVED
- Approved by: Human / Project Owner
- Approved at: 2026-08-28
- Notes:

# DEC-004 — Appointment Concurrency, Retry, and Conflict Contract

## Status

APPROVED

## Problem

The Data Model establishes PostgreSQL protection against double booking,
application-level scheduling transaction protection, and tenant/actor-scoped
idempotency. The public API and Development Contracts do not yet establish the
complete conflict, stale-update, and retry semantics.

## Evidence

- `docs/DATA-MODEL.MD` — Sections 15–16: PostgreSQL exclusion direction,
  scheduling resource, transaction flow, and idempotency rules.
- `docs/architecture/architecture-decisions.md` — reliability, idempotency,
  retry, and concurrency guidance.
- `docs/API-CONTRACTS.md` — Sections 11 and 21; API-004.
- `docs/DEVELOPMENT-CONTRACTS.md` — Section 21, Concurrency.
- `docs/SECURITY.md` — API abuse, integrity, and idempotency controls.
- `docs/IMPLEMENTATION-PLAN.md` — Sections 11, 13, 20, 22, 24, and 36;
  `BLOCK-004`.
- `docs/DECISION-LOG.md` — DEC-004 is `APPROVED`; public conflict and
  stale-update semantics remain a follow-up.

## Why This Blocks Implementation

Appointment create/update, rescheduling, idempotency replay, stale updates,
double-booking prevention, and reliability tests cannot be finalized without a
single database-to-API contract.

## Options

### Option A — Database constraint plus application transaction handling

- Description: Retain the documented PostgreSQL exclusion-constraint direction
  and the application scheduling transaction/idempotency flow.
- Advantages: Database protection remains enforced at the transaction boundary
  and matches the current Data Model.
- Disadvantages: Public conflict and stale-update behavior still require an
  explicit API decision.
- Implementation impact: Implement the transaction flow, constraint handling,
  idempotency replay, and explicit error mapping after approval.
- Security impact: Reduces double-booking and replay risk, but authorization
  must still be checked before mutation.
- Data-model impact: Retains `btree_gist`, scheduling-resource, exclusion, and
  idempotency requirements.
- API impact: Requires approved conflict, stale-update, and retry semantics;
  this packet does not invent status codes or headers.
- AI impact: Conditional AI appointment creation must use the same application
  mutation and idempotency contract.
- Operational impact: Database conflict metrics, retry behavior, and failure
  observability must be defined.

### Option B — Application concurrency protocol with database invariants

- Description: Define an application-level concurrency protocol while retaining
  database integrity protections as a final invariant.
- Advantages: Gives the application explicit control over public mutation
  behavior.
- Disadvantages: More complexity and greater risk of gaps between checks and
  committed database state.
- Implementation impact: Requires a documented protocol, transaction boundary,
  stale-update mechanism, conflict mapping, and tests.
- Security impact: Authorization and replay protections must apply to every
  protocol path.
- Data-model impact: Existing database constraints cannot be weakened without a
  separate approved change.
- API impact: Requires an explicit public concurrency and conflict contract.
- AI impact: AI mutation tools must use the same protocol and cannot bypass it.
- Operational impact: More protocol-specific telemetry, retry, and incident
  handling is required.

## Recommended Option

Technical recommendation: preserve the documented database exclusion-constraint
direction and application idempotency flow, then define public conflict and
stale-update semantics explicitly. This option was selected by Human / Project
Owner.

## Consequences

Approval must synchronize Data Model, API Contracts, Development Contracts,
Security, AI conditional mutation behavior, tests, and appointment tasks.

## Approval

- Decision owner: Architecture with Engineers B/C and API owner review
- Status: APPROVED
- Approved by: Human / Project Owner
- Approved at: 2026-08-28
- Notes:

# DEC-005 — AI Platform and Governance Boundary

## Status

APPROVED

## Problem

AI must remain an untrusted controlled subsystem behind the Tool Gateway. The
repository does not select an AI provider, model, embedding model/dimension,
RAG governance, retention/logging policy, knowledge ownership model, or final
tool authorization policy.

## Evidence

- `docs/product/system-definition.md` — AI purpose, capabilities, restrictions,
  context/memory, RAG, external providers, and AI development rules.
- `docs/architecture/architecture-decisions.md` — AI Gateway, provider
  boundary, RAG, tools, and data architecture.
- `docs/API-CONTRACTS.md` — Sections 14–15 and API-007.
- `docs/SECURITY.md` — Sections 15–18 and open security decisions.
- `docs/AI-SAFETY.md` — Sections 5–10, 18–27, 29, and 37.
- `docs/DEVELOPMENT-CONTRACTS.md` — Sections 15–16 and 51.
- `docs/IMPLEMENTATION-PLAN.md` — Sections 16–19, 22, 24, and 36;
  `BLOCK-005`.
- `docs/DECISION-LOG.md` — DEC-005 is `APPROVED`.

## Remaining Implementation Dependencies

The AI platform boundary is approved. AI Gateway, context assembly, RAG, tool
permissions, AI memory, retention, provider/model behavior, and clinical drafts
still depend on the explicitly listed follow-up decisions.

## Options

### Option A — External provider behind the AI Gateway

- Description: Select an externally hosted AI provider behind the project AI
  Gateway and application-controlled Tool Gateway.
- Advantages: Provider supplies model execution without the project operating a
  model runtime.
- Disadvantages: Provider logging, retention, availability, residency, and
  data-processing behavior require explicit review.
- Implementation impact: Implement provider-neutral Gateway contracts, bounded
  provider adapters, timeouts, failure behavior, and output validation.
- Security impact: Provider data boundary, prompt/context minimization, secret
  handling, tenant isolation, and provider logging require review.
- Data-model impact: Conversation, message, draft, knowledge, and embedding
  persistence must follow the approved retention/governance policy.
- API impact: AI APIs must expose only approved behavior and preserve draft/
  approval semantics.
- AI impact: Provider/model/embedding selection and safety evaluation become
  explicit approval inputs.
- Operational impact: Provider availability, quotas, rate limits, cost,
  monitoring, and outage behavior must be defined.

### Option B — Project-controlled model runtime behind the AI Gateway

- Description: Operate or integrate a project-controlled model runtime behind
  the same Gateway and Tool Gateway boundary.
- Advantages: Greater control over runtime and data boundary.
- Disadvantages: Greater infrastructure, capacity, model operations, and
  maintenance responsibility.
- Implementation impact: Requires runtime, model serving, versioning, and
  failure contracts in addition to Gateway contracts.
- Security impact: The project owns model-runtime isolation, access control,
  secrets, logging, and data handling.
- Data-model impact: Same AI persistence and retention decisions remain
  required; runtime control does not decide policy.
- API impact: AI API behavior remains Gateway-controlled and provider-neutral.
- AI impact: Model and embedding evaluation, versioning, and rollback become
  project responsibilities.
- Operational impact: Capacity, availability, patching, monitoring, and
  incident response are project-owned.

## Recommended Option

Technical recommendation: retain a provider-neutral AI Gateway and an
application-controlled Tool Gateway in either option. Human Product/
Architecture/Security decision is required for provider, model, embedding,
knowledge governance, retention, and tool authorization.

## Consequences

Approval must update Architecture, System Definition, API Contracts, Security,
AI Safety, Development Contracts, Data Model retention/RAG sections, and AI
implementation tasks. AI must continue to have no direct database access, no
autonomous clinical mutation, and no Tool Gateway bypass.

## Approval

- Decision owner: Product owner with Engineer D, Architecture, Security, and affected domain owners
- Status: APPROVED
- Approved by: Human / Project Owner
- Approved at: 2026-08-28
- Notes: Option B selected — operate or integrate a project-controlled AI
  runtime behind the AI Gateway. The selected Dify direction is self-hosted
  Dify behind the project AI Gateway and application-controlled Tool Gateway.
  Model/provider, embedding, retention, knowledge governance, rate/resource
  limits, and tool authorization remain explicit follow-up decisions.

# DEC-006 — Data Governance, Retention, Deletion, and Residency

## Status

APPROVED

## Problem

The source documents require explicit lifecycle handling for PHI, clinical
records, audit events, backups, exports, AI conversations, drafts, prompts,
context, embeddings, and knowledge data. They do not establish retention
periods, deletion/anonymization rules, residency, backup retention, or the
applicable regulatory scope.

No regulatory requirement is assumed by this packet.

## Evidence

- `docs/product/system-definition.md` — data classification, storage,
  security, backup/disaster recovery, and Open Decisions.
- `docs/architecture/architecture-decisions.md` — backup, recovery, retention,
  residency, RPO, and RTO sections.
- `docs/DATA-MODEL.MD` — Sections 41–43, 51, 57–61, 64, and 67.
- `docs/API-CONTRACTS.md` — API-007 and API-010.
- `docs/SECURITY.md` — Sections 8, 17, 29, 32–33, and 40.
- `docs/AI-SAFETY.md` — Sections 19–20, 24–25, and 37.
- `docs/IMPLEMENTATION-PLAN.md` — Sections 29, 33–37;
  `BLOCK-006` and `BLOCK-007`.
- `docs/DECISION-LOG.md` — DEC-006 is `APPROVED`.

## Why This Blocks Implementation

Data lifecycle, deletion, export, backup, AI retention, storage boundaries,
and production evidence depend on explicit governance. Features that do not
need policy-dependent behavior may continue as preparation only.

## Options

### Option A — Product/compliance defines and approves the policy

- Description: Product/compliance ownership explicitly defines retention,
  deletion, anonymization, residency, audit, AI, and backup policies.
- Advantages: Establishes a project policy without inventing legal requirements.
- Disadvantages: Requires owner input and may introduce implementation
  constraints or external dependencies.
- Implementation impact: Schema, jobs, APIs, exports, deletion, and tests must
  implement the approved policy.
- Security impact: Enables explicit PHI, audit, backup, AI, and residency
  controls.
- Data-model impact: Retention fields, lifecycle states, deletion behavior,
  amendments, and cascades must follow the policy.
- API impact: Export, deletion, field exposure, and error behavior must be
  aligned to the policy.
- AI impact: Conversation, prompt/context, draft, embedding, knowledge, and
  provider-log handling must follow the approved rules.
- Operational impact: Backup lifecycle, restore testing, monitoring, and
  incident processes must provide evidence of compliance with the project
  policy.

### Option B — Defer policy-dependent capabilities

- Description: Keep policy-dependent data lifecycle and storage capabilities out
  of implementation until governance is approved.
- Advantages: Avoids irreversible or non-compliant behavior based on guesses.
- Disadvantages: Delays affected MVP and production capabilities.
- Implementation impact: Only policy-independent preparation and boundaries may
  proceed.
- Security impact: Reduces the risk of retaining, exporting, or deleting data
  under an unapproved policy.
- Data-model impact: No unapproved retention or deletion semantics are added.
- API impact: Policy-dependent export, deletion, and affected data endpoints
  remain blocked.
- AI impact: AI persistence and provider-dependent features remain blocked where
  retention/governance is required.
- Operational impact: Production release remains blocked for affected data.

## Recommended Option

Human decision required. Product/compliance must define the project policy;
Codex must not infer jurisdictional or regulatory obligations.

## Consequences

Approval must synchronize System Definition, Architecture, Data Model, API
Contracts, Security, AI Safety, Development Contracts where operational rules
are affected, and the Implementation Plan/release gate.

## Approval

- Decision owner: Product owner and compliance/data-governance owner; otherwise not specified
- Status: APPROVED
- Approved by: Human / Project Owner
- Approved at: 2026-08-28
- Notes: Option A selected — Product/compliance owner must define and approve
  retention, deletion, anonymization, residency, audit, AI, and backup
  policies. No regulatory requirement or lifecycle value is inferred by this
  decision.

# DEC-007 — Clinical Files MVP Scope and Boundary

## Status

APPROVED

## Problem

The Data Model contains `clinical_files` and documents its security/lifecycle
concerns. The API contract marks the File API Post-MVP, and the Implementation
Plan keeps file work outside the MVP critical path. DEC-007 explicitly approves
that boundary.

## Evidence

- `docs/product/system-definition.md` — storage, data classification, AI/RAG,
  and Open Decisions.
- `docs/architecture/architecture-decisions.md` — object storage, private
  access, document processing, and security boundaries.
- `docs/DATA-MODEL.MD` — Sections 26–27, 46, 51, and 67.
- `docs/API-CONTRACTS.md` — Section 17, File API — Post-MVP.
- `docs/SECURITY.md` — Sections 14 and 28.
- `docs/AI-SAFETY.md` — Sections 18–20, 25, and 37.
- `docs/DEVELOPMENT-CONTRACTS.md` — Sections 25 and 43.
- `docs/IMPLEMENTATION-PLAN.md` — Sections 13, 20, 34, and 38;
  `BLOCK-008`.
- `docs/DECISION-LOG.md` — DEC-007 is `APPROVED`.

## Why This Blocks Implementation

File scope changes schema/migration scope, object storage, upload validation,
authorization, retention, worker processing, API surface, and possible AI/RAG
ingestion.

## Options

### Option A — Keep clinical files Post-MVP

- Description: Exclude clinical-file APIs, storage implementation, and AI file
  ingestion from MVP.
- Advantages: Preserves the currently documented scope and reduces attack
  surface.
- Disadvantages: File-dependent workflows are unavailable in MVP.
- Implementation impact: No file implementation is scheduled before MVP; any
  file preparation remains documentation-only.
- Security impact: Avoids introducing upload, scanning, private-download, and
  content-security risk before controls are specified.
- Data-model impact: `clinical_files` remains outside MVP implementation scope.
- API impact: File APIs remain Post-MVP.
- AI impact: AI cannot ingest or retrieve clinical files in MVP.
- Operational impact: No file-storage lifecycle or file-processing worker is
  required for MVP release.

### Option B — Include a bounded clinical-file MVP capability

- Description: Include only an explicitly defined clinical-file scope in MVP.
- Advantages: Supports product workflows that require file storage or access.
- Disadvantages: Adds storage, upload, validation, authorization, retention,
  worker, and testing scope.
- Implementation impact: Add approved schema, migration, API, storage, worker,
  and security tasks with dependencies.
- Security impact: Requires private storage, backend authorization, content
  validation, audit, abuse limits, and lifecycle controls.
- Data-model impact: Define association, metadata, lifecycle, deletion, and
  retention semantics for `clinical_files`.
- API impact: Define upload/download/reference operations, validation, errors,
  authorization, and tenant behavior.
- AI impact: Explicitly decide whether files may enter context or RAG; no AI
  ingestion is implied by file inclusion alone.
- Operational impact: Add storage availability, scanning/processing failure,
  monitoring, backup, and recovery requirements.

## Recommended Option

Human decision required. The current documents support keeping files Post-MVP,
but Product confirmation is required before treating that as an approved scope
decision.

## Consequences

Approval must synchronize System Definition, Architecture, Data Model, API
Contracts, Security, AI Safety, Development Contracts, and Implementation Plan.

## Approval

- Decision owner: Product owner with Engineers B/D, Security, and Architecture review
- Status: APPROVED
- Approved by: Human / Project Owner
- Approved at: 2026-08-28
- Notes: Option A selected — defer all Clinical File capabilities to Post-MVP.
  MVP is limited to textual and structured data; file schema, endpoints,
  storage, workers, parsing/scanning, and AI file ingestion are excluded.

# BLOCK-009 — Pagination Contract

## Status

APPROVED

## Problem

The API contract defines a conceptual collection response and requires bounded
cursor pagination. BLOCK-009 is now resolved by a uniform opaque cursor
standard with server-enforced governance.

## Evidence

- `docs/API-CONTRACTS.md` — Section 3.3 and API-005.
- `docs/DEVELOPMENT-CONTRACTS.md` — API implementation and testing rules.
- `docs/SECURITY.md` — bounded input/result and abuse controls.
- `docs/IMPLEMENTATION-PLAN.md` — Sections 12, 24, 36, and 42;
  `BLOCK-009`.

## Why This Blocks Implementation

Affected list/search APIs cannot expose stable client behavior or complete
pagination tests until the contract is approved.

## Options

### Option A — Opaque cursor over an approved stable keyset

- Description: Use the existing `next_cursor`/`has_more` response shape with an
  opaque cursor encoding the approved allowlisted ordering keyset. Use a
  deterministic tie-breaker for stable ordering.
- Advantages: Avoids exposing storage details and supports stable continuation
  across pages.
- Disadvantages: Cursor encoding, invalidation, and ordering compatibility must
  be maintained.
- Implementation impact: Add cursor encode/decode validation, bounded limit
  enforcement, stable ordering, and tests.
- Security impact: Cursor must not bypass tenant/resource authorization or expose
  sensitive identifiers.
- Data-model impact: Required ordering fields and indexes must be reviewed;
  schema changes are not implied by this option.
- API impact: Finalize default/max size, cursor format, invalid-cursor behavior,
  ordering, and response semantics.
- AI impact: AI conversation and RAG collection behavior must use the same
  approved pagination rules where applicable.
- Operational impact: Monitor page depth, invalid cursors, expensive queries,
  and abuse limits.

### Option B — Opaque cursor with endpoint-specific approved ordering

- Description: Keep the cursor opaque but approve a separate stable ordering
  and bounded limit contract for each collection endpoint.
- Advantages: Allows domain-appropriate ordering and indexes.
- Disadvantages: More contracts to document, test, and maintain.
- Implementation impact: Each list/search task must declare ordering, cursor
  fields, limits, validation, and stable tie-breaking.
- Security impact: Every endpoint-specific query remains allowlisted and
  tenant-scoped.
- Data-model impact: Each ordering/index requirement needs affected-owner review.
- API impact: More explicit endpoint contracts and compatibility obligations.
- AI impact: AI/RAG endpoints need their own approved ordering and bounds.
- Operational impact: Endpoint-specific performance and rate-limit monitoring
  is required.

## Recommended Option

The approved standard uses an opaque Base64URL/JSON cursor, centralized
server-enforced governance, `default_size = 20`, `max_size = 100`, stable
allowlisted keyset ordering with a deterministic unique tie-breaker, and HTTP
`400 INVALID_PAGINATION_CURSOR` for invalid cursors. HMAC may provide cursor
integrity/authenticity; it is not encryption. Tenant binding is server-validated
and does not grant authorization.

## Consequences

Approval must update API Contracts, Development Contracts, affected API task
dependencies and acceptance criteria, security tests, and Implementation Plan
blocker references.

## Approval

- Decision owner: API/Architecture owner
- Status: APPROVED
- Approved by: Human / Project Owner
- Approved at: 2026-08-28
- Notes:

# BLOCK-010 — Appointment `NO_SHOW` Authority

## Status

APPROVED

## Problem

`NO_SHOW` exists in the appointment status set, but the repository does not
fully define who may perform that transition, whether it is an explicit command
or part of generic status update behavior, or the complete authorization and
audit behavior.

## Evidence

- `docs/DATA-MODEL.MD` — Section 14, Appointment Status and allowed transitions.
- `docs/API-CONTRACTS.md` — Appointment status transitions and the resolved
  explicit-command boundary.
- `docs/SECURITY.md` — authorization and audit requirements.
- `docs/DEVELOPMENT-CONTRACTS.md` — appointment transition and authorization
  testing rules.
- `docs/IMPLEMENTATION-PLAN.md` — Sections 17, 20, 24, and 36;
  `BLOCK-010`.

## Why This Blocks Implementation

The approved boundary now governs appointment transition authorization, status
commands, audit events, and negative tests. The responsible role/permission
still follows the separate authorization matrix decision.

## Options

### Option A — Explicit application command with approved role/permission

- Description: Expose `NO_SHOW` as an explicit application transition command
  governed by an approved role/permission policy.
- Advantages: Makes the side effect, authorization, validation, and audit
  boundary explicit.
- Disadvantages: Requires product approval of the responsible actor and command
  semantics.
- Implementation impact: Add explicit transition validation, authorization,
  idempotency/audit behavior, and tests.
- Security impact: Reduces accidental generic status mutation and makes access
  review auditable.
- Data-model impact: Uses the existing status value and transition rules; no
  schema change is implied.
- API impact: Requires an approved command shape and error behavior; no HTTP
  status is invented here.
- AI impact: AI cannot invoke the transition unless separately approved as a
  bounded authorized tool.
- Operational impact: Audit, metrics, and support workflows can identify the
  transition explicitly.

### Option B — Generic status update governed by an approved permission

- Description: Permit `NO_SHOW` through the existing status-update path, with
  explicit permission, transition validation, audit, and idempotency.
- Advantages: Reuses the existing status mutation path.
- Disadvantages: Generic mutation increases the risk of accidental or overly
  broad transition authority.
- Implementation impact: Add an explicit permission matrix and transition
  tests to the generic path.
- Security impact: Requires strict allowlisting to prevent unauthorized status
  changes.
- Data-model impact: Uses the existing status enum but requires documented
  application transition rules.
- API impact: Existing status-update semantics must explicitly define `NO_SHOW`
  authority and validation.
- AI impact: AI remains unable to perform the mutation unless separately
  approved under the same permission and Tool Gateway controls.
- Operational impact: Audit and monitoring must distinguish `NO_SHOW` changes
  from other status updates.

## Recommended Option

Technical recommendation: prefer an explicit application transition boundary so
that authority, validation, idempotency, and audit are visible. Human Product/
Operations/Domain approval is required for the responsible role or permission.

## Consequences

Approval must synchronize Data Model transition rules, API Contracts,
Security/authorization rules, Development tests, AI tool restrictions if
applicable, and Appointment implementation tasks.

## Approval

- Decision owner: Product owner with Engineer C and Security/API review
- Status: APPROVED
- Approved by: Human / Project Owner
- Approved at: 2026-08-28
- Notes: Option A selected — use an explicit application transition command
  for `NO_SHOW`, with approved role/permission governance, transition
  validation, idempotency, audit, and negative tests. AI cannot invoke the
  transition unless separately approved through the AI Tool Gateway.

# Decision → Document Impact Matrix

| Decision | Current Status | System Definition | Architecture | Data Model | API Contract | Security | AI Safety | Development Contracts | Implementation Plan |
|---|---|---|---|---|---|---|---|---|---|
| DEC-001 | APPROVED | UPDATE | UPDATE | REVIEW | UPDATE | UPDATE | REVIEW | UPDATE | UPDATE |
| DEC-002 | APPROVED | UPDATE | REVIEW | UPDATE | UPDATE | UPDATE | REVIEW | UPDATE | UPDATE |
| DEC-003 | APPROVED | REVIEW | UPDATE | UPDATE | UPDATE | REVIEW | UPDATE | UPDATE | UPDATE |
| DEC-004 | APPROVED | REVIEW | UPDATE | REVIEW | UPDATE | REVIEW | REVIEW | UPDATE | UPDATE |
| DEC-005 | APPROVED | UPDATE | UPDATE | REVIEW | UPDATE | UPDATE | UPDATE | UPDATE | UPDATE |
| DEC-006 | APPROVED | UPDATE | UPDATE | UPDATE | UPDATE | UPDATE | REVIEW | UPDATE | UPDATE |
| DEC-007 | APPROVED | UPDATE | UPDATE | UPDATE | UPDATE | UPDATE | UPDATE | UPDATE | UPDATE |
| BLOCK-009 | APPROVED | REVIEW | UPDATE | REVIEW | UPDATE | UPDATE | UPDATE | UPDATE | UPDATE |
| BLOCK-010 | APPROVED | REVIEW | REVIEW | UPDATE | UPDATE | REVIEW | REVIEW | UPDATE | UPDATE |

`UPDATE` means the approved result must be synchronized into the document.
`REVIEW` means consistency review is required if the approved result changes
that document's interpretation. No document is changed by this packet.

# Decision Traceability

| Decision | Current Status | Decision Owner | Blocks | Documents Affected | Human Approval Required |
|---|---|---|---|---|---|
| DEC-001 | APPROVED | Engineer A / Security / Architecture / Product | Protected access, identity, tenant context, authorization, sensitive APIs | System, Architecture, API, Security, Development, Implementation Plan | YES |
| DEC-002 | APPROVED | Product / Engineer A / affected owners | Role-specific authorization and onboarding | System, Data, API, Security, Development, Implementation Plan | YES |
| DEC-003 | APPROVED | Product / Engineer B / Architecture / AI Safety | Clinical and AI approval lifecycle using `IN_REVIEW` | Architecture, Data, API, Security, AI Safety, Development, Implementation Plan | YES |
| DEC-004 | APPROVED | Architecture / Engineers B-C / API | Appointment mutation, retry, stale update, double booking | Architecture, Data, API, Security, Development, Implementation Plan | YES |
| DEC-005 | APPROVED | Product / Engineer D / Architecture / Security | Self-hosted Dify Gateway boundary; remaining provider/model, RAG, tools, and AI persistence decisions | System, Architecture, Data, API, Security, AI Safety, Development, Implementation Plan | YES |
| DEC-006 | APPROVED | Product / Compliance/Data Governance | Product/Compliance policy gate; clinical/AI lifecycle, deletion, export, backup, residency, release values | System, Architecture, Data, API, Security, AI Safety, Development, Implementation Plan | YES |
| DEC-007 | APPROVED | Product / Engineers B-D / Security / Architecture | Clinical files excluded from MVP; future file schema, API, storage, workers, and AI ingestion | System, Architecture, Data, API, Security, AI Safety, Development, Implementation Plan | YES |
| BLOCK-009 | APPROVED | API / Architecture | Affected list/search APIs | Architecture, Data, API, Security, AI Safety, Development, Implementation Plan | YES |
| BLOCK-010 | APPROVED | Product / Engineer C / Security/API | `NO_SHOW` transition and tests | Data, API, Security, Development, Implementation Plan | YES |
