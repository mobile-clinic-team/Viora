# Clinic AI Platform — System & Technical Architecture

> Version: 0.1.0
> Status: Draft
> Last Updated: 2026-08-28
> Audience: Product, Engineering, Security, AI Engineering
>
> This document defines the production architecture of the
> Clinic AI Platform — a multi-tenant clinic management system
> with an integrated AI assistant.
>
> This document is the technical companion to:
>
> - `docs/system-definition.md`
>
> The architecture is designed for:
>
> - multi-tenancy
> - sensitive healthcare data
> - strong security
> - auditability
> - AI safety
> - human accountability
> - production scalability
> - four full-stack engineers
> - Nx monorepo
> - modular monolith architecture

---

# 1. System Overview

The Clinic AI Platform is a multi-tenant healthcare management
platform that allows clinics and healthcare organizations to manage:

- users
- roles
- clinic locations
- patients
- appointments
- encounters
- clinical records
- billing
- notifications
- AI-assisted workflows
- knowledge retrieval
- audit events

The AI assistant is a controlled subsystem of the application.

The AI is NOT an independent authority.

The application remains responsible for:

- authentication
- authorization
- tenant isolation
- data access
- business rules
- tool permissions
- clinical record lifecycle
- auditability
- human approval

---

# 2. Architecture Goals

The system architecture must satisfy the following goals:

1. Strong tenant isolation.
2. Secure handling of sensitive healthcare information.
3. Explicit domain boundaries.
4. Production-grade reliability.
5. Horizontal scalability.
6. Strong auditability.
7. Controlled AI access.
8. Human approval for sensitive AI-generated actions.
9. Independent development by four full-stack engineers.
10. Ability to evolve toward distributed services if future
    requirements justify it.
11. Minimize infrastructure complexity during MVP.
12. Prevent architectural violations through code and CI rules.

---

# 3. Core Architecture Principles

## 3.1 Modular Monolith First

The initial backend SHALL be a modular monolith.

The system is deployed as one primary API application,
but internally contains strongly isolated business modules.

Conceptually:

    API
    │
    ├── Identity
    ├── Tenant
    ├── Patient
    ├── Doctor
    ├── Appointment
    ├── Clinical
    ├── Billing
    ├── Notification
    ├── Audit
    └── AI

The system SHALL NOT start as a microservice architecture
unless there is a demonstrated technical or business reason.

---

## 3.2 Domain Isolation

Each domain owns:

- business rules
- application services
- domain entities
- validation
- persistence logic
- authorization policies

A domain MUST NOT directly access another domain's
database tables or internal repositories.

Invalid:

    Appointment
        │
        ▼
    SQL
        │
        ▼
    patient table

Valid:

    Appointment
        │
        ▼
    Patient Application Interface
        │
        ▼
    Patient Domain

---

## 3.3 Database Is Infrastructure

PostgreSQL is infrastructure.

It is NOT a communication mechanism between domains.

Business logic must not depend on direct cross-domain SQL.

---

## 3.4 Security Is a System Property

Security SHALL NOT depend on frontend behavior.

The backend is authoritative.

Frontend checks are only UX controls.

---

## 3.5 AI Is Untrusted

The AI model is treated as an untrusted reasoning engine.

The AI:

- does not determine its own permissions
- does not access the database directly
- does not bypass tenant isolation
- does not execute arbitrary code
- does not access secrets
- does not finalize clinical records autonomously

---

# 4. High-Level Architecture

```text
                         INTERNET
                            │
                            ▼
                     ┌─────────────┐
                     │     WAF     │
                     │ Edge Layer  │
                     └──────┬──────┘
                            │
                            ▼
                     ┌─────────────┐
                     │ Load / Edge │
                     │  Routing    │
                     └──────┬──────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
         ┌─────────────┐         ┌─────────────┐
         │     Web     │         │     API     │
         │ Application │         │ Application │
         └─────────────┘         └──────┬──────┘
                                        │
             ┌──────────────────────────┼────────────────────────┐
             │                          │                        │
             ▼                          ▼                        ▼
      ┌─────────────┐           ┌─────────────┐          ┌─────────────┐
      │   Identity  │           │   Business  │          │ AI Gateway  │
      │   Boundary  │           │   Domains   │          │   / Agent   │
      └─────────────┘           └──────┬──────┘          └──────┬──────┘
                                       │                        │
                         ┌─────────────┼────────────┐           │
                         │             │            │           │
                         ▼             ▼            ▼           ▼
                    PostgreSQL       Redis     Object Storage  LLM
                         │
                         ▼
                       Audit
```

5. Runtime Components
5.1 Web Application

Responsibilities:

authentication UX
dashboards
patient management
appointment management
clinical workflows
AI assistant UI
administrative interfaces

The web application MUST NOT access PostgreSQL directly.

All protected operations go through the API.

6. API Application

The API is the primary application boundary.

Responsibilities:

authentication integration
tenant resolution
authorization
request validation
business orchestration
domain services
API response formatting
rate limiting
audit generation
idempotency

Request flow:

Request
  │
  ▼
Authentication
  │
  ▼
Tenant Resolution
  │
  ▼
Authorization
  │
  ▼
Input Validation
  │
  ▼
Application Service
  │
  ▼
Domain
  │
  ▼
Repository
  │
  ▼
PostgreSQL
7. Domain Architecture

Initial domains:

Identity
Tenant
Patient
Doctor
Appointment
Clinical
Billing
Notification
Audit
AI

The domains are logically independent.

For MVP, queue management is derived from appointment status, not a dedicated queue entity.

8. Domain Internal Structure

Each domain SHOULD follow:

