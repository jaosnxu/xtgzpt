export const platformBoundary = {
  product: "xtgzpt",
  phase: "phase-1",
  formFactor: "web-responsive",
  aiAuthority: "draft-suggest-remind-only",
  approvalAuthority: "human-only"
} as const;

export const platformModules = [
  { key: "dashboard", name: "首页" },
  { key: "workbench", name: "我的工作台" },
  { key: "projects", name: "项目" },
  { key: "tasks", name: "任务" },
  { key: "chat", name: "聊天" },
  { key: "knowledge", name: "知识库" },
  { key: "contracts", name: "合同" },
  { key: "approvals", name: "审批" },
  { key: "settings", name: "系统设置" }
] as const;

export type ModuleKey = (typeof platformModules)[number]["key"];

export const roles = {
  super_admin: "超级管理员",
  admin: "系统管理员",
  project_owner: "项目负责人",
  member: "普通成员"
} as const;

export type RoleKey = keyof typeof roles;

export const ROLE_MENU: Record<RoleKey, ModuleKey[]> = {
  super_admin: platformModules.map((item) => item.key),
  admin: platformModules.map((item) => item.key),
  project_owner: [
    "dashboard",
    "workbench",
    "projects",
    "tasks",
    "chat",
    "knowledge",
    "contracts",
    "approvals"
  ],
  member: [
    "dashboard",
    "workbench",
    "projects",
    "tasks",
    "chat",
    "knowledge",
    "contracts",
    "approvals"
  ]
};

export function canAccessModule(role: RoleKey, module: ModuleKey) {
  return ROLE_MENU[role].includes(module);
}
