import type { AuditEvent } from '../../contracts/src/index.ts';

export interface AuditCursor {
  readonly tenantId: string;
  readonly createdAt: string;
  readonly eventId: string;
}

export class AuditRepositoryInputError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'AuditRepositoryInputError';
  }
}

export type AuditAppendResult =
  | { readonly kind: 'APPENDED'; readonly event: AuditEvent }
  | { readonly kind: 'REPLAY'; readonly event: AuditEvent }
  | { readonly kind: 'CONFLICT'; readonly event: AuditEvent };

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AuditRepositoryInputError(`${field} is required`);
  }
  return value.trim();
}

function assertCursor(cursor: AuditCursor): void {
  requiredText(cursor.tenantId, 'cursor.tenantId');
  requiredText(cursor.createdAt, 'cursor.createdAt');
  requiredText(cursor.eventId, 'cursor.eventId');
  if (!Number.isFinite(Date.parse(cursor.createdAt))) {
    throw new AuditRepositoryInputError('cursor.createdAt is invalid');
  }
}

export function encodeAuditCursor(cursor: AuditCursor): string {
  assertCursor(cursor);
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeAuditCursor(value: string, expectedTenantId: string): AuditCursor {
  requiredText(expectedTenantId, 'tenantId');
  if (!/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new AuditRepositoryInputError('cursor is not opaque base64url');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw new AuditRepositoryInputError('cursor is invalid');
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AuditRepositoryInputError('cursor payload is invalid');
  }
  const cursor = parsed as Partial<AuditCursor>;
  assertCursor(cursor as AuditCursor);
  if (cursor.tenantId !== expectedTenantId) {
    throw new AuditRepositoryInputError('cursor tenant does not match query tenant');
  }
  return cursor as AuditCursor;
}

export function validateAuditListInput(input: {
  readonly tenantId: string;
  readonly limit: number;
  readonly cursor?: string;
}): void {
  const tenantId = requiredText(input.tenantId, 'tenantId');
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) {
    throw new AuditRepositoryInputError('limit must be between 1 and 100');
  }
  if (input.cursor !== undefined) decodeAuditCursor(input.cursor, tenantId);
}

export interface AuditEventRepository {
  /**
   * Implementations must never update or delete an existing event. Repeating
   * the same id and payload is a replay; reusing an id with another payload
   * is a conflict.
   */
  append(event: AuditEvent): Promise<AuditAppendResult>;
  listByTenant(input: {
    readonly tenantId: string;
    readonly limit: number;
    /** Opaque keyset cursor ordered by createdAt, then eventId. */
    readonly cursor?: string;
  }): Promise<readonly AuditEvent[]>;
}
