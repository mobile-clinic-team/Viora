# PREP-008 — Security and AI Safety Evidence Matrix

Status: MATRIX COMPLETE — EVIDENCE REQUIREMENTS RECORDED; RELEASE READINESS IS
NOT CLAIMED

This artifact maps the S1–S6 security checkpoints and AI Gateway,
Tool Gateway, RAG, safety, and human-approval evidence required by the
Implementation Plan. It is documentation-only and does not implement runtime
controls, tests, providers, migrations, or policy changes.

## Scope and acceptance criterion

PREP-008 is owned by Engineer A/D with affected domain owners. Evidence must
prove that deterministic application controls remain authoritative over model
output, tenant isolation is preserved, sensitive operations are audited, and
AI clinical content cannot become authoritative without authorized human
approval.

The matrix distinguishes:

- **Design evidence:** approved contract, boundary, or decision exists.
- **Execution evidence:** automated/manual test or operational result exists.
- **Release evidence:** execution evidence is complete, reviewed, and tied to
  the applicable environment and release gate.

Existing documents provide design requirements, not execution or release proof.

## Evidence status vocabulary

| Status | Meaning |
|---|---|
| REQUIRED | Must be produced for the checkpoint |
| GATED | Only applicable when the boundary or feature is enabled |
| OPEN | Design or operational value still requires owner decision |
| NOT CLAIMED | This preparation task does not produce the evidence |

## S1 — Identity and access checkpoint

Exit requires authentication, membership, authorization, and canonical denial
behavior to be verified before protected endpoints are treated as ready.

| ID | Evidence required | Evidence form | Owner | Status |
|---|---|---|---|---|
| S1-01 | Missing/invalid authentication returns `401` without protected data | API negative tests and response review | A / API | REQUIRED / NOT CLAIMED |
| S1-02 | Valid user resolves only active, valid membership and tenant context | Identity integration tests and context trace | A | REQUIRED / NOT CLAIMED |
| S1-03 | Inactive/revoked membership cannot access tenant resources | Authorization negative tests and audit/security signal | A | REQUIRED / NOT CLAIMED |
| S1-04 | Role and endpoint permission use default deny and least privilege | Permission matrix plus positive/negative tests | A + domain owner | REQUIRED / NOT CLAIMED |
| S1-05 | IDOR and enumeration do not disclose protected resources | Resource substitution tests; approved `404`/`403` review | A + domain owner | REQUIRED / NOT CLAIMED |
| S1-06 | Authorization runs before OCC/version validation and mutation | Ordering test with stale unauthorized request | A + domain owner | REQUIRED / NOT CLAIMED |
| S1-07 | Sensitive reads/mutations carry actor, tenant, request ID, result, and safe metadata | Audit event contract and integration evidence | A + feature owner | REQUIRED / NOT CLAIMED |
| S1-08 | Authentication/session recovery, revocation, and privileged MFA behavior are verified | Security integration/operational evidence | A / Security | REQUIRED / NOT CLAIMED |

## S2 — Tenant isolation checkpoint

S2 requires the PREP-007 matrix to pass across direct and indirect paths. A
resource lookup by ID alone is a defect.

| ID | Evidence required | Evidence form | Owner | Status |
|---|---|---|---|---|
| S2-01 | Tenant A cannot read, list, search, or mutate Tenant B API resources | API isolation suite using synthetic A/B fixtures | A + all domain owners | REQUIRED / NOT CLAIMED |
| S2-02 | Tenant-scoped repositories reject mixed-tenant references | Repository/application integration tests | A + domain owner | REQUIRED / NOT CLAIMED |
| S2-03 | Cache keys and cache-hit/miss/re-fetch behavior remain tenant-scoped | Cache isolation tests and key review | A + affected owner | GATED / NOT CLAIMED |
| S2-04 | Storage object paths and metadata cannot cross tenant scope | Private-storage authorization tests | B + A | GATED / NOT CLAIMED |
| S2-05 | Jobs/outbox preserve tenant and originating actor context through retry/failure | Worker/outbox integration and failure evidence | A + operations | REQUIRED / NOT CLAIMED |
| S2-06 | Search/RAG indexing, filtering, pagination, and metadata exclude Tenant B | Retrieval isolation and cursor-tampering tests | D + A | REQUIRED / NOT CLAIMED |
| S2-07 | AI context and tool results contain only authorized Tenant A data | Context/tool boundary tests with leakage assertions | D + A + domain owner | REQUIRED / NOT CLAIMED |
| S2-08 | Audit access and audit events are tenant/permission scoped | Audit read and event-attribution tests | A | REQUIRED / NOT CLAIMED |

## S3 — Clinical and PHI protection checkpoint

S3 requires minimum-necessary data handling, clinical immutability, authorship,
amendment, and audit evidence.

