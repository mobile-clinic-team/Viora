# Database migrations

Migrations in this directory are reviewed PostgreSQL SQL files. They are
applied in numeric order by the future database deployment runner; this
repository does not yet include that runner or a PostgreSQL integration test
environment.

Migration `005_audit_events.sql` is intentionally limited to the approved
audit table, tenant/actor referential integrity, keyset-query indexes, and the
append-only database trigger. The application owns resource-reference
semantics, so audit events do not introduce foreign keys to Patient or
Clinical tables.

Before deployment, the database owner must validate clean-database execution,
dependency order, rollback/forward-fix behavior, permissions, and the
PostgreSQL adapter transaction boundary.
