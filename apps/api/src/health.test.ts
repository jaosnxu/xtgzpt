import { describe, expect, it } from "vitest";
import { buildServer } from "./index";

describe("health endpoint", () => {
  it("returns service status and frozen boundary", async () => {
    const server = buildServer();
    const response = await server.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      boundary: {
        aiAuthority: "draft-suggest-remind-only",
        approvalAuthority: "human-only"
      },
      status: "ok",
      service: "xtgzpt-api"
    });
  });
});
