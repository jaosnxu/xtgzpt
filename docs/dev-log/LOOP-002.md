# LOOP-002 Platform Switch Verification

## Goal

确认 GitHub 平台开关已开启，避免 Loop 系统只依赖本地自检。

## Verification

- Repository: `jaosnxu/xtgzpt`
- Visibility: `public`
- Default branch: `main`
- `main` protection: enabled
- Required checks:
  - `lint`
  - `typecheck`
  - `test`
  - `build-smoke`
  - `audit`

## Result

`INTENT-001` 已关闭。

## Merge Queue Check

- Queue: `#28 → #29 → #31`
- `#28`: checks 全绿，`mergeable=true`
- Blocker: `mergeable_state=blocked`
- Branch protection: `main` requires 1 approving review
- Current reviews: only `COMMENTED`, no `APPROVED`
- Decision: do not self-approve or bypass reviewer gate
- Runner: `npm run loop:merge-queue -- --queue 28,29,31 --apply`
- Runner result: stopped at `#28` with GitHub `405`
- GitHub message: `At least 1 approving review is required by reviewers with write access.`

## Remaining Platform Debt

- `INTENT-002`: 本机未安装 / 未认证 `gh` CLI，当前继续使用 GitHub connector 与 local git。
- `INTENT-003`: 真实生产 secrets 与上线 smoke test 等生产目标明确后再开启。
- `INTENT-004`: PR 队列合并需要非作者 / 外部 reviewer approving review。
