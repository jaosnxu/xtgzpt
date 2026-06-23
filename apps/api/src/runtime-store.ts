import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AiDraftRecord,
  AiFrameworkRecord,
  AiFrameworkVersionRecord,
  AiRunDecisionRecord,
  AiRunRecord,
  AiRunSourceEvidenceRecord,
  AiSnapshotRecord,
  ApprovalActionRecord,
  ApprovalNodeRecord,
  ApprovalRecord,
  AuditLogEntry,
  ChatMessageRecord,
  ChatThreadRecord,
  ContractApprovalHandoffRecord,
  ContractExecutionEventRecord,
  ContractRecord,
  ContractReviewRecord,
  ContractRiskConfirmationRecord,
  ContractVersionRecord,
  FileAssetRecord,
  FileObjectBindingRecord,
  FileVersionRecord,
  KnowledgeItemRecord,
  KnowledgeVersionRecord,
  ProjectMemoryRecord,
  ProjectRecord,
  TaskActivityRecord,
  TaskCommentRecord,
  TaskRecord
} from "@xtgzpt/shared";

export interface DeniedAccessEvent {
  id: string;
  actorUserId: string | null;
  dimension: string;
  action: string;
  resourceType: string;
  reason: "unauthenticated" | "forbidden";
  requestId: string;
  createdAt: string;
}

export interface RuntimeData {
  deniedAccessEvents: DeniedAccessEvent[];
  auditLogs: AuditLogEntry[];
  projects: ProjectRecord[];
  tasks: TaskRecord[];
  chatThreads: ChatThreadRecord[];
  chatMessages: ChatMessageRecord[];
  aiDrafts: AiDraftRecord[];
  aiFrameworks: AiFrameworkRecord[];
  aiFrameworkVersions: AiFrameworkVersionRecord[];
  aiRuns: AiRunRecord[];
  aiSnapshots: AiSnapshotRecord[];
  aiRunSourceEvidence: AiRunSourceEvidenceRecord[];
  aiRunDecisions: AiRunDecisionRecord[];
  knowledgeItems: KnowledgeItemRecord[];
  knowledgeVersions: KnowledgeVersionRecord[];
  projectMemories: ProjectMemoryRecord[];
  approvals: ApprovalRecord[];
  approvalNodes: ApprovalNodeRecord[];
  approvalActions: ApprovalActionRecord[];
  contracts: ContractRecord[];
  contractVersions: ContractVersionRecord[];
  contractReviews: ContractReviewRecord[];
  contractRiskConfirmations: ContractRiskConfirmationRecord[];
  contractApprovalHandoffs: ContractApprovalHandoffRecord[];
  contractExecutionEvents: ContractExecutionEventRecord[];
  files: FileAssetRecord[];
  fileVersions: FileVersionRecord[];
  fileObjectBindings: FileObjectBindingRecord[];
  taskActivities: TaskActivityRecord[];
  taskComments: TaskCommentRecord[];
}

export interface RuntimeStore {
  state: RuntimeData;
  ready: Promise<void>;
  save: () => void | Promise<void>;
  close: () => void | Promise<void>;
}

export type RuntimeStoreMode = "memory" | "file" | "postgres";

export interface PostgresRuntimeStoreConfig {
  databaseUrl: string;
  schema: string;
  table: string;
  documentId: string;
  client?: PostgresRuntimeClient;
  clientFactory?: (config: PostgresRuntimeStoreConfig) => PostgresRuntimeClient | Promise<PostgresRuntimeClient>;
}

export interface PostgresRuntimeQueryResult {
  rows: Array<Record<string, unknown>>;
  rowCount?: number | null;
}

export interface PostgresRuntimeConnectedClient {
  query: (sql: string, params?: unknown[]) => Promise<PostgresRuntimeQueryResult>;
  release?: () => void;
}

export interface PostgresRuntimeClient {
  query: (sql: string, params?: unknown[]) => Promise<PostgresRuntimeQueryResult>;
  connect?: () => Promise<PostgresRuntimeConnectedClient>;
  end?: () => void | Promise<void>;
}

