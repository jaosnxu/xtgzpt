import { describe, expect, it } from "vitest";
import { buildServer } from "./index";

type TestServer = ReturnType<typeof buildServer>;

async function login(server: TestServer, username: string) {
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

async function createProject(server: TestServer, token: string, title: string) {
  const response = await server.inject({
    method: "POST",
    url: "/projects",
    headers: {
      authorization: `Bearer ${token}`
    },
    payload: {
      title,
      organizationId: "org-product"
    }
  });

  expect(response.statusCode).toBe(201);
  return response.json().project.id as string;
}

async function createKnowledgeDraftFromChat(
  server: TestServer,
  token: string,
  projectId: string,
  content: string,
  memberUserIds = ["user-knowledge"]
) {
  const thread = await server.inject({
    method: "POST",
    url: "/chat/threads",
    headers: {
      authorization: `Bearer ${token}`
    },
    payload: {
      title: `知识审核会话 ${content}`,
      organizationId: "org-product",
      memberUserIds,
      relatedObjectType: "project",
      relatedObjectId: projectId
    }
  });
  const threadId = thread.json().thread.id as string;

  await server.inject({
    method: "POST",
    url: `/chat/threads/${threadId}/messages`,
    headers: {
      authorization: `Bearer ${token}`
    },
    payload: {
      content
    }
  });

  const draft = await server.inject({
    method: "POST",
    url: `/chat/threads/${threadId}/ai/knowledge-draft`,
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  expect(draft.statusCode).toBe(200);
  return draft.json().draft.id as string;
}

describe("DEV-013 knowledge productionization", () => {
  it("keeps AI knowledge drafts in review until a knowledge administrator publishes with evidence", async () => {
    const server = buildServer();
    const ownerToken = await login(server, "owner");
    const knowledgeToken = await login(server, "knowledge");
    const superToken = await login(server, "super");
    const projectId = await createProject(server, ownerToken, "DEV-013 知识审核项目");
    const draftId = await createKnowledgeDraftFromChat(
      server,
      ownerToken,
      projectId,
      "DEV-013 publish gate marker should require human review."
    );

    const confirm = await server.inject({
      method: "POST",
      url: `/ai/drafts/${draftId}/confirm`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });
    const itemId = confirm.json().knowledgeItem.id as string;

    expect(confirm.statusCode).toBe(201);
    expect(confirm.json().knowledgeItem).toEqual(
      expect.objectContaining({
        status: "submitted_for_review",
        reviewerUserId: null,
        publishedAt: null,
        sourceEvidence: expect.arrayContaining([
          expect.objectContaining({
            sourceType: "ai_draft",
            sourceId: draftId
          }),
          expect.objectContaining({
            sourceType: "chat_message"
          })
        ])
      })
    );

    const queryBeforePublish = await server.inject({
      method: "POST",
      url: "/knowledge/query",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        query: "publish gate marker",
        projectId
      }
    });
    expect(queryBeforePublish.statusCode).toBe(200);
    expect(queryBeforePublish.json().results).toHaveLength(0);

    const publish = await server.inject({
      method: "POST",
      url: `/knowledge/items/${itemId}/publish`,
      headers: {
        authorization: `Bearer ${knowledgeToken}`
      },
      payload: {
        reason: "reviewed source evidence"
      }
    });
    expect(publish.statusCode).toBe(200);
    expect(publish.json().item).toEqual(
      expect.objectContaining({
        status: "published",
        reviewerUserId: "user-knowledge",
        publishedAt: expect.any(String)
      })
    );

    const queryAfterPublish = await server.inject({
      method: "POST",
      url: "/knowledge/query",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        query: "publish gate marker",
        projectId
      }
    });
    expect(queryAfterPublish.statusCode).toBe(200);
    expect(queryAfterPublish.json().results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: itemId,
          type: "knowledge_item",
          sourceEvidence: expect.arrayContaining([
            expect.objectContaining({
              sourceType: "ai_draft",
              sourceId: draftId
            })
          ])
        })
      ])
    );

    const audit = await server.inject({
      method: "GET",
      url: "/audit-logs",
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });
    expect(audit.json().auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "knowledge.submitted_for_review_from_ai_draft" }),
        expect.objectContaining({ action: "knowledge.published", objectId: itemId })
      ])
    );
  });

  it("records reject, version and archive actions and keeps archived knowledge out of retrieval", async () => {
    const server = buildServer();
    const ownerToken = await login(server, "owner");
    const knowledgeToken = await login(server, "knowledge");
    const superToken = await login(server, "super");

    const create = await server.inject({
      method: "POST",
      url: "/knowledge/items",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        title: "DEV-013 manual version record",
        content: "Initial source evidence for reject and archive actions.",
        organizationId: "org-product"
      }
    });
    const itemId = create.json().item.id as string;
    expect(create.statusCode).toBe(201);
    expect(create.json().item.status).toBe("draft");

    const submit = await server.inject({
      method: "POST",
      url: `/knowledge/items/${itemId}/submit-review`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });
    const reject = await server.inject({
      method: "POST",
      url: `/knowledge/items/${itemId}/reject`,
      headers: {
        authorization: `Bearer ${knowledgeToken}`
      },
      payload: {
        reason: "source evidence incomplete"
      }
    });
    const version = await server.inject({
      method: "POST",
      url: `/knowledge/items/${itemId}/versions`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        title: "DEV-013 manual version record v2",
        content: "Version two contains archive retrieval marker.",
        submitForReview: true
      }
    });
    const publish = await server.inject({
      method: "POST",
      url: `/knowledge/items/${itemId}/publish`,
      headers: {
        authorization: `Bearer ${knowledgeToken}`
      }
    });
    const archive = await server.inject({
      method: "POST",
      url: `/knowledge/items/${itemId}/archive`,
      headers: {
        authorization: `Bearer ${knowledgeToken}`
      },
      payload: {
        reason: "superseded"
      }
    });
    const queryArchived = await server.inject({
      method: "POST",
      url: "/knowledge/query",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        query: "archive retrieval marker"
      }
    });
    const history = await server.inject({
      method: "GET",
      url: `/knowledge/items/${itemId}/versions`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });

    expect(submit.statusCode).toBe(200);
    expect(reject.statusCode).toBe(200);
    expect(reject.json().item.status).toBe("rejected");
    expect(version.statusCode).toBe(201);
    expect(version.json().version).toEqual(
      expect.objectContaining({
        version: 2,
        status: "submitted_for_review",
        authorUserId: "user-owner",
        reviewerUserId: null
      })
    );
    expect(publish.statusCode).toBe(200);
    expect(archive.statusCode).toBe(200);
    expect(archive.json().item.status).toBe("archived");
    expect(queryArchived.statusCode).toBe(200);
    expect(queryArchived.json().results).toHaveLength(0);
    expect(history.statusCode).toBe(200);
    expect(history.json().versions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ version: 1, status: "rejected", reviewerUserId: "user-knowledge" }),
        expect.objectContaining({ version: 2, status: "archived", reviewerUserId: "user-knowledge" })
      ])
    );

    const audit = await server.inject({
      method: "GET",
      url: "/audit-logs",
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });
    expect(audit.json().auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "knowledge.submitted_for_review", objectId: itemId }),
        expect.objectContaining({ action: "knowledge.rejected", objectId: itemId }),
        expect.objectContaining({ action: "knowledge.version_created", objectId: itemId }),
        expect.objectContaining({ action: "knowledge.published", objectId: itemId }),
        expect.objectContaining({ action: "knowledge.archived", objectId: itemId })
      ])
    );
  });

  it("does not return unauthorized published sources or put them into AI context", async () => {
    const server = buildServer();
    const ownerToken = await login(server, "owner");
    const memberToken = await login(server, "member");
    const knowledgeToken = await login(server, "knowledge");
    const visibleProjectId = await createProject(server, ownerToken, "DEV-013 visible source project");
    const hiddenProjectId = await createProject(server, ownerToken, "DEV-013 hidden source project");
    await server.inject({
      method: "POST",
      url: `/projects/${visibleProjectId}/members`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        userId: "user-member"
      }
    });
    const visibleDraftId = await createKnowledgeDraftFromChat(
      server,
      ownerToken,
      visibleProjectId,
      "DEV-013 shared source retrieval marker.",
      ["user-member", "user-knowledge"]
    );
    const hiddenDraftId = await createKnowledgeDraftFromChat(
      server,
      ownerToken,
      hiddenProjectId,
      "DEV-013 forbidden source retrieval marker."
    );

    const publishedItemIds: string[] = [];

    for (const draftId of [visibleDraftId, hiddenDraftId]) {
      const confirm = await server.inject({
        method: "POST",
        url: `/ai/drafts/${draftId}/confirm`,
        headers: {
          authorization: `Bearer ${ownerToken}`
        }
      });
      const itemId = confirm.json().knowledgeItem.id as string;
      publishedItemIds.push(itemId);
      const publish = await server.inject({
        method: "POST",
        url: `/knowledge/items/${itemId}/publish`,
        headers: {
          authorization: `Bearer ${knowledgeToken}`
        }
      });
      expect(confirm.statusCode).toBe(201);
      expect(publish.statusCode).toBe(200);
    }

    const memberQuery = await server.inject({
      method: "POST",
      url: "/knowledge/query",
      headers: {
        authorization: `Bearer ${memberToken}`
      },
      payload: {
        query: "source retrieval marker",
        projectId: visibleProjectId
      }
    });
    expect(memberQuery.statusCode).toBe(200);
    expect(JSON.stringify(memberQuery.json())).toContain("shared source retrieval marker");
    expect(JSON.stringify(memberQuery.json())).not.toContain("forbidden source retrieval marker");

    const thread = await server.inject({
      method: "POST",
      url: "/chat/threads",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        title: "DEV-013 member AI context",
        organizationId: "org-product",
        memberUserIds: ["user-member"],
        relatedObjectType: "project",
        relatedObjectId: visibleProjectId
      }
    });
    const threadId = thread.json().thread.id as string;
    await server.inject({
      method: "POST",
      url: `/chat/threads/${threadId}/messages`,
      headers: {
        authorization: `Bearer ${memberToken}`
      },
      payload: {
        content: "Reuse source retrieval marker in summary."
      }
    });
    const summary = await server.inject({
      method: "POST",
      url: `/chat/threads/${threadId}/ai/summarize`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    expect(summary.statusCode).toBe(200);
    expect(summary.json().draft.contextSourceIds).toEqual(
      expect.arrayContaining(memberQuery.json().results.map((result: { id: string }) => result.id))
    );
    expect(summary.json().draft.contextSourceIds).toContain(publishedItemIds[0]);
    expect(summary.json().draft.contextSourceIds).not.toContain(publishedItemIds[1]);
  });
});
