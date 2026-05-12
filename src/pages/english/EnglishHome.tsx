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
  calcTierDistribution,
  loadVocabProgress,
  type VocabProgress,
} from "../../lib/englishVocabProgress";
import { MasteryTierBar } from "../../components/MasteryTierBar";
import { SubjectTodayRings, type RingSpec } from "../../components/SubjectTodayRings";
import { TermSwitcher, termToSemester, ensureDefaultTerm } from "../../components/TermSwitcher";
import { loadDaily, setDailyTarget, type DailyState } from "../../lib/dailyTarget";
import type { Term } from "../../core/types";

export function EnglishHomePage() {
  const [progress, setProgress] = useState<VocabProgress | null>(null);
  // v0.31.107：3 环对应 3 个 daily state（科学外语学习：input + output + 综合）
  const [vocabDaily, setVocabDaily] = useState<DailyState | null>(null);
  const [speakDaily, setSpeakDaily] = useState<DailyState | null>(null);
  const [sentenceDaily, setSentenceDaily] = useState<DailyState | null>(null);
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
      const [vd, spd, snd] = await Promise.all([
        loadDaily("english_vocab", s.id, 15),
        loadDaily("english_speak", s.id, 5),
        loadDaily("english_sentences", s.id, 3),
      ]);
      // v0.31.108：3 环目标按记忆曲线估算 — G4B 下册 112 词，6-7 周到期末（~49 天）：
      //   vocab 15/天 × 49 = 735 词次 ÷ 112 词 = **每词 ~6.5 次见面**（间隔重现达 85-90% 掌握）
      //   speak 5/天 = 4-5 句正好对应 Krashen 输出阈值（不会累）
      //   sentence 3/天 × 49 = 147 次 ÷ 30 短句库 = 每句 ~5 次，整合输出足够
      const TARGETS = { vocab: 15, speak: 5, sentence: 3 };
      const aligned = await Promise.all([
        vd.target === TARGETS.vocab
          ? vd
          : (await setDailyTarget("english_vocab", s.id, TARGETS.vocab),
            await loadDaily("english_vocab", s.id, TARGETS.vocab)),
        spd.target === TARGETS.speak
          ? spd
          : (await setDailyTarget("english_speak", s.id, TARGETS.speak),
            await loadDaily("english_speak", s.id, TARGETS.speak)),
        snd.target === TARGETS.sentence
          ? snd
          : (await setDailyTarget("english_sentences", s.id, TARGETS.sentence),
            await loadDaily("english_sentences", s.id, TARGETS.sentence)),
      ]);
      if (cancelled) return;
      setProgress(p);
      setVocabDaily(aligned[0]);
      setSpeakDaily(aligned[1]);
      setSentenceDaily(aligned[2]);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const semester = termToSemester(currentTerm);
  const pool =
    semester === null
      ? G4_WORDS
      : G4_WORDS.filter((w) => w.semester === semester);
  const dist = progress ? calcTierDistribution(pool, progress) : null;

  const rings: RingSpec[] = buildRings({
    vocab: vocabDaily,
    speak: speakDaily,
    sentence: sentenceDaily,
  });

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

/**
 * v0.31.107：英语 3 环重设计（科学外语学习 + 游戏性）。
 *
 * 维度依据：
 *  - Input（识别）：vocab 词汇识别 — 看词/听辨 → 10 词次
 *  - Output（产出）：speak 朗读 — Qwen Omni 判 ≥70 分 → 3 次
 *  - Integration（综合）：sentence 短句朗读 / 造句 → 3 次
 *
 * 设计灵感：Duolingo daily streak + Anki 间隔重现 + Krashen 输入输出假说。
 * 3 环全闭 = 一天的语言学习完整闭环（看 + 说 + 用）。
 */
function buildRings(
  d: {
    vocab: DailyState | null;
    speak: DailyState | null;
    sentence: DailyState | null;
  },
): RingSpec[] {
  const cyanA = "#22d3ee";
  const cyanB = "#0891b2";
  const violetA = "#a78bfa";
  const violetB = "#7c3aed";
  const amberA = "#fcd34d";
  const amberB = "#d97706";

  const loaded = d.vocab !== null && d.speak !== null && d.sentence !== null;

  const ring = (
    daily: DailyState | null,
    id: string,
    icon: string,
    label: string,
    to: string,
    unit: string,
    hue: string,
    hue2: string,
  ): RingSpec => {
    const tgt = daily?.target ?? 1;
    const cnt = daily?.todayCount ?? 0;
    const prog = !loaded ? 0 : Math.min(1, cnt / Math.max(1, tgt));
    const done = loaded && cnt >= tgt;
    return {
      id,
      icon,
      shortLabel: label,
      progress: prog,
      statusText: !loaded
        ? "—"
        : done
          ? `今日完成 ${cnt} ${unit} ✓`
          : `${cnt} / ${tgt} ${unit}`,
      to,
      hue,
      hue2,
      done,
    };
  };

  return [
    ring(d.vocab, "vocab", "🌍", "词汇识别", "/english/vocab", "词次", cyanA, cyanB),
    ring(d.speak, "speak", "📣", "朗读 AI 判", "/english/vocab", "次", violetA, violetB),
    ring(d.sentence, "sentence", "🔀", "短句应用", "/english/sentence", "次", amberA, amberB),
  ];
}
