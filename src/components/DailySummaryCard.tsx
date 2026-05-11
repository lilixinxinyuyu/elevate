/**
 * v0.31.103 — 主页今日总结卡。
 *
 * 设计目标（Bruce 要求）：让 Selena 自己 + 家长 + 辅导老师快速看到她今天的进步 +
 * 欠缺，可截屏分享。
 *
 * 数据：
 *   - 数学：db.attempts (subjectId='math', createdAt today) + db.fluencyAttempts
 *     today + db.tutorSessions today + db.mistakes (resolved/created today)
 *   - 语文：daily_log::chinese 字数 + chinese_char_progress 累计已掌握
 *   - 英语：daily_log::english 词数 + english_vocab_progress 累计已掌握
 *
 * 跨学科：streak / mistake revival
 *
 * 截屏：用 html-to-image.toPng() 把卡片 div 转 base64 → 触发 download。
 */

import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toPng } from "html-to-image";
import { db } from "../db/dexie";
import { SKILLS } from "../content/skills";
import { G4_CHARS_ALL } from "../subjects/chinese/charLibrary";
import { loadDailyLog } from "../lib/dailyActivityLog";

interface DailySummaryCardProps {
  studentId: string;
  studentName: string;
}

interface MathSummary {
  attempts: number;
  correct: number;
  /** 今日易错 top 3：{ skillId, name, wrong, total } */
  topWrongSkills: { skillId: string; name: string; wrong: number; total: number }[];
  fluencySessions: number;
  tutorCount: number;
  mistakeRevived: number;
}

interface SubjectStats {
  todayRight: number;
  todayWrong: number;
  todayItems: number;
  totalMastered: number;
  totalPool: number;
}

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayHuman(): string {
  const d = new Date();
  const week = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  return `${d.getMonth() + 1}/${d.getDate()} 周${week}`;
}

