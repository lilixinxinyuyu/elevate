# 闯关 (Boss Battle) 系统

> Phase 2 Axis 3，v0.31.49 起步，v0.31.74-79 多次细调。

## 路由

- `/math/big-problems` — `BossWorld`：6 个单元 boss + 1 期末大魔王世界地图
- `/math/boss-battle/:unitId` — `BossBattle`：单个 boss 战

## 核心循环

1. **IntroScreen** — boss 头像 + 名字 + 标语 + "准备挑战"提示
2. **3 阶段战**（warmup / main / boss）：
   - 每阶段 2-3 道题
   - 答错 -1 心，**v0.31.74 后阶段切换不再 +1 心**（之前几乎不可能 game-over）
3. **PhaseBreakScreen** — 切换阶段时弹 1.5s 动画
4. **VictoryScreen / DefeatScreen** — 通关 / 失败结算

## 关键参数

| 参数 | 当前值 | 历史 |
|---|---|---|
| `MAX_HEARTS` | **2** (v0.31.74) | 之前 3 |
| 阶段切换补血 | 不补 (v0.31.74) | 之前 +1 心 |
| `noRetry` 模式 | **true** (v0.31.83) | 之前 false（有 silent retry → 双计 bug） |
| Defeat 条件 | `hearts === 0`（v0.31.83 简化） | 之前 `hearts === 0 && correct < 4`（漏判） |
| Stars 评分 | 见下表（v0.31.83 收紧） | 之前 4 星只看 correct === total |

### Stars 评分表（v0.31.83）

| 星 | 条件 |
|---|---|
| ⭐⭐⭐⭐ | **全对 + 满血**（heartsLeft ≥ 2） |
| ⭐⭐⭐ | 全对但掉过血 OR correct ≥ 6 |
| ⭐⭐ | correct ≥ 5 |
| ⭐ | correct ≥ 4 |
| Defeat | correct < 4 OR hearts === 0 |

## v0.31.83 修复历史（重要）

爸爸："Selena 三点血都没有了，最后一道题也回答错误，还是闯关完成了，给了四颗星。中间点重做就是一样的题，直接根据做错显示的正确答案填好就算对了。"

3 个 root cause：

### Bug 1: 每题双重 onAnswerLogged

老 GameShell 的 silent retry 路径：1st 错答静默入库 + RetryHintPanel 提示重做。BossBattle's `onSubmit` 每次调用 `onAnswerLogged` → 1st wrong + 2nd attempt 都触发 → results 数组每题 2 entry → correct 计数虚高。9 题 1st 全错 + 2nd retry 全对 → results 看起来 9 个 correct → 4 stars。

**Fix**：GameShell 加 `noRetry` prop，BossBattle 传 `noRetry={true}`。boss 模式下 1st 错答即定终局。

### Bug 2: defeat 条件漏判

```ts
// BUGGY (老):
if (hearts === 0 && correct < 4) → defeat
// 反例：hearts=0 但 retry 蒙对了 4 题 → correct=4 → 不 defeat → 上 stars 流程
```

**Fix**: `if (hearts === 0)` → defeat 不管 correct 多少。

### Bug 3: 4 星条件只看 correct === total

老逻辑：correct === total → 4 星。配合 Bug 1 双计，全对很容易达到 → 4 星骗局。

**Fix**: `starsFromAccuracy(correct, total, heartsLeft)` 多收一个 heartsLeft 参数；4 星要求 `correct === total && heartsLeft >= 2`（满血）。掉过血但全对 = 3 星。

## Hint 流程（v0.31.74 重做）

之前：求小进 → 看提示 → 没下文。现在：

```
点 "📞 求小进" chip
   ↓
modal: 看提示 / 让小进讲题 / 跳过本题
   ↓
   ┌─────────────────────┬──────────────────┐
   ↓                     ↓                  ↓
看提示                 让小进讲题          跳过
(autoRevealHint++)     (open TutorPanel)   (-1 救场)
                                            (跳下一题)
   ↓
答错 + 用过 hint
   ↓
自动渲染 escalate CTA: "继续不会？让小进讲题"（不消耗救场名额！）
   ↓
点击 → 同样 open TutorPanel
```

修复点：
- `onUseLifeline("explain")` 实际打开 TutorPanel（之前只是又开 hint）
- **省级专属限制移除** — 所有段位都能让小进讲题
- 答错且 hintUsed → 自动给 escalate CTA（不消耗救场名额）
- 进下一题 / 阶段切换都清掉 escalate CTA

## Boss 视觉

### Avatar 来源

`<BossAvatar unitId={...} state={"normal"|"enraged"} />`：

```ts
// 优先级（state="enraged"）
math_boss_<unitId>_enraged   // 专属狂怒态变体（如有）
  ↓ fallback
math_boss_<unitId>           // 普通图 + CSS hue-rotate (-30deg) + saturate 红化
  ↓ fallback
emoji
```

