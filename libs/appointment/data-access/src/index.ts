import type { AppointmentAvailabilityQuery, AppointmentAvailabilitySlot, AppointmentListQuery } from '../../contracts/src/index.ts';
import type { Appointment } from '../../domain/src/index.ts';

/** Raised by the scheduling adapter when the database constraint rejects an overlap. */
export class AppointmentSchedulingConflictError extends Error {
  public constructor(message = 'appointment scheduling conflict') {
    super(message);
    this.name = 'AppointmentSchedulingConflictError';
  }
}

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
  updateStatus(input: {
    readonly tenantId: string;
    readonly appointmentId: string;
    readonly status: Appointment['status'];
    readonly checkedInAt?: string | null;
    readonly expectedVersion: bigint;
  }): Promise<Appointment | null>;
}

export interface AppointmentAvailabilityRepository {
  listAvailableSlots(input: AppointmentAvailabilityQuery & { readonly tenantId: string }): Promise<readonly AppointmentAvailabilitySlot[]>;
}
