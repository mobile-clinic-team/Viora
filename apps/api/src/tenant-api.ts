import type { RequestContext } from '../../../libs/platform/context/src/index.ts';
import {
  createLocation,
  getTenant,
  listLocations,
  patchTenant,
  TenantApplicationError,
} from '../../../libs/tenant/application-entrypoint/src/index.ts';
import type { LocationCreate, TenantPatch } from '../../../libs/tenant/contracts/src/index.ts';
import type { LocationRepository, TenantRepository } from '../../../libs/tenant/data-access/src/index.ts';

export interface TenantApiDependencies {
  readonly tenants: TenantRepository;
  readonly locations: LocationRepository;
}

export interface TenantApiResponse {
  readonly status: 200 | 201 | 400 | 401 | 403 | 404 | 409 | 412 | 422 | 500;
  readonly body: unknown;
  readonly etag?: string;
}

function errorResponse(error: unknown): TenantApiResponse {
  if (!(error instanceof TenantApplicationError)) return { status: 500, body: { code: 'INTERNAL_ERROR' } };
  const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'FORBIDDEN' ? 403 : error.code === 'CONFLICT' || error.code === 'IDEMPOTENCY_CONFLICT' ? 409 : error.code === 'PRECONDITION_FAILED' ? 412 : 422;
  return { status, body: { code: error.code } };
}

function withoutVersion<T extends { readonly version: bigint }>(resource: T): Omit<T, 'version'> {
  const { version: _version, ...publicResource } = resource;
  return publicResource;
}

function withEtag<T extends { readonly version: bigint }>(resource: T): TenantApiResponse {
  return { status: 200, body: withoutVersion(resource), etag: `"${resource.version.toString()}"` };
}

export async function handleGetTenant(deps: TenantApiDependencies, context: RequestContext, tenantId: string): Promise<TenantApiResponse> {
  try { return withEtag(await getTenant(deps.tenants, context, tenantId)); } catch (error) { return errorResponse(error); }
}

export async function handlePatchTenant(deps: TenantApiDependencies, context: RequestContext, tenantId: string, body: TenantPatch, authorizedRole: string, ifMatch?: string): Promise<TenantApiResponse> {
  try { return withEtag(await patchTenant(deps.tenants, context, tenantId, body, authorizedRole, ifMatch)); } catch (error) { return errorResponse(error); }
}

export async function handleListLocations(deps: TenantApiDependencies, context: RequestContext, tenantId: string, query: Parameters<typeof listLocations>[3]): Promise<TenantApiResponse> {
  try { return { status: 200, body: (await listLocations(deps.locations, context, tenantId, query)).map(withoutVersion) }; } catch (error) { return errorResponse(error); }
}

export async function handleCreateLocation(deps: TenantApiDependencies, context: RequestContext, tenantId: string, body: LocationCreate, authorizedRole: string, idempotencyKey: string): Promise<TenantApiResponse> {
  try { return { status: 201, body: withoutVersion(await createLocation(deps.locations, context, tenantId, body, authorizedRole, idempotencyKey)) }; } catch (error) { return errorResponse(error); }
}
