-- AI-003 / migration 011
-- AI persistence is application-controlled and tenant/authorization scoped.
-- Raw prompt/response content is not persisted here; messages retain only a
-- controlled content reference as defined by the data model.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE ai_message_role AS ENUM ('USER', 'ASSISTANT', 'SYSTEM', 'TOOL');
CREATE TYPE ai_draft_status AS ENUM ('GENERATED', 'REVIEWING', 'APPROVED', 'REJECTED', 'EXPIRED');

CREATE TABLE ai_conversations (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  patient_id UUID REFERENCES patients (id) ON DELETE RESTRICT,
  context_type TEXT,
  context_id TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE ai_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES ai_conversations (id) ON DELETE RESTRICT,
  role ai_message_role NOT NULL,
  content_reference TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE ai_drafts (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES patients (id) ON DELETE RESTRICT,
  encounter_id UUID REFERENCES encounters (id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  draft_type TEXT NOT NULL,
  content JSONB NOT NULL CHECK (jsonb_typeof(content) = 'object'),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  status ai_draft_status NOT NULL,
  approved_by UUID REFERENCES users (id) ON DELETE RESTRICT,
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES users (id) ON DELETE RESTRICT,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE knowledge_documents (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants (id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  source TEXT NOT NULL,
  document_type TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES knowledge_documents (id) ON DELETE RESTRICT,
  tenant_id UUID REFERENCES tenants (id) ON DELETE RESTRICT,
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX ai_conversations_tenant_created_idx
  ON ai_conversations (tenant_id, created_at, id);
CREATE INDEX ai_messages_conversation_created_idx
  ON ai_messages (conversation_id, created_at, id);
CREATE INDEX ai_drafts_tenant_patient_status_idx
  ON ai_drafts (tenant_id, patient_id, status, created_at, id);
CREATE INDEX knowledge_documents_tenant_status_idx
  ON knowledge_documents (tenant_id, status, id);
CREATE INDEX knowledge_chunks_tenant_document_idx
  ON knowledge_chunks (tenant_id, document_id, id);
CREATE INDEX knowledge_chunks_embedding_hnsw_idx
  ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);

