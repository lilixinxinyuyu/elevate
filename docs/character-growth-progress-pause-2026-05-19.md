# Character Growth Roadmap — 暂停存档

**暂停日期**: 2026-05-19
**暂停原因**: Bruce pivot 到中文模块开启 (语文拼音 + 词组)
**最后 ship version**: v0.35.90

恢复时直接接 Phase B (Hub v6 character-led lobby 重做).

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

**Outfit per archetype × tier** (Lv1 done, Lv2-5 待生):

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
