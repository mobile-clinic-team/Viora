import type { AuditEvent, AuditEventInput } from '../../../audit/contracts/src/index.ts';

export interface AuditSink {
  append(event: AuditEvent): Promise<void>;
}

export class AuditValidationError extends Error {
  public constructor(message = 'invalid audit event') {
    super(message);
    this.name = 'AuditValidationError';
  }
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new AuditValidationError(`${field} is required`);
  return value.trim();
}

export function buildAuditEvent(input: AuditEventInput, now = new Date()): AuditEvent {
  if (!Number.isFinite(now.getTime())) throw new AuditValidationError('createdAt is invalid');
  const metadata = input.metadata;
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) throw new AuditValidationError('metadata is invalid');
  for (const value of Object.values(metadata)) {
    if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) throw new AuditValidationError('metadata contains unsupported value');
  }
  const result = input.result;
  if (result !== 'SUCCESS' && result !== 'DENIED' && result !== 'FAILURE') throw new AuditValidationError('result is invalid');
  return {
    id: text(input.id, 'id'), tenantId: text(input.tenantId, 'tenantId'), actorId: text(input.actorId, 'actorId'),
    action: text(input.action, 'action'), resourceType: text(input.resourceType, 'resourceType'), resourceId: text(input.resourceId, 'resourceId'),
    result, requestId: text(input.requestId, 'requestId'), correlationId: text(input.correlationId, 'correlationId'),
    metadata: { ...metadata }, createdAt: input.createdAt === undefined ? now.toISOString() : text(input.createdAt, 'createdAt'),
  };
}

export async function emitAuditEvent(sink: AuditSink, input: AuditEventInput): Promise<AuditEvent> {
  const event = buildAuditEvent(input);
  await sink.append(event);
  return event;
}
