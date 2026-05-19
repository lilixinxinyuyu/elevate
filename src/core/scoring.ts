import type { AbilityId, Question } from "./types";
import { adjustedEstimatedTime } from "./timing";
import { isAccuracyFirstV1 } from "../lib/featureFlags";
import { isSpeedEligible } from "./speedMatchPolicy";
import { isSteadyAimActive, getSteadyAimXp } from "./steadyAimPolicy";

export interface ScoreInput {
  question: Question;
  isCorrect: boolean;
  partialCorrect?: boolean;
  multiStepAllStepsCorrect?: boolean;
  hintsOpened: number;
  elapsedSeconds: number;
  isReview: boolean;
  comboAfter: number; // 本题答完后的连击数
  /** 之前答对过这道题几次（仅 isCorrect=true 的次数）。0 = 第一次答对（无递减） */
  priorCorrectCount?: number;
  /** 是否是该 skill 的首次答对（学到新知识点 +5 XP） */
  isNewSkill?: boolean;
  /**
   * v0.30.7: 这次答题前是否打开过"小进讲题"。
   * usedTutor + isCorrect → tutor-assisted 答对：基础分 ×0.7、无 combo 倍率、
   * 无速度奖励、无新 skill 奖励、无复习奖励。本质上"借助讲解才答对"，
   * 不能跟独立答对等价计 XP。
   */
  usedTutor?: boolean;
  /**
   * v0.30.7: 同一道题在本 session 里第几次作答（1 / 2）。
   * - 1: 第一次作答（正常加成）
   * - 2: 1st 错答之后的重做提交（无 combo/无速度奖励，因为已经有了"先错"的事实）
   * 注：对 isCorrect=true & attemptOrdinal=2 但 usedTutor=false 的情况——
   *     即"自己想通了再做对"——还是给 base XP（独立学习），但没 combo/速度。
   */
  attemptOrdinal?: 1 | 2;
  /**
   * v0.30.12: 本 skill 历史已答对题数（含本次之前的所有 correct attempt）。
   * 用于 siblingDecayMultiplier 防"姊妹题刷分"。
   * 不传时 default 0（=学习期，全分）。
   */
  skillCorrectCount?: number;
}

export interface ScoreDelta {
  total: number;
  byAbility: Partial<Record<AbilityId, number>>;
  base: number;
  hintPenalty: number;
  comboMul: number;
  timeBonus: number;
  /** 重做递减倍率（0-1）。1.0 = 首次答对；0.5/0.2/0.1 = 第 2/3/4 次；0 = 第 5+ 次 */
  repeatDecay: number;
  /** 新知识点首次答对的奖励 XP（5 或 0） */
  newSkillBonus: number;
  /**
   * v0.34.98 (iter 32 P0-0a) Accuracy-First mode:
   * - tooFast = true: 答对但用时 < 40% 估算 → UI 弹"答太快, 检查估算和单位" 温和提示
   *   (不扣分, 不算错, 只是元认知 nudge)
   * - slowThink = true: 答对且用时 ≥ 150% 估算 → +3 XP "🧠 深思 bonus"
   * 仅当 isAccuracyFirstV1() 返回 true 时填充. 老逻辑下两者都 false.
   */
  tooFast?: boolean;
  slowThink?: boolean;
}

export function comboMultiplier(combo: number): number {
  if (combo >= 10) return 2.0;
  if (combo >= 5) return 1.5;
  if (combo >= 3) return 1.2;
  return 1.0;
}

/**
 * 重复递减倍率：同一道题已经答对过 N 次后，再次答对的 XP 倍率。
 * 配合 priorCorrectCount 使用：
 *   priorCorrect 0 (本次是第 1 次对) → 1.0 (满分)
 *   priorCorrect 1 (本次是第 2 次对) → 0.5
 *   priorCorrect 2 (本次是第 3 次对) → 0.2
 *   priorCorrect 3 (本次是第 4 次对) → 0.1
 *   priorCorrect 4+ (第 5 次以后)   → 0   （**纯刷量不加分**）
 *
 * 累计：一道题最多挤出 1.0+0.5+0.2+0.1 = 1.8 倍 base XP。
 */
export const REPEAT_DECAY = [1.0, 0.5, 0.2, 0.1] as const;
export const NEW_SKILL_BONUS = 5;

export function repeatDecayMultiplier(priorCorrectCount: number): number {
  if (priorCorrectCount < 0) return 1.0;
  if (priorCorrectCount >= REPEAT_DECAY.length) return 0;
  return REPEAT_DECAY[priorCorrectCount] ?? 0;
}

