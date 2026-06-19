# External Loop System

本项目是业务项目仓库，不承载可复用 Loop 平台代码。

## 独立仓库

- Loop 系统仓库：`https://github.com/jaosnxu/tea-finance-loop-system`
- 当前用途：保存可复用的 Loop 规则、runner、skill、connector、sub-agent、memory spine 等平台能力
- 本项目用途：保存协同工作平台自身的 PRD、执行日志、审计记录、意图债和业务代码

## 当前边界

本项目可以保存：

- `docs/loop/00_MEMORY_INDEX.md`
- `docs/loop/01_OPERATING_RULES.md`
- `docs/loop/02_INTENT_DEBT.md`
- `docs/loop/03_REVIEWER_GATE_FALLBACK.md`
- `docs/loop/04_GITHUB_BRANCH_PROTECTION.md`
- `docs/dev-log/*.md`

本项目不再保存：

- 通用 merge queue runner 代码
- 通用 skill 加载器
- 通用 connector 框架
- 通用 sub-agent 框架
- 通用 memory spine 引擎

## 调用方式

在独立 Loop 系统仓库执行平台能力，再把结果写回本项目的 dev-log、audit-log 或 intent debt。

示例：

```bash
cd /path/to/tea-finance-loop-system
python3 scripts/merge_queue.py --repo jaosnxu/xtgzpt --queue 28,29,31 --apply
```

若独立 Loop 系统仓库的 runner PR 尚未合入 `main`，必须先完成该仓库自己的 reviewer gate。
