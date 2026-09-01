export type IdentityStatus = 'ACTIVE' | 'SUSPENDED' | 'DISABLED';
export type MembershipStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED';

export interface IdentitySubjectReference {
  readonly issuer: string;
  readonly subject: string;
}

export interface UserIdentity {
  readonly id: string;
  readonly status: IdentityStatus;
  readonly subject: IdentitySubjectReference;
}

export interface Membership {
  readonly id: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly role: string;
  readonly status: MembershipStatus;
}

export interface ActorIdentity {
  readonly userId: string;
  readonly subject: IdentitySubjectReference;
  readonly status: IdentityStatus;
}

export interface TenantContextReference {
  readonly tenantId: string;
  readonly membershipId: string;
}

export interface AuthenticatedActorContext {
  readonly kind: 'authenticated';
  readonly actor: ActorIdentity;
  readonly membership: Membership;
  readonly tenant: TenantContextReference;
}

export interface UnauthenticatedContext {
  readonly kind: 'unauthenticated';
}

export type IdentityContext = AuthenticatedActorContext | UnauthenticatedContext;
