/* global console, process */

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
          "task_audit"
        ]
      },
      null,
      2
    )
  );
} finally {
  await server.close();
}
