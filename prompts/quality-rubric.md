# Selena 题库附加要求（搭配四原则使用）

> 本文是**机械约束**清单（题型、字段、时间、字数等可工程化检查的事项）。
> 价值观层面的判定见 [quality-principles.md](./quality-principles.md) — 那 4 条是核心，本文是辅助。

---

## 1. 教材范围

<!--SUBJ:MATH-->
### 数学（北师大版四年级）

- **下册** 涵盖：小数的意义和加减、认识方程、观察物体、三角形、小数乘法、平均数、复式条形图。（unit_id 以 `G4B_` 开头，term 字段值是 `"下册"`）
- **上册** 涵盖：大数认识、线与角、三位数乘两位数、运算律、方向与位置、除法、生活中的负数、可能性。（unit_id 以 `G4A_` 开头，term 字段值是 `"上册"`）
- ⛔ **不许超纲**：比例、百分数、函数、图形旋转坐标、立体体积公式（5 年级及以上禁止）。
- ⛔ **不许跑题**：题干必须紧扣 `skill_id` 主题。出"积的小数位数"却写"求平均数"是严重错误。
<!--/SUBJ:MATH-->

<!--SUBJ:CHINESE-->
### 语文（人教版四年级）

- **下册**：1-4 单元字音字形 / 古诗 / 修辞 / 听写词语 / 阅读。
- **上册**：5-8 单元同上。
- ⛔ 不出 5 年级及以上内容（说明文复杂题、文言文长篇）。
<!--/SUBJ:CHINESE-->

---

## 2. 题型必备字段

所有题型都必须包含：

| 字段 | 说明 |
|---|---|
| `question_id` | 唯一 id，AI 题以 `AI_` 开头 |
| `stem` | 题干，**≥ 8 个汉字**，紧扣 skill_id |
| `solution_steps` | 至少 1 步分析（字符串数组） |
| `hints` | 至少 1 条 `{ text, penalty }`（penalty 整数 1-3） |
| `feedback_correct` / `feedback_wrong` | 各一句话，儿童化语气 |
| `common_errors` | ≥ 2 项 `{ tag, error, remediation }` |
| `tags` | 数组，AI 题必须含 `"ai_generated"` |

> **注意**：`subjectId` / `term` / `unit_id` / `unit_name` / `skill_id` / `skill_name` / `grade` / `difficulty` / `game_type` / `question_format` / `estimated_time_seconds` / `exam_priority` / `ability_dimension` / `cognitive_level` / `status` 这些字段**会由系统在 user prompt 的「已确定的元数据」段告诉你确切的值，原样抄进每道题即可，不要自行造值**。

按题型差异化的字段：

- **plain_choice / cube_view / balance_lab / decimal_shifter / triangle_judge / shop_counter**
  → `options: [{id:"A",text:"..."}, ...]` (4 选 1) + `answer: { type:"choice", value:"A" }`
- **word_problem_lab**
  → `subquestions: [...]` (clue_pick / choose / numeric 三步) + `answer: { type:"multi_step", steps:[...] }`
- **vertical_repair / equation_builder / speed_match** 等迷你游戏
  → 题型特定 schema，不需要 options

---

## 3. 时间表（estimated_time_seconds）

> 调用方会在「已确定的元数据」给你 `estimated_time_seconds` 的具体值。下表只是参考。

系统按 `elapsed/estimated` 算速度奖励：< 50% 闪电 +5 / < 80% 迅速 +3 / ≤ 100% 及时 +2 / > 100% 0 分 / > 150% 自动判错。

<!--SUBJ:MATH-->
| game_type | 难度 1-2 | 难度 3 | 难度 4-5 |
|---|---|---|---|
| `speed_match`（口算/快判） | 10s | 15s | 20s |
| `plain_choice`（4 选 1） | 20s | 30s | 40s |
| `decimal_shifter`（小数点） | 18s | 25s | 35s |
| `cube_view`（立体观察） | 25s | 35s | 50s |
| `triangle_judge`（三角形） | 22s | 30s | 40s |
| `vertical_repair`（竖式） | 25s | 35s | 45s |
| `balance_lab`（天平） | 35s | 50s | 65s |
| `shop_counter`（购物） | 35s | 50s | 70s |
| `clue_finder`（应用题读题） | 35s | 45s | 60s |
| `word_problem_lab`（分阶段应用题） | 70s | 90s | 130s |
<!--/SUBJ:MATH-->

<!--SUBJ:CHINESE-->
| game_type | 难度 1-2 | 难度 3 | 难度 4-5 |
|---|---|---|---|
| 拼音/字音 | 12s | 16s | 20s |
| 古诗补字 | 22s | 28s | 35s |
| 听写 | 20s | 28s | 40s |
| 修辞/句子 | 25s | 32s | 45s |
| 阅读理解（多段+多题） | 90s | 120s | 180s |
<!--/SUBJ:CHINESE-->