| ID | Evidence required | Evidence form | Owner | Status |
|---|---|---|---|---|
| S3-01 | Patient and clinical responses are role/resource filtered | API field-allowlist and authorization tests | B + A | REQUIRED / NOT CLAIMED |
| S3-02 | Logs/errors/traces/audit metadata do not contain unnecessary PHI | Redaction review and automated marker checks | A + B | REQUIRED / NOT CLAIMED |
| S3-03 | Finalized clinical versions cannot be overwritten | Database/application negative test | B + schema owner | REQUIRED / NOT CLAIMED |
| S3-04 | Amendments create a new version with reason and authorship | Clinical workflow integration test | B | REQUIRED / NOT CLAIMED |
| S3-05 | Clinical access/mutation/finalization/amendment events are auditable | Audit integration evidence | B + A | REQUIRED / NOT CLAIMED |
| S3-06 | Stale clinical updates and approvals revalidate authorization and current state | OCC/stale-draft tests | B + A | REQUIRED / NOT CLAIMED |
| S3-07 | Retention, deletion, export, and legal-hold behavior follows approved policy | Policy approval and environment evidence | Product/Compliance + Security | OPEN / NOT CLAIMED |

## S4 — AI Gateway and Tool Gateway checkpoint

S4 requires the Gateway to be the only AI-to-application capability boundary.
The model must never be the final enforcement point.

| ID | Evidence required | Evidence form | Owner | Status |
|---|---|---|---|---|
| S4-01 | Application resolves identity, tenant, permissions, and resource scope independently | Gateway contract and integration tests | D + A | REQUIRED / NOT CLAIMED |
| S4-02 | Only explicitly allowlisted tools can be invoked | Tool registry review and denial tests | D + A | REQUIRED / NOT CLAIMED |
| S4-03 | Tool schemas validate identifiers, bounds, enums, dates, and side effects | Malformed-input and schema tests | D + domain owner | REQUIRED / NOT CLAIMED |
| S4-04 | Tool authorization rechecks actor, tenant, resource, relationship, and permission | Cross-tenant/IDOR/tool-denial tests | D + A + domain owner | REQUIRED / NOT CLAIMED |
| S4-05 | Tool results are minimum-necessary, filtered, bounded, and free of secrets/topology | Output filtering and size tests | D + A | REQUIRED / NOT CLAIMED |
| S4-06 | AI has no direct PostgreSQL, Redis, storage, filesystem, SQL, shell, or secret access | Architecture review and runtime/network denial evidence | D + Infrastructure | REQUIRED / NOT CLAIMED |
| S4-07 | Model text and retrieved content cannot grant permission or alter policy | Direct/indirect prompt-injection tests | D + A | REQUIRED / NOT CLAIMED |
| S4-08 | Provider/tool timeout or failure fails closed for sensitive operations | Fault-injection and safe-deferral tests | D + Operations | REQUIRED / NOT CLAIMED |
| S4-09 | AI request, tool invocation/result/denial, context access, and failures are auditable with metadata-first logging | Audit integration and redaction evidence | D + A | REQUIRED / NOT CLAIMED |
| S4-10 | Context, retrieval, and tool calls are bounded by approved rate, timeout, loop, and size controls | Load/abuse tests and operational configuration review | D + API owner | REQUIRED; values OPEN |

## S5 — Human approval and clinical AI checkpoint

S5 requires server-side human approval before AI-generated clinical content
becomes authoritative. Approval must retain the accountable human actor.

| ID | Evidence required | Evidence form | Owner | Status |
|---|---|---|---|---|
| S5-01 | AI clinical output is draft-only and cannot directly finalize a record | Mutation-bypass negative test | B + D | REQUIRED / NOT CLAIMED |
| S5-02 | Draft follows canonical `IN_REVIEW` lifecycle and explicit review/approval transitions | State-transition tests | B + D | REQUIRED / NOT CLAIMED |
| S5-03 | Only an authorized human reviewer can approve | Role/permission and negative tests | A + B + D | REQUIRED / NOT CLAIMED |
| S5-04 | Approval revalidates tenant, permission, current version, draft status, and stale state | OCC and stale-approval integration tests | A + B + D | REQUIRED / NOT CLAIMED |
| S5-05 | Approval, rejection, edit, resubmission, and handoff record human actor and audit metadata | Audit evidence with redaction review | A + B + D | REQUIRED / NOT CLAIMED |
| S5-06 | High-risk, emergency, ambiguous, conflicting, or uncertain requests abstain and route safely | Golden Dataset/scenario evidence | Clinical + AI + Product | REQUIRED / NOT CLAIMED |
| S5-07 | AI cannot approve `NO_SHOW`, clinical finalization, prescription, or other forbidden actions outside approved boundaries | Tool and workflow denial tests | D + affected domain owner | REQUIRED / NOT CLAIMED |
| S5-08 | Human-facing UI/API clearly identifies advisory/draft status and required review | Contract/UI acceptance evidence | B + D + Product | REQUIRED / NOT CLAIMED |

## S6 — Pre-production and operational security checkpoint

S6 is a release gate. It cannot be satisfied by documentation-only preparation.

