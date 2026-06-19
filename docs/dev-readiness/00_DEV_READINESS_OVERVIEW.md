# DEV READINESS OVERVIEW

更新时间：2026-06-19

## 1. 本包目的

本目录是 xtgzpt 协同工作平台进入正式开发前的生产级补全包。

它不是新的 PRD，也不是代码实现，而是把已经冻结的产品目标、边界、页面、权限、AI、审计、状态机、验收标准转换成开发可以直接执行、测试可以直接验收、Loop 可以持续追踪的工程输入。

## 2. 唯一依据

开发必须同时遵守以下文件：

- `README.md`
- `PROJECT_INTAKE.md`
- `docs/PROJECT_CONSTITUTION.md`
- `docs/TECHNICAL_STANDARD.md`
- `docs/BUSINESS_IMPLEMENTATION_PLAN.md`
- `docs/TEST_ACCEPTANCE_STANDARD.md`
- `docs/00_PROJECT_MASTER_PACKAGE.md`
- `docs/01_GOVERNANCE_FREEZE_G000_G019.md`
- `docs/02_WIREFRAME_WF0_P001_P009.md`
- `docs/03_PROTOTYPE_HANDOFF_FIGMA.md`
- `docs/04_REVIEW_CHECKLIST.md`
- `docs/dev-readiness/*`

冲突处理顺序：

1. `docs/PROJECT_CONSTITUTION.md` 当前阶段、边界和禁止项优先
2. G000-G019 冻结规则优先
3. WF-0 / P001-P009 页面范围优先
4. 本目录用于落地补全，不得推翻冻结边界

## 3. 开发总目标

做一个企业内部协同工作平台，不做 ERP。

第一阶段目标：

- 让用户能在一个系统内完成工作入口、项目协同、任务协同、聊天协同、AI 知识问答、合同审查、人工审批、系统配置。
- 让 AI 成为辅助分析工具，不成为审批人、发布人、付款人、签署人、执行确认人。
- 让权限、文件、审计、AI 框架、页面状态在第一版就进入生产级标准。

## 4. 第一版一级菜单

普通业务用户只允许看到以下一级菜单：

1. 首页
2. 我的工作台
3. 项目
4. 任务
5. 聊天
6. 知识库
7. 合同
8. 审批

系统设置仅管理员可见，不属于普通用户一级菜单。

禁止新增以下一级菜单：

- 用户
- 文件中心
- 通知中心
- AI 中心
- 审计中心
- 报表中心
- 资产
- 库存
- 财务
- 采购
- 销售
- ERP 后台

## 5. 第一版必须坚持的边界

必须做：

- Web 响应式后台
- 角色、组织、权限、菜单、页面访问控制
- 项目、任务、聊天、知识库、合同、审批的协同闭环
- 合同上传/粘贴、AI 审查、风险清单、原文标红、A/B/C 方案、人工确认、二次审查、审批、执行跟踪
- AI 知识库问答，必须基于权限过滤后的来源
- 审批必须由人决策
- 所有关键动作必须审计
- 所有文件必须有权限

第一版不做：

- ERP
- 财务付款
- 采购库存
- 销售管理
- 自动合同签署
- AI 自动审批
- AI 自动发布知识
- AI 自动创建正式任务
- App / PWA / 原生移动端
- 对外客户门户

## 6. DEV READINESS 文件索引

- `../PROJECT_CONSTITUTION.md`：项目宪法
- `../TECHNICAL_STANDARD.md`：技术标准
- `../BUSINESS_IMPLEMENTATION_PLAN.md`：业务实现阶段计划
- `../TEST_ACCEPTANCE_STANDARD.md`：测试验收标准
- `01_DEVELOPMENT_PRD.md`：开发版 PRD
- `02_PERMISSION_MATRIX.md`：权限矩阵
- `03_OBJECTS_AND_STATE_MACHINES.md`：业务对象与状态机
- `04_API_DRAFT.md`：接口草案
- `05_AI_FRAMEWORK_SCHEMAS.md`：AI 框架与输出结构
- `06_AUDIT_LOG_MATRIX.md`：审计矩阵
- `07_PAGE_STATES_AND_RESPONSIVE.md`：页面状态与响应式规则
- `08_TEST_CASES_AND_ACCEPTANCE.md`：测试用例与验收
- `09_P0_P1_RISK_AUDIT.md`：P0/P1 风险审计
- `10_DEVELOPMENT_BACKLOG.md`：开发 backlog
- `11_PHASE_1_PROTOTYPE_GOVERNANCE.md`：第一阶段原型治理与冻结规则
- `12_PHASE_1_PROTOTYPE_EXECUTION_RECORD.md`：第一阶段原型执行记录
- `13_PHASE_1_DESIGN_QA_AUDIT.md`：第一阶段设计 QA 审计
- `14_PHASE_1_INTERACTION_TEST_REPORT.md`：第一阶段交互测试报告
- `15_PHASE_1_FREEZE_CONFIRMATION.md`：第一阶段原型冻结确认

## 7. 进入开发前的放行条件

只有同时满足以下条件，才允许进入代码开发：

- 第一阶段原型已经验收通过
- 用户明确确认原型冻结
- 一级菜单没有越界
- 权限矩阵完整
- 合同流程完整
- AI 禁止动作明确
- 审批人类决策明确
- 文件权限明确
- 审计矩阵完整
- 页面状态完整
- 响应式范围明确
- P0 风险已消除或有阻断标记

当前状态：

- Phase 1 原型已冻结。
- 用户已明确回复 `按这个原型进入开发`。
- 当前已进入代码开发，已完成 `DEV-001` 到 `DEV-008`。
- 当前仍禁止生产上线，直到生产上线验收门槛全部通过。

## 8. Loop 记录规则

本项目每次开发、变更、失败、阻塞、修复都必须进入仓库记录。

建议记录位置：

- issue：需求、任务、问题、阻塞
- PR：具体变更和审查
- docs：冻结规则、经验、标准
- changelog 或 release note：阶段结果

Loop 运行时必须先读取本目录，再决定下一步动作。

第一阶段必须先读 `11_PHASE_1_PROTOTYPE_GOVERNANCE.md`，不得跳过原型冻结直接进入正式代码开发。

当前 Phase 1 已由用户明确回复 `按这个原型进入开发`，冻结记录见 `15_PHASE_1_FREEZE_CONFIRMATION.md`。
