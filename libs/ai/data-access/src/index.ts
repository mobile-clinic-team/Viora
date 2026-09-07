import { randomUUID } from 'node:crypto';
import type { AiDraft, AiDraftRepository, AiDraftStatus } from '../../tools/src/clinical-draft-workflow.ts';
import type { KnowledgeDocumentStatus } from '../../tools/src/index.ts';

export interface AiQueryResult<Row extends Record<string, unknown> = Record<string, unknown>> {
  readonly rows: readonly Row[];
}

export interface AiQueryClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<AiQueryResult<Row>>;
}

export class AiRepositoryInputError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'AiRepositoryInputError';
  }
}

type DraftRow = {
  readonly id: string;
  readonly tenant_id: string;
  readonly patient_id: string;
  readonly encounter_id: string | null;
  readonly created_by: string;
  readonly draft_type: string;
  readonly content: AiDraft['content'];
  readonly version: bigint | string | number;
  readonly status: AiDraftStatus;
  readonly approved_by: string | null;
  readonly approved_at: string | Date | null;
  readonly rejected_by: string | null;
  readonly rejected_at: string | Date | null;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
};

function requiredText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new AiRepositoryInputError(`${field} is required`);
  return value.trim();
}

function iso(value: string | Date | null): string | null {
  return value === null ? null : value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function version(value: bigint | string | number): bigint {
  try {
    return typeof value === 'bigint' ? value : BigInt(value);
  } catch {
    throw new AiRepositoryInputError('draft version is invalid');
  }
}

function toDraft(row: DraftRow): AiDraft {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    patientId: row.patient_id,
    encounterId: row.encounter_id,
    createdBy: row.created_by,
    draftType: row.draft_type,
    content: row.content,
    version: version(row.version),
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: iso(row.approved_at),
    rejectedBy: row.rejected_by,
    rejectedAt: iso(row.rejected_at),
    createdAt: iso(row.created_at)!,
    updatedAt: iso(row.updated_at)!,
  };
}

const columns = `id, tenant_id, patient_id, encounter_id, created_by, draft_type,
  content, version, status, approved_by, approved_at, rejected_by, rejected_at,
  created_at, updated_at`;

export class PostgresAiDraftRepository implements AiDraftRepository {
  private readonly database: AiQueryClient;

  public constructor(database: AiQueryClient) {
    this.database = database;
  }

  public async create(input: Omit<AiDraft, 'id' | 'createdAt' | 'updatedAt'>): Promise<AiDraft> {
    const tenantId = requiredText(input.tenantId, 'tenantId');
    const patientId = requiredText(input.patientId, 'patientId');
    const createdBy = requiredText(input.createdBy, 'createdBy');
    const draftType = requiredText(input.draftType, 'draftType');
    if (input.version < 1n) throw new AiRepositoryInputError('version must be positive');
    const result = await this.database.query<DraftRow>(
      `INSERT INTO ai_drafts
        (id, tenant_id, patient_id, encounter_id, created_by, draft_type, content,
         version, status, approved_by, approved_at, rejected_by, rejected_at,
         created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9,
               $10, $11::timestamptz, $12, $13::timestamptz, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING ${columns}`,
      [randomUUID(), tenantId, patientId, input.encounterId, createdBy, draftType,
        JSON.stringify(input.content), input.version.toString(), input.status,
        input.approvedBy, input.approvedAt, input.rejectedBy, input.rejectedAt],
    );
    if (!result.rows[0]) throw new AiRepositoryInputError('draft was not created');
    return toDraft(result.rows[0]);
  }

  public async findById(input: { readonly tenantId: string; readonly draftId: string }): Promise<AiDraft | null> {
    const tenantId = requiredText(input.tenantId, 'tenantId');
    const draftId = requiredText(input.draftId, 'draftId');
    const result = await this.database.query<DraftRow>(
      `SELECT ${columns} FROM ai_drafts WHERE tenant_id = $1 AND id = $2`,
      [tenantId, draftId],
    );
    return result.rows[0] ? toDraft(result.rows[0]) : null;
  }

