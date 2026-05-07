## 答题格式：geometry_operation（几何操作）

**特点**：在画布 / 点子图上画图、连线、标注角度。前端用 dot_grid_draw 模板。

### 适用场景
- 三角形 / 四边形构造（按要求画图）
- 标三角形分类（看图判断 + 在点子图上画对应图形）
- 量角器读角度（更进阶）

### 必填字段
```json
{
  "question_format": "geometry_operation",
  "play_as": "dot_grid_draw",
  "answer": {
    "type": "choice",
    "value": "isosceles_right_triangle"
  },
  "dot_grid": {
    "gridWidth": 6,
    "gridHeight": 6,
    "expectedShape": "isosceles_right_triangle",
    "minVertices": 3,
    "maxVertices": 3
  }
}
```

### 设计要求

#### 1. 题目要求明确
- ✅ "在点子图上画一个等腰直角三角形"
- ✅ "用 4 个格点画一个长方形（不是正方形）"
- ❌ "画个图" / "在格子里画一画"

#### 2. expectedShape 必须是合法值
合法的：
- `parallelogram` — 平行四边形
- `rectangle` — 长方形
- `square` — 正方形
- `trapezoid` — 梯形
- `isosceles_triangle` — 等腰三角形
- `equilateral_triangle` — 等边三角形（点子图很难精确画，慎用）
- `right_triangle` — 直角三角形
- `isosceles_right_triangle` — 等腰直角三角形

#### 3. 网格尺寸
- 通常 5×5 到 7×7
- 太小（≤4×4）画图自由度太低；太大（≥8×8）孩子找不准点

#### 4. 顶点数
- 三角形：minVertices: 3, maxVertices: 3
- 四边形：minVertices: 4, maxVertices: 4

#### 5. 应该判定的属性
判分逻辑（前端 DotGridDraw.tsx）：
- 边长（用网格距离）
- 内角（向量点积判直角；正负判等长）
- 顶点数

### 解答提示（hints）写法
- ✅ "先选一个直角顶点（90° 角），再向两个方向选距离相等的格点"
- ✅ "正方形需要 4 条相同长度的边 + 4 个直角"
- ❌ "你画对就行" / "想想看"

### 时间（estimated_time_seconds）
- 简单图形（直角三角形 / 长方形）：50s
- 中等（等腰三角形 / 梯形）：60s
- 复杂（特殊位置约束）：80s

### ⛔ 禁止
- expectedShape 不在合法清单
- 网格太小让题不可解
- 不可能存在的图形（如格点上画正三角形—除非允许斜边）
- 题干没说目标形状
