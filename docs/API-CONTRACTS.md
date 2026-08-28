# API-CONTRACTS.md

> Canonical API contract for the Clinic AI Platform.
> Version: 0.1.0
> Status: Draft pending the blocking decisions listed at the end.

## 1. Purpose

This document defines what the platform API exposes to the frontend,
backend modules, AI subsystem, and approved external integrations.
It defines resource boundaries, operations, request and response shapes,
authorization expectations, errors, idempotency, audit behavior, and the
MVP API surface.

It does not define controllers, services, repositories, SQL, ORM code,
framework code, infrastructure providers, or database migrations.

This contract is subordinate to and must remain consistent with:

- `docs/product/system-definition.md`, which defines product scope,
  workflows, users, and responsibilities;
- `docs/architecture/architecture-decisions.md`, which defines module
  boundaries, AI safety, ownership, and architectural constraints;
- `docs/DATA-MODEL.MD`, which defines entities, relationships, status
  values, tenant scope, immutability, and data ownership.

Where those documents leave an API-affecting matter unresolved, this
document records it under `API Contract Open Decisions / Blocking Issues`
instead of silently choosing an implementation.

## 2. API Design Principles

- The API is resource-oriented and uses HTTP semantics consistently.
- JSON is the canonical representation for requests and responses.
- Public routes are versioned under `/api/v1`; incompatible changes require
  a new major API version.
- Every protected operation runs inside an authenticated and validated
  tenant context.
- A client-provided `tenant_id` is never sufficient evidence of access.
- Authentication establishes identity; authorization evaluates identity,
  tenant, role, permission, resource, relationship, and action.
- Validation is performed at the API boundary and again in the owning
  domain where business invariants require it.
- Errors use one canonical structure and do not disclose unnecessary PHI.
- Retry-sensitive mutations use idempotency where specified below.
- Collection responses use cursor pagination once the cursor contract is
  approved; the exact cursor policy remains open.
- Filtering, sorting, and search use allowlisted fields only.
- Mutations vulnerable to concurrent updates must detect stale state and
  return a conflict rather than silently overwrite data.
- Sensitive reads and mutations generate audit events according to the
  operation's `Audit` rule.
- API contracts expose domain capabilities, not database tables by default.
- AI is a controlled consumer of application capabilities and never an
  authorization authority or direct data-store client.

## 3. Base API Convention

### 3.1 Base path and representation

All version-one routes use:

```text
/api/v1
```

Requests with bodies use `Content-Type: application/json`.
Successful JSON responses use `Content-Type: application/json`.
Empty successful responses use `204 No Content`.

Request IDs are accepted from `X-Request-ID` when valid, otherwise the
server generates one. Every response includes `X-Request-ID`; the same
value is returned as `error.request_id` for failures.

### 3.2 JSON conventions

- UUIDs are canonical lowercase hyphenated UUID strings.
- Timestamps are RFC 3339 UTC strings, for example
  `2026-08-28T10:30:00Z`.
- Enum values use the uppercase string values defined by the data model.
- Missing fields and explicit `null` are distinct. A field is nullable only
  when the underlying contract says so; clients must not infer nullability.
- Response objects use stable resource names and do not expose storage keys,
  database implementation details, or internal repositories.
- Monetary amounts, when introduced for Post-MVP billing, will use an
  explicit currency and decimal-safe representation.

### 3.3 Pagination, filtering, and sorting

Collection responses have this conceptual shape:

```json
{
  "data": [],
  "pagination": {
    "next_cursor": null,
    "has_more": false
  }
}
```

Clients may request `limit`; the server enforces the approved bounded default
of `20` and maximum of `100`. The cursor is an opaque Base64URL/JSON value.
Collection ordering is an endpoint-approved stable keyset with a deterministic
unique tie-breaker; clients must not rely on offset pagination or an arbitrary
database column. Invalid cursors return HTTP `400` with
`INVALID_PAGINATION_CURSOR`. Tenant binding is server-validated and does not
grant authorization.

Filters use named parameters documented per endpoint. Sort fields and
directions are allowlisted per endpoint. Search is domain-specific and
must not become unrestricted query syntax.

## 4. Authentication

Protected routes require `Authorization: Bearer <token>` established through
the approved Auth0-style Managed CIAM OIDC/OAuth2 target profile behind the
platform's provider-neutral identity boundary. The approved session/token
strategy is a
hybrid short-lived access token with a 15-minute lifetime plus rotating refresh
token with a 7-day absolute session lifetime, replay detection, and
application-side server revocation. Refresh tokens rotate on every use and
replay revokes the token family. MFA is required for Staff,
Admin, and privileged clinical operations. Standard recovery is provider-managed
through the application callback/handoff flow. Recovery exceptions require
re-authentication or step-up MFA, explicit authorization, bounded scope, and
audit; insufficient-assurance sessions cannot invoke privileged operations.
The final provider contract, including region/residency and service-level
terms, remains open under the Architecture Decision Gate.
Public API and
domain code must use the normalized application identity context rather than
vendor-specific claims or SDKs.

An unauthenticated request to a protected route returns `401` with
`UNAUTHENTICATED`. A valid identity without the required permission returns
`403` with `FORBIDDEN`. Authentication failures must not reveal whether a
protected resource exists.

## 5. Tenant Context

The API establishes tenant context from the authenticated user and an
active, valid membership. A route may receive a tenant identifier in a path
or request body when selecting context or creating a tenant-scoped
resource, but the server must verify membership and authorization before
using it.

For tenant-owned resources, the server derives and validates the effective
tenant before querying or mutating the resource. Cross-tenant lookup,
inference, and mutation are forbidden. A resource identifier belonging to a
different tenant is treated as inaccessible and must not be distinguishable
from a missing resource.

`tenant_id` is returned in resource representations where it is part of the
canonical entity, but clients must not use it to bypass membership checks.
Patient identity remains tenant-scoped; cross-tenant patient matching is not
an MVP API.

## 6. Authorization Model

The API recognizes the roles defined in the project documents:

| API role | Meaning |
|---|---|
| `PATIENT` | Patient self-service actor |
| `DOCTOR` | Doctor/clinical decision-maker |
| Nurse / Clinical Staff | Separate application role for authorized clinical staff; permissions remain contextual |
| Receptionist | Separate application role for authorized operational staff; permissions remain contextual |
| `CLINIC_ADMIN` | Clinic owner/organization administrator |
| `SUPER_ADMIN` | Platform administrator with explicitly controlled privileged access |

Role alone is never sufficient where resource ownership, patient
relationship, appointment relationship, location, or permission is required.
Platform administrators do not receive unrestricted clinical access by
default. Privileged access is explicit and audited.

The canonical MVP permission policy is endpoint-specific least privilege with
default deny. Endpoint authorization must use only the documented operation
permissions and the required tenant, resource, relationship, location, and
clinical-need-to-know checks; an unspecified operation is denied.

The following endpoint summaries use these authorization dimensions:

