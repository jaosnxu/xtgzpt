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
  assert(knowledgeConfirm.body.knowledgeItem.status === "published", "knowledge draft was not published");

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

  const reuseDraft = await inject("POST", `/chat/threads/${threadId}/ai/summarize`, memberToken);
  assert(reuseDraft.statusCode === 200, `memory reuse draft failed with ${reuseDraft.statusCode}`);
  assert(reuseDraft.body.draft.contextSourceIds.length > 0, "AI draft did not reuse memory context");

  const chatModule = await inject("GET", "/modules/chat", memberToken);
  const knowledgeModule = await inject("GET", "/modules/knowledge", superToken);
  assert(chatModule.body.status === "available", "chat module is not available");
  assert(knowledgeModule.body.status === "available", "knowledge module is not available");

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
          "project_memory",
          "knowledge_query",
          "memory_context_reuse"
        ]
      },
      null,
      2
    )
  );
} finally {
  await server.close();
}
