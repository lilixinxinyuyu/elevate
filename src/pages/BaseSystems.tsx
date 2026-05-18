/**
 * v0.35.4 (iter 38 P1-3): 进制小课堂 主页面.
 *
 * Selena 43% master plan P1-3.
 * 4 节微课讲清进率: 10 进制 / 60 进制 / 特殊进率 / 常错对照.
 *
 * 评审共识:
 *   - 自由顺序进入 (默认推荐顺序), 不强 lock
 *   - 卡片纯文本 + emoji + 轻视觉 (钟表 / 阶梯)
 *   - Trophy 只全部完成给一次, 单节只 XP
 *   - 节 4 加判断题专门打"1 小时 = 100 分钟"
 *
 * 流程:
 *   主菜单 → 点节 → 概念卡片 → "开始练习" → 2-4 题练习 → 完成 → 回菜单
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BASE_SYSTEM_LESSONS,
  BASE_SYSTEM_XP,
  areAllLessonsComplete,
  isLessonComplete,
  loadLessonProgress,
  saveLessonProgress,
  type Lesson,
} from "../core/baseSystemContent";
import { MascotQuickAccess } from "../components/MascotQuickAccess";

type PageMode = "menu" | "concept" | "exercise" | "lessonDone";

export default function BaseSystemsPage() {
  const navigate = useNavigate();
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [mode, setMode] = useState<PageMode>("menu");
  const [exerciseIdx, setExerciseIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [showHint, setShowHint] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [reveal, setReveal] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [progress, setProgress] = useState(() => loadLessonProgress());

  function refreshProgress() {
    setProgress(loadLessonProgress());
  }

  function pickLesson(l: Lesson) {
    setActiveLesson(l);
    setMode("concept");
    setExerciseIdx(0);
    setCorrectCount(0);
    setShowHint(false);
    setAnswer("");
    setReveal(false);
    setErrMsg("");
  }

  function startExercises() {
    setMode("exercise");
    setExerciseIdx(0);
    setAnswer("");
    setReveal(false);
    setShowHint(false);
    setCorrectCount(0);
    setErrMsg("");
  }

  function submitAnswer() {
    if (!activeLesson || reveal) return;
    const ex = activeLesson.exercises[exerciseIdx];
    if (!ex) return;
    const userNum = Number(answer);
    if (!Number.isFinite(userNum)) {
      setErrMsg("请输入数字");
      return;
    }
    setErrMsg("");
    const isCorrect = userNum === ex.answer;
    setReveal(true);
    if (isCorrect) {
      setCorrectCount((c) => c + 1);
    }
  }

  function nextExercise() {
    if (!activeLesson) return;
    if (exerciseIdx >= activeLesson.exercises.length - 1) {
      // 完成本节
      saveLessonProgress(activeLesson.id, correctCount + (reveal && Number(answer) === activeLesson.exercises[exerciseIdx]?.answer ? 1 : 0), activeLesson.exercises.length);
      refreshProgress();
      setMode("lessonDone");
    } else {
      setExerciseIdx(exerciseIdx + 1);
      setAnswer("");
      setReveal(false);
      setShowHint(false);
      setErrMsg("");
    }
  }

  function backToMenu() {
    setActiveLesson(null);
    setMode("menu");
  }

  /* ──────────── Menu ──────────── */
  if (mode === "menu") {
    const allDone = areAllLessonsComplete();
    return (
      <div className="max-w-md mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-indigo-100">📐 进制小课堂</h1>
          <button onClick={() => navigate(-1)} className="text-xs text-slate-400 hover:text-slate-200">返回</button>
        </div>
        <p className="text-sm text-indigo-200/80">
          单位换算其实就是判"进率"! 4 节讲清楚 — 推荐按顺序学.
        </p>
        <div className="space-y-2">
          {BASE_SYSTEM_LESSONS.map((l, i) => {
            const done = isLessonComplete(l.id);
            const p = progress[l.id];
            return (
              <button
                key={l.id}
                onClick={() => pickLesson(l)}
                className={`block w-full text-left p-3 rounded-xl border transition ${
                  done
                    ? "bg-emerald-500/15 border-emerald-400/40 hover:bg-emerald-500/25"
                    : "bg-indigo-500/10 border-indigo-400/30 hover:bg-indigo-500/20"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{l.icon}</span>
                  <span className="font-semibold text-base text-indigo-50">
                    第 {i + 1} 节: {l.title}
                  </span>
                  {done && <span className="ml-auto text-xs text-emerald-200">✓ 完成</span>}
                  {!done && p && p.completedExercises > 0 && (
                    <span className="ml-auto text-xs text-indigo-200/70">
                      {p.completedExercises}/{p.totalExercises}
                    </span>
                  )}
                </div>
                <p className="text-xs text-indigo-200/70 mt-1">{l.punchline}</p>
              </button>
            );
          })}
        </div>
        {allDone && (
          <div className="rounded-xl bg-amber-500/15 border border-amber-400/40 p-3 text-center">
            <p className="text-base font-bold text-amber-100">🏆 你拿到了"进制小专家" 称号!</p>
            <p className="text-xs text-amber-200/80 mt-1">完成 4 节 +{BASE_SYSTEM_XP.ALL_LESSONS_COMPLETE} XP</p>
          </div>
        )}
        <MascotQuickAccess context="base_systems" />
      </div>
    );
  }

  if (!activeLesson) return null;

  /* ──────────── Concept ──────────── */
  if (mode === "concept") {
    return (
      <div className="max-w-md mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-indigo-100">
            {activeLesson.icon} {activeLesson.title}
          </h1>
          <button onClick={backToMenu} className="text-xs text-slate-400 hover:text-slate-200">返回菜单</button>
        </div>
        <div className="rounded-xl bg-indigo-500/10 border border-indigo-400/40 p-4 space-y-3">
          <p className="text-base font-bold text-indigo-50">{activeLesson.punchline}</p>
          <pre className="text-sm text-indigo-50/90 whitespace-pre-wrap leading-relaxed font-sans">
            {activeLesson.conceptCard}
          </pre>
        </div>
        <button
          onClick={startExercises}
          className="w-full px-4 py-3 rounded-xl bg-indigo-500 text-white font-semibold hover:bg-indigo-400"
        >
          ✅ 学完了, 来做 {activeLesson.exercises.length} 道练习 →
        </button>
        <MascotQuickAccess context="base_systems" />
      </div>
    );
  }

  /* ──────────── Exercise ──────────── */
  if (mode === "exercise") {
    const ex = activeLesson.exercises[exerciseIdx];
    if (!ex) return null;
    const kind = ex.kind ?? "numeric";
    const isAnswerCorrect = Number(answer) === ex.answer;

    function pickValue(v: number) {
      if (reveal) return;
      setAnswer(String(v));
      setReveal(true);
      if (v === ex!.answer) setCorrectCount((c) => c + 1);
    }

    return (
      <div className="max-w-md mx-auto p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-base font-bold text-indigo-100">
            {activeLesson.icon} 练习 ({exerciseIdx + 1}/{activeLesson.exercises.length})
          </h1>
          <span className="text-xs text-indigo-200/70">{correctCount}/{exerciseIdx + (reveal ? 1 : 0)} 对</span>
        </div>
        <div className="rounded-xl bg-slate-900/50 border border-indigo-400/30 p-4">
          <p className="text-base text-indigo-50">{ex.prompt}</p>
        </div>

        {/* numeric: 数字输入 */}
        {kind === "numeric" && (
          <>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={reveal}
                autoFocus
                className="flex-1 px-3 py-2 rounded-lg bg-slate-800 text-indigo-50 border border-indigo-400/40 focus:outline-none focus:border-indigo-300 text-lg"
              />
              {ex.unit && <span className="text-indigo-200 font-semibold">{ex.unit}</span>}
            </div>
            {errMsg && <p className="text-xs text-rose-200 bg-rose-500/15 px-2 py-1 rounded">{errMsg}</p>}
          </>
        )}

        {/* judgment: 对/错 大按钮 (post-review 共识 blocker) */}
        {kind === "judgment" && !reveal && (
          <div className="flex gap-3">
            <button
              onClick={() => pickValue(1)}
              className="flex-1 py-4 rounded-xl bg-emerald-500 text-white text-2xl font-bold hover:bg-emerald-400 transition"
            >
              ✓ 对
            </button>
            <button
              onClick={() => pickValue(0)}
              className="flex-1 py-4 rounded-xl bg-rose-500 text-white text-2xl font-bold hover:bg-rose-400 transition"
            >
              ✗ 错
            </button>
          </div>
        )}

        {/* choice: 多选 (post-review 加 1 千米 = ? 米 用) */}
        {kind === "choice" && !reveal && ex.choices && (
          <div className="flex flex-col gap-2">
            {ex.choices.map((c, i) => (
              <button
                key={i}
                onClick={() => pickValue(c.value)}
                className="text-left px-4 py-3 rounded-xl bg-slate-800 border border-indigo-400/40 text-indigo-50 hover:bg-slate-700 transition"
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {showHint && !reveal && (
          <p className="text-xs text-amber-200 bg-amber-500/15 px-2 py-1 rounded">💡 {ex.hint ?? "再想想"}</p>
        )}
        {reveal && (
          <div className={`rounded-lg px-3 py-2 ${isAnswerCorrect ? "bg-emerald-500/15 border border-emerald-400/40" : "bg-rose-500/15 border border-rose-400/40"}`}>
            <p className={`font-semibold ${isAnswerCorrect ? "text-emerald-100" : "text-rose-100"}`}>
              {isAnswerCorrect ? "✓ 对了!" : kind === "judgment" ? "✗ 想错了" : `✗ 正解: ${ex.answer}${ex.unit ?? ""}`}
            </p>
            <p className="text-sm text-slate-200/90 mt-1">{ex.explanation}</p>
          </div>
        )}
        <div className="flex gap-2">
          {!reveal && kind === "numeric" && (
            <>
              <button onClick={() => setShowHint(true)} disabled={showHint} className="px-3 py-2 rounded-lg bg-slate-800 text-amber-200 text-sm border border-amber-400/30 hover:bg-slate-700 disabled:opacity-50">
                💡 提示
              </button>
              <button onClick={submitAnswer} className="flex-1 px-3 py-2 rounded-lg bg-indigo-500 text-white font-semibold hover:bg-indigo-400">
                提交答案
              </button>
            </>
          )}
          {!reveal && kind !== "numeric" && (
            <button onClick={() => setShowHint(true)} disabled={showHint} className="px-3 py-2 rounded-lg bg-slate-800 text-amber-200 text-sm border border-amber-400/30 hover:bg-slate-700 disabled:opacity-50">
              💡 提示
            </button>
          )}
          {reveal && (
            <button onClick={nextExercise} className="flex-1 px-3 py-2 rounded-lg bg-indigo-500 text-white font-semibold hover:bg-indigo-400">
              {exerciseIdx >= activeLesson.exercises.length - 1 ? "完成本节 →" : "下一题 →"}
            </button>
          )}
        </div>
        <MascotQuickAccess context="base_systems" />
      </div>
    );
  }

  /* ──────────── LessonDone ──────────── */
  if (mode === "lessonDone") {
    const allDone = areAllLessonsComplete();
    return (
      <div className="max-w-md mx-auto p-4 space-y-4">
        <h1 className="text-2xl font-bold text-emerald-100 text-center">🎉 第 {BASE_SYSTEM_LESSONS.indexOf(activeLesson) + 1} 节完成!</h1>
        <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/40 p-4 space-y-2">
          <p className="text-base text-emerald-100 font-semibold">{activeLesson.icon} {activeLesson.title}</p>
          <p className="text-sm text-emerald-50">答对: {correctCount}/{activeLesson.exercises.length}</p>
          <p className="text-sm text-emerald-50">本节 XP: +{BASE_SYSTEM_XP.LESSON_COMPLETE}</p>
        </div>
        {allDone && (
          <div className="rounded-xl bg-amber-500/15 border border-amber-400/40 p-4 text-center">
            <p className="text-xl font-bold text-amber-100">🏆 你拿到"进制小专家" 称号!</p>
            <p className="text-sm text-amber-200 mt-1">4 节全部完成 +{BASE_SYSTEM_XP.ALL_LESSONS_COMPLETE} XP bonus</p>
          </div>
        )}
        <button onClick={backToMenu} className="w-full px-4 py-2 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-400">
          回主菜单
        </button>
        <MascotQuickAccess context="base_systems" />
      </div>
    );
  }

  return null;
}
