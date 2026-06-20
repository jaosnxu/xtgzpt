# AUDIT-017 页面状态和响应式生产化审计

## 状态

- 状态：代码审计完成；外部 verifier gate 和 Browser DOM 验收通过
- 审计对象：DEV-017 页面状态和响应式生产化收口
- Loop 任务：`TASK-XTGZPT-DEV-017-CONTINUATION-CODEX-1`

## 审计范围

- 1440 / 1280 / 960 Web 办公宽度布局约束
- 长文本、badge、toolbar、卡片、列表和证据面是否避免明显重叠
- normal、empty、loading、no-permission、error、AI-generating、AI-failed、expired、archived 状态面是否复用统一组件
- 是否新增冻结外顶级菜单
- AI Framework / AI Runs 是否仍位于 System Settings 和来源对象相关表面
- AI 人工边界是否保持不变

## Findings

当前未发现 P0/P1 代码审计问题。

已确认：

- `apps/web/src/styles.css` 增加桌面内容宽度、侧栏宽度、1280 和 1100 断点约束；960 宽度仍保留左侧导航。
- 通用 row、panel、metric、badge、state notice 增加 `min-width: 0`、换行、截断、稳定高度和窄宽堆叠规则。
- Workbench 增加归档和过期状态提示。
- Chat 对归档会话显示 archived 状态，并禁用发送消息和 AI 草稿生成。
- Knowledge 增加发布权限提示和归档知识提示；AI 仍不能发布、驳回或归档知识。
- Contracts 增加 archived / completed 状态提示；AI 审查仍只能输出风险建议和标注。
- Approvals 增加 expired 状态提示；审批动作仍受当前人类节点和审批权限控制。
- Login 增加 loading / error 状态提示和提交中禁用。
- 未新增顶级菜单；`apps` 和 `packages` 未出现 `AI 中心` / `AI中心` 字符串。

## Verifier 结果

已通过：

- `git diff --check`
- `rg` 扫描 `AI Center` / 顶级 AI 菜单相关字符串，无匹配
- `npm run lint`
- `npm run typecheck`
- `npm run test`：14 个 test files / 56 个 tests
- `npm run build`
- `npm run smoke:api`：29 checks
- `npm audit --audit-level=low`：0 vulnerabilities
- Browser DOM 验收：Dashboard、Workbench、Projects、Tasks、Chat、Knowledge、Contracts、Approvals、System Settings、Login/menu flow

Browser DOM 验收结果：

- 当前 in-app Browser 可用的 1280 和 960 viewports 均无 horizontal overflow，且无 out-of-bounds elements。
- 请求的 1440 viewport 被当前 in-app Browser 约束为 1280。这是工具限制，不是产品失败；DEV-017 CSS 在 1440 office layout 内使用 1240 content max，1280 DOM 验收已覆盖该内容宽度约束。
- Browser CDP screenshot capture 超时；DOM 验证已通过。

## 非阻塞风险

### AUDIT-017-P2-001 当前 Browser 截图接口超时

影响：

- 无法保存截图证据。

处理：

- 已使用 DOM 验收替代截图验收，覆盖核心页面、宽度、横向溢出和元素出界检查。

## 审计结论

DEV-017 的代码变更保持在前端 UI/CSS 和状态提示范围内，未扩大业务范围，未新增一级菜单，未放宽 AI 人工边界。外部 verifier gate 和 Browser DOM 验收已通过；当前仅保留 Browser CDP screenshot capture 超时这一工具限制记录。
