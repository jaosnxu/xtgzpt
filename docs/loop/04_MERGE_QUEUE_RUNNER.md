# Loop Merge Queue Runner

本文件定义 PR 队列合并的固定执行方式，避免每个阶段靠临时命令和人工沟通。

## 命令

计划模式：

```bash
npm run loop:merge-queue -- --queue 28,29,31
```

执行模式：

```bash
npm run loop:merge-queue -- --queue 28,29,31 --apply
```

## 默认规则

- 默认目标 base：`main`
- 默认 merge method：`merge`
- 默认 required checks：
  - `lint`
  - `typecheck`
  - `test`
  - `build-smoke`
  - `audit`

## 环境变量

- `GITHUB_TOKEN` / `GH_TOKEN` / `GITHUB_PAT`：GitHub token
- 若未提供 token，脚本会读取本机 `git credential`
- `LOOP_PR_QUEUE`：队列，例如 `28,29,31`
- `LOOP_TARGET_BASE`：目标 base，默认 `main`
- `LOOP_REQUIRED_CHECKS`：逗号分隔的 required checks
- `LOOP_MERGE_METHOD`：`merge` / `squash` / `rebase`
- `LOOP_APPLY=1`：等同于 `--apply`

## 执行逻辑

1. 按队列顺序读取 PR
2. 如果 PR 已关闭，跳过并记录
3. 如果 PR base 不是目标 base，则自动切到目标 base
4. 检查 required checks 是否全绿
5. 检查 PR 是否可合并
6. 调用 GitHub merge endpoint
7. 成功后继续下一个 PR
8. 任一步失败则停止队列，并输出阻塞原因

## 阻塞处理

以下情况不得绕过：

- GitHub 分支保护要求 approving review
- GitHub 权限不足
- required checks 不全绿
- merge conflict
- 生产配置或 secrets 缺失

阻塞必须写入：

- `docs/loop/02_INTENT_DEBT.md`
- 对应 `docs/dev-log/*.md`
- 对应 PR 评论

## 当前队列

```bash
npm run loop:merge-queue -- --queue 28,29,31 --apply
```

当前已确认阻塞：

- PR `#28`
- GitHub 返回：`At least 1 approving review is required by reviewers with write access.`
- 记录：`INTENT-004`
