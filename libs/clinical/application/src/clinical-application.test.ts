import { strict as assert } from 'node:assert';
import test from 'node:test';
import { amendMedicalRecord, createInitialMedicalRecord, createEncounter, finalizeMedicalRecord, getEncounter, reviewMedicalRecord, ClinicalApplicationError, type ClinicalApplicationDependencies } from './index.ts';
import type { Encounter, ClinicalRecordWithVersion, MedicalRecord, MedicalRecordVersion } from '../../domain/src/index.ts';
import { createAuthenticatedRequestContext, createUnauthenticatedRequestContext } from '../../../platform/context/src/index.ts';

const tenantId = 'tenant-a';
const context = createAuthenticatedRequestContext({ requestId: 'r', correlationId: 'c', userId: 'doctor-a', subject: 's', tenantId, membershipId: 'm' });
const encounter: Encounter = { encounterId: 'encounter-a', tenantId, patientId: 'patient-a', appointmentId: null, doctorId: 'doctor-a', startedAt: '2026-09-04T09:00:00Z', endedAt: null, status: 'OPEN', createdAt: '2026-09-04T09:00:00Z', updatedAt: '2026-09-04T09:00:00Z' };
const record: MedicalRecord = { medicalRecordId: 'record-a', tenantId, patientId: 'patient-a', encounterId: 'encounter-a', status: 'DRAFT', currentVersion: 1n, createdAt: encounter.createdAt, updatedAt: encounter.updatedAt };
const version: MedicalRecordVersion = { versionId: 'version-a', medicalRecordId: record.medicalRecordId, version: 1n, diagnosis: 'routine', symptoms: 'none', clinicalNotes: 'note', treatmentPlan: 'follow-up', createdBy: 'doctor-a', amendmentReason: null, createdAt: encounter.createdAt };

function dependencies(begin: 'STARTED' | 'REPLAY_ENCOUNTER' | 'REPLAY_RECORD' | 'CONFLICT' = 'STARTED', status: MedicalRecord['status'] = 'DRAFT'): ClinicalApplicationDependencies {
  const currentRecord = { ...record, status, currentVersion: status === 'AMENDED' ? 2n : 1n };
  const currentVersion = { ...version, version: currentRecord.currentVersion, amendmentReason: status === 'AMENDED' ? 'correction' : null };
  return {
    encounters: {
      async create() { return encounter; },
      async findById(input) { return input.tenantId === tenantId && input.encounterId === encounter.encounterId ? encounter : null; },
    },
    records: {
      async createWithInitialVersion() { return { record, version }; },
      async findById(input) { return input.tenantId === tenantId && input.medicalRecordId === record.medicalRecordId ? currentRecord : null; },
      async findByEncounter(input) { return input.tenantId === tenantId && input.encounterId === encounter.encounterId ? currentRecord : null; },
      async findCurrentVersion(input) { return input.tenantId === tenantId && input.medicalRecordId === record.medicalRecordId ? currentVersion : null; },
      async transition(input) { return { ...currentRecord, status: input.to }; },
      async createAmendment() { return { record: { ...currentRecord, status: 'AMENDED', currentVersion: currentRecord.currentVersion + 1n }, version: { ...currentVersion, version: currentRecord.currentVersion + 1n, amendmentReason: 'correction' } }; },
    },
    idempotency: {
      async begin(input) { return { kind: begin === 'CONFLICT' ? 'CONFLICT' as const : begin.startsWith('REPLAY') ? 'REPLAY' as const : 'STARTED' as const, record: { ...input, status: 'SUCCEEDED' as const, responseCode: 201, responseReference: begin === 'REPLAY_ENCOUNTER' ? encounter.encounterId : begin === 'REPLAY_RECORD' ? record.medicalRecordId : null, createdAt: new Date(), expiresAt: new Date() } }; },
      async lookup() { throw new Error('not used'); },
      async complete(input) { return { ...input, key: 'key', requestHash: 'hash', status: 'SUCCEEDED' as const, createdAt: new Date(), expiresAt: new Date(), tenantId, actorId: 'doctor-a', endpoint: 'endpoint' }; },
      async fail(input) { return { ...input, key: 'key', requestHash: 'hash', status: 'FAILED' as const, responseCode: input.responseCode ?? 500, responseReference: null, createdAt: new Date(), expiresAt: new Date(), tenantId, actorId: 'doctor-a', endpoint: 'endpoint' }; },
    },
    authorization: { allows: () => true },
  };
}

