import { describe, expect, it } from "vitest";
import type { ApprovalWithDetails, ContractReviewRecord, WorkbenchResponse } from "@xtgzpt/shared";
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

function riskConfirmPayload(review: ContractReviewRecord) {
  return {
    reason: "DEV-015 human risk confirmation",
    confirmations: review.risks.map((risk) => ({
      riskId: risk.id,
      confirmed: true,
      selectedOption: "B",
      note: "人工确认采用 B 方案"
    }))
  };
}

async function createApprovalReadyContract(server: TestServer, contractToken: string) {
  const upload = await server.inject({
    method: "POST",
    url: "/contracts/upload",
    headers: {
      authorization: `Bearer ${contractToken}`
    },
    payload: {
      title: "DEV-015 审批合同",
      organizationId: "org-product",
      fileName: "approval-contract.txt",
      mimeType: "text/plain",
      contentText: "付款在验收前完成。\n交付和验收标准不明确。\n违约赔偿没有责任上限。"
    }
  });
  expect(upload.statusCode).toBe(201);
  const contractId = upload.json().contract.id as string;

  const initialReview = await server.inject({
    method: "POST",
    url: `/contracts/${contractId}/ai-review`,
    headers: {
      authorization: `Bearer ${contractToken}`,
      "content-type": "application/json"
    }
  });
  expect(initialReview.statusCode).toBe(200);

  const firstConfirm = await server.inject({
    method: "POST",
    url: `/contracts/${contractId}/risk-confirm`,
    headers: {
      authorization: `Bearer ${contractToken}`
    },
    payload: riskConfirmPayload(initialReview.json().review)
  });
  expect(firstConfirm.statusCode).toBe(200);

  const revision = await server.inject({
    method: "POST",
    url: `/contracts/${contractId}/revision`,
    headers: {
      authorization: `Bearer ${contractToken}`
    },
    payload: {
      originalText: "付款在验收后 10 日内完成。\n交付验收按附件清单进行。\n违约赔偿以合同总额 10% 为上限。",
      reason: "DEV-015 approval revision"
    }
  });
  expect(revision.statusCode).toBe(201);

  const secondReview = await server.inject({
    method: "POST",
    url: `/contracts/${contractId}/second-review`,
    headers: {
      authorization: `Bearer ${contractToken}`,
      "content-type": "application/json"
    }
  });
  expect(secondReview.statusCode).toBe(200);

  const secondConfirm = await server.inject({
    method: "POST",
    url: `/contracts/${contractId}/risk-confirm`,
    headers: {
      authorization: `Bearer ${contractToken}`
    },
    payload: riskConfirmPayload(secondReview.json().review)
  });
  expect(secondConfirm.statusCode).toBe(200);

  return contractId;
}

async function submitContractApproval(server: TestServer, contractToken: string, contractId: string) {
  const response = await server.inject({
    method: "POST",
    url: `/contracts/${contractId}/submit-approval`,
    headers: {
      authorization: `Bearer ${contractToken}`
    },
    payload: {
      reason: "DEV-015 create human approval instance"
    }
  });

  expect(response.statusCode).toBe(200);
  return response.json().approval as ApprovalWithDetails;
}

