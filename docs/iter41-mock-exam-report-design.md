# Iter 41 P2-2 模拟整卷成绩分析 设计稿 (送预审)

> Selena 43% master plan P2-2. 现有 mock_exam infra 已 ship (Home 入口 + 一周一次 throttle + scheduler 处理). 这个 iter 主要 add 三件:
> 1. **完成后专属"成绩分析"页** (借鉴真实期末试卷分析格式)
> 2. **题数标准化** (30 题, 模拟一份完整试卷的体量)
> 3. **基于 attempt.metadata 的错题分析** — 用 iter 32-39 累积的诊断数据

## 目标

让 Selena 做完模拟整卷后, 看到的不是普通"做完了下一题"反馈, 而是模拟真实期末考试的:
- 总分 (例 22/30 = 73%)
- 各 skill 表现 (口算/应用题/单位换算/几何)
- 错因诊断 (估算没做对/没用草稿/单步跳到答案/等)
- 推荐下一步 (去 X 进制小课堂 / 去 Y 强化挑战)

这是 Selena 43% 事件后, 让她**自己看见进步轨迹** 的关键闭环.

## 不动的部分

已有不改:
- `mode=mock_exam` session 创建 (`getOrCreateSession`)
- `recordMockExamCompleted` 周节流
- mock_exam 题目不进 mistake queue (`!isCorrect && session.mode !== "mock_exam"`)
- Home 入口 "📝 考试模拟"

## 新增

### 1. 30 题标准化
- Scheduler 在 mode=mock_exam 时强制取 30 题 (现在可能由其他参数决定)
- 题型采样比例 (跟期末实际比例对齐, 暂凭经验估):
  - 口算 (单步速算): 10 题 (33%)
  - 多位计算: 8 题 (27%)
  - 应用题: 6 题 (20%)
  - 单位换算: 3 题 (10%)
  - 几何/图形: 3 题 (10%)

### 2. 成绩分析页面 (新)
路由 `/math/mock-report?sessionId=xxx` (从 mock_exam 完成 navigate 过来)

读取 session.id 对应 attempts, 算出:

```
📝 模拟整卷成绩分析

成绩: 22 / 30 = 73%  (比上次 ↑8%)

各题型表现:
- 🧮 口算         8/10  ████████░░ 80%
- ✏️  多位计算    5/8   ██████░░░░ 62%
- 📝 应用题       4/6   ██████▌░░░ 67%
- 📐 单位换算     2/3   ███████░░░ 67%
- 📊 几何         3/3   ██████████ 100%

错题诊断:
- ⚠️ 2 题"估算没用到" → 去 🧠 估算训练
- ⚠️ 1 题"没列算式跳直接答" → 去 📋 应用题 4 步法
- ⚠️ 1 题"单位混了" → 去 📐 进制小课堂

推荐下一步:
1. 进制小课堂 第 2 节 60 进制 (你单位错了 1 题)
2. 应用题 4 步法 强化 (你跳步 1 题)
3. 多位计算专项练 30 题

[ 再做一次模拟卷 ]  [ 返回主页 ]
```

### 3. 错题诊断逻辑
从 attempt.metadata 解析:
- estimationGate.magnitudeMismatch=true → "估算没用到"
- scratch.tool="direct_bypass" → "没用草稿心算错"
- multiStep.phasePass[2]=false → "算式列错"
- multiStep.phasePass[3]=false but [2]=true → "答没写好 (单位/数)"

## 实现

### 新文件
- `src/core/mockExamReport.ts`: 数据聚合 (输入 attempts, 输出 ReportSummary)
- `src/pages/MockExamReport.tsx`: 页面
- `tests/mockExamReport.test.ts`

### 修改
- `src/db/service.ts`: mock_exam mode 强制 30 题 (改 getOrCreateSession 题数逻辑)
- `src/pages/Train.tsx`: mock_exam session 完成时 navigate('/math/mock-report?sessionId=xxx')
- `src/router.tsx`: 加 `/math/mock-report` 路由
- `src/lib/featureFlags.ts`: isMockExamReportV1

## 设计决策需要预审验证

1. **30 题是否合适**? 老师真考期末 ≈ 25-35 题, 取中.
2. **60 分钟**: 不强制限时? 还是软限时 (banner 倒计时不强退)?
3. **题型采样比例** (10/8/6/3/3): 跟期中真实比例对齐吗?
4. **错题诊断阈值**: 0 题没用估算 vs ≥ 1 题就提示? 触发太敏感?
5. **推荐"去 X 课堂"**: link 直接 navigate? 还是 list 给爸爸看?
6. **缺什么 corner case** (例如 mock_exam 中途退出, 报告还显示吗)?
7. **整体: 立即做 / 改后再做 / 不做**?
