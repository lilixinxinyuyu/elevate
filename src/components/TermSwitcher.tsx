/**
 * TermSwitcher — 赛季切换 (v0.31.43)
 *
 * 完全对齐数学 Home 的 UX：
 *   "赛季：" label + 3 个 pill chips
 *     📚 四年级下册（当前）  ← 默认 active
 *     📕 四年级上册
 *     🎯 综合复习
 *
 * 综合复习对 chinese / english：上下册混合池。
 * active 的 chip 显示 (当前) 后缀 + 紫色边框 + glow。
 *
 * 写 student.currentTerm + selectedTerm::math::<sid> meta（与数学共用一个 key 简化）。
 */

import { useState } from "react";
import { db } from "../db/dexie";
import type { Term } from "../core/types";

const TERMS: { id: Term; emoji: string; label: string }[] = [
  { id: "下册", emoji: "📚", label: "四年级下册" },
  { id: "上册", emoji: "📕", label: "四年级上册" },
  { id: "综合复习", emoji: "🎯", label: "综合复习" },
];

interface TermSwitcherProps {
  currentTerm: Term;
  onChange: (newTerm: Term) => void;
  /** 是否 persist 到 student.currentTerm（默认 true） */
  persist?: boolean;
}

export function TermSwitcher({
  currentTerm,
  onChange,
  persist = true,
}: TermSwitcherProps) {
  const [pending, setPending] = useState<Term | null>(null);
  async function pick(t: Term) {
    if (t === currentTerm || pending) return;
    setPending(t);
    try {
      if (persist) {
        const ss = await db.students.toArray();
        const s = ss[0];
        if (s) {
          await db.students.update(s.id, { currentTerm: t });
          // 与数学的 selectedTerm meta key 保持一致（math:: prefix 是历史名）
          await db.meta.put({ key: `selectedTerm::math::${s.id}`, value: t });
        }
      }
      onChange(t);
    } finally {
      setPending(null);
    }
  }
  return (
    <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-1">
      <span className="text-xs text-slate-400 shrink-0">赛季：</span>
      {TERMS.map((t) => {
        const active = currentTerm === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => pick(t.id)}
            className={`shrink-0 chip text-xs px-3 py-1.5 transition-all ${
              active
                ? "bg-violet-500/30 text-violet-100 border border-violet-400/60 shadow-glow-violet"
                : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10"
            }`}
          >
            <span className="mr-1">{t.emoji}</span>
            {t.label}
            {active && <span className="ml-1 text-violet-200/80">（当前）</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Term → 字/词池的过滤（chinese/english 用）。
 *   "上册" → G4A
 *   "下册" → G4B
 *   "综合复习" → null（含义：不过滤，上下册都包括）
 */
export function termToSemester(t: Term): "G4A" | "G4B" | null {
  if (t === "上册") return "G4A";
  if (t === "下册") return "G4B";
  return null;
}

/** 加载 student.currentTerm（默认 "下册"）。 */
export async function loadCurrentTerm(): Promise<Term> {
  const ss = await db.students.toArray();
  const s = ss[0];
  return ((s?.currentTerm as Term | undefined) ?? "下册");
}

/** 安全 default：如果 student.currentTerm 为空，写入 "下册"。 */
export async function ensureDefaultTerm(): Promise<void> {
  const ss = await db.students.toArray();
  const s = ss[0];
  if (s && !s.currentTerm) {
    await db.students.update(s.id, { currentTerm: "下册" });
  }
}
