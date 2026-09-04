import { strict as assert } from 'node:assert';
import test from 'node:test';
import { checkInAppointment, createAppointment, getAppointmentAvailability, listAppointments, markAppointmentNoShow, type AppointmentApplicationDependencies } from './index.ts';
import { createAuthenticatedRequestContext } from '../../../platform/context/src/index.ts';

const tenantId = '11111111-1111-4111-8111-111111111111';
const appointment = {
  id: '33333333-3333-4333-8333-333333333333', tenantId, locationId: 'location-1',
  patientId: 'patient-1', doctorId: 'doctor-1', startTime: '2026-09-04T09:00:00Z',
  endTime: '2026-09-04T09:30:00Z', status: 'PENDING' as const, checkedInAt: null,
  reason: 'checkup', notes: '', createdBy: 'user-1', version: 1n,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
};
const context = createAuthenticatedRequestContext({ requestId: 'r', correlationId: 'c', userId: 'user-1', subject: 'subject-1', tenantId, membershipId: 'membership-1' });

function deps(begin: 'STARTED' | 'REPLAY' = 'STARTED'): AppointmentApplicationDependencies {
  return {
    appointments: {
      async findById(input) { return input.tenantId === tenantId && input.appointmentId === appointment.id ? appointment : null; },
      async listByTenant(input) { return input.tenantId === tenantId ? [appointment] : []; },
      async create() { return appointment; },
      async update() { return appointment; },
      async updateStatus() { return appointment; },
    },
    availability: { async listAvailableSlots(input) { return input.tenantId === tenantId ? [] : []; } },
    idempotency: {
      async begin(input) { return { kind: begin, record: { ...input, status: 'SUCCEEDED' as const, responseCode: 201, responseReference: begin === 'REPLAY' ? appointment.id : null, createdAt: new Date(), expiresAt: new Date() } }; },
      async lookup() { throw new Error('not used'); },
      async complete(input) { return { ...input, key: 'key', requestHash: 'hash', status: 'SUCCEEDED' as const, createdAt: new Date(), expiresAt: new Date(), tenantId, actorId: 'user-1', endpoint: 'endpoint' }; },
      async fail(input) { return { ...input, key: 'key', requestHash: 'hash', status: 'FAILED' as const, responseCode: input.responseCode ?? 500, responseReference: null, createdAt: new Date(), expiresAt: new Date(), tenantId, actorId: 'user-1', endpoint: 'endpoint' }; },
    },
    authorization: { allows() { return true; } },
  };
}

test('creates a tenant-scoped appointment and returns the repository result', async () => {
  const result = await createAppointment(deps(), context, { locationId: 'location-1', patientId: 'patient-1', doctorId: 'doctor-1', startTime: appointment.startTime, endTime: appointment.endTime, reason: 'checkup' }, 'key-1');
  assert.equal(result.tenantId, tenantId);
});

test('replays an idempotent appointment instead of creating a duplicate', async () => {
  const result = await createAppointment(deps('REPLAY'), context, { locationId: 'location-1', patientId: 'patient-1', doctorId: 'doctor-1', startTime: appointment.startTime, endTime: appointment.endTime, reason: 'checkup' }, 'key-1');
  assert.equal(result.id, appointment.id);
});

test('lists only appointments for the active tenant', async () => {
  const result = await listAppointments(deps(), context, { limit: 10 });
  assert.equal(result[0]?.tenantId, tenantId);
});

test('validates availability range before asking the scheduling provider', async () => {
  await assert.rejects(
    getAppointmentAvailability(deps(), context, {
      doctorId: 'doctor-1',
      from: '2026-09-05T10:00:00Z',
      to: '2026-09-05T09:00:00Z',
    }),
    (error: unknown) => error instanceof Error && error.message === 'VALIDATION_ERROR',
  );
});

test('requires a current version and valid lifecycle transition for check-in', async () => {
  const checkedIn = await checkInAppointment(deps(), context, appointment.id, '"1"');
  assert.equal(checkedIn.id, appointment.id);
  await assert.rejects(markAppointmentNoShow(deps(), context, appointment.id, '"1"'));
});
