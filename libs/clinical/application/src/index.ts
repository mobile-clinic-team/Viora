import type { ClinicalRecordAmendmentRequest, ClinicalRecordCreateRequest, EncounterCreateRequest } from '../../contracts/src/index.ts';
import { assertAmendmentSource, assertMedicalRecordTransition, type ClinicalRecordWithVersion, type Encounter, type MedicalRecord, type MedicalRecordVersion } from '../../domain/src/index.ts';
import type { EncounterRepository, MedicalRecordRepository } from '../../data-access/src/index.ts';
import type { RequestContext } from '../../../platform/context/src/index.ts';
import { authorizeResourceAccess } from '../../../platform/authorization/src/index.ts';
import { assertValidIdempotencyKey, hashPayload, type IdempotencyStore } from '../../../platform/idempotency/src/index.ts';

export type ClinicalAction = 'encounter.create' | 'encounter.read' | 'clinical.record.create' | 'clinical.record.read' | 'clinical.record.review' | 'clinical.record.finalize' | 'clinical.record.amend';

export interface ClinicalAuthorization {
  allows(input: { readonly action: ClinicalAction; readonly context: RequestContext; readonly encounter?: Encounter; readonly medicalRecord?: MedicalRecord }): boolean;
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

function parseAmendment(input: ClinicalRecordAmendmentRequest): ClinicalRecordAmendmentRequest {
  const { amendmentReason: _amendmentReason, ...contentInput } = input as ClinicalRecordAmendmentRequest & Record<string, unknown>;
  const content = parseContent(contentInput);
  return { ...content, amendmentReason: required(input, 'amendmentReason') };
}

async function getRecord(deps: ClinicalApplicationDependencies, context: RequestContext, medicalRecordId: string): Promise<{ record: MedicalRecord; version: MedicalRecordVersion }> {
  const tenantId = tenant(context);
  if (!medicalRecordId.trim()) throw new ClinicalApplicationError('VALIDATION_ERROR');
  const record = await deps.records.findById({ tenantId, medicalRecordId });
  if (!record) throw new ClinicalApplicationError('NOT_FOUND');
  if (record.tenantId !== tenantId) throw new ClinicalApplicationError('FORBIDDEN');
  const decision = authorizeResourceAccess({ action: 'clinical.record.read', context, resource: { resourceId: medicalRecordId, tenantId }, policy: () => deps.authorization.allows({ action: 'clinical.record.read', context, medicalRecord: record }) });
  if (!decision.allowed) throw new ClinicalApplicationError('FORBIDDEN');
  const version = await deps.records.findCurrentVersion({ tenantId, medicalRecordId });
  if (!version) throw new ClinicalApplicationError('NOT_FOUND');
  return { record, version };
}

async function transitionRecord(deps: ClinicalApplicationDependencies, context: RequestContext, medicalRecordId: string, to: MedicalRecord['status'], action: ClinicalAction, idempotencyKey: string): Promise<MedicalRecord> {
  const current = await getRecord(deps, context, medicalRecordId);
  const tenantId = context.tenant!.tenantId;
  const decision = authorizeResourceAccess({ action, context, resource: { resourceId: medicalRecordId, tenantId }, policy: () => deps.authorization.allows({ action, context, medicalRecord: current.record }) });
  if (!decision.allowed) throw new ClinicalApplicationError('FORBIDDEN');
  try { assertValidIdempotencyKey(idempotencyKey); assertMedicalRecordTransition(current.record.status, to); } catch { throw new ClinicalApplicationError('VALIDATION_ERROR'); }
  const identity = { tenantId, actorId: context.actor!.userId, endpoint: `POST /api/v1/medical-records/{medical_record_id}/${to === 'IN_REVIEW' ? 'review' : 'finalize'}` };
  const started = await deps.idempotency.begin({ ...identity, key: idempotencyKey, requestHash: await hashPayload({ medicalRecordId, to, version: current.record.currentVersion.toString() }) });
  if (started.kind === 'CONFLICT') throw new ClinicalApplicationError('IDEMPOTENCY_CONFLICT');
  if (started.kind === 'REPLAY') return current.record;
  try {
    const updated = await deps.records.transition({ tenantId, medicalRecordId, from: current.record.status, to });
    if (!updated) throw new ClinicalApplicationError('VALIDATION_ERROR');
    await deps.idempotency.complete({ ...identity, key: idempotencyKey, responseCode: 200, responseReference: medicalRecordId });
    return updated;
  } catch (error) {
    await deps.idempotency.fail({ ...identity, key: idempotencyKey, responseCode: 500 });
    throw error;
  }
}

export function reviewMedicalRecord(deps: ClinicalApplicationDependencies, context: RequestContext, medicalRecordId: string, idempotencyKey: string): Promise<MedicalRecord> {
  return transitionRecord(deps, context, medicalRecordId, 'IN_REVIEW', 'clinical.record.review', idempotencyKey);
}

export function finalizeMedicalRecord(deps: ClinicalApplicationDependencies, context: RequestContext, medicalRecordId: string, idempotencyKey: string): Promise<MedicalRecord> {
  return transitionRecord(deps, context, medicalRecordId, 'FINALIZED', 'clinical.record.finalize', idempotencyKey);
}

export async function amendMedicalRecord(deps: ClinicalApplicationDependencies, context: RequestContext, medicalRecordId: string, input: ClinicalRecordAmendmentRequest, idempotencyKey: string): Promise<ClinicalRecordWithVersion> {
  const current = await getRecord(deps, context, medicalRecordId);
  const tenantId = context.tenant!.tenantId;
  const decision = authorizeResourceAccess({ action: 'clinical.record.amend', context, resource: { resourceId: medicalRecordId, tenantId }, policy: () => deps.authorization.allows({ action: 'clinical.record.amend', context, medicalRecord: current.record }) });
  if (!decision.allowed) throw new ClinicalApplicationError('FORBIDDEN');
  let content: ClinicalRecordAmendmentRequest;
  try { content = parseAmendment(input); assertAmendmentSource(current.record, current.version); assertValidIdempotencyKey(idempotencyKey); } catch { throw new ClinicalApplicationError('VALIDATION_ERROR'); }
  const identity = { tenantId, actorId: context.actor!.userId, endpoint: 'POST /api/v1/medical-records/{medical_record_id}/amendments' };
  const started = await deps.idempotency.begin({ ...identity, key: idempotencyKey, requestHash: await hashPayload({ medicalRecordId, ...content }) });
  if (started.kind !== 'STARTED') throw new ClinicalApplicationError('IDEMPOTENCY_CONFLICT');
  try {
    const result = await deps.records.createAmendment({ tenantId, actorId: identity.actorId, record: current.record, currentVersion: current.version, content });
    await deps.idempotency.complete({ ...identity, key: idempotencyKey, responseCode: 201, responseReference: result.record.medicalRecordId });
    return result;
  } catch (error) {
    await deps.idempotency.fail({ ...identity, key: idempotencyKey, responseCode: 500 });
    throw error;
  }
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
