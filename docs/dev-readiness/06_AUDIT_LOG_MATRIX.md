# AUDIT LOG MATRIX

## 1. 审计原则

所有关键动作必须留痕。

审计记录必须：

- 不可物理删除
- 不可原地修改
- 可追加纠错记录
- 可按对象查看
- 可按用户查看
- 可按时间查看
- 权限受控

## 2. 通用字段

```json
{
  "audit_log_id": "audit_001",
  "occurred_at": "2026-06-18T10:00:00+03:00",
  "actor_user_id": "user_001",
  "actor_role_ids": ["role_employee"],
  "action": "contract.ai_review_started",
  "object_type": "contract",
  "object_id": "contract_001",
  "source_ip": "127.0.0.1",
  "request_id": "req_001",
  "before_snapshot_ref": "snapshot_before",
  "after_snapshot_ref": "snapshot_after",
  "reason": "用户发起 AI 审查",
  "result": "success"
}
```

## 3. 账号与权限审计

| 动作 | 必须审计 |
| --- | --- |
| 登录成功/失败 | 是 |
| 退出 | 是 |
| 创建用户 | 是 |
| 停用用户 | 是 |
| 修改用户组织 | 是 |
| 修改角色 | 是 |
| 修改权限策略 | 是 |
| 查看系统设置 | 可选 |
| 无权限访问 | 是 |

## 4. 项目审计

| 动作 | 必须审计 |
| --- | --- |
| 新建项目 | 是 |
| 修改项目 | 是 |
| 变更负责人 | 是 |
| 添加/移除成员 | 是 |
| 状态流转 | 是 |
| 关联任务 | 是 |
| 关联审批 | 是 |
| 归档项目 | 是 |

## 5. 任务审计

| 动作 | 必须审计 |
| --- | --- |
| 新建任务 | 是 |
| AI 生成任务草稿 | 是 |
| 人工确认任务草稿 | 是 |
| 修改任务 | 是 |
| 分配负责人 | 是 |
| 修改截止日期 | 是 |
| 状态流转 | 是 |
| 评论 | 可选 |
| 上传附件 | 是 |
| 取消任务 | 是 |

## 6. 聊天审计

| 动作 | 必须审计 |
| --- | --- |
| 创建会话 | 是 |
| 添加/移除成员 | 是 |
| 发送消息 | 可选 |
| 撤回消息 | 是 |
| AI 整理聊天 | 是 |
| AI 生成任务草稿 | 是 |
| AI 生成知识草稿 | 是 |

## 7. 知识库审计

| 动作 | 必须审计 |
| --- | --- |
| 知识问答 | 是 |
| 创建知识草稿 | 是 |
| 提交审核 | 是 |
| 发布知识 | 是 |
| 驳回知识 | 是 |
| 修改知识 | 是 |
| 创建知识版本 | 是 |
| 归档知识 | 是 |
| AI 引用来源 | 是 |
| 权限阻断来源 | 是 |

DEV-013 要求：

- AI 草稿确认只能写 `knowledge.submitted_for_review_from_ai_draft`，不能写自动发布。
- `knowledge.published`、`knowledge.rejected`、`knowledge.archived`、`knowledge.version_created` 必须记录 actor、object、reason、before/after snapshot ref。
- 知识问答审计必须能证明结果来自权限过滤后的本地来源，且每条结果带 source evidence。

## 8. 合同审计

| 动作 | 必须审计 |
| --- | --- |
| 上传合同 | 是 |
| 粘贴合同 | 是 |
| AI 审查开始 | 是 |
| AI 审查完成/失败 | 是 |
| 风险人工确认 | 是 |
| 选择 A/B/C 方案 | 是 |
| 修改合同 | 是 |
| 二次审查 | 是 |
| 提交审批 | 是 |
| 审批结果写回 | 是 |
| 执行跟踪记录 | 是 |
| 版本变化 | 是 |
| 文件访问 | 是 |

DEV-014 要求：

- `contract.uploaded`、`contract.pasted`、`contract.version_created` 必须记录合同入口和版本来源。
- `contract.ai_review_started` / `contract.ai_review_completed` / `contract.second_review_started` / `contract.second_review_completed` 必须记录 AI framework version。
- `contract.risk_confirmed` 必须由人类账号写入，不能由 AI 写入。
- `contract.approval_submitted` 只记录 bounded handoff，不代表审批通过。
- `contract.execution_event_recorded` 只记录 reminder / record / status_update，不代表签署、付款或执行完成。
- 合同无权限读取或 AI 审查必须写拒绝审计，且响应不得泄露合同内容、风险、来源证据或 AI 上下文。

DEV-015 要求：

- `contract.approval_submitted` 必须关联真实 approval id，但不代表审批通过。
- `contract.approval_result_written_back` 必须记录审批结果写回合同状态。

## 9. 审批审计

| 动作 | 必须审计 |
| --- | --- |
| 发起审批 | 是 |
| 审批节点进入 | 是 |
| 同意 | 是 |
| 驳回 | 是 |
| 退回修改 | 是 |
| 转交 | 是 |
| 加签 | 是 |
| AI 审批建议 | 是 |
| 审批完成 | 是 |
| 审批超时 | 是 |

DEV-015 要求：

- `approval.initiated`、`approval.node_entered`、`approval.approved`、`approval.rejected`、`approval.returned`、`approval.transferred`、`approval.add_signed`、`approval.completed` 必须记录 actor、object、reason、before/after snapshot ref 和 result。
- 非当前节点处理人调用审批动作必须写权限拒绝审计。
- AI 不得写入上述人工审批动作审计。

## 10. 文件审计

| 动作 | 必须审计 |
| --- | --- |
| 上传 | 是 |
| 预览 | 是 |
| 下载 | 是 |
| 绑定对象 | 是 |
| 权限变化 | 是 |
| 归档 | 是 |
| AI 读取 | 是 |
| 无权限访问 | 是 |

## 11. AI 审计

| 动作 | 必须审计 |
| --- | --- |
| AI Run 创建 | 是 |
| AI Run 成功 | 是 |
| AI Run 失败 | 是 |
| 框架版本选择 | 是 |
| 来源权限过滤 | 是 |
| 输出人工确认 | 是 |
| 输出被拒绝 | 是 |
| 失败重试 | 是 |

DEV-016 要求：

- `ai.run_created`、`ai.run_succeeded`、`ai.run_failed` 必须记录 actor、object、organization、request id、AI framework version 和 snapshot refs。
- `ai.framework_config_viewed` 和 `ai.framework_version_created` 必须记录人类管理员、变更原因和新旧版本引用。
- `ai.output_adopted`、`ai.output_changed`、`ai.output_rejected` 必须记录人类账号、AI Run、草稿、目标对象和原因。
- 权限拒绝的 AI Run 读取必须写拒绝审计，且响应不得泄露输入/输出快照或来源内容。
- AI 不得写入人工审批、知识发布、任务正式创建、签署、付款或执行完成审计动作。

## 12. 审计验收

任意一个关键动作，测试必须能回答：

- 谁做的
- 什么时间做的
- 对哪个对象做的
- 做之前是什么
- 做之后是什么
- 为什么做
- 成功还是失败
- 有没有 AI 参与
- AI 用了哪个框架版本
