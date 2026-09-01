# Configuration and Secret Handling Contract

> Decision: FOUND-002
> Status: In review; implementation guardrails recorded, production delivery details remain open

This document defines the Viora convention for local development, automated
tests, CI, and production configuration. It does not implement configuration
loading, secret delivery, authentication, infrastructure, or application code.

## 1. Configuration Sources

The committed `.env.example` is documentation only. It contains variable names
and empty or clearly fake placeholders; it is never loaded as an environment.

Allowed local configuration locations are:

- process environment variables supplied by the developer;
- an untracked `.env.local` file for local-only values;
- an untracked `.env.test.local` file for local test-only values.

`.env`, `.env.*`, and local credential files are ignored by the repository
rules. The `.env.example` exception is the only environment file intended for
version control. Developers must not create a tracked exception for a secret
file.

The configuration precedence is:

```text
safe code defaults
  -> .env.example names/placeholders (documentation only; never loaded)
  -> environment-specific untracked local file
  -> process environment variables
  -> CI-injected variables/secrets
  -> production secret/configuration provider
```

An implementation MUST define which sources it loads explicitly. A later
source may override a value from an earlier source, but a production value must
never be supplied by a repository file.

## 2. Local Development

Local secrets belong in the developer's approved password manager or local
secret store and may be materialized only in an ignored local file or process
environment. They must not be sent through commits, pull requests, issues,
chat, screenshots, logs, traces, or test artifacts.

Local credentials must target an isolated development service or sandbox, use
least privilege, and have no production access. A developer who needs a shared
secret must obtain it through the team's approved secret-delivery process; the
secret value must not be copied into this repository.

## 3. Test Configuration and Data

Unit and integration tests MUST use synthetic, deterministic data where
possible. They MUST NOT use real patient records, PHI, production exports,
production database dumps, or copied clinical files. A fixture that resembles
real data must be generated or properly masked and reviewed before use.

Test services and credentials must be isolated from local development and
production. Tests should use fake providers or local emulators where possible.
If an integration test requires a credential, it must use an environment-
specific CI secret or an ignored local test secret with the minimum scope,
shortest practical lifetime, and a documented rotation owner. Test output must
not print credentials, authorization headers, connection strings, or PHI.

No test fixture is required solely to complete FOUND-002.

## 4. CI Configuration

CI may read GitHub Actions Secrets or Variables only when a check genuinely
requires them. Values MUST be referenced by name, never hard-coded, echoed,
written to artifacts, or included in annotations. Production secrets must not
be used by ordinary test jobs.

The existing secret-scanning workflow remains enabled. Its license and token
inputs are repository/organization secrets and are not configuration values to
be copied into source files. Any future integration-test secret must be
scoped to the test environment and job, and must be rotated independently.

## 5. Production Configuration

Production secrets, including database credentials, provider API keys, JWT or
signing material, OAuth credentials, certificates, and service-account keys,
MUST be supplied by the managed secret/configuration provider through the
approved workload identity path. They MUST NOT be stored in Git, committed
`.env` files, images, build output, or developer machines.

The exact provider, topology, promotion workflow, rotation schedule, and
operational ownership remain production-release decisions. This contract does
not select a vendor or create production infrastructure.

## 6. Rotation and Leak Response

Credentials must have a named owner, minimum scope, and an expiration or
rotation plan appropriate to their environment. Local and test credentials must
be revoked when no longer needed; CI and production credentials must be
rotated independently of local credentials.

If a secret, credential, token, private key, certificate, PHI, or production
data is suspected to have entered Git or another development channel:

1. Treat it as compromised and stop further distribution.
2. Revoke or rotate the affected credential through its owner/provider.
3. Identify repositories, commits, logs, artifacts, and external systems where
   the material may have appeared.
4. Preserve security evidence and notify Security and the affected owner.
5. Remove the exposure using the approved remediation process; deleting only
   the current working-tree file is insufficient.
6. Assess reachable Git history and downstream clones. Do not rewrite history
   or force-push as part of FOUND-002 without an explicit incident-response
   authorization.

## 7. Status Boundaries

Implemented/configured by the repository baseline: ignored local-secret
patterns, committed placeholder documentation, governance credential-marker
checks, and pull-request/push secret scanning.

Defined by FOUND-002: local/test configuration locations, precedence,
synthetic-data requirements, test-credential limits, CI secret boundaries, and
leak-response expectations.

Planned or deferred: runtime configuration loading, managed secret-provider
integration, workload identity, production rotation automation, and provider-
specific deployment configuration.
