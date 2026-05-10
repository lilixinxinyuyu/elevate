# 开发 / 部署 / 环境 速查

> 写给未来的 Claude：每次 deploy / env vars / build error 都重新摸——这个 doc 治这个病。

## 一次性 Setup

```bash
# Node 22（项目用 vite + esbuild，老 node 会炸）
nvm use 22  # 或 export PATH="/Users/yong/.nvm/versions/node/v22.11.0/bin:$PATH"

# 安装依赖
cd /Users/yong/Desktop/xy/heping-math-trainer
npm install

# 本地 dev 用的密钥（gitignored），同时给 scripts/ 用
# 文件路径：/Users/yong/Desktop/xy/.dev.vars （父目录！不在 project root）
echo 'APP_PASSWORD=xxxx' > /Users/yong/Desktop/xy/.dev.vars
```

## 常用命令

```bash
npm run dev          # vite dev server (localhost:5173+)
npm run build        # tsc + vite build → dist/
npm run typecheck    # tsc --noEmit
npx vitest run       # 跑测试
npm run preview      # vite preview (跑 build 后的 dist)
```

## 部署（生产）

### CF Pages 部署
```bash
npm run build
npx wrangler pages deploy dist \
  --project-name=selena-elevate \
  --commit-dirty=true \
  --branch=main \
  --commit-message="vX.Y.Z 短描述"
```

**`--commit-message="..." 必须显式给**——wrangler 默认拿 git 最新 commit msg；
如果 commit msg 含中文 + 特殊字符，wrangler 会报：

```
Invalid commit message, it must be a valid UTF-8 string. [code: 8000111]
```

显式覆盖后无问题。

### CF Pages secrets
```bash
npx wrangler pages secret list --project-name=selena-elevate
```

会显示（只显示 key 名，不显示值）：
- `APP_PASSWORD` — 全站 auth 密码
- `DASHSCOPE_API_KEY` — 阿里云 DashScope（备用 image / TTS）
- `TOKEN_PLAN_API_KEY` — 阿里云 token-plan 订阅（**主 image / chat provider**）

新增 secret：`npx wrangler pages secret put NAME --project-name=selena-elevate`

### 部署后检查

```bash
# Bundle 字符串确认（确认 v0.31.x 字符串确实在生产）
curl -s https://selena-elevate.pages.dev/ | grep -oE 'src="/assets/index-[^"]+\.js"' | head -1
curl -s https://selena-elevate.pages.dev/assets/index-XXX.js | grep -oE "想找的字符串" | head -3
```

## 版本号 bump（每次 ship）

3 处必须同步改：
1. `package.json` `"version"`
2. `src/components/Layout.tsx` footer 文字 `本地优先 · vX.Y.Z`
3. `CHANGELOG.md` 顶部加新 section

漏一处会让你 review 时困惑（页面显示版本 ≠ 实际部署版本）。

## SEED_VERSION 升级 协议

`src/db/seed.ts` 的 `SEED_VERSION` 数字。**任何时候**做下面的事必须 bump：
- 加新 seed 题（pack 文件 import 进来）
- 改老 seed 题的 stem/answer/skill_id
- 改 SKILLS / UNITS 列表

不 bump 现有 user `meta.seedVersion === SEED_VERSION` 会 early-return，永远不下载新题。

**v0.30.14 因为这个失败过一次**——v0.30.12 加 60 道 U1-U4 题但忘了 bump，
所有现有用户都没下载到。修法：bump version + 写迁移逻辑（自动 backfill）。

`scripts/add-skill.mjs` 在加新 skill 流程里自动 bump，**手动改 seed 别忘了**。

## Anti-Farm 设计原则

防止 Selena "刷分而非真学"，3 层护栏（v0.30.12 加，详见 CHANGELOG）：

1. **XP siblingDecay**（src/core/scoring.ts）— 同 skill correct 数 7/14/22 三档衰减。
   1 skill 100 道也只 ~50 XP，不能靠刷 sister 题把 XP 刷上去。

2. **Elo 强截断**（src/core/mastery.ts）— 学生 Elo > 题目 Elo + 300，答对完全不涨 Elo。
   防止低难度题刷高 Elo。

3. **能力诊断"广度"**（src/core/rating.ts）— 旧 log(totalAttempts) 改成
   sum(min(5, uniqueCorrectInSkill))，1 skill 最多贡献 5 分。**鼓励横向广度**。

加新勋章 / 新模式时，**永远不要奖励"做更多次"**，要奖励"真学到"。
v0.31.8 加 tutor_companion 勋章是这个原则的好例子（"问 + 之后真进步"才计）。

## Phase 2 Feature Flag

`PHASE2_LIVE` flag 历史上控制新模式（Fluency / 闯关 / Canvas）UI 入口可见性。
**v0.31.26 起默认 ON**（期中后翻），现在仅作为**关闭开关**，正常情况下不需要碰。

opt-out 方式（任一）：
1. **localStorage**：`localStorage.setItem('phase2_live','false')` + 刷新（开发回归用）
2. **URL param**：`?phase2=off`

实现见 `src/lib/featureFlags.ts`，落地状态见
[feature-flags-and-rollout.md](./feature-flags-and-rollout.md)。

## 常见错误 -> 解决

| 错误 | 原因 | 解决 |
|---|---|---|
| `Cannot find module '/Users/yong/Desktop/xy/scripts/...'` | cwd 错 | `cd /Users/yong/Desktop/xy/heping-math-trainer` |
| `APP_PASSWORD env 必填` | `.dev.vars` 在父目录，不是 project root | `export $(grep ^APP_PASSWORD /Users/yong/Desktop/xy/.dev.vars \| xargs)` |
| `Invalid commit message UTF-8` | git 中文 commit + wrangler 自动取 | `--commit-message="ascii fallback"` |
| `tsc -b ... DOM types missing` | 用了 v12 node | `nvm use 22` |
| `wan2.7-image-pro 429` | token-plan 限流 | 串行（脚本默认 concurrency=1） |
| 页面看到 v0.31.X 但没新功能 | 老 PWA 缓存 | hard refresh / 清 service worker |

## 关键路径

```
开发 → 测试 → 部署 → 验证

1. 编辑 src/
2. npm run typecheck && npx vitest run
3. （前端可见的改动）npm run dev → preview verify
4. bump 版本号（3 处）+ CHANGELOG
5. npm run build
6. npx wrangler pages deploy dist --commit-message="..."
7. git commit
8. curl 生产验证 bundle 字符串
9. 浏览器刷新 verify
```
