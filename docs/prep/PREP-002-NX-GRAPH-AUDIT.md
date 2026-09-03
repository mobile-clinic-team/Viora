# PREP-002 — Conceptual Nx Project Graph Audit

Status: DRAFT — NOT PROVEN COMPLETE

## Scope

Documentation/review-only validation of the conceptual Nx project graph,
existing project metadata, observed dependency relationships, and the
allowed/forbidden boundary rules. This audit records discrepancies; it does
not implement or repair the graph.

## Repository Baseline

- Repository: `mobile-clinic-team/Viora`
- Base commit: `ad0e59f25672ae198002ca2bc10d89bbf2f5853d`
- Audit branch: `feature/PREP-002-nx-graph-validation`
- Nx configuration found: `nx.json`, with declared installation version
  `23.1.3`; the repository wrapper files `nx` and `nx.bat` are present.
- Workspace configuration: no root `package.json`, `tsconfig*.json`, or
  `workspace.json` is present in the audited repository. No local Nx binary or
  installed `node_modules` was available for a CLI graph query.
- Project configuration: 32 tracked `project.json` files were inventoried.
- `nx.json` contains target defaults for `build`, `test`, and `lint`, but no
  `depConstraints`, project list, or explicit dependency declarations.

## Actual Projects

The following projects are actual repository projects because a tracked
`project.json` exists at the listed root. Tags and project types come from that
file. A documented project not in this table is not treated as an existing
project.

| Project | Type | Root | Evidence | Notes |
|---|---|---|---|---|
| `api` | application | `apps/api` | `apps/api/project.json` | `boundary:app-api-composition-root` |
| `web` | application | `apps/web` | `apps/web/project.json` | `boundary:app-web`; no source file observed |
| `workers` | application | `apps/workers` | `apps/workers/project.json` | `boundary:app-workers`; no source file observed |
| `ai-contracts` | library | `libs/ai/contracts` | `libs/ai/contracts/project.json` | `boundary:ai-contracts` |
| `ai-gateway` | library | `libs/ai/gateway` | `libs/ai/gateway/project.json` | `boundary:ai-gateway`; no source file observed |
| `ai-tools` | library | `libs/ai/tools` | `libs/ai/tools/project.json` | `boundary:ai-tools`; no source file observed |
| `appointment-contracts` | library | `libs/appointment/contracts` | `libs/appointment/contracts/project.json` | `boundary:appointment-contract` |
| `audit-contracts` | library | `libs/audit/contracts` | `libs/audit/contracts/project.json` | `boundary:audit-contract` |
| `clinical-contracts` | library | `libs/clinical/contracts` | `libs/clinical/contracts/project.json` | `boundary:clinical-contract` |
| `doctor-contracts` | library | `libs/doctor/contracts` | `libs/doctor/contracts/project.json` | `boundary:doctor-contract` |
| `identity-application-entrypoint` | library | `libs/identity/application-entrypoint` | `libs/identity/application-entrypoint/project.json` | `boundary:identity-application-entrypoint` |
| `identity-application` | library | `libs/identity/application` | `libs/identity/application/project.json` | `boundary:identity-application` |
| `identity-contracts` | library | `libs/identity/contracts` | `libs/identity/contracts/project.json` | `boundary:identity-contract` |
| `identity-domain` | library | `libs/identity/domain` | `libs/identity/domain/project.json` | `boundary:identity-domain` |
| `patient-contracts` | library | `libs/patient/contracts` | `libs/patient/contracts/project.json` | `boundary:patient-contract` |
| `platform-audit` | library | `libs/platform/audit` | `libs/platform/audit/project.json` | `boundary:platform-audit` |
| `platform-authorization` | library | `libs/platform/authorization` | `libs/platform/authorization/project.json` | `boundary:platform-authorization` |
| `platform-config` | library | `libs/platform/config` | `libs/platform/config/project.json` | `boundary:platform-config` |
| `platform-context` | library | `libs/platform/context` | `libs/platform/context/project.json` | `boundary:platform-context` |
| `platform-database` | library | `libs/platform/database` | `libs/platform/database/project.json` | `boundary:platform-database-port` |
| `platform-idempotency` | library | `libs/platform/idempotency` | `libs/platform/idempotency/project.json` | `boundary:platform-idempotency` |
| `platform-messaging` | library | `libs/platform/messaging` | `libs/platform/messaging/project.json` | `boundary:platform-messaging` |
| `platform-observability` | library | `libs/platform/observability` | `libs/platform/observability/project.json` | `boundary:platform-observability` |
| `platform-outbox` | library | `libs/platform/outbox` | `libs/platform/outbox/project.json` | `boundary:platform-outbox` |
| `platform-secrets` | library | `libs/platform/secrets` | `libs/platform/secrets/project.json` | `boundary:platform-secrets` |
| `shared` | library | `libs/shared` | `libs/shared/project.json` | `boundary:shared-util` |
| `tenant-application-entrypoint` | library | `libs/tenant/application-entrypoint` | `libs/tenant/application-entrypoint/project.json` | `boundary:tenant-application-entrypoint` |
| `tenant-application` | library | `libs/tenant/application` | `libs/tenant/application/project.json` | `boundary:tenant-application` |
| `tenant-contracts` | library | `libs/tenant/contracts` | `libs/tenant/contracts/project.json` | `boundary:tenant-contract` |
| `tenant-data-access` | library | `libs/tenant/data-access` | `libs/tenant/data-access/project.json` | `boundary:tenant-data-access` |
| `tenant-domain` | library | `libs/tenant/domain` | `libs/tenant/domain/project.json` | `boundary:tenant-domain` |
| `web-api-client` | library | `libs/web/api-client` | `libs/web/api-client/project.json` | `boundary:web-api-client`; no source file observed |

