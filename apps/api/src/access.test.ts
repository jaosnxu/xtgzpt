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
  it("lets all 11 phase-1 seed roles log in", async () => {
    const server = buildServer();
    const usernames = [
      "super",
      "admin",
      "knowledge",
      "approver",
      "finance",
      "legal",
      "contract",
      "exec",
      "dept",
      "owner",
      "member"
    ];

    for (const username of usernames) {
      const token = await loginOnServer(server, username);
      expect(token).toEqual(expect.any(String));
    }
  });

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
    expect(roles.json().roles).toHaveLength(11);
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
        policyVersion: "seed-dev-016",
        role: "admin",
        data: expect.objectContaining({
          scope: "assigned_organizations",
          organizationIds: ["org-group"]
        }),
        operation: expect.arrayContaining(["manage_permissions"]),
        approval: expect.arrayContaining(["configure_approval_policy"]),
        file: expect.arrayContaining(["reference_ai"]),
        ai: expect.arrayContaining(["read_ai_runs", "configure_ai_frameworks"])
      })
    );
  });

  it("returns policy API output with six permission dimensions", async () => {
    const { server, token } = await login("admin");
    const response = await server.inject({
      method: "GET",
      url: "/settings/permission-policies",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        policyVersion: "seed-dev-016",
        policies: expect.arrayContaining([
          expect.objectContaining({
            role: "admin",
            ai: expect.arrayContaining(["read_ai_runs", "configure_ai_frameworks"])
          }),
          expect.objectContaining({
            role: "legal_approver",
            menu: expect.any(Array),
            data: expect.objectContaining({ scope: "assigned_organizations" }),
            operation: expect.any(Array),
            approval: expect.arrayContaining(["approve_current_node"]),
            file: expect.any(Array),
            ai: expect.any(Array)
          })
        ])
      })
    );
  });

  it("returns approval policy output through a separate approval permission API", async () => {
    const { server, token } = await login("admin");
    const response = await server.inject({
      method: "GET",
      url: "/settings/approval-permission-policies",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        policyVersion: "seed-dev-016",
        dimension: "approval",
        approval: expect.arrayContaining([
          expect.objectContaining({
            role: "approver",
            permissions: expect.arrayContaining(["approve_current_node", "reject_current_node"])
          })
        ])
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

  it("audits normal-user denials for settings and approval permission APIs", async () => {
    const server = buildServer();
    const memberToken = await loginOnServer(server, "member");
    const adminToken = await loginOnServer(server, "admin");

    const settings = await server.inject({
      method: "GET",
      url: "/settings/organizations",
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    const approvalPolicies = await server.inject({
      method: "GET",
      url: "/settings/approval-permission-policies",
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    const denials = await server.inject({
      method: "GET",
      url: "/settings/access-denials",
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });

    expect(settings.statusCode).toBe(403);
    expect(approvalPolicies.statusCode).toBe(403);
    expect(denials.statusCode).toBe(200);
    expect(denials.json().denials).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorUserId: "user-member",
          dimension: "menu",
          action: "open:settings",
          resourceType: "module",
          reason: "forbidden"
        }),
        expect.objectContaining({
          actorUserId: "user-member",
          dimension: "approval",
          action: "configure_approval_policy",
          resourceType: "approval_policy",
          reason: "forbidden"
        })
      ])
    );
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
      },
      payload: {
        title: "权限验证项目",
        organizationId: "org-product"
      }
    });

    expect(memberCreateProject.statusCode).toBe(403);
    expect(memberCreateProject.json()).toEqual({ error: "forbidden" });
    expect(ownerCreateProject.statusCode).toBe(201);
    expect(ownerCreateProject.json().project).toEqual(
      expect.objectContaining({
        title: "权限验证项目",
        ownerUserId: "user-owner",
        status: "active"
      })
    );
  });

  it("marks implemented project and task modules as available", async () => {
    const server = buildServer();
    const ownerToken = await loginOnServer(server, "owner");

    const projectsModule = await server.inject({
      method: "GET",
      url: "/modules/projects",
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });
    const tasksModule = await server.inject({
      method: "GET",
      url: "/modules/tasks",
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });

    expect(projectsModule.statusCode).toBe(200);
    expect(projectsModule.json()).toEqual({ module: "projects", status: "available" });
    expect(tasksModule.statusCode).toBe(200);
    expect(tasksModule.json()).toEqual({ module: "tasks", status: "available" });
  });

  it("applies file guards and validates implemented knowledge query", async () => {
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
    const emptyAiQuery = await server.inject({
      method: "POST",
      url: "/knowledge/query",
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    const superAiQuery = await server.inject({
      method: "POST",
      url: "/knowledge/query",
      headers: {
        authorization: `Bearer ${superToken}`
      },
      payload: {
        query: "secret"
      }
    });

    expect(guessedFile.statusCode).toBe(404);
    expect(guessedFile.json()).toEqual({ error: "not_found" });
    expect(JSON.stringify(guessedFile.json())).not.toContain("secret-contract-name");
    expect(emptyAiQuery.statusCode).toBe(400);
    expect(emptyAiQuery.json()).toEqual({ error: "query_required" });
    expect(superAiQuery.statusCode).toBe(200);
    expect(superAiQuery.json()).toEqual({
      query: "secret",
      results: []
    });
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
