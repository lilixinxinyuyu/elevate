# Aliyun 全栈迁移 · 当前状态 + 待办

> **目标**：今天完全摆脱 CloudFlare，全栈迁到 Aliyun（前端 + 后端 + 数据 + 域名）。
> **决策日期**：2026-05-16
> **决策者**：爸爸（已明确：选项 B，完全迁，不要 hybrid）

## 0. 当前最大问题（根因）

Selena 电脑数据已 18+ 小时不能 push 到云。爸爸看不到 Selena 进度。

**根因链**：
1. Selena 本地 IDB 攒了 8.2MB 数据
2. push 到 CF Pages → server 写 D1 → D1 单参数 ~1-2MB 限制 → `SQLITE_TOOBIG` 500
3. v0.33.59 加了 OSS 主路径试图绕过，但 **CF Pages production env vars 没设 ALIYUN_OSS_***（user 加了但可能只在 Preview 环境）→ server `oss_not_configured` 503 → 退回 D1 → 还是 500
4. 死循环

**已验证**：
- ✅ OSS 后端 4 个 env vars 在 `.dev.vars` 文件里都对（HEAD + PUT 测试 200）
- ✅ RAM 权限 / bucket / region / AK 全 OK
- ✅ Selena 已导出 8.2MB JSON backup（保存好了，不会丢）
- ❌ CF Pages 上的 production env 没生效（user 决定不再修，直接迁阿里云）

## 1. 目标架构

```
xiaojin.app (Namecheap DNS)
  ↓ CNAME
ESA Edge (HK)
  ├── /              → OSS bucket xiaojinapp/web/ 静态文件
  └── /api/*         → ESA EdgeRoutine (V8 isolate) → 业务逻辑
                          ↓
                       OSS xiaojinapp/users/{userId}/snapshot.json (用户数据)
                       BAILIAN / TOKEN_PLAN_CN (AI 调用)
```

**单 bucket `xiaojinapp`** 结构：
```
xiaojinapp/
├── web/                          ← 前端静态文件 (Vite build 输出)
│   ├── index.html
│   └── assets/
└── users/                        ← 用户数据 snapshot
    ├── selena/snapshot.json
    └── ... (未来同学)
```

ESA 用 "OSS 私有 Bucket 鉴权" 直接 fetch `web/*`，不需要 bucket 公开读。

## 2. 所有凭证（在 `/Users/yong/Desktop/xy/.dev.vars`）

**所有值都在 `/Users/yong/Desktop/xy/.dev.vars` 文件**（**永不 commit secret 到 repo**）。

需要的 env var keys（**只列 key 不列 value**）：

```
APP_PASSWORD                       (老的 全家共享密码)
TOKEN_PLAN_API_KEY                 (deprecated, SG intl)
DASHSCOPE_API_KEY                  (deprecated, intl)
ALIYUN_OSS_REGION                  = oss-cn-hongkong
ALIYUN_OSS_BUCKET                  = xiaojinapp
ALIYUN_OSS_ACCESS_KEY_ID           (LTAI... 子账号 xiaojinapp-sync)
ALIYUN_OSS_ACCESS_KEY_SECRET       (子账号 secret)
TOKEN_PLAN_CN_API_KEY              (主, cn-beijing 订阅)
BAILIAN_API_KEY                    (fallback, 杭州按量)
```

**读取方式**（在 Bash）：
```bash
grep ^ALIYUN_OSS_ACCESS_KEY_ID= /Users/yong/Desktop/xy/.dev.vars | cut -d= -f2-
```

## 3. Aliyun 服务已开通

