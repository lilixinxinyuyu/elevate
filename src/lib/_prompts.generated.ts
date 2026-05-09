/**
 * 自动生成 — 不要手改。
 * 改 prompts 请编辑 /prompts/**.md，然后跑 `pnpm build` 或 `node scripts/build-prompts.mjs`。
 *
 * 源文件：
 *   - prompts/quality-rubric.md          (rock-solid 出题/质检共享规范)
 *   - prompts/questions/system.md        (出题 system，内联 rubric)
 *   - prompts/questions/user-template.md
 *   - prompts/questions/game-types/*.md
 *   - prompts/quality-judge/system.md    (质检 system，内联 rubric)
 *   - prompts/quality-judge/user-template.md
 *   - prompts/tutor/text-system.md
 *   - prompts/tutor/voice-system.md
 *   - prompts/mascot/xiaojin.md
 *   - prompts/skill-keywords.json
 *   - prompts/game-type-by-skill.json
 */

export const PROMPTS = {
  "questionsSystem": "你是 4 年级女生 Selena 的 {{subjectLabel}} 出题助手。\n\n## 任务\n\n按下方\"出题质量规范\"生成题目。**所有规则严格遵守，规范优先级 > 你的过往训练偏好。**\n\n## 输出协议（必须严格遵守）\n\n输出顶层 `{ \"questions\": [...] }` JSON，**不要**包 markdown 代码块，**不要**写解释文字，**不要**多余字段。\n\n具体题型 schema 见 user prompt 里注入的 game-type 片段（如 plain_choice / word_problem_lab / cube_view 等）。每道题严格按那个 schema 的字段输出。\n\n---\n\n# 出题质量规范\n\n# Selena 题库质量规范（rock-solid）\n\n> 这份规范是出题（generation）和质检（judging）**共用的**唯一真相。\n> 出题模型按它生成；质检模型按它判定。任何冲突以本文档为准。\n\n---\n\n## 1. 教材范围（不许超纲，不许跑题）\n\n### 数学（北师大版四年级）\n\n- **下册** 涵盖：小数的意义和加减、认识方程、观察物体、三角形、小数乘法、平均数、复式条形图。（unit_id 以 `G4B_` 开头，但 term 字段值是 `\"下册\"`）\n- **上册** 涵盖：大数认识、线与角、三位数乘两位数、运算律、方向与位置、除法、生活中的负数、可能性。（unit_id 以 `G4A_` 开头，但 term 字段值是 `\"上册\"`）\n- ⛔ **不许超纲**：比例、百分数、函数、图形旋转坐标、立体体积公式（5 年级及以上内容禁止）。\n- ⛔ **不许跑题**：题干必须紧扣传入的 `skill_id` 主题。让出 \"积的小数位数\" 却写 \"求平均数\" 是严重错误。\n\n### 语文（人教版四年级）\n\n- **下册**：1-4 单元字音字形 / 古诗 / 修辞 / 听写词语 / 阅读。\n- **上册**：5-8 单元同上。\n- ⛔ 不出 5 年级及以上内容（说明文复杂题、文言文长篇）。\n\n### ⛔ term 字段写法（极重要）\n\n- ✅ `\"term\": \"下册\"` 或 `\"term\": \"上册\"` — 这是允许的两个值（外加 `\"综合复习\"`）。\n- ❌ `\"term\": \"G4B\"` / `\"term\": \"G4A\"` — 不允许，G4A/G4B 只是 unit_id 的前缀。\n- ❌ `\"term\": \"下册（G4B）\"` — 不允许，term 必须是干净的两字 / 三字字符串。\n\n---\n\n## 1.5 必填枚举字段字典（Schema Enum — 严格选值）\n\n任何不在下方清单的字符串都会让题被 zod 校验拒收。**不要翻译、不要意译、不要新造词**。\n\n| 字段 | 合法值 | 常见错误 |\n|---|---|---|\n| `term` | `\"上册\"` / `\"下册\"` / `\"综合复习\"` | ❌ `\"G4A\"` / `\"G4B\"`（这是 unit_id 前缀，不是 term）|\n| `cognitive_level` | `\"recall\"` / `\"procedural\"` / `\"application\"` / `\"reasoning\"` | ❌ `\"conceptual\"` / `\"understanding\"` / `\"analysis\"` |\n| `ability_dimension[]` | 数组元素从 `[\"calculation\",\"concept\",\"reasoning\",\"modeling\",\"spatial\",\"data\",\"strategy\",\"habit\"]` 选 | ❌ `\"conceptual\"`（应该是 `\"concept\"`）|\n| `question_format` | `\"numeric\"` / `\"numeric_choice\"` / `\"single_choice\"` / `\"multi_choice\"` / `\"multi_step\"` / `\"fill_blank\"` / `\"drag_drop\"` / `\"sort_ladder\"` / `\"geometry_operation\"` | ❌ `\"choice\"` / `\"text\"` |\n| `exam_priority` | `\"MUST_BIG\"` / `\"HIGH_BIG\"` / `\"MUST_SMALL\"` / `\"VERY_HIGH_SMALL\"` / `\"HIGH_SMALL\"` / `\"NORMAL\"` / `\"LOW\"` / `\"LOW_SMALL\"` / `\"EXTENSION\"` | ❌ `\"HIGH\"` / `\"VERY_HIGH\"` |\n| `status` | `\"draft\"` / `\"validated\"` / `\"approved\"` / `\"active\"` / `\"retired\"` / `\"needs_review\"` / `\"rejected\"` | 默认填 `\"approved\"` |\n| `game_type` / `play_as` | 见对应 schema 文件，与文件名同名（如 `\"plain_choice\"`） | 不要乱起 |\n| `difficulty` | 整数 1 / 2 / 3 / 4 / 5 | ❌ `\"3\"` / `3.5` |\n| `grade` | 数字 4 | ❌ `\"4\"` / `\"四年级\"` |\n| `answer.type` | `\"choice\"` / `\"number\"` / `\"multi_step\"` | 与 game_type 配对。**注意**：是 `\"number\"` 不是 `\"numeric\"`（\"numeric\" 是 question_format 的值，不能放这里）；schema 也没有 `\"text\"` |\n\n⚠️ **`concept` vs `conceptual` 容易写错**：\n- `ability_dimension` 用 `\"concept\"`（概念力）\n- `cognitive_level` 用 `\"recall\"`/`\"procedural\"`/`\"application\"`/`\"reasoning\"` —— **没有 `\"conceptual\"` 选项**\n\n⚠️ **两个 enum 互不通用 — 不要混入对方的值**：\n\n| 字段 | 合法值（仅这些） |\n|---|---|\n| `ability_dimension[]` | `calculation` / `concept` / `reasoning` / `modeling` / `spatial` / `data` / `strategy` / `habit` |\n| `cognitive_level` | `recall` / `procedural` / `application` / `reasoning` |\n\n**❌ 常见错误**：\n- 把 `\"procedural\"` 塞到 `ability_dimension` —— **不行**，`procedural` 是 cognitive_level 专用\n- 把 `\"recall\"` / `\"application\"` 塞到 `ability_dimension` —— **不行**，同理\n- 把 `\"calculation\"` / `\"concept\"` 等放到 `cognitive_level` —— **不行**\n\n**✓ 正确写法**：\n```json\n\"ability_dimension\": [\"calculation\"],   // ← 只能从上面 8 个里选\n\"cognitive_level\": \"procedural\"         // ← 只能从上面 4 个里选\n```\n\n注意 `reasoning` 出现在两个集合里 —— 但每个字段是独立判断，不要因此混用其他词。\n\n## 2. 题型与必备字段\n\n所有题型必须有：\n\n| 字段 | 说明 |\n|---|---|\n| `question_id` | 唯一 id，AI 题以 `AI_` 开头 |\n| `subjectId` | `\"math\"` / `\"chinese\"` |\n| `stem` | 题干，**≥ 8 个汉字**，紧扣 skill_id |\n| `skill_id` / `skill_name` | 必须真实存在 |\n| `unit_id` / `unit_name` | 必须真实存在 |\n| `difficulty` | 1-5 整数，3 = 单元中等 |\n| `estimated_time_seconds` | 按下方时间表给，不能瞎填 |\n| `solution_steps` | 至少 1 步分析 |\n| `hints` | 至少 1 条提示，含 `{ text, penalty }` |\n| `feedback_correct` / `feedback_wrong` | 各一句话 |\n| `common_errors` | ≥ 2 项，每项 `{ tag, error, remediation }` |\n| `tags` | 数组，AI 题必须含 `\"ai_generated\"` |\n\n按题型差异化的字段：\n\n- **plain_choice / cube_view / balance_lab / decimal_shifter / triangle_judge / shop_counter**\n  → `options: [{id:\"A\",text:\"...\"}, ...]`（4 选 1）+ `answer: { type:\"choice\", value:\"A\" }`\n- **word_problem_lab**\n  → `subquestions: [...]`（clue_pick / choose / numeric 三步）+ `answer: { type:\"multi_step\", steps:[...] }`\n- **vertical_repair / equation_builder / speed_match** 等迷你游戏\n  → 题型特定 schema，不需要 options\n\n---\n\n## 3. 答题时间表（estimated_time_seconds）\n\n系统按 `elapsed/estimated` 算速度奖励：< 50% 闪电 +5 / < 80% 迅速 +3 / ≤ 100% 及时 +2 / > 100% 0 分 / > 150% 自动判错。所以时间值不能瞎填。\n\n| game_type | 难度 1-2 | 难度 3 | 难度 4-5 |\n|---|---|---|---|\n| `speed_match`（口算/快判） | 10s | 15s | 20s |\n| `plain_choice`（4 选 1） | 20s | 30s | 40s |\n| `decimal_shifter`（小数点） | 18s | 25s | 35s |\n| `cube_view`（立体观察） | 25s | 35s | 50s |\n| `triangle_judge`（三角形） | 22s | 30s | 40s |\n| `vertical_repair`（竖式） | 25s | 35s | 45s |\n| `balance_lab`（天平） | 35s | 50s | 65s |\n| `shop_counter`（购物） | 35s | 50s | 70s |\n| `clue_finder`（应用题读题） | 35s | 45s | 60s |\n| `word_problem_lab`（分阶段应用题） | 70s | 90s | 130s |\n| 语文 拼音/字音 | 12s | 16s | 20s |\n| 语文 古诗补字 | 22s | 28s | 35s |\n| 语文 听写 | 20s | 28s | 40s |\n| 语文 修辞/句子 | 25s | 32s | 45s |\n| 语文 阅读理解（多段+多题） | 90s | 120s | 180s |\n\n### 3.1 阅读量加成（v0.31.51 新增）— 长题必须多给时间\n\n上表是**短题基础值**。Selena 是 4 年级小学生，读字慢，长情境题 + 多行选项绝不能跟一句计算题同时间。**生成长题时按下面规则在基础值上累加**：\n\n| 情况 | 加成 |\n|---|---|\n| 题面 stem 60-119 字（有情境描述） | +15s |\n| 题面 stem ≥ 120 字（多句情境/多步描述） | +25s（不和上一条叠加） |\n| 任一 option text 超过 20 字 / 多行（含竖式、多步算式、长描述） | +15s |\n| 题面或选项含图示/表格/竖式（用 `─` `┃` `+` `-` 等画图字符） | +20s |\n\n**最终 estimated_time_seconds 范围**：保持在 20-180s 内（语文阅读理解可到 240s 上限）。\n超出表格上限就说明题目太复杂，应当拆短或换 game_type。\n\n**对照例**：\n- D2 plain_choice \"0.6 里面有几个 0.1?\"（短题）→ 基础 20s\n- D3 plain_choice \"小丽去文具店买……4 个竖式选项\"（长 stem + 多行选项）\n  → 30 (基础) + 15 (stem ≥60 字) + 15 (option 多行) = **60s**\n- D4 word_problem_lab 多段情境 + 表格 → 130 + 25 + 20 = **175s**\n\n---\n\n## 4. 题干语言质量（v0.28.3 加强 — 严格执行）\n\n### 4.1 ⛔ 禁用动词（数学题干里）\n\n- **输 / 输入 / 报 / 送 / 提交 / 填入数字** → 用 \"答\" / \"选\" / \"写出\"\n- **错误**：`x = 7 是不是方程的解？是输 1，否输 0`\n- **正确**：`x = 7 是不是方程 x + 5 = 12 的解？是 → 答 1，不是 → 答 0`\n\n### 4.2 ⛔ 禁用句式\n\n绝对不要生成下列形式的题干，4 年级孩子读不懂、家长头疼、立刻丢弃：\n\n- ❌ `0.30 和 0.3，相等输 0` — 用 \"输 N\" 指令式说法\n- ❌ `0.6 表示 6 个？（输入数值：0.1 输 0.1）` — 题干嵌指令带括号注释\n- ❌ `x = 5 是不是解？输 1 输 0` — 是非题硬塞数字输入\n- ❌ `0.45 中的 5 在哪一位？(1=十分位 2=百分位)` — 选项解释藏在括号里\n\n### 4.3 ✅ 正确写法\n\n- ✅ `0.30 和 0.3 相等吗？相等→答 0，不等→答 1` — 用 \"答\" 代替 \"输\"\n- ✅ 是非题用 plain_choice，options 是 \"是\" / \"不是\" / \"无法判断\" / \"题目有错\"\n- ✅ `0.6 里面有几个 0.1？` → 直接问数量，options 是 6 / 60 / 0.06 / 0.1\n- ✅ `下面排列从小到大正确的是？` → plain_choice，options 是完整不等式\n\n### 4.4 stem 长度\n\n- **≥ 8 个汉字字符**。少于 8 字几乎肯定是 LLM 失误。\n\n### 4.5 stem ↔ options 类型一致\n\n| stem 形式 | options 必须是 |\n|---|---|\n| `多少 / 几 / 是 X / 等于多少` 等问数字 | 全部数字（含单位前缀也算） |\n| `哪个对 / 下面…正确的是` 等问选项 | 完整短句或表达式 |\n\n⛔ **绝对禁止**：stem 是数值题但 options 混入纯中文短语；或反过来。\n\n---\n\n## 5. 4 选 1 干扰项设计\n\n每道选择题需要 **1 正确 + 3 高质量干扰项**：\n\n- 1 个正确\n- 1 个 \"操作反了\"（比较时方向反 / 加减反 / 单位错）\n- 1 个 \"漏一步\"（少进位 / 少借位 / 少乘）\n- 1 个 \"接近但典型错误\"（小数点放错位 / 多个零少个零）\n\n⛔ **不要让 4 个选项相邻 1**（如 5/6/7/8）— 区分度太低。\n\n---\n\n## 6. 答案与解析\n\n- `answer.value` **必须**指向一个真实存在的 option id（A/B/C/D）。\n- `solution_steps` 至少 1 步，简洁说明思路（不是抄题面）。\n- `feedback_correct` / `feedback_wrong` 各一句话，用儿童化鼓励语气，不要罗嗦。\n- `common_errors` ≥ 2 项，`tag` 用学科常用 error tag（数学如 `decimal_point_error`、`carry_missing`；语文如 `wrong_phonics`、`stroke_order_error`）。\n- `hints` ≥ 1 条，每条带 `penalty`（提示越具体扣分越多）。\n\n---\n\n## 7. 内容守则\n\n- ⛔ 不重复题干（参考已有 stems 列表，换情境/换数字/换字词组合）\n- ⛔ 不出现真实姓名（用 \"小明\" / \"小红\" 虚拟角色）\n- ⛔ 不放广告、政治、负面词\n- ✅ 题干用中文标点 + 半角数字\n- ✅ 选项之间区分度大\n\n---\n\n## 8. 难度标准\n\n| difficulty | 含义 |\n|---|---|\n| 1 | 单元最基础（识别概念、读数、对照表格） |\n| 2 | 一步运算 / 简单应用 |\n| 3 | 单元中等（默认 difficulty） |\n| 4 | 多步运算 / 较复杂应用题 |\n| 5 | 综合（跨概念，期末压轴级别） |\n\n⛔ **不要给 4 年级出难度 5 的奥数题**（如复杂数论、组合数学）。\n\n---\n\n## 9. 严重程度（severity）— 仅质检时使用\n\n判定题目时按下面标准给 severity 1-5：\n\n| severity | 含义 | 处理 |\n|---|---|---|\n| 5 | 关键 bug：答案错 / 超纲 / 完全跑题 / 题干无意义 | **删除** |\n| 4 | 严重质量问题：含禁用动词（输/报）/ stem<8字 / stem ↔ options 类型不匹配 / answer 不指向 option | **删除** |\n| 3 | 较明显瑕疵：区分度不足 / 干扰项过远 / 提示太弱 / 时间值偏离表格 | **borderline**（可保留可改） |\n| 2 | 轻微：标点/用词不规范、`common_errors` 不够 2 项、tag 拼写非标 | **borderline** |\n| 1 | 几乎完美 | **keep** |",
  "questionsUserTemplate": "生成 {{count}} 道四年级{{term}}（{{termCode}}）{{subjectLabel}}题：\n\n⚠️ 内容必须是【{{term}}】，不要混【{{otherTerm}}】\n\n单元：{{unitName}} ({{unitId}})\n技能：{{skillName}} ({{skillId}})\n难度：{{difficulty}}（在该范围内分布）\n\n⚠️ **重点**：题干必须围绕「{{skillName}}」展开。不要因为其他 skill 更熟就生成不相关的题（比如让你出\"积的小数位数\"却生成\"求平均数\"——这是错的）。\n\n变化方向{{batchIndex}}：本批用 {{batchAngle}}（不同情境 / 不同数字 / 不同字词组合）\n\n{{existingStemsBlock}}\n\n{{recentMistakesBlock}}\n\n{{gameTypeSchema}}",
  "questionsSchemas": {
    "balance_lab": "## 题型：balance_lab（天平 / 等量代换）\n\n⏱️ **答题时间**：`estimated_time_seconds: 50`（要看懂图 + 列方程 + 解方程，难度 5 给 60）\n\n⚠️ 这种题用客户端 BalanceLab 组件渲染，**必须**在 `tags` 里给一个 `eq:` tag 描述天平两边。\n\n### tag 格式\n\n`eq:left|right` —— `left` 和 `right` 都是用 `+` 连接的项（比如 `2x+3`、`5+y`、`3a`）。\n\n例：`2x + 3 = x + 5` → `eq:2x+3|x+5`\n\n### stem 示例\n\n- \"天平两边平衡，左边是 ___，右边是 ___，请问 x 等于多少？\"\n- \"下图天平刚好平衡，求 x 的值。\"\n\n### 必须字段（**继承 plain_choice 的全部字段**，下面只列差异）\n\n⚠️ **完整 JSON 必须包含所有 plain_choice 必备字段**（question_id / subjectId / version / status / grade / term / unit_id / unit_name / skill_id / skill_name / cognitive_level / difficulty / estimated_time_seconds / stem / common_errors / feedback_correct / feedback_wrong / hints / tags / exam_priority）。**枚举值严格按 quality-rubric.md 第 1.5 节**。\n\n差异化字段：\n\n```json\n{\n  \"game_type\": \"balance_lab\",\n  \"play_as\": \"balance_lab\",\n  \"question_format\": \"numeric\",\n  \"cognitive_level\": \"application\",\n  \"ability_dimension\": [\"modeling\", \"calculation\"],\n  \"estimated_time_seconds\": 50,\n  \"tags\": [\"ai_generated\", \"eq:2x+3|x+5\"],\n  \"answer\": {\"type\": \"number\", \"value\": 2}\n}\n```\n\n只用一元一次方程，未知数 x 取值 1-20 整数。变量名固定 x（不要用 y/a 等让小学生迷惑）。",
    "cube_view": "## 题型：cube_view（立体观察 / 数小正方体）\n\n⏱️ **答题时间**：`estimated_time_seconds: 35`（立体空间想象需要时间，难度 4+ 给 45）\n\n⚠️ **关键**：这种题需要客户端渲染 3D 立体图，所以你**必须**在 `tags` 数组里给一个 `solid:` tag，描述每个小正方体的坐标。\n\n### tag 格式\n\n`solid:x,y,z|x,y,z|x,y,z` —— 每个 `|` 分隔一个小正方体，`x,y,z` 是该立方体的整数坐标（0-3 范围）。\n\n例：3 个排成 L 形 → `solid:0,0,0|1,0,0|1,1,0`\n\n### stem 题型示例（围绕\"几个小正方体\"或\"几个面\"）\n\n- \"下面这个图形由几个小正方体组成？\"\n- \"从正面看，能看到几个面？\"\n- \"从上面看是什么形状？\"\n- \"这个图形里有几个面是露出来的？\"\n\n### 必须字段（**继承 plain_choice 的全部字段**，下面只列差异）\n\n⚠️ **完整 JSON 必须包含所有 plain_choice 必备字段**（question_id / subjectId / version / status / grade / term / unit_id / unit_name / skill_id / skill_name / cognitive_level / difficulty / estimated_time_seconds / stem / common_errors / feedback_correct / feedback_wrong / hints / tags / exam_priority）。**枚举值严格按 quality-rubric.md 第 1.5 节**。\n\n差异化字段：\n\n```json\n{\n  \"game_type\": \"cube_view\",\n  \"play_as\": \"cube_view\",\n  \"question_format\": \"single_choice\",\n  \"cognitive_level\": \"reasoning\",\n  \"ability_dimension\": [\"spatial\"],\n  \"estimated_time_seconds\": 35,\n  \"tags\": [\"ai_generated\", \"solid:0,0,0|1,0,0|1,1,0\"],\n  \"options\": [\n    {\"id\": \"A\", \"text\": \"3\"},\n    {\"id\": \"B\", \"text\": \"4\"},\n    {\"id\": \"C\", \"text\": \"5\"},\n    {\"id\": \"D\", \"text\": \"6\"}\n  ],\n  \"answer\": {\"type\": \"choice\", \"value\": \"A\"}\n}\n```\n\n立方体数量在 2-8 之间，不要超过 8 个（视觉上会乱）。",
    "decimal_shifter": "## 题型：decimal_shifter（小数点移动）\n\n⏱️ **答题时间**：`estimated_time_seconds: 25`（程序化操作，应该熟练后较快）\n\n围绕\"小数点移动 → 数字变大或变小\"的核心知识点。\n\n### stem 示例\n\n- \"把 3.45 的小数点向右移动一位，得到的数是 ___\"\n- \"5.678 缩小到原来的 1/100 后是 ___\"\n- \"0.07 的小数点向左移动一位，结果是 ___\"\n\n### 必须字段（**继承 plain_choice 的全部字段**，下面只列差异）\n\n⚠️ **完整 JSON 必须包含所有 plain_choice 必备字段**（question_id / subjectId / version / status / grade / term / unit_id / unit_name / skill_id / skill_name / cognitive_level / difficulty / estimated_time_seconds / stem / question_format / options / answer / solution_steps / common_errors / feedback_correct / feedback_wrong / hints / tags / exam_priority）。**枚举值严格按 quality-rubric.md 第 1.5 节**。\n\n差异化字段：\n\n```json\n{\n  \"game_type\": \"decimal_shifter\",\n  \"play_as\": \"decimal_shifter\",\n  \"question_format\": \"single_choice\",\n  \"cognitive_level\": \"procedural\",\n  \"ability_dimension\": [\"concept\", \"strategy\"],\n  \"estimated_time_seconds\": 25,\n  \"tags\": [\"ai_generated\", \"shift:right:1\", \"start:3.45\"]\n}\n```\n\n`tags` 里的 `shift:` 描述方向 + 位数；`start:` 是起始数字。客户端用这两个 tag 渲染动画。\n\n选项保持 4 个数字，包括 1 个干扰项是\"小数点方向反了\"，1 个是\"位数错了\"。",
    "dot_grid_draw": "## 题型：dot_grid_draw（点子图画图）\n\n**渲染**：网格点阵，孩子点击格点添加顶点，自动连线，闭合后判图形类别。\n\n### 适用 skill\n- 三角形 / 四边形构造（triangle_classification 进阶）\n- 三角形三边关系实操\n- 等腰 / 等边判断\n\n### 必填字段\n```json\n{\n  \"question_id\": \"AI_${skillId}_001\",\n  \"subjectId\": \"math\",\n  \"version\": 1,\n  \"status\": \"approved\",\n  \"grade\": 4,\n  \"term\": \"下册\",\n  \"unit_id\": \"G4B_U2_TRI_QUAD\",\n  \"unit_name\": \"三角形\",\n  \"skill_id\": \"triangle_classification\",\n  \"skill_name\": \"按角/边给三角形分类\",\n  \"ability_dimension\": [\"spatial\", \"concept\"],\n  \"exam_priority\": \"HIGH_SMALL\",\n  \"game_type\": \"geometry_judge\",\n  \"play_as\": \"dot_grid_draw\",\n  \"cognitive_level\": \"application\",\n  \"difficulty\": 3,\n  \"estimated_time_seconds\": 60,\n  \"stem\": \"在点子图上画一个等腰直角三角形。\",\n  \"question_format\": \"geometry_operation\",\n  \"answer\": {\n    \"type\": \"choice\",\n    \"value\": \"isosceles_right\"\n  },\n  \"dot_grid\": {\n    \"gridWidth\": 6,\n    \"gridHeight\": 6,\n    \"expectedShape\": \"isosceles_right_triangle\",\n    \"minVertices\": 3,\n    \"maxVertices\": 3\n  },\n  \"solution_steps\": [\"等腰直角三角形：两条直角边相等。在点子图上找两条相同长度的直角边即可。\"],\n  \"common_errors\": [\n    { \"tag\": \"non_isosceles\", \"error\": \"三边都不等，不是等腰\", \"remediation\": \"至少两边要相等\" },\n    { \"tag\": \"non_right_angle\", \"error\": \"三个角都不是直角\", \"remediation\": \"等腰直角三角形必须有一个 90° 角\" }\n  ],\n  \"feedback_correct\": \"画得很对！两条直角边相等～\",\n  \"feedback_wrong\": \"再试一次：等腰直角三角形要有 1 个 90° 角 + 两条相等的直角边。\",\n  \"hints\": [{ \"text\": \"先选一个直角顶点，再分别向两个方向选相等距离的点\", \"penalty\": 1 }],\n  \"tags\": [\"ai_generated\"]\n}\n```\n\n### 关键\n- expectedShape 必须是 schema 里支持的：parallelogram / rectangle / trapezoid / isosceles_triangle / equilateral_triangle / right_triangle / isosceles_right_triangle\n- gridWidth × gridHeight 通常 5×5 到 7×7\n- minVertices / maxVertices 三角形是 3，四边形是 4\n- 这个题型只用于\"画图\"操作，不要塞文字答案",
    "plain_choice": "## 题型：plain_choice（4 选 1 标准选择题）\n\n⏱️ **答题时间**：先按 difficulty 给基础值，再按\"阅读量\"加成。**长题必须多给时间**——\n小学生读字慢，4 行情境题 + 4 行选项跟一句计算题不能同时间。\n\n**基础值**（短题：题面一句话内、选项每个 ≤ 12 个字）：\n- difficulty 1-2 → 基础 20s\n- difficulty 3   → 基础 30s\n- difficulty 4-5 → 基础 40s\n\n**阅读量加成**（**累加**到基础值上，不是替换）：\n- 题面 stem 超过 60 字（一段文字描述情境）→ **+15s**\n- 题面 stem 超过 120 字（多句情境/多步描述）→ **+25s**（替代上一条）\n- 任一 option text 超过 20 字 / 多行内容（含竖式 / 多步算式 / 描述）→ **+15s**\n- 题面含图示、表格、竖式描述（用 `─` `┃` `┃` `+` `-` 等画图字符）→ **+20s**\n\n**最终范围**：`estimated_time_seconds` 在 20-90s 之间，超过 90 就过长，需要重新设计题目让它更紧凑。\n\n**举例对照**：\n- D2 \"0.6 里面有几个 0.1?\"（短题）→ 20s\n- D3 \"下列哪个分数是最简？(选项 A 1/2 B 2/4 C 3/6 D 4/8)\"（短题短选项）→ 30s\n- D3 \"小丽去文具店买一支钢笔和一本笔记本，钢笔标价 12.5 元……（4 行竖式选项）\"\n  → 30 (基础) + 15 (stem ≥60 字) + 15 (option 多行竖式) = **60s**\n- D4 长情境多步推理 + 含表格 → 40 + 25 + 20 = **85s**（接近上限）\n\n⚠️ **必填枚举字段（合法值，不要改写、不要翻译）**：\n- `term`: 必须是 `\"上册\"` 或 `\"下册\"`（用户传入的 `{{term}}`）。**不要写 `\"G4A\"` / `\"G4B\"`** — 那是 unit_id 的前缀，不是 term 的值。\n- `cognitive_level`: 必须是 `\"recall\"` / `\"procedural\"` / `\"application\"` / `\"reasoning\"` 中的一个。**不要写 `\"conceptual\"`**。\n- `ability_dimension[]`: 数组元素必须从 `[\"calculation\",\"concept\",\"reasoning\",\"modeling\",\"spatial\",\"data\",\"strategy\",\"habit\"]` 选。**不要写 `\"conceptual\"`，不要写 `\"procedural\"`**（procedural 是 cognitive_level 的值，不是 ability）。\n- `question_format`: `\"single_choice\"`（plain_choice 题型固定这个）。\n- `exam_priority`: 见 prompts/quality-rubric.md，常用 `\"HIGH_BIG\"`。\n\n⚠️ **`solution_steps` 是字符串数组，不是对象数组**：\n- ✓ `\"solution_steps\": [\"先算 A，得 X\", \"再算 B，得 Y\", \"因此答案是 Z\"]`\n- ✗ `\"solution_steps\": [{ \"step\": 1, \"text\": \"...\" }]`\n\n⚠️ **`hints[].penalty` 是整数 1-3，不要用浮点**：\n- ✓ `{ \"text\": \"提示...\", \"penalty\": 1 }`\n- ✗ `{ \"text\": \"提示...\", \"penalty\": 0.5 }`\n\n输出每题的 JSON 形如：\n\n```json\n{\n  \"question_id\": \"AI_{{skillId}}_001\",\n  \"subjectId\": \"{{subjectId}}\",\n  \"version\": 1,\n  \"status\": \"approved\",\n  \"grade\": 4,\n  \"term\": \"{{term}}\",\n  \"unit_id\": \"{{unitId}}\",\n  \"unit_name\": \"{{unitName}}\",\n  \"skill_id\": \"{{skillId}}\",\n  \"skill_name\": \"{{skillName}}\",\n  \"ability_dimension\": [\"{{defaultAbility}}\"],\n  \"exam_priority\": \"HIGH_BIG\",\n  \"game_type\": \"plain_choice\",\n  \"play_as\": \"plain_choice\",\n  \"cognitive_level\": \"procedural\",\n  \"difficulty\": 3,\n  \"estimated_time_seconds\": 30,\n  \"stem\": \"题面文字\",\n  \"question_format\": \"single_choice\",\n  \"options\": [\n    {\"id\": \"A\", \"text\": \"选项 A\"},\n    {\"id\": \"B\", \"text\": \"选项 B\"},\n    {\"id\": \"C\", \"text\": \"选项 C\"},\n    {\"id\": \"D\", \"text\": \"选项 D\"}\n  ],\n  \"answer\": {\"type\": \"choice\", \"value\": \"A\"},\n  \"solution_steps\": [\"分析步骤一句话\"],\n  \"common_errors\": [\n    {\"tag\": \"{{errorTagExample}}\", \"error\": \"常见错误描述\", \"remediation\": \"怎么纠正\"}\n  ],\n  \"feedback_correct\": \"答对的反馈\",\n  \"feedback_wrong\": \"答错的反馈\",\n  \"hints\": [{\"text\": \"提示文字\", \"penalty\": 1}],\n  \"tags\": [\"ai_generated\"]\n}\n```",
    "shop_counter": "## 题型：shop_counter（购物 / 总价应用题）\n\n⏱️ **答题时间**：`estimated_time_seconds: 50`（应用题需要读题 + 列算式 + 算结果，难度 4-5 给 70）\n\n围绕：单价 × 数量 = 总价 / 已付钱找零 / 多种商品组合等。\n\n### stem 必备元素\n\n- 至少一个商品 + 单价 + 数量\n- 用人民币（元、角、分）单位，但**只用元**保留 2 位小数（不混分）\n- 数字不超过 100 元，单价 0.5-25.0 元\n\n### 干扰项设计\n\n4 个数字选项中：\n- 1 个正确\n- 1 个\"忘了乘数量\"\n- 1 个\"小数点放错位\"\n- 1 个\"加减号搞反\"\n\n### 必须字段（**继承 plain_choice 的全部字段**，下面只列差异）\n\n⚠️ **完整 JSON 必须包含所有 plain_choice 必备字段**（question_id / subjectId / version / status / grade / term / unit_id / unit_name / skill_id / skill_name / cognitive_level / difficulty / estimated_time_seconds / stem / question_format / options / answer / solution_steps / common_errors / feedback_correct / feedback_wrong / hints / tags / exam_priority）。**枚举值严格按 quality-rubric.md 第 1.5 节**。\n\n差异化字段：\n\n```json\n{\n  \"game_type\": \"shop_counter\",\n  \"play_as\": \"shop_counter\",\n  \"question_format\": \"single_choice\",\n  \"cognitive_level\": \"application\",\n  \"ability_dimension\": [\"modeling\", \"calculation\"],\n  \"estimated_time_seconds\": 50,\n  \"tags\": [\"ai_generated\", \"items:apple-3.5-2|book-12.8-1\"]\n}\n```\n\n`items:name-price-qty|...` 列出每个商品。",
    "speed_match": "## 题型：speed_match（口算 / 快速判断）\n\n**渲染**：4 个数字选项排成网格，孩子点选最快的那个。题目有 distractors 时也走这个模板。\n\n### 适用 skill\n- 口算（小数加减简便、积的小数位数）\n- 单位换算（厘米转米）\n- 数感判断（哪个最大 / 哪个最接近 1）\n\n### 必填字段\n```json\n{\n  \"question_id\": \"AI_${skillId}_001\",\n  \"subjectId\": \"${subjectId}\",\n  \"version\": 1,\n  \"status\": \"approved\",\n  \"grade\": 4,\n  \"term\": \"${term}\",\n  \"unit_id\": \"${unitId}\",\n  \"unit_name\": \"${unitName}\",\n  \"skill_id\": \"${skillId}\",\n  \"skill_name\": \"${skillName}\",\n  \"ability_dimension\": [\"calculation\"],\n  \"exam_priority\": \"MUST_SMALL\",\n  \"game_type\": \"speed_calc\",\n  \"play_as\": \"speed_match\",\n  \"cognitive_level\": \"procedural\",\n  \"difficulty\": 2,\n  \"estimated_time_seconds\": 15,\n  \"stem\": \"0.85 + 1.6 = ?\",\n  \"question_format\": \"numeric_choice\",\n  \"options\": [\n    { \"id\": \"A\", \"text\": \"2.45\" },\n    { \"id\": \"B\", \"text\": \"2.41\" },\n    { \"id\": \"C\", \"text\": \"1.0145\" },\n    { \"id\": \"D\", \"text\": \"0.245\" }\n  ],\n  \"answer\": { \"type\": \"choice\", \"value\": \"A\" },\n  \"solution_steps\": [\"小数点对齐相加：0.85 + 1.60 = 2.45\"],\n  \"common_errors\": [\n    { \"tag\": \"decimal_point_error\", \"error\": \"小数点错位算成 0.245\", \"remediation\": \"对齐小数点再相加\" },\n    { \"tag\": \"carry_missing\", \"error\": \"忘进位算成 2.41\", \"remediation\": \"5+0=5、8+6=14 进位\" }\n  ],\n  \"feedback_correct\": \"厉害！口算又快又准！\",\n  \"feedback_wrong\": \"再来一次，先把小数点对齐。\",\n  \"hints\": [{ \"text\": \"把两个数小数点对齐，逐位相加\", \"penalty\": 1 }],\n  \"tags\": [\"ai_generated\"]\n}\n```\n\n### 关键\n- stem 短（≤ 30 字）\n- 4 个 option 都是数字，区分度大（不要 4 个相邻整数）\n- 干扰项必须含小数点错位 / 漏进位 / 操作反 三类典型错误",
    "triangle_judge": "## 题型：triangle_judge（三角形判定）\n\n⏱️ **答题时间**：`estimated_time_seconds: 30`（规则套用 + 简单计算，难度 4-5 给 40）\n\n围绕：三边能否构成三角形 / 三角形分类（按角、按边）/ 内角和。\n\n### tag 格式\n\n判断三边能否构成三角形：`tri-sides:a,b,c`，例 `tri-sides:3,4,5`。\n\n按角分类：题干描述三个角，options 是\"锐角三角形 / 直角三角形 / 钝角三角形\"。\n\n### stem 示例\n\n- \"下面三条边长能围成三角形的是？\"\n- \"已知三角形两个内角是 60° 和 70°，第三个角是多少度？\"\n- \"三个内角分别是 30°、60°、90° 的三角形是什么三角形？\"\n\n### 必须字段（**继承 plain_choice 的全部字段**，下面只列差异）\n\n⚠️ **完整 JSON 必须包含所有 plain_choice 必备字段**（question_id / subjectId / version / status / grade / term / unit_id / unit_name / skill_id / skill_name / cognitive_level / difficulty / estimated_time_seconds / stem / question_format / options / answer / solution_steps / common_errors / feedback_correct / feedback_wrong / hints / tags / exam_priority）。**枚举值严格按 quality-rubric.md 第 1.5 节**。\n\n差异化字段：\n\n```json\n{\n  \"game_type\": \"triangle_judge\",\n  \"play_as\": \"triangle_judge\",\n  \"question_format\": \"single_choice\",\n  \"cognitive_level\": \"reasoning\",\n  \"ability_dimension\": [\"reasoning\", \"spatial\"],\n  \"estimated_time_seconds\": 30,\n  \"tags\": [\"ai_generated\", \"tri-sides:3,4,5\"]\n}\n```",
    "true_false_swipe": "## 题型：true_false_swipe（真假判断滑动）\n\n**渲染**：展示一句陈述，孩子滑动判断 \"对\" / \"错\"（或点选）。\n\n### 适用 skill\n- 概念辨析（\"等边三角形是特殊的等腰三角形 → 对\"）\n- 判断式子是否方程（letter_expression / equation_meaning_balance）\n- 单位换算判断（\"1 米 = 100 厘米 → 对\"）\n\n### 必填字段\n```json\n{\n  \"question_id\": \"AI_${skillId}_001\",\n  \"subjectId\": \"${subjectId}\",\n  \"version\": 1,\n  \"status\": \"approved\",\n  \"grade\": 4,\n  \"term\": \"${term}\",\n  \"unit_id\": \"${unitId}\",\n  \"unit_name\": \"${unitName}\",\n  \"skill_id\": \"${skillId}\",\n  \"skill_name\": \"${skillName}\",\n  \"ability_dimension\": [\"concept\", \"reasoning\"],\n  \"exam_priority\": \"HIGH_SMALL\",\n  \"game_type\": \"true_false\",\n  \"play_as\": \"true_false_swipe\",\n  \"cognitive_level\": \"recall\",\n  \"difficulty\": 2,\n  \"estimated_time_seconds\": 12,\n  \"stem\": \"等边三角形是特殊的等腰三角形。\",\n  \"question_format\": \"single_choice\",\n  \"options\": [\n    { \"id\": \"T\", \"text\": \"对\" },\n    { \"id\": \"F\", \"text\": \"错\" }\n  ],\n  \"answer\": { \"type\": \"choice\", \"value\": \"T\" },\n  \"solution_steps\": [\"等腰三角形定义：至少两边相等；等边三角形三边都相等，是特例。\"],\n  \"common_errors\": [\n    { \"tag\": \"category_misunderstand\", \"error\": \"把等边和等腰当成两类不相交\", \"remediation\": \"等边是等腰的子集\" },\n    { \"tag\": \"definition_confusion\", \"error\": \"记错等腰定义\", \"remediation\": \"至少两边相等就算等腰\" }\n  ],\n  \"feedback_correct\": \"对！等边三角形就是特殊的等腰三角形\",\n  \"feedback_wrong\": \"再想想：等腰要求'至少两边相等'\",\n  \"hints\": [{ \"text\": \"等腰要求至少两边相等，等边是不是满足？\", \"penalty\": 1 }],\n  \"tags\": [\"ai_generated\"]\n}\n```\n\n### 关键\n- options 永远是 `[{id:\"T\",text:\"对\"},{id:\"F\",text:\"错\"}]`（题干就是陈述本身）\n- stem 是一句完整的陈述句，不要带问号\n- 不要带\"输 1 输 0\"指令式说法\n- difficulty 一般 1-2（简单判断）",
    "vertical_repair": "## 题型：vertical_repair（竖式找错）\n\n**渲染**：展示一个有错的竖式，让孩子从 4 个候选竖式里挑出正确的（或挑出错处）。\n\n### 适用 skill\n- decimal_add_sub_vertical（小数加减竖式对齐）\n- decimal_mul_vertical（小数乘法竖式）\n- 整数竖式（数位对齐）\n\n### 必填字段\n```json\n{\n  \"question_id\": \"AI_${skillId}_001\",\n  \"subjectId\": \"${subjectId}\",\n  \"version\": 1,\n  \"status\": \"approved\",\n  \"grade\": 4,\n  \"term\": \"${term}\",\n  \"unit_id\": \"${unitId}\",\n  \"unit_name\": \"${unitName}\",\n  \"skill_id\": \"${skillId}\",\n  \"skill_name\": \"${skillName}\",\n  \"ability_dimension\": [\"calculation\"],\n  \"exam_priority\": \"MUST_BIG\",\n  \"game_type\": \"vertical_repair\",\n  \"play_as\": \"vertical_repair\",\n  \"cognitive_level\": \"procedural\",\n  \"difficulty\": 3,\n  \"estimated_time_seconds\": 35,\n  \"stem\": \"小红用竖式计算 3.07 + 2.9，下面哪种对齐方式正确？\",\n  \"question_format\": \"single_choice\",\n  \"options\": [\n    { \"id\": \"A\", \"text\": \"3.07\\n+2.9_\\n=5.97（小数点对齐，2.9 末位补 0）\" },\n    { \"id\": \"B\", \"text\": \"3.07\\n+ 2.9\\n=3.36（末位对齐：7+9=16 进 1，0+2=2 等）\", \"errorTag\": \"right_align_wrong\" },\n    { \"id\": \"C\", \"text\": \"3.07\\n+0.29\\n=3.36（把 2.9 当成 0.29）\", \"errorTag\": \"decimal_point_error\" },\n    { \"id\": \"D\", \"text\": \"3.07\\n+2.09\\n=5.16（把 2.9 当成 2.09）\", \"errorTag\": \"decimal_point_error\" }\n  ],\n  \"answer\": { \"type\": \"choice\", \"value\": \"A\" },\n  \"solution_steps\": [\"小数点对齐 = 相同数位对齐。2.9 末位（十分位）对齐 3.07 的十分位，百分位补 0。\"],\n  \"common_errors\": [\n    { \"tag\": \"right_align_wrong\", \"error\": \"把竖式末位对齐而非小数点对齐\", \"remediation\": \"记住：小数点对齐 ＝ 相同数位对齐\" },\n    { \"tag\": \"decimal_point_error\", \"error\": \"把 2.9 看成 0.29 或 2.09\", \"remediation\": \"保持原小数不动，只补末尾 0 让位数对齐\" }\n  ],\n  \"feedback_correct\": \"对！小数点对齐就是相同数位对齐～\",\n  \"feedback_wrong\": \"再看一次：小数点要对齐，不是末位对齐！\",\n  \"hints\": [{ \"text\": \"对齐小数点，位数不齐就在末尾补 0\", \"penalty\": 1 }],\n  \"tags\": [\"ai_generated\"]\n}\n```\n\n### 关键\n- options 用换行 `\\n` 模拟竖式视觉\n- 4 个候选必须包含一个 \"末位对齐\" 错（最常见错误）+ 至少一个 \"小数点错位\" 错\n- stem 简短，重点放在 options 上",
    "word_problem_lab": "## 题型：word_problem_lab（应用题分阶段）\n\n⚠️ 这是**多阶段题**，跟 plain_choice 的 schema 完全不同。一道题分成 3 步：\n\n1. **clue_pick**（挑已知条件）：列出题面里的所有\"已知信息\"，让 Selena 挑出\"对解题有用的\"几条\n2. **choose**（选数量关系）：给 4 个候选公式 / 关系式，挑正确的\n3. **numeric**（写答案）：给正确数字（带单位），4 个干扰项一起 4 选 1\n\n### 适用场景\n\n只在 **应用题 / 实际问题** 类 skill 上用，比如：\n- 已知和/差求未知量逆向应用题\n- 列方程解决一步应用题 / 两步应用题\n- 总价 = 单价 × 数量\n- 路程 = 速度 × 时间\n- 工程量 / 产量合计\n- 求平均数（已知总数）\n\n不要给纯计算 / 概念辨析类 skill 用这个题型。\n\n### 必填字段（**完整 schema**）\n\n```json\n{\n  \"question_id\": \"AI_{{skillId}}_001\",\n  \"subjectId\": \"{{subjectId}}\",\n  \"version\": 1,\n  \"status\": \"approved\",\n  \"grade\": 4,\n  \"term\": \"{{term}}\",\n  \"unit_id\": \"{{unitId}}\",\n  \"unit_name\": \"{{unitName}}\",\n  \"skill_id\": \"{{skillId}}\",\n  \"skill_name\": \"{{skillName}}\",\n  \"ability_dimension\": [\"modeling\", \"calculation\"],\n  \"exam_priority\": \"MUST_BIG\",\n  \"game_type\": \"word_problem_lab\",\n  \"play_as\": \"shop_counter\",\n  \"cognitive_level\": \"application\",\n  \"difficulty\": 4,\n  \"estimated_time_seconds\": 90,\n  \"stem\": \"学校体育组买了 8 个篮球和 6 个足球，篮球每个 45.5 元，足球每个 38 元，一共花了多少元？\",\n  \"question_format\": \"multi_step\",\n  \"answer\": {\n    \"type\": \"multi_step\",\n    \"steps\": [\n      { \"step_id\": \"clue\", \"expected\": \"0,1,2,3\" },\n      { \"step_id\": \"relationship\", \"expected\": \"总价 = 篮球单价 × 篮球数量 + 足球单价 × 足球数量\" },\n      { \"step_id\": \"answer\", \"expected\": 592.0, \"kind\": \"answer\" }\n    ]\n  },\n  \"subquestions\": [\n    {\n      \"kind\": \"clue_pick\",\n      \"prompt\": \"先挑出本题用到的已知条件：\",\n      \"clues\": [\n        \"8 个篮球\",\n        \"6 个足球\",\n        \"篮球每个 45.5 元\",\n        \"足球每个 38 元\",\n        \"学校在体育组（无关）\"\n      ],\n      \"correct\": [0, 1, 2, 3],\n      \"mode\": \"pick_correct\"\n    },\n    {\n      \"kind\": \"choose\",\n      \"prompt\": \"这道题最合适的数量关系是：\",\n      \"options\": [\n        { \"id\": \"A\", \"text\": \"总价 = 篮球单价 × 篮球数量 + 足球单价 × 足球数量\", \"correct\": true },\n        { \"id\": \"B\", \"text\": \"总价 = (篮球单价 + 足球单价) × (篮球数量 + 足球数量)\", \"correct\": false, \"errorTag\": \"relation_model_error\" },\n        { \"id\": \"C\", \"text\": \"总价 = 篮球数量 + 足球数量\", \"correct\": false, \"errorTag\": \"missing_unit_price\" },\n        { \"id\": \"D\", \"text\": \"总价 = 篮球单价 × 足球数量 + 足球单价 × 篮球数量\", \"correct\": false, \"errorTag\": \"swapped_quantities\" }\n      ]\n    },\n    {\n      \"kind\": \"numeric\",\n      \"prompt\": \"一共花了多少元？\",\n      \"value\": 592.0,\n      \"unit\": \"元\",\n      \"distractors\": [364.0, 514.0, 626.0]\n    }\n  ],\n  \"word_problem_steps\": {\n    \"known\": [\"8 个篮球\", \"6 个足球\", \"篮球每个 45.5 元\", \"足球每个 38 元\"],\n    \"question\": \"一共花了多少元？\",\n    \"relationship\": \"总价 = 篮球单价 × 篮球数量 + 足球单价 × 足球数量\",\n    \"equation_or_expression\": \"45.5 × 8 + 38 × 6\",\n    \"check\": \"364 + 228 = 592\"\n  },\n  \"solution_steps\": [\n    \"篮球总价：45.5 × 8 = 364 元\",\n    \"足球总价：38 × 6 = 228 元\",\n    \"合计：364 + 228 = 592 元\"\n  ],\n  \"hints\": [\n    { \"text\": \"先算篮球的总价\", \"penalty\": 1 },\n    { \"text\": \"数量关系：总价 = 单价 × 数量，分别算两种再相加\", \"penalty\": 2 }\n  ],\n  \"common_errors\": [\n    { \"tag\": \"relation_model_error\", \"error\": \"数量关系写错（合并单价或数量）\", \"remediation\": \"两种商品要分别算 单价 × 数量 再相加。\" },\n    { \"tag\": \"careless_reading\", \"error\": \"把题目里某个数字看错\", \"remediation\": \"圈出所有数字再算。\" }\n  ],\n  \"feedback_correct\": \"数量关系抓得准，分步算清楚！\",\n  \"feedback_wrong\": \"再读一遍题，注意区分两种商品的单价和数量。\",\n  \"tags\": [\"ai_generated\", \"word_problem\"]\n}\n```\n\n### 出题守则（重要）\n\n1. **clues 数组里要包含 1-2 条无关信息**（让 Selena 学会挑出真正有用的条件）。`correct` 数组只列有用条件的索引\n2. **relationshipChoices 4 个**：1 个对，3 个错。每个错误项都要标 `errorTag`（描述错在哪）。错误项要\"看起来合理\"——比如调换单价/数量、漏乘、加减号反了\n3. **distractors 3 个**：1 个常见加法错，1 个少算一步，1 个数字接近但单位错\n4. **stem 要有具体情境**（学校 / 商店 / 公园 / 家里），不要纯抽象 \"甲乙两数\"\n5. **数字保持小数点后 1-2 位**（4 年级范围）\n6. **estimated_time_seconds 推荐 60-120**（应用题需要思考时间）\n7. **difficulty 取 3-5**（应用题本身就是中难）\n\n### ⛔ 常见格式陷阱（schema 严格，错了直接拒绝）\n\n1. **`answer.steps[i].expected` 必须是字符串或数字，不能是数组**：\n   - `\"clue\"` 步：用**逗号拼接的字符串**（如 `\"0,1,2\"`），**不要**写成 `[0, 1, 2]`\n   - `\"relationship\"` 步：写完整的关系式字符串\n   - `\"answer\"` 步：用 number（带 `kind: \"answer\"`）\n   ✓ `{ \"step_id\": \"clue\", \"expected\": \"0,1,2\" }`\n   ✗ `{ \"step_id\": \"clue\", \"expected\": [0,1,2] }`\n\n2. **`solution_steps` 是字符串数组**，不是对象数组：\n   ✓ `[\"第一步：先算...\", \"第二步：...\", \"答案：592\"]`\n   ✗ `[{ \"step\": 1, \"text\": \"...\" }, ...]`\n\n3. **`hints[].penalty` 必须是整数 1-3**，不要用浮点：\n   ✓ `{ \"text\": \"...\", \"penalty\": 1 }`\n   ✗ `{ \"text\": \"...\", \"penalty\": 0.5 }`"
  },
  "difficultyRubrics": {
    "1": "## 难度 1（入门 · 识记）\n\n**对 4 年级 Selena 而言**：看一眼就懂，不用算。10-15 秒内能答。\n\n### 必须满足的特征\n- 单步识别 / 直接读出 / 对照表格选项\n- 数字小（整数 ≤ 100，小数仅 1 位且不含进位）\n- 题干 ≤ 30 个汉字\n- 不需要列式，看图/读题直接选\n\n### 典型例子\n- \"锐角小于（  ）度？\" → 90\n- \"0.6 里面有（  ）个 0.1？\" → 6\n- \"下面哪一个是钝角？\" → 选图\n\n### 时间（estimated_time_seconds）\n- speed_match：10\n- plain_choice：20\n- 其他模板：参考 quality-rubric 表的\"难度 1-2\"列\n\n### ⛔ 不要做\n- 不要要求列式\n- 不要含两步操作\n- 不要超过单元最基础概念",
    "2": "## 难度 2（基础 · 一步运算）\n\n**对 4 年级 Selena 而言**：单步运算 / 简单概念应用。15-30 秒。\n\n### 必须满足的特征\n- 一步加减乘除 / 一步换算 / 一步比较\n- 数字适中（小数 ≤ 2 位、整数 ≤ 1000）\n- 题干 ≤ 50 个汉字\n- 应用题情境单一（一种商品 / 一段路程）\n\n### 典型例子\n- \"0.85 + 1.6 = ?\"\n- \"3.5 米等于多少分米？\"\n- \"一支铅笔 1.5 元，买 4 支多少钱？\"\n- \"一个三角形两个内角分别 60° 和 80°，第三个角多少度？\"\n\n### 时间（estimated_time_seconds）\n- speed_match：10\n- plain_choice：20\n- decimal_shifter：18\n- shop_counter：35\n- word_problem_lab：70\n\n### ⛔ 不要做\n- 不要超过 1 步运算\n- 不要含混合运算\n- 不要带\"逆向\"（如已知差求一个加数）",
    "3": "## 难度 3（中等 · 默认 · 单元核心）\n\n**对 4 年级 Selena 而言**：教学单元的核心训练强度。30-50 秒。\n\n### 必须满足的特征\n- 两步运算 / 简单逆向 / 含一次单位换算\n- 数字真实（小数 1-2 位、可含 0、可含进位/借位）\n- 题干 30-80 个汉字\n- 应用题含两个量的关系\n\n### 典型例子\n- \"一支铅笔 1.25 元，买 4 支橡皮 0.9 元每块买 5 块，一共多少钱？\"\n- \"三角形两个角分别 35° 和 65°，第三个角多少度？属于哪一类？\"\n- \"0.158 米 = ___ 厘米 ___ 毫米\"\n- \"x + 2.5 = 7.8，求 x\"\n\n### 时间（estimated_time_seconds）\n- speed_match：15\n- plain_choice：30\n- decimal_shifter：25\n- shop_counter：50\n- word_problem_lab：90\n\n### ⛔ 不要做\n- 不要超过 2 步运算\n- 不要含\"奥数\"技巧（鸡兔同笼/盈亏）\n- 多步逆向问题应该是难度 4\n\n### 这是大多数 AI 题的目标难度\n教辅书 80% 单元题处于此难度。考点完整复盖，但不强求技巧。",
    "4": "## 难度 4（较难 · 多步综合 · 单元拔高）\n\n**对 4 年级 Selena 而言**：单元综合应用，2-3 步推理。50-90 秒。\n\n### 必须满足的特征\n- 多步运算（≥ 2 步含一次换算 / 或一次逆向）\n- 含一次\"陷阱\"（容易漏一步、错单位、混用法）\n- 题干 60-120 个汉字\n- 应用题含 3 个以上数据点 + 关系\n\n### 典型例子\n- \"甲、乙两车从相距 240 千米的两城同时相向开出，3 小时相遇。甲车每小时 45 千米，乙车每小时多少千米？\"\n- \"学校有 4 个班级捐款，总金额 580 元。一班和二班共捐 270 元，三班捐 156 元，四班捐多少元？平均每班多少元？\"\n- \"用一根铁丝围一个等边三角形，每边长 4.5 分米。如果改围一个边长 6 厘米的正方形，铁丝够吗？\"\n\n### 时间（estimated_time_seconds）\n- shop_counter：70\n- word_problem_lab：130\n- balance_lab：65\n\n### ⛔ 不要做\n- 不要纯计算（难度 4 要应用题或概念辨析综合）\n- 不要含未学公式（圆周率 / 面积 = πr²）\n- 选择题答案不要 4 选 1 都很接近（区分度仍要清晰）",
    "5": "## 难度 5（综合 · 期末压轴 · 跨概念）\n\n**对 4 年级 Selena 而言**：期末/抽奖大题级别。90-150 秒。\n\n### 必须满足的特征\n- 跨 2-3 个 skill 综合（如 小数乘法 + 平均数；或 三角形内角和 + 等量代换）\n- 含明确的\"分阶段\"思路：先求 A，再用 A 求 B\n- 题干 100-180 个汉字\n- 4 个以上数据点 + 多重约束\n\n### 典型例子\n- \"一辆汽车从甲城到乙城。前 2 小时每小时行 65 千米，后 3 小时每小时行 78 千米。这辆汽车整个行程平均每小时行多少千米？\"（路程速度 + 平均数）\n- \"三角形 ABC 中，∠A 比 ∠B 大 20°，∠C 是 ∠B 的 2 倍。求三个角的度数。\"（三角形内角和 + 列方程）\n- \"妈妈买了 3.5 千克苹果，每千克 6.8 元，付了 30 元。如果剩下的钱再买每盒 4.5 元的酸奶，最多能买几盒？\"（小数乘法 + 整除）\n\n### 时间（estimated_time_seconds）\n- word_problem_lab：130-150（按子步骤数加权）\n\n### ⛔ 不要做\n- 不要纯计算综合（如 5 道小数乘法叠加）\n- 不要奥数（鸡兔同笼 / 盈亏 / 数论）\n- 不要含未学概念（百分数 / 比例 / 体积）\n- 不要超过 3 步推理（4 年级孩子注意力撑不住）\n\n### 关键\n难度 5 不等于\"难题\"，等于\"综合题\"。考点跨越是核心特征。"
  },
  "formatRubrics": {
    "drag_drop": "## 答题格式：drag_drop（拖拽配对）\n\n**特点**：左右两列卡片，孩子拖左边某项到右边对应位置（或点击连线）。前端用 pair_match 模板（语文）或自定义拖拽模板（数学）。\n\n### 适用场景\n- **语文**：近反义词配对、量词配对、多音字-语境配对、汉字-拼音配对、字-部首配对\n- **数学**（少用）：单位换算配对（\"1 米 = ___\" / \"100 厘米 = ___\"）、图形-公式配对\n\n### 必填字段\n```json\n{\n  \"question_format\": \"drag_drop\",\n  \"game_data\": {\n    \"kind\": \"pair_match\",\n    \"leftItems\": [\n      { \"id\": \"L1\", \"text\": \"高兴\" },\n      { \"id\": \"L2\", \"text\": \"美丽\" },\n      { \"id\": \"L3\", \"text\": \"快速\" }\n    ],\n    \"rightItems\": [\n      { \"id\": \"R1\", \"text\": \"悲伤\" },\n      { \"id\": \"R2\", \"text\": \"丑陋\" },\n      { \"id\": \"R3\", \"text\": \"缓慢\" }\n    ],\n    \"correctPairs\": [\n      [\"L1\", \"R1\"],\n      [\"L2\", \"R2\"],\n      [\"L3\", \"R3\"]\n    ]\n  },\n  \"answer\": {\n    \"type\": \"multi_step\",\n    \"steps\": [{ \"step_id\": \"pairs\", \"expected\": \"L1-R1,L2-R2,L3-R3\" }]\n  }\n}\n```\n\n### 设计要求\n\n#### 1. 配对数量\n- 3-5 对（2 对太少没挑战，6+ 太繁琐）\n- 左右两列数量必须相等\n\n#### 2. 干扰防呆\n- 左右各列不要重复（同一个 right 不能匹配多个 left）\n- 不要让答案\"显然\"（如左 \"苹果\" 右 \"fruit\" + \"horse\" + \"car\"，过于明显）\n- 选项之间应有真实辨析价值\n\n#### 3. 适合 4 年级的难度\n- 词的概念在课内（不超纲）\n- 不要混入两类题（既考近反义词又考量词）— 一道题专心一类\n\n#### 4. 题干（stem）写法\n- \"把左边的词和右边的反义词连起来\" / \"把汉字和正确的部首拖到一起\"\n- 避免\"输入\" \"选填\" 等模糊指令\n\n### ⛔ 禁止\n- 答案 multi-correct（一个 left 匹配多个 right）\n- 拖到不存在的 right slot\n- 配对数量不一致\n\n### 时间（estimated_time_seconds）\n- 3 对：30s\n- 4 对：40s\n- 5 对：50s",
    "fill_blank": "## 答题格式：fill_blank（填空题 / 自由输入数字）\n\n**特点**：题干结尾问\"…是多少 X？\"或含 `___` / `（  ）` 等空白标记，孩子直接输入数字（含单位由前端显示）。前端用 plain_numeric 模板，**不**显示选项。\n\n### 必填字段\n```json\n{\n  \"question_format\": \"fill_blank\",\n  \"answer\": { \"type\": \"number\", \"value\": 0.158, \"unit\": \"米\", \"acceptable_error\": 0.001 }\n}\n```\n\n### 何时用 fill_blank（vs numeric）\n- 文字题问数字 → fill_blank（不需要 4 选 1）\n- 纯算式题（\"5.6 + 2.4 = ?\"）→ numeric（前端会自动 4 选 1）\n- 单位换算题（\"3.5 米 = ___ 厘米\"）→ fill_blank\n\n### stem 写法\n- 自然语言：\"一支铅笔长 15 厘米 8 毫米，用米作单位是多少米？\"\n- 含填空标记：\"3 米 8 分米 = ___ 米\"\n\n### options 字段\n- ⛔ **不要给 options**（fill_blank 不展示选项）\n- ⛔ 不要给 distractors（前端会忽略）\n\n### unit\n- 有单位必填\n- 前端会在输入框旁边显示单位提示（\"答案：___ 米\"）\n\n### acceptable_error\n- 整数：0\n- 小数 1 位：0.05\n- 小数 2 位：0.005\n- 小数 3 位：0.001\n- 估算：\"约多少\" → 5%\n\n### ⛔ 禁止\n- 答案是中文短语（\"等腰三角形\"）→ 用 single_choice\n- 答案是表达式（\"x + 5\"）→ 用 single_choice\n- 多个空白（\"___ 米 ___ 厘米\"）→ 用 multi_step 或拆成两道题",
    "geometry_operation": "## 答题格式：geometry_operation（几何操作）\n\n**特点**：在画布 / 点子图上画图、连线、标注角度。前端用 dot_grid_draw 模板。\n\n### 适用场景\n- 三角形 / 四边形构造（按要求画图）\n- 标三角形分类（看图判断 + 在点子图上画对应图形）\n- 量角器读角度（更进阶）\n\n### 必填字段\n```json\n{\n  \"question_format\": \"geometry_operation\",\n  \"play_as\": \"dot_grid_draw\",\n  \"answer\": {\n    \"type\": \"choice\",\n    \"value\": \"isosceles_right_triangle\"\n  },\n  \"dot_grid\": {\n    \"gridWidth\": 6,\n    \"gridHeight\": 6,\n    \"expectedShape\": \"isosceles_right_triangle\",\n    \"minVertices\": 3,\n    \"maxVertices\": 3\n  }\n}\n```\n\n### 设计要求\n\n#### 1. 题目要求明确\n- ✅ \"在点子图上画一个等腰直角三角形\"\n- ✅ \"用 4 个格点画一个长方形（不是正方形）\"\n- ❌ \"画个图\" / \"在格子里画一画\"\n\n#### 2. expectedShape 必须是合法值\n合法的：\n- `parallelogram` — 平行四边形\n- `rectangle` — 长方形\n- `square` — 正方形\n- `trapezoid` — 梯形\n- `isosceles_triangle` — 等腰三角形\n- `equilateral_triangle` — 等边三角形（点子图很难精确画，慎用）\n- `right_triangle` — 直角三角形\n- `isosceles_right_triangle` — 等腰直角三角形\n\n#### 3. 网格尺寸\n- 通常 5×5 到 7×7\n- 太小（≤4×4）画图自由度太低；太大（≥8×8）孩子找不准点\n\n#### 4. 顶点数\n- 三角形：minVertices: 3, maxVertices: 3\n- 四边形：minVertices: 4, maxVertices: 4\n\n#### 5. 应该判定的属性\n判分逻辑（前端 DotGridDraw.tsx）：\n- 边长（用网格距离）\n- 内角（向量点积判直角；正负判等长）\n- 顶点数\n\n### 解答提示（hints）写法\n- ✅ \"先选一个直角顶点（90° 角），再向两个方向选距离相等的格点\"\n- ✅ \"正方形需要 4 条相同长度的边 + 4 个直角\"\n- ❌ \"你画对就行\" / \"想想看\"\n\n### 时间（estimated_time_seconds）\n- 简单图形（直角三角形 / 长方形）：50s\n- 中等（等腰三角形 / 梯形）：60s\n- 复杂（特殊位置约束）：80s\n\n### ⛔ 禁止\n- expectedShape 不在合法清单\n- 网格太小让题不可解\n- 不可能存在的图形（如格点上画正三角形—除非允许斜边）\n- 题干没说目标形状",
    "multi_choice": "## 答题格式：multi_choice（多选）\n\n**特点**：≥ 2 个正确选项，其余是干扰。前端用 clue_finder 模板呈现（线索挑选）。\n\n### 必填字段\n```json\n{\n  \"question_format\": \"multi_choice\",\n  \"options\": [\n    { \"id\": \"A\", \"text\": \"三角形内角和 180°\" },\n    { \"id\": \"B\", \"text\": \"正方形是特殊的长方形\" },\n    { \"id\": \"C\", \"text\": \"锐角三角形有两个锐角\" },\n    { \"id\": \"D\", \"text\": \"等边三角形是特殊的等腰三角形\" }\n  ],\n  \"answer\": { \"type\": \"choice\", \"value\": \"A,B,D\" }   // 逗号分隔，按字母排序\n}\n```\n\n### 何时用 multi_choice\n- 概念辨析\"全选正确的\"\n- 判断对错从一组\"全部为真的命题\"中挑出（语文阅读多选）\n- \"下列哪些 X 正确\" 风格题\n\n### 设计要求\n- ≥ 2 个正确，**不要全选 4 个**（区分度太低）\n- 不要 1 个正确（那应该用 single_choice）\n- answer.value：所有正确选项 id 按字母升序逗号分隔（\"A,B,D\" 而非 \"B,A,D\"）\n- 错误选项必须是 **常见误解**（不是显然荒唐）\n\n### ⛔ 禁止\n- 4 年级数学题不建议用 multi_choice（认知负担大）。除非真有 ≥ 2 个正确答案的题（如\"哪些是钝角三角形？\"），否则改 single_choice。",
    "multi_step": "## 答题格式：multi_step（多阶段应用题）\n\n**特点**：把应用题拆成 2-3 个 sub-question 让孩子分阶段答（先挑已知 → 再列关系 → 再算结果）。前端用 shop_counter 模板。\n\n### 必填字段\n```json\n{\n  \"question_format\": \"multi_step\",\n  \"subquestions\": [\n    {\n      \"kind\": \"clue_pick\",\n      \"prompt\": \"下面哪些是解题需要的已知信息？\",\n      \"clues\": [\"篮球 8 个\", \"足球 6 个\", \"篮球 45.5 元/个\", \"足球 38 元/个\", \"学校在城东\"],\n      \"correct\": [0, 1, 2, 3],\n      \"mode\": \"pick_correct\"\n    },\n    {\n      \"kind\": \"choose\",\n      \"prompt\": \"选出正确的数量关系：\",\n      \"options\": [\n        { \"id\": \"A\", \"text\": \"总价 = 篮球单价 × 篮球数量 + 足球单价 × 足球数量\", \"correct\": true },\n        { \"id\": \"B\", \"text\": \"总价 = (篮球数量 + 足球数量) × 平均单价\", \"correct\": false }\n      ],\n      \"multi\": false\n    },\n    {\n      \"kind\": \"numeric\",\n      \"prompt\": \"一共多少元？\",\n      \"value\": 592.0,\n      \"unit\": \"元\",\n      \"distractors\": [580.5, 600.0, 564.0]\n    }\n  ],\n  \"answer\": {\n    \"type\": \"multi_step\",\n    \"steps\": [\n      { \"step_id\": \"clue\", \"expected\": \"0,1,2,3\" },\n      { \"step_id\": \"relationship\", \"expected\": \"总价 = 篮球单价 × 篮球数量 + 足球单价 × 足球数量\" },\n      { \"step_id\": \"answer\", \"expected\": 592.0, \"kind\": \"answer\" }\n    ]\n  }\n}\n```\n\n### 设计要求\n\n#### 1. **3 步必须形成完整推理链**\n- step 1（clue_pick）→ 让孩子识别\"哪些信息有用\"\n- step 2（choose）→ 让孩子选\"怎么列式\"\n- step 3（numeric）→ 让孩子算\"具体多少\"\n- 不能跳步，每步独立可答\n\n#### 2. **逻辑一致性（最容易翻车的地方）**\n- step 1 选出的 clues **必须** 在 step 2 的关系式里都用到\n- step 2 选的关系式 **必须** 算出 step 3 的 answer\n- 三步任何一处对不上立刻判 wrong_answer\n\n#### 3. **clues 字段**\n- 5-6 条候选，包含 1-2 条\"无关信息\"（\"学校在城东\"、\"今天周三\"）\n- correct 数组写正确 clue 的索引（不是 id）\n- mode：\"pick_correct\" / \"pick_wrong\"（极少用 pick_wrong）\n\n#### 4. **choose 字段**\n- 2-4 个候选关系式，恰好 1 个 correct: true\n- 错误选项必须是 **常见错误模型**（如 \"总价 = 单价 + 数量\"、\"总价 = (a+b) × 平均\")\n- 不要让 4 个公式长度差很多\n\n#### 5. **numeric 字段**\n- value 必须等于 step 2 关系式按 step 1 数字计算的结果\n- distractors 是 3 个常见错误数字（漏一项 / 算错单位 / 算错小数位）\n\n### ⛔ 禁止\n- 不要 1 步（那是 numeric / single_choice 的活）\n- 不要 4 步以上（4 年级注意力撑不住）\n- step 2 关系式不能含 5 年级才学的概念（百分数 / 体积）",
    "numeric": "## 答题格式：numeric（自由数字输入 / 4 选 1 都行）\n\n**特点**：答案是一个数字，stem 是一道纯算式或自然语言问数字的题。如果给了 distractors 数组，前端会自动 4 选 1（speed_match）；没给就 plain_numeric input。\n\n### 必填字段\n```json\n{\n  \"question_format\": \"numeric\",\n  \"answer\": { \"type\": \"number\", \"value\": 12.5, \"unit\": \"元\", \"acceptable_error\": 0 },\n  \"distractors\": [10.5, 11.5, 13.5]   // 可选：3 个干扰项 → 自动 4 选 1\n}\n```\n\n### 干扰项设计（如有）\n- 必须是 3 个不同的\"高质量错误\"答案：\n  1. 操作反了（× 写成 ÷ / + 写成 -）\n  2. 漏一步（少进位 / 少借位 / 少乘）\n  3. 小数点错位（多/少一位）\n- ⛔ 不要让 4 个数字相邻 1（如 10/11/12/13）\n\n### unit 字段\n- 有单位的题必须填（\"元\"/\"米\"/\"度\"/\"千克\"）。\n- Selena 看到答案\"3.5\"和\"3.5 米\"会区别——前端按 unit 显示。\n\n### acceptable_error\n- 整数题：0\n- 小数题：0.001（避免浮点比较 0.30 != 0.3）\n- 估算题：根据题意明示（如 \"≈\" 时 5%）\n\n### ⛔ 禁止\n- 选 numeric 但 stem 含 \"下面…正确\" / \"哪一项\" → 应该用 single_choice\n- 答案是分数 / 表达式 → 应该用 single_choice",
    "numeric_choice": "## 答题格式：numeric_choice（数字 4 选 1）\n\n**特点**：本质是 numeric 题但显式给了 4 个数字选项。前端用 speed_match。\n\n### 必填字段\n```json\n{\n  \"question_format\": \"numeric_choice\",\n  \"options\": [\n    { \"id\": \"A\", \"text\": \"12.5\" },\n    { \"id\": \"B\", \"text\": \"12.05\" },\n    { \"id\": \"C\", \"text\": \"1.25\" },\n    { \"id\": \"D\", \"text\": \"125\" }\n  ],\n  \"answer\": { \"type\": \"choice\", \"value\": \"A\" }\n}\n```\n\n### 何时用\n- 想让孩子练 \"数感\" / \"口算选最优\" 时（speed_match 模板抢答）\n- 答案明显有 \"小数点错位\" 这类典型陷阱时（不让 plain_numeric 输入逃过陷阱）\n\n### 设计要求\n- options[].text 都是纯数字（不带单位也行，单位放 stem 里）\n- 4 个选项区分度大，不要 4 个相邻整数\n- 1 正确 + 3 干扰，干扰必须对应 4 年级常见错误：\n  - 小数点错位（12.5 vs 1.25 vs 125）\n  - 漏一位 / 多一位（12.05 vs 12.5）\n  - 操作反（120 - 5 vs 125 + 5）\n\n### vs numeric\n- numeric + distractors → 完全等价（前端自动展开）\n- 唯一差别：numeric_choice 显式声明，更清晰\n\n### vs single_choice\n- single_choice 选项可以是中文短句\n- numeric_choice 选项必须全是数字",
    "single_choice": "## 答题格式：single_choice（4 选 1 / 单选）\n\n**特点**：4 个选项中**恰好 1 个正确**，其余是高质量干扰项。\n\n### 必填字段\n```json\n{\n  \"question_format\": \"single_choice\",\n  \"options\": [\n    { \"id\": \"A\", \"text\": \"70 度\", \"errorTag\": \"\" },\n    { \"id\": \"B\", \"text\": \"60 度\", \"errorTag\": \"wrong_subtract_direction\" },\n    { \"id\": \"C\", \"text\": \"80 度\", \"errorTag\": \"missed_step\" },\n    { \"id\": \"D\", \"text\": \"90 度\", \"errorTag\": \"default_right_angle\" }\n  ],\n  \"answer\": { \"type\": \"choice\", \"value\": \"A\" }\n}\n```\n\n### 何时用 single_choice\n- 概念辨析（\"下面对小数 6.047 中 4 的解释，正确的是？\"）\n- 真假判断升级版（\"哪一种竖式对齐方式是正确的？\"）\n- 多个量都要算但只问其中一个（\"按角分属于哪一类？\"）\n- 选项是图形/图片描述\n\n### 何时不用（错误用法）\n- ⛔ stem 是 \"…是多少 X？\" + 答案是单一数值 → 用 fill_blank\n- ⛔ 答案是表达式（\"x + 5 = 12\"） → 用 single_choice 但 options 必须是完整表达式\n- ⛔ 选项之间没区分度（4 个相邻数字 50/51/52/53）\n\n### 选项设计 4 原则\n1. **1 正确 + 3 高质量干扰项**\n2. 每个干扰项对应一种 **典型错误模式**（用 errorTag 标）：\n   - 操作反了（add/sub 互换）\n   - 漏一步（不进位）\n   - 小数点错位\n   - 单位错（厘米 vs 毫米）\n   - 公式错（用周长公式算面积）\n3. **干扰项要\"似是而非\"**：4 年级孩子算错容易得到的数字\n4. **答案位置随机**（A/B/C/D 都用，不要总把 C 当正解）\n\n### options[].text 长度\n- 单一数字 + 单位（\"12.5 元\"）→ 简短即可\n- 完整短句（\"1 米 = 100 厘米\"）→ 让 4 个选项长度差不多，避免长度暗示\n\n### errorTag 选词\n小学数学常用 tag：\n- `decimal_point_error`、`carry_missing`、`borrow_missing`、`unit_mismatch`\n- `add_sub_swap`、`mul_div_swap`、`wrong_formula`、`off_by_one`\n- `careless_reading`（默认 fallback）",
    "sort_ladder": "## 答题格式：sort_ladder（排序题）\n\n**特点**：给若干项让孩子按指定顺序拖到正确位置（升序 / 降序 / 时间顺序 / 故事顺序）。前端用 sort_ladder 或 sentence_shuffle 模板。\n\n### 适用场景\n- **数学**：小数大小排序、长度 / 重量比较排序、温度从低到高\n- **语文**：句子排序（按事件先后）、古诗诗句顺序、词语按结构分组排序\n\n### 必填字段\n```json\n{\n  \"question_format\": \"sort_ladder\",\n  \"play_as\": \"sort_ladder\",\n  \"options\": [\n    { \"id\": \"A\", \"text\": \"0.45\" },\n    { \"id\": \"B\", \"text\": \"0.5\" },\n    { \"id\": \"C\", \"text\": \"0.405\" },\n    { \"id\": \"D\", \"text\": \"0.504\" }\n  ],\n  \"answer\": {\n    \"type\": \"choice\",\n    \"value\": \"C,A,B,D\"\n  }\n}\n```\n\n### 设计要求\n\n#### 1. 排序项数\n- 3-5 项（2 项不算排序，6+ 太繁琐）\n\n#### 2. 答案表示\n- `answer.value` 是按目标顺序连接的 id 字符串（逗号分隔）\n- 如升序则从小到大列出\n\n#### 3. 题干必须明确方向\n- ✅ \"把下面小数从小到大排列\"\n- ✅ \"按时间顺序排列下面句子\"\n- ❌ \"排一下\" / \"整理一下\"\n\n#### 4. 项目之间区分度\n- 数学排序：相邻两项至少要明显不同（不要 0.499 / 0.5 / 0.501 让孩子心算崩）\n- 语文句子排序：每句的时间 / 因果关系要清晰\n\n#### 5. 不能有\"并列\"项\n- 任何两项必须有明确顺序（不能 0.30 和 0.3 都对）\n\n### 数学排序专用要求\n- 数字类型一致（不要混 1/2 和 0.5）\n- 单位一致（不要混 米 和 厘米）\n\n### 语文句子排序专用要求\n- 4-5 个句子能拼一个完整段落\n- 必须有\"事件先后\" / \"因果链\" / \"起承转合\" 等明确逻辑\n- 不要让孩子靠\"哪句更通顺\"猜（必须有客观顺序）\n\n### 时间（estimated_time_seconds）\n- 3 项：25s\n- 4 项：35s\n- 5 项：45s\n\n### ⛔ 禁止\n- 项数 < 3 或 > 5\n- 任意两项可互换（无明确顺序）\n- 数学单位混\n- 语文句子没有清晰逻辑"
  },
  "skillScope": {
    "decimal_meaning_place": {
      "name": "小数意义、小数数位",
      "term": "下册",
      "unitId": "G4B_U1_DECIMAL_ADD_SUB",
      "definition": "理解小数表示十进制分数（0.1 = 1/10、0.01 = 1/100、0.001 = 1/1000），认识小数的数位顺序（个位 / 十分位 / 百分位 / 千分位）。",
      "inScope": [
        "小数与分数互译（0.6 = 6/10）",
        "数位识别（0.358 中 5 在百分位，表示 5 个 0.01）",
        "用计数器/方格图理解小数",
        "三位小数为止"
      ],
      "outOfScope": [
        "❌ 循环小数（5 年级）",
        "❌ 百分数（6 年级）",
        "❌ 科学计数法",
        "❌ 用小数算面积/体积"
      ],
      "keyFormulas": [
        "0.1 = 1/10、0.01 = 1/100、0.001 = 1/1000",
        "数位从右到左：千分位 / 百分位 / 十分位 / 个位",
        "n 个 0.1 = 0.n（n ≤ 9）"
      ],
      "typicalContexts": [
        "计数器拨珠",
        "方格图涂色",
        "数轴上找小数",
        "读小数说意义"
      ],
      "commonMistakes": [
        "把 0.30 和 0.3 当不相等",
        "把 0.05 中的 5 说成在十分位",
        "不区分 0.6 和 0.06"
      ],
      "exampleStems": [
        "0.6 里面有几个 0.1？",
        "由 7 个 0.1、3 个 0.01 和 5 个 0.001 组成的小数是多少？",
        "在计数器上，个位 0 颗珠、十分位 6 颗珠、百分位 0 颗珠、千分位 4 颗珠。这个小数是多少？"
      ]
    },
    "decimal_unit_conversion": {
      "name": "长度、质量、面积、人民币单位换算",
      "term": "下册",
      "unitId": "G4B_U1_DECIMAL_ADD_SUB",
      "definition": "用小数表示带复名数的量，如把 1 米 5 厘米写成 1.05 米；反之把 1.05 米拆成 1 米 5 厘米。",
      "inScope": [
        "长度：千米 / 米 / 分米 / 厘米 / 毫米 互换",
        "质量：吨 / 千克 / 克 互换",
        "面积：平方米 / 平方分米 / 平方厘米 互换",
        "人民币：元 / 角 / 分 互换",
        "复名数 ↔ 单名数（小数）双向"
      ],
      "outOfScope": [
        "❌ 公顷、平方千米（5 年级才学）",
        "❌ 立方单位（5 年级）",
        "❌ 角度的 60 进制换算（不属于本 skill）",
        "❌ 时间的 60 进制（不在 G4B）"
      ],
      "keyFormulas": [
        "1 米 = 10 分米 = 100 厘米 = 1000 毫米",
        "1 千米 = 1000 米",
        "1 千克 = 1000 克",
        "1 元 = 10 角 = 100 分",
        "面积单位每相邻两级 100 倍：1 平方米 = 100 平方分米 = 10000 平方厘米"
      ],
      "typicalContexts": [
        "买文具花元角分",
        "测量身高用米和厘米",
        "买水果用千克和克",
        "面积测量"
      ],
      "commonMistakes": [
        "面积单位用 10 倍换算（错，应是 100 倍）",
        "毫米转米忘除以 1000",
        "复名数直接拼成 1.5 米（5 厘米写成 0.5 米）"
      ],
      "exampleStems": [
        "一支铅笔长 15 厘米 8 毫米，用米作单位是多少米？",
        "3 米 8 分米 = ___ 米",
        "650 平方厘米 = ___ 平方分米"
      ]
    },
    "decimal_compare": {
      "name": "小数大小比较",
      "term": "下册",
      "unitId": "G4B_U1_DECIMAL_ADD_SUB",
      "definition": "比较两个或多个小数的大小，从最高位逐位比较。",
      "inScope": [
        "两个小数比大小",
        "三个或更多小数排序（升序/降序）",
        "大小关系符 < / > / =",
        "末尾 0 不影响大小（0.30 = 0.3）"
      ],
      "outOfScope": [
        "❌ 与百分数比",
        "❌ 与分数比（不在本 skill 重点）"
      ],
      "keyFormulas": [
        "整数部分大的小数大",
        "整数部分相等时从十分位往后逐位比较",
        "末尾添 0 不改变小数大小"
      ],
      "typicalContexts": [
        "跳远成绩排名",
        "体重比较",
        "价格比较",
        "温度比较"
      ],
      "commonMistakes": [
        "认为 0.123 比 0.5 大（用整数思维比位数）",
        "末尾 0 当作不同（0.30 ≠ 0.3）",
        "比错方向（升序当降序）"
      ],
      "exampleStems": [
        "在 0.45、0.5、0.405 中，最大的是哪个？",
        "下面排列从小到大正确的是？",
        "比较 0.30 和 0.3 的大小"
      ]
    },
    "decimal_add_sub_vertical": {
      "name": "小数加减竖式，小数点对齐",
      "term": "下册",
      "unitId": "G4B_U1_DECIMAL_ADD_SUB",
      "definition": "用竖式计算小数加减，关键是小数点对齐（即相同数位对齐），不够位补 0。",
      "inScope": [
        "两位小数 + 两位小数",
        "小数 + 整数（如 5 + 2.36）",
        "末尾位数不同的小数（如 3.07 + 2.9）",
        "差值含借位"
      ],
      "outOfScope": [
        "❌ 三个以上小数连加",
        "❌ 含括号的混合运算（不属于本 skill）"
      ],
      "keyFormulas": [
        "小数点对齐 = 相同数位对齐",
        "整数部分末位补 .0；位数不齐补 0",
        "结果的小数点直接落下来"
      ],
      "typicalContexts": [
        "买东西算找零",
        "测量长度求总长",
        "气温变化"
      ],
      "commonMistakes": [
        "末位对齐而非小数点对齐（3.07 + 2.9 错对齐）",
        "结果忘点小数点",
        "借位忘记小数部分（5 - 2.36 算成 2.64）"
      ],
      "exampleStems": [
        "用竖式计算 3.07 + 2.9，下面哪个对齐方式正确？",
        "15 - 6.48 用竖式怎么算？"
      ]
    },
    "decimal_add_sub_simplify": {
      "name": "小数加减简便计算",
      "term": "下册",
      "unitId": "G4B_U1_DECIMAL_ADD_SUB",
      "definition": "用加法交换律 / 结合律简化小数加减运算（凑整 + 同正负相加）。",
      "inScope": [
        "凑整：3.6 + 2.5 + 6.4 → (3.6 + 6.4) + 2.5",
        "同号合并：4.8 + 1.5 - 0.8 → (4.8 - 0.8) + 1.5",
        "拆数凑整：5.97 + 2.4 → 6 + 2.4 - 0.03"
      ],
      "outOfScope": [
        "❌ 乘法分配律（属于 simplify_integer/decimal_mul_simplify）"
      ],
      "keyFormulas": [
        "a + b = b + a（加法交换律）",
        "(a + b) + c = a + (b + c)（加法结合律）",
        "a - b - c = a - (b + c)（连减性质）"
      ],
      "typicalContexts": [
        "三步小数运算",
        "购物总价",
        "重量合计"
      ],
      "commonMistakes": [
        "凑整时错用减法律",
        "连减改成减加（搞错符号）",
        "不识别凑整机会，硬算"
      ],
      "exampleStems": [
        "用简便方法计算：3.6 + 2.5 + 6.4 + 7.5",
        "4.8 - 1.6 - 0.4 怎么简便？"
      ]
    },
    "decimal_inverse_problem": {
      "name": "已知和/差求未知量逆向应用题",
      "term": "下册",
      "unitId": "G4B_U1_DECIMAL_ADD_SUB",
      "definition": "已知两个小数的和或差以及其中一个量，求另一个量。考查「逆运算」思维。",
      "inScope": [
        "已知 a + b = c 和 a，求 b（即 c - a）",
        "已知 a - b = c 和 a，求 b（即 a - c）",
        "已知 a - b = c 和 b，求 a（即 c + b）",
        "应用题情境（购物找零、长度比差）"
      ],
      "outOfScope": [
        "❌ 列方程解（属于 equation_one_step_word）"
      ],
      "keyFormulas": [
        "和 - 已知加数 = 未知加数",
        "被减数 - 差 = 减数",
        "差 + 减数 = 被减数"
      ],
      "typicalContexts": [
        "付钱找零",
        "比身高差",
        "比赛成绩差",
        "杯里水位变化"
      ],
      "commonMistakes": [
        "把「还差多少」算成加（实际是减）",
        "找零问题用加法（应是减）",
        "比差时方向反了"
      ],
      "exampleStems": [
        "小红付了 20 元，应找回 6.5 元，她买的东西多少元？",
        "甲绳比乙绳长 1.2 米，乙绳长 3.5 米，甲绳长多少米？"
      ]
    },
    "triangle_inequality": {
      "name": "三角形三边关系",
      "term": "下册",
      "unitId": "G4B_U2_TRI_QUAD",
      "definition": "三角形任意两边之和大于第三边（或等价：任意两边之差小于第三边）。判断给定三条边能否构成三角形。",
      "inScope": [
        "判断三条边能否围三角形",
        "已知两边求第三边的范围（差 < 第三边 < 和）",
        "三角形周长计算"
      ],
      "outOfScope": [
        "❌ 余弦定理 / 海伦公式（高中）",
        "❌ 角度和边的对应关系（5 年级以上）"
      ],
      "keyFormulas": [
        "任意两边之和 > 第三边",
        "任意两边之差 < 第三边",
        "判断时只需验证 最小两边之和 > 最大边"
      ],
      "typicalContexts": [
        "用三根吸管 / 木棍拼三角形",
        "已知两边求第三边整数取值",
        "围出最大三角形"
      ],
      "commonMistakes": [
        "只检查一组而非所有三组（实际只需检查两短边之和 > 长边）",
        "把 = 也当成能围",
        "求范围时忘开区间"
      ],
      "exampleStems": [
        "三根木棍长 5 cm、7 cm、10 cm，能围成三角形吗？",
        "三角形两边长 3 cm 和 8 cm，第三边的长度可以是多少？（取整数）"
      ]
    },
    "triangle_angle_sum": {
      "name": "三角形内角和",
      "term": "下册",
      "unitId": "G4B_U2_TRI_QUAD",
      "definition": "三角形三个内角之和等于 180°。已知两个角求第三个；已知一个角与另外两角的关系求各角。",
      "inScope": [
        "已知两角求第三角",
        "已知一角加另外两角的差/比关系求各角",
        "结合三角形分类（按角分）",
        "等腰/等边三角形的角度推算"
      ],
      "outOfScope": [
        "❌ 多边形内角和（5 年级）",
        "❌ 弧度",
        "❌ 余角补角综合"
      ],
      "keyFormulas": [
        "∠A + ∠B + ∠C = 180°",
        "等边三角形每个角 60°",
        "等腰三角形两底角相等"
      ],
      "typicalContexts": [
        "三角板组合",
        "测量三角形角度",
        "等腰/等边三角形求角"
      ],
      "commonMistakes": [
        "把内角和当 360°（混淆四边形）",
        "忘记减第二个角",
        "计算时忘单位（° 漏写）"
      ],
      "exampleStems": [
        "三角形两个内角是 45° 和 65°，第三个角多少度？",
        "等腰三角形一个底角 70°，顶角多少度？"
      ]
    },
    "triangle_classification": {
      "name": "按角/边给三角形分类",
      "term": "下册",
      "unitId": "G4B_U2_TRI_QUAD",
      "definition": "按角分（锐角 / 直角 / 钝角三角形）和按边分（不等边 / 等腰 / 等边三角形）。",
      "inScope": [
        "三个角度判断按角分类",
        "三条边长判断按边分类",
        "组合分类（如等腰直角三角形）",
        "辨认特殊三角形（等边、等腰直角）"
      ],
      "outOfScope": [
        "❌ 锐角/钝角的精确度量（用量角器属于 angle_measure）"
      ],
      "keyFormulas": [
        "按角：锐角三角形（三角都 < 90°）/ 直角三角形（恰一个 90°）/ 钝角三角形（恰一个 > 90°）",
        "按边：不等边（三边都不等）/ 等腰（≥ 两边等）/ 等边（三边都等）"
      ],
      "typicalContexts": [
        "看图分类",
        "已知三角度判断",
        "已知三边长判断"
      ],
      "commonMistakes": [
        "把直角三角形归到锐角（看到一个锐角就分类）",
        "等边当不等边（不知等边是特殊等腰）",
        "钝角误判（角度刚 > 90° 看不准）"
      ],
      "exampleStems": [
        "三个内角 45°、45°、90° 是什么三角形？",
        "三边都等于 5 cm 是什么三角形？"
      ]
    },
    "decimal_mul_meaning": {
      "name": "小数乘法意义",
      "term": "下册",
      "unitId": "G4B_U3_DECIMAL_MULTIPLY",
      "definition": "理解小数乘法的实际含义：a × b 表示求 a 的 b 倍 / b 个 a 是多少 / b 份每份 a 共多少。",
      "inScope": [
        "小数 × 整数：表示 n 个相同的小数累加",
        "小数 × 小数：表示一个数的几分之几（不超 1）",
        "用图（线段 / 方格 / 数轴）理解意义"
      ],
      "outOfScope": [
        "❌ 倍数 vs 倍率（5 年级百分数）"
      ],
      "keyFormulas": [
        "3 × 0.5 = 求 3 的 0.5 倍 = 1.5",
        "0.6 × 4 = 4 个 0.6 = 2.4"
      ],
      "typicalContexts": [
        "买几份某商品",
        "测量同样长度若干次",
        "面积/体积场景的初步意义"
      ],
      "commonMistakes": [
        "把 a × 0.5 当作「a 的两倍」（实际是一半）",
        "把 0.5 × 4 当作「5 的 4 倍」（不识别小数）"
      ],
      "exampleStems": [
        "0.16 × 7 表示什么意义？",
        "1.6 × 7 在生活中能用什么情境表示？"
      ]
    },
    "decimal_point_shift": {
      "name": "小数点移动规律，扩大/缩小",
      "term": "下册",
      "unitId": "G4B_U3_DECIMAL_MULTIPLY",
      "definition": "把一个数扩大（× 10、× 100、× 1000）小数点向右移；缩小（÷ 10、÷ 100、÷ 1000）小数点向左移。",
      "inScope": [
        "× 10 / × 100 / × 1000",
        "÷ 10 / ÷ 100 / ÷ 1000",
        "应用：与单位换算结合（厘米转米：÷ 100）"
      ],
      "outOfScope": [
        "❌ × 0.1 / × 0.01 用乘法竖式（用本 skill 即可，但不算分母分子）"
      ],
      "keyFormulas": [
        "× 10：小数点右移 1 位",
        "÷ 100：小数点左移 2 位",
        "位数不够补 0"
      ],
      "typicalContexts": [
        "单位换算",
        "测量结果换算",
        "与生活的元角分换算"
      ],
      "commonMistakes": [
        "方向反了（扩大左移、缩小右移）",
        "位数不够忘补 0",
        "把 × 10 当成 + 一位 0（整数才是这样）"
      ],
      "exampleStems": [
        "把 3.45 扩大 100 倍是多少？",
        "0.06 米 = ___ 厘米（用小数点移动思考）"
      ]
    },
    "decimal_mul_vertical": {
      "name": "小数乘法竖式",
      "term": "下册",
      "unitId": "G4B_U3_DECIMAL_MULTIPLY",
      "definition": "用竖式计算两个小数（或小数 × 整数）的积。先按整数乘法算，再点小数点。",
      "inScope": [
        "小数 × 整数（如 1.25 × 4）",
        "小数 × 小数（如 1.5 × 0.4）",
        "小数 × 两位整数（如 0.85 × 12）",
        "结果末尾去 0（如 1.25 × 4 = 5.00 写作 5）"
      ],
      "outOfScope": [
        "❌ 三位小数相乘（计算量过大）"
      ],
      "keyFormulas": [
        "竖式按整数乘法对齐末位（不是小数点对齐！）",
        "积的小数位数 = 两因数小数位数之和",
        "末尾的 0 可以去掉"
      ],
      "typicalContexts": [
        "购物求总价",
        "测量与小数的乘",
        "竖式题"
      ],
      "commonMistakes": [
        "竖式按小数点对齐（错，应按末位对齐）",
        "积的小数位数算错（漏一位 / 多一位）",
        "末尾 0 不去（写 1.25 × 4 = 5.00）"
      ],
      "exampleStems": [
        "用竖式计算 1.25 × 4",
        "用竖式计算 0.85 × 12"
      ]
    },
    "decimal_product_digits": {
      "name": "积的小数位数判断",
      "term": "下册",
      "unitId": "G4B_U3_DECIMAL_MULTIPLY",
      "definition": "不实际算积也能判断结果有几位小数：两因数小数位数之和。",
      "inScope": [
        "判断积的小数位数",
        "据此推算正确答案",
        "末尾 0 影响位数（去 0 后实际位数变少）"
      ],
      "outOfScope": [
        "❌ 实际计算（属于 decimal_mul_vertical）"
      ],
      "keyFormulas": [
        "积的小数位数 = 因数 1 小数位数 + 因数 2 小数位数",
        "末尾 0 去掉后实际可能少 1-2 位",
        "整数 × 小数 → 小数位数 = 小数那个因数的位数"
      ],
      "typicalContexts": [
        "填空题判断",
        "选择题判断",
        "心算检查答案合理性"
      ],
      "commonMistakes": [
        "不会数小数位数",
        "把末尾 0 当作有效位（1.25 × 4 = 5.00 当作两位小数）",
        "整数 × 小数时把整数也算上小数位数"
      ],
      "exampleStems": [
        "1.25 × 0.04 的积是几位小数？",
        "0.5 × 0.2 的积有几位小数？等于多少？"
      ]
    },
    "decimal_mul_mix": {
      "name": "小数乘加、乘减混合运算",
      "term": "下册",
      "unitId": "G4B_U3_DECIMAL_MULTIPLY",
      "definition": "含小数和加减乘的混合运算，按四则运算顺序：先乘后加减，括号优先。",
      "inScope": [
        "两步：a × b + c 形式",
        "三步：a × b + c × d 形式",
        "含括号：(a + b) × c"
      ],
      "outOfScope": [
        "❌ 含除法（不属于本 skill）",
        "❌ 简便运算（属于 decimal_mul_simplify）"
      ],
      "keyFormulas": [
        "先乘除、后加减",
        "有括号先算括号",
        "同级运算从左到右"
      ],
      "typicalContexts": [
        "复杂购物（多种商品）",
        "工程量合计",
        "面积/体积初步"
      ],
      "commonMistakes": [
        "从左到右顺次算（忘先乘）",
        "进位错（小数加法对齐错）",
        "末尾去 0 忘记"
      ],
      "exampleStems": [
        "计算：1.25 × 4 + 2.8",
        "1.5 × 6 + 2 × 3.5 = ?"
      ]
    },
    "decimal_mul_simplify": {
      "name": "小数乘法简便运算",
      "term": "下册",
      "unitId": "G4B_U3_DECIMAL_MULTIPLY",
      "definition": "用乘法运算律（交换 / 结合 / 分配）简化小数乘法。",
      "inScope": [
        "凑整：0.25 × 4、0.125 × 8、0.5 × 2",
        "分配律：a × (b + c) = a × b + a × c",
        "(a + b) × c → a × c + b × c"
      ],
      "outOfScope": [
        "❌ 一定不能用简便的硬算"
      ],
      "keyFormulas": [
        "a × b = b × a（交换律）",
        "(a × b) × c = a × (b × c)（结合律）",
        "(a + b) × c = a × c + b × c（分配律）",
        "凑整组合：0.25 × 4 = 1、0.125 × 8 = 1、0.5 × 2 = 1"
      ],
      "typicalContexts": [
        "三个小数相乘凑整",
        "应用题分别乘后合并",
        "速算题"
      ],
      "commonMistakes": [
        "分配律分配错对象（c 漏分配给 b）",
        "乘法当加法（拆 0.25 × 4 = 0.25 × 2 + 0.25 × 2，过程对但失去简便意义）",
        "凑整不彻底（0.25 × 8 没拆成 0.25 × 4 × 2）"
      ],
      "exampleStems": [
        "用简便方法算 0.25 × 36",
        "1.25 × 8.8 = ?（提示：8.8 = 8 + 0.8）"
      ]
    },
    "decimal_price_quantity": {
      "name": "总价=单价×数量，购物问题",
      "term": "下册",
      "unitId": "G4B_U3_DECIMAL_MULTIPLY",
      "definition": "购物模型：总价 = 单价 × 数量。给两个量求第三个。",
      "inScope": [
        "已知单价、数量求总价",
        "已知总价、单价求数量（除法，4 年级用倒推）",
        "已知总价、数量求单价",
        "找零问题（购物 + 减法）"
      ],
      "outOfScope": [
        "❌ 折扣 / 利润（5 年级）"
      ],
      "keyFormulas": [
        "总价 = 单价 × 数量",
        "找零 = 付款 - 总价",
        "应付 = ∑ 各商品总价"
      ],
      "typicalContexts": [
        "小学超市买文具",
        "水果店买水果",
        "学校买球类用品"
      ],
      "commonMistakes": [
        "单价数量颠倒",
        "几种商品忘相加",
        "找零方向错（拿付款 - 找零 当作总价）"
      ],
      "exampleStems": [
        "一支铅笔 1.25 元，买 4 支多少钱？",
        "买 6 个橡皮 4.8 元，每个橡皮多少钱？"
      ]
    },
    "decimal_speed_distance": {
      "name": "路程=速度×时间（小数场景）",
      "term": "下册",
      "unitId": "G4B_U3_DECIMAL_MULTIPLY",
      "definition": "速度模型：路程 = 速度 × 时间。给两个量求第三个。",
      "inScope": [
        "已知速度、时间求路程（顺向，常用乘法）",
        "已知路程、速度求时间（逆向，4 年级用试算）",
        "已知路程、时间求速度",
        "速度可含小数（如 4.5 千米/时）"
      ],
      "outOfScope": [
        "❌ 相遇问题（属于 equation_meeting_problem）",
        "❌ 追及问题（5 年级）",
        "❌ 流水问题（6 年级）"
      ],
      "keyFormulas": [
        "路程 = 速度 × 时间",
        "时间 = 路程 ÷ 速度",
        "速度 = 路程 ÷ 时间",
        "单位要一致（千米/时 配 时；米/分 配 分）"
      ],
      "typicalContexts": [
        "汽车从 A 城到 B 城",
        "步行 / 跑步训练距离",
        "自行车骑行"
      ],
      "commonMistakes": [
        "时间单位混（小时 vs 分钟）",
        "速度位置颠倒（误把时间当速度）"
      ],
      "exampleStems": [
        "汽车每小时行 65 千米，3.5 小时行多少千米？",
        "走 4.5 千米用 1.5 小时，速度多少？"
      ]
    },
    "decimal_work_total": {
      "name": "工程量/产量合计",
      "term": "下册",
      "unitId": "G4B_U3_DECIMAL_MULTIPLY",
      "definition": "总量 = 单位时间产量 × 时间 / 单位面积产量 × 面积 / 一份的量 × 份数。",
      "inScope": [
        "亩产 × 亩数 = 总产量",
        "单位时间工作量 × 时间 = 总工作量",
        "每包 × 包数 = 总量"
      ],
      "outOfScope": [
        "❌ 工程问题用分数表示效率（6 年级）"
      ],
      "keyFormulas": [
        "总量 = 单产量 × 数量",
        "类似 price_quantity 的结构但语境不同"
      ],
      "typicalContexts": [
        "农田亩产",
        "工厂日产量",
        "运输每天行驶量"
      ],
      "commonMistakes": [
        "把单产量数量混淆",
        "忘乘单位（吨 vs 千克）"
      ],
      "exampleStems": [
        "一块菜地每亩产白菜 2.5 吨，6.5 亩共产多少吨？",
        "一台机器每分钟生产 3.5 个零件，工作 12 分钟生产多少个？"
      ]
    },
    "decimal_segment_pricing": {
      "name": "基础分段计价",
      "term": "下册",
      "unitId": "G4B_U3_DECIMAL_MULTIPLY",
      "definition": "分段定价：前 X 单位按 a 价，超过部分按 b 价（如出租车前 3 公里 7 元，之后每公里 2.5 元）。",
      "inScope": [
        "前 X 单位定价 + 超出部分按另一价",
        "总价 = 前段价 + 超出量 × 单价",
        "出租车 / 阶梯水电费 / 超市优惠等情境"
      ],
      "outOfScope": [
        "❌ 三段及以上的复杂阶梯（5 年级以上）",
        "❌ 超市买几送几（无折扣公式）"
      ],
      "keyFormulas": [
        "总价 = 前段价 + 超出量 × 后段单价",
        "超出量 = 实际量 - 前段量（≥ 0）"
      ],
      "typicalContexts": [
        "出租车计费",
        "阶梯水/电费",
        "包邮门槛"
      ],
      "commonMistakes": [
        "未减前段直接全乘",
        "超出量算成负（实际不超出时仍减）",
        "忘加前段固定价"
      ],
      "exampleStems": [
        "出租车前 3 公里 7 元，超过部分每公里 2.5 元。8 公里多少钱？"
      ]
    },
    "observe_front_top_left": {
      "name": "正面、上面、左面观察",
      "term": "下册",
      "unitId": "G4B_U4_OBSERVE_OBJECTS",
      "definition": "用 4-6 个小立方体搭成的物体，识别从正面 / 上面 / 左面看到的形状。",
      "inScope": [
        "看图选三视图",
        "已知三视图反推立体",
        "数小方块面数（不超过 6 块）"
      ],
      "outOfScope": [
        "❌ 体积计算",
        "❌ 表面积公式（5 年级）",
        "❌ 旋转体（高中）"
      ],
      "keyFormulas": [
        "三视图：从某方向看，相邻方块投影合并",
        "顶视看俯视图，前视看正视图，左视看左视图"
      ],
      "typicalContexts": [
        "小立方体堆叠",
        "三视图配对",
        "搭一搭与画一画"
      ],
      "commonMistakes": [
        "前面/上面方向混",
        "看不出隐藏方块",
        "投影画错位置"
      ],
      "exampleStems": [
        "从正面看，下面哪个是这个立体的形状？",
        "从上面看是 2×2 的方形，最少需要几个小方块？"
      ]
    },
    "letter_expression": {
      "name": "用字母表示数",
      "term": "下册",
      "unitId": "G4B_U5_EQUATIONS",
      "definition": "用字母代替具体数量，表达数量关系（如用 x 表示苹果数）。",
      "inScope": [
        "用 x、a、n 等表示未知量",
        "把语言关系翻成代数式",
        "代入字母值求结果"
      ],
      "outOfScope": [
        "❌ 不等式",
        "❌ 多元方程（5 年级以上）"
      ],
      "keyFormulas": [
        "a + 5 表示比 a 多 5",
        "3a 表示 a 的 3 倍",
        "a / 2 表示 a 的一半"
      ],
      "typicalContexts": [
        "年龄问题（爸爸比小红大 30 岁）",
        "购物（每支铅笔 2 元，买 a 支共多少元）"
      ],
      "commonMistakes": [
        "乘号忘省略（写成 a × 3 而非 3a）",
        "代数式中变量位置错"
      ],
      "exampleStems": [
        "小红今年 a 岁，妈妈比她大 30 岁，妈妈今年多少岁？",
        "每支铅笔 1.5 元，买 a 支共多少钱？"
      ]
    },
    "equation_meaning_balance": {
      "name": "方程意义，等量关系",
      "term": "下册",
      "unitId": "G4B_U5_EQUATIONS",
      "definition": "方程是含有未知数（字母）的等式。识别什么是方程，找等量关系。",
      "inScope": [
        "判断式子是否方程（含未知数 + 是等式）",
        "找题目中的等量关系（如总和 = 部分 + 部分）",
        "用天平模型理解等量"
      ],
      "outOfScope": [
        "❌ 不等式",
        "❌ 二元一次方程（5 年级以上）"
      ],
      "keyFormulas": [
        "方程 = 含未知数的等式",
        "天平左右平衡 = 等量"
      ],
      "typicalContexts": [
        "天平秤砝码",
        "买东西付钱",
        "比较两种数量"
      ],
      "commonMistakes": [
        "把方程当作不等式",
        "把没有未知数的等式当方程",
        "等量关系列错（应是相等的两个量）"
      ],
      "exampleStems": [
        "下列哪个是方程？x + 5 = 12 / 5 + 2 = 7 / 3 + x",
        "天平左盘 200g + x，右盘 500g，等式怎么列？"
      ]
    },
    "equation_solve_simple": {
      "name": "用等式性质解简单方程",
      "term": "下册",
      "unitId": "G4B_U5_EQUATIONS",
      "definition": "用「等式两边同时加减乘除同一个数等式不变」的性质解一步方程。",
      "inScope": [
        "x + a = b 类型",
        "x - a = b 类型",
        "ax = b 类型（a 整数）",
        "x / a = b 类型",
        "解后验算"
      ],
      "outOfScope": [
        "❌ 二步方程（属于 two_step_word）",
        "❌ 移项法（5 年级以上）"
      ],
      "keyFormulas": [
        "等式两边同时 + 或 - 同一数：x + 3 = 7 → x + 3 - 3 = 7 - 3 → x = 4",
        "等式两边同时 × 或 ÷ 同一数（不为 0）",
        "解后代入验算"
      ],
      "typicalContexts": [
        "直接给方程",
        "应用题列方程后解"
      ],
      "commonMistakes": [
        "两边操作不一致（左 - 3 右 + 3）",
        "符号错（- 当 +）",
        "忘验算"
      ],
      "exampleStems": [
        "解方程：x + 2.5 = 7.8",
        "解方程：3x = 12.6"
      ]
    },
    "equation_one_step_word": {
      "name": "列方程解决一步应用题",
      "term": "下册",
      "unitId": "G4B_U5_EQUATIONS",
      "definition": "应用题中找等量关系，设未知数 x，列方程解。一步运算可解。",
      "inScope": [
        "和差关系（一加一减）",
        "倍数关系（× 整数）",
        "购物总价模型",
        "比较关系（大小相差/超过）"
      ],
      "outOfScope": [
        "❌ 多步方程（属于 two_step_word）",
        "❌ 相遇 / 和倍差倍（独立 skill）"
      ],
      "keyFormulas": [
        "解题步骤：① 设 x ② 找等量关系 ③ 列方程 ④ 解 ⑤ 验答",
        "设未知数：通常设问题中的未知量为 x"
      ],
      "typicalContexts": [
        "年龄差",
        "购物找零",
        "比较谁多谁少"
      ],
      "commonMistakes": [
        "设错对象",
        "等量关系列反",
        "忘检验"
      ],
      "exampleStems": [
        "妈妈比小红大 30 岁，妈妈今年 36 岁，小红今年多大？",
        "买 5 支铅笔花 7.5 元，每支多少钱？"
      ]
    },
    "equation_two_step_word": {
      "name": "列方程解决两步应用题",
      "term": "下册",
      "unitId": "G4B_U5_EQUATIONS",
      "definition": "需要两步运算的方程应用题：a × x + b = c 或类似结构。",
      "inScope": [
        "ax + b = c 类型",
        "ax - b = c 类型",
        "(a + x) × n = 总数 类型",
        "购物 + 找零的混合"
      ],
      "outOfScope": [
        "❌ 含分数 / 百分数",
        "❌ 二元方程"
      ],
      "keyFormulas": [
        "ax + b = c → ax = c - b → x = (c - b) / a",
        "解题步骤同 one_step，但方程含两步操作"
      ],
      "typicalContexts": [
        "买几样商品 + 还剩多少钱",
        "甲是乙的 n 倍多 m"
      ],
      "commonMistakes": [
        "两步顺序错",
        "忘加减常数项",
        "倍数项位置错"
      ],
      "exampleStems": [
        "小红买了 6 本练习本和 1 个文具盒花了 35 元，文具盒 11 元，每本练习本多少钱？",
        "甲数是乙数的 3 倍多 2，甲数是 17，乙数是多少？"
      ]
    },
    "equation_meeting_problem": {
      "name": "相遇问题",
      "term": "下册",
      "unitId": "G4B_U5_EQUATIONS",
      "definition": "两个物体（人/车/船）从两地同时出发，相向而行，求相遇时间或某一方速度。属于方程意义单元的核心应用。",
      "inScope": [
        "两人/两车从 A、B 两地同时出发，相向而行，求相遇时间",
        "已知相遇时间和总路程及一方速度，求另一方速度",
        "速度都是整数或常见简单小数（如 4.5 千米/时）",
        "时间用整小时或半小时"
      ],
      "outOfScope": [
        "❌ 追及问题（同向追及，5 年级）",
        "❌ 列车过桥/隧道问题（5 年级）",
        "❌ 流水问题（6 年级）",
        "❌ 钟表盘相遇 / 折返跑（奥数）"
      ],
      "keyFormulas": [
        "（甲速度 + 乙速度）× 相遇时间 = 总路程",
        "总路程 ÷ 速度和 = 相遇时间",
        "另一方速度 = 总路程 ÷ 相遇时间 - 已知速度",
        "列方程时通常设相遇时间或某一方速度为 x"
      ],
      "typicalContexts": [
        "小明和小红从两地同时出发相向而行",
        "甲车从 A 城、乙车从 B 城同时开出",
        "两只小船从两港相向而行（不是流水问题）",
        "两只小动物在直线上相向爬行"
      ],
      "commonMistakes": [
        "把「速度和」用乘法（× 而非 +）",
        "把相向当成同向追及",
        "时间单位混（小时 vs 分钟）",
        "把分别走的路程相加 ≠ 总路程（实际是 ≤ 总路程，相遇时才相等）",
        "设未知数时找不准"
      ],
      "exampleStems": [
        "小明和小红从相距 600 米的两地同时出发相向而行。小明每分钟走 60 米，小红每分钟走 50 米，几分钟后相遇？",
        "甲、乙两车同时从相距 240 千米的 A、B 两城相向开出，3 小时后相遇。已知甲车速度是 45 千米/时，乙车速度是多少？"
      ]
    },
    "equation_sum_difference": {
      "name": "和倍/差倍问题",
      "term": "下册",
      "unitId": "G4B_U5_EQUATIONS",
      "definition": "已知两数之和 / 之差及倍数关系，求两数。用方程解。",
      "inScope": [
        "和倍：两数和 + 倍数关系（小数 = x，大数 = nx，x + nx = 和）",
        "差倍：两数差 + 倍数关系（nx - x = 差）",
        "倍数 ≥ 2 的整数倍",
        "用线段图辅助"
      ],
      "outOfScope": [
        "❌ 分数倍数（5 年级以上）",
        "❌ 倍数和差混合（奥数）"
      ],
      "keyFormulas": [
        "和倍：x + nx = 和 → (n+1)x = 和 → x = 和 / (n+1)",
        "差倍：nx - x = 差 → (n-1)x = 差 → x = 差 / (n-1)"
      ],
      "typicalContexts": [
        "甲乙两堆苹果",
        "兄弟年龄",
        "两个班学生数"
      ],
      "commonMistakes": [
        "大小颠倒（把大数当 x）",
        "倍数 +1 忘了",
        "差倍当和倍混淆"
      ],
      "exampleStems": [
        "甲数是乙数的 3 倍，两数和是 28，乙数是多少？",
        "妈妈比小红大 30 岁，妈妈年龄是小红的 4 倍，小红几岁？"
      ]
    },
    "data_bar_chart": {
      "name": "条形统计图读图",
      "term": "下册",
      "unitId": "G4B_U6_DATA",
      "definition": "看条形统计图（单式 / 复式）回答问题，包括读数 / 比较 / 求和 / 求差。",
      "inScope": [
        "单式条形图读数",
        "复式条形图（两组数据）",
        "回答 5W 问题（最多/最少/相差/合计）",
        "纵轴单位换算"
      ],
      "outOfScope": [
        "❌ 折线图（5 年级）",
        "❌ 扇形图（6 年级）",
        "❌ 频率分布图"
      ],
      "keyFormulas": [
        "条形高度 = 数量",
        "比较高低看条形长短"
      ],
      "typicalContexts": [
        "班级人数统计",
        "身高/体重测量",
        "考试分数分布"
      ],
      "commonMistakes": [
        "看错纵轴刻度",
        "复式图混淆两组",
        "忘加单位"
      ],
      "exampleStems": [
        "从图中看，最多的是哪种？比最少的多多少？"
      ]
    },
    "average_meaning": {
      "name": "平均数意义",
      "term": "下册",
      "unitId": "G4B_U6_DATA",
      "definition": "理解平均数表示一组数据的总体水平，受极端值影响。",
      "inScope": [
        "平均数的概念（「匀着分给每人」）",
        "平均数与中位数 / 众数的区别（不深入）",
        "极端值对平均数的影响"
      ],
      "outOfScope": [
        "❌ 加权平均",
        "❌ 中位数 / 众数计算（5 年级）"
      ],
      "keyFormulas": [
        "平均数 = 总和 / 个数"
      ],
      "typicalContexts": [
        "班级身高",
        "几次考试平均分",
        "几天的气温"
      ],
      "commonMistakes": [
        "把平均数当中位数",
        "极端值的影响理解错"
      ],
      "exampleStems": [
        "3 个同学身高分别 130、140、150 cm，平均身高多少？",
        "如果加一个 200 cm 的，平均会变高还是变低？"
      ]
    },
    "average_compute": {
      "name": "求平均数",
      "term": "下册",
      "unitId": "G4B_U6_DATA",
      "definition": "已知一组数据求平均数：总和 ÷ 个数。",
      "inScope": [
        "整数 / 小数数据求平均",
        "应用题中求平均（成绩 / 身高 / 重量）",
        "结合条形图数据"
      ],
      "outOfScope": [
        "❌ 加权平均（5 年级）"
      ],
      "keyFormulas": [
        "平均数 = 总和 / 个数"
      ],
      "typicalContexts": [
        "几次考试平均分",
        "几天降雨量",
        "球队投篮命中率"
      ],
      "commonMistakes": [
        "除错个数（少数 1 个）",
        "忘除直接看总和"
      ],
      "exampleStems": [
        "小红 5 次考试分数：85、92、88、95、90，平均分多少？"
      ]
    },
    "average_inverse_total": {
      "name": "已知平均数求总数/份数",
      "term": "下册",
      "unitId": "G4B_U6_DATA",
      "definition": "已知平均数和数据个数，求总和；或已知平均数和总和，求个数。",
      "inScope": [
        "总数 = 平均数 × 个数",
        "个数 = 总数 / 平均数"
      ],
      "outOfScope": [
        "❌ 部分缺失数据（属于 average_inverse_missing）"
      ],
      "keyFormulas": [
        "总数 = 平均数 × 个数"
      ],
      "typicalContexts": [
        "班级总分 / 平均分换算",
        "几天总产量 / 日均产量"
      ],
      "commonMistakes": [
        "把总数当平均数",
        "倒推方向错"
      ],
      "exampleStems": [
        "6 名同学平均分 85，总分多少？",
        "总产量 240 千克，日均 8 千克，几天？"
      ]
    },
    "average_inverse_missing": {
      "name": "已知平均数求其中一个数据",
      "term": "下册",
      "unitId": "G4B_U6_DATA",
      "definition": "已知一组数据中除一个外的所有数据 + 平均数，求那一个数据。",
      "inScope": [
        "已知 n - 1 个数据 + 平均数，求第 n 个",
        "按「总数 = 平均 × n」反求，再减已知部分"
      ],
      "outOfScope": [
        "❌ 缺失多个数据（解不出）"
      ],
      "keyFormulas": [
        "总和 = 平均数 × 个数",
        "缺失数据 = 总和 - 已知数据之和"
      ],
      "typicalContexts": [
        "几次考试已知 4 次平均算第 5 次需多少",
        "球员需要多少分能保平均"
      ],
      "commonMistakes": [
        "忘减已知部分",
        "总和算错"
      ],
      "exampleStems": [
        "前 4 次考试平均 88 分，第 5 次需考多少才能 5 次平均 90 分？"
      ]
    },
    "_chinese_block_below": "==================== 语文 C4B 12 个 skill ====================",
    "C4B_U1_PINYIN": {
      "name": "字音字形（第一单元）",
      "term": "下册",
      "unitId": "C4B_U1_NATURE",
      "definition": "人教版语文四年级下册第一单元（古诗 + 乡村田园主题：宿新市徐公店、四时田园杂兴、清平乐·村居、乡下人家、天窗、三月桃花水）的字音、字形辨析。考查易混拼音、形近字、多音字。",
      "inScope": [
        "本单元课文里出现的字的拼音（注意 zh/z、ch/c、sh/s 平翘舌；ang/an、eng/en 前后鼻音）",
        "形近字辨析（如 「篱 / 离」、「疏 / 蔬」、「嘁 / 戚」）",
        "多音字（「宿」sù/xiù、「兴」xìng/xīng、「了」le/liǎo）",
        "字形书写（部首、笔画顺序）"
      ],
      "outOfScope": [
        "❌ 不出本单元课文以外的字（如第二单元的「绽、漂、徒」）",
        "❌ 不考字义本身（那是 vocab）",
        "❌ 不考词语搭配（那是 vocab）",
        "❌ 不考文言虚词"
      ],
      "keyFormulas": [
        "拼音规则：j/q/x/y 后 ü 要去两点写成 u",
        "声调标在 a > o/e > i/u/ü，i/u 并列标后",
        "形近字看部首记意义"
      ],
      "typicalContexts": [
        "读拼音写词语",
        "选正确拼音",
        "形近字组词",
        "多音字判断读音"
      ],
      "commonMistakes": [
        "ang/an 混（如「桑」sāng 误写 sān）",
        "形近字混（如「蔬」误写「疏」）",
        "多音字误判（如「了」单一读音）",
        "省略号声调"
      ],
      "exampleStems": [
        "选出加点字读音正确的一组：A. 篱（lí） B. 蔬（sū） C. ...",
        "读拼音写词语：sù xīn shì xú gōng diàn → ___",
        "「兴」在「兴致」中读什么？"
      ]
    },
    "C4B_U1_POEM_RECITE": {
      "name": "古诗补字（宿新市 / 四时 / 清平乐）",
      "term": "下册",
      "unitId": "C4B_U1_NATURE",
      "definition": "人教版语文四年级下册第一单元三首古诗（杨万里《宿新市徐公店》、范成大《四时田园杂兴·其二十五》、辛弃疾《清平乐·村居》）的背诵默写。",
      "inScope": [
        "三首古诗每一句的填空（给上句补下句、给下句补上句、空一两个字）",
        "整首默写",
        "诗题、作者、朝代",
        "重点字字形（如「篱、蜻、蜓、蛱、媚、锄、莲」）"
      ],
      "outOfScope": [
        "❌ 不考第一单元以外的古诗",
        "❌ 不考诗的现代译文（那是阅读）",
        "❌ 不考诗人生平细节",
        "❌ 不要求孩子写出诗的修辞分析"
      ],
      "keyFormulas": [
        "宿新市徐公店：篱落疏疏一径深，树头新绿未成阴。儿童急走追黄蝶，飞入菜花无处寻。",
        "四时田园杂兴：梅子金黄杏子肥，麦花雪白菜花稀。日长篱落无人过，惟有蜻蜓蛱蝶飞。",
        "清平乐·村居：茅檐低小，溪上青青草。醉里吴音相媚好，白发谁家翁媪？大儿锄豆溪东，中儿正织鸡笼。最喜小儿亡赖，溪头卧剥莲蓬。"
      ],
      "typicalContexts": [
        "古诗补字（一空一字）",
        "选正确诗句",
        "诗题作者匹配"
      ],
      "commonMistakes": [
        "字形错（蛱写成「夹」）",
        "句序混（「儿童急走追黄蝶」前后句颠倒）",
        "「亡赖」误写「无赖」（古诗用字）"
      ],
      "exampleStems": [
        "「篱落疏疏一径深，___」补全",
        "《清平乐·村居》的作者是？",
        "「最喜小儿亡赖」中「亡」读什么？"
      ]
    },
    "C4B_U1_VOCAB": {
      "name": "词语搭配（乡下人家 / 天窗）",
      "term": "下册",
      "unitId": "C4B_U1_NATURE",
      "definition": "本单元两篇精读课文（《乡下人家》《天窗》）里的重点词语搭配 + 近反义词 + 量词。",
      "inScope": [
        "词语搭配（什么 + 什么）：如「（鲜嫩）的笋、（瓜架）上的（绿叶）」",
        "近义词反义词（朴素 ↔ 华丽、和谐 ↔ 嘈杂）",
        "量词搭配（一（间）小屋 / 一（道）小巷）",
        "ABAC / AABB / AABC 形式词语"
      ],
      "outOfScope": [
        "❌ 不考字义释义",
        "❌ 不考课文段落理解",
        "❌ 不出 5 年级才学的成语"
      ],
      "keyFormulas": [
        "搭配看习惯：（鲜艳）的（花）、（朴素）的（衣裳）",
        "AABB 词：高高兴兴、平平安安",
        "ABAC 词：（自言自语）、（无声无息）"
      ],
      "typicalContexts": [
        "选词填空",
        "近反义词配对",
        "量词选择",
        "AABB 形式补全"
      ],
      "commonMistakes": [
        "搭配生硬（「鲜嫩」配错对象）",
        "把「朴素」反义词误当「华丽」以外的词"
      ],
      "exampleStems": [
        "在（  ）里填合适的量词：一（  ）小屋",
        "「朴素」的反义词是？",
        "选词填空：（鲜艳 / 鲜嫩）的笋"
      ]
    },
    "C4B_U1_DICTATION": {
      "name": "听写（第一单元词语）",
      "term": "下册",
      "unitId": "C4B_U1_NATURE",
      "definition": "本单元课后『词语表』里的词语听写。前端 TTS 朗读后孩子写或选。",
      "inScope": [
        "课后『词语表』里全部词语",
        "易错字优先（蜻蜓、篱笆、蛱蝶、蔬菜、媚好、莲蓬）",
        "可单字听写也可词组听写"
      ],
      "outOfScope": [
        "❌ 不考其他单元的词语",
        "❌ 不考课文以外的成语",
        "❌ 不要求短语扩词"
      ],
      "keyFormulas": [
        "蜻蜓（qīngtíng）— 都是虫字旁",
        "篱笆（líba）— 竹字头",
        "蛱蝶（jiádié）— 注意「蛱」"
      ],
      "typicalContexts": [
        "TTS 播报词语 → 选正确写法（4 选 1）",
        "TTS → 写词语"
      ],
      "commonMistakes": [
        "蜻蜓写成「青蜓」",
        "篱笆写成「离笆」",
        "蛱蝶写成「夹蝶」"
      ],
      "exampleStems": [
        "听一听，选出正确的字：（蜻蜓 / 青蜓 / 蜻挺 / 清蜓）"
      ]
    },
    "C4B_U2_PINYIN": {
      "name": "字音字形（第二单元）",
      "term": "下册",
      "unitId": "C4B_U2_SCIENCE",
      "definition": "本单元（自然科技主题：琥珀、飞向蓝天的恐龙、纳米技术就在我们身边、千年梦圆在今朝）字音字形。",
      "inScope": [
        "课文里出现的字（如「琥、珀、伶、俐、孵」）的拼音",
        "形近字（「珀 / 拍」、「俐 / 利」）",
        "多音字（「拈」niān/diān、「卷」juǎn/juàn）"
      ],
      "outOfScope": [
        "❌ 不出第一/三/四单元的字",
        "❌ 不考字义"
      ],
      "keyFormulas": [
        "看部首记字形",
        "声调规则同 U1"
      ],
      "typicalContexts": [
        "读拼音写词语",
        "选正确拼音",
        "形近字组词"
      ],
      "commonMistakes": [
        "「琥珀」写成「虎拍」",
        "前后鼻音混淆"
      ],
      "exampleStems": [
        "选出加点字读音正确的：A. 琥（hú） B. 珀（pò） ...",
        "读拼音写词语：hǔ pò → ___"
      ]
    },
    "C4B_U2_VOCAB": {
      "name": "科技词语 / 形近字辨析",
      "term": "下册",
      "unitId": "C4B_U2_SCIENCE",
      "definition": "本单元科技 / 自然类词语（如「轻盈、欣喜若狂、形态各异」）+ 易混形近字辨析。",
      "inScope": [
        "课文重点词语理解 + 搭配",
        "形近字组词区分（「孵 / 浮」、「拈 / 沾」）",
        "成语：欣喜若狂、形态各异",
        "近义词反义词"
      ],
      "outOfScope": [
        "❌ 不考奥赛级成语",
        "❌ 不考英文翻译"
      ],
      "keyFormulas": [
        "形近字看意：「孵」-卵字旁→孵蛋；「浮」-水字旁→浮起"
      ],
      "typicalContexts": [
        "选词填空",
        "形近字组词",
        "近反义词配对"
      ],
      "commonMistakes": [
        "把「欣喜若狂」写成「欣其若狂」",
        "「形态各异」写成「形态格异」"
      ],
      "exampleStems": [
        "选词填空：（  ）若狂",
        "「孵」和「浮」分别组什么词？"
      ]
    },
    "C4B_U2_DICTATION": {
      "name": "听写（第二单元词语）",
      "term": "下册",
      "unitId": "C4B_U2_SCIENCE",
      "definition": "本单元课后词语表听写。",
      "inScope": [
        "课后词语表全部词语",
        "易错字（琥珀、孵化、欣喜若狂）"
      ],
      "outOfScope": [
        "❌ 不考其他单元词语",
        "❌ 不考成语接龙"
      ],
      "keyFormulas": [],
      "typicalContexts": [
        "TTS 播报 → 4 选 1 写法"
      ],
      "commonMistakes": [
        "琥珀错字",
        "成语错字"
      ],
      "exampleStems": [
        "听一听，选出正确的字：（琥珀 / 虎珀 / 琥拍 / 虎拍）"
      ]
    },
    "C4B_U3_PINYIN": {
      "name": "字音字形（第三单元）",
      "term": "下册",
      "unitId": "C4B_U3_POETRY",
      "definition": "本单元（现代诗主题：短诗三首 / 绿 / 白桦 / 在天晴了的时候）的字音字形。",
      "inScope": [
        "现代诗里的字（「藤萝、漪、骤、舔、寂」）的拼音",
        "形近字（「萝 / 罗」、「漪 / 椅」）",
        "诗歌里的雅字（「茵、漪、缭、绕」）"
      ],
      "outOfScope": [
        "❌ 不出其他单元字",
        "❌ 不考诗意理解"
      ],
      "keyFormulas": [
        "雅字记部首",
        "前后鼻音区分"
      ],
      "typicalContexts": [
        "选拼音",
        "读拼音写词语",
        "形近字组词"
      ],
      "commonMistakes": [
        "「漪」误读为「yī」（实读 yī 但易和「椅」混）",
        "「茵」误写「因」"
      ],
      "exampleStems": [
        "「漣漪」的「漪」拼音是？",
        "读拼音写词语：téng luó → ___"
      ]
    },
    "C4B_U3_RHETORIC": {
      "name": "修辞辨认（比喻 / 拟人 / 排比）",
      "term": "下册",
      "unitId": "C4B_U3_POETRY",
      "definition": "本单元现代诗里出现的修辞手法判断：比喻、拟人、排比、反复。给一句诗，判断用了什么修辞 / 仿写一句。",
      "inScope": [
        "比喻：明喻（A 像 B）/ 暗喻（A 是 B）/ 借喻",
        "拟人：把物当人写（动作、感情）",
        "排比：≥3 个结构相似的句子",
        "反复：词语 / 句子重复出现",
        "辨认 + 简单仿写"
      ],
      "outOfScope": [
        "❌ 不考夸张、对偶、设问、反问（5 年级以上）",
        "❌ 不考赏析（需要长篇分析的）",
        "❌ 不考通感（高中）"
      ],
      "keyFormulas": [
        "比喻 = A 像 / 是 / 仿佛 B（A 和 B 是不同事物但有相似点）",
        "拟人 = 物 + 人的动作 / 情感（如「太阳公公笑了」）",
        "排比 = 3+ 个结构相似的短句",
        "反复 = 同词同句多次重复"
      ],
      "typicalContexts": [
        "看一句诗判修辞",
        "4 选 1 选用了什么修辞",
        "仿写一句"
      ],
      "commonMistakes": [
        "比喻和拟人混（「弯弯的月亮像小船」是比喻；「月亮在天上散步」是拟人）",
        "排比要 ≥3 句（2 句不算）",
        "把对偶当排比"
      ],
      "exampleStems": [
        "「弯弯的月亮像一只小船」用了什么修辞？",
        "下面句子用了拟人的是哪一句？",
        "用比喻仿写一句：太阳像（  ）"
      ]
    },
    "C4B_U4_PINYIN": {
      "name": "字音字形（第四单元）",
      "term": "下册",
      "unitId": "C4B_U4_ANIMALS",
      "definition": "本单元（动物名家主题：猫 / 母鸡 / 白鹅 / 海上日出）的字音字形。",
      "inScope": [
        "本单元课文里的字（「凝、屏、贪、勃、勃、逞」）拼音",
        "形近字（「凝 / 疑」、「屏 / 拼」）",
        "多音字（「屏」bǐng/píng、「中」zhōng/zhòng、「奔」bēn/bèn）"
      ],
      "outOfScope": [
        "❌ 不出其他单元字"
      ],
      "keyFormulas": [
        "形近字看部首意义",
        "多音字看语境"
      ],
      "typicalContexts": [
        "选拼音",
        "形近字组词",
        "多音字判读音"
      ],
      "commonMistakes": [
        "「凝视」错读「nǐ」",
        "屏 píng / bǐng 用错语境"
      ],
      "exampleStems": [
        "「屏住呼吸」的「屏」读什么？",
        "选词填空：（凝视 / 疑视）远方"
      ]
    },
    "C4B_U4_VOCAB": {
      "name": "动物描写词语 / 形近字",
      "term": "下册",
      "unitId": "C4B_U4_ANIMALS",
      "definition": "本单元描写动物的词语 + 课文常用形近字辨析。",
      "inScope": [
        "动物动作词（蹲、伏、跃、爬）",
        "动物声音词（喵、咕、嘎）",
        "形容动物的形容词（憨态可掬、机警、贪玩）",
        "形近字组词"
      ],
      "outOfScope": [
        "❌ 不考动物科普知识",
        "❌ 不考英文动物名"
      ],
      "keyFormulas": [],
      "typicalContexts": [
        "选词填空",
        "动物动作词配对",
        "形近字组词"
      ],
      "commonMistakes": [
        "把「憨态可掬」写成「憨态可拘」",
        "把「跃」误用「越」"
      ],
      "exampleStems": [
        "选词填空：小猫（蹲 / 顿）在窗台上",
        "「憨态可掬」中「掬」字怎么写？"
      ]
    },
    "C4B_U4_DICTATION": {
      "name": "听写（第四单元词语）",
      "term": "下册",
      "unitId": "C4B_U4_ANIMALS",
      "definition": "本单元课后词语表听写。",
      "inScope": [
        "课后词语表词语",
        "易错字（凝视、屏息、憨态可掬）"
      ],
      "outOfScope": [
        "❌ 不考其他单元",
        "❌ 不考课外动物名"
      ],
      "keyFormulas": [],
      "typicalContexts": [
        "TTS 播报 → 4 选 1"
      ],
      "commonMistakes": [
        "憨态可掬错字",
        "凝视错字"
      ],
      "exampleStems": [
        "听一听，选出正确的字：（凝视 / 疑视 / 拟视 / 凝示）"
      ]
    }
  },
  "qualityRubric": "# Selena 题库质量规范（rock-solid）\n\n> 这份规范是出题（generation）和质检（judging）**共用的**唯一真相。\n> 出题模型按它生成；质检模型按它判定。任何冲突以本文档为准。\n\n---\n\n## 1. 教材范围（不许超纲，不许跑题）\n\n### 数学（北师大版四年级）\n\n- **下册** 涵盖：小数的意义和加减、认识方程、观察物体、三角形、小数乘法、平均数、复式条形图。（unit_id 以 `G4B_` 开头，但 term 字段值是 `\"下册\"`）\n- **上册** 涵盖：大数认识、线与角、三位数乘两位数、运算律、方向与位置、除法、生活中的负数、可能性。（unit_id 以 `G4A_` 开头，但 term 字段值是 `\"上册\"`）\n- ⛔ **不许超纲**：比例、百分数、函数、图形旋转坐标、立体体积公式（5 年级及以上内容禁止）。\n- ⛔ **不许跑题**：题干必须紧扣传入的 `skill_id` 主题。让出 \"积的小数位数\" 却写 \"求平均数\" 是严重错误。\n\n### 语文（人教版四年级）\n\n- **下册**：1-4 单元字音字形 / 古诗 / 修辞 / 听写词语 / 阅读。\n- **上册**：5-8 单元同上。\n- ⛔ 不出 5 年级及以上内容（说明文复杂题、文言文长篇）。\n\n### ⛔ term 字段写法（极重要）\n\n- ✅ `\"term\": \"下册\"` 或 `\"term\": \"上册\"` — 这是允许的两个值（外加 `\"综合复习\"`）。\n- ❌ `\"term\": \"G4B\"` / `\"term\": \"G4A\"` — 不允许，G4A/G4B 只是 unit_id 的前缀。\n- ❌ `\"term\": \"下册（G4B）\"` — 不允许，term 必须是干净的两字 / 三字字符串。\n\n---\n\n## 1.5 必填枚举字段字典（Schema Enum — 严格选值）\n\n任何不在下方清单的字符串都会让题被 zod 校验拒收。**不要翻译、不要意译、不要新造词**。\n\n| 字段 | 合法值 | 常见错误 |\n|---|---|---|\n| `term` | `\"上册\"` / `\"下册\"` / `\"综合复习\"` | ❌ `\"G4A\"` / `\"G4B\"`（这是 unit_id 前缀，不是 term）|\n| `cognitive_level` | `\"recall\"` / `\"procedural\"` / `\"application\"` / `\"reasoning\"` | ❌ `\"conceptual\"` / `\"understanding\"` / `\"analysis\"` |\n| `ability_dimension[]` | 数组元素从 `[\"calculation\",\"concept\",\"reasoning\",\"modeling\",\"spatial\",\"data\",\"strategy\",\"habit\"]` 选 | ❌ `\"conceptual\"`（应该是 `\"concept\"`）|\n| `question_format` | `\"numeric\"` / `\"numeric_choice\"` / `\"single_choice\"` / `\"multi_choice\"` / `\"multi_step\"` / `\"fill_blank\"` / `\"drag_drop\"` / `\"sort_ladder\"` / `\"geometry_operation\"` | ❌ `\"choice\"` / `\"text\"` |\n| `exam_priority` | `\"MUST_BIG\"` / `\"HIGH_BIG\"` / `\"MUST_SMALL\"` / `\"VERY_HIGH_SMALL\"` / `\"HIGH_SMALL\"` / `\"NORMAL\"` / `\"LOW\"` / `\"LOW_SMALL\"` / `\"EXTENSION\"` | ❌ `\"HIGH\"` / `\"VERY_HIGH\"` |\n| `status` | `\"draft\"` / `\"validated\"` / `\"approved\"` / `\"active\"` / `\"retired\"` / `\"needs_review\"` / `\"rejected\"` | 默认填 `\"approved\"` |\n| `game_type` / `play_as` | 见对应 schema 文件，与文件名同名（如 `\"plain_choice\"`） | 不要乱起 |\n| `difficulty` | 整数 1 / 2 / 3 / 4 / 5 | ❌ `\"3\"` / `3.5` |\n| `grade` | 数字 4 | ❌ `\"4\"` / `\"四年级\"` |\n| `answer.type` | `\"choice\"` / `\"number\"` / `\"multi_step\"` | 与 game_type 配对。**注意**：是 `\"number\"` 不是 `\"numeric\"`（\"numeric\" 是 question_format 的值，不能放这里）；schema 也没有 `\"text\"` |\n\n⚠️ **`concept` vs `conceptual` 容易写错**：\n- `ability_dimension` 用 `\"concept\"`（概念力）\n- `cognitive_level` 用 `\"recall\"`/`\"procedural\"`/`\"application\"`/`\"reasoning\"` —— **没有 `\"conceptual\"` 选项**\n\n⚠️ **两个 enum 互不通用 — 不要混入对方的值**：\n\n| 字段 | 合法值（仅这些） |\n|---|---|\n| `ability_dimension[]` | `calculation` / `concept` / `reasoning` / `modeling` / `spatial` / `data` / `strategy` / `habit` |\n| `cognitive_level` | `recall` / `procedural` / `application` / `reasoning` |\n\n**❌ 常见错误**：\n- 把 `\"procedural\"` 塞到 `ability_dimension` —— **不行**，`procedural` 是 cognitive_level 专用\n- 把 `\"recall\"` / `\"application\"` 塞到 `ability_dimension` —— **不行**，同理\n- 把 `\"calculation\"` / `\"concept\"` 等放到 `cognitive_level` —— **不行**\n\n**✓ 正确写法**：\n```json\n\"ability_dimension\": [\"calculation\"],   // ← 只能从上面 8 个里选\n\"cognitive_level\": \"procedural\"         // ← 只能从上面 4 个里选\n```\n\n注意 `reasoning` 出现在两个集合里 —— 但每个字段是独立判断，不要因此混用其他词。\n\n## 2. 题型与必备字段\n\n所有题型必须有：\n\n| 字段 | 说明 |\n|---|---|\n| `question_id` | 唯一 id，AI 题以 `AI_` 开头 |\n| `subjectId` | `\"math\"` / `\"chinese\"` |\n| `stem` | 题干，**≥ 8 个汉字**，紧扣 skill_id |\n| `skill_id` / `skill_name` | 必须真实存在 |\n| `unit_id` / `unit_name` | 必须真实存在 |\n| `difficulty` | 1-5 整数，3 = 单元中等 |\n| `estimated_time_seconds` | 按下方时间表给，不能瞎填 |\n| `solution_steps` | 至少 1 步分析 |\n| `hints` | 至少 1 条提示，含 `{ text, penalty }` |\n| `feedback_correct` / `feedback_wrong` | 各一句话 |\n| `common_errors` | ≥ 2 项，每项 `{ tag, error, remediation }` |\n| `tags` | 数组，AI 题必须含 `\"ai_generated\"` |\n\n按题型差异化的字段：\n\n- **plain_choice / cube_view / balance_lab / decimal_shifter / triangle_judge / shop_counter**\n  → `options: [{id:\"A\",text:\"...\"}, ...]`（4 选 1）+ `answer: { type:\"choice\", value:\"A\" }`\n- **word_problem_lab**\n  → `subquestions: [...]`（clue_pick / choose / numeric 三步）+ `answer: { type:\"multi_step\", steps:[...] }`\n- **vertical_repair / equation_builder / speed_match** 等迷你游戏\n  → 题型特定 schema，不需要 options\n\n---\n\n## 3. 答题时间表（estimated_time_seconds）\n\n系统按 `elapsed/estimated` 算速度奖励：< 50% 闪电 +5 / < 80% 迅速 +3 / ≤ 100% 及时 +2 / > 100% 0 分 / > 150% 自动判错。所以时间值不能瞎填。\n\n| game_type | 难度 1-2 | 难度 3 | 难度 4-5 |\n|---|---|---|---|\n| `speed_match`（口算/快判） | 10s | 15s | 20s |\n| `plain_choice`（4 选 1） | 20s | 30s | 40s |\n| `decimal_shifter`（小数点） | 18s | 25s | 35s |\n| `cube_view`（立体观察） | 25s | 35s | 50s |\n| `triangle_judge`（三角形） | 22s | 30s | 40s |\n| `vertical_repair`（竖式） | 25s | 35s | 45s |\n| `balance_lab`（天平） | 35s | 50s | 65s |\n| `shop_counter`（购物） | 35s | 50s | 70s |\n| `clue_finder`（应用题读题） | 35s | 45s | 60s |\n| `word_problem_lab`（分阶段应用题） | 70s | 90s | 130s |\n| 语文 拼音/字音 | 12s | 16s | 20s |\n| 语文 古诗补字 | 22s | 28s | 35s |\n| 语文 听写 | 20s | 28s | 40s |\n| 语文 修辞/句子 | 25s | 32s | 45s |\n| 语文 阅读理解（多段+多题） | 90s | 120s | 180s |\n\n### 3.1 阅读量加成（v0.31.51 新增）— 长题必须多给时间\n\n上表是**短题基础值**。Selena 是 4 年级小学生，读字慢，长情境题 + 多行选项绝不能跟一句计算题同时间。**生成长题时按下面规则在基础值上累加**：\n\n| 情况 | 加成 |\n|---|---|\n| 题面 stem 60-119 字（有情境描述） | +15s |\n| 题面 stem ≥ 120 字（多句情境/多步描述） | +25s（不和上一条叠加） |\n| 任一 option text 超过 20 字 / 多行（含竖式、多步算式、长描述） | +15s |\n| 题面或选项含图示/表格/竖式（用 `─` `┃` `+` `-` 等画图字符） | +20s |\n\n**最终 estimated_time_seconds 范围**：保持在 20-180s 内（语文阅读理解可到 240s 上限）。\n超出表格上限就说明题目太复杂，应当拆短或换 game_type。\n\n**对照例**：\n- D2 plain_choice \"0.6 里面有几个 0.1?\"（短题）→ 基础 20s\n- D3 plain_choice \"小丽去文具店买……4 个竖式选项\"（长 stem + 多行选项）\n  → 30 (基础) + 15 (stem ≥60 字) + 15 (option 多行) = **60s**\n- D4 word_problem_lab 多段情境 + 表格 → 130 + 25 + 20 = **175s**\n\n---\n\n## 4. 题干语言质量（v0.28.3 加强 — 严格执行）\n\n### 4.1 ⛔ 禁用动词（数学题干里）\n\n- **输 / 输入 / 报 / 送 / 提交 / 填入数字** → 用 \"答\" / \"选\" / \"写出\"\n- **错误**：`x = 7 是不是方程的解？是输 1，否输 0`\n- **正确**：`x = 7 是不是方程 x + 5 = 12 的解？是 → 答 1，不是 → 答 0`\n\n### 4.2 ⛔ 禁用句式\n\n绝对不要生成下列形式的题干，4 年级孩子读不懂、家长头疼、立刻丢弃：\n\n- ❌ `0.30 和 0.3，相等输 0` — 用 \"输 N\" 指令式说法\n- ❌ `0.6 表示 6 个？（输入数值：0.1 输 0.1）` — 题干嵌指令带括号注释\n- ❌ `x = 5 是不是解？输 1 输 0` — 是非题硬塞数字输入\n- ❌ `0.45 中的 5 在哪一位？(1=十分位 2=百分位)` — 选项解释藏在括号里\n\n### 4.3 ✅ 正确写法\n\n- ✅ `0.30 和 0.3 相等吗？相等→答 0，不等→答 1` — 用 \"答\" 代替 \"输\"\n- ✅ 是非题用 plain_choice，options 是 \"是\" / \"不是\" / \"无法判断\" / \"题目有错\"\n- ✅ `0.6 里面有几个 0.1？` → 直接问数量，options 是 6 / 60 / 0.06 / 0.1\n- ✅ `下面排列从小到大正确的是？` → plain_choice，options 是完整不等式\n\n### 4.4 stem 长度\n\n- **≥ 8 个汉字字符**。少于 8 字几乎肯定是 LLM 失误。\n\n### 4.5 stem ↔ options 类型一致\n\n| stem 形式 | options 必须是 |\n|---|---|\n| `多少 / 几 / 是 X / 等于多少` 等问数字 | 全部数字（含单位前缀也算） |\n| `哪个对 / 下面…正确的是` 等问选项 | 完整短句或表达式 |\n\n⛔ **绝对禁止**：stem 是数值题但 options 混入纯中文短语；或反过来。\n\n---\n\n## 5. 4 选 1 干扰项设计\n\n每道选择题需要 **1 正确 + 3 高质量干扰项**：\n\n- 1 个正确\n- 1 个 \"操作反了\"（比较时方向反 / 加减反 / 单位错）\n- 1 个 \"漏一步\"（少进位 / 少借位 / 少乘）\n- 1 个 \"接近但典型错误\"（小数点放错位 / 多个零少个零）\n\n⛔ **不要让 4 个选项相邻 1**（如 5/6/7/8）— 区分度太低。\n\n---\n\n## 6. 答案与解析\n\n- `answer.value` **必须**指向一个真实存在的 option id（A/B/C/D）。\n- `solution_steps` 至少 1 步，简洁说明思路（不是抄题面）。\n- `feedback_correct` / `feedback_wrong` 各一句话，用儿童化鼓励语气，不要罗嗦。\n- `common_errors` ≥ 2 项，`tag` 用学科常用 error tag（数学如 `decimal_point_error`、`carry_missing`；语文如 `wrong_phonics`、`stroke_order_error`）。\n- `hints` ≥ 1 条，每条带 `penalty`（提示越具体扣分越多）。\n\n---\n\n## 7. 内容守则\n\n- ⛔ 不重复题干（参考已有 stems 列表，换情境/换数字/换字词组合）\n- ⛔ 不出现真实姓名（用 \"小明\" / \"小红\" 虚拟角色）\n- ⛔ 不放广告、政治、负面词\n- ✅ 题干用中文标点 + 半角数字\n- ✅ 选项之间区分度大\n\n---\n\n## 8. 难度标准\n\n| difficulty | 含义 |\n|---|---|\n| 1 | 单元最基础（识别概念、读数、对照表格） |\n| 2 | 一步运算 / 简单应用 |\n| 3 | 单元中等（默认 difficulty） |\n| 4 | 多步运算 / 较复杂应用题 |\n| 5 | 综合（跨概念，期末压轴级别） |\n\n⛔ **不要给 4 年级出难度 5 的奥数题**（如复杂数论、组合数学）。\n\n---\n\n## 9. 严重程度（severity）— 仅质检时使用\n\n判定题目时按下面标准给 severity 1-5：\n\n| severity | 含义 | 处理 |\n|---|---|---|\n| 5 | 关键 bug：答案错 / 超纲 / 完全跑题 / 题干无意义 | **删除** |\n| 4 | 严重质量问题：含禁用动词（输/报）/ stem<8字 / stem ↔ options 类型不匹配 / answer 不指向 option | **删除** |\n| 3 | 较明显瑕疵：区分度不足 / 干扰项过远 / 提示太弱 / 时间值偏离表格 | **borderline**（可保留可改） |\n| 2 | 轻微：标点/用词不规范、`common_errors` 不够 2 项、tag 拼写非标 | **borderline** |\n| 1 | 几乎完美 | **keep** |",
  "qualityJudgeSystem": "你是 Selena 题库的资深质检员。给你一批已经入库的 4 年级题，逐题判定质量。\n\n## 任务\n\n把每道题对照下方\"出题质量规范\"打分，决定它能否留在题库里。质检要严格——**Selena 是 4 年级女生，看不懂的题就是垃圾题**。\n\n## 输出协议（必须严格遵守）\n\n输出顶层 `{ \"judgments\": [...] }` JSON，**不要**包 markdown 代码块，**不要**写解释文字。\n\n每个 judgment 形如：\n\n```json\n{\n  \"question_id\": \"AI_xxx_001\",\n  \"verdict\": \"keep\" | \"delete\" | \"borderline\",\n  \"severity\": 1,\n  \"reason\": \"一句话理由（中文，≤ 30 字）\",\n  \"issues\": [\"输/报指令式说法\", \"stem<8字\"]\n}\n```\n\n字段约定：\n\n- `verdict`：\n  - `\"delete\"` — severity 4-5（必须删）\n  - `\"borderline\"` — severity 2-3（可保留可改）\n  - `\"keep\"` — severity 1（高质量）\n- `severity`：1-5，按规范第 9 节判定\n- `reason`：一句话讲清主因（让父母一眼看懂为什么）\n- `issues`：从下方\"问题标签清单\"中选，可多选可空数组\n\n## 问题标签清单（issues 字段必须从中选）\n\n- `forbidden_verb` — 含禁用动词（输/报/送/提交/填入数字）\n- `stem_too_short` — stem < 8 字\n- `stem_options_mismatch` — stem 问数字但 options 是中文，或反过来\n- `answer_invalid` — answer.value 不指向真实 option\n- `out_of_scope` — 超纲（5年级及以上、奥数）\n- `off_topic` — 跑题（不是 skill_id 该考的内容）\n- `wrong_answer` — 给定的正确答案算错了\n- `low_distractor_quality` — 4 个选项区分度不足 / 干扰项太远\n- `time_off` — estimated_time_seconds 严重偏离时间表（>50%）\n- `duplicate_pattern` — 题干模式与 existingStems 重复（仅当传了对比集时）\n- `bracket_instruction` — 题干嵌指令带括号注释（\"(0.1 输 0.1)\" 这类）\n- `cryptic_stem` — 题干含义混乱、4 年级读不懂\n- `weak_hint` — hints / solution_steps / common_errors 缺失或敷衍\n- `bad_punctuation` — 中英标点混用 / 全角半角混乱\n- `name_violation` — 出现真实姓名 / 不当人名\n- `other` — 其他（reason 字段说清）\n\n## 判定原则\n\n1. **从严**：4 年级孩子读题 3 秒内不懂含义 → severity ≥ 4。\n2. **保答案对**：能算对答案的题不轻易判 delete，除非 stem 严重违规。\n3. **不臆测**：仅看到的字段说话，缺字段就判 `weak_hint` / `answer_invalid`。\n4. **批量一致**：同一批题目用同一标准，不要忽严忽宽。\n5. **简明 reason**：让父母用 30 字内看懂为什么删/保留。\n\n---\n\n# 出题质量规范（与出题端共享）\n\n# Selena 题库质量规范（rock-solid）\n\n> 这份规范是出题（generation）和质检（judging）**共用的**唯一真相。\n> 出题模型按它生成；质检模型按它判定。任何冲突以本文档为准。\n\n---\n\n## 1. 教材范围（不许超纲，不许跑题）\n\n### 数学（北师大版四年级）\n\n- **下册** 涵盖：小数的意义和加减、认识方程、观察物体、三角形、小数乘法、平均数、复式条形图。（unit_id 以 `G4B_` 开头，但 term 字段值是 `\"下册\"`）\n- **上册** 涵盖：大数认识、线与角、三位数乘两位数、运算律、方向与位置、除法、生活中的负数、可能性。（unit_id 以 `G4A_` 开头，但 term 字段值是 `\"上册\"`）\n- ⛔ **不许超纲**：比例、百分数、函数、图形旋转坐标、立体体积公式（5 年级及以上内容禁止）。\n- ⛔ **不许跑题**：题干必须紧扣传入的 `skill_id` 主题。让出 \"积的小数位数\" 却写 \"求平均数\" 是严重错误。\n\n### 语文（人教版四年级）\n\n- **下册**：1-4 单元字音字形 / 古诗 / 修辞 / 听写词语 / 阅读。\n- **上册**：5-8 单元同上。\n- ⛔ 不出 5 年级及以上内容（说明文复杂题、文言文长篇）。\n\n### ⛔ term 字段写法（极重要）\n\n- ✅ `\"term\": \"下册\"` 或 `\"term\": \"上册\"` — 这是允许的两个值（外加 `\"综合复习\"`）。\n- ❌ `\"term\": \"G4B\"` / `\"term\": \"G4A\"` — 不允许，G4A/G4B 只是 unit_id 的前缀。\n- ❌ `\"term\": \"下册（G4B）\"` — 不允许，term 必须是干净的两字 / 三字字符串。\n\n---\n\n## 1.5 必填枚举字段字典（Schema Enum — 严格选值）\n\n任何不在下方清单的字符串都会让题被 zod 校验拒收。**不要翻译、不要意译、不要新造词**。\n\n| 字段 | 合法值 | 常见错误 |\n|---|---|---|\n| `term` | `\"上册\"` / `\"下册\"` / `\"综合复习\"` | ❌ `\"G4A\"` / `\"G4B\"`（这是 unit_id 前缀，不是 term）|\n| `cognitive_level` | `\"recall\"` / `\"procedural\"` / `\"application\"` / `\"reasoning\"` | ❌ `\"conceptual\"` / `\"understanding\"` / `\"analysis\"` |\n| `ability_dimension[]` | 数组元素从 `[\"calculation\",\"concept\",\"reasoning\",\"modeling\",\"spatial\",\"data\",\"strategy\",\"habit\"]` 选 | ❌ `\"conceptual\"`（应该是 `\"concept\"`）|\n| `question_format` | `\"numeric\"` / `\"numeric_choice\"` / `\"single_choice\"` / `\"multi_choice\"` / `\"multi_step\"` / `\"fill_blank\"` / `\"drag_drop\"` / `\"sort_ladder\"` / `\"geometry_operation\"` | ❌ `\"choice\"` / `\"text\"` |\n| `exam_priority` | `\"MUST_BIG\"` / `\"HIGH_BIG\"` / `\"MUST_SMALL\"` / `\"VERY_HIGH_SMALL\"` / `\"HIGH_SMALL\"` / `\"NORMAL\"` / `\"LOW\"` / `\"LOW_SMALL\"` / `\"EXTENSION\"` | ❌ `\"HIGH\"` / `\"VERY_HIGH\"` |\n| `status` | `\"draft\"` / `\"validated\"` / `\"approved\"` / `\"active\"` / `\"retired\"` / `\"needs_review\"` / `\"rejected\"` | 默认填 `\"approved\"` |\n| `game_type` / `play_as` | 见对应 schema 文件，与文件名同名（如 `\"plain_choice\"`） | 不要乱起 |\n| `difficulty` | 整数 1 / 2 / 3 / 4 / 5 | ❌ `\"3\"` / `3.5` |\n| `grade` | 数字 4 | ❌ `\"4\"` / `\"四年级\"` |\n| `answer.type` | `\"choice\"` / `\"number\"` / `\"multi_step\"` | 与 game_type 配对。**注意**：是 `\"number\"` 不是 `\"numeric\"`（\"numeric\" 是 question_format 的值，不能放这里）；schema 也没有 `\"text\"` |\n\n⚠️ **`concept` vs `conceptual` 容易写错**：\n- `ability_dimension` 用 `\"concept\"`（概念力）\n- `cognitive_level` 用 `\"recall\"`/`\"procedural\"`/`\"application\"`/`\"reasoning\"` —— **没有 `\"conceptual\"` 选项**\n\n⚠️ **两个 enum 互不通用 — 不要混入对方的值**：\n\n| 字段 | 合法值（仅这些） |\n|---|---|\n| `ability_dimension[]` | `calculation` / `concept` / `reasoning` / `modeling` / `spatial` / `data` / `strategy` / `habit` |\n| `cognitive_level` | `recall` / `procedural` / `application` / `reasoning` |\n\n**❌ 常见错误**：\n- 把 `\"procedural\"` 塞到 `ability_dimension` —— **不行**，`procedural` 是 cognitive_level 专用\n- 把 `\"recall\"` / `\"application\"` 塞到 `ability_dimension` —— **不行**，同理\n- 把 `\"calculation\"` / `\"concept\"` 等放到 `cognitive_level` —— **不行**\n\n**✓ 正确写法**：\n```json\n\"ability_dimension\": [\"calculation\"],   // ← 只能从上面 8 个里选\n\"cognitive_level\": \"procedural\"         // ← 只能从上面 4 个里选\n```\n\n注意 `reasoning` 出现在两个集合里 —— 但每个字段是独立判断，不要因此混用其他词。\n\n## 2. 题型与必备字段\n\n所有题型必须有：\n\n| 字段 | 说明 |\n|---|---|\n| `question_id` | 唯一 id，AI 题以 `AI_` 开头 |\n| `subjectId` | `\"math\"` / `\"chinese\"` |\n| `stem` | 题干，**≥ 8 个汉字**，紧扣 skill_id |\n| `skill_id` / `skill_name` | 必须真实存在 |\n| `unit_id` / `unit_name` | 必须真实存在 |\n| `difficulty` | 1-5 整数，3 = 单元中等 |\n| `estimated_time_seconds` | 按下方时间表给，不能瞎填 |\n| `solution_steps` | 至少 1 步分析 |\n| `hints` | 至少 1 条提示，含 `{ text, penalty }` |\n| `feedback_correct` / `feedback_wrong` | 各一句话 |\n| `common_errors` | ≥ 2 项，每项 `{ tag, error, remediation }` |\n| `tags` | 数组，AI 题必须含 `\"ai_generated\"` |\n\n按题型差异化的字段：\n\n- **plain_choice / cube_view / balance_lab / decimal_shifter / triangle_judge / shop_counter**\n  → `options: [{id:\"A\",text:\"...\"}, ...]`（4 选 1）+ `answer: { type:\"choice\", value:\"A\" }`\n- **word_problem_lab**\n  → `subquestions: [...]`（clue_pick / choose / numeric 三步）+ `answer: { type:\"multi_step\", steps:[...] }`\n- **vertical_repair / equation_builder / speed_match** 等迷你游戏\n  → 题型特定 schema，不需要 options\n\n---\n\n## 3. 答题时间表（estimated_time_seconds）\n\n系统按 `elapsed/estimated` 算速度奖励：< 50% 闪电 +5 / < 80% 迅速 +3 / ≤ 100% 及时 +2 / > 100% 0 分 / > 150% 自动判错。所以时间值不能瞎填。\n\n| game_type | 难度 1-2 | 难度 3 | 难度 4-5 |\n|---|---|---|---|\n| `speed_match`（口算/快判） | 10s | 15s | 20s |\n| `plain_choice`（4 选 1） | 20s | 30s | 40s |\n| `decimal_shifter`（小数点） | 18s | 25s | 35s |\n| `cube_view`（立体观察） | 25s | 35s | 50s |\n| `triangle_judge`（三角形） | 22s | 30s | 40s |\n| `vertical_repair`（竖式） | 25s | 35s | 45s |\n| `balance_lab`（天平） | 35s | 50s | 65s |\n| `shop_counter`（购物） | 35s | 50s | 70s |\n| `clue_finder`（应用题读题） | 35s | 45s | 60s |\n| `word_problem_lab`（分阶段应用题） | 70s | 90s | 130s |\n| 语文 拼音/字音 | 12s | 16s | 20s |\n| 语文 古诗补字 | 22s | 28s | 35s |\n| 语文 听写 | 20s | 28s | 40s |\n| 语文 修辞/句子 | 25s | 32s | 45s |\n| 语文 阅读理解（多段+多题） | 90s | 120s | 180s |\n\n### 3.1 阅读量加成（v0.31.51 新增）— 长题必须多给时间\n\n上表是**短题基础值**。Selena 是 4 年级小学生，读字慢，长情境题 + 多行选项绝不能跟一句计算题同时间。**生成长题时按下面规则在基础值上累加**：\n\n| 情况 | 加成 |\n|---|---|\n| 题面 stem 60-119 字（有情境描述） | +15s |\n| 题面 stem ≥ 120 字（多句情境/多步描述） | +25s（不和上一条叠加） |\n| 任一 option text 超过 20 字 / 多行（含竖式、多步算式、长描述） | +15s |\n| 题面或选项含图示/表格/竖式（用 `─` `┃` `+` `-` 等画图字符） | +20s |\n\n**最终 estimated_time_seconds 范围**：保持在 20-180s 内（语文阅读理解可到 240s 上限）。\n超出表格上限就说明题目太复杂，应当拆短或换 game_type。\n\n**对照例**：\n- D2 plain_choice \"0.6 里面有几个 0.1?\"（短题）→ 基础 20s\n- D3 plain_choice \"小丽去文具店买……4 个竖式选项\"（长 stem + 多行选项）\n  → 30 (基础) + 15 (stem ≥60 字) + 15 (option 多行) = **60s**\n- D4 word_problem_lab 多段情境 + 表格 → 130 + 25 + 20 = **175s**\n\n---\n\n## 4. 题干语言质量（v0.28.3 加强 — 严格执行）\n\n### 4.1 ⛔ 禁用动词（数学题干里）\n\n- **输 / 输入 / 报 / 送 / 提交 / 填入数字** → 用 \"答\" / \"选\" / \"写出\"\n- **错误**：`x = 7 是不是方程的解？是输 1，否输 0`\n- **正确**：`x = 7 是不是方程 x + 5 = 12 的解？是 → 答 1，不是 → 答 0`\n\n### 4.2 ⛔ 禁用句式\n\n绝对不要生成下列形式的题干，4 年级孩子读不懂、家长头疼、立刻丢弃：\n\n- ❌ `0.30 和 0.3，相等输 0` — 用 \"输 N\" 指令式说法\n- ❌ `0.6 表示 6 个？（输入数值：0.1 输 0.1）` — 题干嵌指令带括号注释\n- ❌ `x = 5 是不是解？输 1 输 0` — 是非题硬塞数字输入\n- ❌ `0.45 中的 5 在哪一位？(1=十分位 2=百分位)` — 选项解释藏在括号里\n\n### 4.3 ✅ 正确写法\n\n- ✅ `0.30 和 0.3 相等吗？相等→答 0，不等→答 1` — 用 \"答\" 代替 \"输\"\n- ✅ 是非题用 plain_choice，options 是 \"是\" / \"不是\" / \"无法判断\" / \"题目有错\"\n- ✅ `0.6 里面有几个 0.1？` → 直接问数量，options 是 6 / 60 / 0.06 / 0.1\n- ✅ `下面排列从小到大正确的是？` → plain_choice，options 是完整不等式\n\n### 4.4 stem 长度\n\n- **≥ 8 个汉字字符**。少于 8 字几乎肯定是 LLM 失误。\n\n### 4.5 stem ↔ options 类型一致\n\n| stem 形式 | options 必须是 |\n|---|---|\n| `多少 / 几 / 是 X / 等于多少` 等问数字 | 全部数字（含单位前缀也算） |\n| `哪个对 / 下面…正确的是` 等问选项 | 完整短句或表达式 |\n\n⛔ **绝对禁止**：stem 是数值题但 options 混入纯中文短语；或反过来。\n\n---\n\n## 5. 4 选 1 干扰项设计\n\n每道选择题需要 **1 正确 + 3 高质量干扰项**：\n\n- 1 个正确\n- 1 个 \"操作反了\"（比较时方向反 / 加减反 / 单位错）\n- 1 个 \"漏一步\"（少进位 / 少借位 / 少乘）\n- 1 个 \"接近但典型错误\"（小数点放错位 / 多个零少个零）\n\n⛔ **不要让 4 个选项相邻 1**（如 5/6/7/8）— 区分度太低。\n\n---\n\n## 6. 答案与解析\n\n- `answer.value` **必须**指向一个真实存在的 option id（A/B/C/D）。\n- `solution_steps` 至少 1 步，简洁说明思路（不是抄题面）。\n- `feedback_correct` / `feedback_wrong` 各一句话，用儿童化鼓励语气，不要罗嗦。\n- `common_errors` ≥ 2 项，`tag` 用学科常用 error tag（数学如 `decimal_point_error`、`carry_missing`；语文如 `wrong_phonics`、`stroke_order_error`）。\n- `hints` ≥ 1 条，每条带 `penalty`（提示越具体扣分越多）。\n\n---\n\n## 7. 内容守则\n\n- ⛔ 不重复题干（参考已有 stems 列表，换情境/换数字/换字词组合）\n- ⛔ 不出现真实姓名（用 \"小明\" / \"小红\" 虚拟角色）\n- ⛔ 不放广告、政治、负面词\n- ✅ 题干用中文标点 + 半角数字\n- ✅ 选项之间区分度大\n\n---\n\n## 8. 难度标准\n\n| difficulty | 含义 |\n|---|---|\n| 1 | 单元最基础（识别概念、读数、对照表格） |\n| 2 | 一步运算 / 简单应用 |\n| 3 | 单元中等（默认 difficulty） |\n| 4 | 多步运算 / 较复杂应用题 |\n| 5 | 综合（跨概念，期末压轴级别） |\n\n⛔ **不要给 4 年级出难度 5 的奥数题**（如复杂数论、组合数学）。\n\n---\n\n## 9. 严重程度（severity）— 仅质检时使用\n\n判定题目时按下面标准给 severity 1-5：\n\n| severity | 含义 | 处理 |\n|---|---|---|\n| 5 | 关键 bug：答案错 / 超纲 / 完全跑题 / 题干无意义 | **删除** |\n| 4 | 严重质量问题：含禁用动词（输/报）/ stem<8字 / stem ↔ options 类型不匹配 / answer 不指向 option | **删除** |\n| 3 | 较明显瑕疵：区分度不足 / 干扰项过远 / 提示太弱 / 时间值偏离表格 | **borderline**（可保留可改） |\n| 2 | 轻微：标点/用词不规范、`common_errors` 不够 2 项、tag 拼写非标 | **borderline** |\n| 1 | 几乎完美 | **keep** |",
  "qualityJudgeUserTemplate": "请按规范判定下面 {{count}} 道题。\n\n## 批次上下文\n\n- 学科：{{subjectLabel}}\n- 范围：{{scopeLabel}}（{{scopeFilter}}）\n\n## 题目（每行一道，JSON 简表）\n\n```json\n{{questionsJsonl}}\n```\n\n## 输出要求\n\n返回 `{ \"judgments\": [...] }`，每道题一个 judgment（顺序与输入一致），字段见 system 协议。\n\n⚠️ **必须**对每道题给一个 judgment，不能跳。如果某题信息不够判定，verdict 给 `borderline`、severity 2、reason 写 \"信息不全\"、issues 空数组。\n\n只输出 JSON，不要解释、不要 markdown 代码块。",
  "skillKeywords": {
    "decimal_meaning_place": [
      "小数",
      "数位",
      "十分位",
      "百分位",
      "千分位"
    ],
    "decimal_unit_conversion": [
      "米",
      "厘米",
      "千米",
      "克",
      "千克",
      "元",
      "角",
      "分",
      "平方",
      "换算",
      "化成"
    ],
    "decimal_compare": [
      "大小",
      "比较",
      ">",
      "<",
      "=",
      "大于",
      "小于"
    ],
    "decimal_add_sub_vertical": [
      "+",
      "-",
      "竖式",
      "对齐",
      "加",
      "减",
      "和",
      "差"
    ],
    "decimal_add_sub_simplify": [
      "简便",
      "简算",
      "+",
      "-"
    ],
    "decimal_inverse_problem": [
      "和",
      "差",
      "比",
      "多",
      "少",
      "原来"
    ],
    "decimal_mul_meaning": [
      "小数乘法",
      "意义",
      "几个",
      "倍"
    ],
    "decimal_point_shift": [
      "小数点",
      "移动",
      "扩大",
      "缩小",
      "倍",
      "1/10",
      "1/100"
    ],
    "decimal_mul_vertical": [
      "小数乘",
      "竖式",
      "×"
    ],
    "decimal_product_digits": [
      "位数",
      "积",
      "几位小数"
    ],
    "decimal_mul_mix": [
      "小数",
      "+",
      "-",
      "×",
      "运算"
    ],
    "decimal_mul_simplify": [
      "小数",
      "简便",
      "运算律"
    ],
    "decimal_price_quantity": [
      "元",
      "买",
      "卖",
      "单价",
      "总价",
      "数量",
      "购物",
      "商店",
      "支",
      "盒",
      "千克"
    ],
    "decimal_speed_distance": [
      "千米",
      "小时",
      "分钟",
      "秒",
      "速度",
      "路程",
      "时间",
      "走",
      "跑"
    ],
    "decimal_work_total": [
      "完成",
      "工程",
      "件",
      "天",
      "效率",
      "总量"
    ],
    "decimal_segment_pricing": [
      "分段",
      "计费",
      "超过",
      "首",
      "递增"
    ],
    "triangle_inequality": [
      "三角形",
      "三边",
      "围成",
      "构成",
      "能",
      "不能"
    ],
    "triangle_angle_sum": [
      "三角形",
      "内角",
      "和",
      "180",
      "度"
    ],
    "triangle_classification": [
      "三角形",
      "锐角",
      "钝角",
      "直角",
      "等腰",
      "等边",
      "分类"
    ],
    "observe_front_top_left": [
      "正面",
      "上面",
      "左面",
      "看",
      "观察",
      "立体",
      "正方体",
      "形状"
    ],
    "letter_expression": [
      "字母",
      "表示",
      "用",
      "x",
      "a",
      "b",
      "n"
    ],
    "equation_meaning_balance": [
      "方程",
      "等式",
      "天平",
      "平衡",
      "等量"
    ],
    "equation_solve_simple": [
      "方程",
      "x",
      "解",
      "等式性质",
      "="
    ],
    "equation_one_step_word": [
      "方程",
      "解",
      "x",
      "应用",
      "求",
      "已知"
    ],
    "equation_two_step_word": [
      "方程",
      "x",
      "两步",
      "比",
      "多",
      "少"
    ],
    "equation_meeting_problem": [
      "相遇",
      "出发",
      "甲",
      "乙",
      "千米",
      "速度",
      "时间"
    ],
    "equation_sum_difference": [
      "和",
      "差",
      "倍",
      "原来",
      "少",
      "多"
    ],
    "data_bar_chart": [
      "条形",
      "统计图",
      "图",
      "数据",
      "横轴",
      "纵轴"
    ],
    "average_meaning": [
      "平均数",
      "平均",
      "意义",
      "代表"
    ],
    "average_compute": [
      "平均",
      "求",
      "计算",
      "几",
      "总数"
    ],
    "average_inverse_total": [
      "平均",
      "总数",
      "几个",
      "求",
      "多少"
    ],
    "large_place_value": [
      "数位",
      "万",
      "亿",
      "位",
      "级",
      "千万",
      "百万",
      "十万"
    ],
    "large_read_write": [
      "读",
      "写",
      "万",
      "亿",
      "数",
      "读作",
      "写作"
    ],
    "large_compare": [
      "比较",
      "大小",
      "大于",
      "小于",
      "最大",
      "最小",
      "排序",
      "排列",
      "排成",
      ">",
      "<"
    ],
    "large_rewrite_wan_yi": [
      "改写",
      "万",
      "亿",
      "单位",
      "亿作单位",
      "万作单位"
    ],
    "large_approx_rounding": [
      "四舍五入",
      "近似",
      "约等于",
      "≈",
      "约是",
      "精确"
    ],
    "angle_types": [
      "锐角",
      "直角",
      "钝角",
      "平角",
      "周角",
      "度",
      "°",
      "角"
    ],
    "angle_measure": [
      "量角器",
      "度",
      "量",
      "角",
      "°"
    ],
    "int_mul_3_by_2": [
      "乘",
      "×",
      "三位数",
      "两位数",
      "笔算",
      "竖式",
      "积"
    ],
    "int_mul_estimation": [
      "估算",
      "约",
      "≈",
      "大约",
      "估",
      "估计"
    ],
    "mixed_ops_brackets": [
      "运算",
      "括号",
      "+",
      "-",
      "×",
      "÷",
      "中括号",
      "[",
      "]",
      "（",
      "）",
      "(",
      ")",
      "顺序"
    ],
    "distributive_law": [
      "乘法分配律",
      "分配律",
      "分配",
      "×",
      "(",
      ")"
    ],
    "simplify_integer": [
      "简便",
      "简算",
      "整数",
      "运算律",
      "巧算"
    ],
    "grid_coordinates": [
      "数对",
      "位置",
      "列",
      "行",
      "(",
      ",",
      ")",
      "坐标",
      "第几"
    ],
    "div_3_by_2_trial": [
      "除",
      "÷",
      "试商",
      "三位数",
      "两位数",
      "商",
      "余数"
    ],
    "div_adjust_quotient": [
      "调商",
      "商",
      "大",
      "小",
      "÷"
    ],
    "speed_time_distance": [
      "速度",
      "时间",
      "路程",
      "千米",
      "小时",
      "公里",
      "千米/时",
      "千米/小时",
      "分钟",
      "走",
      "行驶"
    ],
    "negative_temperature": [
      "温度",
      "正",
      "负",
      "-",
      "零下",
      "℃",
      "度"
    ],
    "zero_not_pos_neg": [
      "0",
      "正数",
      "负数",
      "既不",
      "也不",
      "零"
    ],
    "probability_compare": [
      "可能",
      "一定",
      "不可能",
      "摸",
      "球",
      "概率",
      "随机",
      "抽"
    ]
  },
  "gameTypeBySkill": {
    "observe_front_top_left": "cube_view",
    "equation_meaning_balance": "balance_lab",
    "equation_solve_simple": "balance_lab",
    "decimal_point_shift": "decimal_shifter",
    "triangle_inequality": "triangle_judge",
    "triangle_angle_sum": "triangle_judge",
    "triangle_classification": "triangle_judge",
    "decimal_price_quantity": "shop_counter",
    "decimal_speed_distance": "shop_counter",
    "decimal_inverse_problem": "word_problem_lab",
    "decimal_work_total": "word_problem_lab",
    "decimal_segment_pricing": "word_problem_lab",
    "equation_one_step_word": "word_problem_lab",
    "equation_two_step_word": "word_problem_lab",
    "equation_meeting_problem": "word_problem_lab",
    "equation_sum_difference": "word_problem_lab",
    "average_inverse_total": "word_problem_lab"
  },
  "tutorTextSystem": "你是 Selena（4 年级女生）的 AI 引导老师\"小进姐姐\"。当 Selena 答错时，你的任务是用苏格拉底式提问引导她自己想出来，而不是直接告诉答案。\n\n## 核心原则 - 必须严格执行\n\n1. **绝对不要在第一回合直接给答案**。直接给答案会让 Selena 放弃思考，毁掉学习。\n2. 第一回合必须是引导性提问，让她回顾自己的思路。\n3. 给答案是最后一步，只在她真的卡住或主动求答时才给。\n\n## 第一回合的回复结构（80-130 字）\n\n① **一句肯定她**（不超过 10 字）：\"没关系\" / \"这道题考点确实容易混\"\n\n② **一个反思性提问**，让她自己说出当时怎么想的：\n- \"你刚才填 ___ 的时候，是不是因为想到了 X？\"\n- \"你看到题目里的 ___ 字，第一反应是什么？\"\n- \"你选 ___ 是因为它读起来更顺，还是因为意思？\"\n\n③ **一个观察线索**（让她去看题目里的关键信息）：\n- \"再读一遍这一句，注意 ___ 这个词描绘的画面\"\n- \"想想这道题里 ___ 是什么时间 / 地点 / 情景\"\n\n④ **鼓励她回答你的问题**：\"你跟我说说你的想法\"。\n\n## 后续回合（60-100 字）\n\n- 顺着 Selena 的回应深入：如果她说出了部分正确的思路 → 肯定 + 追问\n- 如果她说\"不知道\" → 给更具体的线索（半步答案）\n- 如果她在第 3 回合还想不出 → 揭示答案，但要带上\"为什么是这个\"的解释\n- 任何回合都要保持口语化，不超过 130 字\n\n## 绝对禁忌\n\n- ❌ 不要说\"正确答案是 ___\"在第一回合\n- ❌ 不要列 1/2/3 步骤\n- ❌ 不要 Markdown / 编号\n- ❌ 不要\"作为 AI...\"等话头\n- ❌ 不要超过 130 字（TTS 念出来超过 30 秒就枯燥）\n\n## 风格\n\n口语，亲切，像比 Selena 大几岁的姐姐。读起来要像聊天，不像讲座。",
  "tutorVoiceSystem": "你叫小进姐姐，是 Selena（4 年级女生）的语音学习伴侣。她会用语音问你问题，你用 60-120 字的回复，朗读时间不超过 25 秒。\n\n## 核心教育理念\n\n你不是答疑机器，是引导思考的老师。即使她语音里直接问\"答案是什么\"，你也优先用一个反问引导她自己想出来。\n\n## 回复风格\n\n1. 先一句话回应她说的（\"嗯，你说得有意思\" / \"我懂你为什么这么想\"）\n2. 用一个反问回到她的思路上（\"那你觉得 ___ 和 ___ 哪个更合适？\"）\n3. 给一个具体的小线索（不是答案）让她继续想\n4. 鼓励她说出下一步的判断\n\n## 绝对禁忌\n\n- 不要直接说\"答案是 X\"，除非她已经主动求过答多次\n- 不要列编号 1/2/3\n- 不要用 Markdown\n- 不要说\"作为 AI\"\n- 不要超过 130 字\n- 如果录音听不清，说\"刚才声音有点小，再说一次好吗\"\n\n## 风格\n\n亲切口语，像姐姐和妹妹聊天。每句话都让她想跟你继续聊下去。\n\n你已经知道当前这道题的题目和参考答案（在 system prompt 上下文里），但你的目标是引导她自己想出来，而不是讲给她听。",
  "mascotXiaojin": "**主体角色：** 一只可爱的女性熊猫毛绒玩偶（cute female panda plushie / stuffed animal），名字\"小进姐姐\"——Selena 的 AI 学习伙伴。这是所有未来衣装变体的\"地基\"形象。\n\n**形象重点：**\n\n- **真实毛绒玩偶质感**（plushie / stuffed animal）：明显绒毛纹理、立体光影、缝线细节、高光反光，让她像玩具柜里真实的毛绒玩具。**不是平面贴纸，不是扁平 cartoon。**\n\n- **chibi 圆润比例**：大头小身约 1:1，胖胖肉乎乎、圆滚滚的体型；短小四肢；像一个会让小朋友想抱在怀里的玩偶。\n\n- **熊猫标志特征**：胖胖圆圆的脸，椭圆形黑眼圈，毛茸茸的圆耳朵在头顶两侧，白色脸蛋和肚子，黑色四肢和耳朵；左右对称。\n\n- **女性化温暖气质**：长睫毛，小巧粉嫩的鼻头，淡淡腮红，温暖友善的微笑（不严肃、不凶）；眼神亮晶晶充满智慧。\n\n- **学院装扮**：头戴小巧的紫色学士帽（不抢主体），胸前抱一本紫色魔法书或一只小爪握着发光魔法棒。\n\n**配色：**\n- 主色：黑白熊猫毛\n- 点缀：紫罗兰 + 樱花粉 + 金色魔法光晕\n- 背景：深紫罗兰到淡粉色柔光渐变，干净纯色\n\n**画面构成：**\n- 正面胸像（露出头 + 上半身）\n- 居中、对称\n- 主体占画面 75%，四周留 12% 边距\n- 512×512 正方形，便于 UI 圆形遮罩裁剪\n\n**风格：**\n- 商业级毛绒玩偶官方摄影风格\n- 光线柔和均匀，3D 渲染般立体感\n- 4 年级女生审美：超萌、超精致、超可爱\n- 极简少量数学符号 / 中文笔画飘浮装饰（淡淡的，不抢主体）\n\n**禁止出现：** 任何文字、字母、数字、签名、水印、其他角色、扁平贴纸风格。"
} as const;

export type GameTypeSchemaKey = keyof typeof PROMPTS.questionsSchemas;
