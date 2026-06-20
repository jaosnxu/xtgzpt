# TECHNICAL STANDARD

本文件定义 `xtgzpt` 当前已落地技术栈和后续生产级技术标准。

## 1. 当前技术栈

当前代码已经落地：

| 层 | 标准 |
| --- | --- |
| 语言 | TypeScript |
| 运行时 | Node.js `>=24 <25` |
| 包管理 | npm `>=11` |
| 仓库结构 | npm workspaces monorepo |
| 前端 | React + Vite |
| 后端 | Fastify |
| 共享模型 | `packages/shared` |
| 数据库资产 | `packages/database/migrations` |
| 测试 | Vitest |
| 代码检查 | ESLint |
| 构建 | TypeScript build + Vite build |
| CI | GitHub Actions |
| AI Provider | 火山方舟 / 豆包 Chat API，环境变量配置 |

## 2. Monorepo 边界

目录职责：

| 路径 | 职责 |
| --- | --- |
| `apps/web` | Web 前端 |
| `apps/api` | HTTP API |
| `packages/shared` | 共享类型、权限、状态机、平台边界 |
| `packages/database` | 数据库迁移和数据库说明 |
| `scripts` | 项目本地脚本，只允许项目专属脚本 |
| `docs` | PRD、宪法、标准、dev-log、audit-log |

禁止：

- 在业务项目仓库放可复用 Loop 平台 runner。
- 前端直接绕过 API 读 seed 数据。
- 后端权限只靠前端隐藏按钮。
- 把生产密钥写入仓库。

## 3. API 标准

API 必须遵守：

- 所有业务接口必须先认证。
- 所有菜单、数据、操作、审批、文件、AI 权限必须在后端校验。
- 无权限必须返回 403 或不泄露对象存在性的 404。
- 错误信息不得泄露敏感对象名称。
- 正式状态变化必须校验当前状态和操作者权限。
- 关键动作必须写审计。
- AI 相关接口必须先做来源权限过滤。

当前 API 已实现：

- `/auth/*`
- `/settings/*`
- `/audit-logs`
- `/objects/:type/:id/audit-logs`
- `/users/:id/audit-logs`
- `/projects`
- `/tasks`
- `/chat/threads`
- `/ai/drafts/:id/confirm`
- `/knowledge/items`
- `/knowledge/items/:id/submit-review`
- `/knowledge/items/:id/versions`
- `/knowledge/items/:id/publish`
- `/knowledge/items/:id/reject`
- `/knowledge/items/:id/archive`
- `/memory/items`
- `/knowledge/query`
- `/modules/:module`
- `/settings/approval-permission-policies`
- `/files`
- `/files/:id`
- `/files/:id/preview`
- `/files/:id/download`
- `/files/:id/archive`
- `/contracts`
- `/contracts/upload`
- `/contracts/paste`
- `/contracts/:id`
- `/contracts/:id/ai-review`
- `/contracts/:id/risk-confirm`
- `/contracts/:id/revision`
- `/contracts/:id/second-review`
- `/contracts/:id/submit-approval`
- `/contracts/:id/execution-events`
- `/approvals`
- `/approvals/:id`
- `/approvals/:id/approve`
- `/approvals/:id/reject`
- `/approvals/:id/return`
- `/approvals/:id/transfer`
- `/approvals/:id/add-sign`
- `/settings/ai-frameworks`
- `/settings/ai-frameworks/:id`
- `/ai/runs`
- `/ai/runs/:id`

## 4. 前端标准

前端必须遵守：

- 所有页面走真实 API。
- 不允许用前端假数据冒充生产数据。
- 菜单必须来自权限结果。
- 无权限、空状态、加载、错误、AI 生成中、AI 失败必须有明确页面状态。
- 俄文长度优先设计，中文用于当前测试可读。
- 不新增冻结外一级菜单。

响应式范围：

- 1440px
- 1280px
- 960px

## 5. 数据库标准

当前状态：

- 已有迁移目录。
- 已有运行时持久化边界覆盖项目、任务、聊天、AI 草稿、知识、项目记忆、审计和文件元数据。
- PostgreSQL 兼容 migration 资产已覆盖当前运行时对象、文件元数据/版本/对象绑定/归档事件、知识审核状态/版本历史/来源证据、合同、合同版本、AI 审查、风险确认、审批边界交接、执行跟踪事件，以及审批实例、节点、动作历史和合同审批结果写回字段。
- DEV-016 已新增 AI Framework、Framework Version、AI Run、输入/输出快照、来源证据链接和人工采纳/驳回/修改记录的 PostgreSQL 兼容 migration 资产。
- DEV-020 已新增 runtime store mode selection：`memory`、`file`、`postgres`。测试默认 `memory`；本地和非测试默认 `file`，并可用 `XTGZPT_RUNTIME_DATA_FILE` 指向持久化文件；生产可通过 `XTGZPT_RUNTIME_STORE_MODE=postgres` 进入 PostgreSQL adapter/cutover boundary。
- DEV-020 已新增 PostgreSQL runtime config validation 和 `0011_runtime_store_cutover_boundary.sql`，用于当前 `RuntimeData` JSON shape 的 cutover document 边界。
- 仍未完成 driver-backed PostgreSQL live writes、连接池、事务、生产数据切流和备份恢复演练。

