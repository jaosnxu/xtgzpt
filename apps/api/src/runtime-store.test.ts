import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildServer } from "./index";
import { resolveRuntimeStoreOptions } from "./runtime-store";

type TestServer = ReturnType<typeof buildServer>;

const tempRoots: string[] = [];

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

function createDataFilePath() {
  const root = mkdtempSync(join(tmpdir(), "xtgzpt-runtime-store-"));
  tempRoots.push(root);
  return join(root, "runtime-data.json");
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("runtime persistence store", () => {
  it("resolves a stable runtime data path for non-test startup and stays inert in tests", () => {
    expect(
      resolveRuntimeStoreOptions({}, { NODE_ENV: "development" }, "/tmp/xtgzpt/apps/api/dist")
    ).toEqual({
      dataFilePath: "/tmp/xtgzpt/apps/api/data/runtime-data.json"
    });
    expect(
      resolveRuntimeStoreOptions({}, { NODE_ENV: "development", XTGZPT_RUNTIME_DATA_FILE: "/tmp/custom.json" }, "/tmp/xtgzpt/apps/api/dist")
    ).toEqual({
      dataFilePath: "/tmp/custom.json"
    });
    expect(resolveRuntimeStoreOptions({}, { NODE_ENV: "test" }, "/tmp/xtgzpt/apps/api/dist")).toEqual({});
  });

  it("keeps runtime data after restart through the default server startup path", async () => {
    const dataFilePath = createDataFilePath();
    const previousNodeEnv = process.env.NODE_ENV;
    const previousRuntimeDataFile = process.env.XTGZPT_RUNTIME_DATA_FILE;
    process.env.NODE_ENV = "development";
    process.env.XTGZPT_RUNTIME_DATA_FILE = dataFilePath;

    let secondServer: TestServer | null = null;

    try {
      const firstServer = buildServer();
      const ownerToken = await loginOnServer(firstServer, "owner");
      const createProject = await firstServer.inject({
        method: "POST",
        url: "/projects",
        headers: {
          authorization: `Bearer ${ownerToken}`
        },
        payload: {
          title: "DEV-009 默认启动持久化",
          summary: "验证正常启动路径不再丢失 runtime 数据。",
          organizationId: "org-product"
        }
      });

      expect(createProject.statusCode).toBe(201);
      const projectId = createProject.json().project.id as string;
      await firstServer.close();

      secondServer = buildServer();
      const secondOwnerToken = await loginOnServer(secondServer, "owner");
      const projects = await secondServer.inject({
        method: "GET",
        url: "/projects",
        headers: {
          authorization: `Bearer ${secondOwnerToken}`
        }
      });

      expect(projects.statusCode).toBe(200);
      expect(projects.json().projects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: projectId,
            title: "DEV-009 默认启动持久化"
          })
        ])
      );
    } finally {
      if (secondServer) {
        await secondServer.close();
      }
      process.env.NODE_ENV = previousNodeEnv;
      if (previousRuntimeDataFile === undefined) {
        delete process.env.XTGZPT_RUNTIME_DATA_FILE;
      } else {
        process.env.XTGZPT_RUNTIME_DATA_FILE = previousRuntimeDataFile;
      }
    }
  });

  it("keeps projects, tasks and audit logs after the API runtime restarts", async () => {
    const dataFilePath = createDataFilePath();
    const firstServer = buildServer({ dataFilePath });
    const ownerToken = await loginOnServer(firstServer, "owner");

    const createProject = await firstServer.inject({
      method: "POST",
      url: "/projects",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        title: "DEV-009 持久化验证",
        summary: "验证服务重启以后项目、任务和审计不会丢失。",
        organizationId: "org-product"
      }
    });
    const projectId = createProject.json().project.id as string;
    const createTask = await firstServer.inject({
      method: "POST",
      url: "/tasks",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        projectId,
        title: "重启后仍存在的任务",
        assigneeUserId: "user-owner",
        confirmerUserId: "user-owner"
      }
    });
    const taskId = createTask.json().task.id as string;

    expect(createProject.statusCode).toBe(201);
    expect(createTask.statusCode).toBe(201);
    await firstServer.close();

    const secondServer = buildServer({ dataFilePath });
    const secondOwnerToken = await loginOnServer(secondServer, "owner");
    const superToken = await loginOnServer(secondServer, "super");

    const projects = await secondServer.inject({
      method: "GET",
      url: "/projects",
      headers: {
        authorization: `Bearer ${secondOwnerToken}`
      }
    });
    const tasks = await secondServer.inject({
      method: "GET",
      url: "/tasks",
      headers: {
        authorization: `Bearer ${secondOwnerToken}`
      }
    });
    const audit = await secondServer.inject({
      method: "GET",
      url: `/objects/task/${taskId}/audit-logs`,
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });

    expect(projects.statusCode).toBe(200);
    expect(tasks.statusCode).toBe(200);
    expect(audit.statusCode).toBe(200);
    expect(projects.json().projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: projectId,
          title: "DEV-009 持久化验证"
        })
      ])
    );
    expect(tasks.json().tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: taskId,
          projectId,
          title: "重启后仍存在的任务"
        })
      ])
    );
    expect(audit.json().auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "task.created",
          objectId: taskId
        })
      ])
    );

    await secondServer.close();
  });

  it("keeps chat, AI drafts, knowledge and project memory after the API runtime restarts", async () => {
    const dataFilePath = createDataFilePath();
    const firstServer = buildServer({ dataFilePath });
    const superToken = await loginOnServer(firstServer, "super");

    const createProject = await firstServer.inject({
      method: "POST",
      url: "/projects",
      headers: {
        authorization: `Bearer ${superToken}`
      },
      payload: {
        title: "DEV-009 知识持久化项目",
        summary: "验证聊天、AI 草稿、知识和项目记忆重启后仍可读取。",
        organizationId: "org-product"
      }
    });
    const projectId = createProject.json().project.id as string;
    const createThread = await firstServer.inject({
      method: "POST",
      url: "/chat/threads",
      headers: {
        authorization: `Bearer ${superToken}`
      },
      payload: {
        title: "DEV-009 知识持久化会话",
        organizationId: "org-product",
        relatedObjectType: "project",
        relatedObjectId: projectId
      }
    });
    const threadId = createThread.json().thread.id as string;
    const sendMessage = await firstServer.inject({
      method: "POST",
      url: `/chat/threads/${threadId}/messages`,
      headers: {
        authorization: `Bearer ${superToken}`
      },
      payload: {
        content: "DEV-009 runtime persistence marker should survive restart."
      }
    });
    const messageId = sendMessage.json().message.id as string;
    const summaryDraft = await firstServer.inject({
      method: "POST",
      url: `/chat/threads/${threadId}/ai/summarize`,
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });
    const taskDraft = await firstServer.inject({
      method: "POST",
      url: `/chat/threads/${threadId}/ai/task-draft`,
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });
    const knowledgeDraft = await firstServer.inject({
      method: "POST",
      url: `/chat/threads/${threadId}/ai/knowledge-draft`,
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });
    const summaryDraftId = summaryDraft.json().draft.id as string;
    const taskDraftId = taskDraft.json().draft.id as string;
    const knowledgeDraftId = knowledgeDraft.json().draft.id as string;

    const confirmSummary = await firstServer.inject({
      method: "POST",
      url: `/ai/drafts/${summaryDraftId}/confirm`,
      headers: {
        authorization: `Bearer ${superToken}`
      },
      payload: {
        projectId
      }
    });
    const confirmKnowledge = await firstServer.inject({
      method: "POST",
      url: `/ai/drafts/${knowledgeDraftId}/confirm`,
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });
    const memoryId = confirmSummary.json().memory.id as string;
    const knowledgeItemId = confirmKnowledge.json().knowledgeItem.id as string;

    expect(createProject.statusCode).toBe(201);
    expect(createThread.statusCode).toBe(201);
    expect(sendMessage.statusCode).toBe(201);
    expect(summaryDraft.statusCode).toBe(200);
    expect(taskDraft.statusCode).toBe(200);
    expect(knowledgeDraft.statusCode).toBe(200);
    expect(confirmSummary.statusCode).toBe(201);
    expect(confirmKnowledge.statusCode).toBe(201);
    await firstServer.close();

    const secondServer = buildServer({ dataFilePath });
    const secondSuperToken = await loginOnServer(secondServer, "super");

    const threads = await secondServer.inject({
      method: "GET",
      url: "/chat/threads",
      headers: {
        authorization: `Bearer ${secondSuperToken}`
      }
    });
    const messages = await secondServer.inject({
      method: "GET",
      url: `/chat/threads/${threadId}/messages`,
      headers: {
        authorization: `Bearer ${secondSuperToken}`
      }
    });
    const drafts = await secondServer.inject({
      method: "GET",
      url: `/chat/threads/${threadId}/ai/drafts`,
      headers: {
        authorization: `Bearer ${secondSuperToken}`
      }
    });
    const knowledgeItems = await secondServer.inject({
      method: "GET",
      url: "/knowledge/items",
      headers: {
        authorization: `Bearer ${secondSuperToken}`
      }
    });
    const memories = await secondServer.inject({
      method: "GET",
      url: "/memory/items",
      headers: {
        authorization: `Bearer ${secondSuperToken}`
      }
    });
    const knowledgeQuery = await secondServer.inject({
      method: "POST",
      url: "/knowledge/query",
      headers: {
        authorization: `Bearer ${secondSuperToken}`
      },
      payload: {
        query: "DEV-009",
        projectId
      }
    });

    expect(threads.statusCode).toBe(200);
    expect(messages.statusCode).toBe(200);
    expect(drafts.statusCode).toBe(200);
    expect(knowledgeItems.statusCode).toBe(200);
    expect(memories.statusCode).toBe(200);
    expect(knowledgeQuery.statusCode).toBe(200);
    expect(threads.json().threads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: threadId,
          title: "DEV-009 知识持久化会话"
        })
      ])
    );
    expect(messages.json().messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: messageId,
          content: "DEV-009 runtime persistence marker should survive restart."
        })
      ])
    );
    expect(drafts.json().drafts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: taskDraftId,
          status: "draft"
        }),
        expect.objectContaining({
          id: summaryDraftId,
          status: "confirmed",
          promotedObjectId: memoryId
        }),
        expect.objectContaining({
          id: knowledgeDraftId,
          status: "confirmed",
          promotedObjectId: knowledgeItemId
        })
      ])
    );
    expect(knowledgeItems.json().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: knowledgeItemId,
          title: "DEV-009 知识持久化会话 知识草稿"
        })
      ])
    );
    expect(memories.json().items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: memoryId,
          projectId
        })
      ])
    );
    expect(knowledgeQuery.json().results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: knowledgeItemId,
          type: "knowledge_item"
        }),
        expect.objectContaining({
          id: memoryId,
          type: "project_memory"
        })
      ])
    );

    await secondServer.close();
  });

  it("keeps file metadata, versions and bindings after the API runtime restarts", async () => {
    const dataFilePath = createDataFilePath();
    const firstServer = buildServer({ dataFilePath });
    const ownerToken = await loginOnServer(firstServer, "owner");

    const createProject = await firstServer.inject({
      method: "POST",
      url: "/projects",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        title: "DEV-012 文件持久化项目",
        organizationId: "org-product"
      }
    });
    const projectId = createProject.json().project.id as string;
    const uploadFile = await firstServer.inject({
      method: "POST",
      url: "/files",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        sourceObjectType: "project",
        sourceObjectId: projectId,
        displayName: "restart-file.txt",
        contentText: "file survives restart"
      }
    });
    const fileId = uploadFile.json().file.id as string;
    const versionId = uploadFile.json().version.id as string;

    expect(createProject.statusCode).toBe(201);
    expect(uploadFile.statusCode).toBe(201);
    await firstServer.close();

    const secondServer = buildServer({ dataFilePath });
    const secondOwnerToken = await loginOnServer(secondServer, "owner");
    const files = await secondServer.inject({
      method: "GET",
      url: `/files?objectType=project&objectId=${projectId}`,
      headers: {
        authorization: `Bearer ${secondOwnerToken}`
      }
    });
    const preview = await secondServer.inject({
      method: "GET",
      url: `/files/${fileId}/preview`,
      headers: {
        authorization: `Bearer ${secondOwnerToken}`
      }
    });

    expect(files.statusCode).toBe(200);
    expect(preview.statusCode).toBe(200);
    expect(files.json().files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: fileId,
          currentVersionId: versionId,
          sourceObjectType: "project",
          sourceObjectId: projectId
        })
      ])
    );
    expect(preview.json()).toEqual(
      expect.objectContaining({
        previewText: "file survives restart"
      })
    );

    await secondServer.close();
  });
});
