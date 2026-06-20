CREATE TABLE IF NOT EXISTS ai_frameworks (
  id text PRIMARY KEY,
  name text NOT NULL,
  scenario text NOT NULL,
  organization_id text,
  status text NOT NULL,
  active_version_id text NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT ai_frameworks_scenario_check CHECK (
    scenario IN ('chat_summary', 'task_draft', 'knowledge_draft', 'knowledge_query', 'contract_review', 'approval_suggestion')
  ),
  CONSTRAINT ai_frameworks_status_check CHECK (status IN ('active', 'disabled'))
);

CREATE TABLE IF NOT EXISTS ai_framework_versions (
  id text PRIMARY KEY,
  framework_id text NOT NULL REFERENCES ai_frameworks(id),
  version text NOT NULL,
  provider text NOT NULL,
  model text NOT NULL,
  prompt_template text NOT NULL,
  boundary_policy text NOT NULL,
  source_evidence_required boolean NOT NULL DEFAULT true,
  retry_policy jsonb NOT NULL,
  created_by_user_id text NOT NULL,
  change_reason text NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT ai_framework_versions_provider_check CHECK (provider IN ('template', 'ark', 'local_structured'))
);

CREATE TABLE IF NOT EXISTS ai_runs (
  id text PRIMARY KEY,
  framework_id text NOT NULL,
  framework_version_id text NOT NULL,
  framework_version text NOT NULL,
  scenario text NOT NULL,
  actor_user_id text NOT NULL,
  organization_id text NOT NULL,
  source_object_type text NOT NULL,
  source_object_id text NOT NULL,
  source_ids jsonb NOT NULL,
  input_snapshot_ref text NOT NULL,
  output_snapshot_ref text,
  context_source_ids jsonb NOT NULL,
  status text NOT NULL,
  failure_class text,
  failure_message text,
  retry_policy jsonb NOT NULL,
  retry_attempt integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL,
  completed_at timestamptz,
  CONSTRAINT ai_runs_scenario_check CHECK (
    scenario IN ('chat_summary', 'task_draft', 'knowledge_draft', 'knowledge_query', 'contract_review', 'approval_suggestion')
  ),
  CONSTRAINT ai_runs_source_type_check CHECK (source_object_type IN ('chat_thread', 'contract', 'knowledge_query', 'approval')),
  CONSTRAINT ai_runs_status_check CHECK (status IN ('created', 'running', 'succeeded', 'failed')),
  CONSTRAINT ai_runs_failure_class_check CHECK (
    failure_class IS NULL OR failure_class IN ('provider_error', 'permission_denied', 'validation_error', 'timeout', 'rate_limited', 'unknown')
  )
);

CREATE TABLE IF NOT EXISTS ai_snapshots (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES ai_runs(id),
  kind text NOT NULL,
  checksum text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT ai_snapshots_kind_check CHECK (kind IN ('input', 'output'))
);

CREATE TABLE IF NOT EXISTS ai_run_source_evidence (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES ai_runs(id),
  source_object_type text NOT NULL,
  source_object_id text NOT NULL,
  source_id text NOT NULL,
  title text NOT NULL,
  excerpt text NOT NULL,
  access_result text NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT ai_run_source_evidence_access_check CHECK (access_result IN ('allowed', 'denied', 'filtered'))
);

CREATE TABLE IF NOT EXISTS ai_run_decisions (
  id text PRIMARY KEY,
  run_id text NOT NULL REFERENCES ai_runs(id),
  draft_id text,
  decision text NOT NULL,
  actor_user_id text NOT NULL,
  target_object_type text,
  target_object_id text,
  change_summary text,
  reason text NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT ai_run_decisions_decision_check CHECK (decision IN ('adopted', 'rejected', 'changed'))
);

CREATE INDEX IF NOT EXISTS ai_frameworks_scenario_status_idx ON ai_frameworks(scenario, status);
CREATE INDEX IF NOT EXISTS ai_framework_versions_framework_created_idx ON ai_framework_versions(framework_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_runs_actor_created_idx ON ai_runs(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_runs_source_idx ON ai_runs(source_object_type, source_object_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_runs_org_status_idx ON ai_runs(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_snapshots_run_kind_idx ON ai_snapshots(run_id, kind);
CREATE INDEX IF NOT EXISTS ai_run_source_evidence_run_idx ON ai_run_source_evidence(run_id);
CREATE INDEX IF NOT EXISTS ai_run_decisions_run_idx ON ai_run_decisions(run_id, created_at DESC);

COMMENT ON TABLE ai_frameworks IS 'DEV-016 AI framework center configuration. Human admins configure; AI cannot configure itself or execute official business actions.';
COMMENT ON TABLE ai_framework_versions IS 'Immutable AI framework versions with boundary and retry policy metadata.';
COMMENT ON TABLE ai_runs IS 'AI Run production records with framework version, source scope, snapshots, status, failure class and retry metadata.';
COMMENT ON TABLE ai_snapshots IS 'Input and output snapshots for AI Run evidence. Payloads must remain permission controlled.';
COMMENT ON TABLE ai_run_source_evidence IS 'Source evidence linkage after permission filtering, including denied or filtered references when applicable.';
COMMENT ON TABLE ai_run_decisions IS 'Human adoption, rejection, or change records for AI outputs.';
