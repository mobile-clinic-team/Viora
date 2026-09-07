-- CLIN-001/002 / migration 010

CREATE TYPE encounter_status AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE medical_record_status AS ENUM ('DRAFT', 'IN_REVIEW', 'FINALIZED', 'AMENDED');

CREATE TABLE encounters (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES patients (id) ON DELETE RESTRICT,
  appointment_id UUID REFERENCES appointments (id) ON DELETE RESTRICT,
  doctor_id UUID NOT NULL REFERENCES doctors (id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  status encounter_status NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT encounters_appointment_key UNIQUE (appointment_id)
);

CREATE TABLE medical_records (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES patients (id) ON DELETE RESTRICT,
  encounter_id UUID NOT NULL REFERENCES encounters (id) ON DELETE RESTRICT,
  status medical_record_status NOT NULL,
  current_version BIGINT NOT NULL DEFAULT 1 CHECK (current_version > 0),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT medical_records_encounter_key UNIQUE (encounter_id)
);

CREATE TABLE medical_record_versions (
  id UUID PRIMARY KEY,
  medical_record_id UUID NOT NULL REFERENCES medical_records (id) ON DELETE RESTRICT,
  version BIGINT NOT NULL CHECK (version > 0),
  diagnosis TEXT NOT NULL,
  symptoms TEXT NOT NULL,
  clinical_notes TEXT NOT NULL,
  treatment_plan TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  amendment_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT medical_record_versions_record_version_key UNIQUE (medical_record_id, version)
);

CREATE FUNCTION reject_medical_record_version_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'medical_record_versions are append-only';
END;
$$;

CREATE TRIGGER medical_record_versions_immutable_trigger
BEFORE UPDATE OR DELETE OR TRUNCATE ON medical_record_versions
FOR EACH STATEMENT
EXECUTE FUNCTION reject_medical_record_version_mutation();

CREATE TABLE patient_allergies (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES patients (id) ON DELETE RESTRICT,
  allergen TEXT NOT NULL,
  reaction TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('MILD', 'MODERATE', 'SEVERE', 'UNKNOWN')),
  status TEXT NOT NULL,
  recorded_by UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX encounters_tenant_patient_started_idx
  ON encounters (tenant_id, patient_id, started_at, id);
CREATE INDEX medical_records_tenant_patient_idx
  ON medical_records (tenant_id, patient_id, id);
CREATE INDEX patient_allergies_tenant_patient_idx
  ON patient_allergies (tenant_id, patient_id, id);
