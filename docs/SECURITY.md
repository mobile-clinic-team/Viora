# SECURITY.md

> Canonical security specification for the Clinic AI Platform.
> Version: 0.1.0
> Status: Draft; MVP security boundaries are approved, with release evidence
> and operational values tracked separately.

## 1. Security Objectives

The platform handles tenant-scoped healthcare and operational data. Security
must therefore preserve:

- **Confidentiality:** only an authenticated, authorized actor may access
  the minimum data needed for the requested operation.
- **Integrity:** clinical records, appointments, identity, authorization,
  and audit evidence must not be altered outside their approved workflows.
- **Availability:** the application and its data must remain usable and
  recoverable without weakening confidentiality or integrity.
- **Tenant isolation:** a request in Tenant A must not access Tenant B data.
- **Least privilege:** users, modules, workers, integrations, and AI tools
  receive only the permissions required for their function.
- **Defense in depth:** client, API, application, database, storage, AI,
  and operational controls must not rely on one boundary alone.
- **Human accountability:** important clinical and AI-assisted actions have
  an attributable human actor and, where required, an approval gate.
- **Auditability:** sensitive access, mutation, authorization, AI, and
  administrative events are recorded without unnecessary PHI.
- **Data minimization:** the system collects, returns, logs, and sends only
  the minimum necessary information.

These objectives matter because unauthorized disclosure can affect patient
privacy and safety, while incorrect or untraceable changes can affect
clinical decisions. The project documentation does not make unapproved
regulatory or certification claims; applicable compliance obligations remain
an open decision.

## 1A. Source-Control Data Protection

Source control is not an approved storage location for healthcare data,
production exports, credentials, API keys, tokens, private keys, certificates,
or other security-sensitive material. The following rules apply to every
branch, commit, pull request, issue attachment, and GitHub Actions artifact:

- Never commit real patient data, PHI/PII, medical records, appointments,
  clinical files, database dumps, production logs, backups, or exports.
- Never commit API keys, OAuth/OIDC secrets, JWT signing keys, encryption keys,
  passwords, connection strings, provider credentials, or `.env` files.
- Use synthetic or properly approved masked fixtures for development and tests.
- Store runtime secrets in the approved managed secret store and inject them at
  runtime; use `.env.example` only with non-sensitive placeholder values.
- `.gitignore` is a convenience control, not a security boundary. A file that
  was previously committed remains in Git history and requires incident
  response, credential rotation, and history remediation.
- Pull requests must pass repository secret scanning. A detected secret or
  healthcare data file blocks merge until the incident is assessed and the
  material is removed from all reachable history.
- If a secret or healthcare data is committed, stop distribution, revoke or
  rotate the credential, preserve audit evidence, notify Security, and do not
  simply delete the file in a later commit.

These controls prevent accidental source-control disclosure; they do not
replace database, storage, access-control, encryption, retention, or incident
response controls.

## 2. Security Threat Model

| Threat | Attack Surface | Impact | Primary Mitigation | Detection |
|---|---|---|---|---|
| Compromised user account | Authentication/session | PHI disclosure, unauthorized mutation | MFA decision, least privilege, session revocation, anomaly monitoring | Failed/suspicious login and unusual access signals |
| Privilege escalation | API authorization, memberships, roles | Administrative or clinical misuse | Explicit permission, tenant, relationship, and operation checks | Authorization failures and privilege-change audit events |
| Cross-tenant access | API IDs, queries, cache, storage, AI context | Tenant breach | Derived tenant context and tenant-scoped access at every layer | Cross-tenant denial alerts and tests |
| IDOR | Resource paths and references | Unauthorized patient/clinical access | Resource ownership/relationship checks and indistinguishable `404` behavior | IDOR integration tests and access audit events |
| Unauthorized patient access | Patient and clinical APIs | PHI disclosure | Need-to-know authorization and response filtering | Sensitive-read audit and anomaly monitoring |
| Malicious API client | JSON, query, headers, replay | Injection, abuse, data leakage | Strict schemas, allowlists, limits, rate limiting, idempotency | API security logs and rate-limit signals |
| Compromised internal module/service | Module contracts and shared infrastructure | Data tampering or boundary bypass | Domain boundaries, least privilege, public application interfaces | Audit, CI boundary checks, security tests |
| Compromised AI subsystem | AI Gateway, tools, context | PHI exfiltration or unsafe mutation | No direct DB access, external authorization, minimum context, human approval | Tool and sensitive-data audit events |
| Direct/indirect prompt injection | User input, retrieved documents, clinical content | Tool abuse or policy bypass | Treat content as data; model output never authorizes | AI evaluation, tool-denial monitoring |
| Malicious uploaded file | Future clinical file upload | Malware, data disclosure, path traversal | Private storage, type/content validation, scanning decision, no execution | Upload/access audit and scanning results |
| Database compromise | PostgreSQL, credentials, backups | Bulk disclosure or tampering | Least-privilege access, encrypted transport/storage, protected backups | Database access and operational monitoring |
| Leaked credential/secret | Source, logs, environment, integrations | Impersonation or data access | Secret isolation, rotation, redaction, no source-control secrets | Secret scanning and incident response |
| Stolen session/token | Client/session boundary | Account takeover | Validation, expiration, revocation, secure transport, recovery controls | Session anomalies and revocation events |
| Replay attack | Retryable mutations/webhooks | Duplicate appointment/payment/action | Domain-specific idempotency TTL, expiry, signature/timestamp checks for future webhooks | Duplicate/conflict metrics and audit |
| Webhook spoofing | Future billing integration | Invoice/payment corruption | Signature verification, event uniqueness, payload validation | Failed signature and replay signals |
| Insider misuse | Privileged users and admin tools | PHI disclosure or improper change | Explicit privileged access, least privilege, audit, review | Access-pattern monitoring and audit review |
| Accidental exposure | Responses, logs, exports, backups | PHI/secret disclosure | Field filtering, minimization, redaction, access control | DLP/security review and log inspection |
| Denial of service | Authentication, search, AI, expensive APIs | Availability loss | Rate limits, bounded input/pagination, abuse monitoring | Traffic, latency, error, and rate-limit signals |