/**
 * v0.30.12: skill-sibling 衰减——防"姊妹题刷分"。
 *
 * 同一 skill 累计已答对 N 题（不同 question_id 但同 skill+难度+题型本质相同）后，
 * 再做"姊妹题"的 XP 递减：
 *   0-7   → 1.0  学习期，给满分
 *   8-14  → 0.7  巩固期
 *   15-22 → 0.4  熟练期
 *   23+   → 0.2  深度饱和（已经掌握，再刷不加多少分）
 *
 * 跟 repeatDecay（同一题 ID 衰减）叠加：repeatDecay × siblingDecay
 *
 * 注：这里只看同 skillId 的历史 correct count（不细到难度/题型），简化实现。
 * 难度差异通过 difficultyMul 在 base 公式里已经体现。
 */
export const SIBLING_DECAY: Array<{ upTo: number; mul: number }> = [
  { upTo: 7, mul: 1.0 },
  { upTo: 14, mul: 0.7 },
  { upTo: 22, mul: 0.4 },
  { upTo: Infinity, mul: 0.2 },
];

export function siblingDecayMultiplier(skillCorrectCount: number): number {
  if (skillCorrectCount <= 0) return 1.0;
  for (const { upTo, mul } of SIBLING_DECAY) {
    if (skillCorrectCount <= upTo) return mul;
  }
  return 0.2;
}

/**
 * 阶梯速度奖励（v0.28.1, v0.35.64 删负反馈）— 答快有奖, 答慢不罚.
 *
 *   < 50% 估算时间  →  +5 XP "⚡⚡⚡ 闪电"
 *   < 80%           →  +3 XP "⚡⚡ 迅速"
 *   ≤ 100%          →  +2 XP "⚡ 及时"  (老版本只有这一档)
 *   > 100%          →   0    "on_time" (不显示负面 label)
 *
 * v0.35.64 (User Flow Review P0-4, Gemini + GPT 共识):
 *   删 "⏰ 超时" / "🐢 拖拉 -1" — 对 10 岁女孩是 negative labeling, 抹杀
 *   成就感引发逆反 (Selena 43% → 心理避风港优先).
 *   速度只给正向 (闪电/迅速/及时), 慢答 0 XP 但**不显示 sad label, 不扣 XP**.
 *
 * 仅 isCorrect=true 时计算, 错答不奖也不罚速度.
 */
export function speedBonus(elapsedSeconds: number, estimatedSeconds: number, isCorrect: boolean): {
  bonus: number;
  tier: "lightning" | "quick" | "on_time" | "overdue" | "slow";
} {
  if (!isCorrect) return { bonus: 0, tier: "on_time" };
  const ratio = elapsedSeconds / Math.max(1, estimatedSeconds);
  if (ratio < 0.5) return { bonus: 5, tier: "lightning" };
  if (ratio < 0.8) return { bonus: 3, tier: "quick" };
  if (ratio <= 1.0) return { bonus: 2, tier: "on_time" };
  // v0.35.64: 之前 overdue (1.0-1.5×) / slow (>1.5×) 返 0 / -1 XP + 负 label.
  // 现在统一返 on_time tier (0 XP), buildFeedbackLabels 看到 on_time + 慢 ratio 不显示 chip.
  return { bonus: 0, tier: "on_time" };
}

/**
 * v0.34.98 (iter 32 P0-0a) Accuracy-First 速度评分 — 取代 speedBonus 的新逻辑.
 *
 * 起因: Selena 43% 期中事件三方分析共识 — 速度奖励训练 System-1 反射,
 *   但真题需 System-2 推理. 必须取消 "答得快 +bonus", 改奖励 "答得稳".
 *
 * 新阶梯 (v0.34.98 iter 32 post-review Gemini 整合):
 *   ratio < 0.4         → bonus 0, tier "too_fast"   (UI nudge "刚才很快, 估算一下")
 *   ratio ∈ [0.4, 1.0)  → bonus 0, tier "normal"     (中性, 不奖不罚)
 *   ratio ∈ [1.0, 1.5)  → bonus 0, tier "deliberate" (中性, 在思考)
 *   ratio ∈ [1.5, 4.0]  → bonus +5, tier "deep_think" (🧠 深思 bonus, 鼓励慢)
 *   ratio > 4.0         → bonus 0, tier "afk" (anti-挂机: 太久 = 发呆 / 走神, 不奖)
 *
 * 整合 review:
 *  - Gemini #5: bonus +3 → +5 — 接受, 匹敌老 "闪电 +5" 给强信号
 *  - Gemini #7: anti-AFK 上限 ratio ≤ 4.0 — 接受, 防止 Selena 发呆刷分
 *  - GPT #5 "怕 game 阈值": 仅复杂题用此公式 (简单 speed-eligible 题保留老 bonus),
 *      所以阈值 game 只在多步/多位题上发生 — 那场景下 "等 1.5×" 反而是正确行为 (深思)
 *
 * 仅 isCorrect=true 时计算.
 */
