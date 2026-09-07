import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = async (name: string) => readFile(new URL(`./${name}`, import.meta.url), 'utf8');

test('foundation migrations are ordered, transactional, and dependency-shaped', async () => {
  const files = [
    '001_extensions.sql',
    '002_tenants_locations.sql',
    '003_users_memberships.sql',
    '004_idempotency.sql',
  ];

  for (const file of files) {
    const sql = await migration(file);
    assert.doesNotMatch(sql, /\bBEGIN;/);
    assert.doesNotMatch(sql, /\bCOMMIT;/);
  }

  assert.match(await migration('001_extensions.sql'), /CREATE EXTENSION IF NOT EXISTS btree_gist/);
  assert.match(await migration('002_tenants_locations.sql'), /REFERENCES tenants \(id\) ON DELETE RESTRICT/);
  assert.match(await migration('003_users_memberships.sql'), /REFERENCES users \(id\) ON DELETE RESTRICT/);
  assert.match(await migration('004_idempotency.sql'), /UNIQUE \(tenant_id, actor_id, endpoint, key\)/);
});

test('foundation status and idempotency contracts match the application contracts', async () => {
  const identity = await migration('003_users_memberships.sql');
  const idempotency = await migration('004_idempotency.sql');

  assert.match(identity, /identity_status AS ENUM \('ACTIVE', 'SUSPENDED', 'DISABLED'\)/);
  assert.match(identity, /membership_status AS ENUM \('ACTIVE', 'SUSPENDED', 'REVOKED'\)/);
  assert.match(idempotency, /idempotency_status AS ENUM \('PROCESSING', 'SUCCEEDED', 'FAILED'\)/);
  assert.match(idempotency, /request_hash VARCHAR\(64\) NOT NULL/);
  assert.match(idempotency, /response_reference TEXT/);
});

test('domain migrations preserve the approved dependency and immutability boundaries', async () => {
  const outbox = await migration('006_outbox_events.sql');
  const patients = await migration('007_patients.sql');
  const doctor = await migration('008_doctor.sql');
  const appointments = await migration('009_appointments.sql');
  const clinical = await migration('010_clinical.sql');

  for (const sql of [outbox, patients, doctor, appointments, clinical]) {
    assert.doesNotMatch(sql, /\bBEGIN;/);
    assert.doesNotMatch(sql, /\bCOMMIT;/);
    assert.match(sql, /ON DELETE RESTRICT/);
  }
  assert.match(outbox, /outbox_status AS ENUM \('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'\)/);
  assert.match(appointments, /EXCLUDE USING gist/);
  assert.match(clinical, /BEFORE UPDATE OR DELETE OR TRUNCATE ON medical_record_versions/);
  assert.match(clinical, /medical_record_versions_immutable_trigger/);
  assert.match(clinical, /UNIQUE \(medical_record_id, version\)/);
  assert.match(patients, /UNIQUE \(tenant_id, medical_record_number\)/);
});