| ID | Evidence required | Evidence form | Owner | Status |
|---|---|---|---|---|
| S6-01 | Environment and secrets are isolated; no credentials exist in Git, logs, images, or build output | Secret scan and environment review | A + Operations | REQUIRED / NOT CLAIMED |
| S6-02 | Encryption, key access, rotation/revocation, and privileged access are verified | Security/operations evidence | Security + Operations | REQUIRED / NOT CLAIMED |
| S6-03 | Rate limits, quotas, timeouts, and abuse controls are configured and tested | Load/abuse evidence | A + D + Operations | REQUIRED; values OPEN |
| S6-04 | Structured logs, request/correlation IDs, security signals, and audit monitoring work | Observability acceptance evidence | A + Operations | REQUIRED / NOT CLAIMED |
| S6-05 | Reviewed forward-compatible migrations, constraints, tenant integrity, and rollback/forward-fix evidence exist | Migration review and staging execution | A + affected owners | REQUIRED / NOT CLAIMED |
| S6-06 | Backups, restore, RPO/RTO, and incident response are tested and approved | Recovery drill and approval record | Operations + Product | REQUIRED; targets OPEN |
| S6-07 | Provider failure, dependency outage, and AI safety regression behavior is verified | Fault-injection and regression evidence | D + Operations + Security | REQUIRED / NOT CLAIMED |
| S6-08 | Required owner, Security, Clinical, AI, and Architecture approvals are recorded | Review record and release checklist | Team owners | REQUIRED / NOT CLAIMED |

## AI safety regression suite

The following suite applies whenever AI Gateway, RAG, tool, context, draft, or
approval behavior changes. It is derived from `docs/AI-SAFETY.md` sections 34–36
and must not treat model instructions as authorization.

| Category | Minimum evidence |
|---|---|
| Tenant isolation | A cannot receive B context, retrieval results, tool results, or audit-sensitive data |
| Authorization / IDOR | Identity claims, role claims, resource IDs, and tenant metadata cannot widen scope |
| Direct prompt injection | User message cannot authorize forbidden tool, data, or mutation access |
| Indirect prompt injection | Clinical note/document/RAG content is treated as data, not instructions |
| Tool abuse | Unallowlisted, malformed, over-broad, repeated, or side-effecting calls are denied or bounded |
| Data minimization | Context and results contain only authorized, purpose-limited, minimum-necessary fields |
| Output validation | Schema, authorization, business state, size, and clinical boundary checks reject unsafe output |
| Hallucination/uncertainty | Ambiguous, conflicting, unsupported, or high-risk cases abstain and escalate safely |
| Human approval bypass | Draft cannot become final without authorized human review and approval |
| Clinical mutation bypass | Finalized records remain immutable; amendments use approved version workflow |
| Resource abuse | Prompt, context, tool-call, retrieval, loop, timeout, and rate limits behave safely |
| Provider failure | Provider/tool outage produces safe deferral/fail-closed behavior without unauthorized fallback |
| Audit/redaction | AI metadata is attributable and useful without raw unnecessary PHI or full prompts/responses |

## Ownership and evidence storage

- Engineer A/Security owns identity, authorization, tenant context, audit,
  secret, and cross-cutting evidence.
- Engineer D/AI owns Gateway, Tool Gateway, RAG, model/output, prompt-injection,
  resource-bound, provider-failure, and AI safety evidence.
- Engineer B/Clinical owns PHI filtering, clinical immutability, amendments,
  draft state, and clinical approval integration evidence.
- Engineer C/Operations owns appointment-specific authorization/concurrency
  evidence and operational scheduling controls where affected.
- Product/Clinical/Compliance approve clinical escalation, lifecycle, retention,
  and release policy decisions where required.
- Evidence must use synthetic fixtures, redacted logs, stable test/run IDs,
  environment identity, commit/build identity, owner, timestamp, result, and
  linked acceptance criterion. Do not store raw PHI, secrets, or unrestricted
  prompts/responses as evidence.

## Gate rules and unresolved dependencies

1. S1 and S2 precede sensitive domain implementation and must be repeated per
   domain integration.
2. S3 must pass before clinical or AI clinical content is treated as usable.
3. S4 must pass before any AI tool or retrieval capability is exposed.
4. S5 must pass before AI drafts can hand off to clinical application workflow.
5. S6 is required before production release and remains open for operational
   values, provider evidence, recovery targets, and final approvals.
6. Existing PREP-007 provides the tenant-isolation case inventory; it does not
   constitute execution evidence.
7. BLOCK-005/AI provider evidence and exact operational limits remain release
   dependencies even though the MVP governance boundary is approved.

## Scope guard

- Runtime security or AI safety implementation: NO
- Automated tests, fixtures, provider, Gateway, RAG, or worker changes: NO
- API, Data Model, architecture, or security-policy changes: NO
- Secrets, PHI, production data, or raw prompts/responses: NO
- Release-readiness or compliance certification claim: NO

## Acceptance criteria

- [x] S1–S6 checkpoint evidence requirements are mapped.
- [x] AI Gateway, Tool Gateway, RAG, prompt-injection, output validation, and fail-closed evidence are mapped.
- [x] Human review/approval and clinical escalation evidence are mapped.
- [x] Owners, evidence forms, gating status, and open dependencies are recorded.
- [x] Synthetic, redacted, and traceable evidence rules are documented.
- [x] No runtime implementation or policy change is added.
- [ ] Security, AI, Clinical, Product, and affected domain owners review and approve the matrix.