## 3. Trust Boundaries

| Boundary | Data crossing | Authentication | Authorization/validation | Must never cross |
|---|---|---|---|---|
| Client → API | JSON requests, headers, resource references, permitted responses | Approved platform authentication; provider is open | API schema, tenant resolution, permission and resource checks | Credentials, arbitrary tenant authority, SQL, storage credentials, unrestricted PHI |
| API → Application services | Validated commands, queries, tenant context, actor context | Trusted application call context | Owning module contract and operation authorization | Direct cross-domain repository/table access |
| Application → PostgreSQL | Domain operations and transactional data | Restricted application DB access | Repository/domain invariants; tenant predicates; migration access separately controlled | AI direct connection, arbitrary client query, unrestricted DB credentials |
| Application → Redis/cache | Cache keys and bounded values where cache is used | Authenticated and network-restricted cache connection | Tenant-aware key construction, TTL, sensitivity rules | Cross-tenant keys or unbounded sensitive clinical data |
| Application → Object storage | Authorized object operation and metadata | Restricted backend/storage identity | Authorization before access; private-by-default objects | Client-controlled arbitrary storage keys or credentials |
| Application → AI Gateway | Minimum necessary authorized context and task | Authenticated application-to-gateway boundary | Tool policy, tenant/resource authorization, output validation | Raw DB access, unnecessary PHI, authorization decisions from model text |
| API/Application → External integration | Approved bounded request/event | Integration authentication and future signature rules | Allowlisted payload, tenant scope, idempotency, audit | Secrets in client responses or unvalidated external commands |

The AI boundary is explicitly:

```text
User
  → Application
  → Authentication / Tenant Resolution
  → Authorization
  → AI Gateway / controlled subsystem
  → Approved Tool
  → Authorized Data
  → Validated AI Response
```

## 4. Identity Security

`users` represents platform identity; it is not a patient medical record.
`memberships` explicitly connects a user to a tenant and role. A user may
belong to more than one tenant, but membership does not itself grant access
to every resource in that tenant.

Identity security must include:

- an explicit lifecycle for active, suspended, archived, or otherwise
  unavailable accounts, using only statuses approved by the identity
  contract;
- membership status and tenant membership validation before protected work;
- role and permission changes restricted to authorized administrators;
- credential protection and recovery without exposing secrets or PHI;
- session/token validation, expiration, revocation, and logout behavior;
- account lockout/brute-force protection and suspicious-attempt detection;
- audit events for login, failed login, logout/revocation where applicable,
  membership changes, permission changes, and privileged access.

The Auth0-style Managed CIAM OIDC/OAuth2 target integration behind a
provider-neutral application
identity boundary is approved. The approved token/session format
is a 15-minute short-lived access token plus a rotating refresh token with a
7-day absolute session lifetime, replay detection, and application-side server
revocation. Replay detection revokes the complete token family. MFA is
required for Staff, Admin, and privileged clinical operations. Standard
recovery is handled by the Managed CIAM provider through the application
callback/handoff flow; recovery exceptions require re-authentication or
step-up MFA, explicit authorization, bounded scope, and audit. Insufficient-
assurance sessions cannot invoke privileged operations. The final provider
contract, region/residency, and service-level terms remain open decisions, not
assumptions of this specification. Account-status synchronization must fail safely and
provider payloads must not replace application authorization. Final provider
contract, region/residency, and service-level terms remain open.

## 5. Authentication

Every protected API request must carry a valid authentication context. The
API validates the credential/session, establishes the actor identity, checks
expiration/revocation state, and then performs authorization separately.

- Missing or invalid authentication returns `401 UNAUTHENTICATED`.
- Valid identity without required access returns `403 FORBIDDEN`.
- Authentication failures must not reveal protected-resource existence.
- Tokens, sessions, refresh credentials, and recovery credentials must be
  protected in transit and never written to ordinary logs.
- Expired or revoked sessions must not be accepted.
- Logout and security response must support session/token revocation once
  the final session model is decided.
- Authentication and recovery endpoints require abuse protection and
  monitoring; exact limits remain open.
- Suspicious attempts must generate safe security signals and, where
  applicable, audit events without recording credentials.

The API contract intentionally does not name a specific authentication
provider or cryptographic token format. The approved integration pattern is an
external provider behind a provider-neutral application identity boundary.

## 6. Authorization

Authorization is a server-side decision based on:

1. authenticated identity;
2. active tenant membership;
3. required role and permission;
4. resource ownership or relationship;
5. operation-specific constraints.

The established roles are `PATIENT`, `DOCTOR`, Nurse/Clinical Staff,
Receptionist, `CLINIC_ADMIN`, and `SUPER_ADMIN`. Nurse/Clinical Staff and
Receptionist are separate application roles. Their final permission matrix and
resource-level authorization remain required; role alone is not sufficient and
must not be inferred as unrestricted access.

Required controls:

- RBAC is a foundation, never the sole authorization decision.
- Patient access requires self-ownership or an approved care/operational
  relationship and permission.
- Clinical access requires clinical need-to-know and resource permission.
- Clinic administrators are limited to their tenant.
- Platform administrators do not automatically receive unrestricted PHI.
- Membership, role, permission, and tenant changes are privileged and
  auditable.
- AI tools are authorized by the application before execution; prompts and
  model output are never authorization mechanisms.
- A valid resource ID without tenant and relationship checks is a security
  violation.

### Canonical Permission Matrix Boundary

The MVP uses endpoint-specific least privilege with default deny. The
following permissions are the documented baseline; every entry still requires
active tenant membership, resource/relationship checks, and any operation-
specific constraint:

