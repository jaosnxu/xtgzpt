import { describe, expect, it } from "vitest";
import { buildServer } from "./index";

type TestServer = ReturnType<typeof buildServer>;

async function loginOnServer(server: TestServer, username: string) {
  const response = await server.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      username,
      password: "113113"
    }
  });

  expect(response.statusCode).toBe(200);
  return response.json().token as string;
}

async function login(username: string) {
  const server = buildServer();
  const token = await loginOnServer(server, username);
  return {
    server,
    token
  };
}

describe("access control", () => {
  it("blocks normal members from system settings", async () => {
    const { server, token } = await login("member");
    const response = await server.inject({
      method: "GET",
      url: "/settings/organizations",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });

  it("rejects forged session tokens", async () => {
    const server = buildServer();
    const response = await server.inject({
      method: "GET",
      url: "/settings/organizations",
      headers: {
        authorization: "Bearer dev-session:user-admin"
      }
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "unauthorized" });
  });

  it("lets system admins configure organizations and roles", async () => {
    const { server, token } = await login("admin");

    const organizations = await server.inject({
      method: "GET",
      url: "/settings/organizations",
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    const roles = await server.inject({
      method: "GET",
      url: "/settings/roles",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(organizations.statusCode).toBe(200);
    expect(organizations.json().organizations.length).toBeGreaterThan(1);
    expect(roles.statusCode).toBe(200);
    expect(roles.json().roles.some((role: { role: string }) => role.role === "admin")).toBe(true);
  });

  it("does not grant system admins all business data by default", async () => {
    const { server, token } = await login("admin");
    const response = await server.inject({
      method: "GET",
      url: "/business/organizations",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().organizations).toEqual([
      expect.objectContaining({
        id: "org-group"
      })
    ]);
  });

  it("does not expand member own-record scope to organization business data", async () => {
    const { server, token } = await login("member");
    const response = await server.inject({
      method: "GET",
      url: "/business/organizations",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().organizations).toEqual([]);
  });

  it("returns a versioned permission summary for the current user", async () => {
    const { server, token } = await login("admin");
    const response = await server.inject({
      method: "GET",
      url: "/auth/me/permissions",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().permissions).toEqual(
      expect.objectContaining({
        policyVersion: "seed-dev-003",
        role: "admin",
        dataScope: "assigned_organizations",
        operations: expect.arrayContaining(["manage_permissions"]),
        ai: expect.arrayContaining(["configure_ai_frameworks"])
      })
    );
  });

  it("records forbidden URL guessing without leaking object names", async () => {
    const server = buildServer();
    const memberToken = await loginOnServer(server, "member");
    const adminToken = await loginOnServer(server, "admin");

    const forbidden = await server.inject({
      method: "GET",
      url: "/settings/permission-policies",
      headers: {
        authorization: `Bearer ${memberToken}`,
        "x-request-id": "secret-contract-name"
      }
    });

    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json()).toEqual({ error: "forbidden" });

    const denials = await server.inject({
      method: "GET",
      url: "/settings/access-denials",
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });

    expect(denials.statusCode).toBe(200);
    expect(denials.json().denials).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorUserId: "user-member",
          dimension: "operation",
          action: "manage_permissions",
          resourceType: "operation",
          reason: "forbidden"
        })
      ])
    );
    expect(denials.json().denials.some((event: { requestId: string }) => event.requestId === "secret-contract-name")).toBe(false);
  });

  it("keeps operation gates separate from unfinished business implementation", async () => {
    const server = buildServer();
    const memberToken = await loginOnServer(server, "member");
    const ownerToken = await loginOnServer(server, "owner");

    const memberCreateProject = await server.inject({
      method: "POST",
      url: "/projects",
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    const ownerCreateProject = await server.inject({
      method: "POST",
      url: "/projects",
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });

    expect(memberCreateProject.statusCode).toBe(403);
    expect(memberCreateProject.json()).toEqual({ error: "forbidden" });
    expect(ownerCreateProject.statusCode).toBe(501);
    expect(ownerCreateProject.json()).toEqual({ error: "not_implemented", stage: "DEV-005" });
  });

  it("applies file and AI guards before unfinished endpoints run", async () => {
    const server = buildServer();
    const memberToken = await loginOnServer(server, "member");
    const superToken = await loginOnServer(server, "super");

    const guessedFile = await server.inject({
      method: "GET",
      url: "/files/secret-contract-name/download",
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    const forbiddenAi = await server.inject({
      method: "POST",
      url: "/knowledge/query",
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    const superAi = await server.inject({
      method: "POST",
      url: "/knowledge/query",
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });

    expect(guessedFile.statusCode).toBe(403);
    expect(guessedFile.json()).toEqual({ error: "forbidden" });
    expect(forbiddenAi.statusCode).toBe(403);
    expect(forbiddenAi.json()).toEqual({ error: "forbidden" });
    expect(superAi.statusCode).toBe(501);
    expect(superAi.json()).toEqual({ error: "not_implemented", stage: "DEV-008" });
  });

  it("does not write guessed unknown module names into denial records", async () => {
    const server = buildServer();
    const adminToken = await loginOnServer(server, "admin");

    const guessedModule = await server.inject({
      method: "GET",
      url: "/modules/secret-contract-name",
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });
    const denials = await server.inject({
      method: "GET",
      url: "/settings/access-denials",
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });

    expect(guessedModule.statusCode).toBe(404);
    expect(guessedModule.json()).toEqual({ error: "not_found" });
    expect(JSON.stringify(denials.json().denials)).not.toContain("secret-contract-name");
  });
});
