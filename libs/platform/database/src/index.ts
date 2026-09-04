import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface QueryResult<Row extends Record<string, unknown> = Record<string, unknown>> {
  readonly rows: readonly Row[];
}

export interface MigrationDatabase {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>>;
}

export interface MigrationDefinition {
  readonly version: string;
  readonly filename: string;
  readonly sql: string;
}

export interface AppliedMigration {
  readonly version: string;
  readonly checksum: string;
}

const MIGRATION_LOCK_KEY = 830021;

export function checksumMigration(sql: string): string {
  return createHash('sha256').update(sql, 'utf8').digest('hex');
}

export async function loadMigrationFiles(directory: string): Promise<MigrationDefinition[]> {
  const names = (await readdir(directory))
    .filter((name) => /^\d+_[a-z0-9_-]+\.sql$/i.test(name))
    .sort((left, right) => {
      const leftVersion = Number(left.match(/^\d+/)?.[0]);
      const rightVersion = Number(right.match(/^\d+/)?.[0]);
      return leftVersion - rightVersion || left.localeCompare(right);
    });

  const migrations: MigrationDefinition[] = [];
  for (const filename of names) {
    const version = filename.match(/^(\d+)_/)?.[1];
    if (!version) continue;
    const sql = await readFile(join(directory, filename), 'utf8');
    if (!sql.trim()) throw new Error(`migration ${filename} is empty`);
    migrations.push({ version, filename, sql });
  }
  return migrations;
}

export async function runMigrations(
  database: MigrationDatabase,
  migrations: readonly MigrationDefinition[],
): Promise<readonly AppliedMigration[]> {
  const ordered = [...migrations].sort((left, right) => Number(left.version) - Number(right.version));
  const versions = new Set<string>();
  for (const migration of ordered) {
    if (versions.has(migration.version)) throw new Error(`duplicate migration version ${migration.version}`);
    versions.add(migration.version);
  }

  await database.query('BEGIN');
  try {
    await database.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_KEY]);
    await database.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        checksum TEXT NOT NULL
      )
    `);

    const appliedResult = await database.query<{ version: string; checksum: string }>(
      'SELECT version, checksum FROM schema_migrations ORDER BY version',
    );
    const applied = new Map(appliedResult.rows.map((row) => [row.version, row.checksum]));

    for (const migration of ordered) {
      const checksum = checksumMigration(migration.sql);
      const existing = applied.get(migration.version);
      if (existing !== undefined) {
        if (existing !== checksum) {
          throw new Error(`checksum mismatch for migration ${migration.version}`);
        }
        continue;
      }

      await database.query(migration.sql);
      await database.query(
        'INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)',
        [migration.version, checksum],
      );
      applied.set(migration.version, checksum);
    }

    await database.query('COMMIT');
    return [...applied.entries()].map(([version, checksum]) => ({ version, checksum }));
  } catch (error) {
    await database.query('ROLLBACK');
    throw error;
  }
}

export { MIGRATION_LOCK_KEY };
