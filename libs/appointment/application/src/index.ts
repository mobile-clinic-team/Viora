import type {
  AppointmentAvailabilityQuery,
  AppointmentCreateRequest,
  AppointmentListQuery,
  AppointmentPatchRequest,
} from '../../contracts/src/index.ts';
import type { Appointment } from '../../domain/src/index.ts';
import { assertAppointmentStatusTransition, assertAppointmentTimeRange } from '../../domain/src/index.ts';
import type { AppointmentAvailabilityRepository, AppointmentRepository } from '../../data-access/src/index.ts';
import type { RequestContext } from '../../../platform/context/src/index.ts';
import { authorizeResourceAccess } from '../../../platform/authorization/src/index.ts';
import { assertValidIdempotencyKey, hashPayload, type IdempotencyStore } from '../../../platform/idempotency/src/index.ts';

export type AppointmentAction = 'appointment.create' | 'appointment.read' | 'appointment.list' | 'appointment.update';

export interface AppointmentAuthorization {
  allows(input: { readonly action: AppointmentAction; readonly context: RequestContext; readonly appointment?: Appointment }): boolean;
}

export interface AppointmentApplicationDependencies {
  readonly appointments: AppointmentRepository;
  readonly availability: AppointmentAvailabilityRepository;
  readonly idempotency: IdempotencyStore;
  readonly authorization: AppointmentAuthorization;
}

export class AppointmentApplicationError extends Error {
  public readonly code: 'FORBIDDEN' | 'NOT_FOUND' | 'PRECONDITION_FAILED' | 'VALIDATION_ERROR' | 'IDEMPOTENCY_CONFLICT';
  public constructor(code: AppointmentApplicationError['code']) {
    super(code);
    this.name = 'AppointmentApplicationError';
    this.code = code;
  }
}

function tenant(context: RequestContext): string {
  if (!context.actor?.userId || !context.tenant?.tenantId.trim()) throw new AppointmentApplicationError('FORBIDDEN');
  return context.tenant.tenantId;
}

function authorize(deps: AppointmentApplicationDependencies, context: RequestContext, action: AppointmentAction, tenantId: string, appointment?: Appointment): void {
  const decision = authorizeResourceAccess({
    action,
    context,
    resource: { resourceId: appointment?.id ?? tenantId, tenantId },
    policy: () => deps.authorization.allows({ action, context, appointment }),
  });
  if (!decision.allowed) throw new AppointmentApplicationError('FORBIDDEN');
}

function plainObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new AppointmentApplicationError('VALIDATION_ERROR');
  return value as Record<string, unknown>;
}

function requiredString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== 'string' || !value.trim()) throw new AppointmentApplicationError('VALIDATION_ERROR');
  return value.trim();
}

function parseCreate(input: AppointmentCreateRequest): Omit<Appointment, 'id' | 'version' | 'createdAt' | 'updatedAt'> {
  const body = plainObject(input);
  const allowed = ['locationId', 'patientId', 'doctorId', 'startTime', 'endTime', 'reason', 'notes'];
  if (Object.keys(body).some((key) => !allowed.includes(key))) throw new AppointmentApplicationError('VALIDATION_ERROR');
  const startTime = requiredString(body, 'startTime');
  const endTime = requiredString(body, 'endTime');
  try { assertAppointmentTimeRange(startTime, endTime); } catch { throw new AppointmentApplicationError('VALIDATION_ERROR'); }
  return {
    tenantId: '',
    locationId: requiredString(body, 'locationId'),
    patientId: requiredString(body, 'patientId'),
    doctorId: requiredString(body, 'doctorId'),
    startTime,
    endTime,
    status: 'PENDING',
    checkedInAt: null,
    reason: requiredString(body, 'reason'),
    notes: body.notes === undefined ? '' : requiredString(body, 'notes'),
    createdBy: '',
  };
}

function limit(input: { readonly limit?: number; readonly cursor?: string }): { readonly limit: number; readonly cursor?: string } {
  const value = input.limit ?? 20;
  if (!Number.isInteger(value) || value < 1 || value > 100 || (input.cursor !== undefined && !input.cursor.trim())) throw new AppointmentApplicationError('VALIDATION_ERROR');
  return { limit: value, cursor: input.cursor };
}

function ifMatch(value: string | undefined): bigint {
  if (!value || !/^"[1-9][0-9]*"$/.test(value)) throw new AppointmentApplicationError('PRECONDITION_FAILED');
  return BigInt(value.slice(1, -1));
}

export async function createAppointment(deps: AppointmentApplicationDependencies, context: RequestContext, input: AppointmentCreateRequest, idempotencyKey: string): Promise<Appointment> {
  const tenantId = tenant(context);
  authorize(deps, context, 'appointment.create', tenantId);
  let appointment = parseCreate(input);
  appointment = { ...appointment, tenantId, createdBy: context.actor!.userId };
  try { assertValidIdempotencyKey(idempotencyKey); } catch { throw new AppointmentApplicationError('VALIDATION_ERROR'); }
  const identity = { tenantId, actorId: context.actor!.userId, endpoint: 'POST /api/v1/appointments' };
  const started = await deps.idempotency.begin({ ...identity, key: idempotencyKey, requestHash: await hashPayload(appointment) });
  if (started.kind === 'CONFLICT') throw new AppointmentApplicationError('IDEMPOTENCY_CONFLICT');
  if (started.kind === 'REPLAY') {
    if (!started.record.responseReference) throw new AppointmentApplicationError('IDEMPOTENCY_CONFLICT');
    const replay = await deps.appointments.findById({
      tenantId,
      appointmentId: started.record.responseReference,
    });
    if (!replay) throw new AppointmentApplicationError('IDEMPOTENCY_CONFLICT');
    return replay;
  }
  try {
    const created = await deps.appointments.create({ tenantId, actorId: context.actor!.userId, appointment });
    await deps.idempotency.complete({ ...identity, key: idempotencyKey, responseCode: 201, responseReference: created.id });
    return created;
  } catch (error) {
    await deps.idempotency.fail({ ...identity, key: idempotencyKey, responseCode: 500 });
    throw error;
  }
}

