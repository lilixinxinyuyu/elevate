/**
 * 词汇大冒险 — 英语单词主战场（v0.31.42）
 *
 * 路由：/english/vocab
 *
 * 升级（v0.31.42）：
 *   1. 上下册切换 → student.currentTerm（赛季制；与数学一致）
 *   2. 游戏化命名 "词汇大冒险" 而非纯"单词"
 *   3. 4 模式：
 *      - 看单词 → 选中文（含 🔊）
 *      - 看中文 → 选单词
 *      - 🔊 听读音 → 选单词
 *      - ⚡ 闪电冲刺：60 秒尽量多答（沿用数学闪电口算节奏）
 */

import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/dexie";
import { G4_WORDS, type G4Word } from "../../subjects/english/wordList";
import {
  buildOptions,
  calcOldStyleStats,
  calcTierDistribution,
  loadVocabProgress,
  migrateHistoricalVocabProgress,
  normWord,
  pickNextWord,
  recordVocabAttempt,
  speakEnglish,
  type OldStyleVocabStats,
  type VocabProgress,
} from "../../lib/englishVocabProgress";
import {
  freshStat,
  type Level,
  type MasteryStat,
} from "../../lib/masteryTier";
import { loadDaily, tickDaily, type DailyState } from "../../lib/dailyTarget";
import { MasteryTierBar, TierChip } from "../../components/MasteryTierBar";
import { termToSemester } from "../../components/TermSwitcher";
import { SpeakWordPanel } from "../../components/english/SpeakWordPanel";
import type { Term } from "../../core/types";

// v0.31.103：加 "speak" 朗读模式（Qwen3-Omni 判分）。其他模式不变。
type Mode = "word2cn" | "cn2word" | "listen" | "speak" | "sprint";
const RECENT_WINDOW = 5;
const REINFORCE_WINDOW = 2;
const SPRINT_DURATION_SECONDS = 60;

interface RoundResult {
  word: string;
  cn: string;
  isCorrect: boolean;
  userPick: string;
  mode: Mode;
  newLevel: Level;
}

