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
   * 选 skill 顺序（Round 5 修复"永远选小数意义"bug）：
   *   1. preferredSkillId（自由练 / 错题挑战明确指定）→ 一定优先
   *   2. preferredUnitId + mastery 排序 → 在指定 unit 里挑最弱
   *   3. currentTerm 范围内 mastery 最弱（有数据的，剔除"没碰过"的）
   *   4. 没有 mastery 数据：随机从 currentTerm + currentUnit 范围里挑
   *      （而不是按难度降序总挑同一个）
   *
   * 关键：当 Selena 还没有任何 mastery 数据时，**随机化**避免每次都"小数意义"。
   */
  const pickSkillToTrain = async (): Promise<Skill | null> => {
    // 1. preferredSkillId 100% 优先（自由练时就该拿这个 skill 出题）
    if (props.preferredSkillId) {
      const s = props.skills.find((x) => x.id === props.preferredSkillId);
      if (s) return s;
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

    // 4. 真有 mastery 数据的 skill 优先：mastery 越低越优先（薄弱的先练）
    const skillsWithMastery = unitFiltered.filter((s) => masteryById.has(s.id));
    if (skillsWithMastery.length > 0) {
      // 排序后取最弱的，但加点抖动避免永远同一个
      const weakest = skillsWithMastery
        .map((s) => ({ s, m: masteryById.get(s.id)! }))
        .sort((a, b) => a.m - b.m);
      // 取最弱 3 个里随机一个，避免反复刷同一题
      const top3 = weakest.slice(0, Math.min(3, weakest.length));
      return top3[Math.floor(Math.random() * top3.length)]!.s;
    }

    // 5. 没有任何 mastery 数据 → 完全随机（按难度低优先 + 随机）
    if (unitFiltered.length === 0) return candidates[0] ?? null;
    // 难度低的（base ≤ 3）先随机，没合适再扩
    const easyish = unitFiltered.filter((s) => (s.difficultyBase ?? 3) <= 3);
    const pool = easyish.length > 0 ? easyish : unitFiltered;
    return pool[Math.floor(Math.random() * pool.length)] ?? null;
  };

  const runGeneration = async () => {
    if (phase.status === "running") return;
    safeSetPhase({ status: "running", message: "正在挑选最适合 Selena 的 skill…" });
    try {
      const skill = await pickSkillToTrain();
      if (!skill) {
        safeSetPhase({ status: "failed", message: "找不到合适的 skill" });
        return;
      }
      const unit = props.units.find((u) => u.id === skill.unitId);
      safeSetPhase({
        status: "running",
        message: `小进正在为「${skill.name}」出题，并发出 ${props.count ?? 8} 道，约 15-30 秒…`,
      });
      const existingStems = props.seedQuestions
        .filter((q) => q.skill_id === skill.id)
        .map((q) => q.stem)
        .slice(0, 30);

      // Round 6: 服务端改成并发 4 题/批，30 题 ~25s；客户端 90s 兜底
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("AI 出题超时（90 秒）")), 90_000),
      );
      const r = await Promise.race([
        generateAiQuestions({
          subjectId: props.subjectId,
          unitId: skill.unitId,
          unitName: unit?.name,
          skillId: skill.id,
          skillName: skill.name,
          // 默认改 8 道，内部分 2 个并发批次跑
          count: props.count ?? 8,
          difficulty: "2-4",
          term: props.currentTerm ?? "下册",
          existingStems,
        }),
        timeout,
      ]);

      if (!mountedRef.current) return; // 组件已卸载（用户离开页面）

      if (r.questions.length === 0) {
        safeSetPhase({ status: "failed", message: "AI 出的题都没通过校验，再试一次。" });
        return;
      }

      const stamped = r.questions.map((q) => ({
        ...q,
        subjectId: props.subjectId,
      }));
      await db.questions.bulkPut(stamped as never);

      if (!mountedRef.current) return;
      sfx.chest();
      safeSetPhase({
        status: "success",
        message: `小进帮你出了 ${stamped.length} 道新题！`,
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
