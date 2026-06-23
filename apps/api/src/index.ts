import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AiProviderError, fallbackAiFrameworkVersion, generateAiDraftContent } from "./ai-provider";
import { loadLocalEnv } from "./env";
import {
  createRuntimeStore,
  resolveRuntimeStoreOptions,
  type DeniedAccessEvent,
  type RuntimeStoreOptions
} from "./runtime-store";
import {
  canAccessFileAction,
  canAccessModule,
  canAccessResourceData,
  canPerformApprovalAction,
  canQueryAuditLogs,
  canManageSettings,
  canManageOrganizations,
  canManageRoles,
  canPerformOperation,
  canUseAiCapability,
  getPermissionSummary,
  getPublicUser,
  platformBoundary,
  platformModules,
  rolePolicies,
  seedOrganizations,
  seedUsers,
  visibleOrganizationsForUser,
  type AiDraftRecord,
  type AiFrameworkRecord,
  type AiFrameworkVersionRecord,
  type AiRetryPolicy,
  type AiRunDecisionRecord,
  type AiRunFailureClass,
  type AiRunRecord,
  type AiRunSourceEvidenceRecord,
  type AiRunSourceObjectType,
  type AiRunStatus,
  type AiRunWithDetails,
  type AiScenario,
  type AiSnapshotKind,
  type AiSnapshotRecord,
  type ApprovalActionRecord,
  type ApprovalActionType,
  type ApprovalNodeRecord,
  type ApprovalPermission,
  type ApprovalRecord,
  type ApprovalWithDetails,
  type AuditLogEntry,
  type AuditLogFilter,
  type AuditResult,
  type AiCapability,
  type ChatMessageRecord,
  type ChatThreadRecord,
  type ContractApprovalHandoffRecord,
  type ContractEntryMethod,
  type ContractExecutionEventRecord,
  type ContractExecutionEventType,
  type ContractOptionKey,
  type ContractRecord,
  type ContractReviewRecord,
  type ContractReviewRisk,
  type ContractReviewType,
  type ContractRiskConfirmationRecord,
  type ContractRiskSeverity,
  type ContractSourceEvidence,
  type ContractTextHighlight,
  type ContractVersionRecord,
  type FileAssetRecord,
  type FilePermission,
  type FilePreviewResponse,
  type FileSourceObjectType,
  type FileVersionRecord,
  type KnowledgeItemRecord,
  type KnowledgeSearchResult,
  type KnowledgeSourceEvidence,
  type KnowledgeVersionRecord,
  type ModuleKey,
  type OperationPermission,
  type PageStateDescriptor,
  type ProjectMemoryRecord,
  type ProjectRecord,
  type ProjectStatus,
  type TaskActivityRecord,
  type TaskCommentRecord,
  type TaskPriority,
  type ResourceAccessContext,
  type TaskRecord,
  type TaskStatus,
  type TaskWithDetails,
  type UserAccount,
  type WorkbenchItem,
  type WorkbenchNotification,
  type WorkbenchNotificationSeverity,
  type WorkbenchNotificationType,
  type WorkbenchResponse
} from "@xtgzpt/shared";

loadLocalEnv();

const moduleDir = dirname(fileURLToPath(import.meta.url));

interface LoginBody {
  username?: string;
  password?: string;
}

interface CreateProjectBody {
  title?: string;
  summary?: string;
  organizationId?: string;
}

interface AddProjectMemberBody {
  userId?: string;
}

interface ProjectStatusBody {
  status?: ProjectStatus;
}

interface CreateTaskBody {
  projectId?: string;
  title?: string;
  description?: string;
  assigneeUserId?: string;
  confirmerUserId?: string;
  priority?: TaskPriority;
  dueAt?: string | null;
}

interface TaskStatusBody {
  status?: TaskStatus;
  reason?: string;
}

interface TaskCommentBody {
  content?: string;
}

interface CreateChatThreadBody {
  title?: string;
  organizationId?: string;
  memberUserIds?: string[];
  relatedObjectType?: ChatThreadRecord["relatedObjectType"];
  relatedObjectId?: string;
}

interface SendChatMessageBody {
  content?: string;
}

interface ConfirmAiDraftBody {
  title?: string;
  content?: string;
  projectId?: string;
  assigneeUserId?: string;
  confirmerUserId?: string;
}

interface KnowledgeQueryBody {
  query?: string;
  organizationId?: string;
  projectId?: string;
  limit?: number;
}

interface CreateKnowledgeItemBody {
  title?: string;
  content?: string;
  organizationId?: string;
}

interface KnowledgeActionBody {
  reason?: string;
}

interface CreateKnowledgeVersionBody {
  title?: string;
  content?: string;
  submitForReview?: boolean;
}

interface UploadFileBody {
  sourceObjectType?: FileSourceObjectType;
  sourceObjectId?: string;
  displayName?: string;
  mimeType?: string;
  contentText?: string;
  formalProcess?: boolean;
}

interface ArchiveFileBody {
  reason?: string;
}

interface AiFileReferenceBody {
  fileIds?: string[];
}

interface UpdateAiFrameworkBody {
  status?: AiFrameworkRecord["status"];
  version?: string;
  provider?: AiFrameworkVersionRecord["provider"];
  model?: string;
  promptTemplate?: string;
  boundaryPolicy?: string;
  sourceEvidenceRequired?: boolean;
  retryPolicy?: Partial<AiRetryPolicy>;
  changeReason?: string;
}

interface ContractUploadBody {
  title?: string;
  organizationId?: string;
  fileName?: string;
  mimeType?: string;
  contentText?: string;
}

interface ContractPasteBody {
  title?: string;
  organizationId?: string;
  originalText?: string;
}

interface ContractRevisionBody {
  title?: string;
  originalText?: string;
  reason?: string;
}

interface ContractRiskConfirmationBody {
  confirmations?: Array<{
    riskId?: string;
    confirmed?: boolean;
    selectedOption?: ContractOptionKey;
    note?: string;
  }>;
  reason?: string;
}

interface ContractActionBody {
  reason?: string;
}

interface ContractExecutionEventBody {
  eventType?: ContractExecutionEventType;
  title?: string;
  notes?: string;
  status?: string;
  dueAt?: string | null;
}

interface CreateApprovalBody {
  sourceObjectType?: "contract";
  sourceObjectId?: string;
  reason?: string;
}

interface ApprovalActionBody {
  targetUserId?: string;
  reason?: string;
}

const sessionPrefix = "dev-session";
const devCredentials: Record<string, string> = {
  super: "113113",
  admin: "113113",
  knowledge: "113113",
  approver: "113113",
  finance: "113113",
  legal: "113113",
  contract: "113113",
  exec: "113113",
  dept: "113113",
  owner: "113113",
  member: "113113"
};

const allowedProjectTransitions: Record<ProjectStatus, ProjectStatus[]> = {
  draft: ["active"],
  active: ["paused", "completed"],
  paused: ["active"],
  completed: ["archived"],
  archived: []
};

const allowedTaskTransitions: Record<TaskStatus, TaskStatus[]> = {
  draft: ["todo", "cancelled"],
  todo: ["in_progress", "blocked", "cancelled"],
  in_progress: ["submitted", "blocked", "cancelled"],
  submitted: ["completed"],
  completed: ["archived"],
  blocked: ["in_progress", "cancelled"],
  cancelled: ["archived"],
  archived: []
};

const supportedFileSourceObjectTypes: FileSourceObjectType[] = [
  "project",
  "task",
  "chat_thread",
  "knowledge_item",
  "project_memory"
];

const contractFrameworkVersion = "contract-review-local-v1.0.0";

const supportedContractExecutionEventTypes: ContractExecutionEventType[] = ["reminder", "record", "status_update"];
const contractNoBodyActionRoutePattern = /^\/contracts\/[^/?]+\/(?:ai-review|second-review)(?:\?|$)/;
const supportedTaskPriorities: TaskPriority[] = ["low", "medium", "high", "urgent"];

function nowIso() {
  return new Date().toISOString();
}

