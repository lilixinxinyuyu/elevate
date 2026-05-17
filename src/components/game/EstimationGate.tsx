/**
 * v0.34.99 (iter 33 P0-1): EstimationGate — 多位数计算的元认知前置.
 *
 * 三阶段 (UI 上 Phase 2+3 同屏, GPT 反馈"减少跳转"):
 *   Phase 1: Round  — 把每个数字 round 到 friendly number (整十/百/千)
 *   Phase 2+3: Estimate + Magnitude — 算近似积 + 选数量级 (同屏)
 *   Phase 4: 真题 reveal — onComplete 后 GameShell 展开正常 answer panel
 *
 * 见 src/core/estimationPolicy.ts 的 heuristic / 白名单 / daily cap.
 * 整合 Gemini + GPT 双家 peer review.
 */
import { useEffect, useMemo, useState } from "react";
import type { Question } from "../../core/types";
import {
  ESTIMATION_XP,
  MAGNITUDE_LABEL,
  detectMainOperator,
  extractNumbers,
  generateAcceptableRounds,
  incrementDailyCount,
  isAcceptableRound,
  isComputeConsistent,
  magnitudeBucket,
  magnitudeChoicesAround,
  type MagnitudeBucket,
} from "../../core/estimationPolicy";

export interface EstimationCompleteSignal {
  /** 三阶段累计 XP (4 + 4 + 2 + 2 perfect bonus) */
  estimationXp: number;
  /** Phase 各阶段是否对 */
  roundCorrect: boolean;
  computeCorrect: boolean;
  magnitudeCorrect: boolean;
  /** Telemetry: 用户输入 */
  userRounds: number[];
  userEstimate: number;
  userMagnitude: MagnitudeBucket;
  /** 真答案的实际数量级 — Phase 4 真题 submit 时检 soft nudge */
  actualMagnitude: MagnitudeBucket;
  /** Phase 各阶段用时 (ms) */
  elapsedPerPhase: { round: number; computeAndMagnitude: number };
}

interface Props {
  question: Question;
  onComplete: (signal: EstimationCompleteSignal) => void;
}

