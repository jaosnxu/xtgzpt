# Loop Intent Debt

意图债不是删除任务，而是记录没有完成的真实原因和恢复条件。

## 当前未清意图债

| ID | 日期 | 分类 | 原始意图 | 当前状态 | 恢复条件 |
| --- | --- | --- | --- | --- | --- |
| INTENT-001 | 2026-06-19 | external_switch | GitHub required checks 强制分支保护 | closed | 2026-06-19 已确认仓库为 public，`main` 已 protected，required checks 包含 `lint`、`typecheck`、`test`、`build-smoke`、`audit` |
| INTENT-002 | 2026-06-19 | tool_failure | 使用 `gh` CLI 创建 / 检查 PR | open | 本机安装并认证 `gh`，或继续使用 GitHub connector |
| INTENT-003 | 2026-06-19 | external_switch | 真实生产 secrets 与上线 smoke test | open | 生产环境、secrets、部署目标明确后配置 |
| INTENT-004 | 2026-06-19 | external_review_gate | 合并 PR 队列 `#28 → #29 → #31` | open | `#28` 已合并；`#29` 已切到 `main` 且 checks 通过，当前需要非 PR 作者 / 外部 reviewer 对 `#29` approving review 后恢复合并队列 |

## 记录模板

| ID | 日期 | 分类 | 原始意图 | 当前状态 | 恢复条件 |
| --- | --- | --- | --- | --- | --- |
| INTENT-XXX | YYYY-MM-DD | failure_type |  | open |  |
