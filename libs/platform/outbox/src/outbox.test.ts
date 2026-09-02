import { strict as assert } from 'node:assert';
import test from 'node:test';
import type {
  NewOutboxEvent,
  OutboxEvent,
  OutboxStore,
} from './index.ts';

const input: NewOutboxEvent = {
  tenantId: 'tenant-a',
  actorId: 'actor-a',
  requestId: 'request-a',
  correlationId: 'correlation-a',
  eventType: 'LocationCreated',
  aggregateType: 'Location',
  aggregateId: 'location-a',
  payload: { name: 'Main' },
};

class MemoryOutboxStore implements OutboxStore {
  private sequence = 0;
  private readonly events: OutboxEvent[] = [];

  public async append(event: NewOutboxEvent): Promise<OutboxEvent> {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const created: OutboxEvent = {
      ...event,
      id: `event-${++this.sequence}`,
      status: 'PENDING',
      attemptCount: 0,
      availableAt: now,
      createdAt: now,
      processedAt: null,
    };
    this.events.push(created);
    return created;
  }

  public async claimBatch(input: { readonly limit: number; readonly now?: Date }): Promise<readonly OutboxEvent[]> {
    const now = input.now ?? new Date();
    const claimed: OutboxEvent[] = [];
    for (const event of this.events) {
      if (claimed.length >= input.limit) break;
      if (event.status === 'PENDING' && event.availableAt <= now) {
        const next = { ...event, status: 'PROCESSING' as const, attemptCount: event.attemptCount + 1 };
        this.events[this.events.indexOf(event)] = next;
        claimed.push(next);
      }
    }
    return claimed;
  }

  public async markCompleted(input: { readonly eventId: string; readonly processedAt?: Date }): Promise<OutboxEvent> {
    const event = this.events.find((candidate) => candidate.id === input.eventId);
    assert.ok(event);
    const next = { ...event, status: 'COMPLETED' as const, processedAt: input.processedAt ?? new Date() };
    this.events[this.events.indexOf(event)] = next;
    return next;
  }

  public async markFailed(input: { readonly eventId: string; readonly maxRetries: number; readonly failedAt?: Date }): Promise<OutboxEvent> {
    const event = this.events.find((candidate) => candidate.id === input.eventId);
    assert.ok(event);
    const status = event.attemptCount >= input.maxRetries ? 'FAILED' as const : 'PENDING' as const;
    const next = { ...event, status, processedAt: status === 'FAILED' ? input.failedAt ?? new Date() : null };
    this.events[this.events.indexOf(event)] = next;
    return next;
  }
}

test('append preserves tenant, actor, request, and correlation context', async () => {
  const store = new MemoryOutboxStore();
  const event = await store.append(input);
  assert.equal(event.tenantId, 'tenant-a');
  assert.equal(event.actorId, 'actor-a');
  assert.equal(event.requestId, 'request-a');
  assert.equal(event.correlationId, 'correlation-a');
  assert.equal(event.status, 'PENDING');
  assert.equal(event.attemptCount, 0);
});

test('claimBatch claims pending events and increments attemptCount', async () => {
  const store = new MemoryOutboxStore();
  await store.append(input);
  await store.append({ ...input, aggregateId: 'location-b' });
  const claimed = await store.claimBatch({ limit: 1, now: new Date('2026-01-01T00:00:00.000Z') });
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0].status, 'PROCESSING');
  assert.equal(claimed[0].attemptCount, 1);
});

test('markCompleted transitions a processing event to completed', async () => {
  const store = new MemoryOutboxStore();
  const created = await store.append(input);
  await store.claimBatch({ limit: 1, now: created.createdAt });
  const completed = await store.markCompleted({ eventId: created.id, processedAt: new Date('2026-01-01T00:01:00.000Z') });
  assert.equal(completed.status, 'COMPLETED');
  assert.equal(completed.processedAt?.toISOString(), '2026-01-01T00:01:00.000Z');
});

test('markFailed increments retry state and dead-letters after max retries', async () => {
  const store = new MemoryOutboxStore();
  const created = await store.append(input);
  await store.claimBatch({ limit: 1, now: created.createdAt });
  const retryable = await store.markFailed({ eventId: created.id, maxRetries: 2 });
  assert.equal(retryable.status, 'PENDING');
  await store.claimBatch({ limit: 1, now: created.createdAt });
  const failed = await store.markFailed({ eventId: created.id, maxRetries: 2, failedAt: new Date('2026-01-01T00:02:00.000Z') });
  assert.equal(failed.status, 'FAILED');
  assert.equal(failed.attemptCount, 2);
});

test('outbox status flow is pending, processing, then completed or failed', async () => {
  const store = new MemoryOutboxStore();
  const created = await store.append(input);
  assert.equal(created.status, 'PENDING');
  const [processing] = await store.claimBatch({ limit: 1, now: created.createdAt });
  assert.equal(processing.status, 'PROCESSING');
  const completed = await store.markCompleted({ eventId: created.id });
  assert.equal(completed.status, 'COMPLETED');
});
