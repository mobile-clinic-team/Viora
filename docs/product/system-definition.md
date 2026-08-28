# Clinic AI Platform — System Definition

> Version: 0.1
> Status: Draft
> Last Updated: 2026-08-27
> Document Owner: Product Team
>
> This document defines the product scope, users, core workflows,
> system responsibilities, AI capabilities, constraints, and
> non-functional goals of the Clinic AI Platform.
>
> This document is the product foundation for architecture,
> database design, API design, implementation, testing, and
> AI-agent development.

---

# 1. Product Overview

## 1.1 Product Name

Working name:

**Clinic AI Platform**

Final product name has not been decided.

---

## 1.2 Product Vision

Clinic AI Platform is a multi-tenant healthcare management platform
designed to help clinics manage their daily operations, patient
information, clinical workflows, appointments, and administrative
activities while providing an AI assistant that helps authorized users
retrieve, understand, summarize, and work with relevant information.

The platform is designed from the beginning for:

- multiple clinics
- multiple users
- strict tenant isolation
- sensitive healthcare data
- strong authentication and authorization
- auditable actions
- production-scale deployment
- AI-assisted workflows

---

## 1.3 Product Principles

The system follows these principles:

### Principle 1 — Security First

Healthcare data is sensitive.

Security must be treated as a fundamental system property,
not as a feature added after implementation.

---

### Principle 2 — Tenant Isolation

Each clinic is an independent tenant.

A user must never access another clinic's data unless explicitly
authorized by a future cross-tenant administrative policy.

---

### Principle 3 — Least Privilege

Users and AI agents receive only the permissions required
to perform their tasks.

---

### Principle 4 — Human Accountability

AI assists users.

AI does not replace authorization, clinical responsibility,
or human approval for sensitive clinical actions.

---

### Principle 5 — Auditability

Important access and modification events must be auditable.

The system must be able to answer:

- Who performed the action?
- What was accessed or changed?
- When did it happen?
- Which clinic was involved?
- Which resource was affected?
- Was the action successful or rejected?

---

### Principle 6 — Domain Boundaries

Business domains must have clear boundaries.

A module must not directly manipulate another module's
internal implementation or database.

---

### Principle 7 — AI as a Controlled Subsystem

AI must not have unrestricted access to the application,
database, filesystem, or external services.

AI interacts with the platform through explicitly
authorized capabilities/tools.

The MVP AI platform direction is self-hosted Dify behind the project AI
Gateway and application-controlled Tool Gateway. External LLM/Embedding
Providers are accessed only through controlled Gateway adapters. MVP AI is limited to read,
summarization, and draft-first capabilities; write tools are default-deny.
Dify is an untrusted orchestration/runtime component and must not access the
production database, bypass domain authorization, or perform autonomous
clinical mutations. Sensitive failures fail closed while core application
workflows degrade safely.

---

# 2. Problem Definition

## 2.1 Current Problems

The target clinic environment may contain fragmented workflows:

- patient information stored in different systems
- manual appointment management
- fragmented clinical information
- repetitive administrative work
- difficulty retrieving relevant patient information
- repetitive documentation tasks
- difficulty maintaining consistent workflows
- limited visibility into clinic operations

The platform aims to centralize these workflows while reducing
unnecessary manual work.

---

## 2.2 Problems the AI Assistant Should Address

The AI assistant should help users with tasks such as:

- retrieving relevant information
- summarizing information
- answering questions about authorized clinic data
- drafting documentation
- assisting with administrative workflows
- searching approved knowledge sources

The AI assistant must not be treated as an unrestricted
decision-making authority.

---

# 3. Target Users

The initial system defines the following user types.

## 3.1 Clinic Owner / Organization Administrator

Responsibilities:

- manage clinic configuration
- manage staff
- manage roles and permissions
- view operational information
- manage clinic-level settings

---

## 3.2 Doctor

Responsibilities:

