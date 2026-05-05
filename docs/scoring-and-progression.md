# 评分 / 段位 / 熟练度 / 反刷分 体系

> 写给未来的 Claude 看：每次想"鼓励多做一点"就反过来鼓励了刷分——这个 doc
> 记录所有现行的 anti-farm 机制 + 设计原则，**不要打破**。

## 三层数据：XP / Tier / Mastery

```
┌──────────────────────────────────────────────────────────────┐
│  XP（经验值）                                                 │
│  ── 每次答题积累，跨学期累加，永远涨                            │
│  ── 决定段位（school → district → city → ... → country）        │
│  ── core/scoring.ts scoreAttempt() 算一次答题加多少           │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Tier 段位 + Sub-rank（IV/III/II/I）                          │
│  ── 5 段：和平校徽 / 锦江徽章 / 蓉城勋章 / 天府之星 / 中华小数神   │
│  ── 每段内 4 个 sub-rank（IV → I 越升越高）                     │
│  ── 阈值在 core/tiers.ts                                      │
│  ── 段位激发关键动机：Hero "再得 X XP 升 锦江区"               │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Mastery（每 skill 0-100 分）                                 │
│  ── Elo 评分 + 滚动窗口 + Fragility 衰减                        │
│  ── core/mastery.ts updateMasteryEloOnly() / fromAttempts()  │
│  ── 决定单元解锁 / 闯关 gate / 自由练推荐                       │
│  ── 学期独立：上下册分别算（学期切换不会影响对方）              │
└──────────────────────────────────────────────────────────────┘
```

## XP 评分 — `core/scoring.ts`

### 基础公式
```
raw_xp = baseDifficulty × correctness
       + speedBonus      (≥80% 时间内对：+1-2 XP)
       - hintsPenalty    (开 hint：每个 -1)
       + comboBonus      (3/5/10 连：+1/+2/+4)
       + freshSkillBonus (+5 XP 第一次碰这个 skill)
```

### 三层衰减叠乘
1. **comboMul**：错题就重置；连击时按级别加成
2. **repeatDecay** (核心反"刷同题")：同 question_id 已答对 N 次：
   - 0 次：100%
   - 1 次：50%
   - 2 次：20%
   - 3 次：10%
   - ≥ 4 次：0%
3. **siblingDecay** (v0.30.12 反"刷姊妹题"，核心反 farm)：
   同 skill 历史已答对题数：
   - 0-7 道：100%（鼓励起步）
   - 8-14 道：70%
   - 15-22 道：40%
   - ≥ 23 道：20%（永远 0.2，留少量鼓励）

最终：`final = raw × comboMul × repeatDecay × siblingDecay`

### Tutor-assisted 半信半疑
开"小进讲题"才答对：所有 XP 奖励 × **0.5**（v0.30.9 调，从 0.7 调严）。
原因：宁可分严，错题以后重做还能拿全 XP。

## Tier 段位 — `core/tiers.ts`

5 段地理升级体系（校园探险世界观）：

| Tier | 名称 | XP 阈值 |
|---|---|---|
| school | 和平校徽 | 0+ |
| district | 锦江徽章 | 10,000 |
| city | 蓉城勋章 | 22,000 |
| province | 天府之星 | 32,000 |
| country | 中华小数神 | 40,000 |

每段内 4 个 sub-rank（**IV → I**），均分该段位区间。
比如 锦江 IV/III/II/I = 10000-13000-16000-19000-22000。

### Hero 显示（v0.31.4）
- XP < 200 距下一段 → 金色 chip "🔥 仅剩 60 XP 升 🏛️ 锦江区" + soft pulse
- 进度条 = 当前 sub-rank 内进度
- 段位徽章 right side = 当前段位 AI 图

## Mastery + Elo + Fragility — `core/mastery.ts`

### 核心思想
传统平均分太粗。我们用 chess Elo 给每 skill 算分：
- 学生 Elo 高 = "对这个 skill 真懂"
- 题目 Elo 通过 difficulty 推导
- 答对 → 学生 Elo 涨；答错 → 降
- score 0-100 = `100 × (Elo / max_elo)` 映射

### 滚动窗口（recent）
近 8 次结果记 array → 用于：
- 显示"最近正确率"
- 计算 Fragility（连错衰减）

### Fragility（脆弱度）
连续答错 → mastery 不光 Elo 降，还要额外打折：
- 连错 1 → ×0.95
- 连错 2 → ×0.85
- 连错 3+ → ×0.70

