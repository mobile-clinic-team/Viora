export type LocationStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export interface Tenant {
  readonly id: string;
  readonly name: string;
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  readonly version: bigint;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Location {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly address: string;
  readonly phone: string;
  readonly status: LocationStatus;
  readonly version: bigint;
  readonly createdAt: string;
  readonly updatedAt: string;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertUuid(value: string, field: string): void {
  if (!uuidPattern.test(value)) throw new Error(`${field} must be a UUID`);
}

export function assertLocationStatusTransition(
  from: LocationStatus,
  to: LocationStatus,
  higherPrivilege: boolean,
): void {
  const allowed = (from === 'ACTIVE' && to === 'INACTIVE') ||
    (from === 'INACTIVE' && to === 'ACTIVE') ||
    (from === 'INACTIVE' && to === 'ARCHIVED') ||
    (from === 'ACTIVE' && to === 'ARCHIVED' && higherPrivilege);
  if (!allowed) throw new Error('invalid location status transition');
}
