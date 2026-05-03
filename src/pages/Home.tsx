import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { todayKey } from "../lib/date";
import {
  checkPoolHealth,
  computeCurrentRating,
  getEquippedBadge,
  getMockExamCooldown,
  getSelectedTerm,
  getStruggleSkills,
  getUnlockedTiers,
  setEquippedBadge,
  setSelectedTerm,
} from "../db/service";
import { tierById, TIERS, tierIndex } from "../core/tiers";
import { TierCard } from "../components/TierCard";
import { TrophyWall } from "../components/TrophyWall";
import { BadgeInventory } from "../components/BadgeInventory";
import { UnlockCelebration } from "../components/UnlockCelebration";
import type { RatingResult } from "../core/rating";
import type { Term } from "../core/types";
import { useEffect, useState } from "react";
import { ackMigrationNotice, getMigrationNoticeUnacked } from "../db/seed";
import { currentExam, daysUntil, FINAL } from "../core/examDates";

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
  const [term, setTerm] = useState<Term>("下册");
  const [poolHealth, setPoolHealth] = useState<{
    freshTotal: number;
    freshMidterm: number;
    starvedSkills: { skillId: string; skillName: string }[];
  } | null>(null);
  const [celebrationToTier, setCelebrationToTier] = useState<string | null>(null);
  const [showMigrationNotice, setShowMigrationNotice] = useState(false);
  const [struggleSkills, setStruggleSkills] = useState<{ skillId: string; skillName: string; consecutiveWrong: number; totalRecent: number }[]>([]);
  const [mockExam, setMockExam] = useState<{ available: boolean; daysUntilNext: number; lastAt: number | null } | null>(null);

  useEffect(() => {
    getMigrationNoticeUnacked().then(setShowMigrationNotice);
  }, []);

  // 加载初始 selectedTerm
  useEffect(() => {
    if (!student) return;
    getSelectedTerm(student.id).then(setTerm);
  }, [student?.id]);

  // 重新计算综合分（学期切换或数据变化时）
  useEffect(() => {
    if (!student) return;
    let cancelled = false;
    (async () => {
      const r = await computeCurrentRating(student.id, term);
      if (cancelled) return;
      setRating(r);

      // 解锁段位（按当前 term）
      const prevUnlocked = await getUnlockedTiers(student.id, term);
      const currentIdx = tierIndex(r.tier.id);
      const shouldBeUnlocked = TIERS.slice(0, currentIdx + 1).map((t) => t.id);
      const newUnlocked = Array.from(new Set([...prevUnlocked, ...shouldBeUnlocked]));
      const grewBy = newUnlocked.filter((id) => !prevUnlocked.includes(id));

      if (grewBy.length > 0) {
        const code = term === "上册" ? "G4A" : term === "下册" ? "G4B" : "MIX";
        await db.meta.put({
          key: `tiersUnlocked::${student.id}::${code}`,
          value: newUnlocked,
        });
        // 庆祝条件
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
      setStruggleSkills(await getStruggleSkills(student.id));
      setMockExam(await getMockExamCooldown(student.id));
    })();
    return () => {
      cancelled = true;
    };
  }, [student?.id, attempts?.length, term]);

  const handleEquip = async (tierId: string) => {
    if (!student) return;
    await setEquippedBadge(student.id, tierId);
    setEquippedTierId(tierId);
  };

  const handleSwitchTerm = async (t: Term) => {
    if (!student) return;
    setTerm(t);
    await setSelectedTerm(student.id, t);
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

  const TERMS: { id: Term; label: string }[] = [
    { id: "下册", label: "📚 四年级下册（当前）" },
    { id: "上册", label: "📕 四年级上册" },
    { id: "综合复习", label: "🎯 综合复习" },
  ];

  return (
    <div className="space-y-6">
      {/* 迁移通知（只显示一次） */}
      {showMigrationNotice && (
        <div className="rounded-2xl bg-gradient-to-br from-amber-500/20 to-rose-500/15 border border-amber-400/40 p-4 relative">
          <button
            type="button"
            onClick={async () => {
              await ackMigrationNotice();
              setShowMigrationNotice(false);
            }}
            className="absolute top-2 right-3 text-amber-200/60 hover:text-amber-100 text-lg leading-none"
            aria-label="知道了"
          >
            ×
          </button>
          <div className="flex gap-3">
            <div className="text-2xl">✨</div>
            <div className="flex-1 text-sm text-amber-100">
              <div className="font-display font-bold mb-1">计分规则升级啦！</div>
              <div className="text-xs text-amber-200/90 leading-relaxed">
                同一道题重复答对会**递减**：第 2 次 50%、第 3 次 20%、第 4 次 10%、之后不加分。
                <br />
                <span className="text-emerald-200">学到新知识点首次答对 +5 XP 奖励 🎓</span>
                <br />
                你的历史 XP 已经按新规则重算啦——多做新题更划算！
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 学期切换器 */}
      <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1">
        <span className="text-xs text-slate-400 shrink-0">赛季：</span>
        {TERMS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => handleSwitchTerm(t.id)}
            className={`shrink-0 chip text-xs px-3 py-1.5 transition-all ${
              term === t.id
                ? "bg-violet-500/30 text-violet-100 border border-violet-400/60 shadow-glow-violet"
                : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

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
        {rating && rating.raw.totalAttempts > 0 && (
          <span className="chip bg-cyan-500/20 text-cyan-100 border border-cyan-400/30" title="本学期答题正确率">
            🎯 {Math.round(rating.raw.accuracy * 100)}% 准
          </span>
        )}
        {(() => {
          const exam = currentExam();
          const days = daysUntil(exam.date);
          if (days < 0) return null;
          const tone =
            exam.tone === "rose"
              ? "bg-rose-500/20 text-rose-100 border-rose-400/40"
              : "bg-cyan-500/20 text-cyan-100 border-cyan-400/40";
          const text =
            days === 0 ? `📅 今天就是${exam.name}！冲！`
            : days === 1 ? `📅 明天${exam.name}`
            : `📅 距${exam.name}还有 ${days} 天`;
          return (
            <span className={`chip border ${tone}`} title={`${exam.name}：${exam.dateKey}`}>
              {text}
            </span>
          );
        })()}
        <Link to="/math/train" className="btn-primary ml-auto text-base px-5 py-2.5">
          ▶ 开始今日挑战
        </Link>
      </div>

      {/* ROI #1：红旗 skill 提示（连错 3+ 次） */}
      {struggleSkills.length > 0 && (
        <section className="card-glow border-rose-400/50 bg-gradient-to-br from-rose-500/15 to-amber-500/10">
          <div className="flex items-start gap-3">
            <div className="text-3xl">🚩</div>
            <div className="flex-1">
              <div className="font-display font-bold text-rose-100 text-base">
                这些知识点连错了好几次，需要爸妈帮一下
              </div>
              <ul className="mt-2 space-y-1 text-sm text-rose-100/90">
                {struggleSkills.slice(0, 3).map((s) => (
                  <li key={s.skillId} className="flex items-center justify-between gap-2">
                    <Link
                      to={`/math/train?skillId=${encodeURIComponent(s.skillId)}`}
                      className="underline decoration-rose-400/50 underline-offset-2 hover:text-white"
                    >
                      {s.skillName}
                    </Link>
                    <span className="chip text-[10px] px-2 py-0.5 bg-rose-500/30 border border-rose-400/40 text-rose-100">
                      最近连错 {s.consecutiveWrong} 次
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 text-xs text-rose-200/70">
                建议爸妈陪 Selena 看一看这几道，把思路讲透；不是题做不动，是没理解到位。
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {(() => {
          const exam = currentExam();
          const days = daysUntil(exam.date);
          const isMidterm = exam.id === "midterm";
          const themeCls = isMidterm
            ? "border-cyan-400/40 bg-gradient-to-br from-cyan-500/20 to-sky-500/10"
            : "border-rose-400/40 bg-gradient-to-br from-rose-500/20 to-pink-500/10";
          const titleCls = isMidterm ? "text-cyan-100" : "text-rose-100";
          const subCls = isMidterm ? "text-cyan-200/80" : "text-rose-200/80";
          const icon = isMidterm ? "⏰" : "🚀";
          const sub = days < 0
            ? `${exam.dateKey} · ${exam.hint}`
            : days <= 7
              ? `仅剩 ${days} 天 · ${exam.hint}`
              : `${exam.dateKey} · ${exam.hint}`;
          return (
            <Link
              to={`/math/train?mode=${exam.mode}`}
              className={`card-glow hover:scale-[1.02] transition-transform col-span-2 sm:col-span-1 ${themeCls}`}
            >
              <div className="text-xl">{icon}</div>
              <div className={`font-display font-bold mt-2 ${titleCls}`}>{exam.name}冲刺</div>
              <div className={`text-xs ${subCls} mt-1`}>{sub}</div>
            </Link>
          );
        })()}
        <Link to="/math/free-practice" className="card hover:bg-ink-700/60 transition-colors">
          <div className="text-xl">🎯</div>
          <div className="font-display font-bold mt-2">自由练</div>
          <div className="text-xs text-slate-400 mt-1">挑几个技能多刷一刷</div>
        </Link>
        <Link to="/math/mistakes" className="card hover:bg-ink-700/60 transition-colors">
          <div className="text-xl">🪄</div>
          <div className="font-display font-bold mt-2">错题复活</div>
          <div className="text-xs text-slate-400 mt-1">
            共 {unresolvedMistakes} 道
            {dueMistakes > 0 ? <span className="text-amber-300"> · 今日到期 {dueMistakes}</span> : null}
          </div>
        </Link>
        {/* 期中考之前也能进期末模式（家长想提前练就练）；期中考之后这张卡换成期中复习 */}
        {currentExam().id === "midterm" ? (
          <Link to="/math/train?mode=final_sprint" className="card hover:bg-ink-700/60 transition-colors">
            <div className="text-xl">🚀</div>
            <div className="font-display font-bold mt-2">期末冲刺</div>
            <div className="text-xs text-slate-400 mt-1">
              {FINAL.dateKey} · 提前打基础
            </div>
          </Link>
        ) : (
          <Link to="/math/train?mode=midterm" className="card hover:bg-ink-700/60 transition-colors">
            <div className="text-xl">📘</div>
            <div className="font-display font-bold mt-2">期中复习</div>
            <div className="text-xs text-slate-400 mt-1">
              U1-U4 还能再刷
            </div>
          </Link>
        )}
      </div>

      {/* ROI #2：每周一次的考试模拟 */}
      {mockExam && (
        mockExam.available ? (
          <Link
            to="/math/train?mode=mock_exam"
            className="card-glow block border-purple-400/40 bg-gradient-to-br from-purple-600/20 via-fuchsia-500/10 to-pink-500/10 hover:scale-[1.01] transition-transform"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="text-xs text-purple-200/70 uppercase tracking-widest">每周一次</div>
                <div className="font-display font-bold text-lg text-purple-100 mt-0.5">📝 考试模拟</div>
                <div className="text-xs text-purple-200/80 mt-1">
                  30 道题 · 锁时钟 · 无提示 · 仿真期末难度（D1:10 / D2:30 / D3:40 / D4:20）
                </div>
                {mockExam.lastAt && (
                  <div className="text-[11px] text-purple-200/60 mt-1">
                    上次完成：{new Date(mockExam.lastAt).toLocaleDateString()}
                  </div>
                )}
              </div>
              <div className="chip bg-purple-500/30 border border-purple-300/50 text-purple-50 font-display font-bold">
                可以挑战
              </div>
            </div>
          </Link>
        ) : (
          <div className="card border-white/10 opacity-70">
            <div className="flex items-center gap-3">
              <div className="text-2xl">📝</div>
              <div className="flex-1">
                <div className="font-display font-bold text-slate-200">考试模拟</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  上次刚做过，{mockExam.daysUntilNext} 天后再开放（每周 1 次保模拟感）
                </div>
              </div>
            </div>
          </div>
        )
      )}

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
                <Link to="/math/admin" className="btn-primary mt-3 inline-block text-sm py-2 px-4">
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
