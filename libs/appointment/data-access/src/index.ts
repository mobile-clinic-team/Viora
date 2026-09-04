import type { AppointmentListQuery } from '../../contracts/src/index.ts';
import type { Appointment } from '../../domain/src/index.ts';

export interface AppointmentRepository {
  findById(input: { readonly tenantId: string; readonly appointmentId: string }): Promise<Appointment | null>;
  listByTenant(input: AppointmentListQuery & { readonly tenantId: string }): Promise<readonly Appointment[]>;
  create(input: {
    readonly tenantId: string;
    readonly actorId: string;
    readonly appointment: Omit<Appointment, 'id' | 'version' | 'createdAt' | 'updatedAt'>;
  }): Promise<Appointment>;
  update(input: {
    readonly tenantId: string;
    readonly appointmentId: string;
    readonly changes: Partial<Pick<Appointment, 'locationId' | 'doctorId' | 'startTime' | 'endTime' | 'reason' | 'notes'>>;
    readonly expectedVersion: bigint;
  }): Promise<Appointment | null>;
}
