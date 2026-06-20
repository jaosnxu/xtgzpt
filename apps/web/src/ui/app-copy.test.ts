import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("frontend production copy", () => {
  const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

  it("does not expose development-stage labels in user-facing screens", () => {
    expect(appSource).not.toMatch(/DEV-\d+/);
    expect(appSource).not.toContain("不实现完整流程");
    expect(appSource).not.toContain("当前只展示");
    expect(appSource).not.toContain("调试");
  });

  it("keeps settings structured as production governance modules", () => {
    expect(appSource).toContain("组织与账号");
    expect(appSource).toContain("角色与数据范围");
    expect(appSource).toContain("审批与文件");
    expect(appSource).toContain("审计与运行");
  });
});
