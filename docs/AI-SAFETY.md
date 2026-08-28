# AI-SAFETY.md

> Canonical safety, authorization, governance, and operational specification
> for the Clinic AI Platform.
> Version: 0.1.0
> Status: Draft; implementation boundaries are approved, with release evidence
> and operational values tracked separately.

## 1. AI Safety Principles

The AI is a controlled subsystem, not an authority, database administrator,
autonomous clinician, or authorization mechanism. Deterministic application
logic has authority over model output. AI must use least privilege, minimum
necessary data, explicit tool permissions, tenant isolation, auditability,
human accountability, and fail-safe behavior.

Model-generated text is untrusted input. Prompts, retrieved documents, and
user instructions are never authorization. AI cannot bypass application
authorization, tenant boundaries, or human approval.

## 2. AI Role in the System

| Actor | Responsibility |
|---|---|
| AI assistant | Authorized information retrieval, summaries, approved knowledge retrieval, administrative assistance, and drafts |
| Application | Authentication, tenant resolution, authorization, context selection, validation, business rules, persistence, and audit |
| Human clinician | Reviews clinical information, creates/approves accountable clinical content, and owns clinical judgment |
| Clinic/platform administrator | Performs explicitly authorized tenant/platform administration; platform access is not unrestricted PHI access |

AI assists users and does not replace authorization, clinical responsibility,
or human approval.

## 3. AI Trust Model

```text
User → Application → Authorization → AI subsystem
     → Tool Gateway → Authorized Tool → Domain Service → Data
```

Before and during every operation, the application independently validates
identity, tenant scope, tool permission, resource ownership, parameters,
business rules, and approval requirements. The model is never the final
enforcement point.

## 4. AI Threat Model

| Threat | Attack Vector | Potential Impact | Required Control | Enforcement Layer |
|---|---|---|---|---|
| Direct prompt injection | User message | Policy/tool bypass | Treat message as untrusted; external authorization | AI Gateway/Application |
| Indirect prompt injection | Clinical note or document | Unauthorized tool use or leakage | Retrieved content is data, not instructions | AI Gateway/Application |
| Tool abuse | Crafted tool arguments | Unauthorized read/write | Allowlist, schema, tenant/resource checks | Tool Gateway |
| Privilege escalation | Claim of administrator/clinician identity | PHI or mutation access | Identity comes from authenticated context | API/Application |
| Cross-tenant retrieval | Patient/document context | Tenant breach | Tenant filtering at every data boundary | Application/Database |
| Context leakage | Excessive prompt context/logging | PHI disclosure | Minimum necessary context and redaction | Application/AI Gateway |
| Hallucination/fabrication | Missing or conflicting context | Unsafe clinical decision | Abstain, identify uncertainty, require human review | AI Gateway/Human |
| Unsafe recommendation | Diagnosis/prescription request | Patient harm | No autonomous diagnosis/prescribing; clinician review | Application/Human |
| Compromised provider/credentials | External model boundary | Data exposure or control loss | Bounded data, secret isolation, revoke/fail closed | Infrastructure/Gateway |
| DoS/cost abuse | Long prompts, loops, repeated retrieval | Availability/cost impact | Bounded context, calls, rate limits, timeouts | API/Gateway |

## 5. AI Capability Boundary

