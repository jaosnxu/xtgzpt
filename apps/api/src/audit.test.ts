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

describe("audit infrastructure", () => {
  it("records login success, login failure, and permission denial", async () => {
    const server = buildServer();

    const failed = await server.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        username: "admin",
        password: "wrong"
      }
    });
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
    const auditLogs = await server.inject({
      method: "GET",
      url: "/audit-logs",
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });

    expect(failed.statusCode).toBe(401);
    expect(forbidden.statusCode).toBe(403);
    expect(auditLogs.statusCode).toBe(200);
    expect(auditLogs.json().auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorUserId: null,
          action: "auth.login_failed",
          objectType: "session",
          result: "failure",
          reason: "invalid_credentials"
        }),
        expect.objectContaining({
          actorUserId: "user-admin",
          action: "auth.login_success",
          objectType: "session",
          objectId: "user-admin",
          result: "success"
        }),
        expect.objectContaining({
          actorUserId: "user-member",
          action: "access.forbidden",
          objectType: "operation",
          result: "denied",
          reason: "operation:manage_permissions"
        })
      ])
    );
    expect(JSON.stringify(auditLogs.json().auditLogs)).not.toContain("secret-contract-name");
  });

  it("supports object and user audit queries for key actions", async () => {
    const server = buildServer();
    const ownerToken = await loginOnServer(server, "owner");
    const superToken = await loginOnServer(server, "super");

    const createProject = await server.inject({
      method: "POST",
      url: "/projects",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        title: "审计验证项目",
        organizationId: "org-product"
      }
    });
    const projectId = createProject.json().project.id as string;
    const objectAudit = await server.inject({
      method: "GET",
      url: `/objects/project/${projectId}/audit-logs`,
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });
    const userAudit = await server.inject({
      method: "GET",
      url: "/users/user-owner/audit-logs",
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });

    expect(createProject.statusCode).toBe(201);
    expect(objectAudit.statusCode).toBe(200);
    expect(userAudit.statusCode).toBe(200);
    expect(objectAudit.json().auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorUserId: "user-owner",
          action: "project.created",
          objectType: "project",
          objectId: projectId,
          result: "success"
        })
      ])
    );
    expect(userAudit.json().auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorUserId: "user-owner",
          actorRoleIds: ["project_owner"],
          action: "project.created",
          objectType: "project",
          result: "success",
          reason: "user_created_project",
          requestId: expect.any(String)
        })
      ])
    );
  });

  it("blocks audit queries for users without audit permission", async () => {
    const server = buildServer();
    const memberToken = await loginOnServer(server, "member");
    const response = await server.inject({
      method: "GET",
      url: "/audit-logs",
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden" });
  });
});
