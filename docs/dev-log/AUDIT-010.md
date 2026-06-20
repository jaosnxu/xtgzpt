# AUDIT-010 角色和权限生产化审计

## 状态

- 状态：本地代码审计通过，待真实 Git worktree / 在线 npm audit 复核
- 分支：`loop/dev-010-role-permission-productionization`
- 审计对象：DEV-010 角色和权限生产化
- Loop 任务：`TASK-XTGZPT-DEV-010-CODEX-2`

## 审计范围

- 11 类 Phase 1 角色模型
- 六维权限摘要
- 独立审批权限 helper
- 权限策略 API 输出
- 系统管理员数据范围
- 普通用户设置和权限 API 拒绝审计
- 审批权限策略迁移资产
- AI 人工确认边界是否保持

## 验证结果

自动验证：

- `npm ci`：通过
- `npm run typecheck`：通过
- `npm run test`：通过，8 个测试文件 / 42 个测试通过
- `npm run lint`：通过
- `npm run build`：通过
- `npm run smoke:api`：通过
- `npm run ci`：通过
- `npm audit --audit-level=low --offline`：0 vulnerabilities
- `npm audit --audit-level=low`：受限网络下失败，错误为 `getaddrinfo ENOTFOUND registry.npmjs.org`
- `git diff --check`：当前目录不是 Git repository，无法执行
- 触达文件空白 / 冲突标记扫描：通过

## Findings

未发现 DEV-010 范围内的阻塞代码问题。

PR 前必须在真实 Git worktree 和可访问 npm registry 的环境补跑：

- `git diff --check`
- `npm audit --audit-level=low`

当前托管执行目录没有 `.git`，且网络不能解析 `registry.npmjs.org`；这两个 gate 属于外部环境限制，不是产品代码失败。

## 已确认

- 共享模型支持 11 类 Phase 1 角色
- 普通用户菜单不包含系统设置
- 系统管理员可访问配置，但 `data.scope` 为 `assigned_organizations`
- 权限摘要按 menu、data、operation、approval、file、ai 输出
- 审批权限独立为 `approval`，操作权限中不再包含审批决策
- `/settings/permission-policies` 输出六维策略
- `/settings/approval-permission-policies` 输出审批权限策略
- 普通用户访问系统设置和审批权限策略 API 均返回 403 并记录拒绝事件
- 审批节点决策 helper 要求当前节点人类审批人
- AI 仍保持草稿、建议、提醒边界，未成为审批人
- 本阶段没有修改 Loop 平台仓库

## 非阻塞风险

### AUDIT-010-P1-001 后台权限策略仍未接入数据库 adapter

影响：

- 已有迁移资产覆盖审批权限策略存储
- 当前运行时仍读取共享 seed 策略

处理：

- 后续数据库 adapter / 设置后台阶段接入真实策略读取

### AUDIT-010-P2-001 审批 helper 不是完整审批闭环

影响：

- 当前只完成审批权限维度和当前节点人类审批判定 helper
- 审批实例、节点流转、退回、转交、加签和写回仍未实现

处理：

- 按计划留到 `DEV-015` 审批闭环

## 审计结论

DEV-010 代码能力可以进入 PR 准备；PR 前仍需在真实 Git / 网络环境补齐外部 gate。
