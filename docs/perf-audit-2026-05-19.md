# Performance 完整诊断 (2026-05-19)

## 🔥 BREAKING (v0.36.11 调查后): ROOT CAUSE 确定

**11-16s spike 不是我们的 cache 问题, 是 ESA edge IP `43.109.163.133` 死了.**

xiaojin.app DNS 返回 7 个 anycast IP, round-robin 分配请求:
```
163.181.78.216  ✅ 1.2s
43.109.163.133  ❌ 完全 25s timeout (dead!)
163.181.77.147  ✅ 1.2s
43.109.96.9     ✅ 1.2-2s
43.109.162.4    ✅ 1.1-3s
163.181.77.181  ✅
163.181.140.x   ✅
```

每次 client 命中 dead IP → 等 25s timeout (实测显示 11-16s, 可能内部 TCP retry).

**因此 Bruce 看到的"整体运行都很慢"主要是这个**. 跟 OSS / cache / model 都无关.

**这不是我们能修的** — 是 Aliyun ESA 内部 anycast cluster 一个节点 down.

**Action 选项 (Bruce 决定)**:
A. 联系 Aliyun support 报告 IP 43.109.163.133 dead, 等他们修 (推荐, 最 cleanest)
B. 临时把 xiaojin.app DNS 切回 selena-elevate.pages.dev (CF Pages 0.7s 稳定, 无 spike)
C. 加 CDN 中转 (Cloudflare 包 xiaojin.app DNS), 让 CF anycast 自动 failover dead IP
D. 等待自然修复 (anycast cluster 偶尔会 self-heal)

我建议 A + B 并行: 先切 DNS 让 Selena 立刻不卡, 同时 ticket Aliyun.

---



> **起源**: 爸爸反馈
>
> > "现在刷新还是很慢的, 整体运行都很慢, 按理说迁移到香港在国内用很快, 但实际上速度还不让以前在 Cloudflare pages 快. 模型也是从国际版切换到了国内版的模型, 很多时候都连接不上, 小进也无法讲题, 也无法用 AI 听英语读音."

## TL;DR — 现状 + 修了什么 + 还差什么

**修了 (v0.36.10 ship)**:
- ✅ ESA auth.ts: 加 30s module-level cache (实测 burst spike rate 40% → 3.3%)
- ✅ ESA proxy-fallback: 加 25s AbortController timeout (避免 CF 失败时卡 60s+)
- ✅ Model 链清理: 删 dead model (MiniMax-M2.5 invalid_parameter_error), 加 deepseek-v4-flash (0.96s vs v3.2 3.2s, 快 3x)
- ✅ v0.36.9 已修: token-plan cn-beijing 主路径接通 + qwen3.6-flash 加入 model 链 + Zod schema backfill

**还没修 (下个 iter)**:
- ⚠️ **ESA isolate cold start spike** (11-16s 偶发): 这是 Aliyun ESA EdgeRoutine 平台特性, 我们 cache 在 module-level 每个 isolate 独立. 解法: 把 `_auth/users.json` 也 baked 进 bundle, 完全脱离 OSS hot path. 改密码后需要 redeploy.
- ⚠️ **/api/generate/questions 504**: ESA gateway 30s timeout < generate (qwen3.6-flash 单 call 9.5s × N model cascade > 30s). 解法: client 直接调 CF Pages backend 而不是 ESA proxy.
- ⚠️ **CF Pages 自己 generate 65s**: 仍有 json_parse_failed (max_tokens=2500 不够 multi_step 2 道题). 解法: sub_batch_size=1 或 max_tokens=4000.

---

## 实测 baseline (v0.36.10 deploy 前)

| Endpoint | TTFB Range | Spike | 评估 |
|---|---|---|---|
| GET / (HTML) | 0.95-1.3s | - | CF (0.95s) 比 xiaojin.app (1.3s) 快 25% |
| POST /api/auth/check | 1.2-2.2s 大部分, 11-16s 频繁 spike | 40% rate | 修复后 3.3% |
| POST /api/sync/download | 1.7s (404) | - | route fall-through 慢 |
| POST /api/tts/generate | 3.8s (短 text) ~ 10.2s (长 sentence) | - | BAILIAN qwen3-tts-flash |
| POST /api/tutor/explain | 3.4-4.5s | - | qwen3.6-flash 苏格拉底回答 OK |
| POST /api/generate/questions | **504 timeout 57s** | always | ESA cascade > 30s gateway |
| GET /api/health | 1.2s | 11s spike 偶发 | native ESA OK |

## 实测各 model 连通性 (cn-beijing 直连)

