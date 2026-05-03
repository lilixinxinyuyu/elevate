/**
 * 语文训练页 — Phase 2 MVP 简化版。
 *
 * 设计取舍：
 *  - 不接 GameShell（math 的 12 模板 + 错题复活 + trophy 整套），手写一个简单的
 *    "看题 → 选答案 → 反馈 → 下一题"循环
 *  - 题来自 subject.seedQuestions，按 unitId / skillId 过滤（URL 参数）
 *  - 听写题（audio_text 存在）顶上显示 ▶ 播放按钮，点了调 speakText
 *  - 完成后简单 summary：对了几道 / 错了几道
 *  - **不写入 attempts 表**（chinese 暂不接 mastery 体系，期中后再做）
 *
 * URL 参数：
 *   ?unitId=C4B_U1_NATURE         只出该单元的题
 *   ?skillId=C4B_U1_PINYIN        只出该技能的题
 *   ?fresh=12345                  时间戳，用来强制 useEffect 重跑（每次进重洗一组）
 *   默认（无参数）= 跨单元随机抽 10 题
 */

import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useSubject } from "../../subjects/context";
import { speakText } from "../../lib/tts";
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
}

export function ChineseTrainPage() {
  const subject = useSubject();
  const [params] = useSearchParams();
  const unitId = params.get("unitId");
  const skillId = params.get("skillId");
  const fresh = params.get("fresh"); // 用来 useMemo dep，每次重生

  // 选题：按 unitId / skillId 过滤，shuffle 后取前 N
  const questions = useMemo<Question[]>(() => {
    let pool = subject.seedQuestions;
    if (skillId) pool = pool.filter((q) => q.skill_id === skillId);
    else if (unitId) pool = pool.filter((q) => q.unit_id === unitId);
    return shuffle(pool).slice(0, SESSION_SIZE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject.id, unitId, skillId, fresh]);

  const [idx, setIdx] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [optionOrder, setOptionOrder] = useState<number[]>([]);

  const q = questions[idx];

  // 进新题：洗选项顺序、清状态
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
  }, [q?.question_id]);

  if (questions.length === 0) {
    return (
      <div className="card text-center">
        <div className="text-3xl mb-2">📭</div>
        <div className="font-semibold mb-1">这个范围还没题</div>
        <div className="text-sm text-slate-400 mb-4">
          {skillId
            ? "这个技能下还没题；试试别的"
            : unitId
              ? "这个单元下还没题；试试别的单元"
              : "题库为空"}
        </div>
        <Link to="/chinese" className="btn-primary inline-block">
          回首页
        </Link>
      </div>
    );
  }

  // 完成
  if (idx >= questions.length) {
    const correctCount = answers.filter((a) => a.correct).length;
    const accuracy = Math.round((correctCount / answers.length) * 100);
    return (
      <div className="card-glow text-center space-y-4">
        <div className="text-5xl">🎉</div>
        <div className="font-display font-bold text-2xl text-brand">完成！</div>
        <div className="text-lg">
          答对 <span className="text-emerald-300 font-bold">{correctCount}</span> /{" "}
          {answers.length} ·{" "}
          <span
            className={
              accuracy >= 80
                ? "text-emerald-300"
                : accuracy >= 60
                  ? "text-amber-300"
                  : "text-rose-300"
            }
          >
            {accuracy}%
          </span>
        </div>
        <div className="text-xs text-slate-400">
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
          <Link to="/chinese" className="btn-secondary">
            回首页
          </Link>
        </div>
      </div>
    );
  }

  if (!q || !q.options) return null;

  const isDictation = !!q.audio_text;
  const correctOptionId = (q.answer as { type: "choice"; value: string }).value;

  const handleChoose = (oid: string) => {
    if (revealed) return;
    setChosen(oid);
    setRevealed(true);
    setAnswers((prev) => [
      ...prev,
      { qid: q.question_id, chosen: oid, correct: oid === correctOptionId },
    ]);
  };

  const handleNext = () => {
    setIdx((i) => i + 1);
  };

  const handlePlayAudio = async () => {
    if (!q.audio_text) return;
    try {
      await speakText(q.audio_text);
    } catch (e) {
      console.warn("[chinese-train] TTS failed", e);
    }
  };

  return (
    <div className="space-y-4">
      {/* 进度条 */}
      <div className="flex items-center gap-3">
        <div className="text-xs text-slate-400">
          第 {idx + 1} / {questions.length} 题
        </div>
        <div className="flex-1 h-1.5 rounded-full bg-ink-700/60 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-rose-400 transition-all"
            style={{ width: `${((idx + 1) / questions.length) * 100}%` }}
          />
        </div>
        <div className="text-xs text-slate-500">
          {q.skill_name ?? q.skill_id} · 难度 {q.difficulty}
        </div>
      </div>

      {/* 听写题 ▶ 播放按钮（题面上方） */}
      {isDictation && (
        <div className="card bg-amber-500/10 border border-amber-400/30 flex items-center gap-3">
          <button
            type="button"
            className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-rose-400 text-white text-2xl flex items-center justify-center shadow-glow shrink-0 hover:scale-105 transition-transform"
            onClick={handlePlayAudio}
            aria-label="播放朗读"
          >
            ▶
          </button>
          <div className="flex-1">
            <div className="font-semibold">点 ▶ 听小晴姐姐读这个词</div>
            <div className="text-xs text-slate-400 mt-1">
              可以重复点（点几次都行），听准了再选答案
            </div>
          </div>
        </div>
      )}

      {/* 题面 */}
      <div className="card-glow">
        <div className="font-display font-bold text-lg leading-relaxed">
          {q.stem}
        </div>
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

      {/* 答完反馈 + 下一题 */}
      {revealed && (
        <div className="space-y-3">
          <div
            className={`card text-sm ${
              chosen === correctOptionId
                ? "bg-emerald-500/10 border-emerald-400/30 text-emerald-100"
                : "bg-rose-500/10 border-rose-400/30 text-rose-100"
            }`}
          >
            <div className="font-semibold mb-1">
              {chosen === correctOptionId ? "✓ 答对了" : "✗ 再想一想"}
            </div>
            <div className="text-xs leading-relaxed text-slate-200/90">
              {chosen === correctOptionId ? q.feedback_correct : q.feedback_wrong}
            </div>
            {q.solution_steps && q.solution_steps.length > 0 && (
              <div className="text-[11px] mt-2 text-slate-300/80 leading-relaxed">
                💡 {q.solution_steps[0]}
              </div>
            )}
          </div>
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