export function DailySummaryCard({ studentId, studentName }: DailySummaryCardProps) {
  // 数学：attempts + fluency + tutor + mistakes 今日
  const math = useLiveQuery(async () => buildMathSummary(studentId), [studentId]);

  // 中文/英文：daily log
  const chineseDaily = useLiveQuery(
    async () => loadDailyLog("chinese", studentId),
    [studentId],
  );
  const englishDaily = useLiveQuery(
    async () => loadDailyLog("english", studentId),
    [studentId],
  );

  // 中文/英文累计已掌握
  const chineseProgress = useLiveQuery(async () => {
    const row = await db.meta.get(`chinese_char_progress::${studentId}`);
    const map = (row?.value as Record<string, { level: number }> | undefined) ?? {};
    let mastered = 0;
    for (const v of Object.values(map)) if (v.level >= 3) mastered += 1;
    return { mastered, total: G4_CHARS_ALL.length };
  }, [studentId]);

  const englishProgress = useLiveQuery(async () => {
    const row = await db.meta.get(`english_vocab_progress::${studentId}`);
    const map = (row?.value as Record<string, { level: number }> | undefined) ?? {};
    let mastered = 0;
    for (const v of Object.values(map)) if (v.level >= 3) mastered += 1;
    // 词表总数从 wordList 读
    const { G4_WORDS } = await import("../subjects/english/wordList");
    return { mastered, total: G4_WORDS.length };
  }, [studentId]);

  // streak
  const mathDaily = useLiveQuery(async () => {
    const row = await db.meta.get(`daily_math_${studentId}`);
    return (row?.value as { streak?: number } | undefined)?.streak ?? 0;
  }, [studentId]);

  const chineseStreak = useLiveQuery(async () => {
    const row = await db.meta.get(`daily_chinese_${studentId}`);
    return (row?.value as { streak?: number } | undefined)?.streak ?? 0;
  }, [studentId]);

  // 截屏 export
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const handleExport = async () => {
    if (!cardRef.current) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2, // 高清
        backgroundColor: "#0b0f1f",
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `selena-${todayDateStr()}.png`;
      a.click();
    } catch (e) {
      console.error("export failed", e);
      alert("截图失败：" + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const mathTotal = math?.attempts ?? 0;
  const mathRate =
    mathTotal > 0 ? Math.round(((math?.correct ?? 0) / mathTotal) * 100) : null;
  const totalStreak = Math.max(mathDaily ?? 0, chineseStreak ?? 0);

  return (
    <section className="space-y-3">
      <div
        ref={cardRef}
        className="rounded-3xl p-5 bg-gradient-to-br from-violet-600/20 via-indigo-700/15 to-pink-600/15 border border-violet-400/30 space-y-4"
      >
        <header className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-xs text-violet-200/80">📅 {todayHuman()}</div>
            <div className="font-display font-bold text-2xl text-violet-50">
              {studentName} 今日快报
            </div>
          </div>
          {totalStreak > 0 && (
            <div className="chip bg-amber-500/20 text-amber-100 border border-amber-400/40 text-sm">
              🔥 连续 {totalStreak} 天
            </div>
          )}
        </header>

        {/* 三学科 mini ring grid */}
        <div className="grid grid-cols-3 gap-3">
          <SubjectMiniCard
            emoji="📐"
            label="数学"
            primary={mathTotal > 0 ? `${mathTotal} 题` : "未练习"}
            secondary={mathRate !== null ? `${mathRate}% 对` : null}
            color="violet"
          />
          <SubjectMiniCard
            emoji="📚"
            label="语文"
            primary={
              chineseDaily && chineseDaily.right + chineseDaily.wrong > 0
                ? `${chineseDaily.right + chineseDaily.wrong} 字`
                : "未练习"
            }
            secondary={
              chineseDaily && chineseDaily.right + chineseDaily.wrong > 0
                ? `${chineseDaily.right} 对 · ${chineseDaily.wrong} 错`
                : chineseProgress
                  ? `累计 ${chineseProgress.mastered}/${chineseProgress.total}`
                  : null
            }
            color="emerald"
          />
          <SubjectMiniCard
            emoji="🔤"
            label="英语"
            primary={
              englishDaily && englishDaily.right + englishDaily.wrong > 0
                ? `${englishDaily.right + englishDaily.wrong} 词`
                : "未练习"
            }
            secondary={
              englishDaily && englishDaily.right + englishDaily.wrong > 0
                ? `${englishDaily.right} 对 · ${englishDaily.wrong} 错`
                : englishProgress
                  ? `累计 ${englishProgress.mastered}/${englishProgress.total}`
                  : null
            }
            color="cyan"
          />
        </div>

        {/* 数学 highlights */}
        {math && math.attempts > 0 && (
          <div className="space-y-2">
            {math.topWrongSkills.length > 0 && (
              <div className="rounded-xl border border-rose-400/30 bg-rose-500/8 p-3">
                <div className="text-xs text-rose-200 mb-1.5 font-semibold">
                  🎯 今日易错 top {Math.min(3, math.topWrongSkills.length)}
                </div>
                <div className="space-y-1">
                  {math.topWrongSkills.slice(0, 3).map((s) => (
                    <div
                      key={s.skillId}
                      className="text-xs text-slate-200 flex items-center justify-between gap-2"
                    >
                      <span className="truncate">· {s.name}</span>
                      <span className="text-rose-300 tabular-nums shrink-0">
                        错 {s.wrong}/{s.total}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2 text-xs">
              {math.fluencySessions > 0 && (
                <span className="chip bg-cyan-500/15 text-cyan-200 border border-cyan-400/30">
                  ⚡ 闪电口算 {math.fluencySessions} 局
                </span>
              )}
              {math.tutorCount > 0 && (
                <span className="chip bg-violet-500/15 text-violet-200 border border-violet-400/30">
                  💬 小进帮讲 {math.tutorCount} 道
                </span>
              )}
              {math.mistakeRevived > 0 && (
                <span className="chip bg-amber-500/15 text-amber-200 border border-amber-400/30">
                  🪄 错题复活 {math.mistakeRevived} 道
                </span>
              )}
            </div>
          </div>
        )}

        {/* 累计进度（中英文掌握度） */}
        {(chineseProgress || englishProgress) && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            {chineseProgress && (
              <ProgressBar
                label="📚 语文写字"
                done={chineseProgress.mastered}
                total={chineseProgress.total}
                color="emerald"
              />
            )}
            {englishProgress && (
              <ProgressBar
                label="🔤 英语单词"
                done={englishProgress.mastered}
                total={englishProgress.total}
                color="cyan"
              />
            )}
          </div>
        )}

        {/* 空状态 */}
        {!mathTotal &&
          !(chineseDaily && chineseDaily.right + chineseDaily.wrong > 0) &&
          !(englishDaily && englishDaily.right + englishDaily.wrong > 0) && (
            <div className="text-center text-sm text-slate-400 py-3">
              今天还没练，选学科开始吧 👇
            </div>
          )}

        <div className="text-[10px] text-slate-500 pt-1 border-t border-violet-400/10">
          Selena's Elevate · {todayDateStr()}
        </div>
      </div>

      <button
        type="button"
        onClick={handleExport}
        disabled={busy}
        className="w-full py-2.5 rounded-xl bg-violet-500/15 text-violet-100 border border-violet-400/30 text-sm font-medium hover:bg-violet-500/25 disabled:opacity-50 active:scale-[0.98] transition-all"
      >
        {busy ? "生成中…" : "📷 保存今日快报图片（发老师 / 家长）"}
      </button>
    </section>
  );
}

function SubjectMiniCard({
  emoji,
  label,
  primary,
  secondary,
  color,
}: {
  emoji: string;
  label: string;
  primary: string;
  secondary: string | null;
  color: "violet" | "emerald" | "cyan";
}) {
  const palette = {
    violet: "bg-violet-500/15 border-violet-400/30 text-violet-100",
    emerald: "bg-emerald-500/15 border-emerald-400/30 text-emerald-100",
    cyan: "bg-cyan-500/15 border-cyan-400/30 text-cyan-100",
  }[color];
  return (
    <div className={`rounded-xl border p-3 ${palette}`}>
      <div className="text-2xl leading-none mb-1">{emoji}</div>
      <div className="text-[11px] opacity-80">{label}</div>
      <div className="font-display font-bold text-base tabular-nums leading-tight mt-0.5">
        {primary}
      </div>
      {secondary && (
        <div className="text-[10px] opacity-70 mt-0.5 tabular-nums">{secondary}</div>
      )}
    </div>
  );
}

function ProgressBar({
  label,
  done,
  total,
  color,
}: {
  label: string;
  done: number;
  total: number;
  color: "emerald" | "cyan";
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const fillCls = color === "emerald" ? "bg-emerald-400" : "bg-cyan-400";
  return (
    <div className="rounded-lg bg-white/5 p-2 border border-white/10">
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-slate-300">{label}</span>
        <span className="text-slate-400 tabular-nums">
          {done}/{total} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full ${fillCls} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

async function buildMathSummary(studentId: string): Promise<MathSummary> {
  const startMs = startOfTodayMs();
  // attempts 今日 (subjectId='math')
  const attempts = await db.attempts
    .where("studentId")
    .equals(studentId)
    .filter((a) => (a.subjectId ?? "math") === "math" && a.createdAt >= startMs)
    .toArray();
  const correct = attempts.filter((a) => a.isCorrect).length;

  // 今日易错 skill — count wrong per skillId
  const wrongMap = new Map<string, { wrong: number; total: number }>();
  for (const a of attempts) {
    const sid = a.skillId;
    if (!sid) continue;
    const cur = wrongMap.get(sid) ?? { wrong: 0, total: 0 };
    cur.total += 1;
    if (!a.isCorrect) cur.wrong += 1;
    wrongMap.set(sid, cur);
  }
  const skillName = new Map(SKILLS.map((s) => [s.id, s.name]));
  const topWrongSkills = Array.from(wrongMap.entries())
    .filter(([, v]) => v.wrong > 0)
    .sort((a, b) => b[1].wrong - a[1].wrong)
    .slice(0, 5)
    .map(([sid, v]) => ({
      skillId: sid,
      name: skillName.get(sid) ?? sid,
      wrong: v.wrong,
      total: v.total,
    }));

  // fluency sessions today
  let fluencySessions = 0;
  try {
    const fAtts = await db.fluencyAttempts
      .where("studentId")
      .equals(studentId)
      .filter((a) => a.createdAt >= startMs)
      .toArray();
    const sessions = new Set(fAtts.map((a) => a.sessionId).filter(Boolean));
    fluencySessions = sessions.size;
  } catch {
    /* fluency 表可能没初始化 */
  }

  // tutor sessions today
  let tutorCount = 0;
  try {
    const tutors = await db.tutorSessions
      .where("studentId")
      .equals(studentId)
      .filter((t) => t.startedAt >= startMs)
      .toArray();
    tutorCount = tutors.length;
  } catch {
    /* */
  }

  // mistake revived today (lastAttemptAt 在今天 + 推进了 stage 视为今日复活成功)
  let mistakeRevived = 0;
  try {
    const m = await db.mistakes
      .where("studentId")
      .equals(studentId)
      .filter((mk) => (mk.lastAttemptAt ?? 0) >= startMs && mk.stage > 0)
      .toArray();
    mistakeRevived = m.length;
  } catch {
    /* */
  }

  return {
    attempts: attempts.length,
    correct,
    topWrongSkills,
    fluencySessions,
    tutorCount,
    mistakeRevived,
  };
}
