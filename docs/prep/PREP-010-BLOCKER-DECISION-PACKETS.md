# PREP-010 — Decision Packets for BLOCK-001 through BLOCK-010

Status: PACKETS RECONCILED — APPROVAL AND RELEASE DEPENDENCIES RECORDED;
NO NEW DECISION IS SELECTED

This artifact reconciles the decision packets, decision log, closure report,
Implementation Plan, and affected contracts for BLOCK-001 through BLOCK-010.
The decisions themselves remain owned by the documented owners. PREP-010 does
not change architecture, API, security, AI safety, Data Model, provider,
retention, or production policy.

## Scope and acceptance criterion

The task requires each blocking decision to have proposed evidence, owner, and
explicit approval status. Resolved-for-implementation is distinguished from
release dependency. A decision packet is not runtime implementation evidence.

## Source and status reconciliation

| Source | Role in this audit |
|---|---|
| `docs/DECISION-PACKETS.md` | Decision options, proposed evidence, owners, and affected documents |
| `docs/DECISION-LOG.md` | Decision history, approval status, and follow-up traceability |
| `docs/DECISION-CLOSURE-REPORT.md` | Closure status, unresolved release dependencies, and consistency checks |
| `docs/IMPLEMENTATION-PLAN.md` | BLOCK-001..010 scope, affected phases, owners, and implementation gates |
| `docs/API-CONTRACTS.md`, `docs/SECURITY.md`, `docs/AI-SAFETY.md`, `docs/DATA-MODEL.MD` | Enforceable contract and policy consequences |

The current governance record marks the MVP decisions as approved or resolved
for implementation where stated, while provider evidence, exact operational
values, production recovery targets, and broader compliance policy values
remain release dependencies. No unresolved release dependency is converted
into an implementation approval by this artifact.

## BLOCK-001 — Authentication provider/session/token/recovery details

| Field | Reconciled record |
|---|---|
| Owner | Engineer A / Security; Architecture, API, and Product affected owners |
| Decision | Auth0-style Managed CIAM OIDC/OAuth2 target behind provider-neutral application boundary; 15-minute access token; 7-day rotating refresh session; replay-family revocation; MFA scope; application revocation; provider-managed recovery with guarded exceptions |
| Evidence required | Identity-context contract; token/session validation tests; membership/tenant resolution; revocation/replay tests; privileged MFA/recovery tests; audit evidence; provider contract review |
| Status | Resolved for implementation; final provider contract, region/residency, and service-level terms remain release dependencies |
| Gate | Required before protected tenant/domain endpoints; release terms required before production |

## BLOCK-002 — Separate Nurse/Clinical Staff and Receptionist permission matrix

| Field | Reconciled record |
|---|---|
| Owner | Product / Engineer A with affected Patient, Clinical, and Appointment owners |
| Decision | Separate application roles with endpoint-specific least privilege and default deny; role alone does not grant resource access |
| Evidence required | Permission matrix; positive/negative endpoint tests; resource/relationship/tenant checks; IDOR and default-deny tests; membership/role change audit |
| Status | Resolved for implementation |
| Gate | Required before authorization-sensitive domain work; endpoint evidence remains required per implementation task |

## BLOCK-003 — Canonical clinical lifecycle status

| Field | Reconciled record |
|---|---|
| Owner | Product / Engineer B with Architecture, API, and AI Safety |
| Decision | `IN_REVIEW` is the canonical clinical intermediate status |
| Evidence required | State-transition tests; review/finalize/amendment contract; invalid-transition tests; immutable finalized version tests; AI draft handoff tests |
| Status | Resolved for implementation |
| Gate | Clinical and AI approval implementation must use `IN_REVIEW`; no alternate status may be invented |

## BLOCK-004 — Public conflict, OCC, and retry semantics

| Field | Reconciled record |
|---|---|
| Owner | Architecture / Engineers B-C / API |
| Decision | Strong `ETag`/`If-Match`; monotonic `BIGINT` for canonical mutable resources; stale update `412`; scheduling conflicts `409`; immutable clinical versions outside OCC; domain-specific retry allowlist and security re-checks |
| Evidence required | Version/ETag tests; stale authorization-order tests; appointment overlap/double-booking tests; retry/re-fetch tests; no-auto-retry clinical/approval tests; idempotency interaction evidence |
| Status | Resolved for implementation |
| Gate | Required for tenant/profile, patient, appointment, clinical, and AI approval mutations; implementation must preserve human confirmation boundaries |

## BLOCK-005 — AI platform/provider/model/retention/RAG governance

| Field | Reconciled record |
|---|---|
| Owner | Product / Engineer D / Security with Architecture and affected domain owners |
| Decision | Self-hosted Dify behind AI/Tool Gateway; controlled LLM/Embedding adapters; pinned MVP model pair; guarded draft-first profile; tenant-only MVP knowledge; typed knowledge mapping; minimum-necessary lifecycle; Legal Hold; risk-tiered escalation |
| Evidence required | Gateway/tool boundary tests; provider/data isolation review; pinned model compatibility/evaluation; RAG tenant/status/permission tests; Golden Dataset and redaction evidence; draft/approval and fail-closed tests |
| Status | Resolved for implementation; provider evidence and exact production limits remain release dependencies |
| Gate | Gateway/RAG/AI implementation requires access, audit, domain contracts, and safety evidence; production requires provider/limit evidence |

## BLOCK-006 — Secrets, encryption, and cloud architecture

