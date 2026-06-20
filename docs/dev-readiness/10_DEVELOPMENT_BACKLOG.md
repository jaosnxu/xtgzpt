# DEVELOPMENT BACKLOG

## 1. 使用规则

本 backlog 是开发启动前的拆分，不是代码任务的唯一来源。

正式开发时，每个条目都应拆成 GitHub issue，并具备：

- 目标
- 范围
- 不做什么
- 验收标准
- 权限要求
- 审计要求
- 测试要求

## 2. P0 开发前任务

| 编号 | 任务 | 状态 |
| --- | --- | --- |
| DR-001 | 建立开发版 PRD | 已完成 |
| DR-002 | 建立权限矩阵 | 已完成 |
| DR-003 | 建立对象和状态机 | 已完成 |
| DR-004 | 建立接口草案 | 已完成 |
| DR-005 | 建立 AI 框架 schema | 已完成 |
| DR-006 | 建立审计矩阵 | 已完成 |
| DR-007 | 建立页面状态和响应式规则 | 已完成 |
| DR-008 | 建立测试和验收标准 | 已完成 |
| DR-009 | 建立 P0/P1 风险审计 | 已完成 |
| DR-010 | 启动 Phase 1 Figma 原型 | 已完成 |
| DR-011 | 建立项目宪法、技术标准、业务实现阶段和测试标准 | 已完成，DEV-019 继续做状态记忆对齐 |

## 3. 阶段顺序

正式代码开发前，必须先完成原型阶段。当前 Phase 1 原型已经冻结，代码开发已经启动。

阶段顺序：

1. PHASE-1 原型确认
2. PHASE-1-FREEZE 原型冻结
3. DEV-001 基础工程骨架
4. DEV-002 认证、账号、组织、角色、菜单权限
5. DEV-003 到 DEV-008 基础协同、AI 草稿、知识检索
6. DEV-009 之后进入生产持久化、完整权限、文件、知识、合同、审批和上线准备

没有用户明确回复“确认原型冻结”，不得启动 DEV-001。当前已满足该条件，冻结记录见 `docs/dev-readiness/15_PHASE_1_FREEZE_CONFIRMATION.md`。

## 4. 第一阶段原型任务

### PHASE-1 原型确认

范围：

- 可点击原型
- 一级菜单
- 页面结构
- 角色可见性
- 合同主流程
- 审批主流程
- AI 边界
- 页面状态
- 1440/1280/960 响应式

验收：

- 用户完成测试
- P0 问题为 0
- P1 问题已修复或进入 backlog
- 用户明确回复“确认原型冻结”

当前状态：

- 已创建 Figma 原型文件
- 已完成第一批页面、第二批核心模块、第三批状态矩阵、第四批深层流程
- 已完成第五批异常状态和权限失败页面
- 已完成 1440、1280、960 三种宽度的关键页面覆盖
- 已添加第一批 Figma 原型点击连线
- 已完成第一轮 Design QA，发现 P1 设计结构问题
- 已冻结，用户明确回复 `按这个原型进入开发`

当前 P1 修复任务：

- 修复伪表格空格排版：修复页已完成
- 修复设置页管理员导航：修复页已完成
- 修复文字溢出风险：修复页已完成
- 加宽角色 badge：修复页已完成
- 将长说明拆成分组结构：修复页已完成

下一步：

- 用 QA 修复标准替换旧版页面：V2 主流程已完成
- 补角色切换演示：已完成
- 补文件权限弹窗：V2 主流程已完成
- 补更多点击连线：V2 主流程已完成第一批

仍需补齐：

- 角色管理完整表单：已完成
- 审计配置完整表单：已完成
- V2 主流程完整交互：已完成，32/32 按钮已连线
- 设置详情完整交互：已完成，16/16 按钮已连线
- 截图证据保存：已完成，Figma `09 Test Evidence`
- 更多边缘状态点击连线：非冻结主入口，可后续补
- Phase 1 原型冻结：已完成，用户明确回复 `按这个原型进入开发`

