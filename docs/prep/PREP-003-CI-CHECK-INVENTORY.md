# PREP-003 — CI Check and Pull Request Gate Inventory

Status: AUDIT COMPLETE — IMPLEMENTATION PREREQUISITES REMAIN UNVERIFIED

This is the task-specific documentation artifact for `PREP-003 — Inventory CI
checks and PR gates` (Issue #20). It records repository evidence at base commit
`f7993d7` on branch `feature/PREP-003-ci-check-inventory`. The audit is
documentation-only and does not create or modify CI configuration.

## Scope and acceptance criterion

The Implementation Plan defines PREP-003 as an A/C task with no dependencies:

> Inventory CI checks and PR gates without creating CI configuration.

The acceptance criterion is to map lint, type, unit, integration, API, build,
security, and dependency checks. This inventory also records applicability,
blocking classification, ownership, prerequisites, and evidence limits for Nx,
migration, tenant-isolation/authorization, AI, and CODEOWNERS checks.

## Repository evidence inspected

| Evidence | Observed state | Classification |
|---|---|---|
| `.github/workflows/governance.yml` | Workflow exists for pull requests and pushes to `main`; it verifies selected source-of-truth files, workflow headings, and credential markers. | VERIFIED |
| `.github/workflows/secret-scan.yml` | Workflow exists for pull requests and pushes to `main`; it checks full Git history with Gitleaks. | VERIFIED |
| `.github/pull_request_template.md` | PR checklist requires task traceability, validation reporting, affected-owner review, and human merge. | VERIFIED |
| `.github/CODEOWNERS` | Path ownership mappings exist for repository/platform, identity/tenant, security, clinical, doctor/appointment, and AI paths. | VERIFIED — enforcement not proven |
| `docs/CI-CHECK-INVENTORY.md` | FOUND-003 baseline inventory and intended transition policy already exist. | VERIFIED — prior-task artifact |
| `docs/GITHUB-DEVELOPMENT-WORKFLOW.md` | Documents required workflow, review, branch-protection, CI, ownership, and definition-of-done expectations. | VERIFIED — policy evidence |
| `nx.json` | Nx target defaults are present, but no `depConstraints` are present. | VERIFIED — boundary enforcement incomplete |
| Root package/workspace configuration | No root `package.json`, lockfile, `tsconfig*.json`, or local Nx installation was found in the repository tree. | VERIFIED — prerequisite absent |

No GitHub repository setting is inferred from tracked files. Required status
checks, branch protection, CODEOWNER enforcement, and administrator/bypass
configuration remain unverified unless GitHub settings evidence is supplied by
the repository/platform owner.

## Currently implemented repository checks

These are the only CI workflow jobs observed in the repository. Their
existence is verified; a local audit does not claim that a remote run is
passing.

| Check/job | Trigger | Blocking classification | Owner | Evidence and limits |
|---|---|---|---|---|
| `governance` — source-of-truth file presence | Pull request; push to `main` | Blocking by workflow intent | Repository/platform; Architecture for policy | Verifies five named governance files. It does not run lint, typecheck, tests, build, Nx, migration, or dependency checks. |
| `governance` — required workflow headings | Pull request; push to `main` | Blocking by workflow intent | Repository/platform; Architecture | Checks selected headings in `docs/GITHUB-DEVELOPMENT-WORKFLOW.md`. This is documentation integrity, not full workflow validation. |
| `governance` — accidental credential-marker scan | Pull request; push to `main` | Blocking by workflow intent | Repository/platform; Security | Scans non-Markdown paths for selected high-confidence markers. It is not a complete secret, PHI, or dependency-vulnerability scan. |
| `secret-scan` — Gitleaks full-history scan | Pull request; push to `main` | Blocking by workflow intent | Security; repository/platform | Uses full-history checkout and `gitleaks/gitleaks-action@v3`; secret values are not stored in the repository. A successful run is not asserted by this artifact. |

The two workflow files expose `contents: read` permissions. No additional
workflow job or required-check name is claimed.

## Required checks and prerequisites

The following checks are required by the existing FOUND-003 inventory and
development workflow when their applicability prerequisites exist. `REQUIRED`
does not mean the check is currently runnable or configured.

| Check family | Current evidence | Blocking / advisory | Applicability and prerequisite | Owner |
|---|---|---|---|---|
| YAML/configuration validation | No dedicated validator workflow or selected validator is present. | Required and blocking when applicable | Workflow/configuration changes, after a validator is selected through the appropriate repository task. | Repository/platform |
| Dependency install and lockfile validation | No root package manifest or lockfile is present. | Required and blocking once prerequisites exist | Package manifest and lockfile must exist. | Repository/platform |
| Formatting | No formatter configuration or CI job is present. | Required and blocking once configuration exists | Affected source/configuration. | Repository/platform / affected owner |
| Lint | No lint executable/configuration or CI job is present. | Required and blocking once source/configuration exists | Every affected project. | Repository/platform / affected owner |
| Typecheck | No root TypeScript/workspace configuration or CI job is present. | Required and blocking once source/configuration exists | Every affected TypeScript project. | Repository/platform / affected owner |
| Unit tests | Tests exist in selected source slices, but no CI test job is present. | Required and blocking for affected projects | Every affected project with tests. | Affected domain owner |
| Integration/API tests | API synthetic tests exist, but no integration/API CI job is present. | Required and blocking when behavior is affected | Affected integration/API behavior; this task does not add real HTTP tests. | Affected domain owner / API owner |
| Build/package validation | Project metadata exists, but no package/build setup or CI job is present. | Required and blocking for affected buildable projects | Affected buildable applications/libraries. | Repository/platform / affected owner |
| Nx affected project detection | `nx.json` exists, but no local Nx CLI/workspace resolution was evidenced. | Required and blocking after prerequisites exist | Nx projects and targets must be runnable; affected scope must not omit cross-cutting checks. | Repository/platform / Architecture |
| Nx dependency graph and tag constraints | `nx.json` has no concrete `depConstraints`; PREP-002 recorded missing enforcement evidence. | Required and blocking after tagged Nx skeleton exists | Projects must be tagged and dependency direction enforced. | Architecture / repository/platform |
| Dependency vulnerability scan | No dependency graph, scanner configuration, or CI job is present. | Required and blocking once dependencies/scanner exist | Dependencies and a supported scanner must exist. | Security / repository/platform |
| Static security analysis | No tool or workflow is selected. | Future/optional; advisory initially | Source code and a later approved tool selection. | Security / repository/platform |
| Healthcare-data/PHI protection scan | No dedicated scan job is present. | Required and blocking when applicable | Fixtures, exports, artifacts, or application source involving healthcare data exist. | Security / Clinical owner |
| Migration/schema validation | No migrations or database runtime exist. | Required and blocking only when applicable | Database schema/migrations exist. | Database owner / affected domain owner |
| Tenant-isolation and authorization tests | Relevant synthetic tests exist, but no CI job is present. | Required and blocking when protected behavior is affected | Protected API/domain behavior. | Security / affected domain owner |
| AI safety/evaluation checks | No AI runtime/evaluation job is present. | Required and blocking only when applicable | AI Gateway, Tool Gateway, RAG, or AI behavior is affected. | AI Safety / Security / affected owner |
| CODEOWNERS path ownership | `.github/CODEOWNERS` mappings exist. | Intended blocking after GitHub enforcement | GitHub required-review enforcement must be enabled and verified separately. | Repository/platform / affected owner |

## Pull request gate classification

### Current repository evidence

For a pull request or a push to `main`, the repository contains evidence for
two workflow jobs: `governance` and `secret-scan`. The workflows are intended
to block when their own steps fail. This artifact does not assert GitHub branch
protection or required-status-check settings because those are not represented
in repository files.

### Intended gate after prerequisites exist

The existing governance documents require the following sequence and gate
behavior:

```text
repository integrity
  -> governance and secret scanning
  -> dependency/lockfile validation
  -> affected project detection
  -> format, lint, typecheck, unit, integration/API, build
  -> Nx, security, migration, tenant, and AI checks as applicable
  -> owner review and branch-protection conditions
  -> human merge
```

An applicable blocking check must pass before merge. An unavailable check is
not silently treated as passed; its prerequisite or a reviewed, task-scoped
exception must be recorded. Advisory findings remain visible and require
follow-up if a later decision promotes them.

## Findings and follow-up

| ID | Finding | Evidence | Impact | Follow-up |
|---|---|---|---|---|
| PREP3-F-001 | Only governance and secret-scan workflows are implemented in the tracked repository. | `.github/workflows/governance.yml`; `.github/workflows/secret-scan.yml` | Most quality, boundary, dependency, and domain-specific gates are not executable through CI yet. | Foundation/workspace implementation task; do not add workflows in PREP-003. |
| PREP3-F-002 | Existing `docs/CI-CHECK-INVENTORY.md` records intended checks but is a FOUND-003 artifact, not task-specific PREP-003 traceability. | `docs/CI-CHECK-INVENTORY.md`; Issue #20 | Documentation presence cannot be treated as execution evidence or completion of future checks. | Preserve the distinction in the PREP-003 PR. |
| PREP3-F-003 | Root package, lockfile, TypeScript workspace, and local Nx execution prerequisites are absent. | Repository file inventory; `nx.json`; PREP-002 audit | Install, affected, typecheck, build, and boundary checks cannot be claimed as runnable. | Establish approved workspace/check prerequisites in a separate scoped task. |
| PREP3-F-004 | CODEOWNERS mappings exist, but repository settings evidence for required enforcement is absent. | `.github/CODEOWNERS`; workflow documentation | Path ownership may not yet be a merge gate. | Repository/platform owner must verify GitHub settings separately. |
| PREP3-F-005 | Existing governance job checks five source-of-truth files, while the repository identifies additional policy documents elsewhere. | `.github/workflows/governance.yml`; workflow documentation | File-presence coverage must not be overstated as complete source-of-truth validation. | Update only through a separately scoped governance decision/task if required. |

## Acceptance criteria

- [x] Current workflow and repository check evidence inventoried without
  inventing configuration.
- [x] Lint, typecheck, unit, integration/API, build, security, dependency, Nx,
  migration, tenant-isolation/authorization, AI, and CODEOWNERS checks mapped
  with status and applicability.
- [x] Blocking versus advisory classification and ownership documented.
- [x] Missing prerequisites, unverified GitHub enforcement, and transition
  conditions recorded explicitly.
- [x] Artifact is documentation-only and does not create or modify CI
  configuration.
- [ ] Validation and remaining risks are reported in the PR.

The last item is completed by the task PR rather than by this standalone
artifact.

## Scope guard

- Code changes: NO
- CI/workflow changes: NO
- Dependency or lockfile changes: NO
- Nx configuration changes: NO
- Database, migration, ORM, or infrastructure changes: NO
- Authentication, authorization, tenant, clinical, or AI behavior changes: NO
- Protected policy-document changes: NO
- PREP-005 migration/idempotency/outbox resolution: NO

This audit does not claim that the repository has executable lint, typecheck,
build, integration, migration, persistent idempotency, transaction, or
branch-protection gates. It also does not claim real HTTP behavior or database
constraints.