function textOrDefault(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function nullableIsoString(value: string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : new Date(timestamp).toISOString();
}

function isFileSourceObjectType(value: unknown): value is FileSourceObjectType {
  return typeof value === "string" && supportedFileSourceObjectTypes.includes(value as FileSourceObjectType);
}

function isJsonContentType(value: string | string[] | undefined) {
  const contentType = Array.isArray(value) ? value[0] : value;
  return typeof contentType === "string" && contentType.toLowerCase().includes("application/json");
}

function headerHasBody(value: string | string[] | undefined) {
  const contentLength = Array.isArray(value) ? value[0] : value;
  return typeof contentLength === "string" && contentLength.trim() !== "" && contentLength.trim() !== "0";
}

interface AuditRecordInput {
  request: FastifyRequest;
  user?: UserAccount;
  action: string;
  objectType: string;
  objectId?: string | null;
  organizationId?: string | null;
  beforeSnapshotRef?: string | null;
  afterSnapshotRef?: string | null;
  reason: string;
  result: AuditResult;
  aiInvolved?: boolean;
  aiFrameworkVersion?: string | null;
}

function createSessionToken(user: UserAccount) {
  return `${sessionPrefix}:${user.id}:${randomUUID()}`;
}

export function buildServer(options: RuntimeStoreOptions = {}) {
  const sessions = new Map<string, string>();
  const store = createRuntimeStore(resolveRuntimeStoreOptions(options));
  const {
    deniedAccessEvents,
    auditLogs,
    projects,
    tasks,
    chatThreads,
    chatMessages,
    aiDrafts,
    aiFrameworks,
    aiFrameworkVersions,
    aiRuns,
    aiSnapshots,
    aiRunSourceEvidence,
    aiRunDecisions,
    knowledgeItems,
    knowledgeVersions,
    projectMemories,
    approvals,
    approvalNodes,
    approvalActions,
    contracts,
    contractVersions,
    contractReviews,
    contractRiskConfirmations,
    contractApprovalHandoffs,
    contractExecutionEvents,
    files,
    fileVersions,
    fileObjectBindings,
    taskActivities,
    taskComments
  } = store.state;
  const server = Fastify({
    logger: true
  });

  const defaultRetryPolicy: AiRetryPolicy = {
    maxRetries: 1,
    retryableFailureClasses: ["provider_error", "timeout", "rate_limited"],
    backoffSeconds: 2
  };

  async function ensureAiFrameworkDefaults() {
    const timestamp = new Date(0).toISOString();
    const defaults: Array<{
      id: string;
      name: string;
      scenario: AiScenario;
      version: string;
      provider: AiFrameworkVersionRecord["provider"];
      model: string;
      promptTemplate: string;
    }> = [
      {
        id: "chat_summary_v1",
        name: "聊天整理框架",
        scenario: "chat_summary",
        version: fallbackAiFrameworkVersion,
        provider: "template",
        model: "template",
        promptTemplate: "基于授权聊天消息生成摘要草稿，不能创建正式对象。"
      },
      {
        id: "task_draft_v1",
        name: "任务草稿框架",
        scenario: "task_draft",
        version: fallbackAiFrameworkVersion,
        provider: "template",
        model: "template",
        promptTemplate: "基于授权聊天消息生成任务草稿，必须等待人工确认。"
      },
      {
        id: "knowledge_draft_v1",
        name: "知识草稿框架",
        scenario: "knowledge_draft",
        version: fallbackAiFrameworkVersion,
        provider: "template",
        model: "template",
        promptTemplate: "基于授权聊天消息生成知识草稿，确认后只能提交审核。"
      },
      {
        id: "knowledge_query_v1",
        name: "知识问答框架",
        scenario: "knowledge_query",
        version: fallbackAiFrameworkVersion,
        provider: "template",
        model: "local-fulltext",
        promptTemplate: "只检索当前用户有权读取的已发布知识和项目记忆。"
      },
      {
        id: "contract_review_v1",
        name: "合同审查框架",
        scenario: "contract_review",
        version: contractFrameworkVersion,
        provider: "local_structured",
        model: "local-contract-review",
        promptTemplate: "基于授权合同版本输出风险、原文标注和 A/B/C 方案，不确认风险。"
      }
    ];

    let changed = false;

    for (const item of defaults) {
      if (aiFrameworks.some((framework) => framework.id === item.id)) {
        continue;
      }

      const versionId = `${item.id}:${item.version}`;
      aiFrameworks.push({
        id: item.id,
        name: item.name,
        scenario: item.scenario,
        organizationId: null,
        status: "active",
        activeVersionId: versionId,
        createdByUserId: "system",
        createdAt: timestamp,
        updatedAt: timestamp
      });
      aiFrameworkVersions.push({
        id: versionId,
        frameworkId: item.id,
        version: item.version,
        provider: item.provider,
        model: item.model,
        promptTemplate: item.promptTemplate,
        boundaryPolicy:
          "AI can analyze, summarize, remind, suggest, and draft only; human confirmation is required for formal business actions.",
        sourceEvidenceRequired: true,
        retryPolicy: defaultRetryPolicy,
        createdByUserId: "system",
        changeReason: "DEV-016 default framework seed",
        createdAt: timestamp
      });
      changed = true;
    }

    if (changed) {
      await store.save();
    }
  }

  server.addHook("onReady", async () => {
    await store.ready;
    await ensureAiFrameworkDefaults();
  });

  server.addHook("onClose", async () => {
    await store.close();
  });

  server.addHook("onRequest", async (request) => {
    if (
      request.method === "POST" &&
      contractNoBodyActionRoutePattern.test(request.url) &&
      isJsonContentType(request.headers["content-type"]) &&
      !headerHasBody(request.headers["content-length"]) &&
      request.headers["transfer-encoding"] === undefined
    ) {
      delete request.raw.headers["content-type"];
    }
  });

  function requestId(request: FastifyRequest) {
    return request.id;
  }

  function sourceIp(request: FastifyRequest) {
    return request.ip || "unknown";
  }

  async function recordAudit({
    request,
    user,
    action,
    objectType,
    objectId = null,
    organizationId = null,
    beforeSnapshotRef = null,
    afterSnapshotRef = null,
    reason,
    result,
    aiInvolved = false,
    aiFrameworkVersion = null
  }: AuditRecordInput) {
    const entry: AuditLogEntry = {
      id: randomUUID(),
      occurredAt: new Date().toISOString(),
      actorUserId: user?.id ?? null,
      actorRoleIds: user ? [user.role] : [],
      action,
      objectType,
      objectId,
      organizationId,
      sourceIp: sourceIp(request),
      requestId: requestId(request),
      beforeSnapshotRef,
      afterSnapshotRef,
      reason,
      result,
      aiInvolved,
      aiFrameworkVersion
    };

    auditLogs.push(entry);
    await store.save();
    return entry;
  }

  function appendTaskActivity({
    task,
    actorUserId,
    activityType,
    fromStatus,
    toStatus,
    note,
    timestamp = nowIso()
  }: {
    task: TaskRecord;
    actorUserId: string;
    activityType: TaskActivityRecord["activityType"];
    fromStatus: TaskStatus | null;
    toStatus: TaskStatus | null;
    note: string;
    timestamp?: string;
  }) {
    const activity: TaskActivityRecord = {
      id: `task-activity-${randomUUID()}`,
      taskId: task.id,
      actorUserId,
      activityType,
      fromStatus,
      toStatus,
      note,
      createdAt: timestamp
    };
    taskActivities.push(activity);
    return activity;
  }

  function activeAiFrameworkForScenario(scenario: AiScenario) {
    const framework = aiFrameworks.find((item) => item.scenario === scenario && item.status === "active") ??
      aiFrameworks.find((item) => item.scenario === scenario);
    const version = framework ? aiFrameworkVersions.find((item) => item.id === framework.activeVersionId) ?? null : null;

    return {
      framework: framework ?? null,
      version
    };
  }

  function classifyAiFailure(message: string): AiRunFailureClass {
    if (/permission|forbidden|unauthorized/i.test(message)) {
      return "permission_denied";
    }

    if (/timeout/i.test(message)) {
      return "timeout";
    }

    if (/429|rate/i.test(message)) {
      return "rate_limited";
    }

    if (/validation|required|invalid/i.test(message)) {
      return "validation_error";
    }

    if (/ark|provider|chat_failed|empty_content/i.test(message)) {
      return "provider_error";
    }

    return "unknown";
  }

  function createAiSnapshot(runId: string, kind: AiSnapshotKind, payload: unknown, timestamp: string) {
    const serialized = JSON.stringify(payload);
    const snapshot: AiSnapshotRecord = {
      id: `ai-snapshot-${randomUUID()}`,
      runId,
      kind,
      checksum: checksumForContent(serialized),
      payload,
      createdAt: timestamp
    };
    aiSnapshots.push(snapshot);
    return snapshot;
  }

  function aiRunWithDetails(run: AiRunRecord): AiRunWithDetails {
    return {
      ...run,
      framework: aiFrameworks.find((framework) => framework.id === run.frameworkId) ?? null,
      frameworkVersionRecord:
        aiFrameworkVersions.find((version) => version.id === run.frameworkVersionId) ?? null,
      inputSnapshot: aiSnapshots.find((snapshot) => snapshot.id === run.inputSnapshotRef) ?? null,
      outputSnapshot: run.outputSnapshotRef
        ? aiSnapshots.find((snapshot) => snapshot.id === run.outputSnapshotRef) ?? null
        : null,
      sourceEvidence: aiRunSourceEvidence.filter((evidence) => evidence.runId === run.id),
      decisions: aiRunDecisions.filter((decision) => decision.runId === run.id)
    };
  }

  async function createAiRun({
    request,
    user,
    scenario,
    organizationId,
    sourceObjectType,
    sourceObjectId,
    sourceIds,
    contextSourceIds,
    inputPayload
  }: {
    request: FastifyRequest;
    user: UserAccount;
    scenario: AiScenario;
    organizationId: string;
    sourceObjectType: AiRunSourceObjectType;
    sourceObjectId: string;
    sourceIds: string[];
    contextSourceIds: string[];
    inputPayload: unknown;
  }) {
    const selected = activeAiFrameworkForScenario(scenario);
    const timestamp = nowIso();
    const runId = `ai-run-${randomUUID()}`;
    const frameworkId = selected.framework?.id ?? `${scenario}_unconfigured`;
    const frameworkVersionId = selected.version?.id ?? `${frameworkId}:unconfigured`;
    const frameworkVersion = selected.version?.version ?? fallbackAiFrameworkVersion;
    const retryPolicy = selected.version?.retryPolicy ?? defaultRetryPolicy;
    const inputSnapshot = createAiSnapshot(runId, "input", inputPayload, timestamp);
    const run: AiRunRecord = {
      id: runId,
      frameworkId,
      frameworkVersionId,
      frameworkVersion,
      scenario,
      actorUserId: user.id,
      organizationId,
      sourceObjectType,
      sourceObjectId,
      sourceIds,
      inputSnapshotRef: inputSnapshot.id,
      outputSnapshotRef: null,
      contextSourceIds,
      status: "running",
      failureClass: null,
      failureMessage: null,
      retryPolicy,
      retryAttempt: 0,
      maxRetries: retryPolicy.maxRetries,
      createdAt: timestamp,
      completedAt: null
    };
    aiRuns.push(run);
    await recordAudit({
      request,
      user,
      action: "ai.run_created",
      objectType: "ai_run",
      objectId: run.id,
      organizationId,
      afterSnapshotRef: inputSnapshot.id,
      reason: `ai_run_created:${scenario}`,
      result: "success",
      aiInvolved: true,
      aiFrameworkVersion: run.frameworkVersion
    });
    return run;
  }

  function appendAiRunEvidence(run: AiRunRecord, evidence: Omit<AiRunSourceEvidenceRecord, "id" | "runId" | "createdAt">[]) {
    const timestamp = nowIso();
    aiRunSourceEvidence.push(
      ...evidence.map((item) => ({
        id: `ai-evidence-${randomUUID()}`,
        runId: run.id,
        createdAt: timestamp,
        ...item
      }))
    );
  }

  async function completeAiRun({
    request,
    user,
    run,
    status,
    outputPayload,
    failureClass = null,
    failureMessage = null,
    frameworkVersion,
    contextSourceIds
  }: {
    request: FastifyRequest;
    user: UserAccount;
    run: AiRunRecord;
    status: Exclude<AiRunStatus, "created" | "running">;
    outputPayload: unknown;
    failureClass?: AiRunFailureClass | null;
    failureMessage?: string | null;
    frameworkVersion?: string;
    contextSourceIds?: string[];
  }) {
    const timestamp = nowIso();
    const outputSnapshot = createAiSnapshot(run.id, "output", outputPayload, timestamp);
    run.status = status;
    run.outputSnapshotRef = outputSnapshot.id;
    run.failureClass = failureClass;
    run.failureMessage = failureMessage;
    run.completedAt = timestamp;
    run.frameworkVersion = frameworkVersion ?? run.frameworkVersion;
    run.contextSourceIds = contextSourceIds ?? run.contextSourceIds;
    await recordAudit({
      request,
      user,
      action: status === "succeeded" ? "ai.run_succeeded" : "ai.run_failed",
      objectType: "ai_run",
      objectId: run.id,
      organizationId: run.organizationId,
      beforeSnapshotRef: run.inputSnapshotRef,
      afterSnapshotRef: outputSnapshot.id,
      reason: status === "succeeded" ? `ai_run_succeeded:${run.scenario}` : failureMessage ?? "ai_run_failed",
      result: status === "succeeded" ? "success" : "failure",
      aiInvolved: true,
      aiFrameworkVersion: run.frameworkVersion
    });
    await store.save();
    return run;
  }

  function aiRunForDraft(draft: AiDraftRecord) {
    return aiRuns
      .filter((run) => run.sourceObjectType === "chat_thread" && run.sourceObjectId === draft.threadId)
      .find((run) => {
        if (run.status !== "succeeded" || !run.outputSnapshotRef) {
          return false;
        }

        const output = aiSnapshots.find((snapshot) => snapshot.id === run.outputSnapshotRef);
        if (!output || typeof output.payload !== "object" || output.payload === null || !("draftId" in output.payload)) {
          return false;
        }

        return (output.payload as { draftId?: unknown }).draftId === draft.id;
      });
  }

  async function recordAiRunDecision({
    request,
    user,
    run,
    draftId,
    decision,
    targetObjectType,
    targetObjectId,
    changeSummary,
    reason
  }: {
    request: FastifyRequest;
    user: UserAccount;
    run: AiRunRecord | undefined;
    draftId: string | null;
    decision: AiRunDecisionRecord["decision"];
    targetObjectType: string | null;
    targetObjectId: string | null;
    changeSummary: string | null;
    reason: string;
  }) {
    if (!run) {
      return undefined;
    }

    const decisionRecord: AiRunDecisionRecord = {
      id: `ai-decision-${randomUUID()}`,
      runId: run.id,
      draftId,
      decision,
      actorUserId: user.id,
      targetObjectType,
      targetObjectId,
      changeSummary,
      reason,
      createdAt: nowIso()
    };
    aiRunDecisions.push(decisionRecord);
    await recordAudit({
      request,
      user,
      action:
        decision === "adopted"
          ? "ai.output_adopted"
          : decision === "changed"
            ? "ai.output_changed"
            : "ai.output_rejected",
      objectType: "ai_run",
      objectId: run.id,
      organizationId: run.organizationId,
      reason,
      result: "success",
      aiInvolved: true,
      aiFrameworkVersion: run.frameworkVersion
    });
    await store.save();
    return decisionRecord;
  }

  async function recordDeniedAccess({
    request,
    user,
    dimension,
    action,
    resourceType,
    reason
  }: {
    request: FastifyRequest;
    user?: UserAccount;
    dimension: DeniedAccessEvent["dimension"];
    action: string;
    resourceType: string;
    reason: DeniedAccessEvent["reason"];
  }) {
    await recordAudit({
      request,
      user,
      action: `access.${reason}`,
      objectType: resourceType,
      reason: `${dimension}:${action}`,
      result: "denied"
    });
    deniedAccessEvents.push({
      id: randomUUID(),
      actorUserId: user?.id ?? null,
      dimension,
      action,
      resourceType,
      reason,
      requestId: requestId(request),
      createdAt: new Date().toISOString()
    });
    await store.save();
  }

  function canReadAuditEntry(user: UserAccount, entry: AuditLogEntry) {
    if (!canQueryAuditLogs(user.role)) {
      return false;
    }

    if (rolePolicies[user.role].dataScope === "all_organizations") {
      return true;
    }

    if (!entry.organizationId) {
      return true;
    }

    return visibleOrganizationsForUser(user).some((organization) => organization.id === entry.organizationId);
  }

  function auditResultFor(user: UserAccount, filter: AuditLogFilter = {}) {
    return auditLogs.filter((entry) => {
      if (!canReadAuditEntry(user, entry)) {
        return false;
      }

      if (filter.actorUserId && entry.actorUserId !== filter.actorUserId) {
        return false;
      }

      if (filter.objectType && entry.objectType !== filter.objectType) {
        return false;
      }

      if (filter.objectId && entry.objectId !== filter.objectId) {
        return false;
      }

      return true;
    });
  }

  function canReadProject(user: UserAccount, project: ProjectRecord) {
    return canAccessResourceData(user, {
      organizationId: project.organizationId,
      ownerUserId: project.ownerUserId,
      participantUserIds: project.memberUserIds
    });
  }

  function canManageProject(user: UserAccount, project: ProjectRecord) {
    return canPerformOperation(user, "edit_project", {
      organizationId: project.organizationId,
      ownerUserId: project.ownerUserId,
      participantUserIds: project.memberUserIds
    });
  }

  function visibleProjectsForUser(user: UserAccount) {
    return projects.filter((project) => project.status !== "archived" && canReadProject(user, project));
  }

  function visibleTasksForUser(user: UserAccount, projectId?: string) {
    return tasks.filter((task) => {
      if (projectId && task.projectId !== projectId) {
        return false;
      }

      const project = projects.find((item) => item.id === task.projectId);

      if (!project || project.status === "archived") {
        return false;
      }

      return canReadProject(user, project);
    });
  }

  function taskWithDetails(task: TaskRecord): TaskWithDetails {
    return {
      ...task,
      comments: taskComments.filter((comment) => comment.taskId === task.id),
      activities: taskActivities.filter((activity) => activity.taskId === task.id)
    };
  }

  function isTaskOverdue(task: TaskRecord) {
    return Boolean(
      task.dueAt &&
      Date.parse(task.dueAt) < Date.now() &&
      !["completed", "cancelled", "archived"].includes(task.status)
    );
  }

  function filterVisibleTasks(user: UserAccount, items: TaskRecord[], filters: Record<string, unknown>) {
    const view = typeof filters.view === "string" ? filters.view : "all";
    const status = typeof filters.status === "string" ? filters.status : null;
    const projectId = typeof filters.projectId === "string" ? filters.projectId : null;

    return items.filter((task) => {
      if (projectId && task.projectId !== projectId) {
        return false;
      }

      if (status && task.status !== status) {
        return false;
      }

      if (view === "mine") {
        return task.assigneeUserId === user.id || task.confirmerUserId === user.id;
      }

      if (view === "created") {
        return task.creatorUserId === user.id;
      }

      if (view === "confirm") {
        return task.confirmerUserId === user.id && task.status === "submitted";
      }

      if (view === "overdue") {
        return isTaskOverdue(task);
      }

      if (view === "completed") {
        return task.status === "completed";
      }

      return view === "all";
    });
  }

  function findVisibleProject(user: UserAccount, projectId: string) {
    const project = projects.find((item) => item.id === projectId);

    if (!project || !canReadProject(user, project)) {
      return undefined;
    }

    return project;
  }

  function findVisibleTask(user: UserAccount, taskId: string) {
    const task = tasks.find((item) => item.id === taskId);

    if (!task) {
      return undefined;
    }

    const project = findVisibleProject(user, task.projectId);

    if (!project) {
      return undefined;
    }

    return {
      task,
      project
    };
  }

  function canReadChatThread(user: UserAccount, thread: ChatThreadRecord) {
    return thread.memberUserIds.includes(user.id);
  }

  function visibleChatThreadsForUser(user: UserAccount) {
    return chatThreads.filter((thread) => thread.status !== "archived" && canReadChatThread(user, thread));
  }

  function canUseOrganizationScope(user: UserAccount, organizationId: string) {
    return visibleOrganizationsForUser(user).some((organization) => organization.id === organizationId);
  }

  function canReadKnowledgeItem(user: UserAccount, item: KnowledgeItemRecord) {
    return canAccessResourceData(user, {
      organizationId: item.organizationId,
      ownerUserId: item.creatorUserId,
      participantUserIds: item.sourceParticipantUserIds
    });
  }

  function canReviewKnowledgeItem(user: UserAccount, item: KnowledgeItemRecord) {
    return canPerformOperation(user, "publish_knowledge", {
      organizationId: item.organizationId,
      ownerUserId: item.creatorUserId,
      participantUserIds: item.sourceParticipantUserIds
    });
  }

  function canReadProjectMemory(user: UserAccount, item: ProjectMemoryRecord) {
    return canAccessResourceData(user, {
      organizationId: item.organizationId,
      ownerUserId: item.creatorUserId,
      participantUserIds: item.sourceParticipantUserIds
    });
  }

  function visibleKnowledgeItemsForUser(user: UserAccount) {
    return knowledgeItems.filter((item) => canReadKnowledgeItem(user, item) || canReviewKnowledgeItem(user, item));
  }

  function retrievableKnowledgeItemsForUser(user: UserAccount) {
    return knowledgeItems.filter((item) => item.status === "published" && canReadKnowledgeItem(user, item));
  }

  function visibleProjectMemoriesForUser(user: UserAccount) {
    return projectMemories.filter((item) => canReadProjectMemory(user, item));
  }

  function canReadContract(user: UserAccount, contract: ContractRecord) {
    return canAccessResourceData(user, {
      organizationId: contract.organizationId,
      ownerUserId: contract.creatorUserId,
      participantUserIds: contract.participantUserIds
    });
  }

  function contractResource(contract: ContractRecord): ResourceAccessContext {
    return {
      organizationId: contract.organizationId,
      ownerUserId: contract.creatorUserId,
      participantUserIds: contract.participantUserIds
    };
  }

  function visibleContractsForUser(user: UserAccount) {
    return contracts.filter((contract) => contract.status !== "archived" && canReadContract(user, contract));
  }

  function findVisibleContract(user: UserAccount, contractId: string) {
    const contract = contracts.find((candidate) => candidate.id === contractId);

    if (!contract || !canReadContract(user, contract)) {
      return undefined;
    }

    return contract;
  }

  function versionsForContract(contractId: string) {
    return contractVersions
      .filter((version) => version.contractId === contractId)
      .sort((left, right) => right.version - left.version);
  }

  function reviewsForContract(contractId: string) {
    return contractReviews
      .filter((review) => review.contractId === contractId)
      .sort((left, right) => right.version - left.version || right.createdAt.localeCompare(left.createdAt));
  }

  function currentContractVersion(contract: ContractRecord) {
    return contractVersions.find(
      (version) => version.contractId === contract.id && version.version === contract.currentVersion
    );
  }

  function latestContractReview(contract: ContractRecord) {
    return reviewsForContract(contract.id)[0];
  }

  function contractWithDetails(contract: ContractRecord) {
    return {
      ...contract,
      versions: versionsForContract(contract.id),
      reviews: reviewsForContract(contract.id),
      riskConfirmations: contractRiskConfirmations.filter((confirmation) => confirmation.contractId === contract.id),
      approvalHandoffs: contractApprovalHandoffs.filter((handoff) => handoff.contractId === contract.id),
      executionEvents: contractExecutionEvents
        .filter((event) => event.contractId === contract.id)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    };
  }

  function nodesForApproval(approvalId: string) {
    return approvalNodes
      .filter((node) => node.approvalId === approvalId)
      .sort((left, right) => left.sequence - right.sequence || left.createdAt.localeCompare(right.createdAt));
  }

  function actionsForApproval(approvalId: string) {
    return approvalActions
      .filter((action) => action.approvalId === approvalId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  function sourceContractForApproval(approval: ApprovalRecord) {
    return contracts.find((contract) => contract.id === approval.sourceObjectId);
  }

  function canReadApproval(user: UserAccount, approval: ApprovalRecord) {
    if (approval.initiatedByUserId === user.id || approval.currentApproverUserId === user.id) {
      return true;
    }

    if (nodesForApproval(approval.id).some((node) => node.approverUserId === user.id)) {
      return true;
    }

    const contract = sourceContractForApproval(approval);
    return Boolean(contract && canReadContract(user, contract));
  }

  function approvalSourceSummary(approval: ApprovalRecord) {
    const contract = sourceContractForApproval(approval);

    return {
      objectType: approval.sourceObjectType,
      objectId: approval.sourceObjectId,
      title: contract?.title ?? "审批来源",
      status: contract?.status ?? "unknown"
    };
  }

  function approvalWithDetails(approval: ApprovalRecord): ApprovalWithDetails {
    const currentApprover = approval.currentApproverUserId
      ? seedUsers.find((candidate) => candidate.id === approval.currentApproverUserId) ?? null
      : null;

    return {
      ...approval,
      nodes: nodesForApproval(approval.id),
      actions: actionsForApproval(approval.id),
      currentApprover: currentApprover ? getPublicUser(currentApprover) : null,
      sourceSummary: approvalSourceSummary(approval)
    };
  }

  function visibleApprovalsForUser(user: UserAccount) {
    return approvals.filter((approval) => canReadApproval(user, approval));
  }

  function canReadAiRun(user: UserAccount, run: AiRunRecord) {
    if (!canUseAiCapability(user, "read_ai_runs", {
      organizationId: run.organizationId,
      ownerUserId: run.actorUserId,
      participantUserIds: [run.actorUserId]
    })) {
      return false;
    }

    if (user.role === "super_admin" || run.actorUserId === user.id) {
      return true;
    }

    if (run.sourceObjectType === "chat_thread") {
      const thread = chatThreads.find((candidate) => candidate.id === run.sourceObjectId);
      return Boolean(thread && canReadChatThread(user, thread));
    }

    if (run.sourceObjectType === "contract") {
      const contract = contracts.find((candidate) => candidate.id === run.sourceObjectId);
      return Boolean(contract && canReadContract(user, contract));
    }

    if (run.sourceObjectType === "approval") {
      const approval = approvals.find((candidate) => candidate.id === run.sourceObjectId);
      return Boolean(approval && canReadApproval(user, approval));
    }

    return canAccessResourceData(user, {
      organizationId: run.organizationId,
      ownerUserId: run.actorUserId,
      participantUserIds: [run.actorUserId]
    });
  }

  function visibleAiRunsForUser(user: UserAccount) {
    return aiRuns.filter((run) => canReadAiRun(user, run)).map(aiRunWithDetails);
  }

  function findVisibleApproval(user: UserAccount, approvalId: string) {
    const approval = approvals.find((candidate) => candidate.id === approvalId);

    if (!approval || !canReadApproval(user, approval)) {
      return undefined;
    }

    return approval;
  }

  function currentApprovalNode(approval: ApprovalRecord) {
    return approval.currentNodeId
      ? approvalNodes.find((node) => node.id === approval.currentNodeId && node.approvalId === approval.id)
      : undefined;
  }

  function approvalResource(approval: ApprovalRecord) {
    const contract = sourceContractForApproval(approval);

    return {
      organizationId: approval.organizationId,
      ownerUserId: approval.initiatedByUserId,
      participantUserIds: [
        approval.initiatedByUserId,
        approval.currentApproverUserId,
        ...(contract?.participantUserIds ?? []),
        ...nodesForApproval(approval.id).map((node) => node.approverUserId)
      ].filter((userId): userId is string => Boolean(userId))
    };
  }

  function isHumanApprover(userId: string | undefined) {
    if (!userId) {
      return false;
    }

    const user = seedUsers.find((candidate) => candidate.id === userId && candidate.status === "active");
    return Boolean(user && rolePolicies[user.role].approval.some((permission) =>
      ["approve_current_node", "reject_current_node", "return_for_revision"].includes(permission)
    ));
  }

  function shiftApprovalNodeSequences(approvalId: string, fromSequence: number) {
    for (const node of approvalNodes) {
      if (node.approvalId === approvalId && node.sequence >= fromSequence) {
        node.sequence += 1;
        node.updatedAt = nowIso();
      }
    }
  }

  function setApprovalCurrentNode(approval: ApprovalRecord, node: ApprovalNodeRecord | null, timestamp: string) {
    approval.currentNodeId = node?.id ?? null;
    approval.currentApproverUserId = node?.approverUserId ?? null;
    approval.updatedAt = timestamp;

    if (node) {
      node.status = "processing";
      node.enteredAt = node.enteredAt ?? timestamp;
      node.updatedAt = timestamp;
    }
  }

  function writeBackApprovalResult(approval: ApprovalRecord, status: "approved" | "rejected" | "returned", timestamp: string) {
    const contract = sourceContractForApproval(approval);

    if (!contract) {
      return;
    }

    if (status === "approved") {
      contract.status = "approved";
      approval.resultWritebackStatus = "contract.approved";
    }

    if (status === "rejected") {
      contract.status = "rejected";
      approval.resultWritebackStatus = "contract.rejected";
    }

    if (status === "returned") {
      contract.status = "revision_required";
      approval.resultWritebackStatus = "contract.revision_required";
    }

    contract.updatedAt = timestamp;
  }

  function createContractApprovalInstance({
    contract,
    version,
    handoff,
    user,
    timestamp
  }: {
    contract: ContractRecord;
    version: ContractVersionRecord;
    handoff: ContractApprovalHandoffRecord;
    user: UserAccount;
    timestamp: string;
    reason: string;
  }) {
    const existing = approvals.find(
      (approval) =>
        approval.sourceObjectType === "contract" &&
        approval.sourceObjectId === contract.id &&
        ["submitted", "processing"].includes(approval.status)
    );

    if (existing) {
      handoff.approvalEngineImplemented = true;
      handoff.approvalId = existing.id;
      contract.approvalHandoffId = handoff.id;
      contract.status = "approval_pending";
      contract.updatedAt = timestamp;
      return existing;
    }

    const approval: ApprovalRecord = {
      id: `approval-${randomUUID()}`,
      title: `${contract.title} 合同审批`,
      organizationId: contract.organizationId,
      sourceObjectType: "contract",
      sourceObjectId: contract.id,
      sourceSnapshotRef: version.id,
      initiatedByUserId: user.id,
      status: "processing",
      currentNodeId: null,
      currentApproverUserId: null,
      resultWritebackStatus: null,
      createdAt: timestamp,
      submittedAt: timestamp,
      completedAt: null,
      updatedAt: timestamp
    };
    const nodes: ApprovalNodeRecord[] = [
      {
        id: `approval-node-${randomUUID()}`,
        approvalId: approval.id,
        sequence: 1,
        name: "法务审批",
        approverUserId: "user-legal",
        status: "processing",
        enteredAt: timestamp,
        decidedAt: null,
        decidedByUserId: null,
        decisionReason: null,
        fromNodeId: null,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: `approval-node-${randomUUID()}`,
        approvalId: approval.id,
        sequence: 2,
        name: "财务审批",
        approverUserId: "user-finance",
        status: "pending",
        enteredAt: null,
        decidedAt: null,
        decidedByUserId: null,
        decisionReason: null,
        fromNodeId: null,
        createdAt: timestamp,
        updatedAt: timestamp
      },
      {
        id: `approval-node-${randomUUID()}`,
        approvalId: approval.id,
        sequence: 3,
        name: "业务审批",
        approverUserId: "user-approver",
        status: "pending",
        enteredAt: null,
        decidedAt: null,
        decidedByUserId: null,
        decisionReason: null,
        fromNodeId: null,
        createdAt: timestamp,
        updatedAt: timestamp
      }
    ];

    approval.currentNodeId = nodes[0].id;
    approval.currentApproverUserId = nodes[0].approverUserId;
    approvals.push(approval);
    approvalNodes.push(...nodes);
    handoff.approvalEngineImplemented = true;
    handoff.approvalId = approval.id;
    contract.approvalHandoffId = handoff.id;
    contract.status = "approval_pending";
    contract.updatedAt = timestamp;

    return approval;
  }

  function contractSourceEvidence({
    sourceType,
    sourceId,
    title,
    fileName,
    mimeType,
    user,
    timestamp,
    originalText
  }: {
    sourceType: ContractEntryMethod | "revision";
    sourceId: string;
    title: string;
    fileName?: string | null;
    mimeType?: string | null;
    user: UserAccount;
    timestamp: string;
    originalText: string;
  }): ContractSourceEvidence[] {
    return [
      {
        sourceType,
        sourceId,
        title,
        fileName: fileName ?? null,
        mimeType: mimeType ?? null,
        capturedByUserId: user.id,
        capturedAt: timestamp,
        excerpt: originalText.slice(0, 320)
      }
    ];
  }

  function clauseForText(text: string, matcher: RegExp, fallback: string) {
    const lines = text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const matchedLine = lines.find((line) => matcher.test(line)) ?? lines[0] ?? fallback;
    const startOffset = Math.max(0, text.indexOf(matchedLine));

    return {
      quote: matchedLine.slice(0, 220),
      startOffset,
      endOffset: startOffset + matchedLine.length
    };
  }

  function buildContractRisk(
    index: number,
    reviewType: ContractReviewType,
    title: string,
    severity: ContractRiskSeverity,
    clause: ReturnType<typeof clauseForText>,
    explanation: string,
    options: Record<ContractOptionKey, string>
  ): { risk: ContractReviewRisk; highlight: ContractTextHighlight } {
    const riskId = `risk-${reviewType}-${index}`;
    const sourceRef = `clause_${index}`;
    const risk: ContractReviewRisk = {
      id: riskId,
      title,
      severity,
      sourceRef,
      sourceQuote: clause.quote,
      explanation,
      options,
      requiresHumanConfirmation: true,
      humanConfirmed: false,
      selectedOption: null,
      confirmationNote: null,
      confirmedByUserId: null,
      confirmedAt: null
    };
    const highlight: ContractTextHighlight = {
      id: `highlight-${reviewType}-${index}`,
      riskId,
      sourceRef,
      quote: clause.quote,
      startOffset: clause.startOffset,
      endOffset: clause.endOffset,
      severity,
      reason: explanation
    };

    return {
      risk,
      highlight
    };
  }

  function buildStructuredContractReview({
    contract,
    version,
    reviewType,
    user,
    timestamp
  }: {
    contract: ContractRecord;
    version: ContractVersionRecord;
    reviewType: ContractReviewType;
    user: UserAccount;
    timestamp: string;
  }): ContractReviewRecord {
    const text = version.originalText;
    const candidates: Array<Omit<ReturnType<typeof buildContractRisk>, "risk" | "highlight"> & {
      enabled: boolean;
      title: string;
      severity: ContractRiskSeverity;
      clause: ReturnType<typeof clauseForText>;
      explanation: string;
      options: Record<ContractOptionKey, string>;
    }> = [
      {
        enabled: /付款|支付|payment|pay/i.test(text),
        title: "付款条款风险",
        severity: "high",
        clause: clauseForText(text, /付款|支付|payment|pay/i, text),
        explanation: "付款节点、条件或凭证不清晰时，后续执行和审批容易产生争议。",
        options: {
          A: "补充明确付款触发条件、付款资料清单和最晚付款日。",
          B: "保留现有金额安排，增加对账确认和延期处理条款。",
          C: "要求对方接受先验收后付款，并增加付款争议暂停机制。"
        }
      },
      {
        enabled: /违约|赔偿|penalty|liquidated/i.test(text),
        title: "违约责任风险",
        severity: "medium",
        clause: clauseForText(text, /违约|赔偿|penalty|liquidated/i, text),
        explanation: "违约责任缺少上限或触发条件时，合同责任边界不稳定。",
        options: {
          A: "设置违约金上限并限定适用场景。",
          B: "保留违约责任，但增加整改期和举证要求。",
          C: "将高额违约责任改为实际损失赔偿并排除间接损失。"
        }
      },
      {
        enabled: /验收|交付|delivery|acceptance/i.test(text),
        title: "交付验收风险",
        severity: "medium",
        clause: clauseForText(text, /验收|交付|delivery|acceptance/i, text),
        explanation: "交付物、验收标准或拒收流程不清晰会影响合同执行跟踪。",
        options: {
          A: "补充交付清单、验收标准和书面确认流程。",
          B: "增加默认验收期限和异议处理窗口。",
          C: "要求按里程碑分批交付并逐项验收。"
        }
      },
      {
        enabled: /解除|终止|termination|cancel/i.test(text),
        title: "解除终止风险",
        severity: "low",
        clause: clauseForText(text, /解除|终止|termination|cancel/i, text),
        explanation: "终止条件和后续结算责任需要可执行的书面边界。",
        options: {
          A: "列明可解除事项、通知期限和结算规则。",
          B: "保留终止条款并增加善后交接义务。",
          C: "要求重大违约达到书面催告后仍未整改才可解除。"
        }
      }
    ];
    const selected = candidates.filter((candidate) => candidate.enabled);
    const activeCandidates = selected.length > 0 ? selected : [
      {
        enabled: true,
        title: "条款完整性风险",
        severity: "medium" as const,
        clause: clauseForText(text, /./, text || contract.title),
        explanation: "当前文本未命中明确风险关键词，仍需人工确认关键条款是否完整。",
        options: {
          A: "由合同发起人补充付款、交付、违约和终止条款。",
          B: "提交法务进行逐条人工核对后再进入审批。",
          C: "退回业务方补充来源证据和合同背景。"
        }
      }
    ];
    const built = activeCandidates.map((candidate, index) =>
      buildContractRisk(index + 1, reviewType, candidate.title, candidate.severity, candidate.clause, candidate.explanation, candidate.options)
    );
    const riskLevel: ContractRiskSeverity = built.some((item) => item.risk.severity === "high")
      ? "high"
      : built.some((item) => item.risk.severity === "medium")
        ? "medium"
        : "low";

    return {
      id: `contract-review-${randomUUID()}`,
      contractId: contract.id,
      versionId: version.id,
      version: version.version,
      reviewType,
      status: "succeeded",
      frameworkId: "contract_review_v1",
      frameworkVersion: contractFrameworkVersion,
      summary: `${contract.title} v${version.version} ${reviewType === "second" ? "二次" : "初次"}结构化审查完成，风险需人工确认。`,
      riskLevel,
      risks: built.map((item) => item.risk),
      highlights: built.map((item) => item.highlight),
      nextRequiredAction: "human_confirm_risks",
      createdByUserId: user.id,
      createdAt: timestamp,
      completedAt: timestamp
    };
  }

  function normalizeSearchText(value: string) {
    return value.trim().toLocaleLowerCase();
  }

  function scoreSearchCandidate(queryTerms: string[], title: string, content: string) {
    const normalizedTitle = normalizeSearchText(title);
    const normalizedContent = normalizeSearchText(content);
    const matchedFields = new Set<string>();
    let relevanceScore = 0;

    for (const term of queryTerms) {
      if (normalizedTitle.includes(term)) {
        relevanceScore += 3;
        matchedFields.add("title");
      }

      if (normalizedContent.includes(term)) {
        relevanceScore += 1;
        matchedFields.add("content");
      }
    }

    return {
      relevanceScore,
      matchedFields: Array.from(matchedFields)
    };
  }

  function splitQueryTerms(query: string) {
    return normalizeSearchText(query)
      .split(/\s+/)
      .map((term) => term.trim())
      .filter(Boolean);
  }

  function evidenceFromDraftAndThread(draft: AiDraftRecord, thread: ChatThreadRecord): KnowledgeSourceEvidence[] {
    return [
      {
        sourceType: "ai_draft",
        sourceId: draft.id,
        sourceMessageIds: draft.sourceMessageIds,
        sourceParticipantUserIds: thread.memberUserIds,
        title: draft.title,
        excerpt: draft.content.slice(0, 240)
      },
      ...draft.sourceMessageIds.map((messageId) => {
        const message = chatMessages.find((candidate) => candidate.id === messageId);

        return {
          sourceType: "chat_message" as const,
          sourceId: messageId,
          sourceMessageIds: [messageId],
          sourceParticipantUserIds: thread.memberUserIds,
          title: thread.title,
          excerpt: message?.content.slice(0, 240) ?? "source_message"
        };
      })
    ];
  }

  function evidenceForProjectMemory(item: ProjectMemoryRecord): KnowledgeSourceEvidence[] {
    return [
      {
        sourceType: "project_memory",
        sourceId: item.sourceDraftId,
        sourceMessageIds: item.sourceMessageIds,
        sourceParticipantUserIds: item.sourceParticipantUserIds,
        title: item.title,
        excerpt: item.content.slice(0, 240)
      }
    ];
  }

  function currentKnowledgeVersion(item: KnowledgeItemRecord) {
    return knowledgeVersions.find(
      (version) => version.knowledgeItemId === item.id && version.version === item.currentVersion
    );
  }

  function searchKnowledgeAndMemory({
    user,
    query,
    organizationId,
    projectId,
    limit = 8
  }: {
    user: UserAccount;
    query: string;
    organizationId?: string;
    projectId?: string | null;
    limit?: number;
  }) {
    const queryTerms = splitQueryTerms(query);

    if (queryTerms.length === 0) {
      return [];
    }

    const knowledgeResults: KnowledgeSearchResult[] = retrievableKnowledgeItemsForUser(user)
      .filter((item) => !organizationId || item.organizationId === organizationId)
      .map((item) => {
        const score = scoreSearchCandidate(queryTerms, item.title, item.content);

        return {
          id: item.id,
          type: "knowledge_item",
          title: item.title,
          content: item.content,
          organizationId: item.organizationId,
          projectId: null,
          sourceId: item.sourceDraftId,
          sourceMessageIds: item.sourceMessageIds,
          sourceEvidence: item.sourceEvidence,
          relevanceScore: score.relevanceScore,
          matchedFields: score.matchedFields,
          createdAt: item.createdAt
        };
      });
    const memoryResults: KnowledgeSearchResult[] = visibleProjectMemoriesForUser(user)
      .filter((item) => !organizationId || item.organizationId === organizationId)
      .filter((item) => !projectId || item.projectId === projectId)
      .map((item) => {
        const score = scoreSearchCandidate(queryTerms, item.title, item.content);

        return {
          id: item.id,
          type: "project_memory",
          title: item.title,
          content: item.content,
          organizationId: item.organizationId,
          projectId: item.projectId,
          sourceId: item.sourceDraftId,
          sourceMessageIds: item.sourceMessageIds,
          sourceEvidence: evidenceForProjectMemory(item),
          relevanceScore: score.relevanceScore,
          matchedFields: score.matchedFields,
          createdAt: item.createdAt
        };
      });

    return [...knowledgeResults, ...memoryResults]
      .filter((item) => item.relevanceScore > 0)
      .sort((left, right) => {
        if (right.relevanceScore !== left.relevanceScore) {
          return right.relevanceScore - left.relevanceScore;
        }

        return right.createdAt.localeCompare(left.createdAt);
      })
      .slice(0, Math.max(1, Math.min(limit, 20)));
  }

  function findVisibleChatThread(user: UserAccount, threadId: string) {
    const thread = chatThreads.find((item) => item.id === threadId);

    if (!thread || !canReadChatThread(user, thread)) {
      return undefined;
    }

    return thread;
  }

  function findVisibleAiDraft(user: UserAccount, draftId: string) {
    const draft = aiDrafts.find((item) => item.id === draftId);

    if (!draft) {
      return undefined;
    }

    const thread = findVisibleChatThread(user, draft.threadId);

    if (!thread) {
      return undefined;
    }

    return {
      draft,
      thread
    };
  }

  function fileVersionPublic(version: FileVersionRecord) {
    const { contentText: _contentText, ...publicVersion } = version;
    return publicVersion;
  }

  function checksumForContent(content: string) {
    return createHash("sha256").update(content).digest("hex");
  }

  function sourceResourceForUser(
    user: UserAccount,
    objectType: FileSourceObjectType,
    objectId: string
  ):
    | {
        organizationId: string;
        ownerUserId?: string;
        participantUserIds: string[];
      }
    | undefined {
    if (objectType === "project") {
      const project = findVisibleProject(user, objectId);

      if (!project) {
        return undefined;
      }

      return {
        organizationId: project.organizationId,
        ownerUserId: project.ownerUserId,
        participantUserIds: project.memberUserIds
      };
    }

    if (objectType === "task") {
      const visibleTask = findVisibleTask(user, objectId);

      if (!visibleTask) {
        return undefined;
      }

      const { task, project } = visibleTask;
      return {
        organizationId: project.organizationId,
        ownerUserId: task.creatorUserId,
        participantUserIds: Array.from(
          new Set([project.ownerUserId, ...project.memberUserIds, task.assigneeUserId, task.confirmerUserId])
        )
      };
    }

    if (objectType === "chat_thread") {
      const thread = findVisibleChatThread(user, objectId);

      if (!thread) {
        return undefined;
      }

      return {
        organizationId: thread.organizationId,
        ownerUserId: thread.creatorUserId,
        participantUserIds: thread.memberUserIds
      };
    }

    if (objectType === "knowledge_item") {
      const item = knowledgeItems.find((candidate) => candidate.id === objectId);

      if (!item || !canReadKnowledgeItem(user, item)) {
        return undefined;
      }

      return {
        organizationId: item.organizationId,
        ownerUserId: item.creatorUserId,
        participantUserIds: item.sourceParticipantUserIds
      };
    }

    const memory = projectMemories.find((candidate) => candidate.id === objectId);

    if (!memory || !canReadProjectMemory(user, memory)) {
      return undefined;
    }

    return {
      organizationId: memory.organizationId,
      ownerUserId: memory.creatorUserId,
      participantUserIds: memory.sourceParticipantUserIds
    };
  }

  function fileSourceResourceForUser(user: UserAccount, file: FileAssetRecord) {
    return sourceResourceForUser(user, file.sourceObjectType, file.sourceObjectId);
  }

  function canUseFile(user: UserAccount, file: FileAssetRecord, action: FilePermission) {
    if (file.status === "archived" && action !== "view") {
      return false;
    }

    const resource = fileSourceResourceForUser(user, file);
    return Boolean(resource && canAccessFileAction(user, action, resource));
  }

  function findAccessibleFile(user: UserAccount, fileId: string, action: FilePermission) {
    const file = files.find((candidate) => candidate.id === fileId);

    if (!file || !canUseFile(user, file, action)) {
      return undefined;
    }

    const version = fileVersions.find((candidate) => candidate.id === file.currentVersionId && candidate.fileId === file.id);

    if (!version) {
      return undefined;
    }

    return {
      file,
      version
    };
  }

  async function recordFileDenied(request: FastifyRequest, user: UserAccount | undefined, action: string) {
    await recordDeniedAccess({
      request,
      user,
      dimension: "file",
      action,
      resourceType: "file",
      reason: user ? "forbidden" : "unauthenticated"
    });
  }

  function visibleFilesForObject(user: UserAccount, objectType: FileSourceObjectType, objectId: string) {
    const resource = sourceResourceForUser(user, objectType, objectId);

    if (!resource || !canAccessFileAction(user, "view", resource)) {
      return undefined;
    }

    const fileIds = new Set(
      fileObjectBindings
        .filter((binding) => binding.objectType === objectType && binding.objectId === objectId)
        .map((binding) => binding.fileId)
    );

    return files.filter((file) => fileIds.has(file.id) && canUseFile(user, file, "view"));
  }

  function latestThreadMessageIds(threadId: string) {
    return chatMessages
      .filter((message) => message.threadId === threadId && message.status !== "withdrawn")
      .map((message) => message.id);
  }

  function threadWithMessageCount(thread: ChatThreadRecord) {
    return {
      ...thread,
      messageCount: chatMessages.filter((message) => message.threadId === thread.id && message.status !== "withdrawn").length
    };
  }

  function projectWithTaskCount(project: ProjectRecord) {
    return {
      ...project,
      taskCount: tasks.filter((task) => task.projectId === project.id && task.status !== "archived").length
    };
  }

  function canChangeTaskStatus(user: UserAccount, task: TaskRecord, project: ProjectRecord, nextStatus: TaskStatus) {
    if (project.ownerUserId === user.id) {
      return true;
    }

    if (nextStatus === "completed") {
      return task.confirmerUserId === user.id;
    }

    if (nextStatus === "in_progress" || nextStatus === "submitted" || nextStatus === "blocked") {
      return task.assigneeUserId === user.id;
    }

    if (nextStatus === "cancelled") {
      return task.assigneeUserId === user.id || task.creatorUserId === user.id;
    }

    return false;
  }

  function workbenchItem(input: WorkbenchItem): WorkbenchItem {
    return input;
  }

  function workbenchNotification({
    user,
    type,
    severity,
    title,
    body,
    module,
    relatedObjectType = null,
    relatedObjectId = null
  }: {
    user: UserAccount;
    type: WorkbenchNotificationType;
    severity: WorkbenchNotificationSeverity;
    title: string;
    body: string;
    module: ModuleKey;
    relatedObjectType?: string | null;
    relatedObjectId?: string | null;
  }): WorkbenchNotification {
    return {
      id: `notification-${type}-${user.id}-${relatedObjectId ?? module}`,
      type,
      severity,
      title,
      body,
      module,
      relatedObjectType,
      relatedObjectId,
      createdAt: nowIso()
    };
  }

  function canConfirmAiDraftForWorkbench(user: UserAccount, draft: AiDraftRecord, thread: ChatThreadRecord) {
    if (draft.status !== "draft") {
      return false;
    }

    if (draft.kind === "chat_summary") {
      return true;
    }

    if (draft.kind === "task_draft") {
      const project =
        thread.relatedObjectType === "project" && thread.relatedObjectId
          ? findVisibleProject(user, thread.relatedObjectId)
          : undefined;

      return Boolean(
        project &&
          canPerformOperation(user, "create_task", {
            organizationId: project.organizationId,
            ownerUserId: user.id,
            participantUserIds: project.memberUserIds
          })
      );
    }

    return canPerformOperation(user, "publish_knowledge", {
      organizationId: thread.organizationId,
      participantUserIds: thread.memberUserIds
    });
  }

  function pageStatesForWorkbench({
    hasVisibleWork,
    hasErrors,
    hasArchivedProjects
  }: {
    hasVisibleWork: boolean;
    hasErrors: boolean;
    hasArchivedProjects: boolean;
  }): PageStateDescriptor[] {
    return [
      {
        key: "normal",
        label: "正常",
        status: hasVisibleWork ? "active" : "available",
        evidence: hasVisibleWork ? "当前账号存在可处理或可查看工作。" : "有数据时进入正常列表和详情。"
      },
      {
        key: "empty",
        label: "空状态",
        status: hasVisibleWork ? "available" : "active",
        evidence: hasVisibleWork ? "列表为空时展示空状态，不编造业务数据。" : "当前账号暂无待处理工作。"
      },
      {
        key: "loading",
        label: "加载中",
        status: "available",
        evidence: "前端请求工作台、项目、任务、聊天和知识数据时展示。"
      },
      {
        key: "no-permission",
        label: "无权限",
        status: "available",
        evidence: "菜单、数据、操作、审批、文件和 AI 权限拒绝时展示，并由后端记录审计。"
      },
      {
        key: "error",
        label: "错误",
        status: hasErrors ? "active" : "available",
        evidence: hasErrors ? "当前会话存在无权限或失败审计。" : "请求失败或状态流转失败时展示。"
      },
      {
        key: "AI_Generating",
        label: "AI 生成中",
        status: "available",
        evidence: "生成 AI 草稿期间禁用重复提交，AI 仍只能输出草稿。"
      },
      {
        key: "AI_Failed",
        label: "AI 失败",
        status: "available",
        evidence: "AI provider 失败返回失败状态，不生成正式对象。"
      },
      {
        key: "expired",
        label: "已过期",
        status: "available",
        evidence: "合同和审批期限对象按到期状态展示；未产生期限实例时保持空状态。"
      },
      {
        key: "archived",
        label: "已归档",
        status: hasArchivedProjects ? "active" : "available",
        evidence: hasArchivedProjects ? "当前存在归档项目，默认列表不展示。" : "归档对象默认从主列表移除。"
      }
    ];
  }

  function workbenchForUser(user: UserAccount): WorkbenchResponse {
    const visibleProjects = visibleProjectsForUser(user);
    const visibleTasks = visibleTasksForUser(user);
    const visibleThreads = visibleChatThreadsForUser(user);
    const visibleThreadIds = new Set(visibleThreads.map((thread) => thread.id));
    const responsibleTasks = visibleTasks.filter(
      (task) => task.assigneeUserId === user.id && task.status !== "completed" && task.status !== "archived"
    );
    const submittedConfirmations = visibleTasks.filter(
      (task) => task.confirmerUserId === user.id && task.status === "submitted"
    );
    const pendingWork = visibleTasks.filter(
      (task) =>
        ((task.assigneeUserId === user.id && ["todo", "in_progress", "blocked"].includes(task.status)) ||
          (task.confirmerUserId === user.id && task.status === "submitted")) &&
        task.status !== "archived"
    );
    const contractConfirmations = visibleContractsForUser(user)
      .filter((contract) => ["risk_pending_confirm", "revision_required"].includes(contract.status))
      .map((contract) =>
        workbenchItem({
          id: `contract-confirmation:${contract.id}`,
          kind: "contract_confirmation",
          title: contract.title,
          description:
            contract.status === "approval_pending"
              ? "合同已完成 DEV-014 审批边界提交，等待后续人工审批引擎处理。"
              : "合同风险、修改或二次审查需要人类处理，AI 不能确认风险或选择方案。",
          module: "contracts",
          status: contract.status,
          objectType: "contract",
          objectId: contract.id,
          organizationId: contract.organizationId,
          updatedAt: contract.updatedAt
        })
      );
    const pendingApprovalItems = visibleApprovalsForUser(user)
      .filter((approval) => approval.status === "processing" && approval.currentApproverUserId === user.id)
      .map((approval) =>
        workbenchItem({
          id: `pending-approval:${approval.id}`,
          kind: "pending_approval",
          title: approval.title,
          description: `${approvalSourceSummary(approval).title} 当前节点需要你人工处理。`,
          module: "approvals",
          status: approval.status,
          objectType: "approval",
          objectId: approval.id,
          organizationId: approval.organizationId,
          updatedAt: approval.updatedAt
        })
      );
    const aiConfirmations = aiDrafts
      .filter((draft) => visibleThreadIds.has(draft.threadId) && draft.status === "draft")
      .flatMap((draft) => {
        const thread = visibleThreads.find((item) => item.id === draft.threadId);

        if (!thread || !canConfirmAiDraftForWorkbench(user, draft, thread)) {
          return [];
        }

        return [
          workbenchItem({
            id: `ai-confirmation:${draft.id}`,
            kind: "ai_confirmation",
            title: draft.title,
            description: "AI 输出仍是草稿，必须由人工确认后才可入库。",
            module: "chat",
            status: draft.kind,
            objectType: "ai_draft",
            objectId: draft.id,
            organizationId: thread.organizationId,
            updatedAt: draft.createdAt
          })
        ];
      });
    const projectItems = visibleProjects.map((project) =>
      workbenchItem({
        id: `participating-project:${project.id}`,
        kind: "participating_project",
        title: project.title,
        description: project.summary,
        module: "projects",
        status: project.status,
        objectType: "project",
        objectId: project.id,
        organizationId: project.organizationId,
        updatedAt: project.updatedAt
      })
    );
    const pendingTaskItems = pendingWork.map((task) => {
      const project = projects.find((item) => item.id === task.projectId);
      return workbenchItem({
        id: `pending-task:${task.id}`,
        kind: "pending_task",
        title: task.title,
        description:
          task.confirmerUserId === user.id && task.status === "submitted"
            ? "等待你人工确认完成，AI 不能代为确认。"
            : task.description,
        module: "tasks",
        status: task.status,
        objectType: "task",
        objectId: task.id,
        organizationId: project?.organizationId ?? null,
        updatedAt: task.updatedAt
      });
    });
    const responsibleTaskItems = responsibleTasks.map((task) => {
      const project = projects.find((item) => item.id === task.projectId);
      return workbenchItem({
        id: `responsible-task:${task.id}`,
        kind: "responsible_task",
        title: task.title,
        description: task.description,
        module: "tasks",
        status: task.status,
        objectType: "task",
        objectId: task.id,
        organizationId: project?.organizationId ?? null,
        updatedAt: task.updatedAt
      });
    });
    const notifications: WorkbenchNotification[] = [];
    const latestPendingTask = pendingTaskItems[0];
    const latestAiConfirmation = aiConfirmations[0];
    const userDeniedCount = deniedAccessEvents.filter((event) => event.actorUserId === user.id).length;
    const canHandleApproval = rolePolicies[user.role].approval.some((permission) =>
      ["approve_current_node", "reject_current_node", "return_for_revision"].includes(permission)
    );
    const canReviewContracts = rolePolicies[user.role].ai.includes("contract_review") || rolePolicies[user.role].menu.includes("contracts");
    const isAdministrator = canManageSettings(user.role);
    const archivedProjectCount = projects.filter((project) => project.status === "archived" && canReadProject(user, project)).length;

    if (latestPendingTask) {
      notifications.push(
        workbenchNotification({
          user,
          type: "pending_work",
          severity: submittedConfirmations.length > 0 ? "warning" : "info",
          title: `${pendingTaskItems.length} 项待处理工作`,
          body: latestPendingTask.description,
          module: "tasks",
          relatedObjectType: latestPendingTask.objectType,
          relatedObjectId: latestPendingTask.objectId
        })
      );
    } else {
      notifications.push(
        workbenchNotification({
          user,
          type: "pending_work",
          severity: "info",
          title: "暂无待处理工作",
          body: "当前账号没有待提交或待确认任务。",
          module: "workbench"
        })
      );
    }

    notifications.push(
      workbenchNotification({
        user,
        type: "approval",
        severity: pendingApprovalItems.length > 0 ? "warning" : canHandleApproval ? "info" : "warning",
        title: pendingApprovalItems.length > 0
          ? `${pendingApprovalItems.length} 个审批节点待处理`
          : canHandleApproval
            ? "暂无待审批节点"
            : "无审批处理权限",
        body: pendingApprovalItems[0]?.description ?? "审批必须由当前节点人类处理，AI 不能审批、驳回、退回、转交或加签。",
        module: "approvals",
        relatedObjectType: pendingApprovalItems[0]?.objectType ?? null,
        relatedObjectId: pendingApprovalItems[0]?.objectId ?? null
      })
    );

    notifications.push(
      workbenchNotification({
        user,
        type: "contract_confirmation",
        severity: canReviewContracts ? "info" : "warning",
        title: contractConfirmations[0]
          ? `${contractConfirmations.length} 个合同事项待处理`
          : canReviewContracts
            ? "暂无待确认合同"
            : "无合同确认权限",
        body: contractConfirmations[0]?.description ?? "合同入口仅支持上传或粘贴；AI 审查后必须由人确认风险。",
        module: "contracts",
        relatedObjectType: contractConfirmations[0]?.objectType ?? null,
        relatedObjectId: contractConfirmations[0]?.objectId ?? null
      })
    );

    notifications.push(
      workbenchNotification({
        user,
        type: "ai_result",
        severity: latestAiConfirmation ? "warning" : "info",
        title: latestAiConfirmation ? `${aiConfirmations.length} 个 AI 结果待人工确认` : "暂无 AI 结果待确认",
        body: latestAiConfirmation?.description ?? "AI 草稿必须由人确认后才能成为正式任务、知识或项目记忆。",
        module: "chat",
        relatedObjectType: latestAiConfirmation?.objectType ?? null,
        relatedObjectId: latestAiConfirmation?.objectId ?? null
      })
    );

    if (!isAdministrator || userDeniedCount > 0 || rolePolicies[user.role].dataScope !== "all_organizations") {
      notifications.push(
        workbenchNotification({
          user,
          type: "no_permission",
          severity: userDeniedCount > 0 ? "warning" : "info",
          title: isAdministrator ? "管理员数据范围受限" : "系统设置不可见",
          body:
            userDeniedCount > 0
              ? `当前会话已有 ${userDeniedCount} 次访问拒绝记录。`
              : "菜单和数据按角色、组织、对象成员关系裁剪。",
          module: isAdministrator ? "settings" : "workbench"
        })
      );
    }

    notifications.push(
      workbenchNotification({
        user,
        type: "system_status",
        severity: "info",
        title: "DEV-015 审批闭环",
        body: "审批实例、当前节点、人工决策和合同结果写回已接入；仍不做外部通知、签署或付款。",
        module: "workbench"
      })
    );

    const visibleWorkCount =
      pendingTaskItems.length + responsibleTaskItems.length + projectItems.length + pendingApprovalItems.length + contractConfirmations.length + aiConfirmations.length;

    return {
      summary: {
        pendingWorkCount: pendingTaskItems.length,
        responsibleTaskCount: responsibleTaskItems.length,
        participatingProjectCount: projectItems.length,
        pendingApprovalCount: pendingApprovalItems.length,
        contractConfirmationCount: contractConfirmations.length,
        aiResultConfirmationCount: aiConfirmations.length,
        notificationCount: notifications.length,
        archivedProjectCount,
        expiredItemCount: 0
      },
      sections: {
        pendingWork: pendingTaskItems,
        responsibleTasks: responsibleTaskItems,
        participatingProjects: projectItems,
        pendingApprovals: pendingApprovalItems,
        contractConfirmations,
        aiConfirmations
      },
      notifications,
      pageStates: pageStatesForWorkbench({
        hasVisibleWork: visibleWorkCount > 0,
        hasErrors: userDeniedCount > 0,
        hasArchivedProjects: archivedProjectCount > 0
      }),
      permissionContext: {
        role: user.role,
        isAdministrator,
        visibleModules: rolePolicies[user.role].menu,
        dataScope: rolePolicies[user.role].dataScope,
        canManageSettings: isAdministrator
      }
    };
  }

  function getSessionUser(token: string | undefined) {
    if (!token) {
      return undefined;
    }

    const normalizedToken = token.startsWith("Bearer ") ? token.slice(7) : token;
    const userId = sessions.get(normalizedToken);

    if (!userId) {
      return undefined;
    }

    return seedUsers.find((user) => user.id === userId && user.status === "active");
  }

  async function requireUser(request: FastifyRequest, reply: FastifyReply) {
    const headerToken = request.headers.authorization ?? request.headers["x-session-token"];
    const token = Array.isArray(headerToken) ? headerToken[0] : headerToken;
    const user = getSessionUser(token);

    if (!user) {
      await recordDeniedAccess({
        request,
        dimension: "auth",
        action: "authenticate",
        resourceType: "session",
        reason: "unauthenticated"
      });
      reply.code(401).send({ error: "unauthorized" });
      return undefined;
    }

    return user;
  }

  async function requireMenuAccess(request: FastifyRequest, reply: FastifyReply, module: ModuleKey) {
    const user = await requireUser(request, reply);

    if (!user) {
      return undefined;
    }

    if (!canAccessModule(user.role, module)) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "menu",
        action: `open:${module}`,
        resourceType: "module",
        reason: "forbidden"
      });
      reply.code(403).send({ error: "forbidden" });
      return undefined;
    }

    return user;
  }

  async function requireSettingsAccess(request: FastifyRequest, reply: FastifyReply) {
    const user = await requireMenuAccess(request, reply, "settings");

    if (!user) {
      return undefined;
    }

    if (!canManageSettings(user.role)) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "operation",
        action: "manage_settings",
        resourceType: "settings",
        reason: "forbidden"
      });
      reply.code(403).send({ error: "forbidden" });
      return undefined;
    }

    return user;
  }

  async function requireOperationAccess(
    request: FastifyRequest,
    reply: FastifyReply,
    operation: OperationPermission,
    resource?: ResourceAccessContext
  ) {
    const user = await requireUser(request, reply);

    if (!user) {
      return undefined;
    }

    if (!canPerformOperation(user, operation, resource)) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "operation",
        action: operation,
        resourceType: "operation",
        reason: "forbidden"
      });
      reply.code(403).send({ error: "forbidden" });
      return undefined;
    }

    return user;
  }

  async function requireApprovalAccess(request: FastifyRequest, reply: FastifyReply, approval: ApprovalPermission) {
    const user = await requireUser(request, reply);

    if (!user) {
      return undefined;
    }

    if (!canPerformApprovalAction(user, approval)) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "approval",
        action: approval,
        resourceType: "approval_policy",
        reason: "forbidden"
      });
      reply.code(403).send({ error: "forbidden" });
      return undefined;
    }

    return user;
  }

  server.get("/health", async () => ({
    status: "ok",
    service: "xtgzpt-api",
    boundary: platformBoundary
  }));

  server.post<{ Body: LoginBody }>("/auth/login", async (request, reply) => {
    const user = seedUsers.find(
      (account) =>
        account.username === request.body?.username &&
        devCredentials[account.username] === request.body?.password &&
        account.status === "active"
    );

    if (!user) {
      await recordAudit({
        request,
        action: "auth.login_failed",
        objectType: "session",
        reason: "invalid_credentials",
        result: "failure"
      });
      return reply.code(401).send({ error: "invalid_credentials" });
    }

    const token = createSessionToken(user);
    sessions.set(token, user.id);
    await recordAudit({
      request,
      user,
      action: "auth.login_success",
      objectType: "session",
      objectId: user.id,
      organizationId: user.defaultOrganizationId,
      reason: "user_login",
      result: "success"
    });

    return {
      token,
      user: getPublicUser(user),
      visibleModules: rolePolicies[user.role].menu,
      dataOrganizations: visibleOrganizationsForUser(user),
      permissions: getPermissionSummary(user)
    };
  });

  server.post("/auth/logout", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    const headerToken = request.headers.authorization ?? request.headers["x-session-token"];
    const token = Array.isArray(headerToken) ? headerToken[0] : headerToken;
    const normalizedToken = token?.startsWith("Bearer ") ? token.slice(7) : token;

    if (normalizedToken) {
      sessions.delete(normalizedToken);
    }

    await recordAudit({
      request,
      user,
      action: "auth.logout",
      objectType: "session",
      objectId: user.id,
      organizationId: user.defaultOrganizationId,
      reason: "user_logout",
      result: "success"
    });

    return {
      status: "ok"
    };
  });

  server.get("/auth/session", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    return {
      user: getPublicUser(user),
      visibleModules: rolePolicies[user.role].menu,
      dataOrganizations: visibleOrganizationsForUser(user),
      permissions: getPermissionSummary(user)
    };
  });

  server.get("/auth/me", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    return {
      user: getPublicUser(user),
      context: {
        currentUserId: user.id,
        organizationScope: visibleOrganizationsForUser(user).map((organization) => organization.id),
        roleIds: [user.role],
        permissionPolicyVersion: getPermissionSummary(user).policyVersion,
        requestId: requestId(request)
      }
    };
  });

  server.get("/auth/me/menus", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    return {
      menus: rolePolicies[user.role].menu
    };
  });

  server.get("/auth/me/permissions", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    return {
      permissions: getPermissionSummary(user)
    };
  });

  server.get("/settings/organizations", async (request, reply) => {
    const user = await requireSettingsAccess(request, reply);

    if (!user) {
      return;
    }

    if (!canManageOrganizations(user.role)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    return {
      organizations: seedOrganizations
    };
  });

  server.get("/settings/roles", async (request, reply) => {
    const user = await requireSettingsAccess(request, reply);

    if (!user) {
      return;
    }

    if (!canManageRoles(user.role)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    return {
      roles: Object.values(rolePolicies)
    };
  });

  server.get("/settings/permission-policies", async (request, reply) => {
    const user = await requireOperationAccess(request, reply, "manage_permissions");

    if (!user) {
      return;
    }

    return {
      policyVersion: getPermissionSummary(user).policyVersion,
      policies: Object.values(rolePolicies).map((policy) => ({
        role: policy.role,
        menu: policy.menu,
        data: {
          scope: policy.dataScope
        },
        operation: policy.operations,
        approval: policy.approval,
        file: policy.files,
        ai: policy.ai
      }))
    };
  });

  server.get("/settings/approval-permission-policies", async (request, reply) => {
    const user = await requireApprovalAccess(request, reply, "configure_approval_policy");

    if (!user) {
      return;
    }

    return {
      policyVersion: getPermissionSummary(user).policyVersion,
      dimension: "approval",
      approval: Object.values(rolePolicies).map((policy) => ({
        role: policy.role,
        permissions: policy.approval
      }))
    };
  });

  server.get("/settings/ai-frameworks", async (request, reply) => {
    const user = await requireSettingsAccess(request, reply);

    if (!user) {
      return;
    }

    if (!canUseAiCapability(user, "configure_ai_frameworks")) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "ai",
        action: "configure_ai_frameworks",
        resourceType: "ai_framework",
        reason: "forbidden"
      });
      return reply.code(403).send({ error: "forbidden" });
    }

    await recordAudit({
      request,
      user,
      action: "ai.framework_config_viewed",
      objectType: "ai_framework",
      reason: "settings_ai_frameworks",
      result: "success",
      aiInvolved: true,
      aiFrameworkVersion: null
    });

    return {
      frameworks: aiFrameworks.map((framework) => ({
        ...framework,
        versions: aiFrameworkVersions
          .filter((version) => version.frameworkId === framework.id)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      }))
    };
  });

  server.put<{ Body: UpdateAiFrameworkBody; Params: { id: string } }>("/settings/ai-frameworks/:id", async (request, reply) => {
    const user = await requireSettingsAccess(request, reply);

    if (!user) {
      return;
    }

    if (!canUseAiCapability(user, "configure_ai_frameworks")) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "ai",
        action: "configure_ai_frameworks",
        resourceType: "ai_framework",
        reason: "forbidden"
      });
      return reply.code(403).send({ error: "forbidden" });
    }

    const framework = aiFrameworks.find((item) => item.id === request.params.id);

    if (!framework) {
      return reply.code(404).send({ error: "not_found" });
    }

    const currentVersion = aiFrameworkVersions.find((version) => version.id === framework.activeVersionId);
    const timestamp = nowIso();
    const normalizedRetryPolicy: AiRetryPolicy = {
      maxRetries: Math.max(0, Math.min(request.body?.retryPolicy?.maxRetries ?? currentVersion?.retryPolicy.maxRetries ?? 1, 3)),
      retryableFailureClasses:
        request.body?.retryPolicy?.retryableFailureClasses ?? currentVersion?.retryPolicy.retryableFailureClasses ?? defaultRetryPolicy.retryableFailureClasses,
      backoffSeconds: Math.max(0, Math.min(request.body?.retryPolicy?.backoffSeconds ?? currentVersion?.retryPolicy.backoffSeconds ?? 2, 60))
    };
    const versionLabel = textOrDefault(
      request.body?.version,
      `${currentVersion?.version ?? framework.scenario}-cfg-${aiFrameworkVersions.filter((version) => version.frameworkId === framework.id).length + 1}`
    );
    const version: AiFrameworkVersionRecord = {
      id: `${framework.id}:${versionLabel}:${randomUUID()}`,
      frameworkId: framework.id,
      version: versionLabel,
      provider: request.body?.provider ?? currentVersion?.provider ?? "template",
      model: textOrDefault(request.body?.model, currentVersion?.model ?? "template"),
      promptTemplate: textOrDefault(request.body?.promptTemplate, currentVersion?.promptTemplate ?? "AI draft only."),
      boundaryPolicy: textOrDefault(
        request.body?.boundaryPolicy,
        currentVersion?.boundaryPolicy ??
          "AI can analyze, summarize, remind, suggest, and draft only; human confirmation is required."
      ),
      sourceEvidenceRequired: request.body?.sourceEvidenceRequired ?? currentVersion?.sourceEvidenceRequired ?? true,
      retryPolicy: normalizedRetryPolicy,
      createdByUserId: user.id,
      changeReason: textOrDefault(request.body?.changeReason, "AI framework configuration changed by human administrator"),
      createdAt: timestamp
    };
    const beforeSnapshotRef = framework.activeVersionId;
    framework.activeVersionId = version.id;
    framework.status = request.body?.status ?? framework.status;
    framework.updatedAt = timestamp;
    aiFrameworkVersions.push(version);
    await store.save();
    await recordAudit({
      request,
      user,
      action: "ai.framework_version_created",
      objectType: "ai_framework",
      objectId: framework.id,
      organizationId: framework.organizationId,
      beforeSnapshotRef,
      afterSnapshotRef: version.id,
      reason: version.changeReason,
      result: "success",
      aiInvolved: true,
      aiFrameworkVersion: version.version
    });

    return {
      framework,
      version
    };
  });

  server.get("/ai/runs", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    if (!canUseAiCapability(user, "read_ai_runs", { ownerUserId: user.id, participantUserIds: [user.id] })) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "ai",
        action: "read_ai_runs",
        resourceType: "ai_run",
        reason: "forbidden"
      });
      return reply.code(403).send({ error: "forbidden" });
    }

    return {
      runs: visibleAiRunsForUser(user).sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    };
  });

  server.get<{ Params: { id: string } }>("/ai/runs/:id", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    const run = aiRuns.find((candidate) => candidate.id === request.params.id);

    if (!run || !canReadAiRun(user, run)) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "ai_run",
        reason: "ai_run:read",
        result: "denied",
        aiInvolved: true,
        aiFrameworkVersion: run?.frameworkVersion ?? null
      });
      return reply.code(404).send({ error: "not_found" });
    }

    return {
      run: aiRunWithDetails(run)
    };
  });

  server.get("/settings/access-denials", async (request, reply) => {
    const user = await requireOperationAccess(request, reply, "manage_permissions");

    if (!user) {
      return;
    }

    return {
      denials: deniedAccessEvents
    };
  });

  server.get("/audit-logs", async (request, reply) => {
    const user = await requireOperationAccess(request, reply, "manage_permissions");

    if (!user) {
      return;
    }

    await recordAudit({
      request,
      user,
      action: "audit.query",
      objectType: "audit_log",
      reason: "query_audit_logs",
      result: "success"
    });

    return {
      auditLogs: auditResultFor(user)
    };
  });

  server.get<{ Params: { type: string; id: string } }>("/objects/:type/:id/audit-logs", async (request, reply) => {
    const user = await requireOperationAccess(request, reply, "manage_permissions");

    if (!user) {
      return;
    }

    await recordAudit({
      request,
      user,
      action: "audit.object_query",
      objectType: "audit_log",
      reason: "query_object_audit_logs",
      result: "success"
    });

    return {
      auditLogs: auditResultFor(user, {
        objectType: request.params.type,
        objectId: request.params.id
      })
    };
  });

  server.get<{ Params: { id: string } }>("/users/:id/audit-logs", async (request, reply) => {
    const user = await requireOperationAccess(request, reply, "manage_permissions");

    if (!user) {
      return;
    }

    await recordAudit({
      request,
      user,
      action: "audit.user_query",
      objectType: "audit_log",
      reason: "query_user_audit_logs",
      result: "success"
    });

    return {
      auditLogs: auditResultFor(user, {
        actorUserId: request.params.id
      })
    };
  });

  server.get("/business/organizations", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    return {
      organizations: visibleOrganizationsForUser(user)
    };
  });

  server.get("/workbench", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "workbench");

    if (!user) {
      return;
    }

    return workbenchForUser(user);
  });

  server.get("/projects", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "projects");

    if (!user) {
      return;
    }

    return {
      projects: visibleProjectsForUser(user).map(projectWithTaskCount)
    };
  });

  server.post<{ Body: CreateProjectBody }>("/projects", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    const organizationId = request.body?.organizationId ?? user.defaultOrganizationId;

    if (!canPerformOperation(user, "create_project", { organizationId })) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "operation",
        action: "create_project",
        resourceType: "project",
        reason: "forbidden"
      });
      return reply.code(403).send({ error: "forbidden" });
    }

    if (!visibleOrganizationsForUser(user).some((organization) => organization.id === organizationId)) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "data",
        action: "create_project",
        resourceType: "project",
        reason: "forbidden"
      });
      return reply.code(403).send({ error: "forbidden" });
    }

    const timestamp = nowIso();
    const project: ProjectRecord = {
      id: `project-${randomUUID()}`,
      title: textOrDefault(request.body?.title, "未命名项目"),
      summary: textOrDefault(request.body?.summary, "项目已创建，等待拆解任务。"),
      organizationId,
      ownerUserId: user.id,
      memberUserIds: [user.id],
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp
    };

    projects.push(project);
    await store.save();
    await recordAudit({
      request,
      user,
      action: "project.created",
      objectType: "project",
      objectId: project.id,
      organizationId,
      reason: "user_created_project",
      result: "success"
    });

    return reply.code(201).send({
      project: projectWithTaskCount(project)
    });
  });

  server.get<{ Params: { id: string } }>("/projects/:id", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "projects");

    if (!user) {
      return;
    }

    const project = findVisibleProject(user, request.params.id);

    if (!project) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "project",
        reason: "project:read",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    return {
      project: projectWithTaskCount(project),
      tasks: visibleTasksForUser(user, project.id)
    };
  });

  server.post<{ Body: AddProjectMemberBody; Params: { id: string } }>("/projects/:id/members", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    const project = findVisibleProject(user, request.params.id);

    if (!project || !canManageProject(user, project)) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "project",
        reason: "project:add_member",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    const member = seedUsers.find((candidate) => candidate.id === request.body?.userId && candidate.status === "active");

    if (!member) {
      return reply.code(400).send({ error: "invalid_member" });
    }

    if (!project.memberUserIds.includes(member.id)) {
      project.memberUserIds.push(member.id);
      project.updatedAt = nowIso();
      await store.save();
    }

    await recordAudit({
      request,
      user,
      action: "project.member_added",
      objectType: "project",
      objectId: project.id,
      organizationId: project.organizationId,
      reason: "user_added_project_member",
      result: "success"
    });

    return {
      project: projectWithTaskCount(project)
    };
  });

  server.post<{ Body: ProjectStatusBody; Params: { id: string } }>("/projects/:id/status", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    const project = findVisibleProject(user, request.params.id);

    if (!project || !canManageProject(user, project)) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "project",
        reason: "project:change_status",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    const nextStatus = request.body?.status;

    if (!nextStatus || !allowedProjectTransitions[project.status].includes(nextStatus)) {
      return reply.code(400).send({ error: "invalid_status_transition" });
    }

    project.status = nextStatus;
    project.updatedAt = nowIso();
    await store.save();
    await recordAudit({
      request,
      user,
      action: "project.status_changed",
      objectType: "project",
      objectId: project.id,
      organizationId: project.organizationId,
      reason: `project_status:${nextStatus}`,
      result: "success"
    });

    return {
      project: projectWithTaskCount(project)
    };
  });

  server.get<{ Querystring: Record<string, string | undefined> }>("/tasks", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "tasks");

    if (!user) {
      return;
    }

    const visibleTasks = visibleTasksForUser(user);
    return {
      tasks: filterVisibleTasks(user, visibleTasks, request.query).map(taskWithDetails)
    };
  });

  server.post<{ Body: CreateTaskBody }>("/tasks", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    const projectId = request.body?.projectId;
    const project = projectId ? findVisibleProject(user, projectId) : undefined;

    if (!project) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "task",
        reason: "task:create_project_scope",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    if (!canPerformOperation(user, "create_task", {
      organizationId: project.organizationId,
      ownerUserId: user.id,
      participantUserIds: project.memberUserIds
    })) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "operation",
        action: "create_task",
        resourceType: "task",
        reason: "forbidden"
      });
      return reply.code(403).send({ error: "forbidden" });
    }

    const assigneeUserId = request.body?.assigneeUserId ?? user.id;
    const confirmerUserId = request.body?.confirmerUserId ?? project.ownerUserId;
    const participants = new Set([project.ownerUserId, ...project.memberUserIds]);
    const priority = request.body?.priority ?? "medium";
    const dueAt = nullableIsoString(request.body?.dueAt);

    if (!participants.has(assigneeUserId) || !participants.has(confirmerUserId)) {
      return reply.code(400).send({ error: "invalid_task_participant" });
    }

    if (!supportedTaskPriorities.includes(priority)) {
      return reply.code(400).send({ error: "invalid_task_priority" });
    }

    if (dueAt === undefined) {
      return reply.code(400).send({ error: "invalid_due_at" });
    }

    const timestamp = nowIso();
    const task: TaskRecord = {
      id: `task-${randomUUID()}`,
      projectId: project.id,
      title: textOrDefault(request.body?.title, "未命名任务"),
      description: textOrDefault(request.body?.description, "任务已创建，等待处理。"),
      creatorUserId: user.id,
      assigneeUserId,
      confirmerUserId,
      priority,
      dueAt,
      status: "todo",
      cancelReason: null,
      completedAt: null,
      confirmedAt: null,
      returnedReason: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    tasks.push(task);
    appendTaskActivity({
      task,
      actorUserId: user.id,
      activityType: "created",
      fromStatus: null,
      toStatus: "todo",
      note: "任务已由人工创建。",
      timestamp
    });
    await store.save();
    await recordAudit({
      request,
      user,
      action: "task.created",
      objectType: "task",
      objectId: task.id,
      organizationId: project.organizationId,
      reason: "user_created_task",
      result: "success"
    });

    return reply.code(201).send({
      task: taskWithDetails(task)
    });
  });

  server.get<{ Params: { id: string } }>("/tasks/:id", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "tasks");

    if (!user) {
      return;
    }

    const visibleTask = findVisibleTask(user, request.params.id);

    if (!visibleTask) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "task",
        reason: "task:read",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    return {
      task: taskWithDetails(visibleTask.task),
      project: projectWithTaskCount(visibleTask.project)
    };
  });

  server.post<{ Body: TaskStatusBody; Params: { id: string } }>("/tasks/:id/status", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    const visibleTask = findVisibleTask(user, request.params.id);

    if (!visibleTask) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "task",
        reason: "task:change_status",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    const { task, project } = visibleTask;
    const nextStatus = request.body?.status;

    if (!nextStatus || !allowedTaskTransitions[task.status].includes(nextStatus)) {
      return reply.code(400).send({ error: "invalid_status_transition" });
    }

    if (!canChangeTaskStatus(user, task, project, nextStatus)) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "operation",
        action: "complete_task",
        resourceType: "task",
        reason: "forbidden"
      });
      return reply.code(403).send({ error: nextStatus === "completed" ? "confirmation_required" : "forbidden" });
    }

    if (nextStatus === "cancelled" && !request.body?.reason?.trim()) {
      return reply.code(400).send({ error: "cancel_reason_required" });
    }

    const previousStatus = task.status;
    const timestamp = nowIso();
    task.status = nextStatus;
    task.cancelReason = nextStatus === "cancelled" ? request.body.reason?.trim() ?? null : task.cancelReason;
    task.completedAt = nextStatus === "submitted" ? timestamp : task.completedAt;
    task.confirmedAt = nextStatus === "completed" ? timestamp : task.confirmedAt;
    task.returnedReason = nextStatus === "in_progress" ? null : task.returnedReason;
    task.updatedAt = timestamp;
    appendTaskActivity({
      task,
      actorUserId: user.id,
      activityType:
        nextStatus === "submitted" ? "submitted" : nextStatus === "completed" ? "confirmed" : "status_changed",
      fromStatus: previousStatus,
      toStatus: nextStatus,
      note: request.body.reason?.trim() ?? `状态变更为 ${nextStatus}`,
      timestamp
    });
    await store.save();
    await recordAudit({
      request,
      user,
      action: "task.status_changed",
      objectType: "task",
      objectId: task.id,
      organizationId: project.organizationId,
      reason: `task_status:${nextStatus}`,
      result: "success"
    });

    return {
      task: taskWithDetails(task)
    };
  });

  server.post<{ Body: TaskStatusBody; Params: { id: string } }>("/tasks/:id/submit", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    const visibleTask = findVisibleTask(user, request.params.id);

    if (!visibleTask) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "task",
        reason: "task:submit",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    const { task, project } = visibleTask;

    if (!allowedTaskTransitions[task.status].includes("submitted")) {
      return reply.code(400).send({ error: "invalid_status_transition" });
    }

    if (!canChangeTaskStatus(user, task, project, "submitted")) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const previousStatus = task.status;
    const timestamp = nowIso();
    task.status = "submitted";
    task.completedAt = timestamp;
    task.updatedAt = timestamp;
    appendTaskActivity({
      task,
      actorUserId: user.id,
      activityType: "submitted",
      fromStatus: previousStatus,
      toStatus: "submitted",
      note: request.body?.reason?.trim() ?? "负责人提交完成结果",
      timestamp
    });
    await store.save();
    await recordAudit({
      request,
      user,
      action: "task.submitted",
      objectType: "task",
      objectId: task.id,
      organizationId: project.organizationId,
      reason: request.body?.reason?.trim() ?? "task_submitted",
      result: "success"
    });

    return {
      task: taskWithDetails(task)
    };
  });

  server.post<{ Body: TaskStatusBody; Params: { id: string } }>("/tasks/:id/confirm", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    const visibleTask = findVisibleTask(user, request.params.id);

    if (!visibleTask) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "task",
        reason: "task:confirm",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    const { task, project } = visibleTask;

    if (!allowedTaskTransitions[task.status].includes("completed")) {
      return reply.code(400).send({ error: "invalid_status_transition" });
    }

    if (!canChangeTaskStatus(user, task, project, "completed")) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "operation",
        action: "complete_task",
        resourceType: "task",
        reason: "forbidden"
      });
      return reply.code(403).send({ error: "confirmation_required" });
    }

    const previousStatus = task.status;
    const timestamp = nowIso();
    task.status = "completed";
    task.confirmedAt = timestamp;
    task.updatedAt = timestamp;
    appendTaskActivity({
      task,
      actorUserId: user.id,
      activityType: "confirmed",
      fromStatus: previousStatus,
      toStatus: "completed",
      note: request.body?.reason?.trim() ?? "确认人确认完成",
      timestamp
    });
    await store.save();
    await recordAudit({
      request,
      user,
      action: "task.confirmed",
      objectType: "task",
      objectId: task.id,
      organizationId: project.organizationId,
      reason: request.body?.reason?.trim() ?? "task_confirmed",
      result: "success"
    });

    return {
      task: taskWithDetails(task)
    };
  });

  server.post<{ Body: TaskStatusBody; Params: { id: string } }>("/tasks/:id/return", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    const visibleTask = findVisibleTask(user, request.params.id);

    if (!visibleTask) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "task",
        reason: "task:return",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    const { task, project } = visibleTask;
    const reason = request.body?.reason?.trim();

    if (task.status !== "submitted") {
      return reply.code(409).send({ error: "task_not_submitted" });
    }

    if (task.confirmerUserId !== user.id && project.ownerUserId !== user.id) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "operation",
        action: "return_task",
        resourceType: "task",
        reason: "forbidden"
      });
      return reply.code(403).send({ error: "forbidden" });
    }

    if (!reason) {
      return reply.code(400).send({ error: "return_reason_required" });
    }

    const previousStatus = task.status;
    const timestamp = nowIso();
    task.status = "in_progress";
    task.returnedReason = reason;
    task.updatedAt = timestamp;
    appendTaskActivity({
      task,
      actorUserId: user.id,
      activityType: "returned",
      fromStatus: previousStatus,
      toStatus: "in_progress",
      note: reason,
      timestamp
    });
    await store.save();
    await recordAudit({
      request,
      user,
      action: "task.returned",
      objectType: "task",
      objectId: task.id,
      organizationId: project.organizationId,
      reason,
      result: "success"
    });

    return {
      task: taskWithDetails(task)
    };
  });

  server.get<{ Params: { id: string } }>("/tasks/:id/activity", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "tasks");

    if (!user) {
      return;
    }

    const visibleTask = findVisibleTask(user, request.params.id);

    if (!visibleTask) {
      return reply.code(404).send({ error: "not_found" });
    }

    return {
      activities: taskActivities.filter((activity) => activity.taskId === visibleTask.task.id),
      comments: taskComments.filter((comment) => comment.taskId === visibleTask.task.id)
    };
  });

  server.post<{ Body: TaskCommentBody; Params: { id: string } }>("/tasks/:id/comments", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "tasks");

    if (!user) {
      return;
    }

    const visibleTask = findVisibleTask(user, request.params.id);

    if (!visibleTask) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "task",
        reason: "task:comment",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    const content = request.body?.content?.trim();

    if (!content) {
      return reply.code(400).send({ error: "comment_required" });
    }

    const timestamp = nowIso();
    const comment: TaskCommentRecord = {
      id: `task-comment-${randomUUID()}`,
      taskId: visibleTask.task.id,
      authorUserId: user.id,
      content,
      createdAt: timestamp
    };
    taskComments.push(comment);
    appendTaskActivity({
      task: visibleTask.task,
      actorUserId: user.id,
      activityType: "commented",
      fromStatus: visibleTask.task.status,
      toStatus: visibleTask.task.status,
      note: content,
      timestamp
    });
    visibleTask.task.updatedAt = timestamp;
    await store.save();
    await recordAudit({
      request,
      user,
      action: "task.commented",
      objectType: "task",
      objectId: visibleTask.task.id,
      organizationId: visibleTask.project.organizationId,
      reason: "task_comment_added",
      result: "success"
    });

    return reply.code(201).send({
      comment,
      task: taskWithDetails(visibleTask.task)
    });
  });

  server.get("/chat/threads", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "chat");

    if (!user) {
      return;
    }

    return {
      threads: visibleChatThreadsForUser(user).map(threadWithMessageCount)
    };
  });

  server.post<{ Body: CreateChatThreadBody }>("/chat/threads", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "chat");

    if (!user) {
      return;
    }

    const organizationId = request.body?.organizationId ?? user.defaultOrganizationId;

    if (!canUseOrganizationScope(user, organizationId)) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "data",
        action: "create_chat_thread",
        resourceType: "chat_thread",
        reason: "forbidden"
      });
      return reply.code(403).send({ error: "forbidden" });
    }

    const requestedMembers = request.body?.memberUserIds ?? [];
    const memberUserIds = Array.from(new Set([user.id, ...requestedMembers]));
    const validMembers = memberUserIds
      .map((userId) => seedUsers.find((candidate) => candidate.id === userId && candidate.status === "active"))
      .filter((candidate): candidate is UserAccount => Boolean(candidate));

    if (validMembers.length !== memberUserIds.length) {
      return reply.code(400).send({ error: "invalid_chat_member" });
    }

    if (request.body?.relatedObjectType === "project" && request.body.relatedObjectId) {
      const relatedProject = findVisibleProject(user, request.body.relatedObjectId);

      if (!relatedProject) {
        await recordAudit({
          request,
          user,
          action: "access.forbidden",
          objectType: "chat_thread",
          reason: "chat:create_related_project",
          result: "denied"
        });
        return reply.code(404).send({ error: "not_found" });
      }
    }

    const timestamp = nowIso();
    const thread: ChatThreadRecord = {
      id: `chat-${randomUUID()}`,
      title: textOrDefault(request.body?.title, "新的工作会话"),
      organizationId,
      creatorUserId: user.id,
      memberUserIds,
      relatedObjectType: request.body?.relatedObjectType ?? null,
      relatedObjectId: request.body?.relatedObjectId ?? null,
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp
    };

    chatThreads.push(thread);
    await store.save();
    await recordAudit({
      request,
      user,
      action: "chat.thread_created",
      objectType: "chat_thread",
      objectId: thread.id,
      organizationId,
      reason: "user_created_chat_thread",
      result: "success"
    });

    return reply.code(201).send({
      thread: threadWithMessageCount(thread)
    });
  });

  server.get<{ Params: { id: string } }>("/chat/threads/:id", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "chat");

    if (!user) {
      return;
    }

    const thread = findVisibleChatThread(user, request.params.id);

    if (!thread) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "chat_thread",
        reason: "chat:read",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    return {
      thread: threadWithMessageCount(thread)
    };
  });

  server.get<{ Params: { id: string } }>("/chat/threads/:id/messages", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "chat");

    if (!user) {
      return;
    }

    const thread = findVisibleChatThread(user, request.params.id);

    if (!thread) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "chat_thread",
        reason: "chat:messages",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    return {
      messages: chatMessages.filter((message) => message.threadId === thread.id && message.status !== "withdrawn")
    };
  });

  server.post<{ Body: SendChatMessageBody; Params: { id: string } }>("/chat/threads/:id/messages", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "chat");

    if (!user) {
      return;
    }

    const thread = findVisibleChatThread(user, request.params.id);

    if (!thread) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "chat_thread",
        reason: "chat:send_message",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    const content = request.body?.content?.trim();

    if (!content) {
      return reply.code(400).send({ error: "message_content_required" });
    }

    const timestamp = nowIso();
    const message: ChatMessageRecord = {
      id: `message-${randomUUID()}`,
      threadId: thread.id,
      senderUserId: user.id,
      content,
      status: "sent",
      createdAt: timestamp,
      updatedAt: timestamp
    };

    chatMessages.push(message);
    thread.updatedAt = timestamp;
    await store.save();
    await recordAudit({
      request,
      user,
      action: "chat.message_sent",
      objectType: "chat_message",
      objectId: message.id,
      organizationId: thread.organizationId,
      reason: "user_sent_chat_message",
      result: "success"
    });

    return reply.code(201).send({
      message
    });
  });

  async function createChatAiDraft(
    request: FastifyRequest<{ Body: AiFileReferenceBody; Params: { id: string } }>,
    reply: FastifyReply,
    capability: AiCapability,
    kind: AiDraftRecord["kind"]
  ) {
    const user = await requireUser(request, reply);

    if (!user) {
      return undefined;
    }

    const thread = findVisibleChatThread(user, request.params.id);

    if (!thread) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "chat_thread",
        reason: `chat:${kind}`,
        result: "denied",
        aiInvolved: true,
        aiFrameworkVersion: fallbackAiFrameworkVersion
      });
      reply.code(404).send({ error: "not_found" });
      return undefined;
    }

    if (!canUseAiCapability(user, capability, {
      organizationId: thread.organizationId,
      participantUserIds: thread.memberUserIds
    })) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "ai",
        action: capability,
        resourceType: "chat_thread",
        reason: "forbidden"
      });
      reply.code(403).send({ error: "forbidden" });
      return undefined;
    }

    const sourceMessageIds = latestThreadMessageIds(thread.id);
    const sourceMessages = chatMessages
      .filter((message) => sourceMessageIds.includes(message.id))
      .map((message) => ({
        senderName: seedUsers.find((candidate) => candidate.id === message.senderUserId)?.displayName ?? message.senderUserId,
        content: message.content
      }));
    const contextResults = searchKnowledgeAndMemory({
      user,
      query: [thread.title, ...sourceMessages.map((message) => message.content)].join(" "),
      organizationId: thread.organizationId,
      projectId: thread.relatedObjectType === "project" ? thread.relatedObjectId : null,
      limit: 5
    });
    const requestedFileIds = request.body?.fileIds ?? [];
    const aiRun = await createAiRun({
      request,
      user,
      scenario: kind,
      organizationId: thread.organizationId,
      sourceObjectType: "chat_thread",
      sourceObjectId: thread.id,
      sourceIds: sourceMessageIds,
      contextSourceIds: [...contextResults.map((item) => item.id), ...requestedFileIds],
      inputPayload: {
        kind,
        threadId: thread.id,
        sourceMessageIds,
        contextSourceIds: contextResults.map((item) => item.id),
        requestedFileIds
      }
    });
    appendAiRunEvidence(aiRun, [
      ...sourceMessageIds.map((messageId) => {
        const message = chatMessages.find((candidate) => candidate.id === messageId);
        return {
          sourceObjectType: "chat_message",
          sourceObjectId: thread.id,
          sourceId: messageId,
          title: thread.title,
          excerpt: message?.content.slice(0, 240) ?? "chat_message",
          accessResult: "allowed" as const
        };
      }),
      ...contextResults.map((item) => ({
        sourceObjectType: item.type,
        sourceObjectId: item.id,
        sourceId: item.sourceId,
        title: item.title,
        excerpt: item.content.slice(0, 240),
        accessResult: "allowed" as const
      }))
    ]);

    if (sourceMessageIds.length === 0) {
      await completeAiRun({
        request,
        user,
        run: aiRun,
        status: "failed",
        outputPayload: { error: "source_messages_required" },
        failureClass: "validation_error",
        failureMessage: "source_messages_required"
      });
      reply.code(400).send({ error: "source_messages_required" });
      return undefined;
    }

    if (requestedFileIds.length > 0) {
      const accessibleFiles = requestedFileIds
        .map((fileId) => findAccessibleFile(user, fileId, "reference_ai"))
        .filter(Boolean);

      if (accessibleFiles.length !== requestedFileIds.length) {
        appendAiRunEvidence(aiRun, requestedFileIds.map((fileId) => ({
          sourceObjectType: "file",
          sourceObjectId: fileId,
          sourceId: fileId,
          title: "file",
          excerpt: "file_reference_permission_checked",
          accessResult: accessibleFiles.some((item) => item?.file.id === fileId) ? "allowed" : "denied"
        })));
        await completeAiRun({
          request,
          user,
          run: aiRun,
          status: "failed",
          outputPayload: { error: "ai_file_reference_blocked_by_permission" },
          failureClass: "permission_denied",
          failureMessage: "ai_file_reference_blocked_by_permission"
        });
        await recordFileDenied(request, user, "reference_ai");
        await recordAudit({
          request,
          user,
          action: "file.ai_reference_denied",
          objectType: "file",
          organizationId: thread.organizationId,
          reason: "ai_file_reference_blocked_by_permission",
          result: "denied",
          aiInvolved: true,
          aiFrameworkVersion: fallbackAiFrameworkVersion
        });
        reply.code(403).send({ error: "forbidden" });
        return undefined;
      }

      for (const accessibleFile of accessibleFiles) {
        if (accessibleFile) {
          appendAiRunEvidence(aiRun, [{
            sourceObjectType: "file",
            sourceObjectId: accessibleFile.file.id,
            sourceId: accessibleFile.file.id,
            title: accessibleFile.file.displayName,
            excerpt: accessibleFile.version.contentText.slice(0, 240),
            accessResult: "allowed"
          }]);
          await recordAudit({
            request,
            user,
            action: "file.ai_referenced",
            objectType: "file",
            objectId: accessibleFile.file.id,
            organizationId: accessibleFile.file.organizationId,
            reason: "ai_file_reference_permission_passed",
            result: "success",
            aiInvolved: true,
            aiFrameworkVersion: fallbackAiFrameworkVersion
          });
        }
      }
    }

    const aiResult = await generateAiDraftContent({
      kind,
      threadTitle: thread.title,
      messages: sourceMessages,
      memoryContexts: contextResults.map((item) => ({
        type: item.type,
        title: item.title,
        content: item.content
      }))
    }).catch((error: unknown) => {
      if (error instanceof AiProviderError) {
        return error;
      }

      return new AiProviderError("ai_provider_unexpected_error");
    });

    if (aiResult instanceof AiProviderError) {
      await completeAiRun({
        request,
        user,
        run: aiRun,
        status: "failed",
        outputPayload: { error: aiResult.message },
        failureClass: classifyAiFailure(aiResult.message),
        failureMessage: aiResult.message
      });
      reply.code(502).send({ error: "ai_provider_failed" });
      return undefined;
    }

    const timestamp = nowIso();
    const draft: AiDraftRecord = {
      id: `ai-draft-${randomUUID()}`,
      kind,
      threadId: thread.id,
      creatorUserId: user.id,
      title:
        kind === "chat_summary"
          ? `${thread.title} 整理摘要`
          : kind === "task_draft"
            ? `${thread.title} 任务草稿`
            : `${thread.title} 知识草稿`,
      content: aiResult.content,
      sourceMessageIds,
      contextSourceIds: [...contextResults.map((item) => item.id), ...requestedFileIds],
      frameworkVersion: aiResult.frameworkVersion,
      isDraft: true,
      status: "draft",
      confirmedByUserId: null,
      confirmedAt: null,
      promotedObjectType: null,
      promotedObjectId: null,
      createdAt: timestamp
    };

    aiDrafts.push(draft);
    await completeAiRun({
      request,
      user,
      run: aiRun,
      status: "succeeded",
      outputPayload: {
        draftId: draft.id,
        title: draft.title,
        content: draft.content,
        isDraft: true,
        humanConfirmationRequired: true
      },
      frameworkVersion: draft.frameworkVersion,
      contextSourceIds: draft.contextSourceIds
    });
    await store.save();
    await recordAudit({
      request,
      user,
      action:
        kind === "chat_summary"
          ? "ai.chat_summarized"
          : kind === "task_draft"
            ? "ai.task_draft_created"
            : "ai.knowledge_draft_created",
      objectType: "ai_run",
      objectId: aiRun.id,
      organizationId: thread.organizationId,
      afterSnapshotRef: draft.id,
      reason: `ai_draft:${kind}:memory_context:${contextResults.length}`,
      result: "success",
      aiInvolved: true,
      aiFrameworkVersion: draft.frameworkVersion
    });

    return {
      draft
    };
  }

  server.post<{ Body: AiFileReferenceBody; Params: { id: string } }>("/chat/threads/:id/ai/summarize", async (request, reply) =>
    createChatAiDraft(request, reply, "chat_summarize", "chat_summary")
  );

  server.post<{ Body: AiFileReferenceBody; Params: { id: string } }>("/chat/threads/:id/ai/task-draft", async (request, reply) =>
    createChatAiDraft(request, reply, "task_draft", "task_draft")
  );

  server.post<{ Body: AiFileReferenceBody; Params: { id: string } }>("/chat/threads/:id/ai/knowledge-draft", async (request, reply) =>
    createChatAiDraft(request, reply, "knowledge_query", "knowledge_draft")
  );

  server.get<{ Params: { id: string } }>("/chat/threads/:id/ai/drafts", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "chat");

    if (!user) {
      return;
    }

    const thread = findVisibleChatThread(user, request.params.id);

    if (!thread) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "chat_thread",
        reason: "chat:ai_drafts",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    return {
      drafts: aiDrafts.filter((draft) => draft.threadId === thread.id)
    };
  });

  server.post<{ Body: ConfirmAiDraftBody; Params: { id: string } }>("/ai/drafts/:id/confirm", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    const visibleDraft = findVisibleAiDraft(user, request.params.id);

    if (!visibleDraft) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "ai_draft",
        reason: "ai_draft:confirm",
        result: "denied",
        aiInvolved: true,
        aiFrameworkVersion: fallbackAiFrameworkVersion
      });
      return reply.code(404).send({ error: "not_found" });
    }

    const { draft, thread } = visibleDraft;

    if (draft.status !== "draft") {
      return reply.code(409).send({ error: "draft_already_confirmed" });
    }

    const timestamp = nowIso();
    const title = textOrDefault(request.body?.title, draft.title);
    const content = textOrDefault(request.body?.content, draft.content);
    const linkedAiRun = aiRunForDraft(draft);
    const decisionType: AiRunDecisionRecord["decision"] =
      title === draft.title && content === draft.content ? "adopted" : "changed";
    const changeSummary = decisionType === "changed" ? "Human edited title or content before confirmation." : null;

    if (draft.kind === "task_draft") {
      const projectId = request.body?.projectId ?? (thread.relatedObjectType === "project" ? thread.relatedObjectId ?? undefined : undefined);
      const project = projectId ? findVisibleProject(user, projectId) : undefined;

      if (!project) {
        return reply.code(400).send({ error: "project_required_for_task_draft" });
      }

      if (!canPerformOperation(user, "create_task", {
        organizationId: project.organizationId,
        ownerUserId: user.id,
        participantUserIds: project.memberUserIds
      })) {
        await recordDeniedAccess({
          request,
          user,
          dimension: "operation",
          action: "create_task",
          resourceType: "ai_draft",
          reason: "forbidden"
        });
        return reply.code(403).send({ error: "forbidden" });
      }

      const assigneeUserId = request.body?.assigneeUserId ?? user.id;
      const confirmerUserId = request.body?.confirmerUserId ?? project.ownerUserId;
      const participants = new Set([project.ownerUserId, ...project.memberUserIds]);

      if (!participants.has(assigneeUserId) || !participants.has(confirmerUserId)) {
        return reply.code(400).send({ error: "invalid_task_participant" });
      }

      const task: TaskRecord = {
        id: `task-${randomUUID()}`,
        projectId: project.id,
        title,
        description: content,
        creatorUserId: user.id,
        assigneeUserId,
        confirmerUserId,
        priority: "medium",
        dueAt: null,
        status: "todo",
        cancelReason: null,
        completedAt: null,
        confirmedAt: null,
        returnedReason: null,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      tasks.push(task);
      appendTaskActivity({
        task,
        actorUserId: user.id,
        activityType: "created",
        fromStatus: null,
        toStatus: "todo",
        note: "AI 草稿经人工确认后创建正式任务。",
        timestamp
      });
      draft.status = "confirmed";
      draft.confirmedByUserId = user.id;
      draft.confirmedAt = timestamp;
      draft.promotedObjectType = "task";
      draft.promotedObjectId = task.id;
      await store.save();
      await recordAudit({
        request,
        user,
        action: "task.created_from_ai_draft",
        objectType: "task",
        objectId: task.id,
        organizationId: project.organizationId,
        beforeSnapshotRef: draft.id,
        reason: "ai_draft_confirmed:task",
        result: "success",
        aiInvolved: true,
        aiFrameworkVersion: draft.frameworkVersion
      });
      await recordAiRunDecision({
        request,
        user,
        run: linkedAiRun,
        draftId: draft.id,
        decision: decisionType,
        targetObjectType: "task",
        targetObjectId: task.id,
        changeSummary,
        reason: "human_confirmed_ai_task_draft"
      });

      return reply.code(201).send({
        draft,
        task: taskWithDetails(task)
      });
    }

    if (draft.kind === "knowledge_draft") {
      const sourceEvidence = evidenceFromDraftAndThread(draft, thread);

      const item: KnowledgeItemRecord = {
        id: `knowledge-${randomUUID()}`,
        title,
        content,
        organizationId: thread.organizationId,
        creatorUserId: user.id,
        reviewerUserId: null,
        currentVersion: 1,
        sourceDraftId: draft.id,
        sourceMessageIds: draft.sourceMessageIds,
        sourceParticipantUserIds: thread.memberUserIds,
        sourceEvidence,
        status: "submitted_for_review",
        createdAt: timestamp,
        updatedAt: timestamp,
        submittedAt: timestamp,
        reviewedAt: null,
        publishedAt: null,
        rejectedAt: null,
        archivedAt: null
      };
      const version: KnowledgeVersionRecord = {
        id: `knowledge-version-${randomUUID()}`,
        knowledgeItemId: item.id,
        version: 1,
        title,
        content,
        authorUserId: user.id,
        reviewerUserId: null,
        status: "submitted_for_review",
        sourceEvidence,
        createdAt: timestamp,
        submittedAt: timestamp,
        reviewedAt: null,
        publishedAt: null,
        rejectedAt: null,
        archivedAt: null
      };

      knowledgeItems.push(item);
      knowledgeVersions.push(version);
      draft.status = "confirmed";
      draft.confirmedByUserId = user.id;
      draft.confirmedAt = timestamp;
      draft.promotedObjectType = "knowledge_item";
      draft.promotedObjectId = item.id;
      await store.save();
      await recordAudit({
        request,
        user,
        action: "knowledge.submitted_for_review_from_ai_draft",
        objectType: "knowledge_item",
        objectId: item.id,
        organizationId: item.organizationId,
        beforeSnapshotRef: draft.id,
        afterSnapshotRef: version.id,
        reason: "ai_draft_confirmed:knowledge_submitted_for_human_review",
        result: "success",
        aiInvolved: true,
        aiFrameworkVersion: draft.frameworkVersion
      });
      await recordAiRunDecision({
        request,
        user,
        run: linkedAiRun,
        draftId: draft.id,
        decision: decisionType,
        targetObjectType: "knowledge_item",
        targetObjectId: item.id,
        changeSummary,
        reason: "human_confirmed_ai_knowledge_draft_for_review"
      });

      return reply.code(201).send({
        draft,
        knowledgeItem: item
      });
    }

    const projectId = request.body?.projectId ?? (thread.relatedObjectType === "project" ? thread.relatedObjectId : null);
    const project = projectId ? findVisibleProject(user, projectId) : undefined;

    if (projectId && (!project || project.organizationId !== thread.organizationId)) {
      return reply.code(400).send({ error: "invalid_memory_project_scope" });
    }

    const memory: ProjectMemoryRecord = {
      id: `memory-${randomUUID()}`,
      title,
      content,
      organizationId: thread.organizationId,
      projectId: project?.id ?? null,
      threadId: thread.id,
      creatorUserId: user.id,
      sourceDraftId: draft.id,
      sourceMessageIds: draft.sourceMessageIds,
      sourceParticipantUserIds: thread.memberUserIds,
      createdAt: timestamp
    };

    projectMemories.push(memory);
    draft.status = "confirmed";
    draft.confirmedByUserId = user.id;
    draft.confirmedAt = timestamp;
    draft.promotedObjectType = "project_memory";
    draft.promotedObjectId = memory.id;
    await store.save();
    await recordAudit({
      request,
      user,
      action: "memory.created_from_ai_summary",
      objectType: "project_memory",
      objectId: memory.id,
      organizationId: memory.organizationId,
      beforeSnapshotRef: draft.id,
      reason: "ai_draft_confirmed:memory",
      result: "success",
      aiInvolved: true,
      aiFrameworkVersion: draft.frameworkVersion
    });
    await recordAiRunDecision({
      request,
      user,
      run: linkedAiRun,
      draftId: draft.id,
      decision: decisionType,
      targetObjectType: "project_memory",
      targetObjectId: memory.id,
      changeSummary,
      reason: "human_confirmed_ai_summary_to_memory"
    });

    return reply.code(201).send({
      draft,
      memory
    });
  });

  server.post<{ Body: { reason?: string }; Params: { id: string } }>("/ai/drafts/:id/reject", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    const visibleDraft = findVisibleAiDraft(user, request.params.id);

    if (!visibleDraft) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "ai_draft",
        reason: "ai_draft:reject",
        result: "denied",
        aiInvolved: true,
        aiFrameworkVersion: fallbackAiFrameworkVersion
      });
      return reply.code(404).send({ error: "not_found" });
    }

    const { draft, thread } = visibleDraft;

    if (draft.status !== "draft") {
      return reply.code(409).send({ error: "draft_already_closed" });
    }

    const reason = textOrDefault(request.body?.reason, "human_rejected_ai_output");
    const timestamp = nowIso();
    draft.status = "rejected";
    draft.confirmedByUserId = user.id;
    draft.confirmedAt = timestamp;
    await recordAudit({
      request,
      user,
      action: "ai_draft.rejected",
      objectType: "ai_draft",
      objectId: draft.id,
      organizationId: thread.organizationId,
      reason,
      result: "success",
      aiInvolved: true,
      aiFrameworkVersion: draft.frameworkVersion
    });
    await recordAiRunDecision({
      request,
      user,
      run: aiRunForDraft(draft),
      draftId: draft.id,
      decision: "rejected",
      targetObjectType: null,
      targetObjectId: null,
      changeSummary: null,
      reason
    });
    await store.save();

    return {
      draft
    };
  });

  server.post<{ Body: CreateKnowledgeItemBody }>("/knowledge/items", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "knowledge");

    if (!user) {
      return;
    }

    const title = request.body?.title?.trim();
    const content = request.body?.content?.trim();
    const organizationId = request.body?.organizationId ?? user.defaultOrganizationId;

    if (!title || !content) {
      return reply.code(400).send({ error: "title_content_required" });
    }

    if (!canUseOrganizationScope(user, organizationId) && !user.organizationIds.includes(organizationId)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    const timestamp = nowIso();
    const sourceEvidence: KnowledgeSourceEvidence[] = [
      {
        sourceType: "manual",
        sourceId: user.id,
        sourceMessageIds: [],
        sourceParticipantUserIds: [user.id],
        title,
        excerpt: content.slice(0, 240)
      }
    ];
    const item: KnowledgeItemRecord = {
      id: `knowledge-${randomUUID()}`,
      title,
      content,
      organizationId,
      creatorUserId: user.id,
      reviewerUserId: null,
      currentVersion: 1,
      sourceDraftId: `manual-${randomUUID()}`,
      sourceMessageIds: [],
      sourceParticipantUserIds: [user.id],
      sourceEvidence,
      status: "draft",
      createdAt: timestamp,
      updatedAt: timestamp,
      submittedAt: null,
      reviewedAt: null,
      publishedAt: null,
      rejectedAt: null,
      archivedAt: null
    };
    const version: KnowledgeVersionRecord = {
      id: `knowledge-version-${randomUUID()}`,
      knowledgeItemId: item.id,
      version: 1,
      title,
      content,
      authorUserId: user.id,
      reviewerUserId: null,
      status: "draft",
      sourceEvidence,
      createdAt: timestamp,
      submittedAt: null,
      reviewedAt: null,
      publishedAt: null,
      rejectedAt: null,
      archivedAt: null
    };

    knowledgeItems.push(item);
    knowledgeVersions.push(version);
    await store.save();
    await recordAudit({
      request,
      user,
      action: "knowledge.draft_created",
      objectType: "knowledge_item",
      objectId: item.id,
      organizationId: item.organizationId,
      afterSnapshotRef: version.id,
      reason: "knowledge_manual_draft_created",
      result: "success"
    });

    return reply.code(201).send({
      item,
      version
    });
  });

  server.get("/knowledge/items", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "knowledge");

    if (!user) {
      return;
    }

    return {
      items: visibleKnowledgeItemsForUser(user).map((item) => ({
        ...item,
        versions: knowledgeVersions
          .filter((version) => version.knowledgeItemId === item.id)
          .sort((left, right) => right.version - left.version)
      }))
    };
  });

  server.get<{ Params: { id: string } }>("/knowledge/items/:id/versions", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "knowledge");

    if (!user) {
      return;
    }

    const item = knowledgeItems.find((candidate) => candidate.id === request.params.id);

    if (!item || !visibleKnowledgeItemsForUser(user).some((candidate) => candidate.id === item.id)) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "knowledge_item",
        reason: "knowledge_versions",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    return {
      item,
      versions: knowledgeVersions
        .filter((version) => version.knowledgeItemId === item.id)
        .sort((left, right) => right.version - left.version)
    };
  });

  server.post<{ Body: KnowledgeActionBody; Params: { id: string } }>("/knowledge/items/:id/submit-review", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "knowledge");

    if (!user) {
      return;
    }

    const item = knowledgeItems.find((candidate) => candidate.id === request.params.id);

    if (!item || !canReadKnowledgeItem(user, item)) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "knowledge_item",
        reason: "knowledge_submit_review",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    if (!["draft", "rejected"].includes(item.status)) {
      return reply.code(409).send({ error: "invalid_knowledge_status" });
    }

    const version = currentKnowledgeVersion(item);
    const timestamp = nowIso();
    item.status = "submitted_for_review";
    item.submittedAt = timestamp;
    item.updatedAt = timestamp;

    if (version) {
      version.status = "submitted_for_review";
      version.submittedAt = timestamp;
    }

    await store.save();
    await recordAudit({
      request,
      user,
      action: "knowledge.submitted_for_review",
      objectType: "knowledge_item",
      objectId: item.id,
      organizationId: item.organizationId,
      beforeSnapshotRef: version?.id ?? null,
      afterSnapshotRef: version?.id ?? null,
      reason: request.body?.reason?.trim() || "knowledge_submit_review",
      result: "success"
    });

    return {
      item,
      version
    };
  });

  async function handleKnowledgeReviewAction(
    request: FastifyRequest<{ Body: KnowledgeActionBody; Params: { id: string } }>,
    reply: FastifyReply,
    nextStatus: "published" | "rejected" | "archived"
  ) {
    const user = await requireMenuAccess(request, reply, "knowledge");

    if (!user) {
      return undefined;
    }

    const item = knowledgeItems.find((candidate) => candidate.id === request.params.id);

    if (!item || !canReviewKnowledgeItem(user, item)) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "operation",
        action: nextStatus === "published" ? "publish_knowledge" : `knowledge_${nextStatus}`,
        resourceType: "knowledge_item",
        reason: "forbidden"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    if (nextStatus === "published" && item.status !== "submitted_for_review") {
      return reply.code(409).send({ error: "invalid_knowledge_status" });
    }

    if (nextStatus === "rejected" && item.status !== "submitted_for_review") {
      return reply.code(409).send({ error: "invalid_knowledge_status" });
    }

    if (nextStatus === "archived" && item.status === "archived") {
      return reply.code(409).send({ error: "invalid_knowledge_status" });
    }

    const version = currentKnowledgeVersion(item);
    const timestamp = nowIso();
    const previousStatus = item.status;
    item.status = nextStatus;
    item.reviewerUserId = user.id;
    item.reviewedAt = timestamp;
    item.updatedAt = timestamp;

    if (nextStatus === "published") {
      item.publishedAt = timestamp;
    }

    if (nextStatus === "rejected") {
      item.rejectedAt = timestamp;
    }

    if (nextStatus === "archived") {
      item.archivedAt = timestamp;
    }

    if (version) {
      version.status = nextStatus;
      version.reviewerUserId = user.id;
      version.reviewedAt = timestamp;

      if (nextStatus === "published") {
        version.publishedAt = timestamp;
      }

      if (nextStatus === "rejected") {
        version.rejectedAt = timestamp;
      }

      if (nextStatus === "archived") {
        version.archivedAt = timestamp;
      }
    }

    await store.save();
    await recordAudit({
      request,
      user,
      action:
        nextStatus === "published"
          ? "knowledge.published"
          : nextStatus === "rejected"
            ? "knowledge.rejected"
            : "knowledge.archived",
      objectType: "knowledge_item",
      objectId: item.id,
      organizationId: item.organizationId,
      beforeSnapshotRef: `${version?.id ?? item.id}:${previousStatus}`,
      afterSnapshotRef: `${version?.id ?? item.id}:${nextStatus}`,
      reason: request.body?.reason?.trim() || `knowledge_${nextStatus}`,
      result: "success"
    });

    return {
      item,
      version
    };
  }

  server.post<{ Body: KnowledgeActionBody; Params: { id: string } }>("/knowledge/items/:id/publish", async (request, reply) =>
    handleKnowledgeReviewAction(request, reply, "published")
  );

  server.post<{ Body: KnowledgeActionBody; Params: { id: string } }>("/knowledge/items/:id/reject", async (request, reply) =>
    handleKnowledgeReviewAction(request, reply, "rejected")
  );

  server.post<{ Body: KnowledgeActionBody; Params: { id: string } }>("/knowledge/items/:id/archive", async (request, reply) =>
    handleKnowledgeReviewAction(request, reply, "archived")
  );

  server.post<{ Body: CreateKnowledgeVersionBody; Params: { id: string } }>("/knowledge/items/:id/versions", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "knowledge");

    if (!user) {
      return;
    }

    const item = knowledgeItems.find((candidate) => candidate.id === request.params.id);

    if (!item || !canReadKnowledgeItem(user, item)) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "knowledge_item",
        reason: "knowledge_version_create",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    if (item.status === "archived") {
      return reply.code(409).send({ error: "invalid_knowledge_status" });
    }

    const timestamp = nowIso();
    const nextVersionNumber = Math.max(
      0,
      ...knowledgeVersions
        .filter((version) => version.knowledgeItemId === item.id)
        .map((version) => version.version)
    ) + 1;
    const title = textOrDefault(request.body?.title, item.title);
    const content = textOrDefault(request.body?.content, item.content);
    const status = request.body?.submitForReview ? "submitted_for_review" : "draft";
    const sourceEvidence: KnowledgeSourceEvidence[] = [
      ...item.sourceEvidence,
      {
        sourceType: "manual",
        sourceId: user.id,
        sourceMessageIds: [],
        sourceParticipantUserIds: [user.id],
        title,
        excerpt: content.slice(0, 240)
      }
    ];
    const version: KnowledgeVersionRecord = {
      id: `knowledge-version-${randomUUID()}`,
      knowledgeItemId: item.id,
      version: nextVersionNumber,
      title,
      content,
      authorUserId: user.id,
      reviewerUserId: null,
      status,
      sourceEvidence,
      createdAt: timestamp,
      submittedAt: status === "submitted_for_review" ? timestamp : null,
      reviewedAt: null,
      publishedAt: null,
      rejectedAt: null,
      archivedAt: null
    };

    item.title = title;
    item.content = content;
    item.currentVersion = nextVersionNumber;
    item.creatorUserId = user.id;
    item.reviewerUserId = null;
    item.status = status;
    item.sourceEvidence = sourceEvidence;
    item.sourceMessageIds = sourceEvidence.flatMap((evidence) => evidence.sourceMessageIds);
    item.sourceParticipantUserIds = Array.from(
      new Set(sourceEvidence.flatMap((evidence) => evidence.sourceParticipantUserIds))
    );
    item.updatedAt = timestamp;
    item.submittedAt = status === "submitted_for_review" ? timestamp : null;
    item.reviewedAt = null;
    item.publishedAt = null;
    item.rejectedAt = null;
    item.archivedAt = null;

    knowledgeVersions.push(version);
    await store.save();
    await recordAudit({
      request,
      user,
      action: "knowledge.version_created",
      objectType: "knowledge_item",
      objectId: item.id,
      organizationId: item.organizationId,
      afterSnapshotRef: version.id,
      reason: status === "submitted_for_review" ? "knowledge_version_submitted_for_review" : "knowledge_version_created",
      result: "success"
    });

    return reply.code(201).send({
      item,
      version
    });
  });

  function assertContractText(reply: FastifyReply, text: string | undefined) {
    if (!text?.trim()) {
      reply.code(400).send({ error: "contract_text_required" });
      return undefined;
    }

    return text.trim();
  }

  async function createContractFromEntry({
    request,
    reply,
    entryMethod
  }: {
    request: FastifyRequest<{ Body: ContractUploadBody & ContractPasteBody }>;
    reply: FastifyReply;
    entryMethod: ContractEntryMethod;
  }) {
    const user = await requireMenuAccess(request, reply, "contracts");

    if (!user) {
      return undefined;
    }

    const organizationId = request.body?.organizationId ?? user.defaultOrganizationId;
    const originalText = assertContractText(
      reply,
      entryMethod === "upload" ? request.body?.contentText : request.body?.originalText
    );

    if (!originalText) {
      return undefined;
    }

    if (!canPerformOperation(user, "create_contract", { organizationId, ownerUserId: user.id })) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "operation",
        action: "create_contract",
        resourceType: "contract",
        reason: "forbidden"
      });
      return reply.code(403).send({ error: "forbidden" });
    }

    const title = textOrDefault(request.body?.title, entryMethod === "upload" ? request.body?.fileName ?? "上传合同" : "粘贴合同");
    const timestamp = nowIso();
    const contractId = `contract-${randomUUID()}`;
    const versionId = `contract-version-${randomUUID()}`;
    const contract: ContractRecord = {
      id: contractId,
      title,
      organizationId,
      creatorUserId: user.id,
      participantUserIds: [user.id],
      status: "draft",
      currentVersion: 1,
      approvalHandoffId: null,
      executionStatus: "not_started",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const version: ContractVersionRecord = {
      id: versionId,
      contractId,
      version: 1,
      title,
      originalText,
      entryMethod,
      sourceEvidence: contractSourceEvidence({
        sourceType: entryMethod,
        sourceId: versionId,
        title,
        fileName: entryMethod === "upload" ? textOrDefault(request.body?.fileName, "contract.txt") : null,
        mimeType: entryMethod === "upload" ? textOrDefault(request.body?.mimeType, "text/plain") : null,
        user,
        timestamp,
        originalText
      }),
      createdByUserId: user.id,
      createdAt: timestamp
    };

    contracts.push(contract);
    contractVersions.push(version);
    await store.save();
    await recordAudit({
      request,
      user,
      action: entryMethod === "upload" ? "contract.uploaded" : "contract.pasted",
      objectType: "contract",
      objectId: contract.id,
      organizationId,
      afterSnapshotRef: version.id,
      reason: `contract_entry:${entryMethod}`,
      result: "success"
    });
    await recordAudit({
      request,
      user,
      action: "contract.version_created",
      objectType: "contract",
      objectId: contract.id,
      organizationId,
      afterSnapshotRef: version.id,
      reason: `contract_initial_version:${entryMethod}`,
      result: "success"
    });

    return reply.code(201).send({
      contract: contractWithDetails(contract)
    });
  }

  server.get("/contracts", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "contracts");

    if (!user) {
      return;
    }

    return {
      contracts: visibleContractsForUser(user).map(contractWithDetails)
    };
  });

  server.post<{ Body: ContractUploadBody }>("/contracts/upload", async (request, reply) =>
    createContractFromEntry({ request, reply, entryMethod: "upload" })
  );

  server.post<{ Body: ContractPasteBody }>("/contracts/paste", async (request, reply) =>
    createContractFromEntry({ request, reply, entryMethod: "paste" })
  );

  server.get<{ Params: { id: string } }>("/contracts/:id", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "contracts");

    if (!user) {
      return;
    }

    const contract = findVisibleContract(user, request.params.id);

    if (!contract) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "contract",
        reason: "contract:read",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    return {
      contract: contractWithDetails(contract)
    };
  });

  async function runContractReview(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
    reviewType: ContractReviewType
  ) {
    const user = await requireMenuAccess(request, reply, "contracts");

    if (!user) {
      return undefined;
    }

    const contract = findVisibleContract(user, request.params.id);

    if (!contract) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "contract",
        reason: `contract:${reviewType}_review`,
        result: "denied",
        aiInvolved: true,
        aiFrameworkVersion: contractFrameworkVersion
      });
      return reply.code(404).send({ error: "not_found" });
    }

    if (!canUseAiCapability(user, "contract_review", contractResource(contract))) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "ai",
        action: "contract_review",
        resourceType: "contract",
        reason: "forbidden"
      });
      return reply.code(403).send({ error: "forbidden" });
    }

    const versionForRun = currentContractVersion(contract);
    const contractAiRun = await createAiRun({
      request,
      user,
      scenario: "contract_review",
      organizationId: contract.organizationId,
      sourceObjectType: "contract",
      sourceObjectId: contract.id,
      sourceIds: versionForRun ? [versionForRun.id] : [],
      contextSourceIds: versionForRun?.sourceEvidence.map((source) => source.sourceId) ?? [],
      inputPayload: {
        contractId: contract.id,
        reviewType,
        status: contract.status,
        versionId: versionForRun?.id ?? null,
        sourceEvidence: versionForRun?.sourceEvidence ?? []
      }
    });

    if (versionForRun) {
      appendAiRunEvidence(contractAiRun, versionForRun.sourceEvidence.map((source) => ({
        sourceObjectType: "contract_version",
        sourceObjectId: versionForRun.id,
        sourceId: source.sourceId,
        title: source.title,
        excerpt: source.excerpt,
        accessResult: "allowed" as const
      })));
    }

    if (reviewType === "initial" && !["draft", "revision_required"].includes(contract.status)) {
      await completeAiRun({
        request,
        user,
        run: contractAiRun,
        status: "failed",
        outputPayload: { error: "invalid_contract_status" },
        failureClass: "validation_error",
        failureMessage: "invalid_contract_status"
      });
      await recordAudit({
        request,
        user,
        action: "contract.ai_review_failed",
        objectType: "contract",
        objectId: contract.id,
        organizationId: contract.organizationId,
        reason: "invalid_contract_status",
        result: "failure",
        aiInvolved: true,
        aiFrameworkVersion: contractFrameworkVersion
      });
      return reply.code(409).send({ error: "invalid_contract_status" });
    }

    if (reviewType === "second" && (contract.currentVersion < 2 || contract.status !== "revision_required")) {
      await completeAiRun({
        request,
        user,
        run: contractAiRun,
        status: "failed",
        outputPayload: { error: "revision_required_before_second_review" },
        failureClass: "validation_error",
        failureMessage: "revision_required_before_second_review"
      });
      await recordAudit({
        request,
        user,
        action: "contract.second_review_failed",
        objectType: "contract",
        objectId: contract.id,
        organizationId: contract.organizationId,
        reason: "revision_required_before_second_review",
        result: "failure",
        aiInvolved: true,
        aiFrameworkVersion: contractFrameworkVersion
      });
      return reply.code(409).send({ error: "revision_required_before_second_review" });
    }

    const version = versionForRun;

    if (!version) {
      await completeAiRun({
        request,
        user,
        run: contractAiRun,
        status: "failed",
        outputPayload: { error: "missing_contract_version" },
        failureClass: "validation_error",
        failureMessage: "missing_contract_version"
      });
      return reply.code(409).send({ error: "missing_contract_version" });
    }

    const timestamp = nowIso();
    const previousStatus = contract.status;
    contract.status = reviewType === "second" ? "second_reviewing" : "ai_reviewing";
    contract.updatedAt = timestamp;
    await recordAudit({
      request,
      user,
      action: reviewType === "second" ? "contract.second_review_started" : "contract.ai_review_started",
      objectType: "contract",
      objectId: contract.id,
      organizationId: contract.organizationId,
      beforeSnapshotRef: `${contract.id}:${previousStatus}`,
      afterSnapshotRef: `${contract.id}:${contract.status}`,
      reason: `contract_review_started:${reviewType}`,
      result: "success",
      aiInvolved: true,
      aiFrameworkVersion: contractFrameworkVersion
    });

    const review = buildStructuredContractReview({
      contract,
      version,
      reviewType,
      user,
      timestamp
    });

    contractReviews.push(review);
    contract.status = "risk_pending_confirm";
    contract.updatedAt = timestamp;
    await completeAiRun({
      request,
      user,
      run: contractAiRun,
      status: "succeeded",
      outputPayload: {
        reviewId: review.id,
        summary: review.summary,
        riskLevel: review.riskLevel,
        riskCount: review.risks.length,
        nextRequiredAction: review.nextRequiredAction,
        humanConfirmationRequired: true
      },
      frameworkVersion: review.frameworkVersion,
      contextSourceIds: version.sourceEvidence.map((source) => source.sourceId)
    });
    await store.save();
    await recordAudit({
      request,
      user,
      action: reviewType === "second" ? "contract.second_review_completed" : "contract.ai_review_completed",
      objectType: "contract",
      objectId: contract.id,
      organizationId: contract.organizationId,
      beforeSnapshotRef: version.id,
      afterSnapshotRef: review.id,
      reason: `contract_review_completed:${review.risks.length}_risks`,
      result: "success",
      aiInvolved: true,
      aiFrameworkVersion: review.frameworkVersion
    });

    return {
      contract: contractWithDetails(contract),
      review
    };
  }

  server.post<{ Params: { id: string } }>("/contracts/:id/ai-review", async (request, reply) =>
    runContractReview(request, reply, "initial")
  );

  server.post<{ Params: { id: string } }>("/contracts/:id/second-review", async (request, reply) =>
    runContractReview(request, reply, "second")
  );

  server.post<{ Body: ContractRiskConfirmationBody; Params: { id: string } }>("/contracts/:id/risk-confirm", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "contracts");

    if (!user) {
      return;
    }

    const contract = findVisibleContract(user, request.params.id);

    if (!contract) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "contract",
        reason: "contract:risk_confirm",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    if (!canPerformOperation(user, "confirm_contract_risk", contractResource(contract))) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "operation",
        action: "confirm_contract_risk",
        resourceType: "contract",
        reason: "forbidden"
      });
      return reply.code(403).send({ error: "forbidden" });
    }

    if (contract.status !== "risk_pending_confirm") {
      return reply.code(409).send({ error: "risk_confirmation_not_pending" });
    }

    const review = latestContractReview(contract);

    if (!review || review.version !== contract.currentVersion) {
      return reply.code(409).send({ error: "review_required" });
    }

    const confirmations = request.body?.confirmations ?? [];
    const confirmationByRiskId = new Map(confirmations.map((confirmation) => [confirmation.riskId, confirmation]));

    for (const risk of review.risks) {
      const confirmation = confirmationByRiskId.get(risk.id);

      if (confirmation?.confirmed !== true || !confirmation.selectedOption) {
        return reply.code(400).send({ error: "all_risks_require_human_confirmation" });
      }
    }

    const timestamp = nowIso();
    const createdConfirmations: ContractRiskConfirmationRecord[] = review.risks.map((risk) => {
      const confirmation = confirmationByRiskId.get(risk.id)!;
      risk.humanConfirmed = true;
      risk.selectedOption = confirmation.selectedOption!;
      risk.confirmationNote = confirmation.note?.trim() ?? "";
      risk.confirmedByUserId = user.id;
      risk.confirmedAt = timestamp;

      return {
        id: `contract-risk-confirmation-${randomUUID()}`,
        contractId: contract.id,
        reviewId: review.id,
        riskId: risk.id,
        confirmed: true,
        selectedOption: confirmation.selectedOption!,
        note: confirmation.note?.trim() ?? "",
        confirmedByUserId: user.id,
        confirmedAt: timestamp
      };
    });

    contractRiskConfirmations.push(...createdConfirmations);
    contract.status = review.reviewType === "second" ? "risk_pending_confirm" : "revision_required";
    contract.updatedAt = timestamp;
    await store.save();
    await recordAudit({
      request,
      user,
      action: "contract.risk_confirmed",
      objectType: "contract",
      objectId: contract.id,
      organizationId: contract.organizationId,
      beforeSnapshotRef: review.id,
      afterSnapshotRef: createdConfirmations.map((confirmation) => confirmation.id).join(","),
      reason: request.body?.reason?.trim() || "human_confirmed_contract_risks",
      result: "success",
      aiInvolved: true,
      aiFrameworkVersion: review.frameworkVersion
    });

    return {
      contract: contractWithDetails(contract),
      confirmations: createdConfirmations
    };
  });

  server.post<{ Body: ContractRevisionBody; Params: { id: string } }>("/contracts/:id/revision", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "contracts");

    if (!user) {
      return;
    }

    const contract = findVisibleContract(user, request.params.id);

    if (!contract) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "contract",
        reason: "contract:revision",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    if (!canPerformOperation(user, "revise_contract", contractResource(contract))) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "operation",
        action: "revise_contract",
        resourceType: "contract",
        reason: "forbidden"
      });
      return reply.code(403).send({ error: "forbidden" });
    }

    if (contract.status !== "revision_required") {
      return reply.code(409).send({ error: "risk_confirmation_required_before_revision" });
    }

    const originalText = assertContractText(reply, request.body?.originalText);

    if (!originalText) {
      return;
    }

    const timestamp = nowIso();
    const versionNumber = Math.max(0, ...versionsForContract(contract.id).map((version) => version.version)) + 1;
    const title = textOrDefault(request.body?.title, contract.title);
    const version: ContractVersionRecord = {
      id: `contract-version-${randomUUID()}`,
      contractId: contract.id,
      version: versionNumber,
      title,
      originalText,
      entryMethod: "revision",
      sourceEvidence: contractSourceEvidence({
        sourceType: "revision",
        sourceId: contract.id,
        title,
        user,
        timestamp,
        originalText
      }),
      createdByUserId: user.id,
      createdAt: timestamp
    };

    contract.title = title;
    contract.currentVersion = versionNumber;
    contract.status = "revision_required";
    contract.updatedAt = timestamp;
    contractVersions.push(version);
    await store.save();
    await recordAudit({
      request,
      user,
      action: "contract.revised",
      objectType: "contract",
      objectId: contract.id,
      organizationId: contract.organizationId,
      afterSnapshotRef: version.id,
      reason: request.body?.reason?.trim() || "contract_revision_submitted",
      result: "success"
    });
    await recordAudit({
      request,
      user,
      action: "contract.version_created",
      objectType: "contract",
      objectId: contract.id,
      organizationId: contract.organizationId,
      afterSnapshotRef: version.id,
      reason: "contract_modified_version_requires_second_review",
      result: "success"
    });

    return reply.code(201).send({
      contract: contractWithDetails(contract),
      version
    });
  });

  server.post<{ Body: ContractActionBody; Params: { id: string } }>("/contracts/:id/submit-approval", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "contracts");

    if (!user) {
      return;
    }

    const contract = findVisibleContract(user, request.params.id);

    if (!contract) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "contract",
        reason: "contract:submit_approval",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    if (!canPerformApprovalAction(user, "initiate_approval", contractResource(contract))) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "approval",
        action: "initiate_approval",
        resourceType: "contract",
        reason: "forbidden"
      });
      return reply.code(403).send({ error: "forbidden" });
    }

    const version = currentContractVersion(contract);
    const review = latestContractReview(contract);
    const allRisksConfirmed = Boolean(review && review.risks.every((risk) => risk.humanConfirmed && risk.selectedOption));

    if (!version || contract.currentVersion < 2 || review?.reviewType !== "second" || review.version !== contract.currentVersion || !allRisksConfirmed) {
      await recordAudit({
        request,
        user,
        action: "contract.approval_submission_blocked",
        objectType: "contract",
        objectId: contract.id,
        organizationId: contract.organizationId,
        reason: "second_review_and_human_risk_confirmation_required",
        result: "failure"
      });
      return reply.code(409).send({ error: "second_review_and_human_confirmation_required" });
    }

    const timestamp = nowIso();
    const handoff: ContractApprovalHandoffRecord = {
      id: `contract-approval-handoff-${randomUUID()}`,
      contractId: contract.id,
      versionId: version.id,
      submittedByUserId: user.id,
      status: "submitted_boundary",
      approvalEngineImplemented: false,
      approvalId: null,
      reason: request.body?.reason?.trim() || "contract_ready_for_human_approval_engine",
      createdAt: timestamp
    };
    const approval = createContractApprovalInstance({
      contract,
      version,
      handoff,
      user,
      timestamp,
      reason: handoff.reason
    });

    contractApprovalHandoffs.push(handoff);
    await store.save();
    await recordAudit({
      request,
      user,
      action: "contract.approval_submitted",
      objectType: "contract",
      objectId: contract.id,
      organizationId: contract.organizationId,
      beforeSnapshotRef: review.id,
      afterSnapshotRef: approval.id,
      reason: "approval_instance_created:human_only",
      result: "success"
    });
    await recordAudit({
      request,
      user,
      action: "approval.initiated",
      objectType: "approval",
      objectId: approval.id,
      organizationId: approval.organizationId,
      beforeSnapshotRef: handoff.id,
      afterSnapshotRef: approval.currentNodeId,
      reason: handoff.reason,
      result: "success"
    });
    await recordAudit({
      request,
      user,
      action: "approval.node_entered",
      objectType: "approval",
      objectId: approval.id,
      organizationId: approval.organizationId,
      afterSnapshotRef: approval.currentNodeId,
      reason: `current_approver:${approval.currentApproverUserId}`,
      result: "success"
    });

    return {
      contract: contractWithDetails(contract),
      handoff,
      approval: approvalWithDetails(approval)
    };
  });

  server.post<{ Body: ContractExecutionEventBody; Params: { id: string } }>("/contracts/:id/execution-events", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "contracts");

    if (!user) {
      return;
    }

    const contract = findVisibleContract(user, request.params.id);

    if (!contract) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "contract",
        reason: "contract:execution_event",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    if (!canPerformOperation(user, "track_contract_execution", contractResource(contract))) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "operation",
        action: "track_contract_execution",
        resourceType: "contract",
        reason: "forbidden"
      });
      return reply.code(403).send({ error: "forbidden" });
    }

    if (!["approval_pending", "approved", "execution_tracking"].includes(contract.status)) {
      return reply.code(409).send({ error: "approval_handoff_required_before_execution_tracking" });
    }

    const eventType = request.body?.eventType;

    if (!eventType || !supportedContractExecutionEventTypes.includes(eventType)) {
      return reply.code(400).send({ error: "invalid_execution_event_type" });
    }

    const timestamp = nowIso();
    const event: ContractExecutionEventRecord = {
      id: `contract-execution-event-${randomUUID()}`,
      contractId: contract.id,
      eventType,
      title: textOrDefault(request.body?.title, eventType === "reminder" ? "执行提醒" : "执行记录"),
      notes: textOrDefault(request.body?.notes, "人工记录的合同执行跟踪事项。"),
      status: textOrDefault(request.body?.status, eventType),
      dueAt: request.body?.dueAt ?? null,
      createdByUserId: user.id,
      createdAt: timestamp
    };

    contractExecutionEvents.push(event);
    contract.executionStatus = "tracking";
    contract.status = "execution_tracking";
    contract.updatedAt = timestamp;
    await store.save();
    await recordAudit({
      request,
      user,
      action: "contract.execution_event_recorded",
      objectType: "contract",
      objectId: contract.id,
      organizationId: contract.organizationId,
      afterSnapshotRef: event.id,
      reason: `execution_tracking:${eventType}:reminder_record_status_only`,
      result: "success"
    });

    return reply.code(201).send({
      contract: contractWithDetails(contract),
      event
    });
  });

  server.get("/approvals", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "approvals");

    if (!user) {
      return;
    }

    return {
      approvals: visibleApprovalsForUser(user).map(approvalWithDetails)
    };
  });

  server.post<{ Body: CreateApprovalBody }>("/approvals", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "approvals");

    if (!user) {
      return;
    }

    if (request.body?.sourceObjectType !== "contract" || !request.body.sourceObjectId) {
      return reply.code(400).send({ error: "approval_source_required" });
    }

    const contract = findVisibleContract(user, request.body.sourceObjectId);

    if (!contract) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "approval",
        reason: "approval:create_source",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    if (!canPerformApprovalAction(user, "initiate_approval", contractResource(contract))) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "approval",
        action: "initiate_approval",
        resourceType: "approval",
        reason: "forbidden"
      });
      return reply.code(403).send({ error: "forbidden" });
    }

    const version = currentContractVersion(contract);
    const review = latestContractReview(contract);
    const allRisksConfirmed = Boolean(review && review.risks.every((risk) => risk.humanConfirmed && risk.selectedOption));

    if (!version || contract.currentVersion < 2 || review?.reviewType !== "second" || review.version !== contract.currentVersion || !allRisksConfirmed) {
      return reply.code(409).send({ error: "second_review_and_human_confirmation_required" });
    }

    const timestamp = nowIso();
    const handoff: ContractApprovalHandoffRecord = {
      id: `contract-approval-handoff-${randomUUID()}`,
      contractId: contract.id,
      versionId: version.id,
      submittedByUserId: user.id,
      status: "submitted_boundary",
      approvalEngineImplemented: false,
      approvalId: null,
      reason: request.body?.reason?.trim() || "approval_api_contract_source",
      createdAt: timestamp
    };
    const approval = createContractApprovalInstance({
      contract,
      version,
      handoff,
      user,
      timestamp,
      reason: handoff.reason
    });

    contractApprovalHandoffs.push(handoff);
    await store.save();
    await recordAudit({
      request,
      user,
      action: "approval.initiated",
      objectType: "approval",
      objectId: approval.id,
      organizationId: approval.organizationId,
      beforeSnapshotRef: handoff.id,
      afterSnapshotRef: approval.currentNodeId,
      reason: handoff.reason,
      result: "success"
    });

    return reply.code(201).send({
      approval: approvalWithDetails(approval)
    });
  });

  server.get<{ Params: { id: string } }>("/approvals/:id", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "approvals");

    if (!user) {
      return;
    }

    const approval = findVisibleApproval(user, request.params.id);

    if (!approval) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "approval",
        reason: "approval:read",
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    return {
      approval: approvalWithDetails(approval)
    };
  });

  async function handleApprovalAction(
    request: FastifyRequest<{ Body: ApprovalActionBody; Params: { id: string } }>,
    reply: FastifyReply,
    action: ApprovalActionType
  ) {
    const user = await requireMenuAccess(request, reply, "approvals");

    if (!user) {
      return undefined;
    }

    const approval = findVisibleApproval(user, request.params.id);

    if (!approval) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "approval",
        reason: `approval:${action}`,
        result: "denied"
      });
      return reply.code(404).send({ error: "not_found" });
    }

    if (approval.status !== "processing") {
      return reply.code(409).send({ error: "approval_not_processing" });
    }

    const node = currentApprovalNode(approval);

    if (!node) {
      return reply.code(409).send({ error: "current_node_required" });
    }

    const permissionByAction: Record<ApprovalActionType, ApprovalPermission> = {
      approve: "approve_current_node",
      reject: "reject_current_node",
      return: "return_for_revision",
      transfer: "transfer_approval",
      add_sign: "add_sign"
    };
    const permission = permissionByAction[action];

    if (!canPerformApprovalAction(user, permission, {
      ...approvalResource(approval),
      currentNodeApproverUserIds: [node.approverUserId]
    })) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "approval",
        action: permission,
        resourceType: "approval",
        reason: "forbidden"
      });
      return reply.code(403).send({ error: "forbidden" });
    }

    if ((action === "transfer" || action === "add_sign") && !isHumanApprover(request.body?.targetUserId)) {
      return reply.code(400).send({ error: "human_approver_required" });
    }

    const reason = request.body?.reason?.trim();

    if (!reason) {
      return reply.code(400).send({ error: "reason_required" });
    }

    const timestamp = nowIso();
    const previousNodeId = node.id;
    const previousApproverId = node.approverUserId;
    const actionRecord: ApprovalActionRecord = {
      id: `approval-action-${randomUUID()}`,
      approvalId: approval.id,
      nodeId: node.id,
      action,
      actorUserId: user.id,
      targetUserId: action === "transfer" || action === "add_sign" ? request.body.targetUserId! : null,
      reason,
      createdAt: timestamp
    };

    approvalActions.push(actionRecord);

    if (action === "approve") {
      node.status = "approved";
      node.decidedAt = timestamp;
      node.decidedByUserId = user.id;
      node.decisionReason = reason;
      node.updatedAt = timestamp;

      const nextNode = nodesForApproval(approval.id).find((candidate) => candidate.status === "pending");

      if (nextNode) {
        setApprovalCurrentNode(approval, nextNode, timestamp);
        await recordAudit({
          request,
          user,
          action: "approval.approved",
          objectType: "approval",
          objectId: approval.id,
          organizationId: approval.organizationId,
          beforeSnapshotRef: previousNodeId,
          afterSnapshotRef: nextNode.id,
          reason,
          result: "success"
        });
        await recordAudit({
          request,
          user,
          action: "approval.node_entered",
          objectType: "approval",
          objectId: approval.id,
          organizationId: approval.organizationId,
          beforeSnapshotRef: previousNodeId,
          afterSnapshotRef: nextNode.id,
          reason: `current_approver:${nextNode.approverUserId}`,
          result: "success"
        });
      } else {
        approval.status = "approved";
        approval.completedAt = timestamp;
        setApprovalCurrentNode(approval, null, timestamp);
        writeBackApprovalResult(approval, "approved", timestamp);
        await recordAudit({
          request,
          user,
          action: "approval.approved",
          objectType: "approval",
          objectId: approval.id,
          organizationId: approval.organizationId,
          beforeSnapshotRef: previousNodeId,
          afterSnapshotRef: `${approval.sourceObjectType}:${approval.sourceObjectId}:approved`,
          reason,
          result: "success"
        });
        await recordAudit({
          request,
          user,
          action: "approval.completed",
          objectType: "approval",
          objectId: approval.id,
          organizationId: approval.organizationId,
          afterSnapshotRef: approval.resultWritebackStatus,
          reason: "approval_result_writeback_completed",
          result: "success"
        });
        await recordAudit({
          request,
          user,
          action: "contract.approval_result_written_back",
          objectType: "contract",
          objectId: approval.sourceObjectId,
          organizationId: approval.organizationId,
          afterSnapshotRef: approval.resultWritebackStatus,
          reason: "approval_approved_human_decision",
          result: "success"
        });
      }
    }

    if (action === "reject" || action === "return") {
      const nextStatus = action === "reject" ? "rejected" : "returned";
      node.status = nextStatus;
      node.decidedAt = timestamp;
      node.decidedByUserId = user.id;
      node.decisionReason = reason;
      node.updatedAt = timestamp;
      approval.status = nextStatus;
      approval.completedAt = timestamp;
      setApprovalCurrentNode(approval, null, timestamp);
      writeBackApprovalResult(approval, nextStatus, timestamp);
      await recordAudit({
        request,
        user,
        action: action === "reject" ? "approval.rejected" : "approval.returned",
        objectType: "approval",
        objectId: approval.id,
        organizationId: approval.organizationId,
        beforeSnapshotRef: previousNodeId,
        afterSnapshotRef: approval.resultWritebackStatus,
        reason,
        result: "success"
      });
      await recordAudit({
        request,
        user,
        action: "contract.approval_result_written_back",
        objectType: "contract",
        objectId: approval.sourceObjectId,
        organizationId: approval.organizationId,
        afterSnapshotRef: approval.resultWritebackStatus,
        reason: `approval_${nextStatus}_human_decision`,
        result: "success"
      });
    }

    if (action === "transfer") {
      node.status = "transferred";
      node.decidedAt = timestamp;
      node.decidedByUserId = user.id;
      node.decisionReason = reason;
      node.updatedAt = timestamp;
      shiftApprovalNodeSequences(approval.id, node.sequence + 1);

      const transferNode: ApprovalNodeRecord = {
        id: `approval-node-${randomUUID()}`,
        approvalId: approval.id,
        sequence: node.sequence + 1,
        name: `${node.name}（转交）`,
        approverUserId: request.body.targetUserId!,
        status: "processing",
        enteredAt: timestamp,
        decidedAt: null,
        decidedByUserId: null,
        decisionReason: null,
        fromNodeId: node.id,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      approvalNodes.push(transferNode);
      approval.status = "transferred";
      setApprovalCurrentNode(approval, transferNode, timestamp);
      approval.status = "processing";
      await recordAudit({
        request,
        user,
        action: "approval.transferred",
        objectType: "approval",
        objectId: approval.id,
        organizationId: approval.organizationId,
        beforeSnapshotRef: `${previousNodeId}:${previousApproverId}`,
        afterSnapshotRef: `${transferNode.id}:${transferNode.approverUserId}`,
        reason,
        result: "success"
      });
    }

    if (action === "add_sign") {
      shiftApprovalNodeSequences(approval.id, node.sequence);
      node.status = "pending";
      node.enteredAt = null;
      node.updatedAt = timestamp;

      const addSignNode: ApprovalNodeRecord = {
        id: `approval-node-${randomUUID()}`,
        approvalId: approval.id,
        sequence: node.sequence - 1,
        name: "加签审批",
        approverUserId: request.body.targetUserId!,
        status: "processing",
        enteredAt: timestamp,
        decidedAt: null,
        decidedByUserId: null,
        decisionReason: null,
        fromNodeId: node.id,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      approvalNodes.push(addSignNode);
      setApprovalCurrentNode(approval, addSignNode, timestamp);
      await recordAudit({
        request,
        user,
        action: "approval.add_signed",
        objectType: "approval",
        objectId: approval.id,
        organizationId: approval.organizationId,
        beforeSnapshotRef: `${previousNodeId}:${previousApproverId}`,
        afterSnapshotRef: `${addSignNode.id}:${addSignNode.approverUserId}`,
        reason,
        result: "success"
      });
    }

    await store.save();

    return {
      approval: approvalWithDetails(approval),
      contract: sourceContractForApproval(approval) ? contractWithDetails(sourceContractForApproval(approval)!) : null,
      action: actionRecord
    };
  }

  server.post<{ Body: ApprovalActionBody; Params: { id: string } }>("/approvals/:id/approve", async (request, reply) =>
    handleApprovalAction(request, reply, "approve")
  );

  server.post<{ Body: ApprovalActionBody; Params: { id: string } }>("/approvals/:id/reject", async (request, reply) =>
    handleApprovalAction(request, reply, "reject")
  );

  server.post<{ Body: ApprovalActionBody; Params: { id: string } }>("/approvals/:id/return", async (request, reply) =>
    handleApprovalAction(request, reply, "return")
  );

  server.post<{ Body: ApprovalActionBody; Params: { id: string } }>("/approvals/:id/transfer", async (request, reply) =>
    handleApprovalAction(request, reply, "transfer")
  );

  server.post<{ Body: ApprovalActionBody; Params: { id: string } }>("/approvals/:id/add-sign", async (request, reply) =>
    handleApprovalAction(request, reply, "add_sign")
  );

  server.get("/memory/items", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    return {
      items: visibleProjectMemoriesForUser(user)
    };
  });

  server.get<{ Querystring: { objectType?: FileSourceObjectType; objectId?: string } }>("/files", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    const objectType = request.query.objectType;
    const objectId = request.query.objectId;

    if (!isFileSourceObjectType(objectType) || !objectId) {
      return reply.code(400).send({ error: "object_binding_required" });
    }

    const visibleFiles = visibleFilesForObject(user, objectType, objectId);

    if (!visibleFiles) {
      await recordFileDenied(request, user, "view");
      return reply.code(404).send({ error: "not_found" });
    }

    return {
      files: visibleFiles
    };
  });

  server.post<{ Body: UploadFileBody }>("/files", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    const sourceObjectType = request.body?.sourceObjectType;
    const sourceObjectId = request.body?.sourceObjectId;

    if (!isFileSourceObjectType(sourceObjectType) || !sourceObjectId) {
      return reply.code(400).send({ error: "object_binding_required" });
    }

    const sourceResource = sourceResourceForUser(user, sourceObjectType, sourceObjectId);

    if (!sourceResource) {
      await recordFileDenied(request, user, "upload");
      return reply.code(404).send({ error: "not_found" });
    }

    if (
      !canPerformOperation(user, "upload_file", sourceResource) ||
      !canAccessFileAction(user, "upload", sourceResource)
    ) {
      await recordFileDenied(request, user, "upload");
      return reply.code(403).send({ error: "forbidden" });
    }

    const contentText = request.body?.contentText ?? "";
    const displayName = textOrDefault(request.body?.displayName, "untitled.txt");
    const mimeType = textOrDefault(request.body?.mimeType, "text/plain");
    const timestamp = nowIso();
    const fileId = `file-${randomUUID()}`;
    const versionId = `file-version-${randomUUID()}`;
    const checksum = checksumForContent(contentText);
    const file: FileAssetRecord = {
      id: fileId,
      organizationId: sourceResource.organizationId,
      displayName,
      mimeType,
      sizeBytes: Buffer.byteLength(contentText, "utf8"),
      checksum,
      uploaderUserId: user.id,
      status: request.body?.formalProcess ? "locked" : "linked",
      currentVersionId: versionId,
      sourceObjectType,
      sourceObjectId,
      formalProcess: request.body?.formalProcess === true,
      archivedByUserId: null,
      archivedAt: null,
      archiveReason: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    const version: FileVersionRecord = {
      id: versionId,
      fileId,
      versionNumber: 1,
      storageKey: `runtime://${fileId}/v1`,
      checksum,
      sizeBytes: file.sizeBytes,
      mimeType,
      originalName: displayName,
      contentText,
      createdByUserId: user.id,
      createdAt: timestamp
    };
    const binding = {
      id: `file-binding-${randomUUID()}`,
      fileId,
      objectType: sourceObjectType,
      objectId: sourceObjectId,
      organizationId: sourceResource.organizationId,
      createdByUserId: user.id,
      createdAt: timestamp
    };

    files.push(file);
    fileVersions.push(version);
    fileObjectBindings.push(binding);
    await store.save();
    await recordAudit({
      request,
      user,
      action: "file.uploaded",
      objectType: "file",
      objectId: file.id,
      organizationId: file.organizationId,
      reason: `file_uploaded:${sourceObjectType}`,
      result: "success"
    });
    await recordAudit({
      request,
      user,
      action: "file.bound_to_object",
      objectType: sourceObjectType,
      objectId: sourceObjectId,
      organizationId: file.organizationId,
      afterSnapshotRef: file.id,
      reason: "file_object_binding_created",
      result: "success"
    });

    return reply.code(201).send({
      file,
      version: fileVersionPublic(version),
      binding
    });
  });

  server.get<{ Params: { id: string } }>("/files/:id", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    const accessibleFile = findAccessibleFile(user, request.params.id, "view");

    if (!accessibleFile) {
      await recordFileDenied(request, user, "view");
      return reply.code(404).send({ error: "not_found" });
    }

    return {
      file: accessibleFile.file,
      version: fileVersionPublic(accessibleFile.version)
    };
  });

  server.get<{ Params: { id: string } }>("/files/:id/preview", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    const accessibleFile = findAccessibleFile(user, request.params.id, "preview");

    if (!accessibleFile) {
      await recordFileDenied(request, user, "preview");
      return reply.code(404).send({ error: "not_found" });
    }

    await recordAudit({
      request,
      user,
      action: "file.previewed",
      objectType: "file",
      objectId: accessibleFile.file.id,
      organizationId: accessibleFile.file.organizationId,
      reason: "file_preview",
      result: "success"
    });

    const response: FilePreviewResponse = {
      file: accessibleFile.file,
      version: fileVersionPublic(accessibleFile.version),
      previewText: accessibleFile.version.contentText.slice(0, 500)
    };
    return response;
  });

  server.get<{ Params: { id: string } }>("/files/:id/download", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    const accessibleFile = findAccessibleFile(user, request.params.id, "download");

    if (!accessibleFile) {
      await recordFileDenied(request, user, "download");
      return reply.code(404).send({ error: "not_found" });
    }

    await recordAudit({
      request,
      user,
      action: "file.downloaded",
      objectType: "file",
      objectId: accessibleFile.file.id,
      organizationId: accessibleFile.file.organizationId,
      reason: "file_download",
      result: "success"
    });

    return {
      file: accessibleFile.file,
      version: fileVersionPublic(accessibleFile.version),
      contentText: accessibleFile.version.contentText
    };
  });

  server.post<{ Body: ArchiveFileBody; Params: { id: string } }>("/files/:id/archive", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    const accessibleFile = findAccessibleFile(user, request.params.id, "archive");

    if (!accessibleFile) {
      await recordFileDenied(request, user, "archive");
      return reply.code(404).send({ error: "not_found" });
    }

    const timestamp = nowIso();
    accessibleFile.file.status = "archived";
    accessibleFile.file.archivedByUserId = user.id;
    accessibleFile.file.archivedAt = timestamp;
    accessibleFile.file.archiveReason = textOrDefault(
      request.body?.reason,
      accessibleFile.file.formalProcess ? "formal_process_file_voided" : "file_archived"
    );
    accessibleFile.file.updatedAt = timestamp;
    await store.save();
    await recordAudit({
      request,
      user,
      action: accessibleFile.file.formalProcess ? "file.voided" : "file.archived",
      objectType: "file",
      objectId: accessibleFile.file.id,
      organizationId: accessibleFile.file.organizationId,
      reason: accessibleFile.file.archiveReason,
      result: "success"
    });

    return {
      file: accessibleFile.file
    };
  });

  server.post<{ Body: KnowledgeQueryBody }>("/knowledge/query", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    if (!canUseAiCapability(user, "knowledge_query", { participantUserIds: [user.id] })) {
      await recordDeniedAccess({
        request,
        user,
        dimension: "ai",
        action: "knowledge_query",
        resourceType: "knowledge",
        reason: "forbidden"
      });
      return reply.code(403).send({ error: "forbidden" });
    }

    const query = request.body?.query?.trim();

    if (!query) {
      return reply.code(400).send({ error: "query_required" });
    }

    const project = request.body?.projectId ? findVisibleProject(user, request.body.projectId) : undefined;

    if (request.body?.projectId && !project) {
      await recordAudit({
        request,
        user,
        action: "access.forbidden",
        objectType: "project",
        reason: "knowledge_query:project_scope",
        result: "denied",
        aiInvolved: true,
        aiFrameworkVersion: fallbackAiFrameworkVersion
      });
      return reply.code(404).send({ error: "not_found" });
    }

    if (request.body?.organizationId && project && project.organizationId !== request.body.organizationId) {
      return reply.code(400).send({ error: "invalid_query_scope" });
    }

    const results = searchKnowledgeAndMemory({
      user,
      query,
      organizationId: request.body?.organizationId ?? project?.organizationId,
      projectId: project?.id ?? null,
      limit: request.body?.limit
    });
    const queryOrganizationId = request.body?.organizationId ?? project?.organizationId ?? user.defaultOrganizationId;
    const queryRun = await createAiRun({
      request,
      user,
      scenario: "knowledge_query",
      organizationId: queryOrganizationId,
      sourceObjectType: "knowledge_query",
      sourceObjectId: `knowledge-query-${requestId(request)}`,
      sourceIds: results.map((result) => result.id),
      contextSourceIds: results.map((result) => result.sourceId),
      inputPayload: {
        query,
        organizationId: queryOrganizationId,
        projectId: project?.id ?? null,
        permissionFiltered: true
      }
    });
    appendAiRunEvidence(queryRun, results.flatMap((result) =>
      result.sourceEvidence.map((evidence) => ({
        sourceObjectType: result.type,
        sourceObjectId: result.id,
        sourceId: evidence.sourceId,
        title: evidence.title,
        excerpt: evidence.excerpt,
        accessResult: "allowed" as const
      }))
    ));
    await completeAiRun({
      request,
      user,
      run: queryRun,
      status: "succeeded",
      outputPayload: {
        resultIds: results.map((result) => result.id),
        resultCount: results.length,
        permissionFiltered: true
      },
      contextSourceIds: results.map((result) => result.sourceId)
    });

    await recordAudit({
      request,
      user,
      action: "ai.knowledge_query_requested",
      objectType: "ai_run",
      objectId: queryRun.id,
      organizationId: queryOrganizationId,
      reason: `knowledge_query:results:${results.length}`,
      result: "success",
      aiInvolved: true,
      aiFrameworkVersion: queryRun.frameworkVersion
    });
    return {
      query,
      results
    };
  });

  server.get<{ Params: { module: string } }>("/modules/:module", async (request, reply) => {
    const moduleKey = request.params.module;
    const availableModules: ModuleKey[] = ["dashboard", "settings", "projects", "tasks", "chat", "knowledge", "contracts", "approvals"];

    if (!platformModules.some((module) => module.key === moduleKey)) {
      return reply.code(404).send({ error: "not_found" });
    }

    const user = await requireMenuAccess(request, reply, moduleKey as ModuleKey);

    if (!user) {
      return;
    }

    return {
      module: request.params.module,
      status: availableModules.includes(moduleKey as ModuleKey) ? "available" : "not_implemented"
    };
  });

  if (process.env.NODE_ENV !== "test" && process.env.XTGZPT_SERVE_WEB === "true") {
    const webDistPath = process.env.XTGZPT_WEB_DIST_DIR ?? resolve(moduleDir, "../../web/dist");
    const indexHtmlPath = resolve(webDistPath, "index.html");

    if (existsSync(indexHtmlPath)) {
      void server.register(fastifyStatic, {
        root: webDistPath,
        decorateReply: false,
        wildcard: false
      });

      server.setNotFoundHandler((request, reply) => {
        if (request.method === "GET" || request.method === "HEAD") {
          return reply.type("text/html").send(readFileSync(indexHtmlPath, "utf8"));
        }

        return reply.code(404).send({ error: "not_found" });
      });
    } else {
      server.log.warn({ webDistPath }, "XTGZPT_SERVE_WEB=true but frontend dist was not found");
    }
  }

  return server;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3002);
  const host = process.env.HOST ?? "127.0.0.1";
  const server = buildServer();

  server.listen({ host, port }).catch((error) => {
    server.log.error(error);
    process.exit(1);
  });
}
