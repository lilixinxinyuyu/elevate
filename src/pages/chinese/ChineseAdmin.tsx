/**
 * 语文管理页 — 与 math admin 对齐的诊断和管控面板。
 *
 * 板块（参考 src/pages/Admin.tsx）：
 *  1. 概览（XP / 称号 / 平均掌握度 / 错题数 / 勋章数）
 *  2. 题库统计（按 4 单元，每单元题数 / skill 数 / 题型分布）
 *  3. 技能诊断（每个 skill 的 mastery / 准确率 / 近 7 天 / 题量）
 *  4. 错题列表（按 stage 分桶，未消化 / 到期可练 / 已 resolved）
 *  5. 最近 attempt 时间线（最近 30 条）
 *  6. TTS 测试（与 math admin 共用一份逻辑）
 *  7. 重置语文测试数据
 *  8. 模拟测试 cooldown 状态 + 强制清除按钮
 */

import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/dexie";
import { useSubject } from "../../subjects/context";
import { isTtsAvailable, speakText } from "../../lib/tts";
import {
  chineseLevelInfo,
  countChineseUnresolvedMistakes,
  getChineseMockExamCooldown,
  getChineseRecentAttempts,
  getChineseSkillMastery,
  getChineseTotalXp,
  getChineseTrophies,
  resetChineseTestData,
} from "../../subjects/chinese/service";
import { CHINESE_TROPHIES } from "../../subjects/chinese/trophies";
import { generateChineseQuestions } from "../../lib/tutor";
import type { Attempt, MasteryScore, MistakeReview, Question } from "../../core/types";

/**
 * 简化版 chinese 题校验：core/validateQuestion 只认 math 的 UNITS/SKILLS，
 * 这里给 chinese 写一份轻量校验，保证字段完整 + unit/skill id 在 chinese 注册表里。
 */
function validateChineseQuestion(
  raw: unknown,
  knownUnitIds: Set<string>,
  knownSkillIds: Set<string>,
): { ok: boolean; question?: Question; issues: { path: string; message: string; severity: "error" | "warning" }[] } {
  const issues: { path: string; message: string; severity: "error" | "warning" }[] = [];
  if (!raw || typeof raw !== "object") {
    return { ok: false, issues: [{ path: ".", message: "不是对象", severity: "error" }] };
  }
  const o = raw as Record<string, unknown>;
  const need = ["question_id", "stem", "unit_id", "skill_id", "options", "answer", "difficulty"];
  for (const f of need) {
    if (o[f] === undefined || o[f] === null || o[f] === "") {
      issues.push({ path: f, message: `字段缺失 ${f}`, severity: "error" });
    }
  }
  if (!Array.isArray(o.options) || (o.options as unknown[]).length < 2) {
    issues.push({ path: "options", message: "至少 2 个选项", severity: "error" });
  } else {
    const optIds = new Set(
      (o.options as Array<{ id?: string }>).map((x) => x.id ?? ""),
    );
    const ans = o.answer as { type?: string; value?: string };
    if (ans?.type !== "choice") {
      issues.push({ path: "answer.type", message: "必须为 choice", severity: "error" });
    } else if (!optIds.has(ans.value ?? "")) {
      issues.push({ path: "answer.value", message: `${ans.value} 不在 options id 集合内`, severity: "error" });
    }
  }
  if (typeof o.unit_id === "string" && !knownUnitIds.has(o.unit_id)) {
    issues.push({ path: "unit_id", message: `未知单元 ${o.unit_id}（chinese 注册表里没有）`, severity: "error" });
  }
  if (typeof o.skill_id === "string" && !knownSkillIds.has(o.skill_id)) {
    issues.push({ path: "skill_id", message: `未知技能 ${o.skill_id}（chinese 注册表里没有）`, severity: "error" });
  }
  // 内容安全（与 core 一致的子集）
  const FORBIDDEN = [/笨|粗心鬼|真差|没用/, /充值|抽奖|点击领取|付费/];
  const stem = typeof o.stem === "string" ? o.stem : "";
  for (const re of FORBIDDEN) {
    if (re.test(stem)) {
      issues.push({ path: "stem", message: `命中禁词 ${re}`, severity: "error" });
    }
  }
  const hasError = issues.some((i) => i.severity === "error");
  if (hasError) return { ok: false, issues };
  // 补全 default 字段方便存 db（先散开 raw，再补空缺字段）
  const fromRaw = o as unknown as Question;
  const q: Question = {
    ...fromRaw,
    version: fromRaw.version ?? 1,
    status: fromRaw.status ?? "approved",
    grade: fromRaw.grade ?? 4,
    term: fromRaw.term ?? "下册",
    estimated_time_seconds: fromRaw.estimated_time_seconds ?? 25,
    cognitive_level: fromRaw.cognitive_level ?? "conceptual",
    ability_dimension: fromRaw.ability_dimension ?? ["vocabulary"],
    exam_priority: fromRaw.exam_priority ?? "HIGH_BIG",
    question_format: fromRaw.question_format ?? "single_choice",
    game_type: fromRaw.game_type ?? "plain_choice",
    common_errors: fromRaw.common_errors ?? [],
    feedback_correct: fromRaw.feedback_correct ?? "",
    feedback_wrong: fromRaw.feedback_wrong ?? "",
    solution_steps: fromRaw.solution_steps ?? [],
    subjectId: "chinese",
  };
  return { ok: true, question: q, issues };
}

