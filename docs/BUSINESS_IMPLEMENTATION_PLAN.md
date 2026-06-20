# BUSINESS IMPLEMENTATION PLAN

本文件定义 `xtgzpt` 从当前 DEV-018 后状态走向受控生产发布的阶段计划。

## 1. 当前完成状态

已完成：

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| Phase 1 | 原型冻结 | 已完成 |
| DEV-001 | 基础工程骨架与 CI | 已完成 |
| DEV-002 | 登录、账号、组织、基础角色、菜单权限 | 已完成 |
| DEV-003 | 统一权限中间层 | 已完成 |
| DEV-004 | 审计日志基础设施 | 已完成 |
| DEV-005 | 项目与任务闭环 | 已完成 |
| DEV-006 | 聊天与 AI 整理草稿 | 已完成 |
| DEV-007 | AI 草稿人工确认入库 | 已完成 |
| DEV-008 | 项目记忆检索与回用 | 已完成 |
| AUDIT-008 | DEV-008 审计 | 已完成 |
| DEV-009 | 生产持久化底座 | 已完成，本地代码 gate 通过；在线 audit / Git metadata 需 PR 环境复核 |
| AUDIT-009 | DEV-009 审计 | 已完成 |
| DEV-010 | 角色和权限生产化 | 已完成，本地代码 gate 通过；在线 audit / Git metadata 需 PR 环境复核 |
| AUDIT-010 | DEV-010 审计 | 已完成 |
| DEV-011 | 我的工作台、通知和页面状态收口 | 已完成，本地代码 gate 通过；在线 audit / 浏览器插件需 PR 或可用环境复核 |
| AUDIT-011 | DEV-011 审计 | 已完成，本地代码审计通过；在线 audit / 浏览器插件需 PR 或可用环境复核 |
| DEV-012 | 文件生产存储 | 已完成，本地代码 gate 通过；在线 audit 需网络环境复核 |
| AUDIT-012 | DEV-012 审计 | 已完成，本地代码审计通过；在线 audit 需网络环境复核 |
| DEV-013 | 知识库生产化 | 已完成，本地代码 gate 通过；在线 audit 需网络环境复核 |
| AUDIT-013 | DEV-013 审计 | 已完成，本地代码审计通过；在线 audit 需网络环境复核 |
| DEV-014 | 合同闭环 | 已完成，本地代码 gate 通过；在线 audit / 浏览器验证需可用环境复核 |
| AUDIT-014 | DEV-014 审计 | 已完成，本地代码审计通过；在线 audit / 浏览器验证需可用环境复核 |
| DEV-015 | 审批闭环 | 已完成，后续 PR/main required checks 已通过；历史执行中的沙箱限制不再代表当前项目状态 |
| AUDIT-015 | DEV-015 审计 | 已完成，后续 PR/main required checks 已通过；历史执行中的沙箱限制不再代表当前项目状态 |
| DEV-016 | AI 框架中心和 AI Run 生产化 | 已完成，后续 PR/main required checks 已通过；历史执行中的沙箱限制不再代表当前项目状态 |
| AUDIT-016 | DEV-016 审计 | 已完成，后续 PR/main required checks 已通过；历史执行中的沙箱限制不再代表当前项目状态 |
| DEV-017 | 全链路响应式和页面状态验收 | 已完成，外部 verifier 已复核本地 gate 和浏览器 DOM 验证；1440 截图受当前 in-app browser 约束 |
| AUDIT-017 | DEV-017 审计 | 已完成 |
| DEV-018 | 生产上线准备 | 已完成生产 readiness 文档和安全占位符；真实生产部署、production smoke、备份恢复演练和 release signoff 仍需 release window 执行 |
| AUDIT-018 | DEV-018 审计 | 已完成，本地完整 gate 通过；待 PR required checks / release operator 执行外部门槛 |
| DEV-019 | DEV-018 后项目记忆和状态对齐 | 已完成，仅文档和 runtime memory 对齐 |
| AUDIT-019 | DEV-019 审计 | 已完成 |
| DEV-020 | API runtime PostgreSQL adapter/cutover boundary | 已完成 runtime store mode selection、PostgreSQL config validation、adapter boundary 和 migration boundary；真实 driver-backed writes / cutover 仍未执行 |
| AUDIT-020 | DEV-020 审计 | 已完成，本地 gate 全部通过 |
| AUDIT-021 | 项目状态和生产准备审计 | 已完成，确认下一阶段应进入 DEV-021 真实 PostgreSQL runtime adapter |