domain/
├── domain/
│   ├── entities/
│   ├── value-objects/
│   ├── services/
│   └── policies/
│
├── application/
│   ├── commands/
│   ├── queries/
│   ├── services/
│   └── dto/
│
├── infrastructure/
│   ├── repositories/
│   ├── persistence/
│   └── adapters/
│
└── presentation/
    ├── controllers/
    └── schemas/

The exact folder structure can evolve.

The architectural dependency rules are more important
than the exact directory names.

9. Dependency Direction

Preferred dependency direction:

Presentation
     │
     ▼
Application
     │
     ▼
Domain
     ▲
     │
Infrastructure

The domain layer MUST NOT depend on:

HTTP
PostgreSQL implementation
Redis
cloud SDKs
LLM providers
external APIs

Infrastructure implements interfaces required by
the application/domain layers.

10. Tenant Architecture

The platform is multi-tenant.

A tenant represents an organization/clinic account.

A tenant MAY contain multiple physical locations.

Tenant
 │
 ├── Location A
 ├── Location B
 └── Location C

Therefore:

Tenant != Location

A location belongs to exactly one tenant.

11. Tenant-Owned Resources

Tenant-owned resources MUST have an explicit tenant relationship.

Examples:

patient
-------
id
tenant_id
...
appointment
-----------
id
tenant_id
location_id
patient_id
...
encounter
---------
id
tenant_id
patient_id
...
clinical_note
-------------
id
tenant_id
encounter_id
...

Tenant context must be validated before accessing
tenant-owned resources.

12. Tenant Resolution

Tenant identity MUST NOT be trusted solely from
a client-provided tenant_id.

The application derives tenant context from:

Authenticated User
        │
        ▼
Membership
        │
        ▼
Requested Tenant
        │
        ▼
Membership Validation
        │
        ▼
Tenant Context

Every protected operation runs inside a validated
tenant context.

13. Patient Identity

Initial MVP decision:

Patient identity is tenant-scoped.

Example:

Tenant A
 └── Patient 001

Tenant B
 └── Patient 001

These represent independent patient records.

The platform MUST NOT automatically assume that
patients from different tenants are the same person.

Cross-tenant patient identity is a future capability
requiring a separate architectural decision.

14. Location Model

A tenant can have multiple locations.

Example:

Tenant
 │
 ├── Location: Hanoi
 ├── Location: Ho Chi Minh City
 └── Location: Da Nang

Operational entities such as appointments may reference
a location.

Example:

Appointment
├── tenant_id
├── location_id
├── patient_id
└── doctor_id
15. Authentication

Authentication SHALL be handled through a dedicated
identity mechanism.

Authentication answers:

Who is this user?

Authorization answers:

What can this user do?

These are separate concerns.

Conceptually:

User
 │
 ▼
Identity Provider
 │
 ▼
Authentication
 │
 ▼
Session / Token
 │
 ▼
Application

The authentication integration pattern is approved as an Auth0-style Managed
CIAM OIDC/OAuth2 target profile behind a provider-neutral application identity
boundary.
The approved session/token strategy is a hybrid short-lived access token with
a 15-minute lifetime plus a rotating refresh session with a 7-day absolute
lifetime, including refresh-token replay detection. The
application owns tenant context, roles, permissions, and session revocation;
the provider owns credentials, MFA, and key rotation. Exact provider, token
lifetime values are approved. Standard recovery is handled by the Managed
CIAM provider and returns through the application callback/handoff flow;
recovery exceptions require re-authentication or step-up MFA, explicit
application authorization, bounded scope, and audit. Account-status changes must be synchronized safely through the
application boundary. The final provider contract, region/residency, and
service-level terms remain open;
vendor-specific SDKs and payloads must not enter domain code or public
contracts.

16. Authorization

Authorization is enforced server-side.

Conceptual model:

Subject
+
Tenant
+
Role
+
Permission
+
Resource
+
Relationship
+
Action
=
Authorization Decision

Example:

Doctor A
Tenant A
READ_PATIENT
Patient 123
     │
     ▼
   ALLOW

Cross-tenant access:

Doctor A
Tenant A
READ_PATIENT
Patient 999
Tenant B
     │
     ▼
   DENY
17. Authorization Enforcement

Authorization MUST occur before sensitive business operations.

Valid:

Controller
   │
   ▼
Application Service
   │
   ├── Authorization
   │
   ▼
Domain Operation
   │
   ▼
Repository

Invalid:

Controller
   │
   ▼
Repository
   │
   ▼
Database

The frontend MUST NOT be considered a security boundary.

18. Core Domain Model

Initial conceptual model:

Tenant
 │
 ├── Location
 ├── Membership
 │
 └── Patient
       │
       ├── Appointment
       │
       └── Encounter
              │
              ├── ClinicalNote
              ├── Diagnosis
              ├── Medication
              └── Allergy

AI exists alongside the clinical domain:

Patient
   │
   ▼
Encounter
   │
   ├── Clinical Records
   │
   └── AI Assistance
          │
          ├── Conversation
          ├── AI Draft
          ├── Tool Execution
          └── Retrieval
19. Clinical Data

Clinical data is highly sensitive.

Examples:

diagnosis
medications
allergies
clinical notes
encounter information
treatment information

Clinical data requires stronger access control
and auditing than general operational data.

20. Clinical Record Lifecycle

Clinical records follow:

DRAFT
  │
  ▼
IN_REVIEW
  │
  ▼
FINALIZED

Finalized clinical records are not directly mutable.

Xem enum và transition rule chi tiết tại DATA-MODEL.md Section 22.

21. Clinical Record Immutability

Once a clinical record is finalized:

UPDATE clinical_record

is prohibited.

Corrections use amendments/versioning:

Original Record
      │
      ├── Amendment 1
      ├── Amendment 2
      └── Amendment 3

The original finalized record remains preserved.

The exact implementation of versioning is defined
during domain/data-model design.

