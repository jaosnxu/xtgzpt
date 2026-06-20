# Project Status

Current source of truth:
- Repository: xtgzpt current managed worktree
- Current phase: DEV-020 API runtime PostgreSQL adapter/cutover boundary
- Active branch or PR: current DEV-020 Loop worktree
- Required gates: lint, typecheck, test, build-smoke, audit

Latest update:
- 2026-06-20 DEV-020 added runtime store mode selection: test `memory`, default/local `file`, and env-selected `postgres` boundary.
- DEV-020 preserved `XTGZPT_RUNTIME_DATA_FILE` file persistence and added PostgreSQL config validation with safe missing-env failure.
- DEV-020 added `packages/database/migrations/0011_runtime_store_cutover_boundary.sql` for the current `RuntimeData` JSON cutover document boundary.
- DEV-020 did not perform real production database writes, hardcode credentials, change UI/menus, or alter permission/AI boundaries.
- Local verifier passed `git diff --check`, `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`, `npm run smoke:api`, and `npm audit --audit-level=low`.
- Remaining external release gates: PR required checks, driver-backed PostgreSQL live writes/cutover, real production deployment, real production secrets injection and platform audit, production smoke, backup/restore drill, and release signoff.

Update this file whenever a project milestone changes.
