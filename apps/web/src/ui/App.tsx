import {
  Bell,
  BookOpen,
  BriefcaseBusiness,
  CheckSquare,
  ClipboardList,
  FileText,
  Home,
  LayoutDashboard,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  Users
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
  type KnowledgeItemRecord,
  type KnowledgeSearchResult,
  type ModuleKey,
  type Organization,
  type PermissionSummary,
  type ProjectMemoryRecord,
  type ProjectRecord,
  type PublicUser,
  type TaskRecord
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
    stage: "DEV-008 进行中",
    summary: "项目记忆检索与自动回用正在接入，聊天和项目任务闭环继续作为底座。"
  },
  workbench: {
    stage: "DEV-005 待开发",
    summary: "我的工作台将在项目、任务、审批真实数据接入后形成待办。"
  },
  projects: {
    stage: "DEV-005 进行中",
    summary: "项目列表、创建、成员、状态和任务关联已进入真实接口。"
  },
  tasks: {
    stage: "DEV-005 进行中",
    summary: "任务列表、创建、负责人提交和人工确认已进入真实接口。"
  },
  chat: {
    stage: "DEV-008 进行中",
    summary: "聊天会话、消息、AI 草稿、人工确认入库和记忆上下文回用已进入真实接口。"
  },
  knowledge: {
    stage: "DEV-008 进行中",
    summary: "正式知识和项目记忆支持权限过滤检索，并可作为 AI 草稿上下文。"
  },
  contracts: {
    stage: "DEV-009 待开发",
    summary: "合同上传、AI 审查、人工确认、二次审查和执行跟踪尚未进入代码开发。"
  },
  approvals: {
    stage: "DEV-010 待开发",
    summary: "审批发起、当前节点审批人、同意、驳回、退回、转交和加签尚未进入代码开发。"
  },
  settings: {
    stage: "DEV-004 已完成",
    summary: "审计查询权限边界已接入，配置写入仍待真实后台持久化。"
  }
};

const stageGateItems = [
  { scope: "认证登录", owner: "API / Web", status: "已验证", stage: "DEV-002" },
  { scope: "角色与菜单权限", owner: "API / Web", status: "已验证", stage: "DEV-002" },
  { scope: "组织数据范围", owner: "API", status: "已验证", stage: "DEV-002" },
  { scope: "统一权限中间层", owner: "API / Web", status: "已验证", stage: "DEV-003" },
  { scope: "文件与 AI 权限", owner: "API", status: "已验证", stage: "DEV-003" },
  { scope: "审计日志基础设施", owner: "API", status: "已验证", stage: "DEV-004" },
  { scope: "项目与任务闭环", owner: "API / Web", status: "已验证", stage: "DEV-005" },
  { scope: "聊天与 AI 草稿", owner: "API / Web", status: "已验证", stage: "DEV-006" },
  { scope: "AI 草稿确认入库", owner: "API / Web", status: "已验证", stage: "DEV-007" },
  { scope: "记忆检索与回用", owner: "API / Web", status: "开发中", stage: "DEV-008" },
  { scope: "审批真实流程", owner: "未开发", status: "待开发", stage: "DEV-010" }
];