22. AI Architecture

AI is isolated behind an AI Gateway.

                    AI Gateway
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
         Agent Runtime        Model Adapter
              │                     │
              ▼                     ▼
         Tool Gateway            LLM

The rest of the system MUST NOT directly depend on
a specific LLM provider.

### 22.1 Approved AI Platform Direction

The approved MVP platform direction is self-hosted Dify behind the project AI
Gateway and application-controlled Tool Gateway. External LLM/Embedding
Providers are accessed only through controlled Gateway adapters; provider
details remain hidden from public contracts. Dify remains an untrusted
runtime boundary: it has no direct production-database access and cannot
bypass authorization, tenant isolation, domain services, audit, or human
approval. MVP AI is limited to read, summarization, and draft-first
capabilities; write tools are default-deny, knowledge is tenant-scoped by
default, and sensitive failures fail closed while core workflows degrade
safely. MVP knowledge is tenant-only; tool permissions use explicit Read,
Summarize, Draft, and Human-approved Action capability classes. AI actor,
tenant scope, tool class, and policy version are carried through the Gateway;
bounded context/tool-call/tenant-actor controls are mandatory, with exact
production values kept as operational release configuration.

The approved MVP model/provider profile is Managed External LLM plus Managed
Embedding. This does not authorize vendor coupling: model and embedding calls
remain behind provider-neutral Gateway adapters. Specific models, embedding
dimension, and retention are governed by the approved decisions; global
knowledge is deferred from MVP and tool/runtime controls are enforced by the
Gateway.

The approved MVP model strategy is a single primary model pair: one managed
generative model and one managed embedding model, with no automatic fallback.
Model/version changes require compatibility review; embedding-dimension
changes require migration or re-embedding planning.

The approved MVP pair is generative model `gpt-4o-2024-08-06` and embedding
model `text-embedding-3-small` with dimension `1536`. Versions are pinned and
no automatic fallback is permitted in MVP. Production AI execution and RAG
schema may use this pair; model changes require compatibility evaluation and
dimension changes require migration or re-embedding planning.

The approved AI data lifecycle is minimum-necessary and category-specific.
Raw prompt/response content is not retained by default; retained content must
be redacted and minimum-necessary. Clinical history remains immutable, and
export/deletion use authorized workflows. Exact retention/deletion values and
compliance controls remain open under Product/Compliance governance.

The approved MVP retention baseline is: `ai_conversations`/`ai_messages` expire
30 days after `last_message_at` and hard-purge in the next daily cycle (maximum
24-hour cleanup lag); unapproved `ai_drafts` expire after 7 days and approved
draft content is purged after approval metadata is recorded; raw prompt/context
retention is 0 days by default; AI metadata is retained for 90 days where
applicable; knowledge embeddings follow source-document lifecycle. Cleanup runs
daily at 02:00, skips Legal Hold scopes without stopping unrelated cleanup, and
records immutable evidence in `audit_events`. Provider ZDR/No-Training remains
an external production-release gate.

Knowledge Legal Hold inheritance uses existing canonical resources and does
not introduce a `clinical_resources` table. Tenant holds are evaluated through
`tenants`, document holds through `knowledge_documents`, and resource holds
only through explicitly approved canonical resources such as `patients` or
`medical_records`. Purge is allowed only when all applicable scopes are clear;
unknown mappings fail closed, unrelated cleanup continues, and skips are
recorded in immutable `audit_events`. The exact MVP mapping remains open.

AI safety evaluation is a blocking gate before MVP AI release. The Golden
Dataset must be versioned and managed in an approved environment; classified
sensitive fields require 100% PII redaction; context recall and precision must
be at least 85%; faithfulness/hallucination failure must remain below 2%; and
model changes require the AI safety regression suite. Latency targets remain
TBD and are monitored as observability/operational measurements, not as a
numeric AI safety threshold.

Clinical file storage, file-processing workers, and AI file ingestion are
explicitly Post-MVP under the approved scope decision. Object-storage
architecture remains available for future capabilities but is not part of the
MVP implementation path for clinical files.

23. AI Request Flow
User
 │
 ▼
AI API
 │
 ▼
Authentication
 │
 ▼
Tenant Resolution
 │
 ▼
Authorization
 │
 ▼
AI Gateway
 │
 ▼
Agent Runtime
 │
 ▼
Intent / Tool Selection
 │
 ▼
Tool Authorization
 │
 ▼
Tool Execution
 │
 ▼
Context Builder
 │
 ▼
LLM
 │
 ▼
Response Validation
 │
 ▼
User
24. AI Tools

AI capabilities are exposed through explicit tools.

Examples:

get_patient
get_recent_encounters
get_medications
get_allergies
search_knowledge
draft_clinical_note
create_appointment

Each tool MUST define:

Tool
├── name
├── description
├── input schema
├── output schema
├── required permissions
├── tenant scope
├── resource scope
├── side effects
└── audit policy
25. AI Tool Authorization

The AI does not decide whether a tool is permitted.

The application decides.

AI Agent
   │
   ▼
Requested Tool
   │
   ▼
Authorization
   │
   ├── DENY
   │
   └── ALLOW
          │
          ▼
     Tool Execution

A prompt is NEVER an authorization mechanism.

26. AI Database Access

The AI MUST NOT access PostgreSQL directly.

Invalid:

AI
 │
 └── SQL
      │
      ▼
 PostgreSQL

Valid:

AI
 │
 ▼
Tool
 │
 ▼
Authorization
 │
 ▼
Application Service
 │
 ▼
Repository
 │
 ▼
PostgreSQL
27. AI Context

AI context is constructed dynamically.

Possible context sources:

Current User
Current Tenant
Current Patient
Current Encounter
Conversation History
Relevant Clinical Data
Approved Knowledge