export interface RuntimeStoreOptions {
  mode?: RuntimeStoreMode;
  dataFilePath?: string;
  postgres?: PostgresRuntimeStoreConfig;
}

const defaultRuntimeDataFileName = "runtime-data.json";
const defaultPostgresRuntimeSchema = "public";
const defaultPostgresRuntimeTable = "runtime_data_documents";
const defaultPostgresRuntimeDocumentId = "runtime-data-v1";
const validPostgresIdentifierPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function emptyRuntimeData(): RuntimeData {
  return {
    deniedAccessEvents: [],
    auditLogs: [],
    projects: [],
    tasks: [],
    chatThreads: [],
    chatMessages: [],
    aiDrafts: [],
    aiFrameworks: [],
    aiFrameworkVersions: [],
    aiRuns: [],
    aiSnapshots: [],
    aiRunSourceEvidence: [],
    aiRunDecisions: [],
    knowledgeItems: [],
    knowledgeVersions: [],
    projectMemories: [],
    approvals: [],
    approvalNodes: [],
    approvalActions: [],
    contracts: [],
    contractVersions: [],
    contractReviews: [],
    contractRiskConfirmations: [],
    contractApprovalHandoffs: [],
    contractExecutionEvents: [],
    files: [],
    fileVersions: [],
    fileObjectBindings: [],
    taskActivities: [],
    taskComments: []
  };
}

const runtimeDataKeys = Object.keys(emptyRuntimeData()) as Array<keyof RuntimeData>;

function arrayOrEmpty<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeKnowledgeItems(value: unknown): KnowledgeItemRecord[] {
  return arrayOrEmpty<Partial<KnowledgeItemRecord>>(value).map((item) => ({
    id: item.id ?? "knowledge-unknown",
    title: item.title ?? "Untitled knowledge",
    content: item.content ?? "",
    organizationId: item.organizationId ?? "",
    creatorUserId: item.creatorUserId ?? "",
    reviewerUserId: item.reviewerUserId ?? null,
    currentVersion: item.currentVersion ?? 1,
    sourceDraftId: item.sourceDraftId ?? "",
    sourceMessageIds: item.sourceMessageIds ?? [],
    sourceParticipantUserIds: item.sourceParticipantUserIds ?? [],
    sourceEvidence: item.sourceEvidence ?? [
      {
        sourceType: "ai_draft",
        sourceId: item.sourceDraftId ?? "",
        sourceMessageIds: item.sourceMessageIds ?? [],
        sourceParticipantUserIds: item.sourceParticipantUserIds ?? [],
        title: item.title ?? "Legacy source",
        excerpt: item.content?.slice(0, 240) ?? ""
      }
    ],
    status: item.status ?? "draft",
    createdAt: item.createdAt ?? new Date(0).toISOString(),
    updatedAt: item.updatedAt ?? item.createdAt ?? new Date(0).toISOString(),
    submittedAt: item.submittedAt ?? null,
    reviewedAt: item.reviewedAt ?? null,
    publishedAt: item.publishedAt ?? (item.status === "published" ? item.updatedAt ?? item.createdAt ?? null : null),
    rejectedAt: item.rejectedAt ?? null,
    archivedAt: item.archivedAt ?? (item.status === "archived" ? item.updatedAt ?? item.createdAt ?? null : null)
  }));
}

