/**
 * 题库诊断面板：
 *   - 各 skill 题数（Top 20 排序）
 *   - 检测垃圾题（缺字段 / answer 指向不存在选项 / stem 空白 / 重复 stem）
 *   - 一键清理垃圾题
 *   - 一键清理超量 AI 题（每 skill 保留前 N 道）
 *   - 🤖 AI 质检（v0.28.4）：让 qwen-plus 按 prompts/quality-rubric.md 判定题目
 *
 * 用于：用户报"题数虚高 / 部分题不见 / AI 出题失败但题在涨" 时的排查工具。
 */

import { useEffect, useMemo, useState } from "react";
import { db } from "../db/dexie";
import type { Question } from "../core/types";
import { SKILLS } from "../content/skills";
import { UNITS } from "../content/units";
import { recordDeletedQuestionIds } from "../db/seed";
import {
  judgeQuestionsInBatches,
  type Judgment,
  type JudgeProgress,
  type JudgeVerdict,
} from "../lib/qualityJudge";

interface QStats {
  total: number;
  bySkill: { skillId: string; skillName: string; count: number; aiGen: number }[];
  bad: { reason: string; q: Pick<Question, "question_id" | "stem" | "skill_id"> }[];
  duplicateStems: number;
  aiGenTotal: number;
  seedTotal: number;
  bySubject: { math: number; chinese: number; undef: number };
}

const SKILL_NAME = new Map(SKILLS.map((s) => [s.id, s.name]));
const SKILL_BY_UNIT = new Map<string, string[]>();
for (const s of SKILLS) {
  const arr = SKILL_BY_UNIT.get(s.unitId) ?? [];
  arr.push(s.id);
  SKILL_BY_UNIT.set(s.unitId, arr);
}

/**
 * 只有"基于选项"的题型需要校验 options + answer.value 对应。
 * 迷你游戏（balance_lab / shop_counter / equation_builder / vertical_repair /
 * speed_match / sort_ladder / poem_cloze / pair_match / sentence_shuffle 等）
 * 不用 options，不应被标"bad_options"。
 */
const OPTION_BASED_TEMPLATES = new Set([
  "plain_choice",
  "single_choice",
  "multi_choice",
  "true_false_swipe",
  "true_false",
  "clue_finder",
  "plain_choice_visual",
]);

function needsOptions(q: Record<string, unknown>): boolean {
  const playAs = (q.play_as as string) || "";
  const gameType = (q.game_type as string) || "";
  const fmt = (q.question_format as string) || "";
  // 只要 play_as / game_type / question_format 任意一个是 option-based 就需要
  if (playAs && OPTION_BASED_TEMPLATES.has(playAs)) return true;
  if (gameType && OPTION_BASED_TEMPLATES.has(gameType)) return true;
  if (fmt === "single_choice" || fmt === "multi_choice") return true;
  return false;
}