## 2. 总体阶段顺序

后续必须按以下顺序推进：

1. GOV-001 项目宪法和标准收口
2. DEV-009 数据库生产持久化
3. DEV-010 角色和权限生产化
4. DEV-011 我的工作台、通知和页面状态收口
5. DEV-012 文件生产存储
6. DEV-013 知识库生产化
7. DEV-014 合同闭环
8. DEV-015 审批闭环
9. DEV-016 AI 框架中心和 AI Run 生产化
10. DEV-017 全链路响应式和页面状态验收
11. DEV-018 生产上线准备
12. DEV-019 DEV-018 后项目记忆和状态对齐
13. DEV-020 API runtime PostgreSQL adapter/cutover boundary
14. AUDIT-021 项目状态和生产准备审计
15. DEV-021 真实 PostgreSQL runtime adapter

## 3. GOV-001 项目宪法和标准收口

目标：

- 建立唯一项目宪法。
- 固化技术标准。
- 固化业务实现阶段。
- 固化测试验收标准。
- 取消旧文档中已经过期的“禁止进入开发/API/数据库字段”口径。

范围：

- `docs/PROJECT_CONSTITUTION.md`
- `docs/TECHNICAL_STANDARD.md`
- `docs/BUSINESS_IMPLEMENTATION_PLAN.md`
- `docs/TEST_ACCEPTANCE_STANDARD.md`
- Loop memory index
- backlog 当前状态

验收：

- 文档能回答项目目标、技术、边界、阶段、验收。
- AI 边界必须写成明确硬规则。
- 当前实现差距被明确列出。

## 4. DEV-009 数据库生产持久化

目标：

- 把核心业务数据从内存数组迁移到数据库仓储层。

范围：

- 数据库连接配置
- migration 执行方式
- repository 层
- 项目持久化
- 任务持久化
- 聊天会话持久化
- 聊天消息持久化
- AI 草稿持久化
- 知识条目持久化
- 项目记忆持久化
- 审计日志持久化

不做：

- 合同完整闭环
- 审批完整闭环
- 文件二进制对象存储

验收：

- 服务重启后数据不丢。
- `npm run ci` 通过。
- repository 测试覆盖核心读写。
- smoke 覆盖项目、任务、聊天、AI 草稿、知识检索。
- 审计日志写入数据库。

## 5. DEV-010 角色和权限生产化

目标：

- 补齐 11 类角色。
- 补齐 6 类权限维度。
- 把审批权限独立出来。

范围：

- 角色模型扩展
- 权限策略表
- 菜单权限
- 数据权限
- 操作权限
- 审批权限
- 文件权限
- AI 权限
- 组织范围
- 项目范围
- 后台配置读取

不做：

- 复杂组织审批自动路由
- 外部身份系统

验收：

- 11 类角色都可配置和登录测试。
- 审批权限不再混在操作权限里。
- 普通用户不能访问系统设置。
- 系统管理员不默认拥有全部业务数据。
- 无权限访问写审计。

## 6. DEV-011 我的工作台、通知和页面状态收口

目标：

- 首页和我的工作台真正成为工作入口。
- 补全系统内通知和各页面状态。

范围：

- 我的待办
- 我负责的任务
- 我参与的项目
- 我待审批
- 我待确认合同
- 我待确认 AI 结果
- 系统内通知
- empty/loading/error/no-permission/archived/expired 状态

验收：

- 普通用户进入系统能看到自己要处理什么。
- 管理员和普通用户看到不同工作台。
- 页面不再只是技术阶段展示。

## 7. DEV-012 文件生产存储

目标：

- 建立文件元数据、权限、版本和存储策略。

范围：

- 文件上传
- 文件元数据表
- 文件绑定业务对象
- 预览权限
- 下载权限
- 版本记录
- 归档
- AI 引用文件权限校验

不做：

- 文件中心一级菜单
- 外部网盘

验收：

- 无权限用户不能下载文件。
- 文件名不通过错误信息泄露。
- 正式流程文件不允许物理删除。
- 上传、预览、下载、归档都写审计。

当前状态：

