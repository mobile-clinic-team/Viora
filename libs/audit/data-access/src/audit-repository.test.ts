import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuditEvent } from '../../contracts/src/index.ts';
import {
  AuditRepositoryInputError,
  decodeAuditCursor,
  encodeAuditCursor,
  type AuditAppendResult,
  type AuditEventRepository,
  PostgresAuditEventRepository,
  validateAuditListInput,
} from './index.ts';

const tenantAEvent: AuditEvent = {
  id: 'audit-a',
  tenantId: 'tenant-a',
  actorId: 'user-a',
  action: 'PATIENT_READ',
  resourceType: 'patient',
  resourceId: 'patient-a',
  result: 'SUCCESS',
  requestId: 'request-a',
  correlationId: 'correlation-a',
  metadata: {},
  createdAt: '2026-09-04T00:00:00.000Z',
};

const tenantBEvent: AuditEvent = {
  ...tenantAEvent,
  id: 'audit-b',
  tenantId: 'tenant-b',
  actorId: 'user-b',
  resourceId: 'patient-b',
};

class InMemoryAuditRepository implements AuditEventRepository {
  private readonly events: AuditEvent[] = [];

  async append(event: AuditEvent): Promise<AuditAppendResult> {
    const existing = this.events.find((candidate) => candidate.id === event.id);
    if (existing) {
      return {
        kind: JSON.stringify(existing) === JSON.stringify(event) ? 'REPLAY' : 'CONFLICT',
        event: existing,
      };
    }
    this.events.push(event);
    return { kind: 'APPENDED', event };
  }

  async listByTenant(input: { readonly tenantId: string; readonly limit: number; readonly cursor?: string }): Promise<readonly AuditEvent[]> {
    validateAuditListInput(input);
    const cursor = input.cursor === undefined ? undefined : decodeAuditCursor(input.cursor, input.tenantId);
    return this.events
      .filter((event) => event.tenantId === input.tenantId)
      .filter((event) => cursor === undefined || event.createdAt > cursor.createdAt || (event.createdAt === cursor.createdAt && event.id > cursor.eventId))
      .slice(0, input.limit);
  }
}

test('audit repository appends events and lists only the requested tenant', async () => {
  const repository = new InMemoryAuditRepository();
  assert.deepEqual(await repository.append(tenantAEvent), { kind: 'APPENDED', event: tenantAEvent });
  assert.deepEqual(await repository.append(tenantBEvent), { kind: 'APPENDED', event: tenantBEvent });

  assert.deepEqual(await repository.listByTenant({ tenantId: 'tenant-a', limit: 100 }), [tenantAEvent]);
  assert.deepEqual(await repository.listByTenant({ tenantId: 'tenant-b', limit: 100 }), [tenantBEvent]);
});

test('audit repository applies a bounded result limit', async () => {
  const repository = new InMemoryAuditRepository();
  await repository.append(tenantAEvent);
  await repository.append({ ...tenantAEvent, id: 'audit-a-2' });

  assert.deepEqual(await repository.listByTenant({ tenantId: 'tenant-a', limit: 1 }), [tenantAEvent]);
});

test('audit cursor is opaque, keyset-shaped, and tenant-bound', () => {
  const cursor = encodeAuditCursor({
    tenantId: 'tenant-a',
    createdAt: tenantAEvent.createdAt,
    eventId: tenantAEvent.id,
  });

  assert.match(cursor, /^[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeAuditCursor(cursor, 'tenant-a'), {
    tenantId: 'tenant-a',
    createdAt: tenantAEvent.createdAt,
    eventId: tenantAEvent.id,
  });
  assert.throws(
    () => decodeAuditCursor(cursor, 'tenant-b'),
    AuditRepositoryInputError,
  );
});

test('audit repository uses the cursor as a createdAt and eventId keyset', async () => {
  const repository = new InMemoryAuditRepository();
  const secondEvent = { ...tenantAEvent, id: 'audit-a-2' };
  await repository.append(tenantAEvent);
  await repository.append(secondEvent);

  const cursor = encodeAuditCursor({
    tenantId: 'tenant-a',
    createdAt: tenantAEvent.createdAt,
    eventId: tenantAEvent.id,
  });
  assert.deepEqual(await repository.listByTenant({ tenantId: 'tenant-a', limit: 100, cursor }), [secondEvent]);
});

test('audit cursor rejects malformed and non-opaque values', () => {
  assert.throws(
    () => decodeAuditCursor('not a cursor', 'tenant-a'),
    AuditRepositoryInputError,
  );
  assert.throws(
    () => decodeAuditCursor('abc', 'tenant-a'),
    AuditRepositoryInputError,
  );
});

test('audit repository replays identical events and conflicts on payload reuse', async () => {
  const repository = new InMemoryAuditRepository();
  await repository.append(tenantAEvent);

  assert.deepEqual(await repository.append(tenantAEvent), {
    kind: 'REPLAY',
    event: tenantAEvent,
  });
  assert.deepEqual(await repository.append({ ...tenantAEvent, action: 'PATIENT_PATCH' }), {
    kind: 'CONFLICT',
    event: tenantAEvent,
  });
});

test('repository validates list input defensively', () => {
  assert.throws(
    () => validateAuditListInput({ tenantId: ' ', limit: 10 }),
    AuditRepositoryInputError,
  );
  assert.throws(
    () => validateAuditListInput({ tenantId: 'tenant-a', limit: 101 }),
    AuditRepositoryInputError,
  );
});

const postgresRow = {
  id: 'audit-a', tenant_id: 'tenant-a', actor_id: 'user-a', action: 'PATIENT_READ',
  resource_type: 'patient', resource_id: 'patient-a', result: 'SUCCESS' as const,
  request_id: 'request-a', correlation_id: 'correlation-a', metadata: {},
  created_at: new Date('2026-09-04T00:00:00.000Z'),
};

test('PostgreSQL audit adapter uses parameterized SQL and preserves replay/conflict semantics', async () => {
  const calls: Array<{ text: string; values: readonly unknown[] }> = [];
  const database = {
    async query(text: string, values: readonly unknown[] = []) {
      calls.push({ text, values });
      if (text.startsWith('INSERT')) return { rows: [] };
      if (text.startsWith('SELECT') && text.includes('WHERE id')) return { rows: [postgresRow] };
      return { rows: [postgresRow] };
    },
  };
  const repository = new PostgresAuditEventRepository(database);

  assert.deepEqual(await repository.append(tenantAEvent), { kind: 'REPLAY', event: tenantAEvent });
  assert.deepEqual(await repository.append({ ...tenantAEvent, metadata: { z: true, a: 1 } }), { kind: 'CONFLICT', event: tenantAEvent });
  assert.deepEqual(await repository.append({ ...tenantAEvent, action: 'PATIENT_PATCH' }), { kind: 'CONFLICT', event: tenantAEvent });
  assert.deepEqual(await repository.listByTenant({ tenantId: 'tenant-a', limit: 10 }), [tenantAEvent]);
  assert.equal(calls.filter((call) => call.text.includes('ON CONFLICT')).length, 3);
  assert.equal(calls.at(-1)?.values[0], 'tenant-a');
  assert.match(calls.at(-1)?.text ?? '', /ORDER BY created_at ASC, id ASC/);
});
