/**
 * 英语首页 (v0.31.40 重写)
 *
 * 顶部 banner + 上下册各自 stats（已掌握/薄弱/未学习）+ 进入 vocab 卡。
 */

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { db } from "../../db/dexie";
import { G4_WORDS } from "../../subjects/english/wordList";
import {
  calcOldStyleStats,
  loadVocabProgress,
  type OldStyleVocabStats,
  type VocabProgress,
} from "../../lib/englishVocabProgress";

export function EnglishHomePage() {
  const [progress, setProgress] = useState<VocabProgress | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ss = await db.students.toArray();
      const s = ss[0];
      if (!s || cancelled) return;
      const p = await loadVocabProgress(s.id);
      if (cancelled) return;
      setProgress(p);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const upperPool = G4_WORDS.filter((w) => w.semester === "G4A");
  const lowerPool = G4_WORDS.filter((w) => w.semester === "G4B");
  const upperStats = progress ? calcOldStyleStats(upperPool, progress) : null;
  const lowerStats = progress ? calcOldStyleStats(lowerPool, progress) : null;

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

      {/* 单词练习入口 */}
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
              3 模式：看单词 → 选中文 / 看中文 → 选单词 / 听读音 → 选单词
            </div>
            <div className="text-[11px] text-cyan-300/80 mt-1">
              已自动从老系统迁移之前的进度
            </div>
          </div>
          <div className="text-cyan-300 text-2xl">→</div>
        </div>
      </Link>

      {/* 上下册各自统计（老系统口径：已掌握/薄弱/未学习） */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <BookStatsCard label="四年级上册" stats={upperStats} total={upperPool.length} />
        <BookStatsCard label="四年级下册" stats={lowerStats} total={lowerPool.length} />
      </div>

      <div className="card text-xs text-slate-400 leading-relaxed">
        💡 玩法：进 "单词" 页面后可切换上/下册和 3 种模式。错过的词会在加权随机中更频繁出现。
      </div>
    </div>
  );
}

function BookStatsCard({
  label,
  stats,
  total,
}: {
  label: string;
  stats: OldStyleVocabStats | null;
  total: number;
}) {
  return (
    <div className="card">
      <div className="text-xs text-slate-400 mb-2">{label}</div>
      {!stats ? (
        <div className="text-slate-500 text-sm">— 加载中 —</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-[10px] text-slate-400">已掌握</div>
              <div className="font-display font-bold text-lg text-emerald-300">
                {stats.mastered}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">薄弱</div>
              <div className="font-display font-bold text-lg text-rose-300">
                {stats.weak}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400">未学习</div>
              <div className="font-display font-bold text-lg text-amber-300">
                {stats.unknown}
              </div>
            </div>
          </div>
          <div className="text-[10px] text-slate-500 mt-2 text-center">
            总 {total} 词 · 已掌握 {Math.round((stats.mastered / total) * 100)}%
          </div>
        </>
      )}
    </div>
  );
}
