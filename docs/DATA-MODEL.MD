# DATA-MODEL.md

# Clinic Management Platform + AI Medical Assistant

**Database & Data Ownership Specification**

> Version: 1.0
> Status: Proposed baseline
> Database: PostgreSQL 16
> Vector Extension: pgvector
> Architecture: Multi-tenant Modular Monolith
> Source of Truth: PostgreSQL

---

# 1. Purpose

This document defines the canonical data model for the clinic management platform.

It specifies:

* entities;
* attributes;
* relationships;
* primary keys;
* foreign keys;
* unique constraints;
* indexes;
* tenant boundaries;
* lifecycle states;
* immutability rules;
* ownership;
* deletion policies;
* migration dependencies.

This document is the source of truth for database implementation.

Application code MUST NOT invent database semantics that contradict this document.

---

# 2. Database Principles

## 2.1 PostgreSQL is the source of truth

PostgreSQL is authoritative for all transactional data.

Redis MUST NOT become the source of truth.

---

## 2.2 Every tenant-owned resource is tenant-scoped

Tenant-owned tables MUST contain:

```text
tenant_id
```

unless there is an explicit architectural reason not to.

---

## 2.3 Tenant isolation is mandatory

A query for a tenant-owned resource MUST always operate inside a validated tenant context.

Conceptually:

```text
Authenticated User
        │
        ▼
Tenant Membership
        │
        ▼
Validated Tenant Context
        │
        ▼
Database Query
```

The client MUST NOT be trusted to provide arbitrary tenant access.

---

## 2.4 IDs

Use UUIDs for public entity identifiers.

Recommended:

```text
UUID v4
```

or another cryptographically safe UUID strategy supported consistently across the system.

IDs should not expose sequential business information.

---

# 3. Common Columns

Most mutable entities should contain:

```text
id
created_at
updated_at
version
```

Example:

```sql
id UUID PRIMARY KEY
created_at TIMESTAMPTZ NOT NULL
updated_at TIMESTAMPTZ NOT NULL
```

For entities that require audit-grade lifecycle tracking, additional fields may include:

```text
created_by
updated_by
```

---

# 4. Tenant Model

## 4.1 tenants

Represents a clinic organization.

```text
tenants
-------
id
name
status
created_at
updated_at
version
```

### Fields

| Field      | Type        | Nullable | Description                   |
| ---------- | ----------- | -------: | ----------------------------- |
| id         | UUID        |       No | Tenant identifier             |
| name       | VARCHAR     |       No | Clinic organization name      |
| status     | ENUM        |       No | ACTIVE / SUSPENDED / ARCHIVED |
| created_at | TIMESTAMPTZ |       No | Creation time                 |
| updated_at | TIMESTAMPTZ |       No | Last update                   |
| version    | BIGINT      |       No | Optimistic concurrency version |

---

# 5. Location Model

A tenant may have multiple physical locations.

```text
locations
---------
id
tenant_id
name
address
phone
status
created_at
updated_at
version
```

Relationship:

```text
Tenant 1 ───── N Location
```

Constraints:

```text
FOREIGN KEY (tenant_id) → tenants.id
```

Recommended index:

```text
INDEX (tenant_id, id)
INDEX (tenant_id, status)
```

Location `version` is `BIGINT NOT NULL DEFAULT 1` for optimistic concurrency.

TEN-001 canonical rules:

- `locations.tenant_id` is immutable and Location transfer between Tenants is
  not supported by TEN-001.
- Tenant deletion uses `RESTRICT` while Locations remain linked.
- Location deletion is represented by `status = 'ARCHIVED'`; TEN-001 does not
  hard-delete Locations.
- `UNIQUE(tenant_id, name)` prevents duplicate Location names within one
  Tenant.
- Tenant isolation is enforced by application authorization and repository
  scoping. The foreign key protects referential integrity and is not an
  authorization control.

Location status is `ACTIVE | INACTIVE | ARCHIVED` and defaults to `ACTIVE`.
Allowed transitions are `ACTIVE <-> INACTIVE`, `INACTIVE -> ARCHIVED`, and
`ACTIVE -> ARCHIVED` for a higher-privilege administrator. Status changes use
a dedicated transition operation and arbitrary client-provided status changes
are forbidden. The current TEN-001 API surface does not expose a Location
PATCH or status-transition endpoint; those operations require a later
approved API contract.

---

# 6. Identity Model

Identity represents users who can authenticate into the platform.

---

## 6.1 users

```text
users
-----
id
email
phone
status
created_at
updated_at
```

Important:

`users` represents platform identity.

It does NOT represent a patient medical record.

---

## 6.2 memberships

A user may belong to one or more tenants.

```text
memberships
-----------
id
user_id
tenant_id
role
status
created_at
updated_at
```

Relationship:

```text
User
 │
 └── N Memberships
            │
            └── Tenant
```

