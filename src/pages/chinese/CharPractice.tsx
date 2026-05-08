/**
 * 语文写字表 500 字 · 练习页（v0.31.40 重写）
 *
 * 路由：/chinese/char-practice
 *
 * 重写动机：v0.31.39 简化太厉害，跟老 chinese/g4_cn.html 系统对不齐
 * - 老系统 500 字（上 250 + 下 250 切换），这版只有下册 250
 * - 老系统 2 模式（手写 + 辨字选择），这版只有 1 模式
 * - 老系统统计 总练习/正确率/错字总数 ；这版用的"已掌握"等逻辑跟老的不一致
 *
 * 新版（pixel-aligned with g4_cn.html UX，再加游戏化）：
 *   ┌────────────────────────────────────────┐
 *   │ [上册] [下册]   [写字模式] [辨字选择]    │  ← 双 toggle
 *   ├────────────────────────────────────────┤
 *   │ 总练习: 180  正确率: 96%  错字: 5       │  ← 老口径 stats
 *   │ ▓▓▓▓▓░░░░ 连击 × 7  +120 XP             │  ← 游戏化：连击 + 单次 XP
 *   ├────────────────────────────────────────┤
 *   │ <模式 panel>                            │
 *   ├────────────────────────────────────────┤
 *   │ 错字本：哩 / 颇 / 挣 / 囊 / 毫           │
 *   └────────────────────────────────────────┘
 *
 * 加权选字沿用老公式 `max(1, wrong*3 + 1 - min(right, 3))`。
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
  generateChooseQuestion,
  loadCharProgress,
  migrateHistoricalCharProgress,
  pickNextChar,
  recordCharAttempt,
  type CharProgress,
  type OldStyleStats,
} from "../../lib/chineseCharProgress";

type Book = "G4A" | "G4B";
type Mode = "write" | "choose";
const RECENT_WINDOW = 5;

interface RoundResult {
  word: string;
  pinyin: string;
  isCorrect: boolean;
  userInput: string;
  mode: Mode;
}

export function CharPracticePage() {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [progress, setProgress] = useState<CharProgress>({});
  const [book, setBook] = useState<Book>("G4B"); // 默认下册（期中冲刺）
  const [mode, setMode] = useState<Mode>("write");
  const [current, setCurrent] = useState<G4Char | null>(null);
  const [chooseQ, setChooseQ] = useState<ReturnType<typeof generateChooseQuestion> | null>(null);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<{ isCorrect: boolean; userInput: string } | null>(
    null,
  );
  const [recentWords, setRecentWords] = useState<string[]>([]);
  const [history, setHistory] = useState<RoundResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [migratedToast, setMigratedToast] = useState<string | null>(null);
  // 游戏化：连击 + 本次会话 XP
  const [combo, setCombo] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [floatingXp, setFloatingXp] = useState<{ amount: number; key: number } | null>(null);

  const pool: G4Char[] = book === "G4A" ? G4A_CHARS : G4B_CHARS;

  // 初次加载
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
      if (migr.imported > 0) {
        setMigratedToast(`已从老系统导入 ${migr.imported} 个字的进度`);
        setTimeout(() => setMigratedToast(null), 5000);
      }
      const p = await loadCharProgress(s.id);
      if (cancelled) return;
      setProgress(p);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 切换 book / mode 时立即取新字
  useEffect(() => {
    if (loading) return;
    pickNew(progress);
    setRecentWords([]);
    setFeedback(null);
    setInput("");
    setCombo(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, mode, loading]);

  function pickNew(curProgress: CharProgress, recent: string[] = []) {
    const next = pickNextChar(pool, curProgress, recent);
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
    setHistory((h) => [
      ...h.slice(-19),
      { word: current.word, pinyin: current.pinyin, isCorrect, userInput, mode },
    ]);
    // 游戏化算分
    if (isCorrect) {
      const base = 8;
      const comboBonus = Math.min(combo, 9) * 2; // 连击 × 2，最多 +18
      const earned = base + comboBonus;
      setSessionXp((x) => x + earned);
      setCombo((c) => c + 1);
      flashXp(earned);
    } else {
      setCombo(0);
      flashXp(0);
    }
    // 持久化
    let nextProgress: CharProgress;
    if (studentId) {
      const newStat = await recordCharAttempt(studentId, current.word, isCorrect);
      nextProgress = { ...progress, [current.word]: newStat };
    } else {
      const cur = progress[current.word] ?? { right: 0, wrong: 0, lastSeenAt: 0 };
      nextProgress = {
        ...progress,
        [current.word]: {
          right: cur.right + (isCorrect ? 1 : 0),
          wrong: cur.wrong + (isCorrect ? 0 : 1),
          lastSeenAt: Date.now(),
        },
      };
    }
    setProgress(nextProgress);
    if (isCorrect) {
      setTimeout(() => advance(nextProgress), 1100);
    }
  }

  function advance(curProgress: CharProgress) {
    if (!current) return;
    const nextRecent = [current.word, ...recentWords].slice(0, RECENT_WINDOW);
    setRecentWords(nextRecent);
    pickNew(curProgress, nextRecent);
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

  const stats = useMemo(() => calcOldStyleStats(progress), [progress]);

  if (loading) return <div className="card text-center text-slate-300">加载中…</div>;

  return (
    <div className="space-y-3 relative">
      <header className="flex items-center justify-between gap-2">
        <div>
          <div className="font-display font-bold text-2xl text-amber-200">
            写字表 500 字
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            人教版 G4 上下册 · 加权随机 · 错过的字会再出现
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

      {/* 老口径统计 + 游戏化 */}
      <StatsBar stats={stats} combo={combo} sessionXp={sessionXp} />

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
              pickNew(progress, []);
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
          progressEntry={progress[current.word]}
        />
      ) : (
        <ChoosePanel
          char={current}
          chooseQ={chooseQ}
          feedback={feedback}
          onPick={onPickChoose}
          onContinueWrong={() => advance(progress)}
          progressEntry={progress[current.word]}
        />
      )}

      {/* 错字本 */}
      <WrongBookPanel
        wrongChars={stats.wrongChars}
        onPickChar={(w) => {
          // 直接跳到那个字（人工选择）
          const target = pool.find((c) => c.word === w);
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
                  <span className="ml-2 text-[10px] text-slate-500">
                    {h.mode === "write" ? "写字" : "辨字"}
                  </span>
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
          className="absolute right-4 top-32 text-amber-300 font-display font-bold text-2xl pointer-events-none animate-slide-up"
        >
          +{floatingXp.amount} XP
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
}: {
  stats: OldStyleStats;
  combo: number;
  sessionXp: number;
}) {
  const pct = Math.round(stats.correctRate * 100);
  return (
    <div className="card-glow space-y-2">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-[10px] text-slate-400">总练习</div>
          <div className="font-display font-bold text-xl text-amber-200">
            {stats.totalAttempts}
            <span className="text-xs text-slate-400 ml-1">字次</span>
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400">正确率</div>
          <div
            className={`font-display font-bold text-xl ${
              pct >= 90 ? "text-emerald-300" : pct >= 70 ? "text-amber-300" : "text-rose-300"
            }`}
          >
            {stats.totalAttempts === 0 ? "—" : `${pct}%`}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-slate-400">错字总数</div>
          <div className="font-display font-bold text-xl text-rose-300">
            {stats.wrongChars.length}
            <span className="text-xs text-slate-400 ml-1">个</span>
          </div>
        </div>
      </div>
      {/* 游戏化：连击 + 本次 XP */}
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
  progressEntry,
}: {
  char: G4Char;
  input: string;
  onInput: (v: string) => void;
  feedback: { isCorrect: boolean; userInput: string } | null;
  onSubmit: (e?: React.FormEvent) => void;
  onContinueWrong: () => void;
  progressEntry: { right: number; wrong: number; lastSeenAt: number } | undefined;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, [char.word]);

  return (
    <form onSubmit={onSubmit} className="card-glow space-y-3" autoComplete="off">
      <div className="text-center text-xs text-slate-500">
        {progressEntry && (
          <span>对 {progressEntry.right} · 错 {progressEntry.wrong}</span>
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
  progressEntry,
}: {
  char: G4Char;
  chooseQ: ReturnType<typeof generateChooseQuestion> | null;
  feedback: { isCorrect: boolean; userInput: string } | null;
  onPick: (opt: string) => void;
  onContinueWrong: () => void;
  progressEntry: { right: number; wrong: number; lastSeenAt: number } | undefined;
}) {
  if (!chooseQ) return <div className="card text-slate-400">题加载中…</div>;
  return (
    <div className="card-glow space-y-3">
      <div className="text-center text-xs text-slate-500">
        {progressEntry && (
          <span>对 {progressEntry.right} · 错 {progressEntry.wrong}</span>
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
          const showWrong =
            !!feedback && !feedback.isCorrect && opt === feedback.userInput;
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
          错过比对过多的 {wrongChars.length} 字 · 点击单独练
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
