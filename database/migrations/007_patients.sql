-- PAT-001 / migration 007
-- Patient identity is tenant-scoped. Patient status and sex remain open text
-- values until their approved value sets are introduced by the data model.

CREATE TABLE patients (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
  user_id UUID REFERENCES users (id) ON DELETE RESTRICT,
  medical_record_number TEXT NOT NULL,
  full_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  sex TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT NOT NULL,
  emergency_contact TEXT NOT NULL,
  status TEXT NOT NULL,
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT patients_tenant_medical_record_number_key
    UNIQUE (tenant_id, medical_record_number)
);

CREATE INDEX patients_tenant_id_idx ON patients (tenant_id, id);
CREATE INDEX patients_tenant_status_idx ON patients (tenant_id, status, id);

