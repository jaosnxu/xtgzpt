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

describe("project and task loop", () => {
  it("runs project member visibility and task completion loop", async () => {
    const server = buildServer();
    const ownerToken = await loginOnServer(server, "owner");
    const memberToken = await loginOnServer(server, "member");
    const adminToken = await loginOnServer(server, "admin");
    const superToken = await loginOnServer(server, "super");

    const createProject = await server.inject({
      method: "POST",
      url: "/projects",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        title: "DEV-005 项目闭环",
        summary: "用于验证项目和任务主链路。",
        organizationId: "org-product"
      }
    });
    const projectId = createProject.json().project.id as string;

    const addMember = await server.inject({
      method: "POST",
      url: `/projects/${projectId}/members`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        userId: "user-member"
      }
    });
    const memberProjects = await server.inject({
      method: "GET",
      url: "/projects",
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    const adminProjectGuess = await server.inject({
      method: "GET",
      url: `/projects/${projectId}`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });

    expect(createProject.statusCode).toBe(201);
    expect(addMember.statusCode).toBe(200);
    expect(memberProjects.statusCode).toBe(200);
    expect(memberProjects.json().projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: projectId,
          title: "DEV-005 项目闭环"
        })
      ])
    );
    expect(adminProjectGuess.statusCode).toBe(404);
    expect(JSON.stringify(adminProjectGuess.json())).not.toContain("DEV-005 项目闭环");

    const createTask = await server.inject({
      method: "POST",
      url: "/tasks",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        projectId,
        title: "完成首个任务",
        description: "负责人提交，项目负责人确认。",
        assigneeUserId: "user-member",
        confirmerUserId: "user-owner"
      }
    });
    const taskId = createTask.json().task.id as string;
    const memberTasks = await server.inject({
      method: "GET",
      url: "/tasks",
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    const taskInProgress = await server.inject({
      method: "POST",
      url: `/tasks/${taskId}/status`,
      headers: {
        authorization: `Bearer ${memberToken}`
      },
      payload: {
        status: "in_progress"
      }
    });
    const taskSubmitted = await server.inject({
      method: "POST",
      url: `/tasks/${taskId}/status`,
      headers: {
        authorization: `Bearer ${memberToken}`
      },
      payload: {
        status: "submitted"
      }
    });
    const memberCompleteBlocked = await server.inject({
      method: "POST",
      url: `/tasks/${taskId}/status`,
      headers: {
        authorization: `Bearer ${memberToken}`
      },
      payload: {
        status: "completed"
      }
    });
    const ownerComplete = await server.inject({
      method: "POST",
      url: `/tasks/${taskId}/status`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        status: "completed"
      }
    });

    expect(createTask.statusCode).toBe(201);
    expect(memberTasks.statusCode).toBe(200);
    expect(memberTasks.json().tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: taskId,
          projectId,
          title: "完成首个任务"
        })
      ])
    );
    expect(taskInProgress.statusCode).toBe(200);
    expect(taskSubmitted.statusCode).toBe(200);
    expect(memberCompleteBlocked.statusCode).toBe(403);
    expect(memberCompleteBlocked.json()).toEqual({ error: "confirmation_required" });
    expect(ownerComplete.statusCode).toBe(200);
    expect(ownerComplete.json().task.status).toBe("completed");

    const projectCompleted = await server.inject({
      method: "POST",
      url: `/projects/${projectId}/status`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        status: "completed"
      }
    });
    const projectArchived = await server.inject({
      method: "POST",
      url: `/projects/${projectId}/status`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        status: "archived"
      }
    });
    const ownerProjectsAfterArchive = await server.inject({
      method: "GET",
      url: "/projects",
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });
    const taskAudit = await server.inject({
      method: "GET",
      url: `/objects/task/${taskId}/audit-logs`,
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });

    expect(projectCompleted.statusCode).toBe(200);
    expect(projectArchived.statusCode).toBe(200);
    expect(ownerProjectsAfterArchive.statusCode).toBe(200);
    expect(ownerProjectsAfterArchive.json().projects).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: projectId
        })
      ])
    );
    expect(taskAudit.statusCode).toBe(200);
    expect(taskAudit.json().auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "task.created",
          objectId: taskId
        }),
        expect.objectContaining({
          action: "task.status_changed",
          objectId: taskId,
          reason: "task_status:completed"
        })
      ])
    );
  });

  it("requires a cancellation reason", async () => {
    const server = buildServer();
    const ownerToken = await loginOnServer(server, "owner");

    const createProject = await server.inject({
      method: "POST",
      url: "/projects",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        title: "取消任务验证",
        organizationId: "org-product"
      }
    });
    const projectId = createProject.json().project.id as string;
    const createTask = await server.inject({
      method: "POST",
      url: "/tasks",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        projectId,
        title: "需要取消的任务",
        assigneeUserId: "user-owner",
        confirmerUserId: "user-owner"
      }
    });
    const taskId = createTask.json().task.id as string;
    const missingReason = await server.inject({
      method: "POST",
      url: `/tasks/${taskId}/status`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        status: "cancelled"
      }
    });
    const cancelled = await server.inject({
      method: "POST",
      url: `/tasks/${taskId}/status`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        status: "cancelled",
        reason: "需求范围调整"
      }
    });

    expect(missingReason.statusCode).toBe(400);
    expect(missingReason.json()).toEqual({ error: "cancel_reason_required" });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().task).toEqual(
      expect.objectContaining({
        status: "cancelled",
        cancelReason: "需求范围调整"
      })
    );
  });

  it("filters tasks and records comments, activity, submit, return, confirm, and forbidden actors", async () => {
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
        title: "DEV-025 任务中心",
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
        title: "需要评论和确认的任务",
        assigneeUserId: "user-member",
        confirmerUserId: "user-owner",
        priority: "high",
        dueAt: "2020-01-01T00:00:00.000Z"
      }
    });
    const taskId = createTask.json().task.id as string;

    const overdue = await server.inject({
      method: "GET",
      url: "/tasks?view=overdue",
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    const created = await server.inject({
      method: "GET",
      url: "/tasks?view=created",
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });
    const comment = await server.inject({
      method: "POST",
      url: `/tasks/${taskId}/comments`,
      headers: {
        authorization: `Bearer ${memberToken}`
      },
      payload: {
        content: "已完成初步处理，等待确认。"
      }
    });
    const inProgress = await server.inject({
      method: "POST",
      url: `/tasks/${taskId}/status`,
      headers: {
        authorization: `Bearer ${memberToken}`
      },
      payload: {
        status: "in_progress"
      }
    });
    const submitted = await server.inject({
      method: "POST",
      url: `/tasks/${taskId}/submit`,
      headers: {
        authorization: `Bearer ${memberToken}`
      },
      payload: {
        reason: "负责人提交人工完成结果"
      }
    });
    const confirmQueue = await server.inject({
      method: "GET",
      url: "/tasks?view=confirm",
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });
    const forbiddenReturn = await server.inject({
      method: "POST",
      url: `/tasks/${taskId}/return`,
      headers: {
        authorization: `Bearer ${adminToken}`
      },
      payload: {
        reason: "越权退回"
      }
    });
    const returned = await server.inject({
      method: "POST",
      url: `/tasks/${taskId}/return`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        reason: "需要补充交付说明"
      }
    });
    const resubmitted = await server.inject({
      method: "POST",
      url: `/tasks/${taskId}/submit`,
      headers: {
        authorization: `Bearer ${memberToken}`
      },
      payload: {
        reason: "补充后再次提交"
      }
    });
    const forbiddenConfirm = await server.inject({
      method: "POST",
      url: `/tasks/${taskId}/confirm`,
      headers: {
        authorization: `Bearer ${memberToken}`
      },
      payload: {
        reason: "负责人不能代替确认人确认"
      }
    });
    const confirmed = await server.inject({
      method: "POST",
      url: `/tasks/${taskId}/confirm`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        reason: "确认完成"
      }
    });
    const activity = await server.inject({
      method: "GET",
      url: `/tasks/${taskId}/activity`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });

    expect(createTask.statusCode).toBe(201);
    expect(createTask.json().task).toEqual(
      expect.objectContaining({
        priority: "high",
        dueAt: "2020-01-01T00:00:00.000Z",
        completedAt: null,
        confirmedAt: null,
        returnedReason: null
      })
    );
    expect(overdue.json().tasks).toEqual(expect.arrayContaining([expect.objectContaining({ id: taskId })]));
    expect(created.json().tasks).toEqual(expect.arrayContaining([expect.objectContaining({ id: taskId })]));
    expect(comment.statusCode).toBe(201);
    expect(comment.json().task.comments).toEqual(
      expect.arrayContaining([expect.objectContaining({ content: "已完成初步处理，等待确认。" })])
    );
    expect(inProgress.statusCode).toBe(200);
    expect(submitted.statusCode).toBe(200);
    expect(submitted.json().task.status).toBe("submitted");
    expect(submitted.json().task.completedAt).toEqual(expect.any(String));
    expect(confirmQueue.json().tasks).toEqual(expect.arrayContaining([expect.objectContaining({ id: taskId })]));
    expect(forbiddenReturn.statusCode).toBe(404);
    expect(returned.statusCode).toBe(200);
    expect(returned.json().task).toEqual(
      expect.objectContaining({
        status: "in_progress",
        returnedReason: "需要补充交付说明"
      })
    );
    expect(resubmitted.statusCode).toBe(200);
    expect(forbiddenConfirm.statusCode).toBe(403);
    expect(forbiddenConfirm.json()).toEqual({ error: "confirmation_required" });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.json().task.status).toBe("completed");
    expect(confirmed.json().task.confirmedAt).toEqual(expect.any(String));
    expect(activity.statusCode).toBe(200);
    expect(activity.json().activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ activityType: "created" }),
        expect.objectContaining({ activityType: "commented" }),
        expect.objectContaining({ activityType: "submitted" }),
        expect.objectContaining({ activityType: "returned" }),
        expect.objectContaining({ activityType: "confirmed" })
      ])
    );
  });
});
