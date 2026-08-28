# Decision Log

Canonical register for unresolved architectural and product decisions. This
document records the decision required for human approval; it does not itself
approve an option or modify any source-of-truth document.

## Decision Status

- `OPEN` — unresolved and awaiting an explicit decision.
- `PROPOSED` — an option has been proposed for review, but is not approved.
- `APPROVED` — explicitly approved by the responsible decision owner.
- `REJECTED` — explicitly rejected by the responsible decision owner.
- `SUPERSEDED` — replaced by a later approved decision.

All decisions in this initial register are `OPEN`.

## DEC-001 — Authentication, Session, MFA, and Tenant Context

**Status:**
APPROVED

**Blocking:**
YES

**Problem:**
The project requires authenticated access, membership-based tenant context,
authorization, session security, account recovery, lockout/rate limiting, and
MFA support or policy. The source documents do not select a specific
authentication provider, token/session format, MFA policy, recovery lifecycle, or final
authentication lifecycle. The implementation plan therefore correctly blocks
protected application endpoints until these decisions are approved.

**Already decided:**

- Protected APIs require an authenticated actor.
- A user must obtain tenant context through an explicit valid membership.
- Tenant context must be established and carried through application services.
- Authorization is enforced server-side and is required before sensitive
  resource access or mutation.
- Authentication and security events require appropriate audit/security signals.

**Still open:**

- Authentication provider.
- Session versus token strategy and exact lifecycle.
- MFA requirement, enrollment, challenge, recovery, and exception policy.
- Account recovery, revocation, expiry, and lockout behavior.
- Exact mechanism for establishing the active tenant context.

**Source Documents:**

- `docs/product/system-definition.md` — Authentication, authorization, and
  security requirements; Member A — Identity & Security; Open Decisions.
- `docs/architecture/architecture-decisions.md` — Identity/security and
  production architecture decisions.
- `docs/API-CONTRACTS.md` — Sections 4–6, authentication, tenant context, and
  authorization.
- `docs/SECURITY.md` — Sections 4–6, Identity Security, Authentication, and
  Authorization; Section 40, Open Security Decisions.
- `docs/DEVELOPMENT-CONTRACTS.md` — Sections 14 and 51, security development
  rules and open development decisions.
- `docs/IMPLEMENTATION-PLAN.md` — Sections 6, 13, 22, 24, and 36;
  `BLOCK-001`.

**Why This Matters:**
Without this decision, the team cannot safely implement identity, protected
API behavior, tenant context, authorization tests, IDOR tests, or any sensitive
Patient, Clinical, Appointment, or AI endpoint.

**Affected Components:**

- Identity, user, membership, tenant-context, session, and authorization
  services.
- All protected API endpoints.
- Audit/security event handling.
- Tenant-aware repositories, jobs, cache, and AI context/tool calls.
- Authentication, authorization, and tenant-isolation test suites.

**Options:**

Option A:

- Description: Select and integrate a project-approved external authentication
  provider.
- Advantages: Provider-managed identity lifecycle and reduced application
  ownership of credential flows.
- Disadvantages: Provider dependency, integration constraints, and unresolved
  provider-specific security/configuration choices.
- Consequences: Provider, session/token integration, MFA behavior, recovery,
  and tenant-context mapping must be documented and tested.

Option B:

- Description: Implement authentication lifecycle within the application using
  project-approved identity and session components.
- Advantages: Direct control over lifecycle and integration behavior.
- Disadvantages: Greater security, operational, recovery, and maintenance
  responsibility for the project.
- Consequences: The project must explicitly approve credential, session/token,
  MFA, recovery, revocation, lockout, and monitoring behavior.

**Recommendation:**
Use a provider-neutral application identity boundary around the selected
external provider. Provider-specific configuration, session/token details, MFA,
recovery, revocation, and tenant-context mapping remain implementation details
that must be defined consistently in the affected documents.

**Decision:**
Option A — External identity provider behind an application identity boundary.

**Rationale:**
Selected by Human / Project Owner to use an external identity provider while
keeping Viora domain services independent from provider-specific behavior.

**Decision Owner:**
Engineer A with Security/Architecture and project-owner approval.

**Approved by:**
Human / Project Owner

**Approved at:**
2026-08-28

**Affected Documents After Approval:**

- `docs/product/system-definition.md`
- `docs/architecture/architecture-decisions.md`
- `docs/API-CONTRACTS.md`
- `docs/SECURITY.md`
- `docs/AI-SAFETY.md`
- `docs/DEVELOPMENT-CONTRACTS.md`
- `docs/IMPLEMENTATION-PLAN.md`

### Authentication Specifics Follow-up

**Selected Option:**

Option A — Managed Enterprise OIDC Authentication Framework, using the
approved hybrid access-token plus rotating-refresh-token strategy.

**Approved Authentication Profile:**

Option A — Managed OIDC with a short-session profile. The managed provider
owns credential handling, MFA, key rotation, and standard recovery. The
application owns tenant context, roles, permissions, authorization, and
session revocation. Access tokens are short-lived and refresh sessions use
rotation with replay detection.

**Provider Target Profile:**

Option C — Managed CIAM provider profile, with Option A selected as the
Auth0-style managed CIAM target for MVP.
The application remains provider-neutral and must use standard OIDC/OAuth2,
OIDC discovery/JWKS, issuer plus external subject mapping, and normalized
`StandardIdentityContext`. No vendor-specific SDK or payload may enter domain
code or public API contracts.

The selected vendor profile is an architectural target, not permission to
couple domain code to a vendor SDK. The adapter must isolate vendor-specific
configuration, claims, webhooks, and errors.

**Approved Session and Recovery Profile:**

Option A — Balanced Short Session:

- access-token lifetime: 15 minutes;
- refresh-session absolute lifetime: 7 days;
- refresh-token rotation on every use;
- refresh-token replay detection revokes the complete token family;
- standard recovery is handled by the Managed CIAM provider;
- recovery exceptions require re-authentication or step-up MFA and audit;
- application-side revocation applies on logout, suspension, password change,
  and permission change.

**Rationale:**

Approved by Human / Project Owner after conflict review. A managed OIDC/OAuth2
provider handles credentials, MFA, and key rotation behind the
provider-neutral adapter. The application retains tenant context, roles,
permissions, session revocation, and authorization control. Access tokens are
short-lived and refresh tokens rotate with replay detection.

**Decision Owner:**

Engineer A with Security/Architecture and project-owner approval.

**Approval Status:**

APPROVED

**Approved Specifics:**

- OIDC/OAuth2 through a provider-neutral application adapter.
- No password or password hash in the application database.
- Standard authentication endpoints: login, callback, refresh, logout, and
  revoke.
- Protected APIs require `Authorization: Bearer <token>`.
- MFA is required for Staff, Admin, and privileged clinical operations.
- Application-side session revocation covers logout, suspension, password
  change, and permission change events.
- Provider claims are mapped into application identity and tenant context;
  provider payloads do not replace application authorization.
- OIDC adapter, JWT validation, claim mapping, and account-status webhook
  handling are implementation guardrails.
- Standard account recovery is provider-managed and returns through the
  application callback/handoff flow; the application does not handle
  passwords or recovery secrets.
- Recovery exceptions require re-authentication or step-up MFA, explicit
  application authorization, bounded scope, and immutable audit evidence.
- Recovery or insufficient-assurance sessions cannot invoke privileged AI
  tools or other privileged clinical operations.

**Approved by:**

Human / Project Owner

**Approved at:**

2026-08-28

### Knowledge Legal Hold Inheritance Follow-up

**Selected Option:**

Option A — Use canonical domain resources without introducing a new
`clinical_resources` table.

