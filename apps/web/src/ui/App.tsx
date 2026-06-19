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
import { useState } from "react";
import {
  canManageOrganizations,
  canManageRoles,
  roles,
  rolePolicies,
  seedOrganizations,
  platformModules,
  type ModuleKey,
  type Organization,
  type PermissionSummary,
  type PublicUser
} from "@xtgzpt/shared";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "/api";

interface SessionState {
  token: string;
  user: PublicUser;
  visibleModules: ModuleKey[];
  dataOrganizations: Organization[];
  permissions: PermissionSummary;
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
    stage: "DEV-004 进行中",
    summary: "当前阶段接入审计日志基础设施、对象审计查询和用户审计查询。"
  },
  workbench: {
    stage: "DEV-005 待开发",
    summary: "我的工作台将在项目、任务、审批真实数据接入后形成待办。"
  },
  projects: {
    stage: "DEV-005 待开发",
    summary: "项目创建、成员、任务拆解和归档流程尚未进入代码开发。"
  },
  tasks: {
    stage: "DEV-005 待开发",
    summary: "任务创建、提交完成、确认和取消流程尚未进入代码开发。"
  },
  chat: {
    stage: "DEV-006 待开发",
    summary: "聊天、AI 整理草稿和群组可见性尚未进入代码开发。"
  },
  knowledge: {
    stage: "DEV-008 待开发",
    summary: "知识库问答、发布审核和权限过滤尚未进入代码开发。"
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
    stage: "DEV-004 进行中",
    summary: "当前阶段已接入权限策略摘要和审计查询入口，配置写入仍待真实后台持久化。"
  }
};

const stageGateItems = [
  { scope: "认证登录", owner: "API / Web", status: "已验证", stage: "DEV-002" },
  { scope: "角色与菜单权限", owner: "API / Web", status: "已验证", stage: "DEV-002" },
  { scope: "组织数据范围", owner: "API", status: "已验证", stage: "DEV-002" },
  { scope: "统一权限中间层", owner: "API / Web", status: "已验证", stage: "DEV-003" },
  { scope: "文件与 AI 权限", owner: "API", status: "已验证", stage: "DEV-003" },
  { scope: "审计日志基础设施", owner: "API", status: "已验证", stage: "DEV-004" },
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
  const activeUser = session?.user ?? null;

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
            <p className="eyebrow">已进入 DEV-004：审计日志基础设施</p>
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
        <MetricCard title="当前阶段" value="DEV-004" helper="审计日志基础设施" />
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
