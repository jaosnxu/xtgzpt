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

export type DataScope = "all_organizations" | "assigned_organizations" | "own_records";

export type OrganizationStatus = "active" | "disabled";

export interface Organization {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
  status: OrganizationStatus;
}

export interface UserAccount {
  id: string;
  username: string;
  displayName: string;
  role: RoleKey;
  organizationIds: string[];
  defaultOrganizationId: string;
  status: "active" | "disabled";
}

export type PublicUser = UserAccount;

export interface RolePolicy {
  role: RoleKey;
  name: string;
  menu: ModuleKey[];
  dataScope: DataScope;
  canManageSettings: boolean;
  canManageOrganizations: boolean;
  canManageRoles: boolean;
}

const coreWorkModules: ModuleKey[] = [
  "dashboard",
  "workbench",
  "projects",
  "tasks",
  "chat",
  "knowledge",
  "contracts",
  "approvals"
];

export const rolePolicies: Record<RoleKey, RolePolicy> = {
  super_admin: {
    role: "super_admin",
    name: roles.super_admin,
    menu: platformModules.map((item) => item.key),
    dataScope: "all_organizations",
    canManageSettings: true,
    canManageOrganizations: true,
    canManageRoles: true
  },
  admin: {
    role: "admin",
    name: roles.admin,
    menu: platformModules.map((item) => item.key),
    dataScope: "assigned_organizations",
    canManageSettings: true,
    canManageOrganizations: true,
    canManageRoles: true
  },
  project_owner: {
    role: "project_owner",
    name: roles.project_owner,
    menu: coreWorkModules,
    dataScope: "assigned_organizations",
    canManageSettings: false,
    canManageOrganizations: false,
    canManageRoles: false
  },
  member: {
    role: "member",
    name: roles.member,
    menu: coreWorkModules,
    dataScope: "own_records",
    canManageSettings: false,
    canManageOrganizations: false,
    canManageRoles: false
  }
};

export const ROLE_MENU: Record<RoleKey, ModuleKey[]> = {
  super_admin: rolePolicies.super_admin.menu,
  admin: rolePolicies.admin.menu,
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

export const seedOrganizations: Organization[] = [
  {
    id: "org-group",
    name: "集团总部",
    code: "GROUP",
    parentId: null,
    status: "active"
  },
  {
    id: "org-product",
    name: "产品研发中心",
    code: "PRODUCT",
    parentId: "org-group",
    status: "active"
  },
  {
    id: "org-operation",
    name: "运营协同中心",
    code: "OPS",
    parentId: "org-group",
    status: "active"
  },
  {
    id: "org-store-a",
    name: "一号门店项目组",
    code: "STORE-A",
    parentId: "org-operation",
    status: "active"
  }
];

export const seedUsers: UserAccount[] = [
  {
    id: "user-super",
    username: "super",
    displayName: "超级管理员",
    role: "super_admin",
    organizationIds: seedOrganizations.map((item) => item.id),
    defaultOrganizationId: "org-group",
    status: "active"
  },
  {
    id: "user-admin",
    username: "admin",
    displayName: "系统管理员",
    role: "admin",
    organizationIds: ["org-group"],
    defaultOrganizationId: "org-group",
    status: "active"
  },
  {
    id: "user-owner",
    username: "owner",
    displayName: "项目负责人",
    role: "project_owner",
    organizationIds: ["org-product", "org-operation"],
    defaultOrganizationId: "org-product",
    status: "active"
  },
  {
    id: "user-member",
    username: "member",
    displayName: "普通成员",
    role: "member",
    organizationIds: ["org-store-a"],
    defaultOrganizationId: "org-store-a",
    status: "active"
  }
];

export function canAccessModule(role: RoleKey, module: ModuleKey) {
  return rolePolicies[role].menu.includes(module);
}

export function getVisibleModules(role: RoleKey) {
  return platformModules.filter((item) => canAccessModule(role, item.key));
}

export function canManageOrganizations(role: RoleKey) {
  return rolePolicies[role].canManageOrganizations;
}

export function canManageRoles(role: RoleKey) {
  return rolePolicies[role].canManageRoles;
}

export function canManageSettings(role: RoleKey) {
  return rolePolicies[role].canManageSettings;
}

export function canViewOrganizationData(user: UserAccount, organizationId: string) {
  const scope = rolePolicies[user.role].dataScope;

  if (scope === "all_organizations") {
    return true;
  }

  if (scope === "own_records") {
    return false;
  }

  return user.organizationIds.includes(organizationId);
}

export function visibleOrganizationsForUser(user: UserAccount, organizations = seedOrganizations) {
  return organizations.filter((organization) => canViewOrganizationData(user, organization.id));
}

export function getPublicUser(user: UserAccount) {
  return user;
}
