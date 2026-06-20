# AUDIT-015 审批闭环审计

## 状态

- 状态：代码审计完成；自动 gate 因当前沙箱无 `node` / `npm` 阻塞
- 审计对象：DEV-015 审批闭环
- Loop 任务：`TASK-XTGZPT-DEV-015-CODEX-1`

## 审计范围

- 是否创建真实人工审批实例、节点和当前处理人
- 审批人是否为人类账号，AI 是否仍不能审批
- 同意、驳回、退回、转交、加签是否校验当前节点处理人
- 审批结果是否写回来源合同
- 工作台和系统内通知是否展示当前节点待审批
- 审批详情 API 是否权限安全且不泄露来源合同敏感信息
- 关键动作是否写审计
- PostgreSQL 兼容 migration 是否覆盖新增对象
- 前端是否只在既有“审批”一级菜单内实现

## Findings

当前未发现代码审计层面的 P0 问题。

需要在 Node/npm 可用环境复核的阻塞项：

- `AUDIT-015-ENV-001`：当前 shell 无 `node` / `npm`，无法运行 `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`、`npm run smoke:api`、`npm run ci`、`npm audit`。
- `AUDIT-015-ENV-002`：当前环境未执行浏览器 1440 桌面截图验收。

## 已确认

- 合同提交审批会创建 approval instance，并把 handoff 的 `approvalId` 指向该实例。
- 初始节点为法务审批，后续节点为财务审批和业务审批，均为 seed human users。
- 非当前节点处理人调用审批动作会被后端拒绝。
- 转交要求目标用户是具备审批处理能力的人类账号。
- 加签会插入人工节点，当前处理人切换到加签人。
- 最终同意写回合同 `approved`。
- 驳回写回合同 `rejected`。
- 退回写回合同 `revision_required`。
- 无权限读取审批详情返回非泄露 404。
- 工作台 `pendingApprovals` 和 approval 通知接入当前节点。
- 审批动作和合同结果写回都有审计记录。
- 新增 migration `0009_approval_closure.sql` 覆盖 approvals、approval_nodes、approval_actions 和 handoff approval id。
- 前端审批工作区在既有“审批”菜单内，未新增一级菜单。

## 非阻塞风险

### AUDIT-015-P1-001 仍未接入真实 PostgreSQL adapter

影响：

- 已有 PostgreSQL 兼容迁移资产，但运行时仍为本地 runtime store。

处理：

- 后续数据库 adapter 阶段接入连接池、事务、迁移执行和备份恢复。

### AUDIT-015-P1-002 审批流程模板仍为确定性本地流程

影响：

- 当前合同审批流固定为法务、财务、业务审批人。
- 尚未实现复杂组织自动路由、代理和流程模板配置。

处理：

- 后续流程配置阶段扩展，但不得绕过当前节点处理人校验。

### AUDIT-015-P2-001 前端浏览器验收未跑

影响：

- 已实现一个 1440 桌面生产布局，但未在当前环境截图验证。

处理：

- 在可用浏览器环境补跑审批页 1440 桌面截图和操作验收。

## 审计结论

DEV-015 审批闭环代码可以进入可用环境 gate 复核。合并前必须补跑 Node/npm gate、audit 和浏览器 1440 桌面验收。
