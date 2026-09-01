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
