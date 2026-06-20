# OBJECTS AND STATE MACHINES

## 1. 核心对象

| 对象 | 说明 | 必须绑定 |
| --- | --- | --- |
| User | 用户账号 | 组织、角色、状态 |
| Organization | 组织 | 父级组织、状态 |
| Role | 角色 | 权限集合 |
| PermissionPolicy | 权限策略 | 角色、组织、范围 |
| Project | 项目 | 组织、负责人、成员 |
| Task | 任务 | 项目、负责人、创建人 |
| ChatThread | 聊天会话 | 成员、关联对象 |
| Message | 消息 | 会话、发送人 |
| KnowledgeItem | 知识条目 | 来源、权限、发布状态 |
| Contract | 合同 | 发起人、组织、版本 |
| ContractReview | 合同 AI 审查结果 | 合同、框架版本 |
| Approval | 审批单 | 来源对象、流程、节点 |
| ApprovalNode | 审批节点 | 审批人、状态 |
| FileAsset | 文件 | 来源对象、权限 |
| AIRun | AI 执行记录 | 框架、输入、输出、用户 |
| AuditLog | 审计记录 | 动作、对象、用户 |

## 2. 用户状态

`pending -> active -> suspended -> archived`

规则：

- pending 用户不能登录业务系统。
- active 用户可按权限访问。
- suspended 用户不能登录，但历史记录保留。
- archived 用户不可再使用，历史审计保留。

## 3. 项目状态

`draft -> active -> paused -> completed -> archived`

允许流转：

- draft -> active
- active -> paused
- paused -> active
- active -> completed
- completed -> archived

禁止：

- archived 恢复 active
- 无权限用户关闭项目

## 4. 任务状态

`draft -> todo -> in_progress -> submitted -> completed`

异常状态：

- `blocked`
- `cancelled`
- `archived`

规则：

- AI 只能生成 draft。
- 正式 todo 必须人工确认。
- submitted 必须由确认人确认后进入 completed。
- cancelled 必须写原因。

## 5. 聊天状态

`active -> archived`

消息状态：

`sent -> edited -> withdrawn`

规则：

- withdrawn 只隐藏展示，不删除审计。
- AI 整理必须保留原始消息引用。
- AI 不能删除原消息。

## 6. 知识状态

`draft -> submitted_for_review -> published`

异常状态：

- `rejected`
- `archived`

规则：

- AI 只能生成 draft。
- AI 知识草稿经人工确认后只能进入 `submitted_for_review`，不得自动进入 `published`。
- `submitted_for_review` 必须由知识管理员或具备知识发布权限的人类管理员处理。
- `rejected` 可由作者创建新版本后重新提交审核。
- published 后变更必须生成新版本。
- archived 不得作为默认检索来源、证据来源或 AI 输入上下文。
- 每个知识版本必须记录 author、reviewer、version、status、时间戳和 source evidence。

## 7. 合同状态

主状态：

`draft -> ai_reviewing -> risk_pending_confirm -> revision_required -> second_reviewing -> approval_pending -> approved -> execution_tracking -> completed`

异常状态：

- `rejected`
- `cancelled`
- `archived`

规则：

- 合同入口只允许上传或粘贴。
- AI 审查完成后必须进入人工确认。
- A/B/C 方案只能作为建议。
- 修改后必须二次审查。
- 审批通过不等于执行完成。
- 执行跟踪必须人工确认。

## 8. 审批状态

审批单状态：

`draft -> submitted -> processing -> approved`

异常状态：

- `rejected`
- `returned`
- `transferred`
- `cancelled`
- `expired`

审批节点状态：

`pending -> processing -> approved/rejected/returned/transferred/add_signed`

规则：

- 审批人必须是人。
- AI 建议必须显示为建议。
- 当前节点必须可追踪当前处理人。
- 审批结果必须写回来源对象。

## 9. 文件状态

`uploaded -> linked -> locked -> archived`

规则：

- linked 文件必须绑定来源对象。
- locked 文件属于正式流程，不允许物理删除。
- archived 只归档，不删除审计。
- 文件访问必须经过文件权限。

## 10. AI 执行状态

`queued -> running -> succeeded`

异常状态：

- `failed`
- `timeout`
- `blocked_by_permission`
- `blocked_by_policy`

规则：

- 每次 AI 执行必须记录框架 ID 和版本。
- 失败必须记录失败类型和可重试建议。
- 权限阻断不得自动重试。

## 11. 审计状态

审计记录不可修改、不可物理删除。

如需纠错，只能追加一条 correction 审计记录。