下一阶段：

- 已完成 `DEV-001` 到 `DEV-018`
- 当前进入 `DEV-019` 项目记忆和状态文档对齐

## 5. 第一阶段代码开发顺序和当前状态

说明：

- 本节保留原开发拆分和当前完成状态。
- DEV-009 之后的生产级新顺序以 `docs/BUSINESS_IMPLEMENTATION_PLAN.md` 为准。
- 旧编号中的合同和审批闭环不再作为立即下一步；生产数据库、完整角色权限和审批权限维度已按新顺序推进，合同闭环和审批闭环顺延。

### DEV-001 基础工程骨架

状态：已完成。

范围：

- 前端工程
- 后端工程
- 数据库迁移
- 本地开发环境
- CI
- lint/test/build

验收：

- 本地可启动
- CI 可跑
- PR 必须检查通过

### DEV-002 认证、账号、角色、组织

状态：已完成。基础认证、账号、组织、菜单权限已在 DEV-002 落地，11 类 Phase 1 角色已在 DEV-010 补齐。

范围：

- 登录
- 用户
- 组织
- 角色
- 菜单权限
- 数据范围

验收：

- 普通用户看不到系统设置
- 管理员能配置组织和角色
- 系统管理员不默认拥有全部业务数据

### DEV-003 权限中间层

状态：已完成。统一权限中间层已落地，独立审批权限维度已在 DEV-010 补齐。

范围：

- 菜单权限
- 数据权限
- 操作权限
- 文件权限
- AI 权限

验收：

- 前端和后端都受权限控制
- URL 猜测访问无效
- 无权限访问写审计

### DEV-004 审计基础设施

状态：已完成基础设施。审计基础设施已落地，运行时持久化边界和 PostgreSQL 兼容迁移资产已在后续阶段补齐；真实生产数据库 adapter/cutover 仍不是已完成上线事实。

范围：

- AuditLog
- 对象审计查询
- 用户审计查询
- 关键动作接入

验收：

- 任一关键动作能追踪谁、何时、做了什么、结果如何

### DEV-005 项目和任务

状态：已完成基础闭环。项目和任务闭环已落地，运行时持久化、文件生产存储和审计资产已在后续阶段补齐。

范围：

- 项目列表/详情
- 项目成员
- 任务列表/详情
- 任务状态流转
- 评论和附件

验收：

- 项目任务闭环可跑通
- 状态和权限正确
- 审计完整

### DEV-006 聊天

状态：已完成聊天和 AI 草稿基础闭环。文件权限、AI Run 记录和运行时持久化边界已在后续阶段补齐。

范围：

- 会话
- 消息
- 附件
- 关联项目/任务/合同
- AI 整理入口

验收：

- 非成员无权限
- AI 整理有来源引用

### DEV-007 AI 框架与 AI Run

状态：已完成。AI 草稿人工确认入库已在 DEV-007 落地，完整 AI Framework / AI Run 生产治理已在 DEV-016 补齐。

范围：

- AI framework 配置
- AI Run 记录
- 失败分类
- 权限过滤

验收：

- 每个 AI 输出可追踪框架版本
- AI 不能越权读取来源

### DEV-008 知识库

状态：已完成。知识和项目记忆检索回用基础版本已落地，知识审核、版本、来源证据和本地全文检索已在 DEV-013 补齐；外部向量数据库仍不属于当前范围。

范围：

- AI 问答
- 权限来源检索
- 知识草稿
- 审核发布

验收：

- 无权限来源不进入 AI 输入
- AI 不能自动发布

### DEV-009 生产持久化底座

状态：已完成。本阶段完成运行时持久化边界和 PostgreSQL 兼容 migration 资产；真实 PostgreSQL adapter、连接池、事务、备份恢复和生产切流仍属生产发布外部门槛。

范围：

