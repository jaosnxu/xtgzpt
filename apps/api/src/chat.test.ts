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

describe("chat and AI draft loop", () => {
  it("runs chat thread, message, AI summary, task draft and knowledge draft as drafts only", async () => {
    const server = buildServer();
    const ownerToken = await loginOnServer(server, "owner");
    const memberToken = await loginOnServer(server, "member");
    const adminToken = await loginOnServer(server, "admin");
    const superToken = await loginOnServer(server, "super");

    const createThread = await server.inject({
      method: "POST",
      url: "/chat/threads",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        title: "DEV-006 会话闭环",
        organizationId: "org-product",
        memberUserIds: ["user-member"]
      }
    });
    const threadId = createThread.json().thread.id as string;

    const memberThreads = await server.inject({
      method: "GET",
      url: "/chat/threads",
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    const adminThreadGuess = await server.inject({
      method: "GET",
      url: `/chat/threads/${threadId}`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });

    expect(createThread.statusCode).toBe(201);
    expect(memberThreads.statusCode).toBe(200);
    expect(memberThreads.json().threads).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: threadId,
          title: "DEV-006 会话闭环"
        })
      ])
    );
    expect(adminThreadGuess.statusCode).toBe(404);
    expect(JSON.stringify(adminThreadGuess.json())).not.toContain("DEV-006 会话闭环");

    const sendMessage = await server.inject({
      method: "POST",
      url: `/chat/threads/${threadId}/messages`,
      headers: {
        authorization: `Bearer ${memberToken}`
      },
      payload: {
        content: "请整理这次项目沟通，并给出任务和知识草稿。"
      }
    });
    const messageId = sendMessage.json().message.id as string;
    const messages = await server.inject({
      method: "GET",
      url: `/chat/threads/${threadId}/messages`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });

    expect(sendMessage.statusCode).toBe(201);
    expect(messages.statusCode).toBe(200);
    expect(messages.json().messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: messageId,
          content: "请整理这次项目沟通，并给出任务和知识草稿。"
        })
      ])
    );

    const summary = await server.inject({
      method: "POST",
      url: `/chat/threads/${threadId}/ai/summarize`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    const taskDraft = await server.inject({
      method: "POST",
      url: `/chat/threads/${threadId}/ai/task-draft`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    const knowledgeDraft = await server.inject({
      method: "POST",
      url: `/chat/threads/${threadId}/ai/knowledge-draft`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    const taskList = await server.inject({
      method: "GET",
      url: "/tasks",
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });

    expect(summary.statusCode).toBe(200);
    expect(summary.json().draft).toEqual(
      expect.objectContaining({
        kind: "chat_summary",
        isDraft: true,
        frameworkVersion: "chat-ai-framework-v1",
        sourceMessageIds: [messageId]
      })
    );
    expect(taskDraft.statusCode).toBe(200);
    expect(taskDraft.json().draft).toEqual(
      expect.objectContaining({
        kind: "task_draft",
        isDraft: true,
        sourceMessageIds: [messageId]
      })
    );
    expect(knowledgeDraft.statusCode).toBe(200);
    expect(knowledgeDraft.json().draft).toEqual(
      expect.objectContaining({
        kind: "knowledge_draft",
        isDraft: true,
        sourceMessageIds: [messageId]
      })
    );
    expect(taskList.statusCode).toBe(200);
    expect(taskList.json().tasks).toHaveLength(0);

    const threadAudit = await server.inject({
      method: "GET",
      url: `/objects/chat_thread/${threadId}/audit-logs`,
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });
    const aiAudit = await server.inject({
      method: "GET",
      url: "/audit-logs",
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });
    const chatModule = await server.inject({
      method: "GET",
      url: "/modules/chat",
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });

    expect(threadAudit.statusCode).toBe(200);
    expect(threadAudit.json().auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "chat.thread_created",
          objectId: threadId
        })
      ])
    );
    expect(aiAudit.statusCode).toBe(200);
    expect(aiAudit.json().auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "ai.chat_summarized",
          aiInvolved: true,
          aiFrameworkVersion: "chat-ai-framework-v1"
        }),
        expect.objectContaining({
          action: "ai.task_draft_created",
          aiInvolved: true
        }),
        expect.objectContaining({
          action: "ai.knowledge_draft_created",
          aiInvolved: true
        })
      ])
    );
    expect(chatModule.statusCode).toBe(200);
    expect(chatModule.json()).toEqual({
      module: "chat",
      status: "available"
    });
  });

  it("requires source messages before creating AI drafts", async () => {
    const server = buildServer();
    const ownerToken = await loginOnServer(server, "owner");

    const createThread = await server.inject({
      method: "POST",
      url: "/chat/threads",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        title: "空会话",
        organizationId: "org-product"
      }
    });
    const threadId = createThread.json().thread.id as string;
    const summary = await server.inject({
      method: "POST",
      url: `/chat/threads/${threadId}/ai/summarize`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });

    expect(createThread.statusCode).toBe(201);
    expect(summary.statusCode).toBe(400);
    expect(summary.json()).toEqual({ error: "source_messages_required" });
  });
});