| Capability | AI Allowed? | Conditions | Human Approval | Enforcement |
|---|---|---|---|---|
| General health information | Yes, limited | Informational; no claim of autonomous clinical judgment | Required when it affects a patient decision | Application/output policy |
| Patient information summary | Yes | Authorized patient context and minimum necessary data | Clinician review where used clinically | Application/Tool Gateway |
| Clinical note summary | Yes | Authorized records only | Required before authoritative use | Application/Human |
| Authorized knowledge retrieval | Yes | Tenant/status/permission filtering | Not inherently, unless clinical use requires it | RAG/Application |
| Clinical content draft | Yes | Draft only; authorized context | Mandatory before final record | Human/Application |
| Patient communication draft | Yes, if approved workflow | Draft and permission constrained | Required before sending | Application/Human |
| Suggest questions for clinician review | Yes | Advisory only | Clinician remains accountable | Application |
| Read appointment information | Yes | Authorized appointment scope | No, read-only | Tool Gateway |
| Read patient information | Yes | Authorized relationship and minimum fields | No, read-only | Tool Gateway |
| Create appointment | Conditional | Only through approved `create_appointment` tool and user permission | Required if product workflow requires it; final authority is application | Tool Gateway/Application |
| Modify/cancel/mark `NO_SHOW` appointment | Conditional | Explicit tool and permission; `NO_SHOW` must use the application transition command and valid transition | Required where policy requires; AI cannot invoke `NO_SHOW` without separate bounded-tool approval | Tool Gateway/Application |
| Create clinical record | Draft only | AI may create draft content, never authoritative final content | Mandatory | Application/Human |
| Modify finalized clinical record | No | Amendments only through authorized clinical workflow | Mandatory | Application |
| Create prescription | Post-MVP/No MVP API | No current MVP surface | Required if later approved | Application/Human |
| Finalize prescription | No | Explicitly forbidden to AI | Human/application only | Application |
| Modify billing/access billing | Post-MVP | No MVP billing API | Future policy required | Application |
| Access files | Post-MVP/pending | No arbitrary storage objects | Future authorization required | Application/Storage |
| Send external communication | Not established | Notification is deferred | Future approval required | Application |
| Execute arbitrary code/database access | No | Never permitted | Not applicable | Gateway/Application |

## 6. Forbidden AI Capabilities

AI must not directly access PostgreSQL, Redis, arbitrary storage, filesystem,
SQL, code, shell commands, secrets, credentials, or unrestricted internal
services. It must not bypass application services, authorization, tenant
isolation, human approval, or audit controls; access another tenant; alter
audit records; modify permissions; create privileged users; impersonate a
clinician; fabricate clinical facts; independently diagnose, prescribe, or
finalize sensitive clinical actions; modify finalized clinical records; or
treat user/model/document instructions as authorization.

## 7. AI Actor Model

| Actor | Identity and attribution |
|---|---|
| Human actor | Authenticated user, active membership, role, permission, and tenant |
| System actor | Named application/worker operation with controlled service context |
| AI actor | AI subsystem/model identity acting only through the originating human/system context |

Every AI request, tool invocation, result, denial, draft, and approval must
retain the originating actor, tenant, request ID, and AI/tool identity where
available. The exact persistent actor representation is open.

## 8. Tool Gateway

The Tool Gateway is the only AI-to-application capability boundary:

```text
AI → Tool request → Tool Gateway → Auth context → Authorization
  → Tenant validation → Input validation → Business rules
  → Domain service → Result filtering → Audit → AI
```

The gateway validates tool allowlisting, authenticated origin, originating
user, tenant/resource scope, permission, arguments, business state, output
size/content, side effects, rate limits, and audit requirements. The model
cannot invoke arbitrary backend functions.

## 9. Tool Permission Model

Every approved tool must have this contract before exposure:

| Field | Required definition |
|---|---|
| Name/purpose | Stable tool name and narrowly bounded purpose |
| Actor | Allowed originating roles/permissions; never model-only authority |
| Scope | Tenant and permitted resource relationship |
| Read/write | Read-only, draft-producing, or mutating behavior |
| Input | Strict schema, identifiers, bounds, and validation |
| Output | Minimum necessary fields and filtering rules |
| Approval | Whether human review/approval is mandatory |
| Side effects | Explicit domain effects and valid transitions |
| Audit | Events, actor, tenant, resource, result, request ID |
| Rate limit | Approved operation/resource limits; exact values open |

Initial conceptual tools supported by the architecture include
`get_patient`, `get_recent_encounters`, `get_medications`, `get_allergies`,
`search_knowledge`, `draft_clinical_note`, and `create_appointment`. This is
a contract inventory, not an implementation or permission grant.

## 10. Read vs Write Tools

