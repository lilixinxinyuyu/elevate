# Selena 题库质量规范（rock-solid）

> 这份规范是出题（generation）和质检（judging）**共用的**唯一真相。
> 出题模型按它生成；质检模型按它判定。任何冲突以本文档为准。

---

## 1. 教材范围（不许超纲，不许跑题）

### 数学（北师大版四年级）

- **下册** 涵盖：小数的意义和加减、认识方程、观察物体、三角形、小数乘法、平均数、复式条形图。（unit_id 以 `G4B_` 开头，但 term 字段值是 `"下册"`）
- **上册** 涵盖：大数认识、线与角、三位数乘两位数、运算律、方向与位置、除法、生活中的负数、可能性。（unit_id 以 `G4A_` 开头，但 term 字段值是 `"上册"`）
- ⛔ **不许超纲**：比例、百分数、函数、图形旋转坐标、立体体积公式（5 年级及以上内容禁止）。
- ⛔ **不许跑题**：题干必须紧扣传入的 `skill_id` 主题。让出 "积的小数位数" 却写 "求平均数" 是严重错误。

### 语文（人教版四年级）

- **下册**：1-4 单元字音字形 / 古诗 / 修辞 / 听写词语 / 阅读。
- **上册**：5-8 单元同上。
- ⛔ 不出 5 年级及以上内容（说明文复杂题、文言文长篇）。

### ⛔ term 字段写法（极重要）

- ✅ `"term": "下册"` 或 `"term": "上册"` — 这是允许的两个值（外加 `"综合复习"`）。
- ❌ `"term": "G4B"` / `"term": "G4A"` — 不允许，G4A/G4B 只是 unit_id 的前缀。
- ❌ `"term": "下册（G4B）"` — 不允许，term 必须是干净的两字 / 三字字符串。

---

## 1.5 必填枚举字段字典（Schema Enum — 严格选值）

任何不在下方清单的字符串都会让题被 zod 校验拒收。**不要翻译、不要意译、不要新造词**。

| 字段 | 合法值 | 常见错误 |
|---|---|---|
| `term` | `"上册"` / `"下册"` / `"综合复习"` | ❌ `"G4A"` / `"G4B"`（这是 unit_id 前缀，不是 term）|
| `cognitive_level` | `"recall"` / `"procedural"` / `"application"` / `"reasoning"` | ❌ `"conceptual"` / `"understanding"` / `"analysis"` |
| `ability_dimension[]` | 数组元素从 `["calculation","concept","reasoning","modeling","spatial","data","strategy","habit"]` 选 | ❌ `"conceptual"`（应该是 `"concept"`）|
| `question_format` | `"numeric"` / `"numeric_choice"` / `"single_choice"` / `"multi_choice"` / `"multi_step"` / `"fill_blank"` / `"drag_drop"` / `"sort_ladder"` / `"geometry_operation"` | ❌ `"choice"` / `"text"` |
| `exam_priority` | `"MUST_BIG"` / `"HIGH_BIG"` / `"MUST_SMALL"` / `"VERY_HIGH_SMALL"` / `"HIGH_SMALL"` / `"NORMAL"` / `"LOW"` / `"LOW_SMALL"` / `"EXTENSION"` | ❌ `"HIGH"` / `"VERY_HIGH"` |
| `status` | `"draft"` / `"validated"` / `"approved"` / `"active"` / `"retired"` / `"needs_review"` / `"rejected"` | 默认填 `"approved"` |
| `game_type` / `play_as` | 见对应 schema 文件，与文件名同名（如 `"plain_choice"`） | 不要乱起 |
| `difficulty` | 整数 1 / 2 / 3 / 4 / 5 | ❌ `"3"` / `3.5` |
| `grade` | 数字 4 | ❌ `"4"` / `"四年级"` |
| `answer.type` | `"choice"` / `"numeric"` / `"text"` / `"multi_step"` | 与 game_type 配对 |

⚠️ **`concept` vs `conceptual` 容易写错**：
- `ability_dimension` 用 `"concept"`（概念力）
- `cognitive_level` 用 `"recall"`/`"procedural"`/`"application"`/`"reasoning"` —— **没有 `"conceptual"` 选项**

## 2. 题型与必备字段

所有题型必须有：

| 字段 | 说明 |
|---|---|
| `question_id` | 唯一 id，AI 题以 `AI_` 开头 |
| `subjectId` | `"math"` / `"chinese"` |
| `stem` | 题干，**≥ 8 个汉字**，紧扣 skill_id |
| `skill_id` / `skill_name` | 必须真实存在 |
| `unit_id` / `unit_name` | 必须真实存在 |
| `difficulty` | 1-5 整数，3 = 单元中等 |
| `estimated_time_seconds` | 按下方时间表给，不能瞎填 |
| `solution_steps` | 至少 1 步分析 |
| `hints` | 至少 1 条提示，含 `{ text, penalty }` |
| `feedback_correct` / `feedback_wrong` | 各一句话 |
| `common_errors` | ≥ 2 项，每项 `{ tag, error, remediation }` |
| `tags` | 数组，AI 题必须含 `"ai_generated"` |

按题型差异化的字段：