  public async transition(input: {
    readonly tenantId: string;
    readonly draftId: string;
    readonly from: AiDraftStatus;
    readonly expectedVersion: bigint;
    readonly to: Exclude<AiDraftStatus, 'GENERATED' | 'EXPIRED'>;
    readonly actorId: string;
    readonly at: string;
  }): Promise<AiDraft | null> {
    const tenantId = requiredText(input.tenantId, 'tenantId');
    const draftId = requiredText(input.draftId, 'draftId');
    const actorId = requiredText(input.actorId, 'actorId');
    if (input.expectedVersion < 1n) throw new AiRepositoryInputError('expectedVersion must be positive');
    const isApproval = input.to === 'APPROVED';
    const isRejection = input.to === 'REJECTED';
    const result = await this.database.query<DraftRow>(
      `UPDATE ai_drafts
          SET status = $1::ai_draft_status,
              version = version + 1,
              approved_by = CASE WHEN $2 THEN $3::uuid ELSE approved_by END,
              approved_at = CASE WHEN $2 THEN $4::timestamptz ELSE approved_at END,
              rejected_by = CASE WHEN $5 THEN $3::uuid ELSE rejected_by END,
              rejected_at = CASE WHEN $5 THEN $4::timestamptz ELSE rejected_at END,
              updated_at = $4::timestamptz
        WHERE tenant_id = $6 AND id = $7 AND status = $8::ai_draft_status AND version = $9
       RETURNING ${columns}`,
      [input.to, isApproval, isApproval || isRejection ? actorId : null, input.at,
        isRejection, tenantId, draftId, input.from, input.expectedVersion.toString()],
    );
    return result.rows[0] ? toDraft(result.rows[0]) : null;
  }
}

export interface AiConversation {
  readonly id: string; readonly tenantId: string; readonly userId: string;
  readonly patientId: string | null; readonly contextType: string | null;
  readonly contextId: string | null; readonly status: string;
  readonly createdAt: string; readonly updatedAt: string;
}
export interface AiMessage {
  readonly id: string; readonly conversationId: string;
  readonly role: 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';
  readonly contentReference: string; readonly createdAt: string;
}
export interface KnowledgeDocument {
  readonly id: string; readonly tenantId: string; readonly title: string;
  readonly source: string; readonly documentType: string;
  readonly status: KnowledgeDocumentStatus; readonly createdAt: string; readonly updatedAt: string;
}
export interface KnowledgeChunk {
  readonly id: string; readonly documentId: string; readonly tenantId: string;
  readonly content: string; readonly embedding: readonly number[];
  readonly metadata: Readonly<Record<string, unknown>>; readonly createdAt: string;
}

