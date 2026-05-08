# Changelog

> 给爸爸/妈妈看的版本演进历史。Selena 不需要看这个文件——升级了她直接刷新就好。
> 所有版本号在 `package.json` + `src/components/Layout.tsx` 的 footer。

## v0.31.40 — 2026-05-08 · 语文 500 字 / 英语 3 模式 · 全部对齐老 HTML 系统

爸爸反馈 v0.31.39 太简化：
1. 语文统计跟老 chinese/g4_cn.html 对不上：老的"总练习 180 / 正确率 96% / 错字 5"，这版"已掌握 2"完全不同口径
2. 语文老版本是 500 字（上下册可切），这版只有 250（下册）
3. 语文老版本有"手写 + 辨字选择"两模式，这版只有写字
4. 英语老版本有 3 模式（看单词选中文/看中文选单词/听读音选单词）+ 上下册切，这版只有 1 个看中文写英文
5. 英语统计 47/3/63 跟新版 51/—/64 对不上

### 语文写字表 500 字 — 重写

**数据：500 字（上 250 + 下 250）**
- `scripts/extract-chinese-chars.mjs` 改成同时抽 g4_cn.html 的 upperWordList + lowerWordList
- `src/subjects/chinese/charLibrary.ts` 现在 export `G4A_CHARS` (250) / `G4B_CHARS` (250) / `G4_CHARS_ALL` (500)

**双模式（沿用老 HTML）**
- ✍️ 写字练习：拼音 + 词组提示 + 含义 → 输入字
- 🎯 辨字选择：拼音 + "请选择正确的生字：<含义>" → 4 选项（同 pinyin 首字母 + 同字表干扰项 + 随机补全），完全沿用 g4_cn.html `generateChooseQuestion` 公式

**统计口径完全对齐老系统（updateStats）**
- 总练习 = sum(right + wrong) — 总 attempt 次（不是不同字数）
- 正确率 = sum(right) / 总练习
- 错字总数 = chars where wrong > right
- 错字本：把这些字按 (wrong - right) 降序列出，点击单字直接跳到那字单独练

**加权随机沿用老公式**
- `weight = max(1, wrong*3 + 1 - min(right, 3))`：错过越多权重越高 ×3，对超 3 次后权重不再降

**游戏化**
- 连击 × 系统：连续答对，每对多 +2 XP（最多 +18）
- 本次 XP 实时累计 + 飞行 +N XP 浮字
- 连击 ≥ 2 时显示 🔥 连击 × N

实测迁移后：**总练习 180 / 正确率 96% / 错字总数 5（毫/哩/颇/挣/囊）** — 完美对上爸爸提到的老数据。

### 英语单词 — 重写

**3 模式（沿用老 HTML）**
- 看单词 → 选中文：英文 + 🔊 → 4 个中文选项
- 看中文 → 选单词：中文 → 4 个英文选项
- 🔊 听读音 → 选单词：自动 TTS 朗读 + 可点击重听 → 4 个英文选项

**TTS：Web Speech API**
- `speakEnglish(text)` 用 SpeechSynthesisUtterance，lang=en-US
- 优先 Samantha（macOS 清晰女声），fallback 任意 en-US female / 任意 en-US

**上下册切换**
- 95 (G4A) / 112 (G4B) 各自独立 stats

**统计口径对齐老 updateStatsPanel**
- 已掌握: correct > wrong * 2
- 薄弱: wrong > 0 且不满足已掌握
- 未学习: correct === 0 && wrong === 0

**加权 weight 字段维护沿用老公式**
- 答对：`weight = max(0.4, weight * 0.75)`
- 答错：`weight *= 1.6`
- 新词初始 weight = 1

**焦点提示**
- 🔴 错题强化（wrong > correct）
- 🟡 高频巩固（weight > 1）
- 🟢 基础练习

**游戏化**
- 同写字表的连击 + XP 系统

### 改动文件
- `src/subjects/chinese/charLibrary.ts` — 250 → 500 字（G4A + G4B + ALL）
- `src/lib/chineseCharProgress.ts` — `calcOldStyleStats` 替代 `summarizeProgress`；`charWeightLikeOldSystem` 替代 `charWeight`；新增 `generateChooseQuestion`
- `src/lib/englishVocabProgress.ts` — `calcOldStyleStats` 老口径 / `weight` 字段维护 / `speakEnglish` TTS / `buildOptions` / `focusBadge`
- `src/pages/chinese/CharPractice.tsx` — 整页重写：上下册 tabs / 写字+辨字双模式 / 老口径 stats / 错字本 / 连击 XP
- `src/pages/english/VocabPractice.tsx` — 整页重写：上下册 tabs / 3 模式 / TTS / 老口径 stats / 焦点 / 连击 XP
- `src/pages/english/EnglishHome.tsx` — 上下册各自 stats card
- `src/pages/chinese/ChineseHome.tsx` — 卡片文案改成 "500 字"
- `scripts/extract-chinese-chars.mjs` — 改抽 g4_cn.html

## v0.31.39 — 2026-05-08 · 语文写字 250 + 英语单词 207（含老数据迁移）

爸爸三个要求：
1. 借鉴老的"四年级上下册写字表 500 字·零泄露练习系统" → 把 G4B 250 字接进语文，迁移老进度
2. 英文单词记忆系统也类似迁移过来
3. 期中是明天 5/9 — 不能动核心 math/chinese 题型，全部新增模块独立旁路

### 语文写字表 250 字（chinese 学科扩展）

新增数据：`src/subjects/chinese/charLibrary.ts`（250 个 G4B 生字 + 拼音 + 词组提示 + 含义；从 `chinese/lower_words_full.js` 自动提取）。脚本：`scripts/extract-chinese-chars.mjs`。

新增页面：`src/pages/chinese/CharPractice.tsx` (路由 `/chinese/char-practice`)
- 顶栏 stats：已掌握 / 待巩固 / 没见过 / 在练 + 进度条
- 每张卡显示：拼音 + 词组（`___` 占位目标字 · 零泄露）+ 含义；输入框写字
- 答对自动 1.2s 切换；答错显示正确字，"下一字 →" 手动推进
- 加权随机（pow(0.75, right - wrong)，clamp [0.3, 1.8]）+ 最近 5 字不重复

进度库：`src/lib/chineseCharProgress.ts`
- `db.meta::chinese_char_progress::<studentId>` 存 right/wrong/lastSeenAt
- `migrateHistoricalCharProgress()`：从 `chinese/data.json` 的 `wordStudyData` 一次性导入历史 138 字进度
- 幂等闸门 `chinese_char_progress_migrated::<studentId>`
- 完全独立于现有 chinese skills/mastery/attempts，不污染期中诊断

入口：ChineseHome 多一个 "✍️ 写字表 250 字 · 加权练习" 卡片。

### 英语学科（new subject 注册）

新增 SubjectId `"english"`（`src/core/types.ts`）。
新增 subject 注册 `src/subjects/english/`（label "英语" / shortLabel "英" / theme cyan-blue / 无 units/skills/seedQuestions —— vocab 自带独立练习不走主框架）。
SubjectPicker 自动多一张英语卡片；header chip 学科切换里也自动多一项。

数据：`src/subjects/english/wordList.ts` — 207 个 G4 单词（A 上 + B 下，去重；从 `english/g4_english.html` 自动提取）。脚本 `scripts/extract-english-words.mjs`。

页面：
- `src/pages/english/EnglishHome.tsx` (路由 `/english`) — 概览 + stats + 单词卡入口
- `src/pages/english/VocabPractice.tsx` (路由 `/english/vocab` 和 `/english/train`) — 中文 → 英文输入；可点"💡 提示首字母"显示首字母 + 长度

进度库：`src/lib/englishVocabProgress.ts`
- `db.meta::english_vocab_progress::<studentId>` 存 correct/wrong/lastSeenAt
- `migrateHistoricalVocabProgress()`：从 `english/data.json` 的 `wordMemory4EN` 一次性导入历史 ~200 词进度
- 幂等闸门同样靠 meta key
- 大小写不敏感（`normWord(word.toLowerCase())`）

### 路由 & 学科切换

router.tsx：
- HomeRoute 多 english 分支 → EnglishHomePage
- TrainRoute 多 english 分支 → VocabPracticePage（让"开始今日挑战"链接也能落到 vocab）
- 新加 `/chinese/char-practice` 和 `/english/vocab` 路由
- 新加专属 Route 守卫 `CharPracticeRoute` / `VocabPracticeRoute`

ORDERED_SUBJECT_IDS 现在是 `["math", "chinese", "english"]` —— picker 卡片 + chip 下拉自动显示。

### 设计原则（沿用爸爸 v0.31.34/.35 反馈）

- **零迁移**：所有新进度独立 db.meta，旧 attempt/mastery 表不动；期中考试相关流程零风险
- **零泄露**：词组提示用 `___` 占位目标字，跟原老系统一致
- **加权随机**：错过的字/词更频繁出现，掌握的少出现 — 4 年级专注度有限，省时间
- **历史尊重**：Selena 已经在老系统练过的，新系统进去就看到 "已自动从老系统导入 N 个字的进度"

### 改动文件
- 新增 9 个文件（subject + 2 progress libs + 3 page + 2 wordList + extract scripts）
- 修改：`src/core/types.ts` (SubjectId 加 english) / `src/subjects/index.ts` (注册) / `src/router.tsx` (路由) / `src/pages/chinese/ChineseHome.tsx` (加入口卡)

## v0.31.38 — 2026-05-08 · 闯关难度阶梯 + AI 再出题真注入会话

爸爸反馈：
1. 「闯关的难度太大了，时间又特别短，Selena 闯关意愿就特别小」
2. 「AI 出题答错时蹦出"再出一道类似的"，但点了下一题没出现类似的题，好像变成了另外一种题」

### 闯关重设计（friendly difficulty curve）

