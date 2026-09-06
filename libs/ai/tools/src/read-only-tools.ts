import type { RequestContext } from '../../../platform/context/src/index.ts';
import type { Encounter } from '../../../clinical/domain/src/index.ts';
import type { Patient } from '../../../patient/domain/src/index.ts';
import type { AiToolDefinition } from '../../contracts/src/index.ts';

export interface ReadOnlyToolLoaders {
  readonly getPatient: (input: { readonly context: RequestContext; readonly patientId: string }) => Promise<Patient>;
  readonly listEncounters: (input: { readonly context: RequestContext; readonly patientId: string; readonly limit: number }) => Promise<readonly Encounter[]>;
}

export interface PatientToolInput { readonly patientId: string; }
export interface PatientToolOutput {
  readonly patientId: string;
  readonly medicalRecordNumber: string;
  readonly fullName: string;
  readonly dateOfBirth: string;
  readonly sex: string;
  readonly status: string;
}

export interface RecentEncountersToolInput { readonly patientId: string; readonly limit?: number; }
export interface EncounterToolOutput {
  readonly encounterId: string;
  readonly patientId: string;
  readonly doctorId: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly status: string;
}

const MAX_ENCOUNTERS = 20;

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPatientInput(input: unknown): input is PatientToolInput {
  return Boolean(input && typeof input === 'object' && validId((input as PatientToolInput).patientId) && Object.keys(input).length === 1);
}

function isEncounterInput(input: unknown): input is RecentEncountersToolInput {
  if (!input || typeof input !== 'object' || !validId((input as RecentEncountersToolInput).patientId)) return false;
  const keys = Object.keys(input);
  if (keys.some((key) => !['patientId', 'limit'].includes(key))) return false;
  const limit = (input as RecentEncountersToolInput).limit;
  return limit === undefined || (Number.isInteger(limit) && limit >= 1 && limit <= MAX_ENCOUNTERS);
}

function patientOutput(patient: Patient): PatientToolOutput {
  return {
    patientId: patient.patientId,
    medicalRecordNumber: patient.medicalRecordNumber,
    fullName: patient.fullName,
    dateOfBirth: patient.dateOfBirth,
    sex: patient.sex,
    status: patient.status,
  };
}

function encounterOutput(encounter: Encounter): EncounterToolOutput {
  return {
    encounterId: encounter.encounterId,
    patientId: encounter.patientId,
    doctorId: encounter.doctorId,
    startedAt: encounter.startedAt,
    endedAt: encounter.endedAt,
    status: encounter.status,
  };
}

export function createReadOnlyPatientTool(loaders: ReadOnlyToolLoaders): AiToolDefinition<PatientToolInput, PatientToolOutput> {
  return {
    name: 'get_patient',
    purpose: 'Read minimum-necessary patient information for an authorized tenant workflow',
    access: 'READ',
    requiresHumanApproval: false,
    maxOutputBytes: 6_000,
    validateInput: isPatientInput,
    authorize: ({ context, resource, toolInput }) => !resource || (resource.resourceType === 'patient' && validId(resource.resourceId) && resource.tenantId === context.tenant?.tenantId && isPatientInput(toolInput) && resource.resourceId === toolInput.patientId.trim()),
    execute: async (input, context) => patientOutput(await loaders.getPatient({ context, patientId: input.patientId.trim() })),
  };
}

export function createReadOnlyRecentEncountersTool(loaders: ReadOnlyToolLoaders): AiToolDefinition<RecentEncountersToolInput, readonly EncounterToolOutput[]> {
  return {
    name: 'get_recent_encounters',
    purpose: 'Read bounded encounter history for an authorized tenant workflow',
    access: 'READ',
    requiresHumanApproval: false,
    maxOutputBytes: 12_000,
    validateInput: isEncounterInput,
    authorize: ({ context, resource, toolInput }) => !resource || (resource.resourceType === 'patient' && validId(resource.resourceId) && resource.tenantId === context.tenant?.tenantId && isEncounterInput(toolInput) && resource.resourceId === toolInput.patientId.trim()),
    execute: async (input, context) => {
      const limit = input.limit ?? MAX_ENCOUNTERS;
      const encounters = await loaders.listEncounters({ context, patientId: input.patientId.trim(), limit });
      return encounters
        .filter((encounter) => encounter.tenantId === context.tenant?.tenantId && encounter.patientId === input.patientId.trim())
        .slice(0, limit)
        .map(encounterOutput);
    },
  };
}
