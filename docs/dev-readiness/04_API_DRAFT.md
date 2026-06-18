# API DRAFT

## 1. 说明

本文件是开发前接口草案，不是最终接口实现。

接口开发时必须保证：

- 后端真实鉴权
- 后端真实数据权限过滤
- 后端真实文件权限过滤
- AI 输入先过权限过滤
- 所有关键动作写审计
- 错误信息不泄露无权限对象

## 2. 通用约定

请求上下文必须包含：

- current_user_id
- organization_scope
- role_ids
- permission_policy_version
- request_id

通用错误：

- `401_UNAUTHENTICATED`
- `403_FORBIDDEN`
- `404_NOT_FOUND`
- `409_STATE_CONFLICT`
- `422_VALIDATION_ERROR`
- `423_LOCKED`
- `429_RATE_LIMITED`
- `500_INTERNAL_ERROR`

## 3. 认证与账号

| 方法 | 路径 | 用途 | 审计 |
| --- | --- | --- | --- |
| POST | `/auth/login` | 登录 | 是 |
| POST | `/auth/logout` | 退出 | 是 |
| GET | `/auth/me` | 当前用户上下文 | 否 |
| GET | `/auth/me/menus` | 当前用户菜单 | 否 |
| GET | `/auth/me/permissions` | 当前用户权限摘要 | 否 |

## 4. 系统设置

| 方法 | 路径 | 用途 | 权限 |
| --- | --- | --- | --- |
| GET | `/settings/organizations` | 组织列表 | 系统设置可见 |
| POST | `/settings/organizations` | 新建组织 | 组织管理 |
| PATCH | `/settings/organizations/{id}` | 修改组织 | 组织管理 |
| GET | `/settings/roles` | 角色列表 | 角色管理 |
| POST | `/settings/roles` | 新建角色 | 角色管理 |
| PATCH | `/settings/roles/{id}` | 修改角色 | 角色管理 |
| GET | `/settings/permission-policies` | 权限策略 | 权限管理 |
| PUT | `/settings/permission-policies/{id}` | 更新权限策略 | 权限管理 |
| GET | `/settings/workflows` | 流程配置 | 流程配置 |
| PUT | `/settings/workflows/{id}` | 更新流程 | 流程配置 |
| GET | `/settings/ai-frameworks` | AI 框架 | AI 配置 |
| PUT | `/settings/ai-frameworks/{id}` | 更新 AI 框架 | AI 配置 |

所有设置变更必须审计。

## 5. 项目

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/projects` | 按权限获取项目列表 |
| POST | `/projects` | 新建项目 |
| GET | `/projects/{id}` | 项目详情 |
| PATCH | `/projects/{id}` | 修改项目 |
| POST | `/projects/{id}/members` | 添加成员 |
| DELETE | `/projects/{id}/members/{user_id}` | 移除成员 |
| POST | `/projects/{id}/status` | 项目状态流转 |
| GET | `/projects/{id}/audit-logs` | 项目审计 |

状态流转必须校验当前状态和权限。

## 6. 任务

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/tasks` | 任务列表 |
| POST | `/tasks` | 新建任务 |
| GET | `/tasks/{id}` | 任务详情 |
| PATCH | `/tasks/{id}` | 修改任务 |
| POST | `/tasks/{id}/assign` | 分配任务 |
| POST | `/tasks/{id}/status` | 状态流转 |
| POST | `/tasks/{id}/comments` | 评论 |
| GET | `/tasks/{id}/audit-logs` | 审计 |

AI 任务草稿必须通过人工确认后才能调用正式新建任务。

## 7. 聊天

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/chat/threads` | 会话列表 |
| POST | `/chat/threads` | 创建会话 |
| GET | `/chat/threads/{id}` | 会话详情 |
| GET | `/chat/threads/{id}/messages` | 消息列表 |
| POST | `/chat/threads/{id}/messages` | 发送消息 |
| POST | `/chat/threads/{id}/ai/summarize` | AI 整理 |
| POST | `/chat/threads/{id}/ai/task-draft` | AI 生成任务草稿 |
| POST | `/chat/threads/{id}/ai/knowledge-draft` | AI 生成知识草稿 |

AI 结果不得自动发布或自动创建正式对象。

## 8. 知识库

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/knowledge/query` | AI 知识问答 |
| GET | `/knowledge/items` | 知识条目列表 |
| POST | `/knowledge/items` | 创建知识草稿 |
| POST | `/knowledge/items/{id}/submit-review` | 提交审核 |
| POST | `/knowledge/items/{id}/publish` | 发布 |
| POST | `/knowledge/items/{id}/archive` | 归档 |

知识问答接口必须先做来源权限过滤，再调用 AI。

## 9. 合同

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/contracts` | 合同列表 |
| POST | `/contracts/upload` | 上传合同 |
| POST | `/contracts/paste` | 粘贴合同 |
| GET | `/contracts/{id}` | 合同详情 |
| POST | `/contracts/{id}/ai-review` | AI 审查 |
| POST | `/contracts/{id}/risk-confirm` | 人工确认风险 |
| POST | `/contracts/{id}/revision` | 提交修改 |
| POST | `/contracts/{id}/second-review` | 二次审查 |
| POST | `/contracts/{id}/submit-approval` | 提交审批 |
| POST | `/contracts/{id}/execution-events` | 执行跟踪 |
| GET | `/contracts/{id}/audit-logs` | 审计 |

## 10. 审批

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/approvals` | 审批列表 |
| POST | `/approvals` | 发起审批 |
| GET | `/approvals/{id}` | 审批详情 |
| POST | `/approvals/{id}/approve` | 同意 |
| POST | `/approvals/{id}/reject` | 驳回 |
| POST | `/approvals/{id}/return` | 退回修改 |
| POST | `/approvals/{id}/transfer` | 转交 |
| POST | `/approvals/{id}/add-sign` | 加签 |
| POST | `/approvals/{id}/ai-suggestion` | AI 建议 |

审批决策接口必须校验当前节点审批人。

## 11. 文件

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/files` | 上传文件 |
| GET | `/files/{id}` | 文件元数据 |
| GET | `/files/{id}/preview` | 预览 |
| GET | `/files/{id}/download` | 下载 |
| POST | `/files/{id}/archive` | 归档 |

文件接口必须独立做文件权限校验。

## 12. 审计

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| GET | `/audit-logs` | 管理员按权限查看审计 |
| GET | `/objects/{type}/{id}/audit-logs` | 对象审计 |

审计不可删除，不提供物理删除接口。