旧版 `5 × D3-D4 + ceil(0.8) 通过` → 4/5 才发印章，时间还有倒计时。
对 4 年级孩子，cognitive load 已经够高，再加压力打击信心。

新版 `1 × D2(热身) + 3 × D3(主战) + 1 × D4(Boss)`：
- D2 热身：subquestions 优先，单步退路；让孩子手感找回来再上主战
- D3 主战：原来的多步应用题
- D4 Boss：综合压轴
- 每档不够时降级到下一档，整体仍然 5 道
- 通过门槛 `4/5 (80%)` → `3/5 (60%)`：give a child a winnable game

`buildBigProblems()` 完整重写（`src/core/scheduler.ts:738`）：每档独立挑桶 + skill 多样性 + fallback。
`finalizeSession()`（`src/db/service.ts:676`）通过率从 0.8 → 0.6。
`Train.tsx` 给 GameShell 的 `countdownEnabled` 现在是 `effectiveMode !== "big_problems"` —— **闯关不限时**。
`BigProblems.tsx` landing 文案同步更新。

### AI 再出题真注入会话队列

`requestRetryQuestion()` / `requestHarderQuestion()` 之前只把生成的题写进 `db.questions`（带 `ai_generated/session_adaptive` tag），但 `Train.tsx` 的 `state.questions` 没改 → 用户点"下一题"看到的还是 plan 里原本的下一题。按钮显示"✓ 已加入下一题"是 **撒谎**。

修复：
- `GameShell` 加 `onInjectQuestion(q: Question)` prop，路由到 FeedbackPanel
- FeedbackPanel 里 `onRetrySimilar` / `onBumpHarder` 在生成成功后调 `onInjectQuestion(newQs[0])`
- `Train.tsx` 的 `handleInjectQuestion` 直接 `state.questions.splice(index+1, 0, q)`
- 防重：同 questionId 已经在 cursor 之后就不再插

下一次 `handleNext` 切到的就是这道新题。

### 改动文件
- `src/core/scheduler.ts` — 重写 `buildBigProblems` 加难度阶梯
- `src/db/service.ts` — 通过率 0.8 → 0.6
- `src/pages/Train.tsx` — `countdownEnabled` 闯关关 + `handleInjectQuestion` callback
- `src/components/game/GameShell.tsx` — `onInjectQuestion` prop 串到 FeedbackPanel
- `src/pages/BigProblems.tsx` — landing 文案更新

## v0.31.37 — 2026-05-07 · 真修 fill_blank 题 + 一键 AI 修全部

爸爸：「静态规则检测到 42 道可疑题，这个不是已经修好了吗？...修好题，删除信息就完了」+「一个一个的点太耗费时间了」

### 真修

`fixFillBlankGameType()` 之前要求 `tags.includes("format_reclassified")` 才修，导致跨设备同步过来没 tag 的题修不到（用户看到 42 道仍判损坏 → 实际真坏没修）。

改成按"症状"扫：
- `question_format === "fill_blank"` AND
- `play_as` 或 `game_type` 在 `OPTION_BASED_TEMPLATES` 集合里

直接设 `play_as = "plain_numeric"` + `game_type = "speed_calc"`。每次 boot 都跑（O(n) 没坏的早 continue，开销忽略），不再 idempotent meta key gating。

### 删信息

- 删 "⚠️ 静态规则检测到 N 道可疑题..." banner（用户没法 act 上）
- 删 "损坏" stat box（同理）

题库诊断顶栏现在 3 个 stat box：总题数 / seed / AI 生成。其余的判定全在下方 AI 质检面板里走。

### 一键 AI 修全部

AI 质检结果出来后多一个绿色按钮 **"🔥 一键 AI 修全部 N 道"**：
- 把所有 `verdict !== "keep"` 的题（delete + borderline）一次性丢给 LLM 修
- 并发 3（同 judge 的并发上限）
- 每个修完自动 applyQuestionFix（不弹 modal 逐题确认）
- 进度条实时显示 `done/total · failed`
- 失败的不阻塞成功的，跑完汇报
- 修完的 row 自动从 results 列表移出

### 改动文件
- `src/db/seed.ts` — 重写 `fixFillBlankGameType`
- `src/components/QuestionsAdminPanel.tsx` — 删 banner / stat box / 加 bulk fix 按钮 + 进度条 + worker pool

## v0.31.36 — 2026-05-07 · 整理 admin UI（去重 + 学科隔离）

爸爸反馈：
1. "🚨 损坏题样本" 静态规则检测面板和 AI 质检功能重复，UI 重复占位
2. 数学 admin（`/math/admin`）里有两个语文专属卡片，本来就不该混在数学

### 数学 admin 清理（`src/pages/Admin.tsx`）
- **删** "TTS 测试（语文听写用）" card —— `/chinese/admin` 自带（"🎧 TTS 测试（小进 Cherry 童声）"）
- **删** "语文测试数据清理" card —— `/chinese/admin` 自带（"🧹 重置语文测试数据"）
- 同时删了相关的本地组件函数（TtsSmokePanel / ChineseResetPanel）+ 不再用的 import

### 题库诊断面板清理（`src/components/QuestionsAdminPanel.tsx`）
- **删** "🚨 损坏题样本（N）" details 列表 —— 静态规则检测和 AI 质检功能重叠，AI 质检更准 + 有"✨ AI 修"按钮
- **删** "🗑 清理 N 道损坏题（规则）" 按钮 —— 同上，rule-based 删除粒度太粗
- 保留 "损坏" 数字 stat box 作为 fyi
- 检测到损坏 > 0 时显示一行小提示：「请用下方 🤖 AI 质检定位 + 用 ✨ AI 修按钮逐条修」

### 设计原则（再次强化 v0.31.35 那条）
- 一次性任务（reclassification migration）→ boot-time + console.log
- 重复 / 冗余 UI → 删（保留更准的那个）
- 学科专属功能（语文 TTS / 语文数据重置）→ 只在那个学科的 admin 出现

## v0.31.35 — 2026-05-07 · 修 fill_blank 误标 + Chinese scope + 3 个 format rubric + D5 多 skill

### 修 v0.31.33 残留 bug
- 之前 fill_blank 重分类后 game_type 仍是 "plain_choice"，admin `needsOptions()` 误判 42 道损坏
- 修：`questionFormatClassifier.applyReclassification` 转 fill_blank 时同时设
  `play_as="plain_numeric"` + `game_type="speed_calc"`，路由到 plain_numeric 模板
- 加 boot-time migration `fixFillBlankGameType()`（idempotent meta key
  `fillBlankGameTypeFix_v31_35`）扫库 + meta::questionPatches 修已损坏的题
- **删了 admin UI 里 v0.31.33 加的 `FormatReclassifyPanel`**（一次性任务不该上 UI，
  原则记录在 docs / memory）

### 新增 prompt 内容（爸爸要求）

**Chinese skill scope（12 个 C4B skill 覆盖）**：
- C4B_U1: PINYIN / POEM_RECITE / VOCAB / DICTATION（古诗 + 乡村田园）
- C4B_U2: PINYIN / VOCAB / DICTATION（自然与科技）
- C4B_U3: PINYIN / RHETORIC（现代诗 + 修辞）
- C4B_U4: PINYIN / VOCAB / DICTATION（动物名家）
- 每条含定义 / inScope / outOfScope / 古诗原文 / typicalContexts / commonMistakes / 例题

**3 个 format rubric**（drag_drop / sort_ladder / geometry_operation）：
- 各自必填字段、设计要求、时间锚定、❌ 禁止清单
- 与已有 6 个 format rubric 拼齐 9 种 question_format 全覆盖

**D5 综合题 multi-skill scope 注入**：
- composer 新增 `extraSkillIds: string[]` 参数
- 拼 prompt 时把每个额外 skill 的 scope 都列出来（去重防主 skill 重复）
- 加"综合题设计要求"段：一道题、多阶段推理、同一情境、每个 skill 都真考到
- `sessionAdaptive.requestHarderQuestion()` 自动行为：difficulty 升到 5 时自动从同
  unit 随机挑一个其他 skill 当 extraSkill

### Build 流程

```
11 game-type schemas, 50 skill keyword sets, 5 difficulty rubrics, 9 format rubrics, 45 skill scopes
```

### 设计原则记录（写给以后的 Claude / 项目）

> **一次性任务（数据迁移、批量修复、扫描-and-改）不要做成 admin UI 永久按钮。**
> 用临时脚本 / haiku 直调 / API endpoint / boot-time migration（带 idempotent meta key）
> 解决。Admin 是日常工具，不是历史 bug 修复站。

## v0.31.34 — 2026-05-07 · Prompt 编排器六轴 + 会话内"再出一题"

用户需求：「出题 prompt 应该包含：四年级下册数学相遇问题的定义（避免超纲）+ 已有的难度 3 的相遇问题题目列表（避免重复）+ 难度 3 在系统里的定义（避免难度浮动）+ 选择题的要求（避免太多文字超时）+ 多步骤题的要求（避免每步逻辑不匹配）+ 样题（避免数据结构不正确）。」 → 重写 prompt 系统按这五轴 + 一轴去重 = **六轴模块化 composer**。

### 新增 prompt 文件

| 路径 | 数量 | 说明 |
|---|---|---|
| `prompts/skills/scope.json` | 32 个 G4B 核心 skill | 每个 skill 的精确教学范围（definition / inScope / outOfScope / keyFormulas / typicalContexts / commonMistakes / exampleStems） |
| `prompts/difficulty/{1..5}.md` | 5 | 每个难度的特征 + 时间锚定 + 反例 |
| `prompts/formats/{numeric,numeric_choice,single_choice,multi_choice,multi_step,fill_blank}.md` | 6 | 每个 question_format 的字段要求 + 设计原则 |
| `prompts/questions/game-types/{speed_match,vertical_repair,true_false_swipe,dot_grid_draw}.md` | 4 个新 schema | 之前缺的常用模板 schema |

