/**
 * 语文训练页 — Phase 2.x v0.21（feature parity 版）。
 *
 * 升级清单：
 *  - 答对 → sfx.correct + 选项卡片绿色脉冲；答错 → sfx.wrong + 红色震动
 *  - 连击 ≥3 → sfx.combo
 *  - 完成 → sfx.levelUp + 烟花 emoji 庆祝 + 数据卡
 *  - 听写题 ▶ 接 Qwen TTS（Cherry voice）
 *  - 支持 4 种模式（URL ?mode=）：
 *      practice (默认)：随机抽 10
 *      review：从 chinese mistakes 表挑到期 / 未消化的题（最多 12）
 *      mock_exam：跨 4 单元抽 20 题（5×D1 + 5×D2 + 6×D3 + 4×D4），完成后 cooldown 6 天
 *  - URL ?unitId / ?skillId 过滤（仅 practice 模式）
 *  - URL ?fresh 强制重洗
 */

import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { db } from "../../db/dexie";
import { useSubject } from "../../subjects/context";
import { speakText } from "../../lib/tts";
import { sfx } from "../../lib/sfx";
import {
  createChineseSessionId,
  getChineseMistakeQuestionIds,
  recordChineseMockExamCompleted,
  recordChineseSessionFinish,
  submitChineseAttempt,
  type ChineseAttemptResult,
} from "../../subjects/chinese/service";
import { CHINESE_TROPHIES } from "../../subjects/chinese/trophies";
import type { Question } from "../../core/types";

type TrainMode = "practice" | "review" | "mock_exam";

const PRACTICE_SIZE = 10;
const REVIEW_SIZE = 12;
const MOCK_SIZE = 20;

function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i]!, out[j]!] = [out[j]!, out[i]!];
  }
  return out;
}

