import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationPath = new URL('./005_audit_events.sql', import.meta.url);

test('migration 005 defines tenant-scoped immutable audit evidence', async () => {
  const sql = await readFile(migrationPath, 'utf8');

  for (const fragment of [
    'CREATE TABLE audit_events',
    'id UUID PRIMARY KEY',
    'tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT',
    'actor_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT',
    'correlation_id TEXT NOT NULL',
    "result IN ('SUCCESS', 'DENIED', 'FAILURE')",
    "metadata JSONB NOT NULL DEFAULT '{}'::jsonb",
    'audit_events (tenant_id, created_at, id)',
    'BEFORE UPDATE OR DELETE OR TRUNCATE ON audit_events',
  ]) {
    assert.match(sql, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('migration 005 is transactional and does not add resource foreign keys', async () => {
  const sql = await readFile(migrationPath, 'utf8');

  assert.match(sql, /BEGIN;[\s\S]*COMMIT;\s*$/);
  assert.doesNotMatch(sql, /REFERENCES\s+patients|REFERENCES\s+medical_records/i);
});
