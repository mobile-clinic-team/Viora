import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
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
  } finally {
    await database.close();
  }
});
