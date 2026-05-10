# Trophy AI 图生成 + 同步全流程

> 写给未来的 Claude 看：用户每次都说"你之前做过这个"，结果你又从头摸——
> 这文档就是为了治这个病。**不要再重新发明轮子**。

---

## TL;DR — 标准操作

### 普通 trophy（勋章 / 段位徽章）

```bash
APP_PASSWORD=$(grep ^APP_PASSWORD /Users/yong/Desktop/xy/.dev.vars | cut -d= -f2) \
  node scripts/regenerate-trophies.mjs --missing

# 看图 QA → 不合格的单独重抽
APP_PASSWORD=... node scripts/regenerate-trophies.mjs --ids math_xxx,math_yyy
```

### Boss 怪物图（v0.31.74-81 增强：透明 + enraged 变体）

```bash
# 1) 生成 7 个 boss 原图（白底 JPEG）
APP_PASSWORD=... node scripts/_generate-boss-images.mjs

# 2) OpenCV 处理透明 + 生成 enraged 红化变体
APP_PASSWORD=... python3 scripts/_make-boss-transparent.py
# → 输出 7 主 + 7 enraged = 14 张 RGBA PNG (140-260KB / 张)
# → 自动 push D1（每张单独上传，server 守门）

# 3) Selena 刷新 → pull → 透明背景显示
```

**v0.31.79-81 关键 bug + 修**：
- 客户端 `migrateCompressOversizedTrophyImages`（v0.29.7）会把 >200KB 的 trophy_images 自动 PNG → JPEG（黑底）。我的透明 PNG 280KB 触发它 → push 写回 D1 → 怪物背景又黑了。
- v0.31.79：服务端 keep-newer-by-generatedAt guard
- v0.31.80：服务端 ai-questions sanitize at the door
- v0.31.81：服务端 trophy-images PNG-over-JPEG guard + 客户端 migration 跳过 < 500KB 的 PNG

**用户只需做一件事：刷新 https://selena-elevate.pages.dev/math**

---

## 全流程图

```
┌──────────────────────────────────────────────────────────────────┐
│  scripts/regenerate-trophies.mjs                                  │
│                                                                    │
│  esbuild 打包 trophyImages.ts → 拿 buildTrophyPrompt              │
│         ↓                                                         │
│  GET /api/sync/trophy-images?since=0                              │
│   → 拿云端已有 keys，diff 出缺的                                  │
│         ↓                                                         │
│  for each missing trophy:                                         │
│    POST /api/generate/image  (Bearer APP_PASSWORD)                │
│      → token-plan wan2.7-image-pro 出图（~20s/张）                 │
│      → 拿 PNG URL                                                 │
│    download → /tmp/trophies/<id>.png  (~6 MB raw)                 │
│    magick compress → /tmp/trophies/<id>.jpg  (~50 KB, 512×512 q85)│
│         ↓                                                         │
│  POST /api/sync/trophy-images  (Bearer APP_PASSWORD)              │
│    → D1 INSERT ON CONFLICT UPDATE                                 │
│    → 30 张/批，~50KB/张 完全在 500KB 单行限制内                    │
└──────────────────────────────────────────────────────────────────┘
                               ↓
┌──────────────────────────────────────────────────────────────────┐
│  Selena 浏览器：刷新页面                                           │
│                                                                    │
│  AuthGate.tsx 检测有 storedPassword → pullFromCloud()             │
│         ↓                                                         │
│  src/db/cloudSync.ts pullTrophyImages()                           │
│    GET /api/sync/trophy-images?since=<lastPullAt>                 │
│    → bulkPut 进 db.trophyImages                                   │
│         ↓                                                         │
│  trophyImages.ts migrateCompressOversizedTrophyImages 兜底         │
│    （如果有未压缩老数据）                                          │
│         ↓                                                         │
│  TrophyWall / BadgeInventory React component re-render            │
│  → useLiveQuery 看到新行 → 显示新图                                │
└──────────────────────────────────────────────────────────────────┘
```

