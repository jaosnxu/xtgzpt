# AI FRAMEWORK SCHEMAS

## 1. AI 总原则

AI 是辅助工具，不是业务主体。

AI 可以：

- 分析
- 整理
- 提醒
- 建议
- 起草
- 列风险
- 给审批建议
- 做结构化审查
- 引用来源
- 比较版本

AI 不可以：

- 自动审批
- 自动发布知识
- 自动创建正式任务
- 自动付款
- 自动签署
- 自动确认收货或执行完成
- 自动改变正式状态
- 删除原始记录
- 绕过权限
- 隐藏风险
- 发布系统配置

## 2. AI Framework

每一种 AI 能力必须绑定框架。

```json
{
  "framework_id": "contract_review_v1",
  "framework_name": "合同审查框架",
  "framework_version": "1.0.0",
  "scenario": "contract_review",
  "status": "active",
  "input_schema_version": "1.0.0",
  "output_schema_version": "1.0.0",
  "policy": {
    "requires_permission_filter": true,
    "human_confirmation_required": true,
    "can_change_formal_state": false
  }
}
```

## 3. AI Run

```json
{
  "ai_run_id": "airun_001",
  "framework_id": "contract_review_v1",
  "framework_version": "1.0.0",
  "scenario": "contract_review",
  "trigger_user_id": "user_001",
  "source_object_type": "contract",
  "source_object_id": "contract_001",
  "permission_scope_hash": "hash",
  "status": "succeeded",
  "started_at": "2026-06-18T10:00:00+03:00",
  "finished_at": "2026-06-18T10:00:20+03:00",
  "output_ref": "ai_output_001"
}
```

## 4. 合同审查输出

```json
{
  "summary": "合同摘要",
  "risk_level": "high",
  "risks": [
    {
      "risk_id": "risk_001",
      "title": "付款条款风险",
      "severity": "high",
      "source_quote_ref": "clause_4_2",
      "explanation": "风险说明",
      "recommendations": {
        "A": "保守方案",
        "B": "平衡方案",
        "C": "强硬方案"
      },
      "requires_human_confirmation": true
    }
  ],
  "redlines": [
    {
      "source_ref": "clause_4_2",
      "type": "risk_highlight",
      "reason": "付款条件不明确"
    }
  ],
  "next_required_action": "human_confirm_risks"
}
```

## 5. 审批建议输出

```json
{
  "suggestion": "review_carefully",
  "reasoning": ["存在合同付款风险", "缺少执行时间"],
  "evidence_refs": ["contract_001:clause_4_2"],
  "risk_level": "medium",
  "cannot_decide": true,
  "next_required_action": "human_approval"
}
```

审批建议只作为参考，不得触发 approve/reject。

## 6. 知识问答输出

```json
{
  "answer": "基于可见来源生成的回答",
  "sources": [
    {
      "source_object_type": "knowledge_item",
      "source_object_id": "k_001",
      "title": "制度标题",
      "permission_checked": true
    }
  ],
  "confidence": "medium",
  "missing_information": [],
  "requires_human_confirmation": false
}
```

知识问答必须先做权限过滤。

## 7. 聊天整理输出

```json
{
  "summary": "会议或聊天摘要",
  "decisions": [],
  "open_questions": [],
  "task_drafts": [
    {
      "title": "跟进合同修改",
      "assignee_suggestion": "user_002",
      "due_date_suggestion": "2026-06-20",
      "source_message_refs": ["msg_001", "msg_002"],
      "requires_human_confirmation": true
    }
  ]
}
```

## 8. 项目风险输出

```json
{
  "project_id": "project_001",
  "risk_level": "medium",
  "risks": [
    {
      "title": "任务延期风险",
      "evidence_refs": ["task_001"],
      "suggested_action": "确认负责人和截止日期"
    }
  ],
  "requires_human_action": true
}
```

## 9. 失败分类

AI 失败必须分类：

- `network_error`
- `timeout`
- `permission_blocked`
- `policy_blocked`
- `input_too_large`
- `invalid_framework`
- `model_error`
- `unknown_error`

网络错误可自动重试。权限、政策、框架错误不得自动重试，必须记录阻塞。
