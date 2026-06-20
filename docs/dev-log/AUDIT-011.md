# AUDIT-011 我的工作台、通知和页面状态审计

## 状态

- 状态：本地代码审计通过，在线 `npm audit` / 浏览器插件验证需可用环境复核
- 分支：`loop/dev-011-workbench-notifications-page-states`
- 审计对象：DEV-011 我的工作台、通知和页面状态收口
- Loop 任务：`TASK-XTGZPT-DEV-011-CODEX-1`

## 审计范围

- `/workbench` API 权限边界
- 首页和我的工作台角色感知展示
- 系统内通知类别覆盖
- 页面状态覆盖
- 管理员与普通用户内容差异
- AI 结果人工确认边界
- 1440 / 1280 / 960 响应式代码约束
- DEV-011 不做范围是否被遵守

## 验证结果

自动验证：

- `npm ci`：通过
- `npm run lint`：通过
- `npm run typecheck`：通过
- `npm run test`：通过，9 个测试文件 / 43 个测试通过
- `npm run build`：通过
- `npm run smoke:api`：通过
- `npm audit --audit-level=low --offline`：0 vulnerabilities
- `npm audit --audit-level=low`：受限网络下失败，错误为 `getaddrinfo ENOTFOUND registry.npmjs.org`
- `git diff --check`：通过
- 触达文件空白 / 冲突标记扫描：通过

## Findings

未发现 DEV-011 范围内的阻塞代码问题。

PR 前必须在可用环境补跑：

- 在线 `npm audit --audit-level=low`
- 真实浏览器 1440 / 1280 / 960 截图或交互验收

当前环境中 Browser 插件 `iab` 不可用，且沙箱禁止监听本地端口，导致 `npm run dev:api` 和 `npm run dev:web` 因 `listen EPERM` 失败。这些属于环境限制，不是产品代码失败。

## 已确认

- 普通成员工作台只返回本人相关待办、负责任务、参与项目和可确认 AI 草稿
- 系统管理员可看到设置和权限上下文，但不默认读取普通成员业务项目
- 系统内通知覆盖 pending work、approval、contract confirmation、AI result、no-permission、system status
- 审批和合同实例仍为空状态，没有提前实现完整流程
- AI 结果保持草稿，需要人工确认后才能进入任务、知识或项目记忆
- 核心页面状态覆盖 normal、empty、loading、no-permission、error、AI_Generating、AI_Failed、expired、archived
- 普通用户菜单未新增系统设置或冻结外一级菜单
- 响应式 CSS 使用 `minmax`、断点和单列降级约束，覆盖 1440 / 1280 / 960 可用宽度目标

## 非阻塞风险

### AUDIT-011-P1-001 缺少真实浏览器截图证据

影响：

- 当前只能证明代码、构建和响应式 CSS 约束，不能证明真实浏览器像素级无重叠。

处理：

- 在 Browser 插件或本地浏览器可用环境补跑 1440 / 1280 / 960 截图验收。

### AUDIT-011-P2-001 审批和合同工作台项仍为空实例

影响：

- DEV-011 只展示入口、通知和状态，不生成正式审批或合同确认实例。

处理：

- 按计划留到 `DEV-014` 合同闭环和 `DEV-015` 审批闭环。

## 审计结论

DEV-011 代码能力可以进入 PR 准备；PR 前仍需在网络和浏览器可用环境补齐在线 audit 与真实响应式截图验收。
