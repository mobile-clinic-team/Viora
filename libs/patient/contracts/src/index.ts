/**
 * Stable cross-domain reference to a Patient. This is intentionally limited
 * to identity and tenant ownership; it does not expose patient profile data.
 */
export interface PatientReference {
  readonly patientId: string;
  readonly tenantId: string;
}

export interface PatientCreateRequest {
  readonly userId?: string | null;
  readonly medicalRecordNumber: string;
  readonly fullName: string;
  readonly dateOfBirth: string;
  readonly sex: string;
  readonly phone: string;
  readonly email: string;
  readonly address: string;
  readonly emergencyContact: string;
  readonly status: string;
}

export interface PatientPatchRequest {
  readonly fullName?: string;
  readonly dateOfBirth?: string;
  readonly sex?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly address?: string;
  readonly emergencyContact?: string;
  readonly status?: string;
}

export interface PatientListQuery {
  readonly medicalRecordNumber?: string;
  readonly fullName?: string;
  readonly dateOfBirth?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly limit?: number;
  readonly cursor?: string;
}
