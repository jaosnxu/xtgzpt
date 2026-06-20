import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import { createHash, randomUUID } from "node:crypto";
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
  type AuditLogEntry,
  type AuditLogFilter,
  type AuditResult,
  type ApprovalPermission,
  type AiCapability,
  type ChatMessageRecord,
  type ChatThreadRecord,
  type FileAssetRecord,
  type FilePermission,
  type FilePreviewResponse,
  type FileSourceObjectType,
  type FileVersionRecord,
  type KnowledgeItemRecord,
  type KnowledgeSearchResult,
  type ModuleKey,
  type OperationPermission,
  type PageStateDescriptor,
  type ProjectMemoryRecord,
  type ProjectRecord,
  type ProjectStatus,
  type ResourceAccessContext,
  type TaskRecord,
  type TaskStatus,
  type UserAccount,
  type WorkbenchItem,
  type WorkbenchNotification,
  type WorkbenchNotificationSeverity,
  type WorkbenchNotificationType,
  type WorkbenchResponse
} from "@xtgzpt/shared";

loadLocalEnv();

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
}

interface TaskStatusBody {
  status?: TaskStatus;
  reason?: string;
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

function nowIso() {
  return new Date().toISOString();
}

function textOrDefault(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : fallback;
}

function isFileSourceObjectType(value: unknown): value is FileSourceObjectType {
  return typeof value === "string" && supportedFileSourceObjectTypes.includes(value as FileSourceObjectType);
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
    knowledgeItems,
    projectMemories,
    files,
    fileVersions,
    fileObjectBindings
  } = store.state;
  const server = Fastify({
    logger: true
  });

  function requestId(request: FastifyRequest) {
    return request.id;
  }

  function sourceIp(request: FastifyRequest) {
    return request.ip || "unknown";
  }

