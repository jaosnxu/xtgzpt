# AUDIT-012 文件生产存储审计

## 状态

- 状态：本地代码审计通过，在线 `npm audit` 需网络环境复核
- 分支：`loop/dev-012-file-production-storage`
- 审计对象：DEV-012 文件生产存储
- Loop 任务：`TASK-XTGZPT-DEV-012-CODEX-1`

## 审计范围

- 文件共享契约、状态和权限模型
- 文件 API 元数据、版本、绑定、预览、下载和归档行为
- 来源对象权限继承和文件维度权限叠加
- 无权限响应是否泄露文件名或对象名
- 正式流程文件是否物理删除
- AI 文件引用权限检查是否阻断无权文件
- 文件审计覆盖
- PostgreSQL 兼容迁移资产
- 前端是否新增冻结外一级菜单
- 本阶段不做范围是否被遵守

## 验证结果

自动验证：

- `npm ci`：通过
- `npm run lint`：通过
- `npm run typecheck`：通过
- `npm run test`：通过，10 个测试文件 / 46 个测试通过
- `npm run build`：通过
- `npm run smoke:api`：通过
- `npm run ci`：通过
- `npm audit --audit-level=low --offline`：0 vulnerabilities
- `git diff --check`：通过
- `npm audit --audit-level=low`：受限网络下失败，错误为 `getaddrinfo ENOTFOUND registry.npmjs.org`

## Findings

未发现 DEV-012 范围内的阻塞代码问题。

PR 前必须在可访问 npm registry 的环境补跑：

- `npm audit --audit-level=low`

当前环境不能解析 `registry.npmjs.org`，属于外部网络限制，不是产品代码失败。

## 已确认

- 文件上传创建独立元数据、版本和对象绑定记录
- 版本响应不返回原始内容，下载接口单独返回内容
- 文件绑定支持当前已实现业务对象：project、task、chat_thread、knowledge_item、project_memory
- 预览、下载、归档和 AI 引用均经后端权限校验
- 文件权限继承来源对象权限，并叠加文件维度权限
- 非授权用户通过 URL 猜测文件下载返回非泄露 `404`
- 错误响应不包含被猜测文件名或敏感项目名
- formal process 文件使用 locked / archived 状态作废，不提供物理删除接口
- 上传、绑定、预览、下载、归档、AI 引用和权限拒绝均写审计
- AI 引用无权文件返回 403 并写 `file.ai_reference_denied`
- 前端文件控件只在既有项目/任务页面组件中展示
- 未新增文件中心一级菜单或其他冻结外一级菜单
- 未实现完整合同、审批、外部网盘、部署、生产写入或 secrets

## 非阻塞风险

### AUDIT-012-P1-001 仍未接入真实 PostgreSQL adapter

影响：

- 已有 PostgreSQL 兼容迁移资产覆盖文件元数据、版本、对象绑定和归档事件。
- 当前运行时仍使用本地 runtime store，不是最终生产数据库 adapter。

处理：

- 后续数据库 adapter 阶段接入连接池、事务和真实对象存储策略。

### AUDIT-012-P2-001 文件内容仍是开发运行时文本内容

影响：

- DEV-012 完成文件元数据、版本、权限和审计边界。
- 真实二进制对象存储、病毒扫描、大小限制和内容分片仍需生产存储阶段补齐。

处理：

- 外部云盘明确不在本阶段；生产对象存储策略需在上线准备前补齐。

### AUDIT-012-P2-002 前端只在项目/任务页面展示文件控件

影响：

- 符合“不新增文件中心一级菜单”的范围要求。
- 合同、审批文件控件需等 DEV-014 / DEV-015 对应来源对象闭环后接入。

处理：

- 后续合同闭环和审批闭环在各自已有页面内接入文件控件，不新增一级菜单。

## 审计结论

DEV-012 代码能力可以进入 PR 准备；PR 前仍需在网络可用环境补齐在线 audit。
