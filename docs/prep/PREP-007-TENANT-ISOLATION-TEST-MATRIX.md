# PREP-007 — Tenant A versus Tenant B Isolation Test Matrix

Status: MATRIX COMPLETE — EVIDENCE CASES RECORDED; RUNTIME TEST READINESS IS
NOT CLAIMED

This artifact defines the Tenant A/Tenant B isolation cases required across
direct and indirect access paths. It is a preparation and traceability
artifact; it does not add runtime tests, endpoints, repositories, fixtures,
providers, migrations, or security policy.

## Scope and acceptance criterion

The Implementation Plan assigns PREP-007 to Engineer A/all and requires direct
and indirect API, repository, cache, job, RAG, AI, and audit cases. The core
invariant is:

> A request authenticated in Tenant A must not access Tenant B resources
> through any supported direct or indirect data path.

Fixtures must be synthetic and tenant-aware. The matrix must be applied before
each domain integration and repeated at the security checkpoint.

## Test fixture model

| Fixture | Tenant A | Tenant B | Required relationship |
|---|---|---|---|
| Tenant | `tenant_A` | `tenant_B` | Distinct active tenants |
| Actor | `actor_A` with valid A membership | `actor_B` with valid B membership | No shared membership unless an explicitly approved system operation is under test |
| Location | `location_A` | `location_B` | Each belongs to its own tenant |
| Patient | `patient_A` | `patient_B` | Same-looking synthetic identity is allowed to prove records remain tenant-scoped |
| Doctor | `doctor_A` | `doctor_B` | Each belongs to its own tenant and location |
| Appointment | `appointment_A` | `appointment_B` | References only same-tenant patient, doctor, and location |
| Encounter/record | `encounter_A`, `record_A` | `encounter_B`, `record_B` | References only same-tenant clinical resources |
| Knowledge content | `document_A`, `chunk_A` | `document_B`, `chunk_B` | Tenant/status/permission-filtered retrieval corpus |
| Audit event | `audit_A` | `audit_B` | Actor, tenant, resource, request, and safe metadata are distinguishable |
| Cache/job entries | A-scoped key and payload | B-scoped key and payload | Same logical lookup may exist in both tenants without collision |

No fixture contains real PHI, production data, credentials, or unrestricted
cross-tenant administrative authority.

## Expected response and evidence conventions

- A cross-tenant resource path must return the policy-approved indistinguishable
  `404 NOT_FOUND` or explicit `403 FORBIDDEN`; it must never disclose whether a
  resource exists beyond the approved behavior.
- Every denial records the request/correlation identifier and safe audit or
  security evidence where the endpoint policy requires it, without copying
  unnecessary PHI.
- A passing case proves both the denial and the absence of leakage in response,
  logs, cache, jobs, search results, model context, and audit visibility.
- Tests must re-run authentication, membership, authorization, and tenant
  checks after retry, re-fetch, cache miss, asynchronous dispatch, and paging.

## Direct API isolation cases