| Capability | Allowed baseline | Additional boundary |
|---|---|---|
| Tenant administration | `CLINIC_ADMIN` | Tenant-management permission; platform administration remains explicit and audited |
| Location administration | `CLINIC_ADMIN` | Location-management permission within the tenant |
| Patient create | Nurse/Clinical Staff, Receptionist, `DOCTOR`, `CLINIC_ADMIN` | Patient-create permission and active tenant context |
| Patient read/update | `PATIENT` for permitted self-fields; authorized clinical/operational staff, `DOCTOR`, `CLINIC_ADMIN` | Self-ownership, relationship, need-to-know, and field allowlist |
| Doctor/profile/shift access | `DOCTOR`, Nurse/Clinical Staff, Receptionist, `CLINIC_ADMIN` where documented | Scheduling/profile permission and tenant scope |
| Appointment operations | Nurse/Clinical Staff, Receptionist, `DOCTOR`, `CLINIC_ADMIN` where documented | Operation-specific permission, appointment relationship, transition and tenant checks |
| Clinical access | `DOCTOR` and authorized Nurse/Clinical Staff | Clinical need-to-know, resource permission, immutable lifecycle and human approval where required |
| AI access | Authorized user with AI-assistant permission | Tool-specific authorization, minimum context, tenant/resource filtering and Gateway enforcement |
| Audit access | Explicitly authorized privileged actor | No unrestricted PHI access; all access is audited |

Any capability, role, or operation not listed with an explicit permission is
denied by default. This matrix does not grant `PATIENT`, Receptionist, or
`SUPER_ADMIN` unrestricted clinical access.

## 7. Multi-Tenant Isolation

The mandatory invariant is:

> A request authenticated in Tenant A MUST NOT access Tenant B resources
> unless an explicitly authorized system-level operation permits it.

Isolation requirements:

- **API:** derive tenant context from authenticated membership; never trust a
  client-provided `tenant_id` as authorization. Hide cross-tenant resources
  behind the same `404` behavior as missing resources where appropriate.
- **Application services:** carry actor and tenant context through every
  command/query and validate referenced patient, doctor, location,
  appointment, encounter, and clinical record relationships.
- **Database:** repositories and domain operations must apply tenant scope
  for tenant-owned entities. The current MVP decision enforces tenant
  consistency at application/repository level with integration tests.
- **Cache:** every tenant-sensitive key must include an unambiguous tenant
  scope; values must not be reusable across tenants.
- **Object storage:** files are private by default and access is authorized
  before retrieval; user input cannot select an arbitrary storage key.
- **Search/RAG:** index, query, metadata, and result filtering must enforce
  tenant and permission boundaries before content reaches an actor or model.
- **AI context:** current user, tenant, patient, encounter, and permissions
  are resolved by the application; the model cannot widen the scope.
- **Audit:** tenant and actor references are recorded for sensitive events;
  audit access is itself restricted.

Prohibited patterns include global patient records, ID-only queries without
tenant authorization, cross-tenant cache keys, cross-tenant file paths, and
cross-tenant AI retrieval.

## 8. Patient / PHI Data Protection

Data classification follows the source documents:

| Classification | Examples | Required protection |
|---|---|---|
| Public | Approved public doctor profile information | Response allowlist and integrity controls |
| Internal | Operational data not intended for public access | Authenticated access and minimization |
| Sensitive | Patient contact information, appointments, operational records | Tenant/resource authorization, filtered responses, audit as required |
| Highly Sensitive / Clinical | Diagnoses, medication, allergies, clinical notes, encounter data, medical files | Strict need-to-know authorization, stronger auditing, minimization, protected storage |

Security requirements:

- Patient identity is tenant-scoped; cross-tenant matching/merging is not an
  MVP capability.
- API responses expose only fields needed for the actor and operation.
- Search and export are bounded, authorized, and auditable; bulk extraction
  is not implied by list access.
- Sensitive clinical content must not be unnecessarily written to ordinary
  application logs, traces, metrics, or error details.
- Audit records prefer resource references and safe metadata over clinical
  payloads.
- Clinical history is immutable; export and deletion are performed only through
  authorized workflows. AI audit data uses shared audit metadata rather than a
  mandatory raw prompt/response store.
- Retention, deletion, anonymization, and legal/compliance requirements remain
  policy values owned by Product/Compliance; no retention period is invented
  here. The governance decision establishes this approval gate before
  policy-dependent behavior is implemented.

## 9. API Security

`docs/API-CONTRACTS.md` is authoritative for endpoint semantics. Security
controls applied across those endpoints are:

- authenticate before protected access;
- resolve and validate tenant membership before resource access;
- enforce role, permission, ownership, relationship, and operation checks;
- validate body, path, query, and headers against endpoint allowlists;
- reject mass assignment and arbitrary status/field updates;
- filter response fields by sensitivity and authorization;
- prevent IDOR and avoid cross-tenant existence leaks;
- bound request sizes, result sizes, pagination, search, and expensive AI
  operations;
- use idempotency for retry-sensitive mutations;
- detect stale/concurrent updates using the approved `If-Match`/ETag contract
  after authorization and before mutation;
- apply appropriate security headers at the API/client boundary;
- return the canonical error model without stack traces, SQL, secrets, or
  internal topology.

## 10. Input Validation

The API must validate:

- JSON types, required fields, nullability, enum values, and unexpected
  fields where strictness is appropriate;
- UUID path and body references;
- RFC 3339 UTC timestamps and interval relationships;
- query filters, sort fields, pagination limits, and cursor values using
  endpoint allowlists;
- enforce the approved pagination bounds (`default_size = 20`, `max_size = 100`)
  and reject invalid cursors with the canonical pagination error;
- validate cursor tenant binding server-side; cursor contents never grant
  authorization;
- `Idempotency-Key` as an opaque bounded header value without PHI;
- future webhook signatures, timestamps, event IDs, and payload schemas;
- AI messages, context references, tool arguments, and output limits;
- uploaded file size, filename, MIME/type claims, extension, content, and
  metadata when file scope is approved.

Validation must prevent injection, unsafe deserialization, path traversal,
oversized payloads, malicious metadata, arbitrary query expressions, and
parameter tampering. Validation must not be delegated to the model.

## 11. Output Security

Responses must be built from explicit field allowlists. They must:

- exclude secrets, credentials, tokens, internal storage keys, SQL, stack
  traces, and implementation details;
