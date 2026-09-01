# GitHub Development Workflow

This document defines the proposed repository governance and development workflow for the four-engineer Viora team. It is a workflow proposal only. It does not create a GitHub repository, change GitHub settings, create a real CODEOWNERS file, create branches, or push code.

Where GitHub usernames, team handles, or final Nx paths are not defined by the source documents, this document records `TBD — HUMAN INPUT REQUIRED`.

## 1. Repository Model

- Use one GitHub repository for the Viora MVP.
- Use `main` as the protected integration and release source branch.
- Use a modular-monolith structure with the approved Nx boundaries: core Identity/Tenant, Patient, Doctor/Appointment, and Clinical modules, plus isolated AI Gateway and Tool Gateway applications/boundaries.
- Shared/Platform contains only approved stable primitives, contracts, and infrastructure abstractions. It must not contain domain business logic.
- Repository visibility, GitHub organization, repository name, and administrator/bypass actors are `TBD — HUMAN INPUT REQUIRED`.

## 2. Team Ownership

Ownership follows `IMPLEMENTATION-PLAN.md` and `DEVELOPMENT-CONTRACTS.md` exactly. Ownership coordinates implementation and review; it does not prevent collaboration.

| Engineer | Primary ownership | Review responsibility |
|---|---|---|
| Engineer A | Identity & Security; Tenant, Location, Membership, Roles, Permissions, Audit, Shared/Platform schema | Identity, tenant context, authorization, audit, shared schema, secrets, cross-cutting security |
| Engineer B | Patient & Clinical; Encounter, clinical documentation, medical records | Patient and Clinical contracts, PHI controls, immutable records, human approval integration |
| Engineer C | Operations; Doctor, Appointment, Calendar, Check-in, Queue, Billing and Notification ownership | Doctor/Appointment and scheduling contracts; Billing/Notification are Post-MVP |
| Engineer D | AI Platform; Gateway, Tool Gateway, tools, context, memory, RAG, drafts, evaluation, safety | AI boundary, tool contracts, tenant-scoped retrieval, AI safety and provider integration |

The canonical schema owners are: A for `users`, `memberships`, `tenants`, `locations`, `audit_events`, `idempotency_keys`, and `outbox_events`; B for `patients`, `encounters`, `medical_records`, `medical_record_versions`, and `patient_allergies`; C for `departments`, `doctors`, `doctor_working_shifts`, and `appointments`; D for `ai_conversations`, `ai_messages`, `ai_drafts`, `knowledge_documents`, and `knowledge_chunks`.

## 3. Branch Strategy

- `main`: protected; no direct engineer or Codex pushes.
- `feature/<task-id>-<short-slug>`: normal implementation work mapped to an implementation-plan task.
- `fix/<task-id>-<short-slug>`: defect correction mapped to an existing task or a new issue.
- `chore/<task-id>-<short-slug>`: tooling, documentation, CI, or repository maintenance mapped to an issue.
- `release/<version>`: use only when the release process genuinely requires a release branch and a human approves that process. It is not required for the MVP by default.

Branches start from the current `main`, remain scoped to one issue, and are deleted after merge by the repository policy. Branch names must not be used to bypass ownership or review.

## 4. Issue Strategy

Every implementation task in `IMPLEMENTATION-PLAN.md` gets one GitHub Issue before work starts. The Issue must contain:

- exact task ID and title;
- phase, owner, affected domains, and dependencies;
- allowed and forbidden scope;
- affected contracts, tables, migrations, or Nx projects;
- acceptance criteria and required tests;
- security, tenant-isolation, clinical, AI, and migration impact;
- whether the work is MVP, Post-MVP, or production-release-only.

Architecture, security, compliance, model, retention, or other decision-sensitive work must reference the approved decision/decision-log entry before implementation begins.

## 5. Task → Issue → Branch → PR Traceability

The mandatory chain is:

```text
IMPLEMENTATION-PLAN task
        ↓
GitHub Issue with exact task ID
        ↓
Branch named with task ID
        ↓
Pull Request linked to the Issue
        ↓
CI, owner review, and approval evidence
        ↓
Human merge into main
```

The task ID must appear in the branch name, PR title or body, commits where practical, and the final PR link. A PR without a traceable task is not mergeable.

## 6. Pull Request Rules

Every PR must state:

- task ID and linked Issue;
- purpose and non-goals;
- affected domains and owners;
- files/Nx projects changed;
- tests run and results;
- migration and rollback/forward-fix impact;
- security, tenant-isolation, PHI, clinical, and AI impact;
- API/Data Model/architecture document impact;
- whether any decision or human approval is required.

The PR checklist must confirm that scope is limited, no invented API/entity/role was added, no private domain internals were imported, no secrets or PHI were committed, and documentation/contracts were updated when behavior changed. Unrelated cleanup must be a separate Issue/PR.

## 7. CODEOWNERS Strategy

This is a CODEOWNERS proposal; no actual `.github/CODEOWNERS` file is created by this document.

The final GitHub owner handles are:

`TBD — HUMAN INPUT REQUIRED`

They must be supplied for Engineer A, B, C, D and for the appropriate Architecture, Security, Clinical, AI Safety, and Operations/Release reviewers. Do not substitute invented usernames or team handles.

The eventual CODEOWNERS rules must enforce at least:

- Identity/Tenant, auth/session/context, permissions, audit, secrets, idempotency, outbox, and shared platform → Engineer A plus Security reviewer where security-sensitive;
- Patient/Clinical and medical-record/approval paths → Engineer B plus Clinical reviewer;
- Doctor/Appointment/scheduling paths → Engineer C;
- AI Gateway, Tool Gateway, RAG, drafts, evaluation, and safety paths → Engineer D plus AI Safety reviewer;
- architecture decisions, Nx configuration, public contracts, migrations, and cross-domain changes → affected owner(s) plus Architecture reviewer;
- `docs/SECURITY.md` and security-sensitive configuration → Security reviewer;
- `docs/AI-SAFETY.md` and AI safety policy → AI Safety reviewer;
- `.github/`, CI, branch policy, and release configuration → repository/platform owner plus Architecture/Security or Operations reviewer as applicable.

Exact repository path patterns are `TBD — HUMAN INPUT REQUIRED` until the approved Nx project graph and directory layout exist. CODEOWNERS must never be used to conceal an ownership conflict.

## 8. Branch Protection

The intended protection for `main` is:

- pull request required;
- at least one human approval, with additional required approvals for protected architecture/security/clinical/AI areas;
- required CI status checks;
- CODEOWNER review for protected paths;
- all conversations resolved;
- stale approvals dismissed after new changes;
- approval of the latest push where supported and appropriate;
- force pushes prohibited;
- branch deletion prohibited for `main`;
- direct pushes restricted to explicitly approved human administrators only.

Required administrator, emergency bypass, and GitHub organization policy owners are `TBD — HUMAN INPUT REQUIRED`. These settings are not changed by this document.

## 9. CI Required Checks

The required check inventory should include:

- dependency install and lockfile validation;
- formatting/lint;
- typecheck;
- unit tests;
- Nx affected project tests;
- integration/API tests for affected areas;
- build/package validation;
- Nx dependency-boundary validation;
- migration validation, schema/constraint checks, and migration ordering checks;
- security checks, secret scanning, dependency/container scanning as applicable;
- tenant-isolation and authorization checks for affected protected APIs;
- AI safety/evaluation checks for affected AI changes;
- documentation/contract consistency checks where configured.

CI may use affected checks for speed, but the merge gate must cover every affected project and must not omit a required cross-cutting check. The exact GitHub check names are `TBD — HUMAN INPUT REQUIRED`.

## 10. Nx Boundary Enforcement

- Nx tags and constraints must enforce the approved dependency direction in CI.
- Identity/Tenant, Patient, Doctor/Appointment, Clinical, AI Gateway, Tool Gateway, Audit, and Shared/Platform are separate ownership/boundary concepts.
- Domain code may use shared primitives and approved public contracts, but may not import another domain's private repositories, internals, or database tables.
- AI may access Patient/Clinical/Appointment data only through explicit, authorized public tools/contracts; it may not access a database or arbitrary service directly.
- Workers use public application commands and shared job contracts and may not bypass authorization or domain services.
- Circular dependencies, path-import bypasses, and untagged boundary escapes fail CI.
- Final project names, tags, and path patterns are `TBD — HUMAN INPUT REQUIRED` until the Nx graph is approved under `FOUND-001`.

## 11. Codex Workflow

```text
Issue
  → feature/fix/chore branch
  → Codex implementation within the Issue scope
  → local validation
  → commit
  → push to the feature branch only
  → Pull Request
  → CI
  → human review and CODEOWNER approval
  → human merge
```

