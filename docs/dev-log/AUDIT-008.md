# AUDIT-008 项目记忆检索与回用审计

## 状态

- 状态：审计通过，待 PR
- 分支：`audit/008-memory-retrieval`
- Issue：`https://github.com/jaosnxu/xtgzpt/issues/30`
- 审计对象：DEV-008 / PR #31 / merge commit `4fc0a20`
- 前置队列：PR #28、PR #29、PR #31 已按 `scripts/loop-merge-queue.mjs` 合并到 `main`

## 审计范围

- `/knowledge/query` 检索接口
- 正式知识与项目记忆统一检索
- 检索权限过滤
- AI 草稿生成前上下文回读
- `contextSourceIds` 记录
- 项目记忆绑定当前项目
- 知识库前端检索工作台
- Loop merge queue runner
- 未完成范围是否被误标为完成

## 验证结果

自动验证：

- `npm run ci`：通过
- `npm audit --audit-level=low`：0 vulnerabilities
- `git diff --check`：通过

GitHub 验证：

- PR #28 状态：merged
- PR #29 状态：merged
- PR #31 状态：merged
- `main` 当前提交：`4fc0a20`
- PR #31 required checks：`lint`、`typecheck`、`test`、`build-smoke`、`audit` 全绿
- PR #31 额外检查：`ark-live` 全绿

Loop 队列验证：

- 命令：`npm run loop:merge-queue -- --queue 28,29,31 --apply`
- 队列结果：
  - `#28` 已合并
  - `#29` 已合并
  - `#31` 已合并
- `INTENT-004` 已关闭

功能验证继承自 DEV-008：

- `/knowledge/query` 不再返回 `not_implemented`
- 空查询返回 `query_required`
- 查询结果可返回 `knowledge_item` 和 `project_memory`
- 查询动作写入 `ai.knowledge_query_requested`
- AI 草稿生成前读取可见知识 / 记忆上下文
- AI 草稿保存 `contextSourceIds`
- 知识库页面显示当前检索范围

## Findings

未发现阻塞合并问题。

## 非阻塞风险

### AUDIT-008-P2-001 知识与记忆仍是内存存储

影响：

- 服务重启后正式知识和项目记忆会丢失
- 不能作为生产级知识库持久化能力

结论：

- DEV-008 已明确声明“不做数据库持久化”
- 后续数据库阶段必须补迁移、仓储层、持久化测试和数据恢复策略

### AUDIT-008-P2-002 检索仍是简单关键词评分

影响：

- 当前没有向量数据库和全文搜索引擎
- 复杂语义召回能力有限

结论：

- DEV-008 已明确声明“不做向量数据库 / 全文搜索引擎”
- 后续可在数据持久化稳定后引入向量索引或全文检索

### AUDIT-008-P2-003 知识审核工作流未完成

影响：

- 当前 AI 只生成草稿，人工确认后入库
- 还没有独立知识审核队列、版本审核和发布审批

结论：

- 不构成当前阶段缺陷
- 后续知识管理阶段继续补

### AUDIT-008-P3-001 `gh` CLI 仍未安装

影响：

- 本地不能用 `gh` 查看 Actions 日志
- 当前继续使用 GitHub connector、GitHub REST 和 local git

结论：

- 已记录为 `INTENT-002`
- 不阻塞当前阶段，因为 merge queue runner 已可使用 GitHub REST 执行队列

### AUDIT-008-P3-002 生产 secrets 与上线 smoke test 仍未完成

影响：

- 本阶段可以验证本地和 GitHub Actions
- 不能声明真实生产部署 smoke 已完成

结论：

- 已记录为 `INTENT-003`
- 等生产环境、secrets、部署目标明确后处理

## 审计结论

DEV-008 可以进入下一阶段。

已确认：

- 项目记忆检索与经验回用主闭环完成
- 权限过滤、审计记录和 smoke 覆盖已接入
- 前端知识库检索范围已显性化
- Loop PR 队列执行器已生效
- PR #28、#29、#31 已按队列合并到 `main`
- 未完成能力已明确记录，没有被写成完成

下一步：

- 提交 AUDIT-008
- 创建 PR
- 合并后进入下一开发阶段
