# xtgzpt

协同工作平台（协同软件 / 协调软件）项目仓库。

## 当前状态

本项目已完成：

- G000–G019 全局规则文件
- WF-0 全局框架 Wireframe 说明
- P001–P009 页面 Wireframe 说明
- Wireframe 页面总审计
- G018 原型工具制作交付标准
- G019 原型制作前最终冻结确认
- Phase 1 原型冻结
- DEV-001 到 DEV-015 代码阶段
- 项目宪法、技术标准、业务实现阶段和测试标准收口

当前允许进入：

- Phase 1 代码开发
- 数据库生产持久化
- API 生产实现
- 完整权限、文件、知识、合同、审批开发
- 本地质量门禁
- CI 检查

当前仍禁止进入：

- 生产上线
- 未经冻结确认的新一级菜单
- 新增端形态
- ERP 扩展

## 文档入口

完整项目资料已放入 `docs/`：

1. `docs/PROJECT_CONSTITUTION.md`：项目宪法
2. `docs/TECHNICAL_STANDARD.md`：技术标准
3. `docs/BUSINESS_IMPLEMENTATION_PLAN.md`：业务实现阶段计划
4. `docs/TEST_ACCEPTANCE_STANDARD.md`：测试验收标准
5. `docs/00_PROJECT_MASTER_PACKAGE.md`：项目全量总包
6. `docs/01_GOVERNANCE_FREEZE_G000_G019.md`：G000–G019 冻结规则总表
7. `docs/02_WIREFRAME_WF0_P001_P009.md`：WF-0 与 P001–P009 页面说明
8. `docs/03_PROTOTYPE_HANDOFF_FIGMA.md`：Figma / 原型工具制作交付标准
9. `docs/04_REVIEW_CHECKLIST.md`：审查清单与禁止项
10. `docs/dev-readiness/`：开发准备包、原型冻结记录、测试验收标准

## 项目定位

本系统是公司内部协同软件，不是 ERP。

普通用户一级菜单固定为：

1. 首页
2. 我的工作台
3. 项目
4. 任务
5. 聊天
6. 知识库
7. 合同
8. 审批

系统设置仅管理员可见。

## 核心边界

AI 只能分析、整理、提醒、建议、生成草稿，不能自动审批、发布、付款、签署、确认收货、确认执行完成或创建正式任务。

AI Provider 通过环境变量配置。公开仓库只提交 `.env.example`，真实 `ARK_API_KEY` 必须放在 `.env.local`、服务器环境变量或 GitHub Secrets 中，不能提交到 GitHub。

审批必须人工完成。

合同入口只保留：上传合同文件、粘贴合同文本。

第一版只做 Web 端响应式，不做独立移动端、App、PWA 或原生端。
