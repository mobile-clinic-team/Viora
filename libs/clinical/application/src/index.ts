import type { ClinicalRecordCreateRequest, EncounterCreateRequest } from '../../contracts/src/index.ts';
import type { ClinicalRecordWithVersion, Encounter } from '../../domain/src/index.ts';
import type { EncounterRepository, MedicalRecordRepository } from '../../data-access/src/index.ts';
import type { RequestContext } from '../../../platform/context/src/index.ts';
import { authorizeResourceAccess } from '../../../platform/authorization/src/index.ts';
import { assertValidIdempotencyKey, hashPayload, type IdempotencyStore } from '../../../platform/idempotency/src/index.ts';

export type ClinicalAction = 'encounter.create' | 'encounter.read' | 'clinical.record.create' | 'clinical.record.read';

export interface ClinicalAuthorization {
  allows(input: { readonly action: ClinicalAction; readonly context: RequestContext; readonly encounter?: Encounter }): boolean;
}

export interface ClinicalApplicationDependencies {
  readonly encounters: EncounterRepository;
  readonly records: MedicalRecordRepository;
  readonly idempotency: IdempotencyStore;
  readonly authorization: ClinicalAuthorization;
}

export class ClinicalApplicationError extends Error {
  public readonly code: 'FORBIDDEN' | 'NOT_FOUND' | 'VALIDATION_ERROR' | 'IDEMPOTENCY_CONFLICT';
  public constructor(code: ClinicalApplicationError['code']) {
    super(code);
    this.name = 'ClinicalApplicationError';
    this.code = code;
  }
}

function tenant(context: RequestContext): string {
  if (!context.actor?.userId || !context.tenant?.tenantId.trim()) throw new ClinicalApplicationError('FORBIDDEN');
  return context.tenant.tenantId;
}

function authorize(deps: ClinicalApplicationDependencies, context: RequestContext, action: ClinicalAction, tenantId: string, encounter?: Encounter): void {
  const decision = authorizeResourceAccess({
    action,
    context,
    resource: { resourceId: encounter?.encounterId ?? tenantId, tenantId },
    policy: () => deps.authorization.allows({ action, context, encounter }),
  });
  if (!decision.allowed) throw new ClinicalApplicationError('FORBIDDEN');
}

function required(input: unknown, field: string): string {
  const value = (input as Record<string, unknown>)[field];
  if (typeof value !== 'string' || !value.trim()) throw new ClinicalApplicationError('VALIDATION_ERROR');
  return value.trim();
}

function parseEncounter(input: EncounterCreateRequest): EncounterCreateRequest {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new ClinicalApplicationError('VALIDATION_ERROR');
  const body = input as unknown as Record<string, unknown>;
  const allowed = ['patientId', 'appointmentId', 'doctorId', 'startedAt'];
  if (Object.keys(body).some((key) => !allowed.includes(key))) throw new ClinicalApplicationError('VALIDATION_ERROR');
  const startedAt = body.startedAt === undefined ? undefined : required(body, 'startedAt');
  if (startedAt !== undefined && !Number.isFinite(Date.parse(startedAt))) throw new ClinicalApplicationError('VALIDATION_ERROR');
  const appointmentId = body.appointmentId === undefined ? undefined : required(body, 'appointmentId');
  return {
    patientId: required(body, 'patientId'),
    doctorId: required(body, 'doctorId'),
    ...(appointmentId === undefined ? {} : { appointmentId }),
    ...(startedAt === undefined ? {} : { startedAt }),
  };
}

function parseContent(input: ClinicalRecordCreateRequest): ClinicalRecordCreateRequest {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new ClinicalApplicationError('VALIDATION_ERROR');
  const body = input as unknown as Record<string, unknown>;
  const allowed = ['diagnosis', 'symptoms', 'clinicalNotes', 'treatmentPlan'];
  if (Object.keys(body).some((key) => !allowed.includes(key))) throw new ClinicalApplicationError('VALIDATION_ERROR');
  return { diagnosis: required(body, 'diagnosis'), symptoms: required(body, 'symptoms'), clinicalNotes: required(body, 'clinicalNotes'), treatmentPlan: required(body, 'treatmentPlan') };
}

