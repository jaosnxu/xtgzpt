import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import {
  canAccessFileAction,
  canAccessModule,
  canQueryAuditLogs,
  canManageSettings,
  canManageOrganizations,
  canManageRoles,
  canPerformOperation,
  canUseAiCapability,
  getPermissionSummary,
  getPublicUser,
  platformBoundary,
  platformModules,
  rolePolicies,
  seedOrganizations,
  seedUsers,
  visibleOrganizationsForUser,
  type AuditLogEntry,
  type AuditLogFilter,
  type AuditResult,
  type AiCapability,
  type FilePermission,
  type ModuleKey,
  type OperationPermission,
  type PermissionDimension,
  type ResourceAccessContext,
  type UserAccount
} from "@xtgzpt/shared";

interface LoginBody {
  username?: string;
  password?: string;
}

const sessionPrefix = "dev-session";
const devCredentials: Record<string, string> = {
  super: "113113",
  admin: "113113",
  owner: "113113",
  member: "113113"
};

interface DeniedAccessEvent {
  id: string;
  actorUserId: string | null;
  dimension: PermissionDimension | "auth";
  action: string;
  resourceType: string;
  reason: "unauthenticated" | "forbidden";
  requestId: string;
  createdAt: string;
}

interface AuditRecordInput {
  request: FastifyRequest;
  user?: UserAccount;
  action: string;
  objectType: string;
  objectId?: string | null;
  organizationId?: string | null;
  beforeSnapshotRef?: string | null;
  afterSnapshotRef?: string | null;
  reason: string;
  result: AuditResult;
  aiInvolved?: boolean;
  aiFrameworkVersion?: string | null;
}

function createSessionToken(user: UserAccount) {
  return `${sessionPrefix}:${user.id}:${randomUUID()}`;
}