- `authentication`: whether an authenticated identity is required;
- `tenant scope`: the tenant boundary applied;
- `authorization`: required role/permission;
- `resource ownership`: additional relationship or ownership rule;
- `special authorization`: operation-specific controls.

## 7. Identity API

### GET /api/v1/me

Purpose:

Return the authenticated platform user and permitted identity attributes.

Authentication:

Required.

Tenant scope:

Platform identity; no tenant is implied unless an active membership context
is supplied.

Authorization:

Authenticated user may read their own identity.

Request:

No body. Optional active tenant context follows the unresolved tenant-context
selection policy.

Response:

`200` with `id`, `email`, `phone` when permitted, `status`, and timestamps.

Errors:

`401 UNAUTHENTICATED`.

Idempotency:

Not applicable.

Audit:

Authentication/access policy determines whether ordinary self-read is
audited; privileged identity access is audited.

Notes:

Does not return credentials, secrets, or unrestricted internal metadata.

### GET /api/v1/me/memberships

Purpose:

List the authenticated user's tenant memberships and permitted roles.

Authentication:

Required.

Tenant scope:

All memberships visible to the authenticated user.

Authorization:

Authenticated user may read their own memberships.

Request:

No body.

Response:

`200` collection of membership resources containing membership ID, tenant
ID, role, status, and timestamps.

Errors:

`401 UNAUTHENTICATED`.

Idempotency:

Not applicable.

Audit:

No audit event for ordinary self-read; administrative access is audited.

Notes:

The response does not allow a client to activate a membership without the
server-side membership and authorization checks.

## 8. Tenant / Location API

### GET /api/v1/tenants/{tenant_id}

Purpose:

Retrieve the permitted clinic/tenant profile.

Authentication:

Required.

Tenant scope:

`tenant_id` must be an authorized tenant membership.

Authorization:

Authenticated tenant member for permitted profile fields; `CLINIC_ADMIN`
for administrative fields.

Request:

Path `tenant_id` UUID.

Response:

`200` tenant resource with `id`, `name`, `status`, `created_at`, and
`updated_at`.

Errors:

`401`, `403`, `404`, or `422 VALIDATION_ERROR`.

Idempotency:

Not applicable.

Audit:

Privileged access is audited; ordinary permitted profile reads follow the
data-access audit policy.

Notes:

Tenant statuses are `ACTIVE`, `SUSPENDED`, and `ARCHIVED`. Suspended or
archived tenants cannot perform ordinary mutations.

### PATCH /api/v1/tenants/{tenant_id}

Purpose:

Update permitted clinic profile/configuration fields.

Authentication:

Required.

Tenant scope:

The target tenant must be the caller's authorized tenant.

Authorization:

`CLINIC_ADMIN` with tenant-management permission.

Request:

JSON partial update of allowlisted profile/configuration fields. The server
must not accept arbitrary status changes or membership privilege escalation.

Response:

`200` updated tenant resource.

Errors:

`400`, `401`, `403`, `404`, `409`, or `422`.

Idempotency:

Not required by the current model; clients should use concurrency controls
once the open versioning decision is resolved.

Audit:

Required: tenant profile/configuration mutation.

Notes:

Cross-tenant updates are forbidden.

### GET /api/v1/tenants/{tenant_id}/locations

Purpose:

List locations belonging to an authorized tenant.

Authentication:

Required.

Tenant scope:

The path tenant.

Authorization:

Authorized tenant member for permitted fields; `CLINIC_ADMIN` for
administrative fields.

Request:

Path `tenant_id`; allowlisted `status`, `search`, `limit`, `cursor`, and
sort parameters only.

Response:

`200` paginated location resources.

Errors:

`401`, `403`, `404`, or `422`.

Idempotency:

Not applicable.

Audit:

Privileged access is audited.

Notes:

Location status follows the operational soft-delete/archive policy; exact
enum values are not fully established in the source documents.

### POST /api/v1/tenants/{tenant_id}/locations

Purpose:

Create a physical clinic location.

Authentication:

Required.

Tenant scope:

The path tenant.

Authorization:

`CLINIC_ADMIN` with location-management permission.

Request:

JSON location fields: `name`, `address`, `phone`, and approved status fields.

Response:

`201` created location resource and `Location` resource reference.

Errors:

`400`, `401`, `403`, `404`, `409`, or `422`.

Idempotency:

Required for retryable client creation; use `Idempotency-Key` scoped to
tenant and actor. Same key and same payload returns the original result;
same key with a different payload returns `409 IDEMPOTENCY_CONFLICT`.

Audit:

Required: location creation.

Notes:

No arbitrary tenant assignment is accepted in the body.

## 9. Patient API

### POST /api/v1/patients

Purpose:

Register a patient in the active tenant.

Authentication:

Required.

Tenant scope:

Active authorized tenant.

Authorization:

Nurse / Clinical Staff, Receptionist, `DOCTOR`, or `CLINIC_ADMIN` with patient-create permission;
patient self-registration is not established as an MVP API.

Request:

JSON patient fields from the data model: `user_id` when applicable,
`medical_record_number`, `full_name`, `date_of_birth`, `sex`, `phone`,
`email`, `address`, `emergency_contact`, and approved `status`.

Response:

`201` patient resource with tenant-scoped identity and permitted fields.

Errors:

`400`, `401`, `403`, `409`, or `422`.

Idempotency:

Required for retryable creation; same key/same payload returns the original
patient result, and same key/different payload returns
`409 IDEMPOTENCY_CONFLICT`.

Audit:

Required: `PATIENT_CREATED` without unnecessary PHI in metadata.

Notes:

Cross-tenant identity matching and automatic merging are not exposed.

### GET /api/v1/patients/{patient_id}

Purpose:

Retrieve a permitted tenant-scoped patient profile.

Authentication:

Required.

Tenant scope:

The patient's owning tenant only.

Authorization:

Role/permission plus patient relationship or operational need-to-know.
`PATIENT` may access only their own permitted profile.

Request:

Path `patient_id` UUID.

Response:

`200` permitted patient representation; sensitive fields are minimized by
role and permission.

Errors:

`401`, `403`, `404`, or `422`.

Idempotency:

Not applicable.

Audit:

Required: patient data access.

Notes:

The API must not reveal whether a same-ID patient exists in another tenant.

### PATCH /api/v1/patients/{patient_id}

Purpose:

Update permitted patient demographic/contact data.

Authentication:

Required.

Tenant scope:

The patient's owning tenant only.

Authorization:

`PATIENT` for permitted self-fields; Nurse / Clinical Staff, Receptionist, `DOCTOR`, or `CLINIC_ADMIN`
according to permission and workflow. Clinical record content is not
updated through this route.

Request:

JSON partial update of allowlisted profile/contact fields.

Response:

`200` updated patient resource.

Errors:

`400`, `401`, `403`, `404`, `409`, or `422`.

Idempotency:

Not required by the established model; stale concurrent updates must not
silently overwrite newer values.

Audit:

Required: patient data mutation.

Notes:

