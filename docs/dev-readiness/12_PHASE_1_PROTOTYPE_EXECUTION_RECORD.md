# PHASE 1 PROTOTYPE EXECUTION RECORD

更新时间：2026-06-18

## 1. 当前阶段

当前处于 Phase 1 原型确认阶段。

本阶段目标不是正式代码开发，而是完成可测试、可调整、可冻结的产品原型。

## 2. Figma 原型

Figma 文件：

https://www.figma.com/design/hN1gaidnnmvWUO3IgUwKYt

文件名称：

`xtgzpt Phase 1 Prototype - 协同工作平台`

## 3. 已完成页面

### 00 Phase Gate

用于说明阶段规则、冻结条件、普通用户一级菜单和 Loop 阶段流程。

主要 frame：

- `Phase 1 Cover / Prototype First`
- `Gate Rule`
- `Phase Scope`
- `Approved First-Level Navigation`
- `Required Phase Flow`

### 01 Prototype Screens

用于测试第一批核心页面。

主要 frame：

- `P001 首页 / 1440`
- `P002 我的工作台 / 1440`
- `P007 合同详情 / AI审查`
- `P008 审批详情 / 人工决策`
- `P009 系统设置 / 权限`
- `P007 合同详情 / 960 Narrow Browser`

### 02 Core Modules

用于测试项目、任务、聊天、知识库四个核心协同模块。

主要 frame：

- `P003 项目 / 列表与详情`
- `P004 任务 / 状态流转`
- `P005 聊天 / AI整理`
- `P006 知识库 / AI问答`

### 03 States And Acceptance

用于测试状态、权限、验收条件和冻结规则。

主要 frame：

- `States Cover`
- `合同状态闭环`
- `审批状态闭环`
- `全局页面状态`
- `角色可见性验收`
- `原型冻结确认`

### 04 Deep Flows

用于测试合同、审批、设置和标准办公宽度的深层流程。

主要 frame：

- `P007 合同 / 上传粘贴入口`
- `P007 合同 / 修改与二次审查`
- `P007 合同 / 执行跟踪`
- `P008 审批 / 列表与异常动作`
- `P009 设置 / 分模块`
- `P001 首页 / 1280 Standard`

### 05 Edge States

用于测试异常状态、权限失败、AI 失败和设置字段级配置。

主要 frame：

- `Edge States Cover`
- `项目异常状态`
- `任务异常状态`
- `聊天附件与关联对象`
- `知识审核与发布`
- `系统设置字段级配置`
- `AI 失败与权限阻断`
- `无权限页面模板`

### 06 QA Fixed Screens

用于修复第一轮 Design QA 发现的 P1 结构问题。

主要 frame：

- `QA FIX / 首页正式列表`
- `QA FIX / 审批正式列表`
- `QA FIX / 管理员设置导航`
- `QA FIX / Phase Scope checklist`

### 07 V2 Main Prototype

用于把 QA Fixed 标准应用到主流程页面，替代旧版伪表格页面。

主要 frame：

- `V2 / 首页工作台`
- `V2 / 项目与任务`
- `V2 / 聊天知识`
- `V2 / 合同闭环`
- `V2 / 审批闭环`
- `V2 / 管理员权限设置`
- `V2 State / 项目详情打开`
- `V2 State / 聊天AI整理完成`
- `V2 State / 知识草稿审核`
- `V2 State / 合同风险已确认`
- `V2 State / 审批处理状态`
- `V2 State / 权限保存状态`
- `V2 State / 权限取消状态`

### 08 Role And Settings Detail

用于补齐角色切换演示和系统设置字段级配置。

主要 frame：

- `Role switch demo`
- `Settings Detail / 组织管理`
- `Settings Detail / 角色管理`
- `Settings Detail / 权限管理字段`
- `Settings Detail / 流程配置`
- `Settings Detail / AI框架`
- `Settings Detail / 审计配置`
- `Settings State / 角色视图`
- `Settings State / 组织已保存`
- `Settings State / 角色已保存`
- `Settings State / 成员绑定`
- `Settings State / 审计编辑`

### 09 Test Evidence

用于保存 Phase 1 原型测试截图证据。

主要内容：

- `Loop Prototype Test Evidence`
- 25 张测试 frame 截图缩略图
- V2 主流程 32/32 链接 PASS 记录
- 设置详情 16/16 链接 PASS 记录