const auditReadinessItems = [
  "登录成功/失败、无权限访问和关键未实现动作已写 AuditLog",
  "对象审计和用户审计查询已接入权限控制",
  "项目、合同、任务、审批事件未开发前不能出现在最近审计",
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
  const [knowledgeItems, setKnowledgeItems] = useState<KnowledgeItemRecord[]>([]);
  const [projectMemories, setProjectMemories] = useState<ProjectMemoryRecord[]>([]);
  const [knowledgeQuery, setKnowledgeQuery] = useState("");
  const [knowledgeResults, setKnowledgeResults] = useState<KnowledgeSearchResult[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [chatTitle, setChatTitle] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [workError, setWorkError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
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
      authorizedRequest<{ items: KnowledgeItemRecord[] }>("/knowledge/items"),
      authorizedRequest<{ items: ProjectMemoryRecord[] }>("/memory/items")
    ]);
    setKnowledgeItems(knowledgeResult.items);
    setProjectMemories(memoryResult.items);
  }

  useEffect(() => {
    if (!session) {
      setProjects([]);
      setTasks([]);
      setChatThreads([]);
      setChatMessages([]);
      setAiDrafts([]);
      setKnowledgeItems([]);
      setProjectMemories([]);
      setKnowledgeResults([]);
      setSelectedProjectId(null);
      setSelectedThreadId(null);
      return;
    }

    void Promise.all([refreshWorkData(), refreshChatData(), refreshKnowledgeData()]).catch((error) => {
      const message = error instanceof Error ? error.message : "数据加载失败";
      setWorkError(message);
      setChatError(message);
    });
  }, [session?.token]);

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
    await refreshWorkData();
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
    await refreshWorkData();
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
    await refreshWorkData();
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
    await refreshWorkData();
  }

  async function changeProjectStatus(project: ProjectSummary, status: ProjectRecord["status"]) {
    setWorkError(null);
    await authorizedRequest<{ project: ProjectSummary }>(`/projects/${project.id}/status`, {
      method: "POST",
      body: JSON.stringify({
        status
      })
    });
    await refreshWorkData();
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
    await refreshChatData(result.thread.id);
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
    await refreshChatData(selectedThreadId);
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
    await authorizedRequest<{ draft: AiDraftRecord }>(`/chat/threads/${selectedThreadId}/ai/${path}`, {
      method: "POST",
      body: JSON.stringify({})
    });
    await refreshChatData(selectedThreadId);
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
    await Promise.all([refreshWorkData(), refreshChatData(selectedThreadId), refreshKnowledgeData()]);
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
  const currentModule = activeModuleAllowed ? activeModule : "dashboard";
  const currentModuleName = platformModules.find((item) => item.key === currentModule)?.name ?? "首页";
  const dataOrganizations = session.dataOrganizations;
  const canOpenSettings = canManageOrganizations(activeUser.role) || canManageRoles(activeUser.role);

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
            <p className="eyebrow">已进入 DEV-008：项目记忆检索与回用</p>
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
            <button className="icon-button" aria-label="通知">
              <Bell size={18} />
            </button>
          </div>
        </header>

        {currentModule === "dashboard" ? (
          <DashboardView
            activeUser={activeUser}
            canOpenSettings={canOpenSettings}
            dataOrganizations={dataOrganizations}
            onOpenApprovals={() => setActiveModule("approvals")}
            permissions={session.permissions}
            visibleModuleCount={visibleModules.length}
          />
        ) : currentModule === "projects" || currentModule === "tasks" ? (
          <ProjectTaskView
            activeUser={activeUser}
            canCreateProject={session.permissions.operations.includes("create_project")}
            canCreateTask={session.permissions.operations.includes("create_task")}
            error={workError}
            onAddMember={() => {
              void addMemberToSelectedProject().catch((error) => {
                setWorkError(error instanceof Error ? error.message : "添加成员失败");
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
            projectTitle={projectTitle}
            projects={projects}
            selectedProjectId={selectedProjectId}
            setProjectTitle={setProjectTitle}
            setTaskTitle={setTaskTitle}
            taskTitle={taskTitle}
            tasks={tasks}
          />
        ) : currentModule === "chat" ? (
          <ChatView
            activeUser={activeUser}
            aiDrafts={aiDrafts}
            canConfirmKnowledge={session.permissions.operations.includes("publish_knowledge")}
            canConfirmTask={session.permissions.operations.includes("create_task") && projects.length > 0}
            chatMessage={chatMessage}
            chatTitle={chatTitle}
            error={chatError}
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
            error={knowledgeError}
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
            setKnowledgeQuery={setKnowledgeQuery}
          />
        ) : currentModule === "settings" && canOpenSettings ? (
          <SettingsView activeUser={activeUser} permissions={session.permissions} visibleModuleCount={visibleModules.length} />
        ) : (
          <ModuleStatusView moduleKey={currentModule} moduleName={currentModuleName} />
        )}
      </main>
    </div>
  );
}

function DashboardView({
  activeUser,
  canOpenSettings,
  dataOrganizations,
  onOpenApprovals,
  permissions,
  visibleModuleCount
}: {
  activeUser: PublicUser;
  canOpenSettings: boolean;
  dataOrganizations: Organization[];
  onOpenApprovals: () => void;
  permissions: PermissionSummary;
  visibleModuleCount: number;
}) {
  return (
    <>
      <section className="metric-grid" aria-label="核心指标">
        <MetricCard title="当前阶段" value="DEV-008" helper="项目记忆检索与回用" />
        <MetricCard title="可见菜单" value={String(visibleModuleCount)} helper="按角色裁剪" />
        <MetricCard title="可见组织" value={String(dataOrganizations.length)} helper={rolePolicies[activeUser.role].dataScope} />
        <MetricCard title="审计查询" value="已接入" helper="对象 / 用户 / 全局审计" />
      </section>

      <section className="content-grid">
        <div className="panel work-panel">
          <div className="panel-header">
            <div>
              <h2>阶段门检查</h2>
              <p>这里只展示已验证范围和明确未开发范围，不展示模拟业务单据。</p>
            </div>
            <button className="secondary-button" onClick={onOpenApprovals}>
              <ClipboardList size={17} />
              查看审批阶段
            </button>
          </div>
          <div className="table" role="table" aria-label="阶段门检查">
            <div className="table-row table-head" role="row">
              <span>范围</span>
              <span>责任边界</span>
              <span>状态</span>
              <span>阶段</span>
            </div>
            {stageGateItems.map((item) => (
              <div className="table-row" role="row" key={item.scope}>
                <span>{item.scope}</span>
                <span>{item.owner}</span>
                <span className={item.status === "已验证" ? "status-pass" : "status-pending"}>{item.status}</span>
                <strong>{item.stage}</strong>
              </div>
            ))}
          </div>
        </div>

        <BoundaryPanel />
        <OrganizationPanel dataOrganizations={dataOrganizations} />
        <PermissionPanel permissions={permissions} />
        <AuditPreviewPanel />

        {canOpenSettings ? (
          <SettingsView activeUser={activeUser} permissions={permissions} visibleModuleCount={visibleModuleCount} />
        ) : null}
      </section>
    </>
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
        <span>操作权限：{permissions.operations.length}</span>
        <span>文件权限：{permissions.files.length}</span>
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
  permissions,
  visibleModuleCount
}: {
  activeUser: PublicUser;
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
        <SettingsItem title="操作权限" value={`${permissions.operations.length} 项`} enabled />
        <SettingsItem title="文件权限" value={`${permissions.files.length} 项`} enabled />
        <SettingsItem title="AI 权限" value={`${permissions.ai.length} 项`} enabled />
        <SettingsItem title="数据范围" value={permissions.dataScope} enabled />
        <SettingsItem title="策略版本" value={permissions.policyVersion} enabled />
      </div>
    </div>
  );
}

function ProjectTaskView({
  activeUser,
  canCreateProject,
  canCreateTask,
  error,
  onAddMember,
  onCreateProject,
  onCreateTask,
  onProjectStatusChange,
  onSelectProject,
  onTaskStatusChange,
  projectTitle,
  projects,
  selectedProjectId,
  setProjectTitle,
  setTaskTitle,
  taskTitle,
  tasks
}: {
  activeUser: PublicUser;
  canCreateProject: boolean;
  canCreateTask: boolean;
  error: string | null;
  onAddMember: () => void;
  onCreateProject: () => void;
  onCreateTask: () => void;
  onProjectStatusChange: (project: ProjectSummary, status: ProjectRecord["status"]) => void;
  onSelectProject: (projectId: string) => void;
  onTaskStatusChange: (task: TaskRecord, status: TaskRecord["status"]) => void;
  projectTitle: string;
  projects: ProjectSummary[];
  selectedProjectId: string | null;
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
            <div className="empty-state">当前没有可见项目。</div>
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
            <div className="empty-state">当前项目没有任务。</div>
          )}
        </div>
      </div>
    </section>
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
  canConfirmKnowledge,
  canConfirmTask,
  chatMessage,
  chatTitle,
  error,
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
  canConfirmKnowledge: boolean;
  canConfirmTask: boolean;
  chatMessage: string;
  chatTitle: string;
  error: string | null;
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
            <div className="empty-state">当前没有可见会话。</div>
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
                <div className="empty-state">当前会话没有消息。</div>
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
            <div className="empty-state">还没有 AI 草稿。先发送消息，再生成草稿。</div>
          )}
        </div>
      </div>
    </section>
  );
}