- API 运行时数据仓库
- 项目、任务、聊天、AI 草稿、知识、记忆和审计持久化边界
- 本地可验证的重启后数据读取
- PostgreSQL 生产表结构迁移
- 持久化回归测试
- 状态历史和拒绝访问事件的迁移资产

验收：

- 服务重启后项目、任务和审计不丢失
- 服务重启后聊天、消息、AI 草稿、知识和项目记忆不丢失
- 原有权限、AI 草稿、知识检索和 smoke 不回退
- 生产数据库表结构覆盖当前运行时对象
- 不直接写入生产环境
- `npm run ci` 通过；`npm audit --audit-level=low --offline` 通过
- PR 前需在真实 Git / 网络环境补跑 `git diff --check` 与在线 `npm audit --audit-level=low`

### DEV-010 角色和权限生产化

状态：已重定向为 `DEV-010 角色和权限生产化` 并已完成。审批闭环顺延至 `DEV-015`，不得在本阶段提前实现完整审批流。

范围：

- 11 类 Phase 1 角色进入共享模型、seed 用户和权限策略
- 权限摘要按菜单、数据、操作、审批、文件、AI 六个维度输出
- 审批权限独立为 `approval` 维度
- 新增审批权限 helper 和审批权限策略 API 输出
- 系统管理员保持配置范围，不默认拥有全部业务数据
- 普通用户访问系统设置和权限 API 被后端阻断并写拒绝审计
- 新增审批权限策略数据库迁移资产

验收：

- 11 类角色可登录测试
- 审批权限不再混在操作权限中
- 普通用户不能访问系统设置或权限 API
- 系统管理员不能默认读取未授权业务项目
- 拒绝访问事件可通过管理员权限查询

### DEV-011 我的工作台、通知和页面状态收口

状态：已完成。本阶段把首页和我的工作台改为角色感知的工作入口，并补齐系统内通知与核心页面状态；完整文件、合同和审批闭环继续留到后续阶段。

范围：

- `/workbench` API 汇总本人待办、我负责的任务、我参与的项目、AI 待确认结果、通知和页面状态
- 首页展示角色感知工作摘要，不再展示旧阶段门占位
- 我的工作台展示待办、负责任务、参与项目、待审批、待确认合同和待确认 AI 结果
- 系统内通知覆盖 pending work / approval / contract confirmation / AI result / no-permission / system status
- 核心页面显式展示 normal / empty / loading / no-permission / error / AI_Generating / AI_Failed / expired / archived 状态
- 管理员和普通用户按菜单、数据、操作、审批、文件、AI 权限看到不同内容
- CSS 对 1440 / 1280 / 960 可用宽度做响应式约束

验收：

- 普通用户能看到自己的待办、负责任务、参与项目、AI 待确认结果和通知
- 系统管理员能看到配置和权限上下文，但不默认获得普通用户业务项目
- AI 结果仍必须人工确认后才能入库
- 合同确认和审批实例不在 DEV-011 创建，页面只展示空状态和权限/边界
- `npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`、`npm run smoke:api`、`git diff --check` 通过
- `npm audit --audit-level=low --offline` 通过；在线 audit 需网络环境补跑

### DEV-012 文件生产存储

状态：已完成。本阶段建立文件元数据、版本、对象绑定、归档和权限继承边界；完整合同闭环、完整审批闭环、外部网盘和文件中心一级菜单继续禁止。

范围：

- 共享文件元数据、版本、对象绑定和预览/下载响应契约
- API 运行时持久化文件元数据、版本和对象绑定
- PostgreSQL 兼容迁移资产覆盖 `file_assets`、`file_versions`、`file_object_bindings`、`file_archive_events` 和审计文件字段
- `/files` 上传、按对象查询、元数据、预览、下载和归档接口
- 文件绑定既有项目、任务、聊天、知识和项目记忆对象
- 文件权限继承来源对象权限，并叠加文件维度的 view / preview / download / upload / archive / reference_ai
- 无权限预览、下载和 AI 引用返回非泄露错误，不返回文件名或敏感对象名
- 正式流程文件使用 locked / archived 状态表达作废，不提供物理删除
- 上传、绑定、预览、下载、归档、AI 引用和权限拒绝写审计
- 前端文件控件只出现在既有项目/任务页面组件内，不新增文件中心一级菜单

