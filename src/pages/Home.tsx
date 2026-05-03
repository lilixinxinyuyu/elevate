import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { todayKey } from "../lib/date";
import {
  checkPoolHealth,
  computeCurrentRating,
  getEquippedBadge,
  getUnlockedTiers,
  setEquippedBadge,
} from "../db/service";
import { tierById, TIERS, tierIndex } from "../core/tiers";
import { TierCard } from "../components/TierCard";
import { TrophyWall } from "../components/TrophyWall";
import { BadgeInventory } from "../components/BadgeInventory";
import { UnlockCelebration } from "../components/UnlockCelebration";
import type { RatingResult } from "../core/rating";
import { useEffect, useState } from "react";

/** 把毫秒时间戳格式成本地日期字符串 YYYY-MM-DD（与 todayKey 一致） */
function localDayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function HomePage() {
  const student = useLiveQuery(async () => (await db.students.toArray())[0]);
  const attempts = useLiveQuery(
    async () => (student ? db.attempts.where({ studentId: student.id }).toArray() : []),
    [student?.id],
  );
  const mistakes = useLiveQuery(
    async () => (student ? db.mistakes.where({ studentId: student.id }).toArray() : []),
    [student?.id],
  );
  const trophies = useLiveQuery(
    async () => (student ? db.trophies.where({ studentId: student.id }).toArray() : []),
    [student?.id],
  );

  const [rating, setRating] = useState<RatingResult | null>(null);
  const [unlockedTiers, setUnlockedTiers] = useState<string[]>(["school"]);
  const [equippedTierId, setEquippedTierId] = useState<string>("school");
  const [poolHealth, setPoolHealth] = useState<{
    freshTotal: number;
    freshMidterm: number;
    starvedSkills: { skillId: string; skillName: string }[];
  } | null>(null);
  const [celebrationToTier, setCelebrationToTier] = useState<string | null>(null);

  // 重新计算综合分（attempts/mastery 变化时）
  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    (async () => {
      const r = await computeCurrentRating(student.id);
      if (cancelled) return;
      setRating(r);

      // 解锁段位：当前段位及以下所有段位都视为已解锁（防止跳级跳过中间段）
      const prevUnlocked = await getUnlockedTiers(student.id);
      const currentIdx = tierIndex(r.tier.id);
      const shouldBeUnlocked = TIERS.slice(0, currentIdx + 1).map((t) => t.id);
      const newUnlocked = Array.from(new Set([...prevUnlocked, ...shouldBeUnlocked]));
      const grewBy = newUnlocked.filter((id) => !prevUnlocked.includes(id));

      if (grewBy.length > 0) {
        await db.meta.put({
          key: `tiersUnlocked::${student.id}`,
          value: newUnlocked,
        });
        // 仅当**已经有过解锁记录**且新解锁的段位 > 旧最高时才庆祝
        // （首次加载老数据不弹通告，避免吓到孩子）
        const prevMaxIdx = prevUnlocked.length > 0
          ? Math.max(...prevUnlocked.map(tierIndex))
          : -1;
        if (prevMaxIdx >= 0 && currentIdx > prevMaxIdx && r.tier.id !== "school") {
          setCelebrationToTier(r.tier.id);
        }
      }
      setUnlockedTiers(newUnlocked);
      setEquippedTierId(await getEquippedBadge(student.id));
      setPoolHealth(await checkPoolHealth(student.id));
    })();
    return () => {
      cancelled = true;
    };
  }, [student?.id, attempts?.length]);

  const handleEquip = async (tierId: string) => {
    if (!student) return;
    await setEquippedBadge(student.id, tierId);
    setEquippedTierId(tierId);
  };

  if (!student) return <div className="card">正在初始化…</div>;

  // 用本地日期（与 todayKey 一致），避免 UTC 时区导致连续天数错判
  const practiceDays = new Set((attempts ?? []).map((a) => localDayKey(a.createdAt)));
  const streak = computeStreak(Array.from(practiceDays));
  const today = todayKey();
  const todayAttempts = (attempts ?? []).filter((a) => localDayKey(a.createdAt) === today);
  const unresolvedMistakes = (mistakes ?? []).filter((m) => !m.resolved).length;
  const dueMistakes = (mistakes ?? []).filter((m) => !m.resolved && m.nextReviewAt <= Date.now()).length;

  const equippedBadge = tierById(equippedTierId) ?? tierById("school")!;

  return (
    <div className="space-y-6">
      {/* Hero：综合分 + 段位 + 佩戴的勋章 */}
      {rating ? (
        <TierCard studentName={student.name} rating={rating} equippedBadge={equippedBadge} />
      ) : (
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600/30 via-fuchsia-600/20 to-pink-600/30 border border-violet-400/20 p-6">
          <div className="text-sm text-violet-200">你好 {student.name} 👋</div>
          <div className="mt-2 font-display text-2xl text-white">载入中…</div>
        </section>
      )}

      {/* 副信息 chips + 开始按钮 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip bg-amber-500/20 text-amber-200 border border-amber-400/30">
          🔥 {streak} 天连续
        </span>
        <span className="chip bg-violet-500/20 text-violet-100 border border-violet-400/30">
          今日已做 {todayAttempts.length}
        </span>
        {rating && (
          <span className="chip bg-cyan-500/20 text-cyan-100 border border-cyan-400/30" title="最近 7 天答题正确率">
            🎯 {Math.round(rating.raw.accuracy7d * 100)}% 准
          </span>
        )}
        <Link to="/train" className="btn-primary ml-auto text-base px-5 py-2.5">
          ▶ 开始今日挑战
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Link
          to="/train?mode=midterm"
          className="card-glow hover:scale-[1.02] transition-transform border-cyan-400/40 bg-gradient-to-br from-cyan-500/20 to-sky-500/10"
        >
          <div className="text-xl">⏰</div>
          <div className="font-display font-bold mt-2 text-cyan-100">期中冲刺</div>
          <div className="text-xs text-cyan-200/80 mt-1">下册 1-4 单元混合 15 道</div>
        </Link>
        <Link to="/picker" className="card hover:bg-ink-700/60 transition-colors">
          <div className="text-xl">🎯</div>
          <div className="font-display font-bold mt-2">自由练</div>
          <div className="text-xs text-slate-400 mt-1">挑几个技能多刷一刷</div>
        </Link>
        <Link to="/mistakes" className="card hover:bg-ink-700/60 transition-colors">
          <div className="text-xl">🪄</div>
          <div className="font-display font-bold mt-2">错题复活</div>
          <div className="text-xs text-slate-400 mt-1">
            共 {unresolvedMistakes} 道
            {dueMistakes > 0 ? <span className="text-amber-300"> · 今日到期 {dueMistakes}</span> : null}
          </div>
        </Link>
        <Link to="/train?mode=final_sprint" className="card hover:bg-ink-700/60 transition-colors">
          <div className="text-xl">🚀</div>
          <div className="font-display font-bold mt-2">期末冲刺</div>
          <div className="text-xs text-slate-400 mt-1">按下册重点组队</div>
        </Link>
      </div>

      {/* 题库快用完了提示 */}
      {poolHealth &&
        (poolHealth.freshTotal < 30 ||
          poolHealth.freshMidterm < 15 ||
          poolHealth.starvedSkills.length >= 5) && (
          <section className="card-glow border-amber-400/50 bg-gradient-to-br from-amber-500/15 to-rose-500/10">
            <div className="flex items-start gap-3">
              <div className="text-3xl">🌟</div>
              <div className="flex-1">
                <div className="font-display font-bold text-amber-100 text-lg">
                  Selena，这些题你都很熟啦！
                </div>
                <div className="text-sm text-amber-200/90 mt-1">
                  还剩 <span className="font-bold">{poolHealth.freshTotal}</span> 道新题没做（期中范围 {poolHealth.freshMidterm} 道）。
                </div>
                {poolHealth.starvedSkills.length > 0 && (
                  <div className="text-sm text-amber-200/90 mt-1">
                    这些技能你已经做完了：{poolHealth.starvedSkills.slice(0, 4).map((s) => s.skillName).join("、")}
                    {poolHealth.starvedSkills.length > 4 ? " 等" : ""}。
                  </div>
                )}
                <div className="text-sm text-amber-200/90 mt-1">让爸爸 / 妈妈给你出新题吧～</div>
                <Link to="/admin" className="btn-primary mt-3 inline-block text-sm py-2 px-4">
                  去 AI 出题
                </Link>
              </div>
            </div>
          </section>
        )}

      {/* 段位勋章柜 */}
      <BadgeInventory
        unlockedTierIds={unlockedTiers}
        equippedTierId={equippedTierId}
        onEquip={handleEquip}
      />

      {/* 奖杯墙 */}
      <TrophyWall trophies={trophies ?? []} />

      {/* 跨段升档庆祝 */}
      {celebrationToTier && (
        <UnlockCelebration
          fromTierId={
            // 从已解锁列表里挑出"刚才那一段以下的"作为 from
            unlockedTiers.find((id) => id !== celebrationToTier) ?? "school"
          }
          toTierId={celebrationToTier}
          onClose={() => setCelebrationToTier(null)}
        />
      )}
    </div>
  );
}

function computeStreak(dateKeys: string[]): number {
  if (dateKeys.length === 0) return 0;
  const set = new Set(dateKeys);
  let streak = 0;
  const cursor = new Date();
  if (!set.has(localDayKey(cursor.getTime()))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (set.has(localDayKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
