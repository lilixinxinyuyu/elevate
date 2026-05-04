# Phase 2 — 特殊纪念勋章 (Commemorative Trophy) 待办清单

> 期中后 / 暑期实施。每个都走"顶级事件"盲盒生成流程（commemorative 类，
> heirloom medallion AI prompt）。

## 当前已实现的盲盒触发（v0.29.2）

按事件价值分级（见 [`src/pages/Train.tsx`](../src/pages/Train.tsx) lotteryQueue）：

| 事件 | 弹盲盒 | 模式 | 备注 |
|---|---|---|---|
| 跨大段升档（school→district 等）| ✅ | generate | 每段位独家 badge 图 |
| commemorative 首次解锁（第一步等）| ✅ | generate | 每枚独家图 |
| daily trophy 首次解锁（count=1）| ✅ | generate | 每枚独家图 |
| tiered 升钻（platinum）| ✅ | reveal-only | 多 tier 共用图，弹庆祝 |
| tiered 升金（gold）| ❌ | — | 仅在新奖杯卡片高亮 |
| tiered 升铜/银 | ❌ | — | 静默，角标更新 |
| daily 累计（count > 1）| ❌ | — | 静默 |

---

## 📅 Phase 2 待加触发器（10 类）

### 1. `subrank_up` — 段位星升

- **触发**：rating 计算后发现 `subRank` 增加（★ I → II → III → IV）
- **实施位**：`src/db/service.ts` finalizeSession，对比 `prevSubRank` vs `rating.subRank`
- **trophy meta**：每次升小段都颁发一枚（不像 tier badge 那样一段位一枚）
- **prompt 主题**：星辰 + 上升箭头 + 段位主色
- **场景**：Selena 在锦江★II → 锦江★III 时 → 弹"星升"勋章
- **frequency**：4 个月学期内可能 6-12 次（每段 4 小段，跨段时也会从 ★IV 进下一段 ★I）

### 2. `midterm_done` — 期中加冕

- **触发**：检测到当前日期 = 期中考结束日 + 1 天 ~ +7 天，且当天 Selena 第一次进 app
- **实施位**：新增 `src/lib/seasonalEvents.ts` + `examDates.ts` 已存在期中日期表
- **trophy meta**：每学期一次（用 meta.semester 防重发）
- **prompt 主题**：月桂枝 + 书卷 + 锦旗 + 金色光环
- **frequency**：每学期 1 次

### 3. `final_done` — 期末凯旋

- **触发**：期末考结束后第一次进 app
- 类似 midterm_done，但更隆重（"凯旋"语气）
- **prompt 主题**：王冠 + 奖杯 + 金色锦旗
- **frequency**：每学期 1 次

### 4. `new_semester` — 新学年起航

- **触发**：检测到学期切换（上册→下册 / 下册→新学年上册），第一次进 app
- **实施位**：新增 `src/lib/seasonalEvents.ts`，对比 `student.currentTerm` vs 上次记录
- **trophy meta**：每个学期开学时一枚
- **prompt 主题**：扬帆出海 + 朝阳 + 新书 + 蓝绿主色
- **frequency**：每学期 1 次

### 5. `birthday` — 生日快乐

- **触发**：Selena 生日当天进 app
- **实施位**：`StudentProfile` 加 `birthday: string` 字段；启动检测 today === birthday
- **trophy meta**：一年一枚（meta.year 防重）
- **prompt 主题**：生日蛋糕 + 蜡烛 + 彩带 + 粉紫主色
- **frequency**：每年 1 次

### 6. `pre_exam_streak` — 考前冲刺

- **触发**：期中/期末考前 7 天内连续打卡满 5 天
- **实施位**：seasonalEvents.ts 检测窗口
- **trophy meta**：每学期最多 2 次（期中前 + 期末前）
- **prompt 主题**：火焰 + 倒计时沙漏 + 红橙主色
- **frequency**：每学期最多 2 次

### 7. `perfect_revival_week` — 完美复活

- **触发**：连续 7 天，每天的错题复活率 = 100%（错过的题都复活了）
- **实施位**：trophies.ts 加新 commemorative 定义，check 逻辑扫 mistakes + attempts
- **trophy meta**：可重得（每完成一次新颁一枚？或每学期最多 1 次？）—— 待定
- **prompt 主题**：凤凰浴火 / 涅槃 + 金色羽毛 + 紫红主色
- **frequency**：可能多次（设上限 / 学期）

### 8. `all_ability_gold` — 通才大师（隐藏钻石级）

- **触发**：8 维 ability 勋章全部达到 gold tier
- **实施位**：trophies.ts，check 逻辑统计 ability 类 trophy 的 gold 数量
- **trophy meta**：每学期最多 1 次
- **prompt 主题**：八芒星 + 王冠 + 七彩光晕 + 钻石主色
- **frequency**：本学期最高荣誉，可能整学期 0 次

### 9. `season_special` — 季节限定

- **触发**：特定日期窗口（春节 / 元旦 / 教师节 / 儿童节 等）
- **实施位**：seasonalEvents.ts 节气表
- **trophy meta**：每年每节日 1 枚
- **prompt 主题**：节日特定（春节红包 + 金色福字 / 教师节书本 + 黑板 + 烛台 等）
- **frequency**：每节日 1 次

### 10. `centurion` — 百题英雄

- **触发**：单日累计答题 ≥ 100 道
- **实施位**：trophies.ts，按 todayDateKey 过滤 attempts
- **trophy meta**：可重得（每达成一次颁一枚）
- **prompt 主题**：勇士 + 100 个星芒 + 紫橙主色
- **frequency**：罕见，估计学期 0-3 次

---

## 实施工作量预估

| 项 | 实施量 |
|---|---|
| 加 10 个 trophy def | 半小时 |
| 学期切换检测 | 1 小时 |
| examDates 期中/期末窗口检测 | 半小时 |
| 生日字段 + 检测 | 半小时 |
| 错题复活率统计 | 1 小时 |
| 节气表（season_special）| 1 小时 |
| 测试覆盖 | 1 小时 |
| **总计** | **~5-6 小时** |

---

## 优先级建议

如果暑期时间有限，按 ROI 排序：

🔥 **先做（情感价值最高）**：
1. subrank_up — 你提到她记得有，是误以为 milestone 是 subrank → 真正实现一个
2. new_semester — 学期重置时给个仪式感入口
3. midterm_done / final_done — 配合考试节奏

⭐ **其次（趣味性）**：
4. birthday — 简单实现，每年仪式感
5. all_ability_gold — 钻石级隐藏，激励长期目标

🌳 **可选（精装修）**：
6-10. 其他

---

## 设计参考

- 所有 commemorative 都走 `buildCommemorativePrompt()` —— "传家宝级别 heirloom medallion"
  风格，比 daily/milestone 更精致
- 形状统一六角星
- AI 自由配色（与主题相关），不锁 tier 色
- 弹 LotteryBoxModal mode="generate"（首次解锁，生成独家图）
