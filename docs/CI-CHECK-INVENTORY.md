# CI Check Inventory and Pull Request Gates

> Decision: FOUND-003
> Status: In review; check inventory and merge-gate policy recorded

This document records the Viora CI checks, their blocking classification, and
the expected transition from the current documentation/security baseline to a
repository with an Nx skeleton and application source. FOUND-003 does not
create workflows, install dependencies, create Nx projects, or change GitHub
repository settings.

## 1. Status Vocabulary

- `IMPLEMENTED NOW`: a repository workflow or governance control exists today.
- `REQUIRED WHEN IMPLEMENTATION EXISTS`: the check becomes runnable after its
  required package, Nx, application, database, or test configuration exists.
- `FUTURE/OPTIONAL`: useful hardening that is not a minimum merge gate yet.

`BLOCKING` means a pull request cannot merge when the applicable check fails.
`ADVISORY` reports findings but does not independently block merge until a
future decision promotes it.

## 2. CI Check Inventory

| Check | Status | Blocking? | When applicable | Owner |
|---|---|---|---|---|
| Source-of-truth file presence | IMPLEMENTED NOW | BLOCKING | Every PR and push to `main` through `governance` | Repository/platform |
| Required workflow headings | IMPLEMENTED NOW | BLOCKING | Every PR and push to `main` through `governance` | Repository/platform / Architecture |
| Credential-marker path scan | IMPLEMENTED NOW | BLOCKING | Every PR and push to `main` through `governance` | Security |
| Gitleaks secret and history scan | IMPLEMENTED NOW | BLOCKING | Every PR and push to `main` through `secret-scan` | Security |
| YAML/configuration validation | REQUIRED WHEN IMPLEMENTATION EXISTS | BLOCKING | Workflow/config changes when a validator is selected; current workflows must remain executable | Repository/platform |
| Dependency install and lockfile validation | REQUIRED WHEN IMPLEMENTATION EXISTS | BLOCKING | Once a package manifest and lockfile exist | Repository/platform |
| Formatting | REQUIRED WHEN IMPLEMENTATION EXISTS | BLOCKING | Once formatter configuration exists | Repository/platform / affected owner |
| Lint | REQUIRED WHEN IMPLEMENTATION EXISTS | BLOCKING | Every affected project after source/config exists | Repository/platform / affected owner |
| Typecheck | REQUIRED WHEN IMPLEMENTATION EXISTS | BLOCKING | Every affected TypeScript project after source/config exists | Repository/platform / affected owner |
| Unit tests | REQUIRED WHEN IMPLEMENTATION EXISTS | BLOCKING | Every affected project with tests | Affected domain owner |
| Integration/API tests | REQUIRED WHEN IMPLEMENTATION EXISTS | BLOCKING | Affected integration/API behavior | Affected domain owner / API owner |
| Build/package validation | REQUIRED WHEN IMPLEMENTATION EXISTS | BLOCKING | Affected buildable applications/libraries | Repository/platform / affected owner |
| Nx affected project detection | REQUIRED WHEN IMPLEMENTATION EXISTS | BLOCKING | After Nx projects and targets exist; use affected scope without omitting cross-cutting checks | Repository/platform / Architecture |
| Nx dependency graph and tag constraints | REQUIRED WHEN IMPLEMENTATION EXISTS | BLOCKING | After Nx projects are tagged according to FOUND-001 | Architecture / repository/platform |
| Dependency vulnerability scan | REQUIRED WHEN IMPLEMENTATION EXISTS | BLOCKING | Once dependencies and a supported scanner exist | Security / repository/platform |
| Static security analysis | FUTURE/OPTIONAL | ADVISORY initially | After source code exists and a tool is selected | Security / repository/platform |
| Healthcare-data/PHI protection scan | REQUIRED WHEN IMPLEMENTATION EXISTS | BLOCKING | When fixtures, exports, artifacts, or application source exist | Security / Clinical owner |
| Migration/schema validation | REQUIRED WHEN IMPLEMENTATION EXISTS | BLOCKING | Only when database schema/migrations exist | Database owner / affected domain owner |
| Tenant-isolation and authorization tests | REQUIRED WHEN IMPLEMENTATION EXISTS | BLOCKING | Affected protected API/domain behavior | Security / affected domain owner |
| AI safety/evaluation checks | REQUIRED WHEN IMPLEMENTATION EXISTS | BLOCKING | Affected AI Gateway, Tool Gateway, RAG, or AI behavior | AI Safety / Security / affected owner |
| CODEOWNERS path ownership | IMPLEMENTED NOW | BLOCKING after GitHub enforcement | Path ownership exists in `.github/CODEOWNERS`; GitHub required-review setting remains to be enabled | Repository/platform / affected owner |

