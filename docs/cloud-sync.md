# Cloud Sync 架构 + 调试手册

> 写给未来的 Claude 看：每次都遇到"刷新看不到新数据"问题——这个 doc 治这个病。

## 数据流总览

```
┌─────────────────┐                ┌─────────────────┐
│  IndexedDB      │ ←───┐    ┌──→ │  Cloudflare D1  │
│  (本地)          │     │    │    │  (云端)          │
│                  │     │    │    │                  │
│  · students     │     │    │    │  · snapshots    │
│  · attempts     │     │    │    │    (主数据)      │
│  · mastery      │     │    │    │  · trophy_images│
│  · mistakes     │     │    │    │    (独立)        │
│  · trophies     │     │    │    │                  │
│  · trophyImages │     │    │    └──┬──────────────┘
│  · ...           │   pull push    │
└────┬─────────────┘     │    │    │
     │                    │    │    │
     │ writes by app      │    │    │
     │ trigger periodic   │    │    │
     │ pushToCloud()      │    │    │
     │                    │    │    │
     └────────────────────┘    └────┘
```

### 主数据 sync（download.ts / upload.ts）
- **格式**：单个 snapshot JSON（students + attempts + mastery + mistakes + trophies + meta + tutorSessions + **fluencyAttempts** + **fluencyStats**）
- **endpoint**：`POST /api/sync/upload` push, `GET /api/sync/download?since=N` pull
- **触发**（v0.31.71+ 实时化）：
  - **每次答题后**（`submitAttempt` / `recordFluencyAttempt`）→ `schedulePushToCloud()` 8s 防抖 push
  - **tab 重获焦点 / Layout mount** → `pullIfStale()` 60s 节流
  - **pagehide / visibilitychange=hidden** → `flushPushNow()` 立刻发出 pending push
  - 兜底：finalizeSession 仍 push 一次
- **冲突解决**：`applyPayloadMerged()` — 本地数据永不被远程旧 snapshot 覆盖
- **UI 反馈**：header 右上 `<SyncStatusIndicator/>` chip — 已同步 / 待同步 / 同步中 / 异常；点击立即 force pull + flush push

### 勋章图 sync（trophy-images.ts，独立）
- **为啥拆**：trophyImages payload 大（base64 ~50-300KB/张 × 100+ 张 = 数 MB），跟主 snapshot 一起会爆
- **格式**：每行单独存 D1（`trophy_images` 表），按 `(user_key, trophy_id)` upsert
- **endpoint**：`POST /api/sync/trophy-images` 上传（30 行/批），`GET /api/sync/trophy-images?since=N` 拉
- **限制**：单行 payload 500 KB（确保 jpeg / 透明 PNG < 这个）
- **localStorage key**：`selena.cloud.trophyImagesLastPull`（since 用）
- **服务端守门 (v0.31.79-81)**：
  - **keep-newer-by-generatedAt**：incoming.generatedAt > existing 才允许覆盖（防 stale client overwrite）
  - **PNG > JPEG**：拒绝 JPEG 覆盖 PNG（admin 上传的透明 PNG 不能被 client migration 黑底化）

### AI 题 sync（ai-questions.ts，独立）
- **为啥拆**：AI 题 ~2-3KB/道 × 1400+ 道 = ~4MB，主 snapshot 装不下
- **格式**：每行单独存 D1（`ai_questions` 表），按 `(user_key, question_id)` upsert
- **endpoint**：`POST /api/sync/ai-questions`（50 行/批），`GET /api/sync/ai-questions?since=N`
- **限制**：单行 30 KB
- **服务端 sanitize (v0.31.80)**：写入前自动 strip leak 模式：
  - clue_pick `clues[]` 字符串去掉 "（无关）/（非已知）/（解题设定）"等元注解
  - choose `options[].errorTag` 移到顶层 `_internal_option_diagnostics`（admin-only）
  - 顶层 `options[].errorTag` 同上
  - 空 clue 过滤 + 同步 `correct[]` 索引
- **作用**：即使 1000 个 stale client push 脏数据，server 都自动清理

## 关键 Hook 行为（**踩过的坑**）

### useTrophyImage（v0.31.8 之前的坑）
**症状**：刷新页面后，新 push 到 D1 的 trophy 图死活不显示。
**根因**：旧版 `useTrophyImage` 用 `useEffect` 一次性读 IndexedDB，cloud sync 后写入但 React 不会重渲染。
**修法**（v0.31.8）：改用 `useLiveQuery` from dexie-react-hooks → Dexie 写入自动触发 re-render。
**对照**：`TierBadgeImg` 一直用 useLiveQuery，所以段位徽章一刷新就到位；普通勋章柜的 TrophyIcon 漏修了。

**铁律**：所有展示 IndexedDB 数据的 Hook **必须用 `useLiveQuery`**，不要用 useEffect 一次性读。

