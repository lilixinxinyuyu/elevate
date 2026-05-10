# 用户报告 → AI 立即修题

> v0.31.77 上线，v0.31.79 加日志，v0.31.80 prompt 单文件化。

## 流程

1. Selena（或任何用户）做题时点 GameShell 顶栏右上 **🐛 报告**
2. Modal 选 6 个 reason 之一：
   - ❌ 答案不对
   - 🔁 选项都一样 / 看不出区别
   - 🤷 选项里没有正确答案
   - 🤔 题面看不懂
   - 🧮 数字 / 计算错了
   - ❓ 别的问题（可选自由说明 ≤ 200 字）
3. 后台 `POST /api/admin/report-question`：
   - reason 映射到 fix issues（`answer_wrong → wrong_answer`）
   - 调 qwen-plus + `prompts/fix/system.md`（含 4P 原则）
   - 解析返回的 `{ fixed, changesSummary }`
   - 强制保留 stable 字段（`question_id` / `skill_id` / `unit_id` / `game_type` / `play_as` / `question_format`）
   - UPSERT 到 `ai_questions` D1 表
   - **同时写一条 `question_reports` 表**（前后状态全保留）
4. 客户端拿到 fixed → 写本地 Dexie → 跳到下一题（不计入对错）
5. 下次 Selena / 任何设备拉到这道题 → 是修好的版本

## Resilience

LLM 失败 / parse 失败 / D1 失败时：
- 原题打 `user_reported` + `reported:<reason>` tag 入库
- `question_reports` 表写"修题失败"日志（含 llm_error）
- UI 显示"📩 已记录，等爸爸看"

## 数据落地

### `ai_questions` 表
修题成功后的题写在这里。`tags` 包含 `ai_fixed_by_report` 标识。

### `question_reports` 表（v0.31.79 新建）

```sql
CREATE TABLE question_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_key TEXT NOT NULL,
  question_id TEXT NOT NULL,
  reason TEXT NOT NULL,                  -- 'answer_wrong' / 'options_same' / etc
  reason_text TEXT,                       -- 用户自由输入
  original_payload TEXT NOT NULL,         -- 修前完整 JSON
  fixed_payload TEXT,                     -- 修后完整 JSON（失败为 null）
  changes_summary TEXT,                   -- AI 给的改动一句话
  ai_fix_succeeded INTEGER NOT NULL,      -- 0 / 1
  llm_error TEXT,                         -- 失败原因
  created_at INTEGER NOT NULL
)
```

### Admin 入口

`/api/admin/list-reports` GET 端点：
- `?limit=50` 默认 50，最多 200
- `?onlyFailed=1` 只看 AI 修失败
- `?since=<ms>` 增量

`<ReportsPanel/>` 组件在 Admin → 🛠️ 系统 tab 顶部：
- 列表展示，emoji ✅/⚠️ 表示成功/失败
- 显示 reason 标签 + question_id + changes_summary + 时间
- "展开 JSON 对照" → side-by-side 原题 vs 修后题
- filter [全部 | AI 修失败]

## Prompt（统一）

修题逻辑跑 `prompts/fix/system.md`（详见 [prompt-composer.md](prompt-composer.md)）。

跟变式（`prompts/variant/system.md`）的边界：
- **变式**：source 是 good 题，输出新 question_id 的相似题（换数字+换情境）
- **修题**：source 是 bad 题，输出**同 question_id** 的修复版（针对具体 issue）

## 用途

1. **Selena 撞坏题不再被迫答错** — 她可以自己消化它
2. **prompt 失败模式诊断** — 后台扫 `question_reports`，AI 反复在哪类 reason 上失败 → 针对性改 prompt
3. **题库自我进化** — 用户即审核员，AI 即修复者，admin 不必逐道改

## 代码索引

- 前端按钮: `src/components/game/ReportQuestionButton.tsx`
- 集成到 GameShell: `src/components/game/GameShell.tsx`（顶栏 chip 区右侧）
- 后端处理: `functions/api/admin/report-question.ts`
- 列表查询: `functions/api/admin/list-reports.ts`
- Admin UI: `src/components/ReportsPanel.tsx`
- 修题 prompt: `prompts/fix/system.md`
