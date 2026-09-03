import { createHash } from 'node:crypto';

export type IdempotencyStatus = 'PROCESSING' | 'SUCCEEDED' | 'FAILED';

export interface IdempotencyIdentity {
  readonly tenantId: string;
  readonly actorId: string;
  readonly endpoint: string;
  readonly key: string;
}

export interface IdempotencyRecord extends IdempotencyIdentity {
  readonly requestHash: string;
  readonly status: IdempotencyStatus;
  readonly responseCode: number | null;
  readonly responseReference: string | null;
  readonly createdAt: Date;
  readonly expiresAt: Date;
}

export type IdempotencyLookupResult =
  | { readonly kind: 'NEW' }
  | { readonly kind: 'REPLAY'; readonly record: IdempotencyRecord }
  | { readonly kind: 'CONFLICT'; readonly record: IdempotencyRecord }
  | { readonly kind: 'IN_PROGRESS'; readonly record: IdempotencyRecord };

export type BeginResult =
  | { readonly kind: 'STARTED'; readonly record: IdempotencyRecord }
  | { readonly kind: 'REPLAY'; readonly record: IdempotencyRecord }
  | { readonly kind: 'CONFLICT'; readonly record: IdempotencyRecord };

export interface IdempotencyStore {
  lookup(input: IdempotencyIdentity & {
    readonly requestHash: string;
    readonly now?: Date;
  }): Promise<IdempotencyLookupResult>;

  begin(input: IdempotencyIdentity & {
    readonly requestHash: string;
    readonly now?: Date;
    readonly ttlSeconds?: number;
  }): Promise<BeginResult>;

  complete(input: IdempotencyIdentity & {
    readonly responseCode: number;
    readonly responseReference: string | null;
    readonly completedAt?: Date;
  }): Promise<IdempotencyRecord>;

  fail(input: IdempotencyIdentity & {
    readonly responseCode?: number;
    readonly responseReference?: string | null;
    readonly failedAt?: Date;
  }): Promise<IdempotencyRecord>;
}

export type IdempotencyErrorCode =
  | 'INVALID_KEY'
  | 'INVALID_PAYLOAD'
  | 'INVALID_TTL'
  | 'IDEMPOTENCY_CONFLICT';

export class IdempotencyError extends Error {
  public readonly code: IdempotencyErrorCode;

  public constructor(code: IdempotencyErrorCode, message = code) {
    super(message);
    this.name = 'IdempotencyError';
    this.code = code;
  }
}

export function assertValidIdempotencyKey(key: unknown): asserts key is string {
  if (typeof key !== 'string' || key.length < 1 || key.length > 255 || !key.trim()) {
    throw new IdempotencyError('INVALID_KEY');
  }
}

type CanonicalJson = null | boolean | number | string | readonly CanonicalJson[] | {
  readonly [key: string]: CanonicalJson;
};

function normalize(value: unknown, ancestors: WeakSet<object>): CanonicalJson {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return typeof value === 'string' ? value.trim() : value;
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new IdempotencyError('INVALID_PAYLOAD');
    return value;
  }

  if (typeof value !== 'object' || value === null) {
    throw new IdempotencyError('INVALID_PAYLOAD');
  }

  if (ancestors.has(value)) throw new IdempotencyError('INVALID_PAYLOAD');
  ancestors.add(value);

  try {
    if (Array.isArray(value)) {
      const normalized: CanonicalJson[] = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) throw new IdempotencyError('INVALID_PAYLOAD');
        normalized.push(normalize(value[index], ancestors));
      }
      return normalized;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new IdempotencyError('INVALID_PAYLOAD');
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new IdempotencyError('INVALID_PAYLOAD');
    }

    const normalized: Record<string, CanonicalJson> = {};
    for (const key of Object.keys(value).sort()) {
      normalized[key] = normalize((value as Record<string, unknown>)[key], ancestors);
    }
    return normalized;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalizePayload(payload: unknown): string {
  const canonicalPayload = JSON.stringify(normalize(payload, new WeakSet<object>()));
  if (canonicalPayload === undefined) throw new IdempotencyError('INVALID_PAYLOAD');
  return canonicalPayload;
}

export async function hashPayload(payload: unknown): Promise<string> {
  const canonicalPayload = canonicalizePayload(payload);
  const webCrypto = globalThis.crypto;

  if (webCrypto?.subtle) {
    const bytes = await webCrypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(canonicalPayload),
    );
    return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  return createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
}

export function getDefaultTtlSeconds(): number {
  return 24 * 60 * 60;
}

export function buildExpiresAt(
  now: Date = new Date(),
  ttlSeconds = getDefaultTtlSeconds(),
): Date {
  if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0 || !Number.isFinite(now.getTime())) {
    throw new IdempotencyError('INVALID_TTL');
  }
  return new Date(now.getTime() + ttlSeconds * 1000);
}