Clinical amendments use the clinical amendment workflow, not this route.

### GET /api/v1/patients

Purpose:

Search and list patients inside the active tenant.

Authentication:

Required.

Tenant scope:

Active tenant only.

Authorization:

Authorized staff, doctors, and clinic administrators; patients cannot use
this as a directory endpoint.

Request:

Allowlisted search fields such as `medical_record_number`, verified
`phone`/`email`, `full_name`, `date_of_birth`, plus approved filters,
`limit`, `cursor`, and sort parameters.

Response:

`200` paginated, field-minimized patient resources.

Errors:

`401`, `403`, `422`, or `429 RATE_LIMITED`.

Idempotency:

Not applicable.

Audit:

Required: patient search/access; do not log search terms containing PHI
unless policy requires it.

Notes:

No cross-tenant lookup or unrestricted field-name filtering.

## 10. Doctor Operations API

### GET /api/v1/doctors

Purpose:

List authorized doctors in the active tenant for patient and scheduling
workflows.

Authentication:

Required.

Tenant scope:

Active tenant only.

Authorization:

Authorized tenant members according to role and operational need.

Request:

Allowlisted `department_id`, `location_id`, `status`, `search`, `limit`,
`cursor`, and sort parameters.

Response:

`200` paginated doctor profile resources.

Errors:

`401`, `403`, `422`, or `429`.

Idempotency:

Not applicable.

Audit:

Administrative/privileged access is audited.

Notes:

Doctor ratings are Post-MVP and are not included.

### GET /api/v1/doctors/{doctor_id}

Purpose:

Retrieve an authorized doctor profile.

Authentication:

Required.

Tenant scope:

Doctor's owning tenant only.

Authorization:

Authorized tenant member; sensitive fields such as license information
require the corresponding permission.

Request:

Path `doctor_id` UUID.

Response:

`200` permitted doctor resource.

Errors:

`401`, `403`, `404`, or `422`.

Idempotency:

Not applicable.

Audit:

Privileged/sensitive access is audited.

Notes:

Doctor ownership remains with Engineer C / Operations.

### GET /api/v1/doctors/{doctor_id}/shifts

Purpose:

List working shifts used as the MVP scheduling resource.

Authentication:

Required.

Tenant scope:

Doctor and shift must belong to the active tenant.

Authorization:

`DOCTOR`, Nurse / Clinical Staff, Receptionist, and `CLINIC_ADMIN` according to scheduling permission;
patients receive only availability needed for booking, not unrestricted
shift administration.

Request:

Path `doctor_id`; date range, location, status, and approved pagination
parameters.

Response:

`200` paginated shift resources with `start_time`, `end_time`, location,
and status.

Errors:

`401`, `403`, `404`, `422`, or `429`.

Idempotency:

Not applicable.

Audit:

Administrative schedule access is audited.

Notes:

No `appointment_slots` resource is introduced for MVP.

### PATCH /api/v1/doctors/{doctor_id}

Purpose:

Update permitted doctor profile fields.

Authentication:

Required.

Tenant scope:

Doctor's owning tenant only.

Authorization:

Doctor self-update for permitted fields; `CLINIC_ADMIN` for clinic-managed
fields; all require explicit permission.

Request:

JSON partial update of allowlisted profile fields. Shift management is a
separate scheduling operation.

Response:

`200` updated doctor resource.

Errors:

`400`, `401`, `403`, `404`, `409`, or `422`.

Idempotency:

Not required by the established model; stale updates must be rejected once
the concurrency policy is finalized.

Audit:

Required: doctor profile mutation.

Notes:

Department and location relationships must be validated within the same
tenant.

## 11. Appointment API

Appointment creation and rescheduling are concurrency-sensitive. The
contract requires tenant validation, patient/provider validation,
availability validation, transactionally protected scheduling, and database
double-booking protection as specified by the Data Model. `CANCELLED` and
`NO_SHOW` appointments do not occupy the protected scheduling interval.

### POST /api/v1/appointments

Purpose:

Create a tenant-scoped appointment.

Authentication:

Required.

Tenant scope:

Active tenant; `patient_id`, `doctor_id`, and `location_id` must resolve to
that tenant.

Authorization:

Nurse / Clinical Staff, Receptionist, `DOCTOR`, or `CLINIC_ADMIN` with appointment-create permission;
patient self-booking is not established as an MVP route.

Request:

Headers: required opaque client-generated `Idempotency-Key`.
JSON: `location_id`, `patient_id`, `doctor_id`, `start_time`, `end_time`,
`reason`, and permitted `notes`. The server validates `start_time <
end_time`, working shift coverage, tenant relationships, and status rules.

Response:

`201` created appointment resource and `Appointment` reference. A replay
with the same key and same request returns the original response code and
resource.

Errors:

`400`, `401`, `403`, `404`, `409 CONFLICT`,
`409 IDEMPOTENCY_CONFLICT`, `422`, or `429`.

Idempotency:

Required. The key is opaque and scoped by tenant and actor. Same key plus
same request hash returns the original result. Same key plus a different
request returns `409 IDEMPOTENCY_CONFLICT`. Concurrent requests with the
same key cannot create duplicates.

Audit:

Required: appointment creation, including actor, tenant, resource ID,
result, and request ID without unnecessary PHI.

Notes:

Double-booking is rejected as a conflict. The API does not expose lock or
SQL implementation details.

### GET /api/v1/appointments/{appointment_id}

Purpose:

Retrieve a permitted appointment.

Authentication:

Required.

Tenant scope:

Appointment's owning tenant only.

Authorization:

Appointment relationship, patient relationship, assigned doctor,
operational role, or explicit administrative permission.

Request:

Path `appointment_id` UUID.

Response:

`200` appointment resource with status and permitted scheduling fields.

Errors:

`401`, `403`, `404`, or `422`.

Idempotency:

Not applicable.

Audit:

Required: sensitive appointment access according to audit policy.

Notes:

Cross-tenant IDs are indistinguishable from not found.

### GET /api/v1/appointments

Purpose:

List/search appointments for calendar and operational workflows.

Authentication:

Required.

Tenant scope:

Active tenant only.

Authorization:

Authorized staff, doctors, clinic administrators, or a patient viewing
their own appointments.

Request:

Allowlisted filters: date range, `doctor_id`, `patient_id`, `location_id`,
and appointment `status`; approved pagination and sort parameters.

Response:

`200` paginated appointment resources. Queue views are derived from
appointments with `CHECKED_IN` or `IN_PROGRESS`; no queue entity is
exposed.

Errors:

`401`, `403`, `422`, or `429`.

Idempotency:

Not applicable.

Audit:

Appointment access is audited according to sensitivity and role.

Notes:

Arbitrary database filtering is forbidden.

### PATCH /api/v1/appointments/{appointment_id}

Purpose:

Update permitted appointment details or reschedule an appointment.

Authentication:

Required.

Tenant scope:

Appointment's owning tenant only; all referenced resources must match it.

Authorization:

