## Task Traceability

- Implementation Task ID:
- GitHub Issue:
- Phase:

## Purpose

## Scope and Non-goals

## Affected Domains

- [ ] Identity / Tenant
- [ ] Patient
- [ ] Clinical
- [ ] Doctor / Appointment
- [ ] Shared / Platform
- [ ] AI / Tool Gateway
- [ ] Audit

## Validation

- [ ] Tests run and results reported
- [ ] Nx affected checks run, when Nx exists
- [ ] Dependency boundaries validated
- [ ] Authorization/tenant-isolation tests run, when applicable
- [ ] Migration validation run, when applicable
- [ ] AI safety evaluation run, when applicable

## Migration Impact

- [ ] None
- [ ] Additive
- [ ] Expand/contract
- [ ] Backfill
- [ ] Index/constraint
- [ ] Vector/re-embedding

Rollback or forward-fix plan:

## Security / Clinical / AI Impact

- [ ] No security impact
- [ ] Authentication or authorization
- [ ] Tenant isolation or PHI
- [ ] Secrets or encryption
- [ ] Audit
- [ ] Clinical immutability or approval
- [ ] AI Gateway, Tool Gateway, RAG, model, retention, or safety

## Architecture / Decision Impact

- [ ] No architecture change
- [ ] Uses an approved decision
- [ ] New human decision/approval required

## Final Checklist

- [ ] Scope maps to `IMPLEMENTATION-PLAN.md`
- [ ] No invented API, entity, role, provider behavior, or ownership
- [ ] No private cross-domain import or direct AI database access
- [ ] No secrets, credentials, or prohibited PHI committed
- [ ] Required domain owner and specialist reviewers identified
- [ ] All applicable CI checks pass
- [ ] Documentation/contracts updated when behavior changed
- [ ] Human reviewer will perform the merge
