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
  Link,
  MessageSquare,
  Search,
  Settings,
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
  type AiFrameworkRecord,
  type AiFrameworkVersionRecord,
  type AiDraftRecord,
  type AiRunWithDetails,
  type ApprovalWithDetails,
  type ChatMessageRecord,
  type ChatThreadRecord,
  type ContractApprovalHandoffRecord,
  type ContractEntryMethod,
  type ContractExecutionEventRecord,
  type ContractExecutionEventType,
  type ContractOptionKey,
  type ContractRecord,
  type ContractReviewRecord,
  type ContractVersionRecord,
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
  type TaskWithDetails,
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

const sessionStorageKey = "xtgzpt.session.v1";

function readStoredSession(): SessionState | null {
  try {
    const rawSession = window.sessionStorage.getItem(sessionStorageKey);
    if (!rawSession) {
      return null;
    }

    return JSON.parse(rawSession) as SessionState;
  } catch {
    window.sessionStorage.removeItem(sessionStorageKey);
    return null;
  }
}

function writeStoredSession(session: SessionState | null) {
  if (!session) {
    window.sessionStorage.removeItem(sessionStorageKey);
    return;
  }

  window.sessionStorage.setItem(sessionStorageKey, JSON.stringify(session));
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

interface ContractWithDetails extends ContractRecord {
  versions: ContractVersionRecord[];
  reviews: ContractReviewRecord[];
  approvalHandoffs: ContractApprovalHandoffRecord[];
  executionEvents: ContractExecutionEventRecord[];
}

interface AiFrameworkWithVersions extends AiFrameworkRecord {
  versions: AiFrameworkVersionRecord[];
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
    stage: "经营总览",
    summary: "首页按当前角色聚合待办、项目、任务、审批、合同和系统通知。"
  },
  workbench: {
    stage: "个人工作",
    summary: "我的工作台展示本人待办、负责任务、参与项目、AI 待确认结果和系统内通知。"
  },
  projects: {
    stage: "项目协同",
    summary: "项目列表、创建、成员、状态、任务关联和项目附件进入统一工作流。"
  },
  tasks: {
    stage: "任务执行",
    summary: "任务列表、创建、负责人提交和人工确认按项目权限运行。"
  },
  chat: {
    stage: "协作会话",
    summary: "聊天、AI 草稿、人工确认、人工驳回和记忆上下文回用在会话内闭环。"
  },
  knowledge: {
    stage: "知识沉淀",
    summary: "知识草稿、提交审核、发布、驳回、归档、版本历史和来源证据形成可追溯资产。"
  },
  contracts: {
    stage: "合同管理",
    summary: "合同上传或粘贴后进入版本、风险、人工确认、二次审查、审批和执行跟踪流程。"
  },
  approvals: {
    stage: "审批中心",
    summary: "审批实例、当前节点、同意、驳回、退回、转交、加签和结果写回由人类处理。"
  },
  settings: {
    stage: "系统配置",
    summary: "组织、账号、角色、菜单、数据权限、审批权限、文件权限、AI 治理和审计入口集中配置。"
  }
};

const moduleRoutes: Record<ModuleKey, string> = {
  dashboard: "/dashboard",
  workbench: "/dashboard/workbench",
  projects: "/dashboard/projects",
  tasks: "/dashboard/tasks",
  chat: "/dashboard/chat",
  knowledge: "/dashboard/knowledge",
  contracts: "/dashboard/contracts",
  approvals: "/dashboard/approvals",
  settings: "/dashboard/settings"
};

function moduleFromPath(pathname: string): ModuleKey {
  const match = Object.entries(moduleRoutes)
    .sort((first, second) => second[1].length - first[1].length)
    .find(([, route]) => pathname === route || pathname.startsWith(`${route}/`));

  return (match?.[0] as ModuleKey | undefined) ?? "dashboard";
}

const statusLabels: Record<string, string> = {
  active: "进行中",
  archived: "已归档",
  available: "可处理",
  blocked: "已阻塞",
  cancelled: "已取消",
  completed: "已完成",
  confirmed: "已确认",
  disabled: "已停用",
  draft: "草稿",
  edited: "已编辑",
  expired: "已过期",
  in_progress: "进行中",
  info: "提醒",
  not_active: "未启用",
  pending: "待处理",
  processing: "审批中",
  published: "已发布",
  rejected: "已驳回",
  returned: "已退回",
  revision_required: "待修改",
  risk_pending_confirm: "待确认风险",
  sent: "已发送",
  submitted: "待确认",
  submitted_for_review: "待审核",
  todo: "待处理",
  transferred: "已转交",
  withdrawn: "已撤回",
  warning: "风险提醒",
  approval_pending: "待审批",
  execution_tracking: "执行跟踪",
  approved: "已通过",
  adopted: "已采用",
  changed: "已调整",
  ok: "正常",
  AI_Generating: "生成中",
  AI_Failed: "生成失败"
};

const priorityLabels: Record<string, string> = {
  low: "低",
  medium: "普通",
  high: "高",
  urgent: "紧急"
};

const sourceTypeLabels: Record<string, string> = {
  ai_draft: "智能草稿",
  chat_message: "聊天消息",
  project_memory: "项目记忆",
  manual: "人工录入",
  upload: "上传文件",
  paste: "粘贴文本",
  revision: "修改版本"
};

const objectTypeLabels: Record<string, string> = {
  project: "项目",
  task: "任务",
  chat_thread: "会话",
  contract: "合同",
  approval: "审批",
  knowledge_item: "知识",
  project_memory: "项目记忆",
  ai_draft: "智能草稿"
};

const aiDraftKindLabels: Record<string, string> = {
  chat_summary: "会话摘要",
  task_draft: "任务草稿",
  knowledge_draft: "知识草稿"
};

const scenarioLabels: Record<string, string> = {
  chat_summary: "会话摘要",
  task_draft: "任务草稿",
  knowledge_query: "知识检索",
  contract_review: "合同审查",
  approval_suggestion: "审批建议",
  risk_hint: "风险提示",
  read_ai_runs: "运行记录"
};

const entryMethodLabels: Record<string, string> = {
  upload: "上传",
  paste: "粘贴",
  revision: "修改"
};

const executionEventLabels: Record<string, string> = {
  reminder: "提醒",
  milestone: "里程碑",
  note: "记录"
};

const approvalActionLabels: Record<string, string> = {
  approve: "同意",
  reject: "驳回",
  return: "退回",
  transfer: "转交",
  "add-sign": "加签"
};

const resultWritebackLabels: Record<string, string> = {
  "contract.approved": "合同已通过",
  "contract.rejected": "合同已驳回",
  "contract.returned": "合同已退回"
};

const dataScopeLabels: Record<string, string> = {
  all: "全部数据",
  all_organizations: "全部组织",
  assigned_organizations: "授权组织",
  authorized_organizations: "授权组织",
  own_organization: "本组织",
  own_records: "本人相关",
  project_member: "参与项目"
};

function displayStatus(value: string | null | undefined): string {
  if (!value) {
    return "未设置";
  }

  return statusLabels[value] ?? cleanDisplayText(value);
}

function displayPriority(value: string | null | undefined): string {
  if (!value) {
    return "普通";
  }

  return priorityLabels[value] ?? cleanDisplayText(value);
}

function displaySourceType(value: string | null | undefined): string {
  if (!value) {
    return "来源";
  }

  return sourceTypeLabels[value] ?? objectTypeLabels[value] ?? cleanDisplayText(value);
}

function displayAiKind(value: string | null | undefined): string {
  if (!value) {
    return "智能建议";
  }

  return aiDraftKindLabels[value] ?? scenarioLabels[value] ?? cleanDisplayText(value);
}

function displayEntryMethod(value: string | null | undefined): string {
  if (!value) {
    return "未设置";
  }

  return entryMethodLabels[value] ?? displaySourceType(value);
}

function displayApprovalAction(value: string | null | undefined): string {
  if (!value) {
    return "待处理";
  }

  return approvalActionLabels[value] ?? displayStatus(value);
}

function displayResultWriteback(value: string | null | undefined): string {
  if (!value) {
    return "待处理";
  }

  return resultWritebackLabels[value] ?? displayStatus(value);
}

function displayDataScope(value: string | null | undefined): string {
  if (!value) {
    return "未设置";
  }

  return dataScopeLabels[value] ?? cleanDisplayText(value);
}

function displaySourceEvidence(sourceType: string, fallback?: string | null): string {
  return fallback ? `${displaySourceType(sourceType)}：${fallback}` : displaySourceType(sourceType);
}