- view assigned/authorized patient information
- conduct encounters
- create clinical documentation
- review relevant medical information
- create or review prescriptions where supported
- use the AI assistant

---

## 3.3 Nurse / Clinical Staff

Responsibilities:

- access authorized patient information
- assist with patient workflows
- record clinical information according to permissions
- use approved AI capabilities

---

## 3.4 Receptionist

Responsibilities:

- register patients
- manage appointments
- check patients in
- manage basic administrative information
- access only information required for their role

---

## 3.5 Patient

Responsibilities:

- manage permitted personal information
- view appointments
- receive permitted communications
- access permitted health information
- interact with patient-facing AI capabilities if introduced

---

## 3.6 Platform Administrator

A platform-level administrator is different from a clinic administrator.

Responsibilities may include:

- platform operations
- tenant management
- system configuration
- security operations
- incident investigation

Platform administrators must not automatically receive unrestricted
access to clinical data.

Any privileged access must be explicitly controlled and audited.

---

# 4. Multi-Tenant Model

The system is multi-tenant.

A tenant represents a clinic or healthcare organization.

Example:

    Platform
    │
    ├── Clinic A
    │   ├── Users
    │   ├── Patients
    │   ├── Appointments
    │   └── Clinical Records
    │
    ├── Clinic B
    │   ├── Users
    │   ├── Patients
    │   ├── Appointments
    │   └── Clinical Records
    │
    └── Clinic C
        ├── Users
        ├── Patients
        ├── Appointments
        └── Clinical Records

Tenant isolation is a mandatory security requirement.

Every tenant-owned resource must have an explicit relationship
to its owning tenant.

---

# 5. Core Domains

The initial system consists of the following domains.

## 5.1 Identity

Responsibilities:

- authentication
- user identity
- sessions
- MFA
- roles
- permissions
- account lifecycle
- authentication security

---

## 5.2 Tenant

Responsibilities:

- clinic profile
- clinic configuration
- operating settings
- staff membership
- clinic-level policies

---

## 5.3 Patient

Responsibilities:

- patient registration
- demographic information
- contact information
- patient profile
- patient identifiers
- patient relationships

---

## 5.4 Appointment

Responsibilities:

- appointment creation
- appointment scheduling
- calendar
- availability
- check-in
- queue management
- operational workflows

For MVP, queue management is derived from appointment status, not a dedicated queue entity.

---

## 5.5 Clinical

Responsibilities:

- encounters
- clinical notes
- diagnoses
- symptoms
- allergies
- medications
- prescriptions
- clinical history
- follow-up information

Clinical data requires stricter access controls than ordinary
administrative data.

---

## 5.6 Billing

Responsibilities:

- invoices
- charges
- payments
- billing status
- financial records

Billing is initially an independent domain even if its first
implementation is limited.

---

## 5.7 Notification

Responsibilities:

- email notifications
- SMS notifications
- appointment reminders
- system notifications
- user notification preferences

---

## 5.8 Audit

Responsibilities:

- security audit events
- data access events
- important data modifications
- administrative actions
- AI access and tool execution events

Audit records must be designed to resist unauthorized modification.

---

## 5.9 AI

Responsibilities:

- AI assistant
- conversation management
- context construction
- retrieval
- memory
- tool execution
- AI safety controls
- AI evaluation
- AI observability

AI is a subsystem that interacts with domain services through
controlled interfaces.

---

## 5.10 Doctor

Responsibilities:

- department
- doctor profile
- working shift
- doctor rating

---

# 6. Core User Workflows

The following workflows define the initial product.

---

## 6.1 User Login

    User
      │
      ▼
    Login
      │
      ▼
    Authentication
      │
      ▼
    MFA if required
      │
      ▼
    Session established
      │
      ▼
    Application

Requirements:

- secure authentication
- session management
- MFA support
- account lockout/rate limiting policies
- session revocation

