# AI 模型与供应商注册表

> **最后更新**: v0.35.14 (2026-05-18)
> **维护原则**: 改 endpoint / 加 key / 加 model 时必同步更新本文档。
>
> ## ⚠️ 费用敏感铁律 (2026-05-18 爸爸明确要求)
> 1. **本文档可能跟实际代码不同步** — 改 wiring 前必须 `grep` 实际代码 verify
> 2. **任何会产生计费请求的代码改动 (image gen / 按量 LLM / TTS / 批量任务) 必须明确得到爸爸同意才能 ship**
> 3. **得到同意可以跨 iter 保持; 同意被撤回必须立刻撤回, 不准默默继续**
> 4. **image gen 当前实际情况 (v0.35.13)**: ESA 上 `aliyun-deploy/src/routes/generate.ts` 只走 BAILIAN async (按量付费), **没有 token-plan 路径**, 因为 EdgeRoutine 11s timeout < token-plan sync image gen 25s. 本文档第 2 章把 token-plan 写为"image 主路径"是**设计意图, 非现实**. v0.35.14 起方案: 走 Aliyun Function Compute (FC, 无 11s 限制) 调 token-plan chat/completions 同步出图. 在此架构改造完成 + 爸爸同意启用前, **image gen endpoint 应保持 disable 状态**.

## 1. Provider 与 Endpoint

### 1.1 主路径：TOKEN_PLAN_CN（北京订阅，按月）

阿里云 Token Plan 国内版订阅服务，**优先用**（成本可控、模型全）。

| 用途 | Endpoint | 协议 |
|---|---|---|
| OpenAI-compatible (chat / image) | `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` | OpenAI 标准 |
| Anthropic-compatible (Claude 等) | `https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic` | Anthropic 标准 |

- **Env var**: `TOKEN_PLAN_CN_API_KEY`
- **Key 格式**: `sk-sp-xxx`
- **Region**: cn-beijing（北京）—— 从 HK Aliyun 后端访问走内网，~50ms
- **计费**: 月订阅，固定额度

### 1.2 Fallback：BAILIAN（百炼 按量付费）

阿里云百炼（DashScope 国内版），**只在 TOKEN_PLAN 重试都失败时 fallback**。

| 用途 | Endpoint | 协议 |
|---|---|---|
| OpenAI-compatible | `https://dashscope.aliyuncs.com/compatible-mode/v1` | OpenAI 标准 |
| 原生 DashScope | `https://dashscope.aliyuncs.com/api/v1` | 阿里自家 |

- **Env var**: `BAILIAN_API_KEY`
- **Key 格式**: `sk-xxx`
- **Region**: cn-hangzhou（杭州）
- **计费**: 按 token 按量付费

### 1.3 例外：实时语音多模态强制走 BAILIAN

下列 **realtime / 多模态语音** 模型 TOKEN_PLAN 不提供，**直接用 BAILIAN 主路径**：

| 模型 | 用途 |
|---|---|
| `qwen3.5-omni-plus` | 实时语音多模态（输入语音 + 输出语音/文字） |
| `qwen3.5-omni-flash` | 同上，flash 版（更便宜更快） |
| （可能的语音 TTS 模型） | TTS / STT 走 BAILIAN |

## 2. 可用模型清单

### 2.1 千问 (Qwen) — 阿里自家

| Model | 用途 | TOKEN_PLAN | BAILIAN |
|---|---|---|---|
| `qwen3.6-plus` | 推理 + 视觉 + 文本 | ✅ 主 | ✅ fallback |
| `qwen3.6-flash` | 同上，flash | ✅ 主 | ✅ fallback |
| `qwen-image-2.0` | 图片生成 | ✅ 主 | ✅ fallback |
| `qwen-image-2.0-pro` | 图片生成 pro | ✅ 主 | ✅ fallback |
| `qwen3.5-omni-plus` | 实时语音多模态 | ❌ | ✅ **主** |
| `qwen3.5-omni-flash` | 实时语音多模态 flash | ❌ | ✅ **主** |

### 2.2 万相 (Wan) — 阿里图像专攻

| Model | 用途 | TOKEN_PLAN | BAILIAN |
|---|---|---|---|
| `wan2.7-image` | 图片生成 | ✅ 主 | ✅ fallback |
| `wan2.7-image-pro` | 图片生成 pro（勋章/校徽推荐） | ✅ 主 | ✅ fallback |

### 2.3 DeepSeek — 推理强

| Model | 用途 | TOKEN_PLAN | BAILIAN |
|---|---|---|---|
| `deepseek-v4-pro` | 推理 + 文本 | ✅ 主 | ✅ fallback |
| `deepseek-v4-flash` | 文本 + 推理 flash | ✅ 主 | ✅ fallback |
| `deepseek-v3.2` | 推理 + 文本 | ✅ 主 | ✅ fallback |

