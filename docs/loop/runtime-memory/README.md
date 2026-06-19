# Repository Memory

This directory is the durable memory spine for Loop Engineering.

Rules:
- Read this directory before planning or execution.
- Record every Loop stage result in `action_log.jsonl`.
- Persist repair queue state in `repair_queue.jsonl` with `open`, `claimed`, `resolved`, and `failed` rows.
- Keep project status, standards, decisions, integrations, and open questions current.
- Store reusable experience in `experience/successes.jsonl` and `experience/failures.jsonl`.
