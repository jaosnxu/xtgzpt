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
  | "create_contract"
  | "revise_contract"
  | "confirm_contract_risk"
  | "track_contract_execution"
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
  | "read_ai_runs"
  | "configure_ai_frameworks";

export type PermissionDimension = "menu" | "data" | "operation" | "approval" | "file" | "ai";

export const permissionPolicyVersion = "seed-dev-016";

export type AuditResult = "success" | "failure" | "denied";

export type ProjectStatus = "draft" | "active" | "paused" | "completed" | "archived";

export type TaskStatus = "draft" | "todo" | "in_progress" | "submitted" | "completed" | "blocked" | "cancelled" | "archived";

export type ChatThreadStatus = "active" | "archived";

export type ChatMessageStatus = "sent" | "edited" | "withdrawn";

export type AiDraftKind = "chat_summary" | "task_draft" | "knowledge_draft";

export type AiDraftStatus = "draft" | "confirmed" | "rejected";

export type AiFrameworkStatus = "active" | "disabled";

export type AiScenario =
  | "chat_summary"
  | "task_draft"
  | "knowledge_draft"
  | "knowledge_query"
  | "contract_review"
  | "approval_suggestion";

export type AiRunSourceObjectType = "chat_thread" | "contract" | "knowledge_query" | "approval";

export type AiRunStatus = "created" | "running" | "succeeded" | "failed";

export type AiRunFailureClass =
  | "provider_error"
  | "permission_denied"
  | "validation_error"
  | "timeout"
  | "rate_limited"
  | "unknown";

export type AiSnapshotKind = "input" | "output";

export type AiSourceAccessResult = "allowed" | "denied" | "filtered";

export type AiRunDecisionType = "adopted" | "rejected" | "changed";

export type KnowledgeItemStatus = "draft" | "submitted_for_review" | "published" | "rejected" | "archived";

export type KnowledgeEvidenceSourceType = "ai_draft" | "chat_message" | "project_memory" | "manual";

export type ContractEntryMethod = "upload" | "paste";

export type ContractStatus =
  | "draft"
  | "ai_reviewing"
  | "risk_pending_confirm"
  | "revision_required"
  | "second_reviewing"
  | "approval_pending"
  | "approved"
  | "execution_tracking"
  | "completed"
  | "rejected"
  | "cancelled"
  | "archived";

export type ContractReviewType = "initial" | "second";

export type ContractReviewStatus = "succeeded" | "failed";

export type ContractRiskSeverity = "low" | "medium" | "high";

export type ContractOptionKey = "A" | "B" | "C";

export type ContractExecutionEventType = "reminder" | "record" | "status_update";

export type ApprovalSourceObjectType = "contract";

export type ApprovalStatus =
  | "submitted"
  | "processing"
  | "approved"
  | "rejected"
  | "returned"
  | "transferred"
  | "cancelled"
  | "expired";

export type ApprovalNodeStatus =
  | "pending"
  | "processing"
  | "approved"
  | "rejected"
  | "returned"
  | "transferred"
  | "add_signed";

export type ApprovalActionType = "approve" | "reject" | "return" | "transfer" | "add_sign";

export interface ContractSourceEvidence {
  sourceType: ContractEntryMethod | "revision";
  sourceId: string;
  title: string;
  fileName: string | null;
  mimeType: string | null;
  capturedByUserId: string;
  capturedAt: string;
  excerpt: string;
}

export interface ContractRecord {
  id: string;
  title: string;
  organizationId: string;
  creatorUserId: string;
  participantUserIds: string[];
  status: ContractStatus;
  currentVersion: number;
  approvalHandoffId: string | null;
  executionStatus: "not_started" | "tracking";
  createdAt: string;
  updatedAt: string;
}

export interface ContractVersionRecord {
  id: string;
  contractId: string;
  version: number;
  title: string;
  originalText: string;
  entryMethod: ContractEntryMethod | "revision";
  sourceEvidence: ContractSourceEvidence[];
  createdByUserId: string;
  createdAt: string;
}

export interface ContractReviewRisk {
  id: string;
  title: string;
  severity: ContractRiskSeverity;
  sourceRef: string;
  sourceQuote: string;
  explanation: string;
  options: Record<ContractOptionKey, string>;
  requiresHumanConfirmation: true;
  humanConfirmed: boolean;
  selectedOption: ContractOptionKey | null;
  confirmationNote: string | null;
  confirmedByUserId: string | null;
  confirmedAt: string | null;
}

export interface ContractTextHighlight {
  id: string;
  riskId: string;
  sourceRef: string;
  quote: string;
  startOffset: number;
  endOffset: number;
  severity: ContractRiskSeverity;
  reason: string;
}