### 2.4 月之暗面 (Kimi) — 长上下文 + 视觉

| Model | 用途 | TOKEN_PLAN | BAILIAN |
|---|---|---|---|
| `kimi-k2.6` | 推理 + 视觉 + 文本 | ✅ 主 | ✅ fallback |
| `kimi-k2.5` | 推理 + 视觉 + 文本 | ✅ 主 | ✅ fallback |

### 2.5 智谱 (GLM) — 通用文本

| Model | 用途 | TOKEN_PLAN | BAILIAN |
|---|---|---|---|
| `glm-5.1` | 文本生成 | ✅ 主 | ✅ fallback |
| `glm-5` | 文本生成 | ✅ 主 | ✅ fallback |

### 2.6 MiniMax — 推理 + 文本

| Model | 用途 | TOKEN_PLAN | BAILIAN |
|---|---|---|---|
| `MiniMax-M2.5` | 推理 + 文本 | ✅ 主 | ✅ fallback |

## 3. 调用决策树（写代码用）

```
需要调 LLM
├─ 任务是 "实时语音多模态"（qwen3.5-omni-*）?
│   └─ Yes → BAILIAN_API_KEY + dashscope endpoint，无 fallback
└─ 其他所有任务（chat / 出题 / 质检 / 视觉理解 / 图片生成）
    ├─ Try TOKEN_PLAN_CN_API_KEY + token-plan endpoint
    │   ├─ Success → return
    │   └─ Fail (5xx / timeout / json parse error)
    │       └─ retry 1-2 次（指数退避）
    │           ├─ Success → return
    │           └─ 仍失败 → fallback BAILIAN
    └─ BAILIAN_API_KEY + dashscope endpoint
        └─ 成功 / 失败按调用方处理
```

## 4. 任务 → 推荐模型映射

| 任务 | 主选 model | 备选 model |
|---|---|---|
| 出题（基础数学/语文） | `qwen3.6-flash` | `glm-5.1` |
| 出题（应用题 / 复杂） | `qwen3.6-plus` | `deepseek-v4-pro` |
| 质检 (judge-questions) | `qwen3.6-flash`（批量快） | `deepseek-v4-flash` |
| 修题 (fix-question) | `qwen3.6-plus`（精确） | `kimi-k2.6` |
| 讲题 (tutor 文本) | `qwen3.6-plus` | `deepseek-v4-pro` |
| 视觉理解（带图题） | `qwen3.6-plus` | `kimi-k2.6` |
| 勋章/校徽生图 | `wan2.7-image-pro` | `qwen-image-2.0-pro` |
| 装饰小图 | `qwen-image-2.0` | `wan2.7-image` |
| 实时语音对话（小进） | `qwen3.5-omni-flash` | (无 fallback) |

## 5. Cloudflare Pages Functions / ESA EdgeRoutine 环境变量

部署前必须设：

| Env Var | 必填 | 用途 |
|---|---|---|
| `TOKEN_PLAN_CN_API_KEY` | ✅ | 主路径（北京订阅版） |
| `BAILIAN_API_KEY` | ✅ | fallback + 实时语音 |
| ~~`TOKEN_PLAN_API_KEY`~~ | ⚠️ deprecated | 老 SG intl key，可删 |
| ~~`DASHSCOPE_API_KEY`~~ | ⚠️ deprecated | 老 intl key，可删 |

迁完后老的 2 个 env var 可以从 CF Pages / FC / ESA 删掉。

## 6. ESA AI 加速（未来优化，暂未启用）

阿里云 ESA 自带 AI Gateway 功能：

- **Token 流式加速**: SSE / WebSocket 边缘 buffer + chunk merging
- **语义级 cache**: 相同/相似 prompt 边缘缓存
- **AI 安全**: prompt injection / token bomb 防护

**何时启用**：
- 用户量 > 20（同学加入后）
- 或 LLM 调用 QPS 持续 > 1

**配置位置**: ESA 控制台 → 边缘程序 / AI 加速 → 添加 AI 应用
- Upstream: `token-plan.cn-beijing.maas.aliyuncs.com`
- Domain: `ai.xiaojin.app`（或自定义）

## 7. 历史变更

| 日期 | 版本 | 变更 |
|---|---|---|
| 2026-05 | v0.33.59 | 文档创建。从 intl (SG) 切到国内（北京/杭州）。引入 TOKEN_PLAN_CN 主 + BAILIAN fallback 策略 |
| 之前 | v0.33.x | TOKEN_PLAN_API_KEY (intl SG) + DASHSCOPE_API_KEY (intl) 双源 |