### useAllTrophyImages（5s polling 问题）
**旧实现**：`setInterval(refresh, 5000)` — 写入后最多等 5s。
**v0.31.8 修法**：改 `useLiveQuery` — 写入立刻生效。

## 调试手册

### 症状：刷新后看不到新数据

按这个顺序查（前面没问题再往后）：

#### 1. D1 真的有吗？
```bash
APP_PASSWORD=$(grep ^APP_PASSWORD /Users/yong/Desktop/xy/.dev.vars | cut -d= -f2) \
  curl -s -H "Authorization: Bearer $APP_PASSWORD" \
  "https://selena-elevate.pages.dev/api/sync/trophy-images?since=0" | \
  python3 -c "import json,sys;j=json.load(sys.stdin);print('rows',len(j.get('rows',[])))"
```

如果 0 行：上传步骤就坏了，不是 sync 问题。

#### 2. 本地 IndexedDB 拉到了吗？
浏览器 console：
```js
(async () => {
  const D = (await import('https://cdn.jsdelivr.net/npm/dexie@4.0.8/dist/dexie.min.mjs')).default;
  const db = new D('heping-math-trainer'); await db.open();
  const all = await db.trophyImages.toArray();
  console.log('IndexedDB rows:', all.length);
})();
```

如果 < D1 行数：sync pull 没拉全 → 检查 `localStorage.getItem('selena.cloud.trophyImagesLastPull')`，如果太大就清掉强制全量拉。

#### 3. 页面渲染没更新？
看用的是 useTrophyImage / useAllTrophyImages（应该是 useLiveQuery 版本）。如果发现还是 useEffect 版（v0.31.8 之前的代码），就是这个 bug。

### 强制全量重拉
console：
```js
localStorage.removeItem('selena.cloud.trophyImagesLastPull');
window.location.reload();
```

### 完全重置（核选项，慎用）
console：
```js
indexedDB.deleteDatabase('heping-math-trainer');
window.location.reload();  // 会重新从 cloud 全量拉
```

## 关键文件

| 文件 | 作用 |
|---|---|
| `src/db/cloudSync.ts` | 客户端 sync 主流程（push/pull/merge） |
| `functions/api/sync/upload.ts` | D1 主 snapshot 接收 |
| `functions/api/sync/download.ts` | D1 主 snapshot 下发 |
| `functions/api/sync/trophy-images.ts` | trophy 图独立 endpoint |
| `src/components/AuthGate.tsx` | mount 时触发 pullFromCloud |
| `src/lib/trophyImages.ts` | useTrophyImage / useAllTrophyImages hooks |
| `src/components/TrophyIcon.tsx` | 渲染单张勋章图（用 useTrophyImage） |
| `src/components/TierBadgeImg.tsx` | 渲染段位徽章（用 useLiveQuery） |

## 历史教训汇总

| 版本 | bug | 修法 |
|---|---|---|
| v0.29.5 | 7 MB 图 push 14 MB → 502 | 客户端 Canvas 压缩 256/512 jpeg |
| v0.29.6 | A 设备清的题不能跨设备同步 | 加 deletedQuestionIds meta key |
| v0.29.7 | 大图 marker 设了不重跑 | migration 跑完扫剩余、不设 marker 直到清完 |
| v0.30.0 | trophyImages 跟主 snapshot 一起 → 太大 | 拆独立 endpoint /api/sync/trophy-images |
| v0.30.14 | SEED_VERSION 没 bump → 现有 user 不下载新题 | 加题必 bump（脚本自动） |
| v0.31.8 | useTrophyImage 不响应式 → 刷新后新图不显示 | useLiveQuery 替代 useEffect 一次性读 |
| v0.31.9 | locked tiered trophy 显示 emoji 而非 grayscale AI 图 | TrophyWall 给 tier 加默认 "bronze"（仅 tiered trophies），让 locked 状态预览 bronze 图灰版 |
| v0.31.65 | aiQuestions 在主 snapshot 里 → push 总 payload > 2MB → D1 拒收 | 拆 /api/sync/ai-questions 独立端点 |
| v0.31.71 | session-end 才 push → Selena 中途关 tab 数据丢 | per-attempt 8s 防抖 push + pagehide flush |
| v0.31.71 | 切回 Bruce 设备看不到 Selena 进度 | 加 visibilitychange + focus pull (60s 节流) |
| v0.31.71 | fluencyAttempts/Stats 完全没同步 | 加进 PUSH_TABLES + applyPayloadMerged 处理 |
| v0.31.79 | admin 上传的透明 PNG 被 stale client push 覆盖回 JPEG | 服务端 keep-newer-by-generatedAt guard |
| v0.31.80 | cleanup 过的 AI 题被 stale client push 又把 `（无关）`覆盖回去 | 服务端 sanitize at the door — 写入前自动 strip leak 模式 |
| v0.31.81 | client v0.29.7 migration 把 admin 上传的 PNG 自动 JPEG 黑底化 | 服务端 PNG-over-JPEG 守门 + 客户端跳过 PNG 不重压 |