Assigned doctor, authorized staff, or clinic administrator according to
operation and permission. Patients may update only explicitly permitted
self-service fields if that capability is approved.

Request:

JSON partial update of allowlisted fields. Rescheduling requires the new
interval and repeats availability, working-shift, tenant, and
double-booking validation. The request must include `If-Match`; a stale
version returns `412 Precondition Failed`.

Response:

`200` updated appointment resource.

Errors:

`400`, `401`, `403`, `404`, `409 CONFLICT`, or `422`.

Idempotency:

Required for retryable rescheduling commands; same key/same request returns
the original result and same key/different request returns
`IDEMPOTENCY_CONFLICT`.

Audit:

Required: appointment modification/reschedule.

Notes:

Status changes must follow the allowed transition table below; this route
must not permit arbitrary status assignment.

### POST /api/v1/appointments/{appointment_id}/cancel

Purpose:

Cancel an appointment through an explicit state transition.

Authentication:

Required.

Tenant scope:

Appointment's owning tenant only.

Authorization:

Authorized staff, assigned doctor, clinic administrator, or other approved
actor according to cancellation policy.

Request:

Optional JSON cancellation reason. The command is explicit and does not
accept arbitrary target status.

Response:

`200` cancelled appointment resource.

Errors:

`401`, `403`, `404`, `409`, or `422`.

Idempotency:

Required for retryable command delivery; replay returns the original result.

Audit:

Required: appointment cancellation.

Notes:

MVP allows `PENDING -> CANCELLED` and `CONFIRMED -> CANCELLED`; invalid
transitions are rejected.

### POST /api/v1/appointments/{appointment_id}/check-in

Purpose:

Check in a patient and transition the appointment into the operational
queue view.

Authentication:

Required.

Tenant scope:

Appointment's owning tenant only.

Authorization:

Authorized receptionist/staff, doctor, or clinic administrator according to
check-in permission.

Request:

No arbitrary status field; optional validated check-in metadata.

Response:

`200` appointment resource with `CHECKED_IN` status and `checked_in_at`.

Errors:

`401`, `403`, `404`, `409`, or `422`.

Idempotency:

Required for retryable command delivery; a completed replay returns the
existing state.

Audit:

Required: check-in and resulting queue-relevant mutation.

Notes:

The queue is a derived view, not a separate MVP table or API resource.

### GET /api/v1/appointments/availability

Purpose:

Return availability for a doctor, location, and requested interval.

Authentication:

Required.

Tenant scope:

Active tenant only.

Authorization:

Authorized scheduling actor; results reveal only permitted operational
information.

Request:

Allowlisted `doctor_id`, `location_id`, and date/time range. The server
uses working shifts and existing non-cancelled/non-no-show appointments.

Response:

`200` availability representation; it is advisory and does not reserve a
slot.

Errors:

`401`, `403`, `404`, `422`, or `429`.

Idempotency:

Not applicable.

Audit:

Privileged scheduling access is audited.

Notes:

Availability does not replace the atomic create/reschedule checks.

### Appointment status transitions

The API exposes only domain-valid transitions:

```text
PENDING -> CONFIRMED
PENDING -> CANCELLED
CONFIRMED -> CHECKED_IN
CONFIRMED -> CANCELLED
CHECKED_IN -> IN_PROGRESS
IN_PROGRESS -> COMPLETED
CONFIRMED -> NO_SHOW
```

The `CONFIRMED -> NO_SHOW` transition is exposed only through an explicit
application transition command, protected by the approved role/permission
policy, transition validation, idempotency, and audit. AI cannot invoke this
command unless separately approved as a bounded authorized tool through the AI
Tool Gateway. Invalid or unsupported transitions return `409`; the exact
responsible role/permission remains governed by the authorization matrix.

## 12. Clinical API

Clinical content is highly sensitive. Every clinical route is tenant-scoped,
resource-authorized, and audited. The API distinguishes the logical
`medical_records` resource from immutable `medical_record_versions`.

### POST /api/v1/encounters

Purpose:

Create a clinical encounter for an authorized patient, optionally linked to
an appointment.

Authentication:

Required.

Tenant scope:

Active tenant; patient, appointment, and doctor references must be in that
tenant.

Authorization:

`DOCTOR` or authorized Nurse / Clinical Staff with encounter-create permission.

Request:

JSON: `patient_id`, optional `appointment_id`, `doctor_id`, and permitted
start/status fields. Initial status follows the encounter model: `OPEN`,
`IN_PROGRESS`, `COMPLETED`, or `CANCELLED` only through valid transitions.

Response:

`201` encounter resource.

Errors:

`400`, `401`, `403`, `404`, `409`, or `422`.

Idempotency:

Required for retryable creation commands to prevent duplicate encounters.

Audit:

Required: encounter creation.

Notes:

Walk-in encounters may be supported because the model allows an encounter
without a scheduled appointment.

### GET /api/v1/encounters/{encounter_id}

Purpose:

Retrieve an authorized encounter and permitted clinical context.

Authentication:

Required.

Tenant scope:

Encounter's owning tenant only.

Authorization:

Patient relationship, treating doctor, authorized clinical staff, or
explicit administrative clinical-access permission.

Request:

Path `encounter_id` UUID.

Response:

`200` encounter resource with permitted references and timestamps.

Errors:

`401`, `403`, `404`, or `422`.

Idempotency:

Not applicable.

Audit:

Required: clinical record access.

Notes:

The response must be field-minimized according to authorization.

### POST /api/v1/encounters/{encounter_id}/medical-records

Purpose:

Create the initial logical medical record and its first draft version for an
encounter.

Authentication:

Required.

Tenant scope:

Encounter's owning tenant only.

Authorization:

Authorized doctor or clinical staff according to documentation permission.

Request:

JSON clinical content for a new draft version: diagnosis, symptoms,
clinical notes, treatment plan, and creator context. Content is versioned;
clients do not supply arbitrary database version numbers.

Response:

`201` medical record summary plus current draft version resource.

Errors:

`400`, `401`, `403`, `404`, `409`, or `422`.

Idempotency:

Required for retryable creation.

Audit:

Required: clinical record creation/modification.

Notes:

This is not a generic raw-table CRUD endpoint.

### GET /api/v1/medical-records/{medical_record_id}

Purpose:

Read the logical medical record and an authorized current version.

Authentication:

Required.

Tenant scope:

Medical record's owning tenant only.

Authorization:

Patient relationship, treating doctor, authorized clinical staff, or
explicit permission.

Request:

Path `medical_record_id` UUID; optional approved version selector.

Response:

`200` medical record metadata and permitted version content. Finalized
versions remain identifiable as finalized.

Errors:

`401`, `403`, `404`, or `422`.

Idempotency:

Not applicable.

Audit:

Required: clinical record access.

Notes:

Do not expose a different-tenant record through error differences.

### POST /api/v1/medical-records/{medical_record_id}/review

Purpose:

Move a draft clinical record into the review stage.

Authentication:

Required.

Tenant scope:

Medical record's owning tenant only.

Authorization:

