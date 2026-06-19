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

## Remaining Platform Debt

- `INTENT-002`: 本机未安装 / 未认证 `gh` CLI，当前继续使用 GitHub connector 与 local git。
- `INTENT-003`: 真实生产 secrets 与上线 smoke test 等生产目标明确后再开启。
