## 题型：sentence_shuffle（句子重排 / 龙鳞重组）

⏱️ **答题时间**：`estimated_time_seconds: 35`

把一句话拆成若干词块、打乱，让 Selena 按正确语序点亮拼回。**核心训练**：句子语序、关联词、古诗排序、病句语序修改。前端是「病句龙训」场景（C3 cluster）。

### 玩法（前端）

题面给出排序指令（不是病句原文），底部是打乱的词块。依次点词块填进顺序栏，全部摆对即过关。

### stem 写法

stem 是**排序指令**，例如：
- `把词块按正确顺序点亮组成一句话：`
- `按正确顺序点出王之涣《登鹳雀楼》前两句：`
- `用关联词组句（"因为…所以…"）：`

### 必须字段

```json
{
  "game_type": "sentence_shuffle",
  "question_format": "single_choice",
  "cognitive_level": "procedural",
  "ability_dimension": ["accumulation"],
  "estimated_time_seconds": 35,
  "stem": "把词块按正确顺序点亮组成一句话：",
  "game_data": {
    "kind": "sentence_shuffle",
    "tokens": ["小燕子", "在", "屋檐下", "筑起了", "温暖的", "小巢"],
    "fullSentence": "小燕子在屋檐下筑起了温暖的小巢"
  },
  "options": [],
  "answer": { "type": "choice", "value": "__game_correct__" },
  "solution_steps": ["主语(小燕子) + 状语(在屋檐下) + 谓语(筑起了) + 定语(温暖的) + 宾语(小巢)。"],
  "feedback_correct": "句通气顺！语序对了。",
  "feedback_wrong": "想想：谁 + 在哪里 + 做了什么。",
  "tags": ["ai_generated", "sentence_shuffle", "语序"]
}
```

### game_data 规则（铁律）

- `tokens`：**按正确顺序**列出词块（前端会自己打乱给学生）。每个词块是一个有意义的词或短语（2-4 字最佳），**不要拆成单字**。词块数 3-8 个。
- `fullSentence`：把 tokens **原样顺序拼接**得到的句子（用于过关后展示）。**不要加入 tokens 里没有的标点/字**——否则展示句与拼出来的句子对不上。如果句子需要中间逗号（关联词句"虽然…，但是…"），就把「，」单独作为一个 token 放进 tokens 数组（让学生也排它），fullSentence 再含它；否则 tokens 与 fullSentence 都不要逗号。
- 三类常见题材：
  1. **造句**：主谓宾完整的陈述句（状语/定语归位）。
  2. **关联词**：因为…所以… / 虽然…但是… / 不但…而且… 等，词块含关联词。
  3. **古诗排序**：把一句诗拆成 2-4 字的节奏块（如 "两个/黄鹂/鸣/翠柳"）。
- ❌ 避免 tokens 里有重复词块（会导致判定歧义）。

### ❌ 禁止

- 把句子拆成单个汉字（要拆成词/短语块）
- tokens 顺序不是正确顺序（必须给正确序，前端负责打乱）
- 句子超过 8 个词块（4 年级认知负担）
- answer.type ≠ "choice"（固定 `__game_correct__`）
