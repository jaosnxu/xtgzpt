CREATE TABLE IF NOT EXISTS runtime_data_documents (
  document_id text PRIMARY KEY,
  runtime_data jsonb NOT NULL,
  runtime_schema_version integer NOT NULL DEFAULT 1,
  checksum text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT runtime_data_documents_runtime_data_object_check CHECK (jsonb_typeof(runtime_data) = 'object')
);

CREATE INDEX IF NOT EXISTS runtime_data_documents_updated_idx
  ON runtime_data_documents(updated_at DESC);

COMMENT ON TABLE runtime_data_documents IS 'PostgreSQL runtime store cutover boundary for the current RuntimeData JSON shape. DEV-021 added driver-backed adapter support; production cutover still requires release signoff and is not a production data seed.';
COMMENT ON COLUMN runtime_data_documents.runtime_data IS 'Serialized RuntimeData document containing the current API runtime arrays for the driver-backed PostgreSQL adapter until object-level relational repositories replace the document boundary.';
