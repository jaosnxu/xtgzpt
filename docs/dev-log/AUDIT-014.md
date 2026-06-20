# AUDIT-014 合同闭环审计

## 状态

- 状态：本地代码审计通过，在线 `npm audit` / 浏览器验证需可用环境复核
- 分支：`loop/dev-014-contract-closure`
- 审计对象：DEV-014 合同闭环
- Loop 任务：`TASK-XTGZPT-DEV-014-CODEX-1`

## 审计范围

- 合同入口是否仅支持上传或粘贴
- 合同版本是否记录原文和来源证据
- AI 结构化审查是否只输出风险、原文高亮和 A/B/C 方案
- AI 是否不能确认风险、选择方案、提交审批或改变正式状态
- 人工风险确认是否为继续流转的必要条件
- 修改版本是否必须二次审查后才能提交审批边界
- 审批提交是否只是 bounded handoff，不实现完整审批引擎
- 执行跟踪是否只做 reminder / record / status_update 和审计
- 无权限用户是否无法读取合同正文、风险、来源证据或 AI 上下文
- 前端是否只在既有合同一级菜单内展示流程
- DEV-014 不做范围是否被遵守

## 验证结果

自动验证：

- `npm ci`：通过
- `npm run typecheck`：通过
- `npm run test`：通过，12 个测试文件 / 51 个测试通过
- `npm run build`：通过
- `npm run smoke:api`：通过
- `npm run lint`：通过
- `npm run ci`：通过
- `npm audit --audit-level=low --offline`：0 vulnerabilities
- `git diff --check`：通过
- `npm audit --audit-level=low`：受限网络下失败，错误为 `getaddrinfo ENOTFOUND registry.npmjs.org`
- `npm run dev:web -- --host 127.0.0.1`：受限沙箱下失败，错误为 `listen EPERM: operation not permitted 127.0.0.1:3001`

## Findings

浏览器验证复核发现并已修复 1 个 DEV-014 范围内回归：

- `AUDIT-014-P1-FIXED-001`：Web UI 创建合同成功后点击 AI 审查，浏览器请求 `POST /contracts/:id/ai-review` 没有 JSON body 但保留 `Content-Type: application/json`，Fastify JSON parser 在业务 handler 前返回 `400 Bad Request`。修复后前端无 body 请求不再设置 JSON content type，API 同时对 `/contracts/:id/ai-review` 和 `/contracts/:id/second-review` 的空 body JSON header 做 scoped 兼容；风险确认、审批边界、执行跟踪和 AI 人工确认边界未扩张。

PR 前必须在可用环境补跑：

- 在线 `npm audit --audit-level=low`
- 合同页真实浏览器 1440 / 1280 / 960 截图或交互验收

当前环境不能解析 `registry.npmjs.org`，且禁止监听本地 dev server 端口；这些属于环境限制，不是产品代码失败。

## 已确认

- 仅新增 `/contracts/upload` 和 `/contracts/paste` 两个合同创建入口
- 合同版本保存原文、入口方式和 source evidence
- AI 审查结果包含风险清单、原文高亮、A/B/C 方案、framework version 和 `nextRequiredAction=human_confirm_risks`
- AI 审查结果中风险初始 `humanConfirmed=false`、`selectedOption=null`
- 风险确认接口要求人类用户逐项确认并选择 A/B/C 方案
- 首次风险确认后进入修改要求，修改后创建新版本
- 修改后未二次审查、二次审查风险未人工确认时，提交审批会被 409 阻断
- 审批提交只生成 `approval_pending` 和 `contract_approval_handoffs`，`approvalEngineImplemented=false`
- 执行事件只记录 reminder / record / status_update，不触发签署、付款、外部通知或完成确认
- 上传、粘贴、AI 审查开始/完成、风险确认、版本变化、审批 handoff、执行跟踪和无权限访问均写审计
- 合同页在既有“合同”一级菜单内完成，未新增新一级菜单
- 无权限账号通过合同详情或 AI 审查接口无法拿到合同标题、正文、风险、来源证据或 AI 上下文
- 浏览器式无 body POST 回归已覆盖：`ai-review`、`second-review` 在 `Content-Type: application/json` 且无 payload 时不再返回 parser 级 400；无权限 `ai-review` 仍返回非泄露 404。

## 非阻塞风险

### AUDIT-014-P1-001 仍未接入真实 PostgreSQL adapter

影响：

- 已有 PostgreSQL 兼容迁移资产覆盖合同对象、版本、审查、风险确认、审批 handoff 和执行事件。
- 当前运行时仍使用本地 runtime store，不是最终生产数据库 adapter。

处理：

- 后续数据库 adapter 阶段接入连接池、事务、迁移执行和备份恢复。

### AUDIT-014-P1-002 审批引擎未实现

影响：

- DEV-014 只把合同提交到审批边界，不创建审批节点或处理 approve/reject。

处理：

- 按计划进入 `DEV-015` 审批闭环，补完整人类审批节点、结果写回和权限验证。

### AUDIT-014-P2-001 前端未做真实浏览器截图验收

影响：

- 当前已通过 React typecheck、Vite build 和 API smoke。
- 像素级 1440 / 1280 / 960 截图仍需 PR 或浏览器可用环境复核。

处理：

- 在 Browser 插件或本地浏览器可用环境补跑合同页上传/粘贴、AI 审查、风险确认、版本历史和执行跟踪截图。

## 审计结论

DEV-014 代码能力可以进入 PR 准备；PR 前仍需在网络和浏览器可用环境补齐在线 audit 与真实响应式截图验收。