Codex must work only on the feature branch associated with the Issue, must not broaden scope, must report tests and remaining risks, and must not merge, approve its own PR, bypass branch protection, or push to `main`.

## 12. Review Workflow

1. The author opens the PR and completes the checklist.
2. CI runs all required affected and cross-cutting checks.
3. The primary domain owner reviews domain behavior and contracts.
4. Every affected secondary owner reviews cross-domain contracts and migrations.
5. Security, Clinical, AI Safety, Architecture, or Operations reviewers are added when the change touches their protected concern.
6. The author resolves comments and re-runs checks after changes.
7. Required human and CODEOWNER approvals are recorded before merge.

## 13. Merge Workflow

- Only an authorized human merges an approved PR into `main`.
- Merge is blocked by failing required checks, unresolved conversations, missing required owners, missing decision approval, or scope/traceability gaps.
- Prefer a repository-approved merge method that preserves the Issue/PR traceability. The exact merge method is `TBD — HUMAN INPUT REQUIRED`.
- After merge, verify CI on `main`, migration/deployment status where relevant, and close the Issue only when acceptance criteria are met.

## 14. Hotfix Workflow

Hotfixes are only for an urgent production-impacting defect. Create `fix/<task-id>-<short-slug>` from the protected `main`, link an urgent Issue, keep the change minimal, and obtain the affected CODEOWNER plus the required Security/Clinical/AI/Architecture reviewer. Required checks remain mandatory unless a human-approved emergency procedure exists; emergency bypass authority is `TBD — HUMAN INPUT REQUIRED`. Create a follow-up Issue for deferred hardening, tests, or documentation.

## 15. Security-sensitive Changes

Changes involving authentication, authorization, tenant isolation, PHI, encryption, key/secrets handling, audit, provider integration, rate limits, abuse controls, or fail-closed behavior require the affected owner and Security review. They must include security and negative-path tests, avoid secrets/PHI in code and logs, preserve `401`/`403` and tenant-isolation behavior, and document any release gate. Security-sensitive work cannot be hidden inside a general chore PR.

## 16. Architecture Changes

An architectural change requires a linked decision/ADR and the appropriate approval before implementation. The PR must identify the affected source-of-truth documents and owners. No PR may silently change modular boundaries, provider-neutral adapters, AI Gateway policy, retry/concurrency semantics, canonical resources, or MVP/Post-MVP scope. If the decision is not approved, stop at documentation/analysis and request human decision.

## 17. Database Migration Changes

- Every schema change maps to the owning implementation task and canonical Data Model.
- The domain schema owner owns semantics and migration review; affected owners review cross-domain effects.
- Use versioned migrations only; no manual production schema edits.
- Apply the approved migration order and validate dependencies, foreign keys, indexes, uniqueness, tenant scope, and query impact.
- Use transactional migrations for small additive low-lock changes and expand/contract for breaking, large, high-lock, index, or vector changes as appropriate.
- Separate additive changes, backfills, code adoption, and cleanup where needed.
- PRs must include preflight, verification, rollback/forward-fix, partial-failure, retry, and observability considerations.
- Embedding dimension/model changes require a migration and re-embedding plan.

## 18. AI Changes

AI changes are owned by Engineer D and affected domain owners. Dify remains behind the AI Gateway/Tool Gateway; domain code must remain provider-neutral. Every tool needs an explicit reviewed contract covering actor/permission, tenant/resource scope, read/draft/write class, approval requirements, audit, timeout/retry/rate limits, and output filtering. AI has no direct database access, write tools are default-deny, clinical output remains a draft until authorized human approval, and tenant knowledge boundaries must be tested. Model, embedding, retention, safety, or provider changes require the corresponding approved decision and evaluation/re-embedding evidence.

## 19. 4-Engineer Parallelization

The matrix below follows the source ownership and dependency plan. Exact Nx path patterns remain `TBD — HUMAN INPUT REQUIRED` until `FOUND-001` approves the project graph.

