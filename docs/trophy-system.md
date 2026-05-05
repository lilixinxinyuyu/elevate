# Trophy 系统全流程

> 写给未来的 Claude 看：勋章相关 bug 反复出现 (v0.30.12 中文 leak / v0.31.6
> banner leak / v0.31.8 non-reactive hook / v0.31.9 locked emoji fallback)
> ——这个 doc 把整条链路写清，避免再踩。

## 数据流总览

```
┌─────────────────────────────────────────────────────────────┐
│  src/core/trophies.ts TROPHIES[] (TrophyDef)                │
│  ── 定义 trophy: id / name / category / tier 函数 / 阈值      │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  src/lib/allTrophies.ts getAllTrophyMeta()                  │
│  ── 把每个 def "展开" 成 TrophyMeta[]:                        │
│       · 无 tier 系统的 → 1 个 meta，id = math_<id>           │
│       · 有 tier 系统的 → 4 个 meta，id = math_<id>_<tier>    │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  trophyImageKey(subjectId, rawId, tier?)                    │
│  ── 算 image 表查询 key:                                      │
│       · tier 存在: math_streak_keeper_gold                   │
│       · tier 不存在: math_first_step                         │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  IndexedDB.trophyImages (key = trophyImageKey)              │
│  ── base64 imageDataUrl (~50KB jpg)                         │
│  ── 来源：scripts/regenerate-trophies.mjs 走 D1 sync          │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  useLiveQuery(...) 响应式 hook (v0.31.8 修)                   │
│  ── Dexie 写入立刻 re-render，不需刷新                         │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  TrophyIcon.tsx                                              │
│  ── row.imageDataUrl 存在: 渲染 <img>                        │
│  ── 不存在: emoji 兜底                                        │
│  ── unlocked=false: grayscale + opacity 0.4                 │
└─────────────────────────────────────────────────────────────┘
```

## 关键 invariant（破坏一条就必出 bug）

### 1. **Tier prop 永远要算对 lookup key**
TrophyIcon 用 `trophyImageKey(subjectId, trophyId, tier)` 算查询 key。

- **tiered trophy**（有 `tieredThresholds`）：必须传 tier，否则查不到图
- **non-tiered trophy**（commemorative / daily）：tier 应该是 undefined
- **locked tiered trophy**：v0.31.9 修——传 `bronze` 让锁着的也能 preview 灰图

调用方（TrophyWall）正确写法：
```ts
tier={cur ?? (def.tieredThresholds ? "bronze" : undefined)}
```

### 2. **Hook 必须响应式**（v0.31.8 修）
`useTrophyImage` / `useAllTrophyImages` 必须用 `useLiveQuery` from
`dexie-react-hooks`，不能用 `useEffect` + 一次性 fetch。

为什么：cloud sync 写入 IndexedDB 是异步的，组件可能已经 mount 完了。
非响应式 hook 不会 re-fetch → 用户刷新后看不到新图。

### 3. **Prompt 不能嵌中文 t.name**（v0.30.12 修）
`buildTrophyPrompt` 三个分支：
- `buildTierBadgePrompt` 段位徽章
- `buildCommemorativePrompt` 纪念
- `buildRichTrophyPrompt` 其他

**后两者** fallback 路径会用 `「${t.name}」概念的卡通图标` —— AI 一定把中文当文字渲染进图。

铁律：**新加 trophy 必须先在 `TROPHY_MOTIF_SPEC` 或 `COMMEMORATIVE_MOTIF_SPEC`
加纯英文 motif**。否则一定 leak。

### 4. **Banner / ribbon 是 text 引诱器**（v0.31.7 修）
`boss_G4B_U1` 一开始 motif 含 `"ribbon banner draped at the bottom"` →
AI 在 banner 上塞了 "1 CONQUET SEAL" 英文。

铁律：motif 里**避开 ribbon banner / scroll panel / plaque** 这类元素。
要装饰用 stars / sparkles / wreaths 替代。

### 5. **D1 单行 ≤ 500 KB**（v0.29.5 修）
trophyImages 拆独立 endpoint 后，每行 D1 限 500 KB。512×512 jpeg q=85
约 ~50 KB → 安全。PNG 6 MB 直接超限。

铁律：上 D1 前**一定走 ImageMagick 压缩**（scripts/regenerate-trophies.mjs
默认 `--compress`）。

## TrophyDef 形状

`src/core/trophies.ts`：

