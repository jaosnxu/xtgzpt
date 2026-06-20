import { describe, expect, it } from "vitest";
import {
  canAccessModule,
  canAccessFileAction,
  canPerformOperation,
  canPerformApprovalAction,
  canUseAiCapability,
  canQueryAuditLogs,
  getPermissionSummary,
  canManageOrganizations,
  permissionPolicyVersion,
  canViewOrganizationData,
  platformBoundary,
  roles,
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

  it("supports all 11 phase-1 roles", () => {
    expect(Object.keys(roles)).toHaveLength(11);
    expect(new Set(seedUsers.map((user) => user.role))).toEqual(new Set(Object.keys(roles)));
  });

  it("lets system admins configure settings without granting all business data", () => {
    const admin = seedUsers.find((user) => user.username === "admin");

    expect(admin).toBeDefined();
    expect(canManageOrganizations("admin")).toBe(true);
    expect(canViewOrganizationData(admin!, "org-group")).toBe(true);
    expect(canViewOrganizationData(admin!, "org-store-a")).toBe(false);
    expect(visibleOrganizationsForUser(admin!)).toHaveLength(1);
  });

  it("does not treat own-record access as organization-wide data access", () => {
    const member = seedUsers.find((user) => user.username === "member");

    expect(member).toBeDefined();
    expect(canAccessModule("member", "settings")).toBe(false);
    expect(canViewOrganizationData(member!, "org-store-a")).toBe(false);
    expect(visibleOrganizationsForUser(member!)).toEqual([]);
  });

  it("returns a versioned multi-dimension permission summary", () => {
    const admin = seedUsers.find((user) => user.username === "admin");

    expect(admin).toBeDefined();
    expect(getPermissionSummary(admin!).policyVersion).toBe(permissionPolicyVersion);
    expect(getPermissionSummary(admin!).menu).toContain("settings");
    expect(getPermissionSummary(admin!).data.scope).toBe("assigned_organizations");
    expect(getPermissionSummary(admin!).operation).toContain("manage_permissions");
    expect(getPermissionSummary(admin!).approval).toContain("configure_approval_policy");
    expect(getPermissionSummary(admin!).file).toContain("reference_ai");
    expect(getPermissionSummary(admin!).ai).toContain("configure_ai_frameworks");
  });

  it("keeps approval permissions separate from operations and tied to current-node humans", () => {
    const approver = seedUsers.find((user) => user.username === "approver");
    const admin = seedUsers.find((user) => user.username === "admin");

    expect(approver).toBeDefined();
    expect(admin).toBeDefined();
    expect(canPerformOperation(approver!, "manage_permissions")).toBe(false);
    expect(canPerformApprovalAction(admin!, "configure_approval_policy")).toBe(true);
    expect(canPerformApprovalAction(approver!, "approve_current_node", {
      organizationId: "org-product",
      currentNodeApproverUserIds: ["user-approver"]
    })).toBe(true);
    expect(canPerformApprovalAction(approver!, "approve_current_node", {
      organizationId: "org-product",
      currentNodeApproverUserIds: ["user-legal"]
    })).toBe(false);
  });

  it("keeps operation permissions tied to role and resource scope", () => {
    const owner = seedUsers.find((user) => user.username === "owner");
    const member = seedUsers.find((user) => user.username === "member");

    expect(owner).toBeDefined();
    expect(member).toBeDefined();
    expect(canPerformOperation(owner!, "assign_task", { organizationId: "org-product" })).toBe(true);
    expect(canPerformOperation(owner!, "assign_task", { organizationId: "org-store-a" })).toBe(false);
    expect(canPerformOperation(member!, "assign_task", { ownerUserId: member!.id })).toBe(false);
  });

  it("requires file and AI access to inherit source object access", () => {
    const member = seedUsers.find((user) => user.username === "member");
    const admin = seedUsers.find((user) => user.username === "admin");

    expect(member).toBeDefined();
    expect(admin).toBeDefined();
    expect(canAccessFileAction(member!, "download", { ownerUserId: member!.id })).toBe(true);
    expect(canAccessFileAction(member!, "archive", { ownerUserId: member!.id })).toBe(false);
    expect(canUseAiCapability(member!, "knowledge_query", { participantUserIds: [member!.id] })).toBe(true);
    expect(canUseAiCapability(member!, "contract_review", { participantUserIds: [member!.id] })).toBe(false);
    expect(canUseAiCapability(admin!, "configure_ai_frameworks")).toBe(true);
    expect(canUseAiCapability(member!, "configure_ai_frameworks")).toBe(false);
  });

  it("restricts audit log queries to permission managers", () => {
    expect(canQueryAuditLogs("super_admin")).toBe(true);
    expect(canQueryAuditLogs("admin")).toBe(true);
    expect(canQueryAuditLogs("project_owner")).toBe(false);
    expect(canQueryAuditLogs("member")).toBe(false);
  });
});
