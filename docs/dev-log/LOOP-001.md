# LOOP-001 Loop 平台硬化

## 状态

- 状态：执行中
- 分支：`loop/001-platform-hardening`
- Issue：`https://github.com/jaosnxu/xtgzpt/issues/22`
- 前置：`AUDIT-005` 已合并到 `main`

## 范围

- GitHub Actions gate 拆分
- 依赖审计 gate
- smoke test 脚本
- DEV / AUDIT / BUG / INTENT-DEBT issue 模板
- PR 模板
- dev-log / audit-log Markdown 模板
- Loop memory index
- Intent debt 文件
- reviewer fallback checklist
- branch protection 配置说明

## 不做

- 不开发业务模块
- 不改项目 / 任务业务逻辑
- 不配置 GitHub 平台 required checks 开关，若无法由代码完成则记录为外部开关

## 当前执行记录

| 时间 | 动作 | 结果 |
| --- | --- | --- |
| 2026-06-19 | 创建 Issue #22 | 已完成 |
| 2026-06-19 | 创建分支 `loop/001-platform-hardening` | 已完成 |
| 2026-06-19 | 增加 smoke 脚本与 npm scripts | 已完成 |
| 2026-06-19 | 拆分 GitHub Actions gates | 已完成 |
| 2026-06-19 | 增加 Loop issue / PR / Markdown 模板 | 已完成 |
| 2026-06-19 | 增加 memory index / intent debt / reviewer fallback | 已完成 |
| 2026-06-19 | 首次 `npm run ci` | 失败，smoke 脚本缺 Node 全局声明 |
| 2026-06-19 | 首次 `npm run smoke` | 失败，dist ESM extension 无法解析 |
| 2026-06-19 | 修复 smoke 使用 `tsx` 动态导入源码入口 | 已完成 |
| 2026-06-19 | `npm run ci` | 通过 |
| 2026-06-19 | `npm run smoke` | 通过 |
| 2026-06-19 | `npm audit --audit-level=low` | 0 vulnerabilities |
| 2026-06-19 | `git diff --check` | 通过 |

## 验收标准

- `npm run ci` 通过
- `npm run smoke` 通过
- `npm audit --audit-level=low` 通过
- `git diff --check` 通过
- CI workflow 包含 lint/typecheck/test/build-smoke/audit gates
- Loop 模板与记忆索引存在
- 平台外部开关和工具缺失进入 intent debt

## 验证结果

自动验证：

- `npm run ci`：通过
- `npm run smoke`：通过
- `npm audit --audit-level=low`：0 vulnerabilities
- `git diff --check`：通过

Smoke 覆盖：

- health
- login
- project create
- project member visibility
- task status loop
- confirmation gate
- module status
- task audit

## 当前边界

已完成：

- GitHub Actions 拆分为 `lint`、`typecheck`、`test`、`build-smoke`、`audit`
- 本地 `npm run ci` 已包含 smoke gate
- `npm run smoke` 可独立跑核心 API 闭环
- Loop issue / PR / Markdown 模板已补
- memory index、intent debt、reviewer fallback 已补
- branch protection required checks 说明已补

未完成，不能假装已完成：

- GitHub required checks 平台开关仍需仓库设置确认
- 真实生产 secrets 与上线 smoke test 仍需生产环境信息

## 发现与处理

### LOOP-001-P2-001 smoke 脚本被 lint 拦截

现象：

- `npm run ci` 首次失败
- `scripts/smoke.mjs` 中 `process` 和 `console` 被 ESLint 标记为未定义

处理：

- 在脚本中声明 Node 全局
- 复测 `npm run ci` 通过

### LOOP-001-P2-002 直接导入 dist API 触发 ESM extension 问题

现象：

- `npm run smoke` 首次失败
- `packages/shared/dist/index.js` 导入 `./platform` 时 Node ESM 无法解析无扩展名路径

处理：

- `smoke:api` 改为使用 `tsx scripts/smoke.mjs`
- smoke 动态导入 `apps/api/src/index.ts`
- 在导入前设置 `NODE_ENV=test`，避免 API 自动监听端口
- 复测 `npm run smoke` 通过

## 下一步

- 创建 PR
- 合并后进入 AUDIT-LOOP-001
