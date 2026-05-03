/**
 * 语文训练页 — Phase 2.x（v0.20.0）：接入 mini-service。
 *
 * 升级点（相对 v0.19.0 简化版）：
 *  - 答完一题调 submitChineseAttempt：写 attempt + 更新 mastery + 加 XP + 检查 trophy
 *  - 显示连击次数 / 单题 +XP 抖动 / mastery from→to
 *  - 完成时调 recordChineseSessionFinish + 显示新解锁勋章
 *  - 听写题 ▶ 播放，TTS 错误 surface 到 UI
 *  - 默认随机抽 10 题，?unitId / ?skillId 过滤，?fresh 强制重生
 */

import { Link, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { db } from "../../db/dexie";
import { useSubject } from "../../subjects/context";
import { speakText } from "../../lib/tts";
import {
  createChineseSessionId,
  recordChineseSessionFinish,
  submitChineseAttempt,
  type ChineseAttemptResult,
} from "../../subjects/chinese/service";
import { CHINESE_TROPHIES } from "../../subjects/chinese/trophies";
import type { Question } from "../../core/types";

const SESSION_SIZE = 10;

function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i]!, out[j]!] = [out[j]!, out[i]!];
  }
  return out;
}

interface AnswerRecord {
  qid: string;
  chosen: string;
  correct: boolean;
  points: number;
  comboAfter: number;
}

