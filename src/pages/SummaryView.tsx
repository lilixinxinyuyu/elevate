/**
 * v0.35.55 Refactor Priority 21 (Train.tsx 拆分 step 2, 最大 single extract):
 * SummaryView 抽到独立文件.
 *
 * 痛点: Train.tsx 内嵌 SummaryView ~333 行 — session 结束后的完整结算 UI:
 *   - 段位升档 LotteryBox + UnlockCelebration 弹窗 (state machine queue)
 *   - 答对统计 (firstTryCorrectCount / tutorAssistedCount 区分)
 *   - RewardChest open 动画
 *   - 4 个 StatCard 网格 (XP / 最高连击 / 最快一题 / 正确率)
 *   - 🏆 新奖杯 chip 列表 + TrophyIcon
 *   - 进步最大 skill 列表
 *   - 工坊沙箱"获得灵感 + 回工坊" banner
 *   - 跟小进总结 / 再来一把 / 回首页 3 CTA
 *
 * 跟 TrainPage state 0 coupling — 仅 1 个 summary prop 进.
 */
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { SessionSummary } from "../core/types";
import { trophyById } from "../db/service";
import { RewardChest } from "../components/game/RewardChest";
import { UnlockCelebration } from "../components/UnlockCelebration";
import { TrophyIcon } from "../components/TrophyIcon";
import { LotteryBoxModal } from "../components/LotteryBoxModal";
import { trophyImageKey } from "../lib/allTrophies";
import type { TrophyMeta } from "../lib/trophyImages";
import { TROPHIES } from "../core/trophies";
import { tierById } from "../core/tiers";
import { ATELIER_REALMS, type AtelierRealmId } from "../content/atelier/realms";
import { TrainRoute } from "../lib/routes";
import { StatCard, SummaryReviewTutor } from "./trainComponents";

