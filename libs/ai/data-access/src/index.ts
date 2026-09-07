import { randomUUID } from 'node:crypto';
import type { AiDraft, AiDraftRepository, AiDraftStatus } from '../../tools/src/clinical-draft-workflow.ts';

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