function normalizeTasks(value: unknown): TaskRecord[] {
  return arrayOrEmpty<Partial<TaskRecord>>(value).map((task) => {
    const createdAt = task.createdAt ?? new Date(0).toISOString();
    const updatedAt = task.updatedAt ?? createdAt;
    return {
      id: task.id ?? "task-unknown",
      projectId: task.projectId ?? "",
      title: task.title ?? "未命名任务",
      description: task.description ?? "",
      creatorUserId: task.creatorUserId ?? "",
      assigneeUserId: task.assigneeUserId ?? "",
      confirmerUserId: task.confirmerUserId ?? "",
      priority: task.priority ?? "medium",
      dueAt: task.dueAt ?? null,
      status: task.status ?? "todo",
      cancelReason: task.cancelReason ?? null,
      completedAt: task.completedAt ?? (task.status === "completed" ? updatedAt : null),
      confirmedAt: task.confirmedAt ?? (task.status === "completed" ? updatedAt : null),
      returnedReason: task.returnedReason ?? null,
      createdAt,
      updatedAt
    };
  });
}

function normalizeRuntimeData(value: unknown): RuntimeData {
  const source = value && typeof value === "object" ? (value as Partial<RuntimeData>) : {};

  return {
    deniedAccessEvents: arrayOrEmpty<DeniedAccessEvent>(source.deniedAccessEvents),
    auditLogs: arrayOrEmpty<AuditLogEntry>(source.auditLogs),
    projects: arrayOrEmpty<ProjectRecord>(source.projects),
    tasks: normalizeTasks(source.tasks),
    chatThreads: arrayOrEmpty<ChatThreadRecord>(source.chatThreads),
    chatMessages: arrayOrEmpty<ChatMessageRecord>(source.chatMessages),
    aiDrafts: arrayOrEmpty<AiDraftRecord>(source.aiDrafts),
    aiFrameworks: arrayOrEmpty<AiFrameworkRecord>(source.aiFrameworks),
    aiFrameworkVersions: arrayOrEmpty<AiFrameworkVersionRecord>(source.aiFrameworkVersions),
    aiRuns: arrayOrEmpty<AiRunRecord>(source.aiRuns),
    aiSnapshots: arrayOrEmpty<AiSnapshotRecord>(source.aiSnapshots),
    aiRunSourceEvidence: arrayOrEmpty<AiRunSourceEvidenceRecord>(source.aiRunSourceEvidence),
    aiRunDecisions: arrayOrEmpty<AiRunDecisionRecord>(source.aiRunDecisions),
    knowledgeItems: normalizeKnowledgeItems(source.knowledgeItems),
    knowledgeVersions: arrayOrEmpty<KnowledgeVersionRecord>(source.knowledgeVersions),
    projectMemories: arrayOrEmpty<ProjectMemoryRecord>(source.projectMemories),
    approvals: arrayOrEmpty<ApprovalRecord>(source.approvals),
    approvalNodes: arrayOrEmpty<ApprovalNodeRecord>(source.approvalNodes),
    approvalActions: arrayOrEmpty<ApprovalActionRecord>(source.approvalActions),
    contracts: arrayOrEmpty<ContractRecord>(source.contracts),
    contractVersions: arrayOrEmpty<ContractVersionRecord>(source.contractVersions),
    contractReviews: arrayOrEmpty<ContractReviewRecord>(source.contractReviews),
    contractRiskConfirmations: arrayOrEmpty<ContractRiskConfirmationRecord>(source.contractRiskConfirmations),
    contractApprovalHandoffs: arrayOrEmpty<ContractApprovalHandoffRecord>(source.contractApprovalHandoffs),
    contractExecutionEvents: arrayOrEmpty<ContractExecutionEventRecord>(source.contractExecutionEvents),
    files: arrayOrEmpty<FileAssetRecord>(source.files),
    fileVersions: arrayOrEmpty<FileVersionRecord>(source.fileVersions),
    fileObjectBindings: arrayOrEmpty<FileObjectBindingRecord>(source.fileObjectBindings),
    taskActivities: arrayOrEmpty<TaskActivityRecord>(source.taskActivities),
    taskComments: arrayOrEmpty<TaskCommentRecord>(source.taskComments)
  };
}

function replaceRuntimeState(target: RuntimeData, source: RuntimeData) {
  for (const key of runtimeDataKeys) {
    const targetList = target[key] as unknown[];
    const sourceList = source[key] as unknown[];
    targetList.splice(0, targetList.length, ...sourceList);
  }
}