export interface AiConversationRepository {
  create(input: Omit<AiConversation, 'id' | 'createdAt' | 'updatedAt'>): Promise<AiConversation>;
  findById(input: { readonly tenantId: string; readonly id: string }): Promise<AiConversation | null>;
}
export interface AiMessageRepository {
  append(input: Omit<AiMessage, 'id' | 'createdAt'> & { readonly tenantId: string }): Promise<AiMessage>;
  listByConversation(input: { readonly tenantId: string; readonly conversationId: string; readonly limit: number }): Promise<readonly AiMessage[]>;
}
export interface KnowledgeDocumentRepository {
  create(input: Omit<KnowledgeDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeDocument>;
  setStatus(input: { readonly tenantId: string; readonly id: string; readonly status: KnowledgeDocumentStatus }): Promise<KnowledgeDocument | null>;
}
export interface KnowledgeChunkRepository {
  append(input: Omit<KnowledgeChunk, 'id' | 'createdAt'>): Promise<KnowledgeChunk>;
  searchByEmbedding(input: { readonly tenantId: string; readonly embedding: readonly number[]; readonly limit: number }): Promise<readonly (KnowledgeChunk & { readonly documentId: string; readonly title: string; readonly source: string; readonly status: KnowledgeDocumentStatus; readonly distance: number })[]>;
}

type ConversationRow = { id: string; tenant_id: string; user_id: string; patient_id: string | null; context_type: string | null; context_id: string | null; status: string; created_at: string | Date; updated_at: string | Date };
type MessageRow = { id: string; conversation_id: string; role: AiMessage['role']; content_reference: string; created_at: string | Date };
type DocumentRow = { id: string; tenant_id: string; title: string; source: string; document_type: string; status: KnowledgeDocumentStatus; created_at: string | Date; updated_at: string | Date };
type ChunkRow = { id: string; document_id: string; tenant_id: string; content: string; embedding: readonly number[]; metadata: Readonly<Record<string, unknown>>; created_at: string | Date; distance?: number };

function aiIso(value: string | Date): string { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }
function vector(value: readonly number[]): string {
  if (value.length !== 1536 || value.some((item) => !Number.isFinite(item))) throw new AiRepositoryInputError('embedding must contain 1536 finite numbers');
  return `[${value.join(',')}]`;
}
function mapConversation(row: ConversationRow): AiConversation { return { id: row.id, tenantId: row.tenant_id, userId: row.user_id, patientId: row.patient_id, contextType: row.context_type, contextId: row.context_id, status: row.status, createdAt: aiIso(row.created_at), updatedAt: aiIso(row.updated_at) }; }
function mapMessage(row: MessageRow): AiMessage { return { id: row.id, conversationId: row.conversation_id, role: row.role, contentReference: row.content_reference, createdAt: aiIso(row.created_at) }; }
function mapDocument(row: DocumentRow): KnowledgeDocument { return { id: row.id, tenantId: row.tenant_id, title: row.title, source: row.source, documentType: row.document_type, status: row.status, createdAt: aiIso(row.created_at), updatedAt: aiIso(row.updated_at) }; }

export class PostgresAiConversationRepository implements AiConversationRepository {
  private readonly database: AiQueryClient;
  public constructor(database: AiQueryClient) { this.database = database; }
  public async create(input: Omit<AiConversation, 'id' | 'createdAt' | 'updatedAt'>): Promise<AiConversation> {
    const result = await this.database.query<ConversationRow>(
      `INSERT INTO ai_conversations (id, tenant_id, user_id, patient_id, context_type, context_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id, tenant_id, user_id, patient_id, context_type, context_id, status, created_at, updated_at`,
      [randomUUID(), input.tenantId, input.userId, input.patientId, input.contextType, input.contextId, input.status],
    );
    if (!result.rows[0]) throw new AiRepositoryInputError('conversation was not created');
    return mapConversation(result.rows[0]);
  }
  public async findById(input: { readonly tenantId: string; readonly id: string }): Promise<AiConversation | null> {
    const result = await this.database.query<ConversationRow>(`SELECT id, tenant_id, user_id, patient_id, context_type, context_id, status, created_at, updated_at FROM ai_conversations WHERE tenant_id = $1 AND id = $2`, [input.tenantId, input.id]);
    return result.rows[0] ? mapConversation(result.rows[0]) : null;
  }
}

export class PostgresAiMessageRepository implements AiMessageRepository {
  private readonly database: AiQueryClient;
  public constructor(database: AiQueryClient) { this.database = database; }
  public async append(input: Omit<AiMessage, 'id' | 'createdAt'> & { readonly tenantId: string }): Promise<AiMessage> {
    const result = await this.database.query<MessageRow>(
      `INSERT INTO ai_messages (id, conversation_id, role, content_reference, created_at)
       SELECT $1, c.id, $3::ai_message_role, $4, CURRENT_TIMESTAMP FROM ai_conversations c WHERE c.id = $2 AND c.tenant_id = $5
       RETURNING id, conversation_id, role, content_reference, created_at`,
      [randomUUID(), input.conversationId, input.role, input.contentReference, input.tenantId],
    );
    if (!result.rows[0]) throw new AiRepositoryInputError('conversation is unavailable for tenant');
    return mapMessage(result.rows[0]);
  }
  public async listByConversation(input: { readonly tenantId: string; readonly conversationId: string; readonly limit: number }): Promise<readonly AiMessage[]> {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) throw new AiRepositoryInputError('limit must be between 1 and 100');
    const result = await this.database.query<MessageRow>(`SELECT m.id, m.conversation_id, m.role, m.content_reference, m.created_at FROM ai_messages m JOIN ai_conversations c ON c.id = m.conversation_id AND c.tenant_id = $1 WHERE m.conversation_id = $2 ORDER BY m.created_at ASC, m.id ASC LIMIT $3`, [input.tenantId, input.conversationId, input.limit]);
    return result.rows.map(mapMessage);
  }
}

