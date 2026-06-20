# AUDIT-022 release gate / production cutover audit

## 状态

- 状态：审计完成；文档、parse gates 和本地 verifier gates 通过
- 日期：2026-06-20
- 审计对象：DEV-021 后 PostgreSQL runtime production cutover readiness、release gate 文档、runbook、env/secret posture、CI gate、backup/restore/smoke/rollback/signoff requirements

## 审计范围

- Runtime adapter readiness 是否与 DEV-021 实现一致。
- 环境配置是否只使用 placeholder，是否避免提交真实 secrets。
- GitHub workflow 是否定义 required check job 名称。
- Branch protection、review gate、production environment protection 是否被正确列为外部 release 证据。
- Backup / restore、file-to-postgres backfill、production smoke、rollback 和 signoff 是否有可执行模板。
- 项目文档是否避免声明生产切流已完成。

## Findings

### P0 / P1

未发现需要阻止进入 PR / release operator 外部复核的 P0/P1 文档或本地代码证据问题。本地 verifier gate 已通过，GitHub PR required checks 仍需在远端 CI 通过。

已确认：

- PostgreSQL runtime adapter 已具备 driver-backed `pg` 连接池入口、RuntimeData document 初始化/读取/写入和 checksum 条件更新。
- PostgreSQL adapter failure mode 是显式失败，不静默回退到 file/memory。
- file mode 仍保留，test 默认仍为 memory。
- `.env.example` 未包含真实生产 secrets。
- CI workflow 定义 `lint`、`typecheck`、`test`、`build-smoke`、`audit` job。
- Runbook 覆盖 backup、restore、file-to-postgres backfill、production smoke、rollback、handoff 和 signoff。
- 文档明确禁止把 DEV-022 等同于 production cutover。

### P2 / 外部证据缺口

- Branch protection 是否已实际启用无法从本地 worktree 证明，必须由 GitHub repository settings 或 PR evidence 提供。
- Production environment approval 和 secret store 配置无法从本地 worktree 证明，必须由 GitHub Environment 或部署平台 evidence 提供。
- Production smoke、真实备份和隔离恢复演练尚未执行，必须由 release operator 在签字 release window 内完成。
- 当前 API 仍使用 `dev-session` 进程内 session token；runbook 已明确 `JWT_SECRET` 当前不被 API 消费，不得把 JWT rotation 当作当前 runtime production signoff。

## 验证结果

已通过：

- `git diff --check`
- JSON / JSONL parse checks
- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run test`：14 个 test files / 64 tests
- `npm run build`
- `npm run smoke:api`：`ok: true`，29 个 smoke checks
- `npm audit --audit-level=low`：0 vulnerabilities

## 审计结论

DEV-022 通过文档、runtime-memory、structured-data 和本地 verifier gate 审计。项目可以进入 PR required checks、review gate 和 release operator 外部复核。

项目仍不得声明已经生产上线，也不得直接执行 production PostgreSQL cutover。真实 cutover 只有在 branch protection、required checks、review approval、production environment approval、生产 secrets 注入审计、备份和隔离恢复演练、production smoke、rollback 目标确认和 release signoff 全部完成后才可进入。