### 透明背景（v0.31.79-81）

- 怪物原图由 `_generate-boss-images.mjs` 生成（"clean white background"）
- `_make-boss-transparent.py` (Python OpenCV) flood-fill from 4 corners 移除白底
- 同时生成 `_enraged` 变体（HSV shift + 红色 overlay）
- 输出 384×384 RGBA PNG（typical 140-260KB）

**反复被覆盖的 bug + 修复**（v0.31.79-81）：
- v0.29.7 `migrateCompressOversizedTrophyImages` 把 >200KB 的 trophy_images 重压成 JPEG 黑底
- Selena's PWA pull 我的 PNG → migrate 触发 → 重压成黑底 JPEG → 下次 push 写回 D1
- **修 1**：服务端 trophy-images 加双重守门：keep-newer-by-generatedAt + **PNG > JPEG**（拒绝 JPEG 覆盖 PNG）
- **修 2**：客户端 migration 跳过 PNG（< 500KB 的 PNG 不再被 JPEG 重压）

### Enraged state 触发

`enraged = phaseFromIndex(index) === "boss"` — 第三阶段（最后 boss 战）自动进入狂怒态。
BossPanel 加 `animate-pulse-soft` 框 + `animate-shake` 头像晃 + 红色"🔥 狂怒态"chip。

## 文件索引

```
src/pages/BossBattle.tsx           # 路由 + Stage 状态机
src/pages/BossWorld.tsx            # boss 地图
src/components/boss/BossAvatar.tsx # 头像（state-aware）
src/components/boss/BossPanel.tsx  # boss + HP + 狂怒指示
src/components/boss/HeartsBar.tsx  # 心数
src/components/boss/PhaseIndicator.tsx
src/components/boss/LifelineButton.tsx  # 求小进 modal
src/components/boss/VictoryScreen.tsx
src/components/boss/DefeatScreen.tsx
src/lib/bossBattleState.ts         # rescue allowance / boss state persist
src/core/bossPersonas.ts           # 7 boss 角色定义
scripts/_generate-boss-images.mjs  # AI 出原图
scripts/_make-boss-transparent.py  # OpenCV 透明 + 狂怒变体
```

## 当前 7 个 boss

| Unit | Boss | 主题 |
|---|---|---|
| G4B_U1_DECIMAL_ADD_SUB | 小数浪潮怪 | 海浪 + 小数点 |
| G4B_U2_TRI_QUAD | 三角魔兽 | 三角形 + 罗盘 |
| G4B_U3_DECIMAL_MULTIPLY | 倍数巨人 | 巨人 + × 符号 |
| G4B_U4_OBSERVE_OBJECTS | 视角恶魔 | 三眼 + 立方体 |
| G4B_U5_EQUATIONS | 平衡魔王 | 天平 + x = ? |
| G4B_U6_DATA | 统计巨怪 | 柱状图 + 饼图 |
| FINAL | 数学大魔王 | 王冠 + 整合 |

每个有 normal + `_enraged` 两种 PNG 变体存 D1 `trophy_images` 表。

## v0.31.91+ Playground / 试玩模式

`/math/playground`（`src/pages/Playground.tsx`）—— admin / 调试用的 game-template 试玩入口。

- 列出所有 game template（plain_choice / speed_match / shop_counter / dot_grid_draw / discount_drift / coin_combo / time_heist / number_hunt 等 15 种）
- 每种点一下能跑一道 demo 题，验证模板渲染 + onFinish 逻辑
- 不计 XP、不计 mastery、不计 attempts —— 纯调试通道
- 入口在桌面 admin 面板，移动端 nav 不显示

`router.tsx::PlaygroundRoute` 没有 Phase2 gate，但只在 admin 链接里出现。

## v0.31.96+ Trophy 视觉对齐

Boss 拿到的"闯关印章"（11 枚 boss_*_master 系列）走老款 trophy 视觉（V 字盾 clip-path + 战斗橙色调），**没有**走 v0.31.96 的 CSS 银环统一管道——因为 boss 不是徽章语义。详 `trophy-image-pipeline.md` + `src/components/TrophyIcon.tsx::NEUTRAL_RING` 排除 `category === "boss"` 的判断。

## v0.31.101 Mastery fragility 软 cap（间接影响 boss 解锁）

Boss 解锁条件是 unit 平均 mastery ≥ 75。v0.31.101 把 fragility cap 从硬 45 改成跟 elo 挂钩的软 cap (elo 1500→cap 60 / 1700→cap 70)，所以即使最近 5 题挂了 3+，已经积累的 elo 高的 skill 不会一下回到 45（避免 boss 反复锁回）。详 `scoring-and-progression.md` + `src/core/mastery.ts::fragileCapByElo`。