- minimize PHI based on role, relationship, tenant, and operation;
- avoid revealing cross-tenant resource existence;
- return only permitted search/result fields;
- treat AI output as untrusted/advisory until the approved workflow makes a
  human-reviewed result authoritative;
- use the single canonical API error structure.

Error messages may identify a safe validation problem but must not reveal
database topology, authorization internals, other tenants, or sensitive
resource content.

## 12. Database Security

PostgreSQL is the transactional source of truth. Database security must
include:

- authenticated connections and protected connection credentials;
- least-privilege application database access limited to required domain
  operations;
- separate restriction and review for migration/schema-changing access;
- tenant-scoped repository/application operations and IDOR tests;
- encryption in transit and at rest according to the approved environment;
- protected, access-controlled backups;
- safe handling of sensitive fields and no unnecessary PHI in diagnostics;
- database access auditing where required by the final security/compliance
  policy;
- no direct database access by clients, AI, or unrelated domains.

Specific database roles, hosting controls, cloud topology, key management,
and monitoring provider are not selected here. The approved AI platform
direction is self-hosted Dify behind the AI Gateway and Tool Gateway; Dify
must remain isolated from direct production-data access and application
authorization boundaries.

For MVP, AI is limited to read, summarization, and draft-first capabilities.
External LLM/Embedding Providers are accessed only through controlled AI
Gateway adapters and are not exposed to public API contracts.
The approved MVP model/provider profile is Managed External LLM plus Managed
Embedding; provider-specific credentials, identifiers, and payloads remain
inside the controlled adapter boundary.
MVP uses one primary generative model and one primary embedding model without
automatic fallback. The approved pair is `gpt-4o-2024-08-06` and
`text-embedding-3-small` at dimension `1536`; model changes require
compatibility and security review.
AI data uses a minimum-necessary, category-specific lifecycle. Raw
prompt/response content is not retained by default; retained content must be
redacted and policy-controlled. Exact retention/deletion and provider-side
data-policy values remain open under Product/Compliance governance.
Knowledge purge must honor tenant, explicitly supported canonical-resource,
and document-level Legal Hold inheritance. Unknown mappings fail closed;
cleanup skips are auditable in `audit_events`, and unrelated resources continue
to be processed. MVP resource-scoped knowledge is limited to explicit mappings
for `patients` and `medical_records`; global knowledge is not implicitly
authorized.
The approved AI retention baseline is 30 days for conversations/messages,
7 days for unapproved drafts, 0-day default retention for raw prompt/context,
and 90 days for applicable AI metadata. Knowledge follows source lifecycle;
Legal Hold and immutable `audit_events` evidence override AI cleanup.
The Golden Dataset is jointly owned by Clinical and AI, versioned, and managed
without real PHI outside approved controls. Failure of the strict clinical
evaluation gate blocks AI MVP release.
Knowledge purge must honor tenant, explicitly supported canonical-resource,
and document-level Legal Hold inheritance. Unknown mappings fail closed;
cleanup skips are auditable in `audit_events`, and unrelated resources continue
to be processed.
AI safety evaluation is a blocking pre-release gate. Classified sensitive
fields require 100% PII redaction; context recall and precision must each be at
least 85%; faithfulness/hallucination failure must remain below 2%; and model
changes require the AI safety regression suite. Provider evidence remains open.
Latency targets are TBD and remain an operational observability measurement,
not a numeric AI safety threshold.
Write tools are default-deny, MVP knowledge is tenant-only, and sensitive AI
failures fail closed. Tool permissions use explicit capability classes and the
Gateway propagates AI actor, tenant scope, tool class, and policy version.
The Gateway records audit metadata while
raw prompt/response retention remains minimum-necessary, redacted, and
policy-controlled.

## 13. Redis / Cache Security

Redis/cache is present in the architecture as a supporting component, never
as the source of truth. It must have:

- authenticated access and network isolation;
- encrypted transport where supported by the approved environment;
- tenant-aware, collision-resistant key namespaces;
- explicit TTLs and invalidation on authorization, membership, and resource
  changes;
- no unbounded storage of sensitive clinical content or credentials;
- cache-miss behavior that rechecks authorization against the source of
  truth.

A cached value must never be returned merely because a key exists. The
tenant and actor scope must be validated for every sensitive result.

## 14. Object Storage / File Security

Object storage is part of the architecture, while `clinical_files` are
explicitly Post-MVP under the approved Product decision. If file capability is
enabled in a future phase, the
following are mandatory:

- private-by-default objects;
- backend authorization before metadata or bytes are accessed;
- short-lived signed access only if approved, scoped to one authorized
  object, and never returned before authorization;
- tenant- and resource-isolated object keys generated by the backend;
- no raw storage credentials or arbitrary user-supplied storage key;
- file type, MIME, extension, size, checksum, and content validation;
- malware scanning requirement before clinical use, with the exact scanner
  open;
- no execution of uploaded files;
- audit of upload, metadata access, download, archive, and deletion;
- retention/archive/deletion behavior consistent with the final clinical
  data policy.

## 15. AI Security Boundary

AI is an untrusted reasoning subsystem behind the AI Gateway. The AI:

- must not connect directly to PostgreSQL, Redis, object storage, or
  arbitrary internal services;
- must not bypass application authentication, tenant resolution, or
  authorization;
- must not access another tenant;
- must not receive unnecessary PHI;
- must not directly modify clinical records or finalized versions;
- must not directly finalize prescriptions;
- must not independently prescribe or diagnose;
- must not execute arbitrary SQL, shell commands, code, or filesystem access;
- must not turn an output into authoritative data without the required
  human/application workflow.

Every AI action uses an explicit tool contract with input/output schema,
allowed roles, tenant/resource scope, side effects, and audit policy. The AI
subsystem is never a privileged database user.

## 16. Prompt Injection / Tool Abuse

User messages, clinical content, retrieved documents, and model output are
untrusted data. Controls must include:

- application-enforced tool authorization before every invocation;
- strict tool input schemas and bounded arguments;
- no authorization decisions based on natural-language output;
- tenant/resource checks repeated at tool execution time;
- minimum-necessary context and output filtering;
- treating instructions embedded in knowledge documents as data, not system
  instructions;
