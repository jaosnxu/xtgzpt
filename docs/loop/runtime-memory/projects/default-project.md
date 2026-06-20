# Project Record

Purpose:
- xtgzpt is an internal collaborative work platform for projects, tasks, chat, knowledge, contracts, approvals, permissions, audit and AI-assisted drafts.

Current boundary:
- DEV-001 through DEV-022 are complete in the tracked project plan and dev/audit logs.
- AUDIT-021 project state and production readiness audit is complete.
- DEV-018 completed production readiness documentation, safe placeholder templates and release-operator checklists. It does not mean production deployment or cutover has happened.
- DEV-019 reconciles stale project memory/status after DEV-018 without changing product source, API, UI, database schema, permissions, AI execution boundaries, secrets, deployments, production writes or menus.
- DEV-020 adds runtime store mode selection, PostgreSQL config validation, a no-live-write PostgreSQL adapter boundary and `runtime_data_documents` migration boundary for the current `RuntimeData` JSON shape.
- DEV-021 upgrades that boundary to a driver-backed PostgreSQL runtime adapter with `pg`, RuntimeData document initialization/read/write, checksum conditional updates and safe failure on read/write errors.
- DEV-022 completes release gate / production cutover audit documentation and keeps production cutover blocked until external GitHub/platform/operator evidence and signoff exist.
- Current implementation covers the local runtime file persistence boundary, driver-backed PostgreSQL runtime adapter, PostgreSQL-compatible migration assets, contract closure, approval closure, file production storage, AI framework/run productionization, responsive page-state validation and production readiness documentation.
- Current implementation is still not the final production runtime: the API has not completed real production cutover, online backup/restore or production smoke signoff.
- Next recommended task is external PR/release gate evidence collection and release window signoff; do not cut over production from the local worktree.

Deferred:
- Production PostgreSQL runtime cutover, migration/backfill operator, backups and restore.
- Production deployment, production data, secrets and production smoke.
- Real backup/restore drill, release signoff and real production secrets injection.
- Unrelated finance/ERP modules.
