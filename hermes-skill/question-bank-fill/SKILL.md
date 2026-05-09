---
name: question-bank-fill
description: 题库填补闭环工作流 — 当爸爸说"加题"/"补题"/"题库不够"/"skill X 缺货"/"把 N 个 skill 都填到 ≥30 道"等触发。执行：audit → fill (closed loop with human-in-loop) → review vfail samples → improve prompts/keywords → re-test → push to D1 per-row。**不能写自动 force-fix loop，必须 Claude 在回路中判断。**
version: 0.1.0
author: Bruce + Claude
license: MIT
platforms:
  - macos
  - linux
metadata:
  hermes:
    tags: [content, ai-generation, question-bank, closed-loop, internal]
    long_running: true
---

# 题库填补 · 闭环工作流

> 原则一句话：**Claude 必须亲自看每一类失败、亲自改 prompt/keywords/autoFix，绝不写"强制矫正"的自助 loop**。force-fix 把 AI 跑题的内容包装成合规题入库 = 给将来埋雷。

## 何时启动

爸爸说出以下任意之一，立即激活：

- 「加题」/「补题」/「再加 N 道」/「题库不够」
- 「skill X 缺货」/「skill X 只有几道」
- 「把所有 skill 都填到 ≥N 道」
- 「数学/语文 题库扩量」
- 「fill bank」/「scale up question bank」

## 启动后第一步：永远先 audit

```bash
cd /Users/yong/Desktop/xy/heping-math-trainer
APP_PASSWORD=$(grep ^APP_PASSWORD= ../.dev.vars | cut -d= -f2-)
curl -s -H "Authorization: Bearer $APP_PASSWORD" \
  https://selena-elevate.pages.dev/api/sync/download -o /tmp/prod-snapshot.json
curl -s -H "Authorization: Bearer $APP_PASSWORD" \
  https://selena-elevate.pages.dev/api/sync/ai-questions -o /tmp/aiqs.json
TARGET=30 node scripts/_audit-all-counts.mjs > /tmp/all-counts.json 2>/dev/null
jq '.summary' /tmp/all-counts.json
jq -r '.allCounts | sort_by(.total) | .[0:25] | map("\(.total)\t\(.skillId)") | join("\n")' /tmp/all-counts.json
```

爸爸的 TARGET 可能不同（≥20 / ≥30 / ≥50），通过 `TARGET=N` env 调整。Default 30。

## 工作流（铁律：3-pilot 验证 + 闭环 review）

### 阶段 1：Pilot — 小批量先验证

```bash
cp /tmp/under20.json /tmp/priorities.json   # 把 audit 输出当 input
rm -f /tmp/vfail-samples.jsonl /tmp/vfail-summary.json
APP_PASSWORD=$APP_PASSWORD node scripts/_fill-bank-v3.mjs 5 1 > /tmp/pilot.log 2>&1
# 跑完 → tail /tmp/pilot.log 看结果
```

参数：`<target_per_skill> <passes>`。Pilot 用 `5 1` 即可（24 skill × 1 pass）。

### 阶段 2：**人工 review vfail 样本（最重要！）**

```bash
cat /tmp/vfail-samples.jsonl | jq -s '.[] | {skill: .skillId, issues: [.issues[] | "\(.severity): \(.path) — \(.message[0:100])"], stem: (.q.stem | .[0:80]), game_type: .q.game_type, answer: .q.answer}'
```

**对每个 vfail，Claude 要做的判断**：

1. **题面本身是否好？** 如果 stem 写得对，是 schema/格式问题 → 找根因
2. **是 prompt 问题、validate 问题，还是 schema 问题？**
3. **修法选哪个**：
   - prompt 没说清楚 → 改 `prompts/quality-rubric.md` 或 `prompts/questions/game-types/*.md`
   - prompt 写错了（schema mismatch）→ 改 prompt（最常见！）
   - validate 太严（false positive）→ 改 `src/core/validateQuestion.ts`
   - AI 一致性差但内容好 → 加 **safe** autoFix（见铁律 3）
   - keyword 太窄（off_topic）→ 改 `prompts/skill-keywords.json`

### 阶段 3：改 prompt / 关键词 / autoFix → rebuild → 再 pilot

```bash
npm run build:prompts   # 必须！修 prompts/*.md 后重新生成 _prompts.generated.ts
npm run typecheck && npm test
npm run build
git add -A && git commit -m "v0.31.X: pilot N review — 修 X/Y/Z"
npx wrangler pages deploy dist --project-name=selena-elevate \
  --commit-dirty=true --branch=main \
  --commit-message="v0.31.X pilot review fixes"
```

再 pilot 验证修好了。**连续 2-3 个 pilot 都 0 vfail 才能 scale up**。

### 阶段 4：Scale up 到 keep-filling.sh

```bash
APP_PASSWORD=$APP_PASSWORD TARGET=30 bash scripts/_keep-filling.sh > /tmp/keepfill-out.log 2>&1 &
```

后台跑直到所有 skill ≥ TARGET。会自动 audit → fill → push → 循环。预计 4-12 小时（看 token budget）。

## 三大铁律（不能违反）

### 铁律 1：autoFix 只动**纯元数据**

✅ 安全可改：
- `subjectId` / `status` / `version` / `grade`
- `skill_name` / `unit_name`（从 ID derive）
- 空数组默认（hints / tags）

❌ **绝不动**：
- `skill_id` / `unit_id` / `term`（force-overwrite 会把跑题题包装合规入库 → 大坑）
- `difficulty` / `ability_dimension` / `exam_priority`（内容判断）
- `game_type` / `cognitive_level` / `question_format`
- `answer.type` / `estimated_time_seconds`
- 任何 stem / options / hints text

### 铁律 2：filter 而不是 force

