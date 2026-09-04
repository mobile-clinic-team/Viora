import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  IdentityContextStore,
  Membership,
  UserIdentity,
} from '../../../libs/identity/application-entrypoint/src/index.ts';
import {
  handleGetMe,
  handleListMyMemberships,
} from './identity-api.ts';

const subject = { issuer: 'https://issuer.example', subject: 'user-123' };
const user: UserIdentity = {
  id: 'user-123',
  status: 'ACTIVE',
  subject,
};
const activeMembership: Membership = {
  id: 'membership-a',
  userId: user.id,
  tenantId: 'tenant-a',
  role: 'ADMIN',
  status: 'ACTIVE',
};
const suspendedMembership: Membership = {
  ...activeMembership,
  id: 'membership-suspended',
  tenantId: 'tenant-b',
  status: 'SUSPENDED',
};

function store(memberships: readonly Membership[]): IdentityContextStore {
  return {
    async findUserBySubject() {
      return user;
    },
    async findMembershipsByUser() {
      return memberships;
    },
  };
}

test('GET /me returns only the authenticated tenant context', async () => {
  const response = await handleGetMe(store([activeMembership]), subject, 'tenant-a');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    actor: { userId: user.id, subject, status: 'ACTIVE' },
    membership: activeMembership,
    tenant: { tenantId: 'tenant-a', membershipId: 'membership-a' },
  });
});

test('GET /me fails closed when tenant context is ambiguous', async () => {
  const secondMembership = { ...activeMembership, id: 'membership-b', tenantId: 'tenant-b' };
  const response = await handleGetMe(store([activeMembership, secondMembership]), subject);

  assert.equal(response.status, 409);
  assert.deepEqual(response.body, { code: 'TENANT_CONTEXT_REQUIRED' });
});

test('GET /me/memberships returns only active memberships', async () => {
  const response = await handleListMyMemberships(
    store([activeMembership, suspendedMembership]),
    subject,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, [activeMembership]);
});

test('identity endpoints reject a missing subject', async () => {
  const storeWithNoLookup: IdentityContextStore = {
    async findUserBySubject() {
      throw new Error('must not access identity store');
    },
    async findMembershipsByUser() {
      throw new Error('must not access membership store');
    },
  };

  const me = await handleGetMe(storeWithNoLookup, null, 'tenant-a');
  const memberships = await handleListMyMemberships(storeWithNoLookup, null);

  assert.equal(me.status, 401);
  assert.equal(memberships.status, 401);
});
