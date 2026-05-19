# 中文模块现状分析 + 期中考试卷题型 + 设计建议

**日期**: 2026-05-19
**触发**: Bruce 暂停 character growth, pivot 到 chinese 模块开启 + 看 /scans 期中卷设计游戏

---

## ✅ 现状: Chinese 模块已经是 production-grade

跑通 [https://xiaojin.app/chinese](https://xiaojin.app/chinese) 看到 hub 完整运行 — 不是 placeholder, 是真功能.

### 已有代码资产 (src/subjects/chinese/)
| 文件 | 行数 | 内容 |
|---|---|---|
| charLibrary.ts | 3525 | 大量汉字 + 拼音 + 部首 索引 |
| questions.ts | 1312 | 第 1-4 单元主题包 (字音 / 字形 / 古诗 / 词语 / 修辞) |
| questionPack2.ts | 963 | 扩展题 (复习 + 难题) |
| questionPack3.ts | 724 | 古诗补字深度题 |
| service.ts | 644 | DB CRUD + 答题流程 |
| skills.ts | 194 | 24+ skill 定义 (C4B_U1_PINYIN/POEM/VOCAB/DICT 等) |
| trophies.ts | 193 | 14 类中文勋章 |
| units.ts | 61 | C4B 第 1-4 单元 + 第 5 (期中后) |
| index.ts | 72 | export glue + abilities |
| questionHelpers.ts | 108 | pickChoice + dictation builders |

### 已有 UI Pages (src/pages/chinese/)
- ChineseHome — 中文首页 (3 环 + 字词大冒险 + 错题复活 + 模拟测试)
- ChineseTrain — 训练页 (4 选 1 + 听写, 接 unitId/skillId/mode/fresh URL params)
- CharPractice — 手写练习 (Canvas + AI 视觉判)
- ChinesePicker — unit 选择
- ChineseAdmin — admin

### 已有 Game Components (src/components/chinese/games/)
- ChineseGameDispatcher — 游戏分派
- PairMatchGame — 配对 (字 ↔ 拼音)
- PoemClozeGame — 古诗补字
- SentenceShuffleGame — 句子重组

### 题量
- questions.ts: 312 questions
- questionPack2.ts: 220 questions
- questionPack3.ts: 48 questions
- **总: 580 questions** (大量) 覆盖 5 units

---

## 🔍 唯一阻塞 (本 iter ship 修复)

`src/components/DailySummaryCard.tsx` line 469-470 hardcoded:
```ts
items.push({ done: false, label: "语文拼音", ..., comingSoon: true });
items.push({ done: false, label: "语文词组", ..., comingSoon: true });
```

这让 Math hub 的 daily summary 显示 "语文拼音 · 即将开启 / 语文词组 · 即将开启" — 实际上 chinese 已经能跑.

**修复 v0.35.91**:
- comingSoon flag 删除
- href 改 `/chinese/train?ability=phonics` (拼音) / `?ability=vocabulary` (词组)
- done 检测拆 write/choose count 分别

---

## 📋 期中考试卷分析 (从 /scans/mid-term-chiness-{1-7}.jpeg)

学生卷子 (刘成茂 — 不是 Selena, 是 Bruce 收集的 G4B 同学样品).

### 完整题型清单 (大题 → 小题分布)

| # | 题型 | 例 | 现 chinese 覆盖? |
|---|---|---|---|
| 1 | 加点字读音 (拼音) | 慰藉(wèi jiè) / 解闷 / 健康 / 潇洒 / 推测 | ✅ PINYIN skill |
| 2 | 形声字 + 偏旁 | "蜻蜓" 都是虫字旁 | ✅ PINYIN + GLYPH skill |
| 3 | 错别字找改 | "李强来信 3 个错别字 + 1 个错用标点" | ❓ 未覆盖 |
| 4 | 病句修改 | "1 处语序颠倒句子, 用修改符号在信中修改" | ❓ 未覆盖 |
| 5 | 选词填空 | "柔嫩 / 柔软" 选哪个 | ✅ VOCAB skill |
| 6 | 词语意思理解 | "次第渐变" 意思是? + 找解释句子 | ✅ VOCAB skill |
| 7 | 修辞辨认 | 老黄牛 / 小蜜蜂 / 百灵鸟 / 领头羊 对应人 | ✅ RHETORIC skill |
| 8 | 仿写句子 (调动颜色) | "枝头抽出嫩黄的新芽" 类 | ❓ 未充分覆盖 |
| 9 | 部首/偏旁规律 | 米饭/牛肉/玉米/醋 类饮食偏旁 | ✅ GLYPH skill |
| 10 | 阅读理解 (短文 + 多问) | "假如我来当校长" + "健康食堂" 长篇 | ⚠️ 部分 (READING skill 但题目类型有限) |
| 11 | 表格阅读 | 一周菜谱 + 评价优点 | ❓ 未覆盖 |
| 12 | 古诗背诵默写 | 《独坐敬亭山》"众鸟高飞尽, 孤云独去闲" | ✅ POEM_RECITE skill |
| 13 | 看图写话 | 看小狗图 + 描述警觉的小狗 | ❓ 未覆盖 (需 image input) |
| 14 | 大作文 | "我的乐园" 不少于 400 字 | ❓ 未覆盖 (需 long-form input) |

### 已覆盖 vs 缺失

**✅ 已覆盖 (chinese 模块强项)**:
- 拼音字音 (含多音字 sù/xiǔ/xiù)
- 字形辨析 (蜻蜓虫字旁)
- 古诗补字
- 词语搭配 + 意思
- 修辞辨认 (4 比喻 → 4 人物对应)

**❓ 缺失 (期中考有但 chinese 模块没专门 skill)**:
- 错别字找改
- 病句修改
- 仿写句子
- 表格阅读 + 总结
- 看图写话
- 大作文 (400+ 字)

---

## 🎮 设计建议: Chinese 模块 minigame cluster (parallel to math 7 cluster)

参考 math 7 cluster 模式 (Battle / Detective / Temple / Lab / Data / Carnival / Canvas), 给 chinese 设计专属 cluster:

### Cluster 1: 🏮 古诗拍灯笼 (Poem Lantern)
- 主题: 元宵节灯笼 + 古诗补字
- 视觉: 红灯笼飘空 + 缺字白格 + Mascot 戴汉服
- 交互: 4 候选字 chip, 点对 → 灯笼亮金光 + 鞭炮动画

### Cluster 2: 🔍 字形侦探 (Glyph Detective)
- 主题: 民国侦探 + 偏旁部首
- 视觉: 老式书桌 + 放大镜 + 案卷 (类比 math Detective)
- 交互: 给汉字, 圈出正确偏旁

### Cluster 3: 🐉 病句龙训 (Sentence Dragon)
- 主题: 中国龙 + 句子重组
- 视觉: 卷轴 + 龙鳞 + Selena 训龙师
- 交互: 病句拖 token, 重组正确语序

### Cluster 4: 📜 修辞画卷 (Rhetoric Scroll)
- 主题: 山水画 + 修辞
- 视觉: 水墨卷展开 + 比喻视觉 (老黄牛 → 勤劳之人)
- 交互: 拖比喻物到对应人物

### Cluster 5: 🎨 仿写画师 (Sentence Painter)
- 主题: 美术馆 + 仿写句子
- 视觉: 画家围裙 (复用 artist archetype DNA!) + 调色板
- 交互: 给例句, AI 给关键词 + Selena 仿写 → AI judge (用 chat/completions 5.0 评分)

### Cluster 6: 📖 阅读图书馆 (Reading Library)
- 主题: 古风图书馆 + 长篇阅读
- 视觉: 书架 + 卷轴 + 龙头烛台
- 交互: 短文滚动 + 多步问题 (主旨 / 概括 / 仿写)

### Cluster 7: ✏️ 自由作文 (Free Writing)
- 主题: 写字桌 + 大作文
- 视觉: 砚台 + 毛笔 + 信笺
- 交互: Canvas 大区写作 (or text input) + AI 5.0 评分 + 字数 progress

---

## 📅 实施 roadmap (待 Bruce 拍板)

### Phase 1 (本 iter v0.35.91): 解锁 chinese 拼音/词组 (1 行 fix)
- ✅ DailySummaryCard `comingSoon: true` → `false`
- ✅ href 接 ChineseTrain ability filter (拼音 → phonics, 词组 → vocabulary)
- ⏳ visual verify Math hub + Chinese hub 都正常

### Phase 2: 补缺失题型 (next iters)
- 错别字 skill + 题包 (50+ 题)
- 病句修改 skill + 题包
- 阅读理解 multi-step 题包扩充
- 仿写句子 (用 AI judge)
- 看图写话 (需 image-question template)

### Phase 3: Chinese 7 cluster minigame prototype (类比 math 7 cluster)
- 灯笼 / 侦探 / 龙训 / 画卷 / 画师 / 图书馆 / 作文
- 1 cluster / iter, 跟 math cluster 并行

### Phase 4: 试卷 OCR + 错题录入
- 期中卷扫描 → AI OCR 提取 → 自动建错题
- 学生指着卷子讲解, 系统识别

### Phase 5: Chinese hub character integration
- 等 character growth 恢复后, Chinese 模块也用同 character (跨学科共享)
- "学者 / 艺术家" archetype 在 chinese 课更激活

---

## 决策给 Bruce

1. ✅ 本 iter ship Phase 1 (1 行 fix 解锁拼音/词组)
2. ❓ 接下来想做 Phase 2 补题型, 还是 Phase 3 cluster minigame, 还是其他?
3. ❓ 7 cluster 设计哪个最吸引 Selena? (我猜灯笼 / 龙训 / 画师)
4. ❓ 大作文要不要等 AI judge 接通才做?

恢复 character growth 时回 `docs/character-growth-progress-pause-2026-05-19.md`.
