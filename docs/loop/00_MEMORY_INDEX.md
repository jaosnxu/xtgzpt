# Loop Memory Index

本文件是每轮开发前必须读取的项目记忆索引。Loop 不能只依赖聊天上下文。

## 每轮必读

1. `README.md`
2. `PROJECT_INTAKE.md`
3. `docs/dev-readiness/00_DEV_READINESS_OVERVIEW.md`
4. `docs/dev-readiness/01_DEVELOPMENT_PRD.md`
5. `docs/dev-readiness/02_PERMISSION_MATRIX.md`
6. `docs/dev-readiness/03_OBJECTS_AND_STATE_MACHINES.md`
7. `docs/dev-readiness/04_API_DRAFT.md`
8. `docs/dev-readiness/06_AUDIT_LOG_MATRIX.md`
9. `docs/dev-readiness/08_TEST_CASES_AND_ACCEPTANCE.md`
10. `docs/dev-readiness/10_DEVELOPMENT_BACKLOG.md`
11. `docs/loop/01_OPERATING_RULES.md`
12. `docs/loop/02_INTENT_DEBT.md`
13. `docs/loop/04_MERGE_QUEUE_RUNNER.md`
14. 最近 3 个 `docs/dev-log/DEV-*.md`
15. 最近 3 个 `docs/dev-log/AUDIT-*.md`

## 阶段启动必须确认

- 当前分支是否从最新 `main` 创建
- 当前 issue 是否存在
- 当前阶段范围和不做范围是否明确
- 是否有上阶段遗留 intent debt 影响本阶段
- 是否需要浏览器验证或 API 矩阵
- 技术执行问题是否已按 `docs/loop/01_OPERATING_RULES.md` 自主判断，不把技术判断反复交给用户
- 若需要用户确认，必须属于业务规则、阶段范围、外部权限、密钥、生产风险或重复阻塞

## 阶段完成必须写回

- 本阶段 dev-log 或 audit-log
- 验证命令结果
- 截图或 API 矩阵证据
- 失败、阻塞、工具问题、外部平台开关
- 下一阶段建议