export function speedBonusAccuracyFirst(
  elapsedSeconds: number,
  estimatedSeconds: number,
  isCorrect: boolean,
): {
  bonus: number;
  tier: "too_fast" | "normal" | "deliberate" | "deep_think" | "afk";
} {
  if (!isCorrect) return { bonus: 0, tier: "normal" };
  const ratio = elapsedSeconds / Math.max(1, estimatedSeconds);
  if (ratio < 0.4) return { bonus: 0, tier: "too_fast" };
  if (ratio < 1.0) return { bonus: 0, tier: "normal" };
  if (ratio < 1.5) return { bonus: 0, tier: "deliberate" };
  if (ratio <= 4.0) return { bonus: 5, tier: "deep_think" };
  return { bonus: 0, tier: "afk" };
}

/**
 * v0.30.9 调整 0.7 → 0.5：用户反馈"宁可分数偏严，错题以后重做还能拿分，
 * 不希望分数虚高"。tutor-assisted 答对（讲题之后才对的）只给 base 50%。
 */
export const TUTOR_ASSISTED_FACTOR = 0.5;

/**
 * v0.31.50: 难度加权 XP — 让"做难题"的回报跟付出对齐。
 *
 * index = difficulty (1-5)，index 0 占位（difficulty 不会是 0）。
 *
 * 设计原则：
 *  - D1 (1.0×): 启蒙、热身。基准。
 *  - D2 (1.5×): 标准课内。
 *  - D3 (3.0×): 略难的课内 / 入门拓展。"动了脑子"。
 *  - D4 (6.0×): 真正难题。一道顶过去 4 道 D2，给得起。
 *  - D5 (10.0×): 挑战 / 拓展极限题。罕见但重奖。
 *
 * 不追溯：老 attempt 的 XP 已经按旧公式存进 scoreDelta.total，本次只影响新作答。
 */
export const DIFFICULTY_WEIGHTS = [0, 1.0, 1.5, 3.0, 6.0, 10.0] as const;

