import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  assertValidIdempotencyKey,
  buildExpiresAt,
  canonicalizePayload,
  getDefaultTtlSeconds,
  hashPayload,
  IdempotencyError,
  type IdempotencyRecord,
  type IdempotencyStore,
} from './index.ts';

function identity(key = 'key-1') {
  return {
    tenantId: 'tenant-a',
    actorId: 'actor-a',
    endpoint: 'POST /api/v1/locations',
    key,
  } as const;
}

function record(overrides: Partial<IdempotencyRecord> = {}): IdempotencyRecord {
  return {
    ...identity(),
    requestHash: 'hash-a',
    status: 'PROCESSING',
    responseCode: null,
    responseReference: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    expiresAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly records = new Map<string, IdempotencyRecord>();

  private key(input: { readonly tenantId: string; readonly actorId: string; readonly endpoint: string; readonly key: string }): string {
    return [input.tenantId, input.actorId, input.endpoint, input.key].join('|');
  }

  public async lookup(input: Parameters<IdempotencyStore['lookup']>[0]) {
    const existing = this.records.get(this.key(input));
    if (!existing || (input.now && existing.expiresAt <= input.now)) return { kind: 'NEW' as const };
    if (existing.requestHash !== input.requestHash) return { kind: 'CONFLICT' as const, record: existing };
    if (existing.status === 'PROCESSING') return { kind: 'IN_PROGRESS' as const, record: existing };
    return { kind: 'REPLAY' as const, record: existing };
  }

  public async begin(input: Parameters<IdempotencyStore['begin']>[0]) {
    const now = input.now ?? new Date('2026-01-01T00:00:00.000Z');
    const lookup = await this.lookup(input);
    if (lookup.kind === 'CONFLICT' || lookup.kind === 'REPLAY') return lookup;
    if (lookup.kind === 'IN_PROGRESS') return { kind: 'CONFLICT' as const, record: lookup.record };
    const next = record({
      ...identity(input.key),
      tenantId: input.tenantId,
      actorId: input.actorId,
      endpoint: input.endpoint,
      requestHash: input.requestHash,
      createdAt: now,
      expiresAt: buildExpiresAt(now, input.ttlSeconds),
    });
    this.records.set(this.key(input), next);
    return { kind: 'STARTED' as const, record: next };
  }

  public async complete(input: Parameters<IdempotencyStore['complete']>[0]) {
    const current = this.records.get(this.key(input));
    assert.ok(current);
    const next = { ...current, status: 'SUCCEEDED' as const, responseCode: input.responseCode, responseReference: input.responseReference };
    this.records.set(this.key(input), next);
    return next;
  }

  public async fail(input: Parameters<IdempotencyStore['fail']>[0]) {
    const current = this.records.get(this.key(input));
    assert.ok(current);
    const next = { ...current, status: 'FAILED' as const, responseCode: input.responseCode ?? null, responseReference: input.responseReference ?? null };
    this.records.set(this.key(input), next);
    return next;
  }
}

test('accepts idempotency keys from 1 through 255 characters', () => {
  assert.doesNotThrow(() => assertValidIdempotencyKey('a'));
  assert.doesNotThrow(() => assertValidIdempotencyKey('a'.repeat(255)));
  assert.throws(() => assertValidIdempotencyKey(''), (error: unknown) => error instanceof IdempotencyError && error.code === 'INVALID_KEY');
  assert.throws(() => assertValidIdempotencyKey('a'.repeat(256)), (error: unknown) => error instanceof IdempotencyError && error.code === 'INVALID_KEY');
  assert.throws(() => assertValidIdempotencyKey('   '), (error: unknown) => error instanceof IdempotencyError && error.code === 'INVALID_KEY');
});

test('canonicalization sorts keys and trims strings', () => {
  assert.equal(canonicalizePayload({ b: ' value ', a: [' x ', 1] }), '{"a":["x",1],"b":"value"}');
  assert.equal(canonicalizePayload({ a: 1, b: 2 }), canonicalizePayload({ b: 2, a: 1 }));
});

test('canonicalization rejects non-plain or non-JSON data', () => {
  assert.throws(() => canonicalizePayload(new Date()), /IdempotencyError/);
  assert.throws(() => canonicalizePayload({ value: undefined }), /IdempotencyError/);
});

test('hashPayload is deterministic for logically equivalent payloads', async () => {
  const first = await hashPayload({ b: ' value ', a: 1 });
  const second = await hashPayload({ a: 1, b: 'value' });
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{64}$/);
});

test('lookup returns NEW for an unknown identity', async () => {
  const store = new MemoryIdempotencyStore();
  assert.deepEqual(await store.lookup({ ...identity(), requestHash: 'hash-a' }), { kind: 'NEW' });
});

test('begin, complete, and lookup provide replay behavior', async () => {
  const store = new MemoryIdempotencyStore();
  const started = await store.begin({ ...identity(), requestHash: 'hash-a' });
  assert.equal(started.kind, 'STARTED');
  await store.complete({ ...identity(), responseCode: 201, responseReference: 'location-1' });
  const replay = await store.lookup({ ...identity(), requestHash: 'hash-a' });
  assert.equal(replay.kind, 'REPLAY');
  if (replay.kind === 'REPLAY') assert.equal(replay.record.responseReference, 'location-1');
});

test('same key with a different hash returns conflict', async () => {
  const store = new MemoryIdempotencyStore();
  await store.begin({ ...identity(), requestHash: 'hash-a' });
  const conflict = await store.lookup({ ...identity(), requestHash: 'hash-b' });
  assert.equal(conflict.kind, 'CONFLICT');
});

test('concurrent same-key begin is represented as in progress and must fail closed', async () => {
  const store = new MemoryIdempotencyStore();
  await store.begin({ ...identity(), requestHash: 'hash-a' });
  const concurrent = await store.begin({ ...identity(), requestHash: 'hash-a' });
  assert.equal(concurrent.kind, 'CONFLICT');
});

test('default TTL and expiration helper use 24 hours', () => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  assert.equal(getDefaultTtlSeconds(), 86_400);
  assert.equal(buildExpiresAt(now).toISOString(), '2026-01-02T00:00:00.000Z');
});