Constraint:

```text
UNIQUE(user_id, tenant_id)
```

Authorization uses endpoint-specific least privilege with default deny.
Membership role alone does not grant access; application/repository checks
must also enforce tenant membership, resource ownership or relationship,
location, and clinical need-to-know.

---

# 7. Role Model

Initial roles:

```text
PATIENT
DOCTOR
NURSE / CLINICAL STAFF
RECEPTIONIST
CLINIC_ADMIN
SUPER_ADMIN
```

Nurse / Clinical Staff and Receptionist are separate application roles. The
exact permission matrix and resource-level authorization remain governed by
the authorization contract; a role alone is not sufficient to authorize a
resource.

The actual authorization engine is defined separately in `SECURITY.md` (tài liệu này sẽ được viết sau DATA-MODEL.md, trước API-CONTRACTS.md).

The database role is not sufficient by itself to authorize a resource.

Authorization may also depend on:

* tenant;
* resource ownership;
* doctor-patient relationship;
* appointment relationship;
* location;
* permission.

---

# 8. Patient Model

## 8.1 patients

Patient identity is tenant-scoped.

```text
patients
----------------
id
tenant_id
user_id
medical_record_number
full_name
date_of_birth
sex
phone
email
address
emergency_contact
status
created_at
updated_at
```

Relationship:

```text
Tenant 1 ───── N Patient
```

Optional:

```text
User 1 ───── 0..1 Patient Profile
```

The same human being may technically have different patient records in different tenants.

The system does NOT automatically merge patient identity across tenants.

---

# 9. Patient Identity Rules

The platform MUST NOT assume:

```text
Patient A / Tenant X
=
Patient A / Tenant Y
```

Cross-tenant identity matching is outside MVP scope.

Patient matching within a tenant may use:

* medical record number;
* verified phone;
* verified email;
* date of birth;
* other approved identity attributes.

Automatic identity merging requires a separate decision.

---

# 10. Department Model

## 10.1 departments

```text
departments
-----------
id
tenant_id
name
description
status
created_at
updated_at
```

Relationship:

```text
Tenant 1 ───── N Department
```

Constraint:

```text
UNIQUE(tenant_id, name)
```

---

# 11. Doctor Model

## 11.1 doctors

```text
doctors
-------
id
tenant_id
user_id
department_id
location_id
license_number
display_name
specialization
bio
status
created_at
updated_at
```

Relationship:

```text
Tenant
  │
  ├── Department
  │       │
  │       └── Doctor
  │
  └── Location
          │
          └── Doctor
```

A doctor belongs to exactly one tenant.

A doctor may work at one or multiple locations depending on future scheduling requirements.

If multi-location doctors are required, introduce:

```text
doctor_locations
----------------
doctor_id
location_id
```

instead of assuming a single location.

---

# 12. Doctor Working Shifts

## 12.1 doctor_working_shifts

```text
doctor_working_shifts
----------------------
id
tenant_id
doctor_id
location_id
start_time
end_time
status
created_at
updated_at
```

Relationship:

```text
Doctor 1 ───── N Working Shifts
Location 1 ─── N Working Shifts
```

Rules:

* `start_time < end_time`;
* shift cannot cross invalid boundaries;
* overlapping shifts must be prevented according to scheduling policy.

Recommended index:

```text
INDEX(tenant_id, doctor_id, start_time)
```

---

# 13. Appointment Model

## 13.1 appointments

```text
appointments
------------
id
tenant_id
location_id
patient_id
doctor_id
start_time
end_time
status
checked_in_at TIMESTAMPTZ
reason
notes
created_by
created_at
updated_at
```

Relationships:

```text
Tenant
 │
 ├── Patient
 ├── Doctor
 ├── Location
 └── Appointment
```

---

# 14. Appointment Status

Initial states:

```text
PENDING
CONFIRMED
CHECKED_IN
IN_PROGRESS
COMPLETED
CANCELLED
NO_SHOW
```

Queue view (MVP) = SELECT * FROM appointments WHERE status IN ('CHECKED_IN','IN_PROGRESS') ORDER BY checked_in_at. Không có bảng `queue` riêng cho MVP.

Allowed transitions must be enforced in application/domain logic. The
`CONFIRMED -> NO_SHOW` transition must use an explicit application transition
command with role/permission authorization, idempotency, audit, and negative
authorization tests. AI must not bypass this application boundary.

Example:

```text
PENDING
  │
  ▼
CONFIRMED
  │
  ▼
CHECKED_IN
  │
  ▼
IN_PROGRESS
  │
  ▼
COMPLETED
```

Cancellation:

```text
PENDING ───────► CANCELLED
CONFIRMED ─────► CANCELLED
```

Invalid transitions must be rejected.

---

# 15. Appointment Concurrency

Appointment creation must protect against double booking.

The database must enforce critical uniqueness constraints.

