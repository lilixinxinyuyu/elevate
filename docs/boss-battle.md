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
| Defeat 条件 | hearts == 0 && correct < 4 | 不变 |
| Stars 评分 | 1-4 颗，全对 + 用提示 = 4 ⭐ | 不变 |

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
