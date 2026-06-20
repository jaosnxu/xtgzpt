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

describe("file production storage", () => {
  it("creates metadata, versions and bindings, enforces inherited permissions, archives formal files and audits actions", async () => {
    const server = buildServer();
    const ownerToken = await loginOnServer(server, "owner");
    const memberToken = await loginOnServer(server, "member");
    const adminToken = await loginOnServer(server, "admin");
    const superToken = await loginOnServer(server, "super");
    const projectId = await createProject(server, ownerToken, "DEV-012 文件项目");

    await server.inject({
      method: "POST",
      url: `/projects/${projectId}/members`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        userId: "user-member"
      }
    });

    const upload = await server.inject({
      method: "POST",
      url: "/files",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        sourceObjectType: "project",
        sourceObjectId: projectId,
        displayName: "confidential-plan.txt",
        mimeType: "text/plain",
        contentText: "only project members can read this plan",
        formalProcess: true
      }
    });
    const uploadBody = upload.json();
    const fileId = uploadBody.file.id as string;

    expect(upload.statusCode).toBe(201);
    expect(uploadBody.file).toEqual(
      expect.objectContaining({
        displayName: "confidential-plan.txt",
        sourceObjectType: "project",
        sourceObjectId: projectId,
        status: "locked",
        formalProcess: true
      })
    );
    expect(uploadBody.version).toEqual(
      expect.objectContaining({
        fileId,
        versionNumber: 1,
        originalName: "confidential-plan.txt"
      })
    );
    expect(uploadBody.version.contentText).toBeUndefined();
    expect(uploadBody.binding).toEqual(
      expect.objectContaining({
        fileId,
        objectType: "project",
        objectId: projectId
      })
    );

    const memberFiles = await server.inject({
      method: "GET",
      url: `/files?objectType=project&objectId=${projectId}`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    const memberPreview = await server.inject({
      method: "GET",
      url: `/files/${fileId}/preview`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });
    const memberDownload = await server.inject({
      method: "GET",
      url: `/files/${fileId}/download`,
      headers: {
        authorization: `Bearer ${memberToken}`
      }
    });

    expect(memberFiles.statusCode).toBe(200);
    expect(memberFiles.json().files).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: fileId
        })
      ])
    );
    expect(memberPreview.statusCode).toBe(200);
    expect(memberPreview.json().previewText).toContain("only project members");
    expect(memberDownload.statusCode).toBe(200);
    expect(memberDownload.json().contentText).toBe("only project members can read this plan");

    const adminDownload = await server.inject({
      method: "GET",
      url: `/files/${fileId}/download`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });

    expect(adminDownload.statusCode).toBe(404);
    expect(JSON.stringify(adminDownload.json())).not.toContain("confidential-plan");
    expect(JSON.stringify(adminDownload.json())).not.toContain("DEV-012 文件项目");

    const archived = await server.inject({
      method: "POST",
      url: `/files/${fileId}/archive`,
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        reason: "formal process voided by owner"
      }
    });
    const previewAfterArchive = await server.inject({
      method: "GET",
      url: `/files/${fileId}/preview`,
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

    expect(archived.statusCode).toBe(200);
    expect(archived.json().file).toEqual(
      expect.objectContaining({
        id: fileId,
        status: "archived",
        archiveReason: "formal process voided by owner"
      })
    );
    expect(previewAfterArchive.statusCode).toBe(404);
    expect(audit.statusCode).toBe(200);
    expect(audit.json().auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "file.uploaded",
          objectId: fileId
        }),
        expect.objectContaining({
          action: "file.bound_to_object",
          objectId: projectId
        }),
        expect.objectContaining({
          action: "file.previewed",
          objectId: fileId
        }),
        expect.objectContaining({
          action: "file.downloaded",
          objectId: fileId
        }),
        expect.objectContaining({
          action: "file.voided",
          objectId: fileId
        })
      ])
    );
  });

  it("blocks AI file references when the requester cannot access the file", async () => {
    const server = buildServer();
    const ownerToken = await loginOnServer(server, "owner");
    const memberToken = await loginOnServer(server, "member");
    const superToken = await loginOnServer(server, "super");
    const visibleProjectId = await createProject(server, ownerToken, "AI 可见项目");
    const hiddenProjectId = await createProject(server, ownerToken, "AI 不可见项目");

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

    const hiddenUpload = await server.inject({
      method: "POST",
      url: "/files",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        sourceObjectType: "project",
        sourceObjectId: hiddenProjectId,
        displayName: "hidden-ai-source.txt",
        contentText: "member cannot use this in AI"
      }
    });
    const hiddenFileId = hiddenUpload.json().file.id as string;
    const thread = await server.inject({
      method: "POST",
      url: "/chat/threads",
      headers: {
        authorization: `Bearer ${ownerToken}`
      },
      payload: {
        title: "AI 文件引用会话",
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
        content: "请基于我能访问的材料生成摘要。"
      }
    });

    const blockedDraft = await server.inject({
      method: "POST",
      url: `/chat/threads/${threadId}/ai/summarize`,
      headers: {
        authorization: `Bearer ${memberToken}`
      },
      payload: {
        fileIds: [hiddenFileId]
      }
    });
    const audit = await server.inject({
      method: "GET",
      url: "/audit-logs",
      headers: {
        authorization: `Bearer ${superToken}`
      }
    });

    expect(blockedDraft.statusCode).toBe(403);
    expect(JSON.stringify(blockedDraft.json())).not.toContain("hidden-ai-source");
    expect(JSON.stringify(blockedDraft.json())).not.toContain("AI 不可见项目");
    expect(audit.json().auditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "file.ai_reference_denied",
          result: "denied",
          aiInvolved: true
        })
      ])
    );
  });
});
