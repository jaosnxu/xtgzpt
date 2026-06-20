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
  knowledge_admin: "知识管理员",
  approver: "审批人",
  finance_approver: "财务审批人",
  legal_approver: "法务审批人",
  contract_initiator: "合同发起人",
  executive: "管理层",
  department_head: "部门负责人",
  project_owner: "项目负责人",
  member: "普通员工"
} as const;

export type RoleKey = keyof typeof roles;

export type DataScope = "all_organizations" | "assigned_organizations" | "own_records";

export type OrganizationStatus = "active" | "disabled";

export type OperationPermission =
  | "create_project"
  | "edit_project"
  | "close_project"
  | "create_task"
  | "assign_task"
  | "complete_task"
  | "upload_file"
  | "archive_file"
  | "publish_knowledge"
  | "manage_permissions";

export type ApprovalPermission =
  | "initiate_approval"
  | "approve_current_node"
  | "reject_current_node"
  | "return_for_revision"
  | "transfer_approval"
  | "add_sign"
  | "delegate_approval"
  | "write_back_approval_result"
  | "configure_approval_policy";

export type FilePermission = "view" | "preview" | "download" | "upload" | "archive" | "reference_ai";

export type AiCapability =
  | "chat_summarize"
  | "task_draft"
  | "knowledge_query"
  | "contract_review"
  | "approval_suggestion"
  | "risk_hint"
  | "configure_ai_frameworks";

export type PermissionDimension = "menu" | "data" | "operation" | "approval" | "file" | "ai";

export const permissionPolicyVersion = "seed-dev-010";

export type AuditResult = "success" | "failure" | "denied";

export type ProjectStatus = "draft" | "active" | "paused" | "completed" | "archived";

export type TaskStatus = "draft" | "todo" | "in_progress" | "submitted" | "completed" | "blocked" | "cancelled" | "archived";

export type ChatThreadStatus = "active" | "archived";

export type ChatMessageStatus = "sent" | "edited" | "withdrawn";

export type AiDraftKind = "chat_summary" | "task_draft" | "knowledge_draft";

export type AiDraftStatus = "draft" | "confirmed";

export type KnowledgeItemStatus = "published" | "archived";

