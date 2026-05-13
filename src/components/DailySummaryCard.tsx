/**
 * v0.32.10 — 主页今日快报卡（UI 重做版）。
 *
 * 设计目标（Bruce 要求）：
 *   - 顶部紧凑三学科 mini ring（Apple Watch 风格，截图友好）
 *   - 中部"今日错字/错词 + 持续薄弱"section，帮助辅导老师精准抓手
 *   - 保留游戏化彩色风格，但按专业 UI 标准重排：清晰分区 / 字体层级 /
 *     对齐 / 间距
 *
 * 数据：
 *   - 数学：db.attempts (subjectId='math', createdAt today) + db.fluencyAttempts
 *     today + db.tutorSessions today + db.mistakes (resolved/created today)
 *   - 语文：daily_log::chinese 字数 + 今日错字 (wrongItems v0.32.10) +
 *     chinese_char_progress 累计已掌握 / 持续薄弱（level<3）
 *   - 英语：daily_log::english 词数 + 今日错词 (wrongItems v0.32.10) +
 *     english_vocab_progress 累计已掌握 / 持续薄弱（level<3）
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
import { G4A_CHARS, G4B_CHARS, G4_CHARS_ALL } from "../subjects/chinese/charLibrary";
import { loadDailyLog } from "../lib/dailyActivityLog";
import { termToSemester } from "./TermSwitcher";
import type { Term } from "../core/types";
import type { MasteryStat } from "../lib/masteryTier";

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

/** 持续薄弱字/词条目（level<3 + 最近碰过的优先） */
interface WeakItem {
  item: string;
  level: number;
  wrong: number;
  lastSeenAt: number;
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

/** 今日单科目标 — 用于 mini ring 完成度 */
const DAILY_TARGET_PER_SUBJECT = 15;

/** 按学科今日数量算 0..1 进度（线性，>= target = 1.0） */
function subjectProgress(todayCount: number): number {
  if (todayCount <= 0) return 0.05;
  return Math.min(1, todayCount / DAILY_TARGET_PER_SUBJECT);
}

export function DailySummaryCard({ studentId, studentName }: DailySummaryCardProps) {
  // v0.31.107：按当前 term 过滤池 — 下册 250 / 上册 250 / 综合 500
  const liveStudent = useLiveQuery(async () => (await db.students.toArray())[0]);
  const currentTerm: Term = (liveStudent?.currentTerm as Term | undefined) ?? "下册";
  const semester = termToSemester(currentTerm);

  // 数学：attempts + fluency + tutor + mistakes 今日
  const math = useLiveQuery(async () => buildMathSummary(studentId), [studentId]);

  // 中文/英文：daily log（含 wrongItems）
  const chineseDaily = useLiveQuery(
    async () => loadDailyLog("chinese", studentId),
    [studentId],
  );
  const englishDaily = useLiveQuery(
    async () => loadDailyLog("english", studentId),
    [studentId],
  );

  // 中文累计已掌握 + 持续薄弱 — 按 term 过滤池
  const chineseStats = useLiveQuery(async () => {
    const row = await db.meta.get(`chinese_char_progress::${studentId}`);
    const map = (row?.value as Record<string, MasteryStat> | undefined) ?? {};
    const pool =
      semester === "G4A" ? G4A_CHARS : semester === "G4B" ? G4B_CHARS : G4_CHARS_ALL;
    let mastered = 0;
    const weak: WeakItem[] = [];
    for (const c of pool) {
      const s = map[c.word];
      if (!s) continue;
      if ((s.level ?? 0) >= 3) {
        mastered += 1;
      } else if (s.wrong > 0 && (s.lastSeenAt ?? 0) > 0) {
        // 学过且累计有错的字，按 lastSeenAt 倒序后做 top
        weak.push({
          item: c.word,
          level: s.level,
          wrong: s.wrong,
          lastSeenAt: s.lastSeenAt,
        });
      }
    }
    weak.sort(
      (a, b) =>
        // 优先：最近碰过（lastSeenAt 越新越前），其次错次多
        b.lastSeenAt - a.lastSeenAt || b.wrong - a.wrong,
    );
    return { mastered, total: pool.length, termLabel: currentTerm, weak: weak.slice(0, 6) };
  }, [studentId, semester, currentTerm]);

  // 英语累计已掌握 + 持续薄弱 — 按 term 过滤池
  const englishStats = useLiveQuery(async () => {
    const row = await db.meta.get(`english_vocab_progress::${studentId}`);
    const map = (row?.value as Record<string, MasteryStat> | undefined) ?? {};
    const { G4_WORDS } = await import("../subjects/english/wordList");
    const pool =
      semester === null
        ? G4_WORDS
        : G4_WORDS.filter((w) => w.semester === semester);
    let mastered = 0;
    const weak: WeakItem[] = [];
    for (const w of pool) {
      const k = w.w.toLowerCase().trim();
      const s = map[k];
      if (!s) continue;
      if ((s.level ?? 0) >= 3) {
        mastered += 1;
      } else if (s.wrong > 0 && (s.lastSeenAt ?? 0) > 0) {
        weak.push({
          item: w.w,
          level: s.level,
          wrong: s.wrong,
          lastSeenAt: s.lastSeenAt,
        });
      }
    }
    weak.sort(
      (a, b) => b.lastSeenAt - a.lastSeenAt || b.wrong - a.wrong,
    );
    return { mastered, total: pool.length, termLabel: currentTerm, weak: weak.slice(0, 6) };
  }, [studentId, semester, currentTerm]);

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

  // 三学科今日总数（mini ring 用）
  const chineseTotal =
    chineseDaily ? chineseDaily.right + chineseDaily.wrong : 0;
  const englishTotal =
    englishDaily ? englishDaily.right + englishDaily.wrong : 0;

  // 今日错字/错词（去重列表，v0.32.10）
  const chineseWrongToday = chineseDaily?.wrongItems ?? [];
  const englishWrongToday = englishDaily?.wrongItems ?? [];

  // 数学是否有内容；空状态判定
  const anyActivityToday =
    mathTotal > 0 || chineseTotal > 0 || englishTotal > 0;

  return (
    <section className="space-y-3">
      <div
        ref={cardRef}
        className="rounded-3xl p-5 bg-gradient-to-br from-violet-600/20 via-indigo-700/15 to-pink-600/15 border border-violet-400/30 space-y-4"
      >
        {/* Hero：mini 三环 + 标题 + streak */}
        <header className="flex items-center gap-4">
          <MiniSubjectRings
            mathProgress={subjectProgress(mathTotal)}
            chineseProgress={subjectProgress(chineseTotal)}
            englishProgress={subjectProgress(englishTotal)}
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-violet-200/80">📅 {todayHuman()}</div>
            <div className="font-display font-bold text-2xl text-violet-50 leading-tight">
              {studentName} 今日快报
            </div>
            {totalStreak > 0 && (
              <div className="inline-flex items-center mt-1.5 chip bg-amber-500/20 text-amber-100 border border-amber-400/40 text-xs">
                🔥 连续 {totalStreak} 天
              </div>
            )}
          </div>
        </header>

        {/* 三学科 mini stats grid */}
        <div className="grid grid-cols-3 gap-2">
          <SubjectMiniCard
            emoji="📐"
            label="数学"
            primary={mathTotal > 0 ? `${mathTotal} 题` : "未练"}
            secondary={mathRate !== null ? `${mathRate}% 对` : null}
            color="violet"
          />
          <SubjectMiniCard
            emoji="📚"
            label={`语文 ${currentTerm}`}
            primary={chineseTotal > 0 ? `${chineseTotal} 字` : "未练"}
            secondary={
              chineseTotal > 0 && chineseDaily
                ? `${chineseDaily.right} 对 · ${chineseDaily.wrong} 错`
                : chineseStats
                  ? `累计 ${chineseStats.mastered}/${chineseStats.total}`
                  : null
            }
            color="emerald"
          />
          <SubjectMiniCard
            emoji="🔤"
            label={`英语 ${currentTerm}`}
            primary={englishTotal > 0 ? `${englishTotal} 词` : "未练"}
            secondary={
              englishTotal > 0 && englishDaily
                ? `${englishDaily.right} 对 · ${englishDaily.wrong} 错`
                : englishStats
                  ? `累计 ${englishStats.mastered}/${englishStats.total}`
                  : null
            }
            color="cyan"
          />
        </div>

        {/* 今日错字 / 错词 / 数学易错 — 老师辅导抓手 */}
        {(chineseWrongToday.length > 0 ||
          englishWrongToday.length > 0 ||
          (math && math.topWrongSkills.length > 0)) && (
          <section className="space-y-2">
            <SectionTitle icon="📝" title="今日要回看" />
            <div className="space-y-2">
              {math && math.topWrongSkills.length > 0 && (
                <MistakeRow
                  emoji="📐"
                  label="数学易错"
                  items={math.topWrongSkills.slice(0, 3).map((s) => ({
                    text: s.name,
                    detail: `${s.wrong}/${s.total}`,
                  }))}
                  color="violet"
                />
              )}
              {chineseWrongToday.length > 0 && (
                <MistakeRow
                  emoji="📚"
                  label="语文错字"
                  items={chineseWrongToday.slice(-8).reverse().map((c) => ({
                    text: c,
                  }))}
                  color="emerald"
                />
              )}
              {englishWrongToday.length > 0 && (
                <MistakeRow
                  emoji="🔤"
                  label="英语错词"
                  items={englishWrongToday.slice(-8).reverse().map((w) => ({
                    text: w,
                  }))}
                  color="cyan"
                />
              )}
            </div>
          </section>
        )}

        {/* 持续薄弱字/词 — 跨日累计 level<3 */}
        {(((chineseStats?.weak.length ?? 0) > 0) ||
          ((englishStats?.weak.length ?? 0) > 0)) && (
          <section className="space-y-2">
            <SectionTitle icon="⚠️" title="持续薄弱（多练几遍）" />
            <div className="space-y-2">
              {chineseStats && chineseStats.weak.length > 0 && (
                <MistakeRow
                  emoji="📚"
                  label="语文"
                  items={chineseStats.weak.map((w) => ({
                    text: w.item,
                    detail: `错${w.wrong}`,
                  }))}
                  color="emerald"
                  dim
                />
              )}
              {englishStats && englishStats.weak.length > 0 && (
                <MistakeRow
                  emoji="🔤"
                  label="英语"
                  items={englishStats.weak.map((w) => ({
                    text: w.item,
                    detail: `错${w.wrong}`,
                  }))}
                  color="cyan"
                  dim
                />
              )}
            </div>
          </section>
        )}

        {/* 今日做了什么 chips（保留） */}
        {math && math.attempts > 0 && (
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
        )}

        {/* 累计进度（中英文掌握度，按当前 term 范围） */}
        {(chineseStats || englishStats) && (
          <section className="space-y-2 pt-1">
            <SectionTitle icon="📊" title={`累计掌握（${currentTerm}）`} />
            <div className="grid grid-cols-2 gap-2">
              {chineseStats && (
                <ProgressBar
                  label="📚 语文写字"
                  done={chineseStats.mastered}
                  total={chineseStats.total}
                  color="emerald"
                />
              )}
              {englishStats && (
                <ProgressBar
                  label="🔤 英语单词"
                  done={englishStats.mastered}
                  total={englishStats.total}
                  color="cyan"
                />
              )}
            </div>
          </section>
        )}

        {/* 空状态 */}
        {!anyActivityToday && (
          <div className="text-center text-sm text-slate-400 py-3">
            今天还没练，选学科开始吧 👇
          </div>
        )}

        <div className="text-[10px] text-slate-500 pt-1 border-t border-violet-400/10 flex items-center justify-between">
          <span>Selena's Elevate · {todayDateStr()}</span>
          <span className="text-violet-300/70">📚 G4 · 锦江和平街小学</span>
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

/* ─────────────────────── Sub Components ─────────────────────── */

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] font-bold text-violet-200/90 uppercase tracking-wide">
      <span>{icon}</span>
      <span>{title}</span>
    </div>
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
    <div className={`rounded-xl border p-2.5 ${palette}`}>
      <div className="flex items-center gap-1 text-[11px] opacity-80 whitespace-nowrap">
        <span className="text-base leading-none">{emoji}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="font-display font-bold text-base tabular-nums leading-tight mt-1">
        {primary}
      </div>
      {secondary && (
        <div className="text-[10px] opacity-70 mt-0.5 tabular-nums whitespace-nowrap truncate">
          {secondary}
        </div>
      )}
    </div>
  );
}

