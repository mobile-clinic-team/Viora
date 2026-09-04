export type EncounterStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type MedicalRecordStatus = 'DRAFT' | 'IN_REVIEW' | 'FINALIZED' | 'AMENDED';

export interface EncounterCreateRequest {
  readonly patientId: string;
  readonly appointmentId?: string;
  readonly doctorId: string;
  readonly startedAt?: string;
}

export interface ClinicalRecordCreateRequest {
  readonly diagnosis: string;
  readonly symptoms: string;
  readonly clinicalNotes: string;
  readonly treatmentPlan: string;
}