function isBadQuestion(q: unknown): { bad: true; reason: string } | { bad: false } {
  if (!q || typeof q !== "object") return { bad: true, reason: "非对象" };
  const o = q as Record<string, unknown>;
  if (typeof o.question_id !== "string" || !o.question_id.trim())
    return { bad: true, reason: "缺 question_id" };
  if (typeof o.stem !== "string" || !o.stem.trim())
    return { bad: true, reason: "stem 空" };

  // v0.28.3：题干语言质量检测（避免 "0.30 和 0.3，相等输 0" 这种语言不通顺）
  const stem = o.stem.trim();
  if (stem.length < 8) {
    return { bad: true, reason: `stem 过短 (${stem.length} 字)` };
  }
  // 数学题禁用动词："输 N" / "输入 N" / "报 N" / "送 N" 这些指令式说法
  if (/[输报送]\s*[0-9一二三四五六七八九十]+/.test(stem) || /输入[0-9]/.test(stem)) {
    return { bad: true, reason: "stem 含'输/报 N'指令式说法（建议用'答 N'）" };
  }

  // 只对"option-based"题型校验 options
  if (needsOptions(o)) {
    if (!Array.isArray(o.options) || o.options.length < 2)
      return { bad: true, reason: "options 少于 2 (但题型需要 options)" };
    if (!o.answer || typeof o.answer !== "object")
      return { bad: true, reason: "缺 answer" };
    const ans = o.answer as { type?: string; value?: unknown };
    if (ans.type === "choice") {
      const optIds = (o.options as Array<{ id?: string }>)
        .map((x) => x?.id)
        .filter((x): x is string => typeof x === "string");
      if (typeof ans.value !== "string" || !optIds.includes(ans.value))
        return { bad: true, reason: `answer.value="${String(ans.value)}" 不在 options` };
    }
    // v0.28.3：stem 是数值题，options 不应混入纯中文短语
    const opts = o.options as Array<{ text?: string }>;
    const stemHasDigits = /\d/.test(stem);
    const stemAsksNumber =
      /(多少|几|是\s*\?|=\s*\?|多多少|大多少|小多少)/.test(stem) ||
      stem.endsWith("？是？") ||
      stem.endsWith("等于多少？");
    const optTexts = opts.map((x) => x?.text ?? "").filter(Boolean);
    if (stemAsksNumber && stemHasDigits && optTexts.length >= 2) {
      const allNumeric = optTexts.every((t) => /^[\-+]?\d+(\.\d+)?(\s*[一-鿿]{0,3})?$/.test(t.trim()));
      const someChinese = optTexts.some((t) => /^[一-鿿]{2,}$/.test(t.trim()));
      if (!allNumeric && someChinese) {
        return { bad: true, reason: "数值题但有纯中文选项（stem 问数字、options 是文字）" };
      }
    }
  }
  return { bad: false };
}