## Conceptual Dependency Graph

The following relationships are verified from actual relative imports and are
not inferred from a desired future structure:

```text
api
  -> platform-context
  -> tenant-application-entrypoint
  -> tenant-contract
  -> tenant-data-access

tenant-application-entrypoint
  -> tenant-application

tenant-application
  -> platform-context
  -> platform-authorization
  -> tenant-domain
  -> tenant-contract

tenant-data-access
  -> tenant-domain
  -> tenant-contract

platform-authorization
  -> platform-context
```

Relationship classification: each arrow above is `VERIFIED` as an observed
repository import. Whether it is allowed is evaluated separately below. The
observed `tenant-application -> tenant-data-access` import is intentionally
excluded from this allowed conceptual graph because the authoritative matrix
forbids it; it is recorded as finding `F-004`.

## Boundary Rules

| Boundary | Rule | Source | Repository Evidence | Status |
|---|---|---|---|---|
| Project identity metadata | Each actual project has one exact `boundary:*`, one `scope:*`, and at least one `type:*` tag. | `docs/architecture/NX-PROJECT-GRAPH.md` sections 3 and 10 | All 32 tracked project files expose the expected metadata shape. | PASS |
| Runtime API composition | API composition root may wire domain application, entrypoint, data-access, and approved platform boundaries. | `docs/architecture/NX-PROJECT-GRAPH.md` sections 2 and 5.1 | `apps/api` imports tenant entrypoint, contracts, data-access, and platform context. | PASS |
| Domain application layering | Tenant application may depend on tenant domain/contracts and approved platform boundaries, but no additional boundary. | `docs/architecture/NX-PROJECT-GRAPH.md` section 5.3 | `tenant-application` also imports `tenant-data-access`. | FAIL |
| Domain data access | Tenant data-access may depend on tenant domain/contracts and approved database/infrastructure ports. | `docs/architecture/NX-PROJECT-GRAPH.md` section 5.4 | `tenant-data-access` imports tenant domain/contracts only. | PASS |
| Public worker entrypoints | Workers may use public application-entrypoints/contracts and approved outbox/messaging/observability boundaries, not private application or data-access projects. | `docs/architecture/NX-PROJECT-GRAPH.md` sections 5.1 and 7 | `apps/workers` has no source file to inspect. | UNKNOWN |
| Web boundary | Web may use generated API client, public contracts, and shared primitives; no direct database or private internals. | `docs/architecture/NX-PROJECT-GRAPH.md` section 5.1; `docs/DEVELOPMENT-CONTRACTS.md` section 4 | `apps/web` has no source file to inspect. | UNKNOWN |
| AI boundary | AI gateway/tools are libraries under `libs/ai/*`; no `apps/ai-gateway` or `apps/tool-gateway` project exists. | `docs/architecture/NX-PROJECT-GRAPH.md` sections 2 and 6 | No such application projects are tracked. | PASS |
| Platform direction | Platform primitives may depend only on their approved lower-level platform/shared boundaries. | `docs/architecture/NX-PROJECT-GRAPH.md` section 8 | Context/authorization observed relationship is consistent; most platform projects have no source file. | UNKNOWN |
| Nx enforcement | Nx configuration must enumerate concrete source tags and allowed dependency tags; omitted tags are forbidden. | `docs/architecture/NX-PROJECT-GRAPH.md` section 5 | `nx.json` has no `depConstraints`, and no local CLI dependency graph could be queried. | CONFLICT |
| Path-import enforcement | Circular dependencies, path-import bypasses, and untagged boundary escapes fail CI. | `docs/GITHUB-DEVELOPMENT-WORKFLOW.md` section 10 | Source uses direct relative imports into `libs/*/src/index.ts`; no boundary CI configuration is present in the audited tree. | CONFLICT |
| Shared library boundary | Shared contains only stateless primitives and must not depend on domain/platform implementations. | `docs/architecture/NX-PROJECT-GRAPH.md` section 4; `docs/DEVELOPMENT-CONTRACTS.md` section 4 | `libs/shared` has metadata only; no source file was observed. | UNKNOWN |

