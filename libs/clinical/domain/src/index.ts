import type { EncounterStatus, MedicalRecordStatus } from '../../contracts/src/index.ts';

export interface Encounter {
  readonly encounterId: string;
  readonly tenantId: string;
  readonly patientId: string;
  readonly appointmentId: string | null;
  readonly doctorId: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly status: EncounterStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MedicalRecord {
  readonly medicalRecordId: string;
  readonly tenantId: string;
  readonly patientId: string;
  readonly encounterId: string;
  readonly status: MedicalRecordStatus;
  readonly currentVersion: bigint;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MedicalRecordVersion {
  readonly versionId: string;
  readonly medicalRecordId: string;
  readonly version: bigint;
  readonly diagnosis: string;
  readonly symptoms: string;
  readonly clinicalNotes: string;
  readonly treatmentPlan: string;
  readonly createdBy: string;
  readonly amendmentReason: string | null;
  readonly createdAt: string;
}

export interface ClinicalRecordWithVersion {
  readonly record: MedicalRecord;
  readonly version: MedicalRecordVersion;
}

export function assertEncounterStatus(status: EncounterStatus): void {
  if (!['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) throw new Error('invalid encounter status');
}

export function assertDraftVersion(version: MedicalRecordVersion, record: MedicalRecord): void {
  if (record.status !== 'DRAFT' || record.currentVersion !== version.version || version.amendmentReason !== null) {
    throw new Error('invalid initial medical record version');
  }
}
