import { describe, expect, it } from "vitest";
import type { AiRunWithDetails } from "@xtgzpt/shared";
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

async function createThreadWithMessage(server: TestServer, token: string) {
  const threadResponse = await server.inject({
    method: "POST",
    url: "/chat/threads",
    headers: {
      authorization: `Bearer ${token}`
    },
    payload: {
      title: "DEV-016 AI Run 会话",
      organizationId: "org-product"
    }
  });
  expect(threadResponse.statusCode).toBe(201);
  const threadId = threadResponse.json().thread.id as string;

  const messageResponse = await server.inject({
    method: "POST",
    url: `/chat/threads/${threadId}/messages`,
    headers: {
      authorization: `Bearer ${token}`
    },
    payload: {
      content: "请整理本次上线风险，并生成需要人工确认的草稿。"
    }
  });
  expect(messageResponse.statusCode).toBe(201);

  return threadId;
}

describe("DEV-016 AI framework and run productionization", () => {
  it("keeps framework configuration admin-only and creates immutable framework versions", async () => {
    const server = buildServer();
    const adminToken = await loginOnServer(server, "admin");
    const memberToken = await loginOnServer(server, "member");

    const denied = await server.inject({
      method: "GET",
      url: "/settings/ai-frameworks",
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    expect(denied.statusCode).toBe(403);

    const list = await server.inject({
      method: "GET",
      url: "/settings/ai-frameworks",
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().frameworks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "chat_summary_v1",
          scenario: "chat_summary",
          versions: expect.arrayContaining([
            expect.objectContaining({
              sourceEvidenceRequired: true,
              retryPolicy: expect.objectContaining({ maxRetries: 1 })
            })
          ])
        })
      ])
    );

    const update = await server.inject({
      method: "PUT",
      url: "/settings/ai-frameworks/chat_summary_v1",
      headers: {
        authorization: `Bearer ${adminToken}`
      },
      payload: {
        version: "chat-ai-template-v1.0.1",
        model: "template",
        retryPolicy: {
          maxRetries: 2,
          backoffSeconds: 5
        },
        changeReason: "DEV-016 human admin framework version update"
      }
    });
    expect(update.statusCode).toBe(200);
    expect(update.json().version).toEqual(
      expect.objectContaining({
        version: "chat-ai-template-v1.0.1",
        retryPolicy: expect.objectContaining({ maxRetries: 2, backoffSeconds: 5 }),
        createdByUserId: "user-admin"
      })
    );
  });

  it("records AI Run snapshots, source evidence, retry metadata, and changed/rejected human decisions", async () => {
    const server = buildServer();
    const ownerToken = await loginOnServer(server, "owner");
    const memberToken = await loginOnServer(server, "member");
    const threadId = await createThreadWithMessage(server, ownerToken);

    const summaryResponse = await server.inject({
      method: "POST",
      url: `/chat/threads/${threadId}/ai/summarize`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });
    expect(summaryResponse.statusCode).toBe(200);
    const summaryDraftId = summaryResponse.json().draft.id as string;

    const taskDraftResponse = await server.inject({
      method: "POST",
      url: `/chat/threads/${threadId}/ai/task-draft`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });
    expect(taskDraftResponse.statusCode).toBe(200);
    const rejectedDraftId = taskDraftResponse.json().draft.id as string;

    const changedConfirmation = await server.inject({
      method: "POST",
      url: `/ai/drafts/${summaryDraftId}/confirm`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        title: "人工修改后的摘要",
        content: "人工修改后确认进入项目记忆。"
      }
    });
    expect(changedConfirmation.statusCode).toBe(201);

    const rejection = await server.inject({
      method: "POST",
      url: `/ai/drafts/${rejectedDraftId}/reject`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        reason: "人工判断任务草稿不采用"
      }
    });
    expect(rejection.statusCode).toBe(200);
    expect(rejection.json().draft.status).toBe("rejected");

    const runsResponse = await server.inject({
      method: "GET",
      url: "/ai/runs",
      headers: {
        authorization: `Bearer ${ownerToken}`
      }
    });
    expect(runsResponse.statusCode).toBe(200);
    const runs = runsResponse.json().runs as AiRunWithDetails[];
    expect(runs).toHaveLength(2);
    expect(runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scenario: "chat_summary",
          status: "succeeded",
          inputSnapshot: expect.objectContaining({ kind: "input" }),
          outputSnapshot: expect.objectContaining({ kind: "output" }),
          sourceEvidence: expect.arrayContaining([
            expect.objectContaining({ accessResult: "allowed", sourceObjectType: "chat_message" })
          ]),
          retryPolicy: expect.objectContaining({ maxRetries: expect.any(Number) }),
          decisions: expect.arrayContaining([
            expect.objectContaining({
              decision: "changed",
              targetObjectType: "project_memory",
              actorUserId: "user-owner"
            })
          ])
        }),
        expect.objectContaining({
          scenario: "task_draft",
          status: "succeeded",
          decisions: expect.arrayContaining([
            expect.objectContaining({
              decision: "rejected",
              targetObjectType: null,
              reason: "人工判断任务草稿不采用"
            })
          ])
        })
      ])
    );

    const forbiddenRuns = await server.inject({
      method: "GET",
      url: "/ai/runs",
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    expect(forbiddenRuns.statusCode).toBe(200);
    expect(forbiddenRuns.json().runs).toHaveLength(0);

    const hiddenRun = await server.inject({
      method: "GET",
      url: `/ai/runs/${runs[0].id}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    expect(hiddenRun.statusCode).toBe(404);
  });

  it("classifies AI Run validation failures and records contract review evidence", async () => {
    const server = buildServer();
    const contractToken = await loginOnServer(server, "contract");

    const upload = await server.inject({
      method: "POST",
      url: "/contracts/paste",
      headers: {
        authorization: `Bearer ${contractToken}`
      },
      payload: {
        title: "DEV-016 合同",
        organizationId: "org-product",
        originalText: "付款在验收前完成，违约赔偿没有责任上限。"
      }
    });
    expect(upload.statusCode).toBe(201);
    const contractId = upload.json().contract.id as string;

    const firstReview = await server.inject({
      method: "POST",
      url: `/contracts/${contractId}/ai-review`,
      headers: {
        authorization: `Bearer ${contractToken}`,
        "content-type": "application/json"
      }
    });
    expect(firstReview.statusCode).toBe(200);

    const invalidReview = await server.inject({
      method: "POST",
      url: `/contracts/${contractId}/ai-review`,
      headers: {
        authorization: `Bearer ${contractToken}`,
        "content-type": "application/json"
      }
    });
    expect(invalidReview.statusCode).toBe(409);

    const runsResponse = await server.inject({
      method: "GET",
      url: "/ai/runs",
      headers: {
        authorization: `Bearer ${contractToken}`
      }
    });
    expect(runsResponse.statusCode).toBe(200);
    expect(runsResponse.json().runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scenario: "contract_review",
          status: "succeeded",
          sourceEvidence: expect.arrayContaining([
            expect.objectContaining({ sourceObjectType: "contract_version", accessResult: "allowed" })
          ])
        }),
        expect.objectContaining({
          scenario: "contract_review",
          status: "failed",
          failureClass: "validation_error",
          failureMessage: "invalid_contract_status"
        })
      ])
    );
  });
});
