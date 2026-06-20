CREATE TABLE IF NOT EXISTS contracts (
  id text PRIMARY KEY,
  title text NOT NULL,
  organization_id text NOT NULL,
  creator_user_id text NOT NULL,
  participant_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL,
  current_version integer NOT NULL DEFAULT 1,
  approval_handoff_id text,
  execution_status text NOT NULL DEFAULT 'not_started',
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT contracts_status_check CHECK (
    status IN (
      'draft',
      'ai_reviewing',
      'risk_pending_confirm',
      'revision_required',
      'second_reviewing',
      'approval_pending',
      'approved',
      'execution_tracking',
      'completed',
      'rejected',
      'cancelled',
      'archived'
    )
  ),
  CONSTRAINT contracts_execution_status_check CHECK (execution_status IN ('not_started', 'tracking'))
);

CREATE TABLE IF NOT EXISTS contract_versions (
  id text PRIMARY KEY,
  contract_id text NOT NULL REFERENCES contracts(id),
  version integer NOT NULL,
  title text NOT NULL,
  original_text text NOT NULL,
  entry_method text NOT NULL,
  source_evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT contract_versions_unique UNIQUE (contract_id, version),
  CONSTRAINT contract_versions_entry_method_check CHECK (entry_method IN ('upload', 'paste', 'revision'))
);

CREATE TABLE IF NOT EXISTS contract_reviews (
  id text PRIMARY KEY,
  contract_id text NOT NULL REFERENCES contracts(id),
  version_id text NOT NULL REFERENCES contract_versions(id),
  version integer NOT NULL,
  review_type text NOT NULL,
  status text NOT NULL,
  framework_id text NOT NULL,
  framework_version text NOT NULL,
  summary text NOT NULL,
  risk_level text NOT NULL,
  risks jsonb NOT NULL DEFAULT '[]'::jsonb,
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  next_required_action text NOT NULL,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL,
  completed_at timestamptz,
  CONSTRAINT contract_reviews_type_check CHECK (review_type IN ('initial', 'second')),
  CONSTRAINT contract_reviews_status_check CHECK (status IN ('succeeded', 'failed')),
  CONSTRAINT contract_reviews_risk_level_check CHECK (risk_level IN ('low', 'medium', 'high')),
  CONSTRAINT contract_reviews_next_action_check CHECK (next_required_action = 'human_confirm_risks')
);

CREATE TABLE IF NOT EXISTS contract_risk_confirmations (
  id text PRIMARY KEY,
  contract_id text NOT NULL REFERENCES contracts(id),
  review_id text NOT NULL REFERENCES contract_reviews(id),
  risk_id text NOT NULL,
  confirmed boolean NOT NULL,
  selected_option text NOT NULL,
  note text NOT NULL DEFAULT '',
  confirmed_by_user_id text NOT NULL,
  confirmed_at timestamptz NOT NULL,
  CONSTRAINT contract_risk_confirmations_option_check CHECK (selected_option IN ('A', 'B', 'C'))
);

CREATE TABLE IF NOT EXISTS contract_approval_handoffs (
  id text PRIMARY KEY,
  contract_id text NOT NULL REFERENCES contracts(id),
  version_id text NOT NULL REFERENCES contract_versions(id),
  submitted_by_user_id text NOT NULL,
  status text NOT NULL,
  approval_engine_implemented boolean NOT NULL DEFAULT false,
  reason text NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT contract_approval_handoffs_status_check CHECK (status = 'submitted_boundary'),
  CONSTRAINT contract_approval_handoffs_no_engine_check CHECK (approval_engine_implemented = false)
);

CREATE TABLE IF NOT EXISTS contract_execution_events (
  id text PRIMARY KEY,
  contract_id text NOT NULL REFERENCES contracts(id),
  event_type text NOT NULL,
  title text NOT NULL,
  notes text NOT NULL,
  status text NOT NULL,
  due_at timestamptz,
  created_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT contract_execution_events_type_check CHECK (event_type IN ('reminder', 'record', 'status_update'))
);

CREATE INDEX IF NOT EXISTS contracts_organization_status_idx ON contracts(organization_id, status);
CREATE INDEX IF NOT EXISTS contracts_creator_idx ON contracts(creator_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS contract_versions_contract_idx ON contract_versions(contract_id, version DESC);
CREATE INDEX IF NOT EXISTS contract_reviews_contract_idx ON contract_reviews(contract_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contract_risk_confirmations_contract_idx ON contract_risk_confirmations(contract_id, confirmed_at DESC);
CREATE INDEX IF NOT EXISTS contract_approval_handoffs_contract_idx ON contract_approval_handoffs(contract_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contract_execution_events_contract_idx ON contract_execution_events(contract_id, created_at DESC);

COMMENT ON TABLE contracts IS 'DEV-014 contract closure objects. Approval is a bounded handoff only; no full approval engine is implemented here.';
COMMENT ON TABLE contract_versions IS 'Contract original text and source evidence for upload, paste, and human revisions.';
COMMENT ON TABLE contract_reviews IS 'AI structured contract review output. Risks and options require human confirmation before flow continues.';
COMMENT ON TABLE contract_execution_events IS 'Reminder, record, and status tracking only; no automatic signing, payment, external notification, or execution completion.';