---

## 关键文件 / 端点

| 角色 | 路径 |
|---|---|
| 生成脚本（主流程） | `scripts/regenerate-trophies.mjs` |
| Prompt 构造器 | `src/lib/trophyImages.ts` 的 `buildTrophyPrompt()` |
| Trophy 元数据 | `src/lib/allTrophies.ts` 的 `getAllTrophyMeta()` |
| Motif spec（手写视觉描述） | `src/lib/trophyImages.ts` 的 `TROPHY_MOTIF_SPEC` / `COMMEMORATIVE_MOTIF_SPEC` |
| 中转打包模块（让 .mjs import .ts） | `scripts/_load-trophy-prompts.ts` |
| AI 图生成端点 | `functions/api/generate/image.ts` |
| D1 同步端点 | `functions/api/sync/trophy-images.ts` |
| 浏览器拉取逻辑 | `src/db/cloudSync.ts` 的 `pullTrophyImages()` |
| Auth 入口（触发 pull） | `src/components/AuthGate.tsx` 的 `pullFromCloud()` |

---

## 必备前置

1. **APP_PASSWORD**：写在 `/Users/yong/Desktop/xy/.dev.vars`（gitignored）
   ```
   APP_PASSWORD=xxxxx
   ```

2. **TOKEN_PLAN_API_KEY**：已配在 Cloudflare Pages dashboard secrets，functions
   会自动用。本地不需要。

3. **ImageMagick**：`brew install imagemagick`（已装）。脚本调 `magick`
   命令做 512×512 q85 jpeg 压缩。

4. **Node 22**：脚本用 ESM + esbuild。
   ```bash
   export PATH="/Users/yong/.nvm/versions/node/v22.11.0/bin:$PATH"
   ```

---

## Trophy 命名 / 路径约定

- Trophy ID 加 subjectId 前缀：`math_<id>` 或 `chinese_<id>`
- Tier 后缀（仅 milestone / ability / skill）：`_bronze` / `_silver` / `_gold` / `_platinum`
- 例：`math_streak_keeper_gold`、`math_boss_G4B_U1_DECIMAL_ADD_SUB_master`

D1 表 `trophy_images` 里 `trophy_id` 列就是这个 key（含前缀）。
IndexedDB `trophyImages` 表也用同 key 做主键。

---

## Prompt 构造逻辑（`buildTrophyPrompt`）

三种分支：

1. **段位徽章**（id 形如 `math_tier_school` / `math_tier_district` / ...）
   → `buildTierBadgePrompt`：徽章风格 + 学校/区/市/省/国 题材

2. **commemorative 类**（first_step / midterm_done / 等）
   → `buildCommemorativePrompt`：六角星形 + 仪式感 +
   读 `COMMEMORATIVE_MOTIF_SPEC[id]` 里的纯英文 motif

3. **其他（daily / milestone / ability / skill / boss）**
   → `buildRichTrophyPrompt`：圆形勋章 +
   读 `TROPHY_MOTIF_SPEC[base_id]` 里的 motif（去 tier 后缀） +
   `TIER_FLAVOR[tier]` 拼金属调

### 教训：永远不要让 prompt 包含中文字面

历史 bug：之前 commemorative 4/4 全失败，因为 prompt 用了 `「${t.name}」概念的卡通图标`，
AI 把"第一步"/"期中加冕"等中文当 TEXT 渲染进图。

**铁律**：所有 motif 必须**纯英文**视觉描述，不要嵌入 `t.name` / `t.description`。
Fallback 路径（`spec?.motif ?? \`an iconic illustration that represents「${t.name}」\``）
也要避开——加新 trophy 时**必须先加 motif spec**，否则一定 leak。

