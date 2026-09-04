-- AUD-001 foundation / migration 001
-- PostgreSQL 16 foundation extension required by scheduling constraints.

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

COMMIT;
