/**
 * 语文写字表 500 字 · 练习页（v0.31.41 — mastery tier + 间隔重现）
 *
 * 比 v0.31.40 升级：
 *   - 5 tier 分级（新/初识/在学/熟练/掌握）+ tier 分布条
 *   - SM-2 间隔重现（答对的字按 1m→1h→1d→3d→14d 周期）
 *   - 答错强化（错完那字下 2 题内必现）
 *   - 今日目标 + 连续打卡 streak
 *   - 老口径统计仍保留（总练习/正确率/错字总数）
 *   - 写字模式 + 辨字选择模式
 */

import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "../../db/dexie";
import {
  G4A_CHARS,
  G4B_CHARS,
  type G4Char,
} from "../../subjects/chinese/charLibrary";
import {
  calcOldStyleStats,
  calcTierDistribution,
  generateChooseQuestion,
  loadCharProgress,
  migrateHistoricalCharProgress,
  pickNextChar,
  recordCharAttempt,
  type CharProgress,
  type OldStyleStats,
} from "../../lib/chineseCharProgress";
import {
  freshStat,
  type Level,
  type MasteryStat,
} from "../../lib/masteryTier";
import {
  loadDaily,
  tickDaily,
  type DailyState,
} from "../../lib/dailyTarget";
import { MasteryTierBar, TierChip } from "../../components/MasteryTierBar";

type Book = "G4A" | "G4B";
type Mode = "write" | "choose";
const RECENT_WINDOW = 5;
const REINFORCE_WINDOW = 2; // 错完后下 2 题内强化

interface RoundResult {
  word: string;
  pinyin: string;
  isCorrect: boolean;
  userInput: string;
  mode: Mode;
  newLevel: Level;
}

