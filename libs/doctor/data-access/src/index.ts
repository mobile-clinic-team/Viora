import type {
  DepartmentListQuery,
  DoctorListQuery,
  ShiftListQuery,
} from '../../contracts/src/index.ts';
import type {
  Department,
  Doctor,
  DoctorWorkingShift,
} from '../../domain/src/index.ts';

export interface DepartmentRepository {
  listByTenant(input: DepartmentListQuery & { readonly tenantId: string }): Promise<readonly Department[]>;
}

export interface DoctorRepository {
  findById(input: { readonly tenantId: string; readonly doctorId: string }): Promise<Doctor | null>;
  listByTenant(input: DoctorListQuery & { readonly tenantId: string }): Promise<readonly Doctor[]>;
}

export interface ShiftRepository {
  listByDoctor(input: ShiftListQuery & { readonly tenantId: string; readonly doctorId: string }): Promise<readonly DoctorWorkingShift[]>;
}
