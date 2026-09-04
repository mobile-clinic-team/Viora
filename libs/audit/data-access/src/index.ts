import type { AuditEvent } from '../../contracts/src/index.ts';

export interface AuditEventRepository {
  append(event: AuditEvent): Promise<void>;
  listByTenant(input: {
    readonly tenantId: string;
    readonly limit: number;
    readonly cursor?: string;
  }): Promise<readonly AuditEvent[]>;
}
