import type { EncounterCreateRequest } from '../../contracts/src/index.ts';
import type { ClinicalRecordAmendmentRequest, ClinicalRecordCreateRequest } from '../../contracts/src/index.ts';
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
  transition(input: { readonly tenantId: string; readonly medicalRecordId: string; readonly from: MedicalRecord['status']; readonly to: MedicalRecord['status'] }): Promise<MedicalRecord | null>;
  createAmendment(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly record: MedicalRecord;
    readonly currentVersion: MedicalRecordVersion;
    readonly content: ClinicalRecordAmendmentRequest;
  }): Promise<ClinicalRecordWithVersion>;
}
  findById(input: { readonly tenantId: string; readonly medicalRecordId: string }): Promise<MedicalRecord | null>;