Application-level locking should protect the scheduling transaction.

Conceptual flow:

```text
BEGIN
  │
  ▼
Idempotency Check
  │
  ▼
Lock Scheduling Resource
  │
  ▼
Check Availability
  │
  ▼
Create Appointment
  │
  ▼
COMMIT
```

Approved direction: dùng doctor_working_shifts làm scheduling resource chính.
KHÔNG tạo bảng appointment_slots riêng cho MVP. Chống trùng lịch bằng
PostgreSQL EXCLUDE constraint (yêu cầu extension btree_gist), together with
application transaction handling and the documented idempotency flow:

EXCLUDE USING gist (
  doctor_id WITH =,
  tsrange(start_time, end_time) WITH &&
) WHERE (status NOT IN ('CANCELLED','NO_SHOW'))

Mutable resources use the approved optimistic concurrency boundary. Canonical
mutable MVP resources, including `tenants`, `locations`, `appointments`,
`patients`, `medical_records`, and `ai_drafts`, use
`version BIGINT NOT NULL DEFAULT 1`.
The API validates a strong `If-Match` ETag against the current version before
mutation and increments the version on success. `medical_record_versions` is
append-only/immutable and remains outside the OCC update path; its
record/version uniqueness is preserved separately. Exact mutation retry
guidance remains a follow-up decision.

---

# 16. Appointment Idempotency

## 16.1 idempotency_keys

```text
idempotency_keys
----------------
id
tenant_id
actor_id
endpoint
key
request_hash
status
response_code
response_reference
created_at
expires_at
```

Constraint:

```text
UNIQUE(tenant_id, actor_id, endpoint, key)
```

Rules:

1. same key + same payload → return original result;
2. same key + different payload → reject;
3. processing request must not create duplicates;
4. expired keys may be cleaned according to the approved domain-specific TTL;
   outbox-linked keys must remain until business completion plus grace period.

---

# 17. Encounter Model

An encounter represents a clinical interaction.

## 17.1 encounters

```text
encounters
----------
id
tenant_id
patient_id
appointment_id
doctor_id
started_at
ended_at
status
created_at
updated_at
```

Relationships:

```text
Appointment 1 ───── 0..1 Encounter
Patient 1 ───────── N Encounter
Doctor 1 ────────── N Encounter
```

An encounter may exist independently of a scheduled appointment if future workflows require walk-ins.

---

# 18. Encounter Status

Initial states:

```text
OPEN
IN_PROGRESS
COMPLETED
CANCELLED
```

---

# 19. Clinical Record Model

## 19.1 medical_records

Represents the logical clinical record.

```text
medical_records
---------------
id
tenant_id
patient_id
encounter_id
status
current_version
created_at
updated_at
```

The actual clinical content belongs to version records.

---

# 20. Clinical Record Versions

## 20.1 medical_record_versions

```text
medical_record_versions
-----------------------
id
medical_record_id
version
diagnosis
symptoms
clinical_notes
treatment_plan
created_by
amendment_reason
created_at
```

Constraint:

```text
UNIQUE(medical_record_id, version)
```

---

# 21. Clinical Record Immutability

Once a clinical record version becomes finalized:

```text
FINALIZED
```

its clinical content MUST NOT be overwritten.

Corrections create a new version.

Example:

```text
Record v1
   │
   ▼
Amendment v2
   │
   ▼
Amendment v3
```

Never:

```text
UPDATE v1 SET diagnosis = ...
```

after finalization.

---

# 22. Clinical Record Status

Suggested:

```text
DRAFT
FINALIZED
AMENDED
```

medical_records.status enum: DRAFT | IN_REVIEW | FINALIZED | AMENDED

Transition rules:
- current_version luôn trỏ tới version mới nhất.
- Khi version hiện tại chuyển sang FINALIZED, nội dung của version đó bị khóa (không UPDATE).
- Tạo amendment = tạo version mới, current_version trỏ sang version mới, status của medical_records chuyển thành AMENDED.
- IN_REVIEW là trạng thái trung gian trước khi bác sĩ finalize, khớp với lifecycle DRAFT → IN_REVIEW → FINALIZED.

---

# 23. Prescription Model

## 23.1 prescriptions

```text
prescriptions
-------------
id
tenant_id
encounter_id
patient_id
doctor_id
status
issued_at
created_at
updated_at
```

Prescription items should be normalized separately.

---

## 23.2 prescription_items

```text
prescription_items
------------------
id
prescription_id
medication_name
dosage
frequency
duration
instructions
```

Relationship:

```text
Prescription 1 ───── N Prescription Items
```

The system must not allow AI to directly finalize a prescription.

---

# 24. Allergy Model

## 24.1 patient_allergies

```text
patient_allergies
-----------------
id
tenant_id
patient_id
allergen
reaction
severity
status
recorded_by
created_at
updated_at
```

