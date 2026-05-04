import { TIERS } from "../core/tiers";
import { TrophyIcon } from "./TrophyIcon";

/**
 * 勋章柜：显示所有段位勋章。
 * - 已解锁的：彩色，可点击佩戴
 * - 未解锁的：灰色，hover 显示门槛
 * - 当前佩戴的：边框高亮 + 角标"佩戴中"
 *
 * v0.29.4 修复：之前只渲染 emoji `t.badgeIcon`，从来没用过 AI 生成的段位 badge 图。
 *   现在通过 <TrophyIcon trophyId={`tier_${t.id}`} subjectId="math" /> 优先显示
 *   db.trophyImages 里 `math_tier_${t.id}` 的 AI 图，emoji 兜底。
 */
export function BadgeInventory({
  unlockedTierIds,
  equippedTierId,
  onEquip,
}: {
  unlockedTierIds: string[];
  equippedTierId: string;
  onEquip: (tierId: string) => void;
}) {
  const unlockedSet = new Set(unlockedTierIds);
  return (
    <section className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="font-display font-bold">🎖️ 段位勋章</div>
        <div className="text-xs text-slate-400">
          {unlockedTierIds.length} / {TIERS.length} 段位已解锁
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {TIERS.map((t) => {
          const got = unlockedSet.has(t.id);
          const equipped = equippedTierId === t.id;
          const lockedTip = `达到 ${t.range[0]} 分解锁 · ${t.name}`;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => got && onEquip(t.id)}
              disabled={!got}
              className={`relative rounded-2xl p-3 border text-center transition-all ${
                got
                  ? equipped
                    ? `bg-gradient-to-br ${t.theme.fromColor} ${t.theme.toColor} ${t.theme.borderColor} ring-2 ring-amber-400 shadow-glow-amber`
                    : `bg-gradient-to-br ${t.theme.fromColor} ${t.theme.toColor} ${t.theme.borderColor} hover:scale-[1.03]`
                  : "bg-white/5 border-white/10 grayscale opacity-40 cursor-not-allowed"
              }`}
              title={got ? `点击佩戴：${t.badgeName}` : lockedTip}
            >
              {equipped && (
                <span className="absolute -top-2 -right-2 chip bg-amber-400 text-ink-900 border border-amber-200 font-display font-bold px-2 py-0.5 text-[10px] shadow-glow-amber whitespace-nowrap z-10">
                  佩戴中
                </span>
              )}
              <div className="flex justify-center">
                <TrophyIcon
                  trophyId={`tier_${t.id}`}
                  subjectId="math"
                  emoji={t.badgeIcon}
                  size="lg"
                  unlocked={got}
                />
              </div>
              <div
                className={`text-xs mt-2 leading-tight font-display ${
                  got ? t.theme.textColor : "text-slate-400"
                }`}
              >
                {t.badgeName}
              </div>
              <div className={`text-[10px] mt-0.5 ${got ? t.theme.subTextColor : "text-slate-500"}`}>
                {t.name}
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-3 text-xs text-slate-500">
        点击已解锁的勋章可以佩戴，会显示在你的名字旁边。
      </div>
    </section>
  );
}
