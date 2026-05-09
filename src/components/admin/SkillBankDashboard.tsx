/**
 * v0.31.52: 题库工作台 — Selena 学情 + 题库诊断 合并表
 *
 * 替代 admin 页面老的"📋 题库诊断"和"🤖 AI 自动出题（按薄弱 skill 生成）"两个独立面板。
 *
 * 一张表显示每个 skill 的全部维度：
 *   - 上/下册（📕/📚）
 *   - 期末重要度（必考·大题 / 高频·小题 / ...）
 *   - 题库（总 / seed / AI）+ 审计 (critical / likely / minor)
 *   - Selena 学情（mastery / 答题数 / 准确率 / 薄弱标记）
 *
 * 操作：
 *   - 多选行（checkbox）→ 底部 sticky 批量操作条 → 一键 AI 批量出题
 *   - 单行：直接看到所有诊断信息，决定是否要补题
 *   - 多种排序：默认按"该出题度"高 → 低
 *
 * 出题流程见 AiGenBatchModal。
 */
import { Fragment, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/dexie";
import {
  buildSkillRows,
  examPriorityChip,
  rowGenPriority,
  type SkillRow,
} from "../../lib/skillDiagnostic";
import { AiGenBatchModal } from "./AiGenBatchModal";
import { auditQuestion } from "../../lib/questionAuditLite";
import { recordDeletedQuestionIds } from "../../db/seed";
import {
  judgeQuestionsInBatches,
  fixQuestion,
  applyQuestionFix,
  type Judgment,
} from "../../lib/qualityJudge";
import { generateAiQuestions } from "../../lib/tutor";
import { validateQuestion } from "../../core/validateQuestion";
import { SKILLS } from "../../content/skills";
import { UNITS } from "../../content/units";
import type { ExamPriority, Question, Term } from "../../core/types";

type SortKey =
  | "genPriority"  // 默认 — 综合"该出题度"
  | "mastery"      // 按 mastery 升（薄弱在前）
  | "count"        // 按题量升（缺货在前）
  | "issues"       // 审计问题数降（脏数据在前）
  | "examPriority" // 期末重要度降
  | "name";        // skill 名 a-z

interface FilterState {
  term: Term | "all";
  weakOnly: boolean;
  lowStockOnly: boolean;
  hasIssuesOnly: boolean;
  query: string;
}

const DEFAULT_FILTER: FilterState = {
  term: "下册",
  weakOnly: false,
  lowStockOnly: false,
  hasIssuesOnly: false,
  query: "",
};

export function SkillBankDashboard() {
  const questions = useLiveQuery(async () => db.questions.toArray(), []);
  const attempts = useLiveQuery(async () => db.attempts.toArray(), []);
  const mastery = useLiveQuery(async () => db.mastery.toArray(), []);

  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [sortKey, setSortKey] = useState<SortKey>("genPriority");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  // v0.31.55: 行内详情展开 — 一次最多展开一行（点其他行自动收上一行）
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);

  const allRows: SkillRow[] = useMemo(() => {
    if (!questions || !attempts || !mastery) return [];
    return buildSkillRows(questions, attempts, mastery, null);
  }, [questions, attempts, mastery]);

  const filteredRows = useMemo(() => {
    let rs = allRows;
    if (filter.term !== "all") rs = rs.filter((r) => r.term === filter.term);
    if (filter.weakOnly) rs = rs.filter((r) => r.isWeak);
    if (filter.lowStockOnly) rs = rs.filter((r) => r.isLowStock);
    if (filter.hasIssuesOnly) rs = rs.filter((r) => r.auditCritical + r.auditLikelyBroken > 0);
    if (filter.query.trim()) {
      const q = filter.query.toLowerCase();
      rs = rs.filter(
        (r) =>
          r.skillName.toLowerCase().includes(q) ||
          r.unitName.toLowerCase().includes(q) ||
          r.skillId.toLowerCase().includes(q),
      );
    }
    return rs;
  }, [allRows, filter]);

  const sortedRows = useMemo(() => {
    const rs = [...filteredRows];
    rs.sort((a, b) => {
      switch (sortKey) {
        case "genPriority":
          return rowGenPriority(b) - rowGenPriority(a);
        case "mastery":
          // 薄弱在前；没答过的 (mastery=0 + attempts=0) 排到中间
          return a.mastery - b.mastery;
        case "count":
          return a.totalCount - b.totalCount;
        case "issues":
          return (
            b.auditCritical * 100 + b.auditLikelyBroken * 10 + b.auditMinor -
            (a.auditCritical * 100 + a.auditLikelyBroken * 10 + a.auditMinor)
          );
        case "examPriority":
          return b.priorityRank - a.priorityRank;
        case "name":
          return a.skillName.localeCompare(b.skillName);
        default:
          return 0;
      }
    });
    return rs;
  }, [filteredRows, sortKey]);

  const toggleSelect = (skillId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected(new Set(sortedRows.map((r) => r.skillId)));
  };

  const clearSelection = () => setSelected(new Set());

  const selectedRows = useMemo(
    () => sortedRows.filter((r) => selected.has(r.skillId)),
    [sortedRows, selected],
  );

  const summary = useMemo(() => {
    const totalQs = sortedRows.reduce((s, r) => s + r.totalCount, 0);
    const aiQs = sortedRows.reduce((s, r) => s + r.aiCount, 0);
    const issueQs = sortedRows.reduce(
      (s, r) => s + r.auditCritical + r.auditLikelyBroken,
      0,
    );
    const weakSkills = sortedRows.filter((r) => r.isWeak).length;
    const lowStock = sortedRows.filter((r) => r.isLowStock).length;
    return { totalQs, aiQs, issueQs, weakSkills, lowStock, skillCount: sortedRows.length };
  }, [sortedRows]);

  if (!questions || !attempts || !mastery) {
    return <div className="text-xs text-slate-400 py-4">加载中…</div>;
  }

  return (
    <div className="text-sm space-y-3">
      {/* 顶部统计 */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        <Stat label="筛选后 skill" value={summary.skillCount} tone="violet" />
        <Stat label="题数" value={summary.totalQs} />
        <Stat label="AI 生成" value={summary.aiQs} tone="violet" />
        <Stat label="待修问题" value={summary.issueQs} tone={summary.issueQs > 0 ? "rose" : "slate"} />
        <Stat label="薄弱 / 缺货" value={`${summary.weakSkills} / ${summary.lowStock}`} tone="amber" />
      </div>

      {/* 过滤 + 排序 */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center gap-1">
          {(["all", "上册", "下册"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter((f) => ({ ...f, term: t }))}
              className={`px-2 py-1 rounded-md border ${
                filter.term === t
                  ? "bg-violet-500/25 text-violet-100 border-violet-400/50"
                  : "bg-white/5 text-slate-400 border-white/10"
              }`}
            >
              {t === "all" ? "全部" : t === "上册" ? "📕 上册" : "📚 下册"}
            </button>
          ))}
        </div>

        <FilterChip
          label="🔥 仅薄弱"
          active={filter.weakOnly}
          onClick={() => setFilter((f) => ({ ...f, weakOnly: !f.weakOnly }))}
        />
        <FilterChip
          label="📦 仅缺货"
          active={filter.lowStockOnly}
          onClick={() => setFilter((f) => ({ ...f, lowStockOnly: !f.lowStockOnly }))}
        />
        <FilterChip
          label="❗ 仅有问题"
          active={filter.hasIssuesOnly}
          onClick={() => setFilter((f) => ({ ...f, hasIssuesOnly: !f.hasIssuesOnly }))}
        />

        <input
          type="text"
          placeholder="搜索 skill / unit"
          value={filter.query}
          onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))}
          className="ml-auto px-2 py-1 rounded-md border border-white/10 bg-ink-900/60 text-slate-200 placeholder-slate-500 w-44"
        />

        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="px-2 py-1 rounded-md border border-white/10 bg-ink-900/60 text-slate-200"
        >
          <option value="genPriority">排序：该出题度</option>
          <option value="mastery">排序：mastery 升</option>
          <option value="count">排序：题量升</option>
          <option value="issues">排序：审计问题降</option>
          <option value="examPriority">排序：期末重要度</option>
          <option value="name">排序：名称</option>
        </select>
      </div>

      {/* 表 — 移动端最小宽度 720 强制横向滚动，避免列被挤成竖排文字 */}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-xs min-w-[720px]">
          <thead className="bg-ink-900/70 text-slate-400">
            <tr>
              <th className="p-2 text-left whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={selected.size > 0 && selected.size === sortedRows.length}
                  onChange={() =>
                    selected.size === sortedRows.length ? clearSelection() : selectAllVisible()
                  }
                />
              </th>
              <th className="p-2 text-left whitespace-nowrap">知识点</th>
              <th className="p-2 text-left whitespace-nowrap">期末重要度</th>
              <th className="p-2 text-right whitespace-nowrap">题量</th>
              <th className="p-2 text-right whitespace-nowrap">AI</th>
              <th className="p-2 text-right whitespace-nowrap">问题</th>
              <th className="p-2 text-right whitespace-nowrap">Selena 状况</th>
              <th className="p-2 text-center w-10 whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => {
              const isExpanded = expandedSkillId === r.skillId;
              return (
                <Fragment key={r.skillId}>
                  <Row
                    row={r}
                    selected={selected.has(r.skillId)}
                    onToggle={() => toggleSelect(r.skillId)}
                    expanded={isExpanded}
                    onToggleExpand={() =>
                      setExpandedSkillId((prev) => (prev === r.skillId ? null : r.skillId))
                    }
                  />
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="p-0">
                        <SkillDetailPanel
                          row={r}
                          allQuestions={questions ?? []}
                          onClose={() => setExpandedSkillId(null)}
                          onRequestGen={() => {
                            // v0.31.57: 单 skill inline 出题入口 — 把当前 skill 设为唯一选中并开 modal
                            setSelected(new Set([r.skillId]));
                            setModalOpen(true);
                          }}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-slate-500 italic">
                  没有匹配的 skill
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 底部 sticky 批量操作条 */}
      {selected.size > 0 && (
        <div className="sticky bottom-2 z-10 rounded-xl border border-violet-400/40 bg-ink-900/95 backdrop-blur-md shadow-2xl px-4 py-2 flex items-center gap-3 text-sm">
          <span className="text-violet-200">
            已选 <b className="font-display">{selected.size}</b> 个 skill
          </span>
          <button type="button" onClick={clearSelection} className="text-xs text-slate-400 hover:text-slate-200 underline">
            清空
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="btn-primary text-sm"
          >
            🤖 批量 AI 出题
          </button>
        </div>
      )}

      {modalOpen && (
        <AiGenBatchModal
          selectedSkills={selectedRows}
          onClose={() => setModalOpen(false)}
          onAfterSave={() => {
            // 入库后刷新数据（useLiveQuery 自动），清空选择
            clearSelection();
          }}
        />
      )}
    </div>
  );
}