export function SummaryView({ summary }: { summary: SessionSummary }) {
  // v0.32.9 工坊沙箱：如果本次 session 是从 atelier 启动的，summary 卡片要给"回工坊"按钮
  const [searchParams] = useSearchParams();
  const fromAtelier = searchParams.get("fromAtelier") as AtelierRealmId | null;
  const fromRealm = fromAtelier ? ATELIER_REALMS.find((r) => r.id === fromAtelier) : null;
  const inspirationEarned = fromRealm
    ? summary.correct + (summary.correct === summary.total && summary.total > 0 ? 3 : 0)
    : 0;
  const [chestOpened, setChestOpened] = useState(false);
  const [showTierCelebration, setShowTierCelebration] = useState(
    !!summary.tierUpgrade,
  );
  // 跟小进总结今天的对话面板
  const [reviewTutorOpen, setReviewTutorOpen] = useState(false);
  // 🎁 盲盒队列（v0.29.2 重写规则）：
  //
  //   触发条件（什么时候弹盲盒）：
  //     ✅ 段位升档（school→district 等）       → mode=generate（生成段位 badge 图）
  //     ✅ commemorative 首次解锁（第一步等）  → mode=generate（生成专属图）
  //     ✅ daily trophy 首次解锁 (count=1)    → mode=generate（生成专属图）
  //     ✅ tiered 勋章升钻 (platinum)          → mode=reveal-only（图已存在，弹庆祝）
  //     🚫 tiered 升金 (gold)                  → 不入队，只在"新奖杯"卡片里高亮
  //     🚫 tiered 升铜/银                       → 静默（角标更新就好）
  //     🚫 daily 累计 (count > 1)              → 静默（避免每 5 次都弹打断节奏）
  //
  //   新规则核心：盲盒 = "真正不可重得的事件" 或 "本学期级里程碑"。
  //   减少打扰频率 + 同 prop 区分新生成/已存在图（reveal-only 走快路径）。
  type QueueItem = {
    trophy: TrophyMeta;
    mode: "generate" | "reveal-only";
    subtitle?: string;
  };
  const [lotteryQueue, setLotteryQueue] = useState<QueueItem[]>(() => {
    const out: QueueItem[] = [];

    // 1. 段位升档（v0.31.11 改）：reveal-only 弹庆祝展示已有段位徽章
    if (summary.tierUpgrade) {
      const newTier = tierById(summary.tierUpgrade.toTierId);
      if (newTier) {
        out.push({
          trophy: {
            id: trophyImageKey("math", `tier_${newTier.id}`),
            subjectId: "math",
            name: `${newTier.name} 段位徽章`,
            icon: newTier.badgeIcon,
            description: newTier.unlockSlogan,
            rare: true,
          },
          mode: "reveal-only",
          subtitle: "你正式佩戴上新段位徽章 ✨",
        });
      }
    }

    // 2. trophy awards 按规则筛选
    for (const aw of summary.newTrophies ?? []) {
      const def = TROPHIES.find((t) => t.id === aw.trophyId);
      if (!def) continue;
      const newTotal = aw.newTotalCount ?? 1;

      // commemorative 首次解锁 → 生成专属图
      if (def.category === "commemorative" && newTotal === 1) {
        out.push({
          trophy: {
            id: trophyImageKey("math", def.id),
            subjectId: "math",
            name: def.name,
            icon: def.icon ?? "🏆",
            description: def.description,
            rare: true,
            category: def.category,
          },
          mode: "generate",
        });
        continue;
      }

      // tiered 升钻 → 已有图，弹庆祝（reveal-only）
      if (aw.tier === "platinum") {
        out.push({
          trophy: {
            id: trophyImageKey("math", def.id),
            subjectId: "math",
            name: `${def.name} · 钻石档`,
            icon: def.icon ?? "💎",
            description: `本学期最高荣誉解锁！${def.description}`,
            rare: true,
            category: def.category,
            tier: "platinum",
          },
          mode: "reveal-only",
          subtitle: "你拿到了本学期级别的最高荣誉 💎",
        });
        continue;
      }

      // daily trophy 首次解锁 (count=1) → 生成专属图
      if (def.category === "daily" && newTotal === 1) {
        out.push({
          trophy: {
            id: trophyImageKey("math", def.id),
            subjectId: "math",
            name: def.name,
            icon: def.icon ?? "🏆",
            description: def.description,
            rare: true,
            category: def.category,
          },
          mode: "generate",
        });
        continue;
      }

      // 其他（金/银/铜 tier、daily count>1）→ 静默或 inline 处理
    }
    return out;
  });
  const levelUp = summary.levelAfter > summary.levelBefore;
  const ratingDelta =
    summary.ratingBefore !== undefined && summary.ratingAfter !== undefined
      ? summary.ratingAfter - summary.ratingBefore
      : 0;
  const newTier = summary.tierUpgrade ? tierById(summary.tierUpgrade.toTierId) : null;

  return (
    <div className="space-y-5 pb-8">
      {/* 🎁 盲盒抽奖：稀有 trophy 解锁时优先播放 */}
      {lotteryQueue.length > 0 && (
        <LotteryBoxModal
          trophy={lotteryQueue[0]!.trophy}
          mode={lotteryQueue[0]!.mode}
          subtitle={lotteryQueue[0]!.subtitle}
          onClose={() => setLotteryQueue((prev) => prev.slice(1))}
        />
      )}
      {showTierCelebration && summary.tierUpgrade && (
        <UnlockCelebration
          fromTierId={summary.tierUpgrade.fromTierId}
          toTierId={summary.tierUpgrade.toTierId}
          onClose={() => setShowTierCelebration(false)}
        />
      )}
      <div className="text-center">
        <div className="text-xs text-slate-400 uppercase tracking-widest">
          {summary.dateKey}
        </div>
        <div className="font-display font-bold text-3xl mt-1 text-brand">
          完成啦！
        </div>
        <div className="mt-1 text-slate-300 text-sm">
          答对 {summary.correct} / {summary.total}，正确率 {Math.round(summary.accuracy * 100)}%
        </div>
        {/* v0.30.7: 区分"独立答对"和"讲题后答对"，避免统计撒谎 */}
        {(summary.firstTryCorrectCount != null || (summary.tutorAssistedCount ?? 0) > 0) && (
          <div className="mt-1.5 text-xs text-slate-400 inline-flex items-center gap-2 flex-wrap justify-center">
            {summary.firstTryCorrectCount != null && (
              <span>
                <span className="text-emerald-300 font-display font-bold">
                  {summary.firstTryCorrectCount}
                </span>{" "}
                道一遍就对
              </span>
            )}
            {(summary.tutorAssistedCount ?? 0) > 0 && (
              <>
                <span className="opacity-30">·</span>
                <span>
                  <span className="text-amber-300 font-display font-bold">
                    {summary.tutorAssistedCount}
                  </span>{" "}
                  道讲题后才对
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {!chestOpened ? (
        <RewardChest onOpened={() => setChestOpened(true)} />
      ) : (
        <div className="space-y-4 animate-slide-up">
          {newTier && (
            <div className={`card-glow text-center bg-gradient-to-br ${newTier.theme.fromColor} ${newTier.theme.toColor} ${newTier.theme.borderColor}`}>
              <div className="text-5xl">{newTier.badgeIcon}</div>
              <div className={`font-display font-bold text-2xl mt-1 ${newTier.theme.textColor}`}>
                跨入 {newTier.name}！
              </div>
              <div className={`text-xs mt-1 ${newTier.theme.subTextColor}`}>{newTier.unlockSlogan}</div>
            </div>
          )}
          {ratingDelta > 0 && (
            <div className="card text-center bg-gradient-to-br from-cyan-500/15 to-sky-500/10 border-cyan-400/40">
              <div className="text-xs text-cyan-200/80 font-display">本学期累计 XP</div>
              <div className="font-display font-bold text-3xl text-cyan-100 mt-1 tabular-nums">
                {(summary.ratingBefore ?? 0).toLocaleString()} → {(summary.ratingAfter ?? 0).toLocaleString()}
              </div>
              <div className="text-xs text-cyan-200 mt-1 tabular-nums">+{ratingDelta.toLocaleString()} XP ✨</div>
            </div>
          )}
          {levelUp && (
            <div className="card-glow text-center bg-gradient-to-br from-amber-500/20 to-orange-500/10 border-amber-400/40">
              <div className="text-5xl">🌟</div>
              <div className="font-display font-bold text-2xl mt-1 text-xp">升到 Lv {summary.levelAfter} 了！</div>
              <div className="text-xs text-amber-100 mt-1">Lv {summary.levelBefore} → Lv {summary.levelAfter}</div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="XP" value={`+${summary.xpGained}`} tone="amber" big />
            <StatCard label="最高连击" value={`× ${summary.maxCombo}`} tone="rose" />
            <StatCard label="最快一题" value={summary.fastestSeconds > 0 ? `${summary.fastestSeconds}s` : "-"} />
            <StatCard label="正确率" value={`${Math.round(summary.accuracy * 100)}%`} tone="emerald" />
          </div>

          {summary.newTrophies.length > 0 && (
            <div className="card-glow">
              <div className="font-display font-bold mb-2">🏆 新奖杯</div>
              <div className="flex flex-wrap gap-2">
                {summary.newTrophies.map((aw) => {
                  const t = trophyById(aw.trophyId);
                  // v0.29: tiered 勋章带 tier；commemorative/daily 没有
                  const tierLabel: Record<string, string> = {
                    bronze: "🥉 铜",
                    silver: "🥈 银",
                    gold: "🥇 金",
                    platinum: "💎 钻",
                  };
                  return (
                    <div
                      key={`${aw.trophyId}_${aw.tier ?? ""}`}
                      className="flex items-center gap-2 bg-amber-500/20 border border-amber-400/40 rounded-xl px-3 py-1.5"
                    >
                      <TrophyIcon
                        trophyId={aw.trophyId}
                        subjectId="math"
                        emoji={t?.icon ?? "🏆"}
                        size="md"
                        tier={aw.tier}
                        category={t?.category}
                        glow
                      />
                      <div className="text-amber-100">
                        <div className="text-sm font-semibold">
                          {t?.name ?? aw.trophyId}
                          {aw.tier && (
                            <span className="ml-1 text-xs text-amber-300">{tierLabel[aw.tier]}</span>
                          )}
                        </div>
                        {aw.count > 1 && (
                          <span className="text-xs text-amber-300 font-display font-bold">× {aw.count}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {summary.masteryImprovements.length > 0 && (
            <div className="card">
              <div className="font-display font-bold mb-2">进步最大</div>
              <ul className="text-sm space-y-1 text-slate-200">
                {summary.masteryImprovements.map((i) => (
                  <li key={i.skillId} className="flex justify-between">
                    <span>{i.skillName}</span>
                    <span className="text-emerald-300 font-semibold">{i.from} → {i.to}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* v0.32.9 沙箱：从工坊启动 → top banner 显示获得灵感 + 回工坊按钮 */}
          {fromRealm && (
            <div
              className="card-glow border-2 mb-3"
              style={{
                borderColor: fromRealm.accent.color + "88",
                background: `linear-gradient(135deg, ${fromRealm.accent.grad[0]}, ${fromRealm.accent.grad[1]})`,
              }}
            >
              <div className="flex items-center gap-3">
                <div className="text-3xl">{fromRealm.emoji}</div>
                <div className="flex-1">
                  <div className="font-display font-bold text-base text-slate-50">
                    完成 {fromRealm.name} 探险！
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    小进给你 <span className="font-mono text-amber-300 font-bold">+{inspirationEarned}</span> 灵感
                    {summary.correct === summary.total && summary.total > 0 && (
                      <span className="text-amber-200 ml-2">（全对加 3 ✨）</span>
                    )}
                  </div>
                </div>
                <Link
                  to={`/math/atelier?just=${inspirationEarned}&realm=${fromRealm.id}`}
                  className="btn-primary text-sm px-3 py-1.5 shrink-0"
                  style={{ background: `linear-gradient(135deg, ${fromRealm.accent.color}, ${fromRealm.accent.color}cc)` }}
                >
                  🏠 回工坊
                </Link>
              </div>
            </div>
          )}

          <div className="flex gap-3 justify-center pt-2 flex-wrap">
            <button
              type="button"
              onClick={() => setReviewTutorOpen(true)}
              className="btn-secondary border-amber-400/40 text-amber-100 bg-amber-500/15 hover:bg-amber-500/30"
            >
              👩‍🏫 跟小进总结今天
            </button>
            <Link to={TrainRoute.build({ fresh: Date.now() })} className="btn-primary">再来一把</Link>
            <Link to="/math" className="btn-secondary">回首页</Link>
          </div>
        </div>
      )}

      {reviewTutorOpen && (
        <SummaryReviewTutor onClose={() => setReviewTutorOpen(false)} />
      )}
    </div>
  );
}
