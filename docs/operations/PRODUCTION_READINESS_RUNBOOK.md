# PRODUCTION READINESS RUNBOOK

本文件是 `xtgzpt` 第一版生产上线准备 runbook。它只记录上线前检查、运维步骤和占位符配置，不包含真实密钥、真实生产 URL、真实数据库连接串或任何生产写入结果。

## 1. 使用边界

适用范围：

- 生产环境配置核对
- GitHub Secrets / Variables 占位符清单
- PostgreSQL 兼容 migration 执行前后检查
- 备份和恢复演练
- 日志、健康检查、smoke test、安全审计
- 回滚策略和 release signoff

禁止事项：

- 不在仓库提交 `.env`、`.env.local`、真实 secrets、真实生产 URL、私钥或 token
- 不在未签字 release window 内执行生产 migration、restore、delete、truncate、drop 或 deploy
- 不绕过权限、审计、审批或 AI 人工确认边界
- 不把 DEV-018 文档完成等同于已经生产上线

## 2. 发布前硬门槛

上线前必须全部满足：

| 类别 | 门槛 | 证据位置 |
| --- | --- | --- |
| CI | GitHub required checks `lint`、`typecheck`、`test`、`build-smoke`、`audit` 全绿 | PR checks |
| 本地 gate | `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`、`npm run smoke:api`、`npm audit --audit-level=low`、`git diff --check` | release checklist |
| 响应式 | 1440 / 1280 / 960 核心页面验收通过 | DEV-017 / release checklist |
| 权限 | 菜单、数据、操作、审批、文件、AI 权限矩阵通过 | release checklist |
| 审计 | 关键动作审计矩阵通过 | release checklist |
| 数据库 | migration 计划、备份、恢复演练和回滚/补偿方案完成 | 本 runbook |
| secrets | 生产 secrets 仅存在于 GitHub Secrets 或部署平台 secret store | GitHub / platform audit |
| smoke | 使用调用方提供的生产 base URL 和测试账号完成 production smoke | release checklist |
| signoff | 技术、产品、运维、安全负责人签字 | 本 runbook 第 13 节 |

任一 P0 失败时停止上线。

## 3. 配置清单

生产配置只能通过部署平台环境变量、服务器环境变量或 GitHub Secrets 注入。仓库只允许保留 `.env.example` 和占位符说明。

| 名称 | 类型 | 说明 | 示例值 |
| --- | --- | --- | --- |
| `NODE_ENV` | variable | 运行环境 | `production` |
| `APP_BASE_URL` | variable | Web 公开入口，占位符由环境提供 | `<PRODUCTION_WEB_BASE_URL>` |
| `API_BASE_URL` | variable | API 公开入口，占位符由环境提供 | `<PRODUCTION_API_BASE_URL>` |
| `DATABASE_URL` | secret | PostgreSQL 兼容数据库连接串 | `<PRODUCTION_DATABASE_URL>` |
| `DATABASE_MIGRATION_LOCK_ID` | variable | migration 锁标识，避免并发执行 | `<MIGRATION_LOCK_ID>` |
| `JWT_SECRET` | secret | 认证签名密钥 | `<PRODUCTION_JWT_SECRET>` |
| `ARK_API_KEY` | secret | 火山方舟 / 豆包 API key | `<ARK_API_KEY>` |
| `ARK_BASE_URL` | variable | AI provider API base URL | `<ARK_BASE_URL>` |
| `ARK_MODEL` | variable | AI provider model | `<ARK_MODEL>` |
| `ARK_AI_MAX_TOKENS` | variable | AI 单次最大输出 token | `<ARK_AI_MAX_TOKENS>` |
| `LOG_LEVEL` | variable | 日志级别 | `info` |
| `AUDIT_RETENTION_DAYS` | variable | 审计日志保留策略，按法规和公司制度确定 | `<AUDIT_RETENTION_DAYS>` |
| `BACKUP_BUCKET` | secret 或 variable | 数据库备份目标位置 | `<BACKUP_STORAGE_TARGET>` |

配置检查：

