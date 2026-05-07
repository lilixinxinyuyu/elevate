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