Flow:

User Query
    │
    ▼
Context Resolver
    │
    ├── Identity
    ├── Tenant
    ├── Patient
    ├── Encounter
    └── Permissions
            │
            ▼
       Relevant Data
            │
            ▼
       Context Builder
            │
            ▼
            LLM

The system SHOULD use the minimum necessary context.

28. AI Memory

Conversation history and long-term memory are different.

Short-term context:

Conversation
     │
     ▼
Current Context

Long-term AI memory MUST NOT automatically become
a duplicate medical record.

The clinical domain remains the source of truth
for clinical information.

Long-term memory requires an explicit product,
privacy and governance decision.

29. RAG Architecture

Knowledge retrieval is exposed through an abstraction.

AI
 │
 ▼
Retrieval Interface
 │
 ▼
Retrieval Service
 │
 ├── Tenant Filtering
 ├── Authorization Filtering
 ├── Metadata Filtering
 ├── Semantic Search
 └── Ranking
 │
 ▼
Knowledge Store

The AI does not directly query the vector database.

30. Initial RAG Implementation

For MVP, the preferred implementation is:

PostgreSQL
+
pgvector

Reason:

reduce infrastructure complexity
reduce operational overhead
reuse existing PostgreSQL infrastructure
simplify backups
simplify development

The application must access retrieval through an interface.

Therefore, the underlying vector implementation can
later be replaced.

31. RAG Security

Retrieved documents are untrusted input.

Retrieved content MUST NOT override:

system instructions
authorization rules
tool permissions
tenant isolation
application policies

Example:

Document
   │
   ▼
"Ignore previous instructions"
   │
   X

The agent must treat retrieved content as data,
not as system-level instructions.

32. Human Approval

AI-generated clinical content MUST NOT automatically
become a finalized clinical record.

Required flow:

AI
 │
 ▼
AI Draft
 │
 ▼
Human Review
 │
 ├── Reject
 │
 └── Approve
        │
        ▼
Clinical Service
        │
        ▼
Final Clinical Record

This requirement MUST be enforced technically,
not merely documented as a recommendation.

33. AI Draft Model

AI drafts are separate from finalized clinical records.

Conceptual model:

ai_draft
--------
id
tenant_id
patient_id
encounter_id
content
created_by
created_at
status
approved_by
approved_at

Possible statuses:

GENERATED
REVIEWING
APPROVED
REJECTED
EXPIRED

AI has no direct write path to finalized clinical records.

34. AI Safety Invariants

The following MUST always be true.

Invariant 1

AI cannot bypass authorization.

Invariant 2

AI cannot access PostgreSQL directly.

Invariant 3

AI cannot cross tenant boundaries.

Invariant 4

AI-generated clinical content cannot become finalized
without required human approval.

Invariant 5

AI cannot execute arbitrary code.

Invariant 6

AI cannot access secrets.

Invariant 7

AI cannot directly modify finalized clinical records.

Invariant 8

AI cannot independently prescribe medication.

Invariant 9

AI cannot independently make a final clinical diagnosis.

AI may assist clinicians, summarize information, retrieve knowledge, draft
content and provide decision-support information subject to product policy.
The approved MVP escalation policy is risk-tiered: low-risk assistance may
proceed within scope; medium-risk output is advisory/draft-only with human
review; high-risk, emergency, ambiguous, or materially conflicting requests
must abstain, safely defer, and route to an authorized clinician.

35. Audit Architecture

Audit is a cross-cutting capability.

Important operations generate audit events.

Examples:

LOGIN
LOGIN_FAILED

PATIENT_CREATED
PATIENT_VIEWED
PATIENT_UPDATED

CLINICAL_RECORD_VIEWED
CLINICAL_RECORD_AMENDED

PERMISSION_CHANGED

AI_TOOL_EXECUTED
AI_SENSITIVE_DATA_ACCESSED
36. Audit Event Model

Conceptual structure:

audit_event
-----------
id
timestamp
actor_id
tenant_id
action
resource_type
resource_id
result
request_id
metadata

Audit events SHOULD contain metadata and references,
not full sensitive payloads.

37. PHI Logging Policy

Application logs MUST NOT unnecessarily contain:

full patient records
clinical notes
full medical history
complete AI prompts
complete AI responses
credentials
secrets

Avoid:

logger.info(patient)
logger.info(clinicalNote)
logger.info(aiPrompt)

Prefer:

logger.info({
    event: "clinical_note_access",
    patientId,
    tenantId,
    requestId
})
38. Audit vs AI Observability

Audit and AI observability are separate concerns.

Audit answers:

What sensitive resource was accessed?

Example:

tool = get_recent_encounters
patient_id = patient_123
actor_id = doctor_456
result = SUCCESS
AI Observability answers:

Why did the AI produce this result?

Potential data:

model
latency
token usage
tool sequence
retrieval metadata
evaluation metrics

Sensitive content MUST be redacted or protected
according to retention and access policies.

39. Data Storage

Primary transactional database:

PostgreSQL

PostgreSQL stores:

tenants
locations
users
memberships
patients
appointments
encounters
clinical records
billing
audit metadata
AI metadata
retrieval metadata

PostgreSQL is the source of truth for transactional data.

40. Redis

Redis MAY be used for:

caching
rate limiting
temporary state
distributed coordination
job queues

Redis is NOT the source of truth for:

patients
clinical records
appointments
billing records
41. Object Storage

Private object storage is used for:

uploaded documents
medical files
images
PDFs
attachments

Objects MUST NOT be public by default.

Access is controlled through application authorization
and short-lived access mechanisms where appropriate.

42. Async Processing

Background processing is used for operations that
should not block the primary request.

Examples:

Document Processing
AI Processing
Notifications
Search Indexing
Report Generation
Analytics