/** 错字/错词/易错技能 一行展示 */
function MistakeRow({
  emoji,
  label,
  items,
  color,
  dim,
}: {
  emoji: string;
  label: string;
  items: { text: string; detail?: string }[];
  color: "violet" | "emerald" | "cyan";
  /** 暗一档：用于"持续薄弱"区，跟"今日"区视觉区分 */
  dim?: boolean;
}) {
  const palette = {
    violet: dim
      ? "bg-violet-500/[0.06] border-violet-400/15 text-violet-200/80"
      : "bg-violet-500/10 border-violet-400/25 text-violet-100",
    emerald: dim
      ? "bg-emerald-500/[0.06] border-emerald-400/15 text-emerald-200/80"
      : "bg-emerald-500/10 border-emerald-400/25 text-emerald-100",
    cyan: dim
      ? "bg-cyan-500/[0.06] border-cyan-400/15 text-cyan-200/80"
      : "bg-cyan-500/10 border-cyan-400/25 text-cyan-100",
  }[color];
  return (
    <div className={`rounded-xl border px-3 py-2 ${palette}`}>
      <div className="flex items-center gap-1.5 mb-1 whitespace-nowrap">
        <span className="text-sm leading-none">{emoji}</span>
        <span className="text-[11px] font-bold opacity-90">{label}</span>
        <span className="text-[10px] opacity-60 tabular-nums">({items.length})</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <span
            key={`${it.text}-${i}`}
            className="inline-flex items-baseline gap-0.5 px-2 py-0.5 rounded-md bg-black/25 text-[12px] font-medium whitespace-nowrap"
          >
            <span>{it.text}</span>
            {it.detail && (
              <span className="text-[10px] opacity-60 tabular-nums ml-0.5">
                {it.detail}
              </span>
            )}
          </span>
        ))}
      </div>
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
      <div className="flex items-center justify-between text-[11px] mb-1 whitespace-nowrap">
        <span className="text-slate-300 truncate">{label}</span>
        <span className="text-slate-400 tabular-nums shrink-0">
          {done}/{total} · {pct}%
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