**Approved MVP Knowledge Resource Mapping:**

Option B — Knowledge documents may map explicitly to `patients` and
`medical_records` in MVP. Mapping must be typed and authorization-aware; no
generic polymorphic `clinical_resources` table is introduced. A document linked
to multiple resources is purgeable only when all applicable tenant, resource,
and document holds are clear. Knowledge without a clinical-resource link must
be explicitly classified as tenant-scoped or approved global knowledge.

**Approved Boundary:**

- Tenant-level hold is evaluated through `tenants`.
- Document-level hold is evaluated through `knowledge_documents`.
- Resource-level hold is supported only for explicitly approved canonical
  resources such as `patients` or `medical_records`.
- Purge is allowed only when no applicable tenant, resource, or document hold
  exists.
- Unknown or invalid resource mappings fail closed and are not purged.
- Cleanup continues for unrelated resources and records hold skips in the
  immutable shared `audit_events` boundary.

**Still Open:**

- Final schema/query implementation for inherited hold evaluation.

**Approval Status:**

APPROVED

**Approved by:**

Human / Project Owner

**Approved at:**

2026-08-28

**Still Open:**

- Final contract, region/residency, and service-level terms for the selected
  Auth0-style Managed CIAM provider.

**Affected Documents After Propagation:**

- `docs/product/system-definition.md`
- `docs/architecture/architecture-decisions.md`
- `docs/API-CONTRACTS.md`
- `docs/SECURITY.md`
- `docs/DEVELOPMENT-CONTRACTS.md`
- `docs/IMPLEMENTATION-PLAN.md`

## DEC-002 — STAFF, Nurse, and Receptionist Role Mapping

**Status:**
APPROVED

**Blocking:**
YES

**Problem:**
The product documents describe Nurse/Clinical Staff and Receptionist as user
types, while the Data Model and API/Security documents previously exposed
`STAFF` as a generic role. DEC-002 now establishes Nurse/Clinical Staff and
Receptionist as separate application roles; the final permission matrix and
resource-level authorization remain open.

**Already decided:**

- Nurse/Clinical Staff and Receptionist are separate application roles.
- Access must be least-privilege and permission-controlled.
- The final mapping must be reflected consistently in authorization behavior.

**Still open:**

- The exact permission matrix for each application role.
- The resulting endpoint and resource permissions.

**Source Documents:**

- `docs/product/system-definition.md` — user types and authorization model.
- `docs/DATA-MODEL.MD` — Section 7, Role Model.
- `docs/API-CONTRACTS.md` — Section 6, Authorization Model.
- `docs/SECURITY.md` — Section 6, Authorization.
- `docs/DEVELOPMENT-CONTRACTS.md` — Sections 5 and 30, ownership and
  authorization testing.
- `docs/IMPLEMENTATION-PLAN.md` — Sections 4, 6, 13, 24, and 36;
  `BLOCK-002`.

**Why This Matters:**
Endpoint authorization, permission checks, audit actor classification, IDOR
tests, and staff onboarding still depend on the final permission matrix even
though the role structure is now approved.

**Affected Components:**

- Membership role and permission model.
- Staff onboarding and identity APIs.
- Authorization policy and endpoint guards.
- Audit actor classification.
- Authorization and tenant-isolation tests.

**Options:**

Option A:

- Description: Treat Nurse/Clinical Staff and Receptionist as distinct
  application roles.
- Advantages: Explicit role names and direct policy readability.
- Disadvantages: More role definitions and possible role proliferation.
- Consequences: Role enums, membership APIs, permission matrices, and tests
  must expose and enforce the separate roles.

Option B:

- Description: Treat both user types as `STAFF` and differentiate access with
  permissions.
- Advantages: Preserves the current generic role while allowing least-
  privilege differentiation.
- Disadvantages: Permission policy becomes the primary source of distinction
  and must be made explicit.
- Consequences: Permission assignments, policy evaluation, onboarding, and
  tests must define the Nurse/Receptionist differences.

Option C:

- Description: Treat Nurse/Clinical Staff and Receptionist as subroles of
  `STAFF` with an explicit subtype representation.
- Advantages: Retains the generic role while preserving user-type identity.
- Disadvantages: Introduces an additional role/subrole model that is not yet
  defined by the source documents.
- Consequences: The subtype model, permission precedence, API representation,
  and migration behavior require explicit approval.

**Recommendation:**
The role structure is approved. The final permission matrix requires Product,
Security, and affected-owner review.

**Decision:**
Option A — Nurse/Clinical Staff and Receptionist are separate application roles.

**Rationale:**
Selected by Human / Project Owner to represent Nurse/Clinical Staff and
Receptionist as distinct application roles for explicit authorization and
least-privilege policy.

**Decision Owner:**
Product owner with Engineer A and affected domain owners.

**Approved by:**
Human / Project Owner

**Approved at:**
2026-08-28

**Affected Documents After Approval:**

- `docs/product/system-definition.md`
- `docs/DATA-MODEL.MD`
- `docs/API-CONTRACTS.md`
- `docs/SECURITY.md`
- `docs/DEVELOPMENT-CONTRACTS.md`
- `docs/IMPLEMENTATION-PLAN.md`

### Permission Matrix Follow-up

**Selected Option:**

Option A — endpoint-specific least privilege with default deny for any
operation not explicitly permitted.

**Rationale:**

Approved by Human / Project Owner after conflict review. Permissions remain
operation-specific and are evaluated together with tenant membership, resource
ownership, relationship, location, and clinical need-to-know. No permission is
inferred beyond the evidence in the source contracts.

**Decision Owner:**

Product owner with Engineer A, Security, Clinical, and affected domain owners.

**Approval Status:**

APPROVED

**Approved by:**

Human / Project Owner

**Approved at:**

2026-08-28

**Affected Documents After Propagation:**

- `docs/product/system-definition.md`
- `docs/DATA-MODEL.MD`
- `docs/API-CONTRACTS.md`
- `docs/SECURITY.md`
- `docs/DEVELOPMENT-CONTRACTS.md`
- `docs/IMPLEMENTATION-PLAN.md`

## DEC-003 — Canonical Clinical Lifecycle Status

**Status:**
APPROVED

**Blocking:**
YES

**Problem:**
The source documents previously used both `REVIEW` and `IN_REVIEW` for the
clinical intermediate state. DEC-003 now establishes `IN_REVIEW` as the
canonical state across Architecture, Data Model, API, Security, AI Safety, and
implementation contracts.

**Already decided:**

- Clinical content begins as a draft.
- Finalized clinical records are immutable.
- Amendments create a new version with reason/authorship rather than silently
  overwriting the finalized version.
- Review/finalization requires authorized human/application enforcement.

**Still open:**

- Exact transition names and API representations remain implementation details
  subject to the approved `IN_REVIEW` state.
- Whether AI draft review uses the same canonical state or a mapped lifecycle.

**Source Documents:**

- `docs/architecture/architecture-decisions.md` — Clinical data lifecycle and
  human review decisions.
- `docs/DATA-MODEL.MD` — Sections 20–22, clinical record versions,
  immutability, and status.
- `docs/API-CONTRACTS.md` — Clinical review/finalize/amendment operations.
- `docs/AI-SAFETY.md` — Sections 12–13 and 29, output classification and
  human approval.
- `docs/SECURITY.md` — Section 19, Clinical Record Integrity.
- `docs/IMPLEMENTATION-PLAN.md` — Sections 15, 19, 24, and 36;
  `BLOCK-003`.

**Why This Matters:**
The conflict affects database enums, API transitions, clinical record
immutability, AI draft approval, authorization, audit events, and integration
tests.

**Affected Components:**