- **plain_choice / cube_view / balance_lab / decimal_shifter / triangle_judge / shop_counter**
  → `options: [{id:"A",text:"..."}, ...]`（4 选 1）+ `answer: { type:"choice", value:"A" }`
- **word_problem_lab**
  → `subquestions: [...]`（clue_pick / choose / numeric 三步）+ `answer: { type:"multi_step", steps:[...] }`
- **vertical_repair / equation_builder / speed_match** 等迷你游戏
  → 题型特定 schema，不需要 options

---

## 3. 答题时间表（estimated_time_seconds）

系统按 `elapsed/estimated` 算速度奖励：< 50% 闪电 +5 / < 80% 迅速 +3 / ≤ 100% 及时 +2 / > 100% 0 分 / > 150% 自动判错。所以时间值不能瞎填。

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
| 语文 拼音/字音 | 12s | 16s | 20s |
| 语文 古诗补字 | 22s | 28s | 35s |
| 语文 听写 | 20s | 28s | 40s |
| 语文 修辞/句子 | 25s | 32s | 45s |
| 语文 阅读理解（多段+多题） | 90s | 120s | 180s |

---

## 4. 题干语言质量（v0.28.3 加强 — 严格执行）

### 4.1 ⛔ 禁用动词（数学题干里）

- **输 / 输入 / 报 / 送 / 提交 / 填入数字** → 用 "答" / "选" / "写出"
- **错误**：`x = 7 是不是方程的解？是输 1，否输 0`
- **正确**：`x = 7 是不是方程 x + 5 = 12 的解？是 → 答 1，不是 → 答 0`

### 4.2 ⛔ 禁用句式

绝对不要生成下列形式的题干，4 年级孩子读不懂、家长头疼、立刻丢弃：

- ❌ `0.30 和 0.3，相等输 0` — 用 "输 N" 指令式说法
- ❌ `0.6 表示 6 个？（输入数值：0.1 输 0.1）` — 题干嵌指令带括号注释
- ❌ `x = 5 是不是解？输 1 输 0` — 是非题硬塞数字输入
- ❌ `0.45 中的 5 在哪一位？(1=十分位 2=百分位)` — 选项解释藏在括号里

### 4.3 ✅ 正确写法

- ✅ `0.30 和 0.3 相等吗？相等→答 0，不等→答 1` — 用 "答" 代替 "输"
- ✅ 是非题用 plain_choice，options 是 "是" / "不是" / "无法判断" / "题目有错"
- ✅ `0.6 里面有几个 0.1？` → 直接问数量，options 是 6 / 60 / 0.06 / 0.1
- ✅ `下面排列从小到大正确的是？` → plain_choice，options 是完整不等式

### 4.4 stem 长度

- **≥ 8 个汉字字符**。少于 8 字几乎肯定是 LLM 失误。

### 4.5 stem ↔ options 类型一致

| stem 形式 | options 必须是 |
|---|---|
| `多少 / 几 / 是 X / 等于多少` 等问数字 | 全部数字（含单位前缀也算） |
| `哪个对 / 下面…正确的是` 等问选项 | 完整短句或表达式 |

⛔ **绝对禁止**：stem 是数值题但 options 混入纯中文短语；或反过来。

---

## 5. 4 选 1 干扰项设计

每道选择题需要 **1 正确 + 3 高质量干扰项**：

- 1 个正确
- 1 个 "操作反了"（比较时方向反 / 加减反 / 单位错）
- 1 个 "漏一步"（少进位 / 少借位 / 少乘）
- 1 个 "接近但典型错误"（小数点放错位 / 多个零少个零）

⛔ **不要让 4 个选项相邻 1**（如 5/6/7/8）— 区分度太低。

---

## 6. 答案与解析

- `answer.value` **必须**指向一个真实存在的 option id（A/B/C/D）。
- `solution_steps` 至少 1 步，简洁说明思路（不是抄题面）。
- `feedback_correct` / `feedback_wrong` 各一句话，用儿童化鼓励语气，不要罗嗦。
- `common_errors` ≥ 2 项，`tag` 用学科常用 error tag（数学如 `decimal_point_error`、`carry_missing`；语文如 `wrong_phonics`、`stroke_order_error`）。
- `hints` ≥ 1 条，每条带 `penalty`（提示越具体扣分越多）。

---

## 7. 内容守则

- ⛔ 不重复题干（参考已有 stems 列表，换情境/换数字/换字词组合）
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

⛔ **不要给 4 年级出难度 5 的奥数题**（如复杂数论、组合数学）。

---

## 9. 严重程度（severity）— 仅质检时使用

判定题目时按下面标准给 severity 1-5：

| severity | 含义 | 处理 |
|---|---|---|
| 5 | 关键 bug：答案错 / 超纲 / 完全跑题 / 题干无意义 | **删除** |
| 4 | 严重质量问题：含禁用动词（输/报）/ stem<8字 / stem ↔ options 类型不匹配 / answer 不指向 option | **删除** |
| 3 | 较明显瑕疵：区分度不足 / 干扰项过远 / 提示太弱 / 时间值偏离表格 | **borderline**（可保留可改） |
| 2 | 轻微：标点/用词不规范、`common_errors` 不够 2 项、tag 拼写非标 | **borderline** |
| 1 | 几乎完美 | **keep** |
