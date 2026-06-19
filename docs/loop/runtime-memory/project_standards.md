# Project Standards

Loop standards:
- Fixed workflow before autonomy.
- Each step has status, heartbeat, timeout, retry policy, review, and verification.
- Network failures can retry automatically.
- Code failures enter self-repair cycles before intent debt.
- Exhausted self-repair creates repair queue items for future automatic resume.
- Repair queue items must be schedulable, claimable, and closed as resolved or failed.
- Human intervention must go through approval requests, not informal chat-only approval.
- Tool policy must separate allowed tools, high-risk tools, and production writes.
- Eval cases and regression candidates must be used to prevent repeated platform failures.
- Auth, permission, production config, or unclear requirement failures become blocked intent debt.
- Writer, reviewer, and verifier gates must remain separate in records.
- Every action must be written outside conversation memory.
