export type OutboxStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface NewOutboxEvent {
  readonly tenantId: string;
  readonly actorId: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly eventType: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly payload: JsonValue;
}

export interface OutboxEvent extends NewOutboxEvent {
  readonly id: string;
  readonly status: OutboxStatus;
  readonly attemptCount: number;
  readonly availableAt: Date;
  readonly createdAt: Date;
  readonly processedAt: Date | null;
}

export interface OutboxStore {
  append(input: NewOutboxEvent): Promise<OutboxEvent>;
  claimBatch(input: {
    readonly limit: number;
    readonly now?: Date;
  }): Promise<readonly OutboxEvent[]>;
  markCompleted(input: {
    readonly eventId: string;
    readonly processedAt?: Date;
  }): Promise<OutboxEvent>;
  markFailed(input: {
    readonly eventId: string;
    readonly maxRetries: number;
    readonly failedAt?: Date;
  }): Promise<OutboxEvent>;
}
