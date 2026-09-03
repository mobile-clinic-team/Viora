export interface TenantIdentity {
  readonly tenantId: string;
}

export interface TenantMembershipReference {
  readonly membershipId: string;
  readonly userId: string;
  readonly tenantId: string;
}

export interface TenantContext {
  readonly tenant: TenantIdentity;
  readonly membership: TenantMembershipReference;
}

export interface TenantPatch {
  readonly name: string;
}

export interface LocationCreate {
  readonly name: string;
  readonly address: string;
  readonly phone: string;
}
