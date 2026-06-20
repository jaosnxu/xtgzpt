ALTER TABLE knowledge_items
  DROP CONSTRAINT IF EXISTS knowledge_items_source_draft_id_fkey;

ALTER TABLE knowledge_items
  ALTER COLUMN source_draft_id DROP NOT NULL;

ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS reviewer_user_id uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS current_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS source_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE TABLE IF NOT EXISTS knowledge_versions (
  id text PRIMARY KEY,
  knowledge_item_id text NOT NULL REFERENCES knowledge_items(id),
  version integer NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  author_user_id uuid NOT NULL REFERENCES users(id),
  reviewer_user_id uuid REFERENCES users(id),
  status text NOT NULL,
  source_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  published_at timestamptz,
  rejected_at timestamptz,
  archived_at timestamptz,
  CONSTRAINT knowledge_versions_item_version_unique UNIQUE (knowledge_item_id, version),
  CONSTRAINT knowledge_versions_status_check CHECK (
    status IN ('draft', 'submitted_for_review', 'published', 'rejected', 'archived')
  )
);

CREATE INDEX IF NOT EXISTS knowledge_items_reviewer_status_idx ON knowledge_items(reviewer_user_id, status);
CREATE INDEX IF NOT EXISTS knowledge_items_published_idx ON knowledge_items(organization_id, status, published_at);
CREATE INDEX IF NOT EXISTS knowledge_versions_item_created_idx ON knowledge_versions(knowledge_item_id, created_at DESC);

COMMENT ON TABLE knowledge_versions IS 'DEV-013 knowledge version history with human author/reviewer, status timestamps and source evidence.';
COMMENT ON COLUMN knowledge_items.source_evidence IS 'Permission-filtered source evidence; unpublished/rejected/archived knowledge must not enter retrieval or AI input context.';