Architecture:

API
 │
 ▼
Transaction
 │
 ▼
Event / Job
 │
 ▼
Queue
 │
 ├── AI Worker
 ├── Notification Worker (stub/no-op cho MVP, kích hoạt đầy đủ ở Post-MVP)
 ├── Document Worker
 └── Search Worker
43. Transaction Boundaries

Transactions represent coherent business operations.

Example:

Create Appointment
        │
        ├── Validate Patient
        ├── Validate Provider
        ├── Validate Availability
        └── Create Appointment

After commit:

AppointmentCreated
        │
        ▼
Queue
        │
        ▼
Notification Worker

External side effects SHOULD NOT unnecessarily
participate in the primary database transaction.

44. Idempotency

Operations susceptible to retries MUST support idempotency. Synchronous
retry-sensitive mutations use a bounded operation-class TTL; outbox-backed
operations retain idempotency state through business completion plus a grace
period. Expired keys represent new requests and require current security and
OCC validation; AI approval idempotency never bypasses human approval.

Appointment double-booking protection uses the approved PostgreSQL constraint
direction together with application transaction handling. Public mutations
use the approved optimistic concurrency contract: `If-Match` is checked after
authorization, stale versions fail with `412 Precondition Failed`, and
PostgreSQL scheduling conflicts fail with `409 Conflict`.

The approved OCC representation is a monotonic `BIGINT` version on canonical
mutable MVP resources, including `appointments`, `patients`,
`medical_records`, and `ai_drafts`. Strong ETags have no `W/` prefix and are
used with `If-Match`; resource JSON does not expose `version` by default.
`medical_record_versions` remains append-only/immutable and is outside the OCC
update path. Mutation retries use a domain-specific policy: appointment
reschedule/cancel and clinical amendment/approval do not automatically retry
after `412`; patient/profile and tenant metadata mutations may retry at most
once only when explicitly idempotent and protected by the required
tenant/actor-scoped idempotency key; AI write and approval operations do not
automatically retry and require human confirmation when stale. All retry and
re-fetch flows re-run authentication, authorization, and tenant checks. A
`409 Conflict` scheduling failure requires explicit business resolution.

Examples:

appointment creation
payment operations
webhook processing
external integrations
asynchronous commands

Flow:

Request
   │
   ▼
Idempotency Key
   │
   ├── Already Processed
   │        │
   │        ▼
   │      Return Existing Result
   │
   └── New
          │
          ▼
       Execute
          │
          ▼
      Store Result
45. API Design

APIs expose business capabilities.

Preferred:

POST /appointments
POST /encounters
POST /ai/conversations
POST /ai/drafts/{id}/approve

Avoid designing the entire API purely as CRUD
operations over database tables.

46.1 Pagination Governance

Collection APIs use a uniform opaque cursor contract with server-enforced
governance. The approved baseline is `default_size = 20` and `max_size = 100`,
with allowlisted stable keyset ordering and a deterministic unique tie-breaker.
The cursor is Base64URL/JSON encoded; HMAC may provide integrity/authenticity,
but is not encryption. Tenant binding is validated by the server and never
grants authorization. Invalid cursors use the canonical API error
`INVALID_PAGINATION_CURSOR` with HTTP `400`. Cursor versions and backward
compatibility are server responsibilities.

46. API Request Pipeline

Every protected endpoint follows:

Request
   │
   ▼
Authentication
   │
   ▼
Tenant Context
   │
   ▼
Authorization
   │
   ▼
Input Validation
   │
   ▼
Business Logic
   │
   ▼
Audit
   │
   ▼
Response
47. Error Handling

Errors are classified into:

Authentication Error
Authorization Error
Validation Error
Not Found
Conflict
Business Rule Error
Rate Limit
Dependency Failure
Internal Error

Internal implementation details MUST NOT be exposed
to clients.

48. Database Security

Production PostgreSQL MUST use:

encrypted connections
encryption at rest and in transit, managed KMS key hierarchy, selective
classified-PHI field/envelope encryption with key-version metadata, and
managed Secrets Manager delivery through workload identity
least-privilege credentials and provider-secret isolation
restricted network access
controlled migrations
backup protection
monitoring

Production database credentials MUST NOT be available
to arbitrary developers.

49. Secrets Management

Secrets MUST NOT be committed to Git.

Examples:

DATABASE_URL
LLM_API_KEY
JWT_SECRET
ENCRYPTION_KEY
STORAGE_SECRET

Secrets must be supplied through an approved
secret-management mechanism.

FOUND-002 defines the local/test file convention, configuration precedence,
test-credential limits, and leak-response procedure in
`docs/CONFIGURATION-AND-SECRETS.md`. It does not select a provider or implement
runtime secret loading.

50. Environment Separation

Required environments:

Development
     │
     ▼
Staging
     │
     ▼
Production

Each environment must have independent:

databases
credentials
secrets
storage
AI configuration
observability configuration

Local and test configuration must follow the FOUND-002 contract. Production
configuration and secrets remain external to the repository and are delivered
by the managed provider selected for release.

Production healthcare data MUST NOT be copied into
development environments without an approved
data-handling procedure.

51. Deployment Architecture

Initial production architecture:

                    Internet
                       │
                       ▼
                     WAF
                       │
                       ▼
                 Load Balancer
                       │
              ┌────────┴────────┐
              ▼                 ▼
          Web Instance      API Instance
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
                 Redis     PostgreSQL   Object Storage
                                │
                                ▼
                              Audit

API / Queue
    │
    ▼
Worker System
    │
    ├── AI Worker
    ├── Notification Worker
    └── Document Worker

Application instances SHOULD be stateless.

52. Horizontal Scaling

