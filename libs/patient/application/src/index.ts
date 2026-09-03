import type {
  PatientCreateRequest,
  PatientListQuery,
  PatientPatchRequest,
} from '../../contracts/src/index.ts';
import type {
  Patient,
  PatientCreate,
  PatientProfileChanges,
} from '../../domain/src/index.ts';
import type { PatientRepository } from '../../data-access/src/index.ts';
import type { RequestContext } from '../../../platform/context/src/index.ts';
import {
  authorizeResourceAccess,
} from '../../../platform/authorization/src/index.ts';
import {
  assertValidIdempotencyKey,
  hashPayload,
  type IdempotencyStore,
} from '../../../platform/idempotency/src/index.ts';

export type PatientAction =
  | 'patient.create'
  | 'patient.read'
  | 'patient.update'
  | 'patient.list';

export interface PatientAuthorization {
  allows(input: {
    readonly action: PatientAction;
    readonly context: RequestContext;
    readonly patient?: Patient;
  }): boolean;
}

export interface PatientApplicationDependencies {
  readonly patients: PatientRepository;
  readonly idempotency: IdempotencyStore;
  readonly authorization: PatientAuthorization;
}

export class PatientApplicationError extends Error {
  public readonly code:
    | 'FORBIDDEN'
    | 'IDEMPOTENCY_CONFLICT'
    | 'NOT_FOUND'
    | 'PRECONDITION_FAILED'
    | 'VALIDATION_ERROR';

  public constructor(code: PatientApplicationError['code']) {
    super(code);
    this.name = 'PatientApplicationError';
    this.code = code;
  }
}

const createFields = [
  'userId',
  'medicalRecordNumber',
  'fullName',
  'dateOfBirth',
  'sex',
  'phone',
  'email',
  'address',
  'emergencyContact',
  'status',
] as const;

const patchFields = [
  'fullName',
  'dateOfBirth',
  'sex',
  'phone',
  'email',
  'address',
  'emergencyContact',
  'status',
] as const;

const listFields = [
  'medicalRecordNumber',
  'fullName',
  'dateOfBirth',
  'phone',
  'email',
  'limit',
  'cursor',
] as const;

function requireTenant(context: RequestContext): string {
  if (!context.tenant?.tenantId || !context.actor?.userId) {
    throw new PatientApplicationError('FORBIDDEN');
  }
  return context.tenant.tenantId;
}

function authorize(
  dependencies: PatientApplicationDependencies,
  context: RequestContext,
  action: PatientAction,
  tenantId: string,
  patient?: Patient,
): void {
  const decision = authorizeResourceAccess({
    action,
    context,
    resource: { resourceId: patient?.patientId ?? tenantId, tenantId },
    policy: () => dependencies.authorization.allows({ action, context, patient }),
  });
  if (!decision.allowed) throw new PatientApplicationError('FORBIDDEN');
}

function requirePlainObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new PatientApplicationError('VALIDATION_ERROR');
  }
  return value as Record<string, unknown>;
}

function assertOnlyFields(input: Record<string, unknown>, fields: readonly string[]): void {
  if (Object.keys(input).some((field) => !fields.includes(field))) {
    throw new PatientApplicationError('VALIDATION_ERROR');
  }
}

function requiredString(input: Record<string, unknown>, field: string): string {
  const value = input[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new PatientApplicationError('VALIDATION_ERROR');
  }
  return value.trim();
}

function optionalString(input: Record<string, unknown>, field: string): string | undefined {
  const value = input[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !value.trim()) {
    throw new PatientApplicationError('VALIDATION_ERROR');
  }
  return value.trim();
}

function parseCreate(input: PatientCreateRequest): PatientCreate {
  const body = requirePlainObject(input);
  assertOnlyFields(body, createFields);
  if (body.userId !== undefined && body.userId !== null && (typeof body.userId !== 'string' || !body.userId.trim())) {
    throw new PatientApplicationError('VALIDATION_ERROR');
  }
  return {
    userId: typeof body.userId === 'string' ? body.userId.trim() : null,
    medicalRecordNumber: requiredString(body, 'medicalRecordNumber'),
    fullName: requiredString(body, 'fullName'),
    dateOfBirth: requiredString(body, 'dateOfBirth'),
    sex: requiredString(body, 'sex'),
    phone: requiredString(body, 'phone'),
    email: requiredString(body, 'email'),
    address: requiredString(body, 'address'),
    emergencyContact: requiredString(body, 'emergencyContact'),
    status: requiredString(body, 'status'),
  };
}