export function EstimationGate({ question, onComplete }: Props) {
  const op = detectMainOperator(question.stem);
  const keyNumbers = useMemo(
    () => (question.keyNumbers && question.keyNumbers.length >= 2)
      ? question.keyNumbers.slice(0, 2)
      : extractNumbers(question.stem).slice(0, 2),
    [question.question_id],
  );

  // 容错: 抽不到两个数字 → 直接跳过 gate (避免卡死)
  useEffect(() => {
    if (keyNumbers.length < 2) {
      onComplete({
        estimationXp: 0,
        roundCorrect: false,
        computeCorrect: false,
        magnitudeCorrect: false,
        userRounds: [],
        userEstimate: 0,
        userMagnitude: "ones",
        actualMagnitude: "ones",
        elapsedPerPhase: { round: 0, computeAndMagnitude: 0 },
      });
    }
  }, [keyNumbers.length]);

  const [phase, setPhase] = useState<1 | 2>(1);
  const [phase1Start] = useState(Date.now());
  const [phase2Start, setPhase2Start] = useState<number | null>(null);

  // Phase 1 inputs
  const [roundA, setRoundA] = useState<string>("");
  const [roundB, setRoundB] = useState<string>("");
  const [round1Errs, setRound1Errs] = useState<string>("");

  // Phase 2 inputs
  const [estimate, setEstimate] = useState<string>("");
  const [magBucket, setMagBucket] = useState<MagnitudeBucket | null>(null);
  const [phase2Errs, setPhase2Errs] = useState<string>("");

  function onPhase1Submit() {
    const a = Number(roundA);
    const b = Number(roundB);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      setRound1Errs("请输入两个数字");
      return;
    }
    if (!isAcceptableRound(keyNumbers[0]!, a) || !isAcceptableRound(keyNumbers[1]!, b)) {
      const accA = generateAcceptableRounds(keyNumbers[0]!).join(" / ");
      const accB = generateAcceptableRounds(keyNumbers[1]!).join(" / ");
      setRound1Errs(`想想看 — ${keyNumbers[0]} 看作 ${accA} 之一会好算 ; ${keyNumbers[1]} 看作 ${accB} 之一`);
      return;
    }
    setRound1Errs("");
    setPhase(2);
    setPhase2Start(Date.now());
  }

  function onPhase2Submit() {
    const a = Number(roundA);
    const b = Number(roundB);
    const est = Number(estimate);
    const opSafe = op === "×" || op === "+" ? op : "×";
    if (!isComputeConsistent(a, b, est, opSafe)) {
      const ideal = opSafe === "×" ? a * b : a + b;
      setPhase2Errs(`再算算 — ${a} ${opSafe} ${b} = ${ideal}`);
      return;
    }
    if (!magBucket) {
      setPhase2Errs("选一个数量级 (这答案大约在哪一档?)");
      return;
    }
    const expected = magnitudeBucket(est);
    const magOk = magBucket === expected;
    const allCorrect = magOk; // round 已经 ok (Phase 1 通过), compute 已经 ok (consistent), 只剩 mag
    const xp =
      ESTIMATION_XP.ROUND +
      ESTIMATION_XP.COMPUTE +
      (magOk ? ESTIMATION_XP.MAGNITUDE : 0) +
      (allCorrect ? ESTIMATION_XP.ALL_PERFECT_BONUS : 0);

    // 真答案 magnitude — 用 question.answer.value 算 (number 答案)
    const ansVal = question.answer.type === "number"
      ? (typeof question.answer.value === "number" ? question.answer.value : 0)
      : 0;
    const actualMagnitude = magnitudeBucket(ansVal);

    incrementDailyCount();

    onComplete({
      estimationXp: xp,
      roundCorrect: true,
      computeCorrect: true,
      magnitudeCorrect: magOk,
      userRounds: [a, b],
      userEstimate: est,
      userMagnitude: magBucket,
      actualMagnitude,
      elapsedPerPhase: {
        round: (phase2Start ?? Date.now()) - phase1Start,
        computeAndMagnitude: Date.now() - (phase2Start ?? Date.now()),
      },
    });
  }

  // post-review: 算 actualMagnitude 并 inject 到 magChoices, 保证正确档永远可选
  const actualMagnitude = useMemo<MagnitudeBucket>(() => {
    const ansVal = question.answer.type === "number"
      ? (typeof question.answer.value === "number" ? question.answer.value : 0)
      : 0;
    return magnitudeBucket(ansVal);
  }, [question.question_id]);

  const magChoices = useMemo(() => {
    const est = Number(estimate);
    const seed = !Number.isFinite(est) || est === 0 ? 100 : est;
    return magnitudeChoicesAround(seed, actualMagnitude);
  }, [estimate, actualMagnitude]);

  if (keyNumbers.length < 2) return null; // useEffect will fire onComplete

  return (
    <div className="rounded-2xl border border-indigo-400/40 bg-indigo-500/10 px-4 py-4 space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-indigo-100">
          🧠 估算先 (第 {phase}/2 步)
        </h3>
        <span className="text-[11px] text-indigo-300/80">+{ESTIMATION_XP.ROUND + ESTIMATION_XP.COMPUTE + ESTIMATION_XP.MAGNITUDE + ESTIMATION_XP.ALL_PERFECT_BONUS} XP</span>
      </div>

      <div className="text-sm text-indigo-50/90 bg-slate-900/40 rounded-lg px-3 py-2 font-mono">
        题: {question.stem}
      </div>

      {phase === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-indigo-50">第一步: 把每个数字变成"好算的数" (整十 / 整百 / 整千)</p>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-indigo-100">把 <b>{keyNumbers[0]}</b> 看作</span>
            <input
              type="number"
              inputMode="numeric"
              autoFocus
              value={roundA}
              onChange={(e) => setRoundA(e.target.value)}
              className="w-24 rounded-md px-2 py-1 bg-slate-800 text-indigo-50 border border-indigo-400/30 focus:outline-none focus:border-indigo-300"
              placeholder="?"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-indigo-100">把 <b>{keyNumbers[1]}</b> 看作</span>
            <input
              type="number"
              inputMode="numeric"
              value={roundB}
              onChange={(e) => setRoundB(e.target.value)}
              className="w-24 rounded-md px-2 py-1 bg-slate-800 text-indigo-50 border border-indigo-400/30 focus:outline-none focus:border-indigo-300"
              placeholder="?"
            />
          </div>
          {round1Errs && (
            <p className="text-xs text-amber-200 bg-amber-500/20 rounded px-2 py-1">{round1Errs}</p>
          )}
          <button
            onClick={onPhase1Submit}
            className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-400 transition"
          >
            下一步 →
          </button>
        </div>
      )}

      {phase === 2 && (
        <div className="space-y-3">
          <p className="text-sm text-indigo-50">第二步: 算近似答案 + 选数量级</p>
          <div className="flex items-center gap-2 flex-wrap font-mono">
            <span className="text-indigo-100">{roundA} {op === "+" ? "+" : "×"} {roundB} =</span>
            <input
              type="number"
              inputMode="numeric"
              autoFocus
              value={estimate}
              onChange={(e) => setEstimate(e.target.value)}
              className="w-28 rounded-md px-2 py-1 bg-slate-800 text-indigo-50 border border-indigo-400/30 focus:outline-none focus:border-indigo-300"
              placeholder="?"
            />
          </div>
          {estimate && Number.isFinite(Number(estimate)) && Number(estimate) > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-indigo-200/70">答案大约在哪一档?</p>
              <div className="flex flex-wrap gap-1.5">
                {magChoices.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMagBucket(m)}
                    className={`px-2.5 py-1 rounded-lg text-xs border transition ${
                      magBucket === m
                        ? "bg-indigo-400/40 border-indigo-300 text-indigo-50 font-semibold"
                        : "bg-slate-800 border-indigo-400/30 text-indigo-200 hover:bg-slate-700"
                    }`}
                  >
                    {MAGNITUDE_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {phase2Errs && (
            <p className="text-xs text-amber-200 bg-amber-500/20 rounded px-2 py-1">{phase2Errs}</p>
          )}
          <button
            onClick={onPhase2Submit}
            disabled={!estimate || !magBucket}
            className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-400 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            解锁真答案 →
          </button>
        </div>
      )}
    </div>
  );
}
