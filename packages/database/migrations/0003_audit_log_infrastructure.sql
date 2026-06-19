CREATE TABLE audit_logs (
  id UUID PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID REFERENCES users(id),
  actor_role_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT,
  organization_id UUID REFERENCES organizations(id),
  source_ip TEXT NOT NULL,
  request_id TEXT NOT NULL,
  before_snapshot_ref TEXT,
  after_snapshot_ref TEXT,
  reason TEXT NOT NULL,
  result TEXT NOT NULL,
  ai_involved BOOLEAN NOT NULL DEFAULT false,
  ai_framework_version TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX audit_logs_actor_user_idx ON audit_logs(actor_user_id, occurred_at DESC);
CREATE INDEX audit_logs_object_idx ON audit_logs(object_type, object_id, occurred_at DESC);
CREATE INDEX audit_logs_organization_idx ON audit_logs(organization_id, occurred_at DESC);

COMMENT ON TABLE audit_logs IS 'Append-only audit log. No physical delete API is allowed.';