The approved authentication strategy is an Auth0-style Managed CIAM
OIDC/OAuth2 target profile behind a provider-neutral application boundary,
using short-lived access tokens with a 15-minute lifetime and rotating refresh
tokens with a 7-day absolute session lifetime and replay detection. The
application owns tenant context, roles, permissions, and session revocation;
the provider owns credentials, MFA, key rotation, and standard recovery.
Recovery exceptions require application authorization plus re-authentication or
step-up MFA and audit. The final provider contract, region/residency, and
service-level terms remain open follow-up decisions.

---

## 6.2 Clinic Staff Onboarding

    Clinic Administrator
           │
           ▼
    Invite Staff Member
           │
           ▼
    Staff accepts invitation
           │
           ▼
    Identity created
           │
           ▼
    Clinic membership created
           │
           ▼
    Role assigned

The staff member must belong explicitly to the clinic.

---

## 6.3 Patient Registration

    Receptionist
         │
         ▼
    Create Patient
         │
         ▼
    Validate data
         │
         ▼
    Authorization
         │
         ▼
    Patient created
         │
         ▼
    Audit event

The patient must be associated with the correct tenant.

---

## 6.4 Appointment Creation

    Receptionist / Doctor
            │
            ▼
       Select patient
            │
            ▼
       Select provider
            │
            ▼
       Select time
            │
            ▼
       Validate availability
            │
            ▼
       Create appointment
            │
            ▼
       Audit event
            │
            ▼
       Notification event

---

## 6.5 Patient Check-In

    Patient arrives
          │
          ▼
      Check-in
          │
          ▼
    Appointment validated
          │
          ▼
       Queue created
          │
          ▼
    Clinical workflow begins

---

## 6.6 Clinical Encounter

    Doctor
      │
      ▼
    Open patient
      │
      ▼
    Review authorized history
      │
      ▼
    Start encounter
      │
      ├── Symptoms
      ├── Findings
      ├── Diagnosis
      ├── Medication
      └── Clinical notes
      │
      ▼
    Save encounter
      │
      ▼
    Audit event

---

## 6.7 AI-Assisted Clinical Workflow

    Doctor
      │
      ▼
    Ask AI
      │
      ▼
    AI identifies intent
      │
      ▼
    Authorization check
      │
      ▼
    Context Builder
      │
      ▼
    Retrieve minimum necessary data
      │
      ▼
    AI processing
      │
      ▼
    Response / Draft
      │
      ▼
    Doctor reviews
      │
      ▼
    Optional human-approved action
      │
      ▼
    Audit event

AI must not bypass authorization.

---

# 7. AI Assistant

## 7.1 AI Purpose

The AI assistant is designed to reduce repetitive work and improve
information accessibility for authorized users.

The initial AI assistant is an assistant, not an autonomous
clinical decision maker.

---

## 7.2 Initial AI Capabilities

### Capability A — Patient Information Retrieval

Example:

"Show me the patient's relevant allergies."

The AI retrieves only information that the requesting user
is authorized to access.

---

### Capability B — Clinical History Summary

Example:

"Summarize the patient's recent encounters."

The system retrieves relevant clinical records and generates
a summary.

The source records remain authoritative.

---

### Capability C — Clinical Note Drafting

Example:

"Draft a summary from this encounter."

The AI produces a draft.

The user remains responsible for reviewing and accepting
the final documentation.

---

### Capability D — Knowledge Retrieval

The AI can retrieve information from approved knowledge sources.

Examples:

- clinic policies
- internal procedures
- approved medical knowledge sources
- operational documentation

Access must respect tenant and permission boundaries.

---

### Capability E — Administrative Assistance

Examples:

- appointment assistance
- workflow assistance
- clinic policy lookup
- operational summaries

---

# 8. AI Restrictions

The AI system MUST NOT have unrestricted access to application data.

The AI MUST NOT directly connect to the production database.

The AI MUST access domain capabilities through controlled tools
or application services.

---

## 8.1 Forbidden AI Capabilities

The AI must not independently:

