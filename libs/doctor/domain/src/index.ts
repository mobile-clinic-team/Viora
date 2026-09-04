import type {
  DepartmentStatus,
  DoctorStatus,
  ShiftStatus,
} from '../../contracts/src/index.ts';

export interface Department {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly description: string;
  readonly status: DepartmentStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Doctor {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  readonly departmentId: string;
  readonly locationId: string;
  readonly licenseNumber: string;
  readonly displayName: string;
  readonly specialization: string;
  readonly bio: string;
  readonly status: DoctorStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DoctorWorkingShift {
  readonly id: string;
  readonly tenantId: string;
  readonly doctorId: string;
  readonly locationId: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly status: ShiftStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export class DoctorTenantScopeError extends Error {
  public constructor() {
    super('doctor resource does not belong to the requested tenant');
    this.name = 'DoctorTenantScopeError';
  }
}

export function assertDoctorTenantScope(
  resource: { readonly tenantId: string },
  tenantId: string,
): void {
  if (!tenantId.trim() || resource.tenantId !== tenantId) {
    throw new DoctorTenantScopeError();
  }
}

export function assertShiftTimeRange(startTime: string, endTime: string): void {
  const start = Date.parse(startTime);
  const end = Date.parse(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new Error('shift start_time must be before end_time');
  }
}