- **Read:** AI may retrieve only authorized, minimum necessary data through
  allowlisted tools.
- **Draft:** AI may produce summaries or clinical/administrative drafts; a
  draft is not authoritative data.
- **Write:** AI must not directly write sensitive clinical data or finalized
  records. Any conditional operational mutation uses an explicit tool,
  normal application authorization, the approved application transaction/
  idempotency flow, and valid business rules. Appointment tools must also use
  the approved database double-booking constraints.
- **Approval/finalization:** an authorized human reviews; the application,
  not AI, performs the final mutation.

## 11. Human Approval Gate

Clinical content must follow:

```text
AI → AI Draft → Authorized Human Review → Approval
  → Application Validation → Clinical Application Service → Final Record
```

The gate is enforced by application logic and cannot depend only on prompts,
model instructions, UI behavior, or developer instructions. AI cannot
approve its own draft. The original finalized record remains immutable;
corrections use amendments/versioning.

## 12. AI Output Classification

| Output | Trust level | Human review | Permanent record | Audit |
|---|---|---|---|---|
| Informational response | Untrusted/advisory | When used for clinical action | No automatically | AI request/result as applicable |
| Retrieved knowledge | Untrusted source data | Depends on downstream use | No automatically | Retrieval and source reference |
| Generated summary | Untrusted derived content | Required for authoritative clinical use | Only through approved workflow | AI operation and access |
| Recommendation | Advisory/untrusted | Clinician review required | No automatically | AI operation and reviewer where applicable |
| Clinical draft | Untrusted draft | Mandatory | Only after approved application workflow | Creation/review/approval |
| Administrative draft | Untrusted draft | Required before external/sensitive action | Only after approved workflow | Creation and action |
| Approved clinical content | Human-approved/application-authoritative | Approval already recorded | Yes, through Clinical Service | Full approval/finalization trail |

## 13. Clinical Safety

AI must not present uncertain, missing, conflicting, stale, or inferred
information as established clinical fact. It must identify limitations and
defer when context is insufficient, records conflict, the question is
unsupported/high risk, authorization is absent, or a required tool is
unavailable.

The approved MVP clinical escalation policy is risk-tiered: low-risk
authorized assistance may proceed within scope; medium-risk content is
advisory/draft-only with human review; high-risk, emergency, ambiguous, or
materially conflicting requests must abstain, return a safe deferral, and
route to an authorized clinician. No medical diagnosis threshold is inferred.

## 14. AI Uncertainty / Abstention

Safe behavior is to limit, refuse, or request authorized human review rather
than fabricate certainty. Abstention is required or preferred for ambiguous
patient identity/context, conflicting records, unsupported clinical
questions, unsafe recommendations, missing authorization, unavailable or
failed tools, and unavailable retrieval/context. No clinical risk score or
medical threshold is introduced.

## 15. Prompt Injection Defense

User messages, clinical notes, uploaded files, retrieved documents, web
content, and external data are untrusted. Instructions inside retrieved
data are data, not system instructions. The Gateway and application must
preserve system policies, authorization, tenant isolation, tool limits, and
human approval regardless of model instructions. Direct and indirect
injection tests are mandatory.

## 16. Context Assembly

```text
Application → Authorized data selection → Context construction → AI
```

Context must be authorized, tenant-scoped, purpose-limited, minimum
necessary, validated, and traceable. AI cannot perform arbitrary database
search or arbitrary context assembly. The application resolves current user,
tenant, patient, encounter, permissions, relevant clinical data, and
approved knowledge before sending context.

## 17. Context Isolation

Conversations, patients, clinical records, users, tenants, and retrieved
knowledge remain separately scoped. A Tenant A conversation must never
receive Tenant B context. A patient context does not automatically expose
unrelated patients. Each tool and context assembly operation repeats tenant,
resource, and permission validation.

## 18. RAG Safety

RAG is an MVP capability behind a retrieval abstraction. Retrieval must
filter by tenant, document status, authorization scope, and approved global
visibility. Document/chunk metadata is isolated; archive/deletion must
propagate to retrievable content. Sources may be tracked for authorized
users, but vector storage details are not public. Malicious or stale
documents are treated as untrusted data and cannot override policy.

