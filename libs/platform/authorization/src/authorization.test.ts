import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  authorizeResourceAccess,
  type AuthorizationRequest,
} from './index.ts';
import {
  createAuthenticatedRequestContext,
  createUnauthenticatedRequestContext,
} from '../../context/src/index.ts';

const context = createAuthenticatedRequestContext({
  requestId: 'request-1',
  correlationId: 'correlation-1',
  userId: 'user-a',
  subject: 'subject-a',
  tenantId: 'tenant-a',
  membershipId: 'membership-a',
});

const resource = {
  resourceId: 'resource-a',
  tenantId: 'tenant-a',
};

const authorizedRequest: AuthorizationRequest = {
  action: 'read',
  context,
  resource,
  policy: ({ context: actorContext }) => actorContext.actor?.userId === 'user-a',
};

test('allows same-tenant access when the resource policy allows it', () => {
  assert.deepEqual(authorizeResourceAccess(authorizedRequest), {
    allowed: true,
    reason: 'ALLOW',
  });
});

test('denies same-tenant access when ownership or relationship policy denies it', () => {
  const decision = authorizeResourceAccess({
    ...authorizedRequest,
    policy: () => false,
  });

  assert.deepEqual(decision, { allowed: false, reason: 'POLICY_DENIED' });
});

test('denies cross-tenant access before evaluating the policy', () => {
  let policyCalled = false;
  const decision = authorizeResourceAccess({
    ...authorizedRequest,
    resource: { resourceId: 'resource-b', tenantId: 'tenant-b' },
    policy: () => {
      policyCalled = true;
      return true;
    },
  });

  assert.deepEqual(decision, { allowed: false, reason: 'TENANT_MISMATCH' });
  assert.equal(policyCalled, false);
});

test('denies missing actor context', () => {
  const decision = authorizeResourceAccess({
    ...authorizedRequest,
    context: createUnauthenticatedRequestContext('request-1', 'correlation-1'),
  });

  assert.deepEqual(decision, { allowed: false, reason: 'INVALID_CONTEXT' });
});

test('denies missing tenant context', () => {
  const decision = authorizeResourceAccess({
    ...authorizedRequest,
    context: { ...context, tenant: null },
  });

  assert.deepEqual(decision, { allowed: false, reason: 'INVALID_CONTEXT' });
});

test('denies invalid tenant context', () => {
  const decision = authorizeResourceAccess({
    ...authorizedRequest,
    context: {
      ...context,
      tenant: { tenantId: '', membershipId: 'membership-a' },
    },
  });

  assert.deepEqual(decision, { allowed: false, reason: 'INVALID_CONTEXT' });
});

test('denies invalid resource scope', () => {
  const decision = authorizeResourceAccess({
    ...authorizedRequest,
    resource: { resourceId: '', tenantId: 'tenant-a' },
  });

  assert.deepEqual(decision, { allowed: false, reason: 'INVALID_RESOURCE' });
});

test('denies ambiguous or absent policy by default', () => {
  const decision = authorizeResourceAccess({
    action: 'read',
    context,
    resource,
  });

  assert.deepEqual(decision, { allowed: false, reason: 'POLICY_DENIED' });
});

test('denies policy failures instead of allowing access', () => {
  const decision = authorizeResourceAccess({
    ...authorizedRequest,
    policy: () => {
      throw new Error('synthetic policy failure');
    },
  });

  assert.deepEqual(decision, { allowed: false, reason: 'POLICY_DENIED' });
});

test('denies malformed action', () => {
  const decision = authorizeResourceAccess({
    ...authorizedRequest,
    action: '  ',
  });

  assert.deepEqual(decision, { allowed: false, reason: 'INVALID_CONTEXT' });
});
