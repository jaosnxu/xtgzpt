# LOOP-003 External Loop System Boundary

## Goal

把可复用 Loop 平台能力从业务项目仓库移出，避免 `xtgzpt` 同时承担业务项目和 Loop 平台项目两种职责。

## Decision

- `xtgzpt` 只保存协同工作平台项目自己的代码、PRD、执行日志、审计记录和意图债。
- 可复用 Loop 平台能力统一放入独立仓库：`https://github.com/jaosnxu/tea-finance-loop-system`。
- 已在独立 Loop 仓库创建 runner PR：`https://github.com/jaosnxu/tea-finance-loop-system/pull/3`。

## Changes

- 删除项目内通用 merge queue runner。
- 删除 `package.json` 的 `loop:merge-queue` 脚本。
- 删除项目内 merge queue runner 说明文档。
- 新增 `docs/loop/05_EXTERNAL_LOOP_SYSTEM.md`，明确当前项目与 Loop 系统仓库边界。
- 更新 Loop 记忆索引和执行规则，禁止把可复用 Loop 平台代码放入业务项目仓库。

## Verification

- `npm run ci`
- `npm audit --audit-level=low`
- `git diff --check`

## Result

- `npm run ci`：通过
- `npm audit --audit-level=low`：0 vulnerabilities
- `git diff --check`：通过

## External Blocker

Loop 系统仓库 PR #3 受分支保护限制，仍需要 1 个有写权限账号 approve 后才能合入。