## 19. AI Memory / Conversation Context

Short-term conversation context is distinct from persistent patient/clinical
data. AI memory must not become an alternative medical record or duplicate
clinical truth. Conversations are scoped to tenant, user/participant, and
optional authorized patient/encounter context. Access, retention, deletion,
and audit must follow authorization and the final data policy. Retention and
prompt/context logging periods are open decisions.

The approved governance decision assigns the AI data policy to Product/
Compliance. No AI retention, deletion, anonymization, residency, or logging
value may be inferred before that policy is published.

## 20. AI Data Minimization

Before data enters AI context, the application must determine whether it is
necessary, authorized, tenant-scoped, appropriate to the operation, and
reducible by omitting sensitive fields. Entire patient records must not be
sent when a subset suffices. Uncontrolled conversation logging and
unnecessary PHI transmission are prohibited.

## 21. AI Output Validation

AI output is untrusted input:

```text
Model output → Schema validation → Authorization validation
→ Business validation → Human approval if required → Application mutation
```

Validate schemas, required fields, enums, identifiers, dates, tool
parameters, clinical boundaries, prohibited operations, and output size.
No output can create authority, permissions, tenant scope, or finalization
merely by stating it in natural language.

## 22. Tool Result Validation

Tool results sent back to AI are filtered to the minimum necessary fields and
must exclude secrets, internal topology, arbitrary storage details,
cross-tenant data, and excessive records. Results are rechecked for tenant,
resource, and permission scope before returning to the model.

## 23. AI Auditability

Audit, where applicable, must cover AI requests/responses, tool invocation,
tool result, denied invocation, authorization failure, sensitive context
access, draft creation, human review, approval/rejection, and finalized
result. Use metadata-first records: actor, tenant, operation/tool, resource,
result, request ID, and timestamp. Do not automatically log raw PHI or full
prompts/responses.

## 24. AI Logging

Never unnecessarily log full patient records, clinical notes, credentials,
tokens, secrets, unnecessary PHI, or complete sensitive prompts/responses.
Safe metadata includes event ID, originating actor, tenant, operation, tool,
result, request ID, timestamp, and redacted resource reference. Logging does
not replace audit or authorization.

## 25. Model Provider Boundary

The approved MVP AI platform direction is self-hosted Dify behind the AI
Gateway and application-controlled Tool Gateway. External LLM/Embedding
Providers are accessed only through controlled Gateway adapters. Dify is an untrusted runtime
boundary and receives only authorized minimum-necessary data through the
Gateway; it has no direct database access and cannot bypass tenant isolation,
authorization, domain services, audit, or human approval. Model/provider specifics,
embedding, retention, knowledge governance, failure behavior, and exact tool
authorization and clinical escalation are approved for MVP. Provider evidence
and exact operational limits remain release dependencies.

The approved MVP model/provider profile is Managed External LLM plus Managed
Embedding. This profile does not permit direct provider access from Dify,
domain code, or public APIs; all external model calls remain controlled by the
AI Gateway.

MVP uses one primary generative model and one primary embedding model, with no
automatic fallback. Model/version changes require compatibility evaluation;
embedding-dimension changes require migration or re-embedding planning. The
approved pair is `gpt-4o-2024-08-06` and `text-embedding-3-small` at dimension
`1536`; these values are pinned for MVP.

AI data follows a minimum-necessary, category-specific lifecycle. Raw
prompt/response content is not retained by default; retained content must be
redacted and policy-controlled. Clinical history remains immutable and AI
data must use authorized export/deletion workflows. The approved AI retention
baseline is authoritative for MVP; clinical and broader compliance policy
values remain separate release dependencies.

The approved MVP AI retention baseline is 30 days from `last_message_at` for
conversation/message data, 7 days for unapproved drafts, immediate approved-
draft content purge after audit metadata capture, 0-day default raw
prompt/context retention, and 90-day applicable metadata retention. Knowledge
embeddings follow source lifecycle and Legal Hold inheritance.