生产目标：

- PostgreSQL 兼容关系型数据库作为主数据源。
- 所有核心对象必须数据库持久化。
- 每个核心表必须包含组织归属、状态、创建人、时间字段。
- 状态变化必须有历史记录。
- 审计日志必须独立表保存。
- 文件元数据必须独立表保存。
- AI Run、AI Draft、AI Framework 必须独立建模。

迁移规则：

- 每个阶段新增数据库字段必须有 migration。
- migration 必须可在空库执行。
- 破坏性迁移必须写风险说明和回滚/补偿方案。
- 测试必须覆盖仓储层。

## 6. 权限技术标准

权限模型必须最终支持：

- 11 类角色
- 6 类权限维度
- 后台配置角色权限
- 组织范围
- 项目范围
- 数据范围
- 当前审批节点处理人
- 文件继承对象权限
- AI 继承来源权限

当前技术差距：

- 11 类 Phase 1 角色已进入共享模型、seed 账号和权限策略。
- `approval` 已成为独立权限维度，审批权限不再混在操作权限中。
- 合同来源审批闭环已校验当前节点处理人，支持同意、驳回、退回、转交、加签和结果写回。
- 文件权限已继承项目、任务、聊天、知识和项目记忆等来源对象权限，并覆盖上传、预览、下载、归档和 AI 引用。
- AI 框架配置权限和 AI Run 读取权限已拆分；AI Run 读取继续按来源对象权限过滤。
- 权限还没有生产数据库配置表完整落地。

## 7. AI 技术标准

AI Provider：

- 真实 Key 只能来自 `.env.local`、服务器环境变量或 GitHub Secrets。
- 公开仓库只能提交 `.env.example`。
- 测试环境不得依赖真实网络。
- 无 Key 时允许模板降级，但必须明确 framework version。

AI Run 生产字段必须包含：

- `frameworkId`
- `frameworkVersion`
- `scenario`
- `actorUserId`
- `organizationId`
- `sourceObjectType`
- `sourceObjectId`
- `sourceIds`
- `inputSnapshotRef`
- `outputSnapshotRef`
- `contextSourceIds`
- `status`
- `failureClass`
- `createdAt`
- `completedAt`

DEV-016 当前实现：

- AI Framework / Framework Version 进入共享模型、运行时持久化边界和 migration。
- Chat AI 草稿、知识问答和合同 AI 审查会创建 AI Run。
- AI Run 记录 `frameworkId`、`frameworkVersion`、scenario、actor、organization、source object、source ids、input/output snapshot、context source ids、status、failure class、retry policy metadata 和 completion time。
- 输入/输出快照、来源证据链接和人工采纳/驳回/修改记录进入独立记录。
- 框架配置只允许系统管理员或超级管理员在既有系统设置内操作；AI Run 读取按 `read_ai_runs` 和来源对象权限过滤。
- AI 仍不能审批、驳回、退回、转交、加签、发布知识、创建正式任务、签署、付款或确认执行。

## 7.1 知识检索技术策略

DEV-013 当前实现：

- 保持本地、可测试、确定性的全文检索，不接外部搜索服务。
- 检索候选只来自当前用户有权读取的 `published` 知识和项目记忆。
- `draft`、`submitted_for_review`、`rejected`、`archived` 知识不得进入检索、证据或 AI 输入上下文。
- 每条检索结果必须返回 source evidence。

后续向量策略：

- 可在本地 adapter 中增加 embedding/vector 字段和测试替身。
- 外部向量数据库、外部搜索服务和网络检索不属于 DEV-013，必须另立阶段和安全评审。

## 8. CI 和 Gate

本地 gate：

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run smoke:api`
- `npm audit --audit-level=low`
- `git diff --check`

GitHub required checks：

- `lint`
- `typecheck`
- `test`
- `build-smoke`
- `audit`

合并规则：

- 不直接在 `main` 开发。
- 每个阶段必须有分支、dev-log、验证记录和 PR。
- `main` 必须受 branch protection 保护。
- 至少 1 个有写权限 reviewer approve。

## 9. Secrets 标准

禁止提交：

- `ARK_API_KEY`
- `.env`
- `.env.local`
- 任何第三方 API key
- 生产数据库连接串
- 生产 JWT secret
- 私钥

允许提交：

- `.env.example`
- 无真实密钥的配置说明

## 10. Loop 使用标准

`xtgzpt` 是业务项目仓库。

Loop 平台能力属于：

- `https://github.com/jaosnxu/tea-finance-loop-system`

业务项目只保存：

- 项目宪法
- 技术标准
- PRD
- dev-log
- audit-log
- intent debt
- 项目代码
