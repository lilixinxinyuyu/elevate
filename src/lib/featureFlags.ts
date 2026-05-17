/**
 * Phase 2 feature flag — `PHASE2_LIVE`
 *
 * **v0.31.26 期中考试完，全局默认翻 ON。** 所有 Selena / 爸妈 / 任何设备
 * 自动看到 Phase 2 内容（闯关 / 闪电口算 / 3 环 / boss 解锁等）。
 *
 * 保留 opt-out 通道（极端情况下回滚用）：
 *   - URL 参数：`?phase2=off`（写 "false" 进 localStorage 关闭）
 *   - localStorage：`localStorage.setItem("phase2_live", "false")` 显式关
 *   - URL `?phase2=on` 把开关重新打开（清掉 false）
 *
 * 之后 v0.32 / v0.33 会把这个 flag 整个删掉，代码不再分 Phase 1/2 路径。
 */

const PHASE2_LS_KEY = "phase2_live";
const PHASE2_URL_PARAM = "phase2";

/** 检查并应用 URL 参数 ?phase2=on / ?phase2=off — 一次性写进 localStorage */
function syncFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const v = params.get(PHASE2_URL_PARAM);
    if (v === "on" || v === "true") {
      // 重新开 → 清掉 opt-out 标记，恢复默认（true）
      localStorage.removeItem(PHASE2_LS_KEY);
    } else if (v === "off" || v === "false") {
      // opt-out → 显式写 "false"，下次加载也保持关闭
      localStorage.setItem(PHASE2_LS_KEY, "false");
    }
  } catch {
    /* SSR / disabled localStorage */
  }
}

let _synced = false;

export function isPhase2Live(): boolean {
  // v0.31.26 期中后默认 ON。检查 opt-out 通道：仅当显式 "false" 时才关闭。
  if (typeof window === "undefined") return true;
  if (!_synced) {
    syncFromUrl();
    _synced = true;
  }
  try {
    return localStorage.getItem(PHASE2_LS_KEY) !== "false";
  } catch {
    return true;
  }
}

/**
 * v0.34.98 (iter 32, P0-0): Accuracy-First scoring.
 *
 * 取消"答得快 = bonus XP" 设计 (Selena 43% 期中事件根因之一 - 反复强化反射,
 * 没培养 System-2 推理). 新公式:
 *   - 答对 + 用时 ≥ 1.5× 估算 → +3 XP "🧠 深思 bonus"
 *   - 答对 + 用时 < 0.4× 估算 → 0 + tooFast flag (UI 显示 "答太快, 请检查估算和单位")
 *   - 其他 → 0 速度奖
 *
 * 默认 ON. opt-out: localStorage.setItem("accuracy_first_v1", "false")
 * (回到老速度奖逻辑, 用于 A/B 对照或紧急回滚).
 *
 * URL 参数: ?accuracy_first=off
 */
const ACCURACY_FIRST_LS_KEY = "accuracy_first_v1";

function syncAccuracyFirstFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("accuracy_first");
    if (v === "on" || v === "true") {
      localStorage.removeItem(ACCURACY_FIRST_LS_KEY);
    } else if (v === "off" || v === "false") {
      localStorage.setItem(ACCURACY_FIRST_LS_KEY, "false");
    }
  } catch { /* SSR */ }
}

let _accuracyFirstSynced = false;

export function isAccuracyFirstV1(): boolean {
  // 默认 ON. 仅显式 "false" 时关闭.
  if (typeof window === "undefined") return true;
  if (!_accuracyFirstSynced) {
    syncAccuracyFirstFromUrl();
    _accuracyFirstSynced = true;
  }
  try {
    return localStorage.getItem(ACCURACY_FIRST_LS_KEY) !== "false";
  } catch {
    return true;
  }
}

/**
 * v0.34.98 (iter 32, P0-0): Force-Fill 简单选择题.
 *
 * 简单计算 (单步, 个/十位数) 的 single_choice 强制走 plain_numeric 填空模板,
 * 防 Selena 用"看选项猜" 绕过实际计算. 详见 src/core/speedMatchPolicy.ts.
 *
 * 默认 ON. opt-out: localStorage.setItem("force_fill_simple_v1", "false")
 */
const FORCE_FILL_LS_KEY = "force_fill_simple_v1";

export function isForceFillSimpleV1(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(FORCE_FILL_LS_KEY) !== "false";
  } catch {
    return true;
  }
}

/**
 * v0.34.98 (iter 32, P0-0): SpeedMatch 白名单 enforce.
 *
 * 复杂题 (多位 / 应用题 / 单位换算) 不进 SpeedMatch — fallback 到 plain_numeric.
 * 默认 ON.
 */
const SPEEDMATCH_WHITELIST_LS_KEY = "speedmatch_whitelist_v1";

export function isSpeedMatchWhitelistV1(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(SPEEDMATCH_WHITELIST_LS_KEY) !== "false";
  } catch {
    return true;
  }
}

/**
 * v0.34.99 (iter 33 P0-1): Estimation Gate.
 * 多位数 / 应用题强制 round + estimate + magnitude 三阶段. 详见 src/core/estimationPolicy.ts.
 * 默认 ON. opt-out: localStorage.setItem("estimation_gate_v1", "false") 或 ?est_gate=off
 */
const ESTIMATION_GATE_LS_KEY = "estimation_gate_v1";

function syncEstimationGateFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const v = new URLSearchParams(window.location.search).get("est_gate");
    if (v === "on" || v === "true") localStorage.removeItem(ESTIMATION_GATE_LS_KEY);
    else if (v === "off" || v === "false") localStorage.setItem(ESTIMATION_GATE_LS_KEY, "false");
  } catch { /* SSR */ }
}

let _estGateSynced = false;

/**
 * v0.35.0 (iter 34 P0-2): ScratchInsurance — 软锁 + 草稿险.
 * 多位数 / 应用题旁边弹工具栏 (写草稿 / 列竖式 / 心算确认). 详 src/core/scratchPolicy.ts
 */
const SCRATCH_LS_KEY = "scratch_insurance_v1";

export function isScratchInsuranceV1(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(SCRATCH_LS_KEY) !== "false";
  } catch {
    return true;
  }
}

/**
 * v0.35.1 (iter 35 P0-3): MultiStepApplication — 应用题 4 步框架.
 * 已知 / 求 / 算式 / 答. 见 src/core/multiStepPolicy.ts
 */
const MULTISTEP_LS_KEY = "multi_step_app_v1";

export function isMultiStepAppV1(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(MULTISTEP_LS_KEY) !== "false";
  } catch {
    return true;
  }
}

/**
 * v0.35.2 (iter 36 P1-1): 改错挑战 mini-game.
 * 见 src/core/mistakeHuntPolicy.ts
 */
const MISTAKE_HUNT_LS_KEY = "mistake_hunt_v1";

export function isMistakeHuntV1(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(MISTAKE_HUNT_LS_KEY) !== "false";
  } catch {
    return true;
  }
}

export function isEstimationGateV1(): boolean {
  if (typeof window === "undefined") return true;
  if (!_estGateSynced) {
    syncEstimationGateFromUrl();
    _estGateSynced = true;
  }
  try {
    return localStorage.getItem(ESTIMATION_GATE_LS_KEY) !== "false";
  } catch {
    return true;
  }
}