最近一次（v0.31.7）：boss_G4B_U1 prompt 提了 "ribbon banner draped at the bottom"，
AI 一画 banner 就忍不住塞英文文字 ("CONQUET SEAL" 拼错版)。**ribbon / banner 元素**
本身就是 text 引诱器，能避就避。

---

## 视觉 QA 流程（我自己跑）

每张生成完落到 `/tmp/trophies/<id>.png`，用 Claude Code 的 `Read` tool 直接看图：

```
Read /tmp/trophies/math_boss_first_pass.png
```

会嵌入图渲染。逐枚 check：
- ✓ 有没有文字 / logo / 数字 leak（NO TEXT 检查最重要）
- ✓ 主体跟 motif spec 描述对得上吗
- ✓ 颜色 + tier finish（青铜/银/金/钻）符合
- ✓ 整图填满画布（98%+），不是小勋章 + 一圈白边

不合格 → 改 `TROPHY_MOTIF_SPEC[id].motif` → `--ids <id>` 单张重抽。

---

## 限流 / 成本

- token-plan wan2.7-image-pro：单张 ~25-30 KP，Yongli 订阅有量。
- 并发：脚本默认 1（顺序跑）。token-plan 实测并发 3+ 容易 429，1 最稳。
- 单张耗时：~20s（first-token 慢 + 异步任务轮询）。
- 30 张全量：~10 min。

---

## 常见错误

| 错误 | 原因 | 修法 |
|---|---|---|
| `APP_PASSWORD env 必填` | 没读 `.dev.vars` | `export $(grep ^APP_PASSWORD /Users/yong/Desktop/xy/.dev.vars \| xargs)` |
| `Cannot find module .../scripts/...` | cwd 不是 project root | `cd /Users/yong/Desktop/xy/heping-math-trainer` |
| 中文字 leak 进图 | motif 里嵌了中文 / 用了 fallback | 加 `TROPHY_MOTIF_SPEC[id]` 纯英文 motif |
| D1 `row_too_big_XXXX` | 没压缩，PNG 6MB > 500KB 限制 | `--compress`（默认开）确保走 ImageMagick |
| Cloudflare deploy `Invalid commit message UTF-8` | wrangler 把最近 git 中文 commit 拿去用 | `--commit-message="..."` 显式覆盖 |

---

## 历史背景（为啥这个流程长这样）

### 为啥不在浏览器 admin 一键生成？

之前确实有 admin/trophy-images 页 + "一键生成 N 张缺失" 按钮——但：
1. 需要 Chrome MCP 在线才能驱动（用户经常掉线）
2. 浏览器单线程跑 30 张要等到天荒地老
3. 失败重试 + 视觉 QA 没法自动化

CLI 版省时省心。Admin 按钮还在，**手动小修单张可以用**，批量跑用 CLI。

### 为啥不直接调 DashScope？

可以，但 `/api/generate/image` 已经在 Cloudflare Pages function 实现了
轮询 + 多 provider fallback + token-plan 走 chat-completion 兼容模式
（不是 standard images/generations endpoint）等所有特殊处理。重新实现没必要。

### v0.31.6 引入的 boss / streak 等 11 + 4 + 1 张是因为？

Phase 2 加了 boss印章（11 枚）+ canvas_master tier（4）+ perfect_day/week tier
（8）+ birthday_2026（1）等新 trophy。motif spec 必须提前加，否则
buildRichTrophyPrompt 会 fallback 到 `「${t.name}」` 中文 leak。

---

## 演进 changelog（参考）

- v0.30.x：Chrome MCP 驱动 admin → 视觉 QA → curl D1 拿图 review →
  改 prompt 重抽。慢且依赖 Chrome 扩展在线。
- v0.31.6：写 `scripts/regenerate-trophies.mjs` CLI 版。手动压缩 + 手动 push。
- v0.31.7：脚本默认 `--push-d1` + ImageMagick 压缩，**端到端 1 命令**。
  用户只刷新即可。