- denial of arbitrary tool, SQL, shell, filesystem, secret, or export
  requests;
- validation that an AI draft is still approvable before human approval;
- evaluation for direct/indirect prompt injection, exfiltration, tool abuse,
  and cross-tenant retrieval.

## 17. AI Data Minimization

Only data necessary for the authorized task may cross into AI context.
Context construction must use the current user, tenant, patient,
encounter, relevant authorized records, and approved knowledge rather than
an entire tenant or patient database.

- Patient/clinical context requires explicit resource authorization.
- Sensitive fields not needed for the task are omitted or transformed.
- Conversation history is not automatically the authoritative clinical
  record.
- Prompt/response logging is minimized and must not contain unnecessary PHI.
- AI-generated clinical content remains a draft until authorized human
  review and application-controlled approval.

AI conversation retention, prompt/context logging, embedding model,
embedding dimension, and AI data governance remain open decisions.

## 18. RAG / Knowledge Security

RAG is an MVP capability behind a retrieval abstraction. Retrieval must:

- filter by tenant, document status, and authorization scope;
- prevent Tenant A from retrieving Tenant B documents;
- isolate document and chunk metadata by tenant or approved global scope;
- authorize indexing, update, and deletion operations;
- synchronize document archive/deletion with retrievable content;
- preserve source references where exposed to an authorized caller;
- treat retrieved content as untrusted data and never as policy authority;
- keep vector implementation details private from the public API.

Global versus tenant-specific knowledge visibility and final governance are
open decisions.

## 19. Clinical Record Integrity

Clinical records follow the established lifecycle toward finalization. A
finalized version is immutable:

- no generic overwrite of finalized clinical content;
- corrections create a new version/amendment;
- the original finalized version remains preserved;
- `current_version` references the latest version;
- authorship, timestamps, amendment reason, actor, tenant, and request ID
  remain attributable;
- authorization is checked before read, write, review, finalize, or amend;
- invalid transitions and stale updates are rejected and audited.

The canonical clinical intermediate status is `IN_REVIEW`. The review action,
authorization, finalization, and amendment controls use this status consistently.

## 20. Human Approval

AI-generated clinical content must follow:

```text
AI Draft
   → Authorized Human Review
   → Human Approval
   → Clinical Application Service
   → Final Clinical Record
```

The application, not the model, enforces the gate. The approver must be an
authorized clinician with a valid tenant/resource relationship. Approval is a
privileged action requiring step-up MFA and current-version/OCC validation; a
stale draft returns to review. AI cannot
approve its own draft, directly finalize a record, or directly finalize a
prescription. Approval, rejection, reviewer, timestamps, draft reference,
and resulting resource reference are audited.

## 21. Audit Logging

Audit is a cross-cutting capability owned by Identity & Security. Required
events include:

- login, failed login, logout/revocation where applicable;
- authorization failures and privileged access;
- membership, role, permission, tenant, and administrative changes;
- patient creation, access, and important mutations;
- appointment creation, access, reschedule, cancellation, and check-in;
- encounter and clinical record access, mutation, finalization, and
  amendment;
- AI invocation, sensitive context access, tool execution, draft creation,
  review, approval, and rejection;
- future file access and Billing/payment operations.

Each event should contain, where applicable, `event_id`, timestamp, actor,
tenant, action, resource type/reference, result, request/correlation ID,
and safe metadata. Audit data must resist unauthorized modification and
must not unnecessarily contain raw PHI, full clinical notes, full histories,
or complete prompts/responses.

## 22. Logging Security

Ordinary application logs must never contain:

- passwords, access tokens, refresh tokens, API keys, signing keys,
  encryption keys, webhook secrets, or database credentials;
- unnecessary patient identifiers or PHI;
- complete clinical notes, histories, files, prompts, or model responses
  containing sensitive data;
- raw storage credentials or arbitrary storage keys;
- SQL with sensitive literals, stack traces, or internal secrets.

Safe logs use request IDs, tenant/actor references only where permitted,
resource types/IDs, event names, result categories, timing, and redacted
metadata. Sensitive content requires an explicit approved policy and access
control, not incidental debug logging.

## 23. Secrets Management

Database credentials, AI provider credentials, API keys, signing keys,
webhook secrets, and encryption keys must be:

- supplied only through an approved secret mechanism;
- inaccessible to clients and unauthorized modules;
- excluded from Git, source code, configuration committed to Git, logs,
  traces, metrics, errors, and API responses;
- rotated according to an approved lifecycle;
- revoked promptly after suspected compromise;
- access-controlled and audited where supported.

The approved MVP baseline uses a managed Secrets Manager and managed KMS for
infrastructure and service secrets. Secrets are delivered through workload
identity/runtime injection and never enter source code, business tables, public
APIs, or logs.

## 24. Encryption

The platform requires:

- encryption in transit for client/API, service, database, cache, storage,
  and approved external-integration connections;
- encryption at rest for PostgreSQL, object storage, cache where sensitive
  data is retained, and backups;
- protected encryption of credentials and secret material;
- no claim that encryption alone replaces authorization, minimization, or
  auditability.

Hashing is distinct from encryption: passwords or other one-way credentials
must use the approved credential-protection mechanism, while data requiring
later recovery uses controlled encryption. Selective field-level/envelope
encryption applies to classified PHI and carries key-version metadata so
rotation and migrations remain compatible.

## 25. Key Management

Encryption, signing, webhook, and other security keys require:

- explicit ownership and least-privilege access;
- protected storage separate from source code and ordinary logs;
- rotation and versioning without accidental data loss;
- audit of privileged key access where available;
- revocation/replacement procedures after compromise;
- backup/recovery handling consistent with the key's sensitivity.

The key-management architecture follows the managed KMS baseline. Security and
Operations own key rotation, revocation, access audit, and compromise response;
exact cloud vendor and production topology remain infrastructure/release
details.

## 26. Rate Limiting / Abuse Protection

Rate limiting and abuse detection are required for:

- login, logout, recovery, and authentication-related operations;
- AI conversations, messages, draft generation, and knowledge retrieval;
- patient search and other PHI-sensitive enumeration routes;
- future file upload/download and expensive processing;
- webhook and external-integration endpoints;
- repeated failed authorization or suspicious resource access.

Limits must be tenant-, actor-, credential-, and operation-aware where
appropriate. Exact thresholds, burst behavior, quotas, and response policy
are open; the API returns `429 RATE_LIMITED` using its canonical error
model.

## 27. Webhook Security

Webhook processing is Post-MVP with Billing. When enabled, the service must:

- authenticate the integration and verify its signature before processing;
- validate timestamp/replay window once approved;
- validate the payload schema and provider/event identifiers;
- enforce `UNIQUE(provider, provider_event_id)` idempotency;
- reject duplicate/conflicting events safely;
- avoid trusting provider payloads as authorization;
- update only authorized tenant-scoped billing state;
- audit signature failures, accepted events, rejected events, and results;
- protect raw payload retention under the final data policy.

## 28. File Upload Security

File upload is Post-MVP under the approved Product decision. If enabled in a
future phase:

- authorize the patient/encounter and tenant before initiation;
- enforce approved maximum size, type, extension, MIME, and content checks;
- treat filename and metadata as untrusted; prevent traversal and injection;
- scan for malware before making a file available to clinical workflows;
- isolate storage by tenant/resource and prevent arbitrary key selection;
- never execute or interpret uploaded files as code;
- use private access and short-lived scoped download authorization;
- audit initiation, completion, access, archive, and deletion.

Exact size/type/scanning limits are open decisions.

## 29. Backup & Recovery Security

Database and object-storage backups must:

- be access-controlled and encrypted;
- inherit the sensitivity and tenant protections of source data;
- avoid exposure through development/test environments;
- have an approved retention and deletion policy;
- be restorable only through controlled privileged operations;
- be tested periodically for integrity and recovery;
- preserve auditability of backup access and restoration.

RPO, RTO, provider/topology, backup retention, and restoration ownership
remain open. No numeric target is invented here.

The approved production-policy boundary separates implementation guardrails
from release values. Environment and secret isolation, migration rollback,
failure-safe dependency behavior, test/observability interfaces, and
operational ownership are implementation requirements. SLO, RPO, RTO, backup
retention/restoration targets, rate limits/quotas, alert thresholds,
provider/topology, and incident-response values remain production-release
blockers until approved.

## 30. Security Monitoring

Security monitoring should detect and support investigation of:

- repeated authentication failures, recovery abuse, and session anomalies;
- authorization failures and cross-tenant access attempts;
- unusual patient/clinical access volume or patterns;
- privilege, membership, role, and tenant changes;
- AI tool denials, unusual tool use, prompt-injection signals, and data
  exfiltration patterns;
- unusual search, download, file, webhook, or API activity;
- database, cache, storage, secret, and backup access anomalies;
- availability, latency, error, and rate-limit degradation.

The monitoring platform, retention, alert thresholds, and operational owner
are not yet selected.

## 31. Incident Response

The response lifecycle is:

```text
Detect → Triage → Contain → Investigate → Eradicate → Recover → Review
```

At a high level, response must support:

- credential/session compromise: revoke affected access, preserve evidence,
  investigate scope, and rotate affected secrets;
- PHI exposure or cross-tenant breach: contain access, identify tenants and
  resources, preserve audit evidence, and follow approved notification and
  compliance processes;
- database compromise: isolate access, protect backups/keys, assess
  integrity, and restore only through a controlled plan;
- AI compromise/tool abuse: disable affected tools or gateway paths, revoke
  credentials, inspect context/output exposure, and preserve evaluations;
- malicious file: quarantine/remove access, inspect propagation, and
  preserve upload/access evidence;
- secret leakage: revoke/rotate, search for use, and remove exposure from
  logs/source according to incident procedure.

Organizational contacts, severity levels, notification obligations, and
incident ownership are open decisions; this document does not invent them.

## 32. Data Retention & Deletion

Security must protect retention and deletion workflows for:

- patient and clinical records;
- audit events;
- AI conversations, messages, drafts, and retrieval data;
- future uploaded files;
- backups and restored copies.

Clinical records are not ordinary deletable operational rows: finalized
content remains immutable and corrections use amendments/versioning. Soft
delete/archive does not authorize deletion of clinical history. Retention
periods, legal holds, deletion/anonymization rules, AI retention, audit
retention, and backup expiry are OPEN; no regulatory period is assumed.

## 33. Data Export

The architecture identifies controlled data export as a future capability.
If enabled, export must:

- require explicit authorization and tenant/resource scope;
- restrict the actor to permitted patients/resources;
- prevent unrestricted bulk extraction;
- record the request, scope, actor, result, and download access in audit;
- use a protected, temporary representation with an approved expiration;
- protect the export in transit and at rest;
- prevent access by guessing a URL, ID, or storage key;
- preserve clinical immutability and retention requirements.

Export format, expiry, exact permission, and patient-facing scope are open.

## 34. Privileged Access

Privileged access includes platform administration, clinic administration,
membership/role/permission changes, security operations, data export,
incident investigation, schema/migration access, and key/secret access.

Controls:

- least privilege and explicit permission;
- tenant restriction for clinic administration;
- no default unrestricted PHI access for `SUPER_ADMIN`;
- separation of operational access from clinical approval where applicable;
- strong authentication/MFA once finalized;
- audit of access, action, target, result, and request ID;
- review and revocation when role, membership, or employment changes.

## 35. Security Testing

Before production, security testing must include:

- authentication, expiration, revocation, recovery, and brute-force tests;
- role, permission, resource, relationship, and privileged-access tests;
- Tenant A versus Tenant B isolation tests for API, repository, cache,
  storage, search, RAG, and AI context;
- IDOR, enumeration, parameter-tampering, mass-assignment, and output
  filtering tests;
- JSON, path, query, header, timestamp, pagination, and rate-limit tests;
- appointment idempotency, replay, double-booking, and concurrency tests;
- clinical immutability, amendment, authorship, and approval-gate tests;
- AI tool authorization, prompt-injection, indirect-injection, exfiltration,
  and arbitrary-tool/SQL/shell denial tests;