| 服务 | 状态 | 备注 |
|---|---|---|
| OSS bucket `xiaojinapp` | ✅ Hong Kong region, ZRS, Versioning ON, Private | 单一 bucket 服务前端 + 数据 |
| RAM user `xiaojinapp-sync` | ✅ AK 已发 | 4 个 env vars 已记 `.dev.vars` |
| RAM policy `xiaojinapp-oss-rw` | ✅ 绑给 user | Custom policy, 限 bucket 范围 |
| RAM policy `AliyunFCFullAccess` | ✅ 绑给 user | Function Compute 全权（暂未启用 FC） |
| RAM policy `AliyunESAFullAccess` | ✅ 绑给 user | ESA 全权 |
| ESA service | ✅ **Pro plan** 已开通 | 阿里云控制台 |
| Function Compute 3.0 | ✅ 开通了（备用） | cn-hongkong region |
| 百炼 Bailian | ✅ 开通了，API key 已发 | 国内版（不是 intl） |
| Token Plan 国内订阅 | ✅ 开通了，API key 已发 | cn-beijing region |
| 域名 `xiaojin.app` | ✅ 在 Namecheap 买好 | 还没改 DNS |
| ICP 备案 | ❌ 未办（HK region 不需要） | 未来切国内 region 才需要 |

## 4. AI 模型策略（已写文档 `docs/ai-models-registry.md`）

- **主路径**：`TOKEN_PLAN_CN_API_KEY` → `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1`
- **Fallback**：`BAILIAN_API_KEY` → `https://dashscope.aliyuncs.com/compatible-mode/v1`
- **例外（强制 BAILIAN 主）**：实时语音多模态 `qwen3.5-omni-plus` / `qwen3.5-omni-flash`
- 完整模型清单 + 任务映射见 `docs/ai-models-registry.md`

## 5. Multi-tenant Auth 设计（已实现服务端）

`functions/_shared.ts` 已加 `getUserId(req, env)`:
- 优先查 `APP_USERS` JSON map (`{"密码":"userId"}`)
- Fallback `APP_PASSWORD` → 自动 userId="selena"
- 401 + userId 字符 sanitize

**爸爸 TODO（未来加同学时）**：
- 加 `APP_USERS={"selena-2026":"selena","alice-pwd":"alice"}` env var
- 各家自己用自己 password，互不相通

## 6. 已 ship 的代码（v0.33.59 + v0.33.60）

```
functions/_oss.ts                       — OSS REST + HMAC-SHA1 签名（V8 兼容）
functions/_shared.ts                    — 加 getUserId() multi-tenant
functions/api/sync/oss/upload.ts        — POST 写 OSS snapshot
functions/api/sync/oss/download.ts      — GET 拉 OSS snapshot (HEAD optimize)
functions/api/sync/oss/check.ts         — 诊断 endpoint
src/db/cloudSync.ts                     — 客户端 dual-write OSS主/D1备
src/components/admin/BackupRestorePanel.tsx — 备份/恢复 UI
docs/ai-models-registry.md              — 模型注册文档
docs/aliyun-migration-state.md          — 本文档
```

**已验证**：OSS sign 逻辑正确（`/tmp/test-oss.mjs` 跑过，HEAD 404 + PUT 200）。

## 7. 待做（按顺序）

### Phase 1 · 后端 hono 改写 + 部署 ESA EdgeRoutine

**目录**：`aliyun-deploy/` (新建)
- `aliyun-deploy/src/index.ts` — hono entry，挂载所有 routes
- `aliyun-deploy/src/routes/sync.ts` — `/api/sync/oss/*` + `/api/sync/*` (老的也保留 fallback)
- `aliyun-deploy/src/routes/admin.ts` — `/api/admin/report-question`
- `aliyun-deploy/src/routes/agent.ts` — `/api/agent/judge-questions` / `tutor/*` 等
- `aliyun-deploy/src/routes/generate.ts` — `/api/generate/questions` / `variant` / `image`
- `aliyun-deploy/src/routes/tts.ts` — `/api/tts/generate`
- `aliyun-deploy/src/routes/auth.ts` — `/api/auth/check`
- `aliyun-deploy/src/lib/oss.ts` — 复用 functions/_oss.ts
- `aliyun-deploy/src/lib/auth.ts` — 复用 _shared 的 getUserId/checkAuth
- `aliyun-deploy/src/lib/providers.ts` — chat/image providers (TOKEN_PLAN_CN 主 + BAILIAN fallback)
- `aliyun-deploy/build.mjs` — esbuild 打包成 single `dist/worker.js`
- `aliyun-deploy/deploy-routine.mjs` — Aliyun OpenAPI 上传 EdgeRoutine

