/**
 * 英语首页 (v0.31.41)
 *
 * 顶部 banner + 上下册各自 tier 分布 + 进入 vocab 卡。
 */

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { db } from "../../db/dexie";
import { G4_WORDS } from "../../subjects/english/wordList";
import {
  calcTierDistribution,
  loadVocabProgress,
  type VocabProgress,
} from "../../lib/englishVocabProgress";
import { MasteryTierBar } from "../../components/MasteryTierBar";
import type { TierDistribution } from "../../lib/masteryTier";

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
  const upperDist = progress ? calcTierDistribution(upperPool, progress) : null;
  const lowerDist = progress ? calcTierDistribution(lowerPool, progress) : null;

  return (
    <div className="space-y-5">
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

      <Link
        to="/english/vocab"
        className="card-glow bg-gradient-to-br from-cyan-500/15 to-blue-500/10 border-cyan-400/40 hover:scale-[1.01] transition-transform block"
      >
        <div className="flex items-center gap-3">
          <div className="text-3xl">🔤</div>
          <div className="flex-1">
            <div className="font-display font-bold text-cyan-100">
              单词记忆 · 5-tier 分级 + 间隔重现
            </div>
            <div className="text-xs text-slate-300 mt-0.5">
              3 模式 · 看单词→中文 / 看中文→单词 / 听读音→单词
            </div>
            <div className="text-[11px] text-cyan-300/80 mt-1">
              从老系统迁移进度 · 答错的会强化 · 答对的按间隔回炉
            </div>
          </div>
          <div className="text-cyan-300 text-2xl">→</div>
        </div>
      </Link>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <BookCard label="四年级上册" total={upperPool.length} dist={upperDist} />
        <BookCard label="四年级下册" total={lowerPool.length} dist={lowerDist} />
      </div>

      <div className="card text-xs text-slate-400 leading-relaxed">
        💡 玩法：进 "单词" 页面后可切换上/下册和 3 种模式。
        <ul className="list-disc pl-5 mt-1">
          <li>🌱 新 → 📖 初识 → ✨ 在学 → ⭐ 熟练 → 🏆 掌握 五个等级</li>
          <li>答错的字下 2 题内必现，答对的按间隔回炉（1分→1时→1天→3天→14天）</li>
          <li>每日目标 + 连续打卡，完成有庆祝</li>
        </ul>
      </div>
    </div>
  );
}

function BookCard({
  label,
  total,
  dist,
}: {
  label: string;
  total: number;
  dist: TierDistribution | null;
}) {
  return (
    <div className="card">
      <div className="text-xs text-slate-400 mb-2">{label}</div>
      {!dist ? (
        <div className="text-slate-500 text-sm">— 加载中 —</div>
      ) : (
        <>
          <MasteryTierBar dist={dist} />
          <div className="text-[10px] text-slate-500 mt-2 text-center">
            总 {total} 词 · 已掌握 {dist.byLevel[4]} ·{" "}
            {Math.round((dist.byLevel[4] / total) * 100)}%
          </div>
        </>
      )}
    </div>
  );
}
