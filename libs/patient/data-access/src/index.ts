import type { PatientReference } from '../../contracts/src/index.ts';
import type {
  Patient,
  PatientCreate,
  PatientProfileChanges,
} from '../../domain/src/index.ts';

/**
 * All Patient persistence operations are tenant-scoped by contract. Concrete
 * adapters must enforce this scope in their persistence query as well.
 */
export interface PatientRepository {
  findById(input: PatientReference): Promise<Patient | null>;
  findByMedicalRecordNumber(input: {
    readonly tenantId: string;
    readonly medicalRecordNumber: string;
  }): Promise<Patient | null>;
  listByTenant(input: {
    readonly tenantId: string;
    readonly limit: number;
    readonly cursor?: string;
  }): Promise<readonly Patient[]>;
  create(input: {
    readonly tenantId: string;
    readonly patient: PatientCreate;
  }): Promise<Patient>;
  update(input: {
    readonly tenantId: string;
    readonly patientId: string;
    readonly changes: PatientProfileChanges;
    readonly expectedVersion: bigint;
  }): Promise<Patient | null>;
}
