export type DoctorStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type DepartmentStatus = 'ACTIVE' | 'INACTIVE';
export type ShiftStatus = 'ACTIVE' | 'CANCELLED';

export interface DepartmentReference {
  readonly departmentId: string;
  readonly tenantId: string;
}

export interface DoctorReference {
  readonly doctorId: string;
  readonly tenantId: string;
}

export interface DepartmentListQuery {
  readonly search?: string;
  readonly status?: DepartmentStatus;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface DoctorListQuery {
  readonly departmentId?: string;
  readonly locationId?: string;
  readonly status?: DoctorStatus;
  readonly search?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface ShiftListQuery {
  readonly from?: string;
  readonly to?: string;
  readonly locationId?: string;
  readonly status?: ShiftStatus;
  readonly limit?: number;
  readonly cursor?: string;
}
