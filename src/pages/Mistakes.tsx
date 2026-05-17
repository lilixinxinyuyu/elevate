import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { SKILLS } from "../content/skills";
import { UNITS } from "../content/units";
import type { Attempt, Question } from "../core/types";
import { TutorPanel } from "../components/tutor/TutorPanel";
import {
  getMistakeRevivedToday,
  getReviveSessionVitality,
  spreadOverflowDueMistakes,
} from "../db/service";
import { DAILY_REVIVE_TARGET } from "../lib/mistakeSchedule";

const SKILL_MAP = new Map(SKILLS.map((s) => [s.id, s]));
const UNIT_MAP = new Map(UNITS.map((u) => [u.id, u]));

export function MistakesPage() {
  const student = useLiveQuery(async () => (await db.students.toArray())[0]);
  const mistakes = useLiveQuery(
    async () => (student ? db.mistakes.where({ studentId: student.id }).toArray() : []),
    [student?.id],
  );
  const questions = useLiveQuery(async () => db.questions.toArray(), []);
  const attempts = useLiveQuery(
    async () => (student ? db.attempts.where({ studentId: student.id }).toArray() : []),
    [student?.id],
  );

  const [filter, setFilter] = useState<"due" | "unresolved" | "all">("due");
  const [tutorFor, setTutorFor] = useState<{
    stem: string;
    correctAnswer: string;
    studentAnswer: string;
    skillName: string;
    skillId: string;
    questionId: string;
  } | null>(null);

  // v0.31.69: 进页时跑一次 spread，把多余到期题推到未来 7 天
  useEffect(() => {
    if (!student?.id) return;
    void spreadOverflowDueMistakes(student.id);
  }, [student?.id]);

  const revivedToday = useLiveQuery(async () => {
    if (!student) return 0;
    return await getMistakeRevivedToday(student.id);
  }, [student?.id, attempts?.length]);

  const reviveVitality = useLiveQuery(async () => {
    if (!student) return { encourageMore: false, attempts: 0, accuracy: 0 };
    return await getReviveSessionVitality(student.id);
  }, [student?.id, attempts?.length]);

  if (!student) return <div className="card">加载中…</div>;
  const qmap = new Map((questions ?? []).map((q) => [q.question_id, q]));
  const lastAttemptByQ = new Map<string, Attempt>();
  for (const a of (attempts ?? []) as Attempt[]) {
    const prev = lastAttemptByQ.get(a.questionId);
    if (!prev || a.createdAt > prev.createdAt) lastAttemptByQ.set(a.questionId, a);
  }

  // v0.31.16: 渲染层兜底过滤孤儿错题（cloudSync 合并后到 cleanupOrphanMistakes
  // 跑完之间有短窗口；questions 表还没 seed 完时也有可能命中）。
  // 计数也只算"有题在"的，避免页头数字跟列表对不上。
  const liveMistakes = (mistakes ?? []).filter((m) => qmap.has(m.questionId));

  const filtered = liveMistakes.filter((m) => {
    if (filter === "due" && (m.resolved || m.nextReviewAt > Date.now())) return false;
    if (filter === "unresolved" && m.resolved) return false;
    return true;
  });

  const allCount = liveMistakes.length;
  const unresolvedCount = liveMistakes.filter((m) => !m.resolved).length;
  const dueCount = liveMistakes.filter((m) => !m.resolved && m.nextReviewAt <= Date.now()).length;

  // v0.31.69: 今日目标 / 进度 / 是否已闭环 / 是否鼓励多做
  const revivedTodayN = revivedToday ?? 0;
  const totalToday = dueCount + revivedTodayN;
  const targetToday = Math.min(DAILY_REVIVE_TARGET, totalToday);
  const reviveDone = revivedTodayN >= targetToday && targetToday > 0;
  const encourageMore = reviveVitality?.encourageMore ?? false;
  const futureQueue = unresolvedCount - dueCount; // 已被 spread 推到未来的

  return (
    <div className="space-y-4">
      <div className="card-glow flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <div className="font-display font-bold text-xl flex items-center gap-2">
            错题复活
            {reviveDone && <span className="text-xs text-emerald-300">✓ 今日已闭</span>}
          </div>
          <div className="text-sm text-slate-400">
            {targetToday > 0 ? (
              <>
                今日 <span className="text-amber-300 font-semibold">{revivedTodayN} / {targetToday}</span> 道
                {dueCount > 0 && !reviveDone && (
                  <>
                    <span className="mx-1.5 text-slate-600">·</span>
                    剩 <span className="text-amber-300">{Math.max(0, targetToday - revivedTodayN)}</span> 道
                  </>
                )}
              </>
            ) : (
              <span className="text-emerald-300">今日已清 ✨</span>
            )}
            {futureQueue > 0 && (
              <>
                <span className="mx-1.5 text-slate-600">·</span>
                <span className="text-slate-500">未来 7 天分散 {futureQueue} 道</span>
              </>
            )}
            <span className="mx-1.5 text-slate-600">·</span>
            <span className="text-slate-500">历史共 {allCount}</span>
          </div>
          {reviveDone && encourageMore && (
            <div className="text-xs text-amber-200 mt-1.5">
              🔥 状态超好（{Math.round((reviveVitality?.accuracy ?? 0) * 100)}% 准确率 + 比平时快）— 再来 10 道？
            </div>
          )}
          {reviveDone && !encourageMore && (
            <div className="text-xs text-slate-300 mt-1.5">
              今天就到这吧，明天再战 👋
            </div>
          )}
        </div>
        <div className="flex gap-2 items-center">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="field py-1.5 text-sm w-auto"
          >
            <option value="due">到期复习</option>
            <option value="unresolved">未解决</option>
            <option value="all">全部</option>
          </select>
          <Link
            to={`/math/train?mode=review&fresh=${Date.now()}`}
            className={reviveDone && !encourageMore ? "btn-secondary" : "btn-primary"}
          >
            {reviveDone
              ? encourageMore
                ? "🔥 再来 10 道"
                : "🪄 还想做"
              : "🪄 开始复活"}
          </Link>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card text-sm text-slate-300">还没有到期错题，继续加油！</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((m) => {
            const q = qmap.get(m.questionId);
            const skill = SKILL_MAP.get(m.skillId);
            const unit = skill ? UNIT_MAP.get(skill.unitId) : undefined;
            const last = lastAttemptByQ.get(m.questionId);
            return (
              <div key={m.id} className="card">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <span>
                    {unit?.term} · {unit?.name} · {skill?.name}
                  </span>
                  <span className={srStageLabel(m.stage).tone}>
                    {srStageLabel(m.stage).text} · 下次 {new Date(m.nextReviewAt).toLocaleDateString("zh-CN")}
                  </span>
                </div>
                <div className="text-sm leading-relaxed text-slate-100">
                  {q?.stem ?? "[题目已移除]"}
                </div>
                {last && q && (
                  <div className="mt-2 text-xs">
                    <span className="text-rose-300">我的答案：{displayUserAnswer(last.answer, q)}</span>
                    <span className="mx-2 text-slate-500">·</span>
                    <span className="text-emerald-300">正确答案：{displayAnswer(q)}</span>
                    {/* Ep 爸爸-2026-05-17 Q3: 如果显示值相同, 标个 ✓ 帮老师/家长一眼看到 */}
                    {displayUserAnswer(last.answer, q) === displayAnswer(q) && (
                      <span className="ml-2 text-emerald-400 font-bold" title="最近一次答对了，间隔重复中">✓ 最近答对</span>
                    )}
                  </div>
                )}
                {q && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        setTutorFor({
                          stem: q.stem,
                          correctAnswer: displayAnswer(q),
                          studentAnswer: last ? displayUserAnswer(last.answer, q) : "",
                          skillName: skill?.name ?? q.skill_id,
                          skillId: q.skill_id,
                          questionId: q.question_id,
                        })
                      }
                      className="chip text-[11px] px-2.5 py-1 bg-amber-500/20 border border-amber-400/40 text-amber-100 hover:bg-amber-500/35 transition-colors"
                    >
                      👩‍🏫 让小进讲讲这道
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tutorFor && student && (
        <TutorPanel
          subjectId="math"
          context="wrong_retry"
          studentId={student.id}
          stem={tutorFor.stem}
          correctAnswer={tutorFor.correctAnswer}
          studentAnswer={tutorFor.studentAnswer}
          skillName={tutorFor.skillName}
          skillId={tutorFor.skillId}
          questionId={tutorFor.questionId}
          onClose={() => setTutorFor(null)}
        />
      )}
    </div>
  );
}

