-- AUD-001 foundation / migration 004
-- Retry identity. Payload comparison and replay/conflict mapping stay in the repository.

CREATE TYPE idempotency_status AS ENUM ('PROCESSING', 'SUCCEEDED', 'FAILED');

CREATE TABLE idempotency_keys (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
  actor_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  endpoint TEXT NOT NULL,
  key VARCHAR(255) NOT NULL,
  request_hash VARCHAR(64) NOT NULL,
  status idempotency_status NOT NULL,
  response_code INTEGER,
  response_reference TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT idempotency_keys_identity_key UNIQUE (tenant_id, actor_id, endpoint, key),
  CONSTRAINT idempotency_keys_hash_format CHECK (request_hash ~ '^[0-9a-f]{64}$')
);
