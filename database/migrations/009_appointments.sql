-- APPT-001 / migration 009
-- Double booking is rejected at the database boundary for active statuses.

CREATE TYPE appointment_status AS ENUM (
  'PENDING', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS',
  'COMPLETED', 'CANCELLED', 'NO_SHOW'
);

CREATE TABLE appointments (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations (id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES patients (id) ON DELETE RESTRICT,
  doctor_id UUID NOT NULL REFERENCES doctors (id) ON DELETE RESTRICT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status appointment_status NOT NULL,
  checked_in_at TIMESTAMPTZ,
  reason TEXT NOT NULL,
  notes TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT appointments_time_range CHECK (start_time < end_time)
);

ALTER TABLE appointments
  ADD CONSTRAINT appointments_doctor_schedule_exclusion
  EXCLUDE USING gist (
    doctor_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  ) WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));

CREATE INDEX appointments_tenant_patient_start_idx
  ON appointments (tenant_id, patient_id, start_time, id);
CREATE INDEX appointments_tenant_doctor_start_idx
  ON appointments (tenant_id, doctor_id, start_time, id);
CREATE INDEX appointments_tenant_status_checked_in_idx
  ON appointments (tenant_id, status, checked_in_at, id);

