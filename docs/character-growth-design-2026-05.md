# Character Growth System — Design Doc

v0.35.85 (2026-05-19) — Phase 1 (MVP) ship 后写

## 起源
Bruce 提议: "段位徽章变成角色形象, 每次升级 → 形象变化". 3 张 ref:
1. PUBG/MOBA shooter lobby — 角色中央 + 装备 = 身份
2. Reddit lobby UI 4-quadrant
3. Ring Fit Adventure menu — **closest analog**

## Peer review 共识 (Gemini + GPT)
- **普罗透斯效应 (Proteus Effect)**: 对受挫儿童, avatar 是自我投射 + 力量代偿; tier 徽章是评价体系, 唤醒被评分恐惧
- **同一人物 + 不同 outfit + 配件 + 微姿态**; 不要不同年龄
- **Complement 不 Replace 全部**: tier badge 缩成头像角标
- **🐼+🦊 mascot demote** = sidekick/coach (still in ring), NOT main protagonist
- **Phase 切分**: 10 iter 做不完, MVP 先 1-2 张

## 角色选择决策
**用现成"小进"** (Selena's AI 数学老师, VRoid 短发款 邻家姐姐 蓝开衫红熊猫)

理由:
- 已 ship 在 Mascot3D atelier 沙箱 (4 skin)
- "拍板"过的 visual DNA
- avoid IP 混乱 (2D Selena + 3D 小进 + emoji panda 3 主角并存)
- 4 个 skin (default/graduation/wizard/legendary) 几乎 1-1 match 5 段位

## 5 段位 → 5 outfit 映射

| Tier | id | 现有 skin | 立绘 outfit |
|---|---|---|---|
| 学校 (Lv1) | school | default | 蓝开衫 + 白裙 + 短 bob + 小书包 + 铅笔 badge |
| 区 (Lv2) | district | (new) | 训练夹克 + 胸口数学徽章 + 平板 |
| 市 (Lv3) | city | wizard | 几何符号悬浮 + 战术腰包 + 数学罗盘 |
| 省 (Lv4) | province | graduation | 半披风 + champion jacket + 金属边饰 |
| 国 (Lv5) | country | legendary | hero 套装 + 月桂头饰 + 金色 aura |

## Wan 生成 Pipeline (Phase 2)

Wan endpoint (token-plan): `wan2.7-image-pro`
当前状态: ⚠️ quota exhausted (本 iter 写文档时), 需等恢复

### Character Bible Prompt (每张固定)
```
Anime cel-shading style, masterpiece quality, frontal half-body portrait,
looking at viewer, dark navy background (for transparency cutout).
10-year-old cute Chinese girl, short black bob hair, large amber eyes,
gentle confident smile, round soft face.
NO multiple views, NO full body, NO age drift, NO mature/teen features.
Same character across all 5 prompts (锁死 anchor traits).
```

### Per-tier Variable Prompt
Phase 1 (本 iter):
- **Lv1 学校段**: `wearing simple blue school cardigan over white shirt, small pencil pin on cardigan, holding a notebook, shy-but-eager expression, soft natural lighting.`

Phase 2 (后续):
- **Lv2 区段**: `wearing modern training jacket with math symbol patch, holding mini tablet with glowing equation, teal accent color, focused expression.`
- **Lv3 市段**: `wearing full geometry-trim training outfit, utility belt with math compass, glowing holographic equations floating around, confident posture.`
- **Lv4 省段**: `wearing champion jacket with half-cape, varsity-style with gold trim, holding trophy card, subtle blue energy aura behind, proud but humble.`
- **Lv5 国段**: `wearing hero outfit with luminous trim, laurel headband (not crown), star-shaped medal, subtle golden particle aura, hand on heart, warmest smile.`

### Negative Prompt (防崩坏)
```
multiple views, full body, ugly, deformed, inconsistent face, different hair color,
different eye color, messy background, text, signature, NSFW, mature features,
teen, anime sexualized, school uniform fetish.
```

### Tip: Same Seed
若 wan 支持 seed 参数, 5 张用同一 seed 强化一致性. 测试若不支持, 靠 Anchor Traits 词汇量收束.

## UI Integration (Phase 1, 本 iter ship)

### Component: `src/components/TierCharacter.tsx`
- Props: `{ tier, subRank, subRankRoman, size: 'sm'|'md'|'lg' }`
- Tries to load `/character/tier-<tierId>-v1.png`
- Fallback: 现有 emoji 圆 + "立绘 wip" label
- sub-rank ornament (✨💎🏅👑) 仍贴右下角

### Hub v5.4 Mission Panel
- emoji 圆 (96x96) → portrait rect (80x112)
- Layout: portrait left, label right (段位名 + sub-tier label + 进度 bar)

### Asset 上传 (quota 恢复后)
```bash
# 1. 跑 wan 生成 (用 scripts/regenerate-trophies.mjs 类似)
# 2. CV 抠图 → scripts/_make-trophy-transparent-v2.py
# 3. 上 public/character/tier-school-v1.png
# 4. 在 TierCharacter.tsx 的 AVAILABLE_AVATARS Set 加 "school"
# 5. push → CF auto-deploy
```

## Phase Roadmap
- ✅ **Phase 1** (v0.35.85, 本 iter): UI infrastructure + fallback emoji 圆 + design doc
- ⏳ **Phase 2a** (quota 恢复后 1 iter): Lv1 学校段 立绘 generate + 上传
- ⏳ **Phase 2b** (3 iter): Lv2-Lv5 立绘 generate + 一致性 review
- ⏳ **Phase 3**: 升级仪式动画 (白光爆开 + 立绘 swap)
- ⏳ **Phase 4** (Bruce 评后): Mascot 🐼+🦊 demote to sidekick (peer 共识但 Bruce 未拍板)

## 拒绝采纳的 peer 建议 (critical filter)
- ❌ Gemini "改段位名: 见习星航员 → 银河指挥官 etc" — Bruce 战略命名, 不动语义
- ❌ GPT "下一阶段 silhouette 预告" — Phase 3 再说, MVP 先单图
- ⚠️ Gemini "致命警告: 段位名触发 PTSD" — 给 Bruce 决断, 我先不动