- 已完成。
- 文件元数据、版本、对象绑定、归档状态和 AI 引用权限检查已进入共享模型与 API。
- PostgreSQL 兼容迁移资产新增 `0006_file_production_storage.sql`。
- 文件控件只出现在既有项目/任务页面组件内，未新增文件中心一级菜单。
- 本地 `npm run ci`、`npm audit --audit-level=low --offline`、`git diff --check` 通过。
- 在线 `npm audit --audit-level=low` 因当前环境无法解析 `registry.npmjs.org` 阻塞，需 PR / 网络环境补跑。

## 8. DEV-013 知识库生产化

目标：

- 从当前知识和记忆检索升级为生产知识库。

范围：

- 知识审核流
- 知识版本
- 发布、驳回、归档
- 知识问答
- 来源证据
- 权限过滤
- 全文检索或向量检索技术选型

验收：

- AI 不能自动发布知识。
- 知识管理员审核后才发布。
- 问答结果必须显示来源。
- 无权限来源不进入 AI 输入。

当前状态：

- 已完成。
- 知识状态支持 `draft`、`submitted_for_review`、`published`、`rejected`、`archived`。
- AI 知识草稿确认只进入 `submitted_for_review`，必须由知识管理员或具备发布权限的人类管理员发布。
- 知识版本记录 author、reviewer、version、status、timestamps 和 source evidence。
- 发布、驳回、归档、创建版本和知识问答均写审计。
- 知识问答每条结果返回 source evidence，且未发布、被驳回、已归档或无权限来源不进入检索、证据或 AI 输入上下文。
- 搜索保持本地可测试全文检索；外部向量数据库和外部搜索服务不在 DEV-013 范围。
- 本地 `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`、`npm run smoke:api`、`npm run ci`、`npm audit --audit-level=low --offline`、`git diff --check` 通过。
- 在线 `npm audit --audit-level=low` 因当前环境无法解析 `registry.npmjs.org` 阻塞，需 PR / 网络环境补跑。

## 9. DEV-014 合同闭环

目标：

- 完成合同风险审查和执行跟踪闭环。

范围：

- 合同上传
- 合同文本粘贴
- 合同版本
- AI 结构化审查
- 风险清单
- 原文标红
- A/B/C 方案
- 人工确认风险
- 修改后二次审查
- 提交审批
- 执行跟踪
- 合同审计

不做：

- 自动签署
- 自动付款
- 采购/库存/财务系统

验收：

- 合同必须走人工确认。
- 合同未二次审查不能进入后续审批。
- AI 只能建议，不能选择方案。
- 全流程状态和审计完整。

当前状态：

- 已完成。
- 合同入口只支持上传合同文本或粘贴合同文本，未新增文件中心或其他一级菜单。
- 合同版本记录原文、来源证据、录入方式、创建人和时间。
- AI 结构化审查返回风险清单、原文高亮、A/B/C 方案、framework version 和 `next_required_action=human_confirm_risks`。
- AI 不确认风险、不选择 A/B/C 方案、不提交审批、不改变正式业务结果。
- 风险必须由具备权限的人类账号确认并选择方案；首次确认后进入修改，修改版本必须二次审查。
- DEV-014 中提交审批只生成 `approval_pending` 状态、审批边界 handoff 记录和审计；DEV-015 已在此 handoff 后创建真实审批实例。
- 执行跟踪只记录提醒、事项、状态和审计，不做自动签署、付款、外部通知或执行完成确认。
- 无权限用户通过列表、详情或 AI 审查接口不能读取合同正文、风险、来源证据或 AI 上下文。
- PostgreSQL 兼容迁移资产新增 `0008_contract_closure.sql`。
- 本地 `npm run typecheck`、`npm run test`、`npm run build`、`npm run smoke:api` 已通过；完整 `npm run ci`、audit 和 git diff 结果见 `docs/dev-log/DEV-014.md`。

## 10. DEV-015 审批闭环

目标：

- 建立人类审批工作台。

范围：

- 发起审批
- 审批模板
- 节点
- 当前处理人
- 同意
- 驳回
- 退回修改
- 转交
- 加签
- AI 审批建议
- 审批历史
- 结果写回来源对象

不做：

- AI 自动审批
- 自动付款
- 外部通知

验收：

- 当前节点审批人才能处理。
- AI 不是审批人。
- 转交、加签、退回必须记录原因。
- 审批结果必须写回来源对象。

当前状态：