/**
 * 爸爸 2026-05-17 Q3 修：display 不对称导致 "我的:199.5 · 正确:199.5千克"
 * 视觉像不同其实相同。修法：拿到 question 后, user_answer 也加同样的 unit
 * (number 题), 让两边格式一致；choice 题 user_answer 已是 option id 自然对齐。
 *
 * 还做了一件: array answer (选 D 但被记成 ["D"]) 也优雅 unwrap.
 */
function displayUserAnswer(a: unknown, q?: Question): string {
  if (a == null) return "-";
  // 数组 / 对象：unwrap 单元素数组（template 异常常出 ["D"]），其余照旧
  if (Array.isArray(a)) {
    if (a.length === 1) return displayUserAnswer(a[0], q);
    return a.map((x) => String(x)).join(", ");
  }
  if (typeof a === "object") {
    return Object.entries(a as Record<string, unknown>)
      .map(([k, v]) => `${k}=${v ?? ""}`)
      .join("；");
  }
  const s = typeof a === "string" || typeof a === "number" ? String(a) : String(a);
  // 数字题加单位让两侧对称（user 输入 "199.5" 显示 "199.5千克"）
  if (q?.answer.type === "number" && q.answer.unit) {
    // 已含 unit 不重复加（user 偶尔会带单位输入）
    if (s.endsWith(q.answer.unit)) return s;
    return `${s}${q.answer.unit}`;
  }
  return s;
}

function displayAnswer(q: Question): string {
  const a = q.answer;
  if (a.type === "number") return `${a.value}${a.unit ?? ""}`;
  if (a.type === "choice") return a.value;
  return a.steps.map((s) => `${s.step_id}=${s.expected}`).join("；");
}

/** Ep 爸爸-2026-05-17：spaced repetition 进度可见，避免"答对了还在错题列表"的疑惑 */
function srStageLabel(stage: number): { text: string; tone: string } {
  const TOTAL_STAGES = 5; // REVIEW_INTERVAL_DAYS.length
  const done = Math.max(0, Math.min(stage, TOTAL_STAGES));
  const left = TOTAL_STAGES - done;
  if (left === 0) {
    return { text: `✓ 已掌握`, tone: "text-emerald-300" };
  }
  if (done === 0) {
    return { text: `🔴 还需答对 ${left} 次`, tone: "text-rose-300" };
  }
  return { text: `已对 ${done}/${TOTAL_STAGES} · 再答对 ${left} 次就毕业`, tone: "text-amber-300" };
}
