# GitHub Branch Protection Required Checks

本仓库代码已提供 GitHub Actions gates，但 required checks 是 GitHub 仓库平台开关，不能只靠代码文件保证。

## 建议在 GitHub 设置

路径：

`Settings -> Branches -> Branch protection rules -> main`

建议开启：

- Require a pull request before merging
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Do not allow bypassing the above settings

建议 required checks：

- `lint`
- `typecheck`
- `test`
- `build-smoke`
- `audit`

## 当前状态

- 代码层已补 `.github/workflows/ci.yml`
- 平台层 required checks 需要仓库管理员确认
- 未配置前，Loop 必须在本地运行同等 gate 并记录结果