function parsePatch(input: PatientPatchRequest): PatientProfileChanges {
  const body = requirePlainObject(input);
  assertOnlyFields(body, patchFields);
  if (Object.keys(body).length === 0) throw new PatientApplicationError('VALIDATION_ERROR');
  return {
    fullName: optionalString(body, 'fullName'),
    dateOfBirth: optionalString(body, 'dateOfBirth'),
    sex: optionalString(body, 'sex'),
    phone: optionalString(body, 'phone'),
    email: optionalString(body, 'email'),
    address: optionalString(body, 'address'),
    emergencyContact: optionalString(body, 'emergencyContact'),
    status: optionalString(body, 'status'),
  };
}

function parseList(input: PatientListQuery): Required<Pick<PatientListQuery, 'limit'>> & Omit<PatientListQuery, 'limit'> {
  const query = requirePlainObject(input);
  assertOnlyFields(query, listFields);
  const limit = query.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new PatientApplicationError('VALIDATION_ERROR');
  }
  const result: Record<string, string | number | undefined> = { limit };
  for (const field of listFields) {
    if (field !== 'limit') result[field] = optionalString(query, field);
  }
  return result as Required<Pick<PatientListQuery, 'limit'>> & Omit<PatientListQuery, 'limit'>;
}

function requireIfMatch(value: string | undefined): bigint {
  if (!value || !/^"[1-9][0-9]*"$/.test(value)) {
    throw new PatientApplicationError('PRECONDITION_FAILED');
  }
  return BigInt(value.slice(1, -1));
}

export async function createPatient(
  dependencies: PatientApplicationDependencies,
  context: RequestContext,
  input: PatientCreateRequest,
  idempotencyKey: string,
): Promise<Patient> {
  const tenantId = requireTenant(context);
  authorize(dependencies, context, 'patient.create', tenantId);
  const patient = parseCreate(input);
  try {
    assertValidIdempotencyKey(idempotencyKey);
  } catch {
    throw new PatientApplicationError('VALIDATION_ERROR');
  }

  const identity = {
    tenantId,
    actorId: context.actor!.userId,
    endpoint: 'POST /api/v1/patients',
  };
  const started = await dependencies.idempotency.begin({
    ...identity,
    key: idempotencyKey,
    requestHash: await hashPayload(patient),
  });
  if (started.kind === 'CONFLICT') throw new PatientApplicationError('IDEMPOTENCY_CONFLICT');
  if (started.kind === 'REPLAY') {
    if (!started.record.responseReference) throw new PatientApplicationError('IDEMPOTENCY_CONFLICT');
    const replay = await dependencies.patients.findById({ tenantId, patientId: started.record.responseReference });
    if (!replay) throw new PatientApplicationError('IDEMPOTENCY_CONFLICT');
    return replay;
  }

  try {
    const created = await dependencies.patients.create({ tenantId, patient });
    await dependencies.idempotency.complete({
      ...identity,
      key: idempotencyKey,
      responseCode: 201,
      responseReference: created.patientId,
    });
    return created;
  } catch (error) {
    await dependencies.idempotency.fail({ ...identity, key: idempotencyKey, responseCode: 500 });
    throw error;
  }
}

export async function getPatient(
  dependencies: PatientApplicationDependencies,
  context: RequestContext,
  patientId: string,
): Promise<Patient> {
  const tenantId = requireTenant(context);
  authorize(dependencies, context, 'patient.read', tenantId);
  const patient = await dependencies.patients.findById({ tenantId, patientId });
  if (!patient) throw new PatientApplicationError('NOT_FOUND');
  authorize(dependencies, context, 'patient.read', tenantId, patient);
  return patient;
}

export async function patchPatient(
  dependencies: PatientApplicationDependencies,
  context: RequestContext,
  patientId: string,
  input: PatientPatchRequest,
  ifMatch: string | undefined,
): Promise<Patient> {
  const tenantId = requireTenant(context);
  authorize(dependencies, context, 'patient.update', tenantId);
  const current = await dependencies.patients.findById({ tenantId, patientId });
  if (!current) throw new PatientApplicationError('NOT_FOUND');
  authorize(dependencies, context, 'patient.update', tenantId, current);
  const expectedVersion = requireIfMatch(ifMatch);
  if (current.version !== expectedVersion) throw new PatientApplicationError('PRECONDITION_FAILED');
  const updated = await dependencies.patients.update({
    tenantId,
    patientId,
    changes: parsePatch(input),
    expectedVersion,
  });
  if (!updated) throw new PatientApplicationError('PRECONDITION_FAILED');
  return updated;
}

export async function listPatients(
  dependencies: PatientApplicationDependencies,
  context: RequestContext,
  input: PatientListQuery,
): Promise<readonly Patient[]> {
  const tenantId = requireTenant(context);
  authorize(dependencies, context, 'patient.list', tenantId);
  return dependencies.patients.listByTenant({ tenantId, ...parseList(input) });
}
