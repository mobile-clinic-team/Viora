export type AppointmentStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CHECKED_IN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface AppointmentCreateRequest {
  readonly locationId: string;
  readonly patientId: string;
  readonly doctorId: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly reason: string;
  readonly notes?: string;
}

export interface AppointmentPatchRequest {
  readonly locationId?: string;
  readonly doctorId?: string;
  readonly startTime?: string;
  readonly endTime?: string;
  readonly reason?: string;
  readonly notes?: string;
}

export interface AppointmentListQuery {
  readonly doctorId?: string;
  readonly patientId?: string;
  readonly locationId?: string;
  readonly status?: AppointmentStatus;
  readonly from?: string;
  readonly to?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface AppointmentAvailabilityQuery {
  readonly doctorId: string;
  readonly locationId?: string;
  readonly from: string;
  readonly to: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface AppointmentAvailabilitySlot {
  readonly tenantId: string;
  readonly doctorId: string;
  readonly locationId: string;
  readonly startTime: string;
  readonly endTime: string;
}