Knowledge and vector cleanup must evaluate inherited Legal Hold through
canonical tenant, supported resource, and document scopes. No new generic
`clinical_resources` abstraction is introduced; invalid mappings fail closed,
and skipped cleanup is recorded in `audit_events`. MVP retrieval supports
typed, authorized links only to `patients` and `medical_records`.
The Golden Dataset is jointly owned by Clinical and AI, versioned, and managed
in an approved environment without real PHI outside approved controls. Strict
clinical threshold failure blocks AI MVP release.

Knowledge and vector cleanup must evaluate inherited Legal Hold through
canonical tenant, supported resource, and document scopes. No new generic
`clinical_resources` abstraction is introduced; invalid mappings fail closed,
and skipped cleanup is recorded in `audit_events`.

The approved AI evaluation profile is a Strict Clinical Safety Gate. AI MVP
release is blocked until the versioned Golden Dataset evaluation passes,
classified sensitive fields achieve 100% PII redaction, and Clinical/Security
approve the results. Context recall and precision must each be at least 85%,
and faithfulness/hallucination failure must remain below 2%. Model changes
require the safety regression suite. Latency targets remain TBD and are
observed operationally; provider evidence requirements remain open.

## 26. AI Failure Modes

For model/provider timeout or failure, malformed output, unavailable tool,
denied authorization, unavailable retrieval/context, or failed safety
validation, the system must return a safe error/deferred result and preserve
normal application security. Sensitive operations **fail closed**. A failed
AI path must never fall back to direct data access, bypass approval, or
perform an unvalidated mutation.

## 27. AI Rate Limiting / Resource Control

AI requests, tool calls, retrieval, conversation length, prompt/context
size, and expensive draft operations require bounded controls at user,
tenant, operation, and tool scope. MVP knowledge is tenant-only; global
knowledge requires a separate Product/Security approval. Tool permissions use
Read, Summarize, Draft, and Human-approved Action capability classes, and AI
actor identity, tenant scope, tool class, and policy version are propagated
through the Gateway. Exact production numeric limits and quotas remain
operational/release configuration. Exceeding a limit fails safely and returns
the API's canonical rate-limit error.

Collection pagination uses the approved uniform opaque cursor contract and
server-enforced bounds (`default_size = 20`, `max_size = 100`). These pagination
values do not resolve separate AI rate-limit or cost-quota decisions.

## 28. Cost / Resource Abuse

The Gateway must prevent recursive tool calls, tool loops, repeated
retrieval, maliciously long prompts, oversized contexts, and excessive
requests. It must impose an approved execution boundary and stop work when
that boundary is exceeded. Numerical limits are intentionally unresolved.

## 29. AI Autonomy Levels

| Level | Meaning | MVP status |
|---|---|---|
| 0 | Informational response | Allowed within authorization/safety limits |
| 1 | Read-only authorized assistance | Allowed through approved tools |
| 2 | Draft generation | Allowed; draft is not authoritative |
| 3 | Human-approved action | Allowed only through application approval |
| 4 | Autonomous sensitive mutation | Forbidden |

The product and architecture support controlled assistance, drafts, and
human-approved workflows; they do not authorize autonomous sensitive
clinical mutation.

## 30. AI Safety Invariants

1. AI is never an authorization authority.
2. AI never receives unrestricted database access.
3. AI cannot cross tenant boundaries.
4. AI cannot bypass application authorization.
5. AI cannot directly finalize sensitive clinical actions.
6. AI clinical content remains a draft until required approval.
7. AI output is untrusted input.
8. Retrieved content cannot override system instructions or policy.
9. AI tools are explicitly allowlisted and schema-bound.
10. Sensitive AI operations are auditable.
11. AI receives minimum necessary data.
12. Security controls are enforced outside the model.
13. AI failure cannot weaken normal application security.
14. Human accountability remains preserved.

## 31. AI ↔ DOMAIN BOUNDARY

