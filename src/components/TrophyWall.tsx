import { Link } from "react-router-dom";
import { TROPHIES } from "../core/trophies";
import { TrophyIcon } from "./TrophyIcon";
import { useAllTrophyImages } from "../lib/trophyImages";
import { trophyImageKey } from "../lib/allTrophies";
import type { UserTrophy } from "../core/types";

/**
 * 奖杯墙：所有获得过的奖杯按"已获得 / 未解锁"分组陈列。
 *
 * v0.27.2 视觉改进：
 *   - 去掉外层 amber 边框 + shadow-glow（之前和 TrophyIcon 自己的 ring 双框过密）
 *   - 每枚奖杯就是一个干净的图标 + 名字 + 计数角标
 *   - 头部加"补全 AI 图"入口，链向 /math/admin#trophy-images，方便一键给已获得
 *     但还没 AI 图的奖杯统一画图
 */
export function TrophyWall({ trophies }: { trophies: UserTrophy[] }) {
  const counts = new Map<string, number>();
  for (const t of trophies) counts.set(t.trophyId, (counts.get(t.trophyId) ?? 0) + 1);

  const earned = TROPHIES.filter((t) => (counts.get(t.id) ?? 0) > 0)
    .map((t) => ({ def: t, count: counts.get(t.id)! }))
    .sort((a, b) => b.count - a.count);
  const locked = TROPHIES.filter((t) => (counts.get(t.id) ?? 0) === 0);

  // 看一下已获得的奖杯里有几个还差 AI 图
  const cachedImages = useAllTrophyImages();
  const earnedMissingAi = earned.filter(
    (e) => !cachedImages.has(trophyImageKey("math", e.def.id)),
  ).length;

  const totalKinds = earned.length;
  const totalCount = trophies.length;

  return (
    <section className="card">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="font-display font-bold text-lg">🏆 奖杯柜</div>
        <div className="flex items-center gap-2 flex-wrap">
          {earnedMissingAi > 0 && (
            <Link
              to="/math/admin#trophy-images"
              className="chip text-xs px-2.5 py-1 bg-violet-500/15 border border-violet-400/40 text-violet-200 hover:bg-violet-500/25"
              title="跳到管理页一键生成所有缺失的勋章 AI 图"
            >
              ✨ {earnedMissingAi} 枚还没 AI 图
            </Link>
          )}
          <div className="text-xs text-slate-400">
            {totalKinds} / {TROPHIES.length} 种 · 共 {totalCount} 枚
          </div>
        </div>
      </div>

      {earned.length > 0 && (
        <>
          <div className="text-xs text-amber-300/80 font-display mb-3 ml-1">已获得</div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-3 gap-y-4 mb-6">
            {earned.map(({ def, count }) => (
              <div
                key={def.id}
                className="relative text-center group"
                title={`${def.description}（已获得 ${count} 次）`}
              >
                {count > 1 && (
                  <span className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 chip bg-rose-500 text-white border border-rose-300 font-display font-bold text-[10px] sm:text-xs px-1.5 py-0.5 shadow-glow-rose whitespace-nowrap z-10">
                    × {count}
                  </span>
                )}
                <div className="flex justify-center">
                  <TrophyIcon
                    trophyId={def.id}
                    subjectId="math"
                    emoji={def.icon ?? "🏆"}
                    size="lg"
                    glow
                    unlocked
                  />
                </div>
                <div className="text-xs mt-2 leading-tight text-amber-100">{def.name}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {locked.length > 0 && (
        <>
          <div className="text-xs text-slate-500 font-display mb-3 ml-1">还没拿到的</div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-3 gap-y-4">
            {locked.map((def) => (
              <div
                key={def.id}
                className="relative text-center"
                title={`未解锁：${def.description}`}
              >
                <div className="flex justify-center">
                  <TrophyIcon
                    trophyId={def.id}
                    subjectId="math"
                    emoji={def.icon ?? "🏆"}
                    size="lg"
                    unlocked={false}
                  />
                </div>
                <div className="text-xs mt-2 leading-tight text-slate-400">{def.name}</div>
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
