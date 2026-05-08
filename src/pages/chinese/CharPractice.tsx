/**
 * 字词大冒险 — 语文写字 / 辨字主战场（v0.31.42）
 *
 * 路由：/chinese/char-quest（保留 /chinese/char-practice 别名兼容）
 *
 * 三大改进（v0.31.42）：
 *   1. 写字模式真用 Canvas + qwen-vl 视觉判定（修 v0.31.41 IME 拼音输入直接出字的 bug）
 *   2. 上下册切换 = student.currentTerm（赛季制；与数学一致）
 *   3. 游戏化命名：字词大冒险（不再叫"写字练习"）
 *
 * 三种模式：
 *   ✍️ 手写挑战：canvas 画 → LLM 视觉判
 *   🎯 辨字选择：4 选项中挑正确字
 *   👀 看拼音猜字：input 框（输入法不灵的字 / 没法画 canvas 的电脑端 fallback）
 */

import { Link } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/dexie";
import {
  G4A_CHARS,
  G4B_CHARS,
  G4_CHARS_ALL,
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
import { judgeHandwriting } from "../../lib/handwritingJudge";
import { MasteryTierBar, TierChip } from "../../components/MasteryTierBar";
import { HandwriteCanvas } from "../../components/HandwriteCanvas";
import { termToSemester } from "../../components/TermSwitcher";
import type { Term } from "../../core/types";

type Mode = "write" | "choose" | "type";
const RECENT_WINDOW = 5;
const REINFORCE_WINDOW = 2;

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
  // v0.31.43: 用 useLiveQuery 让 student.currentTerm 实时跟随首页切换更新
  const liveStudent = useLiveQuery(async () => (await db.students.toArray())[0]);
  const currentTerm: Term = (liveStudent?.currentTerm as Term | undefined) ?? "下册";
  const [mode, setMode] = useState<Mode>("write");
  const [current, setCurrent] = useState<G4Char | null>(null);
  const [chooseQ, setChooseQ] = useState<ReturnType<typeof generateChooseQuestion> | null>(null);
  const [typeInput, setTypeInput] = useState("");
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    userInput: string;
    comment?: string;
    confidence?: "high" | "medium" | "low";
    observed?: string;
  } | null>(null);
  const [judgingCanvas, setJudgingCanvas] = useState(false);
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
  // 用于强制重置 canvas（提交后下一字时清空）
  const [canvasResetKey, setCanvasResetKey] = useState(0);
  // v0.31.46: 词组提示作为付费 hint（-3 XP），与数学的 hint 机制一致
  const [hintOpened, setHintOpened] = useState(false);

  const semester = termToSemester(currentTerm);
  // v0.31.43: 综合复习 (semester === null) → 上下册混合池
  const pool: G4Char[] = useMemo(
    () =>
      semester === "G4A"
        ? G4A_CHARS
        : semester === "G4B"
          ? G4B_CHARS
          : G4_CHARS_ALL,
    [semester],
  );
  const fullPool: G4Char[] = G4_CHARS_ALL;

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
    setTypeInput("");
    setCombo(0);
    setCanvasResetKey((k) => k + 1);
    setHintOpened(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTerm, mode, loading]);

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

  async function recordResult(
    isCorrect: boolean,
    userInput: string,
    extras?: { comment?: string; confidence?: "high"|"medium"|"low"; observed?: string },
  ) {
    if (!current) return;
    setFeedback({ isCorrect, userInput, ...extras });
    const oldStat = progress[current.word] ?? freshStat();
    let nextStat: MasteryStat;
    if (studentId) {
      nextStat = await recordCharAttempt(studentId, current.word, isCorrect);
    } else {
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

    if (isCorrect && nextStat.level > oldStat.level) {
      setLevelUpToast({ word: current.word, from: oldStat.level, to: nextStat.level });
      setTimeout(() => setLevelUpToast(null), 2000);
    }

    if (isCorrect) {
      const base = mode === "write" ? 12 : 8; // 手写难度高，加分多
      const comboBonus = Math.min(combo, 9) * 2;
      const tierBonus = nextStat.level > oldStat.level ? 5 : 0;
      // v0.31.46: 用了词组提示 → -3 XP（数学风格）
      const hintPenalty = hintOpened ? 3 : 0;
      const earned = Math.max(0, base + comboBonus + tierBonus - hintPenalty);
      setSessionXp((x) => x + earned);
      setCombo((c) => c + 1);
      flashXp(earned);
      setReinforceQueue((q) =>
        q
          .filter((r) => r.word !== current.word)
          .map((r) => ({ ...r, remaining: r.remaining - 1 }))
          .filter((r) => r.remaining > 0),
      );
    } else {
      setCombo(0);
      flashXp(0);
      setReinforceQueue((q) => {
        const without = q.filter((r) => r.word !== current.word);
        return [
          ...without.map((r) => ({ ...r, remaining: r.remaining - 1 })).filter((r) => r.remaining > 0),
          { word: current.word, remaining: REINFORCE_WINDOW },
        ];
      });
    }

    if (studentId && daily) {
      const { next: dNext, justCompleted } = await tickDaily("chinese_chars", studentId, daily);
      setDaily(dNext);
      if (justCompleted) {
        setDailyCelebration({ streak: dNext.streak });
        setTimeout(() => setDailyCelebration(null), 4500);
      }
    }

    if (isCorrect) {
      setTimeout(() => advance(nextProgress), 1300);
    }
  }

  function advance(curProgress: CharProgress) {
    if (!current) return;
    const nextRecent = [current.word, ...recentWords].slice(0, RECENT_WINDOW);
    setRecentWords(nextRecent);
    const reinforceWords = reinforceQueue.map((r) => r.word);
    pickNew(curProgress, nextRecent, reinforceWords);
    setTypeInput("");
    setFeedback(null);
    setCanvasResetKey((k) => k + 1);
    setHintOpened(false); // v0.31.46: 下一字重新隐藏提示
  }

  // 手写提交 → 调 LLM 视觉判
  async function onSubmitCanvas(base64: string) {
    if (!current || feedback) return;
    setJudgingCanvas(true);
    try {
      const result = await judgeHandwriting({
        targetChar: current.word,
        pinyin: current.pinyin,
        imageBase64: base64,
      });
      void recordResult(result.isCorrect, "(手写)", {
        comment: result.comment,
        confidence: result.confidence,
        observed: result.observed,
      });
    } catch (e) {
      // LLM 失败 → 不计错，弹 toast 让用户重试
      setFeedback({
        isCorrect: false,
        userInput: "(网络错误)",
        comment: `视觉识别失败：${(e as Error).message.slice(0, 60)}。可以再试一次或换"辨字"模式。`,
      });
    } finally {
      setJudgingCanvas(false);
    }
  }

  function onSubmitType(e?: React.FormEvent) {
    e?.preventDefault();
    if (!current || feedback) return;
    const trimmed = typeInput.trim();
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
            🗡️ 字词大冒险
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            手写挑战 + 视觉 AI 判定
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

      {/* v0.31.43: 学期切换移到首页（与数学 UX 一致），这里只显示当前赛季 chip */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="chip text-[11px] px-2.5 py-1 bg-violet-500/15 border border-violet-400/30 text-violet-100">
          {currentTerm === "综合复习" ? "🎯 综合复习" : currentTerm === "上册" ? "📕 四年级上册" : "📚 四年级下册"}
        </span>
        <Link
          to="/chinese"
          className="chip text-[11px] px-2.5 py-1 bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
        >
          切换赛季 →
        </Link>
      </div>

      {/* 模式切换 */}
      <div className="flex gap-2">
        <ModeTab active={mode === "write"} onClick={() => setMode("write")}>
          ✍️ 手写挑战
        </ModeTab>
        <ModeTab active={mode === "choose"} onClick={() => setMode("choose")}>
          🎯 辨字选择
        </ModeTab>
        <ModeTab active={mode === "type"} onClick={() => setMode("type")}>
          ⌨️ 打字回忆
        </ModeTab>
      </div>

      {/* 5-tier 分布 */}
      <div className="card-glow space-y-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-slate-300 font-semibold">
            本赛季掌握分布（{semester === "G4A" ? "上册 250" : semester === "G4B" ? "下册 250" : "综合 500"}）
          </span>
          {fullTierDist.byLevel[4] > 0 && (
            <span className="text-violet-300 text-[11px]">
              全 500 已掌握 {fullTierDist.byLevel[4]}
            </span>
          )}
        </div>
        <MasteryTierBar dist={tierDist} />
      </div>

      <StatsBar stats={oldStats} combo={combo} sessionXp={sessionXp} daily={daily} />

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
          stat={progress[current.word]}
          feedback={feedback}
          judging={judgingCanvas}
          canvasResetKey={canvasResetKey}
          onSubmit={onSubmitCanvas}
          onContinueWrong={() => advance(progress)}
          hintOpened={hintOpened}
          onOpenHint={() => setHintOpened(true)}
        />
      ) : mode === "choose" ? (
        <ChoosePanel
          char={current}
          chooseQ={chooseQ}
          feedback={feedback}
          stat={progress[current.word]}
          onPick={onPickChoose}
          onContinueWrong={() => advance(progress)}
          hintOpened={hintOpened}
          onOpenHint={() => setHintOpened(true)}
        />
      ) : (
        <TypePanel
          char={current}
          input={typeInput}
          onInput={setTypeInput}
          feedback={feedback}
          onSubmit={onSubmitType}
          onContinueWrong={() => advance(progress)}
          stat={progress[current.word]}
          hintOpened={hintOpened}
          onOpenHint={() => setHintOpened(true)}
        />
      )}

      <WrongBookPanel
        wrongChars={oldStats.wrongChars}
        onPickChar={(w) => {
          const target = pool.find((c) => c.word === w) ?? fullPool.find((c) => c.word === w);
          if (target) {
            setCurrent(target);
            if (mode === "choose") setChooseQ(generateChooseQuestion(target, pool));
            setTypeInput("");
            setFeedback(null);
            setCanvasResetKey((k) => k + 1);
            setHintOpened(false);
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
                  <span className="ml-2 text-[10px] text-slate-500">
                    {h.mode === "write" ? "手写" : h.mode === "choose" ? "辨字" : "打字"}
                  </span>
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
      className={`flex-1 px-2 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
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

      {daily && (
        <div className="border-t border-ink-700/40 pt-2 text-xs">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-300">
              今日目标{" "}
              <span className="font-display font-bold text-amber-200">{daily.todayCount}</span>
              <span className="text-slate-400"> / {daily.target} 字次</span>
            </span>
            {daily.streak > 0 && (
              <span className="text-rose-300">🔥 连续 {daily.streak} 天</span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-ink-700/60 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-400 to-orange-400 transition-[width] duration-300" style={{ width: `${dailyPct}%` }} />
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
  stat,
  feedback,
  judging,
  canvasResetKey,
  onSubmit,
  onContinueWrong,
  hintOpened,
  onOpenHint,
}: {
  char: G4Char;
  stat: MasteryStat | undefined;
  feedback: NonNullable<unknown> | null;
  judging: boolean;
  canvasResetKey: number;
  onSubmit: (base64: string) => void;
  onContinueWrong: () => void;
  hintOpened: boolean;
  onOpenHint: () => void;
}) {
  const level: Level = (stat?.level ?? 0) as Level;
  const fb = feedback as {
    isCorrect: boolean;
    userInput: string;
    comment?: string;
    confidence?: "high"|"medium"|"low";
    observed?: string;
  } | null;

  return (
    <div className="card-glow space-y-3">
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
        <div className="text-xs text-slate-400 mb-1">含义</div>
        <div className="text-base text-slate-100 mt-1">{char.meaning}</div>
        <HintRevealer
          group={char.group}
          target={char.word}
          opened={hintOpened}
          onOpen={onOpenHint}
        />
      </div>

      <div className="text-center">
        <div className="text-xs text-violet-200 mb-2">在画板上手写这个字 → AI 视觉识别判定</div>
        <HandwriteCanvas
          key={canvasResetKey}
          width={300}
          height={300}
          onSubmit={onSubmit}
          disabled={judging || !!fb}
        />
      </div>

      {judging && (
        <div className="rounded-xl border border-cyan-400/40 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-100 text-center">
          🔍 AI 正在识别你写的字…
        </div>
      )}

      {fb && fb.isCorrect && (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 text-center">
          <div className="font-display text-2xl mb-1">✓ 写对了！</div>
          {fb.comment && <div className="text-xs text-emerald-200">{fb.comment}</div>}
        </div>
      )}
      {fb && !fb.isCorrect && (
        <>
          <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            <div className="font-semibold mb-1">再来一次 — 正确字是：</div>
            <div className="text-center font-display text-3xl text-amber-200 my-1">{char.word}</div>
            {fb.observed && fb.observed !== char.word && (
              <div className="text-xs text-rose-200/80">
                AI 识别成了 <span className="font-display text-base">{fb.observed}</span>
              </div>
            )}
            {fb.comment && <div className="text-xs text-rose-200/80 mt-1">{fb.comment}</div>}
          </div>
          <button type="button" onClick={onContinueWrong} className="btn-primary w-full">
            下一字 →
          </button>
        </>
      )}
    </div>
  );
}

function ChoosePanel({
  char,
  chooseQ,
  feedback,
  stat,
  onPick,
  onContinueWrong,
  hintOpened,
  onOpenHint,
}: {
  char: G4Char;
  chooseQ: ReturnType<typeof generateChooseQuestion> | null;
  feedback: { isCorrect: boolean; userInput: string } | null;
  stat: MasteryStat | undefined;
  onPick: (opt: string) => void;
  onContinueWrong: () => void;
  hintOpened: boolean;
  onOpenHint: () => void;
}) {
  if (!chooseQ) return <div className="card text-slate-400">题加载中…</div>;
  const level: Level = (stat?.level ?? 0) as Level;
  return (
    <div className="card-glow space-y-3">
      <div className="flex justify-between items-center text-xs">
        <TierChip level={level} />
        {stat && (stat.right > 0 || stat.wrong > 0) && (
          <span className="text-slate-500 tabular-nums">对 {stat.right} · 错 {stat.wrong}</span>
        )}
      </div>
      <div className="text-center">
        <div className="text-xs text-slate-400 uppercase tracking-widest">拼音</div>
        <div className="font-display text-3xl text-cyan-200 mt-1">{char.pinyin}</div>
      </div>
      <div className="rounded-2xl border border-violet-400/30 bg-violet-500/5 p-3 text-center">
        <div className="text-sm text-slate-200">{chooseQ.question}</div>
        <HintRevealer
          group={char.group}
          target={char.word}
          opened={hintOpened}
          onOpen={onOpenHint}
          compact
        />
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
              <span className="text-xs text-slate-400 mr-2">{String.fromCharCode(65 + idx)}.</span>
              {opt}
            </button>
          );
        })}
      </div>
      {feedback && !feedback.isCorrect && (
        <>
          <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            <div className="font-semibold mb-1">再来一次 — 正确字是：</div>
            <div className="text-center font-display text-3xl text-amber-200 my-1">{chooseQ.answer}</div>
          </div>
          <button type="button" onClick={onContinueWrong} className="btn-primary w-full">下一字 →</button>
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

function TypePanel({
  char,
  input,
  onInput,
  feedback,
  onSubmit,
  onContinueWrong,
  stat,
  hintOpened,
  onOpenHint,
}: {
  char: G4Char;
  input: string;
  onInput: (v: string) => void;
  feedback: { isCorrect: boolean; userInput: string } | null;
  onSubmit: (e?: React.FormEvent) => void;
  onContinueWrong: () => void;
  stat: MasteryStat | undefined;
  hintOpened: boolean;
  onOpenHint: () => void;
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
          <span className="text-slate-500 tabular-nums">对 {stat.right} · 错 {stat.wrong}</span>
        )}
      </div>
      <div className="rounded-xl border border-amber-300/30 bg-amber-500/5 p-3 text-xs text-amber-200/70">
        💡 注意：打字模式拼音 IME 会自动出字。仅推荐用 ✍️ 手写挑战 来真正练写字。
      </div>
      <div className="text-center">
        <div className="text-xs text-slate-400 uppercase tracking-widest">拼音</div>
        <div className="font-display text-3xl text-cyan-200 mt-1">{char.pinyin}</div>
      </div>
      <div className="rounded-2xl border border-amber-400/30 bg-amber-500/5 p-4 text-center">
        <div className="text-xs text-slate-400 mb-1">含义</div>
        <div className="text-base text-slate-100 mt-1">{char.meaning}</div>
        <HintRevealer
          group={char.group}
          target={char.word}
          opened={hintOpened}
          onOpen={onOpenHint}
        />
      </div>
      <div>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => onInput(e.target.value)}
          placeholder="打字输入（仅作辅助）"
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
        <>
          <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            <div className="font-semibold mb-1">再来一次 — 正确字是：</div>
            <div className="text-center font-display text-3xl text-amber-200 my-1">{char.word}</div>
            <div className="text-xs text-rose-200/80">你写的：<span className="line-through">{feedback.userInput || "(空)"}</span></div>
          </div>
          <button type="button" onClick={onContinueWrong} className="btn-primary w-full">下一字 →</button>
        </>
      )}
      {feedback && feedback.isCorrect && (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 text-center">
          ✓ 太棒了！
        </div>
      )}
      {!feedback && (
        <button type="submit" disabled={!input.trim()} className="btn-primary w-full disabled:opacity-50">
          提交
        </button>
      )}
    </form>
  );
}

/**
 * 词组提示按钮 — 数学风格的"付费提示"机制 (v0.31.46)
 *
 * 默认隐藏 group（拼音 + 含义已经免费提供）。点击 → 显示完整 group（含 target 字
 * 可见），扣 3 XP。下一题自动 reset。
 *
 * compact: 在辨字模式那种空间紧的地方用更紧凑的视觉。
 */
function HintRevealer({
  group,
  target,
  opened,
  onOpen,
  compact = false,
}: {
  group: string;
  target: string;
  opened: boolean;
  onOpen: () => void;
  compact?: boolean;
}) {
  if (opened) {
    return (
      <div className={`mt-3 rounded-xl border border-amber-400/40 bg-amber-500/10 ${compact ? "p-2" : "p-3"} text-center`}>
        <div className="text-[10px] text-amber-200/80 mb-1">
          💡 词组提示已展开 · 本题 -3 XP
        </div>
        <div className={`font-display ${compact ? "text-lg" : "text-2xl"} text-amber-100 tracking-wide`}>
          {group}
        </div>
        <div className="text-[10px] text-slate-500 mt-1">
          ___ 处填的就是这个字（{target.length === 1 ? "1" : target.length} 个汉字）
        </div>
      </div>
    );
  }
  return (
    <div className="mt-3 flex justify-center">
      <button
        type="button"
        onClick={onOpen}
        className={`chip px-3 py-1.5 ${compact ? "text-[11px]" : "text-xs"} bg-amber-500/15 border border-amber-400/30 text-amber-100 hover:bg-amber-500/25 transition-colors`}
        title="展开词组提示，本题扣 3 XP"
      >
        💡 词组提示（-3 XP）
      </button>
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
