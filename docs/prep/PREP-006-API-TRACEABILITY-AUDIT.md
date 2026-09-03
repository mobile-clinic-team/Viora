# PREP-006 — MVP API Traceability and Blocker Audit

Status: AUDIT COMPLETE — TRACEABILITY RECORDED; IMPLEMENTATION READINESS IS
NOT CLAIMED

This is the task-specific documentation artifact for `PREP-006 — Map 37 MVP
API operations to task IDs and blockers` (Issue #24). It records repository
evidence at base commit `661b817` on branch
`feature/PREP-006-api-traceability`. The audit does not modify any source-of-
truth contract, endpoint, handler, router, middleware, application service,
repository, database, migration, or infrastructure.

## Scope and acceptance criterion

The Implementation Plan assigns PREP-006 to Engineer A/API owner, depends on
completed PREP-001, and requires every MVP endpoint to have a domain, owner,
dependencies, and acceptance criteria. This artifact maps the 37 concrete
HTTP endpoint headings found in `docs/API-CONTRACTS.md` to the canonical API
traceability task IDs in `docs/IMPLEMENTATION-PLAN.md`.

The Implementation Plan also contains an explicit `NO_SHOW` application
transition command. It is recorded separately below because it is not an HTTP
endpoint and must not be silently counted as a 38th endpoint or converted into
an invented route.

## Evidence and count reconciliation

| Evidence | Count/state | Interpretation |
|---|---:|---|
| Concrete HTTP endpoint headings in `docs/API-CONTRACTS.md` | 37 | Directly counted from `### GET/POST/PATCH /api/v1/...` headings. |
| Endpoint rows in the Implementation Plan traceability table | 37 | All concrete endpoint rows map to an `API-*` task ID. |
| Additional Implementation Plan traceability row | 1 | `Explicit NO_SHOW application transition command`; application command, not HTTP endpoint. |
| Total rows in the Implementation Plan traceability table | 38 | 37 endpoints plus the separate NO_SHOW command. |
| `docs/API-CONTRACTS.md` section 28 prose | Says 31 concrete endpoint operations | Inconsistent with the 37 headings and the category arithmetic shown in the same section. |
| Section 28 category arithmetic | 2 + 4 + 4 + 4 + 7 + 8 + 7 + 1 = 37 | The category counts support 37 concrete endpoints. |

The `31` value is recorded as a source inconsistency. PREP-006 does not edit
the API contract or choose which number a future source-of-truth update should
retain.

## Canonical endpoint mapping

The following table preserves the operation, API task ID, domain, owner,
dependencies, and acceptance criterion from the Implementation Plan. “Blocker
note” classifies the named dependency without silently changing it.

| # | Concrete endpoint | API task ID | Domain / owner | Source dependencies | Acceptance criterion | Blocker note |
|---:|---|---|---|---|---|---|
| 1 | `GET /api/v1/me` | API-ID-001 | Identity / A | AUTH-001 | Returns only authenticated user's permitted identity | AUTH-001 foundation prerequisite; merged task evidence exists. |
| 2 | `GET /api/v1/me/memberships` | API-ID-002 | Identity / A | AUTH-001 | Returns only caller's valid memberships | AUTH-001 foundation prerequisite; merged task evidence exists. |
| 3 | `GET /api/v1/tenants/{tenant_id}` | API-TEN-001 | Tenant / A | TEN-001 | Membership-scoped tenant response | TEN-001 prerequisite; merged contract/application evidence exists. |
| 4 | `PATCH /api/v1/tenants/{tenant_id}` | API-TEN-002 | Tenant / A | TEN-001, BLOCK-004 | Authorized update, concurrency-safe | Requires tenant foundation and approved stale-update/retry boundary; BLOCK-004 is recorded as resolved for implementation, but enforcement remains a future implementation concern. |
| 5 | `GET /api/v1/tenants/{tenant_id}/locations` | API-TEN-003 | Tenant / A | TEN-001 | Tenant-scoped allowlisted paginated list using the approved cursor contract | Requires tenant foundation and approved pagination contract. |
| 6 | `POST /api/v1/tenants/{tenant_id}/locations` | API-TEN-004 | Tenant / A | TEN-001, PLAT-001 | Authorized idempotent creation | PLAT-001 is merged at contract-only scope; persistent store/transaction enforcement remains deferred. |
| 7 | `POST /api/v1/patients` | API-PAT-001 | Patient / B | PAT-001, PLAT-001 | Tenant-scoped creation and audit | Patient foundation and idempotency/audit runtime prerequisites are not proven complete. |
| 8 | `GET /api/v1/patients/{patient_id}` | API-PAT-002 | Patient / B | PAT-001, AUTH-002 | Ownership/relationship and field filtering pass | Requires patient foundation and authorization/IDOR behavior; AUTH-002 evidence is merged. |
| 9 | `PATCH /api/v1/patients/{patient_id}` | API-PAT-003 | Patient / B | PAT-001, BLOCK-004 | Allowed fields only; stale update rejected | Requires patient foundation and approved OCC/retry semantics. |
| 10 | `GET /api/v1/patients` | API-PAT-004 | Patient / B | PAT-001 | Allowlisted search and approved pagination isolation pass | Requires patient foundation and approved cursor/pagination contract. |
| 11 | `GET /api/v1/doctors` | API-DOC-001 | Doctor / C | DOC-001 | Tenant/permission-scoped list using the approved cursor contract | DOC-001 is not proven complete; tenant/permission and pagination evidence remain required. |
| 12 | `GET /api/v1/doctors/{doctor_id}` | API-DOC-002 | Doctor / C | DOC-001 | Tenant/resource authorization passes | Requires Doctor foundation and tenant/resource authorization evidence. |
| 13 | `GET /api/v1/doctors/{doctor_id}/shifts` | API-DOC-003 | Doctor / C | DOC-001 | Authorized shift list and approved filters/pagination pass | Requires Doctor foundation and approved bounded filters/pagination. |
| 14 | `PATCH /api/v1/doctors/{doctor_id}` | API-DOC-004 | Doctor / C | DOC-001, BLOCK-004 | Allowlisted profile update is authorized | Requires Doctor foundation and stale-update/retry boundary. |
| 15 | `POST /api/v1/appointments` | API-APPT-001 | Appointment / C | PAT-002, DOC-001, PLAT-001, BLOCK-004 | Idempotent create and double-booking protection pass | Requires Patient read, Doctor, contract-level idempotency, and approved concurrency/OCC; runtime persistence is not proven. |
| 16 | `GET /api/v1/appointments/{appointment_id}` | API-APPT-002 | Appointment / C | APPT-001 | Tenant/resource access and audit pass | Requires appointment foundation and tenant/resource/audit evidence. |
| 17 | `GET /api/v1/appointments` | API-APPT-003 | Appointment / C | APPT-001 | Allowlisted filters and approved pagination isolation pass | Requires appointment foundation and approved pagination/tenant isolation. |
| 18 | `PATCH /api/v1/appointments/{appointment_id}` | API-APPT-004 | Appointment / C | APPT-001, BLOCK-004 | Valid reschedule/update and stale conflict pass | Requires appointment foundation and concurrency/retry decision enforcement. |
| 19 | `POST /api/v1/appointments/{appointment_id}/cancel` | API-APPT-005 | Appointment / C | APPT-001, BLOCK-002 | Valid cancellation transition and audit pass | Requires appointment foundation and endpoint-specific role/permission behavior. |
| 20 | `POST /api/v1/appointments/{appointment_id}/check-in` | API-APPT-006 | Appointment / C | APPT-001, BLOCK-002 | Authorized check-in transition and audit pass | Requires appointment foundation and endpoint-specific role/permission behavior. |
| 21 | `GET /api/v1/appointments/availability` | API-APPT-007 | Appointment / C | DOC-001, APPT-001 | Advisory availability uses shifts and active appointments | Requires Doctor and appointment foundations; advisory result must not become booking authority. |
| 22 | `POST /api/v1/encounters` | API-CLIN-001 | Clinical / B | PAT-002, APPT-001 | Tenant-consistent encounter creation passes | Requires authorized Patient and Appointment foundations. |
| 23 | `GET /api/v1/encounters/{encounter_id}` | API-CLIN-002 | Clinical / B | CLIN-001 | Authorized clinical read and audit pass | Requires clinical foundation, PHI filtering, authorization, and audit evidence. |
| 24 | `POST /api/v1/encounters/{encounter_id}/medical-records` | API-CLIN-003 | Clinical / B | CLIN-001, PLAT-001 | Draft version creation is immutable/audited | Requires clinical version foundation and contract-level idempotency/audit; persistence is deferred. |
| 25 | `GET /api/v1/medical-records/{medical_record_id}` | API-CLIN-004 | Clinical / B | CLIN-001 | Current authorized version is field-filtered | Requires clinical version foundation, PHI minimization, and authorization. |
| 26 | `POST /api/v1/medical-records/{medical_record_id}/review` | API-CLIN-005 | Clinical / B | CLIN-002 | Canonical `IN_REVIEW` status and transition enforced | Requires clinical read/foundation and canonical lifecycle contract. |
| 27 | `POST /api/v1/medical-records/{medical_record_id}/finalize` | API-CLIN-006 | Clinical / B | CLIN-002 | Authorized finalize locks current version | Requires clinical read/foundation, immutable finalized version, and authorization. |
| 28 | `POST /api/v1/medical-records/{medical_record_id}/amendments` | API-CLIN-007 | Clinical / B | CLIN-002, PLAT-001 | Amendment creates version with reason/audit | Requires clinical foundation, immutable versioning, audit, and contract-level idempotency. |
| 29 | `GET /api/v1/patients/{patient_id}/allergies` | API-CLIN-008 | Clinical / B | PAT-002, CLIN-001 | Authorized tenant-scoped allergy read | Requires authorized Patient read and clinical foundation; PHI filtering remains applicable. |
| 30 | `POST /api/v1/ai/conversations` | API-AI-001 | AI / D | AI-001, AUTH-002 | Authorized tenant/context conversation created | Requires AI foundation plus authenticated authorization/context; provider-neutral boundary remains required. |
| 31 | `POST /api/v1/ai/conversations/{conversation_id}/messages` | API-AI-002 | AI / D | API-AI-001, AI-001, PLAT-001 | Validated message and safe response/async result | Requires AI conversation foundation, contract-level idempotency, safety, and async boundary evidence. |
| 32 | `GET /api/v1/ai/conversations/{conversation_id}` | API-AI-003 | AI / D | API-AI-001 | Authorized access using the approved pagination contract | Requires AI conversation foundation, tenant/resource authorization, and pagination. |
| 33 | `POST /api/v1/ai/drafts` | API-AI-004 | AI / D | AI-001, CLIN-001, PLAT-001 | Draft-only output with audit and authorization | Requires AI/Clinical public contracts, draft-first safety, audit, and contract-level idempotency. |
| 34 | `POST /api/v1/ai/drafts/{draft_id}/review` | API-AI-005 | AI / D | API-AI-004 | Human reviewer moves draft to review | Requires draft foundation and explicit human approval boundary. |
| 35 | `POST /api/v1/ai/drafts/{draft_id}/approve` | API-AI-006 | AI / D/B | API-AI-005, CLIN-002 | Human approval gates application handoff | Requires reviewed draft, authorized human approval, clinical read, and immutable/audited handoff. |
| 36 | `POST /api/v1/ai/drafts/{draft_id}/reject` | API-AI-007 | AI / D | API-AI-005 | Authorized rejection is audited | Requires reviewed draft, authorization, and audit. |
| 37 | `POST /api/v1/ai/knowledge/search` | API-RAG-001 | RAG / D | AI-001, BLOCK-005 | Tenant/status/permission-filtered results using approved pagination | Requires AI foundation, tenant-only knowledge boundary, permission filtering, and approved pagination; provider/release terms remain separate. |

## Separate non-HTTP application command

| Command | API task ID | Domain / owner | Source dependencies | Acceptance criterion | Classification |
|---|---|---|---|---|---|
| Explicit `NO_SHOW` application transition command | API-APPT-008 | Appointment / C | APPT-001, BLOCK-002 in the Implementation Plan | Explicit command, authorization, validation, idempotency, audit, and negative tests pass | Application transition command; not one of the 37 concrete HTTP endpoints. |

The decision closure document identifies `BLOCK-010` as the explicit NO_SHOW
authority decision, while the API traceability row names `BLOCK-002`. Both
references are preserved; this discrepancy is recorded below for governance
reconciliation rather than silently corrected.

## Dependency and blocker register

| ID | Affected mapping | Repository/source status | Implementation consequence |
|---|---|---|---|
| PREP6-F-001 | All 37 endpoints | The 37 endpoint headings and 37 endpoint traceability rows are directly evidenced. | The endpoint inventory is complete at contract/document level; it does not prove any endpoint is runtime-ready. |
| PREP6-F-002 | Section 28 MVP count | API contract prose says 31 concrete operations, while the headings and category arithmetic produce 37. | Do not use the `31` value for planning or silently edit the API contract in PREP-006. |
| PREP6-F-003 | API-APPT-008 | NO_SHOW appears as a 38th traceability row but is explicitly an application command, not an HTTP endpoint. | Keep it separate from the 37 endpoint count and preserve its command-level acceptance criteria. |
| PREP6-F-004 | API-APPT-008 | Implementation Plan names BLOCK-002; Decision Closure identifies BLOCK-010 for NO_SHOW authority. | The owner must reconcile the decision reference before implementing the command; PREP-006 does not choose one. |
| PREP6-F-005 | API-TEN-004, API-PAT-001, API-APPT-001, API-CLIN-003, API-CLIN-007, API-AI-002, API-AI-004 | PLAT-001 is merged only as idempotency/outbox contracts; persistent storage, transaction coupling, and runtime enforcement remain deferred. | These rows may retain contract-level dependency traceability but cannot claim production idempotency or transactional behavior. |
| PREP6-F-006 | API-TEN-002, API-PAT-003, API-DOC-004, API-APPT-001, API-APPT-004 | BLOCK-004 is recorded as resolved for implementation, but each affected task still has to enforce the approved OCC/retry/security re-check rules. | A resolved decision is not a substitute for endpoint-specific implementation and negative-path tests. |
| PREP6-F-007 | API-APPT-005, API-APPT-006, API-APPT-008 | BLOCK-002 is recorded as resolved, but endpoint-specific least-privilege and default-deny tests remain implementation acceptance criteria. | Authorization evidence must be produced per endpoint; the decision status alone is insufficient. |
| PREP6-F-008 | API-RAG-001 | BLOCK-005 is resolved for implementation while provider evidence and exact production limits remain release dependencies. | Provider-neutral RAG mapping can proceed later, but production release cannot be claimed from this traceability artifact. |
| PREP6-F-009 | Cross-domain rows | API traceability assigns domain owners but does not establish that all dependent implementation tasks are complete. | Each future implementation task must verify the listed task/decision dependencies before coding. |

## Owner and task mapping summary

| Domain | Endpoint count | Owner from Implementation Plan | API task ID range/pattern | Primary implementation prerequisites |
|---|---:|---|---|---|
| Identity | 2 | A | API-ID-001..002 | AUTH-001 |
| Tenant / Location | 4 | A | API-TEN-001..004 | TEN-001; PLAT-001 for idempotent creation; BLOCK-004 for tenant mutation |
| Patient | 4 | B | API-PAT-001..004 | PAT-001; AUTH-002 for protected read; PLAT-001/BLOCK-004 where named |
| Doctor Operations | 4 | C | API-DOC-001..004 | DOC-001; BLOCK-004 for profile mutation |
| Appointment | 7 concrete endpoints | C | API-APPT-001..007 | PAT-002, DOC-001, APPT-001, PLAT-001, BLOCK-002/004 where named |
| Clinical | 8 | B | API-CLIN-001..008 | PAT-002, APPT-001, CLIN-001/002, PLAT-001 where named |
| AI Assistant | 7 | D or D/B | API-AI-001..007 | AI-001, AUTH-002, Clinical public contracts, PLAT-001 where named |
| RAG | 1 | D | API-RAG-001 | AI-001, BLOCK-005 |
| Separate NO_SHOW command | Not an endpoint | C | API-APPT-008 | APPT-001; source references BLOCK-002 and BLOCK-010 require reconciliation |

The endpoint category total is 37. The separate NO_SHOW command is intentionally
not included in the Appointment endpoint count.

## Readiness and scope boundaries

- This artifact establishes traceability, not implementation readiness.
- Existing merged task evidence for AUTH-001, AUTH-002, TEN-001, and PLAT-001
  is preserved as dependency evidence; PLAT-001 remains contract-only.
- Endpoint implementation must preserve authenticated actor context, validated
  tenant membership, authorization, tenant-scoped repository boundaries,
  allowlisted outputs, audit/redaction, idempotency, and human-approval rules
  where applicable.
- No endpoint may be added, removed, renamed, or reclassified by this task.
- No database, migration, ORM, transaction manager, HTTP framework/router,
  provider integration, persistent idempotency, or runtime CI gate is added.
- No claim is made about database constraints, transaction rollback,
  concurrent-update protection, production secret delivery, or real HTTP
  behavior.

## Acceptance criteria

- [x] All 37 concrete MVP API endpoint operations are mapped to API task IDs.
- [x] Each endpoint has domain, owner, dependencies, acceptance criteria, and
  blocker/unknown notes.
- [x] Explicit NO_SHOW is recorded separately as an application command, not
  counted as a concrete HTTP endpoint.
- [x] The API contract's 31-versus-37 count inconsistency is recorded without
  silently resolving it.
- [x] Existing task and decision dependencies are preserved; no new API or
  task is invented.
- [x] Artifact is documentation-only.
- [ ] Validation and remaining risks are reported in the PR.

The last item is completed by the task PR rather than by this standalone
artifact.

## Scope guard

- Endpoint/handler/router changes: NO
- HTTP framework or middleware: NO
- Request parsing or application service changes: NO
- Repository/database/migration/ORM changes: NO
- API contract/source-of-truth changes: NO
- Architecture, security, AI-safety, or Data Model policy changes: NO
- Dependency/package/lockfile changes: NO
- Secrets, credentials, PHI, and production data: NO
- New API/task/provider/owner invented: NO
