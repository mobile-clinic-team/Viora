export interface RequestContext {
  readonly requestId: string;
  readonly correlationId: string;
  readonly actor: {
    readonly userId: string;
    readonly subject: string;
    readonly kind: 'HUMAN' | 'AI';
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
  readonly actorKind?: 'HUMAN' | 'AI';
  readonly tenantId: string;
  readonly membershipId: string;
}): RequestContext {
  return {
    requestId: input.requestId,
    correlationId: input.correlationId,
    actor: { userId: input.userId, subject: input.subject, kind: input.actorKind ?? 'HUMAN' },
    tenant: {
      tenantId: input.tenantId,
      membershipId: input.membershipId,
    },
  };
}
