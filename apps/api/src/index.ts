import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import {
  canManageOrganizations,
  canManageRoles,
  getPublicUser,
  platformBoundary,
  rolePolicies,
  seedOrganizations,
  seedUsers,
  visibleOrganizationsForUser,
  type UserAccount
} from "@xtgzpt/shared";

interface LoginBody {
  username?: string;
  password?: string;
}

const sessionPrefix = "dev-session";

function createSessionToken(user: UserAccount) {
  return `${sessionPrefix}:${user.id}:${randomUUID()}`;
}

export function buildServer() {
  const sessions = new Map<string, string>();
  const server = Fastify({
    logger: true
  });

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

  async function requireUser(request: { headers: Record<string, string | string[] | undefined> }) {
    const headerToken = request.headers.authorization ?? request.headers["x-session-token"];
    const token = Array.isArray(headerToken) ? headerToken[0] : headerToken;
    return getSessionUser(token);
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
        account.password === request.body?.password &&
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
      dataOrganizations: visibleOrganizationsForUser(user)
    };
  });

  server.get("/auth/session", async (request, reply) => {
    const user = await requireUser(request);

    if (!user) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    return {
      user: getPublicUser(user),
      visibleModules: rolePolicies[user.role].menu,
      dataOrganizations: visibleOrganizationsForUser(user)
    };
  });

  server.get("/settings/organizations", async (request, reply) => {
    const user = await requireUser(request);

    if (!user) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    if (!canManageOrganizations(user.role)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    return {
      organizations: seedOrganizations
    };
  });

  server.get("/settings/roles", async (request, reply) => {
    const user = await requireUser(request);

    if (!user) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    if (!canManageRoles(user.role)) {
      return reply.code(403).send({ error: "forbidden" });
    }

    return {
      roles: Object.values(rolePolicies)
    };
  });

  server.get("/business/organizations", async (request, reply) => {
    const user = await requireUser(request);

    if (!user) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    return {
      organizations: visibleOrganizationsForUser(user)
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