- Clinical record and version status model.
- Clinical review, finalize, and amendment APIs.
- AI draft review and approval workflow.
- Authorization, audit, and clinical integrity tests.

**Options:**

Option A:

- Description: Adopt `REVIEW` as the canonical intermediate clinical status.
- Advantages: Matches the Architecture lifecycle wording.
- Disadvantages: Requires alignment with the current Data Model enum and any
  API/AI representations using `IN_REVIEW`.
- Consequences: Data Model, API, AI Safety, tests, and implementation plan
  must be synchronized.

Option B:

- Description: Adopt `IN_REVIEW` as the canonical intermediate clinical status.
- Advantages: Matches the current Data Model enum.
- Disadvantages: Requires alignment with the Architecture lifecycle wording.
- Consequences: Architecture, API, AI Safety, tests, and implementation plan
  must be synchronized.

**Recommendation:**
Use `IN_REVIEW` consistently and prohibit translation at individual domain
boundaries.

**Decision:**
Option B — `IN_REVIEW` is the canonical intermediate clinical status.

**Rationale:**
Selected by Human / Project Owner after conflict review. The selected value
matches the Data Model enum and is propagated as the canonical external and
internal clinical status.

**Decision Owner:**
Product owner with Engineer B and Architecture/AI Safety review.

**Approved by:**
Human / Project Owner

**Approved at:**
2026-08-28

**Affected Documents After Approval:**

- `docs/architecture/architecture-decisions.md`
- `docs/DATA-MODEL.MD`
- `docs/API-CONTRACTS.md`
- `docs/AI-SAFETY.md`
- `docs/SECURITY.md`
- `docs/DEVELOPMENT-CONTRACTS.md`
- `docs/IMPLEMENTATION-PLAN.md`

## DEC-004 — Appointment Concurrency and Retry Contract

**Status:**
APPROVED

**Blocking:**
YES

**Problem:**
The Data Model establishes a database direction using PostgreSQL concurrency
constraints for appointment scheduling and defines idempotency behavior for
retries. The Architecture, API, and Development Contracts require safe
mutation/retry behavior, but the public API semantics, conflict behavior, and
stale-update behavior are not fully selected. The database mechanism must be
kept separate from the public API contract.

**Already decided:**

- Appointment scheduling must prevent double booking.
- PostgreSQL is the transactional database direction.
- The Data Model points to an exclusion-constraint approach using
  `btree_gist`.
- Idempotency keys are tenant/actor scoped and the same key/payload must be
  replay-safe; a different payload for the same key must be rejected.
- Retry behavior must not create duplicate mutations.

**Still open:**

- Final public conflict and stale-update representation semantics.
- Public conflict response semantics; this log does not invent an HTTP status
  or concurrency header.
- Stale-update detection and rejection semantics.
- Exact interaction between transaction conflict, idempotency replay, and
  retry behavior for each mutation.

**Source Documents:**

- `docs/architecture/architecture-decisions.md` — reliability, idempotency,
  and concurrency decisions.
- `docs/DATA-MODEL.MD` — Sections 15–16, Appointment Concurrency and
  Idempotency; Section 53, migration order.
- `docs/API-CONTRACTS.md` — Sections 11 and 21, Appointment API and
  Concurrency; API-004.
- `docs/DEVELOPMENT-CONTRACTS.md` — Section 21, Concurrency.
- `docs/SECURITY.md` — API abuse, integrity, and idempotency controls.
- `docs/IMPLEMENTATION-PLAN.md` — Sections 11, 13, 17, 20, 22, 24, and 36;
  `BLOCK-004`.

**Why This Matters:**
Appointment creation, rescheduling, cancellation, availability, idempotency,
double-booking tests, and cross-domain workflow integration cannot be finalized
without a consistent contract.

**Affected Components:**

- Appointment write services and APIs.
- PostgreSQL appointment constraints and migrations.
- Shared idempotency contract and mutation handling.
- Availability and scheduling integration.
- Appointment, retry, concurrency, and reliability tests.

**Options:**

Option A:

- Description: Use the Data Model's PostgreSQL exclusion-constraint direction
  as the primary double-booking mechanism, with application-level handling of
  the resulting conflict.
- Advantages: Database-enforced protection at the transaction boundary.
- Disadvantages: Public conflict and stale-update semantics still need an
  explicit API decision.
- Consequences: Migration, transaction, error mapping, retry, and integration
  tests must be specified together.

Option B:

- Description: Use an application-level concurrency protocol around the
  appointment mutation while retaining database integrity protections.
- Advantages: More explicit application control over public mutation behavior.
- Disadvantages: More implementation complexity and a larger risk of gaps
  between application checks and database state.
- Consequences: The protocol, conflict behavior, stale-update behavior, and
  database fallback/invariant must be explicitly approved and tested.

**Recommendation:**
Retain the documented PostgreSQL exclusion-constraint direction together with
application transaction handling and tenant/actor-scoped idempotency. Public
conflict and stale-update semantics must be defined consistently in the
affected contracts.

**Decision:**
Option A — Database constraint plus application transaction handling.

**Rationale:**
Selected by Human / Project Owner to retain the documented PostgreSQL
double-booking protection, application scheduling transaction, and idempotency
flow.

**Decision Owner:**
Architecture with Engineers B/C and API owner review.

**Approved by:**
Human / Project Owner

**Approved at:**
2026-08-28

**Affected Documents After Approval:**

- `docs/architecture/architecture-decisions.md`
- `docs/DATA-MODEL.MD`
- `docs/API-CONTRACTS.md`
- `docs/SECURITY.md`
- `docs/DEVELOPMENT-CONTRACTS.md`
- `docs/IMPLEMENTATION-PLAN.md`

### Public Concurrency Semantics Follow-up

**Selected Option:**

Option C — OCC with monotonic `BIGINT` on canonical mutable resources and a
separate append-only/immutable version-history boundary.

**Rationale:**

Approved by Human / Project Owner after conflict review. Mutation requests use
strong `ETag`/`If-Match` semantics and validate the expected version at the API
boundary. PostgreSQL scheduling conflicts remain distinct from stale updates.
Authorization must run before version checks, and immutable clinical history
must not be updated in place.

**Approved Public Semantics:**

- `GET` resources expose an `ETag` based on the current version.
- `PUT`/`PATCH`/`DELETE` mutations require `If-Match`.
- Strong ETags have no `W/` prefix; resource JSON does not expose `version` by
  default.
- Stale version returns `412 Precondition Failed`.
- PostgreSQL exclusion-constraint conflict returns `409 Conflict`.
- AI mutations must use a current version and cannot bypass the same check.
- `BIGINT NOT NULL DEFAULT 1` applies to canonical mutable MVP resources,
  including `appointments`, `patients`, `medical_records`, and `ai_drafts`.
- `medical_record_versions` remains append-only/immutable and is excluded from
  the OCC update path; its record/version uniqueness is preserved separately.

**Decision Owner:**

Architecture with Engineers B/C, API, and Security review.

**Approval Status:**

APPROVED

**Approved by:**

Human / Project Owner

**Approved at:**

2026-08-28

**Still Open:**

None for the approved MVP mutation retry policy. Final provider-specific retry
limits and operational backoff values remain implementation/release details
where applicable.

### Mutation Retry Policy Follow-up

**Selected Option:**

Option D — Domain-specific hybrid retry policy.

**Approved Retry Rules:**

- Appointment reschedule/cancel and clinical amendment/approval mutations must
  not automatically retry after `412`; the client re-fetches and requires
  user confirmation against the current version.
- Patient/profile and tenant metadata mutations may retry at most once only
  when explicitly classified as idempotent and protected by the required
  tenant/actor-scoped idempotency key.