- file type, size, traversal, storage-isolation, malware, and access tests
  when File scope is enabled;
- webhook signature, timestamp, idempotency, and payload tests when Billing
  is enabled;
- secret scanning, dependency scanning, logging redaction, backup access,
  and migration/security review tests.

The critical invariant is tested explicitly: Tenant A cannot access Tenant B
resources through any supported API or indirect data path.

## 36. Secure Development Requirements

All team members must:

- keep secrets out of Git, source, logs, tests, fixtures, and API responses;
- review dependencies and security-relevant changes;
- require code review for authentication, authorization, tenant context,
  clinical integrity, AI tools, files, secrets, and audit behavior;
- review migration permissions and tenant impact before database changes;
- update API contracts before incompatible API behavior;
- add tenant-isolation and authorization tests for new resource paths;
- verify audit requirements for sensitive reads and mutations;
- respect Nx/module boundaries and public cross-domain contracts;
- have AI tool changes reviewed for scope, permissions, side effects, and
  prompt-injection resistance.

No specific CI vendor is prescribed. The architecture requires violations
to be detected before production deployment.

## 37. Security Invariants

1. No cross-tenant data access.
2. Client-provided `tenant_id` is never authorization by itself.
3. Authentication is distinct from authorization.
4. Every protected resource access checks identity, membership, permission,
   relationship, and operation constraints.
5. AI cannot bypass application authorization or cross tenant boundaries.
6. AI cannot directly access PostgreSQL or arbitrary internal services.
7. AI cannot directly modify/finalize clinical records or prescriptions.
8. AI-generated clinical content requires authorized human approval before it
   becomes authoritative clinical data.
9. Finalized clinical records cannot be silently overwritten; amendments
   preserve the original and accountability.
10. Sensitive data and secrets are not unnecessarily written to logs.
11. Secrets never enter source control, ordinary logs, or API responses.
12. Sensitive operations are auditable without unnecessary raw PHI.
13. Cache, storage, search, RAG, and AI context cannot cross tenant scope.
14. Retry-sensitive operations cannot create duplicates through replay.

## 38. SECURITY ↔ TEAM OWNERSHIP

| Security Responsibility | Owning Team | Module |
|---|---|---|
| Identity, authentication, sessions, recovery | Engineer A | Identity & Security |
| Tenant context, membership, roles, permissions, authorization | Engineer A | Tenant / Identity & Security |
| Audit events and privileged-access evidence | Engineer A | Audit |
| Patient data access controls and clinical authorization | Engineer B | Patient / Clinical |
| Clinical immutability, amendments, authorship, approval handoff | Engineer B | Clinical |
| Doctor, appointment, scheduling, concurrency, operational access | Engineer C | Doctor / Appointment / Operations |
| Billing/webhook security when enabled | Engineer C | Billing (Post-MVP) |
| AI Gateway, tools, context, RAG, AI evaluation and safety | Engineer D | AI Platform |
| Shared idempotency/outbox schema and access contract | Engineer A | Shared/Platform |
| Cross-domain security review | Affected owner with Engineer A security ownership | Applicable module boundary |

Ownership follows System Definition and Architecture. All members remain
responsible for security, tests, observability, and documentation in their
area.

## 39. SECURITY REQUIREMENTS MATRIX

| Requirement | Domain | Security Control | Enforcement Layer | MVP/Post-MVP |
|---|---|---|---|---|
| Authenticated protected request | Identity/API | Validate identity and session/token state | API | MVP |
| Tenant isolation | All tenant domains | Membership-derived tenant context and scoped access | API, Application service, Database/tests | MVP |
| IDOR prevention | Patient/Clinical/Appointment/AI | Resource relationship and tenant checks | API, Application service | MVP |
| Least privilege | All | Role + permission + relationship checks | Application service | MVP |
| Clinical immutability | Clinical | No finalized overwrite; amendment/version workflow | Application service, Database invariants/tests | MVP |
| Human approval | AI/Clinical | Human reviewer and application-controlled approval gate | Application service, AI Gateway | MVP |
| AI isolation | AI | Gateway/tools; no direct DB or arbitrary service access | AI Gateway, Application service | MVP |
| RAG isolation | AI/RAG | Tenant/status/permission filtering | Application service, AI Gateway | MVP |
| Sensitive response minimization | All | Field allowlists and error redaction | API | MVP |
| Idempotency | Appointment/AI/retryable mutations | Actor/tenant key scope and request hash | Application service, Shared/Platform | MVP |
| Appointment double-booking protection | Appointment | Atomic scheduling validation and conflict handling | Application service, Database/tests | MVP |
| Appointment `NO_SHOW` transition | Appointment | Explicit application command, role/permission check, transition validation, idempotency, audit, and negative tests | API, Application service, Audit, Tests | MVP |
| Auditability | All sensitive domains | Actor/tenant/action/resource/result/request ID | Application service, Audit | MVP |
| Secret protection | All | No source/log/API exposure; controlled secret delivery | Infrastructure/application process | MVP |
| Encryption | All data stores/connections | Managed KMS, in-transit/at-rest encryption, selective classified-PHI field/envelope encryption, key-version metadata | Infrastructure/Security | MVP |
| Cache isolation | Shared cache | Tenant-aware keys, TTL, invalidation | Application service, Redis | MVP if cache used |
| File access control | Clinical files | Private storage and backend authorization | API, Application service, Object storage | Post-MVP |
| Webhook authenticity | Billing | Signature, replay, schema, event uniqueness | API, Application service | Post-MVP |
| Backup security | Data platform | Encryption, access control, restore testing | Infrastructure/operations | MVP, targets open |

## 40. Open Security Decisions

