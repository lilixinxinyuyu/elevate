import { useEffect, useState } from "react";
import { getStoredPassword } from "../db/cloudSync";

/**
 * v0.31.79：Admin tab 的"报告 / 修题历史"面板。
 *
 * 显示用户用 ReportQuestionButton 报告的题 + AI 修题前后状态。
 * 用于：
 *   - 找 prompt 失败模式（AI 修题失败的题集中在哪类 reason / skill）
 *   - 复审 AI 自动修过的题（万一改出新 bug 可以人工 rollback）
 *   - 统计哪些题反复被报告（指向 prompt 或题目本身的设计问题）
 */

interface Report {
  id: number;
  question_id: string;
  reason: string;
  reason_text: string | null;
  original: { stem?: string } & Record<string, unknown>;
  fixed: ({ stem?: string } & Record<string, unknown>) | null;
  changes_summary: string | null;
  ai_fix_succeeded: boolean;
  llm_error: string | null;
  created_at: number;
}

const REASON_LABEL: Record<string, string> = {
  answer_wrong: "答案不对",
  options_same: "选项都一样",
  options_no_correct: "没有正确答案",
  stem_unclear: "题面看不懂",
  math_error: "数字 / 计算错",
  other: "其他",
};

export function ReportsPanel() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "failed">("all");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  async function load() {
    setError(null);
    setReports(null);
    try {
      const pwd = getStoredPassword();
      const params = new URLSearchParams({ limit: "100" });
      if (filter === "failed") params.set("onlyFailed", "1");
      const r = await fetch(`/api/admin/list-reports?${params}`, {
        headers: pwd ? { Authorization: `Bearer ${pwd}` } : {},
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error ?? "unknown");
      setReports(j.reports as Report[]);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    void load();
  }, [filter]);

  function toggle(id: number) {
    setExpanded((s) => {
      const ns = new Set(s);
      if (ns.has(id)) ns.delete(id);
      else ns.add(id);
      return ns;
    });
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div>
          <div className="font-semibold">🐛 用户报告的题（AI 修题历史）</div>
          <div className="text-xs text-slate-400 mt-0.5">
            Selena 在做题时点 "🐛 报告" 后这里就会有记录。AI 修过的可以复审；修不动的指向 prompt 或题本身设计问题。
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          className="text-xs px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10"
        >
          🔄 刷新
        </button>
      </div>

      <div className="flex gap-1 mb-3">
        {(["all", "failed"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1 rounded-full ${
              filter === f
                ? "bg-violet-500/30 text-violet-100 border border-violet-400/50"
                : "bg-white/5 text-slate-400 hover:bg-white/10"
            }`}
          >
            {f === "all" ? "全部" : "AI 修失败"}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-400/30 rounded-md p-2 mb-2">
          加载失败：{error}
        </div>
      )}

      {!reports && !error && <div className="text-sm text-slate-400">加载中…</div>}

      {reports && reports.length === 0 && (
        <div className="text-sm text-slate-400">暂无报告。Selena 还没用过报告按钮。</div>
      )}

      {reports && reports.length > 0 && (
        <div className="space-y-2">
          {reports.map((r) => {
            const isExpanded = expanded.has(r.id);
            const stem = r.original?.stem ?? "(stem 缺失)";
            const dt = new Date(r.created_at);
            return (
              <div
                key={r.id}
                className={`rounded-lg border ${
                  r.ai_fix_succeeded
                    ? "border-emerald-400/30 bg-emerald-500/5"
                    : "border-rose-400/30 bg-rose-500/5"
                } p-2.5 text-sm`}
              >
                <div className="flex items-start gap-2">
                  <span className="text-lg shrink-0">{r.ai_fix_succeeded ? "✅" : "⚠️"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-slate-200">
                        {REASON_LABEL[r.reason] ?? r.reason}
                      </span>
                      <code className="text-[11px] text-slate-400 truncate">{r.question_id}</code>
                      <span className="text-[10px] text-slate-500 ml-auto tabular-nums shrink-0">
                        {dt.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-slate-200 mt-1.5 line-clamp-2">{String(stem)}</div>
                    {r.reason_text && (
                      <div className="text-[11px] text-slate-400 mt-1 italic">"{r.reason_text}"</div>
                    )}
                    {r.changes_summary && (
                      <div className="text-[11px] text-emerald-200 mt-1">改动：{r.changes_summary}</div>
                    )}
                    {r.llm_error && (
                      <div className="text-[11px] text-rose-200 mt-1">LLM error: {r.llm_error}</div>
                    )}
                    <button
                      type="button"
                      onClick={() => toggle(r.id)}
                      className="text-[11px] text-violet-300 hover:text-violet-100 mt-1.5"
                    >
                      {isExpanded ? "收起" : "展开 JSON 对照"}
                    </button>
                    {isExpanded && (
                      <div className="grid sm:grid-cols-2 gap-2 mt-2">
                        <div>
                          <div className="text-[10px] text-slate-400 mb-1">原题</div>
                          <pre className="text-[10px] bg-ink-900/80 border border-white/5 rounded p-2 overflow-auto max-h-64 text-slate-300">
                            {JSON.stringify(r.original, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 mb-1">修后题</div>
                          <pre className="text-[10px] bg-ink-900/80 border border-white/5 rounded p-2 overflow-auto max-h-64 text-slate-300">
                            {r.fixed ? JSON.stringify(r.fixed, null, 2) : "(未修成功)"}
                          </pre>
                        </div>
                      </div>
                    )}
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
