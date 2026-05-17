# Iter 35 P0-3 MultiStepApplication 设计稿 (送预审)

> 起源: Selena 43% 期中事件 master plan P0-3. peer review 共识: 应用题强制 4 步框架, 已知/求 用拖拽题干数字 (10 岁打字慢), 算式才打字. 同时 Gemini 早期建议 P0-3 一起改 AI generation prompt 加 keyNumbers (iter 33 deferred).

## 目标

把应用题从"看完整题直接给答案" 改为 4 步分步填写, 训练表征转换 (文字 → 算式).

## 触发条件

(任一)
- `q.word_problem_steps` 已存在 (现有 schema, 5 字段 known/question/relationship/equation_or_expression/check) → 直接走 multi-step UI
- `q.subquestions` 已存在 → 已经是 multi-step, 不重复
- heuristic: hasStory + hasMultiStep + difficulty ≥ 3 + question_format = numeric

显式 metadata: `q.requiresMultiStep?: boolean` 覆盖 (跟 speedEligible/requiresEstimation/requiresScratch 一致).

互斥规则:
- 跟 EstimationGate 互斥 (estimation 已经排除 story 题, 自然不冲突)
- 跟 ScratchInsurance 互斥 (multi-step 已经强化结构思考, 不需要 scratch toolbar)
- 复杂度: 应用题进入 multi-step OR 计算题进入 estimation/scratch — 三选一

Feature flag: `multi_step_app_v1` (default ON, opt-out via URL ?multi_step=off)

## 4 阶段 UI

### Phase 1: 已知 (Known)
显示完整题面, 题面里的数字可以**点击 → 自动飞入已知卡片**.
也支持手动输入 (兜底).

```
题: 小明买了 5 千克苹果, 每千克 12 元. 一共多少元?
       ▲             ▲

[已知卡片区]
┌────────────────┐  ┌────────────────┐
│ 5 千克 (苹果)   │  │ 12 元/千克      │  [+ 加一项]
└────────────────┘  └────────────────┘
```

XP: +4

验证: 至少 2 个已知项 (应用题至少 2 个数字).

### Phase 2: 求 (Question)
题面最后一句通常是"求...". 让 Selena 选/写要求.

```
[3 个候选] (从 q.word_problem_steps.question 或 heuristic 提取)
○ 一共多少元?  ← 自动 highlight
○ 多少千克?
○ 每千克多少?

[或手动输入] [_______________]
```

XP: +2

验证: 跟 q.word_problem_steps.question (若有) 一致, 或包含 "?" + 量词.

### Phase 3: 算式 (Equation)
textarea 让 Selena 写算式. 这是关键步 (无法跳过, 必须打字).

```
[算式: ____________________]
       (例: 5 × 12 = 60)
```

XP: +6 (最重 — 这是真功夫)

验证:
- 必须包含 ≥ 1 个运算符
- 必须能 parse 出数字结果
- 结果跟 q.answer.value 比较 (±5% 误差)

### Phase 4: 答 (Answer)
最终答案 + 单位 (drop-down 或自动猜).

```
答: [______ ] [元 ▾]
```

XP: +8 (最终 + 单位都对)

验证: 数字匹配 q.answer.value + 单位匹配 q.word_problem_steps (若有) 或 stem 提取的常见单位.

### Phase 5: Reveal (现行 feedback)
4 步完成后, 切到现有 FeedbackPanel, 主 score 走 scoreAttempt (Phase 3+4 是关键 — Phase 3 正确就算 attempt isCorrect = true).

## XP 公式 (peer review 之前给的+20 上限改良)

Total 上限 +20 (跟 EstimationGate 一致), 但分 4 phase:
- 已知 +4
- 求 +2
- 算式 +6
- 答 +8

中间步骤错 → 不影响下一步进入 (peer review 强调不要 hard-block). 但 attempt.isCorrect 跟 Phase 4 答最终一致.

终答对但中间步骤错 → 减 5 XP "蒙对"提示 (跟现有 scoring 一致, 防瞎蒙).

## 同时改 AI generation prompt (iter 33 deferred)

修改 `functions/api/generate/questions.ts` 的 prompt, 给生成的应用题加:
```json
{
  "keyNumbers": [5, 12],  // 主要计算用的数字 (≤ 4 个)
  "requiresEstimation": false,  // 应用题暂不触发 estimation gate
  "requiresMultiStep": true,    // 应用题主动触发 multi-step
  "word_problem_steps": {
    "known": ["5 千克苹果", "12 元/千克"],
    "question": "一共多少元?",
    "relationship": "总价 = 单价 × 数量",
    "equation_or_expression": "5 × 12 = 60",
    "check": "..."
  }
}
```