The API must support horizontal scaling.

              Load Balancer
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
    API #1      API #2      API #3
       │           │           │
       └───────────┼───────────┘
                   │
                   ▼
               PostgreSQL

Application correctness MUST NOT depend on local
in-memory state.

53. Database Scaling

Initial architecture:

Application
     │
     ▼
PostgreSQL Primary

Future options:

Read Replicas
Connection Pooling
Partitioning
Caching
Archival
Sharding

These are introduced based on measured requirements.

54. Reliability

The production system SHOULD implement:

health checks
readiness checks
graceful shutdown
request timeouts
dependency timeouts
retry policies
circuit breaking where appropriate
idempotency
queue retries
dead-letter queues

Retries MUST NOT create duplicate business operations.

55. Observability

Production observability includes:

Logs
Metrics
Traces
Audit Events
AI Telemetry

Every request SHOULD have a request/correlation ID.

Example:

request_id = req_abc123

The ID can connect:

API Request
     │
     ▼
Database Operation
     │
     ▼
Queue Job
     │
     ▼
Worker
     │
     ▼
AI Request
     │
     ▼
Audit Event
56. Backup Strategy

Production data must be backed up.

The final infrastructure design must define:

backup frequency
retention
encryption
geographic redundancy
restoration process
restoration testing

Backups MUST be treated as sensitive data.

57. Disaster Recovery

The system must define:

RPO
Recovery Point Objective

RTO
Recovery Time Objective

Initial values:

RPO = TBD
RTO = TBD

These values are business/operational decisions.

58. CI/CD

Every pull request must pass automated checks.

Developer
    │
    ▼
Pull Request
    │
    ▼
CI
    │
    ├── Lint
    ├── Type Check
    ├── Unit Tests
    ├── Integration Tests
    ├── API Tests
    ├── Build
    ├── Security Checks
    └── Dependency Checks
    │
    ▼
Code Review
    │
    ▼
Merge
    │
    ▼
Deployment
59. Database Migration Policy

All schema changes MUST use versioned migrations.

Developers MUST NOT manually modify production schema.

Example:

migration_001
migration_002
migration_003
...

Destructive migrations require additional review.

60. Nx Monorepo

The repository uses Nx.

Conceptual structure:

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
├── platform
├── web
└── shared

The graph uses domain-first libraries with lazy scaffolding. The initial
runtime apps are `web`, `api`, and `workers`; AI Gateway and Tool Gateway are
library boundaries under `libs/ai/*` and run inside `apps/api`. Changes to this
direction require an architecture decision.

61. Nx Domain Boundaries

Nx dependency constraints MUST enforce the domain and layer boundaries defined
in `docs/architecture/NX-PROJECT-GRAPH.md`.

Valid:

AI
 │
 ▼
Patient Public Contract

Invalid:

AI
 │
 ▼
Patient Internal Repository

Invalid:

Appointment
 │
 ▼
Clinical Database Table

Architectural violations should fail during CI.

62. Shared Libraries

Shared libraries should remain small.

Good examples:

shared-types
shared-validation
shared-errors
shared-logging
shared-observability

Avoid:

shared-everything

Business logic belongs to its owning domain.

63. Team Ownership

Four full-stack engineers own four major areas.

Engineer A — Identity & Security

Owns:

Identity
Tenant
Location
Membership
Roles
Permissions
Authorization
Audit

Owns schema of: Outbox, Idempotency Keys (shared infrastructure — other domains write rows within their own transaction, do not modify schema).

Responsibilities:

frontend
backend
database
tests
security
observability
documentation
Engineer B — Patient & Clinical

Owns:

Patient
Encounter
Clinical
Clinical Notes
Diagnosis
Medication
Allergy

Responsibilities:

frontend
backend
database
tests
security
observability
documentation
Engineer C — Operations

Owns:

Appointment
Doctor
Calendar
Check-in
Queue
Billing
Notification

Responsibilities:

frontend
backend
database
tests
security
observability
documentation
Engineer D — AI Platform

Owns:

AI Gateway
Agent Runtime
Tools
Context
Memory
RAG
AI Drafts
AI Evaluation
AI Observability

Responsibilities:

frontend
backend
AI integration
database
tests
security
observability
documentation
64. Cross-Domain Change Rules

A developer may modify another domain only
when required by an explicit contract.

Example:

AI requires patient information
        │
        ▼
Patient Public Interface

AI must not access Patient internal implementation.

Cross-domain architectural changes require review
from affected domain owners.

65. Testing Strategy

Testing exists at multiple levels.

Unit Tests

Test:

domain rules
authorization policies
business logic
validation
Integration Tests

Test:

repositories
database interactions
application services
cross-domain contracts
API Tests

Test:

authentication
authorization
tenant isolation
validation
business behavior
End-to-End Tests

Critical workflow:

Login
  ↓
Create Patient
  ↓
Create Appointment
  ↓
Check-in
  ↓
Create Encounter
  ↓
AI Assistance
  ↓
Human Review
  ↓
Approve AI Draft
  ↓
Finalize Clinical Record
66. Security Testing

Security testing MUST include:

authentication tests
authorization tests
tenant isolation tests
privilege escalation tests
injection tests
rate limiting tests
session security
AI tool authorization
prompt injection resistance
sensitive-data leakage
human approval enforcement
67. AI Evaluation

AI quality must be evaluated independently from
traditional software tests.

Evaluation areas:

Factuality
Retrieval Quality
Hallucination Rate
Tool Selection
Authorization Compliance
Prompt Injection Resistance
Sensitive Data Leakage
Human Approval Compliance

The AI is not considered production-ready merely
because its responses appear reasonable.

68. Performance Targets

Initial values remain TBD.

The system must eventually define:

