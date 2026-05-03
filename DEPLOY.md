# Cloudflare Pages 部署指南

把整个 App 部署到 `https://<你的项目>.pages.dev`，Selena 在任何设备打开输密码就能玩，进度自动云同步。

## 一、整体架构（5 张图说明）

```
Selena 的设备                  Cloudflare 边缘网络
┌──────────────────┐          ┌─────────────────────────────────────┐
│ Safari/Chrome    │          │  Pages（静态文件 dist/）             │
│  ▼               │  HTTPS   │   • index.html                      │
│  React App       │ ───────▶ │   • bundle.js                       │
│  ▼               │          │                                     │
│  AuthGate (密码) │ ◀──────▶ │  Pages Functions                    │
│  ▼               │          │   • POST /api/auth/check            │
│  IndexedDB       │ ──push──▶│   • POST /api/sync/upload           │
│  (本地优先)       │ ◀─pull── │   • GET  /api/sync/download         │
│                  │          │           ▼                          │
│                  │          │   D1 (SQLite at edge)               │
│                  │          │   • snapshots 表（保留近 50 个版本） │
└──────────────────┘          └─────────────────────────────────────┘
```

数据流：
- **首次访问**：输密码 → AuthGate 验证 → 拉云端最新到 IndexedDB → 进 App
- **训练中**：所有读写都在 IndexedDB（离线也能玩）
- **完成一组**：自动 POST /api/sync/upload 把全量 IndexedDB JSON 推到 D1
- **新设备**：输密码 → 拉 D1 最新版本 → 本地立刻有所有进度

## 二、第一次部署（一次性，~15 分钟）

### Step 1. 准备 Cloudflare 资源（dashboard）

1. **创建 D1 数据库**（Cloudflare Dashboard → Workers & Pages → D1）
   - 名字：`selena-elevate-db`
   - 创建后记下生成的 `database_id`（一串 UUID）

2. **创建 Pages 项目**
   - Connect to Git → 选 `lilixinxinyuyu/elevate`
   - Build command: `pnpm install && pnpm build`
   - Build output directory: `dist`
   - 确认 Node 版本环境变量（如需）：`NODE_VERSION=20`

3. **绑定 D1 到 Pages 项目**
   - Pages 项目 → Settings → Functions → D1 database bindings
   - Variable name: `DB`（必须叫这个，functions 里的 `env.DB` 就是这个）
   - D1 database: 选刚创建的 `selena-elevate-db`
   - **Production** 和 **Preview** 都加（不然 PR 预览部署会 500）

4. **设置环境变量**
   - Pages 项目 → Settings → Environment variables
   - 名字：`APP_PASSWORD`，值：自己取一个 8+ 位密码（例如 `xy-selena-2026`）
   - Production 和 Preview 都加
   - **Encrypt** 选项打开（避免出现在日志里）

### Step 2. 初始化 D1 schema

本地一次性执行（需要 `wrangler` CLI）：

```bash
# 安装 wrangler（一次性）
npm install -g wrangler
wrangler login                        # 浏览器登 Cloudflare 账号

# 编辑 wrangler.toml，把 database_id 填上去
# （把 REPLACE_ME 换成 Step 1 里生成的 UUID）

# 创 schema
wrangler d1 execute selena-elevate-db --remote --file=db/schema.sql
```

### Step 3. 把 Selena 现有 IndexedDB 数据导入云端（仅第一次）

她已经在本地刷了 ~430 道，错题 / 奖杯 / 等级都有，要带过去：

```bash
# 1. 用 db/import-dump.mjs 把 IndexedDB JSON 转成 INSERT 语句
node db/import-dump.mjs ~/Desktop/xy/db/heping-math-trainer.json \
  > db/import-dump.sql

# 2. 灌入 D1
wrangler d1 execute selena-elevate-db --remote --file=db/import-dump.sql

# 3. 验证一下
wrangler d1 execute selena-elevate-db --remote \
  --command "SELECT id, attempts_count, sessions_count, total_xp FROM snapshots ORDER BY created_at DESC LIMIT 1"
```

应该看到 attempts_count=429 之类的输出。

### Step 4. 触发首次部署

```bash
git push origin main
```

Cloudflare Pages 自动构建 → 几分钟后给你一个 `https://elevate-xxx.pages.dev` URL。

### Step 5. 让 Selena 用起来

1. 把 URL 发给她（或在她浏览器打开）
2. 第一次会提示输密码 → 输 Step 1.4 设置的 `APP_PASSWORD`
3. 进入后会自动拉云端进度（如果 Step 3 灌入成功，她会看到所有奖杯和历史）
4. 加到主屏幕（iPhone Safari → 分享 → 添加到主屏幕；Android Chrome → 安装应用）
5. 之后正常玩，每次完成一组挑战自动云同步

## 三、日常更新（你改代码后）

```bash
git push origin main
```

Cloudflare 自动重新 build & 部署。Selena 浏览器一刷新就是新版（**进度数据照样在 D1 里，不会丢**）。

## 四、想换个密码

1. Pages 项目 → Settings → Environment variables → 改 `APP_PASSWORD`
2. 触发一次重新部署（Pages → Deployments → Retry deployment）
3. 让 Selena 在 `/admin → 云同步 → 忘记密码` 然后重新输

## 五、查看 Selena 的训练数据（给以后的 AI 助手用）

查最新一次快照：

```bash
wrangler d1 execute selena-elevate-db --remote \
  --command "SELECT created_at, attempts_count, sessions_count, total_xp FROM snapshots ORDER BY created_at DESC LIMIT 5"
```

下载完整 JSON：

```bash
wrangler d1 execute selena-elevate-db --remote --json \
  --command "SELECT payload FROM snapshots ORDER BY created_at DESC LIMIT 1" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['results'][0]['payload'])" \
  > current.json
```

之后 `current.json` 里就是完整 IndexedDB 状态，AI Agent 可以读它来分析 Selena 进度、做出题策略、写讲解等。

## 六、常见问题

### Q1：浏览器输密码后立马提示「密码不对」
- 检查 Cloudflare Environment variables 里 APP_PASSWORD 有没有保存
- 检查 Production 环境变量有，Preview 没有 → 浏览器访问的可能是 preview URL → 在 Production 域名上重试

### Q2：完成挑战后没有同步
- F12 → Network 看 `/api/sync/upload` 是否 401（密码不对）/ 500（D1 binding 没绑）
- 进 `/admin → 云同步 → 立即上传` 手动试一次，会显示具体错误

### Q3：Selena 在 iPad 看不到 Mac 上做的题
- iPad 进 `/admin → 云同步 → 拉取云端最新` 手动拉一次
- 如果还是不对，确认 Mac 上完成挑战时同步成功了（Mac /admin 看「上次推送」时间）

### Q4：D1 是否要钱
- 免费额度：5GB 存储、25M 行读 / 天、5w 行写 / 天
- Selena 一年训练大约几 MB 数据，远在免费内
- Pages 也是免费 100k 请求/天

### Q5：能撤销密码门吗（让 App 公开）
- 把 Pages 的 `APP_PASSWORD` env var 删掉 → AuthGate 检测到后端不要密码 → 直通
- ⚠️ 这样任何人拿到 URL 都能操作 Selena 的数据，**不推荐**