export async function createEncounter(deps: ClinicalApplicationDependencies, context: RequestContext, input: EncounterCreateRequest, idempotencyKey: string): Promise<Encounter> {
  const tenantId = tenant(context);
  authorize(deps, context, 'encounter.create', tenantId);
  const encounter = parseEncounter(input);
  try { assertValidIdempotencyKey(idempotencyKey); } catch { throw new ClinicalApplicationError('VALIDATION_ERROR'); }
  const identity = { tenantId, actorId: context.actor!.userId, endpoint: 'POST /api/v1/encounters' };
  const started = await deps.idempotency.begin({ ...identity, key: idempotencyKey, requestHash: await hashPayload(encounter) });
  if (started.kind === 'CONFLICT') throw new ClinicalApplicationError('IDEMPOTENCY_CONFLICT');
  if (started.kind === 'REPLAY') {
    if (!started.record.responseReference) throw new ClinicalApplicationError('IDEMPOTENCY_CONFLICT');
    const replay = await deps.encounters.findById({ tenantId, encounterId: started.record.responseReference });
    if (!replay) throw new ClinicalApplicationError('IDEMPOTENCY_CONFLICT');
    return replay;
  }
  try {
    const created = await deps.encounters.create({ ...encounter, tenantId });
    await deps.idempotency.complete({ ...identity, key: idempotencyKey, responseCode: 201, responseReference: created.encounterId });
    return created;
  } catch (error) {
    await deps.idempotency.fail({ ...identity, key: idempotencyKey, responseCode: 500 });
    throw error;
  }
}

export async function getEncounter(deps: ClinicalApplicationDependencies, context: RequestContext, encounterId: string): Promise<Encounter> {
  const tenantId = tenant(context);
  if (!encounterId.trim()) throw new ClinicalApplicationError('VALIDATION_ERROR');
  authorize(deps, context, 'encounter.read', tenantId, { encounterId, tenantId } as Encounter);
  const encounter = await deps.encounters.findById({ tenantId, encounterId });
  if (!encounter) throw new ClinicalApplicationError('NOT_FOUND');
  if (encounter.tenantId !== tenantId) throw new ClinicalApplicationError('FORBIDDEN');
  return encounter;
}

export async function createInitialMedicalRecord(deps: ClinicalApplicationDependencies, context: RequestContext, encounterId: string, input: ClinicalRecordCreateRequest, idempotencyKey: string): Promise<ClinicalRecordWithVersion> {
  const encounter = await getEncounter(deps, context, encounterId);
  authorize(deps, context, 'clinical.record.create', context.tenant!.tenantId, encounter);
  const content = parseContent(input);
  try { assertValidIdempotencyKey(idempotencyKey); } catch { throw new ClinicalApplicationError('VALIDATION_ERROR'); }
  const identity = { tenantId: context.tenant!.tenantId, actorId: context.actor!.userId, endpoint: 'POST /api/v1/encounters/{encounter_id}/medical-records' };
  const started = await deps.idempotency.begin({ ...identity, key: idempotencyKey, requestHash: await hashPayload({ encounterId, ...content }) });
  if (started.kind === 'CONFLICT') throw new ClinicalApplicationError('IDEMPOTENCY_CONFLICT');
  if (started.kind === 'REPLAY') {
    if (!started.record.responseReference) throw new ClinicalApplicationError('IDEMPOTENCY_CONFLICT');
    const record = await deps.records.findByEncounter({ tenantId: identity.tenantId, encounterId });
    const version = await deps.records.findCurrentVersion({ tenantId: identity.tenantId, medicalRecordId: started.record.responseReference });
    if (!record || !version) throw new ClinicalApplicationError('IDEMPOTENCY_CONFLICT');
    return { record, version };
  }
  try {
    const result = await deps.records.createWithInitialVersion({ tenantId: identity.tenantId, actorId: identity.actorId, encounter, content });
    await deps.idempotency.complete({ ...identity, key: idempotencyKey, responseCode: 201, responseReference: result.record.medicalRecordId });
    return result;
  } catch (error) {
    await deps.idempotency.fail({ ...identity, key: idempotencyKey, responseCode: 500 });
    throw error;
  }
}
