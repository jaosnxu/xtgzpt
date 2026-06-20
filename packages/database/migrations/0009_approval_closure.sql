ALTER TABLE contract_approval_handoffs
  DROP CONSTRAINT IF EXISTS contract_approval_handoffs_no_engine_check;

ALTER TABLE contract_approval_handoffs
  ADD COLUMN IF NOT EXISTS approval_id text;

CREATE TABLE IF NOT EXISTS approvals (
  id text PRIMARY KEY,
  title text NOT NULL,
  organization_id text NOT NULL,
  source_object_type text NOT NULL,
  source_object_id text NOT NULL,
  source_snapshot_ref text NOT NULL,
  initiated_by_user_id text NOT NULL,
  status text NOT NULL,
  current_node_id text,
  current_approver_user_id text,
  result_writeback_status text,
  created_at timestamptz NOT NULL,
  submitted_at timestamptz NOT NULL,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL,
  CONSTRAINT approvals_source_type_check CHECK (source_object_type IN ('contract')),
  CONSTRAINT approvals_status_check CHECK (
    status IN ('submitted', 'processing', 'approved', 'rejected', 'returned', 'transferred', 'cancelled', 'expired')
  )
);

CREATE TABLE IF NOT EXISTS approval_nodes (
  id text PRIMARY KEY,
  approval_id text NOT NULL REFERENCES approvals(id),
  sequence integer NOT NULL,
  name text NOT NULL,
  approver_user_id text NOT NULL,
  status text NOT NULL,
  entered_at timestamptz,
  decided_at timestamptz,
  decided_by_user_id text,
  decision_reason text,
  from_node_id text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT approval_nodes_status_check CHECK (
    status IN ('pending', 'processing', 'approved', 'rejected', 'returned', 'transferred', 'add_signed')
  )
);

CREATE TABLE IF NOT EXISTS approval_actions (
  id text PRIMARY KEY,
  approval_id text NOT NULL REFERENCES approvals(id),
  node_id text NOT NULL REFERENCES approval_nodes(id),
  action text NOT NULL,
  actor_user_id text NOT NULL,
  target_user_id text,
  reason text NOT NULL,
  created_at timestamptz NOT NULL,
  CONSTRAINT approval_actions_action_check CHECK (action IN ('approve', 'reject', 'return', 'transfer', 'add_sign'))
);

CREATE INDEX IF NOT EXISTS approvals_source_idx ON approvals(source_object_type, source_object_id);
CREATE INDEX IF NOT EXISTS approvals_current_handler_idx ON approvals(current_approver_user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS approvals_organization_status_idx ON approvals(organization_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS approval_nodes_approval_sequence_idx ON approval_nodes(approval_id, sequence);
CREATE INDEX IF NOT EXISTS approval_nodes_handler_idx ON approval_nodes(approver_user_id, status);
CREATE INDEX IF NOT EXISTS approval_actions_approval_created_idx ON approval_actions(approval_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contract_approval_handoffs_approval_idx ON contract_approval_handoffs(approval_id);

COMMENT ON TABLE approvals IS 'DEV-015 human approval instances. AI cannot approve, reject, return, transfer, add-sign, become an approver, sign, pay, or confirm execution.';
COMMENT ON TABLE approval_nodes IS 'Ordered human approval nodes with current handler traceability.';
COMMENT ON TABLE approval_actions IS 'Human approval action history for approve, reject, return, transfer, and add-sign.';
