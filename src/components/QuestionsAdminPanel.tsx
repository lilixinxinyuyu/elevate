/**
 * 题库诊断面板：
 *   - 各 skill 题数（Top 20 排序）
 *   - 检测垃圾题（缺字段 / answer 指向不存在选项 / stem 空白 / 重复 stem）
 *   - 一键清理垃圾题
 *   - 一键清理超量 AI 题（每 skill 保留前 N 道）
 *
 * 用于：用户报"题数虚高 / 部分题不见 / AI 出题失败但题在涨" 时的排查工具。
 */

import { useEffect, useState } from "react";
import { db } from "../db/dexie";
import type { Question } from "../core/types";
import { SKILLS } from "../content/skills";

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
      await db.questions.bulkDelete(ids);
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
      await db.questions.bulkDelete(idsToDelete);
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
      await db.questions.bulkDelete(aiIds);
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
            🗑 清理 {stats.bad.length} 道损坏题
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
