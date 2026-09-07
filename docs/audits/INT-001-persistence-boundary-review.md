# INT-001 persistence boundary repair

Status: IN REVIEW / NOT PRODUCTION-READY

Issue: https://github.com/mobile-clinic-team/Viora/issues/87
Branch: `feature/INT-001-persistence-boundary-fixes`
Baseline: `976bcccb74950a7386fe4fe36a2e097ab318e8f6` (local main and fetched origin/main).
Implementer: Member D, Trần Thái Anh (`thaianh050406-arch`).
Review required: A (database/runtime), B (Clinical integration), affected
Security/AI Safety and CI CODEOWNERS. No human approval is claimed here.
Date: 2026-09-07.

## Verified defects and chosen corrections

1. `createAiDraft` omitted the repository's required `version` and supplied
   timestamps outside its input contract. The in-memory test repository
   silently injected version 1, hiding failure in the real PostgreSQL adapter.
   The workflow now supplies `1n`, uses the authenticated creator and leaves
   creation timestamps to persistence. Regression tests failed on the old
   workflow. The database test now exercises workflow -> actual adapter -> SQL.
2. The migration adapter issued BEGIN/SQL/COMMIT through `pool.query`. Session
   affinity was not guaranteed. A dedicated, lazily connected `pg.Client` now
   owns the adapter lifetime, with idempotent close and no reconnect after a
   connection/session failure. The regression test rejects pool transaction
   dispatch and failed on the old adapter. This follows the
   [node-postgres transaction contract](https://node-postgres.com/features/transactions).
3. Scoped TypeScript validation found that `PostgresKnowledgeChunkRepository`
   returned SQL column names (`document_id`, `tenant_id`) instead of the
   existing application fields (`documentId`, `tenantId`). The real database
   test reproduced undefined tenantId. The INSERT result now explicitly maps
   the canonical fields, with regression assertions against SQL-name leakage.

Alternatives: putting the version default in a test double would hide the
contract mismatch again; relying on a one-slot pool would still return a live
transaction to the pool. A dedicated client fits this migration-only adapter
without changing its public signature or introducing a pool lease API.

## Compatibility and security review

- No SQL migration, public HTTP contract, database model, role/RLS, clinical
  status, retention rule, or architecture boundary changes.
- The existing one-transaction-per-batch runner behavior is preserved. A
  per-file transaction redesign is outside this repair.
- Creation stays GENERATED; review/approval remains human-only and governed
  by existing authorization. SQL tenant filters and OCC predicates remain.
- Integration uses synthetic identities/patient content and a newly created
  disposable PostgreSQL/pgvector container. Other running databases are not
  used. The suite now requires explicit disposable-database acknowledgement
  before destructive schema reset; CI sets it only on its service database.
- Unit tests verify that missing opt-in fails before any database connection.
- Creation/approval tests use a permissive synthetic authorization policy;
  they do not prove production identity verification, MFA, or policy wiring.

## Validation evidence

- Red/green reproduction: missing version and pool transaction dispatch.
- Full suite with PostgreSQL/pgvector: 135 passed, 0 failed, 0 skipped on both
  Windows (Node 26.3.1) and Linux (`node:24-bookworm-slim`, matching CI's Node
  major). Both runs used the final repaired source and disposable database.
- Scoped strict TypeScript 5.9.3 check passed for the modified database/workflow
  source and tests plus their imports. Tools were installed in ignored
  `.tmp/int001-validation`; the temporary configuration explicitly resolves
  pg to its installed @types/pg declarations. This diagnostic does not create
  or replace the missing repository-wide typecheck/build gate.
- `npm audit --omit=dev`: zero reported advisories in the installed dependency
  set during this repair; this is not proof of application security.
- `git diff --check` passed. Changed-file credential-marker scan found no
  matches. Remote CI/history scanning and human review remain PR gates.
- Clean chain 001–012 and upgrade from 001–005, retaining a pre-existing tenant.
- Replay without duplicate history; rejection of changed applied checksums.
- Later SQL failure rolls back earlier new DDL and migration-history entries
  in the same batch; previously committed rows/history survive.
- Same backend session owns its advisory transaction lock; another session
  cannot take that lock until close releases it. Closing an unfinished
  transaction rolls back its new table.
- Client lifecycle tests cover connection failure, session loss, repeated
  close, unused close, and close racing with connection acquisition.

## Remaining gates and next work

This patch is not a claim of complete INT-001, clinical approval handoff, or
production/store readiness. The baseline has no configured root lint,
typecheck, build or executable Nx boundary checks; unavailable checks must be
reported, not marked passed. Human review or the workflow's explicitly
recorded exception is required before merging while those gates are missing.

Follow-up order: make static type/build/boundary validation executable;
integrate runtime authentication, database-backed domain repositories and
transaction coordination; validate the documented HTTP/E2E workflow; then
implement the approved mobile scope and release validation. AI lifecycle
audit, retention/Legal Hold, production identity/provider wiring and external
release decisions require separate evidence. No claim of a complete security
audit or regulatory/store approval is made by this repair.

## Recovery

No data conversion or applied migration edits occur. Reverting this code-only
change is possible but reintroduces known defects and is not recommended as a
production mitigation. On migration failure, close the adapter and verify
history before a reviewed retry. The tested recovery is transaction rollback,
not down migration or a backup-restore exercise. Production deployment and
release remain outside this PR.