// ============ 子组件 ============

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone?: "rose" | "amber" | "violet" | "slate";
}) {
  const colorMap: Record<string, string> = {
    rose: "text-rose-300 bg-rose-500/10 border-rose-400/30",
    amber: "text-amber-300 bg-amber-500/10 border-amber-400/30",
    violet: "text-violet-300 bg-violet-500/10 border-violet-400/30",
    slate: "text-slate-300 bg-slate-700/30 border-slate-500/20",
  };
  return (
    <div className={`rounded-lg border px-3 py-2 ${colorMap[tone ?? "slate"]}`}>
      <div className="text-[10px] opacity-70">{label}</div>
      <div className="font-display font-bold text-base tabular-nums">{value}</div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 rounded-md border ${
        active
          ? "bg-amber-500/20 text-amber-100 border-amber-400/50"
          : "bg-white/5 text-slate-400 border-white/10"
      }`}
    >
      {label}
    </button>
  );
}

function Row({
  row,
  selected,
  onToggle,
  expanded,
  onToggleExpand,
}: {
  row: SkillRow;
  selected: boolean;
  onToggle: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const prio = examPriorityChip(row.examPriority);
  return (
    <tr
      className={`border-t border-white/5 hover:bg-white/5 cursor-pointer ${
        selected ? "bg-violet-500/10" : ""
      } ${expanded ? "bg-violet-500/5" : ""}`}
      onClick={onToggle}
    >
      <td className="p-2" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={onToggle} />
      </td>
      <td className="p-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`shrink-0 px-1 rounded text-[10px] ${
              row.term === "上册"
                ? "bg-cyan-500/15 text-cyan-300"
                : "bg-emerald-500/15 text-emerald-300"
            }`}
            title={row.term}
          >
            {row.term === "上册" ? "📕 上" : "📚 下"}
          </span>
          <span className="text-slate-100">{row.skillName}</span>
          {row.isWeak && (
            <span
              className="shrink-0 px-1 rounded text-[10px] bg-rose-500/20 text-rose-200"
              title={`mastery=${row.mastery} attempts=${row.attemptsCount}`}
            >
              🔥 弱
            </span>
          )}
          {row.isLowStock && (
            <span
              className="shrink-0 px-1 rounded text-[10px] bg-amber-500/20 text-amber-200"
              title={`只有 ${row.totalCount} 道`}
            >
              📦 缺
            </span>
          )}
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">{row.unitName}</div>
      </td>
      <td className="p-2 whitespace-nowrap">
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] border ${prio.tone}`}>
          {prio.label}
        </span>
      </td>
      <td className="p-2 text-right tabular-nums text-slate-200 whitespace-nowrap">
        {row.totalCount}
        <div className="text-[10px] text-slate-500">
          seed {row.seedCount}
        </div>
      </td>
      <td className="p-2 text-right tabular-nums text-slate-300">
        {row.aiCount > 0 ? row.aiCount : <span className="text-slate-600">—</span>}
      </td>
      <td className="p-2 text-right tabular-nums">
        {row.auditCritical > 0 && (
          <span className="text-rose-300" title="critical 数">🔴 {row.auditCritical}</span>
        )}
        {row.auditLikelyBroken > 0 && (
          <span className="ml-1 text-amber-300" title="likely-broken 数">🟠 {row.auditLikelyBroken}</span>
        )}
        {row.auditMinor > 0 && (
          <span className="ml-1 text-yellow-300/70" title="minor 数">🟡 {row.auditMinor}</span>
        )}
        {row.auditCritical + row.auditLikelyBroken + row.auditMinor === 0 && (
          <span className="text-slate-600">—</span>
        )}
      </td>
      <td className="p-2 text-right tabular-nums text-slate-300">
        {row.attemptsCount > 0 ? (
          <>
            <div>
              <span className="text-slate-100">m {row.mastery}</span>
              <span className="text-slate-500"> · {row.attemptsCount} 次</span>
            </div>
            <div className="text-[10px] text-slate-500 flex items-center justify-end gap-1.5 flex-wrap">
              {!Number.isNaN(row.accuracy) && <span>{Math.round(row.accuracy * 100)}% 准</span>}
              {!Number.isNaN(row.daysSinceLast) && (
                <span
                  className={
                    row.daysSinceLast === 0
                      ? "text-emerald-300/80"
                      : row.daysSinceLast <= 3
                        ? "text-slate-400"
                        : row.daysSinceLast <= 7
                          ? "text-amber-300/70"
                          : "text-rose-300/70"
                  }
                  title={`上次练习：${new Date(row.lastPracticedAt).toLocaleDateString()}`}
                >
                  · {row.daysSinceLast === 0 ? "今天" : `${row.daysSinceLast}天前`}
                </span>
              )}
            </div>
          </>
        ) : (
          <span className="text-slate-600">未练</span>
        )}
      </td>
      <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={onToggleExpand}
          className={`w-7 h-7 rounded-md text-base transition-all ${
            expanded
              ? "bg-violet-500/30 text-violet-100"
              : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
          }`}
          aria-label={expanded ? "收起详情" : "展开详情"}
          title={expanded ? "收起" : "展开本 skill 详情"}
        >
          {expanded ? "▴" : "▾"}
        </button>
      </td>
    </tr>
  );
}