  function recordAudit({
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
    store.save();
    return entry;
  }

  function recordDeniedAccess({
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
    recordAudit({
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
    store.save();
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

  function canReadProjectMemory(user: UserAccount, item: ProjectMemoryRecord) {
    return canAccessResourceData(user, {
      organizationId: item.organizationId,
      ownerUserId: item.creatorUserId,
      participantUserIds: item.sourceParticipantUserIds
    });
  }

  function visibleKnowledgeItemsForUser(user: UserAccount) {
    return knowledgeItems.filter((item) => item.status !== "archived" && canReadKnowledgeItem(user, item));
  }

  function visibleProjectMemoriesForUser(user: UserAccount) {
    return projectMemories.filter((item) => canReadProjectMemory(user, item));
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

    const knowledgeResults: KnowledgeSearchResult[] = visibleKnowledgeItemsForUser(user)
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

  function recordFileDenied(request: FastifyRequest, user: UserAccount | undefined, action: string) {
    recordDeniedAccess({
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
        evidence: "后续合同和审批期限对象接入后展示；当前 DEV-012 不创建期限实例。"
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
        severity: canHandleApproval ? "info" : "warning",
        title: canHandleApproval ? "暂无待审批节点" : "无审批处理权限",
        body: "完整审批实例和节点流转保留到 DEV-015；当前不会生成可处理的正式审批单。",
        module: "approvals"
      })
    );

    notifications.push(
      workbenchNotification({
        user,
        type: "contract_confirmation",
        severity: canReviewContracts ? "info" : "warning",
        title: canReviewContracts ? "暂无待确认合同" : "无合同确认权限",
        body: "合同风险确认保留到 DEV-014；当前不创建合同正式流程。",
        module: "contracts"
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
        title: "DEV-012 文件生产存储",
        body: "文件能力进入项目等既有页面；外部通知、完整合同和完整审批流不在本阶段范围。",
        module: "workbench"
      })
    );

    const visibleWorkCount =
      pendingTaskItems.length + responsibleTaskItems.length + projectItems.length + aiConfirmations.length;

    return {
      summary: {
        pendingWorkCount: pendingTaskItems.length,
        responsibleTaskCount: responsibleTaskItems.length,
        participatingProjectCount: projectItems.length,
        pendingApprovalCount: 0,
        contractConfirmationCount: 0,
        aiResultConfirmationCount: aiConfirmations.length,
        notificationCount: notifications.length,
        archivedProjectCount,
        expiredItemCount: 0
      },
      sections: {
        pendingWork: pendingTaskItems,
        responsibleTasks: responsibleTaskItems,
        participatingProjects: projectItems,
        pendingApprovals: [],
        contractConfirmations: [],
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
      recordDeniedAccess({
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
      recordDeniedAccess({
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
      recordDeniedAccess({
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
      recordDeniedAccess({
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
      recordDeniedAccess({
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
      recordAudit({
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
    recordAudit({
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

    recordAudit({
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

    recordAudit({
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

    recordAudit({
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

    recordAudit({
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
      recordDeniedAccess({
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
      recordDeniedAccess({
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
    store.save();
    recordAudit({
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
      recordAudit({
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
      recordAudit({
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
      store.save();
    }

    recordAudit({
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
      recordAudit({
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
    store.save();
    recordAudit({
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

  server.get("/tasks", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "tasks");

    if (!user) {
      return;
    }

    return {
      tasks: visibleTasksForUser(user)
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
      recordAudit({
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
      recordDeniedAccess({
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

    if (!participants.has(assigneeUserId) || !participants.has(confirmerUserId)) {
      return reply.code(400).send({ error: "invalid_task_participant" });
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
      status: "todo",
      cancelReason: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    tasks.push(task);
    store.save();
    recordAudit({
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
      task
    });
  });

  server.get<{ Params: { id: string } }>("/tasks/:id", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "tasks");

    if (!user) {
      return;
    }

    const visibleTask = findVisibleTask(user, request.params.id);

    if (!visibleTask) {
      recordAudit({
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
      task: visibleTask.task,
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
      recordAudit({
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
      return reply.code(403).send({ error: nextStatus === "completed" ? "confirmation_required" : "forbidden" });
    }

    if (nextStatus === "cancelled" && !request.body?.reason?.trim()) {
      return reply.code(400).send({ error: "cancel_reason_required" });
    }

    task.status = nextStatus;
    task.cancelReason = nextStatus === "cancelled" ? request.body.reason?.trim() ?? null : task.cancelReason;
    task.updatedAt = nowIso();
    store.save();
    recordAudit({
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
      task
    };
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
      recordDeniedAccess({
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
        recordAudit({
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
    store.save();
    recordAudit({
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
      recordAudit({
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
      recordAudit({
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
      recordAudit({
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
    store.save();
    recordAudit({
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
      recordAudit({
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
      recordDeniedAccess({
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

    if (sourceMessageIds.length === 0) {
      reply.code(400).send({ error: "source_messages_required" });
      return undefined;
    }

    const requestedFileIds = request.body?.fileIds ?? [];

    if (requestedFileIds.length > 0) {
      const accessibleFiles = requestedFileIds
        .map((fileId) => findAccessibleFile(user, fileId, "reference_ai"))
        .filter(Boolean);

      if (accessibleFiles.length !== requestedFileIds.length) {
        recordFileDenied(request, user, "reference_ai");
        recordAudit({
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
          recordAudit({
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
      recordAudit({
        request,
        user,
        action:
          kind === "chat_summary"
            ? "ai.chat_summarized"
            : kind === "task_draft"
              ? "ai.task_draft_created"
              : "ai.knowledge_draft_created",
        objectType: "ai_run",
        organizationId: thread.organizationId,
        reason: aiResult.message,
        result: "failure",
        aiInvolved: true,
        aiFrameworkVersion: fallbackAiFrameworkVersion
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
    store.save();
    recordAudit({
      request,
      user,
      action:
        kind === "chat_summary"
          ? "ai.chat_summarized"
          : kind === "task_draft"
            ? "ai.task_draft_created"
            : "ai.knowledge_draft_created",
      objectType: "ai_run",
      objectId: draft.id,
      organizationId: thread.organizationId,
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
      recordAudit({
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
      recordAudit({
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
        recordDeniedAccess({
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
        status: "todo",
        cancelReason: null,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      tasks.push(task);
      draft.status = "confirmed";
      draft.confirmedByUserId = user.id;
      draft.confirmedAt = timestamp;
      draft.promotedObjectType = "task";
      draft.promotedObjectId = task.id;
      store.save();
      recordAudit({
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

      return reply.code(201).send({
        draft,
        task
      });
    }

    if (draft.kind === "knowledge_draft") {
      if (!canPerformOperation(user, "publish_knowledge", {
        organizationId: thread.organizationId,
        participantUserIds: thread.memberUserIds
      })) {
        recordDeniedAccess({
          request,
          user,
          dimension: "operation",
          action: "publish_knowledge",
          resourceType: "ai_draft",
          reason: "forbidden"
        });
        return reply.code(403).send({ error: "forbidden" });
      }

      const item: KnowledgeItemRecord = {
        id: `knowledge-${randomUUID()}`,
        title,
        content,
        organizationId: thread.organizationId,
        creatorUserId: user.id,
        sourceDraftId: draft.id,
        sourceMessageIds: draft.sourceMessageIds,
        sourceParticipantUserIds: thread.memberUserIds,
        status: "published",
        createdAt: timestamp,
        updatedAt: timestamp
      };

      knowledgeItems.push(item);
      draft.status = "confirmed";
      draft.confirmedByUserId = user.id;
      draft.confirmedAt = timestamp;
      draft.promotedObjectType = "knowledge_item";
      draft.promotedObjectId = item.id;
      store.save();
      recordAudit({
        request,
        user,
        action: "knowledge.published_from_ai_draft",
        objectType: "knowledge_item",
        objectId: item.id,
        organizationId: item.organizationId,
        beforeSnapshotRef: draft.id,
        reason: "ai_draft_confirmed:knowledge",
        result: "success",
        aiInvolved: true,
        aiFrameworkVersion: draft.frameworkVersion
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
    store.save();
    recordAudit({
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

    return reply.code(201).send({
      draft,
      memory
    });
  });

  server.get("/knowledge/items", async (request, reply) => {
    const user = await requireMenuAccess(request, reply, "knowledge");

    if (!user) {
      return;
    }

    return {
      items: visibleKnowledgeItemsForUser(user)
    };
  });

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
      recordFileDenied(request, user, "view");
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
      recordFileDenied(request, user, "upload");
      return reply.code(404).send({ error: "not_found" });
    }

    if (
      !canPerformOperation(user, "upload_file", sourceResource) ||
      !canAccessFileAction(user, "upload", sourceResource)
    ) {
      recordFileDenied(request, user, "upload");
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
    store.save();
    recordAudit({
      request,
      user,
      action: "file.uploaded",
      objectType: "file",
      objectId: file.id,
      organizationId: file.organizationId,
      reason: `file_uploaded:${sourceObjectType}`,
      result: "success"
    });
    recordAudit({
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
      recordFileDenied(request, user, "view");
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
      recordFileDenied(request, user, "preview");
      return reply.code(404).send({ error: "not_found" });
    }

    recordAudit({
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
      recordFileDenied(request, user, "download");
      return reply.code(404).send({ error: "not_found" });
    }

    recordAudit({
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
      recordFileDenied(request, user, "archive");
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
    store.save();
    recordAudit({
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
      recordDeniedAccess({
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
      recordAudit({
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

    recordAudit({
      request,
      user,
      action: "ai.knowledge_query_requested",
      objectType: "ai_run",
      objectId: `knowledge-query-${requestId(request)}`,
      organizationId: request.body?.organizationId ?? project?.organizationId ?? user.defaultOrganizationId,
      reason: `knowledge_query:results:${results.length}`,
      result: "success",
      aiInvolved: true,
      aiFrameworkVersion: fallbackAiFrameworkVersion
    });
    return {
      query,
      results
    };
  });

  server.get<{ Params: { module: string } }>("/modules/:module", async (request, reply) => {
    const moduleKey = request.params.module;
    const availableModules: ModuleKey[] = ["dashboard", "settings", "projects", "tasks", "chat", "knowledge"];

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