对**枚举数组**（如 `ability_dimension`），AI 偶尔混入非法值。

✅ 安全：filter 留下合法的，**仍 ≥1 个有效值才保留**
```js
const filtered = arr.filter(v => VALID_SET.has(v));
if (filtered.length > 0 && filtered.length < arr.length) q.field = filtered;
```

❌ 危险：filter 后空 → 强加默认（这是"我编对的"，不是"AI 写的"）

### 铁律 3：连续 N 次 vfail 不空转

`_fill-bank-v3.mjs` 已实现：同 skill 连续 4 次 vfail → 跳过本 round + 写到 `vfail-summary.json`。下次 audit 后 Claude 应**亲自看这些 skill 的 prompt** + 决定怎么改。

## 历史 vfail 模式 + 修法（避免重复掉坑）

| 模式 | 触发 | 修法 |
|---|---|---|
| `off_topic` 服务端拒绝 | `stemMatchesSkill` 关键词太窄 | 改 `prompts/skill-keywords.json` 加同义词，但**不要加单字或太宽**（如"万"会让所有大数题误穿） |
| `procedural` in `ability_dimension` | AI 混了两个 enum | prompt 加 ⚠️ 表格强调互不通用 + autoFix filter |
| `solution_steps` is object array | schema 要 `string[]`，AI 给 `{step, text}` | prompt 加 ✗ 错例 + safe autoFix（抽 `.text`） |
| `hints[].penalty` is float | AI 给 0.1/0.2 想表达 small/med | prompt 明示整数 + safe autoFix（sub-1 ×10, ≥1 round） |
| `answer.type = "numeric"` | **prompt 本身写错** schema 要 `"number"` | 改 `quality-rubric.md` + `balance_lab.md` 把 "numeric" 改成 "number" |
| `clue.expected = [0,1]` | schema 要 string，AI 给数组 | `word_problem_lab.md` 加 ✗ 错例：要 `"0,1"` 字符串 |
| `没用 X` false positive | `FORBIDDEN_REGEX /没用/` 中性短语误杀 | 改成 `/你没用|真没用|废物/` 精准 |
| `D1 push 500` 主 sync 超 2MB | aiQuestions 全量塞主 snapshot | **拆独立 `/api/sync/ai-questions` 端点**，per-row upsert（已 v0.31.65 完成） |

## 文件地图

### 必看
- `scripts/_audit-all-counts.mjs` — audit per-skill 题量
- `scripts/_fill-bank-v3.mjs` — 闭环填题（autoFix + vfail 捕获）
- `scripts/_keep-filling.sh` — 持续运行直到达 TARGET
- `scripts/_load-content-extended.ts` — esbuild bundle entry

### Prompts（改了要 `npm run build:prompts`！）
- `prompts/quality-rubric.md` — 总体规范（answer.type/cognitive_level/ability_dimension 等枚举值）
- `prompts/skill-keywords.json` — 关键词（决定 server 端 off_topic 检查）
- `prompts/questions/game-types/*.md` — 11 个题型各自的 schema + 例子
- `prompts/questions/system.md` — system prompt 模板

### 服务端
- `functions/api/generate/questions.ts` — gen + `stemMatchesSkill` 检查
- `functions/api/sync/ai-questions.ts` — per-row sync endpoint（v0.31.65+）
- `functions/api/agent/judge-questions.ts` — AI 二次质检（admin 用，不影响 fill）
- `functions/_prompts.generated.ts` — 自动生成，不要手改

### 客户端（影响 D1 sync）
- `src/db/cloudSync.ts` — push/pull aiQuestions per-row
- `src/core/validateQuestion.ts` — schema 校验 + FORBIDDEN_REGEX
- `src/core/schema.ts` — Zod schemas（**改这里要同步改 prompt**）
- `src/lib/questionAuditLite.ts` — client-side audit (mirrors scripts/audit-questions.mjs)

### 一次性脚本（已跑过，留作参考）
- `scripts/_migrate-aiqs-to-perrow.mjs` — 把主 snapshot 的 aiQuestions 迁到 per-row

## 容量监控

每个 skill ≥ TARGET 后 audit 才会显示 `underTwenty: 0`。这才是收工标准。

```bash
TARGET=30 node scripts/_audit-all-counts.mjs 2>/dev/null | jq '.summary.underTwenty'
# 0 = 全部 ≥30，可以收工
```

## 收工时给爸爸的报告模板

```
✅ 题库填到 TARGET=N 完成

| 指标 | 启动前 | 现在 | 增量 |
|---|---|---|---|
| AI 题数 | X | Y | +Z |
| 仍 <N 的 skill | 28 | 0 | -28 |

修复历史（人工 review）：
- Pilot 1: 发现 X，修 prompt/code Y
- Pilot 2: ...
- ...

最终：N 个 pilot 后稳定 0 vfail，scale up 后台跑 K 小时完成。

后台 keep-filling.sh 自动检测达标即退出。
```

## 给将来 Claude 的关键提醒

1. **跑前先 read 这个 SKILL.md** 完整一遍。每条铁律都有血泪教训
2. **绝不写"强制矫正"自助 loop**。爸爸明确反馈过不要这样
3. **vfail 是宝贵信号**。每个都看，找根因，改 prompt 而不是绕开
4. **Pilot → review → fix → pilot 再次** 至少 2-3 轮 0 vfail 才能 scale up
5. **autoFix 添加新 case 前先想 30 秒**：是 AI 已写好我抽出？还是我编新内容？后者绝不
6. **prompt 改完一定 `npm run build:prompts` + 部署**，不然服务端不生效
7. **每次成功都 commit + deploy**，留版本号方便回退

最后：题库填补不是机械活，是判断活。Claude 是把关人。
