CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY,
  title text NOT NULL,
  summary text NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  owner_user_id uuid NOT NULL REFERENCES users(id),
  member_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS projects_organization_status_idx ON projects(organization_id, status);
CREATE INDEX IF NOT EXISTS projects_owner_user_idx ON projects(owner_user_id);

CREATE TABLE IF NOT EXISTS tasks (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id),
  title text NOT NULL,
  description text NOT NULL,
  creator_user_id uuid NOT NULL REFERENCES users(id),
  assignee_user_id uuid NOT NULL REFERENCES users(id),
  confirmer_user_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL,
  cancel_reason text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS tasks_project_status_idx ON tasks(project_id, status);
CREATE INDEX IF NOT EXISTS tasks_assignee_status_idx ON tasks(assignee_user_id, status);
CREATE INDEX IF NOT EXISTS tasks_confirmer_status_idx ON tasks(confirmer_user_id, status);

CREATE TABLE IF NOT EXISTS chat_threads (
  id text PRIMARY KEY,
  title text NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  creator_user_id uuid NOT NULL REFERENCES users(id),
  member_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  related_object_type text,
  related_object_id text,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS chat_threads_organization_status_idx ON chat_threads(organization_id, status);
CREATE INDEX IF NOT EXISTS chat_threads_related_object_idx ON chat_threads(related_object_type, related_object_id);

CREATE TABLE IF NOT EXISTS chat_messages (
  id text PRIMARY KEY,
  thread_id text NOT NULL REFERENCES chat_threads(id),
  sender_user_id uuid NOT NULL REFERENCES users(id),
  content text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS chat_messages_thread_created_idx ON chat_messages(thread_id, created_at);

CREATE TABLE IF NOT EXISTS ai_drafts (
  id text PRIMARY KEY,
  kind text NOT NULL,
  thread_id text NOT NULL REFERENCES chat_threads(id),
  creator_user_id uuid NOT NULL REFERENCES users(id),
  title text NOT NULL,
  content text NOT NULL,
  source_message_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  context_source_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  framework_version text NOT NULL,
  is_draft boolean NOT NULL DEFAULT true,
  status text NOT NULL,
  confirmed_by_user_id uuid REFERENCES users(id),
  confirmed_at timestamptz,
  promoted_object_type text,
  promoted_object_id text,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_drafts_thread_status_idx ON ai_drafts(thread_id, status);
CREATE INDEX IF NOT EXISTS ai_drafts_creator_status_idx ON ai_drafts(creator_user_id, status);

CREATE TABLE IF NOT EXISTS knowledge_items (
  id text PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  creator_user_id uuid NOT NULL REFERENCES users(id),
  source_draft_id text NOT NULL REFERENCES ai_drafts(id),
  source_message_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_participant_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS knowledge_items_organization_status_idx ON knowledge_items(organization_id, status);

CREATE TABLE IF NOT EXISTS project_memories (
  id text PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  project_id text REFERENCES projects(id),
  thread_id text NOT NULL REFERENCES chat_threads(id),
  creator_user_id uuid NOT NULL REFERENCES users(id),
  source_draft_id text NOT NULL REFERENCES ai_drafts(id),
  source_message_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  source_participant_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS project_memories_organization_project_idx ON project_memories(organization_id, project_id);
CREATE INDEX IF NOT EXISTS project_memories_thread_idx ON project_memories(thread_id);

CREATE TABLE IF NOT EXISTS project_status_history (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id),
  from_status text,
  to_status text NOT NULL,
  actor_user_id uuid REFERENCES users(id),
  reason text NOT NULL,
  request_id text NOT NULL,
  occurred_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS project_status_history_project_idx ON project_status_history(project_id, occurred_at);

CREATE TABLE IF NOT EXISTS task_status_history (
  id text PRIMARY KEY,
  task_id text NOT NULL REFERENCES tasks(id),
  from_status text,
  to_status text NOT NULL,
  actor_user_id uuid REFERENCES users(id),
  reason text NOT NULL,
  request_id text NOT NULL,
  occurred_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS task_status_history_task_idx ON task_status_history(task_id, occurred_at);

CREATE TABLE IF NOT EXISTS denied_access_events (
  id text PRIMARY KEY,
  actor_user_id uuid REFERENCES users(id),
  dimension text NOT NULL,
  action text NOT NULL,
  resource_type text NOT NULL,
  reason text NOT NULL,
  request_id text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS denied_access_events_actor_idx ON denied_access_events(actor_user_id, created_at);
CREATE INDEX IF NOT EXISTS denied_access_events_dimension_idx ON denied_access_events(dimension, resource_type, created_at);