Authorized clinical actor with review permission.

Request:

No arbitrary status field; optional review metadata.

Response:

`200` medical record with `IN_REVIEW` state.

Errors:

`401`, `403`, `404`, `409`, or `422`.

Idempotency:

Required for retryable command delivery.

Audit:

Required: clinical lifecycle mutation.

Notes:

The canonical external intermediate status is `IN_REVIEW`. The endpoint name
`/review` describes the transition action.

### POST /api/v1/medical-records/{medical_record_id}/finalize

Purpose:

Finalize the current reviewed clinical record version.

Authentication:

Required.

Tenant scope:

Medical record's owning tenant only.

Authorization:

Authorized doctor/clinician with finalization permission. AI cannot call
this operation as an autonomous actor.

Request:

No arbitrary overwrite or target status; optional finalization metadata.

Response:

`200` finalized medical record and immutable current version.

Errors:

`401`, `403`, `404`, `409`, or `422`.

Idempotency:

Required for retryable command delivery.

Audit:

Required: clinical record finalization.

Notes:

After finalization, clinical content cannot be overwritten.

### POST /api/v1/medical-records/{medical_record_id}/amendments

Purpose:

Create a correction as a new clinical record version.

Authentication:

Required.

Tenant scope:

Medical record's owning tenant only.

Authorization:

Authorized clinician with amendment permission and a valid relationship to
the patient/encounter.

Request:

JSON new version content and mandatory `amendment_reason`. The finalized
original is never edited.

Response:

`201` new version and medical record summary with updated current version.

Errors:

`400`, `401`, `403`, `404`, `409`, or `422`.

Idempotency:

Required for retryable amendment creation.

Audit:

Required: clinical record amendment, including reason and references but
not duplicating the full PHI payload.

Notes:

There is intentionally no generic `PUT /medical-records/{id}` overwrite
operation.

### GET /api/v1/patients/{patient_id}/allergies

Purpose:

Read authorized patient allergy information for clinical workflow and AI
tool use.

Authentication:

Required.

Tenant scope:

Patient's owning tenant only.

Authorization:

Authorized clinical actor or patient for permitted self-view.

Request:

Path `patient_id`; approved status/pagination filters only.

Response:

`200` field-minimized allergy collection with allergen, reaction, severity,
status, and timestamps. Severity values are `MILD`, `MODERATE`, `SEVERE`,
and `UNKNOWN`.

Errors:

`401`, `403`, `404`, or `422`.

Idempotency:

Not applicable.

Audit:

Required: clinical data access.

Notes:

Creation/update operations for allergies are not included until the MVP
clinical write workflow explicitly establishes them.

## 13. Clinical Immutability and Post-MVP Clinical Resources

The API never exposes a generic overwrite for finalized clinical content.
Finalized versions are immutable; corrections use amendments/versioning.
AI-generated content remains separate until a human-approved clinical
workflow creates or finalizes an authoritative record.

The following Data Model entities are explicitly Post-MVP and have no MVP
CRUD surface:

| Entity | API status |
|---|---|
| `prescriptions`, `prescription_items` | POST-MVP |
| `lab_results` | POST-MVP |
| `clinical_files` | POST-MVP (approved out of MVP) |
| `doctor_ratings` | POST-MVP |

When approved, prescriptions must preserve the rule that AI cannot directly
finalize them.

## 14. AI API

AI routes are application routes behind the AI Gateway. They authenticate
the user, resolve tenant context, authorize requested tools, select minimum
necessary context, validate output, and audit sensitive operations.

The approved MVP AI platform direction is self-hosted Dify behind the AI
Gateway and application-controlled Tool Gateway. External LLM/Embedding
Providers are accessed only through controlled Gateway adapters. API clients and domain
services must depend on the Gateway contract, not directly on Dify APIs.

The approved MVP model/provider profile is Managed External LLM plus Managed
Embedding. Specific provider/model identifiers, embedding dimension, retention,
knowledge exceptions, tool permissions, and operational limits are not public
API contract values. MVP retrieval is tenant-only; global knowledge is not
available without separate Product/Security approval. Tool Gateway capability
classes are Read, Summarize, Draft, and Human-approved Action, with actor,
tenant, and policy context enforced server-side. Exact numeric limits remain
operational/release configuration.

The MVP execution strategy uses `gpt-4o-2024-08-06` as the primary generative
model and `text-embedding-3-small` at dimension `1536` as the primary embedding
model, with no automatic fallback. Provider/model identifiers remain behind
the Gateway contract and are not exposed through public API responses.

AI persistence is minimum-necessary and category-specific. Raw prompt/response
content is not returned or retained by default; any retained content is
redacted and policy-controlled. Export and deletion are available only through
authorized workflows and do not imply unrestricted raw AI-log access.

The approved retention behavior is 30 days from `last_message_at` for
conversation/message resources with a maximum 24-hour cleanup lag, 7 days for
unapproved drafts, and post-approval draft-content purge after audit metadata
is recorded. Raw prompt/context content is not retained by default; AI
metadata follows the approved 90-day policy. Expiry and deletion remain
authorized, tenant-scoped workflows.

Knowledge/document deletion must honor inherited Legal Hold across tenant,
explicitly supported canonical-resource, and document scopes. Invalid or
unknown resource mappings fail closed; Legal Hold does not grant access or
change public authorization behavior.

AI MVP release requires the approved clinical safety evaluation gate. The
Golden Dataset is jointly owned by Clinical and AI and is versioned in an
approved environment without real PHI outside approved controls. Exact
quality and latency thresholds are not public API values. The approved
internal safety baseline is context recall and precision of at least 85%,
faithfulness/hallucination failure below 2%, and 100% redaction for classified
sensitive fields; latency targets remain TBD and operational.
application must not promote AI behavior that fails the versioned Golden
Dataset, classified-field PII redaction, or Clinical/Security evaluation gates.

The MVP AI API surface is read, summarization, and draft-first. AI write tools
are default-deny and cannot perform autonomous clinical mutations. Tenant-
scoped knowledge, minimum-necessary context, output validation, audit
metadata, and fail-closed behavior are mandatory; raw prompt/response
retention follows the approved data policy.

### POST /api/v1/ai/conversations

Purpose:

Create an AI conversation scoped to the current tenant and optional patient
or encounter context.

Authentication:

Required.

Tenant scope:

Active tenant; optional patient/encounter must be authorized and tenant
consistent.

Authorization:

Authorized user with AI-assistant permission.

Request:

JSON: optional `patient_id`, `context_type`, and `context_id`; no raw
database or arbitrary context source.

Response:

`201` conversation resource with status and permitted context references.

Errors:

`400`, `401`, `403`, `404`, `422`, or `429`.

Idempotency:

Required when the client retries conversation creation.

Audit:

Required when a sensitive patient/encounter context is attached.

Notes:

Conversation data is not the authoritative clinical record.

### POST /api/v1/ai/conversations/{conversation_id}/messages

Purpose:

Submit a user message and receive an AI response or asynchronous processing
reference.