| Domain | AI Read Access | AI Write Access | Human Approval | Tool Gateway Required |
|---|---|---|---|---|
| Patient | Authorized patient information only | None directly | Not for read; required for clinical use | Yes |
| Clinical | Authorized encounters, history, allergies, and notes | Draft content only; no finalized record | Yes for authoritative content | Yes |
| Appointment | Authorized appointment/availability information | Conditional approved appointment tool only | Application workflow; policy-specific | Yes |
| Doctor | Authorized profile/operational data needed for a task | None established | Not applicable | Yes |
| Tenant/Identity | Current authorized context only | None | Not applicable | Yes |
| AI/RAG | Authorized conversations and knowledge | Draft/conversation state through application | Human gate for clinical draft | Yes |
| Audit | No unrestricted audit-log access | Never modify audit records | Not applicable | Yes |
| Billing | No MVP access | No MVP access | Future decision | Yes if approved |
| Files | No MVP access; no arbitrary objects | No MVP access | Future decision | Yes if approved |

## 32. AI ↔ TEAM OWNERSHIP

| AI Responsibility | Owning Team | Module |
|---|---|---|
| AI Gateway and agent runtime | Engineer D | AI Platform |
| Tools and tool authorization integration | Engineer D with affected domain owner | AI Platform / public domain contracts |
| Context and memory | Engineer D | AI Platform |
| Retrieval/RAG | Engineer D | AI Platform |
| AI drafts and evaluation/safety | Engineer D | AI Platform |
| Patient/clinical data capability exposed to AI | Engineer B | Patient / Clinical |
| Appointment capability exposed to AI | Engineer C | Doctor / Appointment |
| Identity, tenant, authorization, audit | Engineer A | Identity & Security / Tenant / Audit |

Cross-domain changes require review by the affected owner. This preserves
the ownership stated in System Definition and Architecture.

## 33. AI SAFETY REQUIREMENTS MATRIX

| Requirement | Threat | Control | Enforcement Layer | MVP/Post-MVP |
|---|---|---|---|---|
| Tenant-scoped context | Cross-tenant retrieval | Derive context and recheck every tool | API, Application Service, Database, AI Gateway | MVP |
| Minimum necessary PHI | Context leakage | Purpose-limited selection and filtering | Application Service, AI Gateway | MVP |
| Tool allowlist | Tool abuse | Explicit schema and permission contract | AI Gateway, Application Service | MVP |
| Human approval | Autonomous clinical mutation | Application-controlled draft/review/approval | Application Service, Human Review | MVP |
| Immutable finalized record | Clinical tampering | Amendment/version workflow only | Application Service, Database | MVP |
| Untrusted model output | Hallucination/injection | Schema, authorization, business validation | AI Gateway, Application Service | MVP |
| Untrusted retrieved content | Indirect injection | Content cannot override policy | AI Gateway, Application Service | MVP |
| Auditability | Insider misuse/exfiltration | Metadata-first event recording | Application Service, Audit | MVP |
| Secret isolation | Credential compromise | No secret in context/log/output | Infrastructure, AI Gateway | MVP |
| Fail closed | Provider/tool failure | Deny sensitive operation on failure | AI Gateway, Application Service | MVP |
| Bounded AI resources | DoS/cost abuse | Limits, timeout, loop/context controls | API, AI Gateway, Infrastructure | MVP; values open |
| Dify runtime boundary | Runtime compromise or data leakage | Self-hosted isolation, minimized encrypted request, no direct DB access, and Gateway policy enforcement | AI Gateway, Infrastructure | MVP |
| File isolation | Malicious/arbitrary file access | Private authorized storage | Application Service, Object Storage | Post-MVP |
| Webhook authenticity | Spoof/replay | Signature, timestamp, event idempotency | API, Application Service | Post-MVP |

## 34. AI SAFETY TESTING

Mandatory categories include tenant isolation, authorization bypass, IDOR,
direct/indirect prompt injection, malicious document injection, tool abuse,
unauthorized tool invocation, cross-tenant retrieval, sensitive-data
leakage, hallucination/uncertainty handling, malformed structured output,
human approval bypass, clinical-record mutation bypass, tool loops/resource
abuse, provider failure, and timeout/failure.

