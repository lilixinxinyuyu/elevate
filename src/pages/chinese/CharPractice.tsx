/**
 * 语文写字表 250 字 · 练习页（v0.31.39）
 *
 * 路由：/chinese/char-practice
 *
 * 流程：
 *   1. 进页 → 加载 student + 历史 progress（含 chinese/data.json 迁移）
 *   2. 加权随机一个字（new + 错过的优先）
 *   3. 显示拼音 + 词组（含 ___ 占位）+ 含义；用户输入这个字
 *   4. 即时判对错；right/wrong 计数 +1，更新 progress；下一题
 *   5. 顶部 stats：已学 X / 已掌握 Y / 待巩固 Z / 总 250
 *
 * 数据：
 *   - 字源：src/subjects/chinese/charLibrary.ts (G4B_CHARS = 250 个)
 *   - 进度：src/lib/chineseCharProgress.ts (db.meta::chinese_char_progress)
 *   - 迁移：进页第一次自动跑（幂等）
 *
 * 故意不接 db.attempts/mastery —— 与现有 chinese 题型完全独立，避免污染期中诊断。
 */

import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { db } from "../../db/dexie";
import { G4B_CHARS, type G4bChar } from "../../subjects/chinese/charLibrary";
import {
  charWeight,
  loadCharProgress,
  migrateHistoricalCharProgress,
  pickNextChar,
  recordCharAttempt,
  summarizeProgress,
  type CharProgress,
  type CharProgressSummary,
} from "../../lib/chineseCharProgress";

type Stage = "loading" | "practicing" | "reviewing";

interface RoundResult {
  word: string;
  pinyin: string;
  isCorrect: boolean;
  userInput: string;
}

const RECENT_WINDOW = 5;

