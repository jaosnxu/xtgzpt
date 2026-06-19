# Loop Operating Rules

## 固定流程

1. 读取 `docs/loop/00_MEMORY_INDEX.md`
2. 读取当前阶段相关 PRD、backlog、权限、状态机、审计矩阵
3. 创建或确认 GitHub issue
4. 从最新 `main` 创建阶段分支
5. 实现当前阶段最小完整闭环
6. 运行自动验证
7. 运行 smoke 或浏览器/API 矩阵
8. 写入 dev-log
9. 创建 PR
10. 执行 reviewer gate
11. 合并
12. 创建 AUDIT 阶段
13. 审计后再进入下一开发阶段

## 状态记录

每个阶段必须有以下状态之一：

- `pending`
- `in_progress`
- `blocked`
- `retrying`
- `verified`
- `merged`
- `audited`

## 失败分类

- `network`
- `permission`
- `configuration`
- `code_error`
- `test_gap`
- `requirement_unclear`
- `production_risk`
- `tool_failure`
- `external_switch`

## 重试规则

- 网络错误可以自动重试
- 同一问题最多重试 3 次
- 3 次失败后进入 `docs/loop/02_INTENT_DEBT.md`
- 权限、登录、生产 secrets、仓库设置缺失，不继续乱跑，直接记录阻塞

## Gate 规则

开发阶段至少需要：

- `npm run ci`
- `npm run smoke`
- `npm audit --audit-level=low`
- `git diff --check`
- 对应 API 或浏览器矩阵

审计阶段至少需要：

- 复核上阶段日志
- 复核未完成边界
- 复核新增代码对应权限、状态机、审计
- 记录 blocker 和非 blocker 风险

## 禁止

- 禁止未记录失败就跳过
- 禁止把未完成能力写成完成
- 禁止直接在业务阶段混入平台大改
- 禁止无 issue、无日志、无验证合并
