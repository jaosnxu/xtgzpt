import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AiDraftRecord,
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
  knowledgeItems: KnowledgeItemRecord[];
  knowledgeVersions: KnowledgeVersionRecord[];
  projectMemories: ProjectMemoryRecord[];
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

export interface RuntimeStoreOptions {
  dataFilePath?: string;
}

const defaultRuntimeDataFileName = "runtime-data.json";

function emptyRuntimeData(): RuntimeData {
  return {
    deniedAccessEvents: [],
    auditLogs: [],
    projects: [],
    tasks: [],
    chatThreads: [],
    chatMessages: [],
    aiDrafts: [],
    knowledgeItems: [],
    knowledgeVersions: [],
    projectMemories: [],
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
    knowledgeItems: normalizeKnowledgeItems(source.knowledgeItems),
    knowledgeVersions: arrayOrEmpty<KnowledgeVersionRecord>(source.knowledgeVersions),
    projectMemories: arrayOrEmpty<ProjectMemoryRecord>(source.projectMemories),
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

export function resolveRuntimeStoreOptions(
  options: RuntimeStoreOptions = {},
  env: Record<string, string | undefined> = process.env,
  moduleDir = dirname(fileURLToPath(import.meta.url))
): RuntimeStoreOptions {
  if (options.dataFilePath || env.NODE_ENV === "test") {
    return options;
  }

  return {
    ...options,
    dataFilePath:
      env.XTGZPT_RUNTIME_DATA_FILE ??
      resolve(moduleDir, "..", "data", defaultRuntimeDataFileName)
  };
}

export function createRuntimeStore(options: RuntimeStoreOptions = {}): RuntimeStore {
  const state = loadRuntimeData(options.dataFilePath);

  return {
    state,
    save() {
      if (!options.dataFilePath) {
        return;
      }

      mkdirSync(dirname(options.dataFilePath), { recursive: true });
      const tempPath = `${options.dataFilePath}.tmp`;
      writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
      renameSync(tempPath, options.dataFilePath);
    }
  };
}
