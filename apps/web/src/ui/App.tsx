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
import { ROLE_MENU, type RoleKey, platformModules } from "@xtgzpt/shared";

const activeRole: RoleKey = "admin";

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
  const visibleModules = platformModules.filter((item) => ROLE_MENU[activeRole].includes(item.key));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">XT</span>
          <div>
            <strong>协同工作平台</strong>
            <span>Phase 1 Development</span>
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
            <p className="eyebrow">已按冻结原型进入开发</p>
            <h1>首页工作台</h1>
          </div>
          <div className="top-actions">
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
          <MetricCard title="待审合同" value="5" helper="必须人工二次确认" />
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
                <p>AI 只能建议，不能替人确认。</p>
              </div>
              <ShieldCheck size={22} />
            </div>
            <ul className="guard-list">
              <li>审批必须人工完成</li>
              <li>系统设置仅管理员可见</li>
              <li>合同详情按项目成员裁剪</li>
              <li>审计记录只追加不删除</li>
            </ul>
          </aside>

          <div className="panel">
            <div className="panel-header compact">
              <div>
                <h2>组织与角色</h2>
                <p>DEV-002 将进入账号、角色、组织范围。</p>
              </div>
              <Users size={22} />
            </div>
            <div className="role-strip">
              <span>超级管理员</span>
              <span>系统管理员</span>
              <span>项目负责人</span>
              <span>普通成员</span>
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
        </section>
      </main>
    </div>
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