Prompt 加一段 instruction 教 AI 怎么填这些字段.

## 数据流

```
GameShell
  └─ resolveTemplate(q)
        ├─ if requiresMultiStep(q) AND multi_step_app_v1 → 'multi_step_application'
        └─ else 现有逻辑
  └─ MultiStepApplicationPanel
        ├─ Phase 1: 已知 (click stem numbers → chips + manual input)
        ├─ Phase 2: 求 (3 候选选项 + 手动)
        ├─ Phase 3: 算式 (textarea + parse)
        ├─ Phase 4: 答 (numeric + unit)
        └─ onComplete({ phasePass[4], finalAnswer, finalUnit, perPhaseXp })
            → handleFinish (跟现有 attempt 流统一)

attempt.metadata.multiStep = {
  phasePass: [true, true, true, false],
  earnedXp: 12,
  perPhaseElapsedMs: [...],
  userKnown: [...],
  userQuestion: "...",
  userEquation: "...",
  userAnswer: 60
}
```

## 实现拆分

### 新文件
- `src/core/multiStepPolicy.ts`:
  - `requiresMultiStep(q): boolean` heuristic + explicit
  - `extractKnownCandidates(q)` (从 stem 或 word_problem_steps.known 提候选)
  - `extractQuestionCandidates(q)` (3 个"求 X" 候选)
  - `validateEquation(eq, expected): boolean` (parse + tolerance)
  - `extractUnitCandidates(stem, knownAnswer): string[]`
- `src/components/game/templates/MultiStepApplication.tsx`: 4 phase 组件
- `tests/multiStepPolicy.test.ts`

### 修改
- `src/core/schema.ts` + `types.ts`: 加 `requiresMultiStep?: boolean`
- `src/components/game/templates/resolve.ts`: 路由 multi_step_application
- `src/components/game/GameShell.tsx`: 加 multi_step_application 到 pickPanel
- `src/lib/featureFlags.ts`: isMultiStepAppV1
- `functions/api/generate/questions.ts`: prompt 加 keyNumbers/requiresMultiStep/word_problem_steps 引导
- (可能) `src/db/service.ts`: AttemptOutcome 加 multiStepMeta 透传

### Out of scope (留后 iter)
- 算式 LaTeX 渲染 (现在 plain text)
- "求" 复杂度高的中文 NLP (现在 substring match)
- 跨 attempt 学习 — Selena 在 Phase 3 反复错 → 触发 P1-2 SkillRepair 同型 +5 — 留 iter 37

## 设计决策需要预审验证

1. **触发优先级**: word_problem_steps 已存在 → 强制 multi-step? 现有题库可能很多简单题也带 word_problem_steps 字段. 是否需要 + 复杂度 gate (difficulty ≥ 3 OR 已知 ≥ 2)?
2. **"已知" 用 chip + click vs 拖拽**: chip + click 实现简单 (button on each digit in stem). 拖拽 (drag-drop) 体验好但实现复杂. v1 用 chip + click?
3. **算式 parse**: 用什么库? Function constructor 不安全, 写简单 tokenizer? 还是只支持 "数字 op 数字 = 结果" 一行格式 (简化)?
4. **"求" 候选 3 个**: 从哪里来? heuristic 提? AI gen 题面提? 还是只有"自定义输入"?
5. **XP 公式 +4/+2/+6/+8 = +20**: peer review (iter 33) 把 estimation 从 +20 降到 +12. 这里 multi-step 该不该也降?
6. **跟 ScratchInsurance 互斥** vs **重叠 (互补)**: multi-step 本质就是结构化的 scratch. 互斥更省 UI, 但 Selena 可能怀念 "scratch 险" (没保险了). 是否给 multi-step 也加一种 "草稿险" (4 步全错也不扣 XP)?
7. **AI prompt 改造**: 现在改, 还是先 ship multi-step UI, 下一轮 (iter 36 之前) 再改 prompt? 现在改的话, 这一轮 iter 时间会拉长.
8. **缺什么 corner case**? 多步题 + 求带分数/小数? 多步题 + 单位换算 (元 ↔ 角)?
9. **整体方向**: 立即做 / 改后再做 / 不做?
