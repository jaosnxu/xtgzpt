# AUDIT-003 DEV-003 阶段自检与收口

## 状态

- 状态：执行中
- Issue：`https://github.com/jaosnxu/xtgzpt/issues/12`
- 基线：`main` after DEV-003
- 目的：进入 DEV-004 前，对 DEV-003 权限中间层做统一自检、审计、修复和复测

## 审计范围

- 菜单权限
- 数据权限
- 操作权限
- 文件权限
- AI 权限
- 拒绝访问记录
- 未开发业务边界
- 前端阶段状态
- 依赖审计

## 发现问题

### AUDIT-003-P2-001 阶段状态仍显示 DEV-003 进行中

现象：

- DEV-003 已合并到 `main`
- 前端 `moduleStatus` 和顶部阶段说明仍显示 `DEV-003 进行中`

风险：

- 用户和 reviewer 会误以为 DEV-003 尚未完成
- 后续进入 AUDIT-003 / DEV-004 时阶段状态不清晰

处理：

- 首页和设置模块阶段改为 `DEV-003 已完成`
- 顶部说明改为 `DEV-003 已完成：等待 AUDIT-003 收口`

## 静态审计结果

- 未发现假业务审计事实重新出现在 `apps/` 或 `packages/`
- `x-request-id` 仅保留在回归测试和文档记录中，API 拒绝记录不再信任该 header
- 未知模块名先返回 404，不进入拒绝记录
- 授权通过但未开发的接口继续返回 `501 not_implemented`
- DEV-004 完整审计基础设施未被标记为完成

## 自动验证结果

| 检查项 | 结果 |
| --- | --- |
| `npm ci` | 通过 |
| `npm run ci` | 通过 |
| `npm audit --audit-level=low` | 0 vulnerabilities |
| `git diff --check` | 通过 |
| API 权限矩阵 | 通过 |
| Headless Chrome 页面自检 | 通过 |

## API 自检结果

| 场景 | 结果 |
| --- | --- |
| 登录响应包含 `seed-dev-003` | 通过 |
| 普通成员不返回 `settings` 菜单 | 通过 |
| 恶意 `x-request-id=secret-contract-name` 不进入拒绝记录 | 通过 |
| `/modules/secret-contract-name` 返回 404 | 通过 |
| 普通成员新建项目返回 403 | 通过 |
| 项目负责人新建项目返回 `501 DEV-005` | 通过 |
| 猜测文件下载返回 403 且响应不泄露文件名 | 通过 |
| 拒绝记录不包含 `secret-contract-name` | 通过 |

## 浏览器自检结果

- 管理员首页显示 `DEV-003 已完成：等待 AUDIT-003 收口`
- 管理员首页显示权限摘要和 `seed-dev-003`
- 页面不再显示 `DEV-003 进行中`
- 页面不显示模拟业务审计事实
- 截图：
  - `docs/dev-log/AUDIT-003-dashboard-admin.png`

## 已知工具问题

- 在运行 `npm ci` 时，正在 watch 的 `tsx` dev server 会因为 `node_modules` 被重建而短暂报 `tsx/dist/preflight.cjs` 缺失
- 处理方式：验证前停止旧 watch 服务，`npm ci` 后重新启动 API/Web
- 该问题属于本地开发服务生命周期问题，不影响 build、test 或 CI 结果

## 当前阶段边界

已完成：

- DEV-003 权限策略模型
- 后端统一权限 guard
- 拒绝访问记录
- 前端权限摘要展示
- 权限维度数据库迁移

未完成，不能假装已完成：

- DEV-004 完整审计基础设施
- 真实文件上传、下载、预览
- 真实 AI 调用
- 真实项目、任务、知识、合同、审批业务流

## 下一步门禁

进入 DEV-004 前必须完成：

- 本审计修复合并
- `npm ci` + `npm run ci` 通过
- `npm audit --audit-level=low` 通过
- API 权限矩阵复测通过
- 浏览器页面状态复测通过
- 独立 reviewer gate 通过