Possible severity:

```text
MILD
MODERATE
SEVERE
UNKNOWN
```

---

# 25. Laboratory Results

## 25.1 lab_results

```text
lab_results
-----------
id
tenant_id
patient_id
encounter_id
test_name
result_value
unit
reference_range
status
resulted_at
created_at
updated_at
```

For complex laboratory data, a separate normalized test/result structure may be introduced.

---

# 26. Clinical Files

Clinical files are stored outside PostgreSQL in private object storage.

PostgreSQL stores metadata.

## 26.1 clinical_files

```text
clinical_files
--------------
id
tenant_id
patient_id
encounter_id
storage_key
file_name
content_type
file_size
checksum
status
uploaded_by
created_at
```

The database stores:

```text
storage_key
```

not the actual file bytes.

---

# 27. Clinical File Security

Objects are private by default.

Access flow:

```text
Client
  │
  ▼
Backend
  │
  ▼
Authorization
  │
  ▼
Clinical File Metadata
  │
  ▼
Object Storage
```

A client must never be able to access arbitrary storage keys.

---

# 28. Doctor Ratings

## 28.1 doctor_ratings

```text
doctor_ratings
--------------
id
tenant_id
appointment_id
patient_id
doctor_id
rating
comment
created_at
updated_at
```

Constraint:

```text
UNIQUE(appointment_id)
```

Rules:

1. appointment must belong to the patient;
2. appointment must be completed;
3. patient must be authorized;
4. doctor must match appointment;
5. rating range must be validated.

Suggested:

```text
rating = 1..5
```

---

# 29. AI Conversation Model

## 29.1 ai_conversations

```text
ai_conversations
----------------
id
tenant_id
user_id
patient_id
context_type
context_id
status
created_at
updated_at
```

`patient_id` may be nullable for general conversations.

AI conversations are not the authoritative clinical record.

---

# 30. AI Messages

## 30.1 ai_messages

```text
ai_messages
-----------
id
conversation_id
role
content_reference
created_at
```

Possible roles:

```text
USER
ASSISTANT
SYSTEM
TOOL
```

Sensitive prompt/response content must follow the retention and PHI logging policy.

The approved MVP AI platform direction is self-hosted Dify behind the AI
Gateway and Tool Gateway. External LLM/Embedding Providers are accessed only
through controlled Gateway adapters. Dify does not directly access production data; all
conversation, message, context, embedding, and knowledge persistence remains
application-controlled and tenant/authorization scoped.

The approved MVP model/provider profile is Managed External LLM plus Managed
Embedding. Provider-specific model and embedding details remain outside the
domain schema and public contracts; exact embedding dimension and versioning
must be selected before vector schema implementation.

MVP uses one primary generative model and one primary embedding model, without
automatic fallback. The approved pair is `gpt-4o-2024-08-06` for generation
and `text-embedding-3-small` with dimension `1536` for embeddings. Embedding-
dimension changes require an approved migration or re-embedding plan.

Knowledge purge evaluates inherited Legal Hold across canonical scopes:
`tenants` for tenant holds, `knowledge_documents` for document holds, and only
explicitly approved canonical resources such as `patients` or
`medical_records` for resource holds. No `clinical_resources` table is added;
invalid mappings fail closed and skipped cleanup is recorded in `audit_events`.

AI conversations, drafts, embeddings, knowledge data, provider metadata, and
audit metadata follow a minimum-necessary, category-specific lifecycle. Raw
prompt/response content is not retained by default; retained content must be
redacted. Exact retention/deletion values remain governed by Product/Compliance
and must not be inferred by the schema.

The approved MVP retention baseline is 30 days from `last_message_at` for
`ai_conversations`/`ai_messages` with hard purge in the next daily cycle
(maximum 24-hour lag), 7 days for unapproved `ai_drafts`, and immediate draft
content purge after approval once approval metadata is recorded. Raw
prompt/context retention is 0 days by default; applicable AI metadata is 90
days; knowledge embeddings follow source-document lifecycle. Cleanup runs at
02:00 daily and preserves Legal Hold and immutable `audit_events` evidence.

The MVP AI data boundary is read/summarization/draft-first. Write-tool state
is default-deny, knowledge is tenant-scoped by default, and sensitive raw
prompt/response content is not retained by default; audit metadata is retained
according to the Product/Compliance-approved data policy.

The system should avoid duplicating sensitive clinical data unnecessarily.

---

# 31. AI Draft Model

## 31.1 ai_drafts

```text
ai_drafts
---------
id
tenant_id
patient_id
encounter_id
created_by
draft_type
content
status
approved_by
approved_at
rejected_by
rejected_at
created_at
updated_at
```

Possible statuses:

```text
GENERATED
REVIEWING
APPROVED
REJECTED
EXPIRED
```

---

# 32. AI Draft Approval

