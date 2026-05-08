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
import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/dexie";
import {
  buildSkillRows,
  examPriorityChip,
  rowGenPriority,
  type SkillRow,
} from "../../lib/skillDiagnostic";
import { AiGenBatchModal } from "./AiGenBatchModal";
import type { ExamPriority, Term } from "../../core/types";

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
        <Stat label="待修问题题" value={summary.issueQs} tone={summary.issueQs > 0 ? "rose" : "slate"} />
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

      {/* 表 */}
      <div className="overflow-x-auto rounded-lg border border-white/10">
        <table className="w-full text-xs">
          <thead className="bg-ink-900/70 text-slate-400">
            <tr>
              <th className="p-2 text-left">
                <input
                  type="checkbox"
                  checked={selected.size > 0 && selected.size === sortedRows.length}
                  onChange={() =>
                    selected.size === sortedRows.length ? clearSelection() : selectAllVisible()
                  }
                />
              </th>
              <th className="p-2 text-left">知识点</th>
              <th className="p-2 text-left">期末重要度</th>
              <th className="p-2 text-right">题量</th>
              <th className="p-2 text-right">AI</th>
              <th className="p-2 text-right">问题</th>
              <th className="p-2 text-right">Selena 状况</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((r) => (
              <Row
                key={r.skillId}
                row={r}
                selected={selected.has(r.skillId)}
                onToggle={() => toggleSelect(r.skillId)}
              />
            ))}
            {sortedRows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-slate-500 italic">
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
}: {
  row: SkillRow;
  selected: boolean;
  onToggle: () => void;
}) {
  const prio = examPriorityChip(row.examPriority);
  return (
    <tr
      className={`border-t border-white/5 hover:bg-white/5 cursor-pointer ${
        selected ? "bg-violet-500/10" : ""
      }`}
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
      <td className="p-2">
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] border ${prio.tone}`}>
          {prio.label}
        </span>
      </td>
      <td className="p-2 text-right tabular-nums text-slate-200">
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
            {!Number.isNaN(row.accuracy) && (
              <div className="text-[10px] text-slate-500">
                {Math.round(row.accuracy * 100)}% 准
              </div>
            )}
          </>
        ) : (
          <span className="text-slate-600">未练</span>
        )}
      </td>
    </tr>
  );
}

// 给 ExamPriority 用 — 防 unused import warn
const _unusedExamPriority: ExamPriority | null = null;
void _unusedExamPriority;
