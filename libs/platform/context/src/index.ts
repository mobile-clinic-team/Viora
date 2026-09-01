export interface RequestContext {
  readonly requestId: string;
  readonly correlationId: string;
  readonly actor: {
    readonly userId: string;
    readonly subject: string;
  } | null;
  readonly tenant: {
    readonly tenantId: string;
    readonly membershipId: string;
  } | null;
}

export function createUnauthenticatedRequestContext(
  requestId: string,
  correlationId: string,
): RequestContext {
  return {
    requestId,
    correlationId,
    actor: null,
    tenant: null,
  };
}

export function createAuthenticatedRequestContext(input: {
  readonly requestId: string;
  readonly correlationId: string;
  readonly userId: string;
  readonly subject: string;
  readonly tenantId: string;
  readonly membershipId: string;
}): RequestContext {
  return {
    requestId: input.requestId,
    correlationId: input.correlationId,
    actor: { userId: input.userId, subject: input.subject },
    tenant: {
      tenantId: input.tenantId,
      membershipId: input.membershipId,
    },
  };
}
