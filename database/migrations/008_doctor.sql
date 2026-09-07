-- DOC-001 / migration 008

CREATE TYPE department_status AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE doctor_status AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
CREATE TYPE doctor_shift_status AS ENUM ('ACTIVE', 'CANCELLED');

CREATE TABLE departments (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  status department_status NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT departments_tenant_name_key UNIQUE (tenant_id, name)
);

CREATE TABLE doctors (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  department_id UUID NOT NULL REFERENCES departments (id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations (id) ON DELETE RESTRICT,
  license_number TEXT NOT NULL,
  display_name TEXT NOT NULL,
  specialization TEXT NOT NULL,
  bio TEXT NOT NULL,
  status doctor_status NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT doctors_tenant_license_key UNIQUE (tenant_id, license_number)
);

CREATE TABLE doctor_working_shifts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
  doctor_id UUID NOT NULL REFERENCES doctors (id) ON DELETE RESTRICT,
  location_id UUID NOT NULL REFERENCES locations (id) ON DELETE RESTRICT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status doctor_shift_status NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT doctor_working_shifts_time_range CHECK (start_time < end_time)
);

CREATE INDEX doctors_tenant_id_idx ON doctors (tenant_id, id);
CREATE INDEX doctor_shifts_tenant_doctor_start_idx
  ON doctor_working_shifts (tenant_id, doctor_id, start_time);

