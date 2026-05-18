/**
 * v0.35.10 (爸爸反馈): 期末备考中心 dashboard.
 *
 * 取代原 Home "考试模拟" 单 card 入口. 一站式:
 *   - 历史 mock 成绩 + 趋势
 *   - 错题类型 4 周趋势
 *   - 弱点 skill (top 3)
 *   - 小进姐姐针对当下问题的指导
 *   - 选 30 / 60 / 80 题开始新模拟卷
 */
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { computeExamPrep, type MockHistoryEntry } from "../core/examPrep";
import type { Question } from "../core/types";
import { MascotQuickAccess } from "../components/MascotQuickAccess";

export default function ExamPrepPage() {
  const navigate = useNavigate();
  const studentId = useLiveQuery(async () => (await db.students.toCollection().first())?.id ?? null, []) ?? null;
  const attempts = useLiveQuery(
    async () => studentId ? db.attempts.where("studentId").equals(studentId).toArray() : [],
    [studentId],
  ) ?? [];
  const sessions = useLiveQuery(
    async () => studentId ? db.sessions.where("studentId").equals(studentId).toArray() : [],
    [studentId],
  ) ?? [];
  const mastery = useLiveQuery(
    async () => studentId ? db.mastery.where("studentId").equals(studentId).toArray() : [],
    [studentId],
  ) ?? [];

  const questionIds = useMemo(() => [...new Set(attempts.map((a) => a.questionId))], [attempts]);
  const questions = useLiveQuery(
    async () => questionIds.length === 0 ? [] : await db.questions.where("question_id").anyOf(questionIds).toArray(),
    [questionIds.join(",")],
  ) ?? [];
  const questionsById = useMemo(() => {
    const m = new Map<string, Question>();
    for (const q of questions) m.set(q.question_id, q);
    return m;
  }, [questions]);

  const snapshot = useMemo(
    () => computeExamPrep(sessions, attempts, questionsById, mastery),
    [sessions, attempts, questionsById, mastery],
  );

  const [chosenSize, setChosenSize] = useState<30 | 60 | 80>(snapshot.recommendedSize);
  const [hardLimit, setHardLimit] = useState(false);

  function startMockExam() {
    const params = new URLSearchParams({
      mode: "mock_exam",
      fresh: String(Date.now()),
      size: String(chosenSize),
      hard: hardLimit ? "1" : "0",
    });
    navigate(`/math/train?${params.toString()}`);
  }

  const hasData = snapshot.totalMockExams > 0 || snapshot.errorTrends.length > 0;

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-purple-100">📝 期末备考中心</h1>
        <button onClick={() => navigate(-1)} className="text-xs text-slate-400 hover:text-slate-200">返回</button>
      </div>

      {/* 开始新模拟卷 */}
      <section className="rounded-xl bg-purple-500/15 border border-purple-400/40 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-purple-100">🎯 开始新模拟卷</h2>
        <div className="text-xs text-purple-200/80">
          推荐 <b>{snapshot.recommendedSize} 题</b> (基于你的掌握度)
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[30, 60, 80].map((sz) => (
            <button
              key={sz}
              onClick={() => setChosenSize(sz as 30 | 60 | 80)}
              className={`px-3 py-2 rounded-lg border text-sm font-semibold transition ${
                chosenSize === sz
                  ? "bg-purple-500 text-white border-purple-300"
                  : "bg-slate-800 text-purple-200 border-purple-400/30 hover:bg-slate-700"
              }`}
            >
              {sz} 题
              <div className="text-[10px] font-normal opacity-70">
                ≈ {sz === 30 ? "60 分钟" : sz === 60 ? "90 分钟" : "120 分钟"}
              </div>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-purple-200/80 cursor-pointer">
          <input
            type="checkbox"
            checked={hardLimit}
            onChange={(e) => setHardLimit(e.target.checked)}
            className="rounded"
          />
          硬限时 (倒计时强交卷) — 真考体验
        </label>
        <button
          onClick={startMockExam}
          className="w-full px-4 py-2.5 rounded-lg bg-purple-500 text-white text-base font-semibold hover:bg-purple-400"
        >
          开始 {chosenSize} 题模拟卷 →
        </button>
      </section>

      {!hasData ? (
        <div className="rounded-lg bg-slate-900/40 border border-slate-500/30 p-4 text-center text-slate-300 text-sm">
          还没有备考数据. 做几道题或完成第 1 次模拟卷后, 这里会显示历史 / 趋势 / 弱点.
        </div>
      ) : (
        <>
          {/* 历史 + 趋势 */}
          {snapshot.history.length > 0 && (
            <section className="rounded-xl bg-slate-900/50 border border-purple-400/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-purple-100">📊 历次模拟成绩</h2>
                {snapshot.trendDeltaPercent !== null && (
                  <span className={`text-xs font-bold ${
                    snapshot.trendDeltaPercent > 0 ? "text-emerald-200" : snapshot.trendDeltaPercent < 0 ? "text-rose-200" : "text-slate-300"
                  }`}>
                    {snapshot.trendDeltaPercent > 0 ? "↑" : snapshot.trendDeltaPercent < 0 ? "↓" : "≈"} {Math.abs(snapshot.trendDeltaPercent)}%
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {snapshot.history.slice(0, 5).map((h) => (
                  <HistoryRow key={h.sessionId} entry={h} />
                ))}
              </div>
              {snapshot.history.length > 5 && (
                <p className="text-[10px] text-slate-400 text-center">共 {snapshot.history.length} 次模拟, 显示最近 5 次</p>
              )}
            </section>
          )}

          {/* 错题类型 4 周趋势 */}
          {snapshot.errorTrends.length > 0 && (
            <section className="rounded-xl bg-slate-900/50 border border-amber-400/30 p-3 space-y-2">
              <h2 className="text-sm font-semibold text-amber-100">⚠️ 错题类型 (近 4 周)</h2>
              <div className="space-y-2">
                {snapshot.errorTrends.slice(0, 5).map((t) => {
                  const max = Math.max(...t.weeklyCounts, 1);
                  return (
                    <div key={t.category} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span>{t.icon}</span>
                        <span className="text-sm text-amber-100 flex-1">{t.category}</span>
                        <span className="text-xs text-amber-200/80">{t.totalRecent} 题</span>
                      </div>
                      <div className="flex gap-1 items-end h-8">
                        {t.weeklyCounts.map((c, i) => (
                          <div
                            key={i}
                            className="flex-1 bg-amber-400/50 rounded-sm"
                            style={{ height: `${(c / max) * 100}%`, minHeight: c > 0 ? "4px" : "1px" }}
                            title={`第 ${i + 1} 周: ${c} 题`}
                          />
                        ))}
                      </div>
                      <div className="flex gap-1 text-[9px] text-slate-400">
                        <span className="flex-1 text-center">4 周前</span>
                        <span className="flex-1 text-center">3 周前</span>
                        <span className="flex-1 text-center">2 周前</span>
                        <span className="flex-1 text-center">本周</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* 弱点 skill */}
          {snapshot.weaknesses.length > 0 && (
            <section className="rounded-xl bg-slate-900/50 border border-rose-400/30 p-3 space-y-2">
              <h2 className="text-sm font-semibold text-rose-100">📉 待加强 (top 3 弱点)</h2>
              <div className="space-y-1.5">
                {snapshot.weaknesses.map((w) => (
                  <div key={w.skillId} className="flex items-center gap-2">
                    <span className="text-xs text-rose-200/80 flex-1 truncate">{w.skillName}</span>
                    {w.fragile && <span className="text-[10px] bg-rose-500/30 text-rose-100 px-1 rounded">🔥 易错</span>}
                    <span className="text-xs font-bold text-rose-100">{w.masteryScore}/100</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 小进姐姐指导 */}
          <section className="rounded-xl bg-indigo-500/15 border border-indigo-400/40 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🐼</span>
              <h2 className="text-sm font-semibold text-indigo-100">小进姐姐针对你说</h2>
            </div>
            <div className="text-sm text-indigo-50">
              <p className="font-semibold">{snapshot.advice.topProblem}</p>
              <p className="text-xs text-indigo-200/90 mt-1">{snapshot.advice.message}</p>
            </div>
            {snapshot.advice.recommendedRoute ? (
              <Link
                to={snapshot.advice.recommendedRoute}
                className="block w-full text-center px-3 py-2 rounded-lg bg-indigo-500 text-white text-sm font-semibold hover:bg-indigo-400"
              >
                {snapshot.advice.recommendedActionLabel} →
              </Link>
            ) : (
              <p className="text-xs text-indigo-300/70 text-center">{snapshot.advice.recommendedActionLabel}</p>
            )}
          </section>
        </>
      )}
      <MascotQuickAccess context="exam_prep" />
    </div>
  );
}

function HistoryRow({ entry }: { entry: MockHistoryEntry }) {
  const navigate = useNavigate();
  const pct = entry.scorePercent;
  const date = new Date(entry.finishedAt);
  const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
  return (
    <button
      onClick={() => navigate(`/math/mock-report?sessionId=${entry.sessionId}`)}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-800/50 hover:bg-slate-800 transition text-left"
    >
      <span className="text-xs text-slate-300 w-12">{dateStr}</span>
      <span className="text-xs text-slate-400 w-20">{entry.totalCorrect}/{entry.totalQuestions}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-900 overflow-hidden">
        <div
          className={`h-full ${pct >= 80 ? "bg-emerald-400" : pct >= 60 ? "bg-amber-400" : "bg-rose-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-xs font-bold w-10 text-right ${
        pct >= 80 ? "text-emerald-200" : pct >= 60 ? "text-amber-200" : "text-rose-200"
      }`}>{pct}%</span>
    </button>
  );
}
