import { describe, expect, it } from "vitest";
import {
  arkAiFrameworkVersion,
  buildArkChatPayload,
  defaultArkModel,
  fallbackAiFrameworkVersion,
  generateAiDraftContent
} from "./ai-provider";

describe("AI provider", () => {
  it("builds Ark chat payload with draft-only instructions", () => {
    const payload = buildArkChatPayload({
      kind: "task_draft",
      threadTitle: "交付会",
      messages: [
        {
          senderName: "负责人",
          content: "请整理上线前检查项。"
        }
      ]
    });

    expect(payload.model).toBe(defaultArkModel);
    expect(payload.messages[0].content).toContain("只能整理、建议和生成草稿");
    expect(payload.messages[1].content).toContain("会话标题：交付会");
    expect(payload.messages[1].content).toContain("任务草稿");
    expect(payload.messages[1].content).toContain("负责人: 请整理上线前检查项。");
  });

  it("uses template output when Ark API key is not configured", async () => {
    const result = await generateAiDraftContent(
      {
        kind: "chat_summary",
        threadTitle: "空配置",
        messages: [
          {
            senderName: "成员",
            content: "没有配置 API Key。"
          }
        ]
      },
      {
        env: {
          NODE_ENV: "development"
        }
      }
    );

    expect(result.frameworkVersion).toBe(fallbackAiFrameworkVersion);
    expect(result.model).toBe("template");
    expect(result.content).toContain("AI 建议");
  });

  it("calls Ark chat completions when explicitly enabled in test", async () => {
    const calls: Array<{ body: string; headers: HeadersInit; url: string }> = [];
    const fetchFn: typeof fetch = async (url, init) => {
      calls.push({
        url: String(url),
        headers: init?.headers ?? {},
        body: String(init?.body)
      });

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: "真实模型返回的草稿内容"
              }
            }
          ]
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    };

    const result = await generateAiDraftContent(
      {
        kind: "knowledge_draft",
        threadTitle: "知识沉淀",
        messages: [
          {
            senderName: "成员",
            content: "把这个流程整理成知识。"
          }
        ]
      },
      {
        allowNetworkInTest: true,
        env: {
          NODE_ENV: "test",
          ARK_API_KEY: "unit-test-key",
          ARK_BASE_URL: "https://ark.example.test/api/v3",
          ARK_MODEL: "doubao-test-model"
        },
        fetchFn
      }
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://ark.example.test/api/v3/chat/completions");
    expect(calls[0].headers).toMatchObject({
      authorization: "Bearer unit-test-key",
      "content-type": "application/json"
    });
    expect(JSON.parse(calls[0].body)).toMatchObject({
      model: "doubao-test-model",
      max_tokens: 1200
    });
    expect(result).toEqual({
      content: "真实模型返回的草稿内容",
      frameworkVersion: arkAiFrameworkVersion,
      model: "doubao-test-model"
    });
  });
});