验收：

- 无权限用户不能预览或下载文件，错误响应不泄露文件名或对象名
- 上传同时创建元数据、版本和对象绑定记录
- 文件预览、下载、归档和 AI 引用权限均由后端校验
- 归档后文件不可继续预览或下载，审计保留
- AI 使用文件前必须通过当前用户文件权限检查
- 页面状态覆盖 normal / empty / loading / no-permission / error / archived / version history
- `npm run ci`、`npm audit --audit-level=low --offline`、`git diff --check` 通过
- 在线 `npm audit --audit-level=low` 需网络环境补跑

### DEV-013 知识库生产化

状态：已完成。本阶段把知识库从基础检索升级为审核、版本、证据和本地权限过滤检索；完整合同闭环、完整审批闭环、外部向量数据库、外部搜索服务和部署继续禁止。

范围：

- 知识状态支持 `draft`、`submitted_for_review`、`published`、`rejected`、`archived`
- AI 知识草稿人工确认后只进入 `submitted_for_review`，不得自动发布
- 知识管理员或具备发布权限的人类管理员执行发布、驳回和归档
- 知识版本记录 author、reviewer、version、status、timestamps 和 source evidence
- `/knowledge/items`、`submit-review`、`versions`、`publish`、`reject`、`archive` 和 `/knowledge/query` 接入真实 API
- 知识问答结果每条返回 source evidence
- 未发布、被驳回、已归档或无权限来源不进入检索、证据或 AI 输入上下文
- 搜索保持本地可测试全文检索，并文档化后续本地 vector adapter 策略
- PostgreSQL 兼容迁移资产新增 `0007_knowledge_productionization.sql`
- 前端知识库页面展示审核队列、版本历史、来源证据和发布/驳回/归档控件

不做：

- 不实现完整合同流程
- 不实现完整审批流程
- 不接外部向量数据库
- 不接外部搜索服务
- 不做部署或生产写入
- 不处理 secrets
- 不做财务模块、ERP 扩张、外部通知或移动 App
- 不允许 AI 自动发布知识、自动审批、自动创建正式任务或自动确认执行完成

验收：

- AI 知识草稿确认后状态为 `submitted_for_review`
- 发布前知识不进入 `/knowledge/query` 或 AI 草稿上下文
- 知识管理员发布后状态为 `published`，结果带 source evidence
- 驳回、创建新版本、发布、归档均写审计
- 归档知识不再进入检索或 AI 输入
- 无权限已发布知识不进入检索结果、source evidence 或 AI contextSourceIds
- `npm run ci`、`npm audit --audit-level=low --offline`、`git diff --check` 通过
- 在线 `npm audit --audit-level=low` 需网络环境补跑

## 6. 第一批建议 issue

建议创建以下 GitHub issue：

- `[PHASE-1] 可点击原型确认与冻结`
- `[DEV-001] 基础工程骨架与 CI`
- `[DEV-002] 认证、组织、角色、菜单权限`
- `[DEV-003] 统一权限中间层`
- `[DEV-004] 审计日志基础设施`
- `[DEV-005] 项目与任务闭环`
- `[DEV-006] 聊天与 AI 整理草稿`
- `[DEV-007] AI 框架配置与 AI Run`
- `[DEV-008] 知识库问答与发布审核`
- `[DEV-009] 生产持久化底座`
- `[DEV-010] 角色和权限生产化`
- `[DEV-011] 我的工作台、通知和页面状态收口`
- `[DEV-012] 文件生产存储`
- `[DEV-013] 知识库生产化`
- `[DEV-014] 合同闭环`
- `[DEV-015] 审批闭环`
- `[DEV-016] AI 框架中心和 AI Run 生产化`
- `[DEV-017] 全链路响应式和页面状态验收`
- `[DEV-018] 生产上线准备`
- `[DEV-019] DEV-018 后项目记忆和状态文档对齐`

