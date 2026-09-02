import type { Location, Tenant } from '../../domain/src/index.ts';
import type { LocationCreate } from '../../contracts/src/index.ts';

export interface TenantRepository {
  findById(tenantId: string): Promise<Tenant | null>;
  updateName(tenantId: string, name: string, expectedVersion: bigint): Promise<Tenant>;
}

export type IdempotencyLookup =
  | { readonly kind: 'NEW' }
  | { readonly kind: 'REPLAY'; readonly location: Location }
  | { readonly kind: 'CONFLICT' };

export interface LocationRepository {
  listByTenant(input: { readonly tenantId: string; readonly status?: Location['status']; readonly search?: string; readonly limit: number; readonly cursor?: string }): Promise<readonly Location[]>;
  findIdempotency(input: { readonly tenantId: string; readonly actorId: string; readonly endpoint: string; readonly key: string; readonly fingerprint: string }): Promise<IdempotencyLookup>;
  create(input: { readonly tenantId: string; readonly actorId: string; readonly idempotencyKey: string; readonly fingerprint: string; readonly payload: LocationCreate }): Promise<Location>;
}
