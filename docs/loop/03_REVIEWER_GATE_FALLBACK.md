# Reviewer Gate Fallback

当 sub-agent、外部 reviewer 或 GitHub review 不可用时，不能跳过审查。必须执行本地 reviewer checklist。

## 必查清单

- 权限：是否出现未授权数据读取、操作、菜单入口
- 状态机：是否允许非法状态跳转
- 审计：关键动作是否写入审计，失败是否记录
- 数据泄漏：404/403 是否泄露对象名称、组织、路径或敏感输入
- 前端：按钮是否误导用户执行无权限动作，页面是否空白或崩溃
- 测试：是否覆盖主链路、越权、失败、边界
- 文档：dev-log 是否记录验证、失败和未完成范围
- 范围：是否把未来阶段功能误标为完成

## 输出格式

```md
## Reviewer Gate

Findings:
- P0/P1/P2/P3 ...

Validation:
- npm run ci
- npm run smoke
- npm audit --audit-level=low

Decision:
- pass / blocked
```

## 不能通过的情况

- P0/P1 未修复
- 权限泄漏
- 状态机主链路错误
- 审计缺失
- `npm run ci` 或 `npm run smoke` 失败
- 未完成范围没有记录
