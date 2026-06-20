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
}

export interface RuntimeStore {
  state: RuntimeData;
  save: () => void;
}

export type RuntimeStoreMode = "memory" | "file" | "postgres";

export interface PostgresRuntimeStoreConfig {
  databaseUrl: string;
  schema: string;
  table: string;
  documentId: string;
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
    fileObjectBindings: []
  };
}

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

function normalizeRuntimeData(value: unknown): RuntimeData {
  const source = value && typeof value === "object" ? (value as Partial<RuntimeData>) : {};

  return {
    deniedAccessEvents: arrayOrEmpty<DeniedAccessEvent>(source.deniedAccessEvents),
    auditLogs: arrayOrEmpty<AuditLogEntry>(source.auditLogs),
    projects: arrayOrEmpty<ProjectRecord>(source.projects),
    tasks: arrayOrEmpty<TaskRecord>(source.tasks),
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
    fileObjectBindings: arrayOrEmpty<FileObjectBindingRecord>(source.fileObjectBindings)
  };
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
    save() {
      return;
    }
  };
}

function createFileRuntimeStore(dataFilePath?: string): RuntimeStore {
  const state = loadRuntimeData(dataFilePath);

  return {
    state,
    save() {
      if (!dataFilePath) {
        return;
      }

      mkdirSync(dirname(dataFilePath), { recursive: true });
      const tempPath = `${dataFilePath}.tmp`;
      writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
      renameSync(tempPath, dataFilePath);
    }
  };
}

export function createPostgresRuntimeStore(config: PostgresRuntimeStoreConfig): RuntimeStore {
  const state = emptyRuntimeData();

  return {
    state,
    save() {
      throw new Error(
        `PostgreSQL runtime adapter boundary is selected for ${config.schema}.${config.table}, but DEV-020 does not execute live database writes without a driver-backed cutover.`
      );
    }
  };
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