/**
 * 同心 3 学科 mini ring（80x80 SVG，截图友好）
 *   - 外环 数学 violet
 *   - 中环 语文 emerald
 *   - 内环 英语 cyan
 * 中心：闭合环数 / 3；全闭显示 🎉
 */
function MiniSubjectRings({
  mathProgress,
  chineseProgress,
  englishProgress,
}: {
  mathProgress: number;
  chineseProgress: number;
  englishProgress: number;
}) {
  const size = 80;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = 7;
  const gap = 2;
  // 外/中/内 半径
  const radii = [
    cx - stroke / 2 - 1,
    cx - stroke - gap - stroke / 2 - 1,
    cx - 2 * (stroke + gap) - stroke / 2 - 1,
  ];
  const rings = [
    {
      id: "math",
      progress: mathProgress,
      hue: "#a78bfa",
      hue2: "#7c3aed",
    },
    {
      id: "chinese",
      progress: chineseProgress,
      hue: "#34d399",
      hue2: "#059669",
    },
    {
      id: "english",
      progress: englishProgress,
      hue: "#22d3ee",
      hue2: "#0891b2",
    },
  ];
  const closedCount = rings.filter((r) => r.progress >= 1).length;
  const allDone = closedCount === 3;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="block" width={size} height={size}>
        <defs>
          {rings.map((r) => (
            <linearGradient
              key={r.id}
              id={`mr-${r.id}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor={r.hue} />
              <stop offset="100%" stopColor={r.hue2} />
            </linearGradient>
          ))}
        </defs>
        {rings.map((r, i) => {
          const radius = radii[i] ?? 10;
          const c = 2 * Math.PI * radius;
          const offset = c * (1 - Math.max(0.06, r.progress));
          return (
            <g key={r.id}>
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={r.hue}
                strokeOpacity={0.18}
                strokeWidth={stroke}
              />
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={`url(#mr-${r.id})`}
                strokeWidth={stroke}
                strokeLinecap={r.progress >= 0.5 ? "round" : "butt"}
                strokeDasharray={c}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            </g>
          );
        })}
      </svg>
      {/* 中心数字 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
        {allDone ? (
          <div className="text-2xl">🎉</div>
        ) : (
          <div className="font-display font-bold text-base text-slate-100 leading-none tabular-nums">
            {closedCount}
            <span className="text-slate-400 text-[10px]">/3</span>
          </div>
        )}
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