| ID | Operation/path | Setup | Action as `actor_A` | Expected result / evidence |
|---|---|---|---|---|
| API-01 | Patient read | `patient_B` exists | Request `GET /api/v1/patients/{patient_B}` | Denied with approved `404`/`403`; no B fields or existence leak |
| API-02 | Patient list/search | Both tenants have matching synthetic names | Search/list as A | Results contain only A patients; pagination cannot reveal B cursors or counts |
| API-03 | Patient mutation | `patient_B` exists | Attempt PATCH as A | Denied; B record unchanged; no audit event falsely attributed as a successful A mutation |
| API-04 | Doctor/location reads | B doctor, shift, and location exist | Request B resources from A | Denied; filtered list contains only A resources |
| API-05 | Appointment read/list | B appointment exists | Read/list/filter appointments as A | Only A appointments returned; B ID and filters do not leak existence |
| API-06 | Appointment create | A actor submits B patient/doctor/location IDs | Create appointment | Rejected before mutation; no appointment, outbox event, or audit success is created |
| API-07 | Appointment command | B appointment exists | Cancel/check-in/NO_SHOW B appointment | Denied; status unchanged; denial follows endpoint authorization and audit rules |
| API-08 | Encounter/clinical read | B encounter/record/allergy exists | Read B clinical resource as A | Denied; no PHI in response, logs, or error details |
| API-09 | Clinical mutation | A request references B encounter or record | Create/review/finalize/amend | Rejected; no version, status, audit, or outbox mutation occurs |
| API-10 | Tenant/location administration | A actor targets B tenant/location | Read or mutate B administration resource | Membership/permission and tenant checks deny; B unchanged |
| API-11 | AI conversation/draft | B conversation/draft exists | Read or mutate B AI resource as A | Denied; no B messages, draft content, or approval state reaches A |
| API-12 | Knowledge search | A and B have matching documents | Search as A with broad/empty filters | Results contain only eligible A knowledge; tenant/status/permission filters apply before response |
| API-13 | Pagination/cursors | A and B have interleaved creation times/IDs | Reuse B cursor or alter cursor fields in A request | Invalid or denied; no cross-tenant continuation or count leak |
| API-14 | Client-provided tenant ID | A membership is active; payload names B | Submit B `tenant_id` in body/query/header | Server derives A context; request is denied or ignores untrusted tenant value according to contract |

## Repository and database-boundary cases

| ID | Boundary | Action | Expected result / evidence |
|---|---|---|---|
| REP-01 | Tenant-scoped patient repository | Query `patient_B` with A context | No row returned; query path includes validated tenant scope |
| REP-02 | Indirect relationship lookup | Load A appointment referencing patient/doctor/location | All related resources are tenant-consistent; mixed-tenant relationship fails closed |
| REP-03 | Mutation consistency | Insert/update A appointment using B patient or doctor ID | Application/repository rejects before commit; no partial row remains |
| REP-04 | Cross-tenant IDOR | Substitute B IDs in every resource repository port | Denial is consistent across direct and nested lookups |
| REP-05 | Bulk/search query | Use wildcard, empty filter, or broad sort as A | Only A rows and A-scoped aggregates/counts are returned |
| REP-06 | Transaction/outbox coupling | Attempt denied A-to-B mutation | Business row, audit success event, and outbox event are absent or carry only an approved denial record |
| REP-07 | Idempotency scope | Replay same key from A against B resource or payload | Key remains scoped to A actor/tenant/endpoint; no B result is replayed |
| REP-08 | Migration/constraint verification | Exercise tenant-owned FK and uniqueness constraints | Invalid tenant relationships are rejected; no unapproved composite-FK assumption is introduced |

## Cache and storage cases

| ID | Boundary | Action | Expected result / evidence |
|---|---|---|---|
| CACHE-01 | Key construction | Cache equivalent A and B lookups | Keys are unambiguous and tenant-scoped; values never collide |
| CACHE-02 | Cache hit | Prime B value, request equivalent A resource | Cache does not return B; authorization/source-of-truth check still applies |
| CACHE-03 | Cache miss/re-fetch | Expire A entry, request while B entry exists | Re-fetch uses A context and returns only A data |
| CACHE-04 | Invalidation | Mutate or archive A resource | A invalidation cannot delete, overwrite, or expose B cache data |
| STORAGE-01 | Private object path | A actor supplies B object key/path | Backend authorization denies before retrieval; no existence or metadata leak |
| STORAGE-02 | Derived object key | Create equivalent A/B file metadata where future file scope is enabled | Keys include tenant/resource scope and cannot collide; test remains gated while files are Post-MVP |

## Jobs, outbox, and asynchronous cases

| ID | Boundary | Action | Expected result / evidence |
|---|---|---|---|
| JOB-01 | Outbox context | Create an A event and dispatch asynchronously | Tenant A and originating actor context survive commit and worker handoff |
| JOB-02 | Worker authorization | Deliver an A job containing a B resource ID | Worker revalidates tenant/resource relationship and fails closed |
| JOB-03 | Queue isolation | Publish equivalent A/B jobs | Consumer cannot cross-read or acknowledge the other tenant's payload |
| JOB-04 | Retry/replay | Retry an A job after timeout or worker restart | Re-checks tenant and authorization; retry does not process B data or duplicate side effects |
| JOB-05 | Failure/dead-letter | Force an A job failure | Retry/dead-letter metadata remains tenant-scoped and does not expose payload to B actors |
| JOB-06 | Audit/outbox correlation | Process A event with request/correlation IDs | Audit and outbox evidence retain matching A tenant/actor context without unnecessary PHI |