export class PostgresKnowledgeDocumentRepository implements KnowledgeDocumentRepository {
  private readonly database: AiQueryClient;
  public constructor(database: AiQueryClient) { this.database = database; }
  public async create(input: Omit<KnowledgeDocument, 'id' | 'createdAt' | 'updatedAt'>): Promise<KnowledgeDocument> {
    const result = await this.database.query<DocumentRow>(`INSERT INTO knowledge_documents (id, tenant_id, title, source, document_type, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP) RETURNING id, tenant_id, title, source, document_type, status, created_at, updated_at`, [randomUUID(), input.tenantId, input.title, input.source, input.documentType, input.status]);
    if (!result.rows[0]) throw new AiRepositoryInputError('document was not created');
    return mapDocument(result.rows[0]);
  }
  public async setStatus(input: { readonly tenantId: string; readonly id: string; readonly status: KnowledgeDocumentStatus }): Promise<KnowledgeDocument | null> {
    const result = await this.database.query<DocumentRow>(`UPDATE knowledge_documents SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $2 AND id = $3 RETURNING id, tenant_id, title, source, document_type, status, created_at, updated_at`, [input.status, input.tenantId, input.id]);
    return result.rows[0] ? mapDocument(result.rows[0]) : null;
  }
}

export class PostgresKnowledgeChunkRepository implements KnowledgeChunkRepository {
  private readonly database: AiQueryClient;
  public constructor(database: AiQueryClient) { this.database = database; }
  public async append(input: Omit<KnowledgeChunk, 'id' | 'createdAt'>): Promise<KnowledgeChunk> {
    const result = await this.database.query<ChunkRow>(`INSERT INTO knowledge_chunks (id, document_id, tenant_id, content, embedding, metadata, created_at) SELECT $1, d.id, d.tenant_id, $4, $5::vector, $6::jsonb, CURRENT_TIMESTAMP FROM knowledge_documents d WHERE d.id = $2 AND d.tenant_id = $3 RETURNING id, document_id, tenant_id, content, embedding, metadata, created_at`, [randomUUID(), input.documentId, input.tenantId, input.content, vector(input.embedding), JSON.stringify(input.metadata)]);
    if (!result.rows[0]) throw new AiRepositoryInputError('document is unavailable for tenant');
    return { ...result.rows[0], embedding: input.embedding, createdAt: aiIso(result.rows[0].created_at) };
  }
  public async searchByEmbedding(input: { readonly tenantId: string; readonly embedding: readonly number[]; readonly limit: number }): Promise<readonly (KnowledgeChunk & { readonly documentId: string; readonly title: string; readonly source: string; readonly status: KnowledgeDocumentStatus; readonly distance: number })[]> {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 100) throw new AiRepositoryInputError('limit must be between 1 and 100');
    const result = await this.database.query<ChunkRow & { title: string; source: string; status: KnowledgeDocumentStatus }>(`SELECT k.id, k.document_id, k.tenant_id, k.content, k.embedding, k.metadata, k.created_at, d.title, d.source, d.status, k.embedding <=> $2::vector AS distance FROM knowledge_chunks k JOIN knowledge_documents d ON d.id = k.document_id AND d.tenant_id = k.tenant_id WHERE k.tenant_id = $1 AND d.status = 'APPROVED' ORDER BY k.embedding <=> $2::vector, k.id LIMIT $3`, [input.tenantId, vector(input.embedding), input.limit]);
    return result.rows.map((row) => ({ id: row.id, documentId: row.document_id, tenantId: row.tenant_id, content: row.content, embedding: row.embedding, metadata: row.metadata, createdAt: aiIso(row.created_at), title: row.title, source: row.source, status: row.status, distance: Number(row.distance) }));
  }
}