## 4. 已覆盖验收点

已覆盖：

- 普通用户 8 个一级菜单
- 系统设置仅管理员可见
- 首页不是经营大屏
- 我的工作台展示个人工作队列
- 项目不做 ERP 后台
- 任务支持 AI 草稿和人工确认
- 聊天支持 AI 整理，但不删除原消息
- 知识库是 AI 问答入口，不是传统文档库
- 合同支持 AI 审查、风险清单、原文标红、A/B/C 方案、人工确认、二次审查、审批、执行跟踪
- 审批必须人工决策
- AI 只做建议、草稿、分析
- AI 不自动审批、不自动发布知识、不自动创建正式任务
- 无权限、空状态、加载、错误、AI 生成中、AI 失败等页面状态
- 960 窄浏览器合同风险确认页面
- 1280 标准办公宽度首页
- 合同上传/粘贴入口
- 合同修改与二次审查
- 合同执行跟踪
- 审批列表和退回/转交/加签异常动作
- 系统设置分模块
- 第一批 Figma 原型点击连线
- 项目 Empty / NoPermission / Archived / AI Failed 状态
- 任务 Blocked / Overdue / Cancelled / Submitted 状态
- 聊天附件与关联对象
- 知识审核与发布状态
- AI permission_blocked / policy_blocked / network_error 状态
- 无权限页面模板
- 系统设置字段级配置
- QA 修复页：真实表格列、宽角色 badge、管理员设置导航、Phase Scope checklist
- V2 主流程：按 QA 标准重做首页、项目任务、聊天知识、合同、审批、管理员权限
- V2 文件权限弹窗
- V2 主流程点击连线
- 角色切换演示
- 设置详情：组织管理、角色管理、权限管理、流程配置、AI 框架、审计配置
- V2 主流程状态 frame
- 设置详情状态 frame
- V2 主流程 32/32 按钮有效连线
- 设置详情 16/16 按钮有效连线
- 截图证据已存入 `09 Test Evidence`
- 原型冻结话术规则

## 5. 当前未完成项

仍需继续补齐：

- 更多边缘状态点击连线

## 6. 验证记录

已通过 Figma API 验证：

- `00 Phase Gate`：12 个主要 frame
- `01 Prototype Screens`：6 个主要 frame
- `02 Core Modules`：4 个主要 frame
- `03 States And Acceptance`：6 个主要 frame
- `04 Deep Flows`：6 个主要 frame
- `05 Edge States`：8 个主要 frame
- `06 QA Fixed Screens`：4 个主要 frame
- `07 V2 Main Prototype`：13 个主要 frame
- `08 Role And Settings Detail`：12 个主要 frame
- `09 Test Evidence`：26 个主要 frame

合计：97 个主要 frame。

已添加第一批按钮连线：

- 首页进入合同风险确认
- 首页进入我的审批
- 审批查看来源合同
- 合同上传/粘贴进入修改与二次审查
- 合同二次审查进入审批
- 合同执行确认完成回到 1280 首页
- 审批退回修改回到合同上传/粘贴入口

已添加 V2 主流程连线：

- 首页处理合同风险 -> 合同闭环
- 首页查看审批 -> 审批闭环
- 首页确认 AI 草稿 -> 聊天知识
- 聊天任务草稿 -> 项目与任务
- 合同进入二次审查 -> 审批闭环
- 审批同意 -> 首页工作台
- 审批驳回 -> 合同闭环
- 审批退回修改 -> 合同闭环

最终交互覆盖验证：

- `07 V2 Main Prototype`：32 个按钮，32 个已连线，未连线 0
- `08 Role And Settings Detail`：16 个按钮，16 个已连线，未连线 0

## 7. 当前结论

Loop 已启动 Phase 1 原型执行。

V2 主流程已通过结构化审计：

- P1：0
- P2：0
- fake table spacing：0
- text width risk：0

角色与设置详情页已通过结构化审计：

- P1：0
- P2：0
- fake table spacing：0
- text width risk：0

设置详情已覆盖全部第一批后台模块：

- 组织管理
- 角色管理
- 权限管理
- 流程配置
- AI 框架
- 审计配置

当前原型可用于第一轮方向审查和主流程测试，但还不能冻结。

冻结前必须补齐更多边缘状态点击连线，并由用户完成测试。

主测页面交互已补齐；旧版页面仍作为历史过程页，不作为冻结测试入口。
