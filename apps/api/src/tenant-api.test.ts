import { strict as assert } from 'node:assert';
import test from 'node:test';
import { createAuthenticatedRequestContext } from '../../../libs/platform/context/src/index.ts';
import { handleCreateLocation, handleGetTenant, handleListLocations, handlePatchTenant } from './tenant-api.ts';

const tenantId = '11111111-1111-4111-8111-111111111111';
const otherTenantId = '22222222-2222-4222-8222-222222222222';
const context = createAuthenticatedRequestContext({
  requestId: 'request-1', correlationId: 'correlation-1', userId: 'user-1',
  subject: 'subject-1', tenantId, membershipId: 'membership-1',
});

const tenant = { id: tenantId, name: 'Viora Clinic', status: 'ACTIVE' as const, version: 1n, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };
const location = { id: '33333333-3333-4333-8333-333333333333', tenantId, name: 'Main', address: 'Synthetic address', phone: '+10000000000', status: 'ACTIVE' as const, version: 1n, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' };

function deps(idempotency: 'NEW' | 'REPLAY' | 'CONFLICT' = 'NEW') {
  return {
    tenants: {
      async findById(id: string) { return id === tenantId ? tenant : null; },
      async updateName(id: string, name: string) { return { ...tenant, id, name, version: 2n }; },
    },
    locations: {
      async listByTenant() { return [location]; },
      async findIdempotency() { return idempotency === 'REPLAY' ? { kind: 'REPLAY' as const, location } : { kind: idempotency as 'NEW' | 'CONFLICT' }; },
      async create() { return location; },
    },
  };
}

test('GET tenant denies a substituted cross-tenant identifier', async () => {
  const response = await handleGetTenant(deps(), context, otherTenantId);
  assert.equal(response.status, 403);
});

test('public tenant resources omit the internal version while exposing a strong ETag', async () => {
  const response = await handleGetTenant(deps(), context, tenantId);
  assert.equal(response.status, 200);
  assert.equal(response.etag, '"1"');
  assert.equal('version' in (response.body as object), false);
});

test('protected tenant access fails closed without actor or tenant context', async () => {
  const response = await handleGetTenant(deps(), { requestId: 'r', correlationId: 'c', actor: null, tenant: null }, tenantId);
  assert.equal(response.status, 403);
});

test('PATCH tenant requires administrator role and current If-Match', async () => {
  const denied = await handlePatchTenant(deps(), context, tenantId, { name: 'Updated' }, 'RECEPTIONIST', '"1"');
  assert.equal(denied.status, 403);
  const stale = await handlePatchTenant(deps(), context, tenantId, { name: 'Updated' }, 'CLINIC_ADMIN', '"2"');
  assert.equal(stale.status, 412);
  const malformed = await handlePatchTenant(deps(), context, tenantId, { name: 'Updated' }, 'CLINIC_ADMIN', 'W/"1"');
  assert.equal(malformed.status, 412);
  const extraField = await handlePatchTenant(deps(), context, tenantId, { name: 'Updated', status: 'ARCHIVED' } as never, 'CLINIC_ADMIN', '"1"');
  assert.equal(extraField.status, 422);
});

test('POST location rejects client ownership fields and accepts synthetic creation', async () => {
  const invalid = await handleCreateLocation(deps(), context, tenantId, { name: 'Main', address: 'A', phone: 'P', tenantId: otherTenantId } as never, 'CLINIC_ADMIN', 'key-1');
  assert.equal(invalid.status, 422);
  const created = await handleCreateLocation(deps(), context, tenantId, { name: 'Main', address: 'Synthetic address', phone: '+10000000000' }, 'CLINIC_ADMIN', 'key-2');
  assert.equal(created.status, 201);
});

test('location creation is tenant-scoped and idempotent', async () => {
  const crossTenant = await handleCreateLocation(deps(), context, otherTenantId, { name: 'Main', address: 'A', phone: 'P' }, 'CLINIC_ADMIN', 'key-1');
  assert.equal(crossTenant.status, 403);
  const replay = await handleCreateLocation(deps('REPLAY'), context, tenantId, { name: 'Main', address: 'A', phone: 'P' }, 'CLINIC_ADMIN', 'key-1');
  assert.equal(replay.status, 201);
  const conflict = await handleCreateLocation(deps('CONFLICT'), context, tenantId, { name: 'Main', address: 'A', phone: 'P' }, 'CLINIC_ADMIN', 'key-1');
  assert.equal(conflict.status, 409);
  assert.deepEqual(conflict.body, { code: 'IDEMPOTENCY_CONFLICT' });
});

test('public location resources omit the internal version', async () => {
  const listed = await handleListLocations(deps(), context, tenantId, {});
  assert.equal(listed.status, 200);
  assert.equal('version' in ((listed.body as readonly object[])[0] ?? {}), false);

  const created = await handleCreateLocation(deps(), context, tenantId, { name: 'Main', address: 'Synthetic address', phone: '+10000000000' }, 'CLINIC_ADMIN', 'key-3');
  assert.equal(created.status, 201);
  assert.equal('version' in (created.body as object), false);
});

test('location list rejects malformed tenant identifiers and invalid pagination', async () => {
  assert.equal((await handleListLocations(deps(), context, 'not-a-uuid', {})).status, 422);
  assert.equal((await handleListLocations(deps(), context, tenantId, { limit: 101 })).status, 422);
});
