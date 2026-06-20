import {
  AlertTriangle,
  Archive,
  Bell,
  BookOpen,
  Brain,
  BriefcaseBusiness,
  CheckSquare,
  Clock,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Home,
  Inbox,
  LayoutDashboard,
  LoaderCircle,
  Lock,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  Upload,
  Users,
  XCircle
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  canManageOrganizations,
  canManageRoles,
  roles,
  rolePolicies,
  seedOrganizations,
  seedUsers,
  platformModules,
  type AiDraftRecord,
  type ChatMessageRecord,
  type ChatThreadRecord,
  type FileAssetRecord,
  type FileDownloadResponse,
  type FilePreviewResponse,
  type KnowledgeItemRecord,
  type KnowledgeSearchResult,
  type KnowledgeVersionRecord,
  type ModuleKey,
  type Organization,
  type PageStateDescriptor,
  type PermissionSummary,
  type ProjectMemoryRecord,
  type ProjectRecord,
  type PublicUser,
  type TaskRecord,
  type WorkbenchItem,
  type WorkbenchNotification,
  type WorkbenchResponse
} from "@xtgzpt/shared";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

interface SessionState {
  token: string;
  user: PublicUser;
  visibleModules: ModuleKey[];
  dataOrganizations: Organization[];
  permissions: PermissionSummary;
}

interface ProjectSummary extends ProjectRecord {
  taskCount: number;
}

interface ChatThreadSummary extends ChatThreadRecord {
  messageCount: number;
}

interface FilePreviewState {
  fileId: string;
  previewText: string;
  versionNumber: number;
}

interface KnowledgeItemWithVersions extends KnowledgeItemRecord {
  versions?: KnowledgeVersionRecord[];
}

const menuIcon = {
  dashboard: Home,
  workbench: LayoutDashboard,
  projects: BriefcaseBusiness,
  tasks: CheckSquare,
  chat: MessageSquare,
  knowledge: BookOpen,
  contracts: FileText,
  approvals: ClipboardList,
  settings: Settings
} as const;

const moduleStatus: Record<ModuleKey, { stage: string; summary: string }> = {
  dashboard: {
    stage: "DEV-013 已接入",
    summary: "首页按角色汇总待处理工作、AI 待确认结果、通知、权限状态、文件和知识审核边界。"
  },
  workbench: {
    stage: "DEV-012 已接入",
    summary: "我的工作台展示本人待办、负责任务、参与项目、AI 待确认结果和系统内通知。"
  },
  projects: {
    stage: "DEV-012 文件已接入",
    summary: "项目列表、创建、成员、状态、任务关联和项目附件进入真实接口，并展示空、加载、错误、无权限和归档状态。"
  },
  tasks: {
    stage: "DEV-012 文件边界已接入",
    summary: "任务列表、创建、负责人提交和人工确认已进入真实接口；文件附件通过所属项目权限继承。"
  },
  chat: {
    stage: "DEV-012 AI 文件引用已接入",
    summary: "聊天、AI 草稿、人工确认入库、记忆上下文回用和 AI 文件引用权限检查已进入真实接口。"
  },
  knowledge: {
    stage: "DEV-013 审核已接入",
    summary: "知识草稿、提交审核、发布、驳回、归档、版本历史和来源证据进入真实接口；AI 不能自动发布。"
  },
  contracts: {
    stage: "DEV-014 待开发",
    summary: "当前仅展示权限、空状态和人工确认边界；合同上传、AI 审查、二次审查和执行跟踪不在 DEV-012 范围。"
  },
  approvals: {
    stage: "DEV-015 待开发",
    summary: "当前仅展示权限、空状态和人工审批边界；审批实例、当前节点、退回、转交和加签不在 DEV-012 范围。"
  },
  settings: {
    stage: "DEV-012 状态已接入",
    summary: "权限摘要、组织、角色、审批、文件和 AI 权限维度按角色展示。"
  }
};

const auditReadinessItems = [
  "登录成功/失败、无权限访问和关键未实现动作已写 AuditLog",
  "对象审计和用户审计查询已接入权限控制",
  "文件上传、预览、下载、归档、AI 引用和权限拒绝已写审计",
  "审计记录不提供物理删除入口"
];