AI draft:

```text
GENERATED
    │
    ▼
REVIEWING
    │
 ┌──┴──────┐
 ▼         ▼
REJECTED  APPROVED
             │
             ▼
     Clinical Application Service
             │
             ▼
       Final Clinical Record
```

AI itself cannot execute the approval operation. An authorized clinician may
review, edit, and approve within tenant/resource scope; approval requires
step-up MFA, current-version validation, and audit evidence. A stale draft
returns to review before approval.

---

# 33. Knowledge Base

RAG uses PostgreSQL + pgvector in MVP.

---

## 33.1 knowledge_documents

```text
knowledge_documents
-------------------
id
tenant_id
title
source
document_type
status
created_at
updated_at
```

Depending on knowledge scope, `tenant_id` may be nullable for globally approved knowledge.

---

## 33.2 knowledge_chunks

```text
knowledge_chunks
----------------
id
document_id
tenant_id
content
embedding
metadata
created_at
```

`embedding` uses pgvector.

Example conceptual type:

```text
vector(1536)
```

The exact dimension depends on the selected embedding model and MUST NOT be hardcoded before the model is selected.

---

# 34. RAG Tenant Isolation

Retrieval must filter by:

```text
tenant_id
+
document status
+
authorization scope
```

The AI must never retrieve documents that the requesting actor cannot access.

---

# 35. Invoice Model

## 35.1 invoices

```text
invoices
--------
id
tenant_id
patient_id
appointment_id
invoice_number
currency
subtotal
tax
total
status
due_at
paid_at
created_at
updated_at
```

---

# 36. Invoice Status

Suggested:

```text
DRAFT
ISSUED
PENDING_PAYMENT
PAID
FAILED
CANCELLED
REFUNDED
```

Allowed state transitions must be enforced by billing logic.

---

# 37. Payment Webhook Events

## 37.1 payment_webhook_events

```text
payment_webhook_events
----------------------
id
provider
provider_event_id
event_type
payload_hash
processed_at
status
created_at
```

Constraint:

```text
UNIQUE(provider, provider_event_id)
```

The raw webhook payload should only be retained if required by operational/compliance policy and must be protected appropriately.

---

# 38. Payment Idempotency

Webhook processing must be idempotent.

Flow:

```text
Webhook
   │
   ▼
Verify Signature
   │
   ▼
Check provider_event_id
   │
   ├── Already Processed → Return Success
   │
   └── New
        │
        ▼
     Process
        │
        ▼
     Update Invoice
        │
        ▼
   Mark Event Processed
```

---

# 39. Audit Model

## 39.1 audit_events

```text
audit_events
------------
id
tenant_id
actor_id
action
resource_type
resource_id
result
request_id
correlation_id
metadata
created_at
```

Important:

Audit data should identify what happened without unnecessarily duplicating sensitive medical content.

---

# 40. Audit Examples

Example:

```text
actor_id: doctor_123
tenant_id: tenant_456
action: CLINICAL_RECORD_VIEWED
resource_type: medical_record
resource_id: record_789
result: SUCCESS
request_id: req_abc
correlation_id: corr_abc
```

Do NOT store:

```text
complete clinical note
complete patient medical history
complete AI prompt
```

unless explicitly required and protected under a defined policy.

---

# 41. Soft Delete

Soft deletion may be used for operational entities.

Example:

```text
status = ARCHIVED
```

or:

```text
deleted_at
```

However, soft delete does NOT mean:

> "clinical records can be deleted later."

Clinical data follows its own retention and amendment policy.

---

# 42. Cascading Delete Rules

Avoid unrestricted:

```sql
ON DELETE CASCADE
```

for clinical entities.

Example:

```text
Patient
   │
   ├── Encounter
   ├── Clinical Record
   ├── Prescription
   └── Lab Result
```

Deleting the patient must not automatically destroy clinical history.

Relationships involving regulated clinical data require explicit deletion/retention behavior.

---

# 43. Tenant-Scoped Foreign Key Integrity

For tenant-owned relationships, application logic must verify tenant consistency.

Invalid:

```text
appointment.tenant_id = A
appointment.patient_id = patient_from_tenant_B
```

The database model should be designed so these invalid combinations are difficult or impossible.

Decision: Với MVP, tenant consistency được enforce ở tầng application/repository (xem Section 62-64), xác thực bằng integration test (Section 57). KHÔNG áp dụng composite FK cho MVP do độ phức tạp migration/ORM tăng cao. Việc chuyển sang composite FK sẽ được đánh giá lại qua ADR riêng nếu phát sinh sự cố tenant-leak trong production.

---

# 44. Recommended Index Strategy

Every tenant-scoped high-volume table should consider:

```text
INDEX(tenant_id)
```

Common compound indexes:

