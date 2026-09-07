import assert from 'node:assert/strict';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createAuthenticatedRequestContext } from '../../context/src/index.ts';
import { createAiDraft, reviewAiDraft, approveAiDraft } from '../../../ai/tools/src/clinical-draft-workflow.ts';
import { PostgresAuditEventRepository } from '../../../audit/data-access/src/index.ts';
import {
  PostgresAiConversationRepository,
  PostgresAiDraftRepository,
  PostgresAiMessageRepository,
  PostgresKnowledgeChunkRepository,
  PostgresKnowledgeDocumentRepository,
} from '../../../ai/data-access/src/index.ts';
import {
  createPostgresMigrationDatabase,
  loadMigrationFiles,
  runMigrations,
} from './index.ts';

const connectionString = process.env.DATABASE_URL;

function disposableDatabase() {
  // These tests intentionally reset public. Never use an application database.
  if (process.env.VIORA_DISPOSABLE_DATABASE !== '1') {
    throw new Error('PostgreSQL tests reset public; set VIORA_DISPOSABLE_DATABASE=1 only for a disposable test database');
  }
  return createPostgresMigrationDatabase(connectionString!);
}

test('runs the complete migration chain on PostgreSQL', { skip: !connectionString }, async () => {
  const database = disposableDatabase();
  try {
    await database.query('DROP SCHEMA public CASCADE');
    await database.query('CREATE SCHEMA public');

    const migrationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../database/migrations');
    const migrations = await loadMigrationFiles(migrationDirectory);
    const applied = await runMigrations(database, migrations);

    assert.deepEqual(applied.map(({ version }) => version), ['001', '002', '003', '004', '005', '006', '007', '008', '009', '010', '011', '012']);
    const tables = await database.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
       AND table_name IN ('tenants', 'locations', 'users', 'memberships', 'idempotency_keys', 'audit_events',
                          'outbox_events', 'patients', 'departments', 'doctors', 'doctor_working_shifts',
                          'appointments', 'encounters', 'medical_records', 'medical_record_versions', 'patient_allergies',
                          'ai_conversations', 'ai_messages', 'ai_drafts', 'knowledge_documents', 'knowledge_chunks')
       ORDER BY table_name`,
    );
    assert.deepEqual(tables.rows.map(({ table_name }) => table_name), [
      'ai_conversations',
      'ai_drafts',
      'ai_messages',
      'appointments',
      'audit_events',
      'departments',
      'doctor_working_shifts',
      'doctors',
      'encounters',
      'idempotency_keys',
      'knowledge_chunks',
      'knowledge_documents',
      'locations',
      'medical_record_versions',
      'medical_records',
      'memberships',
      'outbox_events',
      'patient_allergies',
      'patients',
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

    await database.query(
      `INSERT INTO patients
        (id, tenant_id, user_id, medical_record_number, full_name, date_of_birth,
         sex, phone, email, address, emergency_contact, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'MRN-AI-001', 'AI Integration Patient', '1990-01-01',
               'UNKNOWN', '0000000000', 'ai@example.test', 'test address',
               'test contact', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      ['00000000-0000-0000-0000-000000000031', tenantId, actorId],
    );
    const drafts = new PostgresAiDraftRepository(database);
    const context = createAuthenticatedRequestContext({
      requestId: 'integration-request', correlationId: 'integration-correlation',
      userId: actorId, subject: 'integration-subject', tenantId, membershipId: 'integration-membership',
    });
    const workflow = { drafts, authorization: { allows: () => true } };
    const createdDraft = await createAiDraft(workflow, context, {
      tenantId,
      patientId: '00000000-0000-0000-0000-000000000031',
      encounterId: null,
      createdBy: 'caller-value-must-not-be-trusted',
      draftType: 'CLINICAL_NOTE',
      content: { diagnosis: 'test', symptoms: 'test', clinicalNotes: 'test', treatmentPlan: 'test' },
    });
    assert.equal(createdDraft.version, 1n);
    assert.equal(createdDraft.createdBy, actorId);
    assert.ok(Number.isFinite(Date.parse(createdDraft.createdAt)));
    assert.equal(createdDraft.createdAt, createdDraft.updatedAt);
    assert.equal((await drafts.findById({ tenantId, draftId: createdDraft.id }))?.status, 'GENERATED');
    const reviewing = await reviewAiDraft(workflow, context, createdDraft.id);
    assert.equal(reviewing?.version, 2n);
    const approved = await approveAiDraft(workflow, context, createdDraft.id);
    assert.equal(approved?.approvedBy, actorId);
    assert.equal(await drafts.transition({
      tenantId, draftId: createdDraft.id, from: 'REVIEWING', expectedVersion: 2n,
      to: 'APPROVED', actorId, at: '2026-09-07T00:02:00.000Z',
    }), null);
    assert.equal(await drafts.findById({ tenantId: otherTenantId, draftId: createdDraft.id }), null);

    const conversations = new PostgresAiConversationRepository(database);
    const conversation = await conversations.create({ tenantId, userId: actorId, patientId: null, contextType: null, contextId: null, status: 'ACTIVE' });
    const messages = new PostgresAiMessageRepository(database);
    await messages.append({ tenantId, conversationId: conversation.id, role: 'USER', contentReference: 'ref://message-1' });
    assert.equal((await messages.listByConversation({ tenantId, conversationId: conversation.id, limit: 10 })).length, 1);

    const documents = new PostgresKnowledgeDocumentRepository(database);
    const document = await documents.create({ tenantId, title: 'Approved test document', source: 'integration', documentType: 'GUIDANCE', status: 'APPROVED' });
    const chunks = new PostgresKnowledgeChunkRepository(database);
    const embedding = Array.from({ length: 1536 }, () => 0);
    const chunk = await chunks.append({ tenantId, documentId: document.id, content: 'approved tenant knowledge', embedding, metadata: { source: 'test' } });
    assert.equal(chunk.tenantId, tenantId);
    assert.equal(chunk.documentId, document.id);
    assert.deepEqual(chunk.embedding, embedding);
    assert.equal(Object.hasOwn(chunk, 'tenant_id'), false);
    assert.equal(Object.hasOwn(chunk, 'document_id'), false);
    assert.equal(Object.hasOwn(chunk, 'created_at'), false);
    assert.equal((await chunks.searchByEmbedding({ tenantId, embedding, limit: 10 })).length, 1);
    assert.equal((await chunks.searchByEmbedding({ tenantId: otherTenantId, embedding, limit: 10 })).length, 0);
  } finally {
    await database.close();
  }
});

