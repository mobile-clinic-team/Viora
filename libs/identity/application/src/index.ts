import type {
  IdentityContext,
  IdentitySubjectReference,
  Membership,
  UserIdentity,
} from '../../contracts/src/index.ts';
import {
  assertActiveMembership,
  assertActiveUser,
  assertValidSubject,
} from '../../domain/src/index.ts';

export interface IdentityContextStore {
  findUserBySubject(subject: IdentitySubjectReference): Promise<UserIdentity | null>;
  findMembershipsByUser(userId: string): Promise<readonly Membership[]>;
}

export interface ResolveIdentityContextInput {
  readonly subject: IdentitySubjectReference | null;
  readonly requestedTenantId?: string;
}

async function resolveActiveUser(
  store: IdentityContextStore,
  subject: IdentitySubjectReference | null,
): Promise<UserIdentity> {
  if (!subject) throw new IdentityContextError('UNAUTHENTICATED');

  try {
    assertValidSubject(subject);
  } catch {
    throw new IdentityContextError('INVALID_IDENTITY');
  }

  const user = await store.findUserBySubject(subject);
  if (!user) throw new IdentityContextError('UNAUTHENTICATED');

  try {
    assertActiveUser(user);
  } catch {
    throw new IdentityContextError('INVALID_IDENTITY');
  }

  return user;
}

export class IdentityContextError extends Error {
  public readonly code:
    | 'UNAUTHENTICATED'
    | 'INVALID_IDENTITY'
    | 'MEMBERSHIP_REQUIRED'
    | 'TENANT_CONTEXT_REQUIRED';

  public constructor(
    code:
      | 'UNAUTHENTICATED'
      | 'INVALID_IDENTITY'
      | 'MEMBERSHIP_REQUIRED'
      | 'TENANT_CONTEXT_REQUIRED',
  ) {
    super(code);
    this.name = 'IdentityContextError';
    this.code = code;
  }
}

export async function resolveIdentityContext(
  store: IdentityContextStore,
  input: ResolveIdentityContextInput,
): Promise<IdentityContext> {
  const user = await resolveActiveUser(store, input.subject);

  const memberships = (await store.findMembershipsByUser(user.id)).filter(
    (membership) => membership.status === 'ACTIVE',
  );
  const candidates = input.requestedTenantId !== undefined
    ? memberships.filter(
        (membership) => membership.tenantId === input.requestedTenantId,
      )
    : memberships;

  if (candidates.length !== 1) {
    throw new IdentityContextError(
      candidates.length === 0
        ? 'MEMBERSHIP_REQUIRED'
        : 'TENANT_CONTEXT_REQUIRED',
    );
  }

  const membership = candidates[0];
  try {
    assertActiveMembership(membership, user.id, input.requestedTenantId);
  } catch {
    throw new IdentityContextError('MEMBERSHIP_REQUIRED');
  }

  return {
    kind: 'authenticated',
    actor: {
      userId: user.id,
      subject: user.subject,
      status: user.status,
    },
    membership,
    tenant: {
      tenantId: membership.tenantId,
      membershipId: membership.id,
    },
  };
}

export async function listActiveMemberships(
  store: IdentityContextStore,
  subject: IdentitySubjectReference | null,
): Promise<readonly Membership[]> {
  const user = await resolveActiveUser(store, subject);
  return (await store.findMembershipsByUser(user.id)).filter(
    (membership) => membership.status === 'ACTIVE',
  );
}
