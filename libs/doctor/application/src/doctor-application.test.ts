import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  getDoctor,
  listDoctorShifts,
  listDoctors,
  type DoctorApplicationDependencies,
} from './index.ts';
import { createAuthenticatedRequestContext } from '../../../platform/context/src/index.ts';

const tenantId = '11111111-1111-4111-8111-111111111111';
const otherTenantId = '22222222-2222-4222-8222-222222222222';
const doctorId = '33333333-3333-4333-8333-333333333333';
const context = createAuthenticatedRequestContext({
  requestId: 'request-1',
  correlationId: 'correlation-1',
  userId: 'user-1',
  subject: 'subject-1',
  tenantId,
  membershipId: 'membership-1',
});
const doctor = {
  id: doctorId,
  tenantId,
  userId: 'user-doctor',
  departmentId: 'department-1',
  locationId: 'location-1',
  licenseNumber: 'license-1',
  displayName: 'Dr. Example',
  specialization: 'General Medicine',
  bio: '',
  status: 'ACTIVE' as const,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function deps(): DoctorApplicationDependencies {
  return {
    departments: { async listByTenant() { return []; } },
    doctors: {
      async findById(input) { return input.tenantId === tenantId && input.doctorId === doctorId ? doctor : null; },
      async listByTenant(input) { return input.tenantId === tenantId ? [doctor] : []; },
    },
    shifts: { async listByDoctor(input) { return input.tenantId === tenantId ? [] : []; } },
    authorization: { allows() { return true; } },
  };
}

test('lists doctors only inside the active tenant', async () => {
  const result = await listDoctors(deps(), context, { limit: 10 });
  assert.equal(result.length, 1);
  assert.equal(result[0]?.tenantId, tenantId);
});

test('rejects a substituted cross-tenant doctor identifier', async () => {
  await assert.rejects(
    getDoctor(deps(), context, otherTenantId),
    (error: unknown) => error instanceof Error && error.message === 'NOT_FOUND',
  );
});

test('requires an authorized tenant context for shift access', async () => {
  const denied: DoctorApplicationDependencies = {
    ...deps(),
    authorization: { allows() { return false; } },
  };
  await assert.rejects(
    listDoctorShifts(denied, context, doctorId, {}),
    (error: unknown) => error instanceof Error && error.message === 'FORBIDDEN',
  );
});
