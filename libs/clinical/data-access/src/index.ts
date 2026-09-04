import type { EncounterCreateRequest } from '../../contracts/src/index.ts';
import type { ClinicalRecordCreateRequest } from '../../contracts/src/index.ts';
import type { ClinicalRecordWithVersion, Encounter, MedicalRecord, MedicalRecordVersion } from '../domain/src/index.ts';

export interface EncounterRepository {
  create(input: EncounterCreateRequest & { readonly tenantId: string }): Promise<Encounter>;
  findById(input: { readonly tenantId: string; readonly encounterId: string }): Promise<Encounter | null>;
}

export interface MedicalRecordRepository {
  createWithInitialVersion(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly encounter: Encounter;
    readonly content: ClinicalRecordCreateRequest;
  }): Promise<ClinicalRecordWithVersion>;
  findByEncounter(input: { readonly tenantId: string; readonly encounterId: string }): Promise<MedicalRecord | null>;
  findCurrentVersion(input: { readonly tenantId: string; readonly medicalRecordId: string }): Promise<MedicalRecordVersion | null>;
}