Authentication:

Required.

Tenant scope:

Conversation's tenant only.

Authorization:

Conversation owner or explicitly authorized participant; patient context
requires patient/resource authorization.

Request:

JSON message content and approved client context references. The client
cannot select unauthorized tools, model providers, database queries, or
arbitrary files.

Response:

`200` validated assistant response or `202` processing reference when
asynchronous work is selected by the approved architecture.

Errors:

`400`, `401`, `403`, `404`, `409`, `422`, or `429`.

Idempotency:

Required for retryable message submission; same key/same payload returns
the original result.

Audit:

Required: AI invocation and sensitive data access/tool execution as
applicable. Do not log complete prompts/responses by default.

Notes:

AI output is advisory unless it is explicitly represented as a draft.

### GET /api/v1/ai/conversations/{conversation_id}

Purpose:

Retrieve an authorized conversation and permitted message references.

Authentication:

Required.

Tenant scope:

Conversation's tenant only.

Authorization:

Conversation owner/participant with appropriate permission.

Request:

Path `conversation_id`; approved pagination parameters for messages.

Response:

`200` conversation resource and permitted messages. Sensitive content is
minimized according to retention and PHI policy.

Errors:

`401`, `403`, `404`, or `422`.

Idempotency:

Not applicable.

Audit:

Required for sensitive conversation access.

Notes:

The conversation is not a medical record.

### POST /api/v1/ai/drafts

Purpose:

Generate a clinical or administrative AI draft through an authorized tool
workflow.

Authentication:

Required.

Tenant scope:

Active tenant; patient and encounter references must be authorized.

Authorization:

Authorized clinician/user with draft-generation permission.

Request:

JSON: `patient_id`, optional `encounter_id`, `draft_type`, and approved
context/reference inputs. No direct database access or arbitrary tool
selection is accepted from the client.

Response:

`201` AI draft with status `GENERATED` or `202` processing reference.

Errors:

`400`, `401`, `403`, `404`, `422`, or `429`.

Idempotency:

Required for retryable draft generation.

Audit:

Required: AI tool invocation, sensitive data access, and draft creation.

Notes:

The draft is not authoritative and cannot finalize a clinical record.

### POST /api/v1/ai/drafts/{draft_id}/review

Purpose:

Mark an AI draft as under human review.

Authentication:

Required.

Tenant scope:

Draft's owning tenant only.

Authorization:

Authorized human reviewer; AI actors cannot perform the review action.

Request:

No arbitrary status assignment.

Response:

`200` draft with `REVIEWING` status.

Errors:

`401`, `403`, `404`, `409`, or `422`.

Idempotency:

Required for retryable command delivery.

Audit:

Required: AI draft review transition.

Notes:

Reviewing does not make the draft clinical truth.

### POST /api/v1/ai/drafts/{draft_id}/approve

Purpose:

Approve an AI draft for controlled handoff to the Clinical Application
Service.

Authentication:

Required.

Tenant scope:

Draft's owning tenant only.

Authorization:

Authorized human clinician/reviewer with approval permission. The AI cannot
approve its own output.

Request:

Optional human review metadata; no client-supplied actor substitution.

Response:

`200` approved draft and a controlled clinical-service handoff reference;
the exact resulting clinical resource depends on the approved workflow.

Errors:

`401`, `403`, `404`, `409`, or `422`.

Idempotency:

Required for retryable approval delivery.

Audit:

Required: AI draft approval, approver, tenant, draft, result, and request ID.

Notes:

Approval is not a direct AI write path to finalized records. It is an explicit
application action by an authorized clinician and requires step-up MFA for the
privileged clinical operation. The application revalidates the strong
`If-Match`/OCC version, tenant, authorization, business state, and draft state;
a stale draft returns to review and requires renewed confirmation. Approval,
rejection, edit, and resubmission are audited with actor, timestamp,
draft/resource reference, version, and provenance.

### POST /api/v1/ai/drafts/{draft_id}/reject

Purpose:

Reject an AI draft.

Authentication:

Required.

Tenant scope:

Draft's owning tenant only.

Authorization:

Authorized human reviewer; AI cannot reject its own output as a final
governance action.

Request:

Optional rejection reason.

Response:

`200` draft with `REJECTED` status.

Errors:

`401`, `403`, `404`, `409`, or `422`.

Idempotency:

Required for retryable command delivery.

Audit:

Required: AI draft rejection.

Notes:

Draft statuses are `GENERATED`, `REVIEWING`, `APPROVED`, `REJECTED`, and
`EXPIRED`.

## 15. RAG / Knowledge Retrieval API

Knowledge retrieval is part of MVP behind an application abstraction. The
public API does not expose embeddings, vector dimensions, storage keys, or
vector database details.

### POST /api/v1/ai/knowledge/search

Purpose:

Retrieve authorized approved knowledge for an AI-assisted workflow.

Authentication:

Required.

Tenant scope:

The active tenant plus approved globally visible knowledge, if and only if
the final knowledge-governance decision permits it.

Authorization:

Caller must have knowledge-retrieval permission. The service filters by
tenant, document status, document access scope, and user permissions.

Request:

JSON: bounded `query`, approved filters, and bounded result limit. The
client cannot submit embedding vectors, arbitrary metadata expressions, or
instructions that override authorization.

Response:

`200` ranked result references/snippets permitted for the caller. Results
are treated as untrusted data and need not be exposed directly to the end
user when used only as AI context.

Errors:

`400`, `401`, `403`, `422`, or `429`.

Idempotency:

Not applicable for a read/search operation.

Audit:

Required when sensitive tenant knowledge is retrieved or used in AI context.

Notes:

The AI does not directly query PostgreSQL or the vector store. Global versus
tenant-specific knowledge behavior is an open governance decision.

## 16. Billing API — POST-MVP

Billing is explicitly deferred from MVP. `invoices` and
`payment_webhook_events` remain future-ready data entities, but no billing
endpoint is part of the MVP contract.

Future Billing APIs must define invoice retrieval/creation, payment status,
payment-provider boundaries, signed webhook handling, and idempotency using
`UNIQUE(provider, provider_event_id)`. They must not be treated as current
MVP APIs.

## 17. File API — POST-MVP

`clinical_files` are explicitly Post-MVP under the approved Product decision.
When enabled in a future phase,
the API must expose only authorized upload initiation, completion/metadata,
download/access, and supported archive/deletion operations. It must never
expose arbitrary storage keys, provider credentials, or raw object-storage
internals.

## 18. Audit API

Audit events are an internal cross-cutting capability owned by Identity &
Security. No general-purpose public CRUD API is included in MVP.

If an admin-visible or exportable audit view is later approved, it must be a
read-only, permissioned, tenant-scoped query that exposes resource
references and event metadata without unnecessary clinical content. Audit
events conceptually contain `id`, `tenant_id`, `actor_id`, `action`,
`resource_type`, `resource_id`, `result`, `request_id`, `metadata`, and
`created_at`; complete notes, histories, prompts, and responses are not
stored or returned unless explicitly required by policy.

