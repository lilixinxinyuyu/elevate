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

import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { toPng } from "html-to-image";
import { db } from "../db/dexie";
import { SKILLS } from "../content/skills";
import { UNITS } from "../content/units";
import { G4A_CHARS, G4B_CHARS, G4_CHARS_ALL } from "../subjects/chinese/charLibrary";
import { loadDailyLog } from "../lib/dailyActivityLog";
import { getFragileSkillsToReview } from "../db/service";
import { termToSemester } from "./TermSwitcher";
import type { Term } from "../core/types";
import type { MasteryStat } from "../lib/masteryTier";
import { expectedProgress } from "../core/semesterProgress";

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
  /**
   * v0.32.15：今日错题"待复活"总数（!resolved && nextReviewAt <= now）。
   * 爸爸反馈：有错题待复活时报告卡没显示，老师/家长看不到该提醒她做。
   */
  mistakesDueToday: number;
  /** 按 skill 分组的待复活 top 5（给老师看一眼"哪几块没掌握"） */
  mistakesDueBySkill: { skillId: string; name: string; count: number }[];

  /**
   * 爸爸 2026-05-17 报告闭环重构：数学一天要 3 个 mode 都碰才算完。
   * 单一 mode 摸 1 次≠"今日数学闭环"。每一项 true = 今日至少 1 次。
   */
  modesToday: {
    /** 训练 = 任意非 big_problems 的 session 今日发生 */
    train: boolean;
    /** 闯关 = mode='big_problems' 的 session 今日发生 */
    boss: boolean;
    /** 闪电口算 = 任意 fluencyAttempt 今日发生 */
    fluency: boolean;
  };
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

/**
 * v0.32.16：合并今日错字/词 + 持续薄弱，去重 + 标 isToday。
 * 今日的优先显示（按 wrongToday 顺序倒序，最新最前），累积薄弱补在后面。
 */
