## 题型：plain_choice（4 选 1 标准选择题）

> `subjectId / term / unit_id / skill_id / grade / difficulty / cognitive_level / ability_dimension / question_format / estimated_time_seconds / exam_priority / status` 这些字段由系统在 user prompt 的「已确定的元数据」段精确给出，**原样抄进**每道题，不要自己造值或改值。

⏱️ **答题时间**已由系统按 game_type × difficulty × 阅读量在元数据里给出。如果你想给的题面长 / 选项含图示，超过元数据里的值 → 应该把题做更紧凑而不是改时间。

---

## 必填字段（**完整 schema** — 复制这个结构）

```json
{
  "stem": "题面文字（≥ 8 个汉字）",
  "options": [
    { "id": "A", "text": "选项 A" },
    { "id": "B", "text": "选项 B" },
    { "id": "C", "text": "选项 C" },
    { "id": "D", "text": "选项 D" }
  ],
  "answer": { "type": "choice", "value": "A" },
  "solution_steps": ["分析步骤一句话"],
  "hints": [{ "text": "提示文字", "penalty": 1 }],
  "common_errors": [
    { "tag": "decimal_point_error", "error": "常见错误描述", "remediation": "怎么纠正" }
  ],
  "feedback_correct": "答对的反馈一句话",
  "feedback_wrong": "答错的反馈一句话",
  "tags": ["ai_generated"]
}
```

⚠️ `solution_steps` 是字符串数组（`["第一步", "第二步"]`），不是对象数组。
⚠️ `hints[].penalty` 是整数 1-3，不要浮点。

---

## 4 条原则（违反就 fail，详见 quality-principles.md）

- **P1 题面纯净**：`stem` / `options[].text` / `hints` / `feedback` 不要写"（无关）/（错答）/（误用）"等元注解；options 上**不要**挂 `errorTag` 字段（错答归类放 `_internal_option_diagnostics`）
- **P2 数学闭合**：答案在题面情境下必须合常识（果树/人数等可数实物 → 整数）
- **P3 干扰项独立**：3 个错选项不能用题中数字的直接衍生（如 6x 的值），必须代表"具体学生误解"
- **P4 skill 真考**：4 个选项量级一致；不让学生靠排除奇葩值就蒙对

---

## v0.31.73：竖式 / 数位对齐题用结构化 visual 字段（不要 ASCII art）

⚠️ **当题目涉及"小数点对齐 / 竖式书写 / 数位对齐"等概念时**，options[] 必须**额外**带 `visual` 字段，让前端用 grid 渲染对齐而不是靠空格字符。

```json
{
  "id": "A",
  "text": "5.09 - 2.3（末位对齐 — 错位）",
  "visual": {
    "type": "vertical_arithmetic",
    "a": "5.09",
    "op": "−",
    "b": "2.3",
    "align": "right"
  }
}
```

```json
{
  "id": "B",
  "text": "5.09 - 2.30（小数点对齐 — 正确）",
  "visual": {
    "type": "vertical_arithmetic",
    "a": "5.09",
    "op": "−",
    "b": "2.30",
    "align": "decimal"
  }
}
```

`visual` 字段：
- `type: "vertical_arithmetic"`（目前只有这一种结构化竖式，其他题型不需要 visual）
- `a` / `op` / `b`：操作数 + 运算符（`+` / `−` / `×` / `÷`）
- `align: "decimal"`（按小数点对齐 — 正确写法）/ `"right"`（按末位对齐 — 错误写法）

**触发场景**：题面里出现"小数加减竖式 / 对齐小数点 / 列竖式 / 数位对齐"等关键词，且选项要展示具体的对齐效果。

⛔ **不要再用 `\n` 拼 ASCII art**（如 `" 5.09\n− 2.30\n────"`）—— 字体宽不一致 → 渲染对不齐。新结构化 visual 字段由前端 monospace + grid 精确对齐。

`text` 字段仍保留（供 a11y 阅读 / 截图回退），但内容应是**简洁描述**（如 "末位对齐"），不要再粘 ASCII 竖式。

---

## 干扰项设计（P3 + P4 落地）

每道选择题需要 **1 正确 + 3 高质量干扰项**：
- 1 个 "操作反了"（比较时方向反 / 加减反 / 单位错）
- 1 个 "漏一步"（少进位 / 少借位 / 少乘）
- 1 个 "接近但典型错误"（小数点放错位 / 多个零少个零）

⛔ 不要 4 个选项相邻 1（如 5/6/7/8）— 区分度太低
⛔ 不要把题中数字直接放进 distractor（如题里"6 倍"，distractor 不能是 6 本身）