export function ChineseAdminPage() {
  const subject = useSubject();
  const student = useLiveQuery(async () => (await db.students.toArray())[0]);

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="font-semibold mb-2">📊 语文学习概览</div>
        <ChineseOverviewPanel studentId={student?.id} />
      </div>

      <div className="card">
        <div className="font-semibold mb-2">📚 题库统计</div>
        <ChineseQuestionStatsPanel
          questions={subject.seedQuestions}
          skills={subject.skills}
          units={subject.units}
        />
      </div>

      <div className="card">
        <div className="font-semibold mb-2">🎯 技能诊断（每个 skill 的掌握度）</div>
        <ChineseSkillDiagnosticsPanel studentId={student?.id} />
      </div>

      <div className="card">
        <div className="font-semibold mb-2">🪄 错题分布</div>
        <ChineseMistakesPanel studentId={student?.id} />
      </div>

      <div className="card">
        <div className="font-semibold mb-2">⏱️ 最近 30 次答题</div>
        <ChineseRecentAttemptsPanel studentId={student?.id} />
      </div>

      <div className="card">
        <div className="font-semibold mb-2">📝 模拟测试 cooldown</div>
        <ChineseMockExamPanel studentId={student?.id} />
      </div>

      <div className="card">
        <div className="font-semibold mb-2">🎧 TTS 测试（小进 Cherry 童声）</div>
        <ChineseTtsPanel />
      </div>

      <div className="card">
        <div className="font-semibold mb-2">🤖 AI 自动出题（按薄弱 skill 生成）</div>
        <AIQuestionGeneratorPanel />
      </div>

      <div className="card">
        <div className="font-semibold mb-2">🧹 重置语文测试数据</div>
        <ChineseResetPanel studentId={student?.id} />
      </div>
    </div>
  );
}

// ============================================================
//  AI 自动出题面板
// ============================================================

