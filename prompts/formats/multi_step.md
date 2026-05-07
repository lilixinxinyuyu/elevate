## 答题格式：multi_step（多阶段应用题）

**特点**：把应用题拆成 2-3 个 sub-question 让孩子分阶段答（先挑已知 → 再列关系 → 再算结果）。前端用 shop_counter 模板。

### 必填字段
```json
{
  "question_format": "multi_step",
  "subquestions": [
    {
      "kind": "clue_pick",
      "prompt": "下面哪些是解题需要的已知信息？",
      "clues": ["篮球 8 个", "足球 6 个", "篮球 45.5 元/个", "足球 38 元/个", "学校在城东"],
      "correct": [0, 1, 2, 3],
      "mode": "pick_correct"
    },
    {
      "kind": "choose",
      "prompt": "选出正确的数量关系：",
      "options": [
        { "id": "A", "text": "总价 = 篮球单价 × 篮球数量 + 足球单价 × 足球数量", "correct": true },
        { "id": "B", "text": "总价 = (篮球数量 + 足球数量) × 平均单价", "correct": false }
      ],
      "multi": false
    },
    {
      "kind": "numeric",
      "prompt": "一共多少元？",
      "value": 592.0,
      "unit": "元",
      "distractors": [580.5, 600.0, 564.0]
    }
  ],
  "answer": {
    "type": "multi_step",
    "steps": [
      { "step_id": "clue", "expected": "0,1,2,3" },
      { "step_id": "relationship", "expected": "总价 = 篮球单价 × 篮球数量 + 足球单价 × 足球数量" },
      { "step_id": "answer", "expected": 592.0, "kind": "answer" }
    ]
  }
}
```

### 设计要求

#### 1. **3 步必须形成完整推理链**
- step 1（clue_pick）→ 让孩子识别"哪些信息有用"
- step 2（choose）→ 让孩子选"怎么列式"
- step 3（numeric）→ 让孩子算"具体多少"
- 不能跳步，每步独立可答

#### 2. **逻辑一致性（最容易翻车的地方）**
- step 1 选出的 clues **必须** 在 step 2 的关系式里都用到
- step 2 选的关系式 **必须** 算出 step 3 的 answer
- 三步任何一处对不上立刻判 wrong_answer

#### 3. **clues 字段**
- 5-6 条候选，包含 1-2 条"无关信息"（"学校在城东"、"今天周三"）
- correct 数组写正确 clue 的索引（不是 id）
- mode："pick_correct" / "pick_wrong"（极少用 pick_wrong）

#### 4. **choose 字段**
- 2-4 个候选关系式，恰好 1 个 correct: true
- 错误选项必须是 **常见错误模型**（如 "总价 = 单价 + 数量"、"总价 = (a+b) × 平均")
- 不要让 4 个公式长度差很多

#### 5. **numeric 字段**
- value 必须等于 step 2 关系式按 step 1 数字计算的结果
- distractors 是 3 个常见错误数字（漏一项 / 算错单位 / 算错小数位）

### ⛔ 禁止
- 不要 1 步（那是 numeric / single_choice 的活）
- 不要 4 步以上（4 年级注意力撑不住）
- step 2 关系式不能含 5 年级才学的概念（百分数 / 体积）
