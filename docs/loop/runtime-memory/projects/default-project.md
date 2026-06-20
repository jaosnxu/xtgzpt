# Project Record

Purpose:
- xtgzpt is an internal collaborative work platform for projects, tasks, chat, knowledge, contracts, approvals, permissions, audit and AI-assisted drafts.

Current boundary:
- DEV-001 through DEV-020 are complete in the tracked project plan and dev/audit logs.
- AUDIT-021 project state and production readiness audit is complete.
- DEV-018 completed production readiness documentation, safe placeholder templates and release-operator checklists. It does not mean production deployment or cutover has happened.
- DEV-019 reconciles stale project memory/status after DEV-018 without changing product source, API, UI, database schema, permissions, AI execution boundaries, secrets, deployments, production writes or menus.
- DEV-020 adds runtime store mode selection, PostgreSQL config validation, a no-live-write PostgreSQL adapter boundary and `runtime_data_documents` migration boundary for the current `RuntimeData` JSON shape.
- Current implementation covers the local runtime file persistence boundary, PostgreSQL-compatible migration assets, contract closure, approval closure, file production storage, AI framework/run productionization, responsive page-state validation, production readiness documentation and API runtime cutover boundary.
- Current implementation is still not the final production runtime: the API has not completed driver-backed PostgreSQL live writes, connection pool, transactions, online backup/restore or production data cutover.
- Next recommended task is DEV-021 real PostgreSQL runtime adapter, without production cutover.

Deferred:
- Driver-backed PostgreSQL runtime writes, migration/backfill runner, connection pool, transactions, backups and restore.
- Production deployment, production data, secrets and production smoke.
- Real backup/restore drill, release signoff and real production secrets injection.
- Unrelated finance/ERP modules.
