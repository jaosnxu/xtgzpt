# Project Record

Purpose:
- xtgzpt is an internal collaborative work platform for projects, tasks, chat, knowledge, contracts, approvals, permissions, audit and AI-assisted drafts.

Current boundary:
- DEV-009 establishes the runtime business data persistence boundary and migration assets for current collaboration runtime objects.
- This phase covers projects, tasks, chat threads, chat messages, AI drafts, knowledge items, project memory, audit records and denied access events.
- Current implementation is local runtime file persistence plus PostgreSQL-compatible migration assets, not the final PostgreSQL adapter.

Deferred:
- PostgreSQL adapter, migration runner, connection pool, transactions, backups and restore.
- Production deployment, production data, secrets and production smoke.
- Contract and approval full closures, file binary storage and unrelated finance/ERP modules.
