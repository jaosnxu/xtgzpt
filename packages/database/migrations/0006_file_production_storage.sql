CREATE TABLE IF NOT EXISTS file_assets (
  id text PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  display_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  checksum text NOT NULL,
  uploader_user_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL,
  current_version_id text,
  source_object_type text NOT NULL,
  source_object_id text NOT NULL,
  formal_process boolean NOT NULL DEFAULT false,
  archived_by_user_id uuid REFERENCES users(id),
  archived_at timestamptz,
  archive_reason text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT file_assets_status_check CHECK (status IN ('uploaded', 'linked', 'locked', 'archived')),
  CONSTRAINT file_assets_source_object_type_check CHECK (
    source_object_type IN ('project', 'task', 'chat_thread', 'knowledge_item', 'project_memory')
  )
);

CREATE TABLE IF NOT EXISTS file_versions (
  id text PRIMARY KEY,
  file_id text NOT NULL REFERENCES file_assets(id),
  version_number integer NOT NULL,
  storage_key text NOT NULL,
  checksum text NOT NULL,
  size_bytes bigint NOT NULL,
  mime_type text NOT NULL,
  original_name text NOT NULL,
  content_ref text NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL,
  UNIQUE (file_id, version_number)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'file_assets_current_version_id_fkey'
  ) THEN
    ALTER TABLE file_assets
      ADD CONSTRAINT file_assets_current_version_id_fkey
      FOREIGN KEY (current_version_id) REFERENCES file_versions(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS file_object_bindings (
  id text PRIMARY KEY,
  file_id text NOT NULL REFERENCES file_assets(id),
  object_type text NOT NULL,
  object_id text NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  created_by_user_id uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL,
  CONSTRAINT file_object_bindings_object_type_check CHECK (
    object_type IN ('project', 'task', 'chat_thread', 'knowledge_item', 'project_memory')
  )
);

CREATE TABLE IF NOT EXISTS file_archive_events (
  id text PRIMARY KEY,
  file_id text NOT NULL REFERENCES file_assets(id),
  previous_status text NOT NULL,
  archived_by_user_id uuid NOT NULL REFERENCES users(id),
  reason text NOT NULL,
  request_id text NOT NULL,
  occurred_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS file_assets_organization_status_idx ON file_assets(organization_id, status);
CREATE INDEX IF NOT EXISTS file_assets_source_object_idx ON file_assets(source_object_type, source_object_id);
CREATE INDEX IF NOT EXISTS file_versions_file_number_idx ON file_versions(file_id, version_number);
CREATE INDEX IF NOT EXISTS file_object_bindings_object_idx ON file_object_bindings(object_type, object_id);
CREATE INDEX IF NOT EXISTS file_object_bindings_file_idx ON file_object_bindings(file_id);
CREATE INDEX IF NOT EXISTS file_archive_events_file_idx ON file_archive_events(file_id, occurred_at);

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS file_id text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS file_version_id text;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS file_action text;

CREATE INDEX IF NOT EXISTS audit_logs_file_idx ON audit_logs(file_id, occurred_at);
