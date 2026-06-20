# AUDIT-020 API runtime PostgreSQL adapter/cutover boundary 审计

## 状态

- 状态：审计完成，完整本地门禁已通过
- 日期：2026-06-20
- 审计对象：DEV-020 runtime store mode selection、PostgreSQL boundary、配置校验和文档更新

## 审计范围

- 是否保持测试 in-memory store。
- 是否保持 file runtime store 和 `XTGZPT_RUNTIME_DATA_FILE`。
- 是否允许通过 env 选择 PostgreSQL boundary。
- 是否在缺少 PostgreSQL 必需 env 时安全失败。
- 是否拒绝 placeholder、非 PostgreSQL URL 和不安全 identifier。
- 是否未写入真实生产数据、未提交真实 credentials。
- 是否未改变 UI、菜单、权限、审批或 AI 人工确认边界。
- 是否更新 runbook、标准、backlog、DEV-020、runtime memory 和 run summary。

## Findings

当前未发现 P0/P1 产品交付问题。

已确认：

- `resolveRuntimeStoreOptions` 支持 `memory`、`file`、`postgres`。
- `NODE_ENV=test` 默认 `memory`。
- 非测试默认 `file`，并继续支持 `XTGZPT_RUNTIME_DATA_FILE`。
- PostgreSQL mode 要求真实 `XTGZPT_RUNTIME_DATABASE_URL` 或 `DATABASE_URL`。
- PostgreSQL config validation 拒绝 placeholder、非 PostgreSQL URL 和不安全 schema/table identifier。
- `createPostgresRuntimeStore` 当前以 no-live-write 边界方式失败，未执行真实数据库写入。
- `.env.example` 只包含 placeholder。
- 新增 `0011_runtime_store_cutover_boundary.sql` 只创建 schema boundary，不包含生产数据。
- 未修改前端 UI、菜单、权限策略、审批节点处理逻辑或 AI 执行边界。

## 保留限制

- 当前 PostgreSQL adapter boundary 不是 driver-backed live persistence。
- 真实 PostgreSQL writes、连接池、事务、数据迁移/回填、备份恢复演练、production smoke、release signoff 和生产 cutover 仍未完成。

## 验证结果

已通过：

- `git diff --check`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run smoke:api`
- `npm audit --audit-level=low`

结果：

- `npm run test`：14 个测试文件、60 个测试通过
- `npm audit --audit-level=low`：0 vulnerabilities

## 审计结论

DEV-020 正确建立 API runtime PostgreSQL adapter/cutover boundary，并保留 file runtime store。当前变更没有执行生产写入、没有提交真实 secrets、没有改变权限或 AI 边界。项目仍不能声明 API 已完成真实 PostgreSQL production cutover。