export function buildServer() {
  const sessions = new Map<string, string>();
  const deniedAccessEvents: DeniedAccessEvent[] = [];
  const auditLogs: AuditLogEntry[] = [];
  const server = Fastify({
    logger: true
  });

  function requestId(request: FastifyRequest) {
    return request.id;
  }

  function sourceIp(request: FastifyRequest) {
    return request.ip || "unknown";
  }

  function recordAudit({
    request,
    user,
    action,
    objectType,
    objectId = null,
    organizationId = null,
    beforeSnapshotRef = null,
    afterSnapshotRef = null,
    reason,
    result,
    aiInvolved = false,
    aiFrameworkVersion = null
  }: AuditRecordInput) {
    const entry: AuditLogEntry = {
      id: randomUUID(),
      occurredAt: new Date().toISOString(),
      actorUserId: user?.id ?? null,
      actorRoleIds: user ? [user.role] : [],
      action,
      objectType,
      objectId,
      organizationId,
      sourceIp: sourceIp(request),
      requestId: requestId(request),
      beforeSnapshotRef,
      afterSnapshotRef,
      reason,
      result,
      aiInvolved,
      aiFrameworkVersion
    };

    auditLogs.push(entry);
    return entry;
  }

  function recordDeniedAccess({
    request,
    user,
    dimension,
    action,
    resourceType,
    reason
  }: {
    request: FastifyRequest;
    user?: UserAccount;
    dimension: DeniedAccessEvent["dimension"];
    action: string;
    resourceType: string;
    reason: DeniedAccessEvent["reason"];
  }) {
    recordAudit({
      request,
      user,
      action: `access.${reason}`,
      objectType: resourceType,
      reason: `${dimension}:${action}`,
      result: "denied"
    });
    deniedAccessEvents.push({
      id: randomUUID(),
      actorUserId: user?.id ?? null,
      dimension,
      action,
      resourceType,
      reason,
      requestId: requestId(request),
      createdAt: new Date().toISOString()
    });
  }

  function canReadAuditEntry(user: UserAccount, entry: AuditLogEntry) {
    if (!canQueryAuditLogs(user.role)) {
      return false;
    }

    if (rolePolicies[user.role].dataScope === "all_organizations") {
      return true;
    }

    if (!entry.organizationId) {
      return true;
    }

    return visibleOrganizationsForUser(user).some((organization) => organization.id === entry.organizationId);
  }

  function auditResultFor(user: UserAccount, filter: AuditLogFilter = {}) {
    return auditLogs.filter((entry) => {
      if (!canReadAuditEntry(user, entry)) {
        return false;
      }

      if (filter.actorUserId && entry.actorUserId !== filter.actorUserId) {
        return false;
      }

      if (filter.objectType && entry.objectType !== filter.objectType) {
        return false;
      }

      if (filter.objectId && entry.objectId !== filter.objectId) {
        return false;
      }

      return true;
    });
  }

  function getSessionUser(token: string | undefined) {
    if (!token) {
      return undefined;
    }

    const normalizedToken = token.startsWith("Bearer ") ? token.slice(7) : token;
    const userId = sessions.get(normalizedToken);

    if (!userId) {
      return undefined;
    }

    return seedUsers.find((user) => user.id === userId && user.status === "active");
  }

  async function requireUser(request: FastifyRequest, reply: FastifyReply) {
    const headerToken = request.headers.authorization ?? request.headers["x-session-token"];
    const token = Array.isArray(headerToken) ? headerToken[0] : headerToken;
    const user = getSessionUser(token);

    if (!user) {
      recordDeniedAccess({
        request,
        dimension: "auth",
        action: "authenticate",
        resourceType: "session",
        reason: "unauthenticated"
      });
      reply.code(401).send({ error: "unauthorized" });
      return undefined;
    }

    return user;
  }

  async function requireMenuAccess(request: FastifyRequest, reply: FastifyReply, module: ModuleKey) {
    const user = await requireUser(request, reply);

    if (!user) {
      return undefined;
    }

    if (!canAccessModule(user.role, module)) {
      recordDeniedAccess({
        request,
        user,
        dimension: "menu",
        action: `open:${module}`,
        resourceType: "module",
        reason: "forbidden"
      });
      reply.code(403).send({ error: "forbidden" });
      return undefined;
    }

    return user;
  }

  async function requireSettingsAccess(request: FastifyRequest, reply: FastifyReply) {
    const user = await requireMenuAccess(request, reply, "settings");

    if (!user) {
      return undefined;
    }

    if (!canManageSettings(user.role)) {
      recordDeniedAccess({
        request,
        user,
        dimension: "operation",
        action: "manage_settings",
        resourceType: "settings",
        reason: "forbidden"
      });
      reply.code(403).send({ error: "forbidden" });
      return undefined;
    }

    return user;
  }

  async function requireOperationAccess(
    request: FastifyRequest,
    reply: FastifyReply,
    operation: OperationPermission,
    resource?: ResourceAccessContext
  ) {
    const user = await requireUser(request, reply);

    if (!user) {
      return undefined;
    }

    if (!canPerformOperation(user, operation, resource)) {
      recordDeniedAccess({
        request,
        user,
        dimension: "operation",
        action: operation,
        resourceType: "operation",
        reason: "forbidden"
      });
      reply.code(403).send({ error: "forbidden" });
      return undefined;
    }

    return user;
  }

  async function requireFileAccess(
    request: FastifyRequest,
    reply: FastifyReply,
    action: FilePermission,
    resource: ResourceAccessContext
  ) {
    const user = await requireUser(request, reply);

    if (!user) {
      return undefined;
    }

    if (!canAccessFileAction(user, action, resource)) {
      recordDeniedAccess({
        request,
        user,
        dimension: "file",
        action,
        resourceType: "file",
        reason: "forbidden"
      });
      reply.code(403).send({ error: "forbidden" });
      return undefined;
    }

    return user;
  }

  async function requireAiAccess(
    request: FastifyRequest,
    reply: FastifyReply,
    capability: AiCapability,
    resource?: ResourceAccessContext
  ) {
    const user = await requireUser(request, reply);

    if (!user) {
      return undefined;
    }

    if (!canUseAiCapability(user, capability, resource)) {
      recordDeniedAccess({
        request,
        user,
        dimension: "ai",
        action: capability,
        resourceType: "ai",
        reason: "forbidden"
      });
      reply.code(403).send({ error: "forbidden" });
      return undefined;
    }

    return user;
  }

  server.get("/health", async () => ({
    status: "ok",
    service: "xtgzpt-api",
    boundary: platformBoundary
  }));

  server.post<{ Body: LoginBody }>("/auth/login", async (request, reply) => {
    const user = seedUsers.find(
      (account) =>
        account.username === request.body?.username &&
        devCredentials[account.username] === request.body?.password &&
        account.status === "active"
    );

    if (!user) {
      recordAudit({
        request,
        action: "auth.login_failed",
        objectType: "session",
        reason: "invalid_credentials",
        result: "failure"
      });
      return reply.code(401).send({ error: "invalid_credentials" });
    }

    const token = createSessionToken(user);
    sessions.set(token, user.id);
    recordAudit({
      request,
      user,
      action: "auth.login_success",
      objectType: "session",
      objectId: user.id,
      organizationId: user.defaultOrganizationId,
      reason: "user_login",
      result: "success"
    });

    return {
      token,
      user: getPublicUser(user),
      visibleModules: rolePolicies[user.role].menu,
      dataOrganizations: visibleOrganizationsForUser(user),
      permissions: getPermissionSummary(user)
    };
  });

  server.post("/auth/logout", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    const headerToken = request.headers.authorization ?? request.headers["x-session-token"];
    const token = Array.isArray(headerToken) ? headerToken[0] : headerToken;
    const normalizedToken = token?.startsWith("Bearer ") ? token.slice(7) : token;

    if (normalizedToken) {
      sessions.delete(normalizedToken);
    }

    recordAudit({
      request,
      user,
      action: "auth.logout",
      objectType: "session",
      objectId: user.id,
      organizationId: user.defaultOrganizationId,
      reason: "user_logout",
      result: "success"
    });

    return {
      status: "ok"
    };
  });

  server.get("/auth/session", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    return {
      user: getPublicUser(user),
      visibleModules: rolePolicies[user.role].menu,
      dataOrganizations: visibleOrganizationsForUser(user),
      permissions: getPermissionSummary(user)
    };
  });

  server.get("/auth/me", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    return {
      user: getPublicUser(user),
      context: {
        currentUserId: user.id,
        organizationScope: visibleOrganizationsForUser(user).map((organization) => organization.id),
        roleIds: [user.role],
        permissionPolicyVersion: getPermissionSummary(user).policyVersion,
        requestId: requestId(request)
      }
    };
  });

  server.get("/auth/me/menus", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    return {
      menus: rolePolicies[user.role].menu
    };
  });

  server.get("/auth/me/permissions", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    return {
      permissions: getPermissionSummary(user)
    };
  });

  server.get("/settings/organizations", async (request, reply) => {
    const user = await requireSettingsAccess(request, reply);

    if (!user) {
      return;
    }

    if (!canManageOrganizations(user.role)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    return {
      organizations: seedOrganizations
    };
  });

  server.get("/settings/roles", async (request, reply) => {
    const user = await requireSettingsAccess(request, reply);

    if (!user) {
      return;
    }

    if (!canManageRoles(user.role)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    return {
      roles: Object.values(rolePolicies)
    };
  });

  server.get("/settings/permission-policies", async (request, reply) => {
    const user = await requireOperationAccess(request, reply, "manage_permissions");

    if (!user) {
      return;
    }

    return {
      policyVersion: getPermissionSummary(user).policyVersion,
      policies: Object.values(rolePolicies).map((policy) => ({
        role: policy.role,
        menu: policy.menu,
        dataScope: policy.dataScope,
        operations: policy.operations,
        files: policy.files,
        ai: policy.ai
      }))
    };
  });

  server.get("/settings/access-denials", async (request, reply) => {
    const user = await requireOperationAccess(request, reply, "manage_permissions");

    if (!user) {
      return;
    }

    return {
      denials: deniedAccessEvents
    };
  });

  server.get("/audit-logs", async (request, reply) => {
    const user = await requireOperationAccess(request, reply, "manage_permissions");

    if (!user) {
      return;
    }

    recordAudit({
      request,
      user,
      action: "audit.query",
      objectType: "audit_log",
      reason: "query_audit_logs",
      result: "success"
    });

    return {
      auditLogs: auditResultFor(user)
    };
  });

  server.get<{ Params: { type: string; id: string } }>("/objects/:type/:id/audit-logs", async (request, reply) => {
    const user = await requireOperationAccess(request, reply, "manage_permissions");

    if (!user) {
      return;
    }

    recordAudit({
      request,
      user,
      action: "audit.object_query",
      objectType: "audit_log",
      reason: "query_object_audit_logs",
      result: "success"
    });

    return {
      auditLogs: auditResultFor(user, {
        objectType: request.params.type,
        objectId: request.params.id
      })
    };
  });

  server.get<{ Params: { id: string } }>("/users/:id/audit-logs", async (request, reply) => {
    const user = await requireOperationAccess(request, reply, "manage_permissions");

    if (!user) {
      return;
    }

    recordAudit({
      request,
      user,
      action: "audit.user_query",
      objectType: "audit_log",
      reason: "query_user_audit_logs",
      result: "success"
    });

    return {
      auditLogs: auditResultFor(user, {
        actorUserId: request.params.id
      })
    };
  });

  server.get("/business/organizations", async (request, reply) => {
    const user = await requireUser(request, reply);

    if (!user) {
      return;
    }

    return {
      organizations: visibleOrganizationsForUser(user)
    };
  });

  server.post("/projects", async (request, reply) => {
    const user = await requireOperationAccess(request, reply, "create_project");

    if (!user) {
      return;
    }

    recordAudit({
      request,
      user,
      action: "project.create_requested",
      objectType: "project",
      objectId: "dev005-not-implemented",
      organizationId: user.defaultOrganizationId,
      reason: "permission_passed_but_dev005_not_implemented",
      result: "failure"
    });
    return reply.code(501).send({ error: "not_implemented", stage: "DEV-005" });
  });

  server.post("/files", async (request, reply) => {
    const user = await requireOperationAccess(request, reply, "upload_file");

    if (!user) {
      return;
    }

    recordAudit({
      request,
      user,
      action: "file.upload_requested",
      objectType: "file",
      objectId: "dev005-not-implemented",
      organizationId: user.defaultOrganizationId,
      reason: "permission_passed_but_dev005_not_implemented",
      result: "failure"
    });
    return reply.code(501).send({ error: "not_implemented", stage: "DEV-005" });
  });

  server.get("/files/:id/download", async (request, reply) => {
    const user = await requireFileAccess(request, reply, "download", {
      participantUserIds: []
    });

    if (!user) {
      return;
    }

    recordAudit({
      request,
      user,
      action: "file.download_requested",
      objectType: "file",
      objectId: "dev005-not-implemented",
      reason: "permission_passed_but_dev005_not_implemented",
      result: "failure"
    });
    return reply.code(501).send({ error: "not_implemented", stage: "DEV-005" });
  });

  server.post("/knowledge/query", async (request, reply) => {
    const user = await requireAiAccess(request, reply, "knowledge_query", {
      participantUserIds: []
    });

    if (!user) {
      return;
    }

    recordAudit({
      request,
      user,
      action: "ai.knowledge_query_requested",
      objectType: "ai_run",
      objectId: "dev008-not-implemented",
      organizationId: user.defaultOrganizationId,
      reason: "permission_passed_but_dev008_not_implemented",
      result: "failure",
      aiInvolved: true,
      aiFrameworkVersion: "not_started"
    });
    return reply.code(501).send({ error: "not_implemented", stage: "DEV-008" });
  });

  server.get<{ Params: { module: string } }>("/modules/:module", async (request, reply) => {
    const moduleKey = request.params.module;

    if (!platformModules.some((module) => module.key === moduleKey)) {
      return reply.code(404).send({ error: "not_found" });
    }

    const user = await requireMenuAccess(request, reply, moduleKey as ModuleKey);

    if (!user) {
      return;
    }

    return {
      module: request.params.module,
      status: request.params.module === "dashboard" || request.params.module === "settings" ? "available" : "not_implemented"
    };
  });

  return server;
}

if (process.env.NODE_ENV !== "test") {
  const port = Number(process.env.PORT ?? 3002);
  const host = process.env.HOST ?? "127.0.0.1";
  const server = buildServer();

  server.listen({ host, port }).catch((error) => {
    server.log.error(error);
    process.exit(1);
  });
}