// ============ v0.31.55: skill 行内详情面板 ============

function SkillDetailPanel({
  row,
  allQuestions,
  onClose,
  onRequestGen,
}: {
  row: SkillRow;
  allQuestions: Question[];
  onClose: () => void;
  /** v0.31.57: 行内点 🤖 → 父组件打开批量出题 modal 仅含本 skill */
  onRequestGen: () => void;
}) {
  const skillQuestions = useMemo(
    () =>
      allQuestions
        .filter((q) => q.skill_id === row.skillId)
        .slice()
        .sort((a, b) => {
          // AI 题排前（更可能要 review），然后按 difficulty 升序
          const aAi =
            (a.tags ?? []).includes("ai_generated") || (a.question_id ?? "").startsWith("AI_");
          const bAi =
            (b.tags ?? []).includes("ai_generated") || (b.question_id ?? "").startsWith("AI_");
          if (aAi !== bAi) return aAi ? -1 : 1;
          return (a.difficulty ?? 0) - (b.difficulty ?? 0);
        }),
    [allQuestions, row.skillId],
  );
  const [busy, setBusy] = useState(false);
  const [showLimit, setShowLimit] = useState(20);
  // v0.31.56: AI judge / fix / regen 行内集成
  const [judgments, setJudgments] = useState<Map<string, Judgment>>(new Map());
  const [judgeProgress, setJudgeProgress] = useState<{ done: number; total: number } | null>(null);
  const [regenLoadingId, setRegenLoadingId] = useState<string | null>(null);
  const [fixLoadingId, setFixLoadingId] = useState<string | null>(null);

  const skill = SKILLS.find((s) => s.id === row.skillId);
  const unit = UNITS.find((u) => u.id === row.unitId);

  const onJudgeAll = async () => {
    if (skillQuestions.length === 0) return;
    setJudgeProgress({ done: 0, total: 1 });
    try {
      const r = await judgeQuestionsInBatches(skillQuestions, {
        subjectId: "math",
        scopeLabel: `skill:${row.skillName}`,
        scopeFilter: row.skillId,
        onProgress: (p) =>
          setJudgeProgress({ done: p.done, total: p.total }),
      });
      setJudgments(new Map(r.judgments));
    } catch (e) {
      console.warn("[judgeAll] failed:", e);
      window.alert(`AI 质检失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setJudgeProgress(null);
    }
  };

  const onRegenOne = async (q: Question) => {
    if (!skill || !unit) return;
    setRegenLoadingId(q.question_id);
    try {
      const existingStems = skillQuestions.map((qq) => qq.stem).slice(0, 30);
      const term = unit.term === "综合复习" ? undefined : unit.term;
      const r = await generateAiQuestions({
        subjectId: "math",
        unitId: unit.id,
        unitName: unit.name,
        skillId: skill.id,
        skillName: skill.name,
        count: 1,
        difficulty: String(q.difficulty ?? 3),
        term,
        existingStems,
      });
      const newQ = r.questions[0];
      if (!newQ) {
        window.alert("AI 没返回新题");
        return;
      }
      const v = validateQuestion(newQ);
      if (!v.ok || !v.question) {
        window.alert(
          `生成的题没通过 validate：\n${v.issues.map((i) => `${i.severity}: ${i.path} ${i.message}`).join("\n")}`,
        );
        return;
      }
      const stamped = {
        ...v.question,
        subjectId: "math" as const,
        status: "approved" as const,
        tags: Array.from(new Set([...(v.question.tags ?? []), "ai_generated"])),
      };
      await db.questions.put(stamped as never);
      // 提示成功；用户可手动删原题
      window.alert(`✅ 新题已入库：${stamped.question_id}\n（原题保留，需要的话点 🗑️ 删）`);
    } catch (e) {
      window.alert(`重生成失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRegenLoadingId(null);
    }
  };

  const onFixOne = async (q: Question) => {
    const j = judgments.get(q.question_id);
    if (!j) return;
    setFixLoadingId(q.question_id);
    try {
      const r = await fixQuestion({
        question: q,
        issues: j.issues,
        reason: j.reason,
        subjectId: "math",
      });
      if (!window.confirm(`AI 修改建议：\n\n${r.changesSummary}\n\n应用？（会覆盖原题内容）`)) return;
      await applyQuestionFix(r.fixed);
      // 修后清这题的 judgment（避免显示旧 verdict）
      setJudgments((prev) => {
        const m = new Map(prev);
        m.delete(q.question_id);
        return m;
      });
    } catch (e) {
      window.alert(`AI 修题失败：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setFixLoadingId(null);
    }
  };

  const onClearAi = async () => {
    const aiQs = skillQuestions.filter(
      (q) =>
        (q.tags ?? []).includes("ai_generated") || (q.question_id ?? "").startsWith("AI_"),
    );
    if (aiQs.length === 0) return;
    if (
      !window.confirm(
        `将永久删除「${row.skillName}」下的 ${aiQs.length} 道 AI 题（保留 seed）。确定？`,
      )
    )
      return;
    setBusy(true);
    try {
      await recordDeletedQuestionIds(aiQs.map((q) => q.question_id));
    } finally {
      setBusy(false);
    }
  };

  const onDeleteOne = async (qid: string) => {
    if (!window.confirm(`永久删除题 ${qid}？`)) return;
    setBusy(true);
    try {
      await recordDeletedQuestionIds([qid]);
    } finally {
      setBusy(false);
    }
  };

  const judging = judgeProgress !== null;

  return (
    <div className="bg-violet-500/[0.04] border-t border-violet-400/30 px-4 py-3 text-xs">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="text-slate-300 mr-auto">
          <span className="font-display font-bold text-violet-200">{row.skillName}</span>
          <span className="ml-2 text-slate-500">
            · 共 {skillQuestions.length} 道（seed {row.seedCount} · AI {row.aiCount}）
          </span>
          {judgments.size > 0 && (
            <span className="ml-2 text-cyan-300/80">· 已质检 {judgments.size}</span>
          )}
        </div>
        <button
          type="button"
          onClick={onRequestGen}
          disabled={busy || judging}
          className="px-2 py-1 rounded-md bg-violet-500/20 hover:bg-violet-500/30 text-violet-200 border border-violet-400/40 disabled:opacity-50"
          title="给本 skill 一键批量出题（打开工作台）"
        >
          🤖 给此 skill 出题
        </button>
        <button
          type="button"
          onClick={() => void onJudgeAll()}
          disabled={busy || judging || skillQuestions.length === 0}
          className="px-2 py-1 rounded-md bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 border border-cyan-400/30 disabled:opacity-50"
          title="让 LLM 按质量规范判定每道题"
        >
          {judging
            ? `✨ 质检中… ${judgeProgress!.done}/${judgeProgress!.total}`
            : `✨ AI 质检本 skill`}
        </button>
        {row.aiCount > 0 && (
          <button
            type="button"
            onClick={() => void onClearAi()}
            disabled={busy || judging}
            className="px-2 py-1 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-400/30 disabled:opacity-50"
          >
            🗑️ 全删 AI 题（{row.aiCount}）
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-1 rounded-md bg-white/5 text-slate-400 hover:text-slate-200"
        >
          ✕ 收起
        </button>
      </div>

      {skillQuestions.length === 0 ? (
        <div className="text-slate-500 italic py-3">没有题</div>
      ) : (
        <div className="space-y-1.5 max-h-96 overflow-y-auto">
          {skillQuestions.slice(0, showLimit).map((q) => {
            const isAi =
              (q.tags ?? []).includes("ai_generated") ||
              (q.question_id ?? "").startsWith("AI_");
            const audit = auditQuestion(q);
            const auditTone =
              audit.worstSeverity === "critical"
                ? "text-rose-300"
                : audit.worstSeverity === "likely-broken"
                  ? "text-amber-300"
                  : audit.worstSeverity === "minor"
                    ? "text-yellow-300/80"
                    : "text-emerald-300/80";
            const auditIcon =
              audit.worstSeverity === "critical"
                ? "🔴"
                : audit.worstSeverity === "likely-broken"
                  ? "🟠"
                  : audit.worstSeverity === "minor"
                    ? "🟡"
                    : "🟢";
            const judgment = judgments.get(q.question_id);
            const verdictChip =
              judgment?.verdict === "delete"
                ? { label: "AI判删", tone: "bg-rose-500/25 text-rose-200" }
                : judgment?.verdict === "borderline"
                  ? { label: "AI判存疑", tone: "bg-amber-500/25 text-amber-200" }
                  : judgment?.verdict === "keep"
                    ? { label: "AI判 OK", tone: "bg-emerald-500/20 text-emerald-200" }
                    : null;
            const isRegenerating = regenLoadingId === q.question_id;
            const isFixing = fixLoadingId === q.question_id;
            const showFix = judgment && (judgment.verdict === "delete" || judgment.verdict === "borderline");
            return (
              <div
                key={q.question_id}
                className="flex items-start gap-2 px-2 py-1.5 rounded border border-white/5 bg-ink-900/40"
              >
                <span
                  className={`shrink-0 px-1 rounded text-[10px] ${
                    q.difficulty === 1 || q.difficulty === 2
                      ? "bg-cyan-500/15 text-cyan-300"
                      : q.difficulty === 3
                        ? "bg-amber-500/15 text-amber-300"
                        : "bg-rose-500/15 text-rose-300"
                  }`}
                  title={`难度 ${q.difficulty}`}
                >
                  D{q.difficulty}
                </span>
                <span
                  className={`shrink-0 px-1 rounded text-[10px] ${
                    isAi ? "bg-violet-500/15 text-violet-300" : "bg-slate-700/40 text-slate-400"
                  }`}
                >
                  {isAi ? "AI" : "seed"}
                </span>
                <span
                  className={`shrink-0 text-xs ${auditTone}`}
                  title={
                    audit.issues.length > 0
                      ? audit.issues.slice(0, 3).map((i) => `${i.code}: ${i.message}`).join(" · ")
                      : "通过"
                  }
                >
                  {auditIcon}
                </span>
                {verdictChip && (
                  <span
                    className={`shrink-0 px-1 rounded text-[10px] ${verdictChip.tone}`}
                    title={`${judgment!.reason}\n\n${judgment!.issues.join("\n")}`}
                  >
                    {verdictChip.label}
                  </span>
                )}
                <span className="flex-1 min-w-0 text-slate-300 truncate" title={q.stem}>
                  {q.stem}
                </span>
                {showFix && (
                  <button
                    type="button"
                    onClick={() => void onFixOne(q)}
                    disabled={busy || isFixing}
                    className="shrink-0 px-1.5 text-amber-300 hover:text-amber-200 disabled:opacity-50"
                    title={`AI 修一下：\n${judgment!.reason}`}
                  >
                    {isFixing ? "⏳" : "🔧"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void onRegenOne(q)}
                  disabled={busy || isRegenerating || !skill || !unit}
                  className="shrink-0 px-1.5 text-violet-300 hover:text-violet-200 disabled:opacity-50"
                  title="生成一道相似题（原题保留）"
                >
                  {isRegenerating ? "⏳" : "🔄"}
                </button>
                <button
                  type="button"
                  onClick={() => void onDeleteOne(q.question_id)}
                  disabled={busy}
                  className="shrink-0 px-1.5 text-slate-500 hover:text-rose-300 disabled:opacity-50"
                  title="删此题"
                >
                  🗑️
                </button>
              </div>
            );
          })}
          {skillQuestions.length > showLimit && (
            <button
              type="button"
              onClick={() => setShowLimit((n) => n + 30)}
              className="w-full py-1.5 text-slate-400 hover:text-slate-200 text-[11px]"
            >
              再显示 30 道（共 {skillQuestions.length} 道）
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// 给 ExamPriority 用 — 防 unused import warn
const _unusedExamPriority: ExamPriority | null = null;
void _unusedExamPriority;