### DEV-016 AI 框架中心和 AI Run 生产化

状态：已完成。本阶段将 AI Framework、Framework Version、AI Run、快照、来源证据、人工采纳/驳回/修改、失败分类和重试策略 metadata 接入生产化边界；前端只在既有系统设置、聊天、知识、合同等菜单内展示证据和配置，不新增 AI 一级菜单。

范围：

- AI Framework / Framework Version 共享模型、API 和运行时持久化边界
- AI Run、输入/输出快照、来源证据链接和人工决策记录
- 聊天 AI 草稿、知识问答、合同 AI 审查接入 AI Run
- AI Framework 配置权限和 AI Run 读取权限
- PostgreSQL 兼容迁移资产 `0010_ai_framework_run_productionization.sql`
- API 回归测试 `apps/api/src/ai-run-production.test.ts`

不做：

- 不接外部 agent、外部向量数据库或外部通知
- 不做财务、采购、库存、ERP、移动 App、部署、生产写入或 secrets
- 不允许 AI 自动审批、驳回、退回、转交、加签、发布知识、创建正式任务、签署、付款或确认执行

验收：

- AI Framework 配置只允许系统管理员或超级管理员
- AI Run 读取按 `read_ai_runs` 和来源对象权限过滤
- AI Run 有 framework、version、scenario、actor、organization、source ids、snapshot refs、context ids、status、failure class、retry policy metadata
- AI 输出人工确认、驳回、修改均有记录和审计
- 无权限读取 AI Run 不泄露输入、输出、来源证据或对象内容

### DEV-014 合同闭环

状态：已完成。本阶段完成合同上传/粘贴入口、版本、原文来源证据、AI 结构化风险审查、人工风险确认、修改后二次审查、审批边界提交和执行跟踪记录；完整审批引擎已在 `DEV-015` 接入。

范围：

- 合同入口只允许 `/contracts/upload` 和 `/contracts/paste`
- 合同版本记录原文、来源证据、入口方式、创建人和时间
- AI 审查输出风险清单、原文高亮、A/B/C 方案、framework version 和人工确认要求
- AI 不确认风险、不选择方案、不提交审批、不签署、不付款、不确认执行完成
- 人工风险确认必须逐项确认并选择 A/B/C 方案
- 修改合同后必须创建新版本并完成二次审查，才能提交审批边界
- 审批提交只生成 `approval_pending` 状态和 handoff/audit 记录，不实现审批节点流转
- 执行跟踪只记录 reminder / record / status_update 和审计
- 无权限用户不能读取合同正文、风险、来源证据或 AI 上下文
- 前端在既有合同一级菜单内展示入口、版本历史、AI 审查、风险确认、二次审查、审批边界和执行跟踪
- 新增 PostgreSQL 兼容迁移资产 `0008_contract_closure.sql`

不做：

- 不实现自动签署
- 不实现自动付款
- 不实现采购、库存、财务工作流
- 不实现完整审批引擎
- 不接外部 OCR、外部电子签章、外部通知
- 不做部署、生产写入、secrets、移动 App 或新一级菜单

验收：

- 上传或粘贴后生成合同和 v1 原文版本
- AI 审查返回风险、原文高亮和 A/B/C 方案，且所有风险初始为未确认、未选择方案
- 未人工确认风险不能提交修改或审批
- 修改版本未二次审查不能提交审批边界
- 审批边界提交不创建审批节点，不给出 approve/reject 结果
- 执行跟踪只写提醒/记录/状态和审计
- 无权限账号通过 URL 猜测合同详情或 AI 审查返回非泄露 404/403
- `npm run ci`、`npm audit --audit-level=low --offline`、`git diff --check` 通过；在线 audit 和浏览器截图需可用环境补跑

