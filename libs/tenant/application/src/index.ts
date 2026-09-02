import type { RequestContext } from '../../../platform/context/src/index.ts';
import { authorizeResourceAccess } from '../../../platform/authorization/src/index.ts';
import type { Tenant, Location, LocationStatus } from '../../domain/src/index.ts';
import { assertUuid } from '../../domain/src/index.ts';
import type { LocationCreate, TenantPatch } from '../../contracts/src/index.ts';
import type { TenantRepository, LocationRepository } from '../../data-access/src/index.ts';

export class TenantApplicationError extends Error {
  public readonly code: 'NOT_FOUND' | 'FORBIDDEN' | 'VALIDATION_ERROR' | 'PRECONDITION_FAILED' | 'CONFLICT' | 'IDEMPOTENCY_CONFLICT';

  public constructor(code: 'NOT_FOUND' | 'FORBIDDEN' | 'VALIDATION_ERROR' | 'PRECONDITION_FAILED' | 'CONFLICT' | 'IDEMPOTENCY_CONFLICT') {
    super(code);
    this.code = code;
  }
}

function authorizeTenant(context: RequestContext, tenantId: string, authorizedRole?: string): void {
  const decision = authorizeResourceAccess({
    action: authorizedRole ? 'tenant.mutate' : 'tenant.read',
    context,
    resource: { resourceId: tenantId, tenantId },
    // The role is an authorization result from a trusted composition root. It
    // must never be copied from request body, path, query, or headers.
    policy: () => authorizedRole === undefined || authorizedRole === 'CLINIC_ADMIN',
  });
  if (!decision.allowed) throw new TenantApplicationError('FORBIDDEN');
}

function requireIfMatch(ifMatch: string | undefined): bigint {
  if (!ifMatch || !/^"[1-9][0-9]*"$/.test(ifMatch)) throw new TenantApplicationError('PRECONDITION_FAILED');
  return BigInt(ifMatch.slice(1, -1));
}

function requireName(name: string): string {
  if (!name.trim() || name.length > 200) throw new TenantApplicationError('VALIDATION_ERROR');
  return name.trim();
}

function requireObject(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TenantApplicationError('VALIDATION_ERROR');
  return value as Record<string, unknown>;
}

export async function getTenant(repository: TenantRepository, context: RequestContext, tenantId: string): Promise<Tenant> {
  try { assertUuid(tenantId, 'tenant_id'); } catch { throw new TenantApplicationError('VALIDATION_ERROR'); }
  authorizeTenant(context, tenantId);
  const tenant = await repository.findById(tenantId);
  if (!tenant) throw new TenantApplicationError('NOT_FOUND');
  return tenant;
}

export async function patchTenant(repository: TenantRepository, context: RequestContext, tenantId: string, input: TenantPatch, authorizedRole: string, ifMatch: string | undefined): Promise<Tenant> {
  try { assertUuid(tenantId, 'tenant_id'); } catch { throw new TenantApplicationError('VALIDATION_ERROR'); }
  authorizeTenant(context, tenantId, authorizedRole);
  const current = await getTenant(repository, context, tenantId);
  const expectedVersion = requireIfMatch(ifMatch);
  if (expectedVersion !== current.version) throw new TenantApplicationError('PRECONDITION_FAILED');
  const body = requireObject(input);
  if (Object.keys(body).some((key) => key !== 'name') || typeof body.name !== 'string') throw new TenantApplicationError('VALIDATION_ERROR');
  return repository.updateName(tenantId, requireName(body.name), expectedVersion);
}

export async function listLocations(repository: LocationRepository, context: RequestContext, tenantId: string, query: { readonly status?: LocationStatus; readonly search?: string; readonly limit?: number; readonly cursor?: string }): Promise<readonly Location[]> {
  try { assertUuid(tenantId, 'tenant_id'); } catch { throw new TenantApplicationError('VALIDATION_ERROR'); }
  authorizeTenant(context, tenantId);
  if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100)) throw new TenantApplicationError('VALIDATION_ERROR');
  if (query.cursor !== undefined && !query.cursor.trim()) throw new TenantApplicationError('VALIDATION_ERROR');
  if (query.status !== undefined && !['ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(query.status)) throw new TenantApplicationError('VALIDATION_ERROR');
  return repository.listByTenant({ tenantId, status: query.status, search: query.search?.trim(), limit: query.limit ?? 20, cursor: query.cursor });
}

export async function createLocation(repository: LocationRepository, context: RequestContext, tenantId: string, input: LocationCreate, authorizedRole: string, idempotencyKey: string): Promise<Location> {
  try { assertUuid(tenantId, 'tenant_id'); } catch { throw new TenantApplicationError('VALIDATION_ERROR'); }
  authorizeTenant(context, tenantId, authorizedRole);
  if (!idempotencyKey.trim() || idempotencyKey.length > 255) throw new TenantApplicationError('VALIDATION_ERROR');
  const body = requireObject(input);
  if (Object.keys(body).some((key) => !['name', 'address', 'phone'].includes(key)) || typeof body.name !== 'string' || typeof body.address !== 'string' || typeof body.phone !== 'string') throw new TenantApplicationError('VALIDATION_ERROR');
  const payload = { name: requireName(body.name), address: body.address.trim(), phone: body.phone.trim() };
  if (!payload.address || !payload.phone) throw new TenantApplicationError('VALIDATION_ERROR');
  const fingerprint = JSON.stringify(payload);
  const replay = await repository.findIdempotency({ tenantId, actorId: context.actor!.userId, endpoint: 'POST /api/v1/tenants/{tenant_id}/locations', key: idempotencyKey, fingerprint });
  if (replay.kind === 'REPLAY') return replay.location;
  if (replay.kind === 'CONFLICT') throw new TenantApplicationError('IDEMPOTENCY_CONFLICT');
  return repository.create({ tenantId, payload, idempotencyKey, actorId: context.actor!.userId, fingerprint });
}