**关键考虑**：
- V8 isolate API only（fetch / crypto.subtle / TextEncoder / DecompressionStream / CompressionStream）
- 不用 Node API（fs/path/Buffer 等）
- 不用 D1（数据全走 OSS）
- 不用 KV（暂时）
- 单文件 bundle < 1MB

**已装 deps**: `hono@4.12.19`, `ali-oss@6.23.0`, `esbuild@0.28.0`

### Phase 2 · 前端 build 上传 OSS

`scripts/deploy-frontend-oss.mjs`：
- `npm run build` → dist/
- 读 .dev.vars 拿 AK
- ali-oss SDK 批量上传 dist/* → OSS xiaojinapp/web/
- 设 Content-Type 正确 mapping (.js / .css / .html / .png 等)
- 设 Cache-Control: index.html 短缓存（5min）+ 其他长缓存（1 year）

### Phase 3 · ESA 配置

通过 Aliyun OpenAPI 或控制台：
1. **创建 ESA Site**：xiaojin.app
2. **添加 Origin**：`xiaojinapp.oss-cn-hongkong.aliyuncs.com` (启用 OSS 私有 bucket 鉴权)
3. **添加路由规则**：
   - `/api/*` → EdgeRoutine handler
   - `/*` → Origin (OSS web/ 前缀)
4. **EdgeRoutine 配置**：
   - Bind env vars (从 .dev.vars 同步过来)
   - 上传 `worker.js` bundle
5. **申请免费 SSL 证书**（Let's Encrypt 自动）
6. **拿 ESA CNAME 值**（给爸爸去 Namecheap 配）

### Phase 4 · DNS + 数据迁移

**爸爸 Namecheap**：
1. xiaojin.app → Advanced DNS
2. 加 CNAME: `@` → `<ESA 给的 CNAME>`
3. 等 DNS 生效（5-60 分钟）

**数据迁移**：
- 选项 A：直接用 OSS PUT 把 Selena 的 8.2MB JSON 传到 `users/selena/snapshot.json`（最快）
- 选项 B：Selena 在新 `xiaojin.app` 上点"导入备份"（已 ship 的 UI）

推荐 A，由我跑脚本搞定。

### Phase 5 · 验证 + 关 CF

1. Selena 访问 `https://xiaojin.app` → 看到她数据
2. 爸爸自己电脑访问 → 看到 Selena 数据
3. 跑 24-48 小时观察
4. 关闭 CF Pages 项目 + D1 database

## 8. 注意事项 / 已知坑

### A. Selena 当前数据保护
- **8.2MB backup JSON 已经导出** —— Selena 那台机器已保存好
- Selena 那台浏览器 tab 千万不要关（IDB 数据还在）
- 完成迁移前不要 clear cache / clear site data

### B. CF Pages 暂时保留
- 不要立刻删 CF Pages 项目
- 作为 fallback 保留 1-2 周观察 Aliyun 稳定性
- CF Pages 的 OSS env vars 即使不修也没关系（不再用）

### C. 没 ICP 的限制
- HK region OSS + EdgeRoutine 都不需要 ICP
- `.app` 域名注册在 Namecheap，DNS 指 ESA HK 节点完全合法
- 未来想切国内 region (cn-hangzhou 等)，那时再办 ICP
- ICP 流程：2-4 周，需身份证 + 居住证明（爸爸现在不需要做）

### D. ESA EdgeRoutine 限制
- 单请求最长 30s wall clock
- 内存 128MB
- CPU 时间 50ms/请求（编译执行 budget）
- 代码 bundle < 1MB
- 没 D1，没 KV（暂时不用）

我们所有 endpoints 都能在 30s 内完成（已为 judge-questions 优化过 batch size）。

### E. 模型 endpoint 切换
- 老 `TOKEN_PLAN_API_KEY` (SG intl) 和 `DASHSCOPE_API_KEY` (intl) 已 deprecated，迁完可从 ESA env 删
- 新代码默认用 `TOKEN_PLAN_CN_API_KEY` + `BAILIAN_API_KEY`
- 详细 priority + model 清单见 `docs/ai-models-registry.md`

### F. 旧 D1 数据不需要迁
- D1 上的 snapshot 是 18 小时前的 stale 版本
- Selena 的最新数据在她本地 IDB + 8.2MB backup JSON
- 用 backup JSON 直接灌到 OSS 即可
- 这之后 D1 可以 drop

## 9. 紧急情况 / 中断恢复

**如果会话中断**，下次接手的 Claude 看这个文档 + `docs/ai-models-registry.md`，应该能完整接续。

关键 commit:
- `b08974d` — v0.33.59 OSS sync 主路径 shipped
- `80feee8` — v0.33.60 OSS check 诊断 endpoint
- `18c614c` — docs: AI 模型注册表

未提交的 working state（截至本文写时）：
- 已装 `hono@4.12.19`, `ali-oss@6.23.0`
- `/tmp/test-oss.mjs` — OSS 连接测试脚本（一次性）
- 还没开始写 `aliyun-deploy/` 目录

## 10. 联系信息

- 阿里云主账号 ID: 5245985623010923
- RAM 子账号：`xiaojinapp-sync@5245985623010923.onaliyun.com`
- 域名：`xiaojin.app` (Namecheap)
- CF Pages 项目：`selena-elevate` (保留作 fallback)
- GitHub repo：`lilixinxinyuyu/elevate`
- 本地路径：`/Users/yong/Desktop/xy/heping-math-trainer`
- Selena 备份 JSON：8.2MB，爸爸在本地存好了

---

## 立即下一步（不要再问，直接做）

1. 创建 `aliyun-deploy/` 目录结构
2. 把 `functions/api/*` 所有 endpoints port 到 hono routes
3. 写 esbuild bundle 脚本
4. 写 ali-oss 前端 deploy 脚本
5. 写 Aliyun OpenAPI EdgeRoutine 上传脚本
6. 触发：bundle backend + deploy frontend OSS + deploy EdgeRoutine + config ESA site
7. 给爸爸 CNAME 值
8. 推 Selena 8.2MB backup 到 OSS
9. 验证 xiaojin.app 端到端

---

## ✅ 迁移收尾完成 (2026-05-20, v0.36.17)

**CF Pages 彻底删除, 单一 ESA 后端**:
- 删 `functions/` 整个目录 (28 文件) + `tsconfig.functions.json` + `wrangler.toml`
- composer 源 `functions/_promptComposer.ts` → `aliyun-deploy/src/lib/promptComposer.ts`
- `_gameTypePicker.ts` (权重抽样) → `aliyun-deploy/src/lib/gameTypePicker.ts`, ESA generate 用它
- `build-prompts.mjs` 只输出 `src/lib/` (前端) + `aliyun-deploy/src/generated/` (ESA)
- `proxy-fallback` 不再转 CF, 未 native 路径返 501

**验证**: 前端 build OK, ESA typecheck clean, 登录/讲题在 ESA 单独 work, voice 废弃路径 501.

**部署流程 (单一)**:
- 后端: `cd aliyun-deploy && npm run build && ./node_modules/.bin/esa deploy dist/worker.js`
- 前端: `npm run build && cd aliyun-deploy && npm run deploy:frontend` (OSS web/)
- **不再 `wrangler pages deploy`** (CF Pages 已退役)

**遗留 (爸爸可在 CF 控制台操作)**: selena-elevate.pages.dev 项目本身还在 CF 账号 (代码删了,
项目可手动删). 不影响 xiaojin.app (走 ESA).

**未解决**: ESA 出题 latency (完整 prompt 504) + dead IP 43.109.163.133 — 不再有 CF 兜底
掩盖, 必须在 ESA 解决. 见 docs/perf-audit-2026-05-19.md.