- AI write and approval operations must not automatically retry; they require
  human confirmation when the target version is stale.
- Any retry or re-fetch flow must re-run authentication, authorization, and
  tenant-isolation checks.
- `409 Conflict` scheduling failures are not converted into retries; the
  client must resolve the business conflict explicitly.

**Decision Status:**

APPROVED

**Approved by:**

Human / Project Owner

**Approved at:**

2026-08-28

### Idempotency TTL Follow-up

**Selected Option:**

Option C — Domain-specific TTL.

**Approved MVP Rules:**

- Synchronous appointment, patient/profile, tenant metadata, and similar
  retry-sensitive mutations use a bounded short replay window appropriate to
  the operation class.
- Outbox-backed asynchronous operations retain idempotency state until
  business completion plus an approved grace period.
- Cleanup is driven by `expires_at` and must not remove an in-flight or
  unresolved outbox-linked operation.
- A replay after expiry is treated as a new request and must pass current
  authentication, authorization, tenant, validation, and OCC checks.
- AI draft/approval idempotency cannot bypass human approval or stale-version
  handling.
- Exact numeric TTLs and grace periods are operational configuration to be
  finalized with the affected API/Operations owners.

**Decision Status:**

APPROVED

**Approved by:**

Human / Project Owner

**Approved at:**

2026-08-28

**Affected Documents After Propagation:**

- `docs/architecture/architecture-decisions.md`
- `docs/DATA-MODEL.MD`
- `docs/API-CONTRACTS.md`
- `docs/SECURITY.md`
- `docs/DEVELOPMENT-CONTRACTS.md`
- `docs/IMPLEMENTATION-PLAN.md`

## DEC-005 — AI Platform and Governance Boundary

**Status:**
APPROVED

**Blocking:**
YES

**Problem:**
The sources require AI to operate as a controlled, untrusted subsystem behind
an AI Tool Gateway. They do not select an AI provider, model, embedding model,
vector implementation details, retention/logging policy, knowledge ownership
model, global-versus-tenant knowledge behavior, or final tool authorization
policy.

**Already decided:**

- AI must not directly connect to the production database.
- AI operates through application-controlled, explicitly allowlisted tools.
- Tool calls require authorization, tenant/resource filtering, validation,
  auditability, bounded execution, and failure-safe behavior.
- Autonomous diagnosis, prescribing, and final clinical mutation are outside
  the allowed AI boundary.
- MVP direction prefers PostgreSQL plus a pgvector abstraction for RAG, without
  prescribing public vector implementation details.
- Clinical drafts require an authorized human approval flow.

**Still open — MVP-blocking:**

- AI provider and production integration boundary.
- Generative model and embedding model/dimension.
- AI conversation, prompt/context, draft, and provider logging retention.
- Knowledge-document ownership and global-versus-tenant scope.
- Tool permission model and actor/tenant context persistence.
- Exact AI rate/resource limits where required for safe operation.

**Post-MVP or conditionally scoped:**

- Broader AI autonomy.
- Autonomous clinical actions.
- Any tool or workflow not explicitly approved by the MVP boundary.
- Appointment creation through AI remains conditional on a separate product and
  workflow decision.

**Source Documents:**

- `docs/product/system-definition.md` — Sections 7–10, AI capabilities,
  restrictions, context/memory, and RAG.
- `docs/architecture/architecture-decisions.md` — AI Gateway, provider
  boundary, RAG, and AI data architecture.
- `docs/API-CONTRACTS.md` — Sections 14–15 and API-007.
- `docs/SECURITY.md` — Sections 15–18 and Open Security Decisions.
- `docs/AI-SAFETY.md` — Sections 5–10, 18–27, 29, and 37.
- `docs/DEVELOPMENT-CONTRACTS.md` — Sections 15–16 and 51.
- `docs/IMPLEMENTATION-PLAN.md` — Sections 16–19, 22, 24, and 36;
  `BLOCK-005`.

**Why This Matters:**
AI Gateway, context assembly, RAG, approved tools, retention controls, and AI
drafts cannot be implemented safely without the boundary and governance
decisions.

**Affected Components:**

- AI Gateway and provider adapter boundary.
- Context assembly, memory, and conversation persistence.
- Embedding/RAG abstraction and knowledge-document lifecycle.
- Tool authorization, validation, rate/resource control, and audit.
- AI draft workflow and AI safety tests.

**Options:**

Option A:

- Description: Select an externally hosted AI provider behind the project AI
  Gateway.
- Advantages: Provider service can supply model execution without the project
  operating the model runtime.
- Disadvantages: Provider logging, retention, availability, residency, and
  data-processing behavior require explicit review.
- Consequences: Provider, model, contract, failure, privacy, retention, and
  security controls must be approved.

Option B:

- Description: Operate or integrate a project-controlled model runtime behind
  the AI Gateway.
- Advantages: Greater control over runtime and data boundary.
- Disadvantages: Greater infrastructure, model operations, capacity, and
  maintenance responsibility.
- Consequences: Runtime, model, embedding, storage, monitoring, retention,
  failure, and safety controls must be approved.

**Recommendation:**
Requires project-owner/architecture decision.

**Decision:**
Option B — operate or integrate a project-controlled AI runtime behind the
AI Gateway. For the selected Dify direction, Dify is self-hosted and remains
behind the project AI Gateway and application-controlled Tool Gateway.

**Rationale:**
Selected by Human / Project Owner. Self-hosting provides project control over
the AI platform boundary, while model/provider, embedding, retention,
knowledge governance, rate limits, and tool authorization remain explicit
follow-up requirements.

**Approved by:**
Human / Project Owner

**Approved at:**
2026-08-28

**Decision Owner:**
Product owner with Engineer D, Architecture, Security, and affected domain
owners.

### AI Governance Values Follow-up

**Selected Option:**

Option B — Controlled External Model Provider Integration Framework, within
the approved Controlled & Guarded AI Infrastructure Framework.

**Approved Boundary:**

- Self-hosted Dify behind the AI Gateway and Tool Gateway.
- External LLM/Embedding Providers are accessed only through controlled AI
  Gateway adapters; provider details remain hidden from public API contracts.
- Read, summarization, and draft-first capabilities only.
- Write tools are default-deny and no autonomous clinical mutation is allowed.
- Knowledge is tenant-scoped by default.
- Sensitive AI/runtime/provider/retrieval failures fail closed while core
  application workflows degrade safely.
- AI audit captures operation metadata; raw prompt/response content is
  minimized and redacted according to the approved data policy, without a
  blanket requirement to retain 100% of raw content.

**Approved MVP Model/Provider Profile:**

Option A — Managed External LLM plus Managed Embedding. Dify remains
self-hosted, and all external model/embedding calls pass through controlled
AI Gateway adapters. Public API and domain code remain provider-neutral.

**Approved Model Strategy:**

Option A — Single Primary Model Pair. MVP uses one primary managed
generative model and one primary managed embedding model, with no automatic
fallback. Model/version changes require compatibility review; embedding
dimension changes require a migration or re-embedding plan.

**Approved Model Selection Rule:**

Option A — the exact primary generative model and exact primary embedding
model/dimension must be selected and pinned before RAG vector schema or
production AI execution is finalized. Model/version changes require
compatibility evaluation; embedding-dimension changes require migration or
re-embedding. No automatic fallback is permitted in MVP.

**Approved MVP Model Pair:**

- Generative model: `gpt-4o-2024-08-06`.
- Embedding model: `text-embedding-3-small`.
- Embedding dimension: `1536`.
- Model versions are pinned; no automatic fallback is permitted in MVP.
- Model changes require compatibility evaluation. Embedding-dimension changes
  require an approved migration or re-embedding plan.

