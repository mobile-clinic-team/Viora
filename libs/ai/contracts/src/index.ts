import type { RequestContext } from '../../../platform/context/src/index.ts';

export type AiToolAccess = 'READ' | 'DRAFT' | 'WRITE';

export interface AiToolResource {
  readonly resourceId: string;
  readonly tenantId: string;
  readonly resourceType: string;
}

export interface AiToolRequest<Input = unknown> {
  readonly toolName: string;
  readonly input: Input;
  readonly resource?: AiToolResource;
}

export interface AiToolDefinition<Input = unknown, Output = unknown> {
  readonly name: string;
  readonly purpose: string;
  readonly access: AiToolAccess;
  readonly requiresHumanApproval: boolean;
  readonly maxOutputBytes: number;
  readonly validateInput: (input: unknown) => input is Input;
  readonly execute: (input: Input, context: RequestContext) => Promise<Output>;
  readonly authorize?: (input: { readonly context: RequestContext; readonly resource?: AiToolResource }) => boolean;
}

export interface AiToolResult<Output = unknown> {
  readonly ok: boolean;
  readonly toolName: string;
  readonly output?: Output;
  readonly reason?:
    | 'INVALID_CONTEXT'
    | 'UNKNOWN_TOOL'
    | 'INVALID_INPUT'
    | 'UNAUTHORIZED'
    | 'HUMAN_APPROVAL_REQUIRED'
    | 'OUTPUT_REJECTED'
    | 'TOOL_FAILURE';
}

export interface AiAuditRecord {
  readonly toolName: string;
  readonly context: RequestContext;
  readonly outcome: 'ALLOWED' | 'DENIED' | 'FAILURE';
  readonly resource?: AiToolResource;
}

export interface AiGateway {
  invokeTool<Input, Output>(
    request: AiToolRequest<Input>,
    context: RequestContext,
  ): Promise<AiToolResult<Output>>;
}
