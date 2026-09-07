import assert from 'node:assert/strict';
import test from 'node:test';
import { PostgresAiDraftRepository } from './index.ts';

const draft = {
  tenantId: '00000000-0000-0000-0000-000000000001',
  patientId: '00000000-0000-0000-0000-000000000002',
  encounterId: '00000000-0000-0000-0000-000000000003',
  createdBy: '00000000-0000-0000-0000-000000000004',
  draftType: 'CLINICAL_NOTE',
  content: { diagnosis: 'x', symptoms: 'y', clinicalNotes: 'z', treatmentPlan: 'w' },
  version: 1n,
  status: 'GENERATED' as const,
  approvedBy: null,
  approvedAt: null,
  rejectedBy: null,
  rejectedAt: null,
};

function db() {
  const calls: Array<{ sql: string; values: readonly unknown[] }> = [];
  return {
    calls,
    async query(sql: string, values: readonly unknown[] = []) {
      calls.push({ sql, values });
      return { rows: [] };
    },
  };
}

test('AI draft adapter uses parameterized SQL and tenant/OCC predicates', async () => {
  const database = db();
  const repository = new PostgresAiDraftRepository(database);
  await repository.findById({ tenantId: draft.tenantId, draftId: 'draft-1' });
  await repository.transition({ tenantId: draft.tenantId, draftId: 'draft-1', from: 'GENERATED', expectedVersion: 1n, to: 'REVIEWING', actorId: draft.createdBy, at: '2026-09-07T00:00:00.000Z' });
  assert.match(database.calls[0].sql, /WHERE tenant_id = \$1 AND id = \$2/);
  assert.match(database.calls[1].sql, /status = \$8::ai_draft_status AND version = \$9/);
  assert.deepEqual(database.calls[1].values.slice(-4), [draft.tenantId, 'draft-1', 'GENERATED', '1']);
  assert.ok(database.calls.every(({ sql }) => !sql.includes('UPDATE ai_drafts SET content')));
});

test('AI draft adapter rejects missing tenant and stale version inputs', async () => {
  const repository = new PostgresAiDraftRepository(db());
  await assert.rejects(repository.findById({ tenantId: ' ', draftId: 'draft-1' }), /tenantId is required/);
  await assert.rejects(
    repository.transition({ tenantId: draft.tenantId, draftId: 'draft-1', from: 'GENERATED', expectedVersion: 0n, to: 'REVIEWING', actorId: draft.createdBy, at: '2026-09-07T00:00:00.000Z' }),
    /expectedVersion must be positive/,
  );
});

