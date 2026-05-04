import { TROPHIES } from "../core/trophies";
import { TrophyIcon } from "./TrophyIcon";

import type { UserTrophy } from "../core/types";

/**
 * 奖杯墙：所有获得过的奖杯按"已获得 / 未解锁"分组，全部展示。
 *
 * v0.27.1 改：
 *   - 用 <TrophyIcon> 渲染每枚奖杯 → 自动从 db.trophyImages 读 LotteryBoxModal
 *     生成的 AI 精美图，没有再 fallback emoji。Selena 抽到的盲盒奖杯图终于
 *     永久陈列在奖杯柜里。
 *   - 移除 v0.27.0 加的"段位徽章"分组 —— 跟 Home 上的 BadgeInventory 重复。
 *     段位徽章统一在 BadgeInventory（可点击佩戴）展示。
 *
 * 未解锁的奖杯 grayscale + opacity，hover 显示要求。
 */
export function TrophyWall({ trophies }: { trophies: UserTrophy[] }) {
  const counts = new Map<string, number>();
  for (const t of trophies) counts.set(t.trophyId, (counts.get(t.trophyId) ?? 0) + 1);

  const earned = TROPHIES.filter((t) => (counts.get(t.id) ?? 0) > 0)
    .map((t) => ({ def: t, count: counts.get(t.id)! }))
    .sort((a, b) => b.count - a.count);
  const locked = TROPHIES.filter((t) => (counts.get(t.id) ?? 0) === 0);

  const totalKinds = earned.length;
  const totalCount = trophies.length;

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="font-display font-bold text-lg">🏆 奖杯柜</div>
        <div className="text-xs text-slate-400">
          {totalKinds} / {TROPHIES.length} 种 · 共 {totalCount} 枚
        </div>
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
                  <span className="absolute -top-2 -right-2 chip bg-rose-500 text-white border border-rose-300 font-display font-bold px-2 py-0.5 shadow-glow-rose whitespace-nowrap z-10">
                    × {count}
                  </span>
                )}
                <div className="flex justify-center mb-1">
                  <TrophyIcon
                    trophyId={def.id}
                    subjectId="math"
                    emoji={def.icon ?? "🏆"}
                    size="lg"
                    glow
                    unlocked
                  />
                </div>
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
                className="rounded-2xl p-3 border bg-white/5 border-white/10 text-center"
                title={`未解锁：${def.description}`}
              >
                <div className="flex justify-center mb-1">
                  <TrophyIcon
                    trophyId={def.id}
                    subjectId="math"
                    emoji={def.icon ?? "🏆"}
                    size="lg"
                    unlocked={false}
                  />
                </div>
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
