# PREP-004 — Environment and Configuration Requirements Audit

Status: AUDIT COMPLETE — RUNTIME DELIVERY REMAINS DEFERRED

This is the task-specific documentation artifact for `PREP-004 — Define
environment and configuration requirements` (Issue #22). It records the
repository evidence at the PREP-004 branch base and defines provider-neutral
requirements for local, test, staging, and production environments. It does
not implement configuration loading, secret delivery, infrastructure,
deployment, or authentication.

## Scope and acceptance criterion

The Implementation Plan assigns PREP-004 to Engineer A, depends on completed
PREP-001 governance reconciliation, and requires:

> Local/test/staging/production data and secret boundaries are documented.

The Phase 0 foundation plan describes the related deliverable as the local/test
configuration contract in `docs/CONFIGURATION-AND-SECRETS.md`. That document
already contains the approved baseline. This task-specific artifact reconciles
that baseline with the staging/production boundary and records what is and is
not proven by the current repository.

## Evidence inspected

| Evidence | Observed state | Classification |
|---|---|---|
| `docs/CONFIGURATION-AND-SECRETS.md` | Defines documentation-only `.env.example`, ignored local files, configuration precedence, local/test rules, CI secret handling, production secret boundaries, and leak response. | VERIFIED — FOUND-002 baseline |
| `.env.example` | Contains variable names with empty placeholders and explicitly states that copied files must not be committed. | VERIFIED — documentation only |
| `.gitignore` | Ignores environment files, credential files, key/certificate formats, healthcare-data paths, dependencies, and generated output; keeps `.env.example` trackable. | VERIFIED — repository convenience control |
| `docs/SECURITY.md` | Prohibits source-control secrets/PHI, requires synthetic or approved masked fixtures, and defines externalized secret and environment isolation boundaries. | VERIFIED — protected policy evidence |
| `.github/workflows/governance.yml` | Runs a credential-marker scan and verifies selected governance files. | VERIFIED — CI guardrail |
| `.github/workflows/secret-scan.yml` | Runs Gitleaks on pull requests and pushes to `main` using full history. | VERIFIED — CI guardrail |
| `docs/DECISION-LOG.md` | Records provider-neutral implementation guardrails and leaves provider/topology and production operational values open. | VERIFIED — decision evidence |
| Runtime/workspace configuration | No runtime configuration loader, root package manifest, lockfile, environment schema, deployment configuration, or secret-provider integration is present. | VERIFIED — implementation deferred |

No secret value, credential, PHI, production data, provider identifier, or
environment-specific value is added by this audit.

## Environment boundary matrix

The following requirements are the minimum provider-neutral boundary. They are
requirements for future implementation, not evidence that the environments or
their delivery mechanisms exist today.

| Environment | Permitted data | Secret/configuration boundary | Required controls | Prohibited data/behavior |
|---|---|---|---|---|
| Local development | Synthetic development data and approved local fixtures only. | Process environment variables or untracked `.env.local`; local credentials use least privilege and target an isolated development service/sandbox. | Developer-approved local secret store; no production access; no secret values in Git, chat, logs, screenshots, or artifacts. | Production credentials, production exports, real PHI, unrestricted shared-service credentials. |
| Automated test | Synthetic deterministic data, or properly masked fixtures approved for the test purpose. | Process/CI-injected test variables or untracked `.env.test.local`; credentials are isolated from local/staging/production and scoped to the job. | Fake providers/local emulators where possible; minimum scope and shortest practical lifetime; test output redacts credentials, headers, connection strings, and PHI. | Production data, production credentials, copied clinical files, raw secrets in fixtures or artifacts. |
| Staging | Non-production data created or approved for staging validation; no production data by default. | Dedicated staging configuration and credentials, isolated from local/test/production; delivery must use the future approved managed secret/configuration boundary. | Environment-specific access, least privilege, auditability, safe promotion, independent rotation, and production-like controls without production secret reuse. | Production credentials or unapproved production exports; sharing local/test secrets; treating staging as a production data replica without explicit approval. |
| Production | Authorized production tenant and clinical data only through approved application workflows and controls. | Managed secret/configuration provider with workload-identity/runtime injection; values never come from Git, `.env` files, images, build output, or developer machines. | Encryption in transit/at rest as approved; least privilege; ownership; rotation/revocation; access audit; protected backups; release and incident-response gates. | Repository-stored secrets, developer-supplied production values, client-visible credentials, direct AI/client access to unrestricted production data. |

The staging row makes the required boundary explicit because the existing
FOUND-002 document specifies local, test, CI, and production handling but does
not provide a separate staging section. It does not select a staging provider,
topology, dataset, or deployment mechanism.

## Configuration source and precedence

The approved source order from `docs/CONFIGURATION-AND-SECRETS.md` is:

```text
safe code defaults
  -> .env.example names/placeholders (documentation only; never loaded)
  -> environment-specific untracked local file
  -> process environment variables
  -> CI-injected variables/secrets
  -> production secret/configuration provider
```

Future runtime code must define explicitly which sources it loads and must not
allow a repository file to supply a production value. A later source may
override an earlier value only within the environment and scope for which that
source is authorized.

The repository does not currently provide an environment schema, loader, or
precedence-enforcement test. This audit therefore records the contract and
does not claim runtime enforcement.

## Secret boundary requirements

| Requirement | Local | Test/CI | Staging | Production | Evidence status |
|---|---|---|---|---|---|
| Secret value external to source control | MUST | MUST | MUST | MUST | Contracted; repository scan workflows exist |
| Environment-specific isolation | MUST | MUST | MUST | MUST | Contracted; runtime delivery absent |
| Least privilege | MUST | MUST | MUST | MUST | Contracted; operational enforcement absent |
| No secret values in logs/artifacts | MUST | MUST | MUST | MUST | Contracted; no runtime log implementation |
| Named owner and rotation/revocation plan | SHOULD/MUST before use | MUST before CI use | MUST before staging use | MUST | Contracted; named operational records absent |
| Workload identity/runtime injection | Not required for local files; provider-neutral | Prefer CI secret injection | REQUIRED future boundary | REQUIRED future boundary | Not implemented |
| Production credential reuse | PROHIBITED | PROHIBITED | PROHIBITED | N/A | Contracted |
| Leak response and reachable-history assessment | REQUIRED | REQUIRED | REQUIRED | REQUIRED | Contracted in Security/Configuration docs |

Provider credentials remain isolated to the relevant adapter or application
boundary and must never enter public contracts, business tables, ordinary
logs, or client responses. Provider-specific names, topology, region,
residency, service-level terms, and rotation schedule remain outside this
task.

## Data handling requirements by environment

- Local and automated tests use synthetic deterministic data whenever
  possible. Any masked fixture must be approved for its purpose and must not
  retain unnecessary PHI.
- Test services and credentials are separate from local development and
  production. Ordinary test jobs must not use production secrets.
- Staging is a non-production boundary. Production data import, replication,
  or export into staging is not assumed and requires explicit approval and
  controls outside this task.
- Production data is accessed only through authorized application workflows;
  clients, AI components, unrelated domains, and development environments do
  not receive unrestricted access.
- Logs, traces, CI annotations, test output, screenshots, issues, pull
  requests, and artifacts must not contain credentials, authorization headers,
  connection strings, PHI, or raw sensitive clinical content.

## Ownership and operational handoff

The repository documents control ownership at a responsibility level:

- Security/Operations own key rotation, revocation, access audit, and
  compromise response.
- Repository/platform owns CI secret wiring, repository guardrails, and
  configuration conventions.
- Affected domain owners define the minimum configuration needed by their
  application contracts and tests.
- Production-release owners must provide the final provider contract,
  topology, residency, promotion, backup, monitoring, SLO/RPO/RTO, and
  incident-contact evidence before production delivery.

Individual operational names, provider accounts, secret identifiers, numeric
rotation intervals, and environment URLs are intentionally not invented.

## Deferred decisions and missing implementation evidence

| Item | Current state | Why it remains deferred |
|---|---|---|
| Runtime configuration loader and schema | Not present | Requires implementation task and tests; no source/configuration changes are authorized here. |
| Local/test secret materialization | Contracted through ignored files/process variables | No real secret is needed or allowed for this task. |
| Staging delivery and promotion | Boundary documented; mechanism TBD | Provider, topology, promotion workflow, and staging data policy are not selected in repository evidence. |
| Production managed secret/configuration provider | Boundary approved generically | Exact provider, workload identity, topology, region/residency, and service terms remain release/infrastructure decisions. |
| Rotation schedule and operational contacts | Requirement recorded | Numeric schedule and named contacts require Security/Operations/production-release evidence. |
| Environment-specific validation | Not implemented | Requires a future configuration implementation and CI/release task; no checks are claimed as runnable. |
| Runtime access enforcement | Not implemented | Configuration contract does not prove authentication, authorization, tenant isolation, encryption, or deployment controls. |

These deferred items do not authorize provider selection, infrastructure work,
or production delivery through PREP-004.

## Findings and follow-up

| ID | Finding | Evidence | Impact | Follow-up |
|---|---|---|---|---|
| PREP4-F-001 | The repository has a local/test/CI/production secret-handling baseline but no separate staging section in the source configuration contract. | `docs/CONFIGURATION-AND-SECRETS.md`; Implementation Plan PREP-004 acceptance criterion | Staging isolation could be interpreted inconsistently. | Use this provider-neutral boundary in the future staging/release task; do not select a provider here. |
| PREP4-F-002 | Configuration precedence is documented but has no runtime loader, schema, or automated enforcement evidence. | Configuration contract; repository file inventory | Implementations could load an unsafe source or silently override environment boundaries. | Add a separately scoped configuration implementation and validation task. |
| PREP4-F-003 | Production secret delivery is a generic managed-provider/workload-identity boundary; exact provider and topology remain open. | `docs/CONFIGURATION-AND-SECRETS.md`; `docs/SECURITY.md`; `docs/DECISION-LOG.md` | Premature selection would change architecture and release scope. | Obtain the required infrastructure/security/release decision before integration. |
| PREP4-F-004 | Named operational owners, numeric rotation values, and environment endpoints are not repository evidence. | Configuration/security/decision documents | A contract cannot by itself prove operational readiness. | Record these in the approved operations/release process without committing secrets or URLs that expose protected infrastructure. |
| PREP4-F-005 | Existing CI guardrails scan for selected credential markers and repository secrets, but do not prove runtime secret isolation or PHI handling in every future job. | `.github/workflows/governance.yml`; `.github/workflows/secret-scan.yml` | CI success must not be treated as complete environment/security enforcement. | Extend checks only through a separately scoped CI/security task when prerequisites exist. |

## Acceptance criteria

- [x] Local development configuration and data boundaries documented.
- [x] Automated test/CI configuration and data boundaries documented.
- [x] Staging configuration and data boundaries documented without selecting a
  provider or topology.
- [x] Production configuration and data boundaries documented with managed
  secret/workload-identity requirements and release-scoped open items.
- [x] Secret sources, precedence, least privilege, ownership, rotation, and
  leak-response requirements reconciled.
- [x] Provider, topology, workload-identity implementation, and production
  delivery decisions remain explicit deferred/TBD items where not approved.
- [x] No secret, PHI, dependency, infrastructure, runtime code, or protected
  policy change was made.
- [ ] Validation and remaining risks are reported in the PR.

The last item is completed by the task PR rather than by this standalone
artifact.

## Scope guard

- Code changes: NO
- Configuration loader/schema: NO
- Secret-provider integration: NO
- Infrastructure/deployment: NO
- `.env.example` changes: NO
- `.gitignore` changes: NO
- Workflow/CI changes: NO
- Authentication/authorization or tenant behavior: NO
- Database/migration/ORM changes: NO
- API/domain/AI behavior: NO
- Provider or topology selection: NO
- Production secret delivery: NO

This audit defines boundaries and readiness evidence only. It does not claim
that any runtime environment, secret provider, workload identity, rotation
automation, staging deployment, production delivery, or configuration loader is
implemented.
