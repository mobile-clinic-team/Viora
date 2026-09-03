# PREP-001 Conflict Register

Working governance artifact for `PREP-001 — Reconcile source-of-truth documents and maintain the blocker register`.

This register is documentation-only. It does not select an unapproved option,
change a source-of-truth document, authorize implementation, or claim that
PREP-001 is complete. Register entry status values are limited to `OPEN`,
`DEFERRED`, and `RESOLVED`.

## Scope and acceptance criterion

PREP-001 reconciles the seven repository source-of-truth documents and
maintains the related blocker register. The acceptance criterion from
`docs/IMPLEMENTATION-PLAN.md` is:

> Every conflict is recorded with owner, impact, and affected phase.

The review is isolated from PLAT-001. The PLAT-001 contract-only changes and
their merged commit are not modified by this task.

## Source-of-truth documents

1. `docs/product/system-definition.md`
2. `docs/architecture/architecture-decisions.md`
3. `docs/DATA-MODEL.MD`
4. `docs/API-CONTRACTS.md`
5. `docs/SECURITY.md`
6. `docs/AI-SAFETY.md`
7. `docs/DEVELOPMENT-CONTRACTS.md`

Supporting planning and governance evidence is referenced separately where it
does not itself act as a source of product, architecture, data, API, security,
AI-safety, or development policy: `docs/IMPLEMENTATION-PLAN.md`,
`docs/DECISION-LOG.md`, `docs/DECISION-CLOSURE-REPORT.md`, and
`docs/GITHUB-DEVELOPMENT-WORKFLOW.md`.

## Conflict register

Owner assignment is marked `PROPOSED` unless the repository explicitly assigns
the responsibility. No individual reviewer or approval is inferred.