Metric	Target
API Availability	TBD
API p95 Latency	TBD
API p99 Latency	TBD
AI Response Latency	TBD
Queue Processing Latency	TBD
Database Availability	TBD
RPO	TBD
RTO	TBD

Targets should be derived from actual product requirements.

69. MVP Scope

The MVP should focus on the smallest complete workflow:

Identity
   ↓
Tenant
   ↓
Patient
   ↓
Appointment
   ↓
Check-in
   ↓
Encounter
   ↓
Clinical Record
   ↓
AI Assistance
   ↓
Human Approval
   ↓
Final Clinical Record
70. Billing

Billing is an independent domain.

For MVP, billing IS deferred.

The architecture must preserve the ability to introduce:

Invoice
Payment
PaymentMethod
BillingTransaction

without changing the core patient/clinical architecture.

71. RAG MVP

Basic knowledge retrieval is part of the AI architecture.

Initial implementation:

PostgreSQL + pgvector

The retrieval subsystem must remain behind
an application abstraction.

72. Consent

Consent is a future architectural capability.

The system should avoid designing Patient as if
consent were simply:

consent = true

A mature consent model may require:

Consent
├── patient_id
├── purpose
├── status
├── granted_at
├── withdrawn_at
├── policy_version
└── evidence

Full consent management is outside the initial MVP
unless explicitly added to scope.

73. Data Export and Privacy

The architecture must eventually support controlled:

data access
data export
correction
retention
deletion workflows

These capabilities must respect:

tenant isolation
clinical record immutability
legal retention requirements
audit requirements

The data-governance decision is approved as a category-specific lifecycle
boundary owned by Product/Compliance. Clinical history remains immutable;
export and deletion use authorized workflows; and minimum-necessary/redaction
controls apply across Application, Database, Backup, and AI boundaries.
Retention, deletion/anonymization, export, residency, audit, AI-data, and
backup values remain unapproved until that owner publishes the policy; the
architecture must not infer them.
74. Architecture Anti-Patterns

The following are prohibited.

74.1 Frontend → Database
Frontend
   │
   ▼
Database
74.2 AI → Database
AI
 │
 ▼
Database
74.3 Cross-Domain SQL
Appointment
   │
   ▼
Clinical Table
74.4 Frontend Authorization as Security
if (user.role === "doctor") {
    showButton()
}

This is UX, not security.

74.5 AI as Authorization
Prompt:
"You are a doctor, therefore access this record."

This is never valid authorization.

74.6 Direct Clinical Mutation
AI
 │
 ▼
UPDATE clinical_notes

Prohibited.

74.7 Full PHI Logging
logger.info(fullPatientRecord)

Prohibited unless there is an explicit,
controlled and justified requirement.

74.8 Premature Microservices

Do not introduce distributed services merely
because the product is expected to scale.

Start modular.

Extract services when evidence justifies it.

75. Architecture Decision Records

Important decisions must be recorded as ADRs.

Examples:

ADR-001-tenant-model
ADR-002-patient-identity
ADR-003-clinical-record-immutability
ADR-004-ai-human-approval
ADR-005-ai-audit-logging
ADR-006-authentication
ADR-007-authorization
ADR-008-rag-storage
ADR-009-cloud-provider
ADR-010-data-residency
ADR-011-tenant-consistency-strategy

Each ADR should contain:

Context
Options
Decision
Rationale
Consequences
Security Impact
Affected Domains
Migration Requirements
76. Architecture Decision Gate

Before implementation begins, the following
must be decided.

P0 — Blocking
[ ] Tenant / Location model
[ ] Patient identity model
    - patient multi-account
[ ] Clinical record immutability
[ ] AI human approval
[ ] PHI / audit / logging policy
[ ] Authentication architecture
[ ] Authorization model
    - Nurse / Clinical Staff and Receptionist are separate application roles
    - UUID strategy
    - RBAC/permission schema chi tiết
[ ] Doctor model
    - doctor multi-location
[ ] Appointment scheduling model
    - appointment slot model
    - appointment overlap strategy
[ ] MVP scope
P1 — Required Before Production
[ ] Cloud provider
[ ] PostgreSQL hosting
[ ] Object storage
[ ] Secrets management
[ ] Observability stack
[ ] Backup strategy
[ ] Disaster recovery
[ ] Data residency
[ ] SLO
[ ] RPO
[ ] RTO
[ ] AI data & retention policy
- embedding model & vector dimension
- global vs tenant-specific knowledge documents
- AI conversation retention
- AI draft retention
[ ] Data governance
- clinical data retention
- consent data model
- data export model
- deletion/anonymization model

Production implementation may proceed with environment/secret isolation,
migration rollback contracts, failure-safe dependency behavior, test and
observability interfaces, and explicit operational ownership. Migrations use
the approved hybrid risk strategy: transactional for small additive low-lock
changes and expand/contract for breaking, large-table, high-lock, index-heavy,
or vector changes, with preflight and rollback/forward-fix plans. SLO, RPO, RTO,
backup retention/restoration targets, rate limits/quotas, alert thresholds,
provider/topology, and incident-response values remain production-release
blockers until approved; no numeric target is inferred.
77. Architecture Readiness Criteria

The architecture is READY FOR IMPLEMENTATION when:

tenant model is decided
location model is decided
patient identity model is decided
clinical immutability policy is decided
AI approval boundary is decided
PHI/audit policy is decided
authentication architecture is decided
authorization model is defined
MVP scope is frozen
domain boundaries are approved
initial domain model is approved
database model is approved
deployment baseline is defined
CI/CD baseline is defined
Nx dependency boundaries are defined
Codex engineering rules are available
78. Implementation Sequence

