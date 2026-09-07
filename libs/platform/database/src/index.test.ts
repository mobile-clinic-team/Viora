import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, Pool } from 'pg';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  checksumMigration,
  createPostgresMigrationDatabase,
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
    if (sql.includes('SELECT version, checksum')) return { rows: this.applied as unknown as readonly Row[] };
    if (sql.startsWith('INSERT INTO schema_migrations')) {
      this.applied.push({ version: String(values?.[0]), checksum: String(values?.[1]) });
    }
    return { rows: [] };
  }
}

const migration = (version: string, sql: string) => ({ version, filename: `${version}_test.sql`, sql });

test('destructive PostgreSQL suite refuses DATABASE_URL without disposable opt-in before connecting', () => {
  const environment: NodeJS.ProcessEnv = { ...process.env, DATABASE_URL: 'postgresql://127.0.0.1:1/never_connect', VIORA_DISPOSABLE_DATABASE: '' };
  // The child is an independent runner, not a worker of this test process.
  delete environment.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types', '--test',
    fileURLToPath(new URL('./postgres-migration.integration.test.ts', import.meta.url)),
  ], {
    env: environment,
    encoding: 'utf8',
    timeout: 15_000,
  });
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stdout + result.stderr, /VIORA_DISPOSABLE_DATABASE=1/);
  assert.doesNotMatch(result.stdout + result.stderr, /ECONNREFUSED/);
});

test('migration adapter keeps transaction statements on one client and closes once', async (t) => {
  t.mock.method(Pool.prototype, 'query', async () => { throw new Error('pool.query cannot own a transaction'); });
  const connections: Client[] = [];
  const sessions: Client[] = [];
  const ended: Client[] = [];
  t.mock.method(Client.prototype, 'connect', async function (this: Client) { connections.push(this); });
  t.mock.method(Client.prototype, 'query', async function (this: Client) {
    sessions.push(this);
    return { rows: [] };
  });
  t.mock.method(Client.prototype, 'end', async function (this: Client) { ended.push(this); });
  const database = createPostgresMigrationDatabase('postgresql://localhost/viora_test');
  try {
    await runMigrations(database, [migration('001', 'SELECT 1;')]);
    assert.equal(connections.length, 1);
    assert.ok(sessions.length >= 6);
    assert.ok(sessions.every((session) => session === connections[0]));
  } finally {
    await database.close();
  }
  await Promise.all([database.close(), database.close()]);
  assert.deepEqual(ended, connections);
  await assert.rejects(database.query('SELECT 1'), /closed/);
});

test('migration adapter closes a failed connection without retrying it', async (t) => {
  const failure = new Error('synthetic connection failure');
  const connect = t.mock.method(Client.prototype, 'connect', async () => { throw failure; });
  const end = t.mock.method(Client.prototype, 'end', async () => {});
  const database = createPostgresMigrationDatabase('postgresql://localhost/viora_test');
  try {
    await assert.rejects(database.query('BEGIN'), (error) => error === failure);
    await assert.rejects(database.query('BEGIN'), (error) => error === failure);
    assert.equal(connect.mock.callCount(), 1);
  } finally {
    await database.close();
  }
  assert.equal(end.mock.callCount(), 1);
});

test('closing an unused migration adapter does not open a connection', async (t) => {
  const connect = t.mock.method(Client.prototype, 'connect', async () => {});
  const end = t.mock.method(Client.prototype, 'end', async () => {});
  const database = createPostgresMigrationDatabase('postgresql://localhost/viora_test');
  await Promise.all([database.close(), database.close()]);
  assert.equal(connect.mock.callCount(), 0);
  assert.equal(end.mock.callCount(), 1);
  await assert.rejects(database.query('SELECT 1'), /closed/);
});

test('migration adapter fails closed after a session error instead of reconnecting mid-transaction', async (t) => {
  let session: Client | undefined;
  const connect = t.mock.method(Client.prototype, 'connect', async function (this: Client) { session = this; });
  const query = t.mock.method(Client.prototype, 'query', async () => ({ rows: [] }));
  const end = t.mock.method(Client.prototype, 'end', async () => {});
  const database = createPostgresMigrationDatabase('postgresql://localhost/viora_test');
  try {
    await database.query('BEGIN');
    const failure = new Error('synthetic session loss');
    session!.emit('error', failure);
    await assert.rejects(database.query('COMMIT'), (error) => error === failure);
    assert.equal(connect.mock.callCount(), 1);
    assert.equal(query.mock.callCount(), 1);
  } finally {
    await database.close();
  }
  assert.equal(end.mock.callCount(), 1);
});

test('close during connection acquisition prevents a late query and ends the session once', async (t) => {
  let finishConnect!: () => void;
  const connecting = new Promise<void>((resolve) => { finishConnect = resolve; });
  t.mock.method(Client.prototype, 'connect', () => connecting);
  const query = t.mock.method(Client.prototype, 'query', async () => ({ rows: [] }));
  const end = t.mock.method(Client.prototype, 'end', async () => {});
  const database = createPostgresMigrationDatabase('postgresql://localhost/viora_test');
  const rejected = assert.rejects(database.query('BEGIN'), /closed/);
  const closing = database.close();
  finishConnect();
  await Promise.all([rejected, closing, database.close()]);
  assert.equal(query.mock.callCount(), 0);
  assert.equal(end.mock.callCount(), 1);
});

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
