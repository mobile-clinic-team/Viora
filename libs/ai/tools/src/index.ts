import type { RequestContext } from '../../../platform/context/src/index.ts';

export type KnowledgeDocumentStatus = 'DRAFT' | 'APPROVED' | 'ARCHIVED' | 'REVOKED';

export interface KnowledgeSearchRequest {
  readonly query: string;
  readonly limit?: number;
}

export interface KnowledgeSearchResult {
  readonly documentId: string;
  readonly chunkId: string;
  readonly title: string;
  readonly source: string;
  readonly snippet: string;
}

export interface KnowledgeSearchCandidate extends KnowledgeSearchResult {
  readonly tenantId: string;
  readonly status: KnowledgeDocumentStatus;
}

export interface KnowledgeSearchSource {
  search(input: {
    readonly query: string;
    readonly tenantId: string;
    readonly limit: number;
  }): Promise<readonly KnowledgeSearchCandidate[]>;
}

export interface KnowledgePermission {
  canSearch(context: RequestContext): boolean;
}

export interface KnowledgeSearchAudit {
  record(input: {
    readonly context: RequestContext;
    readonly queryLength: number;
    readonly resultCount: number;
    readonly outcome: 'ALLOWED' | 'DENIED' | 'FAILURE';
  }): Promise<void>;
}

export type KnowledgeSearchOutcome =
  | { readonly kind: 'RESULTS'; readonly results: readonly KnowledgeSearchResult[] }
  | { readonly kind: 'DENIED'; readonly reason: 'INVALID_CONTEXT' | 'MISSING_PERMISSION' }
  | { readonly kind: 'INVALID'; readonly reason: 'EMPTY_QUERY' | 'QUERY_TOO_LONG' | 'INVALID_LIMIT' }
  | { readonly kind: 'FAILED'; readonly reason: 'SEARCH_UNAVAILABLE' };

export interface KnowledgeSearchPort {
  search(context: RequestContext, request: KnowledgeSearchRequest): Promise<KnowledgeSearchOutcome>;
}

export interface KnowledgeSearchLimits {
  readonly maxQueryCharacters: number;
  readonly defaultLimit: number;
  readonly maxLimit: number;
  readonly maxSnippetCharacters: number;
}

const DEFAULT_LIMITS: KnowledgeSearchLimits = {
  maxQueryCharacters: 2_000,
  defaultLimit: 20,
  maxLimit: 20,
  maxSnippetCharacters: 2_000,
};

function authenticated(context: RequestContext): boolean {
  return Boolean(
    context && typeof context.requestId === 'string' && context.requestId.trim() &&
    typeof context.correlationId === 'string' && context.correlationId.trim() &&
    context.actor && typeof context.actor.userId === 'string' && context.actor.userId.trim() &&
    typeof context.actor.subject === 'string' && context.actor.subject.trim() &&
    context.tenant && typeof context.tenant.tenantId === 'string' && context.tenant.tenantId.trim() &&
    typeof context.tenant.membershipId === 'string' && context.tenant.membershipId.trim(),
  );
}

/** Tenant-only retrieval boundary; storage and embedding details stay behind the source port. */
export class TenantScopedKnowledgeSearch implements KnowledgeSearchPort {
  private readonly limits: KnowledgeSearchLimits;
  private readonly source: KnowledgeSearchSource;
  private readonly permission: KnowledgePermission;
  private readonly audit: KnowledgeSearchAudit;

  public constructor(
    source: KnowledgeSearchSource,
    permission: KnowledgePermission,
    audit: KnowledgeSearchAudit,
    limits: Partial<KnowledgeSearchLimits> = {},
  ) {
    this.source = source;
    this.permission = permission;
    this.audit = audit;
    this.limits = { ...DEFAULT_LIMITS, ...limits };
  }

  public async search(context: RequestContext, request: KnowledgeSearchRequest): Promise<KnowledgeSearchOutcome> {
    const deny = async (reason: 'INVALID_CONTEXT' | 'MISSING_PERMISSION'): Promise<KnowledgeSearchOutcome> => {
      await this.audit.record({ context, queryLength: typeof request?.query === 'string' ? request.query.length : 0, resultCount: 0, outcome: 'DENIED' });
      return { kind: 'DENIED', reason };
    };

    if (!authenticated(context)) return deny('INVALID_CONTEXT');
    if (!request || typeof request.query !== 'string' || request.query.trim().length === 0) {
      return { kind: 'INVALID', reason: 'EMPTY_QUERY' };
    }
    if (request.query.length > this.limits.maxQueryCharacters) {
      return { kind: 'INVALID', reason: 'QUERY_TOO_LONG' };
    }
    const limit = request.limit ?? this.limits.defaultLimit;
    if (!Number.isInteger(limit) || limit < 1 || limit > this.limits.maxLimit) {
      return { kind: 'INVALID', reason: 'INVALID_LIMIT' };
    }
    try {
      if (!this.permission.canSearch(context)) return deny('MISSING_PERMISSION');
    } catch {
      return deny('MISSING_PERMISSION');
    }

    try {
      const candidates = await this.source.search({ query: request.query.trim(), tenantId: context.tenant!.tenantId, limit });
      const results = candidates
        .filter((candidate) => candidate.tenantId === context.tenant!.tenantId && candidate.status === 'APPROVED')
        .slice(0, limit)
        .map((candidate) => ({
          documentId: candidate.documentId,
          chunkId: candidate.chunkId,
          title: candidate.title,
          source: candidate.source,
          snippet: candidate.snippet.slice(0, this.limits.maxSnippetCharacters),
        }));
      await this.audit.record({ context, queryLength: request.query.length, resultCount: results.length, outcome: 'ALLOWED' });
      return { kind: 'RESULTS', results };
    } catch {
      await this.audit.record({ context, queryLength: request.query.length, resultCount: 0, outcome: 'FAILURE' });
      return { kind: 'FAILED', reason: 'SEARCH_UNAVAILABLE' };
    }
  }
}