```bash
printenv NODE_ENV
printenv APP_BASE_URL
printenv API_BASE_URL
printenv LOG_LEVEL
```

不得在终端、CI log 或 issue 中打印 secret 值。需要确认 secret 是否存在时，只记录“已配置 / 未配置”。

## 4. GitHub Secrets 和 Variables 占位符

Repository 或 Environment 级配置：

| GitHub 名称 | 类型 | 必需 | 用途 |
| --- | --- | --- | --- |
| `PRODUCTION_DATABASE_URL` | Secret | 是 | migration、API 数据库连接 |
| `PRODUCTION_JWT_SECRET` | Secret | 是 | 生产认证签名 |
| `ARK_API_KEY` | Secret | 按 AI live gate 需要 | live Ark test 和生产 AI provider |
| `PRODUCTION_SMOKE_USERNAME` | Secret | 是 | production smoke 专用低权限测试账号 |
| `PRODUCTION_SMOKE_PASSWORD` | Secret | 是 | production smoke 专用低权限测试账号密码 |
| `PRODUCTION_SMOKE_ADMIN_USERNAME` | Secret | 是 | production smoke 专用管理员测试账号 |
| `PRODUCTION_SMOKE_ADMIN_PASSWORD` | Secret | 是 | production smoke 专用管理员测试账号密码 |
| `BACKUP_STORAGE_TOKEN` | Secret | 是 | 备份存储写入凭据 |
| `APP_BASE_URL` | Variable | 是 | Web base URL 占位符 |
| `API_BASE_URL` | Variable | 是 | API base URL 占位符 |
| `ARK_BASE_URL` | Variable | 按 AI live gate 需要 | AI provider base URL |
| `ARK_MODEL` | Variable | 按 AI live gate 需要 | AI model |
| `ARK_AI_MAX_TOKENS` | Variable | 否 | AI token 限制 |

配置规则：

- 生产 secrets 必须使用 GitHub Environments protection 或部署平台 secret store。
- Production environment 必须要求 reviewer approval。
- CI 输出不得 echo secret。
- smoke 账号必须是专用账号，权限覆盖普通员工和必要管理员路径，但不能使用真实员工账号。

## 5. 数据库 Migration

当前仓库的 PostgreSQL 兼容 migration 资产位于 `packages/database/migrations`：

- `0001_foundation.sql`
- `0002_permission_dimensions.sql`
- `0003_audit_log_infrastructure.sql`
- `0004_runtime_collaboration_records.sql`
- `0005_approval_permission_policies.sql`
- `0006_file_production_storage.sql`
- `0007_knowledge_productionization.sql`
- `0008_contract_closure.sql`
- `0009_approval_closure.sql`
- `0010_ai_framework_run_productionization.sql`

上线前确认：

- migration 在空库执行通过。
- migration 在当前生产快照副本执行通过。
- 破坏性变更有明确补偿方案；没有补偿方案不得上线。
- 审计日志表、文件元数据表、AI Run 表、合同表和审批表存在。
- migration 执行人、时间、commit SHA、数据库快照编号写入 release checklist。

生产执行模板：

```bash
export DATABASE_URL="<PRODUCTION_DATABASE_URL>"
export RELEASE_SHA="<GIT_COMMIT_SHA>"

psql "$DATABASE_URL" \
  --set ON_ERROR_STOP=on \
  --file packages/database/migrations/0001_foundation.sql

psql "$DATABASE_URL" \
  --set ON_ERROR_STOP=on \
  --file packages/database/migrations/0002_permission_dimensions.sql
```

按文件编号顺序继续执行到最新 migration。执行前必须先完成第 6 节备份。不得跳号执行。

执行后检查模板：

```bash
psql "$DATABASE_URL" --set ON_ERROR_STOP=on --command "\dt"
psql "$DATABASE_URL" --set ON_ERROR_STOP=on --command "select count(*) from audit_logs;"
```

禁止把上述命令输出中的连接串、用户名、主机名或敏感业务数据复制进仓库。

## 6. 备份和恢复

### 6.1 备份

备份必须在 migration 和 deploy 前执行。

