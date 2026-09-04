import { strict as assert } from 'node:assert';
import test from 'node:test';
import { handleCreatePatient, handleGetPatient, handleListPatients, handlePatchPatient } from './patient-api.ts';
import { createAuthenticatedRequestContext } from '../../../libs/platform/context/src/index.ts';
import type { PatientApiDependencies } from './patient-api.ts';
import type { Patient } from '../../../libs/patient/domain/src/index.ts';

const context = createAuthenticatedRequestContext({
  requestId: 'request-a', correlationId: 'correlation-a', userId: 'user-a',
  subject: 'subject-a', tenantId: 'tenant-a', membershipId: 'membership-a',
});

const patient: Patient = {
  patientId: 'patient-a', tenantId: 'tenant-a', userId: null,
  medicalRecordNumber: 'MRN-A', fullName: 'Synthetic Patient', dateOfBirth: '1990-01-01',
  sex: 'UNSPECIFIED', phone: '0000000000', email: 'patient@example.test',
  address: 'Synthetic address', emergencyContact: 'Synthetic contact', status: 'ACTIVE',
  version: 1n, createdAt: '2026-09-04T00:00:00.000Z', updatedAt: '2026-09-04T00:00:00.000Z',
};

function dependencies(): PatientApiDependencies {
  return {
    patients: {
      async findById(input) { return input.tenantId === patient.tenantId && input.patientId === patient.patientId ? patient : null; },
      async findByMedicalRecordNumber() { return null; },
      async listByTenant() { return [patient]; },
      async create() { return patient; },
      async update() { return patient; },
    },
    idempotency: {
      async lookup() { return { kind: 'NEW' as const }; },
      async begin() { throw new Error('not used by this test'); },
      async complete() { throw new Error('not used by this test'); },
      async fail() { throw new Error('not used by this test'); },
    },
    authorization: { allows: () => true },
    present(value) { return { patientId: value.patientId, fullName: value.fullName }; },
  };
}

test('returns an ETag and uses the composition-root patient presenter', async () => {
  const response = await handleGetPatient(dependencies(), context, 'patient-a');
  assert.deepEqual(response, {
    status: 200,
    body: { patientId: 'patient-a', fullName: 'Synthetic Patient' },
    etag: '"1"',
  });
});

test('maps a stale patch to precondition failed', async () => {
  const response = await handlePatchPatient(dependencies(), context, 'patient-a', { fullName: 'Updated' }, '"2"');
  assert.deepEqual(response, { status: 412, body: { code: 'PRECONDITION_FAILED' } });
});

test('creates a patient through the composition boundary with an ETag', async () => {
  const deps = dependencies();
  deps.idempotency.begin = async (input) => ({
    kind: 'STARTED' as const,
    record: { ...input, status: 'PROCESSING' as const, responseCode: null, responseReference: null, createdAt: new Date(), expiresAt: new Date() },
  });
  deps.idempotency.complete = async (input) => ({
    ...input, key: 'key-a', requestHash: 'hash', status: 'SUCCEEDED' as const,
    createdAt: new Date(), expiresAt: new Date(), tenantId: patient.tenantId, actorId: context.actor!.userId, endpoint: 'POST /api/v1/patients',
  });
  const response = await handleCreatePatient(deps, context, {
    medicalRecordNumber: 'MRN-C', fullName: 'Created Patient', dateOfBirth: '1991-01-01',
    sex: 'UNSPECIFIED', phone: '0000000001', email: 'created@example.test', address: 'Address',
    emergencyContact: 'Contact', status: 'ACTIVE',
  }, 'key-a');
  assert.deepEqual(response, { status: 201, body: { patientId: 'patient-a', fullName: 'Synthetic Patient' }, etag: '"1"' });
});

test('lists patients through the presenter without exposing the domain object', async () => {
  const response = await handleListPatients(dependencies(), context, { fullName: 'Synthetic', limit: 10 });
  assert.deepEqual(response, { status: 200, body: [{ patientId: 'patient-a', fullName: 'Synthetic Patient' }] });
});
