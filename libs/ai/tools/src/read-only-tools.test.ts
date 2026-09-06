import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthenticatedRequestContext } from '../../../platform/context/src/index.ts';
import { createReadOnlyPatientTool, createReadOnlyRecentEncountersTool } from './read-only-tools.ts';

const context = createAuthenticatedRequestContext({
  requestId: 'request-read', correlationId: 'correlation-read', userId: 'user-a', subject: 'subject-a',
  tenantId: 'tenant-a', membershipId: 'membership-a',
});

const patient = {
  patientId: 'patient-a', tenantId: 'tenant-a', userId: null, medicalRecordNumber: 'MRN-1', fullName: 'A',
  dateOfBirth: '2000-01-01', sex: 'F', phone: 'private', email: 'private', address: 'private',
  emergencyContact: 'private', status: 'ACTIVE', version: 1n, createdAt: '2026-01-01', updatedAt: '2026-01-01',
};

const encounter = {
  encounterId: 'encounter-a', tenantId: 'tenant-a', patientId: 'patient-a', appointmentId: null, doctorId: 'doctor-a',
  startedAt: '2026-01-01T10:00:00Z', endedAt: null, status: 'OPEN', createdAt: '2026-01-01', updatedAt: '2026-01-01',
} as const;

function loaders() {
  return {
    async getPatient() { return patient; },
    async listEncounters() { return [encounter, { ...encounter, encounterId: 'encounter-b', tenantId: 'tenant-b' }]; },
  };
}

test('get_patient returns minimum necessary fields only', async () => {
  const tool = createReadOnlyPatientTool(loaders());
  const output = await tool.execute({ patientId: ' patient-a ' }, context);
  assert.deepEqual(output, { patientId: 'patient-a', medicalRecordNumber: 'MRN-1', fullName: 'A', dateOfBirth: '2000-01-01', sex: 'F', status: 'ACTIVE' });
  assert.equal('phone' in output, false);
});

test('get_recent_encounters filters tenant and bounds results', async () => {
  const tool = createReadOnlyRecentEncountersTool(loaders());
  const output = await tool.execute({ patientId: 'patient-a', limit: 20 }, context);
  assert.deepEqual(output, [{ encounterId: 'encounter-a', patientId: 'patient-a', doctorId: 'doctor-a', startedAt: '2026-01-01T10:00:00Z', endedAt: null, status: 'OPEN' }]);
});

test('read-only tools reject malformed or excessive input', () => {
  const patientTool = createReadOnlyPatientTool(loaders());
  const encounterTool = createReadOnlyRecentEncountersTool(loaders());
  assert.equal(patientTool.validateInput({ patientId: 'x', extra: true }), false);
  assert.equal(encounterTool.validateInput({ patientId: 'x', limit: 21 }), false);
});