### 新增 composer 模块

`functions/_promptComposer.ts` 暴露：
- `composeQuestionUserPrompt({ subjectId, skillId, format, difficulty, gameType, count, existingStems, recentMistakeStems, batchAngle })`
  按六轴拼一个完整的出题 prompt。skill 没在 scope.json 里时优雅 fallback 到 skillName + global rubric。
- `composeJudgeUserPrompt({ subjectId, scopeLabel, scopeFilter, questions })`
  把这批题涉及的所有 skill scope 都列出来（最多 6 个），让 judge 严格对照。
- `composeFixUserPrompt({ question, issues, reason, subjectId })`
  修题时注入该题 skill 的 scope，防止改完跑题。

### 三个端点全部升级到 composer

- `/api/generate/questions` — 新增 `format` + 单数字 `difficulty` 参数；buildUserPrompt 改用 composer
- `/api/agent/judge-questions` — buildUserPrompt 改用 composer，自动注入这批题涉及的 skill scope
- `/api/agent/fix-question` — buildUserPrompt 改用 composer，注入对应 skill scope

### 新模块 `src/lib/sessionAdaptive.ts`

会话内自适应出题：
- `requestRetryQuestion(question)` — 答错后调 composer 出同 skill / 同 difficulty / 同 format 的 1 道巩固题，写库并标 `session_adaptive` tag
- `requestHarderQuestion(question)` — 闪电速度后调 composer 出同 skill / +1 difficulty 的 1 道挑战题

### UI 集成（`GameShell.FeedbackPanel`）

- 答错时显示 cyan **"🔄 再出一道类似的"** 按钮（同 skill / 同 difficulty / 同 format）
- 答对 + 闪电/迅速速度 + difficulty < 5 时显示 fuchsia **"🚀 来道更难的（D{n+1}）"** 按钮
- 都是即时调 LLM ~10s 出题写库，下一题自然抽到（disabled 防双击）

### Build 流程

`scripts/build-prompts.mjs` 扫多新增的目录：
```
11 game-type schemas, 50 skill keyword sets, 5 difficulty rubrics, 6 format rubrics, 32 skill scopes
```

### 例子：相遇问题 D4 multi_step 的 prompt

总长 ~5000 字符（~1200 token），包含：
1. 任务声明（数学 / G4B / 相遇问题 / D4 / multi_step）
2. **Skill scope** — 定义 / 范围 / 超纲项 / 公式 / 情境 / 常见错误 / 例题（约 1500 字符）
3. **难度 4 rubric** — 多步推理 / 含陷阱 / 60-120 字 / 反例 (约 800 字符)
4. **multi_step format rubric** — 必填字段 / 3 步推理链一致性 / clue/choose/numeric 各自要求（约 1500 字符）
5. **shop_counter game-type schema** — 完整 JSON 样板
6. existing stems 截断列表
7. 输出协议

每个字符都精确目标化——告别"出语文出数学都行"的混杂 prompt。

### 文档

`docs/prompt-composer.md` 有完整设计 + 使用 + 扩展指南（添加新 skill scope / 新 difficulty / 新 format）。

### 后续可加（目前覆盖不全）

- 语文 skill scope（目前 scope.json 全是数学 G4B）
- drag_drop / sort_ladder / geometry_operation 的 format rubric（这些用得少）
- 跨 skill 综合题（D5）的 multi-skill scope 注入

## v0.31.33 — 2026-05-07 · 答题格式重分类（修正 fill_blank 误标）

用户反馈："很多 fill blank 的题没有分类到这个类别，帮我过一下数据库把它们都归类到正确的类别"。

**根因**：早期 AI 出题（aiGenG4BPack / aiGenG4B_U14_Pack 共 213 道）一律打
`question_format: "single_choice"` + 4 个选项，但其中 70% 实际上是 "…是多少 X？"
风格的填空题。导致 admin 面板"按答题格式"过滤选 fill_blank 时永远 0 道，没法
针对填空题做 AI 质检。

**新增模块** `src/lib/questionFormatClassifier.ts`：纯启发式分类器（不调 LLM）
- `classifyFormat(q)` 决策树：
  1. 复杂题型（multi_step / drag_drop / sort_ladder / dot_grid / 有 subquestions）→ 不动
  2. 已是 fill_blank → 不动
  3. stem 含 `___` / `（  ）` / `□` 填空标记 + 不是概念辨析 → fill_blank
  4. stem 含 "下面/下列…正确" / "哪一个" / "哪句话…说法" 等概念辨析 → 保持 single_choice
  5. 自然题 + 末尾 "…是多少 X？" + answer 是 choice 但能从被选项的文字干净抽出
     "数值 + 单位"（如 "0.158米" → `{value: 0.158, unit: "米"}`）→ fill_blank
- `extractNumericFromText("0.158米")` → `{value: 0.158, unit: "米"}`
  - 跳过分数、表达式、纯中文文字（保持 single_choice）
- `applyReclassification(q, r)` 拷贝并打 tag `format_reclassified`
- `scanForReclassification(questions)` 整库扫描，按 transition 分组报告

**新增 admin 面板** `🏷️ 答题格式重分类`：
- 在 AI 质检面板下面，单独折叠 details
- 点 "🔍 扫描全库" 秒级出报告（毫秒级，不调 API）
- 显示 transition 表："single_choice → fill_blank: 143"
- 预览 list（前 15 条）：原 format / 新 format / stem / 转换原因
- "✓ 应用全部 N 条" 逐条 applyQuestionFix → 写 db.questions + meta::questionPatches
- 跨设备同步（同 v0.31.32 修题机制）

**Seed 库扫描结果**（SEED_QUESTIONS 共 961 道，去重 946 道；
Selena 本地 db.questions 实际只剩 ~590 道 = SEED 减去 deletedQuestionIds 里的历史删除）：
- 估计 100+ 道会被改 single_choice → fill_blank（实际数字以 admin 扫描为准）
- 全部触发原因都是 "自然题 + 末尾问数字"
- 验证样本：`一支铅笔长15厘米8毫米，用米作单位是多少米？` → fill_blank（0.158米）
- 保留样本：`下面对小数 6.047 中'4'的解释，正确的是？` → single_choice 不动

**之后 admin 流程**：
1. 跑一次 "🏷️ 答题格式重分类" → 应用 → 143 道题改为 fill_blank
2. 回 "🤖 AI 质检"，scope 选 "按答题格式 / fill_blank" → 真的能扫到 143 道
3. 出问题的 fill_blank 题用 "✨ AI 修" 修

## v0.31.32 — 2026-05-06 · AI 质检 → 一键 AI 修题（不删，直接改）

用户反馈："删除也不好，改了就好了，删除还要再出题"。同意。

**新增 AI 修题流程**：
1. 质检结果表每行（verdict ≠ keep 时）多一个 "✨ AI 修" 按钮
2. 点 → 调 `/api/agent/fix-question` 让 qwen-plus 按 issues + reason 修题
3. 弹"修题对比"modal：左原 / 右修，每个字段（stem / options / answer / solution_steps /
   estimated_time_seconds / common_errors / hints / feedback / tags）都有 diff
4. 改过的字段橙色框标"已改"；没改的灰底 60% 透明度
5. 确认 → applyQuestionFix 写 db.questions + meta::questionPatches（跨设备同步）
6. 拒绝 → 关 modal，原题保留

**跨设备同步机制**：
- 修过的题存进 `meta::questionPatches: Record<qid, Question>`
- meta 表本身就 cloudSync（v0.27 起的合并策略），跟 deletedQuestionIds 一个原理
- seed.ts 启动后调用 `applyPendingQuestionPatches()`：把 patches 中的题 upsert 到 db.questions
- 在两条路径都跑：SEED_VERSION 不变的早 return 分支 + bulkPut 后的常规分支
- 避免 SEED bulkPut 把修过的题盖回原版

**Endpoint**：`POST /api/agent/fix-question`
- 输入：单道题 + issues + reason
- 输出：完整修过 JSON + changesSummary
- 强制 carry-forward：question_id / unit_id / skill_id / version / grade / term 不允许 LLM 改
- 自动给 tags 加 "ai_fixed" 标记

**好处**：
- 不丢 question_id → 该题的 attempts / mistakes / mastery 历史全部继承
- 不需要重新生成（一道好的应用题 prompt 不容易写）
- 跨设备一致：admin 这台改了，Selena 那台同步后立刻拿到修过版本

## v0.31.31 — 2026-05-06 · AI 质检面板 UX 优化（去最大数量限制 + 进度条）

旧版每次跑 AI 质检要：
- 选 scope（按学科/单元/skill/题型/...）
- 选 "最多 N 道"（20/60/120/200/400）—— 多余的题被砍掉，不能一次扫完
- 没法按 question_format 过滤（用户提到"填空题都有问题"）
- 进度只一行小字，看不到剩多少

修了：
- 砍掉 `maxSample` 选择器 —— 系统按匹配数量自动规划批次（每批 20 道、并发 3）
- scope 选择变化时实时显示"匹配 N 道 · M 批 · ~K 秒"，开始按钮直接说"开始 AI 质检（全部 N 道）"
- 加 `按答题格式 (questionFormat)` scope —— 直接选 fill_blank / single_choice 等
  （之前只能按 game_type 选，对"填空题都有问题"这种场景不灵）
- 题量 > 200 道时弹确认（怕误操作烧 API）
- 进度可视化进度条（紫→粉渐变 + 当前批次/已判定数/失败批次）

例：选"填空题"会自动找出全部 fill_blank 题，按数量分批，进度条跑完即出报告，
不用手动决定"扫多少道"。

## v0.31.30 — 2026-05-06 · 题库全面体检 + 修一道找零算错题

新增 `pnpm audit:questions` 静态题库审计脚本（`scripts/audit-questions.mjs`），
跑全 961 道题查 7 类问题：