export function VocabPracticePage() {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [progress, setProgress] = useState<VocabProgress>({});
  const [daily, setDaily] = useState<DailyState | null>(null);
  // v0.31.43: useLiveQuery 让赛季实时跟首页切换
  const liveStudent = useLiveQuery(async () => (await db.students.toArray())[0]);
  const currentTerm: Term = (liveStudent?.currentTerm as Term | undefined) ?? "下册";
  const [mode, setMode] = useState<Mode>("word2cn");
  const [current, setCurrent] = useState<G4Word | null>(null);
  const [options, setOptions] = useState<G4Word[]>([]);
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; pick: string } | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const [reinforceQueue, setReinforceQueue] = useState<{ word: string; remaining: number }[]>([]);
  const [history, setHistory] = useState<RoundResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [migratedToast, setMigratedToast] = useState<string | null>(null);
  const [combo, setCombo] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [floatingXp, setFloatingXp] = useState<{ amount: number; key: number } | null>(null);
  const [dailyCelebration, setDailyCelebration] = useState<{ streak: number } | null>(null);
  const [levelUpToast, setLevelUpToast] = useState<{ word: string; from: Level; to: Level } | null>(null);
  // 闪电冲刺状态
  const [sprintState, setSprintState] = useState<
    | { stage: "idle" }
    | { stage: "running"; secondsLeft: number; correct: number; wrong: number }
    | { stage: "done"; correct: number; wrong: number }
  >({ stage: "idle" });
  const sprintTimerRef = useRef<number | null>(null);

  const semester = termToSemester(currentTerm);
  // v0.31.43: 综合复习 (semester === null) → 上下册混合池
  const pool: G4Word[] = useMemo(
    () =>
      semester === null
        ? G4_WORDS
        : G4_WORDS.filter((w) => w.semester === semester),
    [semester],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ss = await db.students.toArray();
      const s = ss[0];
      if (!s) {
        setLoading(false);
        return;
      }
      if (cancelled) return;
      setStudentId(s.id);
      const migr = await migrateHistoricalVocabProgress(s.id);
      if (migr.imported > 0 || migr.upgraded > 0) {
        setMigratedToast(`已迁移 ${migr.imported} 词 + 升级 ${migr.upgraded} 词到 5-tier 等级`);
        setTimeout(() => setMigratedToast(null), 5000);
      }
      const p = await loadVocabProgress(s.id);
      const d = await loadDaily("english_vocab", s.id, 15);
      if (cancelled) return;
      setProgress(p);
      setDaily(d);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    pickNew(progress, [], []);
    setRecent([]);
    setReinforceQueue([]);
    setFeedback(null);
    setCombo(0);
    setSprintState({ stage: "idle" });
    if (sprintTimerRef.current) {
      window.clearInterval(sprintTimerRef.current);
      sprintTimerRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTerm, mode, loading]);

  useEffect(() => {
    if (mode !== "listen" || !current) return;
    const t = setTimeout(() => speakEnglish(current.w), 350);
    return () => clearTimeout(t);
  }, [mode, current]);

  function pickNew(p: VocabProgress, recentLower: string[], reinforceWords: string[]) {
    const next = pickNextWord(pool, p, recentLower, reinforceWords);
    setCurrent(next);
    if (next) {
      setOptions(buildOptions(next, pool));
    } else {
      setOptions([]);
    }
  }

  function flashXp(amount: number) {
    setFloatingXp({ amount, key: Date.now() });
    setTimeout(() => setFloatingXp(null), 900);
  }

  function startSprint() {
    if (sprintTimerRef.current) window.clearInterval(sprintTimerRef.current);
    setSprintState({ stage: "running", secondsLeft: SPRINT_DURATION_SECONDS, correct: 0, wrong: 0 });
    pickNew(progress, [], []);
    setFeedback(null);
    sprintTimerRef.current = window.setInterval(() => {
      setSprintState((s) => {
        if (s.stage !== "running") return s;
        if (s.secondsLeft <= 1) {
          if (sprintTimerRef.current) {
            window.clearInterval(sprintTimerRef.current);
            sprintTimerRef.current = null;
          }
          return { stage: "done", correct: s.correct, wrong: s.wrong };
        }
        return { ...s, secondsLeft: s.secondsLeft - 1 };
      });
    }, 1000);
  }

  async function recordResult(isCorrect: boolean, pick: string) {
    if (!current) return;
    setFeedback({ isCorrect, pick });
    const oldStat = progress[normWord(current.w)] ?? freshStat();
    let nextStat: MasteryStat;
    if (studentId) {
      nextStat = await recordVocabAttempt(studentId, current.w, isCorrect);
    } else {
      const tmp = { ...oldStat };
      tmp.right += isCorrect ? 1 : 0;
      tmp.wrong += isCorrect ? 0 : 1;
      tmp.lastSeenAt = Date.now();
      tmp.consecutiveRight = isCorrect ? tmp.consecutiveRight + 1 : 0;
      nextStat = tmp;
    }
    const nextProgress: VocabProgress = { ...progress, [normWord(current.w)]: nextStat };
    setProgress(nextProgress);

    setHistory((h) => [
      ...h.slice(-19),
      { word: current.w, cn: current.c, isCorrect, userPick: pick, mode, newLevel: nextStat.level },
    ]);

    if (isCorrect && nextStat.level > oldStat.level) {
      setLevelUpToast({ word: current.w, from: oldStat.level, to: nextStat.level });
      setTimeout(() => setLevelUpToast(null), 2000);
    }

    if (isCorrect) {
      const base = mode === "sprint" ? 5 : 8; // sprint 单题分少但题量大
      const comboBonus = Math.min(combo, 9) * 2;
      const tierBonus = nextStat.level > oldStat.level ? 5 : 0;
      const earned = base + comboBonus + tierBonus;
      setSessionXp((x) => x + earned);
      setCombo((c) => c + 1);
      flashXp(earned);
      setReinforceQueue((q) =>
        q
          .filter((r) => r.word !== normWord(current.w))
          .map((r) => ({ ...r, remaining: r.remaining - 1 }))
          .filter((r) => r.remaining > 0),
      );
    } else {
      setCombo(0);
      flashXp(0);
      setReinforceQueue((q) => {
        const without = q.filter((r) => r.word !== normWord(current.w));
        return [
          ...without.map((r) => ({ ...r, remaining: r.remaining - 1 })).filter((r) => r.remaining > 0),
          { word: normWord(current.w), remaining: REINFORCE_WINDOW },
        ];
      });
    }

    if (studentId && daily && mode !== "sprint") {
      // sprint 模式不计入今日字次（避免一次 60s 把 daily 用光）
      const { next: dNext, justCompleted } = await tickDaily("english_vocab", studentId, daily);
      setDaily(dNext);
      if (justCompleted) {
        setDailyCelebration({ streak: dNext.streak });
        setTimeout(() => setDailyCelebration(null), 4500);
      }
    }

    if (mode === "sprint") {
      // sprint：立刻进下一题，更新 score
      setSprintState((s) =>
        s.stage === "running"
          ? { ...s, correct: s.correct + (isCorrect ? 1 : 0), wrong: s.wrong + (isCorrect ? 0 : 1) }
          : s,
      );
      setTimeout(() => advance(nextProgress), 600);
    } else if (isCorrect) {
      setTimeout(() => advance(nextProgress), 1100);
    }
  }

  function advance(p: VocabProgress) {
    if (!current) return;
    const newRecent = [normWord(current.w), ...recent].slice(0, RECENT_WINDOW);
    setRecent(newRecent);
    pickNew(p, newRecent, reinforceQueue.map((r) => r.word));
    setFeedback(null);
  }

  const oldStats = useMemo(() => calcOldStyleStats(pool, progress), [pool, progress]);
  const tierDist = useMemo(() => calcTierDistribution(pool, progress), [pool, progress]);

  if (loading) return <div className="card text-center text-slate-300">加载中…</div>;

  return (
    <div className="space-y-3 relative">
      <header className="flex items-center justify-between gap-2">
        <div>
          <div className="font-display font-bold text-2xl text-cyan-200">
            🌍 词汇大冒险
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            4 种玩法 · 间隔重现
          </div>
        </div>
        <Link
          to="/english"
          className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border border-ink-700/60 hover:border-ink-600"
        >
          ← 回首页
        </Link>
      </header>

      {migratedToast && (
        <div className="rounded-xl border border-cyan-400/40 bg-cyan-500/10 text-cyan-100 text-xs px-3 py-2">
          ✓ {migratedToast}
        </div>
      )}

      {/* v0.31.43: 学期切换移到首页（与数学 UX 一致），这里只显示当前赛季 chip */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="chip text-[11px] px-2.5 py-1 bg-violet-500/15 border border-violet-400/30 text-violet-100">
          {currentTerm === "综合复习" ? "🎯 综合复习" : currentTerm === "上册" ? "📕 四年级上册" : "📚 四年级下册"}
        </span>
        <Link
          to="/english"
          className="chip text-[11px] px-2.5 py-1 bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
        >
          切换赛季 →
        </Link>
      </div>

      {/* 5 模式（v0.31.103 加"📣 朗读"——Qwen Omni AI 判分） */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        <ModeTab active={mode === "word2cn"} onClick={() => setMode("word2cn")}>看词 → 中文</ModeTab>
        <ModeTab active={mode === "cn2word"} onClick={() => setMode("cn2word")}>看中文 → 词</ModeTab>
        <ModeTab active={mode === "listen"} onClick={() => setMode("listen")}>🔊 听 → 词</ModeTab>
        <ModeTab active={mode === "speak"} onClick={() => setMode("speak")}>📣 朗读 AI 判</ModeTab>
        <ModeTab active={mode === "sprint"} onClick={() => setMode("sprint")}>⚡ 闪电冲刺</ModeTab>
      </div>

      {/* 5-tier 分布 */}
      <div className="card-glow space-y-3">
        <div className="text-xs text-slate-300 font-semibold">
          本赛季掌握分布（{semester === "G4A" ? "上册" : semester === "G4B" ? "下册" : "综合"} {tierDist.total} 词）
        </div>
        <MasteryTierBar dist={tierDist} />
      </div>

      <StatsBar
        stats={oldStats}
        combo={combo}
        sessionXp={sessionXp}
        daily={daily}
        sprintInfo={
          sprintState.stage === "running"
            ? { secondsLeft: sprintState.secondsLeft, correct: sprintState.correct, wrong: sprintState.wrong }
            : null
        }
      />

      {mode === "speak" && current ? (
        <SpeakWordPanel
          target={current.w}
          hintMeaning={current.c}
          mode="word"
          onScore={(score, _transcript, _feedback) => {
            const isCorrect = score >= 70;
            void recordResult(isCorrect, `🎤 ${score}/100`);
            // v0.31.107：朗读 ≥70 分独立计入 english_speak daily（喂朗读环）
            if (isCorrect && studentId) {
              void (async () => {
                const cur = await loadDaily("english_speak", studentId, 5);
                await tickDaily("english_speak", studentId, cur);
              })();
            }
          }}
        />
      ) : mode === "sprint" ? (
        <SprintPanel
          state={sprintState}
          word={current}
          options={options}
          feedback={feedback}
          stat={current ? progress[normWord(current.w)] : undefined}
          onStart={startSprint}
          onPick={(opt) => {
            if (sprintState.stage !== "running" || !current) return;
            const isCorrect = opt === current.c;
            void recordResult(isCorrect, opt);
          }}
          onRestart={() => {
            setSprintState({ stage: "idle" });
          }}
        />
      ) : !current ? (
        <div className="card text-center text-slate-300 py-8">
          <div className="text-4xl mb-2">🎉</div>
          <div className="font-display text-lg text-emerald-200">这一轮所有词都出过了</div>
          <button
            type="button"
            className="btn-primary mt-4"
            onClick={() => {
              setRecent([]);
              setReinforceQueue([]);
              pickNew(progress, [], []);
            }}
          >
            再来一轮
          </button>
        </div>
      ) : (
        <QuestionPanel
          word={current}
          options={options}
          mode={mode}
          feedback={feedback}
          stat={progress[normWord(current.w)]}
          onPick={(opt) => {
            const isCorrect =
              mode === "word2cn"
                ? opt === current.c
                : normWord(opt) === normWord(current.w);
            void recordResult(isCorrect, opt);
          }}
          onSpeak={() => speakEnglish(current.w)}
          onContinueWrong={() => advance(progress)}
        />
      )}

      {history.length > 0 && (
        <details className="rounded-xl border border-ink-700/50 bg-ink-900/40 p-3">
          <summary className="text-xs text-slate-400 cursor-pointer">
            本次 {history.length} 词 · 对 {history.filter((h) => h.isCorrect).length}
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {history.slice().reverse().slice(0, 12).map((h, idx) => (
              <li key={`${h.word}-${idx}`} className="flex justify-between border-b border-ink-700/40 pb-1">
                <span className="text-slate-300">
                  <span className="text-cyan-200 font-display text-sm mr-2">{h.word}</span>
                  <span className="text-slate-400">{h.cn}</span>
                  <span className="ml-2"><TierChip level={h.newLevel} /></span>
                </span>
                <span className={h.isCorrect ? "text-emerald-300" : "text-rose-300"}>
                  {h.isCorrect ? "✓" : `✗`}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {floatingXp && floatingXp.amount > 0 && (
        <div
          key={floatingXp.key}
          className="absolute right-4 top-32 text-cyan-300 font-display font-bold text-2xl pointer-events-none animate-slide-up z-40"
        >
          +{floatingXp.amount} XP
        </div>
      )}

      {levelUpToast && (
        <div className="fixed top-1/3 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
          <div className="card-glow bg-violet-500/20 border-violet-400/50 text-violet-100 text-center animate-slide-up">
            <div className="text-3xl">⬆️</div>
            <div className="font-display text-lg">
              {levelUpToast.word} 升到{" "}
              <span className="text-violet-300 font-bold">
                {["新", "初识", "在学", "熟练", "掌握"][levelUpToast.to]}
              </span>
              ！
            </div>
          </div>
        </div>
      )}

      {dailyCelebration && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="card-glow bg-gradient-to-br from-cyan-500 to-blue-500 text-white text-center p-6 max-w-xs animate-slide-up shadow-2xl">
            <div className="text-5xl">🏆</div>
            <div className="font-display font-bold text-2xl mt-2">今日目标完成！</div>
            <div className="text-sm mt-1 opacity-90">
              连续打卡 {dailyCelebration.streak} 天 · 加油！
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-2 rounded-lg font-semibold transition-colors ${
        active
          ? "bg-violet-500/20 text-violet-100 border border-violet-400/40"
          : "bg-ink-900/40 text-slate-400 border border-ink-700/60 hover:bg-ink-700/40"
      }`}
    >
      {children}
    </button>
  );
}

function StatsBar({
  stats,
  combo,
  sessionXp,
  daily,
  sprintInfo,
}: {
  stats: OldStyleVocabStats;
  combo: number;
  sessionXp: number;
  daily: DailyState | null;
  sprintInfo: { secondsLeft: number; correct: number; wrong: number } | null;
}) {
  const dailyPct = daily ? Math.min(100, (daily.todayCount / daily.target) * 100) : 0;
  return (
    <div className="card-glow space-y-2">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] text-slate-400">已掌握</div>
          <div className="font-display font-bold text-lg text-emerald-300">
            {stats.mastered}
            <span className="text-xs text-slate-400 ml-1">/ {stats.totalWords}</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400">薄弱</div>
          <div className="font-display font-bold text-lg text-rose-300">{stats.weak}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400">未学习</div>
          <div className="font-display font-bold text-lg text-amber-300">{stats.unknown}</div>
        </div>
      </div>

      {sprintInfo ? (
        <div className="border-t border-ink-700/40 pt-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-cyan-200 font-display font-bold">⚡ 闪电冲刺</span>
            <span className="font-display font-bold text-amber-300 text-lg">
              {sprintInfo.secondsLeft}s
            </span>
          </div>
          <div className="text-[10px] text-slate-400">
            ✓ {sprintInfo.correct} · ✗ {sprintInfo.wrong}
          </div>
        </div>
      ) : daily ? (
        <div className="border-t border-ink-700/40 pt-2 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-300">
              今日目标{" "}
              <span className="font-display font-bold text-cyan-200">{daily.todayCount}</span>
              <span className="text-slate-400"> / {daily.target} 词次</span>
            </span>
            {daily.streak > 0 && (
              <span className="text-rose-300">🔥 连续 {daily.streak} 天</span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-ink-700/60 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-blue-400 transition-[width] duration-300" style={{ width: `${dailyPct}%` }} />
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between text-xs border-t border-ink-700/40 pt-2">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">本次 XP</span>
          <span className="font-display font-bold text-cyan-300">+{sessionXp}</span>
        </div>
        {combo >= 2 && (
          <div className="flex items-center gap-1.5">
            <span className="text-rose-300 animate-pulse">🔥</span>
            <span className="font-display font-bold text-rose-200">连击 × {combo}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionPanel({
  word,
  options,
  mode,
  feedback,
  stat,
  onPick,
  onSpeak,
  onContinueWrong,
}: {
  word: G4Word;
  options: G4Word[];
  mode: Mode;
  feedback: { isCorrect: boolean; pick: string } | null;
  stat: MasteryStat | undefined;
  onPick: (opt: string) => void;
  onSpeak: () => void;
  onContinueWrong: () => void;
}) {
  const level: Level = (stat?.level ?? 0) as Level;

  let questionContent: React.ReactNode;
  let pickFromOptions: { label: string; value: string }[];
  let correctValue: string;
  if (mode === "word2cn") {
    questionContent = (
      <span className="font-display text-3xl text-cyan-100 inline-flex items-center gap-3">
        {word.w}
        <button
          type="button"
          onClick={onSpeak}
          className="text-xl hover:scale-110 transition-transform"
          title="播放发音"
        >
          🔊
        </button>
      </span>
    );
    pickFromOptions = options.map((o) => ({ label: o.c, value: o.c }));
    correctValue = word.c;
  } else if (mode === "cn2word") {
    questionContent = (
      <span className="font-display text-2xl text-amber-100">{word.c}</span>
    );
    pickFromOptions = options.map((o) => ({ label: o.w, value: o.w }));
    correctValue = word.w;
  } else {
    questionContent = (
      <button
        type="button"
        onClick={onSpeak}
        className="font-display text-2xl text-cyan-100 hover:text-cyan-200 transition-colors flex items-center gap-3"
      >
        🔊 <span className="text-base">点击重新听</span>
      </button>
    );
    pickFromOptions = options.map((o) => ({ label: o.w, value: o.w }));
    correctValue = word.w;
  }

  return (
    <div className="card-glow space-y-3">
      <div className="flex justify-between items-center text-xs">
        <div className="flex items-center gap-2">
          <TierChip level={level} />
          <span className="text-slate-500 text-[10px]">{word.semester}</span>
        </div>
        {stat && (stat.right > 0 || stat.wrong > 0) && (
          <span className="text-slate-500 tabular-nums">
            对 {stat.right} · 错 {stat.wrong}
            {stat.consecutiveRight > 1 && (
              <span className="ml-2 text-emerald-300">连对 {stat.consecutiveRight}</span>
            )}
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/5 p-4 text-center">
        {questionContent}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {pickFromOptions.map((o, idx) => {
          const showRight = !!feedback && o.value === correctValue;
          const showWrong = !!feedback && !feedback.isCorrect && o.value === feedback.pick;
          return (
            <button
              key={`${o.value}-${idx}`}
              type="button"
              onClick={() => onPick(o.value)}
              disabled={!!feedback}
              className={`p-3 rounded-2xl border-2 text-left transition-colors ${
                showRight
                  ? "bg-emerald-500/30 border-emerald-400 text-emerald-100"
                  : showWrong
                    ? "bg-rose-500/30 border-rose-400 text-rose-100"
                    : "bg-ink-900/60 border-ink-600 hover:bg-ink-700/60 hover:border-violet-400 text-slate-100"
              }`}
            >
              <span className="text-xs text-slate-400 mr-1.5">
                {String.fromCharCode(65 + idx)}.
              </span>
              <span className={mode === "word2cn" ? "text-base" : "font-display text-base"}>
                {o.label}
              </span>
            </button>
          );
        })}
      </div>

      {feedback && !feedback.isCorrect && (
        <>
          <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            <div className="font-semibold mb-1">再来一次 — 正确答案：</div>
            <div className="text-center font-display text-2xl text-amber-200 my-1">{correctValue}</div>
            <div className="text-xs text-rose-200/80">
              {mode === "word2cn" ? `${word.w} = ${word.c}` : `${word.c} = ${word.w}`}
            </div>
          </div>
          <button type="button" onClick={onContinueWrong} className="btn-primary w-full">下一词 →</button>
        </>
      )}
      {feedback && feedback.isCorrect && (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 text-center">
          ✓ 太棒了！
        </div>
      )}
    </div>
  );
}

function SprintPanel({
  state,
  word,
  options,
  feedback,
  stat,
  onStart,
  onPick,
  onRestart,
}: {
  state:
    | { stage: "idle" }
    | { stage: "running"; secondsLeft: number; correct: number; wrong: number }
    | { stage: "done"; correct: number; wrong: number };
  word: G4Word | null;
  options: G4Word[];
  feedback: { isCorrect: boolean; pick: string } | null;
  stat: MasteryStat | undefined;
  onStart: () => void;
  onPick: (opt: string) => void;
  onRestart: () => void;
}) {
  if (state.stage === "idle") {
    return (
      <div className="card-glow text-center py-6 space-y-3">
        <div className="text-5xl">⚡</div>
        <div className="font-display font-bold text-xl text-cyan-200">闪电冲刺</div>
        <div className="text-sm text-slate-300">
          60 秒尽量多答对题 · 看英文选中文
          <br />
          每对 +5 XP，连击 × 还有连击奖励
        </div>
        <button type="button" onClick={onStart} className="btn-primary inline-flex">
          ▶ 开始
        </button>
      </div>
    );
  }
  if (state.stage === "done") {
    const total = state.correct + state.wrong;
    const acc = total === 0 ? 0 : Math.round((state.correct / total) * 100);
    return (
      <div className="card-glow text-center py-6 space-y-3">
        <div className="text-5xl">🏁</div>
        <div className="font-display font-bold text-xl text-cyan-200">冲刺结束</div>
        <div className="grid grid-cols-3 gap-2 text-center max-w-sm mx-auto">
          <div>
            <div className="text-[10px] text-slate-400">答对</div>
            <div className="font-display font-bold text-2xl text-emerald-300">{state.correct}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">答错</div>
            <div className="font-display font-bold text-2xl text-rose-300">{state.wrong}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-400">正确率</div>
            <div className="font-display font-bold text-2xl text-amber-300">{acc}%</div>
          </div>
        </div>
        <button type="button" onClick={onRestart} className="btn-primary inline-flex">
          🔄 再来一轮
        </button>
      </div>
    );
  }
  // running
  if (!word) return <div className="card text-slate-400">加载中…</div>;
  const level: Level = (stat?.level ?? 0) as Level;
  return (
    <div className="card-glow space-y-3">
      <div className="flex justify-between items-center text-xs">
        <TierChip level={level} />
        <div className="font-display font-bold text-amber-300 text-base tabular-nums">
          ⏱ {state.secondsLeft}s
        </div>
      </div>
      <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/5 p-4 text-center">
        <span className="font-display text-2xl text-cyan-100">{word.w}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o, idx) => {
          const showRight = !!feedback && o.c === word.c;
          const showWrong = !!feedback && !feedback.isCorrect && o.c === feedback.pick;
          return (
            <button
              key={`${o.c}-${idx}`}
              type="button"
              onClick={() => onPick(o.c)}
              disabled={!!feedback}
              className={`p-3 rounded-2xl border-2 text-left transition-colors ${
                showRight
                  ? "bg-emerald-500/30 border-emerald-400 text-emerald-100"
                  : showWrong
                    ? "bg-rose-500/30 border-rose-400 text-rose-100"
                    : "bg-ink-900/60 border-ink-600 hover:bg-ink-700/60 hover:border-violet-400 text-slate-100"
              }`}
            >
              <span className="text-xs text-slate-400 mr-1.5">
                {String.fromCharCode(65 + idx)}.
              </span>
              <span className="text-base">{o.c}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
