import { strict as assert } from 'node:assert';
import test from 'node:test';
import { AuditValidationError, buildAuditEvent, buildAuditEventInput, emitAuditEvent, type AuditSink } from './index.ts';
import { createAuthenticatedRequestContext, createUnauthenticatedRequestContext } from '../../context/src/index.ts';

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

test('builds an audit input from authenticated request context', () => {
  const input = buildAuditEventInput(
    createAuthenticatedRequestContext({
      requestId: 'request-1',
      correlationId: 'correlation-1',
      userId: 'user-a',
      subject: 'subject-a',
      tenantId: 'tenant-a',
      membershipId: 'membership-a',
    }),
    {
      id: 'audit-2',
      action: 'PATIENT_READ',
      resourceType: 'patient',
      resourceId: 'patient-a',
      result: 'SUCCESS',
      metadata: { membershipId: 'membership-a' },
    },
  );

  assert.deepEqual(input, {
    id: 'audit-2',
    tenantId: 'tenant-a',
    actorId: 'user-a',
    action: 'PATIENT_READ',
    resourceType: 'patient',
    resourceId: 'patient-a',
    result: 'SUCCESS',
    requestId: 'request-1',
    correlationId: 'correlation-1',
    metadata: { membershipId: 'membership-a' },
  });
});

test('does not build an audit input without authenticated context', () => {
  assert.throws(
    () => buildAuditEventInput(
      createUnauthenticatedRequestContext('request-1', 'correlation-1'),
      {
        id: 'audit-3',
        action: 'PATIENT_READ',
        resourceType: 'patient',
        resourceId: 'patient-a',
        result: 'DENIED',
        metadata: {},
      },
    ),
    AuditValidationError,
  );
});