**Approved AI Data Lifecycle Profile:**

Option A — Minimum-Necessary, Category-Specific Lifecycle. AI conversations,
drafts, embeddings, knowledge data, provider metadata, and audit metadata are
governed by category-specific policy. Raw prompt/response content is not
retained by default; any retained content must be minimum-necessary and
redacted. Clinical history remains immutable, and export/deletion use
authorized workflows.

**Approved Canonical Retention Baseline:**

Option A —

- `ai_conversations` and `ai_messages`: expire 30 days after
  `last_message_at`; soft-delete at expiry and hard-purge in the next daily
  cleanup cycle, with maximum cleanup lag of 24 hours.
- `ai_drafts`: expire after 7 days if not approved, or purge content after
  approval only after approval metadata is recorded in `audit_events` and no
  applicable Legal Hold exists.
- Raw prompt/context content: 0-day default retention.
- AI operational/audit metadata: 90-day retention where applicable under the
  approved policy boundary.
- Knowledge embeddings: lifecycle synchronized with the source document;
  purge is hold-aware across tenant, supported canonical resource, and
  document scopes.
- Cleanup runs daily at 02:00; Legal Hold is skip-scoped and does not stop
  unrelated cleanup.
- Deletion evidence and approval metadata are immutable records in
  `audit_events` and are not removed by AI cleanup.
- Provider ZDR and No-Training remain an external production-release gate
  requiring the approved provider contract.

**Rationale:**

Approved by Human / Project Owner after conflict review. The adjusted boundary
preserves the guarded MVP AI profile while remaining consistent with PHI
minimization, redaction, and the Product/Compliance-owned retention policy.

**Decision Owner:**

Product owner with Engineer D, Architecture, Security, AI Safety, and affected
domain owners.

**Approval Status:**

APPROVED

**Approved by:**

Human / Project Owner

**Approved at:**

2026-08-28

**Still Open:**

- Remaining AI evaluation evidence and operational measurement details.
- Final compliance/legal confirmation and provider-contract evidence for the
  approved retention baseline.
- Provider/runtime evidence and final production release controls.

### AI Tool and Runtime Governance Follow-up

**Selected Option:**

Option D — Guarded baseline: tenant-only knowledge, capability classes, and
bounded quotas.

**Approved MVP Governance Rules:**

- MVP knowledge is tenant-scoped only; global knowledge is deferred until a
  separate Product/Security approval.
- Tool permissions use explicit capability classes: Read, Summarize, Draft,
  and Human-approved Action. The model cannot grant or elevate capabilities.
- AI actor identity, tenant scope, tool class, and policy version are carried
  through the Gateway and recorded through the approved audit boundary.
- Tool Gateway enforces bounded context size, per-tool call limits, tenant and
  actor quotas, and cost controls. Exact production numeric values remain
  operational/release configuration.
- Missing identity, tenant context, capability, or provider safety evidence
  fails closed. Autonomous clinical mutation remains prohibited.

**Decision Status:**

APPROVED

**Approved by:**

Human / Project Owner

**Approved at:**

2026-08-28

### AI Clinical Escalation Follow-up

**Selected Option:**

Option C — Risk-tiered clinical escalation policy.

**Approved MVP Escalation Rules:**

- Low-risk, authorized requests may receive bounded AI assistance within the
  approved tenant and capability scope.
- Medium-risk requests may produce advisory content or a draft only, with
  explicit uncertainty information and human review.
- High-risk, emergency, ambiguous, or materially conflicting requests must
  abstain, return a safe deferral, and route to an authorized clinician.
- No risk tier may bypass authorization, tenant isolation, human approval,
  clinical immutability, or the AI Tool Gateway.
- Risk tier, uncertainty reason, escalation status, and accountable actor are
  included in the applicable audit/provenance record.

**Decision Status:**

APPROVED

**Approved by:**

Human / Project Owner

**Approved at:**

2026-08-28

### AI Human Approval Workflow Follow-up

**Selected Option:**

Option C — Single-author workflow with step-up approval.

**Approved MVP Approval Rules:**

- An authorized clinician may review, edit, and approve a draft within the
  permitted tenant/resource scope.
- Approval is an explicit application action and requires step-up MFA for the
  privileged clinical operation.
- Approval must validate the current strong `If-Match`/OCC version and rerun
  authentication, authorization, tenant, business, and draft-state checks.
- A stale or changed draft cannot be approved; it returns to review after the
  client re-fetches the current state.
- Reject, edit, resubmit, review, and approval transitions are audited with
  actor, timestamps, draft/resource reference, version, and provenance.
- AI actors cannot review, approve, finalize, or bypass the application
  approval workflow.

**Decision Status:**

APPROVED

**Approved by:**

Human / Project Owner

**Approved at:**

2026-08-28

### AI Evaluation Gate Follow-up

**Selected Option:**

Option A — Strict Clinical Safety Gate.

**Approved Boundary:**

- AI safety evaluation is a blocking gate before AI MVP release.
- Golden Dataset must be versioned and managed in an approved environment.
- PII redaction must reach 100% for classified sensitive fields.
- Faithfulness/hallucination thresholds require Clinical/Security approval.
- Model changes require the AI safety regression suite before rollout.
- Latency is tracked as a separate operational/release gate unless explicit
  performance thresholds are approved.

The approved evaluation profile is a strict clinical threshold gate. The
Golden Dataset is jointly owned by Clinical and AI, versioned, and managed in
an approved environment without real PHI outside approved controls. Safety
evaluation failure blocks AI MVP release; exact numeric quality and latency
thresholds remain separate decisions.

**Still Open:**

- Golden Dataset owner, composition, and versioning procedure.
- Exact latency targets and measurement scope.
- Provider no-training, retention, and evaluation evidence requirements.

### AI Evaluation Thresholds Follow-up

**Selected Option:**

Option C — Quality Thresholds Strict, Latency TBD.

**Approved Numeric Evaluation Baseline:**

- Context recall and precision must be at least 85% on the approved Golden
  Dataset.
- Faithfulness/hallucination failure rate must be below 2% on the approved
  Golden Dataset.
- PII redaction for classified sensitive fields must be 100%.
- Latency targets remain TBD and are monitored as observability/operational
  measurements, not as a numeric AI safety threshold under this decision.

**Decision Status:**

APPROVED

**Approved by:**

Human / Project Owner

**Approved at:**

2026-08-28

**Approval Status:**

APPROVED

**Approved by:**

Human / Project Owner

**Approved at:**

2026-08-28

**Affected Documents After Propagation:**

- `docs/product/system-definition.md`
- `docs/architecture/architecture-decisions.md`
- `docs/DATA-MODEL.MD`
- `docs/API-CONTRACTS.md`
- `docs/SECURITY.md`
- `docs/AI-SAFETY.md`
- `docs/DEVELOPMENT-CONTRACTS.md`
- `docs/IMPLEMENTATION-PLAN.md`

**Affected Documents After Approval:**

- `docs/product/system-definition.md`
- `docs/architecture/architecture-decisions.md`
- `docs/API-CONTRACTS.md`
- `docs/SECURITY.md`
- `docs/AI-SAFETY.md`
- `docs/DEVELOPMENT-CONTRACTS.md`
- `docs/IMPLEMENTATION-PLAN.md`

### DEV-005 Migration Workflow Follow-up

**Selected Option:**

Option C — Hybrid migration strategy based on migration risk.

**Approved MVP Migration Rules:**

- Small, additive, low-lock changes may use transactional migrations.
- Breaking, large-table, high-lock, index-heavy, or vector changes must use
  expand/contract sequencing with compatibility windows.
