import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  AiDraftRecord,
  AuditLogEntry,
  ChatMessageRecord,
  ChatThreadRecord,
  KnowledgeItemRecord,
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
  projectMemories: ProjectMemoryRecord[];
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
    projectMemories: []
  };
}

function arrayOrEmpty<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
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
    knowledgeItems: arrayOrEmpty<KnowledgeItemRecord>(source.knowledgeItems),
    projectMemories: arrayOrEmpty<ProjectMemoryRecord>(source.projectMemories)
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
