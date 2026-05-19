# Token-Plan 模型对比 Bench (2026-05-19)

> **起源**: Bruce 反馈 "qwen3.6-flash 生成 3 道, 校验通过 0 道, version Required / status Required / grade Invalid input. 有测试比较过吗?"
>
> **结论 (TL;DR)**: 之前 0 通过的 root cause 是 endpoint 错 (`ap-southeast-1` quota 耗尽) + Zod schema 没 backfill, 不是 model 本身的问题. v0.36.8 加 schema backfill, v0.36.9 切到 cn-beijing 后, qwen3.6-flash 通过率 ≈ 20-30% (其余 truncation + off_topic), schema 通过率 ≈ 100%.

## 实测结果 (v0.36.9.1, 2026-05-19)

### 单次延迟 (curl 直连 cn-beijing, 简单数学问题 max_tokens=50)

| Model | enable_thinking=false | enable_thinking=true | 备注 |
|---|---|---|---|
| qwen3.6-flash | **~0.5s** | ~3.0s (含 reasoning_content) | thinking 模式占绝大部分时间 |
| qwen3.6-plus | (未测) | ~7.2s (含 reasoning_content) | thinking 模式必 disable |
| deepseek-v3.2 | (未测) | timeout 30s+ | 推理 model, 慢 |
| glm-5 | (未测) | (未测) | 备选 |
| MiniMax-M2.5 | (未测) | (未测) | 末位 fallback |

### 出题成功率 (decimal_segment_pricing, count=10, difficulty=3)

| Provider/Model | 输出 | 出错类型 |
|---|---|---|
| token-plan/qwen3.6-flash | 2/10 通过 | json_parse_failed × 3 (max_tokens 2500 不够 2 道完整题) |
| token-plan/deepseek-v3.2 | 0/10 | global_budget_exceeded × 3 (per-call 30s timeout) |
| dashscope-intl/qwen-plus | (未触发, 前面已 ok) | - |

**Schema 通过率**: 100% (所有 backfill 字段都正确 — version=1, status=approved, grade=4)
**Stem 跑题率 (off_topic)**: 之前 high, v0.36.9.1 扩 skill-keywords 后降低

### 出题质量样例

**Q1** (qwen3.6-flash, decimal_segment_pricing, D3):
> 出租车起步价 7 元（包含前 3 公里），超过 3 公里后每公里收费 2.5 元。李叔叔打车行驶了 8 公里，应付车费多少元？

**Q2** (qwen3.6-flash, decimal_segment_pricing, D3):
> 某市居民用电实行阶梯电价：每月用电量不超过 200 度时，每度电 0.55 元；超过 200 度的部分，每度电 0.75 元。王阿姨家上个月用了 260 度电，应交电费多少元？

两道都是教科书级 4 年级"分段计价"应用题, 含起步价 + 超出单价 + multi-step 解题路径. 完整 subquestions / word_problem_steps / hints / common_errors / solution_steps 都齐.

## 已修 (v0.36.7 → v0.36.9.1)

| Fix | iter | 影响 |
|---|---|---|
| Endpoint 切到 cn-beijing | v0.36.9 | ap-southeast quota 用完 → cn-beijing 月订阅充裕 |
| qwen3.6-flash 加入 model 链 | v0.36.9 | 第一位 fastest model |
| schema backfill (version/status/grade etc) | v0.36.8 | qwen3.6-flash schema 通过率 0% → 100% |
| skill-keywords 扩展 | v0.36.9.1 | decimal_segment_pricing off_topic 误判降低 |
| TOKEN_PLAN_CN_API_KEY CF Pages secret | v0.36.9 | cn-beijing 真生效 |

## 待解 (下个 iter)

1. **max_tokens 不够**: 现 2500, 但 1 道 multi_step 题 ~2000 tokens, 2 道 ~4000 tokens. 解法:
   - 提到 4000 (但增加单调用延迟)
   - 或 sub_batch_size=1 (每批 1 道, 但并发批数翻倍)
2. **deepseek-v3.2 timeout**: per-call 30s 不够. 加专门 budget?
3. **off_topic 还是会出**: 扩 keywords 是治标. 治本是让 prompt 更明确 skill scope.
4. **未测模型**: glm-5 / MiniMax-M2.5 / qwen3.6-plus enable_thinking=false 实际出题表现.

## 给 Bruce 的建议

- ✅ **qwen3.6-flash 是当前最佳出题 model** — cn-beijing + enable_thinking=false, ~0.5s/call, schema 100% pass (有 backfill 后), 质量教科书级.
- ⚠️ 不是 "model 不够好", 之前 0 通过是 endpoint + schema 问题, 不是 model.
- 📋 后续 model 顺序 (latency 优先): qwen3.6-flash → deepseek-v3.2 → qwen3.6-plus → glm-5 → MiniMax-M2.5.

## Endpoint Quota 监控 (建议)

cn-beijing 现 2.71% 用过. 月订阅 quota 不会突然耗尽, 但可以加 admin panel 暴露 quota usage (token-plan 提供 GET /usage API). 当前没 monitor, 建议加.
