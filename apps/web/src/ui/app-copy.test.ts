import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("frontend production copy", () => {
  const appSource = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

  it("does not expose development-stage labels in user-facing screens", () => {
    expect(appSource).not.toMatch(/DEV-\d+/);
    expect(appSource).not.toContain("不实现完整流程");
    expect(appSource).not.toContain("当前只展示");
    expect(appSource).not.toContain("调试");
    expect(appSource).not.toContain("认证由 API");
    expect(appSource).not.toContain("正在请求 API");
    expect(appSource).not.toContain("通过 API 读取");
    expect(appSource).not.toContain("访问边界");
    expect(appSource).not.toContain("页面状态");
    expect(appSource).not.toContain("前端请求");
  });

  it("keeps settings structured as production governance modules", () => {
    expect(appSource).toContain("组织与账号");
    expect(appSource).toContain("角色与数据范围");
    expect(appSource).toContain("审批与文件");
    expect(appSource).toContain("审计与运行");
  });

  it("keeps task center and AI boundary language user-facing", () => {
    for (const label of ["全部", "我的", "我创建", "待确认", "已逾期", "已完成"]) {
      expect(appSource).toContain(label);
    }

    expect(appSource).toContain("AI 输出必须人工确认后才能进入正式对象。");
    expect(appSource).toContain("账号安全");
    expect(appSource).toContain("displayStatus");
    expect(appSource).toContain("displayPriority");
    expect(appSource).toContain("relatedObjectLabel");
    expect(appSource).toContain('assigned_organizations: "授权组织"');
    expect(appSource).not.toMatch(/finance|ERP|procurement|inventory|mobile/i);
  });

  it("keeps browser session recovery for refreshed deep links", () => {
    expect(appSource).toContain("xtgzpt.session.v1");
    expect(appSource).toContain("readStoredSession");
    expect(appSource).toContain("writeStoredSession");
    expect(appSource).toContain("登录已过期，请重新登录");
  });
});