function runtimeDataChecksum(value: RuntimeData) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function loadRuntimeData(dataFilePath?: string) {
  if (!dataFilePath || !existsSync(dataFilePath)) {
    return emptyRuntimeData();
  }

  const raw = readFileSync(dataFilePath, "utf8");
  return normalizeRuntimeData(JSON.parse(raw));
}

function normalizeRuntimeStoreMode(value: string | undefined): RuntimeStoreMode | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "memory" || normalized === "in-memory" || normalized === "in_memory") {
    return "memory";
  }
  if (normalized === "file" || normalized === "runtime-file") {
    return "file";
  }
  if (normalized === "postgres" || normalized === "postgresql" || normalized === "pg") {
    return "postgres";
  }

  throw new Error(
    `Unsupported XTGZPT_RUNTIME_STORE_MODE "${value}". Expected one of: memory, file, postgres.`
  );
}

function assertPostgresIdentifier(value: string, envName: string) {
  if (!validPostgresIdentifierPattern.test(value)) {
    throw new Error(`${envName} must be a safe PostgreSQL identifier.`);
  }
}

function resolvePostgresDatabaseUrl(env: Record<string, string | undefined>) {
  const databaseUrl = env.XTGZPT_RUNTIME_DATABASE_URL ?? env.DATABASE_URL;
  if (!databaseUrl?.trim()) {
    throw new Error(
      "XTGZPT_RUNTIME_STORE_MODE=postgres requires XTGZPT_RUNTIME_DATABASE_URL or DATABASE_URL."
    );
  }

  const trimmed = databaseUrl.trim();
  if (trimmed.startsWith("<") || trimmed.endsWith(">")) {
    throw new Error("PostgreSQL runtime database URL must be a real secret value, not a placeholder.");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("PostgreSQL runtime database URL must be a valid URL.");
  }

  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("PostgreSQL runtime database URL must use postgres:// or postgresql://.");
  }

  if (!parsed.hostname || !parsed.pathname || parsed.pathname === "/") {
    throw new Error("PostgreSQL runtime database URL must include host and database name.");
  }

  return trimmed;
}

export function resolvePostgresRuntimeStoreConfig(
  env: Record<string, string | undefined> = process.env
): PostgresRuntimeStoreConfig {
  const schema = env.XTGZPT_RUNTIME_POSTGRES_SCHEMA?.trim() || defaultPostgresRuntimeSchema;
  const table = env.XTGZPT_RUNTIME_POSTGRES_TABLE?.trim() || defaultPostgresRuntimeTable;
  const documentId = env.XTGZPT_RUNTIME_POSTGRES_DOCUMENT_ID?.trim() || defaultPostgresRuntimeDocumentId;

  assertPostgresIdentifier(schema, "XTGZPT_RUNTIME_POSTGRES_SCHEMA");
  assertPostgresIdentifier(table, "XTGZPT_RUNTIME_POSTGRES_TABLE");

  if (!documentId) {
    throw new Error("XTGZPT_RUNTIME_POSTGRES_DOCUMENT_ID must not be empty.");
  }

  return {
    databaseUrl: resolvePostgresDatabaseUrl(env),
    schema,
    table,
    documentId
  };
}

function createMemoryRuntimeStore(): RuntimeStore {
  return {
    state: emptyRuntimeData(),
    ready: Promise.resolve(),
    save() {
      return;
    },
    close() {
      return;
    }
  };
}

function createFileRuntimeStore(dataFilePath?: string): RuntimeStore {
  const state = loadRuntimeData(dataFilePath);

  return {
    state,
    ready: Promise.resolve(),
    save() {
      if (!dataFilePath) {
        return;
      }

      mkdirSync(dirname(dataFilePath), { recursive: true });
      const tempPath = `${dataFilePath}.tmp`;
      writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
      renameSync(tempPath, dataFilePath);
    },
    close() {
      return;
    }
  };
}

