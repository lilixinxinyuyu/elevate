/**
 * 英语 G4 单词记忆 · 练习页 (v0.31.39)
 *
 * 路由：/english/vocab
 *
 * 流程：
 *   1. 进页加载 student + 历史进度（含 english/data.json 迁移）
 *   2. 加权随机一个单词
 *   3. 显示中文意思（+ 提示首字母 + 长度）
 *   4. 用户输入英文单词
 *   5. 即时判对错；写 progress；下一题
 *
 * 答错时不立刻进下一题，给"下一词 →" 按钮，让 Selena 看清楚正确写法。
 */

import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { db } from "../../db/dexie";
import { G4_WORDS, type G4Word } from "../../subjects/english/wordList";
import {
  loadVocabProgress,
  migrateHistoricalVocabProgress,
  normWord,
  pickNextWord,
  recordVocabAttempt,
  summarizeVocab,
  vocabWeight,
  type VocabProgress,
  type VocabSummary,
} from "../../lib/englishVocabProgress";

const RECENT_WINDOW = 5;

interface RoundResult {
  word: string;
  cn: string;
  isCorrect: boolean;
  userInput: string;
}

export function VocabPracticePage() {
  const [studentId, setStudentId] = useState<string | null>(null);
  const [progress, setProgress] = useState<VocabProgress>({});
  const [summary, setSummary] = useState<VocabSummary | null>(null);
  const [current, setCurrent] = useState<G4Word | null>(null);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    userInput: string;
  } | null>(null);
  const [recentLowerWords, setRecentLowerWords] = useState<string[]>([]);
  const [history, setHistory] = useState<RoundResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [migratedToast, setMigratedToast] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);

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
      if (migr.imported > 0) {
        setMigratedToast(
          `已从老系统导入 ${migr.imported} 个单词的进度（你之前练过的不丢）`,
        );
        setTimeout(() => setMigratedToast(null), 5000);
      }
      const p = await loadVocabProgress(s.id);
      if (cancelled) return;
      setProgress(p);
      setSummary(summarizeVocab(G4_WORDS, p));
      const next = pickNextWord(G4_WORDS, p, []);
      setCurrent(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const advance = (
    nextProgress: VocabProgress,
    justSeenLower: string | null,
  ) => {
    const newRecent = justSeenLower
      ? [justSeenLower, ...recentLowerWords].slice(0, RECENT_WINDOW)
      : recentLowerWords;
    setRecentLowerWords(newRecent);
    const next = pickNextWord(G4_WORDS, nextProgress, newRecent);
    setCurrent(next);
    setInput("");
    setFeedback(null);
    setShowHint(false);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!current || feedback) return;
    const trimmed = input.trim();
    if (!trimmed) return;
    const isCorrect = trimmed.toLowerCase() === current.w.toLowerCase();
    setFeedback({ isCorrect, userInput: trimmed });
    setHistory((h) => [
      ...h,
      { word: current.w, cn: current.c, isCorrect, userInput: trimmed },
    ]);
    if (studentId) {
      const newStat = await recordVocabAttempt(studentId, current.w, isCorrect);
      const nextProgress: VocabProgress = {
        ...progress,
        [normWord(current.w)]: newStat,
      };
      setProgress(nextProgress);
      setSummary(summarizeVocab(G4_WORDS, nextProgress));
      if (isCorrect) {
        setTimeout(() => advance(nextProgress, normWord(current.w)), 1200);
      }
    }
  };

  const onSkipWrong = () => {
    if (!current) return;
    advance(progress, normWord(current.w));
  };

  if (loading) {
    return <div className="card text-center text-slate-300">加载单词进度中…</div>;
  }
  if (!studentId) {
    return (
      <div className="card text-center text-slate-300">
        请先去首页登录学生账号。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-display font-bold text-2xl text-cyan-200">
            英语单词 · {G4_WORDS.length} 词
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            G4 上下册全部 · 加权随机 · 错过的会再出现
          </div>
        </div>
        <Link
          to="/english"
          className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border border-ink-700/60 hover:border-ink-600"
        >
          ← 回首页
        </Link>
      </div>

      {migratedToast && (
        <div className="rounded-xl border border-cyan-400/40 bg-cyan-500/10 text-cyan-100 text-xs px-3 py-2">
          ✓ {migratedToast}
        </div>
      )}

      {summary && <VocabProgressBar summary={summary} />}

      {!current ? (
        <div className="card text-center text-slate-300">
          <div className="text-4xl mb-2">🎉</div>
          <div className="font-display text-xl text-emerald-200">所有词都出过了</div>
          <div className="mt-4">
            <button
              type="button"
              className="btn-primary"
              onClick={() => setRecentLowerWords([])}
            >
              再来一轮
            </button>
          </div>
        </div>
      ) : (
        <VocabCard
          word={current}
          input={input}
          onInput={setInput}
          feedback={feedback}
          onSubmit={handleSubmit}
          onContinueAfterWrong={onSkipWrong}
          progressEntry={progress[normWord(current.w)]}
          showHint={showHint}
          onToggleHint={() => setShowHint((v) => !v)}
        />
      )}

      {history.length > 0 && (
        <details className="rounded-xl border border-ink-700/50 bg-ink-900/40 p-3">
          <summary className="text-xs text-slate-400 cursor-pointer">
            本次 {history.length} 词 · 对 {history.filter((h) => h.isCorrect).length}
          </summary>
          <ul className="mt-2 space-y-1 text-xs">
            {history
              .slice()
              .reverse()
              .map((h, idx) => (
                <li
                  key={`${h.word}-${idx}`}
                  className="flex justify-between border-b border-ink-700/40 pb-1"
                >
                  <span className="text-slate-300">
                    <span className="text-cyan-200 font-display text-sm mr-2">
                      {h.word}
                    </span>
                    <span className="text-slate-400">{h.cn}</span>
                  </span>
                  <span className={h.isCorrect ? "text-emerald-300" : "text-rose-300"}>
                    {h.isCorrect ? "✓" : `✗ ${h.userInput || "(空)"}`}
                  </span>
                </li>
              ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function VocabProgressBar({ summary }: { summary: VocabSummary }) {
  const { total, attempted, mastered, shaky, fresh } = summary;
  const masteredPct = (mastered / total) * 100;
  const attemptedPct = ((attempted - mastered) / total) * 100;
  return (
    <div className="card-glow">
      <div className="flex justify-between items-baseline mb-2">
        <span className="font-semibold text-cyan-100">
          {mastered}{" "}
          <span className="text-xs text-slate-400 font-normal">/ {total} 词已掌握</span>
        </span>
        <span className="text-xs text-slate-400">
          没见过 {fresh} · 待巩固 {shaky}
        </span>
      </div>
      <div className="h-3 rounded-full bg-ink-700/60 overflow-hidden flex">
        <div
          className="bg-emerald-400 transition-[width] duration-300"
          style={{ width: `${masteredPct}%` }}
        />
        <div
          className="bg-cyan-400/60 transition-[width] duration-300"
          style={{ width: `${attemptedPct}%` }}
        />
      </div>
    </div>
  );
}

function VocabCard({
  word,
  input,
  onInput,
  feedback,
  onSubmit,
  onContinueAfterWrong,
  progressEntry,
  showHint,
  onToggleHint,
}: {
  word: G4Word;
  input: string;
  onInput: (v: string) => void;
  feedback: { isCorrect: boolean; userInput: string } | null;
  onSubmit: (e?: React.FormEvent) => void;
  onContinueAfterWrong: () => void;
  progressEntry: { correct: number; wrong: number; lastSeenAt: number } | undefined;
  showHint: boolean;
  onToggleHint: () => void;
}) {
  const wTier = useMemo(() => {
    const w = vocabWeight(progressEntry);
    if (w >= 1.4) return { label: "强化", color: "rose" };
    if (w >= 0.9) return { label: "在练", color: "amber" };
    return { label: "熟练", color: "emerald" };
  }, [progressEntry]);

  const hintFirstLetter = word.w[0] ?? "";
  const hintLength = word.w.length;

  return (
    <form onSubmit={onSubmit} className="card-glow space-y-3" autoComplete="off">
      <div className="flex justify-between items-center text-xs">
        <span
          className={`chip text-[10px] px-2 py-0.5 border ${
            wTier.color === "rose"
              ? "bg-rose-500/15 text-rose-200 border-rose-400/40"
              : wTier.color === "amber"
                ? "bg-amber-500/15 text-amber-200 border-amber-400/40"
                : "bg-emerald-500/15 text-emerald-200 border-emerald-400/40"
          }`}
        >
          {wTier.label} · {word.semester}
        </span>
        {progressEntry && (
          <span className="text-slate-500 tabular-nums">
            对 {progressEntry.correct} · 错 {progressEntry.wrong}
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-cyan-400/30 bg-cyan-500/5 p-4 text-center">
        <div className="text-xs text-slate-400 mb-1">中文意思</div>
        <div className="font-display text-2xl text-cyan-100">{word.c}</div>
      </div>

      {showHint && (
        <div className="text-center text-xs text-amber-200">
          首字母：<span className="font-display text-base">{hintFirstLetter}</span> · 长度{" "}
          {hintLength}
        </div>
      )}

      <div>
        <input
          type="text"
          value={input}
          onChange={(e) => onInput(e.target.value)}
          placeholder="输入英文单词"
          autoFocus
          maxLength={40}
          disabled={!!feedback}
          className={`w-full text-center font-display text-2xl p-4 rounded-2xl border bg-ink-900/60 ${
            feedback?.isCorrect
              ? "border-emerald-400 text-emerald-200"
              : feedback
                ? "border-rose-400 text-rose-200"
                : "border-ink-600 text-cyan-100 focus:border-violet-400 focus:outline-none"
          }`}
        />
      </div>

      {feedback && !feedback.isCorrect && (
        <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          <div className="font-semibold mb-1">再来一次 — 正确写法是：</div>
          <div className="text-center font-display text-2xl text-cyan-200 my-1">
            {word.w}
          </div>
          <div className="text-xs text-rose-200/80">
            你写的：<span className="line-through">{feedback.userInput || "(空)"}</span>
          </div>
        </div>
      )}

      {feedback && feedback.isCorrect && (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 text-center">
          ✓ 太棒了！正在切换下一个词…
        </div>
      )}

      {!feedback ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onToggleHint}
            className="btn-secondary text-xs px-3 py-2"
          >
            {showHint ? "✓ 提示中" : "💡 提示首字母"}
          </button>
          <button
            type="submit"
            disabled={!input.trim()}
            className="btn-primary flex-1 disabled:opacity-50"
          >
            提交
          </button>
        </div>
      ) : !feedback.isCorrect ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onContinueAfterWrong}
            className="btn-primary flex-1"
          >
            下一词 →
          </button>
        </div>
      ) : null}
    </form>
  );
}
