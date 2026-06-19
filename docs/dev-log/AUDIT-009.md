# AUDIT-009 生产持久化底座审计

## 状态

- 状态：本地代码审计通过，待真实 Git worktree / PR gate 复核
- 分支：`loop/dev-009-persistence-foundation`
- 审计对象：DEV-009 生产持久化底座
- Loop 任务：`TASK-XTGZPT-DEV-009-CODEX-4`

## 审计范围

- API 运行时数据仓库边界
- 文件持久化写入与重启读取
- 项目、任务、聊天、AI 草稿、知识、记忆和审计对象覆盖
- PostgreSQL 迁移草案和类型一致性
- 原有权限、审计、AI 草稿、知识检索 smoke 是否回退
- Loop 项目记忆是否写回

## 验证结果

自动验证：

- `npm run typecheck`：通过
- `npm run test`：通过，8 个测试文件 / 34 个测试通过
- `npm run lint`：通过
- `npm run build`：通过
- `npm run smoke:api`：通过
- `npm run ci`：通过
- `npm audit --audit-level=low --offline`：0 vulnerabilities
- `npm audit --audit-level=low`：受限网络下失败，错误为 `getaddrinfo ENOTFOUND registry.npmjs.org`
- `git diff --check`：当前目录不是 Git repository，无法执行
- 触达文件空白 / 冲突标记扫描：通过

Loop 验证：

- Loop 读取 `docs/loop/00_MEMORY_INDEX.md`：通过
- Loop 写入 `docs/loop/runtime-memory`：通过
- Loop 阶段记录、heartbeat、trace、run summary：通过
- Loop writer executor 未修改 Loop 平台仓库：通过
- Loop intent debt：本轮代码修复无新增；在线 audit 与 Git metadata 复核作为外部环境待办记录

## Findings

未发现阻塞代码能力的实现问题。

PR 前必须在真实 Git worktree 和可访问 npm registry 的环境补跑：

- `git diff --check`
- `npm audit --audit-level=low`

当前托管执行目录没有 `.git`，且网络不能解析 `registry.npmjs.org`；这两个 gate 属于环境限制，不是产品代码失败。

## 非阻塞风险

### AUDIT-009-P1-001 当前只是运行时文件持久化，不是最终 PostgreSQL adapter

影响：

- 本阶段已经解决本地 API runtime 重启数据丢失的基础问题
- 但生产环境仍需要 PostgreSQL adapter、连接池、事务、迁移执行器和备份恢复策略

处理：

- 已新增 `0004_runtime_collaboration_records.sql`
- 已修正 DEV-009 migration 中用户 / 组织外键为 `uuid`，避免 `text` 外键引用既有 UUID 表
- 已补 `project_status_history`、`task_status_history`、`denied_access_events`
- 后续阶段必须把 runtime store 接到 PostgreSQL adapter

### AUDIT-009-P2-001 写入保存不是事务型

影响：

- 文件写入使用临时文件和 rename，能降低半写入风险
- 但跨对象写入仍不是数据库事务

处理：

- 当前仅作为生产持久化边界第一步
- PostgreSQL adapter 阶段补事务边界

### AUDIT-009-P2-002 sessions 仍是运行时内存

影响：

- 服务重启后登录 token 失效
- 不影响业务对象持久化，但不符合最终生产 session 标准

处理：

- 后续认证生产化阶段补 session 存储或 JWT 策略

### AUDIT-009-P2-003 当前托管 worktree 缺少 Git 元数据

影响：

- `git status` 和 `git diff --check` 不能在当前目录执行
- 无法从本目录证明分支、diff 和空白检查的 Git gate

处理：

- 已对本轮触达文件执行空白 / 冲突标记扫描，结果通过
- PR 前必须在真实 Git worktree 补跑 `git diff --check`

### AUDIT-009-P2-004 在线 npm audit 被网络限制阻断

影响：

- `npm audit --audit-level=low` 需要访问 npm registry
- 当前环境返回 `getaddrinfo ENOTFOUND registry.npmjs.org`

处理：

- `npm audit --audit-level=low --offline` 已通过，0 vulnerabilities
- PR / CI 环境仍必须执行在线 `npm audit --audit-level=low`

## 审计结论

DEV-009 代码能力可以进入 PR 准备；PR 前仍需在真实 Git / 网络环境补齐外部 gate。

已确认：

- 本阶段没有修改 Loop 平台代码
- 项目业务数据写入边界已经统一
- 项目、任务、聊天、消息、AI 草稿、知识、项目记忆和审计记录具备重启后读取测试
- 原有 API、权限、AI 草稿、知识检索和 smoke 没有回退
- PostgreSQL 表结构已经补到数据库迁移目录，并覆盖状态历史与拒绝访问事件
