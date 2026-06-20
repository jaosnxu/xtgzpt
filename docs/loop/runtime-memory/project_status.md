# Project Status

Current source of truth:
- Repository: xtgzpt current managed worktree
- Current phase: DEV-021 real PostgreSQL runtime adapter completed
- Active branch or PR: current DEV-021 Loop worktree
- Required gates: lint, typecheck, test, build-smoke, audit

Latest update:
- 2026-06-20 DEV-021 upgraded the DEV-020 PostgreSQL runtime boundary into a driver-backed adapter.
- PostgreSQL mode now uses `pg`, async runtime store lifecycle, RuntimeData document initialization/read/write and checksum conditional updates.
- Adapter failures and checksum conflicts fail loudly; no silent fallback to file or memory.
- file mode remains available and test default remains memory.
- The project remains an internal collaboration platform, not finance, ERP, procurement, inventory, sales, assets or reporting software.
- Freeze boundaries remain active: no new top-level menu, no production deployment, no real production writes, no AI automatic formal action, no permission/audit bypass.
- Next recommended task: DEV-022 release gate / production cutover audit.

Remaining external release gates:
- real production PostgreSQL cutover
- real production deployment
- real production secrets injection and platform audit
- production smoke
- backup/restore drill
- release signoff

Update this file whenever a project milestone changes.