export function App() {
  const [session, setSession] = useState<SessionState | null>(() => readStoredSession());
  const [activeModule, setActiveModule] = useState<ModuleKey>(() => moduleFromPath(window.location.pathname));
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskComment, setTaskComment] = useState("");
  const [taskView, setTaskView] = useState<"all" | "mine" | "created" | "confirm" | "overdue" | "completed">("all");
  const [chatThreads, setChatThreads] = useState<ChatThreadSummary[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessageRecord[]>([]);
  const [aiDrafts, setAiDrafts] = useState<AiDraftRecord[]>([]);
  const [aiFrameworks, setAiFrameworks] = useState<AiFrameworkWithVersions[]>([]);
  const [aiRuns, setAiRuns] = useState<AiRunWithDetails[]>([]);
  const [workbench, setWorkbench] = useState<WorkbenchResponse | null>(null);
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItemWithVersions[]>([]);
  const [projectMemories, setProjectMemories] = useState<ProjectMemoryRecord[]>([]);
  const [contracts, setContracts] = useState<ContractWithDetails[]>([]);
  const [approvals, setApprovals] = useState<ApprovalWithDetails[]>([]);
  const [projectFiles, setProjectFiles] = useState<FileAssetRecord[]>([]);
  const [filePreview, setFilePreview] = useState<FilePreviewState | null>(null);
  const [knowledgeQuery, setKnowledgeQuery] = useState("");
  const [contractTitle, setContractTitle] = useState("");
  const [contractText, setContractText] = useState("");
  const [contractFileName, setContractFileName] = useState("");
  const [contractEntryMethod, setContractEntryMethod] = useState<ContractEntryMethod>("paste");
  const [contractRevisionText, setContractRevisionText] = useState("");
  const [executionTitle, setExecutionTitle] = useState("");
  const [knowledgeResults, setKnowledgeResults] = useState<KnowledgeSearchResult[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [knowledgeQueryProjectId, setKnowledgeQueryProjectId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [selectedApprovalId, setSelectedApprovalId] = useState<string | null>(null);
  const [isWorkbenchLoading, setIsWorkbenchLoading] = useState(false);
  const [isWorkLoading, setIsWorkLoading] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isKnowledgeLoading, setIsKnowledgeLoading] = useState(false);
  const [isContractLoading, setIsContractLoading] = useState(false);
  const [isApprovalLoading, setIsApprovalLoading] = useState(false);
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
  const [contractError, setContractError] = useState<string | null>(null);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [aiGovernanceError, setAiGovernanceError] = useState<string | null>(null);
  const [approvalTargetUserId, setApprovalTargetUserId] = useState("user-approver");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const activeUser = session?.user ?? null;

  useEffect(() => {
    if (!session) {
      return;
    }

    const nextPath = moduleRoutes[activeModule];
    if (window.location.pathname !== nextPath) {
      window.history.replaceState(null, "", nextPath);
    }
  }, [activeModule, session]);

  function showActionFeedback(message: string) {
    setActionMessage(message);
    window.setTimeout(() => {
      setActionMessage(null);
    }, 2600);
  }

  function canNavigateTo(module: ModuleKey) {
    return session?.visibleModules.includes(module) ?? false;
  }

  function navigateToModule(module: ModuleKey, feedback?: string) {
    if (!canNavigateTo(module)) {
      showActionFeedback("当前账号没有目标模块权限。");
      return false;
    }

    setActiveModule(module);

    if (feedback) {
      showActionFeedback(feedback);
    }

    return true;
  }

  function openProject(projectId: string, module: ModuleKey = "projects") {
    setSelectedProjectId(projectId);
    navigateToModule(module, module === "tasks" ? "已跳转到项目任务。" : "已跳转到项目详情。");
  }

  function openTask(taskId: string) {
    const task = tasks.find((candidate) => candidate.id === taskId);

    if (task) {
      setSelectedProjectId(task.projectId);
      setSelectedTaskId(task.id);
    }

    navigateToModule("tasks", "已跳转到任务所在项目。");
  }

  function openThread(threadId: string) {
    setSelectedThreadId(threadId);
    navigateToModule("chat", "已跳转到关联会话。");
    void refreshChatData(threadId).catch((error) => {
      setChatError(error instanceof Error ? error.message : "会话加载失败");
    });
  }

  function openProjectChat(projectId: string) {
    setSelectedProjectId(projectId);
    const relatedThread = chatThreads.find((thread) => thread.relatedObjectType === "project" && thread.relatedObjectId === projectId);

    if (relatedThread) {
      openThread(relatedThread.id);
      return;
    }

    navigateToModule("chat", "已切到聊天；创建会话会自动关联当前项目。");
  }

  function openContract(contractId: string) {
    setSelectedContractId(contractId);
    navigateToModule("contracts", "已跳转到来源合同。");
  }

  function openApproval(approvalId: string) {
    setSelectedApprovalId(approvalId);
    navigateToModule("approvals", "已跳转到审批详情。");
  }

  function openKnowledgeWithProject(projectId: string | null) {
    setKnowledgeQueryProjectId(projectId);
    if (projectId) {
      setSelectedProjectId(projectId);
    }
    navigateToModule("knowledge", projectId ? "已带入项目上下文检索。" : "已切到知识库。");
  }

  async function openAiDraft(draftId: string) {
    const cachedDraft = aiDrafts.find((candidate) => candidate.id === draftId);

    if (cachedDraft) {
      openThread(cachedDraft.threadId);
      return;
    }

    const threadResult = await authorizedRequest<{ threads: ChatThreadSummary[] }>("/chat/threads");
    setChatThreads(threadResult.threads);

    for (const thread of threadResult.threads) {
      const draftResult = await authorizedRequest<{ drafts: AiDraftRecord[] }>(`/chat/threads/${thread.id}/ai/drafts`);
      const draft = draftResult.drafts.find((candidate) => candidate.id === draftId);

      if (draft) {
        openThread(draft.threadId);
        return;
      }
    }

    navigateToModule("chat", "未找到 AI 草稿，已切到聊天模块。");
  }

  function openRelatedObject(objectType: string | null, objectId: string | null, moduleHint?: ModuleKey | null) {
    if (!objectType || !objectId) {
      return;
    }

    if (objectType === "project") {
      openProject(objectId, moduleHint === "tasks" ? "tasks" : "projects");
      return;
    }

    if (objectType === "task") {
      openTask(objectId);
      return;
    }

    if (objectType === "chat_thread") {
      openThread(objectId);
      return;
    }

    if (objectType === "contract") {
      openContract(objectId);
      return;
    }

    if (objectType === "approval") {
      openApproval(objectId);
      return;
    }

    if (objectType === "ai_draft") {
      void openAiDraft(objectId).catch((error) => {
        setChatError(error instanceof Error ? error.message : "AI 草稿定位失败");
        navigateToModule("chat", "AI 草稿定位失败，已切到聊天模块。");
      });
      return;
    }

    if (objectType === "knowledge_item" || objectType === "project_memory") {
      navigateToModule("knowledge", "已切到知识库证据面板。");
    }
  }

  async function authorizedRequest<T>(path: string, init: RequestInit = {}) {
    if (!session) {
      throw new Error("未登录");
    }

    const headers = new Headers(init.headers);
    headers.set("authorization", `Bearer ${session.token}`);

    if (init.body !== undefined && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers
    });

    if (!response.ok) {
      if (response.status === 401) {
        writeStoredSession(null);
        setSession(null);
        window.history.replaceState(null, "", "/login");
        throw new Error("登录已过期，请重新登录");
      }

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
      authorizedRequest<{ tasks: TaskWithDetails[] }>("/tasks")
    ]);
    setProjects(projectResult.projects);
    setTasks(taskResult.tasks);
    setSelectedProjectId((current) => current ?? projectResult.projects[0]?.id ?? null);
    setSelectedTaskId((current) => current ?? taskResult.tasks[0]?.id ?? null);
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

  async function refreshContractData() {
    if (!session) {
      return;
    }

    const result = await authorizedRequest<{ contracts: ContractWithDetails[] }>("/contracts");
    setContracts(result.contracts);
    setSelectedContractId((current) => current ?? result.contracts[0]?.id ?? null);
  }

  async function refreshApprovalData() {
    if (!session) {
      return;
    }

    const result = await authorizedRequest<{ approvals: ApprovalWithDetails[] }>("/approvals");
    setApprovals(result.approvals);
    setSelectedApprovalId((current) => current ?? result.approvals[0]?.id ?? null);
  }

  async function refreshAiGovernanceData() {
    if (!session || !session.permissions.ai.includes("read_ai_runs")) {
      setAiRuns([]);
      setAiFrameworks([]);
      return;
    }

    const runResult = await authorizedRequest<{ runs: AiRunWithDetails[] }>("/ai/runs");
    setAiRuns(runResult.runs);

    if (session.visibleModules.includes("settings") && session.permissions.ai.includes("configure_ai_frameworks")) {
      const frameworkResult = await authorizedRequest<{ frameworks: AiFrameworkWithVersions[] }>("/settings/ai-frameworks");
      setAiFrameworks(frameworkResult.frameworks);
    } else {
      setAiFrameworks([]);
    }
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
      setAiFrameworks([]);
      setAiRuns([]);
      setKnowledgeItems([]);
      setProjectMemories([]);
      setContracts([]);
      setApprovals([]);
      setProjectFiles([]);
      setFilePreview(null);
      setKnowledgeResults([]);
      setSelectedProjectId(null);
      setSelectedTaskId(null);
      setKnowledgeQueryProjectId(null);
      setSelectedThreadId(null);
      setSelectedContractId(null);
      setSelectedApprovalId(null);
      setIsWorkbenchLoading(false);
      setIsWorkLoading(false);
      setIsChatLoading(false);
      setIsKnowledgeLoading(false);
      setIsContractLoading(false);
      setIsApprovalLoading(false);
      setIsFileLoading(false);
      setShowNotifications(false);
      setAiGovernanceError(null);
      return;
    }

    setIsWorkbenchLoading(true);
    setIsWorkLoading(true);
    setIsChatLoading(true);
    setIsKnowledgeLoading(true);
    setIsContractLoading(true);
    setIsApprovalLoading(true);
    setWorkError(null);
    setChatError(null);
    setKnowledgeError(null);
    setContractError(null);
    setApprovalError(null);
    setAiGovernanceError(null);
    setFileError(null);

    void Promise.allSettled([
      refreshWorkbenchData(),
      refreshWorkData(),
      refreshChatData(),
      refreshKnowledgeData(),
      refreshContractData(),
      refreshApprovalData(),
      refreshAiGovernanceData()
    ]).then((results) => {
      const [workbenchResult, workResult, chatResult, knowledgeResult, contractResult, approvalResult, aiGovernanceResult] = results;

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

      if (contractResult.status === "rejected") {
        const message = contractResult.reason instanceof Error ? contractResult.reason.message : "合同加载失败";
        setContractError(message);
      }

      if (approvalResult.status === "rejected") {
        const message = approvalResult.reason instanceof Error ? approvalResult.reason.message : "审批加载失败";
        setApprovalError(message);
      }

      if (aiGovernanceResult.status === "rejected") {
        const message = aiGovernanceResult.reason instanceof Error ? aiGovernanceResult.reason.message : "AI 治理加载失败";
        setAiGovernanceError(message);
      }

      setIsWorkbenchLoading(false);
      setIsWorkLoading(false);
      setIsChatLoading(false);
      setIsKnowledgeLoading(false);
      setIsContractLoading(false);
      setIsApprovalLoading(false);
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

    const nextSession = (await response.json()) as SessionState;
    writeStoredSession(nextSession);
    setSession(nextSession);
    setActiveModule(moduleFromPath(window.location.pathname));
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
    const result = await authorizedRequest<{ task: TaskWithDetails }>("/tasks", {
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
    setSelectedTaskId(result.task.id);
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
    await authorizedRequest<{ task: TaskWithDetails }>(`/tasks/${task.id}/status`, {
      method: "POST",
      body: JSON.stringify({
        status,
        reason: status === "cancelled" ? "前端取消任务" : undefined
      })
    });
    await Promise.all([refreshWorkData(), refreshWorkbenchData()]);
  }

  async function returnTask(task: TaskRecord) {
    setWorkError(null);
    await authorizedRequest<{ task: TaskWithDetails }>(`/tasks/${task.id}/return`, {
      method: "POST",
      body: JSON.stringify({
        reason: "需要负责人补充处理结果"
      })
    });
    await Promise.all([refreshWorkData(), refreshWorkbenchData()]);
  }

  async function addTaskComment(task: TaskRecord) {
    setWorkError(null);
    await authorizedRequest(`/tasks/${task.id}/comments`, {
      method: "POST",
      body: JSON.stringify({
        content: taskComment.trim() || "已记录人工协作说明。"
      })
    });
    setTaskComment("");
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
      await Promise.all([refreshChatData(selectedThreadId), refreshWorkbenchData(), refreshAiGovernanceData()]);
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
    await Promise.all([refreshWorkData(), refreshChatData(selectedThreadId), refreshKnowledgeData(), refreshWorkbenchData(), refreshAiGovernanceData()]);
  }

  async function rejectAiDraft(draft: AiDraftRecord) {
    setChatError(null);
    await authorizedRequest(`/ai/drafts/${draft.id}/reject`, {
      method: "POST",
      body: JSON.stringify({
        reason: "front_end_human_rejected_ai_output"
      })
    });
    await Promise.all([refreshChatData(selectedThreadId), refreshWorkbenchData(), refreshAiGovernanceData()]);
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
        projectId: knowledgeQueryProjectId ?? undefined,
        limit: 8
      })
    });
    setKnowledgeResults(result.results);
    await refreshAiGovernanceData();
  }

  async function createContract() {
    setContractError(null);
    const organizationId = session?.dataOrganizations[0]?.id ?? activeUser?.defaultOrganizationId;
    const path = contractEntryMethod === "upload" ? "/contracts/upload" : "/contracts/paste";
    const payload =
      contractEntryMethod === "upload"
        ? {
            title: contractTitle.trim() || contractFileName.trim() || "上传合同",
            organizationId,
            fileName: contractFileName.trim() || "contract.txt",
            mimeType: "text/plain",
            contentText: contractText
          }
        : {
            title: contractTitle.trim() || "粘贴合同",
            organizationId,
            originalText: contractText
          };
    const result = await authorizedRequest<{ contract: ContractWithDetails }>(path, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    setContractTitle("");
    setContractText("");
    setContractFileName("");
    setSelectedContractId(result.contract.id);
    await Promise.all([refreshContractData(), refreshWorkbenchData()]);
  }

  async function runContractAiReview(contract: ContractWithDetails) {
    setContractError(null);
    setIsAiGenerating(true);
    setAiFailure(null);

    try {
      await authorizedRequest(`/contracts/${contract.id}/ai-review`, {
        method: "POST"
      });
      await Promise.all([refreshContractData(), refreshWorkbenchData(), refreshAiGovernanceData()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "合同 AI 审查失败";
      setAiFailure(message);
      throw error;
    } finally {
      setIsAiGenerating(false);
    }
  }

  async function confirmContractRisks(contract: ContractWithDetails) {
    const review = contract.reviews[0];

    if (!review) {
      return;
    }

    setContractError(null);
    await authorizedRequest(`/contracts/${contract.id}/risk-confirm`, {
      method: "POST",
      body: JSON.stringify({
        reason: "contract_page_human_risk_confirmation",
        confirmations: review.risks.map((risk) => ({
          riskId: risk.id,
          confirmed: true,
          selectedOption: "B" satisfies ContractOptionKey,
          note: "人工确认风险并选择 B 平衡方案。"
        }))
      })
    });
    await Promise.all([refreshContractData(), refreshWorkbenchData()]);
  }

  async function submitContractRevision(contract: ContractWithDetails) {
    setContractError(null);
    await authorizedRequest(`/contracts/${contract.id}/revision`, {
      method: "POST",
      body: JSON.stringify({
        originalText: contractRevisionText,
        reason: "contract_page_revision_after_risk_confirmation"
      })
    });
    setContractRevisionText("");
    await Promise.all([refreshContractData(), refreshWorkbenchData()]);
  }

  async function runContractSecondReview(contract: ContractWithDetails) {
    setContractError(null);
    setIsAiGenerating(true);

    try {
      await authorizedRequest(`/contracts/${contract.id}/second-review`, {
        method: "POST"
      });
      await Promise.all([refreshContractData(), refreshWorkbenchData(), refreshAiGovernanceData()]);
    } finally {
      setIsAiGenerating(false);
    }
  }

  async function submitContractApproval(contract: ContractWithDetails) {
    setContractError(null);
    await authorizedRequest(`/contracts/${contract.id}/submit-approval`, {
      method: "POST",
      body: JSON.stringify({
        reason: "contract_page_bounded_approval_handoff"
      })
    });
    await Promise.all([refreshContractData(), refreshApprovalData(), refreshWorkbenchData()]);
  }

  async function recordExecutionEvent(contract: ContractWithDetails) {
    setContractError(null);
    await authorizedRequest(`/contracts/${contract.id}/execution-events`, {
      method: "POST",
      body: JSON.stringify({
        eventType: "reminder" satisfies ContractExecutionEventType,
        title: executionTitle.trim() || "合同执行提醒",
        notes: "系统内记录提醒，不发送外部通知。",
        status: "pending"
      })
    });
    setExecutionTitle("");
    await Promise.all([refreshContractData(), refreshWorkbenchData()]);
  }

  async function actOnApproval(
    approval: ApprovalWithDetails,
    action: "approve" | "reject" | "return" | "transfer" | "add-sign"
  ) {
    setApprovalError(null);
    const body =
      action === "transfer" || action === "add-sign"
        ? {
            targetUserId: approvalTargetUserId,
            reason: `approval_page_${action}_human_action`
          }
        : {
            reason: `approval_page_${action}_human_action`
          };

    await authorizedRequest(`/approvals/${approval.id}/${action}`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    await Promise.all([refreshApprovalData(), refreshContractData(), refreshWorkbenchData()]);
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
            <p className="eyebrow">协同工作平台 · {roles[activeUser.role]}</p>
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
            <button
              className="text-button"
              onClick={() => {
                writeStoredSession(null);
                setSession(null);
                window.history.replaceState(null, "", "/login");
              }}
            >
              退出
            </button>
            <button className="icon-button notification-button" aria-label="通知" onClick={() => setShowNotifications((value) => !value)}>
              <Bell size={18} />
              {notificationCount > 0 ? <span>{notificationCount}</span> : null}
            </button>
          </div>
        </header>

        <PageStateNotice active={Boolean(actionMessage)} state="normal" title="操作已处理" body={actionMessage ?? ""} />

        {showNotifications ? (
          <NotificationDrawer
            notifications={workbench?.notifications ?? []}
            isLoading={isWorkbenchLoading}
            onOpenNotification={(notification) =>
              openRelatedObject(notification.relatedObjectType, notification.relatedObjectId, notification.module)
            }
          />
        ) : null}

        {!activeModuleAllowed ? (
          <NoPermissionView moduleName={currentModuleName} />
        ) : currentModule === "dashboard" ? (
          <DashboardView
            activeUser={activeUser}
            dataOrganizations={dataOrganizations}
            error={workError}
            isLoading={isWorkbenchLoading}
            onOpenApprovals={() => setActiveModule("approvals")}
            onOpenWorkItem={openRelatedObject}
            onOpenWorkbench={() => setActiveModule("workbench")}
            projects={projects}
            tasks={tasks}
            contracts={contracts}
            approvals={approvals}
            workbench={workbench}
          />
        ) : currentModule === "workbench" ? (
          <WorkbenchView
            error={workError}
            isLoading={isWorkbenchLoading}
            onOpenModule={setActiveModule}
            onOpenWorkItem={openRelatedObject}
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
            onOpenChatForProject={openProjectChat}
            onOpenKnowledgeForProject={openKnowledgeWithProject}
            onOpenProjectTasks={(projectId) => openProject(projectId, "tasks")}
            onOpenTaskProject={(task) => openProject(task.projectId, "projects")}
            onSelectTask={setSelectedTaskId}
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
            onTaskReturn={(task) => {
              void returnTask(task).catch((error) => {
                setWorkError(error instanceof Error ? error.message : "任务退回失败");
              });
            }}
            onTaskComment={(task) => {
              void addTaskComment(task).catch((error) => {
                setWorkError(error instanceof Error ? error.message : "评论保存失败");
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
            selectedTaskId={selectedTaskId}
            setFileContent={setFileContent}
            setFileName={setFileName}
            setProjectTitle={setProjectTitle}
            setTaskTitle={setTaskTitle}
            setTaskComment={setTaskComment}
            setTaskView={setTaskView}
            taskComment={taskComment}
            taskTitle={taskTitle}
            taskView={taskView}
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
            onRejectDraft={(draft) => {
              void rejectAiDraft(draft).catch((error) => {
                setChatError(error instanceof Error ? error.message : "AI 草稿驳回失败");
              });
            }}
            onOpenDraftObject={openRelatedObject}
            onOpenKnowledgeWithProject={openKnowledgeWithProject}
            onOpenRelatedObject={openRelatedObject}
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
            projects={projects}
            tasks={tasks}
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
            queryProject={projects.find((project) => project.id === knowledgeQueryProjectId) ?? null}
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
            onSelectQueryProject={setKnowledgeQueryProjectId}
            projects={projects}
            queryProjectId={knowledgeQueryProjectId}
            setKnowledgeQuery={setKnowledgeQuery}
          />
        ) : currentModule === "contracts" ? (
          <ContractView
            aiFailure={aiFailure}
            canCreateContract={session.permissions.operation.includes("create_contract")}
            canConfirmRisk={session.permissions.operation.includes("confirm_contract_risk")}
            canReviseContract={session.permissions.operation.includes("revise_contract")}
            canSubmitApproval={session.permissions.approval.includes("initiate_approval")}
            canTrackExecution={session.permissions.operation.includes("track_contract_execution")}
            contractEntryMethod={contractEntryMethod}
            contractError={contractError}
            contractFileName={contractFileName}
            contractRevisionText={contractRevisionText}
            contractText={contractText}
            contractTitle={contractTitle}
            contracts={contracts}
            executionTitle={executionTitle}
            isAiGenerating={isAiGenerating}
            isLoading={isContractLoading}
            onConfirmRisks={(contract) => {
              void confirmContractRisks(contract).catch((error) => {
                setContractError(error instanceof Error ? error.message : "风险确认失败");
              });
            }}
            onCreateContract={() => {
              void createContract().catch((error) => {
                setContractError(error instanceof Error ? error.message : "合同创建失败");
              });
            }}
            onExecutionEvent={(contract) => {
              void recordExecutionEvent(contract).catch((error) => {
                setContractError(error instanceof Error ? error.message : "执行记录失败");
              });
            }}
            onRunAiReview={(contract) => {
              void runContractAiReview(contract).catch((error) => {
                setContractError(error instanceof Error ? error.message : "AI 审查失败");
              });
            }}
            onRunSecondReview={(contract) => {
              void runContractSecondReview(contract).catch((error) => {
                setContractError(error instanceof Error ? error.message : "二次审查失败");
              });
            }}
            onOpenApproval={openApproval}
            onSelectContract={setSelectedContractId}
            onSubmitApproval={(contract) => {
              void submitContractApproval(contract).catch((error) => {
                setContractError(error instanceof Error ? error.message : "提交审批失败");
              });
            }}
            onSubmitRevision={(contract) => {
              void submitContractRevision(contract).catch((error) => {
                setContractError(error instanceof Error ? error.message : "提交修改失败");
              });
            }}
            selectedContractId={selectedContractId}
            setContractEntryMethod={setContractEntryMethod}
            setContractFileName={setContractFileName}
            setContractRevisionText={setContractRevisionText}
            setContractText={setContractText}
            setContractTitle={setContractTitle}
            setExecutionTitle={setExecutionTitle}
          />
        ) : currentModule === "approvals" ? (
          <ApprovalView
            activeUser={activeUser}
            approvalError={approvalError}
            approvals={approvals}
            approvalTargetUserId={approvalTargetUserId}
            canAddSign={session.permissions.approval.includes("add_sign")}
            canApprove={session.permissions.approval.includes("approve_current_node")}
            canReject={session.permissions.approval.includes("reject_current_node")}
            canReturn={session.permissions.approval.includes("return_for_revision")}
            canTransfer={session.permissions.approval.includes("transfer_approval")}
            isLoading={isApprovalLoading}
            onAction={(approval, action) => {
              void actOnApproval(approval, action).catch((error) => {
                setApprovalError(error instanceof Error ? error.message : "审批操作失败");
              });
            }}
            onOpenSourceContract={openContract}
            onSelectApproval={setSelectedApprovalId}
            selectedApprovalId={selectedApprovalId}
            setApprovalTargetUserId={setApprovalTargetUserId}
          />
        ) : currentModule === "settings" && canOpenSettings ? (
          <SettingsView
            activeUser={activeUser}
            aiError={aiGovernanceError}
            aiFrameworks={aiFrameworks}
            aiRuns={aiRuns}
            permissions={session.permissions}
            visibleModuleCount={visibleModules.length}
          />
        ) : (
          <ModuleStatusView moduleKey={currentModule} moduleName={currentModuleName} />
        )}
      </main>
    </div>
  );
}

function DashboardView({
  activeUser,
  dataOrganizations,
  error,
  isLoading,
  onOpenApprovals,
  onOpenWorkItem,
  onOpenWorkbench,
  projects,
  tasks,
  contracts,
  approvals,
  workbench
}: {
  activeUser: PublicUser;
  dataOrganizations: Organization[];
  error: string | null;
  isLoading: boolean;
  onOpenApprovals: () => void;
  onOpenWorkItem: (objectType: string | null, objectId: string | null, moduleHint?: ModuleKey | null) => void;
  onOpenWorkbench: () => void;
  projects: ProjectSummary[];
  tasks: TaskRecord[];
  contracts: ContractWithDetails[];
  approvals: ApprovalWithDetails[];
  workbench: WorkbenchResponse | null;
}) {
  const summary = workbench?.summary;
  const activeProjects = projects.filter((project) => project.status !== "archived");
  const openTasks = tasks.filter((task) => !["completed", "cancelled", "archived"].includes(task.status));
  const activeContracts = contracts.filter((contract) => !["completed", "cancelled", "archived"].includes(contract.status));
  const activeApprovals = approvals.filter((approval) => ["submitted", "processing", "transferred"].includes(approval.status));

  return (
    <>
      <section className="metric-grid" aria-label="核心指标">
        <MetricCard title="我的待办" value={String(summary?.pendingWorkCount ?? 0)} helper="任务处理与人工确认" />
        <MetricCard title="进行中项目" value={String(activeProjects.length)} helper="可见范围内未归档项目" />
        <MetricCard title="待推进任务" value={String(openTasks.length)} helper="未完成任务和确认项" />
        <MetricCard title="合同 / 审批" value={`${activeContracts.length}/${activeApprovals.length}`} helper="未完结合同与审批" />
      </section>

      <PageStateNotice state="loading" title="正在加载首页工作入口" body="正在同步工作台、项目、任务、聊天和知识数据。" active={isLoading} />
      <PageStateNotice state="error" title="首页数据加载失败" body={error ?? ""} active={Boolean(error)} />

      <section className="content-grid">
        <div className="panel work-panel">
          <div className="panel-header">
            <div>
              <h2>今日待处理</h2>
              <p>{activeUser.displayName} 当前需要处理的任务、审批、合同确认和 AI 草稿。</p>
            </div>
            <button className="secondary-button" onClick={onOpenWorkbench}>
              <LayoutDashboard size={17} />
              打开工作台
            </button>
          </div>
          <WorkbenchSection
            emptyText="当前没有待处理工作。"
            items={workbench?.sections.pendingWork ?? []}
            onOpenItem={onOpenWorkItem}
            title="我的待办"
          />
          <WorkbenchSection
            emptyText="当前没有 AI 结果待人工确认。"
            items={workbench?.sections.aiConfirmations ?? []}
            onOpenItem={onOpenWorkItem}
            title="AI 结果确认"
          />
          <WorkbenchSection
            emptyText="当前没有合同确认事项。"
            items={workbench?.sections.contractConfirmations ?? []}
            onOpenItem={onOpenWorkItem}
            title="合同确认"
          />
          <div className="action-row section-actions">
            <button className="secondary-button" onClick={onOpenApprovals}>
              <ClipboardList size={17} />
              查看审批状态
            </button>
          </div>
        </div>

        <ProjectHealthPanel projects={activeProjects} tasks={openTasks} onOpenWorkItem={onOpenWorkItem} />
        <ContractApprovalPanel contracts={activeContracts} approvals={activeApprovals} onOpenApprovals={onOpenApprovals} onOpenWorkItem={onOpenWorkItem} />
        <OrganizationPanel dataOrganizations={dataOrganizations} />
        <SystemNoticePanel notifications={workbench?.notifications ?? []} onOpenWorkItem={onOpenWorkItem} />
      </section>
    </>
  );
}

function WorkbenchView({
  error,
  isLoading,
  onOpenModule,
  onOpenWorkItem,
  workbench
}: {
  error: string | null;
  isLoading: boolean;
  onOpenModule: (module: ModuleKey) => void;
  onOpenWorkItem: (objectType: string | null, objectId: string | null, moduleHint?: ModuleKey | null) => void;
  workbench: WorkbenchResponse | null;
}) {
  const summary = workbench?.summary;
  const hasArchivedProjects = (summary?.archivedProjectCount ?? 0) > 0;
  const hasExpiredItems = (summary?.expiredItemCount ?? 0) > 0;

  return (
    <>
      <section className="metric-grid" aria-label="工作台指标">
        <MetricCard title="我的待办" value={String(summary?.pendingWorkCount ?? 0)} helper="待提交 / 待确认" />
        <MetricCard title="我负责的任务" value={String(summary?.responsibleTaskCount ?? 0)} helper="未完成任务" />
        <MetricCard title="我参与的项目" value={String(summary?.participatingProjectCount ?? 0)} helper="未归档项目" />
        <MetricCard title="待审批 / 合同" value={`${summary?.pendingApprovalCount ?? 0}/${summary?.contractConfirmationCount ?? 0}`} helper="当前节点 / 合同确认" />
      </section>

      <PageStateNotice state="loading" title="正在加载我的工作台" body="正在同步本人待办、任务和确认事项。" active={isLoading} />
      <PageStateNotice state="error" title="工作台加载失败" body={error ?? ""} active={Boolean(error)} />
      <PageStateNotice
        state="empty"
        title="当前没有待处理事项"
        body="工作台不会编造审批、合同或任务数据；有权限数据产生后会显示在这里。"
        active={!isLoading && !error && Boolean(workbench) && (summary?.pendingWorkCount ?? 0) === 0 && (summary?.aiResultConfirmationCount ?? 0) === 0}
      />
      <PageStateNotice
        state="archived"
        title="存在已归档项目"
        body="归档项目保留审计和详情状态，但默认不进入主要工作列表。"
        active={!isLoading && hasArchivedProjects}
      />
      <PageStateNotice
        state="expired"
        title="存在已过期事项"
        body="过期审批或任务会保留状态提示，不允许 AI 代替处理。"
        active={!isLoading && hasExpiredItems}
      />

      <section className="workbench-layout">
        <div className="panel work-panel">
          <div className="panel-header">
            <div>
              <h2>我的工作</h2>
              <p>任务、确认和 AI 结果都要求人工处理，AI 不会自动执行正式动作。</p>
            </div>
          </div>
          <WorkbenchSection title="我的待办" items={workbench?.sections.pendingWork ?? []} emptyText="暂无待办任务或确认项。" onOpenItem={onOpenWorkItem} />
          <WorkbenchSection title="我负责的任务" items={workbench?.sections.responsibleTasks ?? []} emptyText="暂无负责中的任务。" onOpenItem={onOpenWorkItem} />
          <WorkbenchSection title="待确认 AI 结果" items={workbench?.sections.aiConfirmations ?? []} emptyText="暂无 AI 草稿待确认。" onOpenItem={onOpenWorkItem} />
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
          <WorkbenchSection title="项目" items={workbench?.sections.participatingProjects ?? []} emptyText="暂无参与项目。" onOpenItem={onOpenWorkItem} />
        </div>

        <div className="panel">
          <div className="panel-header compact">
            <div>
              <h2>审批与合同</h2>
              <p>合同确认、审批节点和结果回写集中进入工作台。</p>
            </div>
          </div>
          <WorkbenchSection title="我待审批" items={workbench?.sections.pendingApprovals ?? []} emptyText="暂无当前节点审批。" onOpenItem={onOpenWorkItem} />
          <WorkbenchSection title="待确认合同" items={workbench?.sections.contractConfirmations ?? []} emptyText="暂无合同确认项。" onOpenItem={onOpenWorkItem} />
        </div>

        <div className="panel state-panel">
          <div className="panel-header compact">
            <div>
              <h2>系统提醒</h2>
              <p>提醒只来自真实任务、审批、合同和权限事件。</p>
            </div>
          </div>
          <div className="stage-checklist">
            <span>待办提醒：按当前账号生成</span>
            <span>权限提醒：无权限不展示业务数据</span>
            <span>人工确认：AI 建议必须人工处理</span>
          </div>
        </div>
      </section>
    </>
  );
}

function WorkbenchSection({
  title,
  items,
  emptyText,
  onOpenItem
}: {
  title: string;
  items: WorkbenchItem[];
  emptyText: string;
  onOpenItem?: (objectType: string | null, objectId: string | null, moduleHint?: ModuleKey | null) => void;
}) {
  return (
    <div className="workbench-section">
      <div className="section-title">
        <strong>{title}</strong>
        <span>{items.length}</span>
      </div>
      <div className="record-list">
        {items.length > 0 ? (
          items.map((item) => (
            <button
              className="workbench-row"
              disabled={!onOpenItem}
              key={item.id}
              onClick={() => onOpenItem?.(item.objectType, item.objectId, item.module)}
            >
              <div>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </div>
              <span className="status-pill">{displayStatus(item.status)}</span>
              <span className="count-pill">{platformModules.find((module) => module.key === item.module)?.name ?? item.module}</span>
            </button>
          ))
        ) : (
          <div className="empty-state">{emptyText}</div>
        )}
      </div>
    </div>
  );
}

function ProjectHealthPanel({
  onOpenWorkItem,
  projects,
  tasks
}: {
  onOpenWorkItem: (objectType: string | null, objectId: string | null, moduleHint?: ModuleKey | null) => void;
  projects: ProjectSummary[];
  tasks: TaskRecord[];
}) {
  const recentProjects = projects.slice(0, 4);
  const blockedTasks = tasks.filter((task) => task.status === "blocked");
  const submittedTasks = tasks.filter((task) => task.status === "submitted");

  return (
    <div className="panel">
      <div className="panel-header compact">
        <div>
          <h2>项目运行</h2>
          <p>跟踪可见项目、待确认任务和阻塞事项。</p>
        </div>
        <BriefcaseBusiness size={22} />
      </div>
      <div className="detail-grid dashboard-detail-grid">
        <SettingsItem title="可见项目" value={`${projects.length} 个`} enabled />
        <SettingsItem title="待确认任务" value={`${submittedTasks.length} 个`} enabled />
        <SettingsItem title="阻塞任务" value={`${blockedTasks.length} 个`} enabled />
        <SettingsItem title="进行中任务" value={`${tasks.filter((task) => task.status === "in_progress").length} 个`} enabled />
      </div>
      <div className="record-list">
        {recentProjects.length > 0 ? (
          recentProjects.map((project) => (
            <button className="workbench-row" key={project.id} onClick={() => onOpenWorkItem("project", project.id, "projects")}>
              <span>
                <strong>{project.title}</strong>
                <small>{organizationName(project.organizationId)} · {project.memberUserIds.length} 成员</small>
              </span>
              <span className="status-pill">{displayStatus(project.status)}</span>
              <span className="count-pill">{project.taskCount} 任务</span>
            </button>
          ))
        ) : (
          <div className="empty-state">暂无可见项目。</div>
        )}
      </div>
    </div>
  );
}

function ContractApprovalPanel({
  approvals,
  contracts,
  onOpenApprovals,
  onOpenWorkItem
}: {
  approvals: ApprovalWithDetails[];
  contracts: ContractWithDetails[];
  onOpenApprovals: () => void;
  onOpenWorkItem: (objectType: string | null, objectId: string | null, moduleHint?: ModuleKey | null) => void;
}) {
  const waitingContracts = contracts.filter((contract) =>
    ["risk_pending_confirm", "revision_required", "approval_pending", "execution_tracking"].includes(contract.status)
  );
  const currentApprovals = approvals.filter((approval) => approval.status === "processing");

  return (
    <div className="panel">
      <div className="panel-header compact">
        <div>
          <h2>合同与审批</h2>
          <p>合同风险确认、二次审查和审批节点集中跟踪。</p>
        </div>
        <ClipboardList size={22} />
      </div>
      <div className="detail-grid dashboard-detail-grid">
        <SettingsItem title="待处理合同" value={`${waitingContracts.length} 份`} enabled />
        <SettingsItem title="审批中" value={`${currentApprovals.length} 单`} enabled />
        <SettingsItem title="全部合同" value={`${contracts.length} 份`} enabled />
        <SettingsItem title="全部审批" value={`${approvals.length} 单`} enabled />
      </div>
      <div className="record-list">
        {waitingContracts.slice(0, 3).map((contract) => (
          <button className="workbench-row" key={contract.id} onClick={() => onOpenWorkItem("contract", contract.id, "contracts")}>
            <span>
              <strong>{contract.title}</strong>
              <small>v{contract.currentVersion} · {organizationName(contract.organizationId)}</small>
            </span>
            <span className="status-pill">{displayStatus(contract.status)}</span>
            <span className="count-pill">{contract.reviews.length} 审查</span>
          </button>
        ))}
        {currentApprovals.slice(0, 3).map((approval) => (
          <button className="workbench-row" key={approval.id} onClick={() => onOpenWorkItem("approval", approval.id, "approvals")}>
            <span>
              <strong>{approval.title}</strong>
              <small>当前处理人：{approval.currentApprover?.displayName ?? "无"}</small>
            </span>
            <span className="status-pill">{displayStatus(approval.status)}</span>
            <span className="count-pill">{approval.nodes.length} 节点</span>
          </button>
        ))}
        {waitingContracts.length === 0 && currentApprovals.length === 0 ? <div className="empty-state">暂无合同或审批待处理事项。</div> : null}
      </div>
      <div className="action-row section-actions">
        <button className="secondary-button" onClick={onOpenApprovals}>
          <ClipboardList size={17} />
          打开审批中心
        </button>
      </div>
    </div>
  );
}

function SystemNoticePanel({
  notifications,
  onOpenWorkItem
}: {
  notifications: WorkbenchNotification[];
  onOpenWorkItem: (objectType: string | null, objectId: string | null, moduleHint?: ModuleKey | null) => void;
}) {
  return (
    <div className="panel">
      <div className="panel-header compact">
        <div>
          <h2>系统提醒</h2>
          <p>只展示系统内提醒，点击后进入对应业务对象。</p>
        </div>
        <Bell size={22} />
      </div>
      <div className="record-list">
        {notifications.slice(0, 5).map((notification) => (
          <button
            className={`workbench-row severity-${notification.severity}`}
            key={notification.id}
            onClick={() => onOpenWorkItem(notification.relatedObjectType, notification.relatedObjectId, notification.module)}
          >
            <span>
              <strong>{notification.title}</strong>
              <small>{notification.body}</small>
            </span>
            <span className="status-pill">{displayPriority(notification.severity)}</span>
            <span className="count-pill">{platformModules.find((module) => module.key === notification.module)?.name ?? notification.module}</span>
          </button>
        ))}
        {notifications.length === 0 ? <div className="empty-state">暂无系统提醒。</div> : null}
      </div>
    </div>
  );
}

function NotificationDrawer({
  isLoading,
  notifications,
  onOpenNotification
}: {
  isLoading: boolean;
  notifications: WorkbenchNotification[];
  onOpenNotification: (notification: WorkbenchNotification) => void;
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
              <button className={`notification-item ${item.severity}`} key={item.id} onClick={() => onOpenNotification(item)}>
                <Icon size={18} />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
                <span>{platformModules.find((module) => module.key === item.module)?.name ?? item.module}</span>
              </button>
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

function cleanDisplayText(value: string): string {
  let next: string = value
    .replace(/DEV-\d+/g, "当前阶段")
    .replace(/\b(project|task|chat|message|ai-draft|knowledge|contract|approval|file)-[a-f0-9-]{12,}\b/gi, "业务记录")
    .replace(/\bsmoke\b/gi, "测试")
    .replace(/\blegal human approve\b/gi, "法务人工同意")
    .replace(/\bfinal human approve\b/gi, "最终人工同意")
    .replace(/\bhuman approve\b/gi, "人工同意")
    .replace(/approval_page_([a-z-]+)_human_action/gi, (_, action: string) => `页面人工${approvalActionLabels[action] ?? "处理"}`)
    .replace(/contract_page_human_risk_confirmation/gi, "页面人工确认合同风险")
    .replace(/contract_page_revision_after_risk_confirmation/gi, "风险确认后提交修改版本")
    .replace(/contract_page_bounded_approval_handoff/gi, "页面人工提交审批")
    .replace(/\bAPI\b/g, "系统服务");

  const replacements = {
    ...statusLabels,
    ...priorityLabels,
    ...sourceTypeLabels,
    ...objectTypeLabels,
    ...aiDraftKindLabels,
    ...scenarioLabels,
    ...entryMethodLabels,
    ...approvalActionLabels,
    ...resultWritebackLabels,
    ...dataScopeLabels
  };

  for (const [raw, label] of Object.entries(replacements)) {
    next = next.replace(new RegExp(`\\b${raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g"), label);
  }

  return next;
}

function displayPolicyVersion(value: string) {
  return value.replace(/^seed-dev-(\d+)$/i, "策略版本 $1");
}

function NoPermissionView({ moduleName }: { moduleName: string }) {
  return (
    <section className="module-status">
      <div className="panel module-status-panel">
        <PageStateNotice active state="no-permission" title="无权限访问" body={`${moduleName} 不在当前账号的菜单权限内。`} />
        <p className="eyebrow">权限裁剪</p>
        <h2>{moduleName}</h2>
        <p>系统会同时裁剪菜单和数据范围；无权限访问会被拒绝并写入审计。</p>
      </div>
    </section>
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

function SettingsView({
  activeUser,
  aiError,
  aiFrameworks,
  aiRuns,
  permissions,
  visibleModuleCount
}: {
  activeUser: PublicUser;
  aiError: string | null;
  aiFrameworks: AiFrameworkWithVersions[];
  aiRuns: AiRunWithDetails[];
  permissions: PermissionSummary;
  visibleModuleCount: number;
}) {
  return (
    <div className="panel settings-panel">
      <div className="panel-header compact">
        <div>
          <h2>系统设置</h2>
          <p>账号、组织、角色、权限、审批、文件、AI 和审计能力集中维护。</p>
        </div>
        <Settings size={22} />
      </div>
      <div className="action-row section-actions">
        <button className="secondary-button compact-button" onClick={() => document.getElementById("settings-permission-governance")?.scrollIntoView()}>
          账号权限
        </button>
        <button className="secondary-button compact-button" onClick={() => document.getElementById("settings-ai-governance")?.scrollIntoView()}>
          AI 治理
        </button>
      </div>
      <div className="settings-grid settings-module-grid" id="settings-permission-governance">
        <SettingsItem title="组织管理" value={`${seedOrganizations.length} 个组织`} enabled={canManageOrganizations(activeUser.role)} />
        <SettingsItem title="用户账号" value={`${seedUsers.length} 个账号`} enabled={canManageRoles(activeUser.role)} />
        <SettingsItem title="角色体系" value={`${Object.keys(rolePolicies).length} 类角色`} enabled={canManageRoles(activeUser.role)} />
        <SettingsItem title="菜单访问" value={`${visibleModuleCount} 个菜单`} enabled />
        <SettingsItem title="数据范围" value={displayDataScope(permissions.data.scope)} enabled />
        <SettingsItem title="操作权限" value={`${permissions.operation.length} 项规则`} enabled />
        <SettingsItem title="审批权限" value={`${permissions.approval.length} 项规则`} enabled />
        <SettingsItem title="文件权限" value={`${permissions.file.length} 项规则`} enabled />
        <SettingsItem title="AI 权限" value={`${permissions.ai.length} 项能力`} enabled />
        <SettingsItem title="审计策略" value="关键动作留痕" enabled />
        <SettingsItem title="策略版本" value={displayPolicyVersion(permissions.policyVersion)} enabled />
        <SettingsItem title="当前角色" value={roles[activeUser.role]} enabled />
      </div>
      <div className="settings-section-grid">
        <SettingsModuleCard
          title="组织与账号"
          body="维护组织、账号状态、所属组织和默认角色。前台不直接暴露高权限账号清单。"
          stats={[`${seedOrganizations.length} 组织`, `${seedUsers.length} 账号`]}
        />
        <SettingsModuleCard
          title="角色与数据范围"
          body="按角色控制菜单、数据范围和业务动作。系统管理员不默认拥有全部业务数据。"
          stats={[`${Object.keys(rolePolicies).length} 角色`, displayDataScope(permissions.data.scope)]}
        />
        <SettingsModuleCard
          title="审批与文件"
          body="审批动作独立授权，文件预览、下载、上传、归档和 AI 引用继承来源对象权限。"
          stats={[`${permissions.approval.length} 审批规则`, `${permissions.file.length} 文件规则`]}
        />
        <SettingsModuleCard
          title="审计与运行"
          body="登录、无权限访问、文件、AI、审批和关键业务操作进入审计记录，不提供物理删除入口。"
          stats={["审计保留", "无物理删除"]}
        />
      </div>
      <AiGovernancePanel
        aiError={aiError}
        frameworks={aiFrameworks}
        runs={aiRuns}
        canConfigure={permissions.ai.includes("configure_ai_frameworks")}
        canReadRuns={permissions.ai.includes("read_ai_runs")}
      />
    </div>
  );
}

function SettingsModuleCard({ title, body, stats }: { title: string; body: string; stats: string[] }) {
  return (
    <article className="settings-module-card">
      <strong>{title}</strong>
      <p>{body}</p>
      <div>
        {stats.map((stat) => (
          <span key={stat}>{stat}</span>
        ))}
      </div>
    </article>
  );
}

function AiGovernancePanel({
  aiError,
  canConfigure,
  canReadRuns,
  frameworks,
  runs
}: {
  aiError: string | null;
  canConfigure: boolean;
  canReadRuns: boolean;
  frameworks: AiFrameworkWithVersions[];
  runs: AiRunWithDetails[];
}) {
  const recentRuns = runs.slice(0, 6);

  return (
    <div className="ai-governance" id="settings-ai-governance">
      <div className="panel-header compact">
        <div>
          <h2>AI 框架与运行证据</h2>
          <p>配置只对管理员开放；运行记录按来源对象权限读取。</p>
        </div>
        <Brain size={22} />
      </div>
      <PageStateNotice active={Boolean(aiError)} state="error" title="AI 治理数据加载失败" body={aiError ?? ""} />
      <PageStateNotice
        active={!canReadRuns}
        state="no-permission"
        title="无智能运行记录读取权限"
        body="当前账号不能读取智能运行证据；系统仍会按权限记录审计。"
      />
      {canConfigure ? (
        <div className="ai-framework-list">
          {frameworks.length > 0 ? (
            frameworks.map((framework) => {
              const activeVersion = framework.versions.find((version) => version.id === framework.activeVersionId) ?? framework.versions[0];
              return (
                <article className="ai-framework-row" key={framework.id}>
                  <div>
                    <strong>{framework.name}</strong>
                    <small>{displayAiKind(framework.scenario)} · {displayStatus(framework.status)}</small>
                    <small>{activeVersion?.boundaryPolicy ?? "AI 只能输出建议、提醒和草稿。"}</small>
                  </div>
                  <span className="status-pill">{activeVersion?.version ?? "未配置"}</span>
                  <span className="count-pill">重试 {activeVersion?.retryPolicy.maxRetries ?? 0}</span>
                </article>
              );
            })
          ) : (
            <div className="empty-state">暂无可配置 AI 框架或当前账号无配置权限。</div>
          )}
        </div>
      ) : null}
      <div className="ai-run-list">
        {recentRuns.length > 0 ? (
          recentRuns.map((run) => (
            <article className="ai-run-row" key={run.id}>
              <div>
                <strong>{displayAiKind(run.scenario)}</strong>
                <small>{run.frameworkVersion} · 来源：{displaySourceType(run.sourceObjectType)}</small>
                <small>
                  证据 {run.sourceEvidence.length} · 决策 {run.decisions.map((decision) => displayStatus(decision.decision)).join(" / ") || "未处理"}
                </small>
              </div>
              <span className="status-pill">{displayStatus(run.status)}</span>
              <span className="count-pill">{run.failureClass ? displayStatus(run.failureClass) : "正常"}</span>
            </article>
          ))
        ) : (
          <PageStateNotice
            active={canReadRuns}
            state="empty"
            title="暂无智能运行记录"
            body="生成草稿、知识问答或合同审查后会显示来源证据和人工决策。"
          />
        )}
      </div>
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
  onOpenChatForProject,
  onOpenKnowledgeForProject,
  onOpenProjectTasks,
  onOpenTaskProject,
  onSelectTask,
  onPreviewFile,
  onProjectStatusChange,
  onSelectProject,
  onTaskComment,
  onTaskReturn,
  onTaskStatusChange,
  onUploadFile,
  projectTitle,
  projects,
  selectedProjectId,
  selectedTaskId,
  setFileContent,
  setFileName,
  setProjectTitle,
  setTaskComment,
  setTaskTitle,
  setTaskView,
  taskComment,
  taskTitle,
  taskView,
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
  onOpenChatForProject: (projectId: string) => void;
  onOpenKnowledgeForProject: (projectId: string | null) => void;
  onOpenProjectTasks: (projectId: string) => void;
  onOpenTaskProject: (task: TaskRecord) => void;
  onSelectTask: (taskId: string) => void;
  onPreviewFile: (file: FileAssetRecord) => void;
  onProjectStatusChange: (project: ProjectSummary, status: ProjectRecord["status"]) => void;
  onSelectProject: (projectId: string) => void;
  onTaskComment: (task: TaskRecord) => void;
  onTaskReturn: (task: TaskRecord) => void;
  onTaskStatusChange: (task: TaskRecord, status: TaskRecord["status"]) => void;
  onUploadFile: () => void;
  projectTitle: string;
  projects: ProjectSummary[];
  selectedProjectId: string | null;
  selectedTaskId: string | null;
  setFileContent: (value: string) => void;
  setFileName: (value: string) => void;
  setProjectTitle: (value: string) => void;
  setTaskComment: (value: string) => void;
  setTaskTitle: (value: string) => void;
  setTaskView: (value: "all" | "mine" | "created" | "confirm" | "overdue" | "completed") => void;
  taskComment: string;
  taskTitle: string;
  taskView: "all" | "mine" | "created" | "confirm" | "overdue" | "completed";
  tasks: TaskWithDetails[];
}) {
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0] ?? null;
  const selectedTasks = selectedProject ? tasks.filter((task) => task.projectId === selectedProject.id) : [];
  const visibleTasks = filterTasksForView(selectedTasks, taskView, activeUser.id);
  const selectedTask = selectedTasks.find((task) => task.id === selectedTaskId) ?? visibleTasks[0] ?? selectedTasks[0] ?? null;
  const canManageSelectedProject = selectedProject?.ownerUserId === activeUser.id || activeUser.role === "super_admin";

  return (
    <section className="project-workspace">
      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">项目协同</p>
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
                <span className="status-pill">{displayStatus(project.status)}</span>
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
          {selectedProject ? <span className="status-pill strong">{displayStatus(selectedProject.status)}</span> : null}
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
              <button className="secondary-button" onClick={() => onOpenProjectTasks(selectedProject.id)}>
                <CheckSquare size={16} />
                查看任务
              </button>
              <button className="secondary-button" onClick={() => onOpenChatForProject(selectedProject.id)}>
                <MessageSquare size={16} />
                关联聊天
              </button>
              <button className="secondary-button" onClick={() => onOpenKnowledgeForProject(selectedProject.id)}>
                <BookOpen size={16} />
                项目知识
              </button>
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
            <h2>任务中心</h2>
            <p>负责人提交完成后，必须由确认人或项目负责人确认；退回必须写明人工原因。</p>
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
        <div className="task-center">
          <div className="task-tabs" role="tablist" aria-label="任务筛选">
            {taskTabItems.map((item) => (
              <button
                className={taskView === item.key ? "active" : ""}
                key={item.key}
                onClick={() => setTaskView(item.key)}
                type="button"
              >
                {item.label}
                <span>{filterTasksForView(selectedTasks, item.key, activeUser.id).length}</span>
              </button>
            ))}
          </div>
          <div className="task-master-detail">
            <div className="task-table">
              <div className="task-row task-head">
                <span>任务</span>
                <span>负责人</span>
                <span>确认人</span>
                <span>优先级</span>
                <span>状态</span>
              </div>
              {visibleTasks.length > 0 ? (
                visibleTasks.map((task) => (
                  <button
                    className={selectedTask?.id === task.id ? "task-row task-select-row active" : "task-row task-select-row"}
                    key={task.id}
                    onClick={() => onSelectTask(task.id)}
                    type="button"
                  >
                    <span>
                      <strong>{task.title}</strong>
                      <small>{task.description}</small>
                    </span>
                    <span>{userName(task.assigneeUserId)}</span>
                    <span>{userName(task.confirmerUserId)}</span>
                    <span className={`status-pill ${task.priority}`}>{displayPriority(task.priority)}</span>
                    <span className="status-pill">{displayStatus(task.status)}</span>
                  </button>
                ))
              ) : (
                <PageStateNotice active={!isLoading} state="empty" title="当前筛选没有任务" body="切换筛选或创建任务后会显示在这里。" />
              )}
            </div>
            <TaskDetailPanel
              activeUser={activeUser}
              onOpenTaskProject={onOpenTaskProject}
              onTaskComment={onTaskComment}
              onTaskReturn={onTaskReturn}
              onTaskStatusChange={onTaskStatusChange}
              setTaskComment={setTaskComment}
              task={selectedTask}
              taskComment={taskComment}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

const taskTabItems: Array<{ key: "all" | "mine" | "created" | "confirm" | "overdue" | "completed"; label: string }> = [
  { key: "all", label: "全部" },
  { key: "mine", label: "我的" },
  { key: "created", label: "我创建" },
  { key: "confirm", label: "待确认" },
  { key: "overdue", label: "已逾期" },
  { key: "completed", label: "已完成" }
];

function filterTasksForView(
  tasks: TaskWithDetails[],
  view: "all" | "mine" | "created" | "confirm" | "overdue" | "completed",
  userId: string
) {
  return tasks.filter((task) => {
    if (view === "mine") {
      return task.assigneeUserId === userId || task.confirmerUserId === userId;
    }
    if (view === "created") {
      return task.creatorUserId === userId;
    }
    if (view === "confirm") {
      return task.confirmerUserId === userId && task.status === "submitted";
    }
    if (view === "overdue") {
      return Boolean(
        task.dueAt &&
        Date.parse(task.dueAt) < Date.now() &&
        !["completed", "cancelled", "archived"].includes(task.status)
      );
    }
    if (view === "completed") {
      return task.status === "completed";
    }
    return true;
  });
}

function TaskDetailPanel({
  activeUser,
  onOpenTaskProject,
  onTaskComment,
  onTaskReturn,
  onTaskStatusChange,
  setTaskComment,
  task,
  taskComment
}: {
  activeUser: PublicUser;
  onOpenTaskProject: (task: TaskRecord) => void;
  onTaskComment: (task: TaskRecord) => void;
  onTaskReturn: (task: TaskRecord) => void;
  onTaskStatusChange: (task: TaskRecord, status: TaskRecord["status"]) => void;
  setTaskComment: (value: string) => void;
  task: TaskWithDetails | null;
  taskComment: string;
}) {
  if (!task) {
    return (
      <div className="task-detail">
        <PageStateNotice active state="empty" title="未选择任务" body="选择任务后查看评论、活动和人工确认动作。" />
      </div>
    );
  }

  const canReturn = task.status === "submitted" && (task.confirmerUserId === activeUser.id || task.creatorUserId === activeUser.id);

  return (
    <aside className="task-detail">
      <div className="panel-header compact">
        <div>
          <p className="eyebrow">任务详情</p>
          <h2>{task.title}</h2>
          <p>{task.description}</p>
        </div>
        <span className="status-pill strong">{displayStatus(task.status)}</span>
      </div>
      <div className="detail-grid">
        <SettingsItem title="创建人" value={userName(task.creatorUserId)} enabled />
        <SettingsItem title="负责人" value={userName(task.assigneeUserId)} enabled />
        <SettingsItem title="确认人" value={userName(task.confirmerUserId)} enabled />
        <SettingsItem title="截止时间" value={task.dueAt ? new Date(task.dueAt).toLocaleDateString("zh-CN") : "未设置"} enabled />
      </div>
      {task.returnedReason ? (
        <PageStateNotice active state="normal" title="任务已退回" body={task.returnedReason} />
      ) : null}
      <div className="action-row">
        <button className="secondary-button" onClick={() => onOpenTaskProject(task)}>
          <BriefcaseBusiness size={16} />
          项目
        </button>
        {taskActionButtons(task, onTaskStatusChange)}
        {canReturn ? (
          <button className="secondary-button" onClick={() => onTaskReturn(task)}>
            <XCircle size={16} />
            退回
          </button>
        ) : null}
      </div>
      <div className="task-comment-box">
        <input value={taskComment} onChange={(event) => setTaskComment(event.target.value)} placeholder="添加评论" />
        <button className="secondary-button" onClick={() => onTaskComment(task)}>
          评论
        </button>
      </div>
      <div className="task-detail-columns">
        <div>
          <h3>评论</h3>
          {task.comments.length > 0 ? (
            task.comments.map((comment) => (
              <article className="timeline-row" key={comment.id}>
                <strong>{userName(comment.authorUserId)}</strong>
                <p>{comment.content}</p>
                <small>{new Date(comment.createdAt).toLocaleString("zh-CN")}</small>
              </article>
            ))
          ) : (
            <p className="muted-text">暂无评论</p>
          )}
        </div>
        <div>
          <h3>活动</h3>
          {task.activities.length > 0 ? (
            task.activities.map((activity) => (
              <article className="timeline-row" key={activity.id}>
                <strong>{activityLabel(activity.activityType)}</strong>
                <p>{cleanDisplayText(activity.note)}</p>
                <small>{userName(activity.actorUserId)} · {new Date(activity.createdAt).toLocaleString("zh-CN")}</small>
              </article>
            ))
          ) : (
            <p className="muted-text">暂无活动</p>
          )}
        </div>
      </div>
    </aside>
  );
}

function activityLabel(type: string) {
  const labels: Record<string, string> = {
    created: "创建",
    updated: "更新",
    submitted: "提交",
    confirmed: "确认",
    returned: "退回",
    commented: "评论",
    status_changed: "状态变更"
  };
  return labels[type] ?? type;
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
          <p className="eyebrow">项目文件</p>
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
              <span className="status-pill">{displayStatus(file.status)}</span>
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

function projectName(projects: ProjectSummary[], projectId: string | null | undefined) {
  if (!projectId) {
    return "无项目";
  }

  return projects.find((project) => project.id === projectId)?.title ?? "授权项目";
}

function relatedObjectLabel({
  objectId,
  objectType,
  projects,
  tasks
}: {
  objectId: string | null | undefined;
  objectType: string | null | undefined;
  projects: ProjectSummary[];
  tasks: TaskRecord[];
}) {
  if (!objectType || !objectId) {
    return "未关联业务对象";
  }

  if (objectType === "project") {
    return `关联项目：${projectName(projects, objectId)}`;
  }

  if (objectType === "task") {
    return `关联任务：${tasks.find((task) => task.id === objectId)?.title ?? "授权任务"}`;
  }

  return `关联${objectTypeLabels[objectType] ?? "业务对象"}`;
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
  onOpenDraftObject,
  onOpenKnowledgeWithProject,
  onOpenRelatedObject,
  onRejectDraft,
  onSelectThread,
  onSendMessage,
  selectedThreadId,
  setChatMessage,
  setChatTitle,
  projects,
  tasks,
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
  onOpenDraftObject: (objectType: string | null, objectId: string | null, moduleHint?: ModuleKey | null) => void;
  onOpenKnowledgeWithProject: (projectId: string | null) => void;
  onOpenRelatedObject: (objectType: string | null, objectId: string | null, moduleHint?: ModuleKey | null) => void;
  onRejectDraft: (draft: AiDraftRecord) => void;
  onSelectThread: (threadId: string) => void;
  onSendMessage: () => void;
  selectedThreadId: string | null;
  setChatMessage: (value: string) => void;
  setChatTitle: (value: string) => void;
  projects: ProjectSummary[];
  tasks: TaskRecord[];
  threads: ChatThreadSummary[];
}) {
  const selectedThread = threads.find((thread) => thread.id === selectedThreadId) ?? threads[0] ?? null;
  const selectedDrafts = selectedThread ? aiDrafts.filter((draft) => draft.threadId === selectedThread.id) : [];
  const isSelectedThreadArchived = selectedThread?.status === "archived";
  const relatedTask = selectedThread?.relatedObjectType === "task"
    ? tasks.find((task) => task.id === selectedThread.relatedObjectId) ?? null
    : null;
  const relatedProjectId =
    selectedThread?.relatedObjectType === "project"
      ? selectedThread.relatedObjectId
      : relatedTask?.projectId ?? null;
  const relatedProject = relatedProjectId ? projects.find((project) => project.id === relatedProjectId) ?? null : null;
  const canConfirmDraft = (draft: AiDraftRecord) =>
    draft.status === "draft" &&
    (draft.kind === "chat_summary" || (draft.kind === "task_draft" && canConfirmTask) || (draft.kind === "knowledge_draft" && canConfirmKnowledge));

  return (
    <section className="project-workspace">
      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">协作会话</p>
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
                <span className="status-pill">{displayStatus(thread.status)}</span>
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
            <div className="relationship-bar">
              <span>
                <Link size={15} />
                {relatedObjectLabel({
                  objectId: selectedThread.relatedObjectId,
                  objectType: selectedThread.relatedObjectType,
                  projects,
                  tasks
                })}
              </span>
              {relatedProject ? (
                <button className="secondary-button compact-button" onClick={() => onOpenRelatedObject("project", relatedProject.id, "projects")}>
                  打开项目
                </button>
              ) : null}
              {relatedProjectId ? (
                <button className="secondary-button compact-button" onClick={() => onOpenKnowledgeWithProject(relatedProjectId)}>
                  带项目检索
                </button>
              ) : null}
              {selectedThread.relatedObjectType && selectedThread.relatedObjectId ? (
                <button
                  className="secondary-button compact-button"
                  onClick={() => onOpenRelatedObject(selectedThread.relatedObjectType, selectedThread.relatedObjectId)}
                >
                  打开关联对象
                </button>
              ) : null}
            </div>
            <div className="inline-form">
              <input value={chatMessage} onChange={(event) => setChatMessage(event.target.value)} placeholder="输入工作消息" />
              <button className="primary-button" disabled={isSelectedThreadArchived} onClick={onSendMessage}>
                发送
              </button>
            </div>
            <PageStateNotice
              active={isSelectedThreadArchived}
              state="archived"
              title="会话已归档"
              body="归档会话只保留消息和 AI 来源证据，不再发送新消息或生成新草稿。"
            />
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
                    <span className="status-pill">{displayStatus(message.status)}</span>
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
            <p className="eyebrow">AI 草稿</p>
            <h2>整理与草稿</h2>
            <p>当前用户：{activeUser.displayName}。AI 输出必须人工确认后才能进入正式对象。</p>
          </div>
        </div>
        <div className="action-row">
          <button className="secondary-button" disabled={!selectedThread || isSelectedThreadArchived || messages.length === 0} onClick={() => onCreateDraft("chat_summary")}>
            整理摘要
          </button>
          <button className="secondary-button" disabled={!selectedThread || isSelectedThreadArchived || messages.length === 0} onClick={() => onCreateDraft("task_draft")}>
            任务草稿
          </button>
          <button className="secondary-button" disabled={!selectedThread || isSelectedThreadArchived || messages.length === 0} onClick={() => onCreateDraft("knowledge_draft")}>
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
              <div className="record-row ai-draft-row" key={draft.id}>
                <span>
                  <strong>{draft.title}</strong>
                  <small>{draft.content}</small>
                </span>
                <span className="status-pill">{displayAiKind(draft.kind)}</span>
                <span className="status-pill">{displayStatus(draft.status)}</span>
                <span className="count-pill">{draft.sourceMessageIds.length} 来源</span>
                <button className="secondary-button compact-button" disabled={!canConfirmDraft(draft)} onClick={() => onConfirmDraft(draft)}>
                  确认入库
                </button>
                <button className="secondary-button compact-button" disabled={draft.status !== "draft"} onClick={() => onRejectDraft(draft)}>
                  驳回
                </button>
                <button
                  className="secondary-button compact-button"
                  disabled={!draft.promotedObjectId}
                  onClick={() => onOpenDraftObject(draft.promotedObjectType, draft.promotedObjectId)}
                >
                  打开结果
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
  onSelectQueryProject,
  projects,
  projectMemories,
  queryProject,
  queryResults,
  queryProjectId,
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
  onSelectQueryProject: (projectId: string | null) => void;
  projects: ProjectSummary[];
  projectMemories: ProjectMemoryRecord[];
  queryProject: ProjectSummary | null;
  queryResults: KnowledgeSearchResult[];
  queryProjectId: string | null;
  setKnowledgeQuery: (value: string) => void;
}) {
  const reviewQueue = knowledgeItems.filter((item) => item.status === "submitted_for_review");
  const publishedItems = knowledgeItems.filter((item) => item.status === "published");

  return (
    <section className="content-grid">
      <div className="panel work-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">知识检索</p>
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
        <div className="scope-note scope-selector">
          <span>当前检索范围</span>
          <select value={queryProjectId ?? ""} onChange={(event) => onSelectQueryProject(event.target.value || null)}>
            <option value="">全部可见范围</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
          <strong>{queryProject ? queryProject.title : "全部可见范围"}</strong>
        </div>
        <PageStateNotice
          active={!canReviewKnowledge}
          state="no-permission"
          title="当前账号不能发布知识"
          body="待审核知识必须由具备发布权限的人类处理，AI 不能自动发布、驳回或归档。"
        />
        <div className="record-list">
          {queryResults.length > 0 ? (
            queryResults.map((item) => (
              <div className="record-row" key={`${item.type}:${item.id}`}>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.content}</small>
                  <small>
                    证据：{item.sourceEvidence.map((evidence) => displaySourceEvidence(evidence.sourceType, evidence.title)).join(" / ")}
                  </small>
                </span>
                <span className="status-pill">{displaySourceType(item.type)}</span>
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
                <span className="status-pill">{displayStatus(item.status)}</span>
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
            <PageStateNotice active={!isLoading} state="empty" title="暂无待审核知识" body="AI 知识草稿确认后会进入人工审核，不会自动发布。" />
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">版本与证据</p>
            <h2>知识条目</h2>
            <p>显示草稿、待审核、已发布、已驳回、已归档状态、版本历史和来源证据。</p>
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
                    证据：{item.sourceEvidence.map((evidence) => displaySourceEvidence(evidence.sourceType, evidence.title)).join(" / ")}
                  </small>
                  <small>
                    版本：{(item.versions ?? []).map((version) => `v${version.version} ${displayStatus(version.status)}`).join(" · ") || `v${item.currentVersion}`}
                  </small>
                </span>
                <span className="status-pill">{displayStatus(item.status)}</span>
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
                <PageStateNotice
                  active={item.status === "archived"}
                  state="archived"
                  title="知识已归档"
                  body="归档知识不会进入检索结果、AI 输入上下文或发布证据。"
                />
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
                <span className="status-pill">{projectName(projects, item.projectId)}</span>
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

function ContractView({
  aiFailure,
  canCreateContract,
  canConfirmRisk,
  canReviseContract,
  canSubmitApproval,
  canTrackExecution,
  contractEntryMethod,
  contractError,
  contractFileName,
  contractRevisionText,
  contractText,
  contractTitle,
  contracts,
  executionTitle,
  isAiGenerating,
  isLoading,
  onConfirmRisks,
  onCreateContract,
  onExecutionEvent,
  onOpenApproval,
  onRunAiReview,
  onRunSecondReview,
  onSelectContract,
  onSubmitApproval,
  onSubmitRevision,
  selectedContractId,
  setContractEntryMethod,
  setContractFileName,
  setContractRevisionText,
  setContractText,
  setContractTitle,
  setExecutionTitle
}: {
  aiFailure: string | null;
  canCreateContract: boolean;
  canConfirmRisk: boolean;
  canReviseContract: boolean;
  canSubmitApproval: boolean;
  canTrackExecution: boolean;
  contractEntryMethod: ContractEntryMethod;
  contractError: string | null;
  contractFileName: string;
  contractRevisionText: string;
  contractText: string;
  contractTitle: string;
  contracts: ContractWithDetails[];
  executionTitle: string;
  isAiGenerating: boolean;
  isLoading: boolean;
  onConfirmRisks: (contract: ContractWithDetails) => void;
  onCreateContract: () => void;
  onExecutionEvent: (contract: ContractWithDetails) => void;
  onOpenApproval: (approvalId: string) => void;
  onRunAiReview: (contract: ContractWithDetails) => void;
  onRunSecondReview: (contract: ContractWithDetails) => void;
  onSelectContract: (contractId: string) => void;
  onSubmitApproval: (contract: ContractWithDetails) => void;
  onSubmitRevision: (contract: ContractWithDetails) => void;
  selectedContractId: string | null;
  setContractEntryMethod: (value: ContractEntryMethod) => void;
  setContractFileName: (value: string) => void;
  setContractRevisionText: (value: string) => void;
  setContractText: (value: string) => void;
  setContractTitle: (value: string) => void;
  setExecutionTitle: (value: string) => void;
}) {
  const selectedContract = contracts.find((contract) => contract.id === selectedContractId) ?? contracts[0] ?? null;
  const latestReview = selectedContract?.reviews[0] ?? null;
  const latestVersion = selectedContract?.versions[0] ?? null;
  const allRisksConfirmed = latestReview?.risks.every((risk) => risk.humanConfirmed && risk.selectedOption) ?? false;
  const canStartInitialReview = Boolean(selectedContract && ["draft", "revision_required"].includes(selectedContract.status));
  const canStartSecondReview = Boolean(selectedContract && selectedContract.currentVersion > 1 && selectedContract.status === "revision_required");
  const canSubmitApprovalNow = Boolean(
    selectedContract &&
      canSubmitApproval &&
      selectedContract.currentVersion > 1 &&
      latestReview?.reviewType === "second" &&
      allRisksConfirmed
  );

  return (
    <section className="contract-workspace">
      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">上传 / 粘贴</p>
            <h2>合同入口</h2>
            <p>入口固定为上传文本或粘贴文本，原文和来源证据会进入版本历史。</p>
          </div>
          <FileText size={22} />
        </div>
        <PageStateNotice state="loading" title="正在加载合同" body="正在读取当前账号有权限访问的合同。" active={isLoading} />
        <PageStateNotice state="error" title="合同操作失败" body={contractError ?? ""} active={Boolean(contractError)} />
        <PageStateNotice
          state="no-permission"
          title="无合同创建权限"
          body="当前账号可查看授权合同；新建合同需要合同发起权限。"
          active={!canCreateContract}
        />
        {canCreateContract ? (
          <div className="contract-entry">
            <div className="segmented-control">
              <button className={contractEntryMethod === "paste" ? "active" : ""} onClick={() => setContractEntryMethod("paste")}>
                粘贴
              </button>
              <button className={contractEntryMethod === "upload" ? "active" : ""} onClick={() => setContractEntryMethod("upload")}>
                上传
              </button>
            </div>
            <input value={contractTitle} onChange={(event) => setContractTitle(event.target.value)} placeholder="合同名称" />
            {contractEntryMethod === "upload" ? (
              <input value={contractFileName} onChange={(event) => setContractFileName(event.target.value)} placeholder="文件名" />
            ) : null}
            <textarea value={contractText} onChange={(event) => setContractText(event.target.value)} placeholder="合同原文" rows={7} />
            <button className="primary-button" disabled={contractText.trim().length === 0} onClick={onCreateContract}>
              <Upload size={16} />
              创建合同
            </button>
          </div>
        ) : null}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">合同列表</p>
            <h2>版本与状态</h2>
            <p>无权限用户不会收到合同正文、风险、来源证据或 AI 上下文。</p>
          </div>
        </div>
        <div className="record-list">
          {contracts.length > 0 ? (
            contracts.map((contract) => (
              <button
                className={selectedContract?.id === contract.id ? "record-row active" : "record-row"}
                key={contract.id}
                onClick={() => onSelectContract(contract.id)}
              >
                <span>
                  <strong>{contract.title}</strong>
                  <small>v{contract.currentVersion} · {organizationName(contract.organizationId)}</small>
                </span>
                <span className="status-pill">{displayStatus(contract.status)}</span>
                <span className="count-pill">{contract.reviews.length} 审查</span>
              </button>
            ))
          ) : (
            <PageStateNotice active={!isLoading} state="empty" title="暂无可见合同" body="创建合同或获得授权后会显示在这里。" />
          )}
        </div>
      </div>

      <div className="panel contract-detail-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">AI 审查与人工确认</p>
            <h2>{selectedContract?.title ?? "未选择合同"}</h2>
            <p>AI 只列风险、标注原文和给 A/B/C 方案，不确认风险、不选择方案、不提交审批。</p>
          </div>
          {selectedContract ? <span className="status-pill strong">{displayStatus(selectedContract.status)}</span> : null}
        </div>
        {selectedContract ? (
          <>
            <PageStateNotice
              active={selectedContract.status === "archived"}
              state="archived"
              title="合同已归档"
              body="归档合同保留版本、审查、审批和执行证据，不再允许新增 AI 审查或提交动作。"
            />
            <PageStateNotice
              active={selectedContract.status === "completed"}
              state="normal"
              title="合同已完成"
              body="完成状态只展示证据链和执行记录，后续动作必须继续由人类发起。"
            />
            <div className="detail-grid">
              <SettingsItem title="当前版本" value={`v${selectedContract.currentVersion}`} enabled />
              <SettingsItem title="入口来源" value={displayEntryMethod(latestVersion?.entryMethod)} enabled />
              <SettingsItem title="执行状态" value={displayStatus(selectedContract.executionStatus)} enabled />
              <SettingsItem title="审批边界" value={selectedContract.approvalHandoffId ? "已提交" : "未提交"} enabled />
            </div>
            <div className="action-row">
              <button className="secondary-button" disabled={!canStartInitialReview || isAiGenerating} onClick={() => onRunAiReview(selectedContract)}>
                <Brain size={16} />
                AI 审查
              </button>
              <button className="secondary-button" disabled={!canConfirmRisk || !latestReview || allRisksConfirmed} onClick={() => onConfirmRisks(selectedContract)}>
                人工确认风险
              </button>
              <button className="secondary-button" disabled={!canStartSecondReview || isAiGenerating} onClick={() => onRunSecondReview(selectedContract)}>
                二次审查
              </button>
              <button className="secondary-button" disabled={!canSubmitApprovalNow} onClick={() => onSubmitApproval(selectedContract)}>
                提交审批边界
              </button>
            </div>
            <PageStateNotice active={isAiGenerating} state="AI_Generating" title="AI 正在审查" body="审查结果只会生成风险建议和原文标注。" />
            <PageStateNotice active={Boolean(aiFailure)} state="AI_Failed" title="AI 审查失败" body={aiFailure ?? ""} />
            <PageStateNotice
              active={selectedContract.currentVersion > 1 && latestReview?.reviewType !== "second"}
              state="no-permission"
              title="修改版本需要二次审查"
              body="修改后的合同版本必须完成二次审查并人工确认风险后，才能提交审批边界。"
            />
            {latestReview ? (
              <div className="contract-review">
                <div className="section-title">
                  <strong>{latestReview.reviewType === "second" ? "二次审查" : "初次审查"} · {displayPriority(latestReview.riskLevel)}</strong>
                  <span>{latestReview.frameworkVersion}</span>
                </div>
                <p>{latestReview.summary}</p>
                <div className="record-list">
                  {latestReview.risks.map((risk) => (
                    <article className="risk-row" key={risk.id}>
                      <div>
                        <strong>{risk.title}</strong>
                        <small>{risk.explanation}</small>
                        <mark>{risk.sourceQuote}</mark>
                        <small>A：{risk.options.A}</small>
                        <small>B：{risk.options.B}</small>
                        <small>C：{risk.options.C}</small>
                      </div>
                      <span className={`status-pill ${risk.severity}`}>{displayPriority(risk.severity)}</span>
                      <span className="count-pill">{risk.humanConfirmed ? `人工选择 ${risk.selectedOption}` : "待人工确认"}</span>
                    </article>
                  ))}
                </div>
              </div>
            ) : (
              <PageStateNotice active state="empty" title="尚未审查" body="发起 AI 审查后会显示风险清单、原文标注和 A/B/C 方案。" />
            )}
          </>
        ) : null}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">修改与二次审查</p>
            <h2>合同修改</h2>
            <p>首次风险确认后才能提交修改版本；修改版本必须二次审查。</p>
          </div>
        </div>
        {selectedContract ? (
          <div className="contract-entry">
            <textarea value={contractRevisionText} onChange={(event) => setContractRevisionText(event.target.value)} placeholder="修改后的合同原文" rows={6} />
            <button
              className="primary-button"
              disabled={!canReviseContract || selectedContract.status !== "revision_required" || contractRevisionText.trim().length === 0}
              onClick={() => onSubmitRevision(selectedContract)}
            >
              提交修改版本
            </button>
          </div>
        ) : null}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">版本历史与执行跟踪</p>
            <h2>证据链</h2>
            <p>审批提交只记录边界交接；执行跟踪只记录提醒、事项和状态。</p>
          </div>
        </div>
        {selectedContract ? (
          <>
            <div className="record-list">
              {selectedContract.versions.map((version) => (
                <div className="record-row" key={version.id}>
                  <span>
                    <strong>v{version.version} · {version.title}</strong>
                    <small>{version.originalText}</small>
                    <small>来源：{version.sourceEvidence.map((source) => displaySourceEvidence(source.sourceType, source.fileName)).join(" / ")}</small>
                  </span>
                  <span className="status-pill">{displayEntryMethod(version.entryMethod)}</span>
                </div>
              ))}
            </div>
            <div className="inline-form">
              <input value={executionTitle} onChange={(event) => setExecutionTitle(event.target.value)} placeholder="执行提醒标题" />
              <button
                className="secondary-button"
                disabled={!canTrackExecution || !["approval_pending", "approved", "execution_tracking"].includes(selectedContract.status)}
                onClick={() => onExecutionEvent(selectedContract)}
              >
                记录执行提醒
              </button>
            </div>
            <div className="record-list">
              {selectedContract.approvalHandoffs.map((handoff) => (
                <div className="record-row" key={handoff.id}>
                  <span>
                    <strong>审批边界提交</strong>
                    <small>{cleanDisplayText(handoff.reason)}</small>
                  </span>
                  <span className="status-pill">{displayStatus(handoff.status)}</span>
                  <span className="count-pill">{handoff.approvalEngineImplemented ? "已创建审批" : "边界记录"}</span>
                  <button
                    className="secondary-button compact-button"
                    disabled={!handoff.approvalId}
                    onClick={() => handoff.approvalId ? onOpenApproval(handoff.approvalId) : undefined}
                  >
                    打开审批
                  </button>
                </div>
              ))}
              {selectedContract.executionEvents.map((event) => (
                <div className="record-row" key={event.id}>
                  <span>
                    <strong>{event.title}</strong>
                    <small>{event.notes}</small>
                  </span>
                  <span className="status-pill">{executionEventLabels[event.eventType] ?? displaySourceType(event.eventType)}</span>
                  <span className="count-pill">{displayStatus(event.status)}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function ApprovalView({
  activeUser,
  approvalError,
  approvals,
  approvalTargetUserId,
  canAddSign,
  canApprove,
  canReject,
  canReturn,
  canTransfer,
  isLoading,
  onAction,
  onOpenSourceContract,
  onSelectApproval,
  selectedApprovalId,
  setApprovalTargetUserId
}: {
  activeUser: PublicUser;
  approvalError: string | null;
  approvals: ApprovalWithDetails[];
  approvalTargetUserId: string;
  canAddSign: boolean;
  canApprove: boolean;
  canReject: boolean;
  canReturn: boolean;
  canTransfer: boolean;
  isLoading: boolean;
  onAction: (approval: ApprovalWithDetails, action: "approve" | "reject" | "return" | "transfer" | "add-sign") => void;
  onOpenSourceContract: (contractId: string) => void;
  onSelectApproval: (approvalId: string) => void;
  selectedApprovalId: string | null;
  setApprovalTargetUserId: (value: string) => void;
}) {
  const selectedApproval = approvals.find((approval) => approval.id === selectedApprovalId) ?? approvals[0] ?? null;
  const currentNode = selectedApproval?.nodes.find((node) => node.id === selectedApproval.currentNodeId) ?? null;
  const isCurrentHandler = selectedApproval?.currentApproverUserId === activeUser.id;
  const isActionableApproval = selectedApproval?.status === "processing";
  const humanApprovers = seedUsers.filter((user) =>
    rolePolicies[user.role].approval.some((permission) =>
      ["approve_current_node", "reject_current_node", "return_for_revision"].includes(permission)
    )
  );

  return (
    <section className="approval-workspace">
      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">审批列表</p>
            <h2>人工审批实例</h2>
            <p>列表只返回当前账号有权限查看的审批；无权限详情不会泄露来源合同。</p>
          </div>
          <ClipboardList size={22} />
        </div>
        <PageStateNotice state="loading" title="正在加载审批" body="正在读取审批实例、节点和当前处理人。" active={isLoading} />
        <PageStateNotice state="error" title="审批操作失败" body={approvalError ?? ""} active={Boolean(approvalError)} />
        <div className="record-list">
          {approvals.length > 0 ? (
            approvals.map((approval) => (
              <button
                className={selectedApproval?.id === approval.id ? "record-row active" : "record-row"}
                key={approval.id}
                onClick={() => onSelectApproval(approval.id)}
              >
                <span>
                  <strong>{approval.title}</strong>
                  <small>{approval.sourceSummary.title} · 当前：{approval.currentApprover?.displayName ?? "无"}</small>
                </span>
                <span className="status-pill">{displayStatus(approval.status)}</span>
                <span className="count-pill">{approval.nodes.length} 节点</span>
              </button>
            ))
          ) : (
            <PageStateNotice active={!isLoading} state="empty" title="暂无可见审批" body="合同提交审批后会在当前处理人和授权人员列表中显示。" />
          )}
        </div>
      </div>

      <div className="panel approval-detail-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">当前节点</p>
            <h2>{selectedApproval?.title ?? "未选择审批"}</h2>
            <p>同意、驳回、退回、转交和加签都必须由当前节点人类处理人执行。</p>
          </div>
          {selectedApproval ? <span className="status-pill strong">{displayStatus(selectedApproval.status)}</span> : null}
        </div>

        {selectedApproval ? (
          <>
            <PageStateNotice
              active={selectedApproval.status === "expired"}
              state="expired"
              title="审批已过期"
              body="过期审批不会显示可执行节点动作；重新发起必须由有权限的人类完成。"
            />
            <div className="detail-grid">
              <SettingsItem title="来源对象" value={selectedApproval.sourceSummary.title} enabled />
              <SettingsItem title="来源状态" value={displayStatus(selectedApproval.sourceSummary.status)} enabled />
              <SettingsItem title="当前处理人" value={selectedApproval.currentApprover?.displayName ?? "无"} enabled={Boolean(selectedApproval.currentApprover)} />
              <SettingsItem title="结果写回" value={displayResultWriteback(selectedApproval.resultWritebackStatus)} enabled={Boolean(selectedApproval.resultWritebackStatus)} />
            </div>
            <div className="relationship-bar">
              <span>
                <Link size={15} />
                来源{objectTypeLabels[selectedApproval.sourceSummary.objectType] ?? "业务对象"}：{selectedApproval.sourceSummary.title}
              </span>
              <button className="secondary-button compact-button" onClick={() => onOpenSourceContract(selectedApproval.sourceSummary.objectId)}>
                返回来源合同
              </button>
            </div>

            <PageStateNotice
              active={selectedApproval.status === "processing" && !isCurrentHandler}
              state="no-permission"
              title="当前账号不是当前节点处理人"
              body="你可以查看授权范围内的审批详情，但不能执行当前节点动作。"
            />

            <div className="approval-current-node">
              <div>
                <strong>{currentNode?.name ?? "无当前节点"}</strong>
                <small>{currentNode ? `${userName(currentNode.approverUserId)} · ${displayStatus(currentNode.status)}` : "审批已结束或无当前处理人"}</small>
              </div>
              <span className="status-pill">{displayStatus(currentNode?.status ?? selectedApproval.status)}</span>
            </div>

            {isActionableApproval ? (
              <>
                <div className="inline-form">
                  <select value={approvalTargetUserId} onChange={(event) => setApprovalTargetUserId(event.target.value)}>
                    {humanApprovers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.displayName}
                      </option>
                    ))}
                  </select>
                  <button className="secondary-button" disabled={!isCurrentHandler || !canTransfer} onClick={() => onAction(selectedApproval, "transfer")}>
                    转交
                  </button>
                  <button className="secondary-button" disabled={!isCurrentHandler || !canAddSign} onClick={() => onAction(selectedApproval, "add-sign")}>
                    加签
                  </button>
                </div>

                <div className="action-row">
                  <button className="primary-button" disabled={!isCurrentHandler || !canApprove} onClick={() => onAction(selectedApproval, "approve")}>
                    <CheckSquare size={16} />
                    同意
                  </button>
                  <button className="secondary-button" disabled={!isCurrentHandler || !canReject} onClick={() => onAction(selectedApproval, "reject")}>
                    <XCircle size={16} />
                    驳回
                  </button>
                  <button className="secondary-button" disabled={!isCurrentHandler || !canReturn} onClick={() => onAction(selectedApproval, "return")}>
                    <Clock size={16} />
                    退回
                  </button>
                </div>
              </>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">节点轨迹</p>
            <h2>处理记录</h2>
            <p>每个节点和动作都进入审计；AI 只能提供建议，不能成为审批人或执行动作。</p>
          </div>
        </div>
        {selectedApproval ? (
          <>
            <div className="record-list">
              {selectedApproval.nodes.map((node) => (
                <div className="record-row" key={node.id}>
                  <span>
                    <strong>{node.sequence}. {node.name}</strong>
                    <small>{userName(node.approverUserId)} · {node.decisionReason ?? "等待处理"}</small>
                  </span>
                  <span className="status-pill">{displayStatus(node.status)}</span>
                  <span className="count-pill">{node.decidedAt ? "已处理" : "待处理"}</span>
                </div>
              ))}
            </div>
            <div className="record-list">
              {selectedApproval.actions.length > 0 ? (
                selectedApproval.actions.map((action) => (
                  <div className="record-row" key={action.id}>
                    <span>
                      <strong>{displayApprovalAction(action.action)}</strong>
                    <small>{userName(action.actorUserId)}{action.targetUserId ? ` -> ${userName(action.targetUserId)}` : ""} · {cleanDisplayText(action.reason)}</small>
                    </span>
                    <span className="status-pill">{displayApprovalAction(action.action)}</span>
                  </div>
                ))
              ) : (
                <div className="empty-state">暂无审批动作记录。</div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function ModuleStatusView({ moduleKey, moduleName }: { moduleKey: ModuleKey; moduleName: string }) {
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
          body="没有可处理实例时保留入口、通知和状态提示，不创建合同或审批正式动作。"
        />
        <PageStateNotice
          active={moduleKey === "contracts"}
          state="expired"
          title="期限状态已预留"
          body="合同期限和执行跟踪按合同状态展示，未授权用户不会看到执行详情。"
        />
        <PageStateNotice
          active={moduleKey === "approvals"}
          state="no-permission"
          title="审批必须由当前节点人类处理"
          body="没有当前节点实例时不会显示审批操作按钮，AI 不能成为审批人。"
        />
        {moduleKey === "approvals" ? (
          <div className="stage-checklist">
            <span>审批发起：已接入</span>
            <span>当前节点审批人：已接入</span>
            <span>同意 / 驳回 / 退回：已接入</span>
            <span>转交 / 加签：已接入，AI 不能自动审批</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function LoginScreen({ onLogin }: { onLogin: (username: string, password: string) => Promise<void> }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit() {
    setError(null);
    setIsSubmitting(true);

    try {
      await onLogin(username, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "登录失败");
    } finally {
      setIsSubmitting(false);
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
          <p className="login-copy">输入用户名和密码进入系统。登录后将按角色进入对应工作区。</p>
          <PageStateNotice active={isSubmitting} state="loading" title="正在登录" body="正在校验账号权限。" />
          <PageStateNotice active={Boolean(error)} state="error" title="登录失败" body={error ?? ""} />
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
          <button className="primary-button login-submit" disabled={isSubmitting} type="submit">
            登录
          </button>
        </form>
        <div className="login-policy">
          <h2>账号安全</h2>
          <ul className="guard-list">
            <li>登录后按角色进入工作区</li>
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
