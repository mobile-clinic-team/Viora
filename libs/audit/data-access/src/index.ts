import type { AuditEvent } from '../../contracts/src/index.ts';

export interface AuditQueryResult<Row extends Record<string, unknown> = Record<string, unknown>> {
  readonly rows: readonly Row[];
}

export interface AuditQueryClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<AuditQueryResult<Row>>;
}

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

type AuditRow = {
  readonly id: string;
  readonly tenant_id: string;
  readonly actor_id: string;
  readonly action: string;
  readonly resource_type: string;
  readonly resource_id: string;
  readonly result: AuditEvent['result'];
  readonly request_id: string;
  readonly correlation_id: string;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
  readonly created_at: string | Date;
};

function toAuditEvent(row: AuditRow): AuditEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    actorId: row.actor_id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    result: row.result,
    requestId: row.request_id,
    correlationId: row.correlation_id,
    metadata: row.metadata,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
  };
}

function eventPayload(event: AuditEvent): string {
  const payload = {
    id: event.id,
    tenantId: event.tenantId,
    actorId: event.actorId,
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId,
    result: event.result,
    requestId: event.requestId,
    correlationId: event.correlationId,
    metadata: event.metadata,
    createdAt: new Date(event.createdAt).toISOString(),
  };
  return JSON.stringify(payload, (_key, value: unknown) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)));
  });
}

/** Raw SQL adapter for the immutable audit_events persistence boundary. */
export class PostgresAuditEventRepository implements AuditEventRepository {
  private readonly database: AuditQueryClient;

  public constructor(database: AuditQueryClient) {
    this.database = database;
  }

  public async append(event: AuditEvent): Promise<AuditAppendResult> {
    const inserted = await this.database.query<AuditRow>(
      `INSERT INTO audit_events
        (id, tenant_id, actor_id, action, resource_type, resource_id, result,
         request_id, correlation_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::timestamptz)
       ON CONFLICT (id) DO NOTHING
       RETURNING id, tenant_id, actor_id, action, resource_type, resource_id,
                 result, request_id, correlation_id, metadata, created_at`,
      [event.id, event.tenantId, event.actorId, event.action, event.resourceType,
        event.resourceId, event.result, event.requestId, event.correlationId,
        JSON.stringify(event.metadata), event.createdAt],
    );
    if (inserted.rows[0]) return { kind: 'APPENDED', event: toAuditEvent(inserted.rows[0]) };

    const existing = await this.database.query<AuditRow>(
      `SELECT id, tenant_id, actor_id, action, resource_type, resource_id,
              result, request_id, correlation_id, metadata, created_at
         FROM audit_events WHERE id = $1`,
      [event.id],
    );
    const existingEvent = existing.rows[0] && toAuditEvent(existing.rows[0]);
    if (!existingEvent) throw new Error('audit event conflict could not be resolved');
    return { kind: eventPayload(existingEvent) === eventPayload(event) ? 'REPLAY' : 'CONFLICT', event: existingEvent };
  }

  public async listByTenant(input: { readonly tenantId: string; readonly limit: number; readonly cursor?: string }): Promise<readonly AuditEvent[]> {
    validateAuditListInput(input);
    const cursor = input.cursor === undefined ? undefined : decodeAuditCursor(input.cursor, input.tenantId);
    const result = await this.database.query<AuditRow>(
      `SELECT id, tenant_id, actor_id, action, resource_type, resource_id,
              result, request_id, correlation_id, metadata, created_at
         FROM audit_events
        WHERE tenant_id = $1
          AND ($2::timestamptz IS NULL OR (created_at, id) > ($2::timestamptz, $3::uuid))
        ORDER BY created_at ASC, id ASC
        LIMIT $4`,
      [input.tenantId, cursor?.createdAt ?? null, cursor?.eventId ?? null, input.limit],
    );
    return result.rows.map(toAuditEvent);
  }
}
