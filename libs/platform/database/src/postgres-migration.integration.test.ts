import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { PostgresAuditEventRepository } from '../../../audit/data-access/src/index.ts';
import {
  createPostgresMigrationDatabase,
  loadMigrationFiles,
  runMigrations,
} from './index.ts';

const connectionString = process.env.DATABASE_URL;

test('runs the complete migration chain on PostgreSQL', { skip: !connectionString }, async () => {
  const database = createPostgresMigrationDatabase(connectionString!);
  try {
    await database.query('DROP SCHEMA public CASCADE');
    await database.query('CREATE SCHEMA public');

    const migrationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../database/migrations');
    const migrations = await loadMigrationFiles(migrationDirectory);
    const applied = await runMigrations(database, migrations);

    assert.deepEqual(applied.map(({ version }) => version), ['001', '002', '003', '004', '005']);
    const tables = await database.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
       AND table_name IN ('tenants', 'locations', 'users', 'memberships', 'idempotency_keys', 'audit_events')
       ORDER BY table_name`,
    );
    assert.deepEqual(tables.rows.map(({ table_name }) => table_name), [
      'audit_events',
      'idempotency_keys',
      'locations',
      'memberships',
      'tenants',
      'users',
    ]);

    const tenantId = '00000000-0000-0000-0000-000000000001';
    const otherTenantId = '00000000-0000-0000-0000-000000000002';
    const actorId = '00000000-0000-0000-0000-000000000011';
    const eventId = '00000000-0000-0000-0000-000000000021';
    await database.query(
      `INSERT INTO tenants (id, name, status, created_at, updated_at)
       VALUES ($1, 'Integration tenant', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
              ($2, 'Other tenant', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [tenantId, otherTenantId],
    );
    await database.query(
      `INSERT INTO users (id, email, status, created_at, updated_at)
       VALUES ($1, 'audit-integration@example.test', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [actorId],
    );

    const repository = new PostgresAuditEventRepository(database);
    const event = {
      id: eventId,
      tenantId,
      actorId,
      action: 'PATIENT_READ',
      resourceType: 'patient',
      resourceId: 'patient-1',
      result: 'SUCCESS' as const,
      requestId: 'request-1',
      correlationId: 'correlation-1',
      metadata: { source: 'integration' },
      createdAt: '2026-09-05T00:00:00.000Z',
    };
    assert.deepEqual((await repository.append(event)).kind, 'APPENDED');
    assert.deepEqual((await repository.append(event)).kind, 'REPLAY');
    assert.deepEqual((await repository.append({ ...event, action: 'PATIENT_PATCH' })).kind, 'CONFLICT');
    assert.deepEqual(await repository.listByTenant({ tenantId, limit: 10 }), [event]);
    await assert.rejects(
      repository.append({ ...event, tenantId: otherTenantId }),
      /audit event id is unavailable/,
    );
  } finally {
    await database.close();
  }
});
