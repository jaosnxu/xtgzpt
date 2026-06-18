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
import { useMemo, useState } from "react";
import {
  canManageOrganizations,
  canManageRoles,
  getVisibleModules,
  roles,
  rolePolicies,
  seedOrganizations,
  seedUsers,
  visibleOrganizationsForUser,
  type UserAccount
} from "@xtgzpt/shared";

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

const priorityItems = [
  { title: "合同待二次审查", owner: "法务 / 负责人", status: "待处理", level: "P0" },
  { title: "任务完成确认", owner: "项目经理", status: "审批中", level: "P1" },
  { title: "AI 草稿待人工确认", owner: "运营组", status: "草稿", level: "P1" },
  { title: "知识库发布复核", owner: "管理员", status: "待确认", level: "P2" }
];

const auditEvents = [
  "项目 A 新增成员，已写审计",
  "合同 OCR 完成，等待人工确认",
  "任务状态从 submitted 进入 completed",
  "管理员更新角色菜单权限"
];

export function App() {
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const activeUser = useMemo(
    () => seedUsers.find((user) => user.id === activeUserId) ?? null,
    [activeUserId]
  );

  if (!activeUser) {
    return <LoginScreen onLogin={setActiveUserId} />;
  }

  const visibleModules = getVisibleModules(activeUser.role);
  const dataOrganizations = visibleOrganizationsForUser(activeUser);
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
              <button className={item.key === "dashboard" ? "nav-item active" : "nav-item"} key={item.key}>
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
            <p className="eyebrow">已进入 DEV-002：账号、角色、组织、权限</p>
            <h1>首页工作台</h1>
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
            <button className="icon-button" aria-label="通知">
              <Bell size={18} />
            </button>
          </div>
        </header>

        <section className="metric-grid" aria-label="核心指标">
          <MetricCard title="我的待办" value="18" helper="审批、任务、合同确认" />
          <MetricCard title="进行中项目" value="12" helper="按成员权限裁剪" />
          <MetricCard title="可见组织" value={String(dataOrganizations.length)} helper={rolePolicies[activeUser.role].dataScope} />
          <MetricCard title="审计事件" value="246" helper="关键动作不可删除" />
        </section>

        <section className="content-grid">
          <div className="panel work-panel">
            <div className="panel-header">
              <div>
                <h2>当前处理队列</h2>
                <p>按冻结原型的工作台结构进入开发，后续 DEV-002 接入真实权限。</p>
              </div>
              <button className="primary-button">
                <ClipboardList size={17} />
                新建审批
              </button>
            </div>
            <div className="table" role="table" aria-label="处理队列">
              <div className="table-row table-head" role="row">
                <span>事项</span>
                <span>当前处理人</span>
                <span>状态</span>
                <span>级别</span>
              </div>
              {priorityItems.map((item) => (
                <div className="table-row" role="row" key={item.title}>
                  <span>{item.title}</span>
                  <span>{item.owner}</span>
                  <span>{item.status}</span>
                  <strong>{item.level}</strong>
                </div>
              ))}
            </div>
          </div>

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
              <li>业务数据按组织授权裁剪</li>
              <li>审计记录只追加不删除</li>
            </ul>
          </aside>

          <div className="panel">
            <div className="panel-header compact">
              <div>
                <h2>组织与角色</h2>
                <p>当前账号只能看到被授权的组织范围。</p>
              </div>
              <Users size={22} />
            </div>
            <div className="role-strip">
              {dataOrganizations.map((organization) => (
                <span key={organization.id}>{organization.name}</span>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-header compact">
              <div>
                <h2>最近审计</h2>
                <p>所有关键动作必须可追溯。</p>
              </div>
            </div>
            <ol className="audit-list">
              {auditEvents.map((event) => (
                <li key={event}>{event}</li>
              ))}
            </ol>
          </div>

          {canOpenSettings ? (
            <div className="panel settings-panel">
              <div className="panel-header compact">
                <div>
                  <h2>系统设置</h2>
                  <p>组织、角色和菜单权限进入配置管理。</p>
                </div>
                <Settings size={22} />
              </div>
              <div className="settings-grid">
                <SettingsItem title="组织管理" value={`${seedOrganizations.length} 个组织`} enabled={canManageOrganizations(activeUser.role)} />
                <SettingsItem title="角色管理" value={`${Object.keys(rolePolicies).length} 个角色`} enabled={canManageRoles(activeUser.role)} />
                <SettingsItem title="菜单权限" value={`${visibleModules.length} 个可见菜单`} enabled />
                <SettingsItem title="数据范围" value={rolePolicies[activeUser.role].dataScope} enabled />
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (userId: string) => void }) {
  return (
    <main className="login-page">
      <section className="login-shell">
        <div>
          <p className="eyebrow">协同工作平台</p>
          <h1>账号登录</h1>
          <p className="login-copy">选择一个 DEV-002 账号进入系统。所有账号密码为 113113。</p>
        </div>
        <div className="login-list">
          {seedUsers.map((user) => (
            <button className="login-account" key={user.id} onClick={() => onLogin(user.id)}>
              <span>{user.displayName}</span>
              <strong>{roles[user.role]}</strong>
              <small>{describeAccess(user)}</small>
            </button>
          ))}
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

function describeAccess(user: UserAccount) {
  const policy = rolePolicies[user.role];

  if (policy.dataScope === "all_organizations") {
    return "可查看全部组织业务数据";
  }

  if (policy.canManageSettings) {
    return "可配置系统，仅看授权组织业务数据";
  }

  return `可见 ${user.organizationIds.length} 个授权组织`;
}
