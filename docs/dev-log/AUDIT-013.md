# AUDIT-013 知识库生产化审计

## 状态

- 状态：本地代码审计通过，在线 `npm audit` 需网络环境复核
- 分支：`loop/dev-013-knowledge-productionization`
- 审计对象：DEV-013 知识库生产化
- Loop 任务：`TASK-XTGZPT-DEV-013-CODEX-1`

## 审计范围

- 知识状态机和 AI 自动发布边界
- 知识管理员发布、驳回、归档权限
- 知识版本 author/reviewer/version/status/timestamps/source evidence
- 知识问答 source evidence 返回
- 无权限来源过滤和 AI 输入上下文过滤
- 本地全文检索和外部搜索禁止边界
- 发布、驳回、归档、创建版本和知识问答审计
- 前端审核队列、版本历史、来源证据和审核控件
- PostgreSQL 兼容迁移资产
- 本阶段不做范围是否被遵守

## 验证结果

自动验证：

- `npm ci`：通过
- `npm run lint`：通过
- `npm run typecheck`：通过
- `npm run test`：通过，11 个测试文件 / 49 个测试通过
- `npm run build`：通过
- `npm run smoke:api`：通过
- `npm run ci`：通过
- `npm audit --audit-level=low --offline`：0 vulnerabilities
- `git diff --check`：通过
- `npm audit --audit-level=low`：受限网络下失败，错误为 `getaddrinfo ENOTFOUND registry.npmjs.org`
- `npm run dev:web -- --host 127.0.0.1`：受限沙箱下失败，错误为 `listen EPERM`

## Findings

未发现 DEV-013 范围内的阻塞代码问题。

PR 前必须在可访问 npm registry 的环境补跑：

- `npm audit --audit-level=low`

当前环境不能解析 `registry.npmjs.org`，且禁止监听本地 dev server 端口；这些属于外部环境限制，不是产品代码失败。

## 已确认

- AI 知识草稿确认写入 `knowledge.submitted_for_review_from_ai_draft`，状态为 `submitted_for_review`
- AI 不会自动写 `published`
- 发布接口要求知识发布权限，并把 reviewer、publishedAt 和当前版本状态写入记录
- 驳回、归档和创建版本均有独立 API、状态变化和审计动作
- `/knowledge/query` 只检索当前用户有权读取的 `published` 知识和项目记忆
- `draft`、`submitted_for_review`、`rejected`、`archived` 知识不会进入检索、证据或 AI 输入上下文
- 每条知识问答结果返回 source evidence
- 无权限已发布知识不会进入检索结果或 AI `contextSourceIds`
- 前端只在既有知识库一级菜单内增加审核队列、版本历史、来源证据和发布/驳回/归档控件
- 搜索仍是本地可测试全文检索，未接外部搜索服务或外部向量数据库
- 新增迁移资产覆盖知识版本和来源证据字段
- 未实现完整合同、完整审批、部署、生产写入、secrets、外部通知、移动 App 或 ERP/财务扩张

## 非阻塞风险

### AUDIT-013-P1-001 仍未接入真实 PostgreSQL adapter

影响：

- 已有 PostgreSQL 兼容迁移资产覆盖知识审核、版本和来源证据。
- 当前运行时仍使用本地 runtime store，不是最终生产数据库 adapter。

处理：

- 后续数据库 adapter 阶段接入连接池、事务、迁移执行和备份恢复。

### AUDIT-013-P2-001 检索仍为本地全文匹配

影响：

- 符合 DEV-013 “local and testable/no external search integration” 范围。
- 大规模语义向量召回能力未实现。

处理：

- 后续可新增本地 vector adapter 和测试替身；外部向量数据库或外部搜索服务必须另立阶段和安全评审。

### AUDIT-013-P2-002 前端未做真实浏览器截图验收

影响：

- 当前已通过 React typecheck、Vite build 和 API smoke。
- 像素级 1440 / 1280 / 960 截图仍需 PR 或浏览器可用环境复核。

处理：

- 在 Browser 插件或本地浏览器可用环境补跑知识页审核队列、版本历史和来源证据截图。

## 审计结论

DEV-013 代码能力可以进入 PR 准备；PR 前仍需在网络可用环境补齐在线 audit，并可补充真实浏览器截图验收。
