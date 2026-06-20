# AUDIT-021 项目状态和生产准备审计

## 状态

- 状态：审计完成
- 日期：2026-06-20
- 审计对象：DEV-020 后项目目标、边界、技术标准、runtime memory、dev/audit 记录、生产风险和下一阶段优先级

## 审计范围

- 是否保持 `xtgzpt` 作为协同工作平台，而不是财务、ERP、采购、库存或经营报表系统。
- 是否保持冻结一级菜单、权限边界、AI 人工确认边界和生产上线禁令。
- DEV-001 到 DEV-020 的代码、文档、runtime memory 和 runbook 状态是否一致。
- 生产 runtime 持久化是否被错误声明为完成。
- required checks、review gate、Loop boot 和项目 runtime memory 是否能支撑下一轮 Loop 任务。
- 下一阶段是否应进入真实 PostgreSQL runtime adapter，或是否存在更高优先级前置项。

## Findings

### P0 / P1

未发现需要阻止下一阶段开发的 P0/P1 产品或安全问题。

已确认：

- `docs/PROJECT_CONSTITUTION.md` 仍明确项目定位为企业内部协同工作平台，并禁止扩张为 ERP、财务、采购、库存、销售、资产或经营报表系统。
- 普通业务用户一级菜单仍冻结为首页、我的工作台、项目、任务、聊天、知识库、合同、审批；系统设置仅管理员可见。
- AI 边界仍保持为分析、总结、提醒、建议、风险提示、草稿生成和权限过滤检索；AI 不能审批、发布、签署、付款、确认执行或改变正式状态。
- DEV-020 只声明 PostgreSQL adapter/cutover boundary，不声明 driver-backed PostgreSQL live writes 或生产切流完成。
- 生产上线仍被明确禁止，直到 production smoke、备份恢复演练、release signoff、真实 secrets 注入和生产部署完成。

### P2

发现并修正：

- `docs/BUSINESS_IMPLEMENTATION_PLAN.md` 中 DEV-015 / AUDIT-015 / DEV-016 / AUDIT-016 仍保留“当前沙箱无 Node/npm，需可用环境复核本地 gate”的旧状态。后续 PR/main 已持续通过 required checks，该总览口径容易误导 Loop 判断当前项目仍处在早期环境阻塞。
- `docs/dev-readiness/10_DEVELOPMENT_BACKLOG.md` 的 DR-011 和下一阶段说明仍停留在 DEV-020 边界阶段，没有把 AUDIT-021 后的下一步写清楚。
- `docs/loop/runtime-memory/project_status.md` 仍写当前阶段为 DEV-020 worktree，未体现 AUDIT-021 后状态和下一步。
- `docs/loop/runtime-memory/current_status.json` 仍停留在 DEV-020。

处理方式：

- 只更新文档和 runtime memory，不改应用代码、API、数据库 schema、前端 UI、权限、AI 行为、依赖、secrets 或部署配置。

## 保留风险

- 真实 driver-backed PostgreSQL runtime adapter 仍未完成。
- API runtime 仍未完成生产数据库 live writes、连接池、事务、数据迁移/回填、备份恢复演练和生产切流。
- 真实生产部署、生产 secrets 注入、production smoke、备份和隔离恢复演练、release signoff 仍未执行。
- 早期 dev-log 中保留的环境阻塞记录属于历史执行事实，不在 AUDIT-021 中改写；当前状态以本审计、项目宪法、技术标准、业务实施计划和 runtime memory 为准。

## 下一阶段判断

结论：下一阶段应进入 `DEV-021 real PostgreSQL runtime adapter`。

理由：

- DEV-020 已完成 mode selection、配置校验和 no-live-write boundary。
- 当前最大生产差距集中在 API runtime 仍未使用真实 PostgreSQL driver-backed store。
- 继续做 UI、菜单、业务模块或财务/ERP 扩张都会偏离当前项目边界。

DEV-021 应包含：

- PostgreSQL driver 和连接池。
- `RuntimeData` 从 PostgreSQL 读取和写入。
- 事务、checksum 或版本条件更新，避免并发覆盖。
- file runtime 到 PostgreSQL runtime 的迁移/回填和回滚策略。
- 单元测试、API smoke、migration/restore runbook 更新。

DEV-021 不应包含：

- 新业务模块。
- 财务系统逻辑。
- UI 菜单扩张。
- 生产 secrets 或真实生产写入。
- 未签字 release window 内的生产切流。

## 验证结果

已通过：

- `git diff --check`
- `current_status.json` JSON parse
- `TASK-XTGZPT-AUDIT-021-CODEX-1.json` JSON parse
- `action_log.jsonl` JSONL parse
- `run_history.jsonl` JSONL parse
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run smoke:api`
- `npm audit --audit-level=low`

## 审计结论

项目状态允许进入 DEV-021，但只允许进入真实 PostgreSQL runtime adapter 的受控实现阶段。项目仍未生产上线，仍不得扩张到财务/ERP/采购/库存/经营报表，也不得改变权限、审批或 AI 人工确认边界。