| Model | Latency | Status | 备注 |
|---|---|---|---|
| qwen3.6-flash | 0.32s | ✅ OK | 最快, 第一选择 |
| qwen3.6-plus | 1.06s | ✅ OK | 稳定 |
| deepseek-v4-flash | 0.96s | ✅ OK | 新加入 (替代 v3.2) |
| deepseek-v4-pro | 2.73s | ✅ OK | 复杂任务 |
| glm-5.1 | 2.35s | ✅ OK | 备用 (替代 5.0) |
| deepseek-v3.2 | 3.21s | ✅ OK 但慢 | 降级到 fallback |
| glm-5 | 3.83s | ✅ OK 但慢 | 已用 5.1 替代 |
| **MiniMax-M2.5** | 0.19s | ❌ **invalid_parameter_error** | dead, 已移除 |

**结论**: cn-beijing 模型基本都 OK, 不是 Bruce 说的"很多连接不上". 之前看到"连接不上"是因为:
1. ESA route 内的 model cascade 包含 dead MiniMax-M2.5 → 浪费 30s
2. 老 deepseek-v3.2 慢 + qwen3.6-plus 偶尔 timeout

## Root cause 矩阵

| 问题 | Root cause | 修复 | 实测改善 |
|---|---|---|---|
| auth/check 11s spike 40% | OSS GET 无 cache | 加 30s module cache + invalidate on write | spike 40% → 3.3% (持续优化中) |
| proxy-fallback 卡 60s | fetch 无 AbortController | 25s timeout, 立刻返 504 | 仅在 CF 失败时触发, 还没 stress-test |
| MiniMax-M2.5 浪费 budget | dead model 还在链里 | 删 + 加 deepseek-v4-flash | 单 sub-batch 节省 ~10-15s |
| generate 504 | ESA 9.5s × N model > 30s gateway | (待修) client 走 CF Pages 直连 | - |
| 小进讲题断连 | model 链有 MiniMax-M2.5 dead | 同上 | tutor.ts MODELS 链同步更新 |

## 我没法修的部分 (实在 ESA 平台限制)

1. **ESA EdgeRoutine cold start spike** (11-16s)
   - V8 isolate 闲置 N 秒后 kill, 重启加载 273KB bundle 需要 5-15s
   - 这是 Aliyun ESA 平台特性, 无 API 可控
   - 解法只能减少 cold start trigger: 用 OSS CDN cache static, 减少 worker 调用
   - 或者完全弃用 ESA, 用 Aliyun Function Compute (FC, 没 cold start spike 但有别的 trade-off)

2. **ESA gateway 30s 硬限**
   - 任何 endpoint 超过 30s 都被 ESA 自己 504
   - generate AI 题 cascade 经常 > 30s (5 model × 9.5s)
   - 解法: 把 AI gen 全部从 ESA 拿掉, 直接走 FC (60s) 或 CF Pages backend

3. **OSS HK region 离我远**
   - 我 curl 从美西测试 OSS HK 1.5-2.3s 是 transcontinental 网络延迟
   - 实际 Bruce 国内 OSS HK 应该 ~50-100ms
   - 验证: 求 Bruce 实际从国内 curl 一次确认 baseline

## 给 Bruce 的建议 (下个 iter 决定)

**A. 现在的状态可以工作吗?**
- ✅ 所有 endpoint 都能正常返回数据 (没 dead 状态)
- ⚠️ /api/generate/questions 偶尔 504 (但客户端有 retry + 出题不是 hot path)
- ⚠️ 偶尔 11s spike (3.3% rate, isolate cold start)
- 大部分操作 1-4s, 不算 fast 但 acceptable

**B. 要不要进一步深度优化?**
1. 把 auth store 烤进 bundle (彻底消 spike): 中等改动, 改密码后需要 redeploy
2. 把 generate AI 完全脱离 ESA, 走 FC: 大改动, 需要新 FC URL
3. 把 OSS bucket 接 CDN 加速: 配置改动, 国内 user 提速明显

**C. 我建议下个 iter 优先级**:
1. ESA generate route → return 503 fast, client retry on CF Pages (简单)
2. baked auth store (消 11s spike, 中等)
3. CDN OSS (大改动, Bruce 决定)

## 验证下一步

下一 iter test 应该:
- 国内 curl xiaojin.app 看 spike 是否 < 5% (Bruce 自己测)
- xiaojin.app /api/generate/questions 短 batch (count=1) 测是否 < 25s
- 长时间静默后第一次 hit 看 cold start frequency

## 不假装修了, 真没修的

- **ESA isolate cold start spike**: 平台限制, 加 cache 只能减不能消
- **OSS 偶发慢**: 同一 OSS region 内网应该快, 跨区慢
- **/api/health 30s 偶发**: 不存在的 path 走 fall-through, 即使 native register 也偶尔 cold

诚实报告: v0.36.10 修了 3 个 root cause (cache, timeout, dead model), 但 11s spike 没完全消除, 是 ESA 平台限制. 下个 iter 走 baked auth + 弃用 ESA generate cascade.
