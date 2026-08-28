# Decision Closure Report

> Date: 2026-08-28
>
> Scope: Final cross-document decision consistency audit after the approved
> decision propagation workflow.

## Final Gate

**Implementation-ready: YES**

All implementation blockers and cross-document implementation conflicts are
resolved or explicitly scoped. Production release remains gated by the
separate provider, compliance, operational, and SLO/recovery values listed
below.

## Approved Decisions

| Decision | Approved result |
|---|---|
| DEC-001 | Auth0-style Managed CIAM OIDC/OAuth2 target profile behind a provider-neutral application identity boundary; 15-minute access token, 7-day rotating refresh session with replay-family revocation; application-owned revocation and MFA scope |
| DEC-002 | Separate Nurse/Clinical Staff and Receptionist application roles with endpoint-specific least privilege and default deny |
| DEC-003 | `IN_REVIEW` is the canonical clinical intermediate status |
| DEC-004 | PostgreSQL concurrency constraint plus application transaction/idempotency direction; monotonic `BIGINT` OCC with strong `If-Match`/ETag semantics; immutable clinical version-history boundary |
| BLOCK-009 | Uniform opaque cursor with server-enforced governance; default 20, maximum 100 |
| BLOCK-010 | Explicit application transition command for `NO_SHOW` |
| DEC-005 | Self-hosted Dify behind the AI Gateway and Tool Gateway; Managed External LLM plus Managed Embedding through controlled adapters; single primary model pair without automatic fallback; guarded draft-first profile; minimum-necessary category-specific AI lifecycle; Strict Clinical Safety Gate with jointly owned/versioned Golden Dataset; canonical Legal Hold inheritance; typed MVP knowledge mapping to `patients`/`medical_records`; approved MVP retention baseline |
| DEC-006 | Product/Compliance owns and approves data-governance policy values; category-specific lifecycle boundary |
| DEC-007 | Clinical Files are Post-MVP; MVP is text and structured data only |
| BLOCK-011 | Implementation guardrails are approved; production release values remain separate release blockers |

## Remaining Blocking Follow-ups

| Severity | Decision | Remaining dependency |
|---|---|---|
| FOLLOW-UP | DEC-001 / BLOCK-001 | Final Managed CIAM provider contract, including region/residency and service-level terms; recovery UX/exception guardrails are approved |
| RESOLVED | DEC-004 / BLOCK-004 | Domain-specific retry policy approved and propagated; implementation must enforce the allowlist, idempotency, human-confirmation, and security re-check boundaries |
| RELEASE DEPENDENCY | DEC-005 / BLOCK-005 | Provider evidence and exact production limit values; MVP tenant-only knowledge, capability classes, AI actor context, and bounded controls are approved; global knowledge is deferred behind a separate approval |
| RESOLVED | BLOCK-006 | Managed Secrets Manager/KMS, workload-identity delivery, selective classified-PHI encryption, key-version metadata, rotation/revocation and provider-secret isolation are approved; exact topology remains operational/release detail |
| RELEASE DEPENDENCY | DEC-006 / BLOCK-007 | MVP governance boundary is approved; clinical retention values, deletion/anonymization, residency, export, audit and backup policy values remain required before production release |
| RESOLVED | API-006 | Domain-specific idempotency TTL and expiry behavior are approved and propagated; exact numeric TTL/grace values remain operational configuration |
| RESOLVED | AI-007 | Authorized clinician review/edit/approve workflow with step-up MFA, OCC revalidation, stale-draft handling and immutable audit provenance is approved and propagated |
| RESOLVED | AI-006 | Risk-tiered clinical escalation, abstention, safe deferral, clinician routing and audit provenance are approved and propagated |
| RESOLVED | DEV-001 | Hybrid modular backend with isolated AI/Tool Gateway boundaries, approved Shared Platform primitives and Nx dependency-direction enforcement are approved and propagated |
| RESOLVED | DEV-005 | Hybrid risk-based migration strategy with transactional/expand-contract paths, preflight, compatibility, verification and rollback/forward-fix controls is approved and propagated |
| RELEASE BLOCKER | BLOCK-011 | SLO, RPO/RTO, backup retention/restoration targets, quotas, alert thresholds, provider/topology and incident-response values |

Resolved decisions are not listed as remaining blockers: role mapping,
clinical status, pagination, `NO_SHOW` authority and clinical-file MVP scope.

## Consistency Audit Result

- Domain and team ownership: consistent with Engineer A shared platform/
  identity ownership, Engineer B Patient/Clinical ownership, Engineer C
  Doctor/Appointment ownership, and Engineer D AI ownership.
- MVP scope: Clinical Files, Billing, Notification, prescriptions, lab
  results and ratings remain Post-MVP; self-hosted Dify and text/structured AI
  workflows remain within the approved AI boundary.
- Database ordering: tenant and identity foundations precede shared
  idempotency/audit/outbox and protected domain migrations; Doctor uses the
  approved migration slot before appointments.
- API ordering: authentication, tenant context, authorization and shared
  protections precede domain mutations; opaque pagination and public
  `If-Match`/ETag semantics are explicit.
- Security and tenant isolation: authorization and tenant checks precede
  resource/version checks; AI/Dify has no direct database access and all
  external providers are behind controlled Gateway adapters.
- Clinical lifecycle: `IN_REVIEW`, immutable finalization, amendments and
  human approval references are consistent.
- AI prerequisites: Gateway/Tool Gateway, minimum-necessary context,
  tenant-scoped knowledge, default-deny writes, metadata-first audit,
  risk-tiered escalation, and fail-closed sensitive behavior are consistent;
  provider evidence and operational values remain release dependencies.
- Testing and Nx boundaries: ownership, affected-owner review, negative tests,
  tenant A/B isolation tests and cross-domain checks remain required; the
  hybrid project graph and dependency-direction boundary are approved.
- Production readiness: implementation guardrails are defined, but secrets,
  encryption, observability details, rate limits, recovery targets,
  compliance policy values and release evidence are not fully approved.

## Safe Starting Point

The first safe implementation phase is **Phase 0 / engineering foundation and
guardrail preparation**. It may include Nx boundary validation, CI/test
inventory, migration dependency review, tenant A/B test-matrix preparation,
provider-neutral interfaces, secret/environment boundary interfaces and
failure-safe contracts. It must not finalize unresolved provider, retention,
encryption, authorization-detail or release-value decisions by assumption.

## First 10 Safe Tasks

1. Validate the conceptual Nx project graph and allowed dependency directions.
2. Inventory lint, type, unit, integration, API, build and security checks.
3. Define environment and secret isolation interfaces without selecting an
   unapproved provider.
4. Reconcile migration dependencies for identity, audit, idempotency, Doctor
   and outbox.
5. Map MVP API operations to owners, contracts and dependency gates.
6. Prepare Tenant A versus Tenant B isolation test cases.
7. Prepare security and AI-safety evidence matrices.
8. Define provider-neutral interfaces for the approved Dify Gateway boundary.
9. Prepare migration rollback and dependency-failure test contracts.
10. Close remaining follow-up decisions with the responsible human owners.

## Source of Record

Decision details and propagation traceability are recorded in
`docs/DECISION-LOG.md` and `docs/DECISION-PACKETS.md`. The implementation
sequence and blocker status remain in `docs/IMPLEMENTATION-PLAN.md`.