| Engineer | Domain/libraries | Allowed logical paths | Required reviewers | Dependencies | Cannot modify without affected-owner review |
|---|---|---|---|---|---|
| A | Identity/Tenant, Audit, Shared/Platform, auth/context, secrets/config | Identity, tenant, audit, shared contracts/infrastructure | Security; Architecture for boundaries; affected domain owners for cross-domain work | Phase 0 foundation; access decisions before sensitive implementation | Patient/Clinical/Doctor/Appointment/AI private internals or schemas owned by others |
| B | Patient, Clinical, encounters, medical records, approval integration | Patient and Clinical modules/contracts/tests | Clinical; Security; A for identity/audit effects | Auth/tenant context; Patient before dependent workflow; Appointment before encounter integration | Identity/Tenant/Appointment/AI private internals; immutable record rules cannot be weakened |
| C | Doctor, Appointment, scheduling, operations | Doctor/Appointment modules/contracts/tests | Affected Patient/Identity owners; Security for protected mutations | Auth/tenant context; Patient and Doctor before appointment; concurrency decision | Clinical private internals; AI internals; Post-MVP Billing/Notification unless explicitly tasked |
| D | AI Platform, AI Gateway, Tool Gateway, RAG, drafts, evaluation/safety | AI applications, tools, retrieval/evaluation boundaries | AI Safety; Security; affected domain owner; Architecture for boundary changes | Access foundation, Clinical/public contracts, audit/idempotency/outbox, AI decisions | Direct database access, domain private internals, autonomous clinical mutation paths |

Parallel work is safe only when it uses public contracts, respects the dependency graph, and has affected-owner review. “Full-stack” does not grant permission to modify another owner's private boundary.

## 20. Definition of Done

A task is done only when:

- the implementation-plan task has a linked Issue, scoped branch, and PR;
- acceptance criteria and required tests pass;
- lint, typecheck, build, affected tests, boundary checks, and applicable security/migration checks pass;
- authorization, tenant isolation, error behavior, audit, and observability are verified where applicable;
- clinical immutability/approval or AI safety/tool controls are verified where applicable;
- migrations are reviewed by the schema owner and affected owners;
- API/Data Model/architecture documents are consistent with the change;
- required human and CODEOWNER approvals are present;
- no unresolved decision, forbidden scope expansion, or unrelated change remains;
- the human merge owner merges only after all gates pass.

## 21. Forbidden Workflow

- Direct push or merge to `main` by an engineer or Codex.
- Work without an implementation-plan task and GitHub Issue.
- One branch containing unrelated tasks or multiple ownership domains without explicit coordination.
- Invented APIs, entities, roles, provider behavior, usernames, team handles, or Nx bypasses.
- Direct database access from AI or cross-domain private repositories.
- Manual production schema edits or unreviewed destructive migrations.
- Bypassing authorization, tenant checks, audit, human approval, or fail-closed behavior.
- Committing secrets, raw PHI, raw AI prompts/responses where prohibited, or environment credentials.
- Self-approval, unresolved review conversations, skipped required checks, force-pushing `main`, or using Codex to merge.

## 22. Example End-to-End Workflow

For `FOUND-003 — Establish CI check inventory and PR gates`:

1. Create a GitHub Issue containing `FOUND-003`, Phase 0, Engineer A/C ownership, dependencies, acceptance criteria, and the required check inventory.
2. Create `feature/FOUND-003-ci-pr-gates` from `main`.
3. Codex works only within the Issue scope, performs local validation, and commits to that branch.
4. Open a PR linking the Issue and documenting affected repository policy, Nx, security, migration, and AI impact (or explicitly “none”).
5. CI runs install, lint, typecheck, unit/affected tests, build, Nx boundary, migration validation, and security checks.
6. Engineer A/C and any required Architecture/Security reviewer review the PR; all conversations are resolved.
7. An authorized human merges the approved PR into protected `main`; Codex does not merge.

This example describes the governance workflow only; it does not create the Issue, branch, PR, GitHub settings, or implementation.

## 23. Source-Control Data and Secret Protection

GitHub is not an approved storage location for healthcare data or runtime
secrets. Never commit real PHI/PII, medical records, clinical files, database
dumps, production logs, backups, API keys, OAuth/OIDC secrets, JWT signing
keys, encryption keys, passwords, connection strings, provider credentials, or
`.env` files. Use synthetic fixtures and `.env.example` placeholders only.

The repository uses `.gitignore` as a first-line convenience control and a
GitHub Actions secret scan as a merge gate. `.gitignore` does not remove data
from Git history. If sensitive material is committed, stop, rotate/revoke it,
notify Security, and remediate the complete reachable history before merging.
Secret-scan and governance checks must pass before a protected branch is
updated.