| Field | Reconciled record |
|---|---|
| Owner | Security / Operations with Engineer A |
| Decision | Managed Secrets Manager/KMS; workload-identity delivery; selective classified-PHI field/envelope encryption; key-version metadata; rotation/revocation; provider-secret isolation |
| Evidence required | Secret scanning; environment isolation; workload identity; encryption/key-access tests; rotation/revocation drill; audit and redaction review; provider-secret boundary review |
| Status | Resolved for MVP; exact cloud topology remains operational/release detail |
| Gate | No credentials in Git/logs/build output; production delivery requires approved operational evidence |

## BLOCK-007 — Compliance, residency, retention, deletion, and export

| Field | Reconciled record |
|---|---|
| Owner | Product / Compliance with Security and affected owners |
| Decision | MVP-scoped governance boundary and Product/Compliance ownership; category-specific policy controls for clinical, AI, audit, export, deletion/anonymization, residency, and backups |
| Evidence required | Published category policies; legal-hold behavior; retention/deletion/export tests; residency review; audit and backup access evidence; production approval record |
| Status | Resolved for MVP; exact clinical policy values, residency, export/deletion/anonymization scope, audit policy, and backup targets remain release dependencies |
| Gate | Interfaces/tests may be prepared; irreversible or production-specific lifecycle behavior cannot be enabled without policy approval |

## BLOCK-008 — Clinical Files MVP scope

| Field | Reconciled record |
|---|---|
| Owner | Product with Engineers B/D and Security/Architecture affected owners |
| Decision | Clinical files are Post-MVP; MVP is text and structured data only |
| Evidence required | Scope checks preventing file API/storage/worker/AI ingestion from MVP; future file decision record; no arbitrary storage access in AI tests |
| Status | Resolved |
| Gate | File schema, storage, upload/download, malware scanning, workers, and AI ingestion remain outside MVP |

## BLOCK-009 — Uniform opaque cursor and pagination governance

| Field | Reconciled record |
|---|---|
| Owner | API / Architecture with all collection endpoint owners |
| Decision | Uniform opaque cursor; server-enforced governance; default page size 20; maximum 100 |
| Evidence required | Cursor encode/decode/expiry tests; tampering and cross-tenant tests; bounded page-size tests; stable ordering and continuation tests across API/RAG/AI collections |
| Status | Resolved for implementation |
| Gate | Every affected list/search endpoint must implement and test the standard; cursor must not grant tenant authority |

## BLOCK-010 — Appointment `NO_SHOW` authority

| Field | Reconciled record |
|---|---|
| Owner | Product / Engineer C with Security/API affected owners |
| Decision | Explicit application transition command for `NO_SHOW`, with role/permission, transition validation, idempotency, audit, and negative-test boundary |
| Evidence required | Command contract; valid/invalid transition tests; endpoint/role authorization tests; replay/idempotency tests; audit attribution; AI denial test |
| Status | Resolved for implementation |
| Gate | Must remain an application command; it must not be inferred from a generic status PATCH or model text |

## Cross-decision dependency map

| Implementation area | Required decisions/evidence |
|---|---|
| Identity and tenant context | BLOCK-001, BLOCK-002, BLOCK-006; S1 evidence |
| Patient and Doctor | BLOCK-001, BLOCK-002, BLOCK-009; S2 evidence |
| Appointment | BLOCK-002, BLOCK-004, BLOCK-009, BLOCK-010; idempotency/outbox and S2 evidence |
| Clinical | BLOCK-002, BLOCK-003, BLOCK-004, BLOCK-007; S2/S3 evidence |
| AI Gateway/RAG/tools | BLOCK-001, BLOCK-002, BLOCK-005, BLOCK-006, BLOCK-009; S2/S4 evidence |
| AI clinical draft/approval | BLOCK-003, BLOCK-004, BLOCK-005, BLOCK-007; S3/S4/S5 evidence |
| Production release | BLOCK-001, BLOCK-005, BLOCK-006, BLOCK-007 plus S6 operational evidence |

## Governance rules

- A packet records a decision and its evidence requirements; it does not
  authorize implementation outside the dependency graph.
- “Resolved for implementation” does not mean provider, operational, or
  production-release evidence is complete.
- Any change to a source-of-truth document requires affected-owner review and
  a separate scoped task; PREP-010 does not rewrite those documents.
- Evidence must be synthetic/redacted, attributable, reproducible, and linked
  to the relevant task, commit/build, environment, owner, and acceptance item.
- No decision packet permits bypassing authorization, tenant isolation, audit,
  clinical immutability, human approval, or fail-closed behavior.

## Scope guard

- New architecture/API/security/AI/Data Model decision: NO
- Provider, runtime, migration, database, test, or infrastructure implementation: NO
- Policy value selection where marked release-dependent: NO
- Secrets, credentials, PHI, production data, or raw AI content: NO
- Release-readiness or compliance certification claim: NO

## Acceptance criteria

- [x] BLOCK-001 through BLOCK-010 each have owner, decision record, evidence requirements, status, and gate.
- [x] Resolved-for-implementation decisions are distinguished from release dependencies.
- [x] Cross-decision implementation dependencies are mapped.
- [x] Source-of-truth and affected-owner review requirements are preserved.
- [x] No option is silently selected and no runtime implementation is added.
- [ ] Team, Security, Architecture, Product/Compliance, Clinical, AI, and affected domain owners review the reconciled packets.