## 19. Canonical Error Model

All API errors use one structure:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": {},
    "request_id": "req_01H..."
  }
}
```

Canonical codes:

| Code | Meaning |
|---|---|
| `UNAUTHENTICATED` | Credentials are absent or invalid |
| `FORBIDDEN` | Identity is valid but lacks permission/resource access |
| `NOT_FOUND` | Resource is absent or intentionally undiscoverable |
| `VALIDATION_ERROR` | Request shape or field validation failed |
| `INVALID_PAGINATION_CURSOR` | Cursor is malformed, invalid, expired, or incompatible |
| `CONFLICT` | Current resource/business state prevents the operation |
| `IDEMPOTENCY_CONFLICT` | Same key was used with a different request |
| `RATE_LIMITED` | Caller exceeded an approved rate limit |
| `INTERNAL_ERROR` | Unexpected server failure |

AI responses for medium-risk content must identify advisory/draft-only status
and required human review. High-risk, emergency, ambiguous, or conflicting
requests must return a safe deferral and escalation outcome; they must not
return authoritative clinical advice or perform a mutation.

## 20. HTTP Status Conventions

| Status | Canonical use |
|---|---|
| `200` | Successful read or mutation returning a representation |
| `201` | Resource or command result created |
| `202` | Accepted asynchronous processing |
| `204` | Successful operation with no response body |
| `400` | Malformed request or unsupported request semantics |
| `401` | Missing/invalid authentication; client must authenticate |
| `403` | Authenticated but not authorized; retrying credentials does not grant access |
| `404` | Resource not found or intentionally hidden across tenant boundaries |
| `409` | State, concurrency, scheduling, or idempotency conflict |
| `422` | Well-formed request with invalid domain/field values |
| `429` | Rate limit exceeded |
| `500` | Unexpected internal failure |

## 21. Concurrency

Appointment creation and rescheduling must protect the scheduling resource
and reject double booking. Availability is advisory; only the mutation
operation establishes the authoritative result.

Clinical amendments must create a new version and must not overwrite a
finalized version. AI draft approval must validate that the draft is still
in an approvable state. Payment operations, when introduced, must protect
webhook event uniqueness and processing state.

The approved concurrency direction is PostgreSQL scheduling constraints with
application transaction handling and idempotency, plus standardized
optimistic concurrency for mutations. Canonical mutable MVP resources use a
monotonic `BIGINT` version. `GET` resources expose a strong `ETag` based on
the current version; `PUT`/`PATCH`/`DELETE` mutations require matching
`If-Match`. Stale versions return `412 Precondition Failed`; PostgreSQL
exclusion-constraint conflicts return `409 Conflict`. Authorization runs
before version validation. Resource JSON does not expose `version` by
default. `medical_record_versions` remains append-only/immutable and is not
updated through the OCC path. Appointment reschedule/cancel and clinical
amendment/approval mutations do not automatically retry after `412`; clients
must re-fetch and obtain user confirmation. Patient/profile and tenant metadata
mutations may retry at most once only when explicitly idempotent and protected
by the required tenant/actor-scoped idempotency key. AI write and approval
operations do not automatically retry and require human confirmation when
stale. All retry/re-fetch flows re-run authentication, authorization, and
tenant checks; `409 Conflict` requires explicit business resolution.

## 22. Idempotency

`Idempotency-Key` is an opaque client-generated value sent as a request
header. It is not a business identifier and must not contain PHI.

Required operations include appointment creation, appointment rescheduling
and commands, retry-sensitive patient/location/encounter/clinical/AI
mutations, and future payment/webhook processing.

The key is scoped by tenant and actor, matching the Data Model uniqueness
rule `(tenant_id, actor_id, key)`. The server stores a request hash and
original result reference. Same key plus same payload returns the original
result. Same key plus different payload returns `409
IDEMPOTENCY_CONFLICT`. Processing retries cannot create duplicates. Idempotency
TTL is domain-specific: synchronous retry-sensitive mutations use a bounded
operation-class window, while outbox-backed operations retain state through
business completion plus an approved grace period. After expiry, a request is
new and must pass current auth, authorization, tenant, validation, and OCC
checks. AI approval idempotency cannot bypass human approval. Exact numeric TTL
and grace values are operational configuration.

## 23. Audit Requirements

The API must generate audit events for, at minimum:

- authentication success/failure and permission changes;
- patient creation, access, and important mutations;
- appointment creation, modification, cancellation, check-in, and access;
- encounter and clinical record access, modification, finalization, and
  amendment;
- AI invocation, sensitive data access, tool execution, draft creation,
  approval, and rejection;
- privileged tenant, membership, role, and administrative operations;
- future billing and file access operations.

Audit records identify actor, tenant, action, resource reference, result,
request ID, and safe metadata. They must not unnecessarily duplicate PHI,
complete clinical notes, complete medical histories, or complete AI prompts
and responses.

## 24. Rate Limiting

Rate limiting is required for authentication-related routes, AI invocation,
patient search, and any future public or upload route. AI requests additionally
use bounded context size, tool-call, tenant/actor, and cost controls. Exact
numeric values remain operational/release configuration. A limited request
returns `429 RATE_LIMITED` with the canonical error shape and request ID.

## 25. API Security

- Require the approved authentication mechanism for protected routes.
- Resolve tenant context from authenticated membership; never trust a raw
  client tenant ID.
- Enforce resource-level authorization and IDOR protection for every
  tenant-owned resource.
- Validate and bound all inputs, filters, search expressions, and request
  sizes.
- Minimize response fields according to role, relationship, and sensitivity.
- Never expose arbitrary storage keys, credentials, secrets, SQL, or ORM
  details.
- Validate webhook signatures before any future payment processing.
- Keep AI behind the AI Gateway and explicit authorized tools.
- Treat retrieved knowledge as untrusted data, not instructions.
- Do not allow AI to bypass authorization, cross tenants, access PostgreSQL,
  directly modify clinical records, independently prescribe, or finalize
  records without the required human workflow.
- Use the deeper security specification in the future `docs/SECURITY.md`
  for implementation-level controls.

## 26. API ↔ DATABASE MAPPING

| API Resource | Domain Owner | Database Entity | Tenant Scoped | MVP/Post-MVP |
|---|---|---|---|---|
| user | Identity | `users` | No | MVP |
| membership | Identity/Tenant | `memberships` | Yes | MVP |
| tenant | Tenant | `tenants` | Platform/tenant root | MVP |
| location | Tenant | `locations` | Yes | MVP |
| patient | Patient | `patients` | Yes | MVP |
| department | Doctor | `departments` | Yes | MVP, read/use as needed |
| doctor | Doctor | `doctors` | Yes | MVP |
| doctor shift | Doctor | `doctor_working_shifts` | Yes | MVP |
| appointment | Appointment | `appointments` | Yes | MVP |
| encounter | Clinical | `encounters` | Yes | MVP |
| medical record | Clinical | `medical_records` | Yes | MVP |
| medical record version | Clinical | `medical_record_versions` | Through medical record | MVP |
| allergy | Clinical | `patient_allergies` | Yes | MVP read workflow |
| AI conversation | AI | `ai_conversations` | Yes | MVP |
| AI message | AI | `ai_messages` | Through conversation | MVP |
| AI draft | AI | `ai_drafts` | Yes | MVP |
| knowledge document/chunk | AI/RAG | `knowledge_documents`, `knowledge_chunks` | Tenant or approved global | MVP |
| audit event | Audit | `audit_events` | Yes where applicable | MVP internal |
| idempotency record | Shared/Platform | `idempotency_keys` | Yes, actor-scoped | MVP internal |
| outbox event | Shared/Platform | `outbox_events` | Yes where applicable | MVP internal |
| prescription | Clinical | `prescriptions`, `prescription_items` | Yes | POST-MVP |
| lab result | Clinical | `lab_results` | Yes | POST-MVP |
| clinical file | Clinical | `clinical_files` | Yes | POST-MVP (approved out of MVP) |
| invoice | Billing | `invoices` | Yes | POST-MVP |
| payment webhook event | Billing | `payment_webhook_events` | Provider-scoped | POST-MVP |
| doctor rating | Doctor | `doctor_ratings` | Yes | POST-MVP |

## 27. API ↔ TEAM OWNERSHIP

| API Domain | Owning Team | Responsible Module |
|---|---|---|
| Identity, authentication, authorization, memberships | Engineer A | Identity & Security |
| Tenant and location | Engineer A | Tenant / Location |
| Patient | Engineer B | Patient |
| Clinical and encounters | Engineer B | Clinical |
| Doctor operations and appointments | Engineer C | Doctor / Appointment / Operations |
| Billing and notification | Engineer C | Billing / Notification (Post-MVP) |
| AI, drafts, tools, context, memory, RAG | Engineer D | AI Platform |
| Audit | Engineer A | Audit |
| Idempotency and outbox schema | Engineer A | Shared/Platform infrastructure |

Other domains may write shared infrastructure rows within their own
transaction, but do not modify shared schema. Cross-domain behavior uses
public application contracts and requires affected-owner review.

## 28. MVP API SURFACE

### MVP

MVP has 8 API domains:

1. Identity
2. Tenant / Location
3. Patient
4. Doctor Operations
5. Appointment
6. Clinical
7. AI Assistant / RAG
8. Audit (internal cross-cutting capability)

The MVP contract defines 31 concrete endpoint operations:

- Identity: 2
- Tenant / Location: 4
- Patient: 4
- Doctor Operations: 4
- Appointment: 7
- Clinical: 8
- AI Assistant: 7
- RAG: 1
- Audit: internal only, no public endpoint

### POST-MVP

- Billing: invoices, payment status, payment integration, and signed
  idempotent webhook processing.
- Notification: email/SMS/reminders and preferences.
- Prescriptions and prescription items.
- Laboratory results and advanced integrations.
- Clinical file upload/download/metadata operations and AI file ingestion.
- Doctor ratings.
- Cross-tenant patient identity matching/merging.

## 29. TRACEABILITY

| API | System Definition Reference | Architecture Reference | Data Model Reference |
|---|---|---|---|
| Identity and memberships | Sections 3.1, 5.1, 6.1-6.2, 25 | Sections 10-18, 63 | Sections 6-7 |
| Tenant/location | Sections 4, 5.2, 6.2, 25 | Sections 10-12, 63 | Sections 4-5 |
| Patient | Sections 3.5, 5.3, 6.3, 25 | Sections 13, 63 | Sections 8-9 |
| Doctor operations | Sections 5.10, 6.4, 25 | Sections 7, 63 | Sections 10-12 |
| Appointment | Sections 5.4, 6.4-6.5, 25 | Sections 42-44, 63 | Sections 13-16 |
| Encounter/clinical | Sections 5.5, 6.6, 11, 25 | Sections 19-21, 63 | Sections 17-27 |
| AI assistant/drafts | Sections 7-11 | Sections 22-34, 63 | Sections 29-34, 59-60 |
| RAG | Section 10 | Sections 29-31 | Sections 33-34 |
| Audit | Section 14 | Section 35 and ownership section | Sections 39-40 |
| Billing | Section 26 (out of MVP) | Section 70 | Sections 35-38 |

## 30. API Contract Remaining Dependencies

The following entries record remaining implementation controls or
production-release dependencies. Approved boundaries are not reopened here.

| ID | Issue | Affected API | Affected document(s) | Why it blocks | Recommended owner |
|---|---|---|---|---|---|
| API-001 | Auth0-style Managed CIAM OIDC/OAuth2 target profile, 15-minute access token, 7-day rotating refresh session, MFA scope, replay-family revocation, account-status guardrails, and provider-managed recovery with application-enforced step-up exceptions are approved; final provider contract, region/residency, and service-level terms remain open. | All protected APIs | Architecture Decision Gate; System Definition open decisions | Final provider assurance and contract terms cannot be finalized. | Engineer A / Security |
| API-004 | Approved implementation control: enforce domain-specific retry allowlist and re-check security context on retry/re-fetch. | Appointment reschedule/update, clinical amendment/approval, tenant/profile mutations | Architecture Decision Gate and concurrency guidance | Must remain within approved idempotency and human-confirmation boundaries. | Engineer C/B with Architecture owner |
| API-006 | Approved implementation control: enforce domain-specific idempotency TTL and expiry behavior; exact numeric TTL/grace values are operational configuration. | Appointment and retry-sensitive mutations | DATA-MODEL Sections 16, 38, 51; Architecture Section 44 | Must apply operation-class and outbox-completion rules. | Engineer A with Product/Security |
| API-007 | AI model/retention governance and tenant-only knowledge boundary are approved for MVP; provider evidence and operational limits remain release dependencies. | AI conversations, messages, drafts, RAG search | Architecture Decision Gate; Data Model Sections 33-34, 51, 60 | Provider evidence and release controls remain to be finalized. | Engineer D with Security/Product |
| API-010 | MVP-scoped governance boundary is approved; clinical retention values, residency, export/deletion/anonymization scope, audit policy and backup targets remain production-release dependencies. | Patient, Clinical, AI, Audit, future File/Billing APIs | System Definition; Architecture Decision Gate; Data Model | Release behavior must not be enabled without the applicable policy and evidence. | Product, Compliance, Security |

## 31. Final Validation Report

Cross-document validation completed against:

- `docs/product/system-definition.md`
- `docs/architecture/architecture-decisions.md`
- `docs/DATA-MODEL.MD`

Validated: domain names, team ownership, MVP/Post-MVP scope, entity names,
tenant boundaries, roles, AI restrictions, human approval, clinical
immutability, appointment idempotency, audit requirements, Billing scope,
RAG scope, and file handling.

The implementation contract is ready for approved MVP work. Provider
assurance, policy values, and operational release gates remain separate
dependencies.