```bash
export DATABASE_URL="<PRODUCTION_DATABASE_URL>"
export BACKUP_FILE="xtgzpt-<ENVIRONMENT>-<YYYYMMDDHHMMSS>-<GIT_COMMIT_SHA>.dump"

pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file "$BACKUP_FILE"
```

备份完成后必须记录：

- 备份文件名
- 备份开始和结束时间
- 备份大小
- 校验和
- 存储位置占位符
- 执行人

校验和模板：

```bash
shasum -a 256 "$BACKUP_FILE"
```

### 6.2 恢复演练

每次生产上线前必须在隔离恢复库演练一次恢复，不得直接在生产库演练。

```bash
export RESTORE_DATABASE_URL="<RESTORE_TARGET_DATABASE_URL>"
export BACKUP_FILE="<BACKUP_FILE>"

pg_restore "$BACKUP_FILE" \
  --dbname "$RESTORE_DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl
```

恢复后检查：

```bash
psql "$RESTORE_DATABASE_URL" --set ON_ERROR_STOP=on --command "select count(*) from audit_logs;"
psql "$RESTORE_DATABASE_URL" --set ON_ERROR_STOP=on --command "select count(*) from projects;"
psql "$RESTORE_DATABASE_URL" --set ON_ERROR_STOP=on --command "select count(*) from tasks;"
```

验收：

- 恢复库可连接。
- 关键表存在。
- 行数检查与备份时间点预期一致。
- 审计日志未丢失。
- 恢复演练结果写入 release checklist。

## 7. 日志和审计

运行日志要求：

- API 日志必须包含 request id、method、path、status、duration、actor id 或匿名状态。
- 错误日志不得包含 secret、完整 token、数据库连接串、私钥或敏感合同正文。
- `LOG_LEVEL=info` 为生产默认；临时 debug 必须有到期时间和负责人。

审计日志要求：

- 登录成功和失败、权限拒绝、关键业务状态变化、文件操作、AI 输出、合同和审批动作都必须写审计。
- 审计记录必须能回答 actor、time、object、action、result、reason、request id、是否涉及 AI、AI framework version。
- 审计日志不得通过普通删除流程清理；保留和归档按公司制度执行。

上线检查：

```bash
curl -fsS "<PRODUCTION_API_BASE_URL>/health"
```

在 smoke 后用具备审计权限的管理员账号检查：

- smoke 创建或读取的对象有审计记录。
- 权限拒绝有审计记录。
- AI 相关 smoke 如启用，记录 framework version。

## 8. 健康检查

API 健康检查：

```bash
curl -fsS "<PRODUCTION_API_BASE_URL>/health"
```

期望：

```json
{"status":"ok"}
```

健康检查失败处理：

1. 停止 release。
2. 检查部署版本、环境变量、数据库连接、应用日志。
3. 如 deploy 已切流，执行第 11 节 rollback。
4. 记录 incident 和 release checklist。

## 9. Production Smoke

production smoke 必须由调用方提供 base URL 和测试账号，仓库不得硬编码生产 host 或 credentials。

必测路径：

- `/health` 返回 ok。
- 普通员工登录后不能看到系统设置。
- 普通员工不能访问无权限对象。
- 管理员可以进入系统设置。
- 项目、任务、聊天、知识、文件、合同、审批核心只读或专用测试写入路径按 release window 执行。
- AI 输出仍为建议或草稿，不自动审批、发布知识、创建正式任务、签署、付款或确认执行。
- 关键动作审计可查询。

生产 smoke 写入规则：

- 默认只允许读和健康检查。
- 若必须执行写入，只能使用已批准的 smoke 专用组织、专用项目和专用账号。
- 写入对象必须带 `smoke` 原因或可识别标签。
- 写入后必须清理或归档，且保留审计。

命令模板：

```bash
export PRODUCTION_API_BASE_URL="<PRODUCTION_API_BASE_URL>"
export PRODUCTION_SMOKE_USERNAME="<PRODUCTION_SMOKE_USERNAME>"
export PRODUCTION_SMOKE_PASSWORD="<PRODUCTION_SMOKE_PASSWORD>"

curl -fsS "$PRODUCTION_API_BASE_URL/health"
```

