import { describe, expect, it } from "vitest";
import type { WorkbenchResponse } from "@xtgzpt/shared";
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

describe("workbench and in-app notifications", () => {
  it("returns role-aware work entries, notifications and page states", async () => {
    const server = buildServer();
    const ownerToken = await loginOnServer(server, "owner");
    const memberToken = await loginOnServer(server, "member");
    const adminToken = await loginOnServer(server, "admin");

    const createProject = await server.inject({
      method: "POST",
      url: "/projects",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        title: "DEV-011 工作台项目",
        organizationId: "org-product"
      }
    });
    const projectId = createProject.json().project.id as string;

    await server.inject({
      method: "POST",
      url: `/projects/${projectId}/members`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        userId: "user-member"
      }
    });

    const createTask = await server.inject({
      method: "POST",
      url: "/tasks",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        projectId,
        title: "成员待处理任务",
        assigneeUserId: "user-member",
        confirmerUserId: "user-owner"
      }
    });
    const taskId = createTask.json().task.id as string;

    const createThread = await server.inject({
      method: "POST",
      url: "/chat/threads",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        title: "DEV-011 AI 确认会话",
        organizationId: "org-product",
        memberUserIds: ["user-member"],
        relatedObjectType: "project",
        relatedObjectId: projectId
      }
    });
    const threadId = createThread.json().thread.id as string;

    await server.inject({
      method: "POST",
      url: `/chat/threads/${threadId}/messages`,
      headers: {
        authorization: `Bearer ${memberToken}`
      },
      payload: {
        content: "请生成一个仍需人工确认的任务草稿。"
      }
    });

    const taskDraft = await server.inject({
      method: "POST",
      url: `/chat/threads/${threadId}/ai/task-draft`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    const draftId = taskDraft.json().draft.id as string;

    const memberWorkbench = await server.inject({
      method: "GET",
      url: "/workbench",
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    const adminWorkbench = await server.inject({
      method: "GET",
      url: "/workbench",
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });

    expect(memberWorkbench.statusCode).toBe(200);
    expect(adminWorkbench.statusCode).toBe(200);

    const memberBody = memberWorkbench.json() as WorkbenchResponse;
    const adminBody = adminWorkbench.json() as WorkbenchResponse;
    const memberNotificationTypes = new Set(memberBody.notifications.map((item) => item.type));

    expect(memberBody.summary.pendingWorkCount).toBe(1);
    expect(memberBody.summary.responsibleTaskCount).toBe(1);
    expect(memberBody.summary.participatingProjectCount).toBe(1);
    expect(memberBody.summary.aiResultConfirmationCount).toBe(1);
    expect(memberBody.sections.pendingWork).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectId: taskId,
          kind: "pending_task"
        })
      ])
    );
    expect(memberBody.sections.aiConfirmations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          objectId: draftId,
          kind: "ai_confirmation"
        })
      ])
    );
    expect(memberNotificationTypes).toEqual(
      new Set(["pending_work", "approval", "contract_confirmation", "ai_result", "no_permission", "system_status"])
    );
    expect(memberBody.pageStates.map((item) => item.key)).toEqual(
      expect.arrayContaining([
        "normal",
        "empty",
        "loading",
        "no-permission",
        "error",
        "AI_Generating",
        "AI_Failed",
        "expired",
        "archived"
      ])
    );
    expect(memberBody.permissionContext.canManageSettings).toBe(false);

    expect(adminBody.permissionContext.canManageSettings).toBe(true);
    expect(adminBody.permissionContext.dataScope).toBe("assigned_organizations");
    expect(adminBody.summary.participatingProjectCount).toBe(0);
    expect(adminBody.sections.pendingWork).toHaveLength(0);
    expect(adminBody.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "no_permission",
          title: "管理员数据范围受限"
        })
      ])
    );
  });
});