export interface ContractReviewRecord {
  id: string;
  contractId: string;
  versionId: string;
  version: number;
  reviewType: ContractReviewType;
  status: ContractReviewStatus;
  frameworkId: "contract_review_v1";
  frameworkVersion: string;
  summary: string;
  riskLevel: ContractRiskSeverity;
  risks: ContractReviewRisk[];
  highlights: ContractTextHighlight[];
  nextRequiredAction: "human_confirm_risks";
  createdByUserId: string;
  createdAt: string;
  completedAt: string | null;
}

export interface ContractRiskConfirmationRecord {
  id: string;
  contractId: string;
  reviewId: string;
  riskId: string;
  confirmed: boolean;
  selectedOption: ContractOptionKey;
  note: string;
  confirmedByUserId: string;
  confirmedAt: string;
}

export interface ContractApprovalHandoffRecord {
  id: string;
  contractId: string;
  versionId: string;
  submittedByUserId: string;
  status: "submitted_boundary";
  approvalEngineImplemented: boolean;
  approvalId: string | null;
  reason: string;
  createdAt: string;
}

export interface ContractExecutionEventRecord {
  id: string;
  contractId: string;
  eventType: ContractExecutionEventType;
  title: string;
  notes: string;
  status: string;
  dueAt: string | null;
  createdByUserId: string;
  createdAt: string;
}

export interface KnowledgeSourceEvidence {
  sourceType: KnowledgeEvidenceSourceType;
  sourceId: string;
  sourceMessageIds: string[];
  sourceParticipantUserIds: string[];
  title: string;
  excerpt: string;
}

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

export interface AiRetryPolicy {
  maxRetries: number;
  retryableFailureClasses: AiRunFailureClass[];
  backoffSeconds: number;
}

