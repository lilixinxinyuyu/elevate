/**
 * Fluency Session — 60 秒倒计时单 module 速算训练。
 *
 * 流程：
 *   1. 进入页面 → 3-2-1 倒计时 → 开始
 *   2. 60 秒内不断生成题、点 4 选 1、立刻下一道
 *   3. 时间到 → 跳到 Result 视图（同页）：题数 / 准确率 / p50 / 提速 / 新解锁
 *   4. "再来一次" 重置；"返回" 回 Fluency Home
 *
 * Phase 2 doc: docs/phase2-plan.md (Axis 3)
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { db } from "../db/dexie";
import { getFluencyModule } from "../content/fluencyModules";
import {
  FLUENCY_TROPHY_DEFS,
  finalizeFluencySession,
  recordFluencyAttempt,
  startFluencySession,
} from "../lib/fluencyEngine";
import type { FluencyProblem, FluencySessionResult } from "../core/fluencyTypes";

type Phase = "loading" | "countdown" | "active" | "done";

const SESSION_DURATION_MS = 60_000;

export function FluencySessionPage() {
  const { moduleId = "" } = useParams();
  const module = getFluencyModule(moduleId);

  const [phase, setPhase] = useState<Phase>("loading");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [problem, setProblem] = useState<FluencyProblem | null>(null);
  const [problemShownAt, setProblemShownAt] = useState<number>(0);
  const [countdown, setCountdown] = useState(3); // 3-2-1
  const [remainingMs, setRemainingMs] = useState(SESSION_DURATION_MS);
  const [done, setDone] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lastFlash, setLastFlash] = useState<"ok" | "nope" | null>(null);
  const [result, setResult] = useState<FluencySessionResult | null>(null);

  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<number | null>(null);

  // 学生 + module 加载
  useEffect(() => {
    if (!module) return;
    void (async () => {
      const ss = await db.students.toArray();
      if (!ss[0]) return;
      setStudentId(ss[0].id);
      setSessionId(startFluencySession());
      setPhase("countdown");
    })();
  }, [module]);

  // 倒计时 3-2-1
  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) {
      // 进入 active
      setPhase("active");
      startedAtRef.current = Date.now();
      setProblem(module!.generate());
      setProblemShownAt(Date.now());
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 700);
    return () => window.clearTimeout(t);
  }, [phase, countdown, module]);

  // session 主时钟
  useEffect(() => {
    if (phase !== "active") return;
    tickRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      const left = SESSION_DURATION_MS - elapsed;
      if (left <= 0) {
        setRemainingMs(0);
        if (tickRef.current) window.clearInterval(tickRef.current);
        void finishSession(elapsed);
      } else {
        setRemainingMs(left);
      }
    }, 100);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  async function finishSession(elapsed: number) {
    if (!studentId || !module) return;
    setPhase("done");
    const r = await finalizeFluencySession({
      studentId,
      moduleId: module.id,
      sessionId,
      module,
      durationMs: elapsed,
    });
    setResult(r);
  }

  function onAnswer(value: number) {
    if (phase !== "active" || !problem || !studentId || !module) return;
    const latency = Date.now() - problemShownAt;
    const isCorrect = value === problem.correctAnswer;
    void recordFluencyAttempt({
      studentId,
      moduleId: module.id,
      sessionId,
      problem,
      selectedAnswer: value,
      latencyMs: latency,
    });
    setDone((n) => n + 1);
    if (isCorrect) {
      setCorrect((n) => n + 1);
      setStreak((n) => n + 1);
      setLastFlash("ok");
    } else {
      setStreak(0);
      setLastFlash("nope");
    }
    setProblem(module.generate());
    setProblemShownAt(Date.now());
    window.setTimeout(() => setLastFlash(null), 200);
  }

  // v0.31.86: hooks 必须在所有 early-return 之前调用，否则模块不存在分支命中后
  // 下一次 render 顺序会变。useMemo 提前到 early-return 之前。
  const optionPool = useMemo(() => {
    if (!problem) return [] as number[];
    return shuffle([problem.correctAnswer, ...problem.distractors]);
  }, [problem]);

  if (!module) {
    return (
      <div className="text-center py-20">
        <div className="text-slate-300">模块不存在。</div>
        <Link to="../fluency" className="text-violet-300 underline">
          返回口算营
        </Link>
      </div>
    );
  }

  if (phase === "loading") {
    return <div className="text-slate-400 text-center py-20">加载中…</div>;
  }

  if (phase === "countdown") {
    return (
      <div
        className={`flex flex-col items-center justify-center min-h-[60vh] gap-4 bg-gradient-to-br ${module.themeColor} rounded-3xl text-white py-10`}
      >
        <div className="text-3xl font-display">{module.name}</div>
        <div className="text-7xl font-display font-bold animate-pulse">
          {countdown > 0 ? countdown : "GO!"}
        </div>
        <div className="text-sm opacity-80">60 秒，看你能答对多少题</div>
      </div>
    );
  }

  if (phase === "done" && result) {
    return <FluencyResult moduleName={module.name} moduleId={module.id} result={result} />;
  }

  // active
  const seconds = Math.ceil(remainingMs / 1000);
  const accuracy = done > 0 ? Math.round((correct / done) * 100) : 0;
  return (
    <div className="space-y-4">
      {/* 顶部进度条 */}
      <div className="flex items-center justify-between text-xs text-slate-300">
        <span>{module.name}</span>
        <span className="tabular-nums">已答 {done} · 对 {correct} ({accuracy}%) · 连 {streak}</span>
      </div>
      <div className="h-2 rounded-full bg-black/30 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-amber-300 via-pink-300 to-violet-300 transition-[width] duration-100"
          style={{ width: `${(remainingMs / SESSION_DURATION_MS) * 100}%` }}
        />
      </div>

      {/* 题目 */}
      <div
        className={`relative rounded-3xl py-12 px-6 text-center bg-gradient-to-br ${module.themeColor} text-white shadow-glow ${
          lastFlash === "ok"
            ? "ring-4 ring-emerald-300/50"
            : lastFlash === "nope"
              ? "ring-4 ring-rose-400/60"
              : ""
        }`}
      >
        <div className="absolute top-3 right-4 text-xs opacity-80 tabular-nums">
          {seconds}s
        </div>
        <div className="text-6xl font-display font-bold tracking-wide tabular-nums">
          {problem?.stem ?? "…"}
        </div>
      </div>

      {/* 4 选 */}
      <div className="grid grid-cols-2 gap-3">
        {optionPool.map((opt) => (
          <button
            type="button"
            key={`${opt}-${problem?.key ?? ""}`}
            onClick={() => onAnswer(opt)}
            className="rounded-2xl py-6 text-3xl font-display font-bold bg-ink-800 border border-ink-700 hover:bg-ink-700 active:scale-95 transition-all tabular-nums"
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

function FluencyResult({
  moduleName,
  moduleId,
  result,
}: {
  moduleName: string;
  moduleId: string;
  result: FluencySessionResult;
}) {
  const accuracy =
    result.totalAttempts > 0
      ? Math.round((result.totalCorrect / result.totalAttempts) * 100)
      : 0;
  const p50sec = result.p50LatencyMs > 0 ? (result.p50LatencyMs / 1000).toFixed(1) : "—";
  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-violet-500 to-pink-500 text-white p-6">
        <div className="text-sm opacity-80">{moduleName} · 一局结束</div>
        <div className="mt-2 flex items-baseline gap-3">
          <div className="text-6xl font-display font-bold tabular-nums">{result.totalAttempts}</div>
          <div className="text-base">题</div>
          <div className="text-2xl font-display tabular-nums">· 对 {result.totalCorrect}</div>
        </div>
        <div className="mt-1 text-sm opacity-90">
          准确 {accuracy}% · 中位 {p50sec}s · 最长连击 {result.longestStreak}
          {result.speedDeltaMs != null && (
            <span className={`ml-2 ${result.speedDeltaMs > 0 ? "text-emerald-200" : "text-rose-200"}`}>
              {result.speedDeltaMs > 0
                ? `▲ 提速 ${(result.speedDeltaMs / 1000).toFixed(2)}s`
                : `▼ 慢了 ${(Math.abs(result.speedDeltaMs) / 1000).toFixed(2)}s`}
            </span>
          )}
        </div>
      </div>

      {result.newlyMastered && (
        <div className="rounded-2xl border-2 border-amber-400/60 bg-amber-500/10 p-4 text-amber-100 text-center">
          🏆 通关「{moduleName}」！准 + 速 双指标达成。
        </div>
      )}

      {result.unlockedTrophies.length > 0 && (
        <div className="rounded-2xl border border-violet-400/50 bg-violet-500/10 p-4">
          <div className="text-sm font-bold text-violet-100 mb-2">✨ 解锁了：</div>
          <div className="flex flex-wrap gap-2 text-xs text-violet-200">
            {result.unlockedTrophies.map((id) => {
              const meta = FLUENCY_TROPHY_DEFS.find((t) => t.id === id);
              const label = meta ? `${meta.icon} ${meta.name}` : id;
              return (
                <span
                  key={id}
                  className="px-2 py-1 rounded-full bg-violet-500/20"
                  title={meta?.description}
                >
                  {label}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Link
          to={`../fluency/${moduleId}`}
          replace
          reloadDocument
          className="flex-1 btn-primary text-center text-sm"
        >
          🔁 再来一次
        </Link>
        <Link to="../fluency" className="flex-1 btn-ghost text-center text-sm border border-ink-700">
          返回口算营
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}