🔴 **Critical**：
- C1 choice 答案但没 options
- C2 answer.value 不在任何 option.id 里
- C3 number 答案 value 不是有限数
- C4 multistep 答案 steps 为空
- C5 多个 options 同时标 correct=true

🟡 **Likely-broken**：
- L1 question_format=single_choice 但 answer.type≠choice
- L2 应用题简单算式（×、+、−、找零、双品种）算不出 stored 答案
- L3 options 文本重复
- L4 元选项 + 应用题主体不匹配

🟢 **Minor**：feedback 缺失 / hint penalty 异常 / 估时偏离

跑完发现 1 道真错题 `AI_G4B_SHOP_002__morz5ozp_1`：
> 果汁 12.9 元/瓶，薯片 6.5 元/包，买 2 瓶 + 1 包付 40 元，应找回多少？

AI 把最后一步算错：40 − 32.3 = **11.7**（错），正解 7.7。option A 改成 7.7，
solution_steps 也改了。

修完再跑：**0 critical / 0 likely-broken / 0 minor**。题库当前是干净的。

未来可以在这个脚本上接 LLM (qwen-turbo) 二次语义核验，跑出 application 类
难度 4-5 题答案是否真的对——目前只静态可证伪的能 catch，纯文字推理的（如
"小明比小红多 3 元"）暂时靠人工。

## v0.31.29 — 2026-05-06 · 修闪电口算环不闭 + 小数商店选择题判错

### Bug 1：3 环之"闪电口算"永远不闭
`Home.tsx` 里 `fluencyTodayCount = 0` 是 v0.31.1 的 TODO 占位，从来没改成真实查询。
所以无论 Selena 今天做了多少道闪电口算，3 环永远显示"还没做"。

修：用 useLiveQuery 查 `db.fluencyAttempts.where({studentId})` 当日的 sessionId
去重计数，传进 buildTodayRingsInput。≥1 个 session 就算闭环。

### Bug 2：小数商店类题（shop_counter + answer.type=choice）判错
AI 生成的"周末超市促销 苹果 5.8 元/千克 香蕉 3.2 元/千克 ..."这种 application
难度题 game_type 是 shop_counter，但 question_format 是 single_choice、
answer 是 `{type:"choice", value:"A"}` + 4 个 options。

ShopCounter 的 `buildSubquestions` 只处理了 `answer.type === "number"` 分支，
choice-type 答案 fallthrough 到 else 渲染了数字输入框 + 期望值 0。
Selena 输入正确数字 24.4 → 跟 0 比 → 永远判错，但 FeedbackPanel 又显示
"正确答案: A. 24.4"，体验完全分裂。

修：在 buildSubquestions 加 choice 分支，用 q.options 直接渲染 4 选 1 的
"choose"-kind 子问题，正确选项标记 correct=true。Selena 选 A 就对了。

## v0.31.28 — 2026-05-06 · 小进开口 race 模式（最坏 3.5s 见效果）

**问题**：Selena 设备上 realtime（dashscope WSS via Worker）连接慢得离谱，
有时要 2 分钟才"ready"。整个流程之前是串行：snapshot → instructions →
tutor.connect()。任何一步卡住都让 panel 空白等死。

**修法 race 模式**：
- 一进 panel 就 **同时启动** realtime connect + 文字 explainQuestion
- 三方 Promise.race：realtime ready / realtime error / 3.5s timeout
- realtime 在 3.5s 内就绪 → 用 realtime 模式，文字结果丢弃
- realtime 超时或出错 → 立即用预取的文字结果（大概率已经回来）
- worst-case 用户最多等 ~3.5s 看到内容（之前 2 分钟）

副作用：text explain 一次请求"白跑"（realtime 赢时结果不用）—— 可以接受，
比让孩子盯着空 panel 转 30 秒强 100 倍。

`fallbackToText` 加 `modeDecided` 单状态机门，防 onError + race rejection
双方都进来导致重复渲染消息。

## v0.31.27 — 2026-05-06 · TutorPanel fallback 模式去除诡异老语音按钮

**问题**：Selena 设备上 realtime（dashscope WSS via Worker）连接失败 → fallback
到老的"文字 explain + push-to-talk voiceAsk"模式。但老的 push-to-talk 调
`/api/tutor/voice` qwen-omni endpoint，账号 free tier 已知必定 403 FreeTierOnly。
Selena 一按按钮就报"DashScope 账号当前等级没有开通 omni 语音模型权限"——
对 9 岁孩子是噪音 UX。

**修法**：
- 砍掉 fallback 模式下的"按住说话"按钮（点了必失败）
- 砍掉老 voiceUnavailable 文案（"账号无 omni 权限"太技术）
- 改成温柔提示："💬 这次小进用文字讲。点 🔊 可以听她念出来；想追问就在下面写。"
- 保留：自动 explainQuestion 文字讲解 + Cherry TTS 朗读 + 文字追问

旧 startRecording / stopRecording 函数仍在代码里（语义清晰且有引用），
只是 UI 不再触发。下个版本可以彻底删掉。

**Selena realtime 失败的根因待排**（开 dev console 看 fallback reason；常见：
WS 握手失败 / 麦克风没权限 / 没存密码）。下一版考虑加 dev-only 错误 chip
方便排查。

## v0.31.26 — 2026-05-06 · Phase 2 全局翻 ON（期中考完）

按 v0.31.1 起的计划"期中后翻 phase2_live flag"。今天就是期中考试日 ——
全局打开。所有 Selena / 爸妈 / 任何设备访问就能直接看到 Phase 2 完整菜单：
闯关 / 闪电口算 / 今日 3 环 / boss 解锁 gate / 校园探险世界观。

`isPhase2Live()` 改成默认 true，仅在 localStorage 显式存了 `"false"` 时才返 false。
保留 opt-out 通道（万一 prod 出 regression 紧急回滚）：
- `?phase2=off` URL 参数：写 "false" 进 localStorage，下次加载也关
- `?phase2=on`：清掉 false 标记，恢复默认 ON

Selena 的设备不再需要任何手动操作 —— 刷新就有 Phase 2 完整体验。

下一版考虑：v0.32 把 isPhase2Live() 这个分支删掉，代码统一只走 Phase 2 路径。

## v0.31.25 — 2026-05-06 · 修小进讲题不一致 bug + Revert 3D 装饰版

### 🚨 严重 bug 修：小进讲解的题跟 Selena 实际做的题对不上
**根因**：v0.31.17 引入变式题流程后，FeedbackPanel 的"👩‍🏫 让小进讲一讲"按钮
和 retry 后的 2nd 提交链路有两个对不上的点：

1. `<FeedbackPanel question={question}>` 传的是 `props.question`（**原题**），
   但 Selena 在 retry 流程里答的是 **变式题**（`displayedQuestion`）。
   FeedbackPanel 内的 TutorPanel 拿着原题 stem 打开，跟 feedback 显示的"正确答案"
   完全对不上 → Selena 看到"小进讲了一道根本没在屏幕上出现过的题"。
   修：改成 `<FeedbackPanel question={displayedQuestion}>`。

2. handleFinish 的 1st-wrong silent-record 分支 gate 只检查 `retryStage === "none"`，
   没检查 `wasRetriedRef.current`。导致 retry 后第二次再答错时 gate 又满足 →
   重新走 silent record + 重新拉变式 + 重新进 retry stage。这会让 variantRef 反复
   重新生成，进一步加剧"题对不上"的混乱。
   修：gate 加 `&& !wasRetriedRef.current`，确保每道原题最多只触发一次 retry 流程。

### 🔄 Revert：3D 熊猫加回装饰
v0.31.24 试着按用户字面意思去掉所有装饰物（裸版熊猫），结果用户反馈"好难看"。
回到 v0.31.22 的有装饰版本：默认粉蝴蝶结、抱着紫色魔法书、4 档 skin 切换帽子
（蝴蝶结 / 学位帽 / 巫师帽 / 皇冠）、周围飘 π/+/★ 数学符号。
保留 v0.31.24 留下来的几何细节优化（教泪滴形眼圈、4 根扇形长睫毛、心形粉鼻头、
∪ 形微笑嘴、面部缝合线）。

## v0.31.24 — 2026-05-06 · 选定 plushie 熊猫为地基，3D 模型重做为裸版

用户在 mascot-compare 对比 5 种风格后，选定 **plushie 毛绒玩偶** 风格
（紫学位帽 + 紫魔法书 + 长睫毛 + 心形鼻 + 黑眼圈那张）作为小进地基形象。

按用户指示："只用熊猫本体，装饰物以后通过 wardrobe 加" —— 3D 模型剥掉所有
装饰：去掉学位帽、魔法书、蝴蝶结、巫师帽、皇冠。**只剩裸版熊猫玩偶**。
未来如果要 3D 装饰，单独在 accessory 层加，不烤进 base。

`src/components/Mascot3D.tsx` 重写：
- 大头 + 圆耳朵在头顶（更明显外移）
- 教泪滴形大黑眼圈，向外微倾，外下端有 tip
- 大亮黑眼睛 + 主高光 + 副高光（眼神闪亮）
- 4 根扇形长弯睫毛（细 cylinder，根部粗 tip 细）
- 粉色心形小鼻头（cleft 朝上，正常心形朝向，用 Three.Shape ExtrudeGeometry）
- ∪ 形微笑嘴（torus 旋转 PI 让 arc 落 -y 半圆），audioLevel 时 scale.y 拉成 O
- 椭圆粉腮红
- 圆胖白色身体，黑色短前肢交叉胸前，黑色后脚藏底部
- 面部 + 身体淡缝合线（plushie 标志细节）
- 多层柔光打光强调绒毛立体感
- 4 档 skin prop 仅影响背景光晕颜色，不改变本体（本体永远黑白熊猫）

