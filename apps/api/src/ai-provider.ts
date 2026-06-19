import type { AiDraftRecord } from "@xtgzpt/shared";

export const fallbackAiFrameworkVersion = "chat-ai-template-v1";
export const arkAiFrameworkVersion = "ark-doubao-chat-v1";
export const defaultArkBaseUrl = "https://ark.cn-beijing.volces.com/api/v3";
export const defaultArkModel = "doubao-seed-2-0-pro-260215";

interface AiProviderMessage {
  senderName: string;
  content: string;
}

export interface AiProviderMemoryContext {
  type: "knowledge_item" | "project_memory";
  title: string;
  content: string;
}

interface GenerateAiDraftInput {
  kind: AiDraftRecord["kind"];
  threadTitle: string;
  messages: AiProviderMessage[];
  memoryContexts?: AiProviderMemoryContext[];
}

interface GenerateAiDraftOptions {
  allowNetworkInTest?: boolean;
  env?: NodeJS.ProcessEnv;
  fetchFn?: typeof fetch;
}

interface ArkChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderError";
  }
}

function fallbackContent(kind: AiDraftRecord["kind"]) {
  if (kind === "chat_summary") {
    return "AI 建议：已根据当前会话消息整理重点、风险和后续动作。";
  }

  if (kind === "task_draft") {
    return "AI 草稿：建议创建一条待人工确认的任务，不能自动进入正式任务列表。";
  }

  return "AI 草稿：建议沉淀为知识条目，必须由知识管理员审核发布。";
}

function promptForKind(kind: AiDraftRecord["kind"]) {
  if (kind === "chat_summary") {
    return "请把会话整理成管理层可读的工作摘要，包含结论、风险、待确认问题和下一步动作。";
  }

  if (kind === "task_draft") {
    return "请基于会话生成任务草稿，包含任务标题、任务说明、验收标准、建议负责人和优先级。注意：只输出草稿，不能假设已经创建正式任务。";
  }

  return "请基于会话生成知识库条目草稿，包含标题、适用场景、正文、注意事项和需要人工复核的内容。注意：只输出草稿，不能假设已经发布。";
}

function buildConversationText(messages: AiProviderMessage[]) {
  return messages.map((message, index) => `${index + 1}. ${message.senderName}: ${message.content}`).join("\n");
}

function buildMemoryContextText(memoryContexts: AiProviderMemoryContext[] = []) {
  if (memoryContexts.length === 0) {
    return "无";
  }

  return memoryContexts
    .map((context, index) => `${index + 1}. [${context.type}] ${context.title}: ${context.content}`)
    .join("\n");
}

export function buildArkChatPayload(input: GenerateAiDraftInput, model = defaultArkModel) {
  return {
    model,
    messages: [
      {
        role: "system",
        content:
          "你是协同工作平台的企业工作助手。你只能整理、建议和生成草稿，不能声称已经创建正式任务、发布知识或完成审批。输出使用中文，结构清晰，避免编造会话中没有的信息。"
      },
      {
        role: "user",
        content: [
          `会话标题：${input.threadTitle}`,
          `目标：${promptForKind(input.kind)}`,
          "可用项目记忆和知识：",
          buildMemoryContextText(input.memoryContexts),
          "原始消息：",
          buildConversationText(input.messages)
        ].join("\n")
      }
    ],
    temperature: 0.2
  };
}

export async function generateAiDraftContent(input: GenerateAiDraftInput, options: GenerateAiDraftOptions = {}) {
  const env = options.env ?? process.env;
  const apiKey = env.ARK_API_KEY?.trim();
  const shouldUseArk = Boolean(apiKey) && (env.NODE_ENV !== "test" || options.allowNetworkInTest);

  if (!shouldUseArk) {
    return {
      content: fallbackContent(input.kind),
      frameworkVersion: fallbackAiFrameworkVersion,
      model: "template"
    };
  }

  const baseUrl = (env.ARK_BASE_URL?.trim() || defaultArkBaseUrl).replace(/\/$/, "");
  const model = env.ARK_MODEL?.trim() || defaultArkModel;
  const maxTokens = Number(env.ARK_AI_MAX_TOKENS ?? 1200);
  const payload = {
    ...buildArkChatPayload(input, model),
    max_tokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 1200
  };
  const fetchImpl = options.fetchFn ?? fetch;
  const response = await fetchImpl(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new AiProviderError(`ark_chat_failed:${response.status}`);
  }

  const body = (await response.json()) as ArkChatResponse;
  const content = body.choices?.[0]?.message?.content?.trim();

  if (!content) {
    throw new AiProviderError("ark_chat_empty_content");
  }

  return {
    content,
    frameworkVersion: arkAiFrameworkVersion,
    model
  };
}