### 长题加成

stem 60-119 字 +15s；stem ≥ 120 字 +25s（不与上一条叠加）；任一 option > 20 字 / 多行 +15s；含图示/表格/竖式 +20s。最终 20-180s 内（语文阅读理解可到 240s）。

---

## 4. 题干语言质量

<!--SUBJ:MATH-->
### 4.1 ⛔ 禁用动词（数学）

- **输 / 输入 / 报 / 送 / 提交 / 填入数字** → 用 "答" / "选" / "写出"
- ❌ `x = 7 是不是方程的解？是输 1，否输 0`
- ✅ `x = 7 是不是方程 x + 5 = 12 的解？是 → 答 1，不是 → 答 0`

### 4.2 ⛔ 禁用句式

- ❌ `0.30 和 0.3，相等输 0` — "输 N" 指令式
- ❌ `0.6 表示 6 个？(输入数值：0.1 输 0.1)` — 题干嵌指令带括号注释
- ❌ `0.45 中的 5 在哪一位？(1=十分位 2=百分位)` — 选项解释藏括号

### 4.3 ✅ 正确写法

- ✅ `0.30 和 0.3 相等吗？相等→答 0，不等→答 1`
- ✅ 是非题用 plain_choice，options 是 "是" / "不是" / "无法判断"
- ✅ `0.6 里面有几个 0.1？` → 直接问数量
<!--/SUBJ:MATH-->

### 4.4 stem 长度

**≥ 8 个汉字字符**。少于 8 字几乎肯定是失误。

### 4.5 stem ↔ options 类型一致

| stem 形式 | options 必须是 |
|---|---|
| `多少 / 几 / 是 X / 等于多少` 问数字 | 全部数字（含单位前缀也算） |
| `哪个对 / 下面…正确的是` 问选项 | 完整短句或表达式 |

⛔ **禁止**：stem 是数值题但 options 混入纯中文短语；或反过来。

<!--SUBJ:CHINESE-->
### 4.6 ⛔ 「看拼音写字 / 听写」答案泄露禁令

**适用**：`subjectId="chinese"` 且 `skill_id` 以 `_PINYIN` 或 `_DICTATION` 结尾，stem 给的是拼音（含声调字符）。

**禁止**：在 `hints[].text` / `solution_steps[]` / `common_errors[].error` / `common_errors[].remediation` / `feedback_correct` / `feedback_wrong` 里出现 `answer` 对应的目标汉字（前提是该字没在 stem 已经写出来）。

例：stem 是「sù xīn shì xú gōng diàn」(answer=宿新市徐公店)
- ❌ `hints: [{ text: "宿是宝盖头加百" }]` — 直接露出「宿」
- ✅ `hints: [{ text: "第一字宝盖头下面是「百」字底" }]` — 用部首线索

**自查**：列出 answer 汉字，逐字在 hints/solution/common_errors/feedback 里搜，命中改写。
<!--/SUBJ:CHINESE-->

---

## 5. 4 选 1 干扰项设计（具体落地见原则 P3）

<!--SUBJ:MATH-->
**1 正确 + 3 高质量干扰项的常见来源**：

- 1 个 "操作反了"（比较时方向反 / 加减反 / 单位错）
- 1 个 "漏一步"（少进位 / 少借位 / 少乘）
- 1 个 "接近但典型错误"（小数点放错位 / 多个零少个零）
<!--/SUBJ:MATH-->

⛔ **不要让 4 个选项相邻 1**（如 5/6/7/8）— 区分度太低。
⛔ **不要使用题中给定数字的直接衍生**（如 6x 的值、总数 / 倍数 等）— 见原则 P3。

---

## 6. 答案与解析

- `answer.value` **必须**指向真实存在的 option id（A/B/C/D）。
- `solution_steps` 至少 1 步，简洁说明思路。
- `feedback_correct` / `feedback_wrong` 各一句话，儿童化鼓励语气。
- `common_errors` ≥ 2 项，`tag` 用学科常用 error tag。
- `hints` ≥ 1 条，每条带 `penalty`（提示越具体扣分越多）。

---

## 7. 内容守则

- ⛔ 不重复题干（参考已有 stems 列表，换情境/换数字/换字词）
- ⛔ 不出现真实姓名（用 "小明" / "小红" 虚拟角色）
- ⛔ 不放广告、政治、负面词
- ✅ 题干用中文标点 + 半角数字
- ✅ 选项之间区分度大

---

## 8. 难度标准

| difficulty | 含义 |
|---|---|
| 1 | 单元最基础（识别概念、读数、对照表格） |
| 2 | 一步运算 / 简单应用 |
| 3 | 单元中等（默认 difficulty） |
| 4 | 多步运算 / 较复杂应用题 |
| 5 | 综合（跨概念，期末压轴级别） |

⛔ **不要给 4 年级出难度 5 的奥数题**（复杂数论、组合数学）。
