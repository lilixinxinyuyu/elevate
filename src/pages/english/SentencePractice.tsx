/**
 * v0.31.103 英语短句大冒险页：朗读 + 造句两种模式。
 *
 * 路由：/english/sentence
 *
 * 模式：
 *   📣 朗读判分：显示句子 + 录音 → Qwen3-Omni 评分（mode='sentence'）
 *   🔀 造句拼图：句子打散成词块 → Selena 按正确顺序点亮 → 检验
 *
 * 数据：用 src/content/englishSentences.ts 的 30 个 G4 句库，按难度过滤 +
 * 随机出。不进 vocab progress（句子粒度跟单词不同），但记入 daily_log
 * （subject='english'）。
 */

import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/dexie";
import { G4_SENTENCES, type G4Sentence } from "../../content/englishSentences";
import { SpeakWordPanel } from "../../components/english/SpeakWordPanel";
import { recordDailyActivity } from "../../lib/dailyActivityLog";
import { loadDaily, tickDaily, type DailyState } from "../../lib/dailyTarget";

type Mode = "speak" | "make";
type Difficulty = 1 | 2 | 3 | "all";

export function SentencePracticePage() {
  const liveStudent = useLiveQuery(async () => (await db.students.toArray())[0]);
  const studentId = liveStudent?.id ?? null;
  const [daily, setDaily] = useState<DailyState | null>(null);
  const [mode, setMode] = useState<Mode>("speak");
  const [difficulty, setDifficulty] = useState<Difficulty>("all");
  const [current, setCurrent] = useState<G4Sentence | null>(null);
  const [dailyCelebration, setDailyCelebration] = useState<{ streak: number } | null>(null);

  const pool = useMemo(
    () =>
      difficulty === "all"
        ? G4_SENTENCES
        : G4_SENTENCES.filter((s) => s.difficulty === difficulty),
    [difficulty],
  );

  useEffect(() => {
    if (!studentId) return;
    void (async () => {
      const d = await loadDaily("english_sentences", studentId, 3);
      setDaily(d);
    })();
  }, [studentId]);

  useEffect(() => {
    pick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty, mode]);

  function pick() {
    if (pool.length === 0) return setCurrent(null);
    const next = pool[Math.floor(Math.random() * pool.length)];
    setCurrent(next ?? null);
  }

  async function recordAttempt(isCorrect: boolean) {
    if (!studentId || !current) return;
    void recordDailyActivity("english", studentId, current.en, isCorrect);
    if (daily) {
      const { next, justCompleted } = await tickDaily(
        "english_sentences",
        studentId,
        daily,
      );
      setDaily(next);
      if (justCompleted) {
        setDailyCelebration({ streak: next.streak });
        setTimeout(() => setDailyCelebration(null), 3500);
      }
    }
  }

  return (
    <div className="space-y-3 relative">
      <header className="flex items-center justify-between gap-2">
        <div>
          <div className="font-display font-bold text-2xl text-cyan-200">
            🗣️ 短句大冒险
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            朗读判分 + 造句拼图 · 30 句 G4 库
          </div>
        </div>
        <Link
          to="/english"
          className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border border-ink-700/60 hover:border-ink-600"
        >
          ← 回首页
        </Link>
      </header>

      {/* 模式切换 */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <ModeTab active={mode === "speak"} onClick={() => setMode("speak")}>
          📣 朗读 AI 判分
        </ModeTab>
        <ModeTab active={mode === "make"} onClick={() => setMode("make")}>
          🔀 造句拼图
        </ModeTab>
      </div>

      {/* 难度 + 今日 chip */}
      <div className="flex items-center justify-between gap-2 text-xs flex-wrap">
        <div className="flex gap-1.5">
          {(["all", 1, 2, 3] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDifficulty(d)}
              className={`px-2 py-1 rounded-md text-[11px] ${
                difficulty === d
                  ? "bg-cyan-500/25 border border-cyan-400/50 text-cyan-100"
                  : "bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
              }`}
            >
              {d === "all" ? "全部" : d === 1 ? "🟢 简单" : d === 2 ? "🟡 中等" : "🔴 较难"}
            </button>
          ))}
        </div>
        {daily && (
          <span className="text-[11px] text-slate-400 tabular-nums">
            今日 {daily.todayCount}/{daily.target}
            {daily.streak > 0 && ` · 🔥 ${daily.streak}`}
          </span>
        )}
      </div>

      {!current ? (
        <div className="card text-center text-slate-400 py-6 text-sm">
          这个难度没有句子，换一个难度
        </div>
      ) : mode === "speak" ? (
        <SpeakModePanel
          sentence={current}
          studentId={studentId}
          onScored={(score) => {
            void recordAttempt(score >= 70);
          }}
          onNext={pick}
        />
      ) : (
        <MakeModePanel
          sentence={current}
          onDone={(isCorrect) => {
            void recordAttempt(isCorrect);
          }}
          onNext={pick}
        />
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
      className={`px-3 py-2 rounded-lg font-semibold transition-colors ${
        active
          ? "bg-cyan-500/20 text-cyan-100 border border-cyan-400/40"
          : "bg-ink-900/40 text-slate-400 border border-ink-700/60 hover:bg-ink-700/40"
      }`}
    >
      {children}
    </button>
  );
}

// =====================================================================
// 朗读模式：复用 SpeakWordPanel 但 mode='sentence'
// =====================================================================

function SpeakModePanel({
  sentence,
  onScored,
  onNext,
  studentId,
}: {
  sentence: G4Sentence;
  onScored: (score: number) => void;
  onNext: () => void;
  studentId: string | null;
}) {
  return (
    <div className="space-y-3">
      <SpeakWordPanel
        key={sentence.en}
        target={sentence.en}
        hintMeaning={sentence.cn}
        mode="sentence"
        onScore={(score) => {
          onScored(score);
          // v0.31.107：朗读 ≥70 分计入 english_speak daily（喂朗读环）
          if (score >= 70 && studentId) {
            void (async () => {
              const cur = await loadDaily("english_speak", studentId, 5);
              await tickDaily("english_speak", studentId, cur);
            })();
          }
        }}
      />
      <button
        type="button"
        onClick={onNext}
        className="w-full py-2 rounded-lg bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 text-sm"
      >
        下一句 →
      </button>
    </div>
  );
}

// =====================================================================
// 造句模式：句子按词拆开 → 打乱 → 点击按顺序点亮 → 满了检验
// =====================================================================

interface Token {
  text: string;
  /** 原顺序 index */
  originIdx: number;
  /** 当前点亮顺序，未点 = -1 */
  pickedAt: number;
}

function MakeModePanel({
  sentence,
  onDone,
  onNext,
}: {
  sentence: G4Sentence;
  onDone: (isCorrect: boolean) => void;
  onNext: () => void;
}) {
  // 拆句：按空格 + 保留标点。先去掉末尾 .?!
  const words = useMemo(() => splitSentenceWords(sentence.en), [sentence.en]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [verdict, setVerdict] = useState<"correct" | "wrong" | null>(null);

  useEffect(() => {
    // 重置 + 打乱（保持 originIdx）
    const fresh: Token[] = words.map((w, i) => ({
      text: w,
      originIdx: i,
      pickedAt: -1,
    }));
    const shuffled = shuffleSeeded(fresh, sentence.en);
    setTokens(shuffled);
    setVerdict(null);
  }, [sentence.en, words]);

  const nextPickOrder = tokens.filter((t) => t.pickedAt >= 0).length;

  function togglePick(tokenIdx: number) {
    if (verdict) return;
    const t = tokens[tokenIdx];
    if (!t) return;
    if (t.pickedAt >= 0) {
      // 取消该选择：所有 pickedAt > t.pickedAt 的减 1
      const removedOrder = t.pickedAt;
      setTokens((prev) =>
        prev.map((p, i) => {
          if (i === tokenIdx) return { ...p, pickedAt: -1 };
          if (p.pickedAt > removedOrder) return { ...p, pickedAt: p.pickedAt - 1 };
          return p;
        }),
      );
    } else {
      setTokens((prev) =>
        prev.map((p, i) => (i === tokenIdx ? { ...p, pickedAt: nextPickOrder } : p)),
      );
    }
  }

  function submit() {
    const ordered = [...tokens]
      .filter((t) => t.pickedAt >= 0)
      .sort((a, b) => a.pickedAt - b.pickedAt);
    if (ordered.length !== words.length) return;
    const ok = ordered.every((t, i) => t.originIdx === i);
    setVerdict(ok ? "correct" : "wrong");
    onDone(ok);
  }

  function reset() {
    setTokens((prev) =>
      prev.map((t) => ({ ...t, pickedAt: -1 })),
    );
    setVerdict(null);
  }

  const orderedTokens = [...tokens]
    .filter((t) => t.pickedAt >= 0)
    .sort((a, b) => a.pickedAt - b.pickedAt);
  const allPicked = orderedTokens.length === words.length;

  return (
    <div className="card-glow space-y-4">
      <div className="text-center">
        <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">
          🇨🇳 中文意思
        </div>
        <div className="font-display text-lg text-slate-100">{sentence.cn}</div>
      </div>

      {/* 已点亮的拼装区 */}
      <div className="rounded-xl border border-violet-400/30 bg-violet-500/5 p-3 min-h-[60px] flex flex-wrap gap-2 items-center justify-center">
        {orderedTokens.length === 0 ? (
          <span className="text-xs text-slate-500">↓ 从下面按顺序点击词块</span>
        ) : (
          orderedTokens.map((t) => (
            <span
              key={t.originIdx}
              className="px-2.5 py-1 rounded-md bg-violet-500/25 text-violet-50 font-display text-base"
            >
              {t.text}
            </span>
          ))
        )}
      </div>

      {/* 词块池 */}
      <div className="flex flex-wrap gap-2 justify-center">
        {tokens.map((t, idx) => {
          const picked = t.pickedAt >= 0;
          return (
            <button
              key={idx}
              type="button"
              disabled={!!verdict}
              onClick={() => togglePick(idx)}
              className={`px-3 py-1.5 rounded-md font-display text-base transition-all ${
                picked
                  ? "bg-violet-500/40 text-white opacity-50"
                  : "bg-cyan-500/15 text-cyan-100 border border-cyan-400/40 hover:bg-cyan-500/25 active:scale-[0.96]"
              } disabled:opacity-40`}
            >
              {t.text}
            </button>
          );
        })}
      </div>

      {/* verdict / submit */}
      {verdict === "correct" && (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 p-3 text-emerald-100 text-center">
          ✓ 拼对了！原句：<span className="font-display">{sentence.en}</span>
        </div>
      )}
      {verdict === "wrong" && (
        <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 text-rose-100 text-center text-sm">
          ✗ 顺序不对。正确顺序：
          <div className="font-display text-base mt-1">{sentence.en}</div>
        </div>
      )}

      <div className="flex gap-2">
        {!verdict ? (
          <>
            <button
              type="button"
              onClick={reset}
              disabled={orderedTokens.length === 0}
              className="flex-1 py-2 rounded-lg bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 disabled:opacity-40 text-sm"
            >
              清空重来
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={!allPicked}
              className="flex-1 py-2 rounded-lg bg-violet-500/30 text-violet-50 border border-violet-400/50 hover:bg-violet-500/40 disabled:opacity-40 text-sm font-semibold"
            >
              ✓ 检验 ({orderedTokens.length}/{words.length})
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onNext}
            className="flex-1 py-2 rounded-lg bg-cyan-500/20 text-cyan-100 border border-cyan-400/40 hover:bg-cyan-500/30 text-sm font-semibold"
          >
            下一句 →
          </button>
        )}
      </div>
    </div>
  );
}

// 句子按空格切，保留末尾标点附在最后一个 word 上
function splitSentenceWords(en: string): string[] {
  return en.trim().split(/\s+/);
}

// seeded shuffle，让相同句子打乱模式一致（不依赖 Math.random，每次刷新结果稳定）
function shuffleSeeded<T>(arr: T[], seed: string): T[] {
  let s = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    s = Math.imul(s ^ seed.charCodeAt(i), 16777619) >>> 0;
  }
  const rng = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
