# Loop Operating Rules

## 固定流程

1. 读取 `docs/loop/00_MEMORY_INDEX.md`
2. 读取当前阶段相关 PRD、backlog、权限、状态机、审计矩阵
3. 创建或确认 GitHub issue
4. 从最新 `main` 创建阶段分支
5. 实现当前阶段最小完整闭环
6. 运行自动验证
7. 运行 smoke 或浏览器/API 矩阵
8. 写入 dev-log
9. 创建 PR
10. 执行 reviewer gate
11. 合并
12. 创建 AUDIT 阶段
13. 审计后再进入下一开发阶段

## 项目执行默认规则

任何项目交付问题都必须进入 Loop 流程处理，不能只停留在对话判断。

Loop 默认负责：

- 技术方案判断
- 分支与 PR base 判断
- CI、测试、smoke、浏览器验证判断
- 端口冲突、服务启动、依赖、构建问题处理
- 代码实现、修复、回归测试和提交
- 开发日志、失败记录、意图债、审计记录写回
- PR 创建、检查状态跟踪和 reviewer gate 执行

除非触发“需要用户确认边界”，技术执行问题不得反复询问用户。

## 需要用户确认边界

只有以下情况需要用户确认：

- 业务规则不清楚，且不同选择会改变产品行为
- 阶段范围变化，例如新增或删除一个模块
- 需要用户提供外部账号、密钥、付款、授权或第三方平台权限
- 涉及生产数据、生产配置、公开仓库密钥、删除数据或不可逆操作
- 同一阻塞条件已经按重试规则处理后仍无法继续

除此之外，Loop 必须自己判断、执行、验证、记录，并在阶段报告中汇总结果。

## 状态记录

每个阶段必须有以下状态之一：

- `pending`
- `in_progress`
- `blocked`
- `retrying`
- `verified`
- `merged`
- `audited`

## 失败分类

- `network`
- `permission`
- `configuration`
- `code_error`
- `test_gap`
- `requirement_unclear`
- `production_risk`
- `tool_failure`
- `external_switch`

## 重试规则

- 网络错误可以自动重试
- 同一问题最多重试 3 次
- 3 次失败后进入 `docs/loop/02_INTENT_DEBT.md`
- 权限、登录、生产 secrets、仓库设置缺失，不继续乱跑，直接记录阻塞

## Gate 规则

开发阶段至少需要：

- `npm run ci`
- `npm run smoke`
- `npm audit --audit-level=low`
- `git diff --check`
- 对应 API 或浏览器矩阵

审计阶段至少需要：

- 复核上阶段日志
- 复核未完成边界
- 复核新增代码对应权限、状态机、审计
- 记录 blocker 和非 blocker 风险

## 禁止

- 禁止未记录失败就跳过
- 禁止把未完成能力写成完成
- 禁止直接在业务阶段混入平台大改
- 禁止无 issue、无日志、无验证合并