export function ChineseTrainPage() {
  const subject = useSubject();
  const [params] = useSearchParams();
  const unitId = params.get("unitId");
  const skillId = params.get("skillId");
  const fresh = params.get("fresh");
  const student = useLiveQuery(async () => (await db.students.toArray())[0]);

  const questions = useMemo<Question[]>(() => {
    let pool = subject.seedQuestions;
    if (skillId) pool = pool.filter((q) => q.skill_id === skillId);
    else if (unitId) pool = pool.filter((q) => q.unit_id === unitId);
    return shuffle(pool).slice(0, SESSION_SIZE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.id, unitId, skillId, fresh]);

  // 一组训练一个 sessionId（写入 attempts 时用）
  const [sessionId] = useState(() => createChineseSessionId());

  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [optionOrder, setOptionOrder] = useState<number[]>([]);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [comboBefore, setComboBefore] = useState(0);
  const [lastResult, setLastResult] = useState<ChineseAttemptResult | null>(null);
  const [audioState, setAudioState] = useState<"idle" | "playing" | "error">("idle");
  const [audioError, setAudioError] = useState<string | null>(null);
  const [questionStartAt, setQuestionStartAt] = useState<number>(Date.now());

  const q = questions[idx];

  // 进新题：洗选项 / 清状态 / 重置 startAt
  useEffect(() => {
    if (!q) return;
    const n = q.options?.length ?? 0;
    const order = Array.from({ length: n }, (_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i]!, order[j]!] = [order[j]!, order[i]!];
    }
    setOptionOrder(order);
    setChosen(null);
    setRevealed(false);
    setLastResult(null);
    setAudioState("idle");
    setAudioError(null);
    setQuestionStartAt(Date.now());
  }, [q?.question_id]);

  // 完成时调 recordChineseSessionFinish
  const allDone = idx >= questions.length;
  useEffect(() => {
    if (!allDone || !student?.id || answers.length === 0) return;
    const correct = answers.filter((a) => a.correct).length;
    const xp = answers.reduce((s, a) => s + a.points, 0);
    void recordChineseSessionFinish({
      studentId: student.id,
      sessionId,
      total: answers.length,
      correct,
      xpGained: xp,
    });
  }, [allDone, student?.id, sessionId, answers]);

  if (questions.length === 0) {
    return (
      <div className="card text-center">
        <div className="text-3xl mb-2">📭</div>
        <div className="font-semibold mb-1">这个范围还没题</div>
        <Link to="/chinese" className="btn-primary inline-block mt-3">回首页</Link>
      </div>
    );
  }

  if (allDone) {
    const correctCount = answers.filter((a) => a.correct).length;
    const accuracy = Math.round((correctCount / answers.length) * 100);
    const totalXp = answers.reduce((s, a) => s + a.points, 0);
    const maxCombo = answers.reduce((m, a) => Math.max(m, a.comboAfter), 0);
    return (
      <div className="card-glow text-center space-y-4">
        <div className="text-5xl">🎉</div>
        <div className="font-display font-bold text-2xl text-brand">完成！</div>
        <div className="grid grid-cols-3 gap-3 text-center pt-2">
          <div>
            <div className="text-xs text-slate-400">正确率</div>
            <div className={`text-2xl font-bold ${
              accuracy >= 80 ? "text-emerald-300" : accuracy >= 60 ? "text-amber-300" : "text-rose-300"
            }`}>
              {accuracy}%
            </div>
            <div className="text-[11px] text-slate-500">{correctCount}/{answers.length}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">本组 XP</div>
            <div className="text-2xl font-bold text-violet-300">+{totalXp}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">最高连击</div>
            <div className="text-2xl font-bold text-amber-300">×{maxCombo}</div>
          </div>
        </div>
        <div className="text-xs text-slate-400 pt-2">
          {accuracy >= 90
            ? "几乎全对！期中没问题。"
            : accuracy >= 75
              ? "已经很稳了，再练 1-2 组到 90%+。"
              : accuracy >= 50
                ? "中等偏好，多回头看看错的题。"
                : "重点复习一下错题，再来一组。"}
        </div>
        <div className="flex justify-center gap-3 pt-2">
          <Link
            to={`/chinese/train?fresh=${Date.now()}${unitId ? `&unitId=${unitId}` : ""}${skillId ? `&skillId=${skillId}` : ""}`}
            className="btn-primary"
          >
            再来一组
          </Link>
          <Link to="/chinese" className="btn-secondary">回首页</Link>
        </div>
      </div>
    );
  }

  if (!q || !q.options) return null;

  const isDictation = !!q.audio_text;
  const correctOptionId = (q.answer as { type: "choice"; value: string }).value;

  const handleChoose = async (oid: string) => {
    if (revealed || !student?.id) return;
    setChosen(oid);
    setRevealed(true);
    const isCorrect = oid === correctOptionId;
    const elapsedSeconds = Math.max(1, Math.round((Date.now() - questionStartAt) / 1000));
    try {
      const result = await submitChineseAttempt({
        studentId: student.id,
        sessionId,
        question: q,
        isCorrect,
        chosenOptionId: oid,
        elapsedSeconds,
        comboBefore,
      });
      setLastResult(result);
      setComboBefore(result.comboAfter);
      setAnswers((prev) => [
        ...prev,
        {
          qid: q.question_id,
          chosen: oid,
          correct: isCorrect,
          points: result.points,
          comboAfter: result.comboAfter,
        },
      ]);
    } catch (e) {
      // service 写库失败也得让用户继续答题
      console.error("[chinese-train] submit failed", e);
      setComboBefore(isCorrect ? comboBefore + 1 : 0);
      setAnswers((prev) => [
        ...prev,
        { qid: q.question_id, chosen: oid, correct: isCorrect, points: 0, comboAfter: isCorrect ? comboBefore + 1 : 0 },
      ]);
    }
  };

  const handleNext = () => setIdx((i) => i + 1);

  const handlePlayAudio = async () => {
    if (!q.audio_text) return;
    setAudioState("playing");
    setAudioError(null);
    try {
      const audio = await speakText(q.audio_text);
      audio.addEventListener("ended", () => setAudioState("idle"));
    } catch (e) {
      setAudioState("error");
      setAudioError(e instanceof Error ? e.message : String(e));
    }
  };

  const trophyDefById = new Map(CHINESE_TROPHIES.map((t) => [t.id, t]));

  return (
    <div className="space-y-4">
      {/* 进度 + 当前连击 + 累计 XP */}
      <div className="flex items-center gap-3">
        <div className="text-xs text-slate-400 shrink-0">
          {idx + 1} / {questions.length}
        </div>
        <div className="flex-1 h-1.5 rounded-full bg-ink-700/60 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-rose-400 transition-all"
            style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
          />
        </div>
        {comboBefore >= 2 && (
          <div className="chip bg-amber-500/20 text-amber-200 border border-amber-400/40 text-xs">
            🔥 ×{comboBefore}
          </div>
        )}
        <div className="text-xs text-slate-500 shrink-0">难度 {q.difficulty}</div>
      </div>

      {/* 听写题 ▶ 播放 */}
      {isDictation && (
        <div className="card bg-amber-500/10 border border-amber-400/30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-rose-400 text-white text-2xl flex items-center justify-center shadow-glow shrink-0 hover:scale-105 transition-transform disabled:opacity-50"
              onClick={handlePlayAudio}
              disabled={audioState === "playing"}
              aria-label="播放朗读"
            >
              {audioState === "playing" ? "⋯" : "▶"}
            </button>
            <div className="flex-1">
              <div className="font-semibold">点 ▶ 听小进读这个词</div>
              <div className="text-xs text-slate-400 mt-1">
                可以重复点（点几次都行），听准了再选答案
              </div>
            </div>
          </div>
          {audioState === "error" && audioError && (
            <div className="mt-3 text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded p-2 break-all">
              🔇 朗读失败：{audioError}
            </div>
          )}
        </div>
      )}

      {/* 题面 */}
      <div className="card-glow">
        <div className="font-display font-bold text-lg leading-relaxed">{q.stem}</div>
      </div>

      {/* 选项 */}
      <div className="grid grid-cols-1 gap-2">
        {optionOrder.map((origIdx, displayIdx) => {
          const o = q.options![origIdx]!;
          const isCorrect = o.id === correctOptionId;
          const isChosen = o.id === chosen;
          let cls = "card text-left flex items-center gap-3 hover:bg-ink-700/60 transition-colors";
          if (revealed) {
            if (isCorrect) cls += " bg-emerald-500/15 border-emerald-400/40 ring-1 ring-emerald-400/30";
            else if (isChosen) cls += " bg-rose-500/15 border-rose-400/40";
            else cls += " opacity-60";
          }
          const label = String.fromCharCode("A".charCodeAt(0) + displayIdx);
          return (
            <button
              type="button"
              key={o.id}
              disabled={revealed}
              onClick={() => handleChoose(o.id)}
              className={cls}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold shrink-0 ${
                  revealed && isCorrect
                    ? "bg-emerald-500/30 text-emerald-100"
                    : revealed && isChosen
                      ? "bg-rose-500/30 text-rose-100"
                      : "bg-ink-700/80 text-slate-300"
                }`}
              >
                {label}
              </div>
              <div className="flex-1 text-base">{o.text}</div>
              {revealed && isCorrect && <div className="text-emerald-300 text-xl">✓</div>}
              {revealed && isChosen && !isCorrect && <div className="text-rose-300 text-xl">✗</div>}
            </button>
          );
        })}
      </div>

      {/* 反馈 */}
      {revealed && (
        <div className="space-y-3">
          <div
            className={`card text-sm ${
              chosen === correctOptionId
                ? "bg-emerald-500/10 border-emerald-400/30 text-emerald-100"
                : "bg-rose-500/10 border-rose-400/30 text-rose-100"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold">
                {chosen === correctOptionId ? "✓ 答对了" : "✗ 再想一想"}
              </div>
              {lastResult && lastResult.points > 0 && (
                <div className="chip bg-violet-500/20 text-violet-200 border border-violet-400/40 text-xs animate-pulse">
                  +{lastResult.points} XP
                </div>
              )}
            </div>
            <div className="text-xs leading-relaxed text-slate-200/90 mt-1">
              {chosen === correctOptionId ? q.feedback_correct : q.feedback_wrong}
            </div>
            {q.solution_steps && q.solution_steps.length > 0 && (
              <div className="text-[11px] mt-2 text-slate-300/80 leading-relaxed">
                💡 {q.solution_steps[0]}
              </div>
            )}
            {lastResult && lastResult.masteryFrom !== lastResult.masteryTo && (
              <div className="text-[11px] mt-2 text-slate-400">
                {q.skill_name ?? q.skill_id} 掌握度：{lastResult.masteryFrom} →{" "}
                <span className={lastResult.masteryTo > lastResult.masteryFrom ? "text-emerald-300" : "text-rose-300"}>
                  {lastResult.masteryTo}
                </span>
              </div>
            )}
          </div>

          {/* 新解锁勋章 */}
          {lastResult?.newTrophyIds && lastResult.newTrophyIds.length > 0 && (
            <div className="card bg-gradient-to-br from-amber-500/15 to-rose-500/15 border border-amber-400/40 text-center animate-slide-up">
              <div className="text-xs text-amber-200 mb-1">🎖️ 新解锁勋章</div>
              <div className="flex justify-center gap-3 flex-wrap">
                {lastResult.newTrophyIds.map((tid) => {
                  const def = trophyDefById.get(tid);
                  if (!def) return null;
                  return (
                    <div key={tid} className="flex items-center gap-2 px-3 py-1.5 bg-ink-900/40 rounded-lg">
                      <div className="text-2xl">{def.icon}</div>
                      <div className="text-left">
                        <div className="text-sm font-bold text-amber-100">{def.name}</div>
                        <div className="text-[10px] text-slate-300">{def.description}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button type="button" onClick={handleNext} className="btn-primary">
              {idx + 1 < questions.length ? "下一题 →" : "查看结果 →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
