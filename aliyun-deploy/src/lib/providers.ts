/**
 * AI Provider 配置：TOKEN_PLAN_CN 主 + BAILIAN fallback。
 *
 * 决策树详见 docs/ai-models-registry.md：
 *   - 实时语音（qwen3.5-omni-*）→ 直接走 BAILIAN，无 fallback
 *   - 其他所有 chat/image/judge 任务 → TOKEN_PLAN_CN 主，BAILIAN fallback
 */

import type { Env } from "./env";

export interface AiProvider {
  baseUrl: string;
  apiKey: string;
  label: "token-plan-cn" | "bailian" | "token-plan-intl" | "dashscope-intl";
}

/** Chat 任务：出题 / 质检 / 修题 / 讲题 */
export function getChatProviders(env: Env): AiProvider[] {
  const providers: AiProvider[] = [];
  if (env.TOKEN_PLAN_CN_API_KEY) {
    providers.push({
      baseUrl: "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
      apiKey: env.TOKEN_PLAN_CN_API_KEY,
      label: "token-plan-cn",
    });
  }
  if (env.BAILIAN_API_KEY) {
    providers.push({
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: env.BAILIAN_API_KEY,
      label: "bailian",
    });
  }
  // 兼容老 intl key（迁完可删）
  if (env.TOKEN_PLAN_API_KEY) {
    providers.push({
      baseUrl: "https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
      apiKey: env.TOKEN_PLAN_API_KEY,
      label: "token-plan-intl",
    });
  }
  if (env.DASHSCOPE_API_KEY) {
    providers.push({
      baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
      apiKey: env.DASHSCOPE_API_KEY,
      label: "dashscope-intl",
    });
  }
  return providers;
}

/** Image 任务：勋章 / 校徽 / 装饰图 */
export function getImageProviders(env: Env): AiProvider[] {
  // Image 同 chat 决策树（pro 模型 token-plan 有，bailian 也有）
  return getChatProviders(env);
}

/** Chat 模型链（按 provider 排选） */
export function getChatModels(p: AiProvider): string[] {
  if (p.label === "token-plan-cn" || p.label === "bailian") {
    // 国内版主链：qwen3.6 主，deepseek-v4 fallback（推理/复杂任务）
    return ["qwen3.6-flash", "qwen3.6-plus", "deepseek-v4-pro", "deepseek-v4-flash", "glm-5.1"];
  }
  // 旧 intl 兜底
  if (p.label === "token-plan-intl") {
    return ["deepseek-v3.2", "glm-5", "MiniMax-M2.5", "qwen3.6-plus"];
  }
  return ["qwen-plus"];
}

/** Image 模型链 */
export function getImageModels(p: AiProvider): string[] {
  if (p.label === "token-plan-cn" || p.label === "bailian") {
    return ["wan2.7-image-pro", "wan2.7-image", "qwen-image-2.0-pro", "qwen-image-2.0"];
  }
  if (p.label === "token-plan-intl") {
    return ["wan2.7-image-pro", "wan2.7-image", "qwen-image-2.0-pro", "qwen-image-2.0"];
  }
  return ["wanx2.1-t2i-turbo", "wanx2.1-t2i-plus", "wanx-v1"];
}

/** 实时语音多模态：硬走 BAILIAN（TOKEN_PLAN 不提供） */
export function getVoiceProvider(env: Env): AiProvider | null {
  if (!env.BAILIAN_API_KEY) return null;
  return {
    baseUrl: "https://dashscope.aliyuncs.com",
    apiKey: env.BAILIAN_API_KEY,
    label: "bailian",
  };
}
