import { describe, expect, it } from "vitest";
import { canAccessModule, platformBoundary } from "./platform";

describe("platform boundary", () => {
  it("keeps AI out of final approval authority", () => {
    expect(platformBoundary.approvalAuthority).toBe("human-only");
    expect(platformBoundary.aiAuthority).toBe("draft-suggest-remind-only");
  });

  it("hides system settings from normal members", () => {
    expect(canAccessModule("member", "settings")).toBe(false);
    expect(canAccessModule("admin", "settings")).toBe(true);
  });
});