function KnowledgeView({
  error,
  knowledgeItems,
  knowledgeQuery,
  onQuery,
  projectMemories,
  queryProject,
  queryResults,
  setKnowledgeQuery
}: {
  error: string | null;
  knowledgeItems: KnowledgeItemRecord[];
  knowledgeQuery: string;
  onQuery: () => void;
  projectMemories: ProjectMemoryRecord[];
  queryProject: ProjectSummary | null;
  queryResults: KnowledgeSearchResult[];
  setKnowledgeQuery: (value: string) => void;
}) {
  return (
    <section className="content-grid">
      <div className="panel work-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">DEV-008 检索</p>
            <h2>知识与记忆检索</h2>
            <p>检索只返回当前账号有权限读取的正式知识和项目记忆。</p>
          </div>
        </div>
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
                </span>
                <span className="status-pill">{item.type}</span>
                <span className="count-pill">{item.relevanceScore} 分</span>
              </div>
            ))
          ) : (
            <div className="empty-state">输入关键词后检索。没有结果时不会编造知识。</div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">正式知识</p>
            <h2>知识条目</h2>
            <p>人工确认后的知识可被检索，也可作为后续 AI 草稿上下文。</p>
          </div>
        </div>
        <div className="record-list">
          {knowledgeItems.length > 0 ? (
            knowledgeItems.map((item) => (
              <div className="record-row" key={item.id}>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.content}</small>
                </span>
                <span className="status-pill">{item.status}</span>
                <span className="count-pill">{item.sourceMessageIds.length} 来源</span>
              </div>
            ))
          ) : (
            <div className="empty-state">还没有正式知识。请先在聊天中生成知识草稿并确认入库。</div>
          )}
        </div>
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
            <div className="empty-state">还没有项目记忆。请先在聊天中生成摘要并确认入库。</div>
          )}
        </div>
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
        {moduleKey === "approvals" ? (
          <div className="stage-checklist">
            <span>审批发起：未开发</span>
            <span>当前节点审批人：未开发</span>
            <span>同意 / 驳回 / 退回：未开发</span>
            <span>AI 建议：未开发且不能自动审批</span>
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