export function scoreAttempt(input: ScoreInput): ScoreDelta {
  const { question, isCorrect, hintsOpened, elapsedSeconds, isReview, multiStepAllStepsCorrect, comboAfter } = input;
  const usedTutor = !!input.usedTutor;
  const isSecondAttempt = (input.attemptOrdinal ?? 1) === 2;

  // v0.30.7：tutor-assisted 答对 = "借助讲解才答对"，所有奖励降权
  const tutorAssisted = isCorrect && usedTutor;
  // 不享受 combo/速度奖励的 case：1) 2nd 提交（已有"先错"事实）2) tutor-assisted（防御性，
  // 实际上 usedTutor=true 永远跟 ordinal=2 一起出现，但留个 belt-and-suspenders）
  const noBonusAttempt = isSecondAttempt || tutorAssisted;

  const base = 10;
  // v0.31.50: 难度加权放大——之前 D4 只比 D1 多 60%（1.6× vs 1.0×），
  // Selena 启蒙期题简单 → 现在题难，"努力 5×、回报 1.6×"严重不公平 → 进度感塌陷。
  // 新公式 D2=1.5× / D3=3× / D4=6× / D5=10×，匹配实际付出。
  // 不追溯老 attempt，仅对未来生效。
  const difficultyMul = DIFFICULTY_WEIGHTS[
    Math.min(DIFFICULTY_WEIGHTS.length - 1, Math.max(1, question.difficulty))
  ] ?? 1.0;
  const correctFactor = isCorrect
    ? (tutorAssisted ? TUTOR_ASSISTED_FACTOR : 1)
    : (input.partialCorrect ? 0.5 : 0.2);
  // 速度奖励：仅 1st 答对独享
  // v0.31.51: 用 adjustedEstimatedTime 而不是裸 question.estimated_time_seconds，
  //           长题（stem ≥60 字 / 多行选项）的时间在运行时加成，跟 GameShell 倒计时一致
  // v0.34.98 (iter 32 P0-0a) Accuracy-First scope:
  //   - isAccuracyFirstV1() OFF (回滚) → 一律老 speedBonus
  //   - isAccuracyFirstV1() ON + 简单 speed-eligible 题 → 老 speedBonus (爸爸: 简单速算还是要奖)
  //   - isAccuracyFirstV1() ON + 复杂题 (多步/多位/应用题) → 新 speedBonusAccuracyFirst (取消快奖, +深思)
  let timeBonus = 0;
  let tooFast = false;
  let slowThink = false;
  if (!noBonusAttempt) {
    const est = adjustedEstimatedTime(question);
    // v0.35.6 iter 40: 稳准挑战 mode 优先 — 主动逆向 reward
    if (isSteadyAimActive()) {
      const r = getSteadyAimXp(elapsedSeconds, est, isCorrect);
      timeBonus = r.bonus;
      tooFast = r.tier === "too_fast";
      slowThink = r.tier === "deep_think";
    } else {
      const accuracyFirst = isAccuracyFirstV1();
      const allowSpeedReward = !accuracyFirst || isSpeedEligible(question);
      if (allowSpeedReward) {
        timeBonus = speedBonus(elapsedSeconds, est, isCorrect).bonus;
      } else {
        const r = speedBonusAccuracyFirst(elapsedSeconds, est, isCorrect);
        timeBonus = r.bonus;
        tooFast = r.tier === "too_fast";
        slowThink = r.tier === "deep_think";
      }
    }
  }
  const hintPenalty = -hintsOpened;
  // multi-step + review + new-skill 奖励都属于"真功夫"加成，tutor-assisted 不给
  const stepBonus = (multiStepAllStepsCorrect && !tutorAssisted) ? 3 : 0;
  const reviewBonus = (isReview && isCorrect && !tutorAssisted) ? 2 : 0;
  // combo 倍率：tutor-assisted 或 2nd 提交都不享受
  const comboMul = (isCorrect && !noBonusAttempt && !tutorAssisted)
    ? comboMultiplier(comboAfter)
    : 1;

  const raw = base * difficultyMul * correctFactor + timeBonus + hintPenalty + stepBonus + reviewBonus;

  // 重做递减：只对答对的题应用（错答本来就只拿 0.2× base 极少分，不再扣）
  const repeatDecay = isCorrect ? repeatDecayMultiplier(input.priorCorrectCount ?? 0) : 1.0;

  // v0.30.12: skill-sibling 衰减 —— 同 skill 累计 correct 太多了再刷"姊妹题"也降权
  // 跟 repeatDecay 叠加：repeatDecay × siblingDecay
  const siblingDecay = isCorrect
    ? siblingDecayMultiplier(input.skillCorrectCount ?? 0)
    : 1.0;

  // 新知识点首次答对：固定 +5 XP（不受 decay 影响）。tutor-assisted 不算"学到了"
  const newSkillBonus = (isCorrect && input.isNewSkill && !tutorAssisted) ? NEW_SKILL_BONUS : 0;

  // 答错保持原 1 分下限；答对走 decay 后允许为 0（5+ 次纯刷不给分）
  const decayed = raw * comboMul * repeatDecay * siblingDecay;
  const totalRaw = decayed + newSkillBonus;
  const total = isCorrect
    ? Math.max(0, Math.round(totalRaw))
    : Math.max(1, Math.round(decayed));

  const abilities = question.ability_dimension.length > 0 ? question.ability_dimension : (["calculation"] as AbilityId[]);
  const share = Math.max(1, Math.round(total / abilities.length));
  const byAbility: Partial<Record<AbilityId, number>> = {};
  for (const a of abilities) byAbility[a] = share;
  if (isReview && isCorrect && !tutorAssisted) byAbility.habit = (byAbility.habit ?? 0) + 1;

  return {
    total,
    byAbility,
    base,
    hintPenalty,
    comboMul,
    timeBonus,
    repeatDecay,
    newSkillBonus,
    tooFast,
    slowThink,
  };
}

export function levelFromXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / 500) + 1;
}

export function xpToNextLevel(xp: number): { need: number; into: number; total: number } {
  const level = levelFromXp(xp);
  const levelStart = (level - 1) * 500;
  const into = xp - levelStart;
  const total = 500;
  return { need: total - into, into, total };
}