- 已完成。
- 合同提交审批会创建真实人工 approval instance，handoff 记录关联 approval id。
- 当前节点从法务到财务再到业务审批人，处理人必须是人类账号。
- 同意、驳回、退回、转交、加签接口均校验当前节点处理人和审批权限。
- 同意最终节点写回合同 `approved`；驳回写回 `rejected`；退回写回 `revision_required`。
- 我的工作台和系统内通知展示当前节点待审批。
- 审批详情 API 对无权限账号返回非泄露 404。
- 前端审批工作区只放在既有“审批”一级菜单内。
- PostgreSQL 兼容迁移资产新增 `0009_approval_closure.sql`。
- 后续 PR/main required checks 已通过；历史执行中的沙箱限制不再代表当前项目状态。

## 11. DEV-016 AI 框架中心和 AI Run 生产化

目标：

- 把当前 AI Provider 和草稿能力升级为可治理 AI 框架中心。

范围：

- AI Framework
- AI Framework Version
- AI Run
- 输入快照
- 输出快照
- 来源证据
- 采纳、驳回、修改记录
- 失败分类
- 重试策略
- 框架配置权限
- AI Run 读取权限
- PostgreSQL 兼容迁移
- 前端证据和配置展示只在既有菜单内

验收：

- 每次 AI 输出可追踪框架、版本、来源、结果。
- 同一 framework version 输出结构稳定。
- AI 失败有分类和审计。
- AI Framework 配置只允许系统管理员或超级管理员。
- AI Run 读取必须继承来源对象权限。
- AI 输出采纳、驳回、修改必须由人类账号记录。

当前状态：

- 已完成。
- 新增 AI Framework、Framework Version、AI Run、输入/输出快照、来源证据链接和人工采纳/驳回/修改记录。
- 聊天 AI 草稿、知识问答和合同 AI 审查接入 AI Run。
- AI Framework 配置只在既有“系统设置”内展示；AI Run 证据只在系统设置和既有业务页面中展示，未新增 AI 一级菜单。
- 新增 PostgreSQL 兼容迁移资产 `0010_ai_framework_run_productionization.sql`。
- 新增 `apps/api/src/ai-run-production.test.ts`。
- 后续 PR/main required checks 已通过；历史执行中的沙箱限制不再代表当前项目状态。

## 12. DEV-017 全链路响应式和页面状态验收

目标：

- 把所有核心页面补到可交付 UI/UX 标准。

范围：

- 1440
- 1280
- 960
- 首页
- 我的工作台
- 项目
- 任务
- 聊天
- 知识库
- 合同
- 审批
- 系统设置

验收：

- 每个宽度都能完成核心任务。
- 文案不溢出。
- 俄文长度不破坏布局。
- 无权限、空、错误、加载、AI 中状态都可见。

当前状态：

- 已完成。
- Dashboard、Workbench、Projects、Tasks、Chat、Knowledge、Contracts、Approvals、System Settings 和 Login/menu flow 已完成页面状态和响应式收口。
- 外部 verifier 已记录 `git diff --check`、无 AI center 一级菜单扫描、`npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`、`npm run smoke:api`、`npm audit --audit-level=low` 通过。
- Browser DOM 验证覆盖当前可用 1280 和 960 viewports；请求的 1440 viewport 受当前 in-app browser 限制约束到 1280，但 CSS/content max-width 仍按 1440 office layout 设计。

## 13. DEV-018 生产上线准备

目标：

- 达到第一版生产上线门槛。

范围：

- 生产环境配置
- GitHub Secrets
- 数据库备份
- 日志
- 健康检查
- smoke test
- 安全审计
- 回滚策略
- 运维说明

验收：

- 生产 smoke test 通过。
- 生产密钥不在仓库。
- 数据可备份和恢复。
- P0 测试为 0 失败。

当前状态：

- 已完成生产上线准备材料，不等同于已经生产上线。
- `docs/operations/PRODUCTION_READINESS_RUNBOOK.md` 已覆盖配置、GitHub Secrets / Variables、migration、运行数据备份、恢复演练、日志、健康检查、production smoke、安全审计、回滚、运维交接和 release signoff。
- `.env.example` 仅保留 placeholder，未提交真实 secret、真实生产 URL、生产数据库连接串、JWT secret、私钥或 token。
- DEV-018 本地 gate 已通过：`git diff --check`、secret 占位符检查、`npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`、`npm run smoke:api`、`npm audit --audit-level=low`。
- 真实生产部署、真实 production smoke、真实备份和隔离恢复演练、真实生产 secrets 注入、release signoff 和 PR required checks 仍是外部门槛。