export interface ProjectRecord {
  id: string;
  title: string;
  summary: string;
  organizationId: string;
  ownerUserId: string;
  memberUserIds: string[];
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaskRecord {
  id: string;
  projectId: string;
  title: string;
  description: string;
  creatorUserId: string;
  assigneeUserId: string;
  confirmerUserId: string;
  status: TaskStatus;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatThreadRecord {
  id: string;
  title: string;
  organizationId: string;
  creatorUserId: string;
  memberUserIds: string[];
  relatedObjectType: "project" | "task" | "contract" | null;
  relatedObjectId: string | null;
  status: ChatThreadStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessageRecord {
  id: string;
  threadId: string;
  senderUserId: string;
  content: string;
  status: ChatMessageStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AiDraftRecord {
  id: string;
  kind: AiDraftKind;
  threadId: string;
  creatorUserId: string;
  title: string;
  content: string;
  sourceMessageIds: string[];
  contextSourceIds: string[];
  frameworkVersion: string;
  isDraft: true;
  status: AiDraftStatus;
  confirmedByUserId: string | null;
  confirmedAt: string | null;
  promotedObjectType: "task" | "knowledge_item" | "project_memory" | null;
  promotedObjectId: string | null;
  createdAt: string;
}

export interface KnowledgeItemRecord {
  id: string;
  title: string;
  content: string;
  organizationId: string;
  creatorUserId: string;
  sourceDraftId: string;
  sourceMessageIds: string[];
  sourceParticipantUserIds: string[];
  status: KnowledgeItemStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMemoryRecord {
  id: string;
  title: string;
  content: string;
  organizationId: string;
  projectId: string | null;
  threadId: string;
  creatorUserId: string;
  sourceDraftId: string;
  sourceMessageIds: string[];
  sourceParticipantUserIds: string[];
  createdAt: string;
}

export type KnowledgeSearchResultType = "knowledge_item" | "project_memory";

export interface KnowledgeSearchResult {
  id: string;
  type: KnowledgeSearchResultType;
  title: string;
  content: string;
  organizationId: string;
  projectId: string | null;
  sourceId: string;
  sourceMessageIds: string[];
  relevanceScore: number;
  matchedFields: string[];
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  actorRoleIds: RoleKey[];
  action: string;
  objectType: string;
  objectId: string | null;
  organizationId: string | null;
  sourceIp: string;
  requestId: string;
  beforeSnapshotRef: string | null;
  afterSnapshotRef: string | null;
  reason: string;
  result: AuditResult;
  aiInvolved: boolean;
  aiFrameworkVersion: string | null;
}

export interface AuditLogFilter {
  actorUserId?: string;
  objectType?: string;
  objectId?: string;
}

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
  operations: OperationPermission[];
  approval: ApprovalPermission[];
  files: FilePermission[];
  ai: AiCapability[];
}

export interface ResourceAccessContext {
  organizationId?: string;
  ownerUserId?: string;
  participantUserIds?: string[];
}

export interface ApprovalAccessContext extends ResourceAccessContext {
  currentNodeApproverUserIds?: string[];
}

export interface PermissionSummary {
  policyVersion: typeof permissionPolicyVersion;
  role: RoleKey;
  menu: ModuleKey[];
  data: {
    scope: DataScope;
    organizationIds: string[];
  };
  operation: OperationPermission[];
  approval: ApprovalPermission[];
  file: FilePermission[];
  ai: AiCapability[];
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
    canManageRoles: true,
    operations: [
      "create_project",
      "edit_project",
      "close_project",
      "create_task",
      "assign_task",
      "complete_task",
      "upload_file",
      "archive_file",
      "publish_knowledge",
      "manage_permissions"
    ],
    approval: [
      "initiate_approval",
      "approve_current_node",
      "reject_current_node",
      "return_for_revision",
      "transfer_approval",
      "add_sign",
      "delegate_approval",
      "write_back_approval_result",
      "configure_approval_policy"
    ],
    files: ["view", "preview", "download", "upload", "archive", "reference_ai"],
    ai: [
      "chat_summarize",
      "task_draft",
      "knowledge_query",
      "contract_review",
      "approval_suggestion",
      "risk_hint",
      "configure_ai_frameworks"
    ]
  },
  admin: {
    role: "admin",
    name: roles.admin,
    menu: platformModules.map((item) => item.key),
    dataScope: "assigned_organizations",
    canManageSettings: true,
    canManageOrganizations: true,
    canManageRoles: true,
    operations: ["manage_permissions", "upload_file", "archive_file"],
    approval: ["configure_approval_policy"],
    files: ["view", "preview", "download", "upload", "archive", "reference_ai"],
    ai: ["chat_summarize", "knowledge_query", "risk_hint", "configure_ai_frameworks"]
  },
  knowledge_admin: {
    role: "knowledge_admin",
    name: roles.knowledge_admin,
    menu: coreWorkModules,
    dataScope: "assigned_organizations",
    canManageSettings: false,
    canManageOrganizations: false,
    canManageRoles: false,
    operations: ["create_task", "complete_task", "upload_file", "archive_file", "publish_knowledge"],
    approval: [],
    files: ["view", "preview", "download", "upload", "archive", "reference_ai"],
    ai: ["chat_summarize", "task_draft", "knowledge_query", "risk_hint"]
  },
  approver: {
    role: "approver",
    name: roles.approver,
    menu: coreWorkModules,
    dataScope: "assigned_organizations",
    canManageSettings: false,
    canManageOrganizations: false,
    canManageRoles: false,
    operations: ["create_task", "complete_task", "upload_file"],
    approval: [
      "approve_current_node",
      "reject_current_node",
      "return_for_revision",
      "transfer_approval",
      "add_sign"
    ],
    files: ["view", "preview", "download", "upload", "reference_ai"],
    ai: ["chat_summarize", "knowledge_query", "approval_suggestion", "risk_hint"]
  },
  finance_approver: {
    role: "finance_approver",
    name: roles.finance_approver,
    menu: coreWorkModules,
    dataScope: "assigned_organizations",
    canManageSettings: false,
    canManageOrganizations: false,
    canManageRoles: false,
    operations: ["create_task", "complete_task", "upload_file"],
    approval: ["approve_current_node", "reject_current_node", "return_for_revision", "transfer_approval"],
    files: ["view", "preview", "download", "upload", "reference_ai"],
    ai: ["chat_summarize", "knowledge_query", "approval_suggestion", "risk_hint"]
  },
  legal_approver: {
    role: "legal_approver",
    name: roles.legal_approver,
    menu: coreWorkModules,
    dataScope: "assigned_organizations",
    canManageSettings: false,
    canManageOrganizations: false,
    canManageRoles: false,
    operations: ["create_task", "complete_task", "upload_file"],
    approval: [
      "approve_current_node",
      "reject_current_node",
      "return_for_revision",
      "transfer_approval",
      "add_sign",
      "write_back_approval_result"
    ],
    files: ["view", "preview", "download", "upload", "archive", "reference_ai"],
    ai: ["chat_summarize", "knowledge_query", "contract_review", "approval_suggestion", "risk_hint"]
  },
  contract_initiator: {
    role: "contract_initiator",
    name: roles.contract_initiator,
    menu: coreWorkModules,
    dataScope: "own_records",
    canManageSettings: false,
    canManageOrganizations: false,
    canManageRoles: false,
    operations: ["create_task", "complete_task", "upload_file"],
    approval: ["initiate_approval"],
    files: ["view", "preview", "download", "upload", "reference_ai"],
    ai: ["chat_summarize", "task_draft", "knowledge_query", "contract_review", "risk_hint"]
  },
  executive: {
    role: "executive",
    name: roles.executive,
    menu: coreWorkModules,
    dataScope: "assigned_organizations",
    canManageSettings: false,
    canManageOrganizations: false,
    canManageRoles: false,
    operations: ["create_task", "complete_task", "upload_file"],
    approval: ["approve_current_node", "reject_current_node", "return_for_revision"],
    files: ["view", "preview", "download", "reference_ai"],
    ai: ["chat_summarize", "knowledge_query", "approval_suggestion", "risk_hint"]
  },
  department_head: {
    role: "department_head",
    name: roles.department_head,
    menu: coreWorkModules,
    dataScope: "assigned_organizations",
    canManageSettings: false,
    canManageOrganizations: false,
    canManageRoles: false,
    operations: ["edit_project", "close_project", "create_task", "assign_task", "complete_task", "upload_file"],
    approval: ["approve_current_node", "reject_current_node", "return_for_revision", "transfer_approval"],
    files: ["view", "preview", "download", "upload", "archive", "reference_ai"],
    ai: ["chat_summarize", "task_draft", "knowledge_query", "approval_suggestion", "risk_hint"]
  },
  project_owner: {
    role: "project_owner",
    name: roles.project_owner,
    menu: coreWorkModules,
    dataScope: "assigned_organizations",
    canManageSettings: false,
    canManageOrganizations: false,
    canManageRoles: false,
    operations: [
      "create_project",
      "edit_project",
      "close_project",
      "create_task",
      "assign_task",
      "complete_task",
      "upload_file",
      "archive_file"
    ],
    approval: ["initiate_approval"],
    files: ["view", "preview", "download", "upload", "archive", "reference_ai"],
    ai: ["chat_summarize", "task_draft", "knowledge_query", "approval_suggestion", "risk_hint"]
  },
  member: {
    role: "member",
    name: roles.member,
    menu: coreWorkModules,
    dataScope: "own_records",
    canManageSettings: false,
    canManageOrganizations: false,
    canManageRoles: false,
    operations: ["create_task", "complete_task", "upload_file"],
    approval: ["initiate_approval"],
    files: ["view", "preview", "download", "upload", "reference_ai"],
    ai: ["chat_summarize", "task_draft", "knowledge_query", "approval_suggestion"]
  }
};

export const ROLE_MENU: Record<RoleKey, ModuleKey[]> = {
  super_admin: rolePolicies.super_admin.menu,
  admin: rolePolicies.admin.menu,
  knowledge_admin: rolePolicies.knowledge_admin.menu,
  approver: rolePolicies.approver.menu,
  finance_approver: rolePolicies.finance_approver.menu,
  legal_approver: rolePolicies.legal_approver.menu,
  contract_initiator: rolePolicies.contract_initiator.menu,
  executive: rolePolicies.executive.menu,
  department_head: rolePolicies.department_head.menu,
  project_owner: rolePolicies.project_owner.menu,
  member: rolePolicies.member.menu
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
    id: "user-department-head",
    username: "dept",
    displayName: "部门负责人",
    role: "department_head",
    organizationIds: ["org-product"],
    defaultOrganizationId: "org-product",
    status: "active"
  },
  {
    id: "user-executive",
    username: "exec",
    displayName: "管理层",
    role: "executive",
    organizationIds: ["org-product", "org-operation"],
    defaultOrganizationId: "org-product",
    status: "active"
  },
  {
    id: "user-contract",
    username: "contract",
    displayName: "合同发起人",
    role: "contract_initiator",
    organizationIds: ["org-product"],
    defaultOrganizationId: "org-product",
    status: "active"
  },
  {
    id: "user-legal",
    username: "legal",
    displayName: "法务审批人",
    role: "legal_approver",
    organizationIds: ["org-group", "org-product"],
    defaultOrganizationId: "org-group",
    status: "active"
  },
  {
    id: "user-finance",
    username: "finance",
    displayName: "财务审批人",
    role: "finance_approver",
    organizationIds: ["org-group", "org-product"],
    defaultOrganizationId: "org-group",
    status: "active"
  },
  {
    id: "user-approver",
    username: "approver",
    displayName: "审批人",
    role: "approver",
    organizationIds: ["org-product"],
    defaultOrganizationId: "org-product",
    status: "active"
  },
  {
    id: "user-knowledge",
    username: "knowledge",
    displayName: "知识管理员",
    role: "knowledge_admin",
    organizationIds: ["org-product"],
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

export function canQueryAuditLogs(role: RoleKey) {
  return role === "super_admin" || rolePolicies[role].operations.includes("manage_permissions");
}

export function canViewOrganizationData(user: UserAccount, organizationId: string | undefined) {
  const scope = rolePolicies[user.role].dataScope;

  if (!organizationId) {
    return false;
  }

  if (scope === "all_organizations") {
    return true;
  }

  if (scope === "own_records") {
    return false;
  }

  return user.organizationIds.includes(organizationId);
}

export function canAccessResourceData(user: UserAccount, resource: ResourceAccessContext) {
  const scope = rolePolicies[user.role].dataScope;

  if (scope === "all_organizations") {
    return true;
  }

  if (resource.ownerUserId === user.id || resource.participantUserIds?.includes(user.id)) {
    return true;
  }

  return canViewOrganizationData(user, resource.organizationId);
}

export function visibleOrganizationsForUser(user: UserAccount, organizations = seedOrganizations) {
  return organizations.filter((organization) => canViewOrganizationData(user, organization.id));
}

export function canPerformOperation(user: UserAccount, operation: OperationPermission, resource?: ResourceAccessContext) {
  if (!rolePolicies[user.role].operations.includes(operation)) {
    return false;
  }

  if (!resource) {
    return true;
  }

  return canAccessResourceData(user, resource);
}

function isCurrentNodeApproval(permission: ApprovalPermission) {
  return [
    "approve_current_node",
    "reject_current_node",
    "return_for_revision",
    "transfer_approval",
    "add_sign",
    "write_back_approval_result"
  ].includes(permission);
}

export function canPerformApprovalAction(
  user: UserAccount,
  permission: ApprovalPermission,
  resource?: ApprovalAccessContext
) {
  if (!rolePolicies[user.role].approval.includes(permission)) {
    return false;
  }

  if (!resource) {
    return permission === "configure_approval_policy";
  }

  if (!canAccessResourceData(user, resource)) {
    return false;
  }

  if (isCurrentNodeApproval(permission)) {
    return resource.currentNodeApproverUserIds?.includes(user.id) === true;
  }

  return true;
}

export function canAccessFileAction(user: UserAccount, action: FilePermission, resource: ResourceAccessContext) {
  return rolePolicies[user.role].files.includes(action) && canAccessResourceData(user, resource);
}

export function canUseAiCapability(user: UserAccount, capability: AiCapability, resource?: ResourceAccessContext) {
  if (!rolePolicies[user.role].ai.includes(capability)) {
    return false;
  }

  if (!resource) {
    return capability === "configure_ai_frameworks";
  }

  return canAccessResourceData(user, resource);
}

export function getPermissionSummary(user: UserAccount): PermissionSummary {
  const policy = rolePolicies[user.role];

  return {
    policyVersion: permissionPolicyVersion,
    role: user.role,
    menu: policy.menu,
    data: {
      scope: policy.dataScope,
      organizationIds: visibleOrganizationsForUser(user).map((organization) => organization.id)
    },
    operation: policy.operations,
    approval: policy.approval,
    file: policy.files,
    ai: policy.ai,
  };
}

export function getPublicUser(user: UserAccount) {
  return user;
}