Tests must prove that model text cannot grant permission, Tenant A cannot
receive Tenant B context, AI cannot access PostgreSQL or arbitrary storage,
finalized records cannot be overwritten, drafts cannot become final without
authorized human approval, and AI failure cannot weaken application security.

## 35. RED TEAM SCENARIOS

| Scenario | Attack | Expected behavior | Enforcement layer | Audit |
|---|---|---|---|---|
| 1 | User asks AI for another patient's record | Refuse/deny; no existence leakage | Application/Tool Gateway | Access denial and request |
| 2 | User claims to be administrator | Ignore claim; use authenticated context | API/Application | Authorization failure if attempted |
| 3 | Clinical note instructs privileged tool use | Treat note as data; do not elevate | AI Gateway | Tool decision and sensitive access |
| 4 | RAG document contains injection | Do not follow document instruction | RAG/AI Gateway | Retrieval and safety signal |
| 5 | AI requests a tool for another tenant | Deny tenant mismatch | Tool Gateway/Application | Denied invocation |
| 6 | AI produces prescription and finalizes it | Block; preserve draft/human workflow | Application/Human Review | Draft and blocked action |
| 7 | Tool returns malformed/excessive output | Reject/filter result; do not continue unsafe flow | Tool Gateway | Validation failure |
| 8 | Provider is compromised/unavailable | Minimize/revoke/fail closed; no direct fallback | AI Gateway/Infrastructure | Provider failure and response |

No red-team scenario authorizes treatment instructions or autonomous medical
decisions.

## 36. HUMAN OVERSIGHT

The human is:

- **reviewer** when inspecting AI summaries, recommendations, or drafts;
- **approver** when clinical content must pass the explicit approval gate;
- **accountable actor** for the resulting human-approved clinical action;
- **escalation point** when the model is uncertain, context conflicts, the
  task is high risk, or safety validation fails.

The application records the human actor and does not present AI as replacing
clinical responsibility or authorization.

## 37. AI SAFETY OPEN DECISIONS

# Open AI Safety Decisions and Release Dependencies

| ID | Decision | Why it matters | Affected domain | Affected document | Blocking level | Owner |
|---|---|---|---|---|---|---|
| AI-001 | Dify deployment/data boundary and provider policy | Self-hosted Dify behind controlled AI/Tool Gateway adapters is approved; provider evidence remains a release dependency | AI | Architecture Gate; Security | Resolved for MVP | Engineer D/Security |
| AI-002 | Model selection and embedding model/dimension | Pinned model pair and `1536` dimension are approved; changes require compatibility/re-embedding review | AI/RAG | Architecture Gate; Data Model | Resolved for MVP | Engineer D |
| AI-003 | Prompt/context and conversation retention/logging | Approved minimum-necessary lifecycle and retention baseline are propagated; broader clinical policy remains a release dependency | AI | Architecture Gate; Security; Data Model | Resolved for MVP | Engineer D/Security |
| AI-004 | Global versus tenant-specific knowledge governance | MVP is tenant-only; global knowledge requires separate Product/Security approval | RAG | Architecture; Data Model; API Contract | Resolved for MVP | Product/Engineer D |
| AI-005 | Final tool permission granularity and AI actor persistence | Capability classes and Gateway propagation of actor/tenant/policy context are approved | AI/Identity | Security; API Contract; Architecture | Resolved for MVP | Engineer A/D |
| AI-006 | Clinical escalation policy for uncertainty/emergency/high-risk requests | Risk-tiered assistance, abstention, safe deferral, clinician routing, and audit provenance are approved | AI/Clinical | System Definition; Architecture | Resolved for MVP | Product/Clinical |
| AI-007 | Human approval workflow using canonical clinical status `IN_REVIEW` | Authorized clinician review/edit/approve with step-up MFA, OCC revalidation, stale-draft handling, and audit provenance are approved | AI/Clinical | Architecture; Data Model; API Contract | Resolved for MVP | Engineer B/Product |
| AI-008 | AI rate limits, context/tool-call limits, and cost controls | Bounded controls are approved; exact numeric values and quotas remain operational/release configuration | AI/API | API Contract; Security | Required before production | Engineer D/API owner |
| AI-009 | AI autonomy scope for conditional appointment operations | Determines whether any AI mutation is permitted | AI/Appointment | System Definition; API Contract | Required before production | Product/Engineer C/D |
| AI-010 | Future file scope and malware scanning policy for AI-accessible files | Determines whether files enter AI context after MVP | AI/Clinical Files | System Definition; Data Model; Security | Post-MVP gate | Product/Engineer B/D |