```ts
{
  id: "streak_keeper",          // 存 IndexedDB key 用
  name: "坚持之王",             // UI 显示
  description: "连续打卡天数",
  icon: "🔥",                   // emoji 兜底（无 AI 图时显示）
  category: "milestone",        // 决定形状 + 配色：daily/milestone/ability/skill/commemorative/boss
  tier: (ctx) => streakDays(...),       // 计算"当前进度"的函数
  tieredThresholds: tiers(3, 7, 30, 100, " 天"),  // 4 tier 阈值
  // OR
  check: (ctx) => boolean        // 单槽 trophy 用（commemorative）
}
```

### `category` 决定的视觉
| category | 形状 | 主色 | 用途 |
|---|---|---|---|
| daily | 圆 | 翠绿 | 每天小胜利 |
| milestone | 圆 | 真金 | 长期里程碑（4 tier） |
| ability | 六边形 | 钴蓝 | 8 维能力（4 tier） |
| skill | 盾形 | 紫罗兰 | 单元学科精通（4 tier） |
| commemorative | 五角星 | 多彩金 | 一辈子一次纪念 |
| boss | shield V-notch | 战斗橙 | 闯关印章（Phase 2） |

形状是 CSS clip-path（`SHAPE_CLIP[category]` in TrophyIcon.tsx）。
**加新 category 必须改 5 处 record**：SHAPE_CLIP、CATEGORY_COLOR、CATEGORY_BG、
TrophyMeta type、boss-style 主题等。

## 加新 trophy 完整流程

1. **trophies.ts**：加 `TrophyDef`（id / name / category / tier 或 check / 阈值）
2. **trophyImages.ts**：加 motif spec
   - `TROPHY_MOTIF_SPEC['math_<id>']`（非 commemorative）
   - 或 `COMMEMORATIVE_MOTIF_SPEC['math_<id>']`（commemorative）
   - **必须纯英文**，避开 banner/ribbon
3. **生成 + push D1**：
   ```bash
   APP_PASSWORD=$(grep ^APP_PASSWORD /Users/yong/Desktop/xy/.dev.vars | cut -d= -f2) \
     node scripts/regenerate-trophies.mjs --missing
   ```
4. **视觉 QA**：Read `/tmp/trophies/*.png`
5. **不合格的**：改 motif → `--ids math_xxx,...`
6. **用户刷新** production → 自动同步（v0.31.8 后真的端到端工作）

## 调试不显示问题

按这个顺序查：

### 1. trophy def 真的有 tieredThresholds 吗？
```bash
grep -A3 "id: \"YOUR_ID\"" src/core/trophies.ts
```
没有 → 该 trophy 走 single image，IndexedDB key 是 `math_<id>`（无后缀）。
有 → 必须 4 张图：`math_<id>_bronze/silver/gold/platinum`。

### 2. IndexedDB 里有图吗？
浏览器 console：
```js
(async () => {
  const D = (await import('https://cdn.jsdelivr.net/npm/dexie@4.0.8/dist/dexie.min.mjs')).default;
  const db = new D('heping-math-trainer'); await db.open();
  const all = await db.table('trophyImages').toArray();
  console.log(all.filter(x => x.trophyId.includes('YOUR_ID')));
})();
```

### 3. TrophyWall 算的 tier prop 对吗？
查 src/components/TrophyWall.tsx 看 `tier={...}` 是不是 v0.31.9 那条带 bronze fallback。

### 4. useTrophyImage 是 useLiveQuery 版吗？
`grep useLiveQuery src/lib/trophyImages.ts` —— 应该有 2 处。如果没有，就是 v0.31.8 之前的代码。

## 历史 bug + 教训（按时间）

| 版本 | bug | 修法 |
|---|---|---|
| v0.29.5 | 7 MB PNG 上传 14 MB → 502 | 客户端 Canvas 256/512 jpeg 压缩 |
| v0.29.7 | 大图 marker 设了不重跑 | migration 跑完扫剩余、未清完不设 marker |
| v0.30.0 | trophyImages 跟主 snapshot 一起 → 太大 | 拆独立 /api/sync/trophy-images endpoint |
| v0.30.12 | commemorative 4/4 中文 leak | COMMEMORATIVE_MOTIF_SPEC 纯英文 + 删 t.name |
| v0.31.6 | 加新 trophy 没加 motif → fallback 又 leak | 加 trophy 时同步加 motif spec |
| v0.31.7 | banner 元素引出英文 "CONQUET SEAL" | motif 避开 ribbon/banner |
| v0.31.8 | useTrophyImage 非响应式 → 刷新看不到 | useLiveQuery 替代 useEffect 一次性读 |
| v0.31.9 | locked tiered trophy 显示 emoji 而非灰图 | TrophyWall tier 默认 bronze（仅 tiered） |