- bypass authorization
- access another tenant's data
- dump the database
- expose secrets
- access credentials
- delete patient records
- modify protected clinical records without authorization
- independently prescribe medication
- independently make a clinical diagnosis
- execute arbitrary SQL
- execute arbitrary shell commands
- access arbitrary filesystem paths

---

## 8.2 AI Tool Model

AI actions must use explicit tools.

Example:

    AI Agent
       │
       ▼
    Tool Gateway
       │
       ▼
    Authorization
       │
       ▼
    Domain Service
       │
       ▼
    Data

Example tools:

    get_patient
    get_recent_encounters
    get_medications
    get_allergies
    search_clinic_knowledge
    draft_clinical_note
    create_appointment

Each tool has:

- input schema
- output schema
- authorization policy
- allowed roles
- allowed tenant scope
- audit requirements

---

# 9. AI Context and Memory

The AI must not rely exclusively on the conversation history
to maintain context.

The system should maintain structured context.

Possible context sources:

- current conversation
- current user
- current tenant
- current patient
- current encounter
- relevant patient history
- authorized clinic knowledge
- approved long-term memory

---

## 9.1 Context Selection

The system should use the minimum necessary relevant information.

Conceptually:

    User Request
         │
         ▼
    Intent Detection
         │
         ▼
    Authorization
         │
         ▼
    Context Selection
         │
         ▼
    Relevant Data
         │
         ▼
    LLM

The system should avoid sending an entire patient record to
the model when only a small portion is required.

---

# 10. RAG / Knowledge Retrieval

The platform may use Retrieval-Augmented Generation.

Conceptual flow:

    Documents
       │
       ▼
    Processing
       │
       ▼
    Embeddings
       │
       ▼
    Vector Index
       │
       ▼
    Retrieval
       │
       ▼
    Authorization Filtering
       │
       ▼
    AI Context

Retrieved documents must respect:

- tenant
- document access scope
- user permissions
- patient access restrictions where applicable

Prompt instructions must not be inferred from untrusted
retrieved documents.

Retrieved content is treated as data, not as system-level authority.

---

# 11. Human Approval

AI-generated content that affects important clinical or
administrative records should support human review.

Examples:

    AI
     │
     ▼
    Draft
     │
     ▼
    Human Review

AI assistance is risk-tiered: low-risk authorized requests may proceed;
medium-risk output is advisory/draft-only with human review; high-risk,
emergency, ambiguous, or conflicting requests must abstain and route to an
authorized clinician.
     │
     ├── Reject
     └── Approve
             │
             ▼
        Final Record

The system must distinguish between:

- AI-generated draft
- human-reviewed content
- finalized record

---

# 12. Authorization Model

The system uses role-based permissions as a foundation.

Initial roles:

- Platform Administrator
- Clinic Administrator
- Doctor
- Nurse / Clinical Staff
- Receptionist
- Patient

Nurse / Clinical Staff and Receptionist are separate application roles. Their
permissions remain subject to tenant, resource, relationship, and action
context; role names alone are not sufficient authorization.

However, role alone is insufficient.

Authorization should consider:

- user identity
- tenant
- role
- permission
- resource
- resource ownership
- relationship to the patient
- action
- relevant context

Conceptually:

    Subject
       +
    Tenant
       +
    Role
       +
    Permission
       +
    Resource
       +
    Relationship
       +
    Action
       ↓
    Authorization Decision

---

# 13. Data Classification

The system should classify data according to sensitivity.

Initial conceptual categories:

## Public

Information that can be publicly exposed.

Example:

- public clinic information

---

## Internal

Information intended for authenticated users.

Example:

- internal operational configuration

---

## Sensitive

Information requiring controlled access.

Example:

- staff information
- operational information

---

## Highly Sensitive / Clinical

Information requiring strict access control.

Examples:

- medical history
- diagnosis
- medications
- allergies
- clinical notes
- prescriptions
- medical documents

---

# 14. Audit Requirements

Important actions must generate audit events.