```text
appointments:
(tenant_id, doctor_id, start_time)

appointments:
(tenant_id, patient_id, start_time)

patients:
(tenant_id, full_name)

encounters:
(tenant_id, patient_id, created_at)

medical_records:
(tenant_id, patient_id)

audit_events:
(tenant_id, created_at)

ai_conversations:
(tenant_id, user_id, created_at)
```

Indexes must be validated using actual query patterns.

Do not blindly index every column.

---

# 45. Uniqueness Rules

Important initial uniqueness constraints:

```text
memberships:
UNIQUE(user_id, tenant_id)

departments:
UNIQUE(tenant_id, name)

doctor_ratings:
UNIQUE(appointment_id)

payment_webhook_events:
UNIQUE(provider, provider_event_id)

medical_record_versions:
UNIQUE(medical_record_id, version)

idempotency_keys:
UNIQUE(tenant_id, actor_id, endpoint, key)
```

Appointment uniqueness requires scheduling-specific design and must account for duration/overlap.

---

# 46. Data Ownership Matrix

| Entity                  | Owner                 | MVP Phase |
| ----------------------- | --------------------- | --------- |
| users                   | Identity              | MVP       |
| memberships             | Identity              | MVP       |
| tenants                 | Tenant                | MVP       |
| locations               | Tenant                | MVP       |
| patients                | Patient               | MVP       |
| departments             | Doctor                | MVP       |
| doctors                 | Doctor                | MVP       |
| doctor_working_shifts   | Doctor                | MVP       |
| doctor_ratings          | Doctor                | Post-MVP  |
| appointments            | Appointment           | MVP       |
| encounters              | Clinical              | MVP       |
| medical_records         | Clinical              | MVP       |
| medical_record_versions | Clinical              | MVP       |
| prescriptions           | Clinical              | Post-MVP  |
| prescription_items      | Clinical              | Post-MVP  |
| patient_allergies       | Clinical              | MVP       |
| lab_results             | Clinical              | Post-MVP  |
| clinical_files          | Clinical              | Post-MVP (đã được Product phê duyệt loại khỏi MVP) |
| ai_conversations        | AI                    | MVP       |
| ai_messages             | AI                    | MVP       |
| ai_drafts               | AI                    | MVP       |
| knowledge_documents     | AI                    | MVP       |
| knowledge_chunks        | AI                    | MVP       |
| invoices                | Billing               | Post-MVP  |
| payment_webhook_events  | Billing               | Post-MVP  |
| idempotency_keys        | Shared/Platform       | MVP       |
| outbox_events           | Shared/Platform       | MVP       |
| audit_events            | Audit                 | MVP       |

notifications, notification_preferences — Post-MVP, schema chưa được thiết kế trong tài liệu này.

---

# 47. Module Database Boundaries

Each module owns its tables.

```text
Identity
 ├── users
 └── memberships

Tenant
 ├── tenants
 └── locations

Patient
 └── patients

Doctor
 ├── departments
 ├── doctors
 ├── doctor_working_shifts
 └── doctor_ratings

Appointment
 ├── appointments

Clinical
 ├── encounters
 ├── medical_records
 ├── medical_record_versions
 ├── prescriptions
 ├── prescription_items
 ├── patient_allergies
 ├── lab_results
 └── clinical_files

AI
 ├── ai_conversations
 ├── ai_messages
 ├── ai_drafts
 ├── knowledge_documents
 └── knowledge_chunks

Billing
 ├── invoices
 └── payment_webhook_events

Audit
 └── audit_events

Shared / Platform
 ├── idempotency_keys
 └── outbox_events
```

---

# 48. Cross-Module Data Access

A module may reference another module's entity through IDs.

Example:

```text
Appointment
 ├── patient_id
 └── doctor_id
```

But business behavior must go through module/application contracts.

The Appointment module must not implement Doctor business rules itself.

---

# 49. Transaction Ownership

A transaction should normally be owned by the module responsible for the business operation.

Example:

```text
Appointment Module
        │
        ▼
Create Appointment Transaction
```

Cross-module operations should avoid distributed transactions.

Prefer:

```text
Local Transaction
      │
      ▼
Outbox Event
      │
      ▼
Asynchronous Consumer
```

---

# 50. Outbox Model

## 50.1 outbox_events

```text
outbox_events
-------------
id
tenant_id
event_type
aggregate_type
aggregate_id
payload
status
attempts
available_at
created_at
processed_at
```

Possible status:

```text
PENDING
PROCESSING
PROCESSED
FAILED
```

Purpose:

Prevent this failure:

```text
DB COMMIT
   │
   X
Queue publish fails
```

Instead:

```text
DB Transaction
   │
   ├── Business Data
   └── Outbox Event
          │
          ▼
       COMMIT
          │
          ▼
    Outbox Worker
          │
          ▼
        Queue
```

---

# 51. Data Retention

Every sensitive data category requires a documented retention policy.

At minimum:

```text
Clinical records
Audit events
AI conversations
AI drafts
Payment records
Uploaded files
Authentication records
```

Retention duration must be determined based on:

* deployment jurisdiction;
* applicable healthcare regulations;
* contractual requirements;
* business requirements.

Do not hardcode legal retention periods until the compliance scope is defined.
Product/Compliance owns the approved category-specific lifecycle policy gate
for retention, deletion/anonymization, export, residency, audit, AI data, and
backup behavior. Clinical history remains immutable; export/deletion must use
authorized workflows; and AI audit metadata uses the shared `audit_events`
boundary. Until policy values are approved, implementation may prepare
interfaces and tests but must not choose irreversible lifecycle semantics.

---

# 52. Encryption

Sensitive data should be protected through:

```text
TLS in transit
+
Encryption at rest
+
Access control
+
Audit
```

Selective field-level/envelope encryption may be applied to classified PHI.
Encrypted fields must retain key-version metadata so rotation and migration
remain compatible; encryption keys and secrets are managed outside business
tables.

Do not introduce application-level encryption casually because it affects:

* indexing;
* search;
* key rotation;
* backup;
* migration.

Such decisions require an ADR.

---

# 53. Database Migration Order

Initial conceptual migration order:

```text
001_extensions (btree_gist)
      │
      ▼
002_tenants_locations
      │
      ▼
003_users_memberships
      │
      ▼
004_idempotency
      │
      ▼
005_audit
      │
      ▼
006_patients
      │
      ▼
007_doctor
      │
      ▼
008_outbox
      │
      ▼
009_appointments
      │
      ▼
010_clinical
      │
      ▼
011_ai
      │
      ▼
012_files
      │
      ▼
013_billing
      │
      ▼
014_indexes_constraints
```

Actual numbering may change after the final ERD is approved.

---

# 54. Migration Rules

Every migration MUST:

* be deterministic;
* run on a clean database;
* be reversible where practical;
* avoid manual production edits;
* include required indexes/constraints;
* be tested against staging.

Never modify production schema manually and then "fix the migration later."

---

# 55. Seed Data

Development seed data must be clearly separated from production data.

Example:

```text
seed/
├── tenants
├── users
├── doctors
├── patients
└── appointments
```

Development data must never contain real patient data.

---

# 56. Test Data

Automated tests should use synthetic data.

Example:

```text
tenant-test-001
patient-test-001
doctor-test-001
appointment-test-001
```

No production PHI may be copied into automated test environments.

---

# 57. Database Security Tests

The database/application integration must test:

### Tenant isolation

```text
Tenant A user
   │
   X
   ▼
Tenant B patient
```

Expected:

```text
NOT FOUND
```

or:

```text
FORBIDDEN
```

according to the API security policy.

### IDOR

Changing:

```text
/patients/patient_A
```

to:

```text
/patients/patient_B
```

must not bypass authorization.

---

# 58. Clinical Integrity Tests

Tests must verify:

```text
Finalize Record
      │
      ▼
Attempt UPDATE
      │
      ▼
REJECT
```

Amendment:

```text
Final v1
  │
  ▼
Create Amendment
  │
  ▼
v2
```

Expected:

```text
v1 remains unchanged
v2 becomes current version
```

---

# 59. AI Data Rules

AI may receive data only through authorized application interfaces.

Example:

```text
AI
 │
 ▼
get_recent_encounters()
 │
 ▼
Authorization
 │
 ▼
Clinical Service
 │
 ▼
Filtered Result
```

The database must never be exposed directly to the AI agent.

---

# 60. AI Data Persistence

AI conversation data and clinical data are different.

Do not automatically copy:

```text
AI conversation
       │
       ▼
Clinical Record
```

Instead:

```text
AI conversation
       │
       ▼
AI Draft
       │
       ▼
Human Approval
       │
       ▼
Clinical Record
```

---

# 61. Data Classification

Recommended classification:

### Public

Examples:

```text
Clinic public name
Clinic address
Doctor public profile
Department name
```

### Internal

Examples:

```text
Operational metrics
Internal configuration
Non-sensitive system metadata
```

### Sensitive

Examples:

```text
Patient contact information
Appointments
Invoices
```

### Highly Sensitive / Clinical

Examples:

```text
Diagnosis
Clinical notes
Prescription
Laboratory results
Allergies
Medical files
```

Access control and audit requirements increase with sensitivity.

---

# 62. Query Rules

Repositories should always receive explicit context where needed.

Preferred:

```text
patientRepository.findById({
  tenantId,
  patientId
})
```

Avoid:

```text
patientRepository.findById(patientId)
```

for tenant-owned resources when this can accidentally permit cross-tenant access.

---

# 63. Repository Contract

Example:

```text
PatientRepository

findById(
    tenantId,
    patientId
)

create(
    tenantId,
    patient
)

update(
    tenantId,
    patientId,
    changes
)
```

