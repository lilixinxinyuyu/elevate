/**
 * v0.35.48 Refactor Priority 15 (GameShell 拆分 step 2): 抽 feedback labels 纯函数.
 *
 * 痛点: FeedbackPanel 里 ~50 行 if/else 链 (深思 / 太快 / 闪电 / 迅速 / 及时 /
 * 超时 / 拖拉 / 草稿险 / 估算 / 重做 / 新知识点) 跟 UI 渲染混在一起, 测试只能
 * mount 整个 GameShell.
 *
 * 提取后: 纯函数 (signal in / labels out), 易单测, GameShell 调用方一行.
 *
 * 每个 label 文案 / emoji 都跟历史 v0.28.1 ... v0.35.0 保留, 顺序也保留 (避免
 * UI 顺序 regression).
 */

export type FeedbackLabelInput = {
  isCorrect: boolean;
  /** v0.34.98 iter 32 P0-0a: Accuracy-First flag — 显示"答太快请检查" nudge */
  tooFast?: boolean;
  /** v0.34.98 iter 32 P0-0a: Accuracy-First flag — 显示"🧠 深思 +5" bonus */
  slowThink?: boolean;
  /** v0.28.1: 阶梯速度档位 — accuracy_first 关闭时 fallback 显示 */
  speedTier?: "lightning" | "quick" | "on_time" | "overdue" | "slow";
  /** 重做衰减 (e.g. 0.75 = ×75%) */
  repeatDecay?: number;
  /** 第一次拿到的 skill bonus XP (默认 5) */
  newSkillBonus?: number;
  /** v0.34.99 iter 33 P0-1: 估算 phase XP */
  estimationXp?: number;
  /** v0.34.99 iter 33 P0-1: 估算量级偏差大 → 提示 (仅正确时显示) */
  estimationMagnitudeMismatch?: boolean;
  /** v0.35.0 iter 34 P0-2: 草稿险 — 写了草稿但错了, XP 不扣 */
  insuredWrong?: boolean;
  /** v0.35.28 (爸爸第 4 次反馈): write-heavy 题 (canvas/multi_step) countdown 关 → speed 档位完全不显示 */
  countdownEnabled: boolean;
};

export function buildFeedbackLabels(input: FeedbackLabelInput): string[] {
  const {
    isCorrect, tooFast, slowThink, speedTier, repeatDecay, newSkillBonus,
    estimationXp, estimationMagnitudeMismatch, insuredWrong, countdownEnabled,
  } = input;
  const labels: string[] = [];

  // 1. 深思 / 太快 (Accuracy-First) 优先于老速度档位
  if (isCorrect && slowThink) {
    labels.push("🧠 深思 +5");
  } else if (isCorrect && tooFast) {
    // 软化文案 (post-review Gemini + GPT 共识: 不指责, 给可操作建议)
    labels.push("⏱️ 刚才很快, 下次试试先估一估");
  } else if (countdownEnabled) {
    // 老阶梯速度奖励 (accuracy_first 关闭时, 且 countdown 启用时显示)
    // v0.35.64 (User Flow Review P0-4, Gemini + GPT 共识 cross-validated):
    // 删 "⏰ 超时" / "🐢 拖拉 -1" — 10 岁孩子 negative labeling 严重抹杀成就感.
    // 只保留正向 (闪电/迅速/及时), 慢答不显示 sad chip + scoring 不扣 XP.
    if (isCorrect && speedTier === "lightning") labels.push("⚡⚡⚡ 闪电 +5");
    else if (isCorrect && speedTier === "quick") labels.push("⚡⚡ 迅速 +3");
    else if (isCorrect && speedTier === "on_time") labels.push("⚡ 及时 +2");
    // overdue / slow tiers 不再返 (scoring.ts 改成统一返 on_time + 0 XP),
    // 但保留 case 容错: 若上游传旧 tier 值进来, 不显示 chip (防回归).
  }

  // 2. 重做衰减
  if (isCorrect && repeatDecay !== undefined && repeatDecay < 1.0 && repeatDecay > 0) {
    labels.push(`重做 ×${Math.round(repeatDecay * 100)}%`);
  } else if (isCorrect && repeatDecay === 0) {
    labels.push("已熟练，不再加分");
  }

  // 3. 新知识点 bonus
  if (newSkillBonus && newSkillBonus > 0) {
    labels.push(`🎓 新知识点 +${newSkillBonus}`);
  }

  // 4. 估算 phase
  if (estimationXp && estimationXp > 0) {
    labels.push(`🧠 估算 +${estimationXp}`);
  }
  if (estimationMagnitudeMismatch && isCorrect) {
    labels.push("⚖️ 数量级跟估算差距大, 下次更准");
  }

  // 5. 草稿险
  if (insuredWrong) {
    labels.push("🛡️ 草稿险生效 — XP 不扣");
  }

  return labels;
}
