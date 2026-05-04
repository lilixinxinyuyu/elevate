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
import { MascotAvatar } from "./MascotAvatar";
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
  /** 优先 unit（今日挑战时如果 student 有 currentUnitId 就用这个） */
  preferredUnitId?: string;
  /**
   * 当前学期（"上册" / "下册"）。
   * 关键：math 题库横跨 G4A 上册 + G4B 下册，没传就会随便挑到上册题。
   * Selena 在下册期中冲刺，只能出下册的题。
   */
  currentTerm?: "上册" | "下册";
  /** 这次想出几道（默认 8） */
  count?: number;
  /**
   * 同时跨几个 skill 出题（默认 1）。
   *
   * - 1：单 skill（自由练 / 错题挑战，传了 preferredSkillId 时用这个）
   * - 3：跨 3 个最弱 skill 各出 count/3 题（每日挑战 empty 时用这个，
   *   一次喂出综合度高的题包，不会"今天只刷工程量/产量合计"）
   *
   * 当 preferredSkillId 被显式传入时，**强制走 1 个 skill**（用户的明确选择）。
   */
  multiSkillCount?: number;
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
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /** 安全 setState — 组件卸载后不再触发渲染（避免离开页面后还更新） */
  const safeSetPhase = (p: Phase) => {
    if (mountedRef.current) setPhase(p);
  };

  /**
   * 选 N 个 skill。
   *
   * 优先级（v0.27.1 加 multiSkill 支持）：
   *   1. preferredSkillId 显式指定 → 只返回该 skill（无视 N，强制单 skill）
   *   2. 否则取 mastery 最弱的 N 个（少于 N 个就用全部）；mastery 都为空时
   *      从 currentTerm + currentUnit 随机选 N 个
   *
   * 关键：当 Selena 还没有任何 mastery 数据时，**随机化**避免每次都"小数意义"。
   */
  const pickSkillsToTrain = async (n: number): Promise<Skill[]> => {
    // 1. preferredSkillId 100% 优先（自由练时就该拿这个 skill 出题）
    if (props.preferredSkillId) {
      const s = props.skills.find((x) => x.id === props.preferredSkillId);
      if (s) return [s];
      console.warn(
        `[AutoGen] preferredSkillId="${props.preferredSkillId}" 不在 skills 列表里，落入兜底`,
      );
    }

    // 按当前学期过滤
    const termUnits = props.currentTerm
      ? props.units.filter((u) => u.term === props.currentTerm)
      : props.units;
    const termUnitIds = new Set(termUnits.map((u) => u.id));
    const termSkills = props.skills.filter((s) => termUnitIds.has(s.unitId));
    const candidates = termSkills.length > 0 ? termSkills : props.skills;

    // 2. preferred unit 优先（如果在 term 范围内）
    let unitFiltered = candidates;
    if (props.preferredUnitId) {
      const unitSkills = candidates.filter((s) => s.unitId === props.preferredUnitId);
      if (unitSkills.length > 0) unitFiltered = unitSkills;
    }

    // 3. 拿 mastery 数据
    let masteryById = new Map<string, number>();
    if (props.studentId) {
      const masteryRows = await db.mastery
        .where("studentId")
        .equals(props.studentId)
        .filter((m) => m.subjectId === props.subjectId)
        .toArray();
      masteryById = new Map(masteryRows.map((m) => [m.skillId, m.score]));
    }

    // 4. 有 mastery 数据：按 mastery 升序 + 加抖动（避免每次同一组）
    const withMastery = unitFiltered
      .map((s) => ({ s, m: masteryById.get(s.id) ?? 999 }))
      .sort((a, b) => a.m - b.m);
    if (withMastery.length > 0) {
      // 取最弱 N*2 里随机选 N 个，多样性更强
      const pool = withMastery.slice(0, Math.min(n * 2, withMastery.length));
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, n).map((x) => x.s);
    }

    // 5. 没 mastery：随机 N 个
    if (unitFiltered.length === 0) return candidates.slice(0, n);
    const easyish = unitFiltered.filter((s) => (s.difficultyBase ?? 3) <= 3);
    const pool = easyish.length > 0 ? easyish : unitFiltered;
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
  };

  const runGeneration = async () => {
    if (phase.status === "running") return;
    safeSetPhase({ status: "running", message: "正在挑选最适合 Selena 的 skill…" });
    try {
      // multiSkillCount 强制为 1（自由练）当显式给了 preferredSkillId
      const desiredSkillN = props.preferredSkillId ? 1 : Math.max(1, props.multiSkillCount ?? 1);
      const skills = await pickSkillsToTrain(desiredSkillN);
      if (skills.length === 0) {
        safeSetPhase({ status: "failed", message: "找不到合适的 skill" });
        return;
      }
      const totalCount = props.count ?? 8;
      const perSkill = Math.max(2, Math.ceil(totalCount / skills.length));

      // **客户端校验**：拦截垃圾题（缺字段 / answer 指向不存在选项 / stem 空白）
      // v0.28.1 加 multi_step 支持
      const isValid = (q: unknown): boolean => {
        if (!q || typeof q !== "object") return false;
        const o = q as Record<string, unknown>;
        if (typeof o.question_id !== "string" || !o.question_id.trim()) return false;
        if (typeof o.stem !== "string" || !o.stem.trim()) return false;
        if (!o.answer || typeof o.answer !== "object") return false;
        const ans = o.answer as { type?: string; value?: unknown };
        // multi_step：要求 subquestions 数组 ≥ 1，且 answer.type === "multi_step"
        if (ans.type === "multi_step") {
          if (!Array.isArray(o.subquestions) || o.subquestions.length === 0) return false;
          return true;
        }
        // choice / numeric / 默认：必须有 options
        if (!Array.isArray(o.options) || o.options.length < 2) return false;
        if (ans.type === "choice") {
          const optIds = (o.options as Array<{ id?: string }>)
            .map((x) => x?.id)
            .filter((x): x is string => typeof x === "string");
          if (typeof ans.value !== "string" || !optIds.includes(ans.value)) return false;
        }
        return true;
      };

      // 多 skill 并发出题（每个 skill 一次 LLM 请求，Promise.allSettled 等所有完成）
      const skillNames = skills.map((s) => `「${s.name}」`).join(skills.length > 1 ? "、" : "");
      safeSetPhase({
        status: "running",
        message:
          skills.length === 1
            ? `小进正在为${skillNames}出题，并发出 ${totalCount} 道，约 15-30 秒…`
            : `小进正在跨 ${skills.length} 个知识点 ${skillNames} 出 ${totalCount} 道综合题，约 20-40 秒…`,
      });

      const timeoutMs = skills.length > 1 ? 120_000 : 90_000;
      const tasks = skills.map(async (skill) => {
        const unit = props.units.find((u) => u.id === skill.unitId);
        const existingStems = props.seedQuestions
          .filter((q) => q.skill_id === skill.id)
          .map((q) => q.stem)
          .slice(0, 30);
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`AI 出题超时（${timeoutMs / 1000} 秒）`)), timeoutMs),
        );
        const r = await Promise.race([
          generateAiQuestions({
            subjectId: props.subjectId,
            unitId: skill.unitId,
            unitName: unit?.name,
            skillId: skill.id,
            skillName: skill.name,
            count: perSkill,
            difficulty: "2-4",
            term: props.currentTerm ?? "下册",
            existingStems,
          }),
          timeout,
        ]);
        return r.questions;
      });

      const settled = await Promise.allSettled(tasks);
      if (!mountedRef.current) return;

      const allQuestions: unknown[] = [];
      let failedSkills = 0;
      for (const s of settled) {
        if (s.status === "fulfilled") {
          allQuestions.push(...s.value);
        } else {
          failedSkills++;
          console.warn("[AutoGen] one skill batch failed:", s.reason);
        }
      }

      if (allQuestions.length === 0) {
        safeSetPhase({
          status: "failed",
          message:
            failedSkills === skills.length
              ? "AI 出题失败（全部跑题或超时），再试一次。"
              : "AI 出的题都没通过校验，再试一次。",
        });
        return;
      }

      const stamped = allQuestions
        .map((q) => ({ ...(q as object), subjectId: props.subjectId }))
        .filter(isValid);

      const rejected = allQuestions.length - stamped.length;
      if (stamped.length === 0) {
        safeSetPhase({
          status: "failed",
          message: `AI 出了 ${allQuestions.length} 道但全部校验失败（缺字段或答案不对应）`,
        });
        return;
      }
      if (rejected > 0) {
        console.warn(`[AutoGen] rejected ${rejected}/${allQuestions.length} bad questions`);
      }
      await db.questions.bulkPut(stamped as never);

      if (!mountedRef.current) return;
      sfx.chest();
      const skillSummary =
        skills.length === 1
          ? `小进帮你出了 ${stamped.length} 道新题！`
          : `小进跨 ${skills.length} 个知识点出了 ${stamped.length} 道综合题！`;
      safeSetPhase({
        status: "success",
        message: skillSummary,
        generatedCount: stamped.length,
      });
      // 通知父刷新 session（也只在还挂载时触发，避免后台导航）
      setTimeout(() => {
        if (mountedRef.current) props.onGenerated();
      }, 800);
    } catch (e) {
      if (!mountedRef.current) return;
      const msg = e instanceof Error ? e.message : String(e);
      safeSetPhase({ status: "failed", message: msg });
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
      {/* 头部：小进头像（running 时 pulse 发光，其他状态正常） */}
      <div className="flex justify-center">
        <div className={`relative ${phase.status === "running" ? "animate-pulse" : "animate-pop"}`}>
          <MascotAvatar size="lg" autoEnsure glow={phase.status !== "failed"} />
          {phase.status === "running" && (
            <div className="absolute inset-0 rounded-full ring-4 ring-violet-400/40 animate-ping pointer-events-none" />
          )}
          {phase.status === "success" && (
            <div className="absolute -top-1 -right-1 text-2xl animate-bounce">✨</div>
          )}
          {phase.status === "failed" && (
            <div className="absolute -top-1 -right-1 text-2xl">🤔</div>
          )}
        </div>
      </div>

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
              可能是 AI 配额满 / 网络抖动 / 模型暂时挂了。
              <br />
              再试一次大概率就能出来；连续 3 次失败再去管理页查诊断。
            </div>
          </div>
        )}
      </div>

      {phase.status === "idle" && (
        <button type="button" onClick={runGeneration} className="btn-primary text-sm">
          🤖 让 AI 给我出 {props.count ?? 8} 道题
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