## Allowed Dependencies

The authoritative allowed directions are documented in
`docs/architecture/NX-PROJECT-GRAPH.md` sections 5.1–8 and summarized by
`docs/DEVELOPMENT-CONTRACTS.md` section 4. Repository evidence verifies these
observed allowed relationships:

- `api` → `platform-context`, `tenant-application-entrypoint`,
  `tenant-contract`, and `tenant-data-access`.
- `tenant-application-entrypoint` → `tenant-application`.
- `tenant-application` → `platform-context`, `platform-authorization`,
  `tenant-domain`, and `tenant-contract`.
- `tenant-data-access` → `tenant-domain` and `tenant-contract`.
- `platform-authorization` → `platform-context`.

Relationships are classified as `VERIFIED` only because the imports exist;
the architectural permission is separately classified by the Boundary Rules
table. No undocumented relationship is proposed as an allowed dependency.

## Forbidden Dependencies

The source-of-truth rules forbid, among other directions:

- domain application → data-access, except where an explicit authoritative
  rule says otherwise;
- workers → private application, domain, data-access, ORM, or infrastructure;
- web → direct database or private domain internals;
- AI → direct database access, arbitrary code, or private domain internals;
- cross-domain private repository access and boundary bypasses;
- circular dependencies and path-import bypasses.

The actual tenant application/data-access relationship and the absence of
enforcement configuration are recorded as findings. No forbidden relationship
is removed by this audit.

## Findings

