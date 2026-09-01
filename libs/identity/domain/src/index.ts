import type {
  IdentitySubjectReference,
  Membership,
  UserIdentity,
} from '../../contracts/src/index.ts';

export class IdentityInvariantError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'IdentityInvariantError';
  }
}

export function assertValidSubject(subject: IdentitySubjectReference): void {
  if (!subject.issuer.trim() || !subject.subject.trim()) {
    throw new IdentityInvariantError('Identity subject is invalid');
  }
}

export function assertActiveUser(user: UserIdentity): void {
  if (user.status !== 'ACTIVE') {
    throw new IdentityInvariantError('User identity is not active');
  }
}

export function assertActiveMembership(
  membership: Membership,
  userId: string,
  tenantId?: string,
): void {
  if (
    membership.status !== 'ACTIVE' ||
    membership.userId !== userId ||
    (tenantId !== undefined && membership.tenantId !== tenantId)
  ) {
    throw new IdentityInvariantError('Membership is invalid for context');
  }
}
