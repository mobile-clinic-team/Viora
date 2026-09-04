import assert from 'node:assert/strict';
import test from 'node:test';
import type { AuditEvent } from '../../contracts/src/index.ts';
import type { AuditEventRepository } from './index.ts';

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

  async append(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }

  async listByTenant(input: { readonly tenantId: string; readonly limit: number }): Promise<readonly AuditEvent[]> {
    return this.events
      .filter((event) => event.tenantId === input.tenantId)
      .slice(0, input.limit);
  }
}

test('audit repository appends events and lists only the requested tenant', async () => {
  const repository = new InMemoryAuditRepository();
  await repository.append(tenantAEvent);
  await repository.append(tenantBEvent);

  assert.deepEqual(await repository.listByTenant({ tenantId: 'tenant-a', limit: 100 }), [tenantAEvent]);
  assert.deepEqual(await repository.listByTenant({ tenantId: 'tenant-b', limit: 100 }), [tenantBEvent]);
});

test('audit repository applies a bounded result limit', async () => {
  const repository = new InMemoryAuditRepository();
  await repository.append(tenantAEvent);
  await repository.append({ ...tenantAEvent, id: 'audit-a-2' });

  assert.deepEqual(await repository.listByTenant({ tenantId: 'tenant-a', limit: 1 }), [tenantAEvent]);
});