export function CharPracticePage() {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [progress, setProgress] = useState<CharProgress>({});
  const [daily, setDaily] = useState<DailyState | null>(null);
  const [book, setBook] = useState<Book>("G4B");
  const [mode, setMode] = useState<Mode>("write");
  const [current, setCurrent] = useState<G4Char | null>(null);
  const [chooseQ, setChooseQ] = useState<ReturnType<typeof generateChooseQuestion> | null>(null);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; userInput: string } | null>(null);
  const [recentWords, setRecentWords] = useState<string[]>([]);
  const [reinforceQueue, setReinforceQueue] = useState<{ word: string; remaining: number }[]>([]);
  const [history, setHistory] = useState<RoundResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [migratedToast, setMigratedToast] = useState<string | null>(null);
  const [combo, setCombo] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [floatingXp, setFloatingXp] = useState<{ amount: number; key: number } | null>(null);
  const [dailyCelebration, setDailyCelebration] = useState<{ streak: number } | null>(null);
  const [levelUpToast, setLevelUpToast] = useState<{ word: string; from: Level; to: Level } | null>(null);

  const pool: G4Char[] = book === "G4A" ? G4A_CHARS : G4B_CHARS;
  const fullPool: G4Char[] = useMemo(() => [...G4A_CHARS, ...G4B_CHARS], []);

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
      const migr = await migrateHistoricalCharProgress(s.id);
      if (migr.imported > 0 || migr.upgraded > 0) {
        setMigratedToast(
          `已迁移 ${migr.imported} 字 + 升级 ${migr.upgraded} 字到 5-tier 等级`,
        );
        setTimeout(() => setMigratedToast(null), 5000);
      }
      const p = await loadCharProgress(s.id);
      const d = await loadDaily("chinese_chars", s.id, 20);
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
    pickNew(progress);
    setRecentWords([]);
    setReinforceQueue([]);
    setFeedback(null);
    setInput("");
    setCombo(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, mode, loading]);

  function pickNew(curProgress: CharProgress, recent: string[] = [], reinforceWords: string[] = []) {
    const next = pickNextChar(pool, curProgress, recent, reinforceWords);
    setCurrent(next);
    if (next && mode === "choose") {
      setChooseQ(generateChooseQuestion(next, pool));
    } else {
      setChooseQ(null);
    }
  }

  function flashXp(amount: number) {
    setFloatingXp({ amount, key: Date.now() });
    setTimeout(() => setFloatingXp(null), 900);
  }

  async function recordResult(isCorrect: boolean, userInput: string) {
    if (!current) return;
    setFeedback({ isCorrect, userInput });
    const oldStat = progress[current.word] ?? freshStat();
    let nextStat: MasteryStat;
    if (studentId) {
      nextStat = await recordCharAttempt(studentId, current.word, isCorrect);
    } else {
      // 没 student：本地内存
      const tmp = { ...oldStat };
      tmp.right += isCorrect ? 1 : 0;
      tmp.wrong += isCorrect ? 0 : 1;
      tmp.lastSeenAt = Date.now();
      tmp.consecutiveRight = isCorrect ? tmp.consecutiveRight + 1 : 0;
      nextStat = tmp;
    }
    const nextProgress: CharProgress = { ...progress, [current.word]: nextStat };
    setProgress(nextProgress);

    setHistory((h) => [
      ...h.slice(-19),
      { word: current.word, pinyin: current.pinyin, isCorrect, userInput, mode, newLevel: nextStat.level },
    ]);

    // 升级提示
    if (isCorrect && nextStat.level > oldStat.level) {
      setLevelUpToast({ word: current.word, from: oldStat.level, to: nextStat.level });
      setTimeout(() => setLevelUpToast(null), 2000);
    }

    // XP / 连击
    if (isCorrect) {
      const base = 8;
      const comboBonus = Math.min(combo, 9) * 2;
      // tier bonus：升级到更高等级 +5
      const tierBonus = nextStat.level > oldStat.level ? 5 : 0;
      const earned = base + comboBonus + tierBonus;
      setSessionXp((x) => x + earned);
      setCombo((c) => c + 1);
      flashXp(earned);
      // 强化队列：移出该字
      setReinforceQueue((q) => q.filter((r) => r.word !== current.word).map((r) => ({ ...r, remaining: r.remaining - 1 })).filter((r) => r.remaining > 0));
    } else {
      setCombo(0);
      flashXp(0);
      // 进强化队列：下 N 题内必现
      setReinforceQueue((q) => {
        const without = q.filter((r) => r.word !== current.word);
        return [...without.map((r) => ({ ...r, remaining: r.remaining - 1 })).filter((r) => r.remaining > 0), { word: current.word, remaining: REINFORCE_WINDOW }];
      });
    }

    // 今日目标
    if (studentId && daily) {
      const { next: dNext, justCompleted } = await tickDaily("chinese_chars", studentId, daily);
      setDaily(dNext);
      if (justCompleted) {
        setDailyCelebration({ streak: dNext.streak });
        setTimeout(() => setDailyCelebration(null), 4500);
      }
    }

    if (isCorrect) {
      setTimeout(() => advance(nextProgress), 1100);
    }
  }

  function advance(curProgress: CharProgress) {
    if (!current) return;
    const nextRecent = [current.word, ...recentWords].slice(0, RECENT_WINDOW);
    setRecentWords(nextRecent);
    const reinforceWords = reinforceQueue.map((r) => r.word);
    pickNew(curProgress, nextRecent, reinforceWords);
    setInput("");
    setFeedback(null);
  }

  function onSubmitWrite(e?: React.FormEvent) {
    e?.preventDefault();
    if (!current || feedback) return;
    const trimmed = input.trim();
    if (!trimmed) return;
    void recordResult(trimmed === current.word, trimmed);
  }

  function onPickChoose(opt: string) {
    if (!current || !chooseQ || feedback) return;
    void recordResult(opt === chooseQ.answer, opt);
  }

  const oldStats = useMemo(() => calcOldStyleStats(progress), [progress]);
  const tierDist = useMemo(() => calcTierDistribution(pool, progress), [pool, progress]);
  const fullTierDist = useMemo(() => calcTierDistribution(fullPool, progress), [fullPool, progress]);

  if (loading) return <div className="card text-center text-slate-300">加载中…</div>;

  return (
    <div className="space-y-3 relative">
      <header className="flex items-center justify-between gap-2">
        <div>
          <div className="font-display font-bold text-2xl text-amber-200">
            写字表 500 字
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            人教版 G4 上下册 · 5-tier 等级 · 间隔重现 · 错过的字会强化
          </div>
        </div>
        <Link
          to="/chinese"
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

      {/* 上/下册切换 */}
      <div className="flex gap-2">
        <BookTab active={book === "G4A"} onClick={() => setBook("G4A")} count={G4A_CHARS.length}>
          四年级上册
        </BookTab>
        <BookTab active={book === "G4B"} onClick={() => setBook("G4B")} count={G4B_CHARS.length}>
          四年级下册
        </BookTab>
      </div>

      {/* 模式切换 */}
      <div className="flex gap-2">
        <ModeTab active={mode === "write"} onClick={() => setMode("write")}>
          ✍️ 写字练习
        </ModeTab>
        <ModeTab active={mode === "choose"} onClick={() => setMode("choose")}>
          🎯 辨字选择
        </ModeTab>
      </div>

      {/* 5-tier 分布条 */}
      <div className="card-glow space-y-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-slate-300 font-semibold">
            本册掌握分布（{book === "G4A" ? "上册 250" : "下册 250"}）
          </span>
          {fullTierDist.byLevel[4] > 0 && (
            <span className="text-violet-300 text-[11px]">
              全 500 已掌握 {fullTierDist.byLevel[4]}
            </span>
          )}
        </div>
        <MasteryTierBar dist={tierDist} />
      </div>

      {/* 老口径统计 + 今日目标 + 连击 */}
      <StatsBar stats={oldStats} combo={combo} sessionXp={sessionXp} daily={daily} />

      {/* 模式 panel */}
      {!current ? (
        <div className="card text-center text-slate-300 py-8">
          <div className="text-4xl mb-2">🎉</div>
          <div className="font-display text-lg text-emerald-200">
            这一轮所有字都出过了
          </div>
          <button
            type="button"
            className="btn-primary mt-4"
            onClick={() => {
              setRecentWords([]);
              setReinforceQueue([]);
              pickNew(progress, [], []);
            }}
          >
            再来一轮
          </button>
        </div>
      ) : mode === "write" ? (
        <WritePanel
          char={current}
          input={input}
          onInput={setInput}
          feedback={feedback}
          onSubmit={onSubmitWrite}
          onContinueWrong={() => advance(progress)}
          stat={progress[current.word]}
        />
      ) : (
        <ChoosePanel
          char={current}
          chooseQ={chooseQ}
          feedback={feedback}
          onPick={onPickChoose}
          onContinueWrong={() => advance(progress)}
          stat={progress[current.word]}
        />
      )}

      {/* 错字本（只显示 wrong > right 的字） */}
      <WrongBookPanel
        wrongChars={oldStats.wrongChars}
        onPickChar={(w) => {
          const target = pool.find((c) => c.word === w) ?? fullPool.find((c) => c.word === w);
          if (target) {
            setCurrent(target);
            if (mode === "choose") {
              setChooseQ(generateChooseQuestion(target, pool));
            }
            setInput("");
            setFeedback(null);
          }
        }}
      />

      {history.length > 0 && (
        <details className="rounded-xl border border-ink-700/50 bg-ink-900/40 p-3">
          <summary className="text-xs text-slate-400 cursor-pointer">
            本次练 {history.length} · 对 {history.filter((h) => h.isCorrect).length}
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {history.slice().reverse().slice(0, 12).map((h, idx) => (
              <li key={`${h.word}-${idx}`} className="flex justify-between border-b border-ink-700/40 pb-1">
                <span className="text-slate-300">
                  <span className="text-amber-200 font-display text-base mr-2">{h.word}</span>
                  <span className="text-slate-400">{h.pinyin}</span>
                  <span className="ml-2"><TierChip level={h.newLevel} /></span>
                </span>
                <span className={h.isCorrect ? "text-emerald-300" : "text-rose-300"}>
                  {h.isCorrect ? "✓" : `✗ ${h.userInput || "(空)"}`}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {/* 飞行 XP 数字 */}
      {floatingXp && floatingXp.amount > 0 && (
        <div
          key={floatingXp.key}
          className="absolute right-4 top-32 text-amber-300 font-display font-bold text-2xl pointer-events-none animate-slide-up z-40"
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
          <div className="card-glow bg-gradient-to-br from-amber-500 to-orange-500 text-white text-center p-6 max-w-xs animate-slide-up shadow-2xl">
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

function BookTab({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
        active
          ? "bg-amber-500/20 text-amber-100 border border-amber-400/40"
          : "bg-ink-900/40 text-slate-400 border border-ink-700/60 hover:bg-ink-700/40"
      }`}
    >
      {children}
      <span className="ml-2 text-[10px] opacity-70">{count} 字</span>
    </button>
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
      className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
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
}: {
  stats: OldStyleStats;
  combo: number;
  sessionXp: number;
  daily: DailyState | null;
}) {
  const pct = Math.round(stats.correctRate * 100);
  const dailyPct = daily ? Math.min(100, (daily.todayCount / daily.target) * 100) : 0;
  return (
    <div className="card-glow space-y-2">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] text-slate-400">总练习</div>
          <div className="font-display font-bold text-lg text-amber-200">
            {stats.totalAttempts}
            <span className="text-xs text-slate-400 ml-1">字次</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400">正确率</div>
          <div
            className={`font-display font-bold text-lg ${
              pct >= 90 ? "text-emerald-300" : pct >= 70 ? "text-amber-300" : "text-rose-300"
            }`}
          >
            {stats.totalAttempts === 0 ? "—" : `${pct}%`}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400">错字</div>
          <div className="font-display font-bold text-lg text-rose-300">
            {stats.wrongChars.length}
            <span className="text-xs text-slate-400 ml-1">个</span>
          </div>
        </div>
      </div>

      {/* 今日目标 */}
      {daily && (
        <div className="border-t border-ink-700/40 pt-2 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-300">
              今日目标{" "}
              <span className="font-display font-bold text-amber-200">
                {daily.todayCount}
              </span>
              <span className="text-slate-400"> / {daily.target} 字次</span>
            </span>
            {daily.streak > 0 && (
              <span className="text-rose-300">
                🔥 连续 {daily.streak} 天
              </span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-ink-700/60 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-400 transition-[width] duration-300"
              style={{ width: `${dailyPct}%` }}
            />
          </div>
        </div>
      )}

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

function WritePanel({
  char,
  input,
  onInput,
  feedback,
  onSubmit,
  onContinueWrong,
  stat,
}: {
  char: G4Char;
  input: string;
  onInput: (v: string) => void;
  feedback: { isCorrect: boolean; userInput: string } | null;
  onSubmit: (e?: React.FormEvent) => void;
  onContinueWrong: () => void;
  stat: MasteryStat | undefined;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, [char.word]);

  const level: Level = (stat?.level ?? 0) as Level;

  return (
    <form onSubmit={onSubmit} className="card-glow space-y-3" autoComplete="off">
      <div className="flex justify-between items-center text-xs">
        <TierChip level={level} />
        {stat && (stat.right > 0 || stat.wrong > 0) && (
          <span className="text-slate-500 tabular-nums">
            对 {stat.right} · 错 {stat.wrong}
            {stat.consecutiveRight > 1 && (
              <span className="ml-2 text-emerald-300">连对 {stat.consecutiveRight}</span>
            )}
          </span>
        )}
      </div>

      <div className="text-center">
        <div className="text-xs text-slate-400 uppercase tracking-widest">拼音</div>
        <div className="font-display text-3xl text-cyan-200 mt-1">{char.pinyin}</div>
      </div>

      <div className="rounded-2xl border border-amber-400/30 bg-amber-500/5 p-4 text-center">
        <div className="text-xs text-slate-400 mb-1">词组提示</div>
        <div className="font-display text-2xl text-amber-100 tracking-wide">
          {char.group}
        </div>
        <div className="text-xs text-slate-400 mt-3">
          含义：<span className="text-slate-200">{char.meaning}</span>
        </div>
      </div>

      <div>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => onInput(e.target.value)}
          placeholder="在这里写出这个字"
          maxLength={6}
          disabled={!!feedback}
          className={`w-full text-center font-display text-3xl p-4 rounded-2xl border bg-ink-900/60 ${
            feedback?.isCorrect
              ? "border-emerald-400 text-emerald-200"
              : feedback
                ? "border-rose-400 text-rose-200"
                : "border-ink-600 text-amber-100 focus:border-violet-400 focus:outline-none"
          }`}
        />
      </div>

      {feedback && !feedback.isCorrect && (
        <WrongCard correct={char.word} userInput={feedback.userInput} />
      )}
      {feedback && feedback.isCorrect && <CorrectCard />}

      {!feedback ? (
        <button type="submit" disabled={!input.trim()} className="btn-primary w-full disabled:opacity-50">
          提交
        </button>
      ) : !feedback.isCorrect ? (
        <button type="button" onClick={onContinueWrong} className="btn-primary w-full">
          下一字 →
        </button>
      ) : null}
    </form>
  );
}

function ChoosePanel({
  char,
  chooseQ,
  feedback,
  onPick,
  onContinueWrong,
  stat,
}: {
  char: G4Char;
  chooseQ: ReturnType<typeof generateChooseQuestion> | null;
  feedback: { isCorrect: boolean; userInput: string } | null;
  onPick: (opt: string) => void;
  onContinueWrong: () => void;
  stat: MasteryStat | undefined;
}) {
  if (!chooseQ) return <div className="card text-slate-400">题加载中…</div>;
  const level: Level = (stat?.level ?? 0) as Level;
  return (
    <div className="card-glow space-y-3">
      <div className="flex justify-between items-center text-xs">
        <TierChip level={level} />
        {stat && (stat.right > 0 || stat.wrong > 0) && (
          <span className="text-slate-500 tabular-nums">
            对 {stat.right} · 错 {stat.wrong}
          </span>
        )}
      </div>
      <div className="text-center">
        <div className="text-xs text-slate-400 uppercase tracking-widest">拼音</div>
        <div className="font-display text-3xl text-cyan-200 mt-1">{char.pinyin}</div>
      </div>
      <div className="rounded-2xl border border-violet-400/30 bg-violet-500/5 p-3 text-center">
        <div className="text-sm text-slate-200">{chooseQ.question}</div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {chooseQ.options.map((opt, idx) => {
          const showRight = !!feedback && opt === chooseQ.answer;
          const showWrong = !!feedback && !feedback.isCorrect && opt === feedback.userInput;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onPick(opt)}
              disabled={!!feedback}
              className={`p-4 rounded-2xl border-2 font-display text-2xl transition-colors ${
                showRight
                  ? "bg-emerald-500/30 border-emerald-400 text-emerald-100"
                  : showWrong
                    ? "bg-rose-500/30 border-rose-400 text-rose-100"
                    : "bg-ink-900/60 border-ink-600 text-amber-100 hover:bg-ink-700/60 hover:border-violet-400"
              }`}
            >
              <span className="text-xs text-slate-400 mr-2">
                {String.fromCharCode(65 + idx)}.
              </span>
              {opt}
            </button>
          );
        })}
      </div>
      {feedback && !feedback.isCorrect && (
        <>
          <WrongCard correct={chooseQ.answer} userInput={feedback.userInput} />
          <button type="button" onClick={onContinueWrong} className="btn-primary w-full">
            下一字 →
          </button>
        </>
      )}
      {feedback && feedback.isCorrect && <CorrectCard />}
    </div>
  );
}

function CorrectCard() {
  return (
    <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 text-center">
      ✓ 太棒了！
    </div>
  );
}

function WrongCard({ correct, userInput }: { correct: string; userInput: string }) {
  return (
    <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
      <div className="font-semibold mb-1">再来一次 — 正确字是：</div>
      <div className="text-center font-display text-3xl text-amber-200 my-1">{correct}</div>
      <div className="text-xs text-rose-200/80">
        你写的：<span className="line-through">{userInput || "(空)"}</span>
      </div>
    </div>
  );
}

function WrongBookPanel({
  wrongChars,
  onPickChar,
}: {
  wrongChars: Array<{ word: string; right: number; wrong: number }>;
  onPickChar: (w: string) => void;
}) {
  if (wrongChars.length === 0) return null;
  return (
    <div className="card border-rose-400/30">
      <div className="font-display font-bold text-rose-200 text-sm mb-2 flex items-center gap-2">
        <span>📕 错字本</span>
        <span className="text-[10px] text-slate-400 font-normal">
          错 &gt; 对 共 {wrongChars.length} 字 · 点击单独练
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {wrongChars.map((w) => (
          <button
            key={w.word}
            type="button"
            onClick={() => onPickChar(w.word)}
            className="px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-400/30 text-rose-100 hover:bg-rose-500/30 transition-colors"
            title={`对 ${w.right} · 错 ${w.wrong}`}
          >
            <span className="font-display text-base">{w.word}</span>
            <span className="text-[10px] text-rose-200/70 ml-1">{w.wrong}-{w.right}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