## Search, RAG, and AI-context cases

| ID | Boundary | Action | Expected result / evidence |
|---|---|---|---|
| RAG-01 | Indexing | Index A and B documents with similar metadata | Tenant/status/permission metadata is stored and enforced; no shared unscoped index result |
| RAG-02 | Retrieval | Search as A using broad query | B chunks are absent before content reaches the application response or model |
| RAG-03 | Metadata tampering | Request B document ID or alter tenant/status filters as A | Request is denied/filtered; client-provided metadata cannot widen scope |
| RAG-04 | Pagination | Continue RAG results with B cursor or modified cursor | Cursor is rejected or remains A-scoped; no B result/count leak |
| AI-01 | Context assembly | Build AI context for an A actor/patient | Context contains only authorized A resources and minimum necessary fields |
| AI-02 | Prompt-injection attempt | A content asks the model to retrieve B data | Model text cannot authorize access; Tool Gateway denies and records safe evidence |
| AI-03 | Tool invocation | AI tool receives B resource reference under A context | Application authorization denies before repository access or model-visible output |
| AI-04 | Draft/approval | A actor attempts to approve a B draft | Denied; B draft and clinical record remain unchanged; human approval boundary is preserved |
| AI-05 | Error/output filtering | Cross-tenant tool/search access fails | Error and model-visible response contain no B PHI, identifiers, or sensitive metadata |

## Audit and security-signal cases

| ID | Boundary | Action | Expected result / evidence |
|---|---|---|---|
| AUD-01 | Sensitive read denial | A requests B patient/clinical data | Audit/security signal identifies A actor, A context, target reference, result, request ID, and safe metadata according to policy |
| AUD-02 | Mutation denial | A attempts B appointment/record mutation | No success audit or outbox event is emitted; denial evidence is attributable and redacted |
| AUD-03 | Audit visibility | A requests audit data containing B events | Access is denied or filtered by explicit audit permission and tenant scope |
| AUD-04 | Context integrity | Change tenant header, actor claim, or correlation value mid-request | Server-side derived context wins; tampering is denied and security signal is recorded |
| AUD-05 | Log/redaction review | Inspect errors, traces, job logs, and audit metadata after failed cases | No unnecessary B PHI, full clinical notes, credentials, or raw AI prompts are present |

## Execution order and release gates

1. Run authentication and membership setup checks, then establish isolated A/B
   synthetic fixtures.
2. Run API and repository cases for each domain before integrating that domain.
3. Run cache, storage, job/outbox, search/RAG, AI, and audit cases whenever the
   corresponding boundary exists; Post-MVP boundaries remain marked gated.
4. Include negative cases for IDOR, enumeration, mass assignment, cursor
   tampering, replay, retry, and client-provided tenant authority.
5. Preserve request/correlation IDs and safe denial evidence for triage.
6. S2 cannot pass until direct and indirect A/B cases pass across API,
   repositories, cache, jobs, search, RAG, AI context, and audit.

## Scope guard

- Runtime test implementation: NO
- Fixtures, database, migrations, ORM, cache, queue, or storage changes: NO
- API, security, AI-safety, or Data Model policy changes: NO
- Provider or deployment selection: NO
- Production data, PHI, secrets, and credentials: NO

## Acceptance criteria

- [x] Direct API isolation cases are listed.
- [x] Repository/database tenant-boundary cases are listed.
- [x] Cache and storage cases are listed.
- [x] Job, outbox, retry, and dead-letter cases are listed.
- [x] Search/RAG and AI-context/tool cases are listed.
- [x] Audit and security-signal cases are listed.
- [x] Synthetic fixture and expected denial/evidence rules are documented.
- [x] No runtime implementation or policy change is added.
- [ ] Affected domain/security owners review and approve the matrix before execution.