`BASE_MASCOT_DESCRIPTOR` 同步更新为 plushie 风格描述符 — 所有 wardrobe 衣装变体
都基于这条 prompt 前缀生成，保证未来所有 AI 生成的造型都"是同一只熊猫换装"。

下一步可能：换 VRM 真模型、3D accessory layer（接 wardrobe）、表情 morph、
眨眼/挥手 idle 变体。

## v0.31.23 — 2026-05-06 · 小进基础形象对比页（5 种流行熊猫风格并发生成）

新隐藏页 `/math/mascot-compare` —— 把网上流行的 5 种熊猫吉祥物风格做成 prompt 候选，
并排生成对比，挑出最符合 Selena/家长口味的"地基形象"。一键替换 db.trophyImages
里的默认 mascot 图，全 UI 立刻换。

5 种风格灵感：
1. **毛绒玩偶 Plushie**（Jellycat / Build-A-Bear 商业摄影感）
2. **极简春植 Choonsik**（韩国 Kakao Friends，超简洁治愈）
3. **圆胖球 Pusheen-panda**（球形身体 + dot 眼睛 + 扁平插画）
4. **慵懒 Tare Panda**（日式 kawaii 极简，黑白配色）
5. **Anime 萌系少女**（Sanrio / 原神 chibi，sparkle 高饱和）

实现：
- `src/lib/mascotStyles.ts`：每种风格独立 prompt + 灵感标签 + tagline
- `src/pages/MascotCompare.tsx`：5 个 generateImage 请求并发跑，每风格 N 张候选；
  pending/ok/failed 三态展示；一键"选为基础形象"写进 db.trophyImages
- 选完会清掉佩戴中的 wardrobe 衣装，让基础形象立刻显示
- 不消耗装扮卡（基础形象选型不算衣装）

每风格 2 张默认配置 = 10 张候选，30-60 秒拿到对比图。

## v0.31.22 — 2026-05-06 · 母熊猫 plushie 形象 + AI 生成衣柜系统 + 装扮卡

把小进从"通用 AI 老师"重定位为"Selena 的女性熊猫毛绒玩偶 — 学习伙伴"。
所有未来衣装变体都从这个**地基形象**派生。

### 基础形象（地基）
- `prompts/mascot/xiaojin.md` 重写：plushie / 毛绒玩偶 / chibi 比例 / 立体光影 /
  缝线细节 / 商业玩偶摄影风格。彻底脱离"扁平贴纸 cartoon"
- `BASE_MASCOT_DESCRIPTOR` 在 `src/lib/mascotWardrobe.ts` 集中管理 —— 所有 AI
  衣装生成都走这条 prompt 前缀，保 Selena 看到的都像"同一只熊猫换装"
- 3D 形象（`/math/mascot3d`）重画：圆白头 / 椭圆黑眼圈 / 顶部黑耳 + 粉内耳 /
  长睫毛 / 粉鼻头 / 抱着紫色魔法书 / 默认粉色蝴蝶结。Roughness 0.95 让"绒"感出来

### 装扮卡 currency
- 完成 ≥ 5 题且正确率 ≥ 50% 的 session → +1 装扮卡（在 `finalizeSession` 里 hook）
- 存 `db.meta::wardrobeCards::math::<studentId>`，整数
- 显示在小进资料卡：`🎁 装扮卡：N 张`

### AI 生成衣柜流程
- 新 dexie v7 表 `mascotWardrobe`（id / studentId / name / prompt / blob / equipped / createdAt）
- 用户写 prompt → 扣 1 卡 → 调 `qwen-image-2.0-pro` 生成 2 张候选 → 挑 1 存进衣柜
  - 不喜欢可以全拒（卡花掉，但 prompt 留给下次）
  - 失败自动退卡
- 8 个预设 prompt suggestion（红贝雷帽 / 宇航员 / 樱花头饰 / 厨师服…）
- 衣柜 grid：佩戴中的金边 + ✓ 标记，点切换，× 删除

### MascotAvatar 优先级链
1. equipped wardrobe item（Selena AI 生成的造型）
2. db.trophyImages 默认小进（基础形象）
3. emoji fallback 🐼

只要 Selena 生成 1 个 wardrobe 造型并装备，整个 UI 里所有出现"小进"的地方
都自动换上新造型 —— Hero / TutorPanel / MascotProfile / BgGen 全套覆盖。

下一步（Phase C 续 / Phase D）：
- VRM 真模型替换 procedural panda
- 3D 形象也接入 wardrobe（衣装 morph target）
- 跨设备 sync wardrobe（图片走独立 endpoint，参考 trophyImages 方案）

## v0.31.21 — 2026-05-06 · 修 TutorPanel 遮挡 + 3D 形象 Phase C MVP

### TutorPanel 从 MascotProfile 弹出时被遮挡 — 修
根因：`.card-glow` → `.card` 用了 `backdrop-blur-sm`（即 `backdrop-filter`），
而 backdrop-filter 在多浏览器里会创建 containing block for fixed-position descendants。
TutorPanel 嵌在 MascotProfile 这个 card 内部弹时，`fixed inset-0` 被锁在父 card 边界里，
导致下方页面没被遮罩盖到，底部按钮也被截断。

修法：TutorPanel 改用 `createPortal(..., document.body)` —— 直接挂到 body，
逃出任何父容器的 containing block。同样的修法以后 home struggle / Mistakes /
Skills tree / BigProblems landing / SummaryView 弹的 panel 全部受益。

### 3D 形象 Phase C MVP — 隐藏调试页 /math/mascot3d
不进 nav，只直链可达。先用 procedural 几何体（球/胶囊/圆柱）把整条管线走通：
- `src/components/Mascot3D.tsx`：react-three-fiber 渲染卡通小进 — 头/双马尾/眼/腮红/嘴/上身
- Idle 动画：呼吸 scale + 头部小幅点头
- 嘴型同步：`useFrame` 每帧把 audioLevel (0-1) 映射到嘴 scale.y
- Skin 切换：default / graduation / wizard / legendary 四档（皮肤+衣服+帽子配色）
- 装饰：π / + / ★ 数学符号悬浮飘动
- realtime 嘴型：`RealtimeTutor.getCurrentAudioLevel()` 暴露播放音频 RMS（接 AnalyserNode）
- 麦克风嘴型：直接读 user mic 给嘴动（脱离 realtime 也能测）
- 250 KB three+R3F+drei 走 React.lazy + Suspense，不进主包

下一步（Phase C 续）：换 VRM 真模型、加表情 morph target、加眨眼/挥手/招手 idle 变体。

### 之前 (Phase A)
## v0.31.20 — 2026-05-06 · 小进养成系统 Phase A：XP / 等级 / 6 个语音入口 / 唱乘法口诀

把小进姐姐从"工具"变成"伙伴"。Selena 跟她互动越多，等级越高，解锁越多东西。

**新增：小进养成系统（src/lib/mascotProgress.ts）**
- 独立 XP（不混入 Selena 段位 XP），按互动 reason 计：
  - 开场对话 +5、当日首聊 +15、用 review 总结 +20、错题复活成功 +25 …
- 7 级阶梯：实习老师小进 → 校园老师 → 数学小老师 → 数学高手 → 数学大师 → 校园传奇 → 神级老师
- 升级解锁：音色（Tina/Cindy/Sunny/Serena/Mia/Hana）/ 隐藏技能 / Skin / 3D 形象（Phase C）

**新增：MascotProfile widget（首页）**
- 展示当前 Lv / XP 进度条 / 距下一级
- "💬 找小进"按钮 — 任意时刻 free_chat 模式语音对话
- "🎙️ 切音色" — 已解锁的可点切，没解锁的显示 🔒 Lv N 门槛

**新增：6 个语音对话入口**
1. 错题复活页 — 每行"👩‍🏫 让小进讲讲这道"按钮（带题干 + 她答 + 正确）
2. 闯关 Boss landing — 顶部"听小进讲思路"按钮（free_chat）
3. 今日挑战结算页 — "👩‍🏫 跟小进总结今天"（review_session 模式）
4. 技能树页 — 每个 skill 行加"👩‍🏫 听小进"按钮（skill_help 模式）
5. 首页 — MascotProfile 里的"💬 找小进"任意场景调用
6. 大题闯关每题答对/错后 — 复用现有 FeedbackPanel "让小进讲一讲"按钮（自动走 realtime）

**新增隐藏技能（Lv 8 解锁）：唱乘法口诀**
- 通过 prompt 注入 instructions：解锁后小进收到 "唱乘法口诀" 类请求会真的用节奏感读出来
- 不依赖 audio assets，realtime TTS 自带音频流

升级时弹 toast 显示新解锁内容；当日首聊 +15 节流（每天最多一次）。

下一阶段（Phase B）：2D skin 变体（trophyImages pipeline 复用）+ 更多隐藏技能；
Phase C：ThreeJS VRM 3D 形象（Lv 15 解锁）。

## v0.31.19 — 2026-05-06 · struggle skill 直连小进 + TutorPanel 多场景

之前红旗 skill 提示写"需要爸妈帮一下"——但现在 realtime 小进就能讲清楚，
何必非得等爸妈在身边。把每条 struggle skill 加了"👩‍🏫 找小进讲讲"按钮，
点开直接进 realtime 语音对话，prompt 里塞了"她在 X skill 上连错 N 次"
让小进开口先问她"你觉得最难的地方是什么？"——交流式而不是讲解式。

TutorPanel 接受可选 stem/correctAnswer/studentAnswer + 新 `context` 字段：
- `wrong_retry`：错答后讲题（默认，老行为）
- `skill_help`：从 home struggle 区进来，无具体题但有 skill name + 连错次数
- `review_session`：一组题做完总结（占位，下一轮做）
- `free_chat`：纯聊天（占位）

instructions 拼接根据 context 走不同分支。

## v0.31.18 — 2026-05-06 · 小进 realtime 语音对话（学情快照 + tool calls）