## 38. TRACEABILITY

| AI Safety Requirement | System Definition | Architecture | Data Model | API Contract | Security |
|---|---|---|---|---|---|
| Controlled AI subsystem | Sections 7-8 | Sections 22-26 | Sections 59-60 | Sections 14-15 | Sections 15-16 |
| Authorized minimum context | Sections 7, 9 | Sections 23, 27-31 | Sections 34, 59-61 | Sections 5, 14-15 | Sections 7-8, 17 |
| Tool boundary | Section 8.2 | Sections 24-26 | Sections 59 | Sections 14-15 | Sections 15-16 |
| Human approval | Section 11 | Sections 32-34 | Section 32 | Sections 13-14 | Section 20 |
| Clinical immutability | Section 11 | Sections 20-21 | Sections 21-22 | Sections 12-13 | Section 19 |
| RAG isolation | Section 10 | Sections 29-31 | Sections 33-34 | Section 15 | Section 18 |
| AI auditability | Section 14 | Section 35 | Sections 39-40 | Section 23 | Sections 21, 23-24 |
| AI failure safety | Sections 7-8 | Sections 22-34 | Sections 59-60 | Sections 14-15 | Sections 15-17, 26 |

## 39. MVP VS POST-MVP

### MVP AI Safety Requirements

- AI assistant, authorized patient-information retrieval, clinical-history
  summarization, approved knowledge retrieval, administrative assistance,
  and clinical-note drafting.
- AI Gateway, explicit tools, tenant/resource authorization, minimum
  necessary context, output validation, auditability, and fail-closed
  sensitive operations.
- RAG tenant/status/permission filtering and untrusted-document handling.
- Human review/approval before AI-generated clinical content becomes
  authoritative.
- No direct database access, arbitrary code, autonomous diagnosis,
  prescribing, or finalized clinical mutation.

### POST-MVP AI Safety Requirements

- Billing/payment AI access or mutation.
- Notification/external communication automation.
- Prescription, lab-result, and clinical-file AI workflows.
- Any broader patient-facing AI capability.
- Additional autonomy beyond the approved Level 3 human-approved workflow.

Future capabilities must not be treated as MVP permissions merely because
the architecture can technically support them.

## 40. Final Cross-Document Validation

Cross-check completed against System Definition, Architecture Decisions,
Data Model, API Contracts, and Security.

Validated alignment:

1. AI capabilities and forbidden capabilities.
2. Domain and team boundaries.
3. Tenant-scoped patient, encounter, appointment, conversation, and RAG
   context.
4. Application authorization and Tool Gateway boundary.
5. No direct AI database/storage access.
6. Clinical immutability and amendment/versioning.
7. Human approval for AI clinical content.
8. Audit and minimum-necessary data requirements.
9. MVP RAG and AI scope; Post-MVP Billing, Notification, Files,
   Prescriptions, Labs, and Ratings.

Unresolved contradictions and security-critical decisions are not silently
resolved: final permissions for separate Nurse/Clinical Staff and Receptionist
roles, canonical clinical status `IN_REVIEW`,
provider/model/retention, tool actor granularity, clinical escalation,
concurrency/rate limits, and future file controls remain listed under Open AI
Safety Decisions or the referenced security/API decision lists. Clinical file
MVP scope itself is approved as Post-MVP.
