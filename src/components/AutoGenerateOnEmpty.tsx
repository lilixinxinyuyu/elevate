/**
 * 没题时自动让 AI 出题。
 *
 * 触发场景：
 *   1. 全新设备 / 重置后 db 一张题都没有 → empty 状态进入这个组件
 *   2. 题做光（starved）后让用户点 "🤖 让 AI 出题" 按钮
 *
 * 选 skill 策略：
 *   - 如果有 mastery 数据：选最弱的（mastery 最低的）skill
 *   - 没有：随便选一个该 unit 的 skill
 *
 * 写完 db.questions 后调 onGenerated() 让父组件 reload session。
 */

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../db/dexie";
import { generateAiQuestions } from "../lib/tutor";
import { sfx } from "../lib/sfx";
import type { Question, Skill, CurriculumUnit } from "../core/types";

interface Props {
  /** "math" 或 "chinese"。决定怎么校验 + 用哪批 unit/skill */
  subjectId: "math" | "chinese";
  /** 该学科所有 skill */
  skills: Skill[];
  /** 该学科所有 unit */
  units: CurriculumUnit[];
  /** 该学科所有 seedQuestions（用作 existingStems 让 AI 别重复） */
  seedQuestions: Question[];
  /** 学生 id（拿 mastery 用） */
  studentId: string | undefined;
  /** 出题成功后通知父：刷新 session */
  onGenerated: () => void;
  /** 友好提示文本：例如"题被你做光啦"vs"先帮你出几道入门题" */
  headlineText?: string;
  /** 自动触发 vs. 等用户点按钮 */
  autoStart?: boolean;
  /** 优先生成的 skillId（错题挑战 / 自由练时知道目标 skill） */
  preferredSkillId?: string;
  /** 这次想出几道（默认 5） */
  count?: number;
  /** chinese 校验需要的 unit/skill 集合（math 用 core validateQuestion） */
  validateAsSubject?: "math" | "chinese";
}

interface Phase {
  status: "idle" | "running" | "success" | "failed";
  message?: string;
  generatedCount?: number;
}

export function AutoGenerateOnEmpty(props: Props) {
  const [phase, setPhase] = useState<Phase>({ status: "idle" });
  const startedRef = useRef(false);

  const pickSkillToTrain = async (): Promise<Skill | null> => {
    if (props.preferredSkillId) {
      const s = props.skills.find((x) => x.id === props.preferredSkillId);
      if (s) return s;
    }
    if (!props.studentId) {
      // 第一题之前 → 选难度最低、第一单元的 skill
      return (
        props.skills
          .filter((s) => s.unitId === props.units[0]?.id)
          .sort((a, b) => (a.difficultyBase ?? 3) - (b.difficultyBase ?? 3))[0] ??
        props.skills[0] ??
        null
      );
    }
    // 看 mastery：选最弱
    const masteryRows = await db.mastery
      .where("studentId")
      .equals(props.studentId)
      .filter((m) => m.subjectId === props.subjectId)
      .toArray();
    if (masteryRows.length === 0) return props.skills[0] ?? null;
    const masteryById = new Map(masteryRows.map((m) => [m.skillId, m.score]));
    const sorted = props.skills
      .map((s) => ({ s, m: masteryById.get(s.id) ?? 50 }))
      .sort((a, b) => a.m - b.m);
    return sorted[0]?.s ?? null;
  };

  const runGeneration = async () => {
    if (phase.status === "running") return;
    setPhase({ status: "running", message: "正在挑选最适合 Selena 的 skill…" });
    try {
      const skill = await pickSkillToTrain();
      if (!skill) {
        setPhase({ status: "failed", message: "找不到合适的 skill" });
        return;
      }
      const unit = props.units.find((u) => u.id === skill.unitId);
      setPhase({
        status: "running",
        message: `小进正在为「${skill.name}」出题，10-25 秒…`,
      });
      const existingStems = props.seedQuestions
        .filter((q) => q.skill_id === skill.id)
        .map((q) => q.stem)
        .slice(0, 30);

      const r = await generateAiQuestions({
        subjectId: props.subjectId,
        unitId: skill.unitId,
        unitName: unit?.name,
        skillId: skill.id,
        skillName: skill.name,
        count: props.count ?? 5,
        difficulty: "2-4",
        existingStems,
      });

      if (r.questions.length === 0) {
        setPhase({ status: "failed", message: "AI 出的题都没通过校验，再试一次。" });
        return;
      }

      // 写 db.questions（带 subjectId 标记）
      const stamped = r.questions.map((q) => ({
        ...q,
        subjectId: props.subjectId,
      }));
      await db.questions.bulkPut(stamped as never);

      sfx.chest();
      setPhase({
        status: "success",
        message: `小进帮你出了 ${stamped.length} 道新题！`,
        generatedCount: stamped.length,
      });
      // 通知父刷新 session
      setTimeout(() => props.onGenerated(), 800);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPhase({ status: "failed", message: msg });
    }
  };

  // 自动启动一次
  useEffect(() => {
    if (props.autoStart && !startedRef.current) {
      startedRef.current = true;
      void runGeneration();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.autoStart]);

  return (
    <div className="card-glow border-violet-400/40 bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-amber-500/10 text-center space-y-3 p-5">
      <div className="text-5xl animate-pop">{phase.status === "running" ? "🤖" : phase.status === "success" ? "🎉" : phase.status === "failed" ? "🤔" : "📝"}</div>

      <div className="font-display font-bold text-violet-100 text-xl">
        {phase.status === "idle" && (props.headlineText ?? "题库是空的")}
        {phase.status === "running" && "AI 正在出题…"}
        {phase.status === "success" && "出好了！开始练习吧～"}
        {phase.status === "failed" && "出题失败"}
      </div>

      <div className="text-sm text-slate-300 leading-relaxed">
        {phase.status === "idle" && (
          <span>
            让 AI 根据 Selena 当前的{" "}
            <span className="text-amber-300">学习情况</span>
            自动出几道<span className="text-amber-300">不重复</span>的题。
          </span>
        )}
        {phase.status === "running" && phase.message && (
          <span className="animate-pulse text-violet-200">{phase.message}</span>
        )}
        {phase.status === "success" && phase.message && (
          <span className="text-emerald-300">{phase.message}</span>
        )}
        {phase.status === "failed" && (
          <div>
            <div className="text-rose-300 break-all text-xs">{phase.message}</div>
            <div className="text-xs text-slate-400 mt-2">
              可能是 DashScope 配额问题，或者今天 AI 心情不好。
            </div>
          </div>
        )}
      </div>

      {phase.status === "idle" && (
        <button type="button" onClick={runGeneration} className="btn-primary text-sm">
          🤖 让 AI 给我出 {props.count ?? 5} 道题
        </button>
      )}

      {phase.status === "running" && (
        <div className="flex justify-center gap-1">
          <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <span
            className="w-2 h-2 rounded-full bg-violet-400 animate-pulse"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="w-2 h-2 rounded-full bg-violet-400 animate-pulse"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      )}

      {phase.status === "failed" && (
        <div className="flex gap-2 justify-center flex-wrap">
          <button
            type="button"
            onClick={() => {
              startedRef.current = false;
              void runGeneration();
            }}
            className="btn-primary text-sm"
          >
            🔄 再试一次
          </button>
          <Link
            to={`/${props.subjectId}/admin#ai-gen`}
            className="btn-secondary text-sm"
          >
            手动管理
          </Link>
        </div>
      )}
    </div>
  );
}