export function CharPracticePage() {
  const [stage, setStage] = useState<Stage>("loading");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [progress, setProgress] = useState<CharProgress>({});
  const [summary, setSummary] = useState<CharProgressSummary | null>(null);
  const [current, setCurrent] = useState<G4bChar | null>(null);
  const [input, setInput] = useState("");
  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    userInput: string;
  } | null>(null);
  const [recentWords, setRecentWords] = useState<string[]>([]);
  const [history, setHistory] = useState<RoundResult[]>([]);
  const [migratedToast, setMigratedToast] = useState<string | null>(null);

  // 加载流程：student + 迁移 + 进度 + 第一道字
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ss = await db.students.toArray();
      const s = ss[0];
      if (!s) {
        setStage("practicing"); // 没 student 也允许练（仅会话内记忆）
        return;
      }
      if (cancelled) return;
      setStudentId(s.id);
      const migr = await migrateHistoricalCharProgress(s.id);
      if (migr.imported > 0) {
        setMigratedToast(
          `已从老系统导入 ${migr.imported} 个字的进度（你之前练过的不丢）`,
        );
        // 5 秒后自动收
        setTimeout(() => setMigratedToast(null), 5000);
      }
      const p = await loadCharProgress(s.id);
      if (cancelled) return;
      setProgress(p);
      setSummary(summarizeProgress(G4B_CHARS, p));
      const next = pickNextChar(G4B_CHARS, p, []);
      setCurrent(next);
      setStage("practicing");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const advance = (
    nextProgress: CharProgress,
    justSeenWord: string | null,
  ) => {
    const newRecent = justSeenWord
      ? [justSeenWord, ...recentWords].slice(0, RECENT_WINDOW)
      : recentWords;
    setRecentWords(newRecent);
    const next = pickNextChar(G4B_CHARS, nextProgress, newRecent);
    setCurrent(next);
    setInput("");
    setFeedback(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!current || feedback) return;
    const trimmed = input.trim();
    if (!trimmed) return;
    const isCorrect = trimmed === current.word;
    setFeedback({ isCorrect, userInput: trimmed });
    setHistory((h) => [
      ...h,
      {
        word: current.word,
        pinyin: current.pinyin,
        isCorrect,
        userInput: trimmed,
      },
    ]);
    if (studentId) {
      const newStat = await recordCharAttempt(studentId, current.word, isCorrect);
      const nextProgress: CharProgress = { ...progress, [current.word]: newStat };
      setProgress(nextProgress);
      setSummary(summarizeProgress(G4B_CHARS, nextProgress));
      // 答错的不立刻进 next；答对自动 1.5s 后跳
      if (isCorrect) {
        setTimeout(() => advance(nextProgress, current.word), 1200);
      }
    } else {
      // 没 student（异常）：本地继续
      const cur = progress[current.word] ?? { right: 0, wrong: 0, lastSeenAt: 0 };
      const updated = {
        right: cur.right + (isCorrect ? 1 : 0),
        wrong: cur.wrong + (isCorrect ? 0 : 1),
        lastSeenAt: Date.now(),
      };
      const nextProgress = { ...progress, [current.word]: updated };
      setProgress(nextProgress);
      setSummary(summarizeProgress(G4B_CHARS, nextProgress));
      if (isCorrect) {
        setTimeout(() => advance(nextProgress, current.word), 1200);
      }
    }
  };

  const onSkipWrong = () => {
    if (!current) return;
    advance(progress, current.word);
  };

  if (stage === "loading") {
    return <div className="card text-center text-slate-300">加载字词进度中…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-display font-bold text-2xl text-amber-200">
            写字表 250
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            人教版 G4B · 加权随机 · 错过的字会再出现
          </div>
        </div>
        <Link
          to="/chinese"
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

      {/* 进度统计 */}
      {summary && <ProgressBar summary={summary} />}

      {/* 当前字卡 */}
      {!current ? (
        <div className="card text-center text-slate-300">
          <div className="text-4xl mb-2">🎉</div>
          <div className="font-display text-xl text-emerald-200">这一轮所有字都出过了</div>
          <div className="text-xs text-slate-400 mt-1">
            （刷新或继续即可，权重会重新洗）
          </div>
          <div className="mt-4">
            <button
              type="button"
              className="btn-primary"
              onClick={() => setRecentWords([])}
            >
              再来一轮
            </button>
          </div>
        </div>
      ) : (
        <CharCard
          char={current}
          input={input}
          onInput={setInput}
          feedback={feedback}
          onSubmit={handleSubmit}
          onContinueAfterWrong={onSkipWrong}
          progressEntry={progress[current.word]}
        />
      )}

      {/* 历史 */}
      {history.length > 0 && (
        <details className="rounded-xl border border-ink-700/50 bg-ink-900/40 p-3">
          <summary className="text-xs text-slate-400 cursor-pointer">
            本次练习 {history.length} 字 · 对 {history.filter((h) => h.isCorrect).length}
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
                    <span className="text-amber-200 font-display text-base mr-2">
                      {h.word}
                    </span>
                    <span className="text-slate-400">{h.pinyin}</span>
                  </span>
                  <span className={h.isCorrect ? "text-emerald-300" : "text-rose-300"}>
                    {h.isCorrect ? "✓" : `✗ 你写的：${h.userInput || "(空)"}`}
                  </span>
                </li>
              ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ProgressBar({ summary }: { summary: CharProgressSummary }) {
  const { total, attempted, mastered, shaky, fresh } = summary;
  const masteredPct = (mastered / total) * 100;
  const attemptedPct = ((attempted - mastered) / total) * 100;
  return (
    <div className="card-glow">
      <div className="flex justify-between items-baseline mb-2">
        <span className="font-semibold text-amber-100">
          {mastered}{" "}
          <span className="text-xs text-slate-400 font-normal">/ {total} 字已掌握</span>
        </span>
        <span className="text-xs text-slate-400">
          没见过 {fresh} · 待巩固 {shaky} · 在练 {Math.max(0, attempted - mastered - shaky)}
        </span>
      </div>
      <div className="h-3 rounded-full bg-ink-700/60 overflow-hidden flex">
        <div
          className="bg-emerald-400 transition-[width] duration-300"
          style={{ width: `${masteredPct}%` }}
          title={`已掌握 ${mastered}`}
        />
        <div
          className="bg-amber-400/60 transition-[width] duration-300"
          style={{ width: `${attemptedPct}%` }}
          title={`已学过 ${attempted - mastered}`}
        />
      </div>
    </div>
  );
}

function CharCard({
  char,
  input,
  onInput,
  feedback,
  onSubmit,
  onContinueAfterWrong,
  progressEntry,
}: {
  char: G4bChar;
  input: string;
  onInput: (v: string) => void;
  feedback: { isCorrect: boolean; userInput: string } | null;
  onSubmit: (e?: React.FormEvent) => void;
  onContinueAfterWrong: () => void;
  progressEntry: { right: number; wrong: number; lastSeenAt: number } | undefined;
}) {
  const wTier = useMemo(() => {
    const w = charWeight(progressEntry);
    if (w >= 1.4) return { label: "强化", color: "rose" };
    if (w >= 0.9) return { label: "在练", color: "amber" };
    return { label: "熟练", color: "emerald" };
  }, [progressEntry]);

  return (
    <form
      onSubmit={onSubmit}
      className="card-glow space-y-3"
      autoComplete="off"
    >
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
          {wTier.label}
        </span>
        {progressEntry && (
          <span className="text-slate-500 tabular-nums">
            对 {progressEntry.right} · 错 {progressEntry.wrong}
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
          type="text"
          value={input}
          onChange={(e) => onInput(e.target.value)}
          placeholder="在这里写出这个字"
          autoFocus
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
        <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          <div className="font-semibold mb-1">再来一次 — 正确字是：</div>
          <div className="text-center font-display text-3xl text-amber-200 my-1">
            {char.word}
          </div>
          <div className="text-xs text-rose-200/80">
            你写的：<span className="line-through">{feedback.userInput || "(空)"}</span>
          </div>
        </div>
      )}

      {feedback && feedback.isCorrect && (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 text-center">
          ✓ 太棒了！正在切换下一个字…
        </div>
      )}

      {!feedback ? (
        <div className="flex gap-2">
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
            下一字 →
          </button>
        </div>
      ) : null}
    </form>
  );
}