/** 模拟测试按难度分桶，凑齐 5+5+6+4=20 题 */
function buildMockExamQuestions(pool: Question[]): Question[] {
  const buckets: Record<1 | 2 | 3 | 4 | 5, Question[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const q of pool) {
    const d = (q.difficulty >= 5 ? 5 : q.difficulty) as 1 | 2 | 3 | 4 | 5;
    buckets[d].push(q);
  }
  const want = { 1: 5, 2: 5, 3: 6, 4: 4 };
  const out: Question[] = [];
  for (const [d, n] of Object.entries(want)) {
    const dn = Number(d) as 1 | 2 | 3 | 4;
    out.push(...shuffle(buckets[dn]).slice(0, n));
  }
  // 不够时退路：D4 不够用 D5 补；D3/D2/D1 之间互补
  if (out.length < MOCK_SIZE) {
    const used = new Set(out.map((q) => q.question_id));
    const rest = pool.filter((q) => !used.has(q.question_id));
    out.push(...shuffle(rest).slice(0, MOCK_SIZE - out.length));
  }
  return shuffle(out).slice(0, MOCK_SIZE);
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
  const navigate = useNavigate();
  const unitId = params.get("unitId");
  const skillId = params.get("skillId");
  const fresh = params.get("fresh");
  const modeParam = (params.get("mode") ?? "practice") as TrainMode;
  const mode: TrainMode =
    modeParam === "review" || modeParam === "mock_exam" ? modeParam : "practice";

  const student = useLiveQuery(async () => (await db.students.toArray())[0]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionsLoaded, setQuestionsLoaded] = useState(false);

  // 选题：3 模式分别处理
  useEffect(() => {
    if (!student?.id) return;
    let cancelled = false;
    setQuestionsLoaded(false);
    (async () => {
      let qs: Question[] = [];
      if (mode === "review") {
        const ids = await getChineseMistakeQuestionIds(student.id, REVIEW_SIZE * 2);
        const idSet = new Set(ids);
        qs = subject.seedQuestions.filter((q) => idSet.has(q.question_id));
        qs = shuffle(qs).slice(0, REVIEW_SIZE);
      } else if (mode === "mock_exam") {
        qs = buildMockExamQuestions(subject.seedQuestions);
      } else {
        let pool = subject.seedQuestions;
        if (skillId) pool = pool.filter((q) => q.skill_id === skillId);
        else if (unitId) pool = pool.filter((q) => q.unit_id === unitId);
        qs = shuffle(pool).slice(0, PRACTICE_SIZE);
      }
      if (cancelled) return;
      setQuestions(qs);
      setQuestionsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id, subject.id, unitId, skillId, fresh, mode]);

  // 一组训练一个 sessionId
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
  const [allUnlockedTrophies, setAllUnlockedTrophies] = useState<string[]>([]);
  const [finishCelebrated, setFinishCelebrated] = useState(false);

  const q = questions[idx];

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
    // 听写题进题面自动播一次（让娃免得忘了点 ▶）
    if (q.audio_text) {
      void speakText(q.audio_text).catch(() => {
        // 自动播失败不显示错误，user 手动点 ▶ 时再 surface
      });
    }
  }, [q?.question_id]);

  const allDone = questionsLoaded && idx >= questions.length && questions.length > 0;

  // 完成时：写 session summary + （mock_exam）记 cooldown + sfx + 庆祝
  useEffect(() => {
    if (!allDone || !student?.id || answers.length === 0 || finishCelebrated) return;
    setFinishCelebrated(true);
    const correct = answers.filter((a) => a.correct).length;
    const xp = answers.reduce((s, a) => s + a.points, 0);
    sfx.levelUp();
    void recordChineseSessionFinish({
      studentId: student.id,
      sessionId,
      total: answers.length,
      correct,
      xpGained: xp,
    });
    if (mode === "mock_exam") {
      void recordChineseMockExamCompleted(student.id);
    }
  }, [allDone, student?.id, answers, sessionId, mode, finishCelebrated]);

  if (!questionsLoaded) {
    return (
      <div className="card text-center text-slate-400">加载题目中…</div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="card text-center">
        <div className="text-3xl mb-2">{mode === "review" ? "🎉" : "📭"}</div>
        <div className="font-semibold mb-1">
          {mode === "review"
            ? "暂时没有需要复活的错题"
            : mode === "mock_exam"
              ? "题库不够，模拟测试需要题量更多"
              : "这个范围还没题"}
        </div>
        <div className="text-sm text-slate-400">
          {mode === "review" ? "答错的题会自动出现在这里。" : ""}
        </div>
        <Link to="/chinese" className="btn-primary inline-block mt-3">回首页</Link>
      </div>
    );
  }

  if (allDone) {
    const correctCount = answers.filter((a) => a.correct).length;
    const accuracy = Math.round((correctCount / answers.length) * 100);
    const totalXp = answers.reduce((s, a) => s + a.points, 0);
    const maxCombo = answers.reduce((m, a) => Math.max(m, a.comboAfter), 0);
    const trophyDefById = new Map(CHINESE_TROPHIES.map((t) => [t.id, t]));
    return (
      <div className="space-y-4">
        {/* 撒花动画区 */}
        <div className="relative card-glow text-center overflow-hidden">
          {/* 顶部 emoji 烟花 */}
          <div className="absolute inset-x-0 top-0 flex justify-around text-2xl pointer-events-none animate-slide-up">
            <span>🎉</span><span>✨</span><span>🎊</span><span>⭐</span><span>🎉</span>
          </div>
          <div className="text-6xl pt-6">
            {accuracy === 100 ? "🏆" : accuracy >= 90 ? "🌟" : accuracy >= 70 ? "🎉" : "💪"}
          </div>
          <div className="font-display font-bold text-2xl text-brand mt-2">
            {mode === "mock_exam" ? "模拟测试完成！" : mode === "review" ? "错题复活完成！" : "完成！"}
          </div>
          <div className="grid grid-cols-3 gap-3 text-center pt-4 pb-2">
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
          <div className="text-xs text-slate-400 pt-1">
            {accuracy >= 90
              ? "几乎全对！期中没问题。"
              : accuracy >= 75
                ? "已经很稳了，再练 1-2 组到 90%+。"
                : accuracy >= 50
                  ? "中等偏好，回头看看错的题。"
                  : "重点复习一下错题，再来一组。"}
          </div>
        </div>

        {/* 新解锁勋章汇总 */}
        {allUnlockedTrophies.length > 0 && (
          <div className="card bg-gradient-to-br from-amber-500/15 to-rose-500/15 border border-amber-400/40">
            <div className="text-sm font-semibold text-amber-200 mb-2">
              🎖️ 本组共解锁 {allUnlockedTrophies.length} 枚勋章
            </div>
            <div className="flex justify-start gap-3 flex-wrap">
              {allUnlockedTrophies.map((tid, i) => {
                const def = trophyDefById.get(tid);
                if (!def) return null;
                return (
                  <div key={`${tid}-${i}`} className="flex items-center gap-2 px-3 py-1.5 bg-ink-900/40 rounded-lg">
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

        <div className="flex justify-center gap-3 pt-1">
          {mode !== "mock_exam" && (
            <Link
              to={`/chinese/train?mode=${mode}&fresh=${Date.now()}${unitId ? `&unitId=${unitId}` : ""}${skillId ? `&skillId=${skillId}` : ""}`}
              className="btn-primary"
            >
              再来一组
            </Link>
          )}
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

    // 立刻放音，不等 db 写完
    if (isCorrect) {
      sfx.correct();
      if (comboBefore + 1 >= 3) {
        // 连击 ≥3 时给个额外的 combo 音效（在 correct 音之后）
        setTimeout(() => sfx.combo(), 250);
      }
    } else {
      sfx.wrong();
    }

    try {
      const result = await submitChineseAttempt({
        studentId: student.id,
        sessionId,
        question: q,
        isCorrect,
        chosenOptionId: oid,
        elapsedSeconds,
        comboBefore,
        isReview: mode === "review",
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
      if (result.newTrophyIds.length > 0) {
        sfx.chest();
        setAllUnlockedTrophies((prev) => [...prev, ...result.newTrophyIds]);
      }
    } catch (e) {
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
  const modeLabel = mode === "mock_exam" ? "📝 模拟测试" : mode === "review" ? "🪄 错题复活" : "今日挑战";

  return (
    <div className="space-y-4">
      {/* 模式标签 + 进度 + 连击 */}
      <div className="flex items-center gap-3">
        <div className="chip bg-violet-500/15 text-violet-200 border border-violet-400/30 text-xs">
          {modeLabel}
        </div>
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
        <div className="text-xs text-slate-500 shrink-0">D{q.difficulty}</div>
      </div>

      {/* 听写题 ▶ */}
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
                进题时已自动播一次；可重复点听准了再选
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
            if (isCorrect) cls += " bg-emerald-500/15 border-emerald-400/40 ring-2 ring-emerald-400/40 animate-slide-up";
            else if (isChosen) cls += " bg-rose-500/15 border-rose-400/40 ring-1 ring-rose-400/30";
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

          {/* 当前题新解锁 trophy 显示 */}
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

      {/* mock exam 模式底部退出按钮（不强制锁，但有警告） */}
      {mode === "mock_exam" && idx < questions.length && (
        <div className="text-center">
          <button
            type="button"
            className="text-xs text-slate-500 underline hover:text-slate-300"
            onClick={() => {
              if (window.confirm("模拟测试还没做完，退出会丢失这次进度（cooldown 不会写）。确定吗？")) {
                navigate("/chinese");
              }
            }}
          >
            提前退出（不计入 cooldown）
          </button>
        </div>
      )}
    </div>
  );
}