export async function getAppointment(deps: AppointmentApplicationDependencies, context: RequestContext, appointmentId: string): Promise<Appointment> {
  const tenantId = tenant(context);
  if (!appointmentId.trim()) throw new AppointmentApplicationError('VALIDATION_ERROR');
  authorize(deps, context, 'appointment.read', tenantId, { id: appointmentId, tenantId } as Appointment);
  const appointment = await deps.appointments.findById({ tenantId, appointmentId });
  if (!appointment) throw new AppointmentApplicationError('NOT_FOUND');
  if (appointment.tenantId !== tenantId) throw new AppointmentApplicationError('FORBIDDEN');
  if (!deps.authorization.allows({ action: 'appointment.read', context, appointment })) throw new AppointmentApplicationError('FORBIDDEN');
  return appointment;
}

export async function listAppointments(deps: AppointmentApplicationDependencies, context: RequestContext, input: AppointmentListQuery): Promise<readonly Appointment[]> {
  const tenantId = tenant(context);
  authorize(deps, context, 'appointment.list', tenantId);
  return deps.appointments.listByTenant({ ...input, ...limit(input), tenantId });
}

export async function getAppointmentAvailability(
  deps: AppointmentApplicationDependencies,
  context: RequestContext,
  input: AppointmentAvailabilityQuery,
) {
  const tenantId = tenant(context);
  authorize(deps, context, 'appointment.list', tenantId);
  return deps.availability.listAvailableSlots({ ...availabilityRange(input), tenantId });
}

export async function updateAppointment(deps: AppointmentApplicationDependencies, context: RequestContext, appointmentId: string, input: AppointmentPatchRequest, version: string | undefined): Promise<Appointment> {
  const current = await getAppointment(deps, context, appointmentId);
  authorize(deps, context, 'appointment.update', current.tenantId, current);
  const expectedVersion = ifMatch(version);
  if (expectedVersion !== current.version) throw new AppointmentApplicationError('PRECONDITION_FAILED');
  const body = plainObject(input);
  const allowed = ['locationId', 'doctorId', 'startTime', 'endTime', 'reason', 'notes'];
  if (Object.keys(body).some((key) => !allowed.includes(key)) || Object.keys(body).length === 0) throw new AppointmentApplicationError('VALIDATION_ERROR');
  const changes = Object.fromEntries(Object.entries(body).map(([key, value]) => {
    if (typeof value !== 'string' || !value.trim()) throw new AppointmentApplicationError('VALIDATION_ERROR');
    return [key, value.trim()];
  })) as AppointmentPatchRequest;
  const start = changes.startTime ?? current.startTime;
  const end = changes.endTime ?? current.endTime;
  try { assertAppointmentTimeRange(start, end); } catch { throw new AppointmentApplicationError('VALIDATION_ERROR'); }
  const updated = await deps.appointments.update({ tenantId: current.tenantId, appointmentId, changes, expectedVersion });
  if (!updated) throw new AppointmentApplicationError('PRECONDITION_FAILED');
  return updated;
}

function availabilityRange(input: AppointmentAvailabilityQuery): AppointmentAvailabilityQuery & { readonly limit: number; readonly cursor?: string } {
  const from = new Date(input.from);
  const to = new Date(input.to);
  if (!input.doctorId.trim() || !Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) {
    throw new AppointmentApplicationError('VALIDATION_ERROR');
  }
  return { ...input, ...limit(input) };
}

export async function transitionAppointment(
  deps: AppointmentApplicationDependencies,
  context: RequestContext,
  appointmentId: string,
  status: Appointment['status'],
  version: string | undefined,
): Promise<Appointment> {
  const current = await getAppointment(deps, context, appointmentId);
  authorize(deps, context, 'appointment.update', current.tenantId, current);
  const expectedVersion = ifMatch(version);
  if (expectedVersion !== current.version) throw new AppointmentApplicationError('PRECONDITION_FAILED');
  try { assertAppointmentStatusTransition(current.status, status); } catch { throw new AppointmentApplicationError('VALIDATION_ERROR'); }
  const updated = await deps.appointments.updateStatus({
    tenantId: current.tenantId,
    appointmentId,
    status,
    checkedInAt: status === 'CHECKED_IN' ? new Date().toISOString() : undefined,
    expectedVersion,
  });
  if (!updated) throw new AppointmentApplicationError('PRECONDITION_FAILED');
  return updated;
}

export const checkInAppointment = (
  deps: AppointmentApplicationDependencies,
  context: RequestContext,
  appointmentId: string,
  version: string | undefined,
) => transitionAppointment(deps, context, appointmentId, 'CHECKED_IN', version);

export const markAppointmentNoShow = (
  deps: AppointmentApplicationDependencies,
  context: RequestContext,
  appointmentId: string,
  version: string | undefined,
) => transitionAppointment(deps, context, appointmentId, 'NO_SHOW', version);
