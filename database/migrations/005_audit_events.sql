-- AUD-001 / migration 005
-- Additive, transactional PostgreSQL migration for immutable audit evidence.

BEGIN;

CREATE TABLE audit_events (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
  actor_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (btrim(action) <> ''),
  resource_type TEXT NOT NULL CHECK (btrim(resource_type) <> ''),
  resource_id TEXT NOT NULL CHECK (btrim(resource_id) <> ''),
  result TEXT NOT NULL CHECK (result IN ('SUCCESS', 'DENIED', 'FAILURE')),
  request_id TEXT NOT NULL CHECK (btrim(request_id) <> ''),
  correlation_id VARCHAR(64) NOT NULL CHECK (btrim(correlation_id) <> ''),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX audit_events_tenant_created_id_idx
  ON audit_events (tenant_id, created_at, id);

CREATE INDEX audit_events_tenant_actor_created_idx
  ON audit_events (tenant_id, actor_id, created_at);

CREATE INDEX audit_events_tenant_correlation_idx
  ON audit_events (tenant_id, correlation_id);

CREATE FUNCTION reject_audit_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events are immutable';
END;
$$;

CREATE TRIGGER audit_events_immutable_trigger
BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_events
FOR EACH STATEMENT
EXECUTE FUNCTION reject_audit_event_mutation();

COMMIT;
