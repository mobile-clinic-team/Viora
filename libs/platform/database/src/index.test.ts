import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checksumMigration,
  MIGRATION_LOCK_KEY,
  runMigrations,
  type MigrationDatabase,
} from './index.ts';

class FakeDatabase implements MigrationDatabase {
  public readonly calls: Array<{ sql: string; values?: readonly unknown[] }> = [];
  public applied: Array<{ version: string; checksum: string }> = [];

  public async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<{ rows: readonly Row[] }> {
    this.calls.push({ sql, values });
    if (sql.includes('SELECT version, checksum')) return { rows: this.applied as readonly Row[] };
    if (sql.startsWith('INSERT INTO schema_migrations')) {
      this.applied.push({ version: String(values?.[0]), checksum: String(values?.[1]) });
    }
    return { rows: [] };
  }
}

const migration = (version: string, sql: string) => ({ version, filename: `${version}_test.sql`, sql });

test('runs migrations in order under one transaction and records checksums', async () => {
  const database = new FakeDatabase();
  const migrations = [migration('002', 'CREATE TABLE locations (id UUID);'), migration('001', 'CREATE EXTENSION btree_gist;')];

  await runMigrations(database, migrations);

  assert.equal(database.calls[0].sql, 'BEGIN');
  assert.deepEqual(database.calls[1], { sql: 'SELECT pg_advisory_xact_lock($1)', values: [MIGRATION_LOCK_KEY] });
  assert.ok(database.calls.findIndex((call) => call.sql === migrations[1].sql) < database.calls.findIndex((call) => call.sql === migrations[0].sql));
  assert.equal(database.calls.at(-1)?.sql, 'COMMIT');
  assert.equal(database.applied.length, 2);
  assert.equal(database.applied[0].checksum, checksumMigration(migrations[1].sql));
});

test('reruns applied migrations without executing SQL again', async () => {
  const database = new FakeDatabase();
  const first = migration('001', 'CREATE EXTENSION btree_gist;');
  await runMigrations(database, [first]);
  const before = database.calls.length;
  await runMigrations(database, [first]);

  assert.equal(database.calls.slice(before).filter((call) => call.sql === first.sql).length, 0);
});

test('rolls back when a recorded checksum differs', async () => {
  const database = new FakeDatabase();
  const first = migration('001', 'CREATE EXTENSION btree_gist;');
  await runMigrations(database, [first]);
  const before = database.calls.length;

  await assert.rejects(() => runMigrations(database, [migration('001', 'changed;')]), /checksum mismatch/);
  assert.equal(database.calls.slice(before).at(-1)?.sql, 'ROLLBACK');
});

test('rejects migrations that try to manage their own transaction', async () => {
  const database = new FakeDatabase();

  await assert.rejects(
    () => runMigrations(database, [migration('005', 'BEGIN; CREATE TABLE audit_events (id UUID); COMMIT;')]),
    /runner owns the transaction/,
  );
  assert.equal(database.calls.at(-1)?.sql, 'ROLLBACK');
});
