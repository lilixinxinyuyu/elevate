/**
 * v0.35.3 (iter 37 P1-2): 强化挑战 mini-session 主页面.
 *
 * 流程:
 *   1. 路由 query 带 skill_id + difficulty + excludeQuestionId
 *   2. 加载: requestStrengthenSet 并发取 3 题
 *   3. 渲染: 跟主 GameShell 一样的 UI, 但 wrapped in quiet mode (suppress estimation/scratch gate)
 *   4. 完成后总结 + 给 bonus + 回原 train flow
 *
 * 评审共识:
 *   - quiet mode: 强化 session 内不弹 estimation/scratch (UX 太重)
 *   - bonus idempotent: markStrengthenBonusAwarded
 *   - abandon graceful: 中途退出 attempt 已计分
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { requestStrengthenSet } from "../lib/sessionAdaptive";
import { submitAttempt, getOrCreateSession } from "../db/service";
import { GameShell, type AttemptResult } from "../components/game/GameShell";
import { MascotQuickAccess } from "../components/MascotQuickAccess";
import {
  STRENGTHEN_SESSION_SIZE,
  calcStrengthenBonus,
  isStrengthenBonusAlreadyAwarded,
  markStrengthenBonusAwarded,
  strengthenSummaryMessage,
} from "../core/strengthenPolicy";
import type { Question, DailySession } from "../core/types";

export function StrengthenPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const skillId = params.get("skill") ?? "";
  const difficulty = Number(params.get("diff") ?? "3");
  const excludeQuestionId = params.get("exclude") ?? "";
  const count = Number(params.get("count") ?? String(STRENGTHEN_SESSION_SIZE));

  // 学生 + session
  const studentId = useLiveQuery(async () => {
    const s = await db.students.toCollection().first();
    return s?.id ?? null;
  }, []);

  const [session, setSession] = useState<DailySession | null>(null);
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<boolean[]>([]);
  const [loadError, setLoadError] = useState<string>("");
  const [xp, setXp] = useState(0);
  const [combo, setCombo] = useState(0);
  const [done, setDone] = useState(false);
  // Track last attempt id - we'll bump its scoreDelta with bonus on finish
  const [lastAttemptId, setLastAttemptId] = useState<string | null>(null);

  // session id (一次 strengthen session 唯一 — 用于 bonus idempotent)
  const sessionId = useMemo(() => `str-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, []);

  // 加载 origin question + 生成 N 道变式
  useEffect(() => {
    if (!studentId || !skillId || !excludeQuestionId) {
      setLoadError("缺少参数, 无法启动");
      return;
    }
    (async () => {
      try {
        // 取原题
        const origin = await db.questions.get(excludeQuestionId);
        if (!origin) {
          setLoadError("原题不存在, 无法生成强化题");
          return;
        }
        const ss = await getOrCreateSession(studentId);
        setSession(ss.session);
        // 拿 N 道变式
        const variants = await requestStrengthenSet(origin, count);
        if (variants.length === 0) {
          setLoadError("生成变式失败, 请稍后再试");
          return;
        }
        setQuestions(variants);
      } catch (e) {
        setLoadError(`加载失败: ${(e as Error).message}`);
      }
    })();
  }, [studentId, skillId, excludeQuestionId, count]);

  async function onSubmitOne(result: AttemptResult, currentQuestion?: Question): Promise<{ points: number }> {
    if (!session || !studentId) return { points: 0 };
    const q = currentQuestion ?? questions?.[idx];
    if (!q) return { points: 0 };
    const outcome = await submitAttempt({
      studentId,
      session,
      question: q,
      userAnswer: result.answer,
      isCorrect: result.isCorrect,
      partialCorrect: result.partialCorrect,
      matchedErrorTags: result.matchedErrorTags,
      hintsOpened: result.hintsOpened,
      elapsedSeconds: result.elapsedSeconds,
      comboBeforeAttempt: combo,
      usedTutor: result.usedTutor,
      attemptOrdinal: result.attemptOrdinal,
    });
    setXp((x) => x + outcome.points);
    setCombo(outcome.comboAfter);
    setLastAttemptId(outcome.attempt.id);
    setResults((rs) => {
      const newRs = [...rs];
      newRs[idx] = result.isCorrect;
      return newRs;
    });
    return { points: outcome.points };
  }

  function onNext() {
    if (!questions) return;
    if (idx >= questions.length - 1) {
      // 最后一题完成 → 总结
      void finishSession();
    } else {
      setIdx(idx + 1);
    }
  }

  async function finishSession() {
    if (done) return;
    const correctCount = results.filter(Boolean).length;
    const bonus = calcStrengthenBonus(correctCount);

    if (bonus > 0 && lastAttemptId && !isStrengthenBonusAlreadyAwarded(sessionId)) {
      // 真正发 bonus: 把 bonus 加到最后一道 attempt 的 scoreDelta.total
      // 这样 getTotalXp (sum attempt scoreDelta.total) 自动算入
      // 同时 metadata 记下 strengthen session id (评审 B: 让数据可分析)
      try {
        const last = await db.attempts.get(lastAttemptId);
        if (last) {
          const updated = {
            ...last,
            scoreDelta: { ...last.scoreDelta, total: last.scoreDelta.total + bonus },
            metadata: {
              ...(last.metadata ?? {}),
              strengthenBonus: bonus,
              strengthenSessionId: sessionId,
              strengthenCorrectCount: correctCount,
              strengthenTotalQuestions: questions?.length ?? 0,
            },
          };
          await db.attempts.put(updated);
          markStrengthenBonusAwarded(sessionId);
        }
      } catch (e) {
        console.warn("[strengthen] bonus persist failed:", e);
      }
    }
    setDone(true);
  }

  function onAbandon() {
    // 中途退出: 已答题正常计分 (submitAttempt 已落库), 不发 bonus
    navigate(-1);
  }

  if (loadError) {
    return (
      <div className="max-w-md mx-auto p-4 space-y-3">
        <h1 className="text-lg font-bold text-rose-100">💪 强化挑战</h1>
        <p className="text-sm text-rose-200">{loadError}</p>
        <button onClick={() => navigate(-1)} className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-sm">返回</button>
      </div>
    );
  }

  if (!questions) {
    return (
      <div className="max-w-md mx-auto p-4 space-y-3">
        <h1 className="text-lg font-bold text-amber-100">💪 准备强化挑战中...</h1>
        <p className="text-sm text-amber-200/80">正在出 {count} 道同型题, 请稍等几秒...</p>
      </div>
    );
  }

  if (done) {
    const correctCount = results.filter(Boolean).length;
    const bonus = calcStrengthenBonus(correctCount);
    return (
      <div className="max-w-md mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-bold text-emerald-100 text-center">强化挑战完成!</h1>
        <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/40 p-4 space-y-2">
          <p className="text-emerald-100 text-lg font-semibold">{strengthenSummaryMessage(correctCount)}</p>
          <p className="text-sm text-emerald-50">答对: {correctCount}/{questions.length}</p>
          <p className="text-sm text-emerald-50">本题得 XP: +{xp}</p>
          {bonus > 0 && (
            <p className="text-base text-amber-100 font-bold">🎁 强化 bonus: +{bonus} XP</p>
          )}
        </div>
        <button onClick={() => navigate(-1)} className="w-full px-4 py-2 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-400">
          回到主练习
        </button>
      </div>
    );
  }

  const currentQ = questions[idx];
  if (!currentQ) return null;

  return (
    <div className="max-w-md mx-auto p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-base font-bold text-amber-100">💪 强化挑战 ({idx + 1}/{questions.length})</h1>
        <button onClick={onAbandon} className="text-xs text-slate-400 underline hover:text-slate-200">退出</button>
      </div>
      {/* GameShell 渲染当前题. quiet mode 通过 examMode-ish props 控制 - 这里复用 noRetry 实现简化 (不弹 retry/strengthen 嵌套) */}
      <GameShell
        question={currentQ}
        index={idx}
        total={questions.length}
        xp={xp}
        combo={combo}
        onSubmit={onSubmitOne}
        onNext={onNext}
        countdownEnabled={false}
        noRetry={true}
      />
      <MascotQuickAccess context="strengthen" />
    </div>
  );
}

export default StrengthenPage;
