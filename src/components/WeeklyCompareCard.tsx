/**
 * v0.31.50 → v0.31.51: 本周 vs 上周同时段 — "和上周的 Selena 比"
 *
 * Phase 1 激励改造的一部分。长期段位条爬得慢 → 难看到进步 → 多巴胺塌。
 * 解药：加一个"短周期对比"卡。
 *
 * **v0.31.51 修两件事**：
 *  1. **公平时间窗**：本周才过去 5 天就拿"本周 5 天 vs 上周 7 天"比是误导。
 *     改为"本周至今 vs 上周同时段"（同样过去 N 天 N 小时）。
 *  2. **换指标**："练习日 5/7" 几乎天天练，对比意义弱。换成 **平均 XP/题** —
 *     反映"题更难/做得更稳"的趋势，对加权 XP 改革后特别有信号。
 *
 * 不引入排行榜，只跟"上周的自己"比 — 既私密又有目标。
 *
 * 三项指标：
 *   - 本周 XP（至今）vs 上周同时段
 *   - 本周题数（至今）vs 上周同时段
 *   - 平均 XP/题 — 反映难度/质量趋势
 *
 * 数据来源：useLiveQuery 的 attempts，不需要查 question 表。简单可靠。
 */
import { useMemo } from "react";
import type { Attempt } from "../core/types";

export interface WeeklyStats {
  /** 本周至今 */
  thisXp: number;
  thisCount: number;
  thisAvgXp: number;
  /** 上周同时段（同样过去 N ms） */
  lastXp: number;
  lastCount: number;
  lastAvgXp: number;
  /** 本周已经过去多少天（向上取整，给 subtitle "本周 X 天 vs 上周 X 天" 用） */
  elapsedDays: number;
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function startOfWeek(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday
  // 周一作为一周开始：周日往前 6 天，其它往前 day-1 天
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d.getTime();
}

export function computeWeeklyStats(attempts: Attempt[], now: number = Date.now()): WeeklyStats {
  const thisWeekStart = startOfWeek(now);
  const elapsed = now - thisWeekStart;
  const lastWeekStart = thisWeekStart - ONE_WEEK_MS;
  // 上周"同时段"窗口结束点：上周一 00:00 + 本周已过去的 ms
  const lastWeekSameWindowEnd = lastWeekStart + elapsed;

  let thisXp = 0;
  let lastXp = 0;
  let thisCount = 0;
  let lastCount = 0;

  for (const a of attempts) {
    const ts = a.createdAt;
    if (ts < lastWeekStart || ts > now) continue;
    const xp = a.scoreDelta?.total ?? 0;
    if (ts >= thisWeekStart) {
      thisXp += xp;
      thisCount++;
    } else if (ts < lastWeekSameWindowEnd) {
      // 上周"同时段" — 跟本周比公平
      lastXp += xp;
      lastCount++;
    }
    // 上周"未同时段"部分（上周后半段）跳过 —— 对比公平比"早知答案"重要
  }

  return {
    thisXp,
    thisCount,
    thisAvgXp: thisCount > 0 ? thisXp / thisCount : 0,
    lastXp,
    lastCount,
    lastAvgXp: lastCount > 0 ? lastXp / lastCount : 0,
    elapsedDays: Math.max(1, Math.ceil(elapsed / (24 * 60 * 60 * 1000))),
  };
}

function StatCell({
  label,
  value,
  delta,
  suffix,
  formatValue,
}: {
  label: string;
  value: number;
  delta: number;
  suffix?: string;
  formatValue?: (v: number) => string;
}) {
  const fmt = formatValue ?? ((v: number) => v.toLocaleString());
  // delta 接近 0（绝对差 < 0.5 或相对差 < 5%）算"持平"，避免 ±1 微小波动当下降
  const significant = Math.abs(delta) >= 1 && Math.abs(delta) / Math.max(1, value - delta) >= 0.05;
  const arrow = !significant ? "→" : delta > 0 ? "↑" : "↓";
  const tone = !significant
    ? "text-slate-500"
    : delta > 0
      ? "text-emerald-300"
      : "text-rose-300/80";
  return (
    <div className="text-center">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="font-display font-bold text-lg sm:text-xl text-slate-100 tabular-nums leading-tight">
        {fmt(value)}
        {suffix && (
          <span className="text-[10px] ml-0.5 text-slate-400 font-normal">
            {suffix}
          </span>
        )}
      </div>
      <div
        className={`text-[10px] tabular-nums ${tone}`}
        title={`上周同时段 ${fmt(value - delta)}${suffix ?? ""}`}
      >
        {arrow} {fmt(Math.abs(delta))}
      </div>
    </div>
  );
}

export function WeeklyCompareCard({ attempts }: { attempts: Attempt[] }) {
  const stats = useMemo(() => computeWeeklyStats(attempts), [attempts]);

  // 双周都没数据 → 不显示，避免空 card 干扰
  if (stats.thisXp === 0 && stats.lastXp === 0 && stats.thisCount === 0 && stats.lastCount === 0) {
    return null;
  }

  const xpDelta = stats.thisXp - stats.lastXp;
  const xpUpPct = stats.lastXp > 0 ? xpDelta / stats.lastXp : 0;
  const avgDelta = stats.thisAvgXp - stats.lastAvgXp;
  // 本周表现明显超上周（XP +20% 或 平均 XP/题 涨 ≥3）→ 鼓励 chip
  const cheering = (xpUpPct >= 0.2 && xpDelta >= 50) || avgDelta >= 3;
  // 本周明显落后（XP 落 ≥30%）→ 鼓励一句话（不批评）
  const xpDownPct = stats.lastXp > 0 ? -xpDelta / stats.lastXp : 0;
  const slipping = stats.lastXp > 100 && xpDownPct >= 0.3;

  return (
    <section className="rounded-2xl border border-white/10 bg-ink-800/40 px-4 py-3">
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="text-xs text-slate-400">
          📊 你 vs 上周同时段
          <span className="ml-1 opacity-60">
            （本周 {stats.elapsedDays} 天 vs 上周前 {stats.elapsedDays} 天）
          </span>
        </span>
        {cheering && (
          <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-200 border border-emerald-400/30">
            🔥 比上周更猛
          </span>
        )}
        {!cheering && slipping && (
          <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200 border border-amber-400/30">
            💪 周末冲一下还能反超
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCell label="本周 XP" value={stats.thisXp} delta={xpDelta} />
        <StatCell
          label="本周题数"
          value={stats.thisCount}
          delta={stats.thisCount - stats.lastCount}
          suffix="道"
        />
        <StatCell
          label="平均 XP / 题"
          value={Math.round(stats.thisAvgXp)}
          delta={Math.round(avgDelta)}
        />
      </div>
    </section>
  );
}
