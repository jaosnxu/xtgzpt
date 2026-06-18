CREATE TABLE role_operation_permissions (
  id UUID PRIMARY KEY,
  role_id UUID NOT NULL REFERENCES roles(id),
  operation_key TEXT NOT NULL,
  can_perform BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(role_id, operation_key)
);

CREATE TABLE role_file_permissions (
  id UUID PRIMARY KEY,
  role_id UUID NOT NULL REFERENCES roles(id),
  file_action TEXT NOT NULL,
  can_perform BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(role_id, file_action)
);

CREATE TABLE role_ai_permissions (
  id UUID PRIMARY KEY,
  role_id UUID NOT NULL REFERENCES roles(id),
  ai_capability TEXT NOT NULL,
  can_use BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(role_id, ai_capability)
);

CREATE TABLE access_denial_events (
  id UUID PRIMARY KEY,
  actor_user_id UUID REFERENCES users(id),
  permission_dimension TEXT NOT NULL,
  action_key TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  request_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