## 14. DEV-019 DEV-018 后项目记忆和状态对齐

目标：

- 修复 DEV-018 后项目状态和 runtime memory 的 stale 记录。

当前状态：

- 已完成。
- 仅修改 docs 和 runtime memory。
- 未修改业务源代码、API、UI、数据库 schema、权限、AI 执行边界、secrets、部署、生产写入或菜单。

## 15. DEV-020 API runtime PostgreSQL adapter/cutover boundary

目标：

- 在不执行真实生产写入的前提下，建立 API runtime store mode selection 和 PostgreSQL cutover boundary。

范围：

- 测试默认 in-memory runtime store。
- 本地和非测试默认 file runtime store，并继续支持 `XTGZPT_RUNTIME_DATA_FILE`。
- 生产可通过 `XTGZPT_RUNTIME_STORE_MODE=postgres` 选择 PostgreSQL runtime boundary。
- PostgreSQL runtime config validation：`XTGZPT_RUNTIME_DATABASE_URL` 或 `DATABASE_URL`、schema、table、document id。
- 新增 `0011_runtime_store_cutover_boundary.sql`，建立当前 `RuntimeData` JSON shape 的 cutover document 表边界。
- 聚焦测试覆盖 mode resolution、file fallback、PostgreSQL config validation 和 missing-env failure。

不做：

- 不连接真实生产数据库。
- 不写入真实生产数据。
- 不提交真实数据库 credentials。
- 不重写 API endpoint、权限、AI 边界或 UI。
- 不执行生产 cutover、备份恢复演练或 release signoff。

当前状态：

- 已完成 code/docs boundary。
- PostgreSQL adapter 当前以安全失败方式阻止 live write，避免误把 boundary 当成真实生产切流。
- 后续仍需 driver-backed PostgreSQL adapter、连接池、事务、数据迁移/回填、备份恢复演练和生产 cutover signoff。

## 16. AUDIT-021 项目状态和生产准备审计

目标：

- 在进入 DEV-021 前确认项目目标、边界、技术标准、runtime memory、dev/audit 记录和生产风险一致。

范围：

- 项目宪法、技术标准、业务实施计划、测试标准。
- DEV-001 到 DEV-020 的 dev-log 和 audit-log。
- runtime memory 当前状态、项目状态、run history 和 action log。
- 生产上线 runbook 和剩余 release gate。

不做：

- 不新增业务功能。
- 不修改应用源代码、API、数据库 schema、UI、菜单、权限、AI 行为、依赖、secrets 或部署。

当前状态：

- 已完成。
- 未发现阻止下一阶段开发的 P0/P1 问题。
- 已修正总览和 runtime memory 中的陈旧状态口径。
- 确认下一阶段应进入 DEV-021 真实 PostgreSQL runtime adapter。

## 17. DEV-021 真实 PostgreSQL runtime adapter

目标：

- 将 DEV-020 的 PostgreSQL boundary 升级为真实 driver-backed runtime persistence，但仍不执行真实生产切流。

范围：

- PostgreSQL driver 和连接池。
- `RuntimeData` 从 PostgreSQL 读取和写入。
- 事务、checksum 或版本条件更新，避免并发覆盖。
- file runtime 到 PostgreSQL runtime 的迁移/回填和回滚策略。
- 单元测试、API smoke、migration/restore runbook 更新。

不做：

- 不新增业务模块。
- 不扩展财务、ERP、采购、库存、销售或经营报表系统。
- 不新增一级菜单。
- 不提交真实生产 secrets。
- 不在未签字 release window 内执行真实生产写入或生产切流。

验收：

- `XTGZPT_RUNTIME_STORE_MODE=postgres` 可在测试数据库或本地 PostgreSQL 替身环境完成真实读写。
- file mode 仍可用，且测试默认仍为 memory。
- PostgreSQL 写入失败必须安全失败，不得静默回退导致数据分叉。
- 迁移/回填/回滚文档明确。
- `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`、`npm run smoke:api`、`npm audit --audit-level=low` 和 `git diff --check` 全部通过。
