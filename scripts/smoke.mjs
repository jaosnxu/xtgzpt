process.env.NODE_ENV = "test";

const { buildServer } = await import("../apps/api/src/index.ts");

const server = buildServer();

async function inject(method, url, token, payload) {
  const response = await server.inject({
    method,
    url,
    headers: token
      ? {
          authorization: `Bearer ${token}`
        }
      : undefined,
    payload
  });

  const body = response.json();
  return {
    statusCode: response.statusCode,
    body
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function login(username) {
  const response = await inject("POST", "/auth/login", null, {
    username,
    password: "113113"
  });

  assert(response.statusCode === 200, `${username} login failed with ${response.statusCode}`);
  assert(typeof response.body.token === "string", `${username} login did not return token`);
  return response.body.token;
}

try {
  const health = await inject("GET", "/health");
  assert(health.statusCode === 200, `health failed with ${health.statusCode}`);
  assert(health.body.status === "ok", "health response is not ok");

  const ownerToken = await login("owner");
  const memberToken = await login("member");
  const contractToken = await login("contract");
  const legalToken = await login("legal");
  const financeToken = await login("finance");
  const approverToken = await login("approver");
  const superToken = await login("super");

  const createProject = await inject("POST", "/projects", ownerToken, {
    title: "Smoke 项目",
    organizationId: "org-product"
  });
  assert(createProject.statusCode === 201, `create project failed with ${createProject.statusCode}`);
  const projectId = createProject.body.project.id;

  const addMember = await inject("POST", `/projects/${projectId}/members`, ownerToken, {
    userId: "user-member"
  });
  assert(addMember.statusCode === 200, `add member failed with ${addMember.statusCode}`);

  const memberProjects = await inject("GET", "/projects", memberToken);
  assert(memberProjects.statusCode === 200, `member projects failed with ${memberProjects.statusCode}`);
  assert(
    memberProjects.body.projects.some((project) => project.id === projectId),
    "member cannot see authorized smoke project"
  );

  const createTask = await inject("POST", "/tasks", ownerToken, {
    projectId,
    title: "Smoke 任务",
    assigneeUserId: "user-member",
    confirmerUserId: "user-owner"
  });
  assert(createTask.statusCode === 201, `create task failed with ${createTask.statusCode}`);
  const taskId = createTask.body.task.id;

  const inProgress = await inject("POST", `/tasks/${taskId}/status`, memberToken, {
    status: "in_progress"
  });
  assert(inProgress.statusCode === 200, `task in_progress failed with ${inProgress.statusCode}`);

  const submitted = await inject("POST", `/tasks/${taskId}/status`, memberToken, {
    status: "submitted"
  });
  assert(submitted.statusCode === 200, `task submitted failed with ${submitted.statusCode}`);

  const memberComplete = await inject("POST", `/tasks/${taskId}/status`, memberToken, {
    status: "completed"
  });
  assert(memberComplete.statusCode === 403, "member completed task without confirmation gate");
  assert(memberComplete.body.error === "confirmation_required", "confirmation gate returned wrong error");

  const ownerComplete = await inject("POST", `/tasks/${taskId}/status`, ownerToken, {
    status: "completed"
  });
  assert(ownerComplete.statusCode === 200, `owner complete failed with ${ownerComplete.statusCode}`);

  const projectsModule = await inject("GET", "/modules/projects", ownerToken);
  const tasksModule = await inject("GET", "/modules/tasks", ownerToken);
  assert(projectsModule.body.status === "available", "projects module is not available");
  assert(tasksModule.body.status === "available", "tasks module is not available");

  const taskAudit = await inject("GET", `/objects/task/${taskId}/audit-logs`, superToken);
  assert(taskAudit.statusCode === 200, `task audit failed with ${taskAudit.statusCode}`);
  assert(
    taskAudit.body.auditLogs.some((entry) => entry.action === "task.created"),
    "task.created audit entry missing"
  );
  assert(
    taskAudit.body.auditLogs.some((entry) => entry.reason === "task_status:completed"),
    "task completed audit entry missing"
  );

  const memberWorkbenchBeforeAi = await inject("GET", "/workbench", memberToken);
  assert(memberWorkbenchBeforeAi.statusCode === 200, `member workbench failed with ${memberWorkbenchBeforeAi.statusCode}`);
  assert(memberWorkbenchBeforeAi.body.summary.participatingProjectCount >= 1, "member workbench missing participating project");
  assert(
    memberWorkbenchBeforeAi.body.notifications.some((item) => item.type === "pending_work"),
    "member workbench missing pending work notification"
  );

  const createThread = await inject("POST", "/chat/threads", ownerToken, {
    title: "Smoke 会话",
    organizationId: "org-product",
    memberUserIds: ["user-member", "user-super"],
    relatedObjectType: "project",
    relatedObjectId: projectId
  });
  assert(createThread.statusCode === 201, `create chat thread failed with ${createThread.statusCode}`);
  const threadId = createThread.body.thread.id;

  const sendMessage = await inject("POST", `/chat/threads/${threadId}/messages`, memberToken, {
    content: "Smoke 聊天消息，需要 AI 整理和草稿。"
  });
  assert(sendMessage.statusCode === 201, `send chat message failed with ${sendMessage.statusCode}`);

  const uploadFile = await inject("POST", "/files", ownerToken, {
    sourceObjectType: "project",
    sourceObjectId: projectId,
    displayName: "smoke-project-file.txt",
    mimeType: "text/plain",
    contentText: "Smoke file content for authorized preview and AI reference."
  });
  assert(uploadFile.statusCode === 201, `file upload failed with ${uploadFile.statusCode}`);
  const fileId = uploadFile.body.file.id;

  const projectFiles = await inject("GET", `/files?objectType=project&objectId=${projectId}`, memberToken);
  assert(projectFiles.statusCode === 200, `file list failed with ${projectFiles.statusCode}`);
  assert(projectFiles.body.files.some((file) => file.id === fileId), "member cannot see bound project file");

  const filePreview = await inject("GET", `/files/${fileId}/preview`, memberToken);
  const fileDownload = await inject("GET", `/files/${fileId}/download`, memberToken);
  assert(filePreview.statusCode === 200, `file preview failed with ${filePreview.statusCode}`);
  assert(fileDownload.statusCode === 200, `file download failed with ${fileDownload.statusCode}`);
  assert(fileDownload.body.contentText.includes("Smoke file content"), "file download returned wrong content");

  const summaryDraft = await inject("POST", `/chat/threads/${threadId}/ai/summarize`, memberToken);
  const taskDraft = await inject("POST", `/chat/threads/${threadId}/ai/task-draft`, memberToken);
  const knowledgeDraft = await inject("POST", `/chat/threads/${threadId}/ai/knowledge-draft`, memberToken);
  assert(summaryDraft.statusCode === 200, `summary draft failed with ${summaryDraft.statusCode}`);
  assert(taskDraft.statusCode === 200, `task draft failed with ${taskDraft.statusCode}`);
  assert(knowledgeDraft.statusCode === 200, `knowledge draft failed with ${knowledgeDraft.statusCode}`);
  assert(summaryDraft.body.draft.isDraft === true, "summary is not marked as draft");
  assert(taskDraft.body.draft.kind === "task_draft", "task draft returned wrong kind");
  assert(knowledgeDraft.body.draft.kind === "knowledge_draft", "knowledge draft returned wrong kind");

  const memberWorkbenchAfterAi = await inject("GET", "/workbench", memberToken);
  assert(memberWorkbenchAfterAi.statusCode === 200, `member AI workbench failed with ${memberWorkbenchAfterAi.statusCode}`);
  assert(memberWorkbenchAfterAi.body.summary.aiResultConfirmationCount >= 1, "workbench missing AI confirmation count");
  assert(
    memberWorkbenchAfterAi.body.notifications.some((item) => item.type === "ai_result"),
    "workbench missing AI result notification"
  );

  const memoryConfirm = await inject("POST", `/ai/drafts/${summaryDraft.body.draft.id}/confirm`, memberToken);
  const taskConfirm = await inject("POST", `/ai/drafts/${taskDraft.body.draft.id}/confirm`, ownerToken, {
    projectId,
    assigneeUserId: "user-member",
    confirmerUserId: "user-owner"
  });
  const knowledgeConfirm = await inject("POST", `/ai/drafts/${knowledgeDraft.body.draft.id}/confirm`, superToken);
  assert(memoryConfirm.statusCode === 201, `memory confirm failed with ${memoryConfirm.statusCode}`);
  assert(memoryConfirm.body.draft.promotedObjectType === "project_memory", "summary was not promoted to memory");
  assert(taskConfirm.statusCode === 201, `task confirm failed with ${taskConfirm.statusCode}`);
  assert(taskConfirm.body.task.projectId === projectId, "task draft promoted to wrong project");
  assert(knowledgeConfirm.statusCode === 201, `knowledge confirm failed with ${knowledgeConfirm.statusCode}`);
  assert(
    knowledgeConfirm.body.knowledgeItem.status === "submitted_for_review",
    "knowledge draft bypassed review submission"
  );

  const knowledgePublish = await inject("POST", `/knowledge/items/${knowledgeConfirm.body.knowledgeItem.id}/publish`, superToken, {
    reason: "smoke knowledge administrator review"
  });
  assert(knowledgePublish.statusCode === 200, `knowledge publish failed with ${knowledgePublish.statusCode}`);
  assert(knowledgePublish.body.item.status === "published", "knowledge administrator did not publish item");

  const memoryItems = await inject("GET", "/memory/items", memberToken);
  const knowledgeItems = await inject("GET", "/knowledge/items", superToken);
  assert(memoryItems.body.items.some((item) => item.id === memoryConfirm.body.memory.id), "confirmed memory missing");
  assert(
    knowledgeItems.body.items.some((item) => item.id === knowledgeConfirm.body.knowledgeItem.id),
    "confirmed knowledge item missing"
  );

  const knowledgeQuery = await inject("POST", "/knowledge/query", superToken, {
    query: "Smoke",
    projectId
  });
  assert(knowledgeQuery.statusCode === 200, `knowledge query failed with ${knowledgeQuery.statusCode}`);
  assert(
    knowledgeQuery.body.results.some((item) => item.type === "project_memory"),
    "knowledge query did not return project memory"
  );
  assert(
    knowledgeQuery.body.results.some((item) => item.type === "knowledge_item"),
    "knowledge query did not return knowledge item"
  );
  assert(
    knowledgeQuery.body.results.every((item) => Array.isArray(item.sourceEvidence) && item.sourceEvidence.length > 0),
    "knowledge query result missing source evidence"
  );

  const contractUpload = await inject("POST", "/contracts/upload", contractToken, {
    title: "Smoke 合同",
    organizationId: "org-product",
    fileName: "smoke-contract.txt",
    mimeType: "text/plain",
    contentText: "付款在验收前完成。\n交付和验收标准不明确。\n违约赔偿没有责任上限。"
  });
  assert(contractUpload.statusCode === 201, `contract upload failed with ${contractUpload.statusCode}`);
  const contractId = contractUpload.body.contract.id;

  const contractReview = await inject("POST", `/contracts/${contractId}/ai-review`, contractToken);
  assert(contractReview.statusCode === 200, `contract AI review failed with ${contractReview.statusCode}`);
  assert(contractReview.body.review.risks.length > 0, "contract review returned no risks");
  assert(
    contractReview.body.review.risks.every((risk) => risk.humanConfirmed === false && risk.selectedOption === null),
    "AI review confirmed risks or selected an option"
  );
  assert(contractReview.body.review.highlights.length > 0, "contract review returned no original text highlights");

  const earlyApproval = await inject("POST", `/contracts/${contractId}/submit-approval`, contractToken, {
    reason: "should be blocked"
  });
  assert(earlyApproval.statusCode === 409, "contract entered approval before human confirmation and second review");

  const firstRiskConfirm = await inject("POST", `/contracts/${contractId}/risk-confirm`, contractToken, {
    confirmations: contractReview.body.review.risks.map((risk) => ({
      riskId: risk.id,
      confirmed: true,
      selectedOption: "B",
      note: "smoke human confirmation"
    }))
  });
  assert(firstRiskConfirm.statusCode === 200, `contract risk confirm failed with ${firstRiskConfirm.statusCode}`);

  const contractRevision = await inject("POST", `/contracts/${contractId}/revision`, contractToken, {
    originalText: "付款在验收后 10 日内完成。\n交付和验收标准见附件。\n违约赔偿以合同总额 10% 为上限。",
    reason: "smoke revision"
  });
  assert(contractRevision.statusCode === 201, `contract revision failed with ${contractRevision.statusCode}`);

  const secondReview = await inject("POST", `/contracts/${contractId}/second-review`, contractToken);
  assert(secondReview.statusCode === 200, `contract second review failed with ${secondReview.statusCode}`);
  assert(secondReview.body.review.reviewType === "second", "second review returned wrong type");

  const secondRiskConfirm = await inject("POST", `/contracts/${contractId}/risk-confirm`, contractToken, {
    confirmations: secondReview.body.review.risks.map((risk) => ({
      riskId: risk.id,
      confirmed: true,
      selectedOption: "B",
      note: "smoke second human confirmation"
    }))
  });
  assert(secondRiskConfirm.statusCode === 200, `contract second risk confirm failed with ${secondRiskConfirm.statusCode}`);

  const approvalHandoff = await inject("POST", `/contracts/${contractId}/submit-approval`, contractToken, {
    reason: "smoke human approval instance"
  });
  assert(approvalHandoff.statusCode === 200, `contract approval handoff failed with ${approvalHandoff.statusCode}`);
  assert(approvalHandoff.body.handoff.approvalEngineImplemented === true, "approval handoff did not create engine instance");
  assert(typeof approvalHandoff.body.handoff.approvalId === "string", "approval handoff missing approval id");
  const approvalId = approvalHandoff.body.approval.id;
  assert(approvalHandoff.body.approval.currentApproverUserId === "user-legal", "approval did not enter legal node");

  const approvalDetailDenied = await inject("GET", `/approvals/${approvalId}`, memberToken);
  assert(approvalDetailDenied.statusCode === 404, "unauthorized member read approval detail");

  const legalWorkbench = await inject("GET", "/workbench", legalToken);
  assert(legalWorkbench.body.summary.pendingApprovalCount === 1, "legal workbench missing pending approval");

  const wrongCurrentHandler = await inject("POST", `/approvals/${approvalId}/approve`, financeToken, {
    reason: "not current handler"
  });
  assert(wrongCurrentHandler.statusCode === 403, "non-current approver handled approval");

  const legalApprove = await inject("POST", `/approvals/${approvalId}/approve`, legalToken, {
    reason: "smoke legal human approve"
  });
  assert(legalApprove.statusCode === 200, `legal approval failed with ${legalApprove.statusCode}`);
  assert(legalApprove.body.approval.currentApproverUserId === "user-finance", "approval did not advance to finance");

  const financeApprove = await inject("POST", `/approvals/${approvalId}/approve`, financeToken, {
    reason: "smoke finance human approve"
  });
  assert(financeApprove.statusCode === 200, `finance approval failed with ${financeApprove.statusCode}`);
  assert(financeApprove.body.approval.currentApproverUserId === "user-approver", "approval did not advance to business approver");

  const finalApprove = await inject("POST", `/approvals/${approvalId}/approve`, approverToken, {
    reason: "smoke final human approve"
  });
  assert(finalApprove.statusCode === 200, `final approval failed with ${finalApprove.statusCode}`);
  assert(finalApprove.body.approval.status === "approved", "approval did not complete");
  assert(finalApprove.body.contract.status === "approved", "contract approval result was not written back");

  const executionEvent = await inject("POST", `/contracts/${contractId}/execution-events`, contractToken, {
    eventType: "reminder",
    title: "Smoke 执行提醒",
    notes: "系统内记录，不发外部通知。",
    status: "pending"
  });
  assert(executionEvent.statusCode === 201, `contract execution event failed with ${executionEvent.statusCode}`);

  const memberContractRead = await inject("GET", `/contracts/${contractId}`, memberToken);
  assert(memberContractRead.statusCode === 404, "unauthorized member read contract content");

  const reuseDraft = await inject("POST", `/chat/threads/${threadId}/ai/summarize`, memberToken);
  assert(reuseDraft.statusCode === 200, `memory reuse draft failed with ${reuseDraft.statusCode}`);
  assert(reuseDraft.body.draft.contextSourceIds.length > 0, "AI draft did not reuse memory context");

  const fileReferenceDraft = await inject("POST", `/chat/threads/${threadId}/ai/summarize`, memberToken, {
    fileIds: [fileId]
  });
  assert(fileReferenceDraft.statusCode === 200, `AI file reference failed with ${fileReferenceDraft.statusCode}`);
  assert(
    fileReferenceDraft.body.draft.contextSourceIds.includes(fileId),
    "AI draft did not record accessible file reference"
  );

  const archiveFile = await inject("POST", `/files/${fileId}/archive`, ownerToken, {
    reason: "smoke archive"
  });
  assert(archiveFile.statusCode === 200, `file archive failed with ${archiveFile.statusCode}`);
  assert(archiveFile.body.file.status === "archived", "file archive did not mark archived");

  const archivedPreview = await inject("GET", `/files/${fileId}/preview`, memberToken);
  assert(archivedPreview.statusCode === 404, "archived file remained previewable");

  const chatModule = await inject("GET", "/modules/chat", memberToken);
  const knowledgeModule = await inject("GET", "/modules/knowledge", superToken);
  const contractsModule = await inject("GET", "/modules/contracts", contractToken);
  const approvalsModule = await inject("GET", "/modules/approvals", legalToken);
  assert(chatModule.body.status === "available", "chat module is not available");
  assert(knowledgeModule.body.status === "available", "knowledge module is not available");
  assert(contractsModule.body.status === "available", "contracts module is not available");
  assert(approvalsModule.body.status === "available", "approvals module is not available");

  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: [
          "health",
          "login",
          "project_create",
          "project_member_visibility",
          "task_status_loop",
          "confirmation_gate",
          "module_status",
          "task_audit",
          "chat_thread",
          "chat_ai_drafts",
          "ai_draft_confirmation",
          "knowledge_items",
          "knowledge_review_publish",
          "project_memory",
          "knowledge_query",
          "contract_upload",
          "contract_ai_review",
          "contract_risk_confirmation",
          "contract_revision_second_review",
          "approval_instance_created",
          "approval_current_handler_gate",
          "approval_result_writeback",
          "contract_execution_tracking",
          "contract_permission_filter",
          "memory_context_reuse",
          "file_upload",
          "file_preview_download",
          "file_archive",
          "ai_file_reference"
        ]
      },
      null,
      2
    )
  );
} finally {
  await server.close();
}