- Every migration requires preflight checks, affected-owner review, dependency
  ordering, verification, and a documented rollback or forward-fix plan.
- Vector dimension/model changes require the approved migration and/or
  re-embedding plan before rollout.
- CI and deployment gates must validate migration ordering, compatibility and
  failure behavior; backup restore is not the default rollback mechanism.

**Decision Status:**

APPROVED

**Approved by:**

Human / Project Owner

**Approved at:**

2026-08-28

### DEV-001 Nx Project Graph Follow-up

**Selected Option:**

Option C — Hybrid modular backend with an isolated AI Gateway/Tool Gateway.

**Approved MVP Boundary:**

- Core Identity/Tenant, Patient, Doctor/Appointment, and Clinical capabilities
  remain in a modular backend with domain-owned application services.
- AI Gateway and Tool Gateway are isolated Nx applications/boundaries and are
  the only AI-to-application capability path.
- Shared Platform contains only approved primitives such as authentication
  context, tenant context, audit, database, idempotency, and outbox contracts.
- Domain libraries must not import another domain's private internals; cross-
  domain access uses public application contracts.
- Nx tags/constraints must enforce dependency direction and ownership. Exact
  repository folder names remain an implementation detail within this boundary.

**Decision Status:**

APPROVED

**Approved by:**

Human / Project Owner

**Approved at:**

2026-08-28

### BLOCK-006 Secrets and Encryption Follow-up

**Selected Option:**

Option D — Hybrid managed baseline.

**Approved MVP Security Boundary:**

- Managed Secrets Manager and managed KMS protect infrastructure and service
  secrets; secrets are delivered through workload identity/runtime injection.
- Provider credentials are isolated to the relevant Gateway/adapter boundary
  and never enter source code, business tables, public APIs, or logs.
- All supported data stores and service connections require encryption at rest
  and in transit.
- Field-level/envelope encryption is applied selectively to classified PHI;
  encrypted fields carry key-version metadata and support rotation without
  breaking reads or migrations.
- Key rotation, revocation, access audit, and compromise response are owned by
  Security/Operations. Exact cloud vendor and production topology remain
  release/infrastructure details.

**Decision Status:**

APPROVED

**Approved by:**

Human / Project Owner

**Approved at:**

2026-08-28

## DEC-006 — Clinical Data Governance, Retention, Deletion, and Residency

**Status:**
APPROVED

**Blocking:**
YES

**Problem:**
The source documents require explicit lifecycle behavior for PHI, clinical
records, audit events, backups, exports, AI conversations, drafts, prompts,
context, and knowledge data. They do not establish the applicable regulatory
requirements, retention periods, residency constraints, deletion/anonymization
rules, or final backup/audit/AI retention policy. This log does not infer legal
requirements.

**Already decided:**

- Clinical data is highly sensitive and must be access-controlled and
  minimized.
- Finalized clinical records are immutable and amendments preserve history.
- Auditability, backups, restore behavior, deletion/retention handling, and
  data export require explicit controls.
- AI data must follow authorization, minimization, retention, deletion, and
  audit policies once those policies are defined.
- No compliance certification or unestablished legal requirement is claimed.

**Still open:**

- PHI and clinical-record retention periods.
- Audit-event retention.
- AI conversation, prompt/context, draft, embedding, and provider-log
  retention.
- Deletion, anonymization, soft-delete, cascade, and amendment behavior.
- Data residency requirements.
- Backup retention and deletion behavior.
- Applicable regulatory/compliance requirements and the responsible approving
  authority.

**Source Documents:**

- `docs/product/system-definition.md` — data classification, security,
  storage, backup/disaster recovery, and Open Decisions.
- `docs/architecture/architecture-decisions.md` — data lifecycle, backup,
  recovery, retention, residency, and RPO/RTO decisions.
- `docs/DATA-MODEL.MD` — Sections 41–43, 51, 57–61, 64, and 67, deletion,
  retention, classification, access policy, and Open Decisions.
- `docs/API-CONTRACTS.md` — API-007 and API-010, AI/data governance and
  compliance/residency/retention.
- `docs/SECURITY.md` — Sections 8, 17, 29, 32–33, and 40.
- `docs/AI-SAFETY.md` — Sections 19–20, 24–25, and 37.
- `docs/IMPLEMENTATION-PLAN.md` — Sections 29, 33–37; `BLOCK-006` and
  `BLOCK-007`.

**Why This Matters:**
Retention and deletion behavior affects schema semantics, exports, backups,
storage, audit, AI memory, provider configuration, tenant isolation, and the
production release gate.

**Affected Components:**

- Clinical and patient data lifecycle services.
- Audit, export, backup, restore, and deletion workflows.
- AI conversation, draft, prompt/context, embedding, and knowledge storage.
- Object storage and database retention controls.
- Security, compliance, and production-readiness evidence.

**Options:**

Option A:

- Description: Product/compliance owner defines and approves the required
  retention, deletion, anonymization, residency, and backup policies.
- Advantages: Creates an explicit project policy without assuming legal rules.
- Disadvantages: Requires owner input and may introduce implementation
  constraints or unresolved external dependencies.
- Consequences: All affected schemas, APIs, storage, jobs, backups, AI
  controls, and tests must follow the approved policy.

Option B:

- Description: Defer policy-dependent capabilities and restrict implementation
  to controls that do not require an unapproved retention or residency choice.
- Advantages: Avoids inventing regulatory requirements or irreversible data
  behavior.
- Disadvantages: Prevents production release and may reduce MVP capability
  until governance is approved.
- Consequences: The release gate remains blocked for any capability whose
  lifecycle policy is not approved.

**Recommendation:**
Requires project-owner/compliance decision; no regulatory requirement is
assumed by this log.

**Decision:**
Option A — Product/compliance owner defines and approves the required
retention, deletion, anonymization, residency, audit, AI, and backup policies.

**Rationale:**
Selected by Human / Project Owner. The project must not infer regulatory
requirements or implement irreversible lifecycle behavior without an explicit
approved policy.

**Approved by:**
Human / Project Owner

**Approved at:**
2026-08-28

**Decision Owner:**
Product owner and compliance/data-governance owner; the responsible compliance
role is not otherwise specified by the source documents.

**Affected Documents After Approval:**

- `docs/product/system-definition.md`
- `docs/architecture/architecture-decisions.md`
- `docs/DATA-MODEL.MD`
- `docs/API-CONTRACTS.md`
- `docs/SECURITY.md`
- `docs/AI-SAFETY.md`
- `docs/DEVELOPMENT-CONTRACTS.md`
- `docs/IMPLEMENTATION-PLAN.md`

### Data Governance Values Follow-up

**Selected Option:**

Option A — Data Minimization & Category-Specific Lifecycle Framework at the
architectural-boundary scope.

**Approved Boundary:**

- Clinical records and history remain immutable and cannot be deleted
  arbitrarily.
- Operational and AI data lifecycle is category-specific and policy-gated.
- Export and deletion occur only through authorized workflows.
- AI audit metadata is recorded through the shared `audit_events` boundary;
  raw prompt/response content is not retained by default.
- Minimum-necessary and redaction controls apply across Application, Database,
  Backup, and AI boundaries.

**Rationale:**

Approved by Human / Project Owner after conflict review. The architectural
boundary preserves data minimization without inventing retention durations,
regulatory obligations, schema fields, cleanup schedules, or legal-hold rules.

**Decision Owner:**

Product owner and Compliance/Data Governance owner with Architecture,
Security, and affected domain review.

**Approval Status:**

APPROVED

**Approved by:**

Human / Project Owner

**Approved at:**

2026-08-28

**Still Open:**

