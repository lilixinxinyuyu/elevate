/**
 * v0.31.50: 本周 vs 上周 — "和上周的 Selena 比"
 *
 * Phase 1 激励改造的一部分。长期段位条爬得慢 → 难看到进步 → 多巴胺塌。
 * 解药：加一个"短周期对比"卡。每周一清零，每天都能看到"本周 XP"在涨，
 * 周末看到"我比上周做了多少"。
 *
 * 不引入排行榜，只跟"上周的自己"比 — 既私密又有目标。
 *
 * 三项指标：
 *   - 本周 XP (主指标)
 *   - 本周题数 (努力量)
 *   - 本周练习日 (习惯)
 *
 * 周边界：本地时间 周一 00:00 → 现在；上周 = 周一 00:00 → 周一 00:00。
 *
 * 数据来源：useLiveQuery 的 attempts，不需要查 question 表。简单可靠。
 */
import { useMemo } from "react";
import type { Attempt } from "../core/types";

interface WeeklyStats {
  thisXp: number;
  lastXp: number;
  thisCount: number;
  lastCount: number;
  thisDays: number;
  lastDays: number;
}

function startOfWeek(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday
  // 周一作为一周开始：周日往前 6 天，其它往前 day-1 天
  const offset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + offset);
  return d.getTime();
}

function localDayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function computeWeeklyStats(attempts: Attempt[], now: number = Date.now()): WeeklyStats {
  const thisWeekStart = startOfWeek(now);
  const lastWeekStart = thisWeekStart - 7 * 24 * 60 * 60 * 1000;

  let thisXp = 0;
  let lastXp = 0;
  let thisCount = 0;
  let lastCount = 0;
  const thisDaysSet = new Set<string>();
  const lastDaysSet = new Set<string>();

  for (const a of attempts) {
    const ts = a.createdAt;
    if (ts < lastWeekStart || ts > now) continue;
    const xp = a.scoreDelta?.total ?? 0;
    const dayKey = localDayKey(ts);
    if (ts >= thisWeekStart) {
      thisXp += xp;
      thisCount++;
      thisDaysSet.add(dayKey);
    } else {
      lastXp += xp;
      lastCount++;
      lastDaysSet.add(dayKey);
    }
  }

  return {
    thisXp,
    lastXp,
    thisCount,
    lastCount,
    thisDays: thisDaysSet.size,
    lastDays: lastDaysSet.size,
  };
}

function StatCell({
  label,
  value,
  delta,
  suffix,
}: {
  label: string;
  value: number;
  delta: number;
  suffix?: string;
}) {
  const arrow = delta > 0 ? "↑" : delta < 0 ? "↓" : "→";
  const tone =
    delta > 0
      ? "text-emerald-300"
      : delta < 0
        ? "text-rose-300/80"
        : "text-slate-500";
  return (
    <div className="text-center">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="font-display font-bold text-lg sm:text-xl text-slate-100 tabular-nums leading-tight">
        {value.toLocaleString()}
        {suffix && (
          <span className="text-[10px] ml-0.5 text-slate-400 font-normal">
            {suffix}
          </span>
        )}
      </div>
      <div className={`text-[10px] tabular-nums ${tone}`} title={`上周 ${(value - delta).toLocaleString()}${suffix ?? ""}`}>
        {arrow} {Math.abs(delta).toLocaleString()}
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

  // 本周表现远超上周 → 加个鼓励 chip（XP +20% 或 +1 练习日）
  const xpDelta = stats.thisXp - stats.lastXp;
  const xpUpPct = stats.lastXp > 0 ? xpDelta / stats.lastXp : 0;
  const dayDelta = stats.thisDays - stats.lastDays;
  const cheering = (xpUpPct >= 0.2 && xpDelta >= 50) || dayDelta >= 1;
  // 本周明显落后 → 鼓励一句话（不批评）
  const xpDownPct = stats.lastXp > 0 ? -xpDelta / stats.lastXp : 0;
  const slipping = stats.lastXp > 100 && xpDownPct >= 0.3;

  return (
    <section className="rounded-2xl border border-white/10 bg-ink-800/40 px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-slate-400">📊 你 vs 上周的你</span>
        {cheering && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-200 border border-emerald-400/30">
            🔥 比上周更猛
          </span>
        )}
        {!cheering && slipping && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200 border border-amber-400/30">
            💪 周末冲一下还能反超
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatCell
          label="本周 XP"
          value={stats.thisXp}
          delta={xpDelta}
        />
        <StatCell
          label="本周题数"
          value={stats.thisCount}
          delta={stats.thisCount - stats.lastCount}
          suffix="道"
        />
        <StatCell
          label="练习日"
          value={stats.thisDays}
          delta={dayDelta}
          suffix="/ 7"
        />
      </div>
    </section>
  );
}