function quotePostgresIdentifier(identifier: string) {
  assertPostgresIdentifier(identifier, "PostgreSQL identifier");
  return `"${identifier.replaceAll("\"", "\"\"")}"`;
}

function postgresTableReference(config: PostgresRuntimeStoreConfig) {
  return `${quotePostgresIdentifier(config.schema)}.${quotePostgresIdentifier(config.table)}`;
}

async function createDefaultPostgresClient(config: PostgresRuntimeStoreConfig): Promise<PostgresRuntimeClient> {
  try {
    const importPg = new Function("specifier", "return import(specifier)") as (
      specifier: string
    ) => Promise<{ Pool?: new (options: { connectionString: string }) => PostgresRuntimeClient }>;
    const pg = await importPg("pg");
    if (!pg.Pool) {
      throw new Error("pg Pool export is unavailable.");
    }

    return new pg.Pool({
      connectionString: config.databaseUrl
    });
  } catch (error) {
    throw new Error(`PostgreSQL runtime store requires the pg driver dependency: ${messageFromError(error)}`);
  }
}

async function withPostgresClient<T>(
  client: PostgresRuntimeClient,
  operation: (client: PostgresRuntimeConnectedClient) => Promise<T>
) {
  if (client.connect) {
    const connected = await client.connect();
    try {
      return await operation(connected);
    } finally {
      connected.release?.();
    }
  }

  return operation(client);
}

function parseRuntimeDataDocument(value: unknown) {
  if (typeof value === "string") {
    return normalizeRuntimeData(JSON.parse(value));
  }

  return normalizeRuntimeData(value);
}

async function ensurePostgresRuntimeTable(
  connection: PostgresRuntimeConnectedClient,
  config: PostgresRuntimeStoreConfig,
  tableReference: string
) {
  if (config.schema !== "public") {
    await connection.query(`CREATE SCHEMA IF NOT EXISTS ${quotePostgresIdentifier(config.schema)}`);
  }

  await connection.query(
    `CREATE TABLE IF NOT EXISTS ${tableReference} (
      document_id text PRIMARY KEY,
      runtime_data jsonb NOT NULL,
      runtime_schema_version integer NOT NULL DEFAULT 1,
      checksum text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT ${quotePostgresIdentifier(`${config.table}_runtime_data_object_check`)}
        CHECK (jsonb_typeof(runtime_data) = 'object')
    )`
  );

  await connection.query(
    `CREATE INDEX IF NOT EXISTS ${quotePostgresIdentifier(`${config.table}_updated_idx`)}
     ON ${tableReference}(updated_at DESC)`
  );
}