之前 /api/tutor/voice 走 qwen3-omni Chat Completions endpoint，账号 free tier 全 403。
重写成 dashscope realtime WebSocket 路径（qwen3.5-omni-flash-realtime），
实测延时 ~1-2s recording → speaking。

架构：
- 新 Worker `selena-tutor-realtime`（独立部署，CF Pages Functions 不支持 incoming WS）
  浏览器 ←(WSS, subprotocol bearer auth)→ Worker ←(WSS, DASHSCOPE_API_KEY)→ dashscope-intl
- 浏览器端 `src/lib/realtimeTutor.ts`：getUserMedia → AudioWorklet 切 PCM16 24kHz mono
  → input_audio_buffer.append 流式发；接 response.audio.delta 用 AudioContext 串行拼接播
- AudioWorklet processor `public/audio/pcm16-encoder-worklet.js`

学情上下文（src/lib/tutorContext.ts）：
- **Phase 2 快照**：连接时把 Selena 段位 / 7 天正确率 / 最弱 3 skill / 未解决错题数 +
  3 道代表错题塞进 instructions。她问"我最近怎么样"小进直接答，无 round-trip
- **Phase 3 tools**：`get_recent_mistakes` / `get_skill_summary` / `get_today_progress`
  通过 OpenAI realtime function-calling 协议暴露给 AI；AI 自己决定何时调
  问"具体哪几道题做错了"会触发 get_recent_mistakes 拿题干 + 她答 + 正确答案再答

TutorPanel 集成：
- 默认走 realtime（连 Worker → 对话）；连不上 / 没麦 / 没密码自动 fallback 到老的
  文本 explainQuestion 模式（保留兜底，DashScope 抽风/Selena 没装麦也不卡）
- realtime 模式下 push-to-talk 按钮直接跑 RealtimeTutor，流式字幕显示在对话区
- 显示 "🔧 小进在查最近错题…" 当 AI 触发 tool call

## v0.31.17 — 2026-05-06 · 变式题彻底不再露相同题（小进讲题后再做也换新）

用户复现：错答后看小进讲解 → 点"再做一次" → 出来的还是同一题。Selena 已经在
讲解里看到了答案，再做一遍只是把数字抄上去 = 假装会了，没真测出迁移能力。

根因（两条线）：
1. `findParallelQuestion` 严格匹配 skill+game_type+difficulty+term+subject —
   候选稀少时返 null，retry 退化成"原题再做"
2. `handleRequestVariant` 把 `sessionPlannedIds`（当前 session 还在排队的 15 道题）
   也排进 exclude，对 skill drill 来说 plan 里基本就是同 skill 的全部候选 →
   严格匹配后 candidate=0 几乎是必然
3. 变式预取是 fire-and-forget；用户秒点重做时 `variantRef.current` 还没 resolve
   → handleRetry 看到 null → 不 swap → 原题再做

修法：
- `findParallelQuestion` 改阶梯放宽：strict → 放宽 game_type → 放宽 difficulty →
  放宽 term → 同学科任意一题（保底）。pool 真空才返 null。
- `handleRequestVariant` 拿掉 `sessionPlannedIds` 排除。如果变式恰好命中 plan
  里后续的题，从 `state.questions` 里 splice 掉，避免后面又作为正题露相同题
- `GameShell.handleFinish` 改为同步 `await onRequestVariant`（IndexedDB 查 < 100ms
  无感），保证 RetryHintPanel 一显示 variantRef 就 100% 就绪
- scheduler 测试更新：原来"全 exclude → null"/"孤立 skill → null"/"不跨 term"
  这 3 条编码的是旧的严格行为，现在反过来：阶梯放宽就该返非 null

## v0.31.16 — 2026-05-06 · 修孤儿错题反复回来 + Hero 配色跟佩戴勋章走

### 错题复活页 [题目已移除] 反复出现的彻底修法
v0.30.14 加的 `cleanupOrphanMistakes` 用 `meta:orphanMistakesCleanedAt` 一次性 gate，
跑完就再也不跑。但 `cloudSync.applyPayloadMerged` 对 mistakes 做 union-by-id 合并 ——
云端旧快照里仍存在的孤儿错题被合回本地，gate 又挡着不再清，于是孤儿"复活"。
- 拿掉 meta gate：`cleanupOrphanMistakes` 改成幂等，每次启动都跑（O(N)，零成本）
- `pullFromCloud` 合并完后立刻再清一次 — 拦住云端 union 把孤儿合回来的窗口
- `pushToCloud` 内部 pre-pull 也复用同一路径，dump 之前孤儿就被清干净，不再被推回云端
- `recordDeletedQuestionIds`（admin 删题）同步删掉引用它的 mistake 行，避免新孤儿产生
- `Mistakes.tsx` + `Home.tsx` 的 mistakes 计数渲染层兜底过滤 `qmap.has(questionId)` —
  哪怕 sync 合并和 cleanup 之间有一瞬间窗口，UI 也不显示 [题目已移除]
- `cleanupOrphanMistakes` 加保险：questions 表为空（边界 / 还没 seed）时直接返回 0，
  不会把全部 mistakes 当孤儿误删

### Hero 区配色跟着佩戴的段位勋章走
之前 `TierCard` 的背景渐变 / 边框 / 文字色全部 hook 在 `rating.tier.theme` 上 ——
她戴校徽但实际段位是锦江区时，背景框是绿色（rating），徽章图却是校徽。视觉割裂。
- `TierCard` 的 `theme` 改成 `equippedBadge.theme`：戴的是哪枚徽章，框就是哪段的色
- `t.name`（"锦江区 I"）继续用 `rating.tier`，因为这是真实段位进度文字，不该被佩戴覆盖
- `TierCompact`（结算页等）行为不变，仍按 rating 染色 —— 那里没有"佩戴"概念

## v0.31.1 — 2026-05-05 · 校园探险世界观 + 闯关 gate + 今日 3 环

讨论后定下整体游戏化方向：**校园探险世界观** + **段位升级** + **gate 解锁**。

### 命名重命名（feature flag on 时生效）
- 自由练 → **专项练**；技能地图 → **技能树**
- 大题营 → **闯关**（nav 短词）/ **大题闯关**（landing H1）
- 口算 → **闪电口算**

### 移动底部 nav 压到 5 项
首页 / 闪电口算 / 今日挑战 / 闯关 / 错题复活；
专项练 + 技能树 改 `desktopOnly` + 进首页 CTA。

### 今日 3 环（Hero 底部）
新组件 `src/components/TodayRings.tsx`：
1. ⚡ 闪电口算 — 今日 ≥ 1 局即闭环
2. 🎯 今日挑战 — 已做题数 / 15
3. 🏆 今日重点（动态）— 闯关解锁接近 / 错题到期 / 考试倒计 / "今日满分"

### 闯关 gate 解锁
重写 `src/pages/BigProblems.tsx`：
- 每单元 skill 平均 ≥ 75 才解锁本单元闯关
- 锁着时显示进度条 + 展开看哪几个 skill 该刷
- 期末大闯关：6 印章齐 + G4B 全 skill 平均 ≥ 70 才开
- URL 加 `unitId` 参数 → scheduler `buildBigProblems` 按单元过滤大题

### 闯关勋章 + 通关连胜（11 枚新）
新 TrophyCategory `boss`：
- 6 单元印章（boss_G4B_U1..U6_master）
- boss_first_pass / boss_no_hint / boss_win_streak_5 / 10 / boss_final_master
- finalizeSession 里 mode=big_problems + accuracy ≥ 0.8 触发；失败重置连胜

### 1-9 × 11-19 速算 fluency 模块（"19 内速算"）
经典天才口算，p50 ≤ 2.5s + ≥ 92% + ≥ 80 题 = 通关。

### 完美一日 / 完美一周 / 生日 / 画图大师 trophy 注册
4 枚 def 注册到 catalog（实际触发逻辑后续 sprint）。

## v0.31.0 — 2026-05-05 · Phase 2 起步：4 个 axis 全部上线

### Axis 4 · 加 skill 一条龙 CLI 脚本（基建）
- 新文件 `scripts/add-skill.mjs` — 一条命令 patch 6+ 文件 + 调 AI 出题 + bump SEED_VERSION
- 安全网：`--dry-run` / `--no-gen` / 不自动 commit，所有改动 stage 给人工审 git diff
- 使用文档 `scripts/README.md`

### Axis 3 · Fluency 口算训练营（**feature flag 隐藏**）
**关键约束**：fluency 完全跟主练习题分离 — 不进 XP / 段位 / 主 mastery / 主错题表。
独立的 attempts / stats 表，独立的勋章柜，独立的雷达。

- 5 个起步模块：5×5 / 9×9 乘法口诀、20 内加减、100 内凑整速算（按 grade 自动开放）
- 每模块每次 60s × 4 选 1 速算训练；干扰项手工设计贴近常见错误
- 每 module 双指标通关：准 ≥ X% + 中位反应时 ≤ Y ms
- 6 个跨模块 trophy：飞毛腿 30/50、连击 20/30、闪电反应、模块大师
- 路由 `/math/fluency` + `/math/fluency/:moduleId`
- DB schema bump v5 → v6：新表 `fluencyAttempts` / `fluencyStats`

### Axis 1 · 大题营（多步应用题专练）
**关键约束**：5 道/场 D3-D4 多步题，不限时；XP / Elo / mastery 全走主线
（这是真实 skill 题，跟 fluency 不同）。

- 新 SessionMode `big_problems` + scheduler `buildBigProblems`
- D3-D4 + `subquestions.length > 0` 过滤；skill 多样性约束
- 路由 `/math/big-problems` landing → `/math/train?mode=big_problems`
- 复用现有 ShopCounter 模板渲染 multi-step 子问题

### Axis 2 · Canvas 真画（点子图画图）
**关键约束**：直接 SVG 点子图 + 点击格点构造多边形 + 按形状类别判分。

