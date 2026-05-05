/**
 * Phase 2 feature flag — `PHASE2_LIVE`
 *
 * 控制 Phase 2 三个新模式（Fluency / 大题营 / Canvas 画图）的 UI 入口是否对
 * Selena 可见。代码可以正常 ship 到生产，但入口被这个 flag 罩住直到期中考完。
 *
 * 三种打开方式（任一即开）：
 *   1. localStorage：`localStorage.setItem("phase2_live", "true")` 然后刷新
 *   2. URL 参数：`?phase2=on`（写进 localStorage 后再用上一条机制）
 *   3. 构建期：`VITE_PHASE2_LIVE=true npm run build`
 *
 * 为什么这样设计：
 *   - localStorage 给爸爸调试用（一台设备开，不污染 Selena）
 *   - URL 参数给"分享给 Selena 提前体验"用
 *   - VITE 环境变量给"全员 flip"用（期中考完后 push 这次构建）
 */

const PHASE2_LS_KEY = "phase2_live";
const PHASE2_URL_PARAM = "phase2";

/** 检查并应用 URL 参数 ?phase2=on / ?phase2=off — 一次性写进 localStorage */
function syncFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const v = params.get(PHASE2_URL_PARAM);
    if (v === "on" || v === "true") localStorage.setItem(PHASE2_LS_KEY, "true");
    else if (v === "off" || v === "false") localStorage.removeItem(PHASE2_LS_KEY);
  } catch {
    /* SSR / disabled localStorage */
  }
}

let _synced = false;

export function isPhase2Live(): boolean {
  // build-time flip：直接环境变量就开（发布期中后构建用）
  if (
    typeof import.meta !== "undefined" &&
    (import.meta as { env?: Record<string, string> }).env?.VITE_PHASE2_LIVE === "true"
  ) {
    return true;
  }
  // 客户端：URL 参数 + localStorage
  if (typeof window === "undefined") return false;
  if (!_synced) {
    syncFromUrl();
    _synced = true;
  }
  try {
    return localStorage.getItem(PHASE2_LS_KEY) === "true";
  } catch {
    return false;
  }
}
