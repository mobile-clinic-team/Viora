/**
 * Stable cross-domain reference to a Patient. This is intentionally limited
 * to identity and tenant ownership; it does not expose patient profile data.
 */
export interface PatientReference {
  readonly patientId: string;
  readonly tenantId: string;
}
