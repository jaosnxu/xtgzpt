# AUDIT-023 前端交互层产品化审计

## 状态

- 状态：审计完成；verifier 已补跑完整本地 gate
- 日期：2026-06-20
- 审计对象：DEV-023 前端交互层产品化

## 审计结论

DEV-023 的变更保持在既有 Phase 1 模块内，未新增一级菜单，未扩展 ERP / 财务 / 采购 / 库存 / 销售 / 资产 / 报表 / 移动端范围，未连接生产系统，未提交 secret，未部署或切流生产。

本阶段补强的是前端端到端交互可达性和本地验收交付：

- dashboard / workbench 到项目、任务、合同、审批和 AI 草稿。
- 项目到任务、文件、聊天和知识上下文。
- 任务回项目。
- 聊天到关联项目 / 任务 / 合同和 AI 草稿确认结果。
- 知识查询按选定项目上下文过滤。
- 合同 handoff 到审批。
- 审批回来源合同。
- 设置到权限、AI 和页面状态治理面板。

## P0 / P1 检查

- 普通用户一级菜单未增加冻结外模块。
- 登录页未展示高权限测试账号清单。
- AI 仍只能生成建议、提醒和草稿，不能审批、发布、付款、签署或确认完成。
- 合同仍必须人工确认风险和二次审查后才能提交审批。
- 审批动作仍通过既有 API 校验当前节点处理人。
- 新增 LAN 脚本只用于本地监听和同网段验收，不是生产部署。

## 风险和限制

- `apps/web/vite.config.ts` 已加入 LAN 代理目标配置，并已通过 typecheck/build。
- 当前 Mac 的 `3001` 端口被一个旧 `next-server` 占用，因此本次 LAN 人工验收临时使用 `3011`。项目脚本默认仍保留 `3001`，也可通过 CLI `-- --port 3011` 临时改端口。
- Browser plugin 能打开页面，但文本输入自动化因 virtual clipboard 不可用失败；登录和对象闭环由 API smoke 覆盖，人工可通过 LAN 链接继续验收。

## 验证记录

已通过：

- `git diff --check`
- JSON parse checks
- JSONL parse checks
- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run test`：14 test files / 64 tests passed
- `npm run build`
- `npm run smoke:api`：`ok: true`，29 checks
- `npm audit --audit-level=low`：0 vulnerabilities
- Web local HTTP check：`http://127.0.0.1:3011/`
- API health check：`http://127.0.0.1:3002/health`
- LAN advertised URL：`http://192.168.2.90:3011/`

## 下一步

- 打开 PR，等待 GitHub required checks 和 review gate。
- 用户用同 LAN 另一台电脑打开当前测试链接 `http://192.168.2.90:3011/`。
- 合并后如需固定 3001，先释放当前占用 3001 的旧 `next-server`。
