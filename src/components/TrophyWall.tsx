import { TROPHIES } from "../core/trophies";
import { TIERS, tierById, tierIndex } from "../core/tiers";
import type { UserTrophy } from "../core/types";

/**
 * 奖杯墙：所有获得过的奖杯按"段位徽章 / 已获得 / 未解锁"分组，全部展示。
 *
 * v0.27.0 新增：段位徽章是独立分组（最顶部），数据从 meta.tiersUnlocked 读，
 * 不写进 db.trophies。Selena 跨段位拿到的 5 枚徽章必须能在奖杯柜里看见。
 */
export function TrophyWall({
  trophies,
  unlockedTierIds = [],
}: {
  trophies: UserTrophy[];
  /** 已解锁的所有段位 id（横跨所有学期 union 后 dedupe）。空数组 = 没解锁过任何段位 */
  unlockedTierIds?: string[];
}) {
  const counts = new Map<string, number>();
  for (const t of trophies) counts.set(t.trophyId, (counts.get(t.trophyId) ?? 0) + 1);

  const earned = TROPHIES.filter((t) => (counts.get(t.id) ?? 0) > 0)
    .map((t) => ({ def: t, count: counts.get(t.id)! }))
    .sort((a, b) => b.count - a.count);
  const locked = TROPHIES.filter((t) => (counts.get(t.id) ?? 0) === 0);

  // 段位徽章：解锁的高亮，没解锁的灰色一并陈列（5 枚位置永远占满，看进度更直观）
  const tierEarnedSet = new Set(unlockedTierIds);
  const tierEarned = TIERS.filter((t) => tierEarnedSet.has(t.id));
  const tierLocked = TIERS.filter((t) => !tierEarnedSet.has(t.id));

  const totalKinds = earned.length + tierEarned.length;
  const totalCount = trophies.length + tierEarned.length;
  const totalAvailable = TROPHIES.length + TIERS.length;

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="font-display font-bold text-lg">🏆 奖杯柜</div>
        <div className="text-xs text-slate-400">
          {totalKinds} / {totalAvailable} 种 · 共 {totalCount} 枚
        </div>
      </div>

      {/* 段位徽章区块 — 永远在最顶上，最有仪式感 */}
      <div className="mb-5">
        <div className="text-xs text-rose-300/80 font-display mb-2 ml-1 flex items-center gap-2">
          🏅 段位徽章
          <span className="text-slate-500 text-[10px]">
            （{tierEarned.length} / {TIERS.length}）
          </span>
        </div>
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {TIERS.map((t) => {
            const earned = tierEarnedSet.has(t.id);
            return (
              <div
                key={t.id}
                className={`relative rounded-2xl p-3 border text-center transition-all ${
                  earned
                    ? `bg-gradient-to-br ${t.theme.fromColor} ${t.theme.toColor} ${t.theme.borderColor} shadow-glow-amber`
                    : "bg-white/5 border-white/10 grayscale opacity-50"
                }`}
                title={
                  earned
                    ? `${t.badgeName}：${t.badgeDesc}`
                    : `还没解锁：${t.badgeName}（达到 ${t.range[0].toLocaleString()} XP 解锁）`
                }
              >
                <div className="text-3xl">{t.badgeIcon}</div>
                <div
                  className={`text-xs mt-1 leading-tight ${
                    earned ? t.theme.textColor : "text-slate-400"
                  }`}
                >
                  {t.name}
                </div>
                {earned && tierIndex(t.id) > 0 && (
                  <span className="absolute -top-2 -right-2 text-amber-300 text-xs animate-pulse">✨</span>
                )}
              </div>
            );
          })}
        </div>
        {tierEarned.length > 0 && (
          <div className="text-[10px] text-slate-500 text-center mt-2">
            最高段位：
            <span className="text-rose-200">
              {tierById(
                tierEarned.reduce((acc, t) =>
                  tierIndex(t.id) > tierIndex(acc.id) ? t : acc,
                ).id,
              )?.name}
            </span>
            {tierLocked.length > 0 && (
              <>
                {" · "}下一段：
                <span className="text-slate-300">
                  {tierLocked[0]?.name}（差 {tierLocked[0]?.range[0].toLocaleString()} XP）
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {earned.length > 0 && (
        <>
          <div className="text-xs text-amber-300/80 font-display mb-2 ml-1">已获得</div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 mb-5">
            {earned.map(({ def, count }) => (
              <div
                key={def.id}
                className="relative rounded-2xl p-3 border bg-gradient-to-br from-amber-500/30 to-orange-500/20 border-amber-400/50 shadow-glow-amber text-center"
                title={`${def.description}（已获得 ${count} 次）`}
              >
                {count > 1 && (
                  <span className="absolute -top-2 -right-2 chip bg-rose-500 text-white border border-rose-300 font-display font-bold px-2 py-0.5 shadow-glow-rose whitespace-nowrap">
                    × {count}
                  </span>
                )}
                <div className="text-3xl">{def.icon ?? "🏆"}</div>
                <div className="text-xs mt-1 leading-tight text-amber-100">{def.name}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {locked.length > 0 && (
        <>
          <div className="text-xs text-slate-500 font-display mb-2 ml-1">还没拿到的</div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {locked.map((def) => (
              <div
                key={def.id}
                className="rounded-2xl p-3 border bg-white/5 border-white/10 grayscale opacity-50 text-center"
                title={`未解锁：${def.description}`}
              >
                <div className="text-3xl">{def.icon ?? "🏆"}</div>
                <div className="text-xs mt-1 leading-tight text-slate-400">{def.name}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {earned.length === 0 && (
        <div className="text-sm text-slate-400 text-center py-8">
          还没拿到任何奖杯——开始第一次挑战吧！
        </div>
      )}
    </section>
  );
}
