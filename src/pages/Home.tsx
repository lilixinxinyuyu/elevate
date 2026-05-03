import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { todayKey } from "../lib/date";
import { levelFromXp } from "../core/scoring";
import { TROPHIES } from "../core/trophies";
import { checkPoolHealth, getTotalXp } from "../db/service";
import { useEffect, useState } from "react";

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
  const [xp, setXp] = useState(0);
  const [poolHealth, setPoolHealth] = useState<{
    freshTotal: number;
    freshMidterm: number;
    starvedSkills: { skillId: string; skillName: string }[];
  } | null>(null);
  useEffect(() => {
    if (!student) return;
    getTotalXp(student.id).then(setXp);
    checkPoolHealth(student.id).then(setPoolHealth);
  }, [student?.id, attempts?.length]);

  if (!student) return <div className="card">正在初始化…</div>;
  const practiceDays = new Set(
    (attempts ?? []).map((a) => new Date(a.createdAt).toISOString().slice(0, 10)),
  );
  const streak = computeStreak(Array.from(practiceDays));
  const today = todayKey();
  const todayAttempts = (attempts ?? []).filter(
    (a) => new Date(a.createdAt).toISOString().slice(0, 10) === today,
  );
  const unresolvedMistakes = (mistakes ?? []).filter((m) => !m.resolved).length;
  const dueMistakes = (mistakes ?? []).filter((m) => !m.resolved && m.nextReviewAt <= Date.now()).length;
  const trophyCounts = new Map<string, number>();
  for (const t of trophies ?? []) {
    trophyCounts.set(t.trophyId, (trophyCounts.get(t.trophyId) ?? 0) + 1);
  }
  const totalTrophyCount = trophies?.length ?? 0;
  const level = levelFromXp(xp);

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600/30 via-fuchsia-600/20 to-pink-600/30 border border-violet-400/20 p-6">
        <div className="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="absolute -left-12 -bottom-12 w-56 h-56 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative">
          <div className="text-sm text-violet-200">你好 {student.name} 👋</div>
          <div className="mt-1 font-display font-bold text-3xl sm:text-4xl text-white">
            今天来打几关？
          </div>
          <div className="mt-2 flex items-center gap-3 text-sm text-slate-200">
            <span className="chip bg-white/10 border border-white/10">Lv {level}</span>
            <span className="chip bg-amber-500/20 text-amber-200 border border-amber-400/30">🔥 {streak} 天连续</span>
            <span className="chip bg-violet-500/20 text-violet-100 border border-violet-400/30">今日已做 {todayAttempts.length}</span>
          </div>
          <Link to="/train" className="btn-primary mt-5 text-base px-6 py-3">
            ▶ 开始今日挑战
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Link to="/train?mode=midterm" className="card-glow hover:scale-[1.02] transition-transform border-cyan-400/40 bg-gradient-to-br from-cyan-500/20 to-sky-500/10">
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

      {/* 题库快用完了 → 提示找家长 / 用 AI 出题 */}
      {poolHealth && (poolHealth.freshTotal < 12 || poolHealth.starvedSkills.length >= 3) && (
        <section className="card-glow border-amber-400/50 bg-gradient-to-br from-amber-500/15 to-rose-500/10">
          <div className="flex items-start gap-3">
            <div className="text-3xl">🌟</div>
            <div className="flex-1">
              <div className="font-display font-bold text-amber-100 text-lg">
                Selena，这些题你都很熟啦！
              </div>
              <div className="text-sm text-amber-200/90 mt-1">
                还剩 <span className="font-bold">{poolHealth.freshTotal}</span> 道新题没做
                {poolHealth.starvedSkills.length > 0 && (
                  <>，{poolHealth.starvedSkills.slice(0, 3).map((s) => s.skillName).join("、")}
                  {poolHealth.starvedSkills.length > 3 ? " 等" : ""} 已经全做过了。</>
                )}
              </div>
              <div className="text-sm text-amber-200/90 mt-1">
                让爸爸 / 妈妈给你出新题吧～
              </div>
              <Link to="/admin" className="btn-primary mt-3 inline-block text-sm py-2 px-4">
                去 AI 出题
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* 奖杯柜 */}
      <section className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="font-display font-bold">奖杯柜</div>
          <div className="text-xs text-slate-400">
            {trophyCounts.size} / {TROPHIES.length} 种 · 共 {totalTrophyCount} 枚
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {TROPHIES.map((t) => {
            const count = trophyCounts.get(t.id) ?? 0;
            const got = count > 0;
            return (
              <div
                key={t.id}
                className={`relative shrink-0 w-28 rounded-2xl p-3 border text-center ${
                  got
                    ? "bg-gradient-to-br from-amber-500/30 to-orange-500/20 border-amber-400/50 shadow-glow-amber"
                    : "bg-white/5 border-white/10 grayscale opacity-50"
                }`}
                title={t.description + (got ? ` （已获得 ${count} 次）` : "")}
              >
                {count > 1 && (
                  <span className="absolute -top-2 -right-2 chip bg-rose-500 text-white border border-rose-300 font-display font-bold px-2 py-0.5 shadow-glow-rose">
                    × {count}
                  </span>
                )}
                <div className="text-3xl">{t.icon ?? "🏆"}</div>
                <div className={`text-xs mt-1 leading-tight ${got ? "text-amber-100" : "text-slate-400"}`}>{t.name}</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function computeStreak(dateKeys: string[]): number {
  if (dateKeys.length === 0) return 0;
  const set = new Set(dateKeys);
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (!set.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
