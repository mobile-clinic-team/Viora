import type {
  IdentityContextStore,
  IdentitySubjectReference,
  Membership,
} from '../../../libs/identity/application-entrypoint/src/index.ts';
import {
  IdentityContextError,
  listActiveMemberships,
  resolveIdentityContext,
} from '../../../libs/identity/application-entrypoint/src/index.ts';

export interface IdentityApiResponse {
  readonly status: 200 | 401 | 403 | 409 | 500;
  readonly body: unknown;
}

function errorResponse(error: unknown): IdentityApiResponse {
  if (!(error instanceof IdentityContextError)) {
    return { status: 500, body: { code: 'INTERNAL_ERROR' } };
  }

  const status = error.code === 'TENANT_CONTEXT_REQUIRED' ? 409 : 401;
  return { status, body: { code: error.code } };
}

function publicMembership(membership: Membership): Membership {
  return membership;
}

export async function handleGetMe(
  store: IdentityContextStore,
  subject: IdentitySubjectReference | null,
  requestedTenantId?: string,
): Promise<IdentityApiResponse> {
  try {
    const context = await resolveIdentityContext(store, {
      subject,
      requestedTenantId,
    });
    if (context.kind !== 'authenticated') {
      return { status: 401, body: { code: 'UNAUTHENTICATED' } };
    }
    return {
      status: 200,
      body: {
        actor: context.actor,
        membership: publicMembership(context.membership),
        tenant: context.tenant,
      },
    };
  } catch (error) {
    return errorResponse(error);
  }
}

export async function handleListMyMemberships(
  store: IdentityContextStore,
  subject: IdentitySubjectReference | null,
): Promise<IdentityApiResponse> {
  try {
    return {
      status: 200,
      body: (await listActiveMemberships(store, subject)).map(publicMembership),
    };
  } catch (error) {
    return errorResponse(error);
  }
}