Examples:

- login
- failed login
- permission changes
- patient creation
- patient data access
- clinical record access
- clinical record modification
- appointment modification
- administrative changes
- AI tool invocation
- AI access to sensitive data
- privileged operations

Audit event should conceptually contain:

    event_id
    timestamp
    actor
    tenant
    action
    resource
    resource_id
    result
    source/context
    metadata

Audit logs must not expose unnecessary sensitive data.

---

# 15. Security Requirements

Security requirements include:

## Authentication

- secure authentication
- MFA support
- session management
- session revocation
- brute-force protection
- credential protection

---

## Authorization

- least privilege
- tenant isolation
- resource-level authorization
- role/permission management
- privileged access controls

---

## Data Protection

- encryption in transit
- encryption at rest
- secrets management
- secure key management
- protected backups

---

## Application Security

- input validation
- output validation
- secure headers
- CSRF protection where applicable
- rate limiting
- abuse prevention
- dependency security
- security testing

---

## AI Security

- prompt injection defense
- tool authorization
- tenant isolation
- context minimization
- output validation
- sensitive-data controls
- AI audit logging
- model/provider credential protection

---

# 16. Reliability Requirements

The platform should be designed for production reliability.

Required capabilities include:

- health checks
- graceful failure
- timeouts
- retry policies
- idempotency for appropriate operations
- asynchronous processing
- queue-based background jobs
- database backups
- disaster recovery
- monitoring
- alerting
- rollback capability

---

# 17. Scalability

The system should initially use a modular monolith architecture.

Conceptually:

    Web
     │
     ▼
    API
     │
    ├── Identity
    ├── Clinic
    ├── Patient
    ├── Appointment
    ├── Clinical
    ├── Billing
    ├── Notification
    ├── Audit
    └── AI
         │
         ▼
      Database

The architecture must preserve module boundaries so that
individual domains can be extracted into independent services
if future scale or operational requirements justify it.

Microservices are not required at initial deployment.

---

# 18. Asynchronous Processing

Long-running or non-critical operations should use background jobs.

Examples:

- AI processing
- notifications
- document processing
- search indexing
- analytics
- report generation

Conceptual flow:

    Application
        │
        ▼
      Event
        │
        ▼
      Queue
        │
        ├── AI Worker
        ├── Notification Worker
        ├── Search Worker
        └── Analytics Worker

The primary transaction should not depend on the successful
completion of unrelated background jobs.

---

# 19. Data Storage

The initial platform is expected to use:

## Transactional Database

PostgreSQL or equivalent relational database.

Used for:

- users
- tenants
- patients
- appointments
- encounters
- clinical records
- billing
- audit metadata

---

## Cache

Redis or equivalent.

Used for:

- caching
- rate limiting
- temporary state
- job coordination where appropriate

Redis is not the source of truth for clinical records.

---

## Object Storage

Private object storage.

Used for:

- medical documents
- PDFs
- images
- attachments

Objects must not be publicly accessible by default.

---

# 20. External AI Providers

The platform may use external LLM providers.

The architecture must ensure that:

- provider credentials are protected
- requests are controlled
- data sent to providers is minimized
- provider access is auditable
- tenant boundaries are maintained
- provider-specific behavior is abstracted behind an AI gateway
- changing model providers does not require rewriting business domains

The system should not make the business domain directly dependent
on a specific LLM provider.

---

# 21. Observability

The system should provide:

## Metrics

Examples:

- request latency
- error rate
- database latency
- queue latency
- AI latency
- AI usage
- resource utilization

---

## Logs

Logs should support debugging and security investigation
without unnecessarily logging sensitive clinical information.

---

## Traces

Distributed tracing should be available where appropriate.

Example:

    User Request
       ↓
    API
       ↓
    Patient Service
       ↓
    Database

For AI:

    User Request
       ↓
    AI Gateway
       ↓
    Agent
       ↓
    Tool
       ↓
    Clinical Service
       ↓
    Database
       ↓
    LLM

