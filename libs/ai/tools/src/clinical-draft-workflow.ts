import type { ClinicalRecordCreateRequest } from '../../../clinical/contracts/src/index.ts';
import { authorizeResourceAccess } from '../../../platform/authorization/src/index.ts';
import type { RequestContext } from '../../../platform/context/src/index.ts';

export type AiDraftStatus = 'GENERATED' | 'REVIEWING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export type AiDraftAction = 'draft.create' | 'draft.review' | 'draft.approve' | 'draft.reject';

export interface AiDraft {
  readonly id: string;
  readonly tenantId: string;
  readonly patientId: string;
  readonly encounterId: string | null;
  readonly createdBy: string;
  readonly draftType: string;
  readonly content: ClinicalRecordCreateRequest;
  readonly version: bigint;
  readonly status: AiDraftStatus;
  readonly approvedBy: string | null;
  readonly approvedAt: string | null;
  readonly rejectedBy: string | null;
  readonly rejectedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AiDraftRepository {
  create(input: Omit<AiDraft, 'id' | 'createdAt' | 'updatedAt'>): Promise<AiDraft>;
  findById(input: { readonly tenantId: string; readonly draftId: string }): Promise<AiDraft | null>;
  transition(input: {
    readonly tenantId: string;
    readonly draftId: string;
    readonly from: AiDraftStatus;
    readonly expectedVersion: bigint;
    readonly to: Exclude<AiDraftStatus, 'GENERATED' | 'EXPIRED'>;
    readonly actorId: string;
    readonly at: string;
  }): Promise<AiDraft | null>;
}

export interface AiDraftAuthorization {
  allows(input: { readonly action: AiDraftAction; readonly context: RequestContext; readonly draft?: AiDraft }): boolean;
}

export class AiDraftWorkflowError extends Error {
  public readonly code: 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID_TRANSITION' | 'VALIDATION_ERROR';
  public constructor(code: AiDraftWorkflowError['code']) {
    super(code);
    this.name = 'AiDraftWorkflowError';
    this.code = code;
  }
}

function requireContext(context: RequestContext): { readonly tenantId: string; readonly actorId: string } {
  if (!context?.tenant?.tenantId.trim() || !context.actor?.userId.trim()) throw new AiDraftWorkflowError('FORBIDDEN');
  return { tenantId: context.tenant.tenantId, actorId: context.actor.userId };
}

function requireHumanContext(context: RequestContext): void {
  requireContext(context);
  if (context.actor?.kind !== 'HUMAN') throw new AiDraftWorkflowError('FORBIDDEN');
}

function authorize(
  deps: AiDraftWorkflowDependencies,
  context: RequestContext,
  action: AiDraftAction,
  tenantId: string,
  draft?: AiDraft,
): void {
  const decision = authorizeResourceAccess({
    action,
    context,
    resource: { resourceId: draft?.id ?? tenantId, tenantId },
    policy: () => deps.authorization.allows({ action, context, draft }),
  });
  if (!decision.allowed) throw new AiDraftWorkflowError('FORBIDDEN');
}

function findOrThrow(deps: AiDraftWorkflowDependencies, context: RequestContext, draftId: string): Promise<AiDraft> {
  const { tenantId } = requireContext(context);
  if (!draftId.trim()) throw new AiDraftWorkflowError('VALIDATION_ERROR');
  return deps.drafts.findById({ tenantId, draftId }).then((draft) => {
    if (!draft) throw new AiDraftWorkflowError('NOT_FOUND');
    if (draft.tenantId !== tenantId) throw new AiDraftWorkflowError('FORBIDDEN');
    return draft;
  });
}

export interface AiDraftWorkflowDependencies {
  readonly drafts: AiDraftRepository;
  readonly authorization: AiDraftAuthorization;
  readonly now?: () => string;
}

export async function createAiDraft(
  deps: AiDraftWorkflowDependencies,
  context: RequestContext,
  input: Omit<AiDraft, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'status' | 'approvedBy' | 'approvedAt' | 'rejectedBy' | 'rejectedAt'>,
): Promise<AiDraft> {
  const { tenantId } = requireContext(context);
  if (input.tenantId !== tenantId || !input.patientId.trim() || !input.draftType.trim()) throw new AiDraftWorkflowError('VALIDATION_ERROR');
  authorize(deps, context, 'draft.create', tenantId);
  return deps.drafts.create({ ...input, version: 1n, status: 'GENERATED', approvedBy: null, approvedAt: null, rejectedBy: null, rejectedAt: null, createdBy: context.actor!.userId });
}

async function transition(
  deps: AiDraftWorkflowDependencies,
  context: RequestContext,
  draftId: string,
  from: AiDraftStatus,
  to: Exclude<AiDraftStatus, 'GENERATED' | 'EXPIRED'>,
  action: AiDraftAction,
): Promise<AiDraft> {
  const draft = await findOrThrow(deps, context, draftId);
  requireHumanContext(context);
  if (draft.status !== from) throw new AiDraftWorkflowError('INVALID_TRANSITION');
  authorize(deps, context, action, draft.tenantId, draft);
  const updated = await deps.drafts.transition({ tenantId: draft.tenantId, draftId: draft.id, from, expectedVersion: draft.version, to, actorId: context.actor!.userId, at: deps.now?.() ?? new Date().toISOString() });
  if (!updated) throw new AiDraftWorkflowError('INVALID_TRANSITION');
  return updated;
}

export function reviewAiDraft(deps: AiDraftWorkflowDependencies, context: RequestContext, draftId: string): Promise<AiDraft> {
  return transition(deps, context, draftId, 'GENERATED', 'REVIEWING', 'draft.review');
}

export function approveAiDraft(deps: AiDraftWorkflowDependencies, context: RequestContext, draftId: string): Promise<AiDraft> {
  return transition(deps, context, draftId, 'REVIEWING', 'APPROVED', 'draft.approve');
}

export function rejectAiDraft(deps: AiDraftWorkflowDependencies, context: RequestContext, draftId: string): Promise<AiDraft> {
  return transition(deps, context, draftId, 'REVIEWING', 'REJECTED', 'draft.reject');
}
