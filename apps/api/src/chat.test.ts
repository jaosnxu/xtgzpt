import { describe, expect, it } from "vitest";
import { fallbackAiFrameworkVersion } from "./ai-provider";
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
        frameworkVersion: fallbackAiFrameworkVersion,
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
          aiFrameworkVersion: fallbackAiFrameworkVersion
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

  it("rejects chat thread creation outside the creator organization scope", async () => {
    const server = buildServer();
    const memberToken = await loginOnServer(server, "member");
    const superToken = await loginOnServer(server, "super");

    const deniedThread = await server.inject({
      method: "POST",
      url: "/chat/threads",
      headers: {
        authorization: `Bearer ${memberToken}`
      },
      payload: {
        title: "越权组织会话",
        organizationId: "org-product"
      }
    });
    const memberThreads = await server.inject({
      method: "GET",
      url: "/chat/threads",
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    const audit = await server.inject({
      method: "GET",
      url: "/audit-logs",
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });

    expect(deniedThread.statusCode).toBe(403);
    expect(deniedThread.json()).toEqual({ error: "forbidden" });
    expect(memberThreads.statusCode).toBe(200);
    expect(memberThreads.json().threads).toHaveLength(0);
    expect(audit.statusCode).toBe(200);
    expect(audit.json().auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "access.forbidden",
          objectType: "chat_thread",
          reason: "data:create_chat_thread",
          result: "denied"
        })
      ])
    );
  });

  it("confirms AI drafts into task, knowledge item and project memory", async () => {
    const server = buildServer();
    const superToken = await loginOnServer(server, "super");

    const createProject = await server.inject({
      method: "POST",
      url: "/projects",
      headers: {
        authorization: `Bearer ${superToken}`
      },
      payload: {
        title: "DEV-007 项目",
        organizationId: "org-product"
      }
    });
    const projectId = createProject.json().project.id as string;
    const createThread = await server.inject({
      method: "POST",
      url: "/chat/threads",
      headers: {
        authorization: `Bearer ${superToken}`
      },
      payload: {
        title: "DEV-007 会话",
        organizationId: "org-product",
        relatedObjectType: "project",
        relatedObjectId: projectId
      }
    });
    const threadId = createThread.json().thread.id as string;

    const message = await server.inject({
      method: "POST",
      url: `/chat/threads/${threadId}/messages`,
      headers: {
        authorization: `Bearer ${superToken}`
      },
      payload: {
        content: "把这次沟通沉淀为正式任务、知识和项目记忆。"
      }
    });
    expect(message.statusCode).toBe(201);

    const summaryDraft = await server.inject({
      method: "POST",
      url: `/chat/threads/${threadId}/ai/summarize`,
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });
    const taskDraft = await server.inject({
      method: "POST",
      url: `/chat/threads/${threadId}/ai/task-draft`,
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });
    const knowledgeDraft = await server.inject({
      method: "POST",
      url: `/chat/threads/${threadId}/ai/knowledge-draft`,
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });

    expect(summaryDraft.statusCode).toBe(200);
    expect(taskDraft.statusCode).toBe(200);
    expect(knowledgeDraft.statusCode).toBe(200);

    const summaryDraftId = summaryDraft.json().draft.id as string;
    const taskDraftId = taskDraft.json().draft.id as string;
    const knowledgeDraftId = knowledgeDraft.json().draft.id as string;
    const confirmSummary = await server.inject({
      method: "POST",
      url: `/ai/drafts/${summaryDraftId}/confirm`,
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });
    const confirmTask = await server.inject({
      method: "POST",
      url: `/ai/drafts/${taskDraftId}/confirm`,
      headers: {
        authorization: `Bearer ${superToken}`
      },
      payload: {
        projectId
      }
    });
    const confirmKnowledge = await server.inject({
      method: "POST",
      url: `/ai/drafts/${knowledgeDraftId}/confirm`,
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });
    const duplicateConfirm = await server.inject({
      method: "POST",
      url: `/ai/drafts/${taskDraftId}/confirm`,
      headers: {
        authorization: `Bearer ${superToken}`
      },
      payload: {
        projectId
      }
    });

    expect(confirmSummary.statusCode).toBe(201);
    expect(confirmSummary.json().draft).toEqual(
      expect.objectContaining({
        status: "confirmed",
        promotedObjectType: "project_memory"
      })
    );
    expect(confirmTask.statusCode).toBe(201);
    expect(confirmTask.json().task).toEqual(
      expect.objectContaining({
        projectId,
        status: "todo"
      })
    );
    expect(confirmTask.json().draft).toEqual(
      expect.objectContaining({
        status: "confirmed",
        promotedObjectType: "task"
      })
    );
    expect(confirmKnowledge.statusCode).toBe(201);
    expect(confirmKnowledge.json().knowledgeItem).toEqual(
      expect.objectContaining({
        organizationId: "org-product",
        status: "submitted_for_review",
        currentVersion: 1,
        reviewerUserId: null,
        sourceEvidence: expect.arrayContaining([
          expect.objectContaining({
            sourceType: "ai_draft",
            sourceId: knowledgeDraftId
          })
        ])
      })
    );
    expect(duplicateConfirm.statusCode).toBe(409);
    expect(duplicateConfirm.json()).toEqual({ error: "draft_already_confirmed" });
    const knowledgeItemId = confirmKnowledge.json().knowledgeItem.id as string;

    const queryBeforePublish = await server.inject({
      method: "POST",
      url: "/knowledge/query",
      headers: {
        authorization: `Bearer ${superToken}`
      },
      payload: {
        query: "DEV-007",
        projectId
      }
    });
    expect(queryBeforePublish.statusCode).toBe(200);
    expect(queryBeforePublish.json().results).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: knowledgeItemId,
          type: "knowledge_item"
        })
      ])
    );

    const publishKnowledge = await server.inject({
      method: "POST",
      url: `/knowledge/items/${knowledgeItemId}/publish`,
      headers: {
        authorization: `Bearer ${superToken}`
      },
      payload: {
        reason: "knowledge_admin_review_passed"
      }
    });
    expect(publishKnowledge.statusCode).toBe(200);
    expect(publishKnowledge.json().item).toEqual(
      expect.objectContaining({
        id: knowledgeItemId,
        status: "published",
        reviewerUserId: "user-super",
        publishedAt: expect.any(String)
      })
    );

    const tasks = await server.inject({
      method: "GET",
      url: "/tasks",
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });
    const knowledgeItems = await server.inject({
      method: "GET",
      url: "/knowledge/items",
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });
    const memories = await server.inject({
      method: "GET",
      url: "/memory/items",
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });

    expect(tasks.json().tasks).toEqual(expect.arrayContaining([expect.objectContaining({ projectId })]));
    expect(knowledgeItems.json().items).toHaveLength(1);
    expect(memories.json().items).toHaveLength(1);

    const knowledgeQuery = await server.inject({
      method: "POST",
      url: "/knowledge/query",
      headers: {
        authorization: `Bearer ${superToken}`
      },
      payload: {
        query: "DEV-007",
        projectId
      }
    });
    expect(knowledgeQuery.statusCode).toBe(200);
    expect(knowledgeQuery.json().results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "project_memory",
          relevanceScore: expect.any(Number),
          sourceEvidence: expect.arrayContaining([
            expect.objectContaining({
              sourceType: "project_memory"
            })
          ])
        }),
        expect.objectContaining({
          type: "knowledge_item",
          relevanceScore: expect.any(Number),
          sourceEvidence: expect.arrayContaining([
            expect.objectContaining({
              sourceType: "ai_draft",
              sourceId: knowledgeDraftId
            })
          ])
        })
      ])
    );

    const reuseThread = await server.inject({
      method: "POST",
      url: "/chat/threads",
      headers: {
        authorization: `Bearer ${superToken}`
      },
      payload: {
        title: "DEV-007 回用会话",
        organizationId: "org-product",
        relatedObjectType: "project",
        relatedObjectId: projectId
      }
    });
    const reuseThreadId = reuseThread.json().thread.id as string;
    await server.inject({
      method: "POST",
      url: `/chat/threads/${reuseThreadId}/messages`,
      headers: {
        authorization: `Bearer ${superToken}`
      },
      payload: {
        content: "继续处理 DEV-007 项目记忆。"
      }
    });
    const reuseDraft = await server.inject({
      method: "POST",
      url: `/chat/threads/${reuseThreadId}/ai/summarize`,
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });
    expect(reuseDraft.statusCode).toBe(200);
    expect(reuseDraft.json().draft.contextSourceIds.length).toBeGreaterThan(0);

    const audit = await server.inject({
      method: "GET",
      url: "/audit-logs",
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });

    expect(audit.json().auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "task.created_from_ai_draft" }),
        expect.objectContaining({ action: "knowledge.submitted_for_review_from_ai_draft" }),
        expect.objectContaining({ action: "knowledge.published" }),
        expect.objectContaining({ action: "memory.created_from_ai_summary" }),
        expect.objectContaining({
          action: "ai.knowledge_query_requested",
          result: "success"
        })
      ])
    );
  });
});