| ID | Finding | Evidence | Classification | Impact | Follow-up |
|---|---|---|---|---|---|
| F-001 | Nx wrapper/configuration exists and declares version `23.1.3`; 32 project metadata files are tracked. | `nx.json`, `nx`, `nx.bat`, all tracked `project.json` files | VERIFIED | Establishes the actual project inventory baseline. | Use this inventory as the PREP-002 baseline. |
| F-002 | The actual project set is a lazy-scaffolded subset of the larger conceptual graph; many documented domain/application/data-access/API projects have no tracked `project.json` or source. | Actual Projects table compared with `docs/architecture/NX-PROJECT-GRAPH.md` sections 3–7 | DOCUMENTED | A documented concept must not be treated as an importable repository project. | Future project creation requires its own scoped task and review. |
| F-003 | `nx.json` does not contain the concrete `depConstraints` required by the approved graph document. | `nx.json`; graph document section 5 | CONFLICT | Boundary rules are documented but not currently enforceable through the observed Nx config. | FOUND-003 / architecture-owner review; do not repair in PREP-002. |
| F-004 | `tenant-application` imports `tenant-data-access` directly. | `libs/tenant/application/src/index.ts:6`; graph document section 5.3 | VIOLATION | Breaks the tenant application layering rule and permits application code to reach a data-access boundary. | Architecture/Engineer A decision and separately scoped implementation fix. |
| F-005 | Runtime source uses direct relative imports into `libs/*/src/index.ts`, while workflow rules prohibit path-import bypasses and require boundary enforcement. | `apps/api/src/tenant-api.ts:1,8–10`; `libs/tenant/application/src/index.ts:1–6`; workflow section 10 | CONFLICT | Project-boundary enforcement and public import conventions are not proven by repository configuration. | Architecture/FOUND-003 review; no import refactor in PREP-002. |
| F-006 | `apps/web`, `apps/workers`, AI libraries, most domain libraries, and platform libraries have metadata without source evidence sufficient to validate their runtime edges. | Actual Projects table and `rg --files apps libs` inventory | UNKNOWN | Allowed/forbidden dependency checks are incomplete for those projects. | Validate when source/configuration exists in a dedicated task. |
| F-007 | Root package/workspace/type configuration is absent, so CLI-level project graph resolution and package-alias analysis cannot be verified. | Missing `package.json`, `tsconfig*.json`, and `workspace.json`; no local Nx binary | UNKNOWN | The audit cannot claim a generated Nx graph or complete dependency closure. | Establish approved workspace/check configuration in the foundation task. |

## Conflicts / Unknowns

- `F-003` is a documentation/configuration conflict: the approved graph
  requires explicit Nx constraints, but the current `nx.json` only contains
  target defaults.
- `F-004` is an observed dependency violation. It is not resolved here because
  PREP-002 is audit-only and no architecture decision authorizes a change.
- `F-005` and `F-007` prevent claiming that boundary enforcement is active or
  that the complete Nx dependency graph has been generated.
- `F-006` remains unknown until the corresponding source/configuration exists;
  missing evidence is not treated as proof of compliance.

## No Invented Paths

No new project, source path, dependency, or configuration path was created or
assumed to be an existing project. The documented paths absent from the Actual
Projects table remain documentation-only concepts and are not included in the
repository graph. No future structure is proposed as an implementation fact.

## PREP-002 Acceptance Criteria

- [x] Existing Nx projects/configuration inventoried.
- [x] Existing boundaries compared against repository evidence.
- [x] Allowed dependencies checked where source evidence exists.
- [x] Forbidden dependencies checked where source evidence exists.
- [x] No new project/path invented.
- [x] No code, project configuration, dependency, migration, CI, or
  infrastructure changed.
- [x] Unresolved ambiguity and observed violations recorded instead of
  silently resolved.

## Conclusion

**BLOCKED — NOT PROVEN COMPLETE.** The repository inventory is established,
but the conceptual graph cannot be confirmed as fully enforced because
`depConstraints` are absent, the tenant application has an observed forbidden
data-access dependency, and several project edges lack source/configuration
evidence. These findings are recorded for the appropriate architecture and
foundation tasks; PREP-002 does not repair them.

## Scope Guard

- Code changes: NO
- Migration changes: NO
- CI changes: NO
- Infrastructure changes: NO
- Source-of-truth changes: NO
- PREP-003/004/005/006/007/008/010 changes: NO
- PREP-005: TECHNICALLY BLOCKED