export interface AiFrameworkRecord {
  id: string;
  name: string;
  scenario: AiScenario;
  organizationId: string | null;
  status: AiFrameworkStatus;
  activeVersionId: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiFrameworkVersionRecord {
  id: string;
  frameworkId: string;
  version: string;
  provider: "template" | "ark" | "local_structured";
  model: string;
  promptTemplate: string;
  boundaryPolicy: string;
  sourceEvidenceRequired: boolean;
  retryPolicy: AiRetryPolicy;
  createdByUserId: string;
  changeReason: string;
  createdAt: string;
}

export interface AiRunRecord {
  id: string;
  frameworkId: string;
  frameworkVersionId: string;
  frameworkVersion: string;
  scenario: AiScenario;
  actorUserId: string;
  organizationId: string;
  sourceObjectType: AiRunSourceObjectType;
  sourceObjectId: string;
  sourceIds: string[];
  inputSnapshotRef: string;
  outputSnapshotRef: string | null;
  contextSourceIds: string[];
  status: AiRunStatus;
  failureClass: AiRunFailureClass | null;
  failureMessage: string | null;
  retryPolicy: AiRetryPolicy;
  retryAttempt: number;
  maxRetries: number;
  createdAt: string;
  completedAt: string | null;
}

export interface AiSnapshotRecord {
  id: string;
  runId: string;
  kind: AiSnapshotKind;
  checksum: string;
  payload: unknown;
  createdAt: string;
}

export interface AiRunSourceEvidenceRecord {
  id: string;
  runId: string;
  sourceObjectType: string;
  sourceObjectId: string;
  sourceId: string;
  title: string;
  excerpt: string;
  accessResult: AiSourceAccessResult;
  createdAt: string;
}

export interface AiRunDecisionRecord {
  id: string;
  runId: string;
  draftId: string | null;
  decision: AiRunDecisionType;
  actorUserId: string;
  targetObjectType: string | null;
  targetObjectId: string | null;
  changeSummary: string | null;
  reason: string;
  createdAt: string;
}

export interface AiRunWithDetails extends AiRunRecord {
  framework: AiFrameworkRecord | null;
  frameworkVersionRecord: AiFrameworkVersionRecord | null;
  inputSnapshot: AiSnapshotRecord | null;
  outputSnapshot: AiSnapshotRecord | null;
  sourceEvidence: AiRunSourceEvidenceRecord[];
  decisions: AiRunDecisionRecord[];
}

export interface KnowledgeItemRecord {
  id: string;
  title: string;
  content: string;
  organizationId: string;
  creatorUserId: string;
  reviewerUserId: string | null;
  currentVersion: number;
  sourceDraftId: string;
  sourceMessageIds: string[];
  sourceParticipantUserIds: string[];
  sourceEvidence: KnowledgeSourceEvidence[];
  status: KnowledgeItemStatus;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  rejectedAt: string | null;
  archivedAt: string | null;
}

export interface KnowledgeVersionRecord {
  id: string;
  knowledgeItemId: string;
  version: number;
  title: string;
  content: string;
  authorUserId: string;
  reviewerUserId: string | null;
  status: KnowledgeItemStatus;
  sourceEvidence: KnowledgeSourceEvidence[];
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  publishedAt: string | null;
  rejectedAt: string | null;
  archivedAt: string | null;
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

export type FileAssetStatus = "uploaded" | "linked" | "locked" | "archived";

export type FileSourceObjectType = "project" | "task" | "chat_thread" | "knowledge_item" | "project_memory";

export interface FileObjectBindingRecord {
  id: string;
  fileId: string;
  objectType: FileSourceObjectType;
  objectId: string;
  organizationId: string;
  createdByUserId: string;
  createdAt: string;
}

export interface FileAssetRecord {
  id: string;
  organizationId: string;
  displayName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  uploaderUserId: string;
  status: FileAssetStatus;
  currentVersionId: string;
  sourceObjectType: FileSourceObjectType;
  sourceObjectId: string;
  formalProcess: boolean;
  archivedByUserId: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FileVersionRecord {
  id: string;
  fileId: string;
  versionNumber: number;
  storageKey: string;
  checksum: string;
  sizeBytes: number;
  mimeType: string;
  originalName: string;
  contentText: string;
  createdByUserId: string;
  createdAt: string;
}

export interface FilePreviewResponse {
  file: FileAssetRecord;
  version: Omit<FileVersionRecord, "contentText">;
  previewText: string;
}

export interface FileDownloadResponse {
  file: FileAssetRecord;
  version: Omit<FileVersionRecord, "contentText">;
  contentText: string;
}

export interface KnowledgeSearchResult {
  id: string;
  type: KnowledgeSearchResultType;
  title: string;
  content: string;
  organizationId: string;
  projectId: string | null;
  sourceId: string;
  sourceMessageIds: string[];
  sourceEvidence: KnowledgeSourceEvidence[];
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

export interface ApprovalRecord {
  id: string;
  title: string;
  organizationId: string;
  sourceObjectType: ApprovalSourceObjectType;
  sourceObjectId: string;
  sourceSnapshotRef: string;
  initiatedByUserId: string;
  status: ApprovalStatus;
  currentNodeId: string | null;
  currentApproverUserId: string | null;
  resultWritebackStatus: string | null;
  createdAt: string;
  submittedAt: string;
  completedAt: string | null;
  updatedAt: string;
}

export interface ApprovalNodeRecord {
  id: string;
  approvalId: string;
  sequence: number;
  name: string;
  approverUserId: string;
  status: ApprovalNodeStatus;
  enteredAt: string | null;
  decidedAt: string | null;
  decidedByUserId: string | null;
  decisionReason: string | null;
  fromNodeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalActionRecord {
  id: string;
  approvalId: string;
  nodeId: string;
  action: ApprovalActionType;
  actorUserId: string;
  targetUserId: string | null;
  reason: string;
  createdAt: string;
}

export interface ApprovalWithDetails extends ApprovalRecord {
  nodes: ApprovalNodeRecord[];
  actions: ApprovalActionRecord[];
  currentApprover: PublicUser | null;
  sourceSummary: {
    objectType: ApprovalSourceObjectType;
    objectId: string;
    title: string;
    status: string;
  };
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

export type WorkbenchItemKind =
  | "pending_task"
  | "responsible_task"
  | "participating_project"
  | "pending_approval"
  | "contract_confirmation"
  | "ai_confirmation";

export type WorkbenchNotificationType =
  | "pending_work"
  | "approval"
  | "contract_confirmation"
  | "ai_result"
  | "no_permission"
  | "system_status";

export type WorkbenchNotificationSeverity = "info" | "warning" | "critical";

export type PageStateKey =
  | "normal"
  | "empty"
  | "loading"
  | "no-permission"
  | "error"
  | "AI_Generating"
  | "AI_Failed"
  | "expired"
  | "archived";

export type PageStateStatus = "active" | "available" | "not_active";

export interface WorkbenchItem {
  id: string;
  kind: WorkbenchItemKind;
  title: string;
  description: string;
  module: ModuleKey;
  status: string;
  objectType: string;
  objectId: string;
  organizationId: string | null;
  updatedAt: string;
}

export interface WorkbenchNotification {
  id: string;
  type: WorkbenchNotificationType;
  severity: WorkbenchNotificationSeverity;
  title: string;
  body: string;
  module: ModuleKey;
  relatedObjectType: string | null;
  relatedObjectId: string | null;
  createdAt: string;
}

export interface PageStateDescriptor {
  key: PageStateKey;
  label: string;
  status: PageStateStatus;
  evidence: string;
}

export interface WorkbenchSummary {
  pendingWorkCount: number;
  responsibleTaskCount: number;
  participatingProjectCount: number;
  pendingApprovalCount: number;
  contractConfirmationCount: number;
  aiResultConfirmationCount: number;
  notificationCount: number;
  archivedProjectCount: number;
  expiredItemCount: number;
}

export interface WorkbenchResponse {
  summary: WorkbenchSummary;
  sections: {
    pendingWork: WorkbenchItem[];
    responsibleTasks: WorkbenchItem[];
    participatingProjects: WorkbenchItem[];
    pendingApprovals: WorkbenchItem[];
    contractConfirmations: WorkbenchItem[];
    aiConfirmations: WorkbenchItem[];
  };
  notifications: WorkbenchNotification[];
  pageStates: PageStateDescriptor[];
  permissionContext: {
    role: RoleKey;
    isAdministrator: boolean;
    visibleModules: ModuleKey[];
    dataScope: DataScope;
    canManageSettings: boolean;
  };
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
      "create_contract",
      "revise_contract",
      "confirm_contract_risk",
      "track_contract_execution",
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
      "read_ai_runs",
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
    ai: ["chat_summarize", "knowledge_query", "risk_hint", "read_ai_runs", "configure_ai_frameworks"]
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
    ai: ["chat_summarize", "task_draft", "knowledge_query", "risk_hint", "read_ai_runs"]
  },
  approver: {
    role: "approver",
    name: roles.approver,
    menu: coreWorkModules,
    dataScope: "assigned_organizations",
    canManageSettings: false,
    canManageOrganizations: false,
    canManageRoles: false,
    operations: ["create_task", "complete_task", "confirm_contract_risk", "upload_file"],
    approval: [
      "approve_current_node",
      "reject_current_node",
      "return_for_revision",
      "transfer_approval",
      "add_sign"
    ],
    files: ["view", "preview", "download", "upload", "reference_ai"],
    ai: ["chat_summarize", "knowledge_query", "approval_suggestion", "risk_hint", "read_ai_runs"]
  },
  finance_approver: {
    role: "finance_approver",
    name: roles.finance_approver,
    menu: coreWorkModules,
    dataScope: "assigned_organizations",
    canManageSettings: false,
    canManageOrganizations: false,
    canManageRoles: false,
    operations: ["create_task", "complete_task", "confirm_contract_risk", "upload_file"],
    approval: ["approve_current_node", "reject_current_node", "return_for_revision", "transfer_approval"],
    files: ["view", "preview", "download", "upload", "reference_ai"],
    ai: ["chat_summarize", "knowledge_query", "approval_suggestion", "risk_hint", "read_ai_runs"]
  },
  legal_approver: {
    role: "legal_approver",
    name: roles.legal_approver,
    menu: coreWorkModules,
    dataScope: "assigned_organizations",
    canManageSettings: false,
    canManageOrganizations: false,
    canManageRoles: false,
    operations: ["create_task", "complete_task", "confirm_contract_risk", "upload_file"],
    approval: [
      "approve_current_node",
      "reject_current_node",
      "return_for_revision",
      "transfer_approval",
      "add_sign",
      "write_back_approval_result"
    ],
    files: ["view", "preview", "download", "upload", "archive", "reference_ai"],
    ai: ["chat_summarize", "knowledge_query", "contract_review", "approval_suggestion", "risk_hint", "read_ai_runs"]
  },
  contract_initiator: {
    role: "contract_initiator",
    name: roles.contract_initiator,
    menu: coreWorkModules,
    dataScope: "own_records",
    canManageSettings: false,
    canManageOrganizations: false,
    canManageRoles: false,
    operations: ["create_task", "complete_task", "create_contract", "revise_contract", "confirm_contract_risk", "track_contract_execution", "upload_file"],
    approval: ["initiate_approval"],
    files: ["view", "preview", "download", "upload", "reference_ai"],
    ai: ["chat_summarize", "task_draft", "knowledge_query", "contract_review", "risk_hint", "read_ai_runs"]
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
    ai: ["chat_summarize", "knowledge_query", "approval_suggestion", "risk_hint", "read_ai_runs"]
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
    ai: ["chat_summarize", "task_draft", "knowledge_query", "approval_suggestion", "risk_hint", "read_ai_runs"]
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
    ai: ["chat_summarize", "task_draft", "knowledge_query", "approval_suggestion", "risk_hint", "read_ai_runs"]
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
    ai: ["chat_summarize", "task_draft", "knowledge_query", "approval_suggestion", "read_ai_runs"]
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
    return capability === "configure_ai_frameworks" || capability === "read_ai_runs";
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
