-- AI-004 / forward migration
-- Global knowledge is intentionally deferred. Existing NULL rows fail this
-- migration rather than being assigned to an arbitrary tenant.

ALTER TABLE knowledge_documents
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE knowledge_chunks
  ALTER COLUMN tenant_id SET NOT NULL;

