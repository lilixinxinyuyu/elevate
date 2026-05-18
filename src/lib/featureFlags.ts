/**
 * v0.35.38 Refactor Priority 6 (peer review #2 共识): defineFlag factory.
 *
 * 痛点 (Gemini-3-pro 强调 "绝对应该 SSOT 化"):
 *   每个 isXxxV1() 重复 ~25 行 boilerplate (LS_KEY const + syncFromUrl 函数 +
 *   _synced 标志 + 实际 isXxx 函数). 13 个 flag × 25 行 = 280+ 行重复.
 *   加新 flag 要写 5 个 mechanical change, 漏一个 (e.g. syncFromUrl 没接 ?param)
 *   flag 静默不工作.
 *
 * 解法: defineFlag(opts) 工厂返回 closure, 抽掉所有 boilerplate.
 *
 * 行为兼容 (vs 旧手写版):
 *   - 默认 ON. 仅 localStorage 显式 "false" 关闭. (老代码: `!== "false"`)
 *   - URL ?<param>=on → 清 LS 恢复默认 ON
 *   - URL ?<param>=off → 写 LS "false" 持久关闭
 *   - SSR (typeof window === "undefined") → return defaultOn
 *   - localStorage 异常 (privacy mode 等) → return defaultOn
 *
 * 加新 flag step:
 *   1. 在下方加 `export const isFooV1 = defineFlag({ lsKey: "foo_v1", urlParam: "foo" });`
 *   2. 完
 */

export type FlagOpts = {
  /** localStorage key — 历史 V1 命名约定: "<feature>_v1" */
  lsKey: string;
  /** URL ?<param>=on/off — 可选, 没设就只能 LS 控制 */
  urlParam?: string;
  /** 默认 ON. 现有所有 flag 都是 true. 若有 default OFF flag 显式传 false. */
  defaultOn?: boolean;
};

/**
 * 工厂: 返回 () => boolean 闭包. 内部维护 _synced 状态 (URL 参数只第一次调用时同步).
 */
function defineFlag(opts: FlagOpts): () => boolean {
  const { lsKey, urlParam, defaultOn = true } = opts;
  let synced = false;

  function syncFromUrl() {
    if (typeof window === "undefined" || !urlParam) return;
    try {
      const v = new URLSearchParams(window.location.search).get(urlParam);
      if (v === "on" || v === "true") localStorage.removeItem(lsKey);
      else if (v === "off" || v === "false") localStorage.setItem(lsKey, "false");
    } catch { /* SSR / privacy mode */ }
  }

  return function isOn(): boolean {
    if (typeof window === "undefined") return defaultOn;
    if (urlParam && !synced) {
      syncFromUrl();
      synced = true;
    }
    try {
      const stored = localStorage.getItem(lsKey);
      if (stored === "false") return false;
      if (stored === "true") return true;
      return defaultOn;
    } catch {
      return defaultOn;
    }
  };
}

// ─────────────────────────────────────────────────────────────────────
// 所有 feature flag — 唯一注册处. 加新 flag 在下面一行.
// ─────────────────────────────────────────────────────────────────────

/**
 * Phase 2 内容 (闯关 / 闪电口算 / 3 环 / boss 解锁).
 * v0.31.26 期中后默认 ON. 之后 v0.32 / v0.33 会整个删掉.
 */
export const isPhase2Live = defineFlag({
  lsKey: "phase2_live",
  urlParam: "phase2",
});

/**
 * v0.34.98 (iter 32, P0-0): Accuracy-First scoring.
 * 取消"答得快 = bonus XP". 答对 + 慢 → 深思 +3. 答对 + 太快 → 0 + tooFast.
 */
export const isAccuracyFirstV1 = defineFlag({
  lsKey: "accuracy_first_v1",
  urlParam: "accuracy_first",
});

/**
 * v0.34.98 (iter 32): Force-Fill 简单选择题强制走 plain_numeric 填空.
 * 防 Selena 用"看选项猜". 见 src/core/speedMatchPolicy.ts.
 */
export const isForceFillSimpleV1 = defineFlag({
  lsKey: "force_fill_simple_v1",
});

/**
 * v0.34.98 (iter 32): SpeedMatch 白名单 — 复杂题 fallback 到 plain_numeric.
 */
export const isSpeedMatchWhitelistV1 = defineFlag({
  lsKey: "speedmatch_whitelist_v1",
});

/**
 * v0.34.99 (iter 33 P0-1): Estimation Gate — 多位数 / 应用题强制 round + estimate.
 * 见 src/core/estimationPolicy.ts.
 */
export const isEstimationGateV1 = defineFlag({
  lsKey: "estimation_gate_v1",
  urlParam: "est_gate",
});

/**
 * v0.35.0 (iter 34 P0-2): ScratchInsurance — 软锁 + 草稿险.
 * 见 src/core/scratchPolicy.ts.
 */
export const isScratchInsuranceV1 = defineFlag({
  lsKey: "scratch_insurance_v1",
});

/**
 * v0.35.1 (iter 35 P0-3): MultiStepApplication — 应用题 4 步框架.
 * 已知 / 求 / 算式 / 答. 见 src/core/multiStepPolicy.ts.
 */
export const isMultiStepAppV1 = defineFlag({
  lsKey: "multi_step_app_v1",
});

/**
 * v0.35.2 (iter 36 P1-1): 改错挑战 mini-game.
 * 见 src/core/mistakeHuntPolicy.ts.
 */
export const isMistakeHuntV1 = defineFlag({
  lsKey: "mistake_hunt_v1",
});

/**
 * v0.35.3 (iter 37 P1-2): 强化挑战 — 错答后弹 3 道同型加练.
 * 见 src/core/strengthenPolicy.ts.
 */
export const isStrengthenChallengeV1 = defineFlag({
  lsKey: "strengthen_challenge_v1",
});

/**
 * v0.35.4 (iter 38 P1-3): 进制小课堂 — 4 节微课讲清进率概念.
 * 见 src/core/baseSystemContent.ts.
 */
export const isBaseSystemLessonV1 = defineFlag({
  lsKey: "base_system_lesson_v1",
});

/**
 * v0.35.5 (iter 39 P1-4): 脑力雷达 — Selena 可见 dashboard.
 * 见 src/core/brainpowerRadar.ts.
 */
export const isBrainpowerRadarV1 = defineFlag({
  lsKey: "brainpower_radar_v1",
});

/**
 * v0.35.6 (iter 40 P2-1): 稳准挑战 — 自愿模式逆向奖励.
 * 见 src/core/steadyAimPolicy.ts.
 */
export const isSteadyAimV1 = defineFlag({
  lsKey: "steady_aim_v1",
});

/**
 * v0.35.7 (iter 41 P2-2): 模拟整卷成绩分析报告.
 * 见 src/core/mockExamReport.ts.
 */
export const isMockExamReportV1 = defineFlag({
  lsKey: "mock_exam_report_v1",
});