### DEV-015 审批闭环

状态：已完成。本阶段完成合同来源真实人工审批实例、节点、当前处理人、同意、驳回、退回、转交、加签、合同结果写回、工作台/通知集成、审计、权限安全详情 API、PostgreSQL 兼容迁移资产和既有审批菜单内前端工作区。

范围：

- `/contracts/:id/submit-approval` 创建 approval instance 并关联 handoff
- `/approvals`、`/approvals/:id`、同意、驳回、退回、转交、加签接口
- 当前节点处理人后端校验
- 非当前节点和无权限详情访问非泄露拒绝
- 合同审批通过写回 `approved`，驳回写回 `rejected`，退回写回 `revision_required`
- 工作台 pending approval 和系统内通知接入
- 前端审批工作区只放在既有“审批”一级菜单内
- 新增 PostgreSQL 兼容迁移资产 `0009_approval_closure.sql`

不做：

- 不实现财务、采购、库存、ERP 或付款流程
- 不实现外部通知、外部电子签章、外部 OCR、生产写入或部署
- 不实现 AI 自动审批、自动驳回、自动退回、自动转交、自动加签或让 AI 成为审批人
- 不新增一级菜单，不做移动 App

验收：

- 合同二次审查和人工确认后可创建真实审批实例
- 当前审批人可以查看和处理；非当前处理人不能处理
- 转交改变当前处理人，加签增加人工节点
- 同意、驳回、退回均写审计并写回合同
- 无权限用户不能通过审批详情 API 获得来源合同敏感信息
- 工作台展示当前节点待审批和通知
- `npm run ci`、`npm audit --audit-level=low --offline`、`git diff --check` 需在 Node/npm 可用环境补跑；当前沙箱无 `node`/`npm`

### DEV-017 全链路响应式和页面状态验收

状态：已完成。本阶段完成核心页面响应式、页面状态、长文本和既有菜单范围验收；未新增一级菜单、未改变业务权限或 AI 人工确认边界。

范围：

- Dashboard、Workbench、Projects、Tasks、Chat、Knowledge、Contracts、Approvals、System Settings 和 Login/menu flow
- 1440 / 1280 / 960 desktop layout 目标
- normal / empty / loading / no-permission / error / AI-generating / AI-failed / expired / archived 状态
- 长文本、badge、工具栏、侧边栏、证据面板和密集列表布局

验收：

- 外部 verifier 已记录本地 gate 通过。
- Browser DOM 验证覆盖当前可用 1280 和 960 viewports；1440 截图受当前 in-app browser 限制，但布局约束按 1440 office layout 设计。
- 无 AI Center 一级菜单，未新增冻结外一级菜单。

### DEV-018 生产上线准备

状态：已完成生产 readiness 文档和安全占位符，不等同于已经生产上线。

范围：

- `docs/operations/PRODUCTION_READINESS_RUNBOOK.md`
- `.env.example` 安全占位符
- DEV-018 / AUDIT-018 执行记录
- 配置、GitHub Secrets / Variables、migration、备份、恢复、日志、健康检查、production smoke、安全审计、回滚、运维交接和 release signoff 模板

不做：

- 不执行真实生产部署
- 不写入真实生产数据库
- 不提交真实 secret、真实生产 URL、生产数据库连接串、JWT secret、私钥或 token
- 不新增业务功能、权限、菜单、AI 执行边界、移动端或 ERP 范围

仍需外部完成：

- PR required checks
- 真实生产部署和切流
- 真实 production smoke
- 真实备份和隔离恢复演练
- release signoff
- 真实生产 secrets 注入和平台侧配置审计

## 7. 开发禁止事项

开发阶段继续禁止：

- 未冻结原型就启动正式代码开发
- 直接在 main 开发
- 不经过 PR 合并
- 不写审计
- 只做前端权限
- 让 AI 自动审批
- 让 AI 自动发布知识
- 新增冻结外一级菜单
- 做 ERP、财务、采购、库存