const encounterInput = { patientId: 'patient-a', doctorId: 'doctor-a' };
const content = { diagnosis: 'routine', symptoms: 'none', clinicalNotes: 'note', treatmentPlan: 'follow-up' };

test('creates and replays a tenant-scoped encounter', async () => {
  const deps = dependencies();
  assert.equal((await createEncounter(deps, context, encounterInput, 'key-a')).encounterId, encounter.encounterId);
  assert.equal((await createEncounter(dependencies('REPLAY_ENCOUNTER'), context, encounterInput, 'key-a')).encounterId, encounter.encounterId);
});

test('rejects a conflicting encounter idempotency key', async () => {
  await assert.rejects(createEncounter(dependencies('CONFLICT'), context, encounterInput, 'key-a'), (error: unknown) => error instanceof ClinicalApplicationError && error.code === 'IDEMPOTENCY_CONFLICT');
});

test('fails closed without authenticated tenant context', async () => {
  await assert.rejects(getEncounter(dependencies(), createUnauthenticatedRequestContext('r', 'c'), encounter.encounterId), (error: unknown) => error instanceof ClinicalApplicationError && error.code === 'FORBIDDEN');
});

test('creates and replays the first draft medical record version', async () => {
  const created = await createInitialMedicalRecord(dependencies(), context, encounter.encounterId, content, 'key-a');
  assert.equal(created.record.status, 'DRAFT');
  assert.equal(created.version.version, 1n);
  const replay = await createInitialMedicalRecord(dependencies('REPLAY_RECORD'), context, encounter.encounterId, content, 'key-a');
  assert.equal(replay.record.medicalRecordId, record.medicalRecordId);
});

test('rejects empty clinical content and unknown fields', async () => {
  await assert.rejects(createInitialMedicalRecord(dependencies(), context, encounter.encounterId, { ...content, clinicalNotes: '' }, 'key-a'), (error: unknown) => error instanceof ClinicalApplicationError && error.code === 'VALIDATION_ERROR');
  await assert.rejects(createInitialMedicalRecord(dependencies(), context, encounter.encounterId, { ...content, extra: 'nope' } as typeof content, 'key-a'), (error: unknown) => error instanceof ClinicalApplicationError && error.code === 'VALIDATION_ERROR');
});

test('enforces DRAFT to IN_REVIEW to FINALIZED transitions', async () => {
  assert.equal((await reviewMedicalRecord(dependencies(), context, record.medicalRecordId, 'review-key')).status, 'IN_REVIEW');
  assert.equal((await finalizeMedicalRecord(dependencies('STARTED', 'IN_REVIEW'), context, record.medicalRecordId, 'finalize-key')).status, 'FINALIZED');
  await assert.rejects(reviewMedicalRecord(dependencies('STARTED', 'FINALIZED'), context, record.medicalRecordId, 'bad-key'), (error: unknown) => error instanceof ClinicalApplicationError && error.code === 'VALIDATION_ERROR');
});

test('creates an amendment version only from a finalized current version', async () => {
  const amended = await amendMedicalRecord(dependencies('STARTED', 'FINALIZED'), context, record.medicalRecordId, { ...content, amendmentReason: 'Corrected diagnosis' }, 'amend-key');
  assert.equal(amended.record.status, 'AMENDED');
  assert.equal(amended.version.version, 2n);
  await assert.rejects(amendMedicalRecord(dependencies(), context, record.medicalRecordId, { ...content, amendmentReason: 'reason' }, 'bad-key'), (error: unknown) => error instanceof ClinicalApplicationError && error.code === 'VALIDATION_ERROR');
});
