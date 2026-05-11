/**
 * 英语首页 (v0.31.42)
 *
 * 跟数学一致的设计：
 *   - 顶部 banner
 *   - 学期切换（写 student.currentTerm；赛季制）
 *   - 今日 3 环（词汇大冒险 / 闪电冲刺 / 复习薄弱）
 *   - 5-tier 分布卡（仅本赛季）
 */

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { db } from "../../db/dexie";
import { G4_WORDS } from "../../subjects/english/wordList";
import {
  calcOldStyleStats,
  calcTierDistribution,
  loadVocabProgress,
  type VocabProgress,
} from "../../lib/englishVocabProgress";
import { MasteryTierBar } from "../../components/MasteryTierBar";
import { SubjectTodayRings, type RingSpec } from "../../components/SubjectTodayRings";
import { TermSwitcher, termToSemester, ensureDefaultTerm } from "../../components/TermSwitcher";
import { loadDaily, type DailyState } from "../../lib/dailyTarget";
import type { Term } from "../../core/types";

export function EnglishHomePage() {
  const [progress, setProgress] = useState<VocabProgress | null>(null);
  const [daily, setDaily] = useState<DailyState | null>(null);
  const [currentTerm, setCurrentTerm] = useState<Term>("下册");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await ensureDefaultTerm();
      const ss = await db.students.toArray();
      const s = ss[0];
      if (!s || cancelled) return;
      setCurrentTerm((s.currentTerm as Term) ?? "下册");
      const p = await loadVocabProgress(s.id);
      const d = await loadDaily("english_vocab", s.id, 20);
      if (cancelled) return;
      setProgress(p);
      setDaily(d);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const semester = termToSemester(currentTerm);
  // 综合复习 (semester=null) → 上下册混合
  const pool =
    semester === null
      ? G4_WORDS
      : G4_WORDS.filter((w) => w.semester === semester);
  const dist = progress ? calcTierDistribution(pool, progress) : null;
  const stats = progress ? calcOldStyleStats(pool, progress) : null;

  const rings: RingSpec[] = buildRings(daily, stats);

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
              外研版四年级 · 当前赛季：{currentTerm}（{pool.length} 词）
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Link
            to={`/english/vocab?fresh=${Date.now()}`}
            className="btn-primary text-base px-5 py-2.5"
          >
            ▶ 开始今日挑战
          </Link>
        </div>
      </div>

      {/* 学期切换 */}
      <TermSwitcher currentTerm={currentTerm} onChange={(t) => setCurrentTerm(t)} />

      {/* 今日 3 环 */}
      <SubjectTodayRings rings={rings} />

      {/* 词汇大冒险入口（v0.31.103 加 📣 朗读 AI 判 模式） */}
      <Link
        to="/english/vocab"
        className="card-glow bg-gradient-to-br from-cyan-500/15 to-blue-500/10 border-cyan-400/40 hover:scale-[1.01] transition-transform block"
      >
        <div className="flex items-center gap-3">
          <div className="text-3xl">🌍</div>
          <div className="flex-1">
            <div className="font-display font-bold text-cyan-100">
              词汇大冒险 · 5 种玩法
            </div>
            <div className="text-xs text-slate-300 mt-0.5">
              看词→中文 / 看中文→词 / 🔊 听→词 / 📣 朗读 AI 判 / ⚡ 闪电冲刺
            </div>
            <div className="text-[11px] text-cyan-300/80 mt-1">
              5-tier 等级 · 间隔重现 · 答错的会强化
            </div>
          </div>
          <div className="text-cyan-300 text-2xl">→</div>
        </div>
      </Link>

      {/* v0.31.103: 短句大冒险入口 */}
      <Link
        to="/english/sentence"
        className="card-glow bg-gradient-to-br from-violet-500/15 to-pink-500/10 border-violet-400/40 hover:scale-[1.01] transition-transform block"
      >
        <div className="flex items-center gap-3">
          <div className="text-3xl">🗣️</div>
          <div className="flex-1">
            <div className="font-display font-bold text-violet-100">
              短句大冒险 · 2 种玩法
            </div>
            <div className="text-xs text-slate-300 mt-0.5">
              📣 朗读 AI 判分 / 🔀 造句拼图
            </div>
            <div className="text-[11px] text-violet-300/80 mt-1">
              30 句 G4 短句库 · 难度可选
            </div>
          </div>
          <div className="text-violet-300 text-2xl">→</div>
        </div>
      </Link>

      {/* tier 分布 */}
      {dist && (
        <div className="card">
          <div className="text-xs text-slate-400 mb-2">
            本赛季掌握分布（{currentTerm} {pool.length} 词）
          </div>
          <MasteryTierBar dist={dist} />
        </div>
      )}
    </div>
  );
}

function buildRings(
  daily: DailyState | null,
  stats: ReturnType<typeof calcOldStyleStats> | null,
): RingSpec[] {
  const cyanA = "#22d3ee";
  const cyanB = "#0891b2";
  const violetA = "#a78bfa";
  const violetB = "#7c3aed";
  const amberA = "#fcd34d";
  const amberB = "#d97706";

  // v0.31.48: 数据加载完之前，所有环 progress=0 / done=false。
  // 这样数据到位后会触发 stroke-dashoffset transition (跟数学一样有"填充"动画)，
  // 真闭合时 sparkle 也能正常 trigger（之前因为初始 done=true 没有 transition）
  const loaded = daily !== null && stats !== null;
  const targetCount = daily?.target ?? 20;
  const todayCount = daily?.todayCount ?? 0;
  const challengeProg = !loaded ? 0 : Math.min(1, todayCount / Math.max(1, targetCount));
  const challengeDone = loaded && todayCount >= targetCount;

  const weak = stats?.weak ?? 0;
  const weakDone = loaded && weak === 0;

  return [
    {
      id: "challenge",
      icon: "🌍",
      shortLabel: "词汇大冒险",
      progress: challengeProg,
      statusText: challengeDone
        ? "今日完成 ✓"
        : `${todayCount} / ${targetCount} 词次`,
      to: "/english/vocab",
      hue: cyanA,
      hue2: cyanB,
      done: challengeDone,
    },
    {
      id: "sprint",
      icon: "⚡",
      shortLabel: "闪电冲刺",
      progress: !loaded ? 0 : 0.05,
      statusText: "60 秒看词选中文",
      to: "/english/vocab?mode=sprint",
      hue: violetA,
      hue2: violetB,
      done: false,
    },
    {
      id: "review",
      icon: "🪄",
      shortLabel: "复习薄弱",
      progress: !loaded ? 0 : weakDone ? 1 : Math.max(0.1, 1 - Math.min(weak / 20, 0.9)),
      statusText: !loaded ? "—" : weakDone ? "无薄弱词 ✓" : `${weak} 个薄弱词`,
      to: "/english/vocab",
      hue: amberA,
      hue2: amberB,
      done: weakDone,
    },
  ];
}
