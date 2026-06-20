CREATE TABLE IF NOT EXISTS role_approval_permissions (
  id uuid PRIMARY KEY,
  role_id uuid NOT NULL REFERENCES roles(id),
  approval_action text NOT NULL,
  can_perform boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role_id, approval_action)
);

CREATE INDEX IF NOT EXISTS role_approval_permissions_role_idx ON role_approval_permissions(role_id);

CREATE TABLE IF NOT EXISTS approval_permission_policies (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  source_object_type text NOT NULL,
  organization_id uuid REFERENCES organizations(id),
  status text NOT NULL DEFAULT 'active',
  created_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS approval_permission_policies_scope_idx
  ON approval_permission_policies(source_object_type, organization_id, status);

CREATE TABLE IF NOT EXISTS approval_permission_policy_nodes (
  id uuid PRIMARY KEY,
  policy_id uuid NOT NULL REFERENCES approval_permission_policies(id),
  node_key text NOT NULL,
  node_name text NOT NULL,
  approver_role_id uuid REFERENCES roles(id),
  approver_user_id uuid REFERENCES users(id),
  can_transfer boolean NOT NULL DEFAULT false,
  can_add_sign boolean NOT NULL DEFAULT false,
  can_return boolean NOT NULL DEFAULT false,
  requires_human boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (approver_role_id IS NOT NULL OR approver_user_id IS NOT NULL),
  CHECK (requires_human = true),
  UNIQUE(policy_id, node_key)
);

CREATE INDEX IF NOT EXISTS approval_permission_policy_nodes_policy_idx
  ON approval_permission_policy_nodes(policy_id);