---

# 22. Production Environment

The platform should separate environments.

Initial environments:

    Development
        │
        ▼
    Staging
        │
        ▼
    Production

Production data must not be casually copied into development
or staging environments.

Production credentials must be isolated from development credentials.

The approved production-policy boundary permits implementation of environment
and secret isolation, migration rollback contracts, failure-safe dependency
behavior, test/observability interfaces, and explicit operational ownership.
SLO, RPO/RTO, backup retention/restoration targets, rate limits/quotas, alert
thresholds, provider/topology, and incident-response values remain production
release blockers until approved; no numeric target is inferred.

---

# 23. Backup and Disaster Recovery

The system must define:

- backup frequency
- retention period
- recovery objectives
- recovery procedures
- restore testing
- disaster recovery procedures

Two explicit targets must eventually be defined:

**RPO — Recovery Point Objective**

Maximum acceptable data loss.

**RTO — Recovery Time Objective**

Maximum acceptable service recovery time.

Exact values are not yet defined.

---

# 24. Compliance

The product may be subject to healthcare, privacy, security,
and data-protection regulations depending on the target market.

Compliance requirements must be determined based on:

- deployment country
- target market
- clinic type
- data processed
- hosting model
- external service providers

The system architecture should support compliance requirements,
but this document does not claim that the system is currently
compliant with any specific regulation.

---

# 25. MVP Scope

The initial MVP should focus on the smallest complete
clinic workflow.

## MVP Modules

### Identity

- login
- logout
- user management
- clinic membership
- basic roles
- permissions

### Clinic

- clinic profile
- staff management
- basic settings

### Patient

- create patient
- view patient
- update patient
- patient search

### Appointment

- create appointment
- view appointments
- update appointment
- basic calendar

### Clinical

- create encounter
- view encounter
- clinical notes
- basic medical history

### AI

- AI assistant
- patient information retrieval
- clinical history summarization
- basic knowledge retrieval
- clinical note drafting

### Audit

- authentication events
- patient access
- clinical access
- important mutations
- AI tool execution

---

# 26. Explicitly Out of MVP Scope

Unless separately approved, the following are not part of
the initial MVP:

- autonomous diagnosis
- autonomous prescribing
- unrestricted AI actions
- arbitrary AI database access
- complex insurance processing
- advanced laboratory integration
- advanced pharmacy integration
- Billing (invoices, payments) — deferred, schema kept future-ready only.
- Notification domain (email/SMS reminders) — deferred.
- Doctor ratings
- hospital-scale interoperability
- fully autonomous clinical workflows
- multi-region active-active architecture
- large microservices architecture

These may be considered later.

---

# 27. Success Criteria

The MVP is successful when an authorized clinic user can:

1. Sign in securely.
2. Access the correct clinic.
3. Register a patient.
4. View the patient's permitted information.
5. Create an appointment.
6. Check the patient into a clinical workflow.
7. Create a clinical encounter.
8. Record a clinical note.
9. Ask the AI assistant about authorized information.
10. Generate an AI-assisted summary/draft.
11. Review AI-generated content.
12. Have important actions recorded in the audit system.

---

# 28. Non-Functional Goals

The following are architectural goals.

## Security

The system must apply defense-in-depth and least privilege.

---

## Privacy

The system should minimize unnecessary collection,
processing, transmission, and exposure of sensitive data.

---

## Reliability

Critical clinical workflows must fail safely.

---

## Scalability

The system should support horizontal scaling of stateless
application components.

---

## Maintainability

Domains must have clear boundaries.

---

## Testability

Business logic must be testable independently of infrastructure.

---

## Observability

Production failures and security events must be observable.

---

## AI Safety

AI must operate within explicit capabilities and authorization
boundaries.

---

# 29. Architectural Constraints

The following constraints are currently assumed:

- Monorepo architecture
- Nx workspace
- TypeScript
- Modular monolith for the initial backend
- PostgreSQL as primary relational database
- Redis for caching/temporary state where required
- private object storage for files
- asynchronous job processing
- centralized authentication and authorization
- tenant isolation
- controlled AI gateway
- controlled AI tools
- audit logging
- CI/CD
- automated testing

Specific cloud provider and individual infrastructure products
are not yet finalized.

---

# 30. Team Ownership

The initial four-person team is organized by domain ownership.

## Member A — Identity & Security

Owns:

- Identity
- Authentication
- Authorization
- Tenant security
- Roles
- Permissions
- Audit

---

## Member B — Patient & Clinical

Owns:

- Patient
- Clinical
- Encounter
- Clinical documentation
- Medical record workflows

---

## Member C — Operations

Owns:

- Doctor
- Appointment
- Calendar
- Check-in
- Queue
- Billing
- Notification

---

## Member D — AI Platform

Owns:

- AI Gateway
- Agent
- Context
- Memory
- Retrieval
- RAG
- Tools
- AI evaluation
- AI safety

---

# 31. Team Ownership Rules

Ownership does not mean isolated development.

All members are full-stack developers.

Each owner is responsible for:

- frontend
- backend
- database changes within their domain
- tests
- documentation
- observability
- security
- production readiness

Cross-domain changes require review from the affected domain owner.

---

# 32. AI Development Rules

Codex and other coding agents must follow the architecture.

AI coding agents must:

1. Read project instructions before coding.
2. Identify the affected domain.
3. Respect Nx module boundaries.
4. Inspect existing contracts before creating new ones.
5. Never bypass authorization.
6. Never access another domain's database directly.
7. Never introduce secrets into source code.
8. Add tests for new business behavior.
9. Explain architectural impact for cross-domain changes.
10. Avoid unnecessary refactoring outside the assigned scope.

---

# 33. Definition of Done

A feature is not considered complete merely because it works
locally.

A production-ready feature should satisfy applicable requirements:

- implementation complete
- authorization implemented
- tenant isolation verified
- validation implemented
- unit tests
- integration tests where required
- audit events where required
- error handling
- logging/observability
- documentation
- security review where applicable
- CI checks passing

---

# 34. Open Decisions

The following decisions remain intentionally open.

## Product

- final product name
- target market
- initial clinic size
- exact MVP boundaries
- patient-facing application scope

## Compliance

- target countries
- applicable healthcare regulations
- data residency requirements
- retention requirements

Data governance is an approved category-specific lifecycle boundary:
clinical history remains immutable; Product/Compliance must define and approve
the applicable retention, deletion/anonymization, export,
residency, audit, AI-data, and backup policies before policy-dependent
behavior is implemented. No regulatory requirement or policy value is
inferred by this document. Export and deletion are authorized workflows, and
AI audit uses shared audit metadata rather than mandatory raw prompt/response
retention.

## Infrastructure

- cloud provider
- deployment platform
- database hosting
- object storage provider
- queue technology
- observability platform

## AI

- primary LLM provider
- secondary/fallback provider
- embedding model
- vector database
- AI data retention policy
- model evaluation framework

## Security

- specific identity provider
- MFA policy
- authorization engine/implementation
- key management architecture
- security monitoring/SIEM

These decisions must be resolved before the relevant
production implementation begins.

---

# 35. Document Status

This document is **Draft v0.1**.

It is not yet a final technical specification.

Changes to the following areas require explicit architectural
review:

- tenant model
- authorization model
- clinical data model
- AI permissions
- data retention
- external data transmission
- domain boundaries

Authorization uses endpoint-specific least privilege with default deny. Each
operation requires the documented permission together with authenticated
tenant membership and applicable resource, relationship, location, and
clinical need-to-know checks.

Clinical Files are explicitly excluded from MVP. MVP accepts textual and
structured data only; file schema, upload/download APIs, object storage,
processing workers, and AI file ingestion are Post-MVP capabilities.
- production infrastructure
