/**
 * TermSwitcher — 切换学期 (赛季) 组件 (v0.31.42)
 *
 * 学期是一个赛季（用户："切换了以后，所出现的内容应该都是只有这一个赛季的，
 * 而不是包含上一个赛季的"）。
 *
 * 这个组件读 student.currentTerm，点击切换 → 写回 db.students.update + 刷新页面。
 *
 * 用在所有学科的 home 页：math/chinese/english 全部用同一个组件，跨学科一致。
 */

import { useState } from "react";
import { db } from "../db/dexie";
import type { Term } from "../core/types";

export function TermSwitcher({
  currentTerm,
  onChange,
}: {
  currentTerm: Term;
  onChange: (newTerm: Term) => void;
}) {
  const [pending, setPending] = useState(false);
  async function pick(t: Term) {
    if (t === currentTerm || pending) return;
    setPending(true);
    try {
      const ss = await db.students.toArray();
      const s = ss[0];
      if (s) {
        await db.students.update(s.id, { currentTerm: t });
      }
      onChange(t);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="flex gap-2">
      <TermPill label="四年级上册" semester="G4A" active={currentTerm === "上册"} onClick={() => pick("上册")} />
      <TermPill label="四年级下册" semester="G4B" active={currentTerm === "下册"} onClick={() => pick("下册")} />
    </div>
  );
}

function TermPill({
  label,
  semester,
  active,
  onClick,
}: {
  label: string;
  semester: "G4A" | "G4B";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
        active
          ? "bg-violet-500/20 text-violet-100 border border-violet-400/40"
          : "bg-ink-900/40 text-slate-400 border border-ink-700/60 hover:bg-ink-700/40"
      }`}
    >
      <span className="inline-flex items-center gap-2">
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded ${
            active ? "bg-violet-400/30 text-violet-100" : "bg-slate-700 text-slate-400"
          }`}
        >
          {semester}
        </span>
        {label}
      </span>
    </button>
  );
}

/** Term ↔ Semester 映射（用在 chinese/english char/word 列表 filter） */
export function termToSemester(t: Term): "G4A" | "G4B" {
  return t === "上册" ? "G4A" : "G4B";
}
