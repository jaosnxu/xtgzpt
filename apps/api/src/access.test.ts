import { describe, expect, it } from "vitest";
import { buildServer } from "./index";

async function login(username: string) {
  const server = buildServer();
  const response = await server.inject({
    method: "POST",
    url: "/auth/login",
    payload: {
      username,
      password: "113113"
    }
  });

  expect(response.statusCode).toBe(200);
  return {
    server,
    token: response.json().token as string
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
});