- 新 GameTemplate `dot_grid_draw`
- 新组件 `DotGridDraw.tsx`：W×H 网格点，点击添加顶点，自动连线，点首点闭合
- 几何判分：parallelogram / rectangle / trapezoid / isosceles_triangle /
  equilateral_triangle / right_triangle / any_triangle 7 种目标
- Question schema 加 `dot_grid` 可选字段 + 5 道 demo 题（DOT_DEMO_*）
- 后续题型（分图操作 / 三角形分类拖拽）可在 DotGridDraw 框架基础上加

### Feature flag 隔离（保护期中）
- 新文件 `src/lib/featureFlags.ts` — `isPhase2Live()`
- 三种打开方式：`localStorage.setItem("phase2_live","true")` / `?phase2=on` URL / `VITE_PHASE2_LIVE=true` 构建期
- Off 时口算 + 大题营 nav 不显示、相关路由走 ComingSoon
- 期中考完后翻 flag

### 修一个老 bug
- `src/db/seed.ts`：`backfillDeletedQuestionIdsFromSeed` 在空 DB（preview / 新装）
  时会把全部 SEED 打成"已删除"。加 `if (localSet.size === 0) return` 守卫。

### 文档
- `docs/phase2-plan.md` — 4 axis 完整 spec lock
- `scripts/README.md` — 加 skill 脚本用法

### Phase 2 后续
- Axis 2 加 2/3 种题型（分图 / 三角形分类）
- Axis 5 试卷分析 — 暂停等多模态视觉


## v0.30.14 — 2026-05-05 · SEED_VERSION 补 bump + 错题孤儿清理

**用户报告**："拉了云端最新的，admin 题量还是没有变化（v0.30.12 的 60 道新题没下来）"。

**根因**：v0.30.12 把 `aiGenG4B_U14_Pack` 加进 `SEED_QUESTIONS` 数组，但忘了
bump `SEED_VERSION`（停在 v0.28.3 的 20）。`ensureSeeded()` 看到本地 meta
`seedVersion === 20` 直接 early-return，新题永远进不来 — 现有用户全部漏发，
只有清缓存或新设备才能拿到。

**修复**：
- `src/db/seed.ts` `SEED_VERSION` 20 → 21，强制现有设备重跑 bulkPut（idempotent）。
- 顺手加 `cleanupOrphanMistakes()` 一次性 migration：清掉 `mistakes` 表里
  `questionId` 已不存在于 `questions` 表的孤儿记录。
  - Selena 实际：112 mistakes 里 62 道孤儿（56 unresolved），错题复活页几乎
    全显示 `[题目已移除]`。
  - 来源是历史 admin 清理 / seed 改版时把题删了，但没同步删 mistake 行。
  - 由 `meta:orphanMistakesCleanedAt` flag 防重跑，跨设备 sync 自然带过去。

**Visual review 一并 audit**（生产 https://selena-elevate.pages.dev）：
- 首页 Hero / 段位勋章柜 / 奖杯柜：✅ 视觉无回归
- Train / Skills / 自由练 / 错题复活 / Admin：✅ 路由 + 渲染都正常
- 题量统计页：✅ 显示正确（修复 SEED_VERSION 后会再涨 ~60 道）
- F3-F4（G4A skill 题量=0、G4B U5/U6 必考题量不足）：列入期中后待办，本次不动

**F5 修：Header 学科 chip 不再跟左上 logo 重复显示 "数"**
- 旧：右上 chip 显示当前 subject.shortLabel ("数")，左上 logo 也是 "数"，视觉冗余
- 新：chip 改成中性 ⇄ 图标 + ▾，aria-label="切换学科"，仍保留可点性
- 文件：`src/components/Layout.tsx`

**F6 修：Trophy 图统计文案 "缺 −40" 负数**
- 旧：cachedCount = 整张 trophyImages 表的行数（包含历史 orphan trophyId）；当
  trophyImages 行数 > 注册 trophy 数时 missingCount 算成负数
- 新：cachedCount 只算注册过的 trophy（intersection with allTrophyIds），
  另显示 "另有 N 张孤儿缓存（旧勋章 ID）"，missingCount=0 时显示 "全部齐了"
- 文件：`src/components/TrophyImagesAdminPanel.tsx`

## v0.30.12 — 2026-05-05 · 防刷分三层护栏 + 60 道 U1-U4 + Trophy 文字 bug 修

**痛点**：用户观察到 Selena 已经在"姊妹题刷分"——同 skill 同难度不同 question_id 来回刷。
旧 scoring 只对同一题 ID 衰减，不同题就给满分；Elo 慢慢爬；能力诊断"题量"
log(totalAttempts) 也是被刷上限 87%。

**3 层护栏全部上线**：

1. **`siblingDecayMultiplier` (XP 维度)** — 同 skill 历史 correct 数：
   0-7 满分 / 8-14 7折 / 15-22 4折 / 23+ 2折（永远 0.2，留少量鼓励）。
   跟 `repeatDecay`（同题 ID）叠乘——双层衰减。

2. **`ELO_DOMINANT_DELTA = 300` (Mastery 维度)** — 学生 Elo > 题目 Elo + 300 时，
   答对完全不涨 Elo（之前自然衰减仍允许 +4-7 慢爬）；答错仍正常降。

3. **能力诊断"题量"→"覆盖广度"** — 旧 log(totalAttempts) → 新 sum across skills
   of min(5, uniqueCorrectInSkill) 封顶 150。1 skill 100 道只 5 分；30 skill ×
   5 道才满分。tutor-correct 在 7 天准确率里也只算 0.5 跟 mastery 一致。

**G4B U1-U4 必考 skill 补强 60 道**（src/content/aiGenG4B_U14_Pack.ts）：
- 11 个必考 skill 缺口 49 道，浏览器自动跑 /api/generate/questions 4 并发
- 9 skill 全部达标；2 skill（decimal_mul_mix / decimal_work_total）LLM 反复
  超时（应用题复杂），先空着，后续 admin 手补
- 60/68 入库（8 个 dups），D2:18 / D3:8 / D4:34

**Trophy 文字 bug 大修**：
- 之前 commemorative prompt 用「${t.name}」 → AI 把 "第一步"/"期中加冕" 等中
  文名当 TEXT 渲染进图（4/4 全失败！）
- v0.30.12 加 COMMEMORATIVE_MOTIF_SPEC 4 个纯英文视觉描述，删 t.name 引用
- 4 张 commemorative 重生成全验：完全无中文 ✅

**测试**：132 → 138 pass（+6 ability test、+5 sibling test、+7 elo cap test、+5 unitUnlock 已有）

---

## v0.30.11 — 2026-05-05 · subrank_up + 五角星放胖 + 钻档动画 + 全 trophy 重做

- subrank_up 勋章（daily counter）：每升小段 +1
- commemorative 五角星 inner radius 18.6% → 30%（AI 图可见 50% → 75%）
- 钻档 3 层叠加动画（shimmer + shimmerPulse + shimmerSweep）
- buildTrophyPrompt v2 强制 fill canvas 98%+，删 8% 边距
- 浏览器跑 wan2.7-image-pro 重做 77 张 trophy 图（74 一次过 + 3 retry 都成）

---

## v0.30.10 — 2026-05-05 · 学期进度自动解锁 + 期中/期末勋章

**学期进度自动解锁排期**（`src/db/unitUnlock.ts`）：
- `UNIT_UNLOCK_SCHEDULE`：G4B_U5_EQUATIONS=2026-05-08（期中后 2 天）/
  G4B_U6_DATA=2026-06-01（6 月初）
- `runScheduledUnlocks(studentId, now)` 进 Layout 时调一次：把"今天该解锁但
  还没解锁"的单元自动开放，返回新解锁列表给 UI 弹庆祝。幂等。
- 已手动解锁的单元跳过；过期那些一次性补齐。

**单元解锁庆祝弹窗**（`UnitUnlockCelebration.tsx`）：
- 全屏 backdrop + bounce 卡片 + 6 颗 sparkle 旋转闪烁
- 自动解锁前缀"⏰ 时间到啦！"；手动解锁前缀"🎉"
- "去练一练 →" CTA 直跳 free-practice，让她试新单元的 skill

**期中 / 期末勋章实装**（phase2-special-trophies.md 1 + 2 号）：
- `midterm_done` 期中加冕：今天 ≥ MIDTERM_DATE 第一次进 app 解锁
- `final_done` 期末凯旋：今天 ≥ FINAL_DATE 同上
- 用 commemorative 类自带 dedupe，每学期 1 枚

新增 6 个测试（runScheduledUnlocks / UNIT_UNLOCK_SCHEDULE 各场景），120 / 120 pass。

---

## v0.30.9 — 2026-05-05 · 学期进度门控 + 自由练修 bug + tutor XP 0.5

**核心**：考期中只考到 U4，但每日挑战经常出 U5/U6 没学过的题 —— 加单元解锁系统。

- **`src/db/unitUnlock.ts`**：每个 (studentId, term) 维护已解锁 unitId 集合，
  默认 G4A 全开 / G4B U1-U4（期中范围）/ 综合复习 = 上下册 union
- **`UnitProgress` 组件**：Home 页折叠卡，按顺序显示所有单元 + 解锁/锁回按钮，
  强制按顺序解锁（U6 必须先解 U5）
- **过滤生效在 3 处**：buildDailySession / SkillPicker / bgGen 都跳过锁定单元
- **期中/期末/模拟考保留 hard-coded 范围**，不受 unlock 限制（这些就是测覆盖范围）

**自由练自动选 4 个最弱 bug 修**（SkillPicker.tsx）：
- 之前所有未练过 skill mastery score 都 ?? 50 → 并列 → JS sort stable
  退回到 SKILLS 数组顺序 → 看起来"选最前面 4 个"
- 现在显式 weaknessRank：已尝试 score=0 → rank=100（最优先）/
  未尝试 → rank=50 / 已尝试 score=100 → rank=0

