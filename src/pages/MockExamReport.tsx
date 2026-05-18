/**
 * v0.35.7 (iter 41 P2-2): 模拟整卷成绩分析页.
 *
 * 流程: mock_exam session 完成 → navigate('/math/mock-report?sessionId=xxx')
 *
 * 评审整合:
 *   - 软限时 (只显示用时, 不强退)
 *   - 错题诊断 Top 3, count ≥ 2 才显示 (高风险类型 count=1 也显示)
 *   - 1 主推荐 + 2 次推荐 (避免 3 个强 CTA 压力)
 *   - 未完成 session → 显示"继续完成", 不算正式成绩
 */
import { useMemo } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { computeMockExamReport } from "../core/mockExamReport";
import type { Question } from "../core/types";

export default function MockExamReportPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get("sessionId") ?? "";

  const studentId = useLiveQuery(async () => (await db.students.toCollection().first())?.id ?? null, []) ?? null;

  const session = useLiveQuery(
    async () => (sessionId ? await db.sessions.get(sessionId) : null),
    [sessionId],
  );

  const attempts = useLiveQuery(
    async () => {
      if (!studentId || !sessionId) return [];
      return db.attempts.where("studentId").equals(studentId).filter((a) => a.sessionId === sessionId).toArray();
    },
    [studentId, sessionId],
  ) ?? [];

  // 拿对应 questions
  const questionIds = useMemo(() => [...new Set(attempts.map((a) => a.questionId))], [attempts]);
  const questions = useLiveQuery(
    async () => (questionIds.length === 0 ? [] : await db.questions.where("question_id").anyOf(questionIds).toArray()),
    [questionIds.join(",")],
  ) ?? [];

  const questionsById = useMemo(() => {
    const m = new Map<string, Question>();
    for (const q of questions) m.set(q.question_id, q);
    return m;
  }, [questions]);

  const summary = useMemo(() => computeMockExamReport(attempts, questionsById), [attempts, questionsById]);

  // 评审共识 blocker fix: 不能硬编码 < 30 (scheduler 可能出 20/25 题, 永远 stuck)
  // 改: 用 session.questionIds 实际数量判定. 完成 = answered ≥ session 实际分配题数.
  const sessionTotal = session?.questionIds?.length ?? 0;
  const TARGET_QUESTIONS_DISPLAY = 30; // 仅展示文案用
  const isIncomplete =
    sessionTotal > 0 &&
    summary.totalQuestions > 0 &&
    summary.totalQuestions < sessionTotal;

  if (!sessionId) {
    return (
      <div className="max-w-md mx-auto p-4 space-y-3">
        <h1 className="text-lg font-bold text-rose-100">📝 模拟整卷成绩分析</h1>
        <p className="text-sm text-rose-200">URL 缺 sessionId 参数</p>
        <button onClick={() => navigate(-1)} className="px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-sm">返回</button>
      </div>
    );
  }

  if (attempts.length === 0) {
    return (
      <div className="max-w-md mx-auto p-4 space-y-3">
        <h1 className="text-lg font-bold text-amber-100">📝 模拟整卷成绩分析</h1>
        <p className="text-sm text-amber-200">还没有答题数据.</p>
        <Link to={`/math/train?mode=mock_exam&fresh=${Date.now()}`} className="block text-center px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold">
          开始模拟整卷
        </Link>
      </div>
    );
  }

  if (isIncomplete) {
    return (
      <div className="max-w-md mx-auto p-4 space-y-3">
        <h1 className="text-lg font-bold text-amber-100">📝 模拟整卷进行中</h1>
        <div className="rounded-xl bg-amber-500/15 border border-amber-400/40 p-3">
          <p className="text-sm text-amber-100">已做: {summary.totalQuestions} / {sessionTotal} 题</p>
          <p className="text-xs text-amber-200/80 mt-1">完成全部题目后, 才能看到完整分析报告.</p>
        </div>
        <Link to={`/math/train?mode=mock_exam&sessionId=${sessionId}`} className="block text-center px-4 py-2 rounded-lg bg-amber-500 text-white font-semibold">
          继续完成模拟卷
        </Link>
        <button onClick={() => navigate("/math")} className="block w-full text-center px-3 py-1.5 rounded-lg bg-slate-700 text-slate-200 text-sm">
          回主页 (放弃此次模拟)
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-purple-100">📝 模拟整卷成绩分析</h1>
        <button onClick={() => navigate("/math")} className="text-xs text-slate-400 hover:text-slate-200">返回</button>
      </div>

      {/* 总分 */}
      <div className={`rounded-xl border p-4 text-center ${
        summary.scorePercent >= 80 ? "bg-emerald-500/15 border-emerald-400/40" :
        summary.scorePercent >= 60 ? "bg-amber-500/15 border-amber-400/40" :
        "bg-rose-500/15 border-rose-400/40"
      }`}>
        <p className="text-xs text-slate-300">总分</p>
        <p className={`text-4xl font-bold mt-1 ${
          summary.scorePercent >= 80 ? "text-emerald-100" :
          summary.scorePercent >= 60 ? "text-amber-100" :
          "text-rose-100"
        }`}>
          {summary.totalCorrect} / {summary.totalQuestions}
          <span className="text-2xl ml-2">= {summary.scorePercent}%</span>
        </p>
        {summary.totalMinutes !== null && (
          <p className="text-xs text-slate-300/80 mt-2">用时 ≈ {summary.totalMinutes} 分钟 (建议 60 分钟内)</p>
        )}
        {summary.totalQuestions < TARGET_QUESTIONS_DISPLAY && (
          <p className="text-[10px] text-amber-200/70 mt-2">
            本次共 {summary.totalQuestions} 题, 非完整 {TARGET_QUESTIONS_DISPLAY} 题模拟卷, 结果仅供参考
          </p>
        )}
      </div>

      {/* 题型 breakdown */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-purple-100">各题型表现</h2>
        {summary.byCategory.map((c) => {
          const pct = Math.round(c.rate * 100);
          return (
            <div key={c.label} className="rounded-lg bg-slate-900/50 border border-purple-400/30 p-2.5">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-base">{c.icon}</span>
                <span className="text-sm font-medium text-purple-100 flex-1">{c.label}</span>
                <span className="text-sm font-bold text-purple-50">{c.correct}/{c.total}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-900 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    pct >= 80 ? "bg-emerald-400" :
                    pct >= 60 ? "bg-amber-400" :
                    "bg-rose-400"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {c.total < 3 && (
                <p className="text-[10px] text-amber-200/60 mt-1">样本较少 ({c.total} 题), 仅供参考</p>
              )}
            </div>
          );
        })}
      </div>

      {/* 错题诊断 — Top 3 */}
      {summary.diagnoses.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-amber-100">⚠️ 错题诊断 (Top {Math.min(3, summary.diagnoses.length)})</h2>
          {summary.diagnoses.map((d, i) => (
            <div key={d.category} className={`rounded-lg p-3 border ${
              i === 0 ? "bg-amber-500/15 border-amber-400/40" : "bg-slate-800/40 border-slate-500/30"
            }`}>
              <p className="text-sm font-semibold text-amber-100">
                {i === 0 && "🎯 主要问题: "}
                {d.category} ({d.count} 题)
              </p>
              <p className="text-xs text-amber-200/80 mt-1">
                {d.recommendation}
              </p>
              {d.link && (
                <Link to={d.link} className="inline-block mt-2 text-xs px-2 py-1 rounded bg-amber-500 text-white">
                  去试试 →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      {summary.diagnoses.length === 0 && summary.scorePercent >= 80 && (
        <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/40 p-3 text-center">
          <p className="text-sm font-semibold text-emerald-100">🎉 没有明显的错题模式 — 你做得很稳!</p>
        </div>
      )}

      <div className="flex gap-2">
        <Link to={`/math/train?mode=mock_exam&fresh=${Date.now()}`} className="flex-1 text-center px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm">
          再做一次模拟卷
        </Link>
        <Link to="/math" className="flex-1 text-center px-3 py-2 rounded-lg bg-purple-500 text-white text-sm font-semibold">
          返回主页
        </Link>
      </div>
    </div>
  );
}
