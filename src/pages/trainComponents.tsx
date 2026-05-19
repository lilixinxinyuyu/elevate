/**
 * v0.35.54 Refactor Priority 20 (Train.tsx 拆分 step 1): 抽 3 个 self-contained
 * sub-component 子组件.
 *
 *   - StatCard: 24 行 pure presentation card (summary 用)
 *   - SummaryReviewTutor: 18 行 wrapper (拉 studentId 再 mount TutorPanel)
 *   - MathAutoGen: 58 行 wrapper (拉 student term/unit 后传给 AutoGenerateOnEmpty)
 *
 * 都跟 Train.tsx state 无 coupling, 仅 props 进.
 */
import { useEffect, useState } from "react";
import { db } from "../db/dexie";
import { TutorPanel } from "../components/tutor/TutorPanel";
import { AutoGenerateOnEmpty } from "../components/AutoGenerateOnEmpty";
import { SKILLS } from "../content/skills";
import { UNITS } from "../content/units";

// ─────────────────────────────────────────────────────────────────────
// StatCard — summary 统计卡 (4 种 tone × 2 size)
// ─────────────────────────────────────────────────────────────────────

export interface StatCardProps {
  label: string;
  value: string;
  tone?: "violet" | "amber" | "rose" | "emerald";
  big?: boolean;
}

export function StatCard({ label, value, tone = "violet", big }: StatCardProps) {
  const toneMap = {
    violet: "from-violet-500/20 to-fuchsia-500/10 border-violet-400/30 text-violet-100",
    amber: "from-amber-500/20 to-orange-500/10 border-amber-400/30 text-amber-100",
    rose: "from-rose-500/20 to-pink-500/10 border-rose-400/30 text-rose-100",
    emerald: "from-emerald-500/20 to-teal-500/10 border-emerald-400/30 text-emerald-100",
  }[tone];
  return (
    <div className={`rounded-2xl border p-3 bg-gradient-to-br ${toneMap} text-center`}>
      <div className="text-[11px] uppercase tracking-widest opacity-80">{label}</div>
      <div className={`font-display font-bold ${big ? "text-3xl" : "text-xl"} mt-1`}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SummaryReviewTutor — session 结束后"跟小进总结今天" 对话面板.
// 不展示 question, 仅以 review_session context 启动 tutor.
// ─────────────────────────────────────────────────────────────────────

export function SummaryReviewTutor({ onClose }: { onClose: () => void }) {
  const [studentId, setStudentId] = useState<string | null>(null);
  useEffect(() => {
    void (async () => {
      const ss = await db.students.toArray();
      setStudentId(ss[0]?.id ?? null);
    })();
  }, []);
  if (!studentId) return null;
  return (
    <TutorPanel
      subjectId="math"
      context="review_session"
      studentId={studentId}
      onClose={onClose}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────
// MathAutoGen — empty state 包装: 读 student 拿 currentTerm + studentId 后
// 传给 AutoGenerateOnEmpty 做"按学期出题".
// ─────────────────────────────────────────────────────────────────────

export interface MathAutoGenProps {
  reloadSession: () => void;
  preferredSkillId: string | undefined;
  starved: boolean;
}

export function MathAutoGen({ reloadSession, preferredSkillId, starved }: MathAutoGenProps) {
  const [studentInfo, setStudentInfo] = useState<{
    id: string;
    currentTerm: "上册" | "下册";
    currentUnitId: string | undefined;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const students = await db.students.toArray();
      const s = students[0];
      if (cancelled || !s) return;
      setStudentInfo({
        id: s.id,
        currentTerm: (s.currentTerm as "上册" | "下册") ?? "下册",
        currentUnitId: s.currentUnitId,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AutoGenerateOnEmpty
      subjectId="math"
      skills={SKILLS}
      units={UNITS}
      seedQuestions={[]}
      studentId={studentInfo?.id}
      currentTerm={studentInfo?.currentTerm ?? "下册"}
      preferredUnitId={studentInfo?.currentUnitId}
      onGenerated={reloadSession}
      autoStart={true}
      headlineText={
        starved
          ? "今天的题都被你做光啦！"
          : "题库还没准备好，让 AI 帮你出几道～"
      }
      // v0.27.1：自由练（preferredSkillId 已传）→ 单 skill 8 道；
      //          每日挑战（无 preferredSkillId）→ 跨 3 个最弱 skill 出 15 道综合题。
      count={preferredSkillId ? 8 : 15}
      multiSkillCount={preferredSkillId ? 1 : 3}
      preferredSkillId={preferredSkillId}
    />
  );
}