No check is marked implemented merely because it is listed in a document. No
dependency, build, typecheck, lint, test, Nx, migration, or AI implementation
check is claimed to run before its prerequisites exist.

## 3. Current Workflow Inventory

### `governance`

The existing workflow runs on pull requests and pushes to `main`. It verifies
required source-of-truth files, required workflow headings, and high-confidence
credential markers without printing matched lines.

### `secret-scan`

The existing workflow runs on pull requests and pushes to `main`. It checks
full Git history using `actions/checkout@v5` with `fetch-depth: 0` and
`gitleaks/gitleaks-action@v3`. `GITHUB_TOKEN` and `GITLEAKS_LICENSE` are
injected from GitHub Secrets; no secret value is stored in the repository.

FOUND-003 does not duplicate or replace either workflow.

## 4. Minimum Pull Request Gate

An applicable blocking check must pass before merge. The minimum gate is:

1. Required governance and secret-scan checks pass.
2. Required quality checks for every affected project pass once source exists:
   formatting, lint, typecheck, tests, and build as applicable.
3. Required security, dependency, PHI, tenant-isolation, authorization, AI,
   migration, and Nx checks pass when their applicability conditions are met.
4. Required CODEOWNER and human approvals are present.
5. Conversations are resolved and branch-protection conditions are satisfied.
6. The PR remains within its linked Issue and implementation-task scope.

A failed applicable blocking check blocks merge. An unavailable check is not
silently treated as passed; the owner must either provide the prerequisite or
record a reviewed, task-scoped exception before merge. Advisory findings remain
visible and require follow-up when promoted by a later decision.

## 5. CI Execution Order

The intended order is:

```text
checkout and repository integrity
  -> governance and secret scanning
  -> dependency/lockfile validation
  -> affected project detection
  -> format, lint, typecheck, unit tests, integration/API tests, build
  -> Nx boundary, security, migration, tenant, and AI checks as applicable
  -> required owner review and branch-protection gate
  -> human merge
```

The order is a coordination convention, not permission to create checks before
their implementation prerequisites exist.

## 6. CI Ownership

- Repository/platform owner: workflow execution, shared CI runtime, dependency
  setup, repository integrity, and CODEOWNERS/governance checks.
- Security owner: secret scanning, dependency/security checks, credential and
  PHI protection, and security-gate interpretation.
- Architecture owner: Nx affected/boundary checks and architecture-sensitive
  gate changes.
- Affected domain owner: project quality, domain tests, API/integration tests,
  tenant/authorization tests, and migration checks for their scope.
- Clinical owner: clinical-data and clinical-safety checks when clinical
  behavior is affected.
- AI Safety owner: AI evaluation and safety checks when AI behavior is
  affected.

## 7. Branch Protection Expectation

GitHub settings are not changed by FOUND-003. The expected `main` policy is:

- pull request required; no ordinary direct pushes;
- required applicable blocking status checks;
- CODEOWNER approval for protected paths and at least one human approval;
- stale approvals dismissed after new changes where supported;
- all required conversations resolved;
- force-push prohibited and `main` not deletable;
- emergency bypass limited to explicitly named human administrators and
  auditable incident handling.

Exact administrator identities and GitHub organization settings remain an
operations task. Until these settings are enabled and verified, local workflow
success alone is not equivalent to branch protection.

## 8. Nx Transition

Before the Nx skeleton exists, CI may validate documentation and repository
security controls only. It must not invent Nx projects or claim affected or
tag-constraint results.

After the skeleton exists, CI must detect affected projects and run the
applicable targets. The `boundary:*` constraints in
`docs/architecture/NX-PROJECT-GRAPH.md` become blocking, including the API
composition-root restriction, worker entrypoint restriction, public AI
boundaries, and domain/data-access direction. A boundary violation or missing
tag fails the applicable PR gate.