| ID | Decision | Why it matters | Affected documents | Affected domains | Blocking level | Recommended owner |
|---|---|---|---|---|---|---|
| SEC-001 | Final Managed CIAM contract and provider assurance | Auth0-style Managed CIAM OIDC/OAuth2 target profile, token lifetimes, MFA scope, application revocation, account-status guardrails, provider-managed recovery, and application-enforced step-up exceptions are approved; final contract, region/residency, and service-level terms determine final provider assurance | Architecture Gate; System Definition; API Contract | Identity, all APIs | Required before production | Engineer A / Security |
| SEC-002 | MFA policy and enforcement scope | MFA scope for Staff, Admin, privileged clinical operations, and step-up actions is approved | System Definition; Architecture Gate | Identity, privileged operations | Resolved for MVP | Engineer A / Security |
| SEC-003 | Authorization engine and final permission matrix for separate Nurse/Clinical Staff and Receptionist roles | Endpoint-specific least privilege and default deny are approved | System Definition; Data Model; API Contract | All tenant, Patient, Clinical, Appointment APIs | Resolved for MVP | Engineer A with Product/Clinical |
| SEC-005 | Public conflict and stale-update semantics | Strong ETag/If-Match, `412` for stale versions, `409` for scheduling conflicts, and domain-specific retry boundaries are approved; retries must re-run authorization and tenant checks | Architecture; API Contract | Appointment, Clinical, tenant mutations | Follow-up | Engineer B/C with Architecture owner |
| SEC-006 | Encryption algorithms, field-level encryption, and key-management architecture | Managed KMS baseline, selective classified-PHI field/envelope encryption, key-version metadata, rotation and revocation are approved; topology remains operational | Architecture Gate; Data Model; System Definition | All sensitive data | Resolved for MVP | Security/Infrastructure owner |
| SEC-007 | Secrets manager and cloud security architecture | Managed Secrets Manager/KMS, workload-identity delivery, isolation and audit are approved; exact provider topology remains release detail | Architecture Gate; System Definition | All integrations and infrastructure | Resolved for MVP | Engineer A with Infrastructure owner |
| SEC-008 | Data residency, compliance scope, retention, deletion/anonymization, legal holds | MVP-scoped governance boundary is approved; clinical policy values and production evidence remain release dependencies | System Definition; Architecture Gate; Data Model | Patient, Clinical, AI, Audit, future File/Billing | Required before production | Product/Compliance/Security |
| SEC-009 | AI retention, prompt/context logging, embedding model/dimension, and global knowledge governance | Approved MVP lifecycle, model/dimension, and tenant-only knowledge boundary; global knowledge requires separate approval | Architecture Gate; Data Model; API Contract | AI, RAG | Resolved for MVP | Engineer D with Security/Product |
| SEC-010 | Rate-limit thresholds, quotas, and abuse response | Determines production DoS and enumeration protection | API Contract; Architecture open decisions | Authentication, search, AI, future files/webhooks | Required before production | Engineer A/API owner |
| SEC-011 | Backup RPO/RTO, retention, provider, and restoration ownership | Determines availability and recovery security posture | Architecture Gate; System Definition | Database, storage, operations | Required before production | Operations/Infrastructure owner |
| SEC-012 | Security monitoring platform, alert thresholds, and incident ownership | Determines detection and response execution | System Definition; Architecture Gate | All security-sensitive domains | Required before production | Security/Operations owner |

## 41. SECURITY TRACEABILITY

| Security Requirement | System Definition | Architecture | Data Model | API Contract |
|---|---|---|---|---|
| Tenant isolation | Sections 4, 12, 15 | Sections 10-12, 61-64 | Sections 2, 8-9, 43, 62-64 | Sections 5-6, 9-11, 25 |
| Least privilege/resource authorization | Sections 3, 12, 15 | Sections 16-17, 25 | Sections 7, 62-64 | Section 6 and endpoint authorization blocks |
| Identity/membership | Sections 3.1, 4, 6.1-6.2 | Sections 10-18, 63 | Sections 6-7 | Sections 4, 7-8 |
| Clinical integrity | Sections 6.6, 11, 14 | Sections 19-21, 32 | Sections 17-22 | Sections 12-13, 21 |
| AI boundary | Sections 7-11 | Sections 22-34 | Sections 29-34, 59-60 | Sections 14-15, 25 |
| RAG isolation | Section 10 | Sections 29-31 | Sections 33-34 | Section 15 |
| Human approval | Section 11 | Sections 32-34 | Section 32 | Sections 13-14 |
| Auditability | Section 14 | Section 35 and ownership | Sections 39-40 | Section 23 |
| Idempotency/replay | Sections 6.4, 18 | Sections 42-44 | Sections 16, 38, 45, 50 | Sections 11, 22 |
| Data minimization/logging | Sections 7-9, 13-15 | Sections 27, 31, 35-38 | Sections 39-40, 59-61 | Sections 19, 23-25 |
| Billing/file boundaries | Section 26 | Sections 70, 73 | Sections 26, 35-38 | Sections 16-17 |

## 42. Final Cross-Document Validation

The following were cross-checked against:

- `docs/product/system-definition.md`;
- `docs/architecture/architecture-decisions.md`;
- `docs/DATA-MODEL.MD`;
- `docs/API-CONTRACTS.md`.

Validated alignment:

1. Domain names and four-team ownership.
2. Roles currently established by the documents.
3. Tenant model and tenant-scoped entities.
4. API boundary and canonical error/status conventions.
5. AI Gateway, tool authorization, no direct database access, and minimum
   necessary context.
6. Clinical immutability, amendments, versioning, and human approval.
7. Appointment concurrency, double-booking protection, and idempotency.
8. Audit requirements and PHI minimization.
9. MVP scope: Identity, Tenant/Location, Patient, Doctor Operations,
   Appointment, Clinical, AI/RAG, and internal Audit capability.
10. Post-MVP scope: Billing, Notification, prescriptions, lab results,
    clinical files excluded from MVP, and doctor ratings.

The following are intentionally not resolved here because the source
documents remain open or inconsistent: authentication provider/token model,
exact token lifetimes and recovery details, encryption/key/secrets architecture, retention and
compliance, AI governance, backup RPO/RTO, monitoring/incident ownership, and
file scope. They are recorded in
Open Security Decisions and must be closed before the affected production
capability is treated as final.
