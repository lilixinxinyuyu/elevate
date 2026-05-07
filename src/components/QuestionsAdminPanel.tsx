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
  applyQuestionFix,
  fixQuestion,
  judgeQuestionsInBatches,
  type FixResult,
  type Judgment,
  type JudgeProgress,
  type JudgeVerdict,
} from "../lib/qualityJudge";
import {
  applyReclassification,
  scanForReclassification,
  type ScanReport,
} from "../lib/questionFormatClassifier";

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

      {/* 🏷️ 答题格式重分类（v0.31.33）*/}
      <FormatReclassifyPanel onAfterApply={refresh} />

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

type ScopeKind = "all" | "subject" | "unit" | "skill" | "gameType" | "questionFormat" | "ai-only";

interface AiJudgePanelProps {
  onAfterApply: () => void | Promise<void>;
}

const QUESTION_FORMATS = [
  "numeric",
  "numeric_choice",
  "single_choice",
  "multi_choice",
  "multi_step",
  "fill_blank",
  "drag_drop",
  "sort_ladder",
  "geometry_operation",
] as const;

function AiJudgePanel({ onAfterApply }: AiJudgePanelProps) {
  const [scopeKind, setScopeKind] = useState<ScopeKind>("subject");
  const [subjectId, setSubjectId] = useState<"math" | "chinese">("math");
  const [unitId, setUnitId] = useState<string>("");
  const [skillId, setSkillId] = useState<string>("");
  const [gameType, setGameType] = useState<string>("plain_choice");
  const [questionFormat, setQuestionFormat] = useState<string>("fill_blank");
  // v0.31.31：去掉 maxSample，改成"匹配多少道就跑多少道"
  // 但保留一个 hard cap 防误操作（>500 道时弹确认）
  const [matchingCount, setMatchingCount] = useState<number | null>(null);
  const [progress, setProgress] = useState<JudgeProgress | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<{ q: Question; j: Judgment }[]>([]);
  const [errMsg, setErrMsg] = useState<string>("");
  const [selectedToDelete, setSelectedToDelete] = useState<Set<string>>(new Set());
  // v0.31.32：AI 修题 — pendingFixId 标当前在请求修题的 qid，fixModal 是预览/确认面板
  const [pendingFixId, setPendingFixId] = useState<string | null>(null);
  const [fixModal, setFixModal] = useState<{
    original: Question;
    judgment: Judgment;
    fix: FixResult;
  } | null>(null);

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

  // 拉满足 scope 的 questions（v0.31.31：不再 cap maxSample，全量交给批处理）
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
      case "questionFormat":
        qs = qs.filter((q) => q.question_format === questionFormat);
        label = `题面格式：${questionFormat}`;
        filter = `scope=questionFormat;questionFormat=${questionFormat}`;
        break;
      case "ai-only":
        qs = qs.filter(
          (q) => (q.question_id ?? "").startsWith("AI_") || (q.tags ?? []).includes("ai_generated"),
        );
        label = "全部 AI 生成题";
        filter = "scope=ai-only";
        break;
    }
    // 优先 AI 题（更可能有问题），按 question_id 稳定排序
    qs.sort((a, b) => {
      const aiA = (a.question_id ?? "").startsWith("AI_") ? 0 : 1;
      const aiB = (b.question_id ?? "").startsWith("AI_") ? 0 : 1;
      if (aiA !== aiB) return aiA - aiB;
      return (a.question_id ?? "").localeCompare(b.question_id ?? "");
    });
    return { qs, label, filter };
  }

  // v0.31.31：scope 一变就预算下匹配多少题，UI 上提前展示给用户
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { qs } = await pickScopeQuestions();
        if (!cancelled) setMatchingCount(qs.length);
      } catch {
        if (!cancelled) setMatchingCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKind, subjectId, unitId, skillId, gameType, questionFormat]);

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
    // v0.31.31：题量大时提示一下时间和成本
    const batches = Math.ceil(qs.length / 20);
    if (qs.length > 200) {
      const estSec = Math.ceil(batches / 3) * 8; // 并发 3，每批约 8s
      const ok = window.confirm(
        `匹配到 ${qs.length} 道题，需要跑 ${batches} 批（预计 ${estSec} 秒，会调 qwen-plus）。继续吗？`,
      );
      if (!ok) return;
    }
    setRunning(true);
    setProgress({ done: 0, total: batches, judgments: new Map(), errors: [] });
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

  // v0.31.32：AI 修题流程
  async function requestFix(q: Question, j: Judgment) {
    if (pendingFixId) return; // 同时只允许一个修题请求
    setPendingFixId(q.question_id);
    setErrMsg("");
    try {
      const fix = await fixQuestion({
        question: q,
        issues: j.issues,
        reason: j.reason,
        subjectId: q.subjectId === "chinese" ? "chinese" : "math",
      });
      setFixModal({ original: q, judgment: j, fix });
    } catch (e) {
      setErrMsg(`修题失败：${(e as Error).message}`);
    } finally {
      setPendingFixId(null);
    }
  }

  async function acceptFix() {
    if (!fixModal) return;
    try {
      await applyQuestionFix(fixModal.fix.fixed);
      // 从 results 里把这条移出（已修不需要再被 review）
      setResults((prev) => prev.filter((r) => r.q.question_id !== fixModal.original.question_id));
      // 也从 selectedToDelete 里移出
      setSelectedToDelete((prev) => {
        const next = new Set(prev);
        next.delete(fixModal.original.question_id);
        return next;
      });
      setFixModal(null);
      await onAfterApply();
    } catch (e) {
      setErrMsg(`应用修题失败：${(e as Error).message}`);
    }
  }

  function rejectFix() {
    setFixModal(null);
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
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="text-slate-400 text-[11px]">选择质检范围（自动跑全部匹配题）：</div>
            {matchingCount !== null && (
              <div className="text-[11px]">
                <span className="text-slate-400">匹配</span>{" "}
                <span className="font-display font-bold text-violet-200">{matchingCount}</span>{" "}
                <span className="text-slate-400">道</span>
                {matchingCount > 0 && (
                  <span className="text-slate-500 ml-1.5">
                    · {Math.ceil(matchingCount / 20)} 批 · ~
                    {Math.ceil(Math.ceil(matchingCount / 20) / 3) * 8} 秒
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "subject", label: "按学科" },
                { id: "unit", label: "按单元" },
                { id: "skill", label: "按 skill" },
                { id: "gameType", label: "按题型 (game_type)" },
                { id: "questionFormat", label: "按答题格式 (fill_blank 等)" },
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
                <label className="text-slate-400">题型 (game_type)</label>
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
            {scopeKind === "questionFormat" && (
              <>
                <label className="text-slate-400">答题格式</label>
                <select
                  className="bg-ink-800/60 border border-ink-700/60 rounded px-2 py-0.5 text-slate-200"
                  value={questionFormat}
                  onChange={(e) => setQuestionFormat(e.target.value)}
                  disabled={running}
                >
                  {QUESTION_FORMATS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        {/* 启动按钮 */}
        <div className="flex gap-2 items-center flex-wrap">
          <button
            type="button"
            onClick={runJudge}
            disabled={
              running ||
              !matchingCount ||
              (scopeKind === "unit" && !unitId) ||
              (scopeKind === "skill" && !skillId)
            }
            className="btn-primary text-xs bg-violet-500/30 border-violet-400/40 text-violet-100"
          >
            {running
              ? "判定中…"
              : matchingCount
                ? `开始 AI 质检（全部 ${matchingCount} 道）`
                : "开始 AI 质检"}
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

        {/* 进度（v0.31.31：可视化进度条 + 详细状态）*/}
        {progress && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-300">
                {running ? "🔄 判定中" : progress.done >= progress.total ? "✅ 完成" : "⏸ 暂停"}
                <span className="text-slate-500 ml-2">
                  {progress.done} / {progress.total} 批
                  {progress.judgments.size > 0 && ` · ${progress.judgments.size} 道已判`}
                </span>
              </span>
              {progress.errors.length > 0 && (
                <span className="text-rose-300 text-[10px]">
                  ⚠ 失败 {progress.errors.length} 批
                </span>
              )}
            </div>
            <div className="h-1.5 rounded-full bg-black/30 overflow-hidden ring-1 ring-white/5">
              <div
                className="h-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-rose-400 transition-all duration-300"
                style={{
                  width: `${
                    progress.total > 0
                      ? Math.round((progress.done / progress.total) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
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
                  <th className="px-1.5 py-1 w-16">操作</th>
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
                  const isPendingFix = pendingFixId === q.question_id;
                  const canFix = j.verdict !== "keep";
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
                      <td className="px-1.5 py-1 text-center">
                        {canFix && (
                          <button
                            type="button"
                            onClick={() => void requestFix(q, j)}
                            disabled={!!pendingFixId || running}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 border border-violet-400/40 text-violet-100 hover:bg-violet-500/40 disabled:opacity-40"
                            title="让 AI 帮你把这题修好（不删，保留 question_id）"
                          >
                            {isPendingFix ? "修中…" : "✨ AI 修"}
                          </button>
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

      {/* v0.31.32: AI 修题确认面板 — 显示原题 vs 修过版本的关键字段对比 */}
      {fixModal && (
        <FixDiffModal
          original={fixModal.original}
          judgment={fixModal.judgment}
          fix={fixModal.fix}
          onAccept={acceptFix}
          onReject={rejectFix}
        />
      )}
    </details>
  );
}

// =============================================================
//  🏷️ 答题格式重分类面板（v0.31.33）
// =============================================================

interface FormatReclassifyPanelProps {
  onAfterApply: () => void | Promise<void>;
}

/**
 * 把误标 question_format 的题（多数是 AI 生成时一律打 single_choice 但实际
 * 上是"…是多少 X？"型的填空题）批量改回 fill_blank。
 *
 * 流程：
 *   1. 点 "🔍 扫描" → 用 questionFormatClassifier 跑一遍全库
 *   2. 显示 transition table（"single_choice → fill_blank: 173 道"）
 *   3. 点 "应用" → 逐条 applyQuestionFix（已修过的版本走 meta::questionPatches 跨设备同步）
 *
 * 决策是纯本地 heuristic（不调 LLM），所以扫描很快（毫秒级）。
 */
function FormatReclassifyPanel({ onAfterApply }: FormatReclassifyPanelProps) {
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [appliedCount, setAppliedCount] = useState(0);

  async function runScan() {
    setScanning(true);
    setErrMsg("");
    setAppliedCount(0);
    try {
      const all = await db.questions.toArray();
      const r = scanForReclassification(all);
      setReport(r);
    } catch (e) {
      setErrMsg(`扫描失败：${(e as Error).message}`);
    } finally {
      setScanning(false);
    }
  }

  async function applyAll() {
    if (!report || report.changes === 0) return;
    if (
      !window.confirm(
        `将重打 ${report.changes} 道题的 question_format（带 single_choice → fill_blank 的会同时把答案从 choice 转成 number 并清掉 options）。这会写到 db.questions 和 meta::questionPatches（跨设备同步）。继续吗？`,
      )
    ) {
      return;
    }
    setApplying(true);
    setErrMsg("");
    setAppliedCount(0);
    try {
      let n = 0;
      for (const { q, r } of report.details) {
        const fixed = applyReclassification(q, r);
        await applyQuestionFix(fixed);
        n += 1;
        if (n % 20 === 0) setAppliedCount(n);
      }
      setAppliedCount(n);
      await onAfterApply();
      // 重扫一次让 transition table 清零
      const all = await db.questions.toArray();
      setReport(scanForReclassification(all));
    } catch (e) {
      setErrMsg(`应用失败：${(e as Error).message}`);
    } finally {
      setApplying(false);
    }
  }

  return (
    <details className="rounded-lg border border-cyan-400/30 bg-cyan-500/5 p-3">
      <summary className="text-cyan-200 text-sm cursor-pointer font-semibold">
        🏷️ 答题格式重分类（修正 fill_blank 误标）
      </summary>
      <div className="mt-3 space-y-3 text-xs">
        <div className="text-slate-400 leading-relaxed">
          早期 AI 出题一律打 <code className="text-cyan-300">single_choice</code>，但很多其实是
          "…是多少 X？" 风格的填空题。这个工具用本地启发式规则把它们改回
          <code className="text-cyan-300"> fill_blank</code>，并把答案从 choice 转成 number
          （从被选项的文字里抽数字 + 单位）。决策是纯规则，不调 LLM，扫描秒级。
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <button
            type="button"
            onClick={runScan}
            disabled={scanning || applying}
            className="btn-primary text-xs bg-cyan-500/30 border-cyan-400/40 text-cyan-100"
          >
            {scanning ? "扫描中…" : report ? "🔄 重扫" : "🔍 扫描全库"}
          </button>
          {report && report.changes > 0 && (
            <button
              type="button"
              onClick={applyAll}
              disabled={applying}
              className="btn-primary text-xs bg-emerald-500/30 border-emerald-400/40 text-emerald-100"
            >
              {applying
                ? `应用中… (${appliedCount}/${report.changes})`
                : `✓ 应用全部 ${report.changes} 条改动`}
            </button>
          )}
        </div>

        {errMsg && (
          <div className="text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded p-2">
            {errMsg}
          </div>
        )}

        {report && (
          <>
            <div className="rounded-lg border border-ink-700/60 bg-ink-800/40 p-2 space-y-1">
              <div className="text-slate-400">
                扫了 <span className="text-cyan-200 font-semibold">{report.total}</span> 道题，
                建议改动 <span className="text-cyan-200 font-semibold">{report.changes}</span> 道
                {appliedCount > 0 && (
                  <span className="text-emerald-300 ml-2">（本次已应用 {appliedCount}）</span>
                )}
              </div>
              {report.changes > 0 && (
                <div className="space-y-0.5 mt-1">
                  {Object.entries(report.byTransition)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => (
                      <div key={k} className="flex justify-between border-t border-ink-700/40 pt-0.5">
                        <span className="text-slate-300 font-mono">{k}</span>
                        <span className="text-cyan-200 tabular-nums">{v}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {report.changes > 0 && (
              <div className="rounded-lg border border-ink-700/40 overflow-hidden">
                <div className="bg-ink-800/50 text-slate-400 text-[10px] uppercase tracking-wider px-2 py-1 flex items-center justify-between">
                  <span>预览（前 {showAll ? report.changes : Math.min(15, report.changes)} 条）</span>
                  {report.changes > 15 && (
                    <button
                      type="button"
                      className="text-cyan-300 hover:underline"
                      onClick={() => setShowAll((v) => !v)}
                    >
                      {showAll ? "折叠" : `查看全部 ${report.changes}`}
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto divide-y divide-ink-700/30">
                  {report.details.slice(0, showAll ? report.changes : 15).map(({ q, r }) => (
                    <div key={q.question_id} className="p-2 text-[11px]">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-mono text-slate-500">
                          {q.question_id.slice(-12)}
                        </span>
                        <span className="text-rose-300/80 line-through">{q.question_format}</span>
                        <span className="text-slate-500">→</span>
                        <span className="text-emerald-300 font-semibold">{r.newFormat}</span>
                      </div>
                      <div className="text-slate-300 mb-0.5 line-clamp-2">{q.stem}</div>
                      <div className="text-slate-500 text-[10px]">{r.reason}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.changes === 0 && (
              <div className="text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 rounded p-2">
                ✓ 所有题目格式分类都正确，没有需要改动的。
              </div>
            )}
          </>
        )}
      </div>
    </details>
  );
}

/** AI 修题对比 modal —— 横向对照原题字段 vs 修过版本，让 admin 一眼看懂改了啥 */
function FixDiffModal({
  original,
  judgment,
  fix,
  onAccept,
  onReject,
}: {
  original: Question;
  judgment: Judgment;
  fix: FixResult;
  onAccept: () => void | Promise<void>;
  onReject: () => void;
}) {
  const fields: { key: keyof Question; label: string }[] = [
    { key: "stem", label: "题干" },
    { key: "options", label: "选项" },
    { key: "answer", label: "答案" },
    { key: "solution_steps", label: "解析" },
    { key: "estimated_time_seconds", label: "估时" },
    { key: "common_errors", label: "常见错误" },
    { key: "hints", label: "hints" },
    { key: "feedback_correct", label: "答对反馈" },
    { key: "feedback_wrong", label: "答错反馈" },
    { key: "tags", label: "tags" },
  ];
  const renderValue = (v: unknown): string => {
    if (v == null) return "—";
    if (typeof v === "string" || typeof v === "number") return String(v);
    return JSON.stringify(v, null, 2);
  };
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3"
      onClick={(e) => {
        if (e.target === e.currentTarget) onReject();
      }}
    >
      <div className="card-glow w-full sm:max-w-3xl bg-ink-900/95 border border-violet-400/40 max-h-[90dvh] overflow-y-auto">
        <div className="flex items-center justify-between p-3 border-b border-ink-700/60 sticky top-0 bg-ink-900/95">
          <div>
            <div className="font-display font-bold text-violet-100">✨ AI 修题预览</div>
            <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-md">
              {original.question_id} · {fix.changesSummary}
            </div>
          </div>
          <button
            type="button"
            onClick={onReject}
            className="text-slate-400 hover:text-slate-200 text-2xl leading-none px-2"
          >
            ×
          </button>
        </div>

        <div className="p-3 space-y-3 text-xs">
          {/* 判定信息 */}
          <div className="rounded-lg bg-rose-500/10 border border-rose-400/30 p-2 text-rose-200">
            <div className="font-semibold">质检判定: {judgment.verdict} (severity {judgment.severity})</div>
            <div className="mt-0.5">{judgment.reason}</div>
            {judgment.issues.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {judgment.issues.map((i) => (
                  <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-100">
                    {i}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 字段对照 */}
          {fields.map(({ key, label }) => {
            const o = original[key];
            const n = fix.fixed[key];
            const changed = JSON.stringify(o) !== JSON.stringify(n);
            return (
              <div
                key={key as string}
                className={`rounded-lg border p-2 ${
                  changed
                    ? "border-amber-400/40 bg-amber-500/5"
                    : "border-ink-700/40 bg-ink-800/30 opacity-60"
                }`}
              >
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-semibold text-slate-200">{label}</span>
                  {changed && <span className="chip text-[9px] bg-amber-500/30 text-amber-100">已改</span>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <div className="text-[10px] text-slate-500 mb-0.5">原</div>
                    <pre className="text-[11px] whitespace-pre-wrap break-words bg-rose-500/5 border border-rose-400/15 rounded p-1.5 text-rose-100/85 max-h-32 overflow-auto">
                      {renderValue(o)}
                    </pre>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 mb-0.5">修后</div>
                    <pre className="text-[11px] whitespace-pre-wrap break-words bg-emerald-500/5 border border-emerald-400/15 rounded p-1.5 text-emerald-100/90 max-h-32 overflow-auto">
                      {renderValue(n)}
                    </pre>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-0 bg-ink-900/95 border-t border-ink-700/60 p-3 flex justify-end gap-2">
          <button type="button" onClick={onReject} className="btn-ghost text-xs">
            取消（不改）
          </button>
          <button
            type="button"
            onClick={() => void onAccept()}
            className="btn-primary text-xs bg-emerald-500/30 border-emerald-400/40 text-emerald-100"
          >
            ✓ 应用修改
          </button>
        </div>
      </div>
    </div>
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
