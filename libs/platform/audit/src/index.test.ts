import { strict as assert } from 'node:assert';
import test from 'node:test';
import { AuditValidationError, buildAuditEvent, emitAuditEvent, type AuditSink } from './index.ts';

const input = {
  id: 'audit-1', tenantId: 'tenant-a', actorId: 'actor-a', action: 'PATIENT_READ', resourceType: 'patient', resourceId: 'patient-a',
  result: 'SUCCESS' as const, requestId: 'request-a', correlationId: 'correlation-a', metadata: { field: 'summary' },
};

test('builds a metadata-first audit event without clinical payload', () => {
  const event = buildAuditEvent(input, new Date('2026-09-04T00:00:00.000Z'));
  assert.equal(event.createdAt, '2026-09-04T00:00:00.000Z');
  assert.deepEqual(event.metadata, { field: 'summary' });
});

test('rejects missing identity and invalid results', () => {
  assert.throws(() => buildAuditEvent({ ...input, tenantId: ' ' }), AuditValidationError);
  assert.throws(() => buildAuditEvent({ ...input, result: 'UNKNOWN' as never }), AuditValidationError);
});

test('emits only validated events through the sink', async () => {
  const events: unknown[] = [];
  const sink: AuditSink = { async append(event) { events.push(event); } };
  const event = await emitAuditEvent(sink, input);
  assert.equal(events[0], event);
});
