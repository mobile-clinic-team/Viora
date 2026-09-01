import type { RequestContext } from '../../context/src/index.ts';

export type AuthorizationDecisionReason =
  | 'ALLOW'
  | 'INVALID_CONTEXT'
  | 'INVALID_RESOURCE'
  | 'TENANT_MISMATCH'
  | 'POLICY_DENIED';

export interface ResourceScope {
  readonly resourceId: string;
  readonly tenantId: string;
}

export interface AuthorizationPolicyInput {
  readonly action: string;
  readonly context: RequestContext;
  readonly resource: ResourceScope;
}

export interface AuthorizationRequest {
  readonly action: string;
  readonly context: RequestContext;
  readonly resource: ResourceScope;
  readonly policy?: (input: AuthorizationPolicyInput) => boolean;
}

export interface AuthorizationDecision {
  readonly allowed: boolean;
  readonly reason: AuthorizationDecisionReason;
}

const deny = (reason: Exclude<AuthorizationDecisionReason, 'ALLOW'>): AuthorizationDecision => ({
  allowed: false,
  reason,
});

export function authorizeResourceAccess(
  request: AuthorizationRequest,
): AuthorizationDecision {
  const { actor, tenant } = request.context;
  if (!actor || !tenant || !actor.userId.trim() || !actor.subject.trim()) {
    return deny('INVALID_CONTEXT');
  }

  if (
    !tenant.tenantId.trim() ||
    !tenant.membershipId.trim() ||
    !request.action.trim()
  ) {
    return deny('INVALID_CONTEXT');
  }

  if (!request.resource.resourceId.trim() || !request.resource.tenantId.trim()) {
    return deny('INVALID_RESOURCE');
  }

  if (tenant.tenantId !== request.resource.tenantId) {
    return deny('TENANT_MISMATCH');
  }

  if (!request.policy) {
    return deny('POLICY_DENIED');
  }

  try {
    return request.policy({
      action: request.action,
      context: request.context,
      resource: request.resource,
    })
      ? { allowed: true, reason: 'ALLOW' }
      : deny('POLICY_DENIED');
  } catch {
    return deny('POLICY_DENIED');
  }
}
