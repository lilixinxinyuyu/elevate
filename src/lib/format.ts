export function formatPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

export function formatMinutes(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}秒`;
  return `${m}分${s}秒`;
}

/**
 * v0.28：5 档掌握度。新算法（Elo + 滚动窗口 + 多样性 + Fragility）下，
 * 90+ "精通"很难拿——需要 ≥20 题、Elo ≥1700、多样题面、近 14 天活跃。
 * 跟原来 90 直接给"熟练"完全不同。
 */
export function masteryColor(score: number): string {
  if (score < 20) return "text-slate-400 bg-white/5 border-white/10";
  if (score < 40) return "text-rose-300 bg-rose-500/10 border-rose-400/30";
  if (score < 60) return "text-orange-200 bg-orange-500/10 border-orange-400/30";
  if (score < 75) return "text-amber-200 bg-amber-500/10 border-amber-400/30";
  if (score < 90) return "text-emerald-200 bg-emerald-500/10 border-emerald-400/30";
  return "text-violet-200 bg-violet-500/10 border-violet-400/30";
}

export function masteryLabel(score: number): string {
  if (score < 20) return "未涉足";
  if (score < 40) return "见过几次";
  if (score < 60) return "进步中";
  if (score < 75) return "较稳";
  if (score < 90) return "熟练";
  return "精通";
}

export function uid(prefix = ""): string {
  return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