function mergeWrongAndWeak(
  wrongToday: string[],
  weakAccumulated: { item: string; wrong: number }[],
): { text: string; detail?: string; isToday?: boolean }[] {
  const weakMap = new Map(weakAccumulated.map((w) => [w.item, w]));
  const seen = new Set<string>();
  const out: { text: string; detail?: string; isToday?: boolean }[] = [];
  // 1. 今日错的（最新优先）+ 如果累积薄弱里有同字，detail 加错次
  for (const t of [...wrongToday].reverse()) {
    if (seen.has(t)) continue;
    seen.add(t);
    const weak = weakMap.get(t);
    out.push({
      text: t,
      detail: weak ? `错${weak.wrong}` : undefined,
      isToday: true,
    });
  }
  // 2. 累积薄弱（已显示在今日的跳过）
  for (const w of weakAccumulated) {
    if (seen.has(w.item)) continue;
    seen.add(w.item);
    out.push({
      text: w.item,
      detail: `错${w.wrong}`,
      isToday: false,
    });
  }
  return out.slice(0, 12);
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

  /**
   * v0.32.25：跨天 bug 修。
   * 爸爸反馈："landing page 需要回看的，在今日还没开始练习的情况下，
   * 语文字和英语词都已经有内容了，把昨天的内容搬到今天来显示了"
   *
   * 根因：useLiveQuery 内部 todayDateStr() 在 closure 调用时算。
   * 但 deps 是 [studentId]，db.meta 没变化 → query 不重 invoke。
   * 跨午夜后 page 一直开着，loadDailyLog 还在拉昨天 dateKey 的数据。
   *
   * 修：currentDateKey state，每分钟检测变化，作为 useLiveQuery deps。
   * 跨天后 dateKey 变 → query 重 invoke → 拉今天的（通常是空 = 今天没练过）。
   */
  const [currentDateKey, setCurrentDateKey] = useState<string>(() => todayDateStr());
  useEffect(() => {
    const check = () => {
      const cur = todayDateStr();
      setCurrentDateKey((prev) => (prev === cur ? prev : cur));
    };
    // 每分钟 check 一次 — 跨午夜后最迟 1 分钟内切换
    const id = window.setInterval(check, 60_000);
    // visibilitychange 也 check 一下（用户切回 tab 时）
    const onVis = () => {
      if (!document.hidden) check();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // 数学：attempts + fluency + tutor + mistakes 今日
  // v0.32.25: currentDateKey 加进 deps，跨天 re-query
  const math = useLiveQuery(
    async () => buildMathSummary(studentId),
    [studentId, currentDateKey],
  );

  // v0.32.18：数学"待复习" skill — 跟 /math/skills 页面 fragile tag 一致
  //   判定: score>0 且 (最近 5 题错 ≥3 OR >21 天没碰)
  //   爸爸明确：报告里要这些 fragile 的 skill，不是"连错 3+"那批
  const mathFragile = useLiveQuery(
    async () => getFragileSkillsToReview(studentId),
    [studentId, currentDateKey],
  );

  // 爸爸 2026-05-17 报告重构 v2：数学累计掌握 % = score ≥ 75 的 skill / 总 skill。
  // unmasteredUnits 现在 3 学科都列（语文按 char level<3 group 成 "拼音池"，
  // 英语按 vocab level<3 group 成 "单词池"，没有正式 unit 概念时这样代替）。
  const mathCumulative = useLiveQuery(async () => {
    const totalSkills = SKILLS.length;
    if (totalSkills === 0) {
      return { mastered: 0, total: 0, pct: 0, unmasteredUnits: [] };
    }
    // 拉 mastery 表 → skillId → score map
    const scoreBySkill = new Map<string, number>();
    try {
      const rows = await db.mastery
        .where("studentId")
        .equals(studentId)
        .filter((m) => (m.subjectId ?? "math") === "math")
        .toArray();
      for (const r of rows) {
        const cur = scoreBySkill.get(r.skillId) ?? 0;
        if ((r.score ?? 0) > cur) scoreBySkill.set(r.skillId, r.score ?? 0);
      }
    } catch {
      /* */
    }
    let mastered = 0;
    for (const s of SKILLS) {
      if ((scoreBySkill.get(s.id) ?? 0) >= 75) mastered++;
    }
    // 按 unit 分组 → 看本 unit 多少 skill ≥ 75
    const byUnit = new Map<string, { total: number; mastered: number }>();
    for (const s of SKILLS) {
      const cur = byUnit.get(s.unitId) ?? { total: 0, mastered: 0 };
      cur.total += 1;
      if ((scoreBySkill.get(s.id) ?? 0) >= 75) cur.mastered += 1;
      byUnit.set(s.unitId, cur);
    }
    // 当前学期的 unit only；未 100% 掌握的列出，按 mastered/total ratio 升序（最薄弱前置）
    const semesterTerm = currentTerm; // 来自外面闭包：上册 / 下册 / 综合复习
    const unmasteredUnits: Array<{ unitId: string; name: string; mastered: number; total: number; pct: number }> = [];
    for (const u of UNITS) {
      if (semesterTerm !== "综合复习" && u.term !== semesterTerm) continue;
      const stat = byUnit.get(u.id) ?? { total: 0, mastered: 0 };
      if (stat.total === 0 || stat.mastered >= stat.total) continue;
      unmasteredUnits.push({
        unitId: u.id,
        name: u.name,
        mastered: stat.mastered,
        total: stat.total,
        pct: stat.mastered / stat.total,
      });
    }
    unmasteredUnits.sort((a, b) => a.pct - b.pct);
    return { mastered, total: totalSkills, pct: mastered / totalSkills, unmasteredUnits };
  }, [studentId, currentDateKey, currentTerm]);

  // 中文/英文：daily log（含 wrongItems）
  // v0.32.25: 显式传 currentDateKey，跨天后自动拉今天的 key（通常空 → 今日列表清空）
  const chineseDaily = useLiveQuery(
    async () => loadDailyLog("chinese", studentId, currentDateKey),
    [studentId, currentDateKey],
  );
  const englishDaily = useLiveQuery(
    async () => loadDailyLog("english", studentId, currentDateKey),
    [studentId, currentDateKey],
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
            // 爸爸 2026-05-17：数学 3 mode 闭环（train+boss+fluency 各占 1/3）
            // Phase 3：中文 2 mode (write+choose)，英文 2 mode (vocab+sentence)
            mathProgress={
              math
                ? (Number(math.modesToday.train) +
                    Number(math.modesToday.boss) +
                    Number(math.modesToday.fluency)) /
                  3
                : 0
            }
            chineseProgress={(() => {
              const mc = chineseDaily?.modeCounts ?? {};
              const writeDone = ((mc.write?.right ?? 0) + (mc.write?.wrong ?? 0)) > 0;
              const chooseDone = ((mc.choose?.right ?? 0) + (mc.choose?.wrong ?? 0)) > 0;
              return (Number(writeDone) + Number(chooseDone)) / 2;
            })()}
            englishProgress={(() => {
              const mc = englishDaily?.modeCounts ?? {};
              const vocabDone = ((mc.vocab?.right ?? 0) + (mc.vocab?.wrong ?? 0)) > 0;
              const sentenceDone = ((mc.sentence?.right ?? 0) + (mc.sentence?.wrong ?? 0)) > 0;
              return (Number(vocabDone) + Number(sentenceDone)) / 2;
            })()}
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

        {/* 爸爸 2026-05-17 v2：unified "今日未闭环 mode" — 列所有学科的未闭环，
            空了说明 3 学科 ×3 mode 全打卡了。每条 ✓/○ 一行直跳目标页。
            数学走 modesToday 真信号；中英文目前只 1 mode（练过/未练），等 Phase 3
            instrument 之后扩开。 */}
        {(() => {
          const items: Array<{ done: boolean; label: string; emoji: string; href: string; subject: string }> = [];
          if (math) {
            items.push({ done: math.modesToday.train, label: "数学训练", emoji: "🎯", href: "/math/train", subject: "math" });
            items.push({ done: math.modesToday.boss, label: "数学闯关", emoji: "⚔️", href: "/math/boss", subject: "math" });
            items.push({ done: math.modesToday.fluency, label: "数学闪电口算", emoji: "⚡", href: "/math/fluency", subject: "math" });
          }
          // Phase 3: 中/英文 mode 拆分（dailyLog.modeCounts）
          // chinese: write (手写) + choose (辨字)；english: vocab (单词) + sentence (短句)
          const chineseModes = chineseDaily?.modeCounts ?? {};
          const englishModes = englishDaily?.modeCounts ?? {};
          const chineseWrite = (chineseModes.write?.right ?? 0) + (chineseModes.write?.wrong ?? 0);
          const chineseChoose = (chineseModes.choose?.right ?? 0) + (chineseModes.choose?.wrong ?? 0);
          const englishVocab = (englishModes.vocab?.right ?? 0) + (englishModes.vocab?.wrong ?? 0);
          const englishSentence = (englishModes.sentence?.right ?? 0) + (englishModes.sentence?.wrong ?? 0);
          items.push({ done: chineseWrite > 0, label: "语文手写", emoji: "✍️", href: "/chinese/char-quest?mode=write", subject: "chinese" });
          items.push({ done: chineseChoose > 0, label: "语文辨字", emoji: "🔍", href: "/chinese/char-quest?mode=choose", subject: "chinese" });
          items.push({ done: englishVocab > 0, label: "英语单词", emoji: "🔤", href: "/english/vocab", subject: "english" });
          items.push({ done: englishSentence > 0, label: "英语短句", emoji: "💬", href: "/english/sentence", subject: "english" });
          const undone = items.filter((i) => !i.done);
          const total = items.length;
          const done = total - undone.length;
          if (undone.length === 0) {
            return (
              <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-center">
                <div className="text-[13px] font-bold text-emerald-100">
                  🎉 太棒了！今日 {total}/{total} 关卡全部解锁 ⭐
                </div>
              </div>
            );
          }
          // 推荐"先做这一个"：取第一个未完成项当今日 CTA（peer review GPT-5.5 建议）
          const recommended = undone[0]!;
          return (
            <div className="rounded-xl border border-violet-400/25 bg-violet-500/8 px-3 py-2.5">
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-[11px] font-bold text-violet-100">🎮 今日任务</div>
                <div className="text-[10px] font-mono text-violet-200/75 tabular-nums">
                  {done} / {total} ⭐
                </div>
              </div>
              {/* 醒目 CTA：先做这一关 */}
              <a
                href={recommended.href}
                className="block rounded-lg bg-gradient-to-r from-pink-500/30 to-violet-500/30 border border-pink-400/40 px-3 py-2.5 mb-2 hover:from-pink-500/40 hover:to-violet-500/40 transition-all"
              >
                <div className="text-[10px] text-pink-200/80 uppercase tracking-wide font-bold">▶ 先开这一关</div>
                <div className="text-[13px] font-bold text-white mt-0.5">
                  {recommended.emoji} {recommended.label}
                </div>
              </a>
              {undone.length > 1 && (
                <div className="flex flex-wrap gap-1.5">
                  {undone.slice(1).map((m) => (
                    <a
                      key={m.label}
                      href={m.href}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium bg-slate-800/40 text-slate-200 border border-slate-700/50 hover:border-violet-400/50 hover:bg-slate-800/60 transition-colors"
                    >
                      <span className="text-sm leading-none">○</span>
                      <span className="leading-none">{m.emoji}</span>
                      <span className="leading-none">{m.label}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {/* 爸爸 2026-05-17 v3 (peer review)：正向成就 strip — 平衡满屏负向信号。
            显示三科累计已掌握 + 今日 streak + AI brief 角标。
            Hero 大三环 + 这一行 = "you've already won X" 锚点。 */}
        {(mathCumulative || chineseStats || englishStats) && (
          <div className="rounded-xl border border-emerald-400/25 bg-gradient-to-r from-emerald-500/12 via-cyan-500/10 to-violet-500/12 px-3 py-2">
            <div className="text-[10px] font-bold text-emerald-200/85 uppercase tracking-wide mb-1.5">
              🏆 累计成就
            </div>
            <div className="flex items-baseline gap-3 flex-wrap text-[12px]">
              {mathCumulative && mathCumulative.mastered > 0 && (
                <span className="text-violet-100">
                  📐 数学 <span className="font-bold text-violet-50">{mathCumulative.mastered}</span><span className="text-violet-200/60">/{mathCumulative.total}</span> 技能
                </span>
              )}
              {chineseStats && chineseStats.mastered > 0 && (
                <span className="text-emerald-100">
                  📚 语文 <span className="font-bold text-emerald-50">{chineseStats.mastered}</span><span className="text-emerald-200/60">/{chineseStats.total}</span> 字
                </span>
              )}
              {englishStats && englishStats.mastered > 0 && (
                <span className="text-cyan-100">
                  🔤 英语 <span className="font-bold text-cyan-50">{englishStats.mastered}</span><span className="text-cyan-200/60">/{englishStats.total}</span> 词
                </span>
              )}
              {(!mathCumulative?.mastered && !chineseStats?.mastered && !englishStats?.mastered) && (
                <span className="text-slate-300">🌱 第一颗星等你来摘</span>
              )}
              {totalStreak >= 2 && (
                <span className="ml-auto text-amber-200 font-bold">🔥 {totalStreak} 天连练</span>
              )}
            </div>
          </div>
        )}

        {/* 三学科 mini stats grid — 爸爸 v2: cumulative ExpectedBar 内联进卡片 */}
        <div className="grid grid-cols-3 gap-2">
          <SubjectMiniCard
            emoji="📐"
            label="数学"
            primary={mathTotal > 0 ? `${mathTotal} 题` : "今日待开启"}
            secondary={mathRate !== null ? `${mathRate}% 对` : null}
            color="violet"
            cumulative={
              mathCumulative
                ? {
                    mastered: mathCumulative.mastered,
                    total: mathCumulative.total,
                    actual: mathCumulative.pct,
                    expected: expectedProgress(currentTerm),
                  }
                : null
            }
          />
          <SubjectMiniCard
            emoji="📚"
            label={`语文 ${currentTerm}`}
            primary={chineseTotal > 0 ? `${chineseTotal} 字` : "今日待开启"}
            secondary={
              chineseTotal > 0 && chineseDaily
                ? `${chineseDaily.right} 对 · ${chineseDaily.wrong} 错`
                : null
            }
            color="emerald"
            cumulative={
              chineseStats && chineseStats.total > 0
                ? {
                    mastered: chineseStats.mastered,
                    total: chineseStats.total,
                    actual: chineseStats.mastered / chineseStats.total,
                    expected: expectedProgress(currentTerm),
                  }
                : null
            }
          />
          <SubjectMiniCard
            emoji="🔤"
            label={`英语 ${currentTerm}`}
            primary={englishTotal > 0 ? `${englishTotal} 词` : "今日待开启"}
            secondary={
              englishTotal > 0 && englishDaily
                ? `${englishDaily.right} 对 · ${englishDaily.wrong} 错`
                : null
            }
            color="cyan"
            cumulative={
              englishStats && englishStats.total > 0
                ? {
                    mastered: englishStats.mastered,
                    total: englishStats.total,
                    actual: englishStats.mastered / englishStats.total,
                    expected: expectedProgress(currentTerm),
                  }
                : null
            }
          />
        </div>

        {/* v0.32.18：错题复活
            - 待复活 1-9 道：列出 skill chip
            - 待复活 = 0 + 已复活 > 0：显示"今日错题已清"
            - 待复活 > 9：隐藏（爸爸要求：">9 道题就隐藏起来"，避免压力大）
            - 全 0：不显示
         */}
        {math &&
          (() => {
            const due = math.mistakesDueToday;
            const revived = math.mistakeRevived;
            const showDueChips = due > 0 && due <= 9;
            const showCleared = due === 0 && revived > 0;
            if (!showDueChips && !showCleared) return null;
            return (
              <section className="space-y-2">
                <SectionTitle
                  icon="🔮"
                  title={`记忆封印 · 已唤醒 ${revived}${showDueChips ? ` · 待挑战 ${due}` : ""}`}
                />
                <div className="rounded-xl border px-3 py-2 bg-amber-500/10 border-amber-400/25 text-amber-100">
                  {showDueChips ? (
                    <>
                      <div className="flex items-center gap-1.5 mb-1 whitespace-nowrap">
                        <span className="text-sm leading-none">⚔️</span>
                        <span className="text-[11px] font-bold opacity-90">
                          这些封印再过一关就破除
                        </span>
                      </div>
                      {math.mistakesDueBySkill.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {math.mistakesDueBySkill.map((s) => (
                            <span
                              key={s.skillId}
                              className="inline-flex items-baseline gap-0.5 px-2 py-0.5 rounded-md bg-black/25 text-[12px] font-medium whitespace-nowrap"
                            >
                              <span>{s.name}</span>
                              <span className="text-[10px] opacity-60 tabular-nums ml-0.5">
                                ×{s.count}
                              </span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[12px] opacity-80">
                          共 {due} 道（跨多个 skill）
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className="text-sm leading-none">✨</span>
                      <span className="text-[12px] font-bold opacity-95">
                        今日封印全部破除（{revived} 道唤醒成功）
                      </span>
                    </div>
                  )}
                </div>
              </section>
            );
          })()}

        {/* v0.32.18：数学"待复习" skill — 跟 /math/skills 页面 fragile tag 同步
            判定: score>0 且 (最近 5 题错 ≥3 OR >21 天没碰)；没有就不显示 */}
        {mathFragile && mathFragile.length > 0 && (
          <section className="space-y-2">
            <SectionTitle
              icon="🔁"
              title={`数学待复习 skill（${mathFragile.length} 个）`}
            />
            <div className="rounded-xl border px-3 py-2 bg-rose-500/10 border-rose-400/25 text-rose-100">
              <div className="flex items-center gap-1.5 mb-1 whitespace-nowrap">
                <span className="text-sm leading-none">⚠️</span>
                <span className="text-[11px] font-bold opacity-90">
                  分数被压低，做对几道就能恢复
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {mathFragile.slice(0, 12).map((s) => {
                  const detail =
                    s.reason === "wrong"
                      ? `近5错${s.recent5Wrong}`
                      : s.reason === "stale"
                        ? `${s.daysSince}天未练`
                        : `近5错${s.recent5Wrong} · ${s.daysSince}天未练`;
                  return (
                    <span
                      key={s.skillId}
                      className="inline-flex items-baseline gap-0.5 px-2 py-0.5 rounded-md bg-black/25 text-[12px] font-medium whitespace-nowrap"
                    >
                      <span>{s.skillName}</span>
                      <span className="text-[10px] opacity-60 tabular-nums ml-0.5">
                        {detail}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* v0.32.26：字词回看
            爸爸 v0.32.25 反馈：今日没练时仍显示昨天/累积内容 → 不要。
            修改逻辑：
            - 每个学科行：只在该学科今日有错（wrongToday > 0）或数学今日有易错时显示
            - weak（累积薄弱）只作为今日有错时的暗色补充，不单独露面
            - 三科今日都没错 → 整个 section 不渲染
         */}
        {(() => {
          const hasMath = math && math.topWrongSkills.length > 0;
          const hasChineseToday = chineseWrongToday.length > 0;
          const hasEnglishToday = englishWrongToday.length > 0;
          // 整个 section 显示条件：任一今日有 actionable 内容
          if (!hasMath && !hasChineseToday && !hasEnglishToday) return null;

          // 各学科 merged：今日错 + 该学科累积薄弱（暗色补充）
          // 只在该学科今日有内容时才计算 / 渲染该行
          const chineseMerged = hasChineseToday
            ? mergeWrongAndWeak(chineseWrongToday, chineseStats?.weak ?? [])
            : [];
          const englishMerged = hasEnglishToday
            ? mergeWrongAndWeak(englishWrongToday, englishStats?.weak ?? [])
            : [];

          // 是否有任一行包含暗色 weak chip（用于决定底部图例是否显示）
          const hasAnyWeakChip =
            chineseMerged.some((c) => c.isToday === false) ||
            englishMerged.some((e) => e.isToday === false);

          return (
            <section className="space-y-2">
              <SectionTitle icon="📋" title="需要回看（今日）" />
              <div className="space-y-2">
                {hasMath && (
                  <MistakeRow
                    emoji="📐"
                    label="数学易错 skill"
                    items={math.topWrongSkills.slice(0, 5).map((s) => ({
                      text: s.name,
                      // v0.32.20：爸爸要求"做 X 道错 Y 道"格式，比 X/Y 更直白给老师
                      detail: `做${s.total}错${s.wrong}`,
                      isToday: true,
                    }))}
                    color="violet"
                  />
                )}
                {hasChineseToday && chineseMerged.length > 0 && (
                  <MistakeRow
                    emoji="📚"
                    label="语文字"
                    items={chineseMerged}
                    color="emerald"
                  />
                )}
                {hasEnglishToday && englishMerged.length > 0 && (
                  <MistakeRow
                    emoji="🔤"
                    label="英语词"
                    items={englishMerged}
                    color="cyan"
                  />
                )}
              </div>
              {hasAnyWeakChip && (
                <div className="text-[10px] text-slate-400 px-1">
                  亮色 = 今日错过 · 暗色 = 之前薄弱
                </div>
              )}
            </section>
          );
        })()}

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

        {/* 爸爸 2026-05-17 v3 (peer review)：知识探险 — 推荐每科攻克 Top 1，
            其余折叠在 <details> 展开（GPT-5.5 + Gemini 双推荐避免"文字墙"）。
            措辞从"未掌握"→"推荐攻克"，正向引导而非负向报怨。*/}
        {(() => {
          interface Row { key: string; name: string; mastered: number; total: number; pct: number; href: string }
          const groups: Array<{ key: string; tone: string; emoji: string; subject: string; top: Row; more: Row[]; moreNote?: string }> = [];
          if (mathCumulative && mathCumulative.unmasteredUnits.length > 0) {
            const us = mathCumulative.unmasteredUnits;
            const top = {
              key: us[0]!.unitId,
              name: us[0]!.name,
              mastered: us[0]!.mastered,
              total: us[0]!.total,
              pct: us[0]!.pct,
              href: `/math/train?unitId=${encodeURIComponent(us[0]!.unitId)}`,
            };
            const more = us.slice(1, 8).map((u) => ({
              key: u.unitId, name: u.name, mastered: u.mastered, total: u.total, pct: u.pct,
              href: `/math/train?unitId=${encodeURIComponent(u.unitId)}`,
            }));
            groups.push({
              key: "math", tone: "border-violet-400/25 bg-violet-500/8", emoji: "📐", subject: "数学",
              top, more,
              moreNote: us.length > 8 ? `还有 ${us.length - 8} 个数学单元` : undefined,
            });
          }
          if (chineseStats && chineseStats.total > chineseStats.mastered) {
            const remaining = chineseStats.total - chineseStats.mastered;
            const top = {
              key: "chinese-pool",
              name: `${currentTerm}写字 · 还差 ${remaining} 字达 level≥3`,
              mastered: chineseStats.mastered, total: chineseStats.total,
              pct: chineseStats.mastered / chineseStats.total, href: "/chinese",
            };
            groups.push({ key: "chinese", tone: "border-emerald-400/25 bg-emerald-500/8", emoji: "📚", subject: "语文", top, more: [] });
          }
          if (englishStats && englishStats.total > englishStats.mastered) {
            const remaining = englishStats.total - englishStats.mastered;
            const top = {
              key: "english-pool",
              name: `${currentTerm}单词 · 还差 ${remaining} 词达 level≥3`,
              mastered: englishStats.mastered, total: englishStats.total,
              pct: englishStats.mastered / englishStats.total, href: "/english/vocab",
            };
            groups.push({ key: "english", tone: "border-cyan-400/25 bg-cyan-500/8", emoji: "🔤", subject: "英语", top, more: [] });
          }
          if (groups.length === 0) {
            return (
              <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-2 text-center">
                <div className="text-[13px] font-bold text-emerald-100">🌟 3 学科全部攻克完成</div>
              </div>
            );
          }
          const rowOf = (r: Row) => {
            const pct = Math.round(r.pct * 100);
            const rowTone =
              r.pct < 0.25 ? "bg-rose-500/20 border-rose-400/30 text-rose-100"
              : r.pct < 0.5 ? "bg-amber-500/20 border-amber-400/30 text-amber-100"
              : "bg-emerald-500/15 border-emerald-400/25 text-emerald-100";
            return (
              <a
                key={r.key}
                href={r.href}
                className={`flex items-center justify-between gap-2 px-2 py-1.5 rounded-md border text-[12px] ${rowTone} hover:brightness-125 transition-all`}
              >
                <span className="truncate">{r.name}</span>
                <span className="font-mono text-[11px] tabular-nums whitespace-nowrap">
                  {r.mastered}/{r.total} · {pct}%
                </span>
              </a>
            );
          };
          return (
            <section className="space-y-2 pt-1">
              <SectionTitle icon="🗺️" title="知识探险 · 推荐攻克" />
              {groups.map((g) => (
                <div key={g.key} className={`rounded-xl border ${g.tone} px-3 py-2 space-y-1.5`}>
                  <div className="text-[11px] font-bold text-violet-100 mb-0.5">
                    {g.emoji} {g.subject}
                  </div>
                  {rowOf(g.top)}
                  {(g.more.length > 0 || g.moreNote) && (
                    <details className="group">
                      <summary className="cursor-pointer text-[10px] text-violet-200/70 hover:text-white select-none pt-0.5">
                        + 还有 {g.more.length + (g.moreNote ? Math.max(0, (mathCumulative?.unmasteredUnits.length ?? 0) - 8) : 0)} 个待挑战 <span className="group-open:hidden">▾</span><span className="hidden group-open:inline">▴</span>
                      </summary>
                      <div className="space-y-1 mt-1.5">
                        {g.more.map(rowOf)}
                        {g.moreNote && (
                          <div className="text-[10px] text-violet-200/60 text-center pt-0.5">
                            …{g.moreNote}
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              ))}
            </section>
          );
        })()}

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
  cumulative,
}: {
  emoji: string;
  label: string;
  primary: string;
  secondary: string | null;
  color: "violet" | "emerald" | "cyan";
  /** 爸爸 2026-05-17 v2：累计掌握 + expected 标线 inline 到 SubjectMiniCard，
   * 不再独立"学期累计进度"section 占大面积 */
  cumulative?: { mastered: number; total: number; actual: number; expected: number } | null;
}) {
  const palette = {
    violet: "bg-violet-500/15 border-violet-400/30 text-violet-100",
    emerald: "bg-emerald-500/15 border-emerald-400/30 text-emerald-100",
    cyan: "bg-cyan-500/15 border-cyan-400/30 text-cyan-100",
  }[color];
  const fillColor =
    color === "violet" ? "#a78bfa" : color === "emerald" ? "#34d399" : "#22d3ee";
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
      {cumulative && cumulative.total > 0 && (
        <div className="mt-1.5">
          <div className="relative h-1.5 rounded-full bg-black/30 overflow-visible">
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${Math.max(2, cumulative.actual * 100)}%`,
                backgroundColor: fillColor,
              }}
            />
            {/* expected pos marker — small vertical pin */}
            <div
              className="absolute -top-0.5 bottom-[-2px] w-px bg-white/70"
              style={{ left: `${cumulative.expected * 100}%` }}
              title={`按学期 ${Math.round(cumulative.expected * 100)}%`}
            />
          </div>
          {/* Ep v3 (peer review)：Gemini caught readability bug — "27/5153%" cramming.
             加 gap-2 + 移除应到（已在 marker hover title），仅显示实际 + N/total */}
          <div className="flex justify-between gap-2 text-[9px] opacity-60 mt-0.5 tabular-nums">
            {cumulative.mastered === 0 ? (
              <>
                <span>🌱 新征程</span>
                <span>目标 {Math.round(cumulative.expected * 100)}%</span>
              </>
            ) : (
              <>
                <span className="flex-shrink-0">{cumulative.mastered} / {cumulative.total}</span>
                <span className="flex-shrink-0">
                  已 {Math.round(cumulative.actual * 100)}%
                  <span className="ml-1 opacity-50">· 目标 {Math.round(cumulative.expected * 100)}%</span>
                </span>
              </>
            )}
          </div>
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
}: {
  emoji: string;
  label: string;
  /** v0.32.16: per-item isToday flag — 今日错亮色，累积薄弱暗色 */
  items: { text: string; detail?: string; isToday?: boolean }[];
  color: "violet" | "emerald" | "cyan";
}) {
  const palette = {
    violet: "bg-violet-500/10 border-violet-400/25 text-violet-100",
    emerald: "bg-emerald-500/10 border-emerald-400/25 text-emerald-100",
    cyan: "bg-cyan-500/10 border-cyan-400/25 text-cyan-100",
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
            className={`inline-flex items-baseline gap-0.5 px-2 py-0.5 rounded-md text-[12px] font-medium whitespace-nowrap ${
              it.isToday === false
                ? "bg-black/15 opacity-65"
                : "bg-black/30"
            }`}
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
/**
 * 爸爸 2026-05-17 报告重构：累计掌握 % 进度条 + expected-by-now 标线。
 *
 * actual 0..1 是实际掌握比例（mastered/total），expected 0..1 是按学期日期
 * 线性算出的"今天应该走到这"。两条线对比给爸爸 / Selena 一眼判断超前/落后。
 *
 * 颜色：超前(>5%)=emerald；on-track(±5%)=violet；落后(<-5%)=amber。
 */
function ExpectedBar({
  actual,
  expected,
  label,
  detail,
}: {
  actual: number;
  expected: number;
  label: string;
  detail?: string;
}) {
  const a = Math.max(0, Math.min(1, actual));
  const e = Math.max(0, Math.min(1, expected));
  const diff = a - e;
  const status: "ahead" | "on_track" | "behind" =
    diff > 0.05 ? "ahead" : diff < -0.05 ? "behind" : "on_track";
  const barFill =
    status === "ahead"
      ? "from-emerald-400 to-emerald-300"
      : status === "behind"
        ? "from-amber-400 to-amber-300"
        : "from-violet-400 to-violet-300";
  const statusText =
    status === "ahead" ? "超进度" : status === "behind" ? "落后于预期" : "符合进度";
  const statusColor =
    status === "ahead" ? "text-emerald-200" : status === "behind" ? "text-amber-200" : "text-violet-200";
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-violet-100/85">{label}</span>
        <span className="flex items-baseline gap-1.5 text-[10px] tabular-nums">
          {detail && <span className="text-violet-200/70">{detail}</span>}
          <span className={`font-bold ${statusColor}`}>{statusText}</span>
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-slate-900/60 border border-white/10 overflow-visible">
        {/* actual fill */}
        <div
          className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r ${barFill}`}
          style={{ width: `${Math.max(2, a * 100)}%` }}
          aria-hidden
        />
        {/* expected marker — vertical pin */}
        <div
          className="absolute -top-1 bottom-[-4px] w-px bg-violet-100/90"
          style={{ left: `${e * 100}%` }}
          aria-hidden
          title={`按学期 ${Math.round(e * 100)}%`}
        />
        <div
          className="absolute -top-1.5 w-2.5 h-2.5 rounded-full bg-violet-100 border border-violet-900 shadow-sm"
          style={{ left: `calc(${e * 100}% - 5px)` }}
          aria-hidden
        />
      </div>
      <div className="flex items-baseline justify-between text-[9px] font-mono text-violet-200/60 tabular-nums">
        <span>实际 {Math.round(a * 100)}%</span>
        <span>↑ 按学期应到 {Math.round(e * 100)}%</span>
      </div>
    </div>
  );
}

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
  let mistakesDueToday = 0;
  const mistakesDueBySkill: { skillId: string; name: string; count: number }[] = [];
  try {
    const allMistakes = await db.mistakes
      .where("studentId")
      .equals(studentId)
      .toArray();
    const nowMs = Date.now();
    // 今日已推进过的
    mistakeRevived = allMistakes.filter(
      (mk) => (mk.lastAttemptAt ?? 0) >= startMs && mk.stage > 0,
    ).length;
    // v0.32.15：今日待复活（未掌握 + 到期）
    const due = allMistakes.filter(
      (mk) => !mk.resolved && mk.nextReviewAt <= nowMs,
    );
    mistakesDueToday = due.length;
    // 按 skill 分组 top 5
    const skillCount = new Map<string, number>();
    for (const mk of due) {
      const sid = mk.skillId;
      if (!sid) continue;
      skillCount.set(sid, (skillCount.get(sid) ?? 0) + 1);
    }
    const sortedSkills = Array.from(skillCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [sid, count] of sortedSkills) {
      mistakesDueBySkill.push({
        skillId: sid,
        name: skillName.get(sid) ?? sid,
        count,
      });
    }
  } catch {
    /* mistakes 表可能没初始化 */
  }

  // 爸爸 2026-05-17：今日数学 3 mode 闭环
  // train = 任意非 big_problems mode 的 session 今天发生
  // boss = mode='big_problems' 的 session 今天发生
  // fluency = 今日 fluencyAttempt count > 0
  let trainModeToday = false;
  let bossModeToday = false;
  try {
    const todaySessions = await db.sessions
      .where("studentId")
      .equals(studentId)
      .filter((s) => s.dateKey === todayDateStr() && (s.subjectId ?? "math") === "math")
      .toArray();
    for (const s of todaySessions) {
      if (s.mode === "big_problems") bossModeToday = true;
      else trainModeToday = true;
    }
  } catch {
    /* sessions 可能空 */
  }
  const fluencyModeToday = fluencySessions > 0;

  return {
    attempts: attempts.length,
    correct,
    topWrongSkills,
    fluencySessions,
    tutorCount,
    mistakeRevived,
    mistakesDueToday,
    mistakesDueBySkill,
    modesToday: {
      train: trainModeToday,
      boss: bossModeToday,
      fluency: fluencyModeToday,
    },
  };
}