| ID | Conflict / inconsistency | Source documents | Current interpretation | Owner | Owner assignment status | Impact | Affected phase | Status | Follow-up task | Decision dependency | Evidence / reference |
|---|---|---|---|---|---|---|---|---|---|---|---|
| C-001 | Several documents are identified as authoritative, but no explicit precedence rule resolves contradictions between them. | All seven source-of-truth documents; `docs/IMPLEMENTATION-PLAN.md` | Preserve each document's stated responsibility and escalate cross-document contradictions for governance review. | Team / Architecture | PROPOSED | Scope, contract, security, and boundary drift. | Phase 0 governance; all later phases | OPEN | PREP-001 | Governance/source-of-truth decision | `docs/API-CONTRACTS.md` section 1; Implementation Plan section 42 |
| C-002 | Architecture references and governance closure material do not establish that every named artifact and decision has identical current wording. | `docs/architecture/architecture-decisions.md`; `docs/DECISION-LOG.md`; `docs/DECISION-CLOSURE-REPORT.md`; `docs/IMPLEMENTATION-PLAN.md` | Closure is evidence of approved direction only where the referenced decision and constraints agree; wording conflicts remain review items. | Team / Architecture | PROPOSED | Implementations may rely on stale or differently scoped decisions. | Phase 0; architecture and implementation gates | OPEN | PREP-001 / PREP-010 | Architecture governance review | Decision Closure Report; Decision Log decision/follow-up sections |
| C-003 | Outbox contracts use `PENDING`, `PROCESSING`, `COMPLETED`, and `FAILED`, while prose also uses broader terms such as processed/completed. | `docs/DEVELOPMENT-CONTRACTS.md`; `docs/API-CONTRACTS.md`; platform outbox contract | The enum is not changed here. Future runtime work must define whether “processed” is descriptive or canonical persisted status. | Engineer A / Shared Platform | PROPOSED | Ambiguous worker, retry, and observability behavior. | PREP-005; future runtime integration | OPEN | PREP-005 | Outbox lifecycle/status decision | Development Contracts sections 20–23; `libs/platform/outbox/src/index.ts` |
| C-004 | Outbox envelope requirements and minimum event identity/context are distributed across documents without one reconciled implementation-ready envelope specification. | `docs/API-CONTRACTS.md`; `docs/DEVELOPMENT-CONTRACTS.md`; `docs/SECURITY.md`; platform outbox contract | Preserve tenant, originating actor/system, resource scope, request/correlation context, retry safety, and uniqueness; final field specification is deferred. | Engineer A / Shared Platform | PROPOSED | Events could lose tenant/audit context or duplicate side effects. | PREP-005; future workers and integrations | OPEN | PREP-005 | Outbox envelope and uniqueness review | Outbox contract and migration 008 dependency |
| C-005 | Queue, worker, retry, and dead-letter behavior is an architectural boundary, while concrete provider/runtime behavior remains open. | `docs/architecture/architecture-decisions.md`; `docs/DEVELOPMENT-CONTRACTS.md`; `docs/AI-SAFETY.md` | Provider-neutral contracts may be prepared, but no queue provider, worker runtime, or dead-letter implementation is authorized here. | Engineer A / Platform with affected owners | PROPOSED | Premature implementation would expand scope and change reliability semantics. | Future runtime phase; not current contract-only work | DEFERRED | PREP-005 / later platform implementation | Queue and dead-letter architecture decision | Development Contracts section 23; architecture queue/worker sections |
| C-006 | Conceptual migration order and dependency ownership need reconciliation across identity, audit, idempotency, outbox, and domain tables; no migrations exist yet. | `docs/DATA-MODEL.MD`; `docs/IMPLEMENTATION-PLAN.md`; `docs/DEVELOPMENT-CONTRACTS.md`; `docs/API-CONTRACTS.md` | The order is planning evidence, not executable migration authority. PREP-005 must review prerequisites, ownership, constraints, and API dependencies first. | Engineer A / affected schema owners | PROPOSED | Incorrect order could violate FK, uniqueness, tenant-scope, or rollback requirements. | PREP-005; migration implementation phase | OPEN | PREP-005 | Migration dependency and ownership review | Implementation Plan migration order; Data Model migration section |
| C-007 | Contract-level idempotency semantics exist, but persistent storage, transaction coupling, expiry execution, and concurrency enforcement are deferred. | `docs/API-CONTRACTS.md`; `docs/DEVELOPMENT-CONTRACTS.md`; platform idempotency contract | Canonical identity is `tenant_id + actor_id + endpoint + key`; contract tests do not prove persistence, DB uniqueness, or transaction behavior. | Engineer A / Shared Platform | PROPOSED | A contract could be mistaken for production duplicate-side-effect protection. | Current contract phase; future persistence phase | DEFERRED | PREP-005 / later platform implementation | Persistent idempotency and migration review | Development Contracts section 22; `libs/platform/idempotency/src/index.ts` |
| C-008 | Documents distinguish conceptual architecture from implementation, but readiness language can be read as authorization for runtime work before decisions and migrations are approved. | `docs/IMPLEMENTATION-PLAN.md`; `docs/architecture/architecture-decisions.md`; `docs/GITHUB-DEVELOPMENT-WORKFLOW.md` | “Implementation-ready” requires its explicit dependencies, blockers, review, and approval requirements; PREP-001 introduces no infrastructure. | Team / Architecture | PROPOSED | Work could bypass decision gates or expand documentation into runtime implementation. | Phase 0 gate; every implementation phase | OPEN | PREP-001 / PREP-010 | Readiness and gate wording reconciliation | Implementation Plan sections 42 and 56; workflow architectural-change rules |
| C-009 | Request, correlation, actor, and tenant context requirements appear in multiple contracts but are not consolidated into one reviewed propagation/audit matrix. | `docs/SECURITY.md`; `docs/DEVELOPMENT-CONTRACTS.md`; `docs/API-CONTRACTS.md`; `docs/AI-SAFETY.md`; platform context/idempotency/outbox contracts | Authenticated actor and validated tenant context must remain bound through authorization, repository ports, idempotency, outbox, jobs, and audit; exact runtime propagation is future work. | Engineer A with Security / affected owners | PROPOSED | Mutable or missing context could create isolation, audit, or retry-safety defects. | PREP-001; PREP-005; security and integration gates | OPEN | PREP-005 / PREP-007 / PREP-008 | Context propagation and audit review | Security audit/context sections; Development Contracts sections 22–23 |
| C-010 | “Draft”, “review”, “implementation-ready”, and “blocked” are different governance states, but no single state/evidence matrix is provided. | `docs/IMPLEMENTATION-PLAN.md`; `docs/DECISION-CLOSURE-REPORT.md`; `docs/GITHUB-DEVELOPMENT-WORKFLOW.md` | A plan or contract alone does not establish implementation readiness; decisions, owners, tests, migrations, and approvals require evidence. | Team / Architecture | PROPOSED | Teams may report completion without acceptance or required review. | Phase 0 governance; PR and release gates | OPEN | PREP-001 / PREP-010 | Governance state/evidence matrix | Implementation Plan readiness/blocker sections; workflow PR gates |
| C-011 | Closure reports and task records can state resolved/ready conditions while task-specific repository evidence, owner review, CI, or human acceptance is absent. | `docs/DECISION-CLOSURE-REPORT.md`; `docs/IMPLEMENTATION-PLAN.md`; `docs/GITHUB-DEVELOPMENT-WORKFLOW.md` | Closure claims must be scoped to the exact decision/task and backed by repository, CI, review, and approval evidence; this register makes no completion claim. | Team / Architecture | PROPOSED | False closure could release blocked work or hide unresolved dependencies. | Phase 0 closure; all release gates | OPEN | PREP-001 / PREP-010 | Evidence-based closure review | Decision Closure Report evidence sections; workflow post-merge/review rules |

