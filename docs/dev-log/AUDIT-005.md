# AUDIT-005 项目与任务闭环审计

## 状态

- 状态：审计通过，待 PR
- 分支：`audit/005-project-task-loop`
- Issue：`https://github.com/jaosnxu/xtgzpt/issues/20`
- 审计对象：DEV-005 / PR #19 / merge commit `86f8bc6`

## 审计范围

- 项目状态机
- 任务状态机
- 项目成员数据权限
- 任务负责人 / 确认人权限
- 审计日志完整性
- 模块可用状态
- 前端 owner / member 角色行为
- 未完成范围是否被误标为完成

## 验证结果

自动验证：

- `npm run ci`：通过
- `npm audit --audit-level=low`：0 vulnerabilities
- `git diff --check`：通过
- 测试结果：5 个测试文件 / 25 个测试通过

GitHub 验证：

- PR #19 状态：merged
- merge commit：`86f8bc6`
- GitHub combined status：无远端 checks 返回

API 边界矩阵：

- 项目负责人不能在未授权组织创建项目：403
- 普通成员不能添加项目成员：404，不暴露项目权限细节
- 项目不能从 `active` 直接归档：400
- 任务不能从 `todo` 直接完成：400
- 取消任务缺少原因：400
- 项目对象审计包含 `project.created`

浏览器证据复核：

- DEV-005 已保存 owner 主流程截图：`docs/dev-log/DEV-005-project-task-owner.png`
- DEV-005 已保存 member 权限视角截图：`docs/dev-log/DEV-005-project-task-member.png`

## Findings

未发现阻塞合并问题。

## 非阻塞风险

### AUDIT-005-P2-001 项目 / 任务仍是内存存储

影响：

- 服务重启后项目和任务数据会丢失
- 不能用于生产数据沉淀

结论：

- 已在 DEV-005 边界中声明，不能当成生产持久化完成
- 后续数据库阶段必须补迁移、仓储层和持久化测试

### AUDIT-005-P2-002 评论和附件未进入 DEV-005 代码实现

影响：

- DEV-005 完成的是项目 / 任务主闭环
- 评论、附件、文件预览仍不能作为生产能力使用

结论：

- 已在 DEV-005 边界中声明
- 后续文件阶段和任务协作阶段继续补

### AUDIT-005-P3-001 远端 GitHub checks 未配置

影响：

- GitHub merge commit 没有远端 CI status 返回
- 当前 gate 依赖本地 `npm run ci`、HTTP 矩阵和 Playwright 验证

结论：

- 不阻塞当前阶段
- 后续平台级升级需要配置 GitHub Actions required checks

### AUDIT-005-P3-002 前端任务操作按钮仍偏粗

影响：

- 前端按钮按任务状态展示，没有完全按当前用户可执行动作隐藏
- API 已正确拒绝未授权动作，但 UX 可继续收口

结论：

- 不构成权限漏洞
- 后续工作台产品化时补前端按钮级权限裁剪

## 审计结论

DEV-005 可以进入下一阶段。

已确认：

- 项目 / 任务主闭环可跑通
- 关键状态机有测试覆盖
- 关键权限边界有效
- 审计记录可查询
- 未完成范围已明确记录

下一步：

- 提交 AUDIT-005
- 创建 PR
- 合并后进入 DEV-006 或按用户优先级继续下一模块
