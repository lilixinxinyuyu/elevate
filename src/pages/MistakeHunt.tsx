/**
 * v0.35.2 (iter 36 P1-1): 改错挑战 — 主页面.
 *
 * Selena 43% master plan P1-1. 5 题 session: 找出每道题"第一处错的地方".
 * 跟小学数学课本"改错题"对齐.
 *
 * 流程:
 *   1. 加载时生成 5 题 (3 vertical + 2 unit_conversion, 随机顺序)
 *   2. 每题: 显示卡片 + N 个可点行 + 提示按钮 + 跳过按钮
 *   3. 点对 → 命中反馈 (划掉错的, 绿字标正解, +N XP floater) → 自动下一题
 *   4. 点错 → shake + 提示 "再看看, 这一行没问题" (本题 XP 上限降到 +10)
 *   5. 跳过 → 直接下一题, 本题 0 分
 *   6. 完成 5 题 → 总结页 (正确率 + 总 XP + "再来 5 题" 按钮)
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { uid } from "../lib/format";
import {
  generateSession,
  calcXp,
  type BugCard,
} from "../core/mistakeHuntPolicy";
import { MascotQuickAccess } from "../components/MascotQuickAccess";

interface QuestionState {
  attempts: number;
  hintUsed: boolean;
  solved: boolean;
  skipped: boolean;
  earnedXp: number;
}

export default function MistakeHuntPage() {
  const navigate = useNavigate();
  const [sessionSeed, setSessionSeed] = useState(() => Date.now());
  const cards = useMemo(() => generateSession(seededRng(sessionSeed)), [sessionSeed]);
  // v0.35.5 iter 39: 落库到 db.attempts (source=mistake_hunt 标 mini-game, 不污染 mastery)
  // 用 useLiveQuery 拿 student
  const studentId = useLiveQuery(async () => (await db.students.toCollection().first())?.id ?? null, []) ?? null;
  const mhSessionId = useMemo(() => `mh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, []);

  // 落 attempt 的 helper (调用 db.attempts.put 异步)
  async function persistAttempt(card: BugCard, idx: number, state: QuestionState) {
    if (!studentId) return;
    try {
      await db.attempts.put({
        id: uid("mh-"),
        studentId,
        subjectId: "math",
        questionId: `mh-${mhSessionId}-${idx}`,
        skillId: `virtual/mistake_hunt_${card.kind}`, // virtual/ 前缀防 SkillPicker 误展示
        sessionId: undefined,
        answer: { picked: state.solved ? card.buggyLineIdx : -1 },
        isCorrect: state.solved,
        partialCorrect: false,
        hintsOpened: state.hintUsed ? 1 : 0,
        elapsedSeconds: 0,
        errorTags: state.solved ? [] : [`mh_miss_${card.bugType}`],
        scoreDelta: { total: state.earnedXp, byAbility: {} },
        masteryDelta: 0,
        isReview: false,
        comboAtEnd: 0,
        metadata: {
          source: "mistake_hunt",
          mhSessionId,
          bugType: card.bugType,
          attempts: state.attempts,
          hintUsed: state.hintUsed,
          cardKind: card.kind,
        },
        createdAt: Date.now(),
      });
    } catch (e) {
      console.warn("[MistakeHunt] persistAttempt failed:", e);
    }
  }
  const [idx, setIdx] = useState(0);
  const [states, setStates] = useState<QuestionState[]>(() =>
    cards.map(() => ({ attempts: 0, hintUsed: false, solved: false, skipped: false, earnedXp: 0 }))
  );
  const [showHint, setShowHint] = useState(false);
  const [lastWrongIdx, setLastWrongIdx] = useState<number | null>(null);
  const [shake, setShake] = useState(false);
  const [reveal, setReveal] = useState(false);

  const card = cards[idx];
  const state = states[idx];

  if (!card || !state) return null;

  const sessionDone = idx >= cards.length - 1 && (state.solved || state.skipped);

  function onPickLine(lineIdx: number) {
    if (reveal || !card || !state) return;
    const newAttempts = state.attempts + 1;

    if (lineIdx === card.buggyLineIdx) {
      // 命中
      const earned = calcXp(newAttempts, state.hintUsed);
      const finalState = { ...state, attempts: newAttempts, solved: true, earnedXp: earned };
      setStates((prev) => {
        const next = [...prev];
        next[idx] = finalState;
        return next;
      });
      setReveal(true);
      // v0.35.5 iter 39: 落库
      void persistAttempt(card, idx, finalState);
      // 2.5s 后下一题
      setTimeout(() => {
        if (idx < cards.length - 1) {
          setIdx(idx + 1);
          setReveal(false);
          setShowHint(false);
          setLastWrongIdx(null);
        }
      }, 2500);
    } else {
      // 错点
      setStates((prev) => {
        const next = [...prev];
        next[idx] = { ...state, attempts: newAttempts };
        return next;
      });
      setLastWrongIdx(lineIdx);
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  }

  function onUseHint() {
    if (!state) return;
    setShowHint(true);
    setStates((prev) => {
      const next = [...prev];
      next[idx] = { ...state, hintUsed: true };
      return next;
    });
  }

  function onSkip() {
    if (!state || !card) return;
    const finalState = { ...state, skipped: true, earnedXp: 0 };
    setStates((prev) => {
      const next = [...prev];
      next[idx] = finalState;
      return next;
    });
    // v0.35.5 iter 39: 跳过也落库 (但 isCorrect=false + earnedXp=0)
    void persistAttempt(card, idx, finalState);
    if (idx < cards.length - 1) {
      setIdx(idx + 1);
      setReveal(false);
      setShowHint(false);
      setLastWrongIdx(null);
    } else {
      // 最后一题跳过 → 直接进总结
      setIdx(idx);
    }
  }

  function onRestart() {
    setSessionSeed(Date.now());
    setIdx(0);
    setStates(cards.map(() => ({ attempts: 0, hintUsed: false, solved: false, skipped: false, earnedXp: 0 })));
    setShowHint(false);
    setLastWrongIdx(null);
    setReveal(false);
  }

  const totalSolved = states.filter((s) => s.solved).length;
  const totalXp = states.reduce((sum, s) => sum + s.earnedXp, 0);

  if (sessionDone) {
    return (
      <div className="max-w-md mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-bold text-emerald-100 text-center">🎉 错题侦探完成!</h1>
        <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/40 p-4 space-y-2">
          <p className="text-emerald-100">命中: {totalSolved}/{cards.length}</p>
          <p className="text-emerald-100">总 XP: +{totalXp}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onRestart} className="flex-1 px-4 py-2 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-400">
            再来 5 题
          </button>
          <button onClick={() => navigate(-1)} className="flex-1 px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600">
            返回
          </button>
        </div>
        <MascotQuickAccess context="find_mistakes" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-cyan-100">🕵️ 错题侦探 ({idx + 1}/{cards.length})</h1>
        <span className="text-xs text-cyan-200/70">已得 +{totalXp} XP</span>
      </div>

      <div className="text-sm text-cyan-100 bg-slate-900/40 rounded-lg px-3 py-2">
        {card.expression}
      </div>

      <div className={`rounded-xl border border-amber-400/40 bg-amber-500/5 p-3 font-mono text-sm whitespace-pre ${shake ? "animate-shake" : ""}`}>
        {card.lines.map((line, i) => {
          const isBuggy = i === card.buggyLineIdx && reveal;
          const isWrongPick = i === lastWrongIdx && !reveal;
          return (
            <button
              key={i}
              onClick={() => onPickLine(i)}
              disabled={reveal}
              className={`block w-full text-left px-2 py-1 rounded my-0.5 transition ${
                isBuggy ? "bg-emerald-500/40 text-emerald-50 line-through" :
                isWrongPick ? "bg-rose-500/20 text-rose-200" :
                reveal ? "text-amber-100/50" :
                "text-amber-100 hover:bg-amber-400/15"
              }`}
            >
              {line}
            </button>
          );
        })}
      </div>

      {reveal && (
        <div className="rounded-lg bg-emerald-500/15 border border-emerald-400/40 px-3 py-2 space-y-1">
          <p className="text-emerald-100 font-semibold">✓ 找到了! +{state.earnedXp} XP</p>
          <p className="text-sm text-emerald-50/90">{card.explanation}</p>
          <p className="text-xs text-emerald-200/70">正解: {card.correctText}</p>
        </div>
      )}

      {showHint && !reveal && (
        <p className="text-xs text-amber-200/80 bg-amber-500/15 rounded px-2 py-1">💡 {card.hint}</p>
      )}

      {!reveal && (
        <div className="flex gap-2">
          <button onClick={onUseHint} disabled={showHint} className="px-3 py-1.5 rounded-lg bg-slate-800 text-amber-200 text-sm border border-amber-400/30 hover:bg-slate-700 disabled:opacity-50">
            💡 提示 (-2 XP)
          </button>
          <button onClick={onSkip} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-sm border border-slate-500/30 hover:bg-slate-700">
            跳过
          </button>
          <button onClick={() => navigate(-1)} className="ml-auto px-3 py-1.5 rounded-lg bg-slate-800 text-slate-400 text-sm hover:bg-slate-700">
            退出
          </button>
        </div>
      )}
      <MascotQuickAccess context="find_mistakes" />
    </div>
  );
}

/** 简单 seeded RNG (跟 mistakeHuntPolicy 的 seededRng 形式一致) */
function seededRng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
