import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  IdentityContextError,
  resolveIdentityContext,
} from '../../application-entrypoint/src/index.ts';
import type {
  IdentityContextStore,
  Membership,
} from '../../application-entrypoint/src/index.ts';

const user = {
  id: 'user-a',
  status: 'ACTIVE' as const,
  subject: { issuer: 'https://issuer.test', subject: 'subject-a' },
};

const tenantAMembership: Membership = {
  id: 'membership-a',
  userId: 'user-a',
  tenantId: 'tenant-a',
  role: 'DOCTOR',
  status: 'ACTIVE',
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

test('establishes an authenticated actor and tenant context', async () => {
  const context = await resolveIdentityContext(store([tenantAMembership]), {
    subject: user.subject,
    requestedTenantId: 'tenant-a',
  });

  assert.equal(context.kind, 'authenticated');
  assert.equal(context.actor.userId, 'user-a');
  assert.equal(context.tenant.tenantId, 'tenant-a');
});

test('rejects an unauthenticated actor', async () => {
  await assert.rejects(
    resolveIdentityContext(store([]), { subject: null }),
    (error: unknown) =>
      error instanceof IdentityContextError && error.code === 'UNAUTHENTICATED',
  );
});

test('rejects an actor without an active membership', async () => {
  await assert.rejects(
    resolveIdentityContext(store([]), {
      subject: user.subject,
      requestedTenantId: 'tenant-a',
    }),
    (error: unknown) =>
      error instanceof IdentityContextError && error.code === 'MEMBERSHIP_REQUIRED',
  );
});

test('does not establish tenant B from tenant A membership', async () => {
  await assert.rejects(
    resolveIdentityContext(store([tenantAMembership]), {
      subject: user.subject,
      requestedTenantId: 'tenant-b',
    }),
    (error: unknown) =>
      error instanceof IdentityContextError && error.code === 'MEMBERSHIP_REQUIRED',
  );
});

test('rejects an empty requested tenant identifier', async () => {
  await assert.rejects(
    resolveIdentityContext(store([tenantAMembership]), {
      subject: user.subject,
      requestedTenantId: '',
    }),
    (error: unknown) =>
      error instanceof IdentityContextError && error.code === 'MEMBERSHIP_REQUIRED',
  );
});

test('rejects ambiguous tenant context without a requested tenant', async () => {
  const tenantBMembership = {
    ...tenantAMembership,
    id: 'membership-b',
    tenantId: 'tenant-b',
  };

  await assert.rejects(
    resolveIdentityContext(store([tenantAMembership, tenantBMembership]), {
      subject: user.subject,
    }),
    (error: unknown) =>
      error instanceof IdentityContextError &&
      error.code === 'TENANT_CONTEXT_REQUIRED',
  );
});
