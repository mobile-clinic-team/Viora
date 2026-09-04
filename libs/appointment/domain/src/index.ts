import type { AppointmentStatus } from '../../contracts/src/index.ts';

export interface Appointment {
  readonly id: string;
  readonly tenantId: string;
  readonly locationId: string;
  readonly patientId: string;
  readonly doctorId: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly status: AppointmentStatus;
  readonly checkedInAt: string | null;
  readonly reason: string;
  readonly notes: string;
  readonly createdBy: string;
  readonly version: bigint;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function assertAppointmentTimeRange(startTime: string, endTime: string): void {
  const start = Date.parse(startTime);
  const end = Date.parse(endTime);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new Error('appointment start_time must be before end_time');
  }
}

const transitions: Readonly<Record<AppointmentStatus, readonly AppointmentStatus[]>> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function assertAppointmentStatusTransition(
  from: AppointmentStatus,
  to: AppointmentStatus,
): void {
  if (!transitions[from].includes(to)) throw new Error('invalid appointment status transition');
}