Tenant context should be explicit.

---

# 64. Data Access Policy

The following is prohibited:

```text
repository.findAll()
```

for sensitive tenant-owned resources unless the method explicitly requires and enforces a tenant scope.

Prefer:

```text
repository.findAllByTenant(tenantId)
```

or:

```text
repository.search({
    tenantId,
    filters
})
```

Bounded collection queries use the approved opaque cursor contract with
allowlisted stable keyset ordering and a deterministic unique tie-breaker.
Supporting indexes for each endpoint's approved ordering fields require
affected-owner review; no arbitrary database column may be used as an
unreviewed public ordering contract.

---

# 65. Final Entity Relationship Overview

```text
                           TENANT
                              │
             ┌────────────────┼────────────────┐
             │                │                │
             ▼                ▼                ▼
         LOCATIONS       MEMBERSHIPS       DEPARTMENTS
             │                │                │
             │                │                ▼
             │                │              DOCTORS
             │                │                │
             │                │                ▼
             │                │        WORKING SHIFTS
             │                │
             ▼                │
        APPOINTMENTS ◄─────────┘
             │
       ┌─────┴─────┐
       ▼           ▼
   PATIENT      DOCTOR
       │
       ▼
   ENCOUNTER
       │
       ├──────────────┐
       ▼              ▼
MEDICAL RECORDS    PRESCRIPTIONS
       │
       ▼
RECORD VERSIONS

PATIENT
   │
   ├── LAB RESULTS
   ├── ALLERGIES
   └── CLINICAL FILES


PATIENT
   │
   ▼
AI CONVERSATION
   │
   ▼
AI DRAFT
   │
   ▼
HUMAN APPROVAL
   │
   ▼
CLINICAL RECORD


PATIENT
   │
   ▼
INVOICE
   │
   ▼
PAYMENT WEBHOOK


ALL SENSITIVE OPERATIONS
           │
           ▼
      AUDIT EVENTS
```

---

# 66. Data Model Invariants

The following rules are mandatory:

```text
1. Every tenant-owned resource is tenant-scoped.

2. Cross-tenant access is forbidden.

3. Patient identity is tenant-scoped.

4. PostgreSQL is the transactional source of truth.

5. Redis is never the source of truth.

6. Clinical records are immutable after finalization.

7. Clinical corrections create amendments/versions.

8. AI drafts are separate from finalized clinical records.

9. AI cannot directly write finalized clinical records.

10. AI cannot query PostgreSQL directly.

11. Clinical files are private by default.

12. Payment webhook events are idempotent.

13. Retry-sensitive operations support idempotency.

14. Critical business invariants are enforced at database level
    wherever practical.

15. Unrestricted cascading deletion is prohibited for clinical data.

16. Production data is never copied into development/test environments.

17. Repository access to sensitive tenant-owned resources must
    include tenant context.

18. Cross-module business rules remain owned by the responsible module.

19. Audit events record sensitive access without unnecessarily
    storing sensitive payloads.

20. Schema changes require migrations.
```

---

# 67. Open Decisions

Danh sách quyết định mở đã được gộp vào system-architecture.md Section 76 (master decision gate). Xem tài liệu đó để theo dõi trạng thái.

---

# 68. Ownership Summary

```text
Engineer A
├── Identity
├── Tenant
├── Audit
├── Outbox
└── Idempotency Keys

Engineer B
└── Patient & Clinical

Engineer C
├── Operations
├── Doctor
└── Billing (Post-MVP)

Engineer D
└── AI Platform
```

---

# 69. Implementation Rule

No team member should create a new table merely because it is convenient.

Before adding a table:

```text
1. Identify owning module.
2. Define purpose.
3. Define tenant scope.
4. Define lifecycle.
5. Define relationships.
6. Define authorization implications.
7. Define indexes.
8. Define deletion/retention behavior.
9. Define migration dependency.
10. Update DATA-MODEL.md.
```

Only then should the migration be implemented.

---

# 70. Next Document

After this document is approved, the next required document is:

```text
docs/API-CONTRACTS.md
```

It must define:

* endpoint;
* HTTP method;
* authentication;
* authorization;
* tenant behavior;
* request schema;
* response schema;
* error schema;
* idempotency;
* pagination;
* audit behavior.

Only after:

```text
SYSTEM-DEFINITION.md
        ↓
ARCHITECTURE.md
        ↓
DATA-MODEL.md
        ↓
SECURITY.md
        ↓
API-CONTRACTS.md
```

should the team begin substantial parallel feature development.

---

# 71. Status

This document is the canonical database-model baseline.

Changes require:

```text
DATA-MODEL.md update
        │
        ▼
Migration update
        │
        ▼
Affected API/module review
        │
        ▼
Tests
        │
        ▼
Pull Request
```

No schema change should exist only in code.
