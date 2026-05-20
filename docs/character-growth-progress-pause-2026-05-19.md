# Character Growth Roadmap — Phase B/C/D 已完成 (2026-05-21 更新)

**原暂停日期**: 2026-05-19 (Bruce pivot 到语文模块) — 已于 **2026-05-21 恢复并完成 B/C/D**。
**当前 ship version**: v0.36.61
**状态**: 角色成长线核心 (Hub v6 character-led lobby + 全 5 段 60 张立绘 + 升段仪式动画) 全部
ship + 真验证。唯一剩余 = Hub v6 设默认 (gated on Selena 多日试用, 见文末 task #22)。

> ⚠️ 下方 "🛑 暂停在哪里" 等章节是 2026-05-19 的历史规划, **已全部落地**; 当前真相见紧接的
> "## ✅ 恢复后完成 (2026-05-21)" 章节。Character Bible / assets 清单 / Bruce 决策表 仍是有效参考。

---

## ✅ 恢复后完成 (2026-05-21, v0.36.54 → v0.36.61)

| Phase | Version | 内容 | 验证 |
|---|---|---|---|
| **B** Hub v6 lobby | v0.36.x (step 3-5) | 角色立绘 centerpiece + 段位 chevron 头顶 + 3 环 halo + 任务栈 (红牌救援/期末BOSS/能力诊断) + 底部 stats bar + 🐼 sidekick + 主 CTA 开始今日挑战。`/math/hub-v6`, OFF-flag (`?hubv6=on` 预览)。 | preview 实跑各段渲染 ✅ |
| **C** 全 5 段立绘 | v0.36.54→58 | 6 archetype × 2 gender × 5 tier = **60 张** 预生成静态立绘 `base-<arch>-<gender>-<tier>-v1.png`。token-plan wan2.7-image-pro 生成 + CV 透明。`AVAILABLE_AVATAR_TIERS` 全接通; `characterAvatarUrl` walk-down resolver 恒命中本段。 | 全 60 张视觉 QA: 女银发/男黑发各自跨 tier 一致, outfit 逐段升级 (便装→斗篷→桂冠/王冠), 无畸形, 无需 reroll ✅ |
| **D** 升段仪式 | v0.36.55 | `CharacterTierUpModal` 4 段 framer-motion (旧立绘 fade→白光→新立绘→庆祝卡 "形象进化! 解锁 X")。HubScreenV6 load 时比 `rating.tier.id` vs db.meta `lastSeenTier`, 跨段前进弹窗 (advance-only, 首进静默, onClose 才推进 lastSeen)。 | preview 注入 attempts 实测: 首进静默✅ / 真跨段(school→district & school→country 多段跳)弹窗+正确立绘✅ / 关闭推进 lastSeen✅ / 重载不重弹(幂等)✅ |

**关键设计落点 (与原规划的差异)**:
- Phase C 原计划 "Lv2-5 中间立绘 per-student async gen"; 实际经双 peer review 改为 **per-(archetype×gender×tier) 预生成静态资产** (非 per-student) — 更可靠、零等待、无运行时 gen 成本。升段时无需 async gen。
- 立绘发色: prompt anchor 写 "black bob" 但 wan 风格把女生渲成银/白发、男生黑发; 跨 tier 各自一致, 已接受为 de-facto 风格 (非 bug)。

**唯一剩余 (task #22, ⚠️ 人工 gated)**: Hub v6 设默认。roadmap 明确 "Selena 用 ?hubv6=on 试几天 OK 后" 才把 `isHubV6Default` 接进 router HomeRoute, 默认 OFF 先 ship 再 flip。**别提前做** — 等爸爸/Selena 试用拍板。

**同期顺带完成的跨学科收尾** (非本 roadmap 但相关):
- 统一选题 Phase 4 (v0.36.59): 双 peer review 定 Option B, 抽 `core/rng.ts` (hashSeed/seededRng/shuffle) 跨学科共享; 全量 "选题 core+adapter" (Option C) peer review 明确**不做** (3 学科过度设计)。
- 语文 cover-fire 推广 (v0.36.60-61): C4 修辞 + C5 仿写 接缺题掩护生成 (此前仅 C1/C2/C3); 现 C1-C5 全接 (5/6)。C6 阅读暂缓 (passage 分组对 AI-gen 脆弱, 需先 cost-test, task #26)。

---

## ✅ 已完成 (5 phases, 7 iters)

| Phase | Iter | 内容 | 状态 |
|---|---|---|---|
| Infra | v0.35.85 | TierCharacter component + fallback + design doc | ✅ |
| Demo | v0.35.88 | Lv1 校园学者 + Lv5 国家英雄 (2 张样张 ship) + dev tier-switcher | ✅ |
| A part 1 | v0.35.89 | 12 张 Lv1 base (6 archetype × 2 gender) + CharacterGallery 评审页 | ✅ |
| A part 2 | v0.35.90 | 3-step onboarding modal + DB persistence + Hub 自动接通 | ✅ |

---

## 🎯 Bruce 拍板的事 (恢复时跳过讨论)

| 决策 | 选择 |
|---|---|
| Archetype 数量 | **6 个**: Scholar / Scientist / Explorer / Mage / Warrior / Artist |
| 性别选项 | **男 / 女** (不加 inclusive option) |
| 延迟 UX | **Blocking wait + 进度条 + 等待时跑 personalization 问题** |
| 命名策略 | **Bruce tier 命名保留 + outfit RPG 名 (hybrid)** |
| 角色身份 | **不需要跟小进一致**, 同学自选 archetype/gender |
| 接口路径 | **cn-beijing wan2.7-image-pro** (不是 intl ap-southeast!) |

---

## 🛑 暂停在哪里 — 下次恢复直接做

### Phase B (next, 最重要): Hub v6 character-led lobby 重做
Bruce 上次原话: **"主页 lobby 是不是要全部改啊? 更多应该参照之前发的这些 lobby 的图片来做"**

参考 3 张 ref:
1. PUBG/MOBA: 角色中央 stage + spotlight
2. Reddit 4-quadrant
3. **Fortnite (最匹配 kid app)**: 角色右侧 + costume=identity + 装备 slot

我之前 agent 分析: **Ring Fit Adventure** 是最 closest analog (Bruce 也在 ref 里给过)

实施方案 (我提的 Hub v6 草案):
```
顶 HUD: 🐼 Selena · Lv1 · XP   🔥 🎫 ⭐

左 mission stack (从上往下):       中右 STAGE (60% screen):
[任务卡] 开始今日挑战 ▶           ┌─ glowing platform ─┐
还差 N 题                         │                     │
                                  │  Selena 全身立绘     │
[红牌救援]                        │  (当前 archetype)    │
                                  │                     │
[期末 BOSS]                       │  头顶: 段位 chevron │
                                  │  身边: 浮动配件 token│
                                  │                     │
[能力诊断 mini]                   │  3 环 spinning aura │
                                  └─────────────────────┘

底部 stats bar:
段位 III · 和平街小学 · 准确78/熟练62/坚持0/广度50 · 综合 475/1000

底部 chips (横向 scroll):
闪电口算 · 错题营 · 模拟卷 · 技能图 · 工坊
```

关键改动 vs 现 v5.6:
- **Mascot 🐼+🦊 demote** 或整合到 platform 角色脚边 (sidekick, 不抢主角)
- **Selena 立绘居中右** (60% screen weight, full-body)
- **3 环作 aura** 围绕 platform (旋转 spinning), 不是 Apple Watch 同心 ring
- **Stats panel demote 底部 bar** — 左侧 mission stack 优先
- **段位 chevron 头顶** — Fortnite style 浮在角色头上

### Phase C: Lv2-Lv5 中间立绘 per-student async gen
- 升大段时 trigger async wan gen
- prompt template per (archetype × gender × tier)
- gen 完前 placeholder + fade-in animation

### Phase D: 升段仪式动画
- 旧立绘 fade → 白光爆开 → 新立绘 reveal
- 庆祝弹窗 "形象进化! 解锁 [outfit RPG 名]"

---

## 📦 已 ship assets (don't 重生)

### 12 base avatars (Lv1 学校段)
`public/character/base-<archetype>-<gender>-school-v1.png`:
- scholar-female, scholar-male
- scientist-female, scientist-male
- explorer-female, explorer-male
- mage-female, mage-male
- warrior-female, warrior-male
- artist-female, artist-male

### 2 张 demo (老 fallback)
- `public/character/tier-school-v1.png` (Lv1 校园学者, 旧 default)
- `public/character/tier-country-v1.png` (Lv5 国家英雄, 旧 demo)

### 代码
- `src/lib/characterChoice.ts` — types + helpers + ARCHETYPE_META + URL routing
- `src/components/TierCharacter.tsx` — portrait component
- `src/components/CharacterOnboardingModal.tsx` — 4-step modal
- `src/pages/HubScreenV5.tsx` — 集成 modal + 重选 button
- `src/pages/CharacterGallery.tsx` — 评审页 `/math/character-gallery`

### DB schema (db.meta key-value)
- `characterChoice::math::<studentId>` → `{ archetype, gender, chosenAt }`
- `characterPersonalization::math::<studentId>` → `{ answers, answeredAt }`

---

## 🧪 Character Bible (Wan prompt anchor, 后续复用)

**Female anchor**:
```
10-year-old cute Chinese girl, short black bob hair (chin-length, neat bangs across forehead),
large amber-brown eyes (bright and warm), gentle confident smile, round soft face,
slim youthful build, healthy fair skin
```

**Male anchor**:
```
10-year-old cute Chinese boy, short black hair (slightly tousled, neat bangs across forehead),
large bright amber-brown eyes, gentle confident smile, round soft face,
slim youthful build, healthy fair skin
```

**Fixed prefix** (每张 prompt):
```
Anime cel-shading style, masterpiece quality, vibrant clean line-art.
Half-body portrait centered, looking at viewer, dark navy background for
transparency cutout (NOT white/transparent, very dark solid navy like #0a0e2c).
```

**Negative** (每张):
```
multiple views, full body, ugly, deformed face, inconsistent proportions,
different hair color, blonde hair, blue eyes, brown hair, freckles, messy
background, text, signature, watermark, NSFW, mature features, teen idol,
aged-up, busty, anime sexualized, school uniform fetish, sailor uniform
```

**Outfit per archetype × tier** (✅ 全 5 段 60 张已生成 + ship, 2026-05-21; 下表是生成时的 outfit 设计参考):

| Archetype | Lv1 (done) | Lv2 (district) | Lv3 (city) | Lv4 (province) | Lv5 (country) |
|---|---|---|---|---|---|
| Scholar | 蓝开衫 + 笔记本 | 训练夹克 + 数学徽章 | 战术腰包 + 罗盘 | 半披风 + 金属边 | hero 套装 + 桂冠 + 星章 |
| Scientist | 白大褂 + 烧瓶 | 增强版烧瓶 + 测量仪 | 全套实验服 + 显微镜 | 科学家披风 | hero 实验袍 + 光环 |
| Explorer | 冒险背心 + 罗盘 | 帐篷器具 + 望远镜 | 完整探险队制服 | 队长袍 + 勋章 | 传奇探险家 + 金桂冠 |
| Mage | 巫师袍 + 魔杖 | 进阶魔法书 + 星杖 | 大法师袍 + 飞翔 | 学院掌门袍 | 大法师 + 星象冠 |
| Warrior | 道服 + 红头带 + 木剑 | 训练胴 + 进阶剑 | 武士套装 + 真剑 | 大师袍 + 长剑 | 传奇武士 + 头冠 |
| Artist | 围裙 + 调色板 + 笔 | 艺术家工作服 | 完整画室装 + 画架 | 大师围裙 + 金色调色板 | 传奇艺术家 + 桂冠 |

---

## ⚠️ 已知 caveats

1. **CV 抠图 tolerance**: 用 `lo/up = 5, 8 seed points` 是 sweet spot. scientist-male 那张需要 lo=12 (bg 色稍微不同, edge case).
2. **wan 偶发 429**: 12 并行有 2 张限流, retry 间隔 15s 通常 OK.
3. **Character consistency**: 12 张 base 整体好, 但 mage outfit 跟其他对比稍 "魔幻", artist 帽子稍跳 — Bruce 评后 reroll 个别可考虑.
4. **localStorage vs DB**: 现在用 `db.meta` 而不是 `students` row, future 应该真正 schema migrate (v9) 加 `characterArchetype` + `characterGender` 字段 (cleaner).

---

## 🔄 恢复 checklist

1. [ ] 翻 `docs/character-growth-design-2026-05.md` 当前 design doc
2. [ ] 翻这个 pause doc
3. [ ] 跑 `/math/hub-v5` + `/math/character-gallery` 看现状
4. [ ] 决定: Phase B Hub v6 重做先, 还是 Phase C Lv2-5 立绘先?
5. [ ] 跟 Bruce 确认 Hub v6 lobby 布局 mockup (要不要让我画 wireframe)?
6. [ ] 拍板后开始