- Category-specific retention and deletion values.
- Residency and legal/compliance scope.
- Backup retention/deletion and restore handling.
- Legal-hold authority and implementation.
- Lifecycle schema metadata, cleanup schedule, deletion evidence, and
  idempotency-key retention.

**Affected Documents After Propagation:**

- `docs/product/system-definition.md`
- `docs/architecture/architecture-decisions.md`
- `docs/DATA-MODEL.MD`
- `docs/API-CONTRACTS.md`
- `docs/SECURITY.md`
- `docs/AI-SAFETY.md`
- `docs/DEVELOPMENT-CONTRACTS.md`
- `docs/IMPLEMENTATION-PLAN.md`

### BLOCK-007 MVP Data-Governance Scope Follow-up

**Selected Option:**

Option B — Approve an MVP-scoped governance baseline.

**Approved MVP Governance Boundary:**

- Product/Compliance/Security policy ownership and approval remain mandatory;
  no regulatory retention period is inferred.
- MVP implementation may proceed for approved clinical, patient, audit, and AI
  lifecycle controls only where the applicable boundary is explicit.
- Clinical records remain immutable; deletion, anonymization, export, and
  Legal Hold operations use authorized workflows and preserve audit evidence.
- The approved AI retention baseline remains in force for AI conversations,
  drafts, metadata, and knowledge embeddings.
- Policy-dependent capabilities without an approved MVP boundary remain
  deferred and must not be exposed through public APIs.
- Clinical/PHI retention values, audit retention, residency, export scope,
  deletion/anonymization details, backup retention, and compliance evidence
  remain production-release dependencies.

**Decision Status:**

APPROVED

**Approved by:**

Human / Project Owner

**Approved at:**

2026-08-28

## DEC-007 — Clinical Files MVP Scope and Boundary

**Status:**
APPROVED

**Blocking:**
YES

**Problem:**
The Data Model defines `clinical_files` and documents file security/lifecycle
concerns. The API contract marks the File API Post-MVP, and the implementation
plan keeps file work outside the MVP critical path. DEC-007 explicitly approves
that boundary.

**Already decided:**

- Files must remain private and backend-authorized.
- File access requires tenant/resource authorization and audit/security
  controls.
- The current implementation plan does not schedule file features before MVP
  completion.
- Clinical file APIs are documented as Post-MVP under the approved scope.

**Still open:**

- Whether `clinical_files` is part of MVP.
- If MVP, supported file types, upload/download/reference behavior, size and
  content constraints, and clinical association scope.
- File lifecycle, retention, deletion, and amendment behavior.
- Authorization, malware/content validation, audit, and storage boundary.
- Whether AI may ingest or retrieve clinical files in MVP.

**Source Documents:**

- `docs/product/system-definition.md` — storage, data classification, AI
  context/RAG, and open scope decisions.
- `docs/architecture/architecture-decisions.md` — object storage, private
  access, async document processing, and security boundaries.
- `docs/DATA-MODEL.MD` — Sections 26–27, Section 46 ownership, Section 51
  retention, and Section 67 Open Decisions.
- `docs/API-CONTRACTS.md` — Section 17, File API — POST-MVP.
- `docs/SECURITY.md` — Sections 14, 28, and file/object-storage security.
- `docs/AI-SAFETY.md` — Sections 18–20, 25, and 37; document/RAG safety and
  open file scope.
- `docs/DEVELOPMENT-CONTRACTS.md` — Sections 25 and 43, file handling and
  ownership.
- `docs/IMPLEMENTATION-PLAN.md` — Sections 13, 20, 34, and 38;
  `BLOCK-007`.

**Why This Matters:**
File scope changes storage, upload security, scanning/validation, lifecycle,
retention, authorization, asynchronous processing, API surface, and possible
AI/RAG exposure.

**Affected Components:**

- `clinical_files` schema and migration scope.
- Object-storage boundary and private file access.
- File APIs, validation, authorization, and audit.
- Document processing workers.
- AI/RAG ingestion and retrieval, if explicitly approved.
- File security and lifecycle tests.

**Options:**

Option A:

- Description: Keep clinical files Post-MVP and exclude file APIs and AI file
  ingestion from MVP.
- Advantages: Preserves the current documented MVP boundary and reduces attack
  surface.
- Disadvantages: File-dependent workflows are unavailable in MVP.
- Consequences: File schema/API/worker work remains deferred and the existing
  Post-MVP boundary must remain synchronized.

Option B:

- Description: Include a deliberately bounded clinical-file capability in MVP.
- Advantages: Supports explicitly selected file-dependent product workflows.
- Disadvantages: Adds storage, upload, content-security, lifecycle, retention,
  authorization, and testing scope.
- Consequences: Product must define the file contract and all affected source
  documents must be updated before implementation.

**Recommendation:**
Requires project-owner/product decision.

**Decision:**
Option A — defer all Clinical File capabilities to Post-MVP. MVP is limited
to textual and structured data; file schema, endpoints, storage, workers,
parsing/scanning, and AI file ingestion are excluded from MVP.

**Rationale:**
Selected by Human / Project Owner. This preserves MVP focus, reduces attack
surface and infrastructure scope, and avoids introducing file lifecycle or
multimodal/RAG behavior before its controls are defined.

**Approved by:**
Human / Project Owner

**Approved at:**
2026-08-28

**Decision Owner:**
Product owner with Engineers B/D, Security, and Architecture review.

**Affected Documents After Approval:**

- `docs/product/system-definition.md`
- `docs/architecture/architecture-decisions.md`
- `docs/DATA-MODEL.MD`
- `docs/API-CONTRACTS.md`
- `docs/SECURITY.md`
- `docs/AI-SAFETY.md`
- `docs/DEVELOPMENT-CONTRACTS.md`
- `docs/IMPLEMENTATION-PLAN.md`

## BLOCK-009 — Uniform Opaque Cursor with Server-Enforced Governance

**Status:**
APPROVED

**Blocking:**
YES

**Decision:**
Option C — Uniform Opaque Cursor with Server-Enforced Governance (Hybrid
Standard).

**Rationale:**
Selected by Human / Project Owner. All collection APIs use one opaque cursor
contract with server-enforced bounds, deterministic tie-breaking, and a
centralized validation utility.

**Approved Contract:**

- Query parameters: `cursor` (string, optional) and `limit` (integer, optional).
- `default_size = 20`.
- `max_size = 100`.
- Response fields: `next_cursor` (opaque string or null) and `has_more`.
- Invalid cursor: HTTP `400` with `INVALID_PAGINATION_CURSOR`.
- Stable ordering uses the endpoint's approved keyset and deterministic unique
  tie-breaker, such as `created_at DESC, id DESC` where applicable.
- Cursor encoding is Base64URL/JSON. HMAC signing may provide integrity and
  authenticity; it is not encryption. Tenant binding is server-validated and
  never grants authorization by itself.
- Cursor versioning/backward compatibility must be handled by the server.

**Decision Owner:**
API/Architecture owner.

**Approved by:**
Human / Project Owner

**Approved at:**
2026-08-28

**Affected Documents After Approval:**

- `docs/architecture/architecture-decisions.md`
- `docs/DATA-MODEL.MD`
- `docs/API-CONTRACTS.md`
- `docs/SECURITY.md`
- `docs/AI-SAFETY.md`
- `docs/DEVELOPMENT-CONTRACTS.md`
- `docs/IMPLEMENTATION-PLAN.md`

## BLOCK-010 — Appointment `NO_SHOW` Authority

**Status:**
APPROVED

**Blocking:**
YES

**Decision:**
Option A — expose `NO_SHOW` as an explicit application transition command,
governed by an approved role/permission policy.