describe("DEV-015 approval closure", () => {
  it("creates real human approval nodes from contract handoff and completes approve/transfer/add-sign writeback", async () => {
    const server = buildServer();
    const contractToken = await loginOnServer(server, "contract");
    const legalToken = await loginOnServer(server, "legal");
    const financeToken = await loginOnServer(server, "finance");
    const approverToken = await loginOnServer(server, "approver");
    const memberToken = await loginOnServer(server, "member");
    const superToken = await loginOnServer(server, "super");
    const contractId = await createApprovalReadyContract(server, contractToken);
    const approval = await submitContractApproval(server, contractToken, contractId);

    expect(approval).toEqual(
      expect.objectContaining({
        sourceObjectType: "contract",
        sourceObjectId: contractId,
        status: "processing",
        currentApproverUserId: "user-legal",
        nodes: expect.arrayContaining([
          expect.objectContaining({ name: "法务审批", approverUserId: "user-legal", status: "processing" }),
          expect.objectContaining({ name: "财务审批", approverUserId: "user-finance", status: "pending" }),
          expect.objectContaining({ name: "业务审批", approverUserId: "user-approver", status: "pending" })
        ])
      })
    );

    const legalWorkbench = await server.inject({
      method: "GET",
      url: "/workbench",
      headers: {
        authorization: `Bearer ${legalToken}`
      }
    });
    const legalWorkbenchBody = legalWorkbench.json() as WorkbenchResponse;
    expect(legalWorkbenchBody.summary.pendingApprovalCount).toBe(1);
    expect(legalWorkbenchBody.sections.pendingApprovals[0]).toEqual(
      expect.objectContaining({
        objectId: approval.id,
        kind: "pending_approval"
      })
    );
    expect(legalWorkbenchBody.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "approval",
          severity: "warning",
          relatedObjectId: approval.id
        })
      ])
    );

    const memberDetail = await server.inject({
      method: "GET",
      url: `/approvals/${approval.id}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    expect(memberDetail.statusCode).toBe(404);
    expect(JSON.stringify(memberDetail.json())).not.toContain("DEV-015 审批合同");

    const wrongApprover = await server.inject({
      method: "POST",
      url: `/approvals/${approval.id}/approve`,
      headers: {
        authorization: `Bearer ${financeToken}`
      },
      payload: {
        reason: "not current node"
      }
    });
    expect(wrongApprover.statusCode).toBe(403);

    const legalApprove = await server.inject({
      method: "POST",
      url: `/approvals/${approval.id}/approve`,
      headers: {
        authorization: `Bearer ${legalToken}`
      },
      payload: {
        reason: "法务人工同意"
      }
    });
    expect(legalApprove.statusCode).toBe(200);
    expect(legalApprove.json().approval.currentApproverUserId).toBe("user-finance");

    const financeTransfer = await server.inject({
      method: "POST",
      url: `/approvals/${approval.id}/transfer`,
      headers: {
        authorization: `Bearer ${financeToken}`
      },
      payload: {
        targetUserId: "user-approver",
        reason: "财务人工转交业务审批人"
      }
    });
    expect(financeTransfer.statusCode).toBe(200);
    expect(financeTransfer.json().approval.currentApproverUserId).toBe("user-approver");
    expect(financeTransfer.json().action).toEqual(expect.objectContaining({ action: "transfer" }));

    const addSign = await server.inject({
      method: "POST",
      url: `/approvals/${approval.id}/add-sign`,
      headers: {
        authorization: `Bearer ${approverToken}`
      },
      payload: {
        targetUserId: "user-legal",
        reason: "业务审批前加签法务复核"
      }
    });
    expect(addSign.statusCode).toBe(200);
    expect(addSign.json().approval.currentApproverUserId).toBe("user-legal");
    expect(addSign.json().approval.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "加签审批", approverUserId: "user-legal", status: "processing" })
      ])
    );

    const addSignApprove = await server.inject({
      method: "POST",
      url: `/approvals/${approval.id}/approve`,
      headers: {
        authorization: `Bearer ${legalToken}`
      },
      payload: {
        reason: "加签法务人工同意"
      }
    });
    expect(addSignApprove.statusCode).toBe(200);
    expect(addSignApprove.json().approval.currentApproverUserId).toBe("user-approver");

    const transferNodeApprove = await server.inject({
      method: "POST",
      url: `/approvals/${approval.id}/approve`,
      headers: {
        authorization: `Bearer ${approverToken}`
      },
      payload: {
        reason: "转交节点人工同意"
      }
    });
    expect(transferNodeApprove.statusCode).toBe(200);
    expect(transferNodeApprove.json().approval.currentApproverUserId).toBe("user-approver");

    const finalApprove = await server.inject({
      method: "POST",
      url: `/approvals/${approval.id}/approve`,
      headers: {
        authorization: `Bearer ${approverToken}`
      },
      payload: {
        reason: "业务终审人工同意"
      }
    });
    expect(finalApprove.statusCode).toBe(200);
    expect(finalApprove.json().approval.status).toBe("approved");
    expect(finalApprove.json().approval.currentApproverUserId).toBeNull();
    expect(finalApprove.json().contract.status).toBe("approved");

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
        expect.objectContaining({ action: "approval.initiated", objectId: approval.id }),
        expect.objectContaining({ action: "approval.transferred", objectId: approval.id }),
        expect.objectContaining({ action: "approval.add_signed", objectId: approval.id }),
        expect.objectContaining({ action: "approval.completed", objectId: approval.id }),
        expect.objectContaining({ action: "contract.approval_result_written_back", objectId: contractId })
      ])
    );
  });

  it("writes rejected and returned approval results back to the source contract", async () => {
    const server = buildServer();
    const contractToken = await loginOnServer(server, "contract");
    const legalToken = await loginOnServer(server, "legal");

    const rejectedContractId = await createApprovalReadyContract(server, contractToken);
    const rejectedApproval = await submitContractApproval(server, contractToken, rejectedContractId);
    const reject = await server.inject({
      method: "POST",
      url: `/approvals/${rejectedApproval.id}/reject`,
      headers: {
        authorization: `Bearer ${legalToken}`
      },
      payload: {
        reason: "法务人工驳回"
      }
    });
    expect(reject.statusCode).toBe(200);
    expect(reject.json().approval.status).toBe("rejected");
    expect(reject.json().contract.status).toBe("rejected");

    const returnedContractId = await createApprovalReadyContract(server, contractToken);
    const returnedApproval = await submitContractApproval(server, contractToken, returnedContractId);
    const returned = await server.inject({
      method: "POST",
      url: `/approvals/${returnedApproval.id}/return`,
      headers: {
        authorization: `Bearer ${legalToken}`
      },
      payload: {
        reason: "法务人工退回修改"
      }
    });
    expect(returned.statusCode).toBe(200);
    expect(returned.json().approval.status).toBe("returned");
    expect(returned.json().contract.status).toBe("revision_required");
  });
});
