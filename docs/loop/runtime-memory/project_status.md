# Project Status

Current source of truth:
- Repository: xtgzpt current managed worktree
- Current phase: DEV-022 release gate / production cutover audit completed
- Active branch or PR: current DEV-022 Loop worktree
- Required gates: lint, typecheck, test, build-smoke, audit

Latest update:
- 2026-06-20 DEV-022 completed release gate / production cutover audit documentation after DEV-021; repair/verifier reran full local gates successfully after the executor PATH issue.
- PostgreSQL mode uses `pg`, async runtime store lifecycle, RuntimeData document initialization/read/write and checksum conditional updates.
- Adapter failures and checksum conflicts fail loudly; no silent fallback to file or memory.
- file mode remains available and test default remains memory.
- Release readiness docs now require branch protection, required checks, production environment approval, secret-store evidence, backup/restore drill, production smoke, rollback target and signoff before cutover.
- The project remains an internal collaboration platform, not finance, ERP, procurement, inventory, sales, assets or reporting software.
- Freeze boundaries remain active: no new top-level menu, no production deployment, no real production writes, no AI automatic formal action, no permission/audit bypass.
- Next recommended task: external PR/release gate evidence collection; do not cut over production until signed release window.

Remaining external release gates:
- real production PostgreSQL cutover
- real production deployment
- real production secrets injection and platform audit
- production smoke
- backup/restore drill
- release signoff

Update this file whenever a project milestone changes.
