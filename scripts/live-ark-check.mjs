import { arkAiFrameworkVersion, generateAiDraftContent } from "../apps/api/src/ai-provider.ts";

const result = await generateAiDraftContent(
  {
    kind: "chat_summary",
    threadTitle: "Ark live check",
    messages: [
      {
        senderName: "系统",
        content: "请返回一段简短的协同平台 AI 草稿连通性测试摘要。"
      }
    ]
  },
  {
    allowNetworkInTest: true
  }
);

if (result.frameworkVersion !== arkAiFrameworkVersion) {
  throw new Error("Ark provider was not used. Check ARK_API_KEY secret.");
}

console.log(
  JSON.stringify({
    ok: true,
    provider: result.frameworkVersion,
    model: result.model,
    contentLength: result.content.length
  })
);
