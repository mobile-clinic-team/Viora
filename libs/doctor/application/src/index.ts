import type {
  DepartmentListQuery,
  DoctorListQuery,
  ShiftListQuery,
} from '../../contracts/src/index.ts';
import type { Department, Doctor, DoctorWorkingShift } from '../../domain/src/index.ts';
import type {
  DepartmentRepository,
  DoctorRepository,
  ShiftRepository,
} from '../../data-access/src/index.ts';
import type { RequestContext } from '../../../platform/context/src/index.ts';
import { authorizeResourceAccess } from '../../../platform/authorization/src/index.ts';

export type DoctorAction = 'doctor.list' | 'doctor.read' | 'doctor.shift.list';

export interface DoctorAuthorization {
  allows(input: { readonly action: DoctorAction; readonly context: RequestContext; readonly resourceId?: string }): boolean;
}

export interface DoctorApplicationDependencies {
  readonly departments: DepartmentRepository;
  readonly doctors: DoctorRepository;
  readonly shifts: ShiftRepository;
  readonly authorization: DoctorAuthorization;
}

export class DoctorApplicationError extends Error {
  public readonly code: 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR';

  public constructor(code: DoctorApplicationError['code']) {
    super(code);
    this.name = 'DoctorApplicationError';
    this.code = code;
  }
}

function tenantId(context: RequestContext): string {
  if (!context.actor?.userId || !context.tenant?.tenantId.trim()) {
    throw new DoctorApplicationError('FORBIDDEN');
  }
  return context.tenant.tenantId;
}

function authorize(
  dependencies: DoctorApplicationDependencies,
  context: RequestContext,
  action: DoctorAction,
  tenant: string,
  resourceId = tenant,
): void {
  const decision = authorizeResourceAccess({
    action,
    context,
    resource: { resourceId, tenantId: tenant },
    policy: () => dependencies.authorization.allows({ action, context, resourceId }),
  });
  if (!decision.allowed) throw new DoctorApplicationError('FORBIDDEN');
}

function query(input: { readonly limit?: number; readonly cursor?: string }): { readonly limit: number; readonly cursor?: string } {
  const limit = input.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (input.cursor !== undefined && !input.cursor.trim())) {
    throw new DoctorApplicationError('VALIDATION_ERROR');
  }
  return { limit, cursor: input.cursor };
}

export async function listDepartments(
  dependencies: DoctorApplicationDependencies,
  context: RequestContext,
  input: DepartmentListQuery,
): Promise<readonly Department[]> {
  const tenant = tenantId(context);
  authorize(dependencies, context, 'doctor.list', tenant);
  return dependencies.departments.listByTenant({ ...input, ...query(input), tenantId: tenant });
}

export async function listDoctors(
  dependencies: DoctorApplicationDependencies,
  context: RequestContext,
  input: DoctorListQuery,
): Promise<readonly Doctor[]> {
  const tenant = tenantId(context);
  authorize(dependencies, context, 'doctor.list', tenant);
  return dependencies.doctors.listByTenant({ ...input, ...query(input), tenantId: tenant });
}

export async function getDoctor(
  dependencies: DoctorApplicationDependencies,
  context: RequestContext,
  doctorId: string,
): Promise<Doctor> {
  const tenant = tenantId(context);
  if (!doctorId.trim()) throw new DoctorApplicationError('VALIDATION_ERROR');
  authorize(dependencies, context, 'doctor.read', tenant, doctorId);
  const doctor = await dependencies.doctors.findById({ tenantId: tenant, doctorId });
  if (!doctor) throw new DoctorApplicationError('NOT_FOUND');
  if (doctor.tenantId !== tenant) throw new DoctorApplicationError('FORBIDDEN');
  return doctor;
}

export async function listDoctorShifts(
  dependencies: DoctorApplicationDependencies,
  context: RequestContext,
  doctorId: string,
  input: ShiftListQuery,
): Promise<readonly DoctorWorkingShift[]> {
  const tenant = tenantId(context);
  if (!doctorId.trim()) throw new DoctorApplicationError('VALIDATION_ERROR');
  authorize(dependencies, context, 'doctor.shift.list', tenant, doctorId);
  const doctor = await dependencies.doctors.findById({ tenantId: tenant, doctorId });
  if (!doctor) throw new DoctorApplicationError('NOT_FOUND');
  if (doctor.tenantId !== tenant) throw new DoctorApplicationError('FORBIDDEN');
  return dependencies.shifts.listByDoctor({ ...input, ...query(input), tenantId: tenant, doctorId });
}