async function computeStats(): Promise<QStats> {
  const all = await db.questions.toArray();
  const bySkillMap = new Map<string, { count: number; aiGen: number }>();
  const stems = new Map<string, number>();
  const bad: QStats["bad"] = [];
  let aiGenTotal = 0;
  let seedTotal = 0;
  const bySubject = { math: 0, chinese: 0, undef: 0 };

  for (const q of all) {
    const sid = q.skill_id || "_no_skill_";
    const cur = bySkillMap.get(sid) ?? { count: 0, aiGen: 0 };
    cur.count++;
    const isAi =
      (q.question_id || "").startsWith("AI_") ||
      (q.tags ?? []).includes("ai_generated");
    if (isAi) {
      cur.aiGen++;
      aiGenTotal++;
    } else {
      seedTotal++;
    }
    bySkillMap.set(sid, cur);

    const sub = (q.subjectId as string) || "undef";
    if (sub === "math") bySubject.math++;
    else if (sub === "chinese") bySubject.chinese++;
    else bySubject.undef++;

    const verdict = isBadQuestion(q);
    if (verdict.bad) {
      bad.push({
        reason: verdict.reason,
        q: { question_id: q.question_id, stem: q.stem, skill_id: q.skill_id },
      });
    }
    if (q.stem) {
      stems.set(q.stem, (stems.get(q.stem) ?? 0) + 1);
    }
  }

  let duplicateStems = 0;
  for (const v of stems.values()) if (v > 1) duplicateStems += v - 1;

  const bySkill = Array.from(bySkillMap.entries())
    .map(([skillId, { count, aiGen }]) => ({
      skillId,
      skillName: SKILL_NAME.get(skillId) ?? skillId,
      count,
      aiGen,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    total: all.length,
    bySkill,
    bad,
    duplicateStems,
    aiGenTotal,
    seedTotal,
    bySubject,
  };
}

export function QuestionsAdminPanel() {
  const [stats, setStats] = useState<QStats | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "ai-heavy" | "with-bad">("all");

  const refresh = async () => {
    setStats(await computeStats());
  };

  useEffect(() => {
    void refresh();
  }, []);

  const onCleanupBad = async () => {
    if (!stats || stats.bad.length === 0) return;
    if (
      !window.confirm(
        `将永久删除 ${stats.bad.length} 道损坏的题（缺字段 / 答案不对应等），确定吗？`,
      )
    )
      return;
    setBusy(true);
    try {
      const ids = stats.bad.map((b) => b.q.question_id);
      // v0.29.4: 记录到 deletedQuestionIds（同步 + 防 seed 复活）
      await recordDeletedQuestionIds(ids);
      await refresh();
      window.alert(`已清理 ${ids.length} 道损坏题`);
    } finally {
      setBusy(false);
    }
  };

  const onTrimSkill = async (skillId: string, keepN: number) => {
    const all = await db.questions.where("skill_id").equals(skillId).toArray();
    // 优先保留 seed，删多余的 AI gen
    const ai = all.filter(
      (q) =>
        (q.question_id || "").startsWith("AI_") ||
        (q.tags ?? []).includes("ai_generated"),
    );
    const seed = all.filter(
      (q) =>
        !(q.question_id || "").startsWith("AI_") &&
        !(q.tags ?? []).includes("ai_generated"),
    );
    const totalKeep = keepN;
    const seedKeep = Math.min(seed.length, totalKeep);
    const aiKeep = Math.max(0, totalKeep - seedKeep);
    const idsToDelete = [
      ...ai.slice(aiKeep).map((q) => q.question_id),
      ...seed.slice(seedKeep).map((q) => q.question_id),
    ];
    if (
      !window.confirm(
        `将永久删除 ${SKILL_NAME.get(skillId) ?? skillId} 下多余的 ${
          idsToDelete.length
        } 道题（保留 ${totalKeep} 道，seed 优先），确定吗？`,
      )
    )
      return;
    setBusy(true);
    try {
      // v0.29.4: 记录到 deletedQuestionIds
      await recordDeletedQuestionIds(idsToDelete);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onClearAllAi = async () => {
    if (
      !window.confirm(
        `将永久删除所有 AI 生成的题（保留 seed 静态题）。这会让 AI 重新出题。确定吗？`,
      )
    )
      return;
    setBusy(true);
    try {
      const all = await db.questions.toArray();
      const aiIds = all
        .filter(
          (q) =>
            (q.question_id || "").startsWith("AI_") ||
            (q.tags ?? []).includes("ai_generated"),
        )
        .map((q) => q.question_id);
      // v0.29.4: 记录到 deletedQuestionIds
      await recordDeletedQuestionIds(aiIds);
      await refresh();
      window.alert(`已删除 ${aiIds.length} 道 AI 题，剩 ${all.length - aiIds.length} 道 seed`);
    } finally {
      setBusy(false);
    }
  };

  if (!stats) return <div className="text-xs text-slate-400">加载中…</div>;

  let filteredSkills = stats.bySkill;
  if (filter === "ai-heavy") filteredSkills = stats.bySkill.filter((s) => s.aiGen >= 30);
  // (with-bad filter handled below by stats.bad listing)

  return (
    <div className="text-sm space-y-3">
      {/* 顶部统计卡 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatBox label="总题数" value={stats.total} />
        <StatBox label="seed" value={stats.seedTotal} tone="emerald" />
        <StatBox label="AI 生成" value={stats.aiGenTotal} tone="violet" />
        <StatBox
          label="损坏"
          value={stats.bad.length}
          tone={stats.bad.length > 0 ? "rose" : "emerald"}
        />
      </div>

      <div className="text-[11px] text-slate-400 leading-relaxed">
        各学科分布：math {stats.bySubject.math} · chinese {stats.bySubject.chinese}
        {stats.bySubject.undef > 0 && ` · 未标记 ${stats.bySubject.undef}`}
        <br />
        重复题干：{stats.duplicateStems} 道（同 stem 出现 2 次以上的多余 row）
      </div>

      {/* 一键操作 */}
      <div className="flex flex-wrap gap-2">
        {stats.bad.length > 0 && (
          <button
            type="button"
            onClick={onCleanupBad}
            disabled={busy}
            className="btn-primary text-sm bg-rose-500/30 border-rose-400/40 text-rose-100"
          >
            🗑 清理 {stats.bad.length} 道损坏题（规则）
          </button>
        )}
        <button
          type="button"
          onClick={onClearAllAi}
          disabled={busy}
          className="btn-ghost text-sm border border-amber-400/40 text-amber-200"
        >
          ⚠️ 删除全部 AI 题（保留 seed）
        </button>
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          className="btn-ghost text-sm border border-violet-400/30 text-violet-200"
        >
          🔄 刷新统计
        </button>
      </div>

      {/* 🤖 AI 质检区 */}
      <AiJudgePanel onAfterApply={refresh} />

      {/* 损坏题样本 */}
      {stats.bad.length > 0 && (
        <details className="rounded-lg border border-rose-400/30 bg-rose-500/5 p-2">
          <summary className="text-rose-200 text-sm cursor-pointer">
            🚨 损坏题样本 ({stats.bad.length})
          </summary>
          <div className="mt-2 space-y-1 text-[11px] max-h-48 overflow-y-auto font-mono">
            {stats.bad.slice(0, 15).map((b) => (
              <div key={b.q.question_id} className="border-b border-rose-400/10 pb-1">
                <span className="text-rose-300">[{b.reason}]</span>{" "}
                <span className="text-slate-400">
                  {b.q.skill_id} / {b.q.question_id.slice(-12)}
                </span>
                <br />
                <span className="text-slate-300 truncate inline-block max-w-full">
                  {b.q.stem?.slice(0, 80) ?? "<no stem>"}
                </span>
              </div>
            ))}
            {stats.bad.length > 15 && (
              <div className="text-slate-500">... 还有 {stats.bad.length - 15} 道</div>
            )}
          </div>
        </details>
      )}

      {/* 过滤 */}
      <div className="flex gap-1.5 text-xs flex-wrap">
        {(
          [
            { id: "all", label: `全部 skill (${stats.bySkill.length})` },
            {
              id: "ai-heavy",
              label: `AI 题 ≥30 (${stats.bySkill.filter((s) => s.aiGen >= 30).length})`,
            },
          ] as const
        ).map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`chip text-xs ${
              filter === f.id
                ? "bg-violet-500/30 text-violet-100 border border-violet-400/40"
                : "bg-white/5 text-slate-400 border border-white/10"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 各 skill 题数表 */}
      <div className="rounded-lg border border-ink-700/40 overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-ink-800/50 text-slate-400">
            <tr>
              <th className="text-left px-2 py-1">skill</th>
              <th className="text-right px-2 py-1">总</th>
              <th className="text-right px-2 py-1">AI</th>
              <th className="text-right px-2 py-1">seed</th>
              <th className="text-right px-2 py-1">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredSkills.map((s) => {
              const seedCount = s.count - s.aiGen;
              const isHeavy = s.aiGen >= 50;
              return (
                <tr
                  key={s.skillId}
                  className={`border-t border-ink-700/30 ${
                    isHeavy ? "bg-amber-500/5" : ""
                  }`}
                >
                  <td className="px-2 py-1 text-slate-200 truncate max-w-[200px]">
                    {s.skillName}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums text-slate-200">
                    {s.count}
                  </td>
                  <td
                    className={`px-2 py-1 text-right tabular-nums ${
                      isHeavy ? "text-amber-300 font-semibold" : "text-violet-300"
                    }`}
                  >
                    {s.aiGen}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums text-slate-400">
                    {seedCount}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {s.count > 30 && (
                      <button
                        type="button"
                        onClick={() => void onTrimSkill(s.skillId, 30)}
                        disabled={busy}
                        className="text-amber-300 hover:underline text-[10px]"
                        title="删多余的 AI 题，保留 30 道（seed 优先保留）"
                      >
                        裁到 30 道
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  tone = "violet",
}: {
  label: string;
  value: number;
  tone?: "violet" | "emerald" | "rose";
}) {
  const toneMap = {
    violet: "from-violet-500/15 to-fuchsia-500/10 border-violet-400/30 text-violet-100",
    emerald: "from-emerald-500/15 to-teal-500/10 border-emerald-400/30 text-emerald-100",
    rose: "from-rose-500/15 to-pink-500/10 border-rose-400/30 text-rose-100",
  }[tone];
  return (
    <div className={`rounded-lg border p-2 bg-gradient-to-br ${toneMap} text-center`}>
      <div className="text-[10px] uppercase tracking-widest opacity-80">{label}</div>
      <div className="font-display font-bold text-lg mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}

// =============================================================
//  🤖 AI 质检子面板（v0.28.4）
// =============================================================

type ScopeKind = "all" | "subject" | "unit" | "skill" | "gameType" | "ai-only";

interface AiJudgePanelProps {
  onAfterApply: () => void | Promise<void>;
}

function AiJudgePanel({ onAfterApply }: AiJudgePanelProps) {
  const [scopeKind, setScopeKind] = useState<ScopeKind>("subject");
  const [subjectId, setSubjectId] = useState<"math" | "chinese">("math");
  const [unitId, setUnitId] = useState<string>("");
  const [skillId, setSkillId] = useState<string>("");
  const [gameType, setGameType] = useState<string>("plain_choice");
  const [maxSample, setMaxSample] = useState<number>(60);
  const [progress, setProgress] = useState<JudgeProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{ q: Question; j: Judgment }[]>([]);
  const [errMsg, setErrMsg] = useState<string>("");
  const [selectedToDelete, setSelectedToDelete] = useState<Set<string>>(new Set());

  const unitsForSubject = useMemo(
    () =>
      UNITS.filter((u) =>
        subjectId === "math" ? u.id.startsWith("G4") : u.id.startsWith("CN") || u.id.startsWith("ZW"),
      ),
    [subjectId],
  );
  const skillsForUnit = useMemo(() => {
    if (!unitId) return [];
    const ids = SKILL_BY_UNIT.get(unitId) ?? [];
    return SKILLS.filter((s) => ids.includes(s.id));
  }, [unitId]);

  // 拉满足 scope 的 questions
  async function pickScopeQuestions(): Promise<{ qs: Question[]; label: string; filter: string }> {
    const all = await db.questions.toArray();
    let qs = all;
    let label: string;
    let filter: string;
    switch (scopeKind) {
      case "all":
        label = "全部题库";
        filter = "scope=all";
        break;
      case "subject":
        qs = qs.filter((q) => (q.subjectId ?? "math") === subjectId);
        label = subjectId === "math" ? "数学全部" : "语文全部";
        filter = `scope=subject;subjectId=${subjectId}`;
        break;
      case "unit":
        qs = qs.filter((q) => q.unit_id === unitId);
        label = `单元：${UNITS.find((u) => u.id === unitId)?.name ?? unitId}`;
        filter = `scope=unit;unitId=${unitId}`;
        break;
      case "skill":
        qs = qs.filter((q) => q.skill_id === skillId);
        label = `技能：${SKILL_NAME.get(skillId) ?? skillId}`;
        filter = `scope=skill;skillId=${skillId}`;
        break;
      case "gameType":
        qs = qs.filter((q) => (q.game_type ?? q.play_as ?? "") === gameType);
        label = `题型：${gameType}`;
        filter = `scope=gameType;gameType=${gameType}`;
        break;
      case "ai-only":
        qs = qs.filter(
          (q) => (q.question_id ?? "").startsWith("AI_") || (q.tags ?? []).includes("ai_generated"),
        );
        label = "全部 AI 生成题";
        filter = "scope=ai-only";
        break;
    }
    // 优先 AI 题（更可能有问题），按 question_id 稳定排序后取前 N
    qs.sort((a, b) => {
      const aiA = (a.question_id ?? "").startsWith("AI_") ? 0 : 1;
      const aiB = (b.question_id ?? "").startsWith("AI_") ? 0 : 1;
      if (aiA !== aiB) return aiA - aiB;
      return (a.question_id ?? "").localeCompare(b.question_id ?? "");
    });
    qs = qs.slice(0, maxSample);
    return { qs, label, filter };
  }

  async function runJudge() {
    if (running) return;
    setErrMsg("");
    setResults([]);
    setSelectedToDelete(new Set());
    const { qs, label, filter } = await pickScopeQuestions();
    if (qs.length === 0) {
      setErrMsg("没找到符合条件的题");
      return;
    }
    setRunning(true);
    setProgress({ done: 0, total: Math.ceil(qs.length / 20), judgments: new Map(), errors: [] });
    try {
      const final = await judgeQuestionsInBatches(qs, {
        subjectId,
        scopeLabel: label,
        scopeFilter: filter,
        onProgress: (p) => setProgress({ ...p, judgments: new Map(p.judgments) }),
      });
      // 拼 results：题 + 判定
      const rows: { q: Question; j: Judgment }[] = [];
      for (const q of qs) {
        const j = final.judgments.get(q.question_id);
        if (j) rows.push({ q, j });
      }
      // 按 severity 倒序，让最该删的排最前
      rows.sort((a, b) => b.j.severity - a.j.severity);
      setResults(rows);
      // 默认勾上 verdict=delete 的
      const preselect = new Set<string>();
      for (const r of rows) if (r.j.verdict === "delete") preselect.add(r.q.question_id);
      setSelectedToDelete(preselect);
      if (final.errors.length > 0) {
        setErrMsg(
          `部分批次失败 (${final.errors.length}/${final.total})：${final.errors[0]?.detail?.slice(0, 80)}`,
        );
      }
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  async function applyDelete() {
    const ids = Array.from(selectedToDelete);
    if (ids.length === 0) return;
    if (!window.confirm(`将永久删除 ${ids.length} 道题（AI 判定为 delete 的题）。确定吗？`)) {
      return;
    }
    // v0.29.4: 记录到 deletedQuestionIds
    await recordDeletedQuestionIds(ids);
    // 从 results 里把删掉的剔出
    setResults((prev) => prev.filter((r) => !selectedToDelete.has(r.q.question_id)));
    setSelectedToDelete(new Set());
    await onAfterApply();
    window.alert(`已删除 ${ids.length} 道题`);
  }

  function toggleSelect(qid: string) {
    setSelectedToDelete((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
  }

  function selectAllByVerdict(verdict: JudgeVerdict) {
    const next = new Set(selectedToDelete);
    for (const r of results) {
      if (r.j.verdict === verdict) next.add(r.q.question_id);
    }
    setSelectedToDelete(next);
  }

  return (
    <details
      className="rounded-lg border border-violet-400/30 bg-violet-500/5 p-3"
      open={results.length > 0 || running}
    >
      <summary className="text-violet-200 text-sm cursor-pointer font-semibold">
        🤖 AI 质检（让 qwen-plus 按 quality-rubric 判定哪些题该删）
      </summary>

      <div className="mt-3 space-y-3 text-xs">
        {/* scope 选择 */}
        <div className="space-y-2">
          <div className="text-slate-400 text-[11px]">选择质检范围（每次最多 {maxSample} 道）：</div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "subject", label: "按学科" },
                { id: "unit", label: "按单元" },
                { id: "skill", label: "按 skill" },
                { id: "gameType", label: "按题型" },
                { id: "ai-only", label: "仅 AI 题" },
                { id: "all", label: "全部" },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setScopeKind(s.id)}
                className={`chip text-[11px] ${
                  scopeKind === s.id
                    ? "bg-violet-500/30 text-violet-100 border border-violet-400/40"
                    : "bg-white/5 text-slate-400 border border-white/10"
                }`}
                disabled={running}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* 二级 selector */}
          <div className="flex flex-wrap gap-2 items-center">
            <label className="text-slate-400">学科</label>
            <select
              className="bg-ink-800/60 border border-ink-700/60 rounded px-2 py-0.5 text-slate-200"
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value as "math" | "chinese");
                setUnitId("");
                setSkillId("");
              }}
              disabled={running}
            >
              <option value="math">数学</option>
              <option value="chinese">语文</option>
            </select>
            {scopeKind === "unit" && (
              <>
                <label className="text-slate-400">单元</label>
                <select
                  className="bg-ink-800/60 border border-ink-700/60 rounded px-2 py-0.5 text-slate-200 max-w-[200px]"
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  disabled={running}
                >
                  <option value="">(请选)</option>
                  {unitsForSubject.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.term} · {u.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            {scopeKind === "skill" && (
              <>
                <label className="text-slate-400">单元</label>
                <select
                  className="bg-ink-800/60 border border-ink-700/60 rounded px-2 py-0.5 text-slate-200 max-w-[180px]"
                  value={unitId}
                  onChange={(e) => {
                    setUnitId(e.target.value);
                    setSkillId("");
                  }}
                  disabled={running}
                >
                  <option value="">(请选)</option>
                  {unitsForSubject.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <label className="text-slate-400">skill</label>
                <select
                  className="bg-ink-800/60 border border-ink-700/60 rounded px-2 py-0.5 text-slate-200 max-w-[200px]"
                  value={skillId}
                  onChange={(e) => setSkillId(e.target.value)}
                  disabled={running || !unitId}
                >
                  <option value="">(请选)</option>
                  {skillsForUnit.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            {scopeKind === "gameType" && (
              <>
                <label className="text-slate-400">题型</label>
                <select
                  className="bg-ink-800/60 border border-ink-700/60 rounded px-2 py-0.5 text-slate-200"
                  value={gameType}
                  onChange={(e) => setGameType(e.target.value)}
                  disabled={running}
                >
                  {[
                    "plain_choice",
                    "decimal_shifter",
                    "cube_view",
                    "balance_lab",
                    "shop_counter",
                    "triangle_judge",
                    "vertical_repair",
                    "speed_match",
                    "word_problem_lab",
                    "clue_finder",
                  ].map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </>
            )}
            <label className="text-slate-400">最多</label>
            <select
              className="bg-ink-800/60 border border-ink-700/60 rounded px-2 py-0.5 text-slate-200"
              value={maxSample}
              onChange={(e) => setMaxSample(Number(e.target.value))}
              disabled={running}
            >
              {[20, 60, 120, 200, 400].map((n) => (
                <option key={n} value={n}>
                  {n} 道
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 启动按钮 */}
        <div className="flex gap-2 items-center flex-wrap">
          <button
            type="button"
            onClick={runJudge}
            disabled={
              running ||
              (scopeKind === "unit" && !unitId) ||
              (scopeKind === "skill" && !skillId)
            }
            className="btn-primary text-xs bg-violet-500/30 border-violet-400/40 text-violet-100"
          >
            {running ? "判定中…" : "开始 AI 质检"}
          </button>
          {results.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => selectAllByVerdict("delete")}
                disabled={running}
                className="btn-ghost text-xs border border-rose-400/30 text-rose-200"
              >
                ✓ 选中所有 delete
              </button>
              <button
                type="button"
                onClick={() => selectAllByVerdict("borderline")}
                disabled={running}
                className="btn-ghost text-xs border border-amber-400/30 text-amber-200"
              >
                ✓ 加选 borderline
              </button>
              <button
                type="button"
                onClick={() => setSelectedToDelete(new Set())}
                disabled={running}
                className="btn-ghost text-xs border border-slate-400/30 text-slate-300"
              >
                清空选择
              </button>
              {selectedToDelete.size > 0 && (
                <button
                  type="button"
                  onClick={applyDelete}
                  disabled={running}
                  className="btn-primary text-xs bg-rose-500/40 border-rose-400/50 text-rose-100"
                >
                  🗑 删除选中 {selectedToDelete.size} 道
                </button>
              )}
            </>
          )}
        </div>

        {/* 进度 */}
        {progress && (
          <div className="text-[11px] text-slate-400">
            进度：{progress.done} / {progress.total} 批
            {progress.judgments.size > 0 && ` · 已判定 ${progress.judgments.size} 道`}
            {progress.errors.length > 0 && (
              <span className="text-rose-300"> · 失败 {progress.errors.length} 批</span>
            )}
          </div>
        )}

        {/* 错误 */}
        {errMsg && (
          <div className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded px-2 py-1">
            {errMsg}
          </div>
        )}

        {/* 结果列表 */}
        {results.length > 0 && (
          <div className="rounded-lg border border-ink-700/40 overflow-hidden">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 text-[11px] text-center mb-1">
              <SummaryChip
                label="🗑 delete"
                count={results.filter((r) => r.j.verdict === "delete").length}
                tone="rose"
              />
              <SummaryChip
                label="⚠ borderline"
                count={results.filter((r) => r.j.verdict === "borderline").length}
                tone="amber"
              />
              <SummaryChip
                label="✓ keep"
                count={results.filter((r) => r.j.verdict === "keep").length}
                tone="emerald"
              />
              <SummaryChip label="∑ 总判定" count={results.length} tone="violet" />
            </div>
            <table className="w-full text-[11px]">
              <thead className="bg-ink-800/50 text-slate-400">
                <tr>
                  <th className="px-1.5 py-1 w-6">勾</th>
                  <th className="px-1.5 py-1 w-12">verdict</th>
                  <th className="px-1.5 py-1 w-8">sev</th>
                  <th className="text-left px-1.5 py-1">stem</th>
                  <th className="text-left px-1.5 py-1">理由 · issues</th>
                </tr>
              </thead>
              <tbody>
                {results.slice(0, 200).map(({ q, j }) => {
                  const tone =
                    j.verdict === "delete"
                      ? "bg-rose-500/5 border-rose-400/20"
                      : j.verdict === "borderline"
                        ? "bg-amber-500/5 border-amber-400/20"
                        : "bg-emerald-500/5 border-emerald-400/20";
                  const verdictColor =
                    j.verdict === "delete"
                      ? "text-rose-300"
                      : j.verdict === "borderline"
                        ? "text-amber-300"
                        : "text-emerald-300";
                  return (
                    <tr key={q.question_id} className={`border-t border-ink-700/30 ${tone}`}>
                      <td className="px-1.5 py-1 text-center">
                        <input
                          type="checkbox"
                          checked={selectedToDelete.has(q.question_id)}
                          onChange={() => toggleSelect(q.question_id)}
                          disabled={running}
                        />
                      </td>
                      <td className={`px-1.5 py-1 ${verdictColor} font-mono`}>{j.verdict}</td>
                      <td className="px-1.5 py-1 text-center tabular-nums text-slate-200">
                        {j.severity}
                      </td>
                      <td className="px-1.5 py-1 text-slate-300 max-w-[280px] truncate">
                        {q.stem.slice(0, 80)}
                      </td>
                      <td className="px-1.5 py-1 text-slate-400">
                        {j.reason}
                        {j.issues.length > 0 && (
                          <div className="mt-0.5 flex flex-wrap gap-0.5">
                            {j.issues.map((i) => (
                              <span
                                key={i}
                                className="text-[10px] px-1 rounded bg-slate-500/20 text-slate-300"
                              >
                                {i}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {results.length > 200 && (
              <div className="text-[10px] text-slate-500 text-center py-1">
                只显示前 200 条；全部 {results.length} 条
              </div>
            )}
          </div>
        )}
      </div>
    </details>
  );
}

function SummaryChip({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "rose" | "amber" | "emerald" | "violet";
}) {
  const toneMap = {
    rose: "bg-rose-500/15 text-rose-200 border-rose-400/30",
    amber: "bg-amber-500/15 text-amber-200 border-amber-400/30",
    emerald: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
    violet: "bg-violet-500/15 text-violet-200 border-violet-400/30",
  }[tone];
  return (
    <div className={`rounded border ${toneMap} px-1.5 py-0.5`}>
      {label}：<span className="font-bold tabular-nums">{count}</span>
    </div>
  );
}