function AIQuestionGeneratorPanel() {
  const subject = useSubject();
  const [unitId, setUnitId] = useState<string>(subject.units[0]?.id ?? "");
  const [skillId, setSkillId] = useState<string>(
    subject.skills.find((s) => s.unitId === (subject.units[0]?.id ?? ""))?.id ?? "",
  );
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("2-4");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | {
    generated: Question[];
    valid: Question[];
    invalid: { id: string; issues: string[] }[];
    model: string;
  }>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const skillsForUnit = subject.skills.filter((s) => s.unitId === unitId);

  const onGenerate = async () => {
    if (!unitId || !skillId) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setSavedCount(null);
    try {
      const unit = subject.units.find((u) => u.id === unitId);
      const skill = subject.skills.find((s) => s.id === skillId);
      // 把同一 skill 的现有题干扔给 AI 当避免重复参考
      const existingStems = subject.seedQuestions
        .filter((q) => q.skill_id === skillId)
        .map((q) => q.stem)
        .slice(0, 30);

      const r = await generateChineseQuestions({
        subjectId: "chinese",
        unitId,
        unitName: unit?.name,
        skillId,
        skillName: skill?.name,
        count,
        difficulty,
        existingStems,
      });

      // 用 chinese-specific 校验（core/validateQuestion 只认 math 的 unit/skill）
      const knownUnits = new Set(subject.units.map((u) => u.id));
      const knownSkills = new Set(subject.skills.map((s) => s.id));
      const valid: Question[] = [];
      const invalid: { id: string; issues: string[] }[] = [];
      for (const q of r.questions) {
        const v = validateChineseQuestion(q, knownUnits, knownSkills);
        if (v.ok && v.question) valid.push(v.question);
        else
          invalid.push({
            id: q.question_id,
            issues: v.issues.map((i) => `${i.severity}: ${i.path} ${i.message}`),
          });
      }
      setResult({ generated: r.questions, valid, invalid, model: r.model });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    if (!result || result.valid.length === 0) return;
    setBusy(true);
    try {
      await db.questions.bulkPut(result.valid as never);
      setSavedCount(result.valid.length);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="text-sm space-y-3">
      <div className="text-xs text-slate-400 leading-relaxed">
        让 qwen-plus 按当前选的单元 / 技能 / 难度，自动生成新题。生成后会跑客户端
        validateQuestion 校验，然后你点&nbsp;"导入到题库"&nbsp;写进 db.questions。
        ChineseTrain 会自动从 db.questions 拉 chinese 题，无需重启。
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-slate-500">单元</span>
          <select
            value={unitId}
            onChange={(e) => {
              setUnitId(e.target.value);
              const first = subject.skills.find((s) => s.unitId === e.target.value);
              if (first) setSkillId(first.id);
            }}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-ink-800 text-slate-200 px-2 py-1.5"
          >
            {subject.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">技能</span>
          <select
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-ink-800 text-slate-200 px-2 py-1.5"
          >
            {skillsForUnit.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-slate-500">数量（1-10）</span>
          <input
            type="number"
            min={1}
            max={10}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1)))}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-ink-800 text-slate-200 px-2 py-1.5"
          />
        </label>
        <label className="block">
          <span className="text-xs text-slate-500">难度（如 2-4）</span>
          <input
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-600 bg-ink-800 text-slate-200 px-2 py-1.5"
          />
        </label>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={onGenerate}
          disabled={busy || !unitId || !skillId}
          className="btn-primary text-sm"
        >
          {busy ? "AI 出题中…" : "🤖 让 AI 出题"}
        </button>
        {result && result.valid.length > 0 && savedCount === null && (
          <button
            type="button"
            onClick={onSave}
            disabled={busy}
            className="btn-secondary text-sm border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/10"
          >
            💾 导入 {result.valid.length} 道到题库
          </button>
        )}
        {savedCount !== null && (
          <span className="text-emerald-300 text-xs self-center">
            ✓ 已写入 {savedCount} 道，回到 /chinese/train 就能练到
          </span>
        )}
      </div>

      {error && (
        <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded p-2 break-all">
          ⚠ {error}
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="text-xs text-slate-400">
            模型：<span className="text-slate-200">{result.model}</span> · 生成{" "}
            {result.generated.length} 道，校验通过 {result.valid.length} 道，
            {result.invalid.length > 0 && (
              <span className="text-rose-300">失败 {result.invalid.length} 道</span>
            )}
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-2">
            {result.valid.map((q) => (
              <div
                key={q.question_id}
                className="rounded border border-emerald-400/30 bg-emerald-500/5 p-2 text-xs"
              >
                <div className="text-slate-100">{q.stem}</div>
                <div className="text-[10px] text-slate-500 mt-1">
                  D{q.difficulty} ·{" "}
                  {(q.options ?? []).length} 选项 · 答案{" "}
                  {(q.answer as { type: "choice"; value: string }).value}
                </div>
              </div>
            ))}
            {result.invalid.map((f) => (
              <div
                key={f.id}
                className="rounded border border-rose-400/30 bg-rose-500/5 p-2 text-xs"
              >
                <div className="text-rose-300">✗ {f.id}</div>
                <ul className="list-disc list-inside text-[10px] text-rose-200/80 mt-1">
                  {f.issues.slice(0, 3).map((i, k) => (
                    <li key={k}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
//  概览
// ============================================================

function ChineseOverviewPanel({ studentId }: { studentId: string | undefined }) {
  const [data, setData] = useState<null | {
    xp: number;
    level: ReturnType<typeof chineseLevelInfo>;
    masteryAvg: number;
    masteryCount: number;
    mistakeCount: number;
    trophyCount: number;
  }>(null);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    (async () => {
      const [xp, mastery, mistakes, trophies] = await Promise.all([
        getChineseTotalXp(studentId),
        getChineseSkillMastery(studentId),
        countChineseUnresolvedMistakes(studentId),
        getChineseTrophies(studentId),
      ]);
      if (cancelled) return;
      const ownedCount = Array.from(trophies.ownedCounts.values()).reduce((s, n) => s + n, 0);
      const masteryAvg =
        mastery.length > 0
          ? Math.round(mastery.reduce((s, m) => s + m.score, 0) / mastery.length)
          : 0;
      setData({
        xp,
        level: chineseLevelInfo(xp),
        masteryAvg,
        masteryCount: mastery.length,
        mistakeCount: mistakes,
        trophyCount: ownedCount,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (!studentId) return <div className="text-sm text-slate-500">没有学生档案</div>;
  if (!data) return <div className="text-sm text-slate-400">载入中…</div>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
      <div className="rounded-lg border border-white/10 bg-white/5 p-2">
        <div className="text-[11px] text-slate-400">称号 / Lv</div>
        <div className="font-display font-bold text-amber-300">
          {data.level.title} · Lv {data.level.level}
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">
          {data.level.xpThisLevel} / {data.level.xpNextLevel} XP
        </div>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/5 p-2">
        <div className="text-[11px] text-slate-400">总 XP</div>
        <div className="font-display font-bold text-violet-300">{data.xp}</div>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/5 p-2">
        <div className="text-[11px] text-slate-400">平均掌握度</div>
        <div
          className={`font-display font-bold ${
            data.masteryAvg >= 80
              ? "text-emerald-300"
              : data.masteryAvg >= 60
                ? "text-amber-300"
                : "text-rose-300"
          }`}
        >
          {data.masteryCount > 0 ? data.masteryAvg : "—"}
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">{data.masteryCount} 个 skill</div>
      </div>
      <div className="rounded-lg border border-white/10 bg-white/5 p-2">
        <div className="text-[11px] text-slate-400">未消化错题 / 勋章</div>
        <div className="font-display font-bold">
          <span className="text-rose-300">{data.mistakeCount}</span>{" "}
          <span className="text-slate-500 text-xs">/</span>{" "}
          <span className="text-amber-300">{data.trophyCount}</span>
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">
          {CHINESE_TROPHIES.length} 类勋章
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  题库统计
// ============================================================

function ChineseQuestionStatsPanel({
  questions,
  skills,
  units,
}: {
  questions: ReturnType<typeof useSubject>["seedQuestions"];
  skills: ReturnType<typeof useSubject>["skills"];
  units: ReturnType<typeof useSubject>["units"];
}) {
  // 按单元统计
  const stats = useMemo(() => {
    const byUnit = new Map<string, number>();
    const byGameType = new Map<string, number>();
    const byDifficulty = new Map<number, number>();
    for (const q of questions) {
      byUnit.set(q.unit_id, (byUnit.get(q.unit_id) ?? 0) + 1);
      byGameType.set(q.game_type, (byGameType.get(q.game_type) ?? 0) + 1);
      byDifficulty.set(q.difficulty, (byDifficulty.get(q.difficulty) ?? 0) + 1);
    }
    return { byUnit, byGameType, byDifficulty };
  }, [questions]);

  return (
    <div className="text-sm space-y-3">
      <div className="text-xs text-slate-400">
        共 {questions.length} 道题 · {skills.length} 个 skill · {units.length} 个单元
      </div>

      {/* 按单元 */}
      <div>
        <div className="text-xs text-slate-500 mb-1">按单元</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {units.map((u) => {
            const n = stats.byUnit.get(u.id) ?? 0;
            const sk = skills.filter((s) => s.unitId === u.id).length;
            return (
              <div key={u.id} className="rounded-lg border border-white/10 bg-white/5 p-2">
                <div className="font-medium text-slate-100">{u.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {n} 题 · {sk} 个 skill
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 题型分布 */}
      <div>
        <div className="text-xs text-slate-500 mb-1">题型分布（game_type）</div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from(stats.byGameType.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([gt, n]) => (
              <span
                key={gt}
                className="chip bg-violet-500/10 border border-violet-400/30 text-violet-200 text-xs"
              >
                {gt} <span className="text-slate-400">×{n}</span>
              </span>
            ))}
        </div>
      </div>

      {/* 难度分布 */}
      <div>
        <div className="text-xs text-slate-500 mb-1">难度分布</div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((d) => {
            const n = stats.byDifficulty.get(d) ?? 0;
            return (
              <div key={d} className="flex-1 rounded border border-white/10 bg-white/5 p-1.5 text-center">
                <div className="text-[10px] text-slate-500">D{d}</div>
                <div className="font-display font-bold text-sm">{n}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================
//  技能诊断
// ============================================================

function ChineseSkillDiagnosticsPanel({ studentId }: { studentId: string | undefined }) {
  const subject = useSubject();
  const [mastery, setMastery] = useState<MasteryScore[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [filter, setFilter] = useState<"weak" | "all">("weak");

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    (async () => {
      const [m, a] = await Promise.all([
        getChineseSkillMastery(studentId),
        getChineseRecentAttempts(studentId, 1000),
      ]);
      if (cancelled) return;
      setMastery(m);
      setAttempts(a);
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const diag = useMemo(() => {
    const masteryById = new Map(mastery.map((m) => [m.skillId, m]));
    return subject.skills.map((s) => {
      const m = masteryById.get(s.id);
      const skillAttempts = attempts.filter((a) => a.skillId === s.id);
      const correct = skillAttempts.filter((a) => a.isCorrect).length;
      const recent = skillAttempts.filter(
        (a) => a.createdAt >= Date.now() - 7 * 24 * 60 * 60 * 1000,
      );
      const recentCorrect = recent.filter((a) => a.isCorrect).length;
      const totalQ = subject.seedQuestions.filter((q) => q.skill_id === s.id).length;
      return {
        skill: s,
        mastery: m?.score ?? 0,
        attempts: skillAttempts.length,
        correct,
        accuracy: skillAttempts.length > 0 ? correct / skillAttempts.length : 0,
        recentAttempts: recent.length,
        recentAccuracy: recent.length > 0 ? recentCorrect / recent.length : 0,
        lastAt: m?.lastPracticedAt ?? 0,
        questionTotal: totalQ,
      };
    });
  }, [mastery, attempts, subject]);

  if (!studentId) return <div className="text-sm text-slate-500">没有学生档案</div>;

  let view = diag.filter((d) => d.attempts > 0);
  if (filter === "weak") {
    view = view
      .filter((d) => d.mastery < 75 || d.recentAccuracy < 0.7)
      .sort((a, b) => a.mastery - b.mastery);
  } else {
    view = view.sort((a, b) => a.mastery - b.mastery);
  }

  return (
    <div className="text-sm space-y-3">
      <div className="flex gap-2 text-xs">
        <button
          type="button"
          className={`chip ${
            filter === "weak"
              ? "bg-rose-500/30 text-rose-100 border border-rose-400/40"
              : "bg-white/5 text-slate-400"
          }`}
          onClick={() => setFilter("weak")}
        >
          薄弱（{diag.filter((d) => d.attempts > 0 && (d.mastery < 75 || d.recentAccuracy < 0.7)).length}）
        </button>
        <button
          type="button"
          className={`chip ${
            filter === "all"
              ? "bg-rose-500/30 text-rose-100 border border-rose-400/40"
              : "bg-white/5 text-slate-400"
          }`}
          onClick={() => setFilter("all")}
        >
          全部练过（{diag.filter((d) => d.attempts > 0).length}）
        </button>
      </div>
      {view.length === 0 ? (
        <div className="text-slate-500 text-xs">还没有练习数据</div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
          {view.map((d) => {
            const acc = Math.round(d.accuracy * 100);
            const recentAcc = Math.round(d.recentAccuracy * 100);
            const masteryColor =
              d.mastery >= 85 ? "text-emerald-300" : d.mastery >= 70 ? "text-amber-300" : "text-rose-300";
            const lastAgo =
              d.lastAt > 0
                ? Math.floor((Date.now() - d.lastAt) / (24 * 60 * 60 * 1000))
                : null;
            return (
              <div key={d.skill.id} className="rounded-lg border border-white/10 bg-white/5 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-slate-100 truncate">{d.skill.name}</div>
                  <span className={`chip ${masteryColor} bg-white/5 border border-current/30 shrink-0`}>
                    熟练 {Math.round(d.mastery)}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>共 {d.attempts} 次（{acc}%）</span>
                  <span>近 7 天 {d.recentAttempts} 次（{recentAcc}%）</span>
                  <span>题库 {d.questionTotal} 道</span>
                  {lastAgo != null && (
                    <span className="text-slate-500">
                      {lastAgo > 0 ? `${lastAgo} 天前` : "今天"}
                    </span>
                  )}
                  {d.questionTotal < 5 && (
                    <span className="text-amber-300">⚠ 题量不足</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
//  错题分布
// ============================================================

function ChineseMistakesPanel({ studentId }: { studentId: string | undefined }) {
  const [mistakes, setMistakes] = useState<MistakeReview[]>([]);
  const subject = useSubject();

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    (async () => {
      const all = await db.mistakes
        .where("studentId")
        .equals(studentId)
        .filter((m) => m.subjectId === "chinese")
        .toArray();
      if (cancelled) return;
      setMistakes(all);
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (!studentId) return <div className="text-sm text-slate-500">没有学生档案</div>;

  const byStage = {
    fresh: mistakes.filter((m) => !m.resolved && m.stage === 0),
    stage1: mistakes.filter((m) => !m.resolved && m.stage === 1),
    stage2: mistakes.filter((m) => !m.resolved && m.stage === 2),
    resolved: mistakes.filter((m) => m.resolved),
  };
  const due = mistakes.filter((m) => !m.resolved && m.nextReviewAt <= Date.now());
  const qById = new Map(subject.seedQuestions.map((q) => [q.question_id, q]));

  return (
    <div className="text-sm space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="rounded-lg border border-rose-400/30 bg-rose-500/10 p-2">
          <div className="text-[11px] text-rose-300">刚错（stage 0）</div>
          <div className="font-display font-bold text-rose-200">{byStage.fresh.length}</div>
        </div>
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-2">
          <div className="text-[11px] text-amber-300">3 天后</div>
          <div className="font-display font-bold text-amber-200">{byStage.stage1.length}</div>
        </div>
        <div className="rounded-lg border border-violet-400/30 bg-violet-500/10 p-2">
          <div className="text-[11px] text-violet-300">7 天后</div>
          <div className="font-display font-bold text-violet-200">{byStage.stage2.length}</div>
        </div>
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-2">
          <div className="text-[11px] text-emerald-300">已彻底掌握</div>
          <div className="font-display font-bold text-emerald-200">{byStage.resolved.length}</div>
        </div>
      </div>

      <div className="text-xs text-slate-400">
        到期可练 {due.length} 道 · 总错题 {mistakes.length}（resolved 标准：连续答对 3 次）
      </div>

      {/* 列出最近 10 道未消化错题 */}
      {mistakes.filter((m) => !m.resolved).slice(0, 10).length > 0 && (
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-2">
          {mistakes
            .filter((m) => !m.resolved)
            .sort((a, b) => a.nextReviewAt - b.nextReviewAt)
            .slice(0, 10)
            .map((m) => {
              const q = qById.get(m.questionId);
              const dueIn = m.nextReviewAt - Date.now();
              const dueLabel =
                dueIn <= 0
                  ? "可练"
                  : `${Math.ceil(dueIn / (24 * 60 * 60 * 1000))}天后`;
              return (
                <div
                  key={m.id}
                  className="rounded border border-white/10 bg-white/5 p-2 text-xs flex items-start gap-2"
                >
                  <span className="chip bg-rose-500/20 text-rose-200 border border-rose-400/30 text-[10px] shrink-0">
                    s{m.stage}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-200 line-clamp-2">
                      {q?.stem ?? `(题已删除：${m.questionId})`}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {q?.skill_name ?? m.skillId} · {dueLabel}
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}

// ============================================================
//  最近 attempt
// ============================================================

function ChineseRecentAttemptsPanel({ studentId }: { studentId: string | undefined }) {
  const subject = useSubject();
  const [attempts, setAttempts] = useState<Attempt[]>([]);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    (async () => {
      const a = await getChineseRecentAttempts(studentId, 30);
      if (cancelled) return;
      setAttempts(a);
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (!studentId) return <div className="text-sm text-slate-500">没有学生档案</div>;
  if (attempts.length === 0)
    return <div className="text-xs text-slate-500">还没做过题</div>;

  const qById = new Map(subject.seedQuestions.map((q) => [q.question_id, q]));

  // 按"距今多久"分桶
  const fmt = (t: number) => {
    const diff = Date.now() - t;
    if (diff < 60_000) return "刚刚";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
    return `${Math.floor(diff / 86_400_000)} 天前`;
  };

  return (
    <div className="text-sm space-y-1.5 max-h-64 overflow-y-auto pr-2">
      {attempts.map((a) => {
        const q = qById.get(a.questionId);
        return (
          <div
            key={a.id}
            className="rounded border border-white/10 bg-white/5 p-2 text-xs flex items-center gap-2"
          >
            <span
              className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-sm ${
                a.isCorrect
                  ? "bg-emerald-500/30 text-emerald-200"
                  : "bg-rose-500/30 text-rose-200"
              }`}
            >
              {a.isCorrect ? "✓" : "✗"}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-slate-200 truncate">
                {q?.stem ?? `(题已删除：${a.questionId})`}
              </div>
              <div className="text-[10px] text-slate-500">
                {q?.skill_name ?? a.skillId} · {a.elapsedSeconds}s · +{a.scoreDelta?.total ?? 0} XP · {fmt(a.createdAt)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
//  模拟测试 cooldown
// ============================================================

function ChineseMockExamPanel({ studentId }: { studentId: string | undefined }) {
  const [info, setInfo] = useState<{
    available: boolean;
    daysUntilNext: number;
    lastAt: number | null;
  } | null>(null);

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;
    (async () => {
      const i = await getChineseMockExamCooldown(studentId);
      if (cancelled) return;
      setInfo(i);
    })();
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const onForceClear = async () => {
    if (!studentId) return;
    if (!window.confirm("强制清除模拟测试 cooldown，下一次立即可用？")) return;
    await db.meta.delete(`chineseMockExamLastAt::chinese::${studentId}`);
    setInfo({ available: true, daysUntilNext: 0, lastAt: null });
  };

  if (!studentId) return <div className="text-sm text-slate-500">没有学生档案</div>;
  if (!info) return <div className="text-sm text-slate-400">载入中…</div>;

  return (
    <div className="text-sm space-y-2">
      <div className="text-xs text-slate-400">
        模拟测试每 6 天可做一次。当前：
        {info.available ? (
          <span className="text-emerald-300 ml-1">✓ 可用</span>
        ) : (
          <span className="text-amber-300 ml-1">
            ⏳ 还需 {info.daysUntilNext} 天
          </span>
        )}
      </div>
      {info.lastAt && (
        <div className="text-[11px] text-slate-500">
          上次完成：{new Date(info.lastAt).toLocaleString()}
        </div>
      )}
      {!info.available && (
        <button
          type="button"
          onClick={onForceClear}
          className="btn-ghost text-xs text-amber-300 border border-amber-400/30"
        >
          强制清除 cooldown
        </button>
      )}
    </div>
  );
}

// ============================================================
//  TTS 测试
// ============================================================

function ChineseTtsPanel() {
  const [status, setStatus] = useState<"idle" | "checking" | "ok" | "missing" | "error">("idle");
  const [reason, setReason] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [text, setText] = useState("你好，我是小进。今天我们一起练习语文。");

  useEffect(() => {
    let cancelled = false;
    setStatus("checking");
    isTtsAvailable().then((r) => {
      if (cancelled) return;
      if (!r.ok) {
        setStatus("error");
        setReason(r.reason ?? "unknown");
      } else if (!r.configured) {
        setStatus("missing");
      } else {
        setStatus("ok");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const play = async () => {
    setPlaying(true);
    setReason(null);
    try {
      await speakText(text);
    } catch (e) {
      setReason(e instanceof Error ? e.message : String(e));
    } finally {
      setPlaying(false);
    }
  };

  return (
    <div className="text-sm text-slate-300 space-y-3">
      <div>
        服务端：
        {status === "checking" && <span className="text-slate-400">检查中…</span>}
        {status === "ok" && <span className="text-emerald-300">✓ 已配置</span>}
        {status === "missing" && (
          <span className="text-amber-300">⚠ DASHSCOPE_API_KEY 没配</span>
        )}
        {status === "error" && (
          <span className="text-rose-300">✗ 检查失败：{reason}</span>
        )}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        className="field text-sm w-full"
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={playing || status !== "ok" || !text.trim()}
          onClick={play}
        >
          {playing ? "播放中…" : "▶ 播放"}
        </button>
        {reason && (
          <span className="text-xs text-rose-300 break-all">{reason}</span>
        )}
      </div>
    </div>
  );
}

// ============================================================
//  重置数据
// ============================================================

function ChineseResetPanel({ studentId }: { studentId: string | undefined }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | {
    attempts: number;
    mastery: number;
    mistakes: number;
    trophies: number;
    metaKeys: number;
  }>(null);

  const onReset = async () => {
    if (!studentId) return;
    if (
      !window.confirm(
        "确定清空语文学科的所有学习数据？\n\n会删：attempts / mastery / mistakes / trophies / 语文 totalXp。\n数学数据完全不动。",
      )
    )
      return;
    setBusy(true);
    setResult(null);
    try {
      const r = await resetChineseTestData(studentId);
      setResult(r);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="text-sm text-slate-300 space-y-2">
      <div className="text-xs text-slate-400">
        清空 chinese 维度的所有学习数据。数学数据 100% 不受影响。
      </div>
      <button
        type="button"
        onClick={onReset}
        disabled={busy || !studentId}
        className="btn-secondary text-sm border border-rose-400/30 text-rose-200 hover:bg-rose-500/10"
      >
        {busy ? "清理中…" : "🧹 清空语文测试数据"}
      </button>
      {result && (
        <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 rounded p-2">
          ✓ 已清空：{result.attempts} attempts · {result.mastery} mastery ·{" "}
          {result.mistakes} mistakes · {result.trophies} trophies ·{" "}
          {result.metaKeys} meta keys
        </div>
      )}
    </div>
  );
}