防止"老分高 + 现在连错好几次 → 假象掌握"。

### Anti-farm Hard Cap (v0.30.12)
**学生 Elo > 题目 Elo + 300 + 答对** → 强行不涨 Elo。
原因：低难度题被高 Elo 学生答对，本应不涨（Elo 差距太大期望命中接近 1），
但代码之前还允许 +4-7 慢爬。300 分硬截断关掉这个 leak。

## 能力诊断（8 维评级）— `core/rating.ts`

8 维能力：concept / calculation / reasoning / spatial / modeling / data / strategy / habit

每维 0-1000 分：
- accuracy 7 天准确率
- mastery 加权
- continuity 连续天数
- breadth 覆盖广度（v0.30.12 重写）

### Anti-farm Breadth (v0.30.12)
旧公式：`log(totalAttempts) × 60 - 50` → Selena 刷 100 题就 log 撑满 87%。
新公式：`sum across skills of min(5, uniqueCorrectInSkill)` 封顶 150：
- 1 skill 答对 100 道 → 只算 5 分
- 30 skill 各对 5 道 → 满分 150

**鼓励横向广度，不是纵向刷量**。

## Term（学期）独立

上下册分开算 XP / 段位 / mastery：
- meta key 命名空间：`totalXp::math::studentId::G4B`
- Selena 切学期 → 主页 XP 大数 + 段位徽章重新算
- 跨学期答题不会污染对方
- 段位徽章是**当前学期**的；佩戴中可以是历史段位（让她戴喜欢的）

## Anti-Farm 三层护栏（v0.30.12）

**最重要的一节** —— 加新激励/勋章/模式时不准破坏：

### 层 1：XP siblingDecay
**位置**：`core/scoring.ts` `siblingDecayMultiplier()`
**作用**：1 skill 100 道也只 ~50 XP，不能靠刷"同 skill 不同 question_id"
往上堆 XP。
**记号**：写 anti-farm 测试 `tests/scoring.test.ts`。

### 层 2：Mastery Elo Hard Cap
**位置**：`core/mastery.ts` `updateStudentElo()`
**作用**：低难度题答对不让高 Elo 学生再涨。
**记号**：`tests/eloHardCap.test.ts`。

### 层 3：能力诊断 Breadth
**位置**：`core/rating.ts` `computeAbilityDiagnostic()` volume component
**作用**：能力分按 skill 多样性算，不按 attempt 量。
**记号**：`tests/rating.test.ts` "volume = skill coverage v0.30.12" describe。

## 加新激励/勋章的设计 checklist

在加任何 "做更多 → 得更多" 机制前，自问：

1. **能不能被刷？**（同 skill 同难度反复做能不能拿同样的奖）
   → 如果能，加 sibling decay / unique check
2. **奖励"做"还是奖励"学到"？**
   → 永远奖励"学到"。tutor_companion 勋章是好例子（问 + 之后真进步才计）
3. **跟 anti-farm 三层有没有冲突？**
   → 如果给"刷同 skill 多次"额外奖励，等于打破 siblingDecay
4. **学期重置后会不会被复刷？**
   → 注意累计指标设计（终身累计 vs 学期累计）

## 历史变更教训

| 版本 | 教训 |
|---|---|
| v0.30.7 | tutor 答对 Elo 走 0.5 半信半疑（防"问完才对"刷 mastery） |
| v0.30.9 | tutor XP factor 0.7 → 0.5（用户反馈宁严勿松） |
| v0.30.12 | 反 farm 三层：sibling XP / Elo cap / breadth 重写 |
| v0.31.8 | tutor_companion 勋章奖励"问完真进步"，不奖励"问得多" |

## 相关文件速查

| 文件 | 作用 |
|---|---|
| `core/scoring.ts` | XP 计算，siblingDecay / repeatDecay / comboMul |
| `core/mastery.ts` | Elo + Fragility + Hard Cap |
| `core/rating.ts` | 段位推导 + 能力 8 维 + breadth |
| `core/tiers.ts` | 段位阈值 + sub-rank 配色 |
| `core/trophies.ts` | 勋章 def + 颁发逻辑 |
| `tests/scoring.test.ts` | XP 衰减测试 |
| `tests/eloHardCap.test.ts` | Elo cap 测试 |
| `tests/rating.test.ts` | breadth + 段位测试 |