## Blocker register

These blockers are follow-up governance items, not implementation work added to
PREP-001:

| Blocker | Related conflicts | Owner | Affected phase | Status | Required evidence |
|---|---|---|---|---|---|
| B-001 | C-001, C-002, C-008, C-010, C-011 | Team / Architecture | PREP-001 and decision gates | OPEN | Reviewed authority, readiness, and closure evidence rules |
| B-002 | C-003, C-004, C-005 | Engineer A / Shared Platform | PREP-005 and future outbox runtime | OPEN | Reconciled outbox lifecycle, envelope, retry, and dead-letter decision |
| B-003 | C-006 | Engineer A / affected schema owners | PREP-005 and migration implementation | OPEN | Reviewed order, ownership, prerequisites, and rollback/forward-fix evidence |
| B-004 | C-007, C-009 | Engineer A with Security / affected owners | PREP-005 and security/integration gates | OPEN | Persistent idempotency and context/audit propagation design with approved boundaries |

`C-005` and `C-007` contain deferred runtime work. `DEFERRED` is not approval
to implement that work in PREP-001 and does not remove the PREP-005 dependency.

## Evidence and review state

- Verified isolated-task base: PLAT-001 merge commit `05cea28` on `main`.
- PREP-001 Issue: `#16` (`PREP-001 — Reconcile source-of-truth documents and maintain the blocker register`).
- This file is the PREP-001 working artifact on the dedicated branch.
- No conflict in this register is marked `RESOLVED`.
- No individual owner, CODEOWNER, Architecture/Security review, CI result,
  human acceptance, or merge is asserted without repository or GitHub evidence.
- PREP-005 remains technically blocked pending the evidence listed in B-002
  through B-004.

## Scope exclusions

This artifact does not add or modify runtime persistence, PostgreSQL,
migrations, ORM code, transaction management, HTTP routing or middleware,
provider SDKs, queue infrastructure, persistent idempotency, or AUTH-001 /
AUTH-002 behavior.
