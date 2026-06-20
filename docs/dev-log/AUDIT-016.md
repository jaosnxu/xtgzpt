# AUDIT-016 AI 框架中心和 AI Run 生产化审计

## 状态

- 状态：代码审计和外部 verifier gate 已完成；Browser DOM 验证通过，截图捕获超时
- 审计对象：DEV-016 AI 框架中心和 AI Run 生产化
- Loop 任务：`TASK-XTGZPT-DEV-016-CODEX-1`

## 审计范围

- AI Framework / Framework Version 是否独立建模
- AI Run 是否记录输入/输出快照、来源证据、状态、失败分类和 retry policy metadata
- 聊天 AI 草稿、知识问答、合同 AI 审查是否接入 AI Run
- 人工采纳、驳回、修改是否独立记录
- AI Framework 配置权限是否只允许系统管理员或超级管理员
- AI Run 读取是否继承来源对象权限
- 前端是否只在既有菜单内展示配置和证据
- 是否保持 AI human-boundary 规则
- PostgreSQL 兼容 migration 是否覆盖新增对象

## Findings

当前未发现代码审计或 verifier gate 层面的 P0 问题。

已完成 verifier gate：

- `git diff --check`：通过
- `npm run lint`：通过
- `npm run typecheck`：通过
- `npm run test`：通过，14 个 test files / 56 个 tests passed
- `npm run build`：通过
- `npm run smoke:api`：通过
- `npm audit --audit-level=low`：通过，0 vulnerabilities

已完成 Browser DOM 验证：

- `http://127.0.0.1:3014`，1440 viewport：通过
- `admin` / `113113` 登录成功
- System Settings 显示 policy `seed-dev-016` 和 AI Framework list
- AI Frameworks 保持在既有 System Settings 菜单内
- 未出现新的 top-level AI 菜单
- Browser CDP screenshot capture timed out；本审计记录 DOM 验证成功和截图捕获限制，不记录截图 artifact 成功

## 已确认

- AI Framework 和 Framework Version 已进入共享模型、运行时持久化边界和 migration。
- AI Run 已记录 framework id、framework version、scenario、actor、organization、source object、source ids、input/output snapshot refs、context source ids、status、failure class、retry policy metadata 和 completion time。
- 聊天 AI 草稿成功、provider/validation/permission failure 均可记录 AI Run。
- 知识问答使用权限过滤后的来源结果创建 AI Run 和来源证据。
- 合同 AI 审查创建 `contract_review` AI Run，并在非法状态时记录 `validation_error`。
- 人工确认 AI 草稿会记录 `adopted` 或 `changed`。
- 人工驳回 AI 草稿会记录 `rejected`，不创建正式对象。
- `/settings/ai-frameworks` 需要系统设置和 `configure_ai_frameworks` 权限。
- `/ai/runs` 和 `/ai/runs/:id` 需要 `read_ai_runs`，且按来源聊天、合同、审批或知识查询范围过滤。
- 前端未新增 AI 一级菜单；配置和证据只在既有系统设置与业务页面内展示。
- PostgreSQL 兼容 migration `0010_ai_framework_run_productionization.sql` 覆盖 AI Framework、Version、Run、Snapshot、Evidence、Decision。

## 非阻塞风险

### AUDIT-016-P1-001 仍未接入真实 PostgreSQL adapter

影响：

- 已有 PostgreSQL 兼容迁移资产，但运行时仍为本地 runtime store。

处理：

- 后续数据库 adapter 阶段接入连接池、事务、迁移执行和备份恢复。

### AUDIT-016-P1-002 AI Framework 配置仍为本地运行时配置

影响：

- 当前配置可通过 API 创建新版本，但尚未接入生产数据库事务、审批发布流程或回滚界面。

处理：

- 后续配置治理阶段补完整发布/回滚策略，但不得允许 AI 自行配置框架。

### AUDIT-016-P2-001 Browser 截图 artifact 捕获超时

影响：

- 系统设置 AI Frameworks 的 DOM 验证已通过，但 Browser CDP screenshot capture timed out，缺少截图 artifact。

处理：

- 如发布流程强制要求截图 artifact，补跑 Browser screenshot capture；当前 DOM 验证已确认菜单边界和 seed-dev-016 展示。

## 审计结论

DEV-016 AI Framework / AI Run 生产化代码已通过外部 verifier gate、smoke、audit 和 1440 viewport Browser DOM 验证。唯一记录限制是 Browser CDP 截图捕获超时；未发现需要阻塞合并的代码审计问题。
