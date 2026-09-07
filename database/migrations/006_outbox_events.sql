-- PLAT-001 / migration 006
-- The persisted lifecycle follows the shared platform contract:
-- PENDING -> PROCESSING -> COMPLETED or FAILED.

CREATE TYPE outbox_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TABLE outbox_events (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
  actor_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  request_id TEXT NOT NULL CHECK (btrim(request_id) <> ''),
  correlation_id VARCHAR(64) NOT NULL CHECK (btrim(correlation_id) <> ''),
  event_type TEXT NOT NULL CHECK (btrim(event_type) <> ''),
  aggregate_type TEXT NOT NULL CHECK (btrim(aggregate_type) <> ''),
  aggregate_id TEXT NOT NULL CHECK (btrim(aggregate_id) <> ''),
  payload JSONB NOT NULL,
  status outbox_status NOT NULL DEFAULT 'PENDING',
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  available_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMPTZ
);

CREATE INDEX outbox_events_claim_idx
  ON outbox_events (status, available_at, created_at, id);

CREATE INDEX outbox_events_tenant_created_idx
  ON outbox_events (tenant_id, created_at, id);