**Rationale:**
Selected by Human / Project Owner. An explicit transition boundary makes
authority, validation, idempotency, audit, and negative-test behavior visible.
The responsible role/permission and final command/error details remain part of
the propagation work and must not be inferred by implementation.

**AI Boundary:**
AI cannot invoke the transition unless separately approved as a bounded,
authorized tool through the AI Tool Gateway.

**Decision Owner:**
Product owner with Engineer C and Security/API review.

**Approved by:**
Human / Project Owner

**Approved at:**
2026-08-28

**Affected Documents After Approval:**

- `docs/DATA-MODEL.MD`
- `docs/API-CONTRACTS.md`
- `docs/SECURITY.md`
- `docs/DEVELOPMENT-CONTRACTS.md`
- `docs/AI-SAFETY.md` (tool boundary review)
- `docs/IMPLEMENTATION-PLAN.md`

# Decision → Document Impact Matrix

| Decision | System Definition | Architecture | Data Model | API Contract | Security | AI Safety | Development Contracts | Implementation Plan |
|---|---|---|---|---|---|---|---|---|
| DEC-001 Authentication | UPDATE | UPDATE | REVIEW | UPDATE | UPDATE | REVIEW | UPDATE | UPDATE |
| DEC-002 Role mapping | UPDATE | REVIEW | UPDATE | UPDATE | UPDATE | REVIEW | UPDATE | UPDATE |
| DEC-003 Clinical lifecycle | REVIEW | UPDATE | UPDATE | UPDATE | REVIEW | UPDATE | UPDATE | UPDATE |
| DEC-004 Appointment concurrency | REVIEW | UPDATE | REVIEW | UPDATE | REVIEW | REVIEW | UPDATE | UPDATE |
| BLOCK-009 Pagination | REVIEW | UPDATE | REVIEW | UPDATE | UPDATE | UPDATE | UPDATE | UPDATE |
| BLOCK-010 NO_SHOW authority | UPDATE | UPDATE | UPDATE | UPDATE | REVIEW | REVIEW | UPDATE | UPDATE |
| DEC-005 AI platform/governance | UPDATE | UPDATE | REVIEW | UPDATE | UPDATE | UPDATE | UPDATE | UPDATE |
| DEC-006 Data governance | UPDATE | UPDATE | UPDATE | UPDATE | UPDATE | UPDATE | REVIEW | UPDATE |
| DEC-007 Clinical files | UPDATE | UPDATE | UPDATE | UPDATE | UPDATE | UPDATE | UPDATE | UPDATE |
| BLOCK-011 Production policy boundary | REVIEW | UPDATE | REVIEW | REVIEW | UPDATE | REVIEW | UPDATE | UPDATE |

`UPDATE` means the approved decision must be reflected in that document.
`REVIEW` means the document may require consistency review, but no direct
change is assumed until the approved decision establishes a conflict or new
requirement. `NO CHANGE` is not used where approval can affect the document's
contract, scope, or traceability.

# Blocking Matrix

| Blocker | Blocks | Does NOT Block | Status |
|---|---|---|---|
| DEC-001 / BLOCK-001 Authentication | Protected endpoints, identity implementation, tenant context, authorization, sensitive domain work, AI access | Phase 0 review, decision preparation, non-sensitive documentation | RESOLVED FOR IMPLEMENTATION; PROVIDER RELEASE TERMS OPEN |
| DEC-002 / BLOCK-002 Role mapping | Endpoint-specific least-privilege matrix, staff onboarding authorization, role-specific endpoint tests | Phase 0 review and role-decision preparation | RESOLVED |
| DEC-003 / BLOCK-003 Clinical lifecycle | Clinical review/finalize/amendment contract, AI draft approval integration, clinical integrity tests using `IN_REVIEW` | Phase 0 review and non-status clinical preparation | RESOLVED |
| DEC-004 / BLOCK-004 Appointment concurrency | Appointment mutations, double-booking/retry behavior, final public concurrency tests | Phase 0 review and non-sensitive contract preparation | RESOLVED FOR IMPLEMENTATION |
| BLOCK-009 Pagination | Affected collection/list/search APIs, bounded queries, and pagination tests | Phase 0 review and decision documentation | RESOLVED |
| BLOCK-010 NO_SHOW authority | Explicit NO_SHOW command, transition authorization, audit, and negative tests | Phase 0 review and non-sensitive appointment preparation | RESOLVED |
| DEC-005 / BLOCK-005 AI platform/governance | Self-hosted Dify, approved model/embedding, RAG, retention, tenant-only knowledge, capability classes and bounded controls are approved; provider evidence and release values remain open | Phase 0 review and provider-neutral boundary preparation | RESOLVED FOR IMPLEMENTATION; RELEASE TERMS OPEN |
| DEC-006 / BLOCK-006/007 Data governance | Product/Compliance ownership and MVP-scoped governance boundary are approved; clinical policy values and production-release evidence remain open | Phase 0 review and policy-decision preparation | RESOLVED FOR IMPLEMENTATION; RELEASE TERMS OPEN |
| DEC-007 / BLOCK-008 Clinical files | Clinical files are approved out of MVP; file schema/API/storage/worker implementation and AI file ingestion are deferred | MVP work that does not depend on files, Phase 0 review | RESOLVED |

None of these decisions blocks Phase 0 review, documentation, decision packets,
or other explicitly non-sensitive preparation. Several decisions block only a
specific domain or release gate rather than every form of project work.

# Recommended Decision Order

1. **DEC-001 — Authentication, Session, MFA, and Tenant Context.** Identity
   and tenant context are prerequisites for authorization and all protected
   domain work.
2. **DEC-002 — STAFF, Nurse, and Receptionist Role Mapping.** The role
   structure is approved; final permission semantics depend on the
   identity/membership foundation.
3. **DEC-006 — Clinical Data Governance, Retention, Deletion, and Residency.**
   Governance affects the lifecycle and safe boundaries of clinical and AI
   data; it should be established before selecting dependent storage/provider
   behavior.
4. **DEC-003 — Canonical Clinical Lifecycle Status.** Clinical and AI approval
   workflows require one shared status representation.
5. **DEC-004 — Appointment Concurrency and Retry Contract.** The API contract
   should be finalized after the identity, authorization, and shared
   idempotency context are known, while preserving the existing database
   direction unless explicitly changed.
6. **DEC-007 — Clinical Files MVP Scope and Boundary.** Scope should be decided
   before file schema, storage, API, worker, or AI-ingestion work is scheduled.
7. **DEC-005 — AI Platform and Governance Boundary.** The final AI platform,
   provider, model, RAG, retention, and tool authorization decision should use
   the approved identity, data-governance, clinical-lifecycle, and scope
   boundaries.

The order is dependency-oriented, not an automatic approval sequence. Each
decision remains `OPEN` until explicitly approved by its decision owner.

# Production Policy Decision

**Decision ID:** BLOCK-011

**Status:** APPROVED — propagated

**Decision:**

Option C — split implementation guardrails from production release values.

**Approved implementation guardrails:**

- environment and secret isolation;
- migration deployment and rollback contract;
- failure-safe behavior for dependency/provider failures;
- test and observability interfaces;
- explicit ownership for operational dependencies.

**Production release values still open:**

- SLO, RPO, and RTO;
- backup retention and restoration targets;
- rate limits, quotas, and alert thresholds;
- provider/topology choices;
- incident contacts, severity levels, and notification obligations.

No numeric or provider-specific production target is inferred by this decision.
The open values remain production-release blockers but do not block core
implementation that can satisfy the approved guardrails.

**Decision Owner:** Operations/Security/Product, with Architecture review.

**Approved by:**

Human / Project Owner

**Approved at:**

2026-08-28
