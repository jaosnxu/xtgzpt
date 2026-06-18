import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import { randomUUID } from "node:crypto";
import {
  canAccessFileAction,
  canAccessModule,
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

function createSessionToken(user: UserAccount) {
  return `${sessionPrefix}:${user.id}:${randomUUID()}`;
}

export function buildServer() {
  const sessions = new Map<string, string>();
  const deniedAccessEvents: DeniedAccessEvent[] = [];
  const server = Fastify({
    logger: true
  });

  function requestId(request: FastifyRequest) {
    return request.id;
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
      return reply.code(401).send({ error: "invalid_credentials" });
    }

    const token = createSessionToken(user);
    sessions.set(token, user.id);

    return {
      token,
      user: getPublicUser(user),
      visibleModules: rolePolicies[user.role].menu,
      dataOrganizations: visibleOrganizationsForUser(user),
      permissions: getPermissionSummary(user)
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

    return reply.code(501).send({ error: "not_implemented", stage: "DEV-005" });
  });

  server.post("/files", async (request, reply) => {
    const user = await requireOperationAccess(request, reply, "upload_file");

    if (!user) {
      return;
    }

    return reply.code(501).send({ error: "not_implemented", stage: "DEV-005" });
  });

  server.get("/files/:id/download", async (request, reply) => {
    const user = await requireFileAccess(request, reply, "download", {
      participantUserIds: []
    });

    if (!user) {
      return;
    }

    return reply.code(501).send({ error: "not_implemented", stage: "DEV-005" });
  });

  server.post("/knowledge/query", async (request, reply) => {
    const user = await requireAiAccess(request, reply, "knowledge_query", {
      participantUserIds: []
    });

    if (!user) {
      return;
    }

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
