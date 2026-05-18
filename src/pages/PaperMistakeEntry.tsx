/**
 * v0.35.8 (iter 42 P2-3): 试卷错题手动录入页面 (admin/super-admin).
 *
 * 评审共识: v1 砍 OCR, 改"手动录入". 闭环验证"线下试卷 → app 队列".
 *
 * 流程:
 *   1. Admin 选 cadet (Selena 等)
 *   2. 选试卷 kind (期中/期末/作业/小测)
 *   3. 填试卷标题
 *   4. 录入错题表格 (题干 / 正解 / Selena 答 / 错误原因 / 备注)
 *   5. "保存到草稿" / "推送给 Selena"
 *
 * 后端: POST /api/super-admin/papers/save
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  genPaperId,
  genPaperMistakeId,
  validatePaperMistake,
  type PaperKind,
  type PaperMistakeEntry,
  type PaperRecord,
} from "../core/paperMistakes";

const KIND_OPTIONS: { value: PaperKind; label: string }[] = [
  { value: "midterm", label: "期中考试" },
  { value: "final", label: "期末考试" },
  { value: "quiz", label: "小测验" },
  { value: "homework", label: "作业" },
  { value: "other", label: "其它" },
];

export default function PaperMistakeEntryPage() {
  const navigate = useNavigate();
  const [paperId] = useState(() => genPaperId());
  const [cadetUid, setCadetUid] = useState("selena"); // 默认 Selena, 可改
  const [kind, setKind] = useState<PaperKind>("final");
  const [title, setTitle] = useState("");
  const [mistakes, setMistakes] = useState<PaperMistakeEntry[]>([
    { paperQuestionId: genPaperMistakeId(), stem: "", correctAnswer: "", studentAnswer: "" },
  ]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function updateMistake(idx: number, patch: Partial<PaperMistakeEntry>) {
    setMistakes((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  }

  function addMistake() {
    setMistakes((prev) => [...prev, { paperQuestionId: genPaperMistakeId(), stem: "", correctAnswer: "", studentAnswer: "" }]);
  }

  function removeMistake(idx: number) {
    setMistakes((prev) => prev.filter((_, i) => i !== idx));
  }

  const validation = useMemo(() => {
    const errs: string[] = [];
    if (!title.trim()) errs.push("试卷标题不能空");
    if (!cadetUid.trim()) errs.push("Cadet ID 不能空");
    if (mistakes.length === 0) errs.push("至少录一道错题");
    mistakes.forEach((m, i) => {
      const e = validatePaperMistake(m);
      if (e) errs.push(`第 ${i + 1} 题: ${e}`);
    });
    return errs;
  }, [title, cadetUid, mistakes]);

  async function onSave(asPush: boolean) {
    setMsg(null);
    if (validation.length > 0) {
      setMsg({ type: "err", text: validation[0] ?? "校验失败" });
      return;
    }
    setBusy(true);
    try {
      const now = Date.now();
      const enrichedMistakes: PaperMistakeEntry[] = mistakes.map((m) =>
        asPush ? { ...m, pushedAt: m.pushedAt ?? now } : m,
      );
      const record: PaperRecord = {
        paperId,
        cadetUid: cadetUid.trim(),
        kind,
        title: title.trim(),
        createdAt: now,
        updatedAt: now,
        enteredBy: "admin", // TODO: 取真 admin 信息
        mistakes: enrichedMistakes,
      };
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const password = typeof window !== "undefined" ? localStorage.getItem("selena.cloud.pwd") : null;
      if (password) headers["X-App-Password"] = password;
      const res = await fetch("/api/super-admin/papers/save", {
        method: "POST",
        headers,
        body: JSON.stringify(record),
      });
      const body = await res.json().catch(() => ({})) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setMsg({ type: "err", text: `保存失败: ${body.error ?? res.status}` });
        return;
      }
      setMsg({
        type: "ok",
        text: asPush
          ? `✅ 已推送 ${enrichedMistakes.length} 道错题给 ${cadetUid} (Lazy 模式 - Selena 训练时再加进队列)`
          : `📝 已保存草稿 (${enrichedMistakes.length} 道错题)`,
      });
    } catch (e) {
      setMsg({ type: "err", text: `网络错误: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-purple-100">📝 试卷错题录入</h1>
        <button onClick={() => navigate(-1)} className="text-xs text-slate-400 hover:text-slate-200">返回</button>
      </div>

      <div className="rounded-lg bg-purple-500/10 border border-purple-400/30 p-3 text-xs text-purple-200/80 space-y-1">
        <p>📌 用于把 Selena 真实考试 / 作业里的错题录入系统.</p>
        <p>录入的错题会单独存档 (不影响 mastery 主数据), 等 Selena 训练时由"错题侦探" / 强化挑战 lazy 拉取.</p>
        <p className="text-purple-300">v1 是手动录入 — 拍照 OCR 留 v2 (评审共识).</p>
      </div>

      {/* Paper meta */}
      <div className="rounded-xl bg-slate-900/50 border border-purple-400/30 p-3 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-purple-200">Cadet ID</label>
            <input
              value={cadetUid}
              onChange={(e) => setCadetUid(e.target.value)}
              className="w-full mt-1 px-2 py-1.5 rounded bg-slate-800 text-purple-50 border border-purple-400/30 text-sm focus:outline-none focus:border-purple-300"
            />
          </div>
          <div>
            <label className="text-xs text-purple-200">试卷类型</label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as PaperKind)}
              className="w-full mt-1 px-2 py-1.5 rounded bg-slate-800 text-purple-50 border border-purple-400/30 text-sm focus:outline-none focus:border-purple-300"
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-purple-200">试卷标题</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例: 2026 春季四年级数学期末"
            className="w-full mt-1 px-2 py-1.5 rounded bg-slate-800 text-purple-50 border border-purple-400/30 text-sm focus:outline-none focus:border-purple-300"
          />
        </div>
      </div>

      {/* Mistakes table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-purple-100">错题列表 ({mistakes.length} 道)</h2>
          <button
            onClick={addMistake}
            className="px-2.5 py-1 rounded bg-purple-500 text-white text-xs font-semibold hover:bg-purple-400"
          >
            + 加一道
          </button>
        </div>
        {mistakes.map((m, i) => (
          <div key={m.paperQuestionId} className="rounded-lg bg-slate-900/40 border border-purple-400/20 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-purple-300/80">第 {i + 1} 题</span>
              {mistakes.length > 1 && (
                <button onClick={() => removeMistake(i)} className="text-xs text-rose-300 hover:text-rose-100">删除</button>
              )}
            </div>
            <textarea
              value={m.stem}
              onChange={(e) => updateMistake(i, { stem: e.target.value })}
              placeholder="题干 (例: 312 × 47 = ?)"
              rows={2}
              className="w-full px-2 py-1.5 rounded bg-slate-800 text-purple-50 border border-purple-400/30 text-sm focus:outline-none focus:border-purple-300"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={m.correctAnswer}
                onChange={(e) => updateMistake(i, { correctAnswer: e.target.value })}
                placeholder="正确答案"
                className="px-2 py-1.5 rounded bg-slate-800 text-emerald-100 border border-emerald-400/30 text-sm focus:outline-none focus:border-emerald-300"
              />
              <input
                value={m.studentAnswer}
                onChange={(e) => updateMistake(i, { studentAnswer: e.target.value })}
                placeholder="Selena 答 (用 '空' 表示没写)"
                className="px-2 py-1.5 rounded bg-slate-800 text-rose-100 border border-rose-400/30 text-sm focus:outline-none focus:border-rose-300"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                value={m.errorTag ?? ""}
                onChange={(e) => updateMistake(i, { errorTag: e.target.value })}
                placeholder="错误标签 (例: 进位漏 / 单位错)"
                className="px-2 py-1.5 rounded bg-slate-800 text-amber-100 border border-amber-400/30 text-sm focus:outline-none focus:border-amber-300"
              />
              <input
                value={m.notes ?? ""}
                onChange={(e) => updateMistake(i, { notes: e.target.value })}
                placeholder="备注 (可选)"
                className="px-2 py-1.5 rounded bg-slate-800 text-slate-200 border border-slate-500/30 text-sm focus:outline-none focus:border-slate-300"
              />
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      {msg && (
        <div className={`rounded-lg px-3 py-2 text-sm ${msg.type === "ok" ? "bg-emerald-500/15 text-emerald-100 border border-emerald-400/40" : "bg-rose-500/15 text-rose-100 border border-rose-400/40"}`}>
          {msg.text}
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => onSave(false)}
          disabled={busy}
          className="flex-1 px-4 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm font-semibold hover:bg-slate-600 disabled:opacity-50"
        >
          {busy ? "保存中..." : "💾 仅保存草稿"}
        </button>
        <button
          onClick={() => onSave(true)}
          disabled={busy}
          className="flex-1 px-4 py-2 rounded-lg bg-purple-500 text-white text-sm font-semibold hover:bg-purple-400 disabled:opacity-50"
        >
          {busy ? "推送中..." : `🚀 推送 ${mistakes.length} 道错题给 ${cadetUid}`}
        </button>
      </div>
    </div>
  );
}
