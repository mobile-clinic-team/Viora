import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  assertPatientTenantScope,
  PatientTenantScopeError,
  type Patient,
} from '../../domain/src/index.ts';
import type { PatientRepository } from './index.ts';

const patientA: Patient = {
  patientId: 'patient-a',
  tenantId: 'tenant-a',
  userId: null,
  medicalRecordNumber: 'MRN-A',
  fullName: 'Synthetic Patient A',
  dateOfBirth: '1990-01-01',
  sex: 'UNSPECIFIED',
  phone: '0000000000',
  email: 'patient-a@example.test',
  address: 'Synthetic address',
  emergencyContact: 'Synthetic contact',
  status: 'ACTIVE',
  version: 1n,
  createdAt: '2026-09-04T00:00:00.000Z',
  updatedAt: '2026-09-04T00:00:00.000Z',
};

class TenantScopedPatientRepository implements PatientRepository {
  public async findById(input: { readonly tenantId: string; readonly patientId: string }): Promise<Patient | null> {
    return input.tenantId === patientA.tenantId && input.patientId === patientA.patientId
      ? patientA
      : null;
  }

  public async findByMedicalRecordNumber(input: { readonly tenantId: string; readonly medicalRecordNumber: string }): Promise<Patient | null> {
    return input.tenantId === patientA.tenantId && input.medicalRecordNumber === patientA.medicalRecordNumber
      ? patientA
      : null;
  }

  public async listByTenant(input: { readonly tenantId: string; readonly limit: number }): Promise<readonly Patient[]> {
    return input.tenantId === patientA.tenantId && input.limit > 0 ? [patientA] : [];
  }

  public async create(input: Parameters<PatientRepository['create']>[0]): Promise<Patient> {
    return {
      ...input.patient,
      patientId: 'patient-created',
      tenantId: input.tenantId,
      version: 1n,
      createdAt: '2026-09-04T00:00:00.000Z',
      updatedAt: '2026-09-04T00:00:00.000Z',
    };
  }

  public async update(input: Parameters<PatientRepository['update']>[0]): Promise<Patient | null> {
    if (input.tenantId !== patientA.tenantId || input.patientId !== patientA.patientId) {
      return null;
    }
    return { ...patientA, ...input.changes, version: input.expectedVersion + 1n };
  }
}

test('accepts a Patient belonging to the requested tenant', () => {
  assert.doesNotThrow(() => assertPatientTenantScope(patientA, 'tenant-a'));
});

test('fails closed when a Patient belongs to another tenant', () => {
  assert.throws(
    () => assertPatientTenantScope(patientA, 'tenant-b'),
    PatientTenantScopeError,
  );
});

test('does not discover a Patient from another tenant through the repository port', async () => {
  const repository = new TenantScopedPatientRepository();

  assert.equal(
    await repository.findById({ tenantId: 'tenant-b', patientId: patientA.patientId }),
    null,
  );
  assert.deepEqual(await repository.listByTenant({ tenantId: 'tenant-b', limit: 20 }), []);
  assert.equal(
    await repository.update({
      tenantId: 'tenant-b',
      patientId: patientA.patientId,
      changes: { fullName: 'Other name' },
      expectedVersion: 1n,
    }),
    null,
  );
});