当前仓库的 `npm run smoke:api` 是本地 API smoke。生产 smoke 需要 release operator 用生产 base URL 和外部注入 credentials 执行，不得把 credentials 写入脚本或仓库。

## 10. 安全和依赖审计

上线前必须运行：

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run smoke:api
npm audit --audit-level=low
git diff --check
```

安全检查：

- `npm audit --audit-level=low` 无未处置漏洞。
- PR diff 不包含 `.env`、`.env.local`、token、私钥、生产 URL 或生产 DB 连接串。
- GitHub required checks 全绿。
- Branch protection 已启用。
- Production environment approval 已启用。

secret 扫描建议：

```bash
git diff --check
git diff --cached --name-only
rg -n "BEGIN (RSA|OPENSSH|PRIVATE)|DATABASE_URL=.*://|JWT_SECRET=.+|ARK_API_KEY=.+" .
```

命令如命中占位符文档，reviewer 需要确认没有真实值。

## 11. 回滚策略

### 11.1 应用回滚

应用回滚优先使用上一个已签字 release artifact 或上一个稳定 commit。

记录：

- 当前 release SHA：`<CURRENT_RELEASE_SHA>`
- 回滚目标 SHA：`<ROLLBACK_RELEASE_SHA>`
- 回滚执行人：`<OPERATOR>`
- 回滚开始时间：`<TIMESTAMP>`
- 回滚完成时间：`<TIMESTAMP>`

回滚后必须执行：

```bash
curl -fsS "<PRODUCTION_API_BASE_URL>/health"
```

并补跑只读 smoke。

### 11.2 数据库回滚或补偿

数据库优先采用补偿 migration，避免直接恢复覆盖生产新写入。

允许恢复备份的条件：

- release window 内确认没有不可丢失的新生产写入，或业务负责人签字接受恢复点。
- 安全、技术、运维负责人共同确认。
- 已保留失败现场备份。

恢复模板见第 6.2 节。恢复生产库前必须先在隔离恢复库演练成功。

### 11.3 AI Provider 回退

如果 AI provider 异常：

- 保持核心人工流程可用。
- AI 接口允许失败分类和模板降级，但不得绕过人工确认。
- 记录 provider failure、request id、framework version。
- 不因 AI provider 失败自动改变合同、审批、知识或任务正式状态。

## 12. 运维交接清单

上线前交接：

- 当前 release SHA
- migration 文件列表和执行状态
- 备份文件名、校验和、恢复演练结果
- GitHub Secrets / Variables 已配置证明
- smoke 账号权限说明
- 健康检查地址占位符
- 日志入口占位符
- 告警入口占位符
- rollback 目标版本
- 当班负责人和升级联系人

上线后观察窗口：

- 前 30 分钟：持续观察 health、API 错误率、登录失败、权限拒绝异常、数据库连接错误。
- 前 2 小时：每 30 分钟复核错误日志、审计写入、AI provider failure。
- 前 24 小时：记录 P0/P1 事件和补救动作。

## 13. Release Signoff

签字前不得上线。

| 角色 | 姓名 | 结论 | 时间 |
| --- | --- | --- | --- |
| 产品负责人 | `<PRODUCT_OWNER>` | `<APPROVED / REJECTED>` | `<TIMESTAMP>` |
| 技术负责人 | `<TECH_LEAD>` | `<APPROVED / REJECTED>` | `<TIMESTAMP>` |
| 运维负责人 | `<OPS_OWNER>` | `<APPROVED / REJECTED>` | `<TIMESTAMP>` |
| 安全负责人 | `<SECURITY_OWNER>` | `<APPROVED / REJECTED>` | `<TIMESTAMP>` |
| Release Manager | `<RELEASE_MANAGER>` | `<APPROVED / REJECTED>` | `<TIMESTAMP>` |

最终结论：

- Release ID：`<RELEASE_ID>`
- Release SHA：`<GIT_COMMIT_SHA>`
- 是否允许上线：`<YES / NO>`
- 附加条件：`<CONDITIONS>`