test('PostgreSQL migration upgrade, replay, checksum rejection and rollback preserve committed state', { skip: !connectionString }, async () => {
  const database = disposableDatabase();
  try {
    await database.query('DROP SCHEMA public CASCADE');
    await database.query('CREATE SCHEMA public');
    const migrationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../database/migrations');
    const migrations = await loadMigrationFiles(migrationDirectory);

    const baseline = await runMigrations(database, migrations.slice(0, 5));
    assert.deepEqual(baseline.map(({ version }) => version), ['001', '002', '003', '004', '005']);
    const tenantId = '00000000-0000-0000-0000-000000000099';
    await database.query(`INSERT INTO tenants (id, name, status, created_at, updated_at)
      VALUES ($1, 'Upgrade fixture', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, [tenantId]);
    const upgraded = await runMigrations(database, migrations);
    assert.equal(upgraded.length, 12);
    assert.deepEqual(await runMigrations(database, migrations), upgraded);
    assert.equal((await database.query('SELECT id FROM tenants WHERE id = $1', [tenantId])).rows.length, 1);

    await assert.rejects(runMigrations(database, [
      { ...migrations[0], sql: `${migrations[0].sql}\n-- synthetic checksum mismatch` },
      ...migrations.slice(1),
    ]), /checksum mismatch/);

    // Synthetic definitions exist only inside this rollback test, never on disk.
    // 013 succeeds; 014 fails. Both DDL and 013 history must roll back together.
    await assert.rejects(runMigrations(database, [
      ...migrations,
      { version: '013', filename: '013_rollback_probe.sql', sql: 'CREATE TABLE migration_rollback_probe (id integer);' },
      { version: '014', filename: '014_failure_probe.sql', sql: 'SELECT 1 / 0;' },
    ]), /division by zero/);
    const probe = await database.query<{ present: string | null }>("SELECT to_regclass('public.migration_rollback_probe') AS present");
    assert.equal(probe.rows[0].present, null);
    assert.equal((await database.query('SELECT version FROM schema_migrations')).rows.length, 12);
    assert.equal((await database.query('SELECT id FROM tenants WHERE id = $1', [tenantId])).rows.length, 1);
    assert.deepEqual(await runMigrations(database, migrations), upgraded);
  } finally {
    await database.close();
  }
});

test('PostgreSQL session stays pinned and close rolls back an unfinished transaction', { skip: !connectionString }, async () => {
  const database = disposableDatabase();
  const observer = disposableDatabase();
  try {
    const first = await database.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
    await database.query('BEGIN');
    await database.query('CREATE TABLE migration_uncommitted_probe (id integer)');
    await database.query('SELECT pg_advisory_xact_lock(830022)');
    assert.equal((await database.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0].pid, first.rows[0].pid);
    const blocked = await observer.query<{ acquired: boolean }>('SELECT pg_try_advisory_xact_lock(830022) AS acquired');
    assert.equal(blocked.rows[0].acquired, false);
    await database.close();
    assert.equal((await observer.query<{ present: string | null }>("SELECT to_regclass('public.migration_uncommitted_probe') AS present")).rows[0].present, null);
    assert.equal((await observer.query<{ acquired: boolean }>('SELECT pg_try_advisory_xact_lock(830022) AS acquired')).rows[0].acquired, true);
    await assert.rejects(database.query('SELECT 1'), /closed/);
  } finally {
    await database.close();
    await observer.close();
  }
});
