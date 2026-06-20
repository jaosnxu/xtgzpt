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

function riskConfirmPayload(risks: Array<{ id: string }>) {
  return {
    reason: "human legal risk confirmation",
    confirmations: risks.map((risk) => ({
      riskId: risk.id,
      confirmed: true,
      selectedOption: "B",
      note: "人工确认采用平衡方案"
    }))
  };
}

describe("DEV-014 contract closure", () => {
  it("runs upload/paste entry, structured AI review, human risk confirmation, revision, second review and bounded approval handoff", async () => {
    const server = buildServer();
    const contractToken = await loginOnServer(server, "contract");
    const superToken = await loginOnServer(server, "super");

    const upload = await server.inject({
      method: "POST",
      url: "/contracts/upload",
      headers: {
        authorization: `Bearer ${contractToken}`
      },
      payload: {
        title: "DEV-014 风险合同",
        organizationId: "org-product",
        fileName: "risk-contract.txt",
        mimeType: "text/plain",
        contentText: "付款在验收前完成。\n交付和验收标准不明确。\n违约赔偿没有责任上限。"
      }
    });

    expect(upload.statusCode).toBe(201);
    const contractId = upload.json().contract.id as string;
    expect(upload.json().contract.versions[0]).toEqual(
      expect.objectContaining({
        entryMethod: "upload",
        originalText: expect.stringContaining("付款")
      })
    );
    expect(upload.json().contract.versions[0].sourceEvidence[0]).toEqual(
      expect.objectContaining({
        sourceType: "upload",
        fileName: "risk-contract.txt"
      })
    );

    const review = await server.inject({
      method: "POST",
      url: `/contracts/${contractId}/ai-review`,
      headers: {
        authorization: `Bearer ${contractToken}`,
        "content-type": "application/json"
      }
    });

    expect(review.statusCode).toBe(200);
    expect(review.json().review).toEqual(
      expect.objectContaining({
        reviewType: "initial",
        frameworkId: "contract_review_v1",
        nextRequiredAction: "human_confirm_risks",
        risks: expect.arrayContaining([
          expect.objectContaining({
            requiresHumanConfirmation: true,
            humanConfirmed: false,
            selectedOption: null,
            options: expect.objectContaining({
              A: expect.any(String),
              B: expect.any(String),
              C: expect.any(String)
            })
          })
        ]),
        highlights: expect.arrayContaining([
          expect.objectContaining({
            quote: expect.stringContaining("付款")
          })
        ])
      })
    );

    const approvalTooEarly = await server.inject({
      method: "POST",
      url: `/contracts/${contractId}/submit-approval`,
      headers: {
        authorization: `Bearer ${contractToken}`
      },
      payload: {
        reason: "should be blocked"
      }
    });

    expect(approvalTooEarly.statusCode).toBe(409);

    const firstConfirm = await server.inject({
      method: "POST",
      url: `/contracts/${contractId}/risk-confirm`,
      headers: {
        authorization: `Bearer ${contractToken}`
      },
      payload: riskConfirmPayload(review.json().review.risks)
    });

    expect(firstConfirm.statusCode).toBe(200);
    expect(firstConfirm.json().contract.status).toBe("revision_required");

    const revision = await server.inject({
      method: "POST",
      url: `/contracts/${contractId}/revision`,
      headers: {
        authorization: `Bearer ${contractToken}`
      },
      payload: {
        originalText: "付款在验收后 10 日内完成。\n交付和验收标准见附件清单。\n违约赔偿以合同总额 10% 为上限。",
        reason: "revise after confirmed risks"
      }
    });

    expect(revision.statusCode).toBe(201);
    expect(revision.json().contract.currentVersion).toBe(2);

    const secondReview = await server.inject({
      method: "POST",
      url: `/contracts/${contractId}/second-review`,
      headers: {
        authorization: `Bearer ${contractToken}`,
        "content-type": "application/json"
      }
    });

    expect(secondReview.statusCode).toBe(200);
    expect(secondReview.json().review.reviewType).toBe("second");
    expect(secondReview.json().review.risks.every((risk: { humanConfirmed: boolean }) => !risk.humanConfirmed)).toBe(true);

    const secondConfirm = await server.inject({
      method: "POST",
      url: `/contracts/${contractId}/risk-confirm`,
      headers: {
        authorization: `Bearer ${contractToken}`
      },
      payload: riskConfirmPayload(secondReview.json().review.risks)
    });

    expect(secondConfirm.statusCode).toBe(200);

    const handoff = await server.inject({
      method: "POST",
      url: `/contracts/${contractId}/submit-approval`,
      headers: {
        authorization: `Bearer ${contractToken}`
      },
      payload: {
        reason: "submit bounded approval handoff"
      }
    });

    expect(handoff.statusCode).toBe(200);
    expect(handoff.json().contract.status).toBe("approval_pending");
    expect(handoff.json().handoff).toEqual(
      expect.objectContaining({
        status: "submitted_boundary",
        approvalEngineImplemented: false
      })
    );

    const execution = await server.inject({
      method: "POST",
      url: `/contracts/${contractId}/execution-events`,
      headers: {
        authorization: `Bearer ${contractToken}`
      },
      payload: {
        eventType: "reminder",
        title: "验收资料提醒",
        notes: "仅记录提醒，不发外部通知。",
        status: "pending"
      }
    });

    expect(execution.statusCode).toBe(201);
    expect(execution.json().contract.executionEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "reminder",
          status: "pending"
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

    expect(audit.statusCode).toBe(200);
    expect(audit.json().auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "contract.uploaded", objectId: contractId }),
        expect.objectContaining({ action: "contract.ai_review_completed", objectId: contractId }),
        expect.objectContaining({ action: "contract.risk_confirmed", objectId: contractId }),
        expect.objectContaining({ action: "contract.revised", objectId: contractId }),
        expect.objectContaining({ action: "contract.second_review_completed", objectId: contractId }),
        expect.objectContaining({ action: "contract.approval_submitted", objectId: contractId }),
        expect.objectContaining({ action: "contract.execution_event_recorded", objectId: contractId })
      ])
    );
  });

  it("does not expose contract content, risks or AI context to unauthorized users", async () => {
    const server = buildServer();
    const contractToken = await loginOnServer(server, "contract");
    const memberToken = await loginOnServer(server, "member");
    const adminToken = await loginOnServer(server, "admin");

    const paste = await server.inject({
      method: "POST",
      url: "/contracts/paste",
      headers: {
        authorization: `Bearer ${contractToken}`
      },
      payload: {
        title: "secret contract title",
        organizationId: "org-product",
        originalText: "secret source text with payment risk"
      }
    });
    const contractId = paste.json().contract.id as string;

    const memberRead = await server.inject({
      method: "GET",
      url: `/contracts/${contractId}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    const adminRead = await server.inject({
      method: "GET",
      url: `/contracts/${contractId}`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });

    expect(memberRead.statusCode).toBe(404);
    expect(adminRead.statusCode).toBe(404);
    expect(JSON.stringify(memberRead.json())).not.toContain("secret");
    expect(JSON.stringify(adminRead.json())).not.toContain("secret");

    const memberReview = await server.inject({
      method: "POST",
      url: `/contracts/${contractId}/ai-review`,
      headers: {
        authorization: `Bearer ${memberToken}`,
        "content-type": "application/json"
      }
    });

    expect(memberReview.statusCode).toBe(404);
    expect(JSON.stringify(memberReview.json())).not.toContain("payment risk");
  });
});
