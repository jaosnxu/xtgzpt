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
- 原型冻结话术规则

## 5. 当前未完成项

仍需继续补齐：

- 系统设置每个子模块的完整表单字段
- 角色切换演示
- 文件权限独立弹窗
- 更多 Figma 原型点击连线

## 6. 验证记录

已通过 Figma API 验证：

- `00 Phase Gate`：12 个主要 frame
- `01 Prototype Screens`：6 个主要 frame
- `02 Core Modules`：4 个主要 frame
- `03 States And Acceptance`：6 个主要 frame
- `04 Deep Flows`：6 个主要 frame
- `05 Edge States`：8 个主要 frame

合计：42 个主要 frame。

已添加第一批按钮连线：

- 首页进入合同风险确认
- 首页进入我的审批
- 审批查看来源合同
- 合同上传/粘贴进入修改与二次审查
- 合同二次审查进入审批
- 合同执行确认完成回到 1280 首页
- 审批退回修改回到合同上传/粘贴入口

## 7. 当前结论

Loop 已启动 Phase 1 原型执行。

当前原型可用于第一轮方向审查和主流程测试，但还不能冻结。

冻结前必须继续补齐未完成项，并由用户完成测试。