export function App() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleKey>("dashboard");
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [chatThreads, setChatThreads] = useState<ChatThreadSummary[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessageRecord[]>([]);
  const [aiDrafts, setAiDrafts] = useState<AiDraftRecord[]>([]);
  const [workbench, setWorkbench] = useState<WorkbenchResponse | null>(null);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItemWithVersions[]>([]);
  const [projectMemories, setProjectMemories] = useState<ProjectMemoryRecord[]>([]);
  const [projectFiles, setProjectFiles] = useState<FileAssetRecord[]>([]);
  const [filePreview, setFilePreview] = useState<FilePreviewState | null>(null);
  const [knowledgeQuery, setKnowledgeQuery] = useState("");
  const [knowledgeResults, setKnowledgeResults] = useState<KnowledgeSearchResult[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isWorkbenchLoading, setIsWorkbenchLoading] = useState(false);
  const [isWorkLoading, setIsWorkLoading] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isKnowledgeLoading, setIsKnowledgeLoading] = useState(false);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiFailure, setAiFailure] = useState<string | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [projectTitle, setProjectTitle] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [chatTitle, setChatTitle] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [workError, setWorkError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [knowledgeError, setKnowledgeError] = useState<string | null>(null);
  const activeUser = session?.user ?? null;

  async function authorizedRequest<T>(path: string, init: RequestInit = {}) {
    if (!session) {
      throw new Error("未登录");
    }

    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${session.token}`,
        ...init.headers
      }
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "请求失败");
    }

    return (await response.json()) as T;
  }

  async function refreshWorkbenchData() {
    if (!session) {
      return;
    }

    const result = await authorizedRequest<WorkbenchResponse>("/workbench");
    setWorkbench(result);
  }

  async function refreshWorkData() {
    if (!session) {
      return;
    }

    const [projectResult, taskResult] = await Promise.all([
      authorizedRequest<{ projects: ProjectSummary[] }>("/projects"),
      authorizedRequest<{ tasks: TaskRecord[] }>("/tasks")
    ]);
    setProjects(projectResult.projects);
    setTasks(taskResult.tasks);
    setSelectedProjectId((current) => current ?? projectResult.projects[0]?.id ?? null);
  }

  async function refreshChatData(threadId = selectedThreadId) {
    if (!session) {
      return;
    }

    const threadResult = await authorizedRequest<{ threads: ChatThreadSummary[] }>("/chat/threads");
    const nextThreadId = threadId ?? threadResult.threads[0]?.id ?? null;
    setChatThreads(threadResult.threads);
    setSelectedThreadId(nextThreadId);

    if (!nextThreadId) {
      setChatMessages([]);
      setAiDrafts([]);
      return;
    }

    const [messageResult, draftResult] = await Promise.all([
      authorizedRequest<{ messages: ChatMessageRecord[] }>(`/chat/threads/${nextThreadId}/messages`),
      authorizedRequest<{ drafts: AiDraftRecord[] }>(`/chat/threads/${nextThreadId}/ai/drafts`)
    ]);
    setChatMessages(messageResult.messages);
    setAiDrafts(draftResult.drafts);
  }

  async function refreshKnowledgeData() {
    if (!session) {
      return;
    }

    const [knowledgeResult, memoryResult] = await Promise.all([
      authorizedRequest<{ items: KnowledgeItemWithVersions[] }>("/knowledge/items"),
      authorizedRequest<{ items: ProjectMemoryRecord[] }>("/memory/items")
    ]);
    setKnowledgeItems(knowledgeResult.items);
    setProjectMemories(memoryResult.items);
  }

  async function refreshProjectFiles(projectId = selectedProjectId) {
    if (!session || !projectId) {
      setProjectFiles([]);
      return;
    }

    const result = await authorizedRequest<{ files: FileAssetRecord[] }>(
      `/files?objectType=project&objectId=${encodeURIComponent(projectId)}`
    );
    setProjectFiles(result.files);
  }

  useEffect(() => {
    if (!session) {
      setWorkbench(null);
      setProjects([]);
      setTasks([]);
      setChatThreads([]);
      setChatMessages([]);
      setAiDrafts([]);
      setKnowledgeItems([]);
      setProjectMemories([]);
      setProjectFiles([]);
      setFilePreview(null);
      setKnowledgeResults([]);
      setSelectedProjectId(null);
      setSelectedThreadId(null);
      setIsWorkbenchLoading(false);
      setIsWorkLoading(false);
      setIsChatLoading(false);
      setIsKnowledgeLoading(false);
      setIsFileLoading(false);
      setShowNotifications(false);
      return;
    }

    setIsWorkbenchLoading(true);
    setIsWorkLoading(true);
    setIsChatLoading(true);
    setIsKnowledgeLoading(true);
    setWorkError(null);
    setChatError(null);
    setKnowledgeError(null);
    setFileError(null);

    void Promise.allSettled([refreshWorkbenchData(), refreshWorkData(), refreshChatData(), refreshKnowledgeData()]).then((results) => {
      const [workbenchResult, workResult, chatResult, knowledgeResult] = results;

      if (workbenchResult.status === "rejected") {
        const message = workbenchResult.reason instanceof Error ? workbenchResult.reason.message : "工作台加载失败";
        setWorkError(message);
      }

      if (workResult.status === "rejected") {
        const message = workResult.reason instanceof Error ? workResult.reason.message : "工作数据加载失败";
        setWorkError(message);
      }

      if (chatResult.status === "rejected") {
        const message = chatResult.reason instanceof Error ? chatResult.reason.message : "会话加载失败";
        setChatError(message);
      }

      if (knowledgeResult.status === "rejected") {
        const message = knowledgeResult.reason instanceof Error ? knowledgeResult.reason.message : "知识加载失败";
        setKnowledgeError(message);
      }

      setIsWorkbenchLoading(false);
      setIsWorkLoading(false);
      setIsChatLoading(false);
      setIsKnowledgeLoading(false);
    });
  }, [session?.token]);

  useEffect(() => {
    if (!session || !selectedProjectId) {
      setProjectFiles([]);
      setFilePreview(null);
      return;
    }

    setIsFileLoading(true);
    setFileError(null);
    void refreshProjectFiles(selectedProjectId)
      .catch((error) => {
        setFileError(error instanceof Error ? error.message : "文件加载失败");
      })
      .finally(() => {
        setIsFileLoading(false);
      });
  }, [session?.token, selectedProjectId]);

  async function handleLogin(username: string, password: string) {
    const response = await fetch(`${apiBaseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    if (!response.ok) {
      throw new Error("账号或密码错误");
    }

    setSession((await response.json()) as SessionState);
  }

  async function createProject() {
    setWorkError(null);
    const organizationId = session?.dataOrganizations[0]?.id ?? activeUser?.defaultOrganizationId;
    const result = await authorizedRequest<{ project: ProjectSummary }>("/projects", {
      method: "POST",
      body: JSON.stringify({
        title: projectTitle.trim() || "新项目",
        summary: "由前端工作台创建。",
        organizationId
      })
    });
    setProjectTitle("");
    setSelectedProjectId(result.project.id);
    await Promise.all([refreshWorkData(), refreshWorkbenchData()]);
  }

  async function addMemberToSelectedProject() {
    if (!selectedProjectId) {
      return;
    }

    setWorkError(null);
    await authorizedRequest(`/projects/${selectedProjectId}/members`, {
      method: "POST",
      body: JSON.stringify({
        userId: "user-member"
      })
    });
    await Promise.all([refreshWorkData(), refreshWorkbenchData()]);
  }

  async function createTask() {
    if (!selectedProjectId) {
      return;
    }

    setWorkError(null);
    const selectedProject = projects.find((project) => project.id === selectedProjectId);
    const assigneeUserId = selectedProject?.memberUserIds.includes("user-member") ? "user-member" : activeUser?.id;
    await authorizedRequest<{ task: TaskRecord }>("/tasks", {
      method: "POST",
      body: JSON.stringify({
        projectId: selectedProjectId,
        title: taskTitle.trim() || "新任务",
        description: "由项目页面创建。",
        assigneeUserId,
        confirmerUserId: selectedProject?.ownerUserId ?? activeUser?.id
      })
    });
    setTaskTitle("");
    await Promise.all([refreshWorkData(), refreshWorkbenchData()]);
  }

  async function uploadProjectFile() {
    if (!selectedProjectId) {
      return;
    }

    setFileError(null);
    const result = await authorizedRequest<{ file: FileAssetRecord }>("/files", {
      method: "POST",
      body: JSON.stringify({
        sourceObjectType: "project",
        sourceObjectId: selectedProjectId,
        displayName: fileName.trim() || "project-note.txt",
        mimeType: "text/plain",
        contentText: fileContent.trim() || "项目附件内容。",
        formalProcess: false
      })
    });
    setFileName("");
    setFileContent("");
    setFilePreview(null);
    await refreshProjectFiles(result.file.sourceObjectId);
  }

  async function previewProjectFile(file: FileAssetRecord) {
    setFileError(null);
    const result = await authorizedRequest<FilePreviewResponse>(`/files/${file.id}/preview`);
    setFilePreview({
      fileId: file.id,
      previewText: result.previewText,
      versionNumber: result.version.versionNumber
    });
  }

  async function downloadProjectFile(file: FileAssetRecord) {
    setFileError(null);
    const result = await authorizedRequest<FileDownloadResponse>(`/files/${file.id}/download`);
    setFilePreview({
      fileId: file.id,
      previewText: result.contentText,
      versionNumber: result.version.versionNumber
    });
  }

  async function archiveProjectFile(file: FileAssetRecord) {
    setFileError(null);
    await authorizedRequest(`/files/${file.id}/archive`, {
      method: "POST",
      body: JSON.stringify({
        reason: file.formalProcess ? "正式流程文件作废" : "项目附件归档"
      })
    });
    setFilePreview(null);
    await refreshProjectFiles(file.sourceObjectId);
  }

  async function changeTaskStatus(task: TaskRecord, status: TaskRecord["status"]) {
    setWorkError(null);
    await authorizedRequest<{ task: TaskRecord }>(`/tasks/${task.id}/status`, {
      method: "POST",
      body: JSON.stringify({
        status,
        reason: status === "cancelled" ? "前端取消任务" : undefined
      })
    });
    await Promise.all([refreshWorkData(), refreshWorkbenchData()]);
  }

  async function changeProjectStatus(project: ProjectSummary, status: ProjectRecord["status"]) {
    setWorkError(null);
    await authorizedRequest<{ project: ProjectSummary }>(`/projects/${project.id}/status`, {
      method: "POST",
      body: JSON.stringify({
        status
      })
    });
    await Promise.all([refreshWorkData(), refreshWorkbenchData()]);
  }

  async function createChatThread() {
    setChatError(null);
    const result = await authorizedRequest<{ thread: ChatThreadSummary }>("/chat/threads", {
      method: "POST",
      body: JSON.stringify({
        title: chatTitle.trim() || "新的工作会话",
        organizationId: session?.dataOrganizations[0]?.id ?? activeUser?.defaultOrganizationId,
        memberUserIds: activeUser?.id === "user-member" ? ["user-owner"] : ["user-member"],
        relatedObjectType: selectedProjectId ? "project" : undefined,
        relatedObjectId: selectedProjectId ?? undefined
      })
    });
    setChatTitle("");
    await Promise.all([refreshChatData(result.thread.id), refreshWorkbenchData()]);
  }

  async function sendChatMessage() {
    if (!selectedThreadId) {
      return;
    }

    setChatError(null);
    await authorizedRequest<{ message: ChatMessageRecord }>(`/chat/threads/${selectedThreadId}/messages`, {
      method: "POST",
      body: JSON.stringify({
        content: chatMessage.trim() || "需要 AI 整理的工作沟通。"
      })
    });
    setChatMessage("");
    await Promise.all([refreshChatData(selectedThreadId), refreshWorkbenchData()]);
  }

  async function createAiDraft(kind: AiDraftRecord["kind"]) {
    if (!selectedThreadId) {
      return;
    }

    setChatError(null);
    const path =
      kind === "chat_summary"
        ? "summarize"
        : kind === "task_draft"
          ? "task-draft"
          : "knowledge-draft";
    setIsAiGenerating(true);
    setAiFailure(null);

    try {
      await authorizedRequest<{ draft: AiDraftRecord }>(`/chat/threads/${selectedThreadId}/ai/${path}`, {
        method: "POST",
        body: JSON.stringify({})
      });
      await Promise.all([refreshChatData(selectedThreadId), refreshWorkbenchData()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI 草稿生成失败";
      setAiFailure(message);
      throw error;
    } finally {
      setIsAiGenerating(false);
    }
  }

  async function confirmAiDraft(draft: AiDraftRecord) {
    setChatError(null);
    await authorizedRequest(`/ai/drafts/${draft.id}/confirm`, {
      method: "POST",
      body: JSON.stringify({
        projectId:
          draft.kind === "task_draft" || draft.kind === "chat_summary" ? selectedProjectId ?? projects[0]?.id : undefined,
        assigneeUserId: activeUser?.id,
        confirmerUserId: projects.find((project) => project.id === (selectedProjectId ?? projects[0]?.id))?.ownerUserId ?? activeUser?.id
      })
    });
    await Promise.all([refreshWorkData(), refreshChatData(selectedThreadId), refreshKnowledgeData(), refreshWorkbenchData()]);
  }

  async function publishKnowledgeItem(item: KnowledgeItemWithVersions) {
    setKnowledgeError(null);
    await authorizedRequest(`/knowledge/items/${item.id}/publish`, {
      method: "POST",
      body: JSON.stringify({
        reason: "knowledge_page_review_publish"
      })
    });
    await refreshKnowledgeData();
  }

  async function rejectKnowledgeItem(item: KnowledgeItemWithVersions) {
    setKnowledgeError(null);
    await authorizedRequest(`/knowledge/items/${item.id}/reject`, {
      method: "POST",
      body: JSON.stringify({
        reason: "knowledge_page_review_reject"
      })
    });
    await refreshKnowledgeData();
  }

  async function archiveKnowledgeItem(item: KnowledgeItemWithVersions) {
    setKnowledgeError(null);
    await authorizedRequest(`/knowledge/items/${item.id}/archive`, {
      method: "POST",
      body: JSON.stringify({
        reason: "knowledge_page_archive"
      })
    });
    await refreshKnowledgeData();
  }

  async function queryKnowledge() {
    setKnowledgeError(null);
    const result = await authorizedRequest<{ results: KnowledgeSearchResult[] }>("/knowledge/query", {
      method: "POST",
      body: JSON.stringify({
        query: knowledgeQuery.trim(),
        projectId: selectedProjectId ?? undefined,
        limit: 8
      })
    });
    setKnowledgeResults(result.results);
  }

  if (!session || !activeUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  const visibleModules = platformModules.filter((item) => session.visibleModules.includes(item.key));
  const activeModuleAllowed = visibleModules.some((item) => item.key === activeModule);
  const currentModule = activeModule;
  const currentModuleName = platformModules.find((item) => item.key === currentModule)?.name ?? "首页";
  const dataOrganizations = session.dataOrganizations;
  const canOpenSettings = canManageOrganizations(activeUser.role) || canManageRoles(activeUser.role);
  const notificationCount = workbench?.summary.notificationCount ?? 0;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">XT</span>
          <div>
            <strong>协同工作平台</strong>
            <span>{roles[activeUser.role]}</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="主导航">
          {visibleModules.map((item) => {
            const Icon = menuIcon[item.key];
            return (
              <button
                className={item.key === currentModule ? "nav-item active" : "nav-item"}
                key={item.key}
                onClick={() => setActiveModule(item.key)}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">DEV-013：知识库生产化</p>
            <h1>{currentModuleName}</h1>
          </div>
          <div className="top-actions">
            <div className="account-chip">
              <span>{activeUser.displayName}</span>
              <strong>{roles[activeUser.role]}</strong>
            </div>
            <label className="search-box">
              <Search size={17} />
              <input placeholder="搜索项目、任务、合同" />
            </label>
            <button className="text-button" onClick={() => setSession(null)}>
              退出
            </button>
            <button className="icon-button notification-button" aria-label="通知" onClick={() => setShowNotifications((value) => !value)}>
              <Bell size={18} />
              {notificationCount > 0 ? <span>{notificationCount}</span> : null}
            </button>
          </div>
        </header>

        {showNotifications ? <NotificationDrawer notifications={workbench?.notifications ?? []} isLoading={isWorkbenchLoading} /> : null}

        {!activeModuleAllowed ? (
          <NoPermissionView moduleName={currentModuleName} />
        ) : currentModule === "dashboard" ? (
          <DashboardView
            activeUser={activeUser}
            canOpenSettings={canOpenSettings}
            dataOrganizations={dataOrganizations}
            error={workError}
            isLoading={isWorkbenchLoading}
            onOpenApprovals={() => setActiveModule("approvals")}
            onOpenWorkbench={() => setActiveModule("workbench")}
            permissions={session.permissions}
            visibleModuleCount={visibleModules.length}
            workbench={workbench}
          />
        ) : currentModule === "workbench" ? (
          <WorkbenchView
            error={workError}
            isLoading={isWorkbenchLoading}
            onOpenModule={setActiveModule}
            workbench={workbench}
          />
        ) : currentModule === "projects" || currentModule === "tasks" ? (
          <ProjectTaskView
            activeUser={activeUser}
            canCreateProject={session.permissions.operation.includes("create_project")}
            canCreateTask={session.permissions.operation.includes("create_task")}
            canUploadFile={session.permissions.file.includes("upload")}
            error={workError}
            fileContent={fileContent}
            fileError={fileError}
            fileName={fileName}
            filePreview={filePreview}
            files={projectFiles}
            isFileLoading={isFileLoading}
            isLoading={isWorkLoading}
            onAddMember={() => {
              void addMemberToSelectedProject().catch((error) => {
                setWorkError(error instanceof Error ? error.message : "添加成员失败");
              });
            }}
            onArchiveFile={(file) => {
              void archiveProjectFile(file).catch((error) => {
                setFileError(error instanceof Error ? error.message : "文件归档失败");
              });
            }}
            onCreateProject={() => {
              void createProject().catch((error) => {
                setWorkError(error instanceof Error ? error.message : "创建项目失败");
              });
            }}
            onCreateTask={() => {
              void createTask().catch((error) => {
                setWorkError(error instanceof Error ? error.message : "创建任务失败");
              });
            }}
            onDownloadFile={(file) => {
              void downloadProjectFile(file).catch((error) => {
                setFileError(error instanceof Error ? error.message : "文件下载失败");
              });
            }}
            onPreviewFile={(file) => {
              void previewProjectFile(file).catch((error) => {
                setFileError(error instanceof Error ? error.message : "文件预览失败");
              });
            }}
            onProjectStatusChange={(project, status) => {
              void changeProjectStatus(project, status).catch((error) => {
                setWorkError(error instanceof Error ? error.message : "项目状态变更失败");
              });
            }}
            onSelectProject={setSelectedProjectId}
            onTaskStatusChange={(task, status) => {
              void changeTaskStatus(task, status).catch((error) => {
                setWorkError(error instanceof Error ? error.message : "任务状态变更失败");
              });
            }}
            onUploadFile={() => {
              void uploadProjectFile().catch((error) => {
                setFileError(error instanceof Error ? error.message : "文件上传失败");
              });
            }}
            projectTitle={projectTitle}
            projects={projects}
            selectedProjectId={selectedProjectId}
            setFileContent={setFileContent}
            setFileName={setFileName}
            setProjectTitle={setProjectTitle}
            setTaskTitle={setTaskTitle}
            taskTitle={taskTitle}
            tasks={tasks}
          />
        ) : currentModule === "chat" ? (
          <ChatView
            activeUser={activeUser}
            aiDrafts={aiDrafts}
            aiFailure={aiFailure}
            canConfirmKnowledge={session.permissions.ai.includes("knowledge_query")}
            canConfirmTask={session.permissions.operation.includes("create_task") && projects.length > 0}
            chatMessage={chatMessage}
            chatTitle={chatTitle}
            error={chatError}
            isAiGenerating={isAiGenerating}
            isLoading={isChatLoading}
            messages={chatMessages}
            onCreateDraft={(kind) => {
              void createAiDraft(kind).catch((error) => {
                setChatError(error instanceof Error ? error.message : "AI 草稿生成失败");
              });
            }}
            onConfirmDraft={(draft) => {
              void confirmAiDraft(draft).catch((error) => {
                setChatError(error instanceof Error ? error.message : "AI 草稿确认失败");
              });
            }}
            onCreateThread={() => {
              void createChatThread().catch((error) => {
                setChatError(error instanceof Error ? error.message : "创建会话失败");
              });
            }}
            onSelectThread={(threadId) => {
              setSelectedThreadId(threadId);
              void refreshChatData(threadId).catch((error) => {
                setChatError(error instanceof Error ? error.message : "会话加载失败");
              });
            }}
            onSendMessage={() => {
              void sendChatMessage().catch((error) => {
                setChatError(error instanceof Error ? error.message : "发送消息失败");
              });
            }}
            selectedThreadId={selectedThreadId}
            setChatMessage={setChatMessage}
            setChatTitle={setChatTitle}
            threads={chatThreads}
          />
        ) : currentModule === "knowledge" ? (
          <KnowledgeView
            canReviewKnowledge={session.permissions.operation.includes("publish_knowledge")}
            error={knowledgeError}
            isLoading={isKnowledgeLoading}
            knowledgeItems={knowledgeItems}
            knowledgeQuery={knowledgeQuery}
            onQuery={() => {
              void queryKnowledge().catch((error) => {
                setKnowledgeError(error instanceof Error ? error.message : "知识检索失败");
              });
            }}
            projectMemories={projectMemories}
            queryProject={projects.find((project) => project.id === selectedProjectId) ?? null}
            queryResults={knowledgeResults}
            onArchiveKnowledge={(item) => {
              void archiveKnowledgeItem(item).catch((error) => {
                setKnowledgeError(error instanceof Error ? error.message : "知识归档失败");
              });
            }}
            onPublishKnowledge={(item) => {
              void publishKnowledgeItem(item).catch((error) => {
                setKnowledgeError(error instanceof Error ? error.message : "知识发布失败");
              });
            }}
            onRejectKnowledge={(item) => {
              void rejectKnowledgeItem(item).catch((error) => {
                setKnowledgeError(error instanceof Error ? error.message : "知识驳回失败");
              });
            }}
            setKnowledgeQuery={setKnowledgeQuery}
          />
        ) : currentModule === "settings" && canOpenSettings ? (
          <SettingsView
            activeUser={activeUser}
            pageStates={workbench?.pageStates ?? []}
            permissions={session.permissions}
            visibleModuleCount={visibleModules.length}
          />
        ) : (
          <ModuleStatusView moduleKey={currentModule} moduleName={currentModuleName} pageStates={workbench?.pageStates ?? []} />
        )}
      </main>
    </div>
  );
}

function DashboardView({
  activeUser,
  canOpenSettings,
  dataOrganizations,
  error,
  isLoading,
  onOpenApprovals,
  onOpenWorkbench,
  permissions,
  visibleModuleCount,
  workbench
}: {
  activeUser: PublicUser;
  canOpenSettings: boolean;
  dataOrganizations: Organization[];
  error: string | null;
  isLoading: boolean;
  onOpenApprovals: () => void;
  onOpenWorkbench: () => void;
  permissions: PermissionSummary;
  visibleModuleCount: number;
  workbench: WorkbenchResponse | null;
}) {
  const summary = workbench?.summary;

  return (
    <>
      <section className="metric-grid" aria-label="核心指标">
        <MetricCard title="我的待办" value={String(summary?.pendingWorkCount ?? 0)} helper="任务处理与人工确认" />
        <MetricCard title="AI 待确认" value={String(summary?.aiResultConfirmationCount ?? 0)} helper="草稿不能自动入库" />
        <MetricCard title="参与项目" value={String(summary?.participatingProjectCount ?? 0)} helper="按数据权限裁剪" />
        <MetricCard title="通知" value={String(summary?.notificationCount ?? 0)} helper="仅系统内通知" />
      </section>

      <PageStateNotice state="loading" title="正在加载首页工作入口" body="工作台、项目、任务、聊天和知识数据正在通过 API 读取。" active={isLoading} />
      <PageStateNotice state="error" title="首页数据加载失败" body={error ?? ""} active={Boolean(error)} />

      <section className="content-grid">
        <div className="panel work-panel">
          <div className="panel-header">
            <div>
              <h2>今日工作入口</h2>
              <p>{activeUser.displayName} 的首页只展示当前账号有权限访问的工作。</p>
            </div>
            <button className="secondary-button" onClick={onOpenWorkbench}>
              <LayoutDashboard size={17} />
              打开工作台
            </button>
          </div>
          <WorkbenchSection
            emptyText="当前没有待处理工作。"
            items={workbench?.sections.pendingWork ?? []}
            title="我的待办"
          />
          <WorkbenchSection
            emptyText="当前没有 AI 结果待人工确认。"
            items={workbench?.sections.aiConfirmations ?? []}
            title="AI 结果确认"
          />
          <div className="action-row section-actions">
            <button className="secondary-button" onClick={onOpenApprovals}>
              <ClipboardList size={17} />
              查看审批状态
            </button>
          </div>
        </div>

        <BoundaryPanel />
        <OrganizationPanel dataOrganizations={dataOrganizations} />
        <PermissionPanel permissions={permissions} />
        <AuditPreviewPanel />

        {canOpenSettings ? (
          <SettingsView
            activeUser={activeUser}
            pageStates={workbench?.pageStates ?? []}
            permissions={permissions}
            visibleModuleCount={visibleModuleCount}
          />
        ) : null}
      </section>
    </>
  );
}

function WorkbenchView({
  error,
  isLoading,
  onOpenModule,
  workbench
}: {
  error: string | null;
  isLoading: boolean;
  onOpenModule: (module: ModuleKey) => void;
  workbench: WorkbenchResponse | null;
}) {
  const summary = workbench?.summary;

  return (
    <>
      <section className="metric-grid" aria-label="工作台指标">
        <MetricCard title="我的待办" value={String(summary?.pendingWorkCount ?? 0)} helper="待提交 / 待确认" />
        <MetricCard title="我负责的任务" value={String(summary?.responsibleTaskCount ?? 0)} helper="未完成任务" />
        <MetricCard title="我参与的项目" value={String(summary?.participatingProjectCount ?? 0)} helper="未归档项目" />
        <MetricCard title="待审批 / 合同" value={`${summary?.pendingApprovalCount ?? 0}/${summary?.contractConfirmationCount ?? 0}`} helper="后续阶段接入实例" />
      </section>

      <PageStateNotice state="loading" title="正在加载我的工作台" body="正在从 API 读取本人工作入口。" active={isLoading} />
      <PageStateNotice state="error" title="工作台加载失败" body={error ?? ""} active={Boolean(error)} />
      <PageStateNotice
        state="empty"
        title="当前没有待处理事项"
        body="工作台不会编造审批、合同或任务数据；有权限数据产生后会显示在这里。"
        active={!isLoading && !error && Boolean(workbench) && (summary?.pendingWorkCount ?? 0) === 0 && (summary?.aiResultConfirmationCount ?? 0) === 0}
      />

      <section className="workbench-layout">
        <div className="panel work-panel">
          <div className="panel-header">
            <div>
              <h2>我的工作</h2>
              <p>任务、确认和 AI 结果都要求人工处理，AI 不会自动执行正式动作。</p>
            </div>
          </div>
          <WorkbenchSection title="我的待办" items={workbench?.sections.pendingWork ?? []} emptyText="暂无待办任务或确认项。" />
          <WorkbenchSection title="我负责的任务" items={workbench?.sections.responsibleTasks ?? []} emptyText="暂无负责中的任务。" />
          <WorkbenchSection title="待确认 AI 结果" items={workbench?.sections.aiConfirmations ?? []} emptyText="暂无 AI 草稿待确认。" />
        </div>

        <div className="panel">
          <div className="panel-header compact">
            <div>
              <h2>参与项目</h2>
              <p>归档项目不进入主列表。</p>
            </div>
            <button className="secondary-button compact-button" onClick={() => onOpenModule("projects")}>
              打开项目
            </button>
          </div>
          <WorkbenchSection title="项目" items={workbench?.sections.participatingProjects ?? []} emptyText="暂无参与项目。" />
        </div>

        <div className="panel">
          <div className="panel-header compact">
            <div>
              <h2>审批与合同</h2>
              <p>当前只展示状态和权限入口，不实现完整流程。</p>
            </div>
          </div>
          <WorkbenchSection title="我待审批" items={workbench?.sections.pendingApprovals ?? []} emptyText="暂无当前节点审批。" />
          <WorkbenchSection title="待确认合同" items={workbench?.sections.contractConfirmations ?? []} emptyText="暂无合同确认项。" />
        </div>

        <div className="panel state-panel">
          <div className="panel-header compact">
            <div>
              <h2>页面状态</h2>
              <p>核心页面按统一状态展示。</p>
            </div>
          </div>
          <PageStateGrid states={workbench?.pageStates ?? []} />
        </div>
      </section>
    </>
  );
}

function WorkbenchSection({ title, items, emptyText }: { title: string; items: WorkbenchItem[]; emptyText: string }) {
  return (
    <div className="workbench-section">
      <div className="section-title">
        <strong>{title}</strong>
        <span>{items.length}</span>
      </div>
      <div className="record-list">
        {items.length > 0 ? (
          items.map((item) => (
            <div className="workbench-row" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </div>
              <span className="status-pill">{item.status}</span>
              <span className="count-pill">{platformModules.find((module) => module.key === item.module)?.name ?? item.module}</span>
            </div>
          ))
        ) : (
          <div className="empty-state">{emptyText}</div>
        )}
      </div>
    </div>
  );
}

function NotificationDrawer({
  isLoading,
  notifications
}: {
  isLoading: boolean;
  notifications: WorkbenchNotification[];
}) {
  return (
    <section className="notification-drawer" aria-label="系统内通知">
      <div className="panel-header compact">
        <div>
          <h2>系统内通知</h2>
          <p>覆盖待办、审批、合同确认、AI 结果、无权限和系统状态。</p>
        </div>
      </div>
      {isLoading ? <PageStateNotice active state="loading" title="正在加载通知" body="通知来自当前会话权限范围。" /> : null}
      <div className="notification-list">
        {notifications.length > 0 ? (
          notifications.map((item) => {
            const Icon = notificationIcon(item.type);
            return (
              <article className={`notification-item ${item.severity}`} key={item.id}>
                <Icon size={18} />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
                <span>{platformModules.find((module) => module.key === item.module)?.name ?? item.module}</span>
              </article>
            );
          })
        ) : (
          <div className="empty-state">暂无系统内通知。</div>
        )}
      </div>
    </section>
  );
}

function notificationIcon(type: WorkbenchNotification["type"]) {
  if (type === "pending_work") {
    return CheckSquare;
  }

  if (type === "approval") {
    return ClipboardList;
  }

  if (type === "contract_confirmation") {
    return FileText;
  }

  if (type === "ai_result") {
    return Brain;
  }

  if (type === "no_permission") {
    return Lock;
  }

  return Bell;
}

function PageStateNotice({
  active,
  body,
  state,
  title
}: {
  active: boolean;
  body: string;
  state: PageStateDescriptor["key"];
  title: string;
}) {
  if (!active) {
    return null;
  }

  const Icon =
    state === "loading" || state === "AI_Generating"
      ? LoaderCircle
      : state === "error" || state === "AI_Failed"
        ? XCircle
        : state === "no-permission"
          ? Lock
          : state === "archived"
            ? Archive
            : state === "expired"
              ? Clock
              : state === "empty"
                ? Inbox
                : AlertTriangle;

  return (
    <div className={`state-notice state-${state}`}>
      <Icon size={18} />
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
    </div>
  );
}

function PageStateGrid({ states }: { states: PageStateDescriptor[] }) {
  if (states.length === 0) {
    return null;
  }

  return (
    <div className="state-grid">
      {states.map((state) => (
        <div className={`state-chip ${state.status}`} key={state.key}>
          <strong>{state.label}</strong>
          <span>{state.evidence}</span>
        </div>
      ))}
    </div>
  );
}

function NoPermissionView({ moduleName }: { moduleName: string }) {
  return (
    <section className="module-status">
      <div className="panel module-status-panel">
        <PageStateNotice active state="no-permission" title="无权限访问" body={`${moduleName} 不在当前账号的菜单权限内。`} />
        <p className="eyebrow">权限裁剪</p>
        <h2>{moduleName}</h2>
        <p>系统不会通过前端隐藏代替后端校验；无权限访问由 API 返回拒绝并写入审计。</p>
      </div>
    </section>
  );
}

function BoundaryPanel() {
  return (
    <aside className="panel guard-panel">
      <div className="panel-header compact">
        <div>
          <h2>权限边界</h2>
          <p>系统管理员可配置系统，但不默认拥有全部业务数据。</p>
        </div>
        <ShieldCheck size={22} />
      </div>
      <ul className="guard-list">
        <li>审批必须人工完成</li>
        <li>配置入口仅管理员角色可见</li>
        <li>业务数据按授权范围裁剪</li>
        <li>文件和 AI 必须继承来源对象权限</li>
      </ul>
    </aside>
  );
}

function OrganizationPanel({ dataOrganizations }: { dataOrganizations: Organization[] }) {
  return (
    <div className="panel">
      <div className="panel-header compact">
        <div>
          <h2>组织与角色</h2>
          <p>当前账号只能看到被授权的组织范围。</p>
        </div>
        <Users size={22} />
      </div>
      <div className="role-strip">
        {dataOrganizations.length > 0 ? (
          dataOrganizations.map((organization) => <span key={organization.id}>{organization.name}</span>)
        ) : (
          <span>仅本人相关数据</span>
        )}
      </div>
    </div>
  );
}

function PermissionPanel({ permissions }: { permissions: PermissionSummary }) {
  return (
    <div className="panel">
      <div className="panel-header compact">
        <div>
          <h2>权限摘要</h2>
          <p>来自 API 会话上下文，前端只负责展示与裁剪。</p>
        </div>
        <ShieldCheck size={22} />
      </div>
      <div className="permission-stack">
        <span>操作权限：{permissions.operation.length}</span>
        <span>审批权限：{permissions.approval.length}</span>
        <span>文件权限：{permissions.file.length}</span>
        <span>AI 权限：{permissions.ai.length}</span>
      </div>
    </div>
  );
}

function AuditPreviewPanel() {
  return (
    <div className="panel">
      <div className="panel-header compact">
        <div>
          <h2>审计边界</h2>
          <p>这里只展示审计能力边界，不展示模拟业务审计事实。</p>
        </div>
      </div>
      <ol className="audit-list">
        {auditReadinessItems.map((event) => (
          <li key={event}>{event}</li>
        ))}
      </ol>
    </div>
  );
}

function SettingsView({
  activeUser,
  pageStates,
  permissions,
  visibleModuleCount
}: {
  activeUser: PublicUser;
  pageStates: PageStateDescriptor[];
  permissions: PermissionSummary;
  visibleModuleCount: number;
}) {
  return (
    <div className="panel settings-panel">
      <div className="panel-header compact">
        <div>
          <h2>系统设置</h2>
          <p>组织、角色、菜单、操作、文件和 AI 权限进入统一策略。</p>
        </div>
        <Settings size={22} />
      </div>
      <div className="settings-grid">
        <SettingsItem title="组织管理" value={`${seedOrganizations.length} 个组织`} enabled={canManageOrganizations(activeUser.role)} />
        <SettingsItem title="角色管理" value={`${Object.keys(rolePolicies).length} 个角色`} enabled={canManageRoles(activeUser.role)} />
        <SettingsItem title="菜单权限" value={`${visibleModuleCount} 个可见菜单`} enabled />
        <SettingsItem title="操作权限" value={`${permissions.operation.length} 项`} enabled />
        <SettingsItem title="审批权限" value={`${permissions.approval.length} 项`} enabled />
        <SettingsItem title="文件权限" value={`${permissions.file.length} 项`} enabled />
        <SettingsItem title="AI 权限" value={`${permissions.ai.length} 项`} enabled />
        <SettingsItem title="数据范围" value={permissions.data.scope} enabled />
        <SettingsItem title="策略版本" value={permissions.policyVersion} enabled />
      </div>
      <PageStateGrid states={pageStates} />
    </div>
  );
}

function ProjectTaskView({
  activeUser,
  canCreateProject,
  canCreateTask,
  canUploadFile,
  error,
  fileContent,
  fileError,
  fileName,
  filePreview,
  files,
  isFileLoading,
  isLoading,
  onAddMember,
  onArchiveFile,
  onCreateProject,
  onCreateTask,
  onDownloadFile,
  onPreviewFile,
  onProjectStatusChange,
  onSelectProject,
  onTaskStatusChange,
  onUploadFile,
  projectTitle,
  projects,
  selectedProjectId,
  setFileContent,
  setFileName,
  setProjectTitle,
  setTaskTitle,
  taskTitle,
  tasks
}: {
  activeUser: PublicUser;
  canCreateProject: boolean;
  canCreateTask: boolean;
  canUploadFile: boolean;
  error: string | null;
  fileContent: string;
  fileError: string | null;
  fileName: string;
  filePreview: FilePreviewState | null;
  files: FileAssetRecord[];
  isFileLoading: boolean;
  isLoading: boolean;
  onAddMember: () => void;
  onArchiveFile: (file: FileAssetRecord) => void;
  onCreateProject: () => void;
  onCreateTask: () => void;
  onDownloadFile: (file: FileAssetRecord) => void;
  onPreviewFile: (file: FileAssetRecord) => void;
  onProjectStatusChange: (project: ProjectSummary, status: ProjectRecord["status"]) => void;
  onSelectProject: (projectId: string) => void;
  onTaskStatusChange: (task: TaskRecord, status: TaskRecord["status"]) => void;
  onUploadFile: () => void;
  projectTitle: string;
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  setFileContent: (value: string) => void;
  setFileName: (value: string) => void;
  setProjectTitle: (value: string) => void;
  setTaskTitle: (value: string) => void;
  taskTitle: string;
  tasks: TaskRecord[];
}) {
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null;
  const selectedTasks = selectedProject ? tasks.filter((task) => task.projectId === selectedProject.id) : [];
  const canManageSelectedProject = selectedProject?.ownerUserId === activeUser.id || activeUser.role === "super_admin";

  return (
    <section className="project-workspace">
      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">DEV-005 真实数据</p>
            <h2>项目</h2>
            <p>项目是协作容器，成员、任务和状态都会进入审计。</p>
          </div>
        </div>
        <PageStateNotice state="loading" title="正在加载项目" body="正在读取当前账号可见项目。" active={isLoading} />
        {error ? <p className="inline-error">{error}</p> : null}
        {canCreateProject ? (
          <div className="inline-form">
            <input value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} placeholder="项目名称" />
            <button className="primary-button" onClick={onCreateProject}>
              创建项目
            </button>
          </div>
        ) : null}
        <div className="record-list">
          {projects.length > 0 ? (
            projects.map((project) => (
              <button
                className={selectedProject?.id === project.id ? "record-row active" : "record-row"}
                key={project.id}
                onClick={() => onSelectProject(project.id)}
              >
                <span>
                  <strong>{project.title}</strong>
                  <small>{organizationName(project.organizationId)} · {userName(project.ownerUserId)}</small>
                </span>
                <span className="status-pill">{project.status}</span>
                <span className="count-pill">{project.taskCount} 任务</span>
              </button>
            ))
          ) : (
            <PageStateNotice active={!isLoading} state="empty" title="当前没有可见项目" body="没有权限或没有参与项目时不会显示业务数据。" />
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">项目详情</p>
            <h2>{selectedProject?.title ?? "未选择项目"}</h2>
            <p>{selectedProject?.summary ?? "选择项目后查看成员、任务和状态。"}</p>
          </div>
          {selectedProject ? <span className="status-pill strong">{selectedProject.status}</span> : null}
        </div>
        {selectedProject ? (
          <>
            <PageStateNotice
              active={selectedProject.status === "archived"}
              state="archived"
              title="项目已归档"
              body="归档项目默认不进入项目主列表。"
            />
            <div className="detail-grid">
              <SettingsItem title="所属组织" value={organizationName(selectedProject.organizationId)} enabled />
              <SettingsItem title="负责人" value={userName(selectedProject.ownerUserId)} enabled />
              <SettingsItem title="成员数" value={`${selectedProject.memberUserIds.length} 人`} enabled />
              <SettingsItem title="任务数" value={`${selectedTasks.length} 个`} enabled />
            </div>
            <div className="member-strip">
              {selectedProject.memberUserIds.map((userId) => (
                <span key={userId}>{userName(userId)}</span>
              ))}
            </div>
            <div className="action-row">
              {canManageSelectedProject && !selectedProject.memberUserIds.includes("user-member") ? (
                <button className="secondary-button" onClick={onAddMember}>
                  添加普通成员
                </button>
              ) : null}
              {selectedProject.status === "active" ? (
                <button className="secondary-button" onClick={() => onProjectStatusChange(selectedProject, "completed")}>
                  完成项目
                </button>
              ) : null}
              {selectedProject.status === "completed" ? (
                <button className="secondary-button" onClick={() => onProjectStatusChange(selectedProject, "archived")}>
                  归档项目
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      <ProjectFilePanel
        canUploadFile={canUploadFile}
        fileContent={fileContent}
        fileError={fileError}
        fileName={fileName}
        filePreview={filePreview}
        files={files}
        isFileLoading={isFileLoading}
        onArchiveFile={onArchiveFile}
        onDownloadFile={onDownloadFile}
        onPreviewFile={onPreviewFile}
        onUploadFile={onUploadFile}
        selectedProject={selectedProject}
        setFileContent={setFileContent}
        setFileName={setFileName}
      />

      <div className="panel project-task-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">任务</p>
            <h2>任务列表</h2>
            <p>负责人提交完成后，必须由确认人或项目负责人确认。</p>
          </div>
        </div>
        {canCreateTask && selectedProject ? (
          <div className="inline-form">
            <input value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} placeholder="任务名称" />
            <button className="primary-button" onClick={onCreateTask}>
              创建任务
            </button>
          </div>
        ) : null}
        <div className="task-table">
          <div className="task-row task-head">
            <span>任务</span>
            <span>负责人</span>
            <span>确认人</span>
            <span>状态</span>
            <span>操作</span>
          </div>
          {selectedTasks.length > 0 ? (
            selectedTasks.map((task) => (
              <div className="task-row" key={task.id}>
                <span>
                  <strong>{task.title}</strong>
                  <small>{task.description}</small>
                </span>
                <span>{userName(task.assigneeUserId)}</span>
                <span>{userName(task.confirmerUserId)}</span>
                <span className="status-pill">{task.status}</span>
                <span className="task-actions">{taskActionButtons(task, onTaskStatusChange)}</span>
              </div>
            ))
          ) : (
            <PageStateNotice active={!isLoading} state="empty" title="当前项目没有任务" body="创建任务后会进入任务列表和工作台待办。" />
          )}
        </div>
      </div>
    </section>
  );
}

function ProjectFilePanel({
  canUploadFile,
  fileContent,
  fileError,
  fileName,
  filePreview,
  files,
  isFileLoading,
  onArchiveFile,
  onDownloadFile,
  onPreviewFile,
  onUploadFile,
  selectedProject,
  setFileContent,
  setFileName
}: {
  canUploadFile: boolean;
  fileContent: string;
  fileError: string | null;
  fileName: string;
  filePreview: FilePreviewState | null;
  files: FileAssetRecord[];
  isFileLoading: boolean;
  onArchiveFile: (file: FileAssetRecord) => void;
  onDownloadFile: (file: FileAssetRecord) => void;
  onPreviewFile: (file: FileAssetRecord) => void;
  onUploadFile: () => void;
  selectedProject: ProjectSummary | null;
  setFileContent: (value: string) => void;
  setFileName: (value: string) => void;
}) {
  return (
    <div className="panel project-file-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">DEV-012 文件</p>
          <h2>项目附件</h2>
          <p>文件绑定当前项目，预览、下载、归档和 AI 引用都继承项目权限。</p>
        </div>
        <FileText size={22} />
      </div>
      <PageStateNotice state="loading" title="正在加载文件" body="正在读取当前项目绑定的文件元数据。" active={isFileLoading} />
      <PageStateNotice state="error" title="文件操作失败" body={fileError ?? ""} active={Boolean(fileError)} />
      <PageStateNotice
        state="no-permission"
        title="无文件上传权限"
        body="当前账号只能查看有权限的文件；上传控件按后端文件权限裁剪。"
        active={Boolean(selectedProject) && !canUploadFile}
      />
      {selectedProject && canUploadFile ? (
        <div className="file-upload-box">
          <input value={fileName} onChange={(event) => setFileName(event.target.value)} placeholder="文件名" />
          <input value={fileContent} onChange={(event) => setFileContent(event.target.value)} placeholder="文件内容" />
          <button className="primary-button" onClick={onUploadFile}>
            <Upload size={16} />
            上传
          </button>
        </div>
      ) : null}
      <div className="file-list">
        {files.length > 0 ? (
          files.map((file) => (
            <article className={file.status === "archived" ? "file-row archived" : "file-row"} key={file.id}>
              <div>
                <strong>{file.displayName}</strong>
                <small>
                  {file.mimeType} · {file.sizeBytes} bytes · 版本历史 v1 当前
                </small>
              </div>
              <span className="status-pill">{file.status}</span>
              <div className="file-actions">
                <button className="icon-button" disabled={file.status === "archived"} onClick={() => onPreviewFile(file)} title="预览">
                  <Eye size={16} />
                </button>
                <button className="icon-button" disabled={file.status === "archived"} onClick={() => onDownloadFile(file)} title="下载">
                  <Download size={16} />
                </button>
                <button className="secondary-button compact-button" disabled={file.status === "archived"} onClick={() => onArchiveFile(file)}>
                  归档
                </button>
              </div>
              {filePreview?.fileId === file.id ? (
                <div className="file-preview">
                  <strong>预览 / 版本 v{filePreview.versionNumber}</strong>
                  <p>{filePreview.previewText}</p>
                </div>
              ) : null}
              <PageStateNotice
                state="archived"
                title="文件已归档"
                body="归档文件不允许继续预览或下载；审计记录保留。"
                active={file.status === "archived"}
              />
            </article>
          ))
        ) : (
          <PageStateNotice active={!isFileLoading && Boolean(selectedProject)} state="empty" title="当前项目没有文件" body="上传后会创建文件元数据、版本记录和项目绑定。" />
        )}
      </div>
    </div>
  );
}

function organizationName(organizationId: string) {
  return seedOrganizations.find((organization) => organization.id === organizationId)?.name ?? organizationId;
}

function userName(userId: string) {
  return seedUsers.find((user) => user.id === userId)?.displayName ?? userId;
}

function taskActionButtons(task: TaskRecord, onTaskStatusChange: (task: TaskRecord, status: TaskRecord["status"]) => void) {
  if (task.status === "todo") {
    return (
      <button className="secondary-button compact-button" onClick={() => onTaskStatusChange(task, "in_progress")}>
        开始
      </button>
    );
  }

  if (task.status === "in_progress") {
    return (
      <button className="secondary-button compact-button" onClick={() => onTaskStatusChange(task, "submitted")}>
        提交
      </button>
    );
  }

  if (task.status === "submitted") {
    return (
      <button className="secondary-button compact-button" onClick={() => onTaskStatusChange(task, "completed")}>
        确认
      </button>
    );
  }

  return <span className="muted-text">无</span>;
}

function ChatView({
  activeUser,
  aiDrafts,
  aiFailure,
  canConfirmKnowledge,
  canConfirmTask,
  chatMessage,
  chatTitle,
  error,
  isAiGenerating,
  isLoading,
  messages,
  onCreateDraft,
  onConfirmDraft,
  onCreateThread,
  onSelectThread,
  onSendMessage,
  selectedThreadId,
  setChatMessage,
  setChatTitle,
  threads
}: {
  activeUser: PublicUser;
  aiDrafts: AiDraftRecord[];
  aiFailure: string | null;
  canConfirmKnowledge: boolean;
  canConfirmTask: boolean;
  chatMessage: string;
  chatTitle: string;
  error: string | null;
  isAiGenerating: boolean;
  isLoading: boolean;
  messages: ChatMessageRecord[];
  onCreateDraft: (kind: AiDraftRecord["kind"]) => void;
  onConfirmDraft: (draft: AiDraftRecord) => void;
  onCreateThread: () => void;
  onSelectThread: (threadId: string) => void;
  onSendMessage: () => void;
  selectedThreadId: string | null;
  setChatMessage: (value: string) => void;
  setChatTitle: (value: string) => void;
  threads: ChatThreadSummary[];
}) {
  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) ?? threads[0] ?? null;
  const selectedDrafts = selectedThread ? aiDrafts.filter((draft) => draft.threadId === selectedThread.id) : [];
  const canConfirmDraft = (draft: AiDraftRecord) =>
    draft.status === "draft" &&
    (draft.kind === "chat_summary" || (draft.kind === "task_draft" && canConfirmTask) || (draft.kind === "knowledge_draft" && canConfirmKnowledge));

  return (
    <section className="project-workspace">
      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">DEV-008 真实数据</p>
            <h2>聊天会话</h2>
            <p>会话只对成员可见，AI 只能整理和生成草稿。</p>
          </div>
        </div>
        <PageStateNotice state="loading" title="正在加载会话" body="正在读取当前账号参与的聊天。" active={isLoading} />
        {error ? <p className="inline-error">{error}</p> : null}
        <div className="inline-form">
          <input value={chatTitle} onChange={(event) => setChatTitle(event.target.value)} placeholder="会话名称" />
          <button className="primary-button" onClick={onCreateThread}>
            创建会话
          </button>
        </div>
        <div className="record-list">
          {threads.length > 0 ? (
            threads.map((thread) => (
              <button
                className={selectedThread?.id === thread.id ? "record-row active" : "record-row"}
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
              >
                <span>
                  <strong>{thread.title}</strong>
                  <small>{organizationName(thread.organizationId)} · {thread.memberUserIds.length} 成员</small>
                </span>
                <span className="status-pill">{thread.status}</span>
                <span className="count-pill">{thread.messageCount} 消息</span>
              </button>
            ))
          ) : (
            <PageStateNotice active={!isLoading} state="empty" title="当前没有可见会话" body="只有会话成员才能读取聊天内容。" />
          )}
        </div>
      </div>

      <div className="panel project-task-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">会话消息</p>
            <h2>{selectedThread?.title ?? "未选择会话"}</h2>
            <p>AI 整理必须引用消息来源，不能删除原始消息。</p>
          </div>
        </div>
        {selectedThread ? (
          <>
            <div className="inline-form">
              <input value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} placeholder="输入工作消息" />
              <button className="primary-button" onClick={onSendMessage}>
                发送
              </button>
            </div>
            <div className="task-table">
              <div className="task-row task-head">
                <span>发送人</span>
                <span>内容</span>
                <span>状态</span>
                <span>时间</span>
                <span>来源</span>
              </div>
              {messages.length > 0 ? (
                messages.map((message) => (
                  <div className="task-row" key={message.id}>
                    <span>{userName(message.senderUserId)}</span>
                    <span>
                      <strong>{message.content}</strong>
                    </span>
                    <span className="status-pill">{message.status}</span>
                    <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
                    <span className="muted-text">原始消息</span>
                  </div>
                ))
              ) : (
                <PageStateNotice active={!isLoading} state="empty" title="当前会话没有消息" body="发送消息后才能生成 AI 草稿。" />
              )}
            </div>
          </>
        ) : null}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">AI 边界</p>
            <h2>整理与草稿</h2>
            <p>当前用户：{activeUser.displayName}。AI 输出必须人工确认后才能进入正式对象。</p>
          </div>
        </div>
        <div className="action-row">
          <button className="secondary-button" disabled={!selectedThread || messages.length === 0} onClick={() => onCreateDraft("chat_summary")}>
            整理摘要
          </button>
          <button className="secondary-button" disabled={!selectedThread || messages.length === 0} onClick={() => onCreateDraft("task_draft")}>
            任务草稿
          </button>
          <button className="secondary-button" disabled={!selectedThread || messages.length === 0} onClick={() => onCreateDraft("knowledge_draft")}>
            知识草稿
          </button>
        </div>
        <PageStateNotice
          active={isAiGenerating}
          state="AI_Generating"
          title="AI 正在生成草稿"
          body="生成期间不会创建正式任务、知识或项目记忆。"
        />
        <PageStateNotice
          active={Boolean(aiFailure)}
          state="AI_Failed"
          title="AI 生成失败"
          body={aiFailure ?? ""}
        />
        <div className="record-list">
          {selectedDrafts.length > 0 ? (
            selectedDrafts.map((draft) => (
              <div className="record-row" key={draft.id}>
                <span>
                  <strong>{draft.title}</strong>
                  <small>{draft.content}</small>
                </span>
                <span className="status-pill">{draft.kind}</span>
                <span className="status-pill">{draft.status}</span>
                <span className="count-pill">{draft.sourceMessageIds.length} 来源</span>
                <button className="secondary-button compact-button" disabled={!canConfirmDraft(draft)} onClick={() => onConfirmDraft(draft)}>
                  确认入库
                </button>
              </div>
            ))
          ) : (
            <PageStateNotice active={!isLoading && !isAiGenerating} state="empty" title="还没有 AI 草稿" body="先发送消息，再生成需要人工确认的草稿。" />
          )}
        </div>
      </div>
    </section>
  );
}

function KnowledgeView({
  canReviewKnowledge,
  error,
  isLoading,
  knowledgeItems,
  knowledgeQuery,
  onArchiveKnowledge,
  onPublishKnowledge,
  onQuery,
  onRejectKnowledge,
  projectMemories,
  queryProject,
  queryResults,
  setKnowledgeQuery
}: {
  canReviewKnowledge: boolean;
  error: string | null;
  isLoading: boolean;
  knowledgeItems: KnowledgeItemWithVersions[];
  knowledgeQuery: string;
  onArchiveKnowledge: (item: KnowledgeItemWithVersions) => void;
  onPublishKnowledge: (item: KnowledgeItemWithVersions) => void;
  onQuery: () => void;
  onRejectKnowledge: (item: KnowledgeItemWithVersions) => void;
  projectMemories: ProjectMemoryRecord[];
  queryProject: ProjectSummary | null;
  queryResults: KnowledgeSearchResult[];
  setKnowledgeQuery: (value: string) => void;
}) {
  const reviewQueue = knowledgeItems.filter((item) => item.status === "submitted_for_review");
  const publishedItems = knowledgeItems.filter((item) => item.status === "published");

  return (
    <section className="content-grid">
      <div className="panel work-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">DEV-013 本地检索</p>
            <h2>知识与记忆检索</h2>
            <p>检索只返回当前账号有权限读取的已发布知识和项目记忆，每条结果都带来源证据。</p>
          </div>
        </div>
        <PageStateNotice state="loading" title="正在加载知识库" body="正在读取当前账号有权限访问的知识和项目记忆。" active={isLoading} />
        {error ? <p className="inline-error">{error}</p> : null}
        <div className="inline-form knowledge-search">
          <input value={knowledgeQuery} onChange={(event) => setKnowledgeQuery(event.target.value)} placeholder="输入要回读的项目上下文" />
          <button className="primary-button" disabled={knowledgeQuery.trim().length === 0} onClick={onQuery}>
            检索
          </button>
        </div>
        <div className="scope-note">
          <span>当前检索范围</span>
          <strong>{queryProject ? queryProject.title : "全部可见范围"}</strong>
        </div>
        <div className="record-list">
          {queryResults.length > 0 ? (
            queryResults.map((item) => (
              <div className="record-row" key={`${item.type}:${item.id}`}>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.content}</small>
                  <small>
                    证据：{item.sourceEvidence.map((evidence) => `${evidence.sourceType}:${evidence.sourceId}`).join(" / ")}
                  </small>
                </span>
                <span className="status-pill">{item.type}</span>
                <span className="count-pill">{item.relevanceScore} 分</span>
              </div>
            ))
          ) : (
            <PageStateNotice active={!isLoading} state="empty" title="暂无检索结果" body="输入关键词后检索；没有结果时不会编造知识。" />
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">审核队列</p>
            <h2>待审核知识</h2>
            <p>知识管理员人工审核后才能发布；AI 只能把知识草稿提交到这里。</p>
          </div>
        </div>
        <div className="record-list">
          {reviewQueue.length > 0 ? (
            reviewQueue.map((item) => (
              <div className="record-row knowledge-row" key={item.id}>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.content}</small>
                  <small>版本 v{item.currentVersion} · 作者 {userName(item.creatorUserId)} · 提交 {item.submittedAt ? new Date(item.submittedAt).toLocaleString() : "未提交"}</small>
                </span>
                <span className="status-pill">{item.status}</span>
                <span className="count-pill">{item.sourceEvidence.length} 证据</span>
                <div className="file-actions">
                  <button className="secondary-button compact-button" disabled={!canReviewKnowledge} onClick={() => onPublishKnowledge(item)}>
                    发布
                  </button>
                  <button className="secondary-button compact-button" disabled={!canReviewKnowledge} onClick={() => onRejectKnowledge(item)}>
                    驳回
                  </button>
                </div>
              </div>
            ))
          ) : (
            <PageStateNotice active={!isLoading} state="empty" title="暂无待审核知识" body="AI 知识草稿确认后会进入 submitted_for_review，不会自动发布。" />
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">版本与证据</p>
            <h2>知识条目</h2>
            <p>显示 draft / submitted_for_review / published / rejected / archived 状态、版本历史和来源证据。</p>
          </div>
        </div>
        <div className="record-list">
          {knowledgeItems.length > 0 ? (
            knowledgeItems.map((item) => (
              <div className="record-row knowledge-row" key={item.id}>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.content}</small>
                  <small>
                    证据：{item.sourceEvidence.map((evidence) => `${evidence.sourceType}:${evidence.sourceId}`).join(" / ")}
                  </small>
                  <small>
                    版本：{(item.versions ?? []).map((version) => `v${version.version} ${version.status}`).join(" · ") || `v${item.currentVersion}`}
                  </small>
                </span>
                <span className="status-pill">{item.status}</span>
                <span className="count-pill">{item.sourceMessageIds.length} 来源</span>
                <div className="file-actions">
                  <button
                    className="secondary-button compact-button"
                    disabled={!canReviewKnowledge || item.status !== "submitted_for_review"}
                    onClick={() => onPublishKnowledge(item)}
                  >
                    发布
                  </button>
                  <button
                    className="secondary-button compact-button"
                    disabled={!canReviewKnowledge || item.status !== "submitted_for_review"}
                    onClick={() => onRejectKnowledge(item)}
                  >
                    驳回
                  </button>
                  <button
                    className="secondary-button compact-button"
                    disabled={!canReviewKnowledge || item.status === "archived"}
                    onClick={() => onArchiveKnowledge(item)}
                  >
                    归档
                  </button>
                </div>
              </div>
            ))
          ) : (
            <PageStateNotice active={!isLoading} state="empty" title="还没有知识条目" body="请先在聊天中生成知识草稿并人工确认提交审核。" />
          )}
        </div>
        <PageStateNotice
          active={publishedItems.length === 0 && knowledgeItems.length > 0}
          state="no-permission"
          title="没有可检索的已发布知识"
          body="未发布、被驳回或已归档知识不会进入检索、证据或 AI 输入上下文。"
        />
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Memory Spine</p>
            <h2>项目记忆</h2>
            <p>摘要草稿确认后进入项目记忆，用于后续工作前回读上下文。</p>
          </div>
        </div>
        <div className="record-list">
          {projectMemories.length > 0 ? (
            projectMemories.map((item) => (
              <div className="record-row" key={item.id}>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.content}</small>
                </span>
                <span className="status-pill">{item.projectId ?? "无项目"}</span>
                <span className="count-pill">{item.sourceMessageIds.length} 来源</span>
              </div>
            ))
          ) : (
            <PageStateNotice active={!isLoading} state="empty" title="还没有项目记忆" body="请先在聊天中生成摘要并由人工确认入库。" />
          )}
        </div>
      </div>
    </section>
  );
}

function ModuleStatusView({
  moduleKey,
  moduleName,
  pageStates
}: {
  moduleKey: ModuleKey;
  moduleName: string;
  pageStates: PageStateDescriptor[];
}) {
  const status = moduleStatus[moduleKey];

  return (
    <section className="module-status">
      <div className="panel module-status-panel">
        <p className="eyebrow">{status.stage}</p>
        <h2>{moduleName}</h2>
        <p>{status.summary}</p>
        <PageStateNotice
          active={moduleKey === "contracts" || moduleKey === "approvals"}
          state="empty"
          title="暂无可处理实例"
          body="本阶段只展示工作入口、通知和状态，不创建完整合同或审批流程。"
        />
        <PageStateNotice
          active={moduleKey === "contracts"}
          state="expired"
          title="期限状态已预留"
          body="合同期限和执行跟踪将在 DEV-014 接入。"
        />
        <PageStateNotice
          active={moduleKey === "approvals"}
          state="no-permission"
          title="审批必须由当前节点人类处理"
          body="没有当前节点实例时不会显示审批操作按钮，AI 不能成为审批人。"
        />
        {moduleKey === "approvals" ? (
          <div className="stage-checklist">
            <span>审批发起：未开发</span>
            <span>当前节点审批人：未开发</span>
            <span>同意 / 驳回 / 退回：未开发</span>
            <span>AI 建议：未开发且不能自动审批</span>
          </div>
        ) : null}
        <PageStateGrid states={pageStates} />
      </div>
    </section>
  );
}

function LoginScreen({ onLogin }: { onLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);

    try {
      await onLogin(username, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "登录失败");
    }
  }

  return (
    <main className="login-page">
      <section className="login-shell">
        <form
          className="login-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <p className="eyebrow">协同工作平台</p>
          <h1>账号登录</h1>
          <p className="login-copy">输入用户名和密码进入系统。登录必须由 API 签发会话。</p>
          <label className="password-field">
            <span>用户名</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </label>
          <label className="password-field">
            <span>密码</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
            />
          </label>
          {error ? <p className="login-error">{error}</p> : null}
          <button className="primary-button login-submit" type="submit">
            登录
          </button>
        </form>
        <div className="login-policy">
          <h2>访问边界</h2>
          <ul className="guard-list">
            <li>认证由 API 签发会话</li>
            <li>菜单按角色裁剪</li>
            <li>业务数据按授权范围裁剪</li>
            <li>高权限账号不在登录页暴露</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

function MetricCard({ title, value, helper }: { title: string; value: string; helper: string }) {
  return (
    <article className="metric-card">
      <span>{title}</span>
      <strong>{value}</strong>
      <p>{helper}</p>
    </article>
  );
}

function SettingsItem({ title, value, enabled }: { title: string; value: string; enabled: boolean }) {
  return (
    <div className={enabled ? "settings-item" : "settings-item disabled"}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}
