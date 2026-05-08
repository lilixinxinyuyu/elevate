/**
 * 英语首页 (v0.31.39 MVP)
 *
 * 范围：仅作为 vocab 入口；后续可在这里加听力 / 写作 / 阅读卡片。
 */

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { db } from "../../db/dexie";
import { G4_WORDS } from "../../subjects/english/wordList";
import {
  loadVocabProgress,
  summarizeVocab,
  type VocabSummary,
} from "../../lib/englishVocabProgress";

export function EnglishHomePage() {
  const [summary, setSummary] = useState<VocabSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ss = await db.students.toArray();
      const s = ss[0];
      if (!s || cancelled) return;
      const p = await loadVocabProgress(s.id);
      if (cancelled) return;
      setSummary(summarizeVocab(G4_WORDS, p));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-5">
      {/* 顶部 banner */}
      <div className="card-glow bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-400/30">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 text-white flex items-center justify-center font-display font-bold shadow-glow">
            英
          </div>
          <div className="flex-1">
            <div className="font-display font-bold text-xl">英语</div>
            <div className="text-xs text-slate-300 mt-0.5">
              外研版四年级 · 上下册全部 {G4_WORDS.length} 单词
            </div>
          </div>
        </div>
      </div>

      {/* 单词练习 */}
      <Link
        to="/english/vocab"
        className="card-glow bg-gradient-to-br from-cyan-500/15 to-blue-500/10 border-cyan-400/40 hover:scale-[1.01] transition-transform block"
      >
        <div className="flex items-center gap-3">
          <div className="text-3xl">🔤</div>
          <div className="flex-1">
            <div className="font-display font-bold text-cyan-100">
              单词记忆 · 加权练习
            </div>
            <div className="text-xs text-slate-300 mt-0.5">
              {summary
                ? `已掌握 ${summary.mastered} / ${summary.total} · 错过的会再出现`
                : `${G4_WORDS.length} 个 G4 单词 · 错过的会再出现`}
            </div>
            <div className="text-[11px] text-cyan-300/80 mt-1">
              已自动从老系统迁移之前的进度
            </div>
          </div>
          <div className="text-cyan-300 text-2xl">→</div>
        </div>
      </Link>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Stat label="总单词" value={summary.total} tone="violet" />
          <Stat label="已掌握" value={summary.mastered} tone="emerald" />
          <Stat label="待巩固" value={summary.shaky} tone="rose" />
          <Stat label="没见过" value={summary.fresh} tone="amber" />
        </div>
      )}

      <div className="card text-xs text-slate-400 leading-relaxed">
        💡 路线图：
        <ul className="list-disc pl-5 mt-1 space-y-0.5">
          <li>当前：单词中文意思 → 输入英文（含老系统进度迁移）</li>
          <li>计划：听音选词 / 句子排序 / 完形填空</li>
          <li>计划：进入"今日挑战"作为一环</li>
        </ul>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "violet" | "emerald" | "rose" | "amber";
}) {
  const cls = {
    violet: "text-violet-300",
    emerald: "text-emerald-300",
    rose: "text-rose-300",
    amber: "text-amber-300",
  }[tone];
  return (
    <div className="card text-center">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className={`font-display font-bold text-xl mt-1 ${cls}`}>{value}</div>
    </div>
  );
}
