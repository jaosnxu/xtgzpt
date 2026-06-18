import { describe, expect, it } from "vitest";
import {
  canAccessModule,
  canManageOrganizations,
  canViewOrganizationData,
  platformBoundary,
  seedUsers,
  visibleOrganizationsForUser
} from "./platform";

describe("platform boundary", () => {
  it("keeps AI out of final approval authority", () => {
    expect(platformBoundary.approvalAuthority).toBe("human-only");
    expect(platformBoundary.aiAuthority).toBe("draft-suggest-remind-only");
  });

  it("hides system settings from normal members", () => {
    expect(canAccessModule("member", "settings")).toBe(false);
    expect(canAccessModule("admin", "settings")).toBe(true);
  });

  it("lets system admins configure settings without granting all business data", () => {
    const admin = seedUsers.find((user) => user.username === "admin");

    expect(admin).toBeDefined();
    expect(canManageOrganizations("admin")).toBe(true);
    expect(canViewOrganizationData(admin!, "org-group")).toBe(true);
    expect(canViewOrganizationData(admin!, "org-store-a")).toBe(false);
    expect(visibleOrganizationsForUser(admin!)).toHaveLength(1);
  });
});