export function createPostgresRuntimeStore(config: PostgresRuntimeStoreConfig): RuntimeStore {
  const state = emptyRuntimeData();
  const tableReference = postgresTableReference(config);
  const emptyState = emptyRuntimeData();
  const emptyChecksum = runtimeDataChecksum(emptyState);
  let persistedChecksum: string | null = null;
  let clientInstance: PostgresRuntimeClient | null = config.client ?? null;
  let saveQueue: Promise<void> = Promise.resolve();

  async function getClient() {
    if (!clientInstance) {
      clientInstance = config.clientFactory
        ? await config.clientFactory(config)
        : await createDefaultPostgresClient(config);
    }

    return clientInstance;
  }

  const ready = (async () => {
    try {
      const client = await getClient();
      await withPostgresClient(client, async (connection) => {
        await ensurePostgresRuntimeTable(connection, config, tableReference);
        await connection.query(
          `INSERT INTO ${tableReference} (document_id, runtime_data, runtime_schema_version, checksum)
           VALUES ($1, $2::jsonb, 1, $3)
           ON CONFLICT (document_id) DO NOTHING`,
          [config.documentId, JSON.stringify(emptyState), emptyChecksum]
        );

        const result = await connection.query(
          `SELECT runtime_data, checksum
           FROM ${tableReference}
           WHERE document_id = $1`,
          [config.documentId]
        );
        const row = result.rows[0];
        if (!row) {
          throw new Error(`RuntimeData document "${config.documentId}" was not found after initialization.`);
        }

        replaceRuntimeState(state, parseRuntimeDataDocument(row.runtime_data));
        persistedChecksum = typeof row.checksum === "string" ? row.checksum : null;
      });
    } catch (error) {
      throw new Error(`PostgreSQL runtime store failed to initialize/read RuntimeData: ${messageFromError(error)}`);
    }
  })();

  return {
    state,
    ready,
    save() {
      saveQueue = saveQueue.then(persistState, persistState);
      return saveQueue;
    },
    async close() {
      await saveQueue;
      await clientInstance?.end?.();
    }
  };

  async function persistState() {
    await ready;
    const nextChecksum = runtimeDataChecksum(state);
    const client = await getClient();

    try {
      await withPostgresClient(client, async (connection) => {
        const result = await connection.query(
          `UPDATE ${tableReference}
           SET runtime_data = $2::jsonb,
               runtime_schema_version = runtime_schema_version + 1,
               checksum = $3,
               updated_at = now()
           WHERE document_id = $1
             AND checksum IS NOT DISTINCT FROM $4
           RETURNING checksum`,
          [config.documentId, JSON.stringify(state), nextChecksum, persistedChecksum]
        );

        if (result.rowCount !== 1) {
          throw new Error(
            `PostgreSQL runtime store concurrent update detected for document "${config.documentId}". Refusing to overwrite newer RuntimeData.`
          );
        }

        persistedChecksum = nextChecksum;
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("concurrent update detected")) {
        throw error;
      }

      throw new Error(`PostgreSQL runtime store failed to persist RuntimeData: ${messageFromError(error)}`);
    }
  }
}

export async function createPostgresRuntimeStoreForTest(
  config: Omit<PostgresRuntimeStoreConfig, "databaseUrl"> & { databaseUrl?: string; client: PostgresRuntimeClient }
): Promise<RuntimeStore> {
  const store = createPostgresRuntimeStore({
    databaseUrl: config.databaseUrl ?? "postgres://localhost:5432/xtgzpt_test",
    schema: config.schema,
    table: config.table,
    documentId: config.documentId,
    client: config.client
  });
  await store.ready;
  return store;
}

export function resolveRuntimeStoreOptions(
  options: RuntimeStoreOptions = {},
  env: Record<string, string | undefined> = process.env,
  moduleDir = dirname(fileURLToPath(import.meta.url))
): RuntimeStoreOptions {
  if (options.postgres) {
    return {
      ...options,
      mode: "postgres"
    };
  }

  if (options.mode === "postgres" || options.mode === "memory") {
    return options;
  }

  if (options.dataFilePath) {
    return {
      ...options,
      mode: "file"
    };
  }

  const mode = options.mode ?? normalizeRuntimeStoreMode(env.XTGZPT_RUNTIME_STORE_MODE);
  if (mode === "postgres") {
    return {
      ...options,
      mode,
      postgres: resolvePostgresRuntimeStoreConfig(env)
    };
  }

  if (mode === "memory" || env.NODE_ENV === "test") {
    return {
      ...options,
      mode: "memory"
    };
  }

  return {
    ...options,
    mode: "file",
    dataFilePath:
      env.XTGZPT_RUNTIME_DATA_FILE ??
      resolve(moduleDir, "..", "data", defaultRuntimeDataFileName)
  };
}

export function createRuntimeStore(options: RuntimeStoreOptions = {}): RuntimeStore {
  if (options.mode === "postgres") {
    if (!options.postgres) {
      throw new Error("PostgreSQL runtime store requires validated postgres configuration.");
    }

    return createPostgresRuntimeStore(options.postgres);
  }

  if (options.mode === "memory" || !options.dataFilePath) {
    return createMemoryRuntimeStore();
  }

  return createFileRuntimeStore(options.dataFilePath);
}