**tutor-assisted XP 0.7 → 0.5**（scoring.ts）：
"分数偏严比虚高好；错题以后还能再做拿分，现在不要慷慨加分"

7 个 unitUnlock 测试，114 / 114 pass。

---

## v0.30.8 — 2026-05-05 · 错题后给"同型同难度变式题"重做

**痛点**：v0.30.7 让错→讲题→对扣了 XP 和 combo，但学生还是在重做"刚看过答案的同一道题"——把数字背下来就能对，不是真理解。

**解法**：1st 错答后自动从题库找一道：
  - 同 skill_id（学的概念相同）/ 同 game_type（UI 玩法相同）/ 同 difficulty
  - 不同 question_id（强迫迁移到新情境）
  - 用户从未见过的优先（最锐利的"是否真会"测试）

变式题就绪 → "再做一次"时 swap 显示。变式题不存在 → fallback 同题重做。
`findParallelQuestion` in `src/core/scheduler.ts`，5 个 test。

---

## v0.30.7 — 2026-05-05 · 讲题/重做计分大改 — 防"刷讲题"

**痛点**：错→讲题→对，combo 累积 + summary "全对" + mastery 涨满，跟独立答对几乎一样。重复同题重复讲题重复做对就成了刷分。

**对照表**：

| 维度 | 直接答对 | 自己重做对 | 讲题后做对 | 直接错 |
|---|---|---|---|---|
| XP base | 100% | 100% | **70%（v0.30.9 改 50%）** | 20% |
| Combo +1 | ✓ | ✗ | ✗ | ✗ |
| 速度奖励 | ✓ | ✗ | ✗ | ✗ |
| 新 skill +5 | ✓ | ✗ | ✗ | ✗ |
| Elo actual | 1.0 | 1.0 | **0.5** | 0 |
| Mistake 入库 | — | ✓（1st 错时）| ✓ | ✓ |
| Mistake stage 推进 | ✓ | ✗ | ✗ | regress |

核心：combo 是"独立连续答对"勋章；mistake 入库永远基于 1st 错答事实；
重复"刷讲题"被 repeatDecay 进一步削减（5 次后 0 XP）。

新加 schema 字段：`Attempt.usedTutor` / `Attempt.attemptOrdinal` /
`MasteryRecentEntry.usedTutor` / `SessionSummary.tutorAssistedCount` /
`SessionSummary.firstTryCorrectCount`。

结算页加"X 道一遍就对 · X 道讲题后才对"真实统计。

6 个新 scoring test，102 / 102 pass。

---

## v0.30.0 ~ v0.30.6 — 2026-05-04 · Hero 大改 + 题库补强 + 校徽

跨多个迭代：

- **G4B AI 题库补强**：浏览器自动化跑 /api/generate/questions，DashScope qwen-plus
  出题 18 个 G4B skill 各补 4-12 道。174 道 → 153 入选（去重 + 禁词扫 + answer.type 校验）
- **AI provider 分流**：chat 用 DashScope（qwen-plus 25s 内可返回），image 用
  token-plan（wan2.7-image-pro 比 wanx2.1-turbo 强很多）
- **Hero 重设计**（TierCard.tsx）：BIG 校徽 210px 移右、段位文字捆绑校徽下方、
  能力诊断折叠、垂直节奏 4-base grid、双 rim 冲突删 CSS ring
- **校徽 sharpness**：tier badge 压缩 256→512 q=0.92 retina 不糊
- **Tier badge prompt v2**：勋章圆形 fill 整画面 98%+、内部 tier 主题色径向渐变、
  绝对禁文字
- **5 段位校徽 AI 重生成**：用 wan2.7-image-pro 出，全无黑边
- **Cache key 统一**：Hero / 段位勋章柜 / XP 下小图都用同一 `math_tier_${id}`

---

## v0.28.0 — 2026-05-04 · 掌握度算法换骨

**核心改动**：mastery 算法重写为 Elo + 滚动窗口 + 难度加权 + Fragility。

老算法（v0.27 之前）每对一题固定 +2.4~3.5 分、不衰减、不区分新旧、5 道唯一题就解锁 80 分上限 → 25 题就全"熟练"，跟模考 75% 严重不一致。

新算法：
- **学生 Elo**（一个数字）：每次答题双向更新；难题答对涨得多
- **滚动窗口加权命中率**：最近 30 题，时间衰减半衰期 14 天 + 难度权重 0.7~1.5
- **多样性**：最近 10 题不同 questionId 数 / 4
- **Fragility 上限 45**：21 天没答对 / 最近 5 错 3 时强制掉到"较稳"以下

新阈值 **6 档**：未涉足 (0-19) → 见过几次 → 进步中 → 较稳 → **熟练 (75-89)** → **精通 (90-100)**

Dexie v5 自动 upgrade：扫所有现有 attempt 重放算法，回填 studentElo / recent / lastSuccessAt 等字段。

借鉴：Duolingo Birdbrain（Elo 自校准）+ Khan Academy（5-in-a-row + 时间门）+ FSRS（遗忘曲线）+ PFA（recency weighting）。

---

## v0.27.2 — 2026-05-04 · 奖杯柜视觉清理

- 奖杯卡片去掉外层 amber 边框 + shadow（之前和 TrophyIcon 自己的 ring 双框过密）
- TrophyIcon emoji 兜底也去掉显式 border
- 奖杯柜头部加 chip "✨ N 枚还没 AI 图"，深链 `/math/admin#trophy-images` → 可一键批量补图
- AdminPage 加 useLocation hash 监听，进页面后自动 scrollIntoView 到对应 id 的 card

## v0.27.1 — 2026-05-04 · 自由练串题 + 模考历史

**P0 路由 bug**：`SkillPicker` 用 `/train?skillIds=...` 老路径，被 `<Navigate to="/math/train">` 兜底重定向时**丢 query string**，导致选 A 出 B → 自由练永远变成"每日挑战出最弱 skill"。修复 SkillPicker 走绝对路径 `/math/train`，router 加 LegacyRedirect 组件透传 search + hash。

其他：
- AI 勋章图终于显示在奖杯柜（TrophyWall 用 `<TrophyIcon>` 组件读 `db.trophyImages`）
- 删除 v0.27.0 加的 TrophyWall 段位徽章分组（跟 BadgeInventory 重复）
- 每日挑战变跨 3 个最弱 skill 出 15 道综合题（之前单 skill 5 道）；自由练保持单 skill 8 道
- 模拟考试历史在周报页可查（最近 5 条 + 可展开 20 条）
- math navItems 加"周报"入口

## v0.27.0 — 2026-05-04 · 段位徽章 + Prompts MD + 出题守 skill + 小进对话日志

- **Prompts 全部抽到 `/prompts/**/*.md`**，`scripts/build-prompts.mjs` 编译进 `functions/_prompts.generated.ts` + `src/lib/_prompts.generated.ts`
- 加 6 个 game-type schema：`plain_choice` / `cube_view` / `balance_lab` / `decimal_shifter` / `triangle_judge` / `shop_counter`
- **出题守 skill**：服务端按 `prompts/skill-keywords.json` 校验 stem 是否真的扣 skill，否则丢弃重试。修了"用户选 cube_shape_count 但 LLM 偷懒生成平均数"的 bug
- 小进对话日志：Dexie v4 加 `tutorSessions` 表，TutorPanel 每条消息增量写回 db；cloudSync 加进 PUSH_TABLES
- 段位徽章奖杯墙分组（v0.27.1 移除，跟 BadgeInventory 重复）

## v0.26 系列（v0.26.0 ~ v0.26.12） — 2026-05-03 · 出题超时 + 题库诊断 + 系统修复

跨多个迭代：

- **AI 出题超时根因**：DashScope FreeTier 限制 + 部分 model 不支持 `enable_thinking=false`。Provider 顺序改 dashscope-first（qwen-plus 是唯一稳定可用的），enable_thinking 仅对 qwen3.x 生效，per-provider lazy 30s budget
- **题库诊断面板** (`QuestionsAdminPanel`)：列出每 skill 题数、bad question 检测 (game-type 感知)、按 skill trim 到 30 题
- **mastery 防刷分**：同题重复对衰减 + 唯一题数封顶 30+N×10（v0.28 整体重写后这个垫层弃用）
- **AI 勋章图缓存**：512×512 sticker + 圆形遮罩 + 段位 badge 专门 prompt
- **段位 + milestone 盲盒**：rare trophy 解锁时 LotteryBoxModal 抽奖生成专属图，常规增量解锁不抽
- **小进吉祥物**：四川大熊猫 + 学士帽 + 魔法棒，所有 AI loading 状态都用她
- **数据 sync 修复**：pull 改用 merge-by-timestamp，本地不被远程旧快照覆盖；chinese train 完成时 push
- **chinese train 模拟考完成 push 修了**

## v0.25.0 — 2026-04-XX · AI 勋章图 + 盲盒 + bg gen 指示器 + resume fix

第一次接 wan2.7-image-pro 出图。盲盒 modal + 烟花 reveal 动画。BgGenIndicator 全局 toast 显示后台出题进度。

---

## 早期里程碑（v0.8 ~ v0.24）

详细 PRD 在 `heping_math_prd_v2.md` 和 `heping_math_prd_engineering_v1.md`。关键：

- **v0.20+**：多学科架构（数学 + 语文 ComingSoon）、嵌套路由 `/:subject/...`、Dexie v2 学科隔离 migration
- **v0.15+**：14 个游戏模板齐活（balance_lab / cube_view / triangle_judge 等带 SVG 视觉）
- **v0.10+**：试卷错题包导入（U2 / U3 / U4 三张过关检测卷）、`wrong_origin` 标签调度优先
- **v0.8.1**：22 种奖杯（单次型 + 计数型 ×N 显示）、期中冲刺模式 `mode=midterm`
