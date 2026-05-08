/**
 * 英语 G4 单词记忆 · 练习页 (v0.31.41 — mastery tier + 间隔重现)
 *
 * 比 v0.31.40 升级：
 *   - 5 tier 等级 + tier 分布条
 *   - SM-2 间隔重现 + 答错强化
 *   - 今日目标 + streak
 *   - 老口径"已掌握/薄弱/未学习"仍保留兼容
 *
 * 3 模式（沿用）：
 *   1. 看单词 → 选中文 (English + 🔊 → 4 个中文)
 *   2. 看中文 → 选单词 (中文 → 4 个英文)
 *   3. 🔊 听读音 → 选单词 (TTS → 4 个英文)
 */

import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
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

type Book = "G4A" | "G4B";
type Mode = "word2cn" | "cn2word" | "listen";
const RECENT_WINDOW = 5;
const REINFORCE_WINDOW = 2;

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
  const [book, setBook] = useState<Book>("G4A");
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

  const pool: G4Word[] = useMemo(
    () => G4_WORDS.filter((w) => w.semester === book),
    [book],
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
      const d = await loadDaily("english_vocab", s.id, 20);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, mode, loading]);

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
      const base = 8;
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

    if (studentId && daily) {
      const { next: dNext, justCompleted } = await tickDaily("english_vocab", studentId, daily);
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
            英语单词
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            外研版 G4 上下册 · 5-tier 等级 · 间隔重现 · 错过的会强化
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

      <div className="flex gap-2">
        <BookTab active={book === "G4A"} onClick={() => setBook("G4A")} count={G4_WORDS.filter((w) => w.semester === "G4A").length}>
          四年级上册
        </BookTab>
        <BookTab active={book === "G4B"} onClick={() => setBook("G4B")} count={G4_WORDS.filter((w) => w.semester === "G4B").length}>
          四年级下册
        </BookTab>
      </div>

      <div className="flex gap-2 text-xs">
        <ModeTab active={mode === "word2cn"} onClick={() => setMode("word2cn")}>
          看单词 → 选中文
        </ModeTab>
        <ModeTab active={mode === "cn2word"} onClick={() => setMode("cn2word")}>
          看中文 → 选单词
        </ModeTab>
        <ModeTab active={mode === "listen"} onClick={() => setMode("listen")}>
          🔊 听读音 → 选单词
        </ModeTab>
      </div>

      {/* 5-tier 分布条 */}
      <div className="card-glow space-y-3">
        <div className="text-xs text-slate-300 font-semibold">
          本册掌握分布（{book === "G4A" ? "上册" : "下册"} {tierDist.total} 词）
        </div>
        <MasteryTierBar dist={tierDist} />
      </div>

      <StatsBar stats={oldStats} combo={combo} sessionXp={sessionXp} daily={daily} />

      {!current ? (
        <div className="card text-center text-slate-300 py-8">
          <div className="text-4xl mb-2">🎉</div>
          <div className="font-display text-lg text-emerald-200">
            这一轮所有词都出过了
          </div>
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
                  {h.isCorrect ? "✓" : `✗ ${h.userPick}`}
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
          ? "bg-cyan-500/20 text-cyan-100 border border-cyan-400/40"
          : "bg-ink-900/40 text-slate-400 border border-ink-700/60 hover:bg-ink-700/40"
      }`}
    >
      {children}
      <span className="ml-2 text-[10px] opacity-70">{count} 词</span>
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
      className={`flex-1 px-2 py-2 rounded-lg font-semibold transition-colors ${
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
  stats: OldStyleVocabStats;
  combo: number;
  sessionXp: number;
  daily: DailyState | null;
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

      {daily && (
        <div className="border-t border-ink-700/40 pt-2 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-300">
              今日目标{" "}
              <span className="font-display font-bold text-cyan-200">
                {daily.todayCount}
              </span>
              <span className="text-slate-400"> / {daily.target} 词次</span>
            </span>
            {daily.streak > 0 && (
              <span className="text-rose-300">
                🔥 连续 {daily.streak} 天
              </span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-ink-700/60 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400 to-blue-400 transition-[width] duration-300"
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
            <div className="text-center font-display text-2xl text-amber-200 my-1">
              {correctValue}
            </div>
            <div className="text-xs text-rose-200/80">
              {mode === "word2cn"
                ? `${word.w} = ${word.c}`
                : `${word.c} = ${word.w}`}
            </div>
          </div>
          <button type="button" onClick={onContinueWrong} className="btn-primary w-full">
            下一词 →
          </button>
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