The engineering lifecycle follows:

                    SYSTEM DEFINITION
                           │
                           ▼
                  ARCHITECTURE DECISIONS
                           │
                           ▼
                     DOMAIN MODEL
                           │
                           ▼
                          ERD
                            │
                            ▼
                         SECURITY.md
                            │
                            ▼
                   TECHNICAL ARCHITECTURE
                           │
                           ▼
                    Nx WORKSPACE
                           │
                           ▼
                 ENGINEERING STANDARDS
                           │
                           ▼
              IDENTITY + TENANT FOUNDATION
                           │
                           ▼
                         PATIENT
                           │
                           ▼
                       APPOINTMENT
                           │
                           ▼
                        CLINICAL
                           │
                           ▼
                       AI FOUNDATION
                           │
                           ▼
                   AI CLINICAL ASSISTANCE
                           │
                           ▼
                         HARDENING
                           │
                           ▼
                   PRODUCTION DEPLOYMENT
79. Codex Engineering Constraint

Codex and other coding agents MUST treat this document
as an architectural constraint.

Coding agents MUST NOT:

create direct cross-domain database access
bypass authorization
create AI direct database access
bypass human approval
introduce secrets into source code
modify finalized clinical records directly
cross tenant boundaries
introduce new infrastructure without architectural review
introduce microservices without an approved ADR

When a requested implementation conflicts with this document,
the agent must stop and identify the conflict instead of
silently implementing the conflicting behavior.

80. Architecture Evolution

The system begins as a modular monolith.

A domain may later be extracted into an independent service
when at least one of the following is demonstrated:

independent scaling requirement
independent reliability requirement
independent deployment requirement
materially different infrastructure requirements
organizational/team scaling
measurable operational bottleneck

Potential future services:

Identity Service
Clinical Service
Appointment Service
AI Service
Notification Service
Billing Service

Service extraction must preserve:

tenant isolation
authorization
auditability
domain contracts
AI safety invariants
81. Final Architectural Model

The intended production architecture is:

                        ┌─────────────────────┐
                        │       CLIENTS       │
                        │                     │
                        │ Web / Mobile / API  │
                        └──────────┬──────────┘
                                   │
                                   ▼
                        ┌─────────────────────┐
                        │     EDGE / WAF      │
                        └──────────┬──────────┘
                                   │
                                   ▼
                        ┌─────────────────────┐
                        │     API PLATFORM    │
                        │                     │
                        │ Auth                │
                        │ Tenant Context      │
                        │ Authorization       │
                        │ Validation          │
                        │ Rate Limiting       │
                        │ Audit               │
                        └──────────┬──────────┘
                                   │
             ┌─────────────────────┼─────────────────────┐
             │                     │                     │
             ▼                     ▼                     ▼
      ┌──────────────┐     ┌────────────────┐    ┌──────────────┐
      │   BUSINESS   │     │      AI        │    │  PLATFORM    │
      │   DOMAINS    │     │   SUBSYSTEM    │    │   SERVICES   │
      │              │     │                │    │              │
      │ Identity     │     │ Agent          │    │ Audit        │
      │ Tenant       │     │ Context        │    │ Notification │
      │ Patient      │     │ Tools          │    │ Jobs         │
      │ Appointment  │     │ RAG            │    │ Observability│
      │ Clinical     │     │ Drafts         │    │              │
      │ Billing      │     │ Evaluation     │    │              │
      └──────┬───────┘     └───────┬────────┘    └──────────────┘
             │                     │
             │                     │
             └──────────┬──────────┘
                        │
                        ▼
               ┌──────────────────┐
               │    APPLICATION   │
               │    INTERFACES    │
               └────────┬─────────┘
                        │
          ┌─────────────┼──────────────┐
          │             │              │
          ▼             ▼              ▼
     PostgreSQL       Redis      Object Storage
          │
          ▼
       pgvector

The central architectural rule is:

                    USER
                      │
                      ▼
                APPLICATION
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
       DOMAIN      AUTHZ        AUDIT
          │
          ▼
       DATA

                    AI
                     │
                     ▼
                AI GATEWAY
                     │
                     ▼
                   TOOLS
                     │
                     ▼
                 AUTHZ
                     │
                     ▼
                DOMAIN API
                     │
                     ▼
                   DATA

The AI is therefore a consumer of controlled application
capabilities, not an owner of healthcare data.

82. Definition of Done for Architecture

Architecture work is considered complete for MVP when:

[✓] System boundaries defined
[✓] Domain boundaries defined
[✓] Tenant isolation defined
[✓] Patient identity defined
[✓] Clinical immutability defined
[✓] AI boundaries defined
[✓] AI human approval defined
[✓] AI tool authorization defined
[✓] Audit architecture defined
[✓] PHI logging policy defined
[✓] RAG abstraction defined
[✓] Storage architecture defined
[✓] Async architecture defined
[✓] Nx boundaries defined
[✓] Team ownership defined

[✓] External identity provider behind provider-neutral application boundary approved
[ ] Specific authentication provider, session/token strategy, and MFA finalized
[✓] Canonical clinical lifecycle status `IN_REVIEW` approved
[ ] Authorization implementation finalized
[ ] Cloud provider finalized
[ ] Infrastructure finalized
[ ] SLO finalized
[ ] RPO/RTO finalized
[ ] Compliance requirements finalized
[ ] Domain model finalized
[ ] ERD finalized

The unchecked items are implementation/architecture decisions
that must be completed before the corresponding production
capability is deployed.
The approved MVP topology is hybrid: Identity/Tenant, Patient, Doctor/
Appointment, and Clinical capabilities remain modular backend domains, while
the AI Gateway and Tool Gateway are independently bounded Nx libraries under
`libs/ai/*`, running inside `apps/api`; they are the only AI-to-application
capability path. Shared
Platform exposes only approved primitives; domain private internals are not
importable across domains, and Nx tags/constraints enforce ownership and
dependency direction.
