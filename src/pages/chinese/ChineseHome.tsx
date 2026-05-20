/**
 * 语文首页 — Phase 2.x 升级版。
 *
 * 板块：
 *  1. 顶部"期中冲刺"banner + 倒计时 + 开始今日挑战
 *  2. 等级 / 称号 / XP 进度条（chineseLevelInfo: 童生→学子→秀才→...→状元）
 *  3. 单元卡（4 个）
 *  4. 错题复活入口（按 chinese 维度，最近 wrong 且没回答对的题）
 *  5. 勋章墙（已解锁 vs 未解锁灰章）
 *  6. 底部题库统计
 */

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db/dexie";
import { useSubject } from "../../subjects/context";
import { MIDTERM, daysUntil } from "../../core/examDates";
import {
  chineseLevelInfo,
  countChineseUnresolvedMistakes,
  getChineseMockExamCooldown,
  getChineseTotalXp,
  getChineseTrophies,
  getChineseSkillMastery,
} from "../../subjects/chinese/service";
import { CHINESE_TROPHIES, type ChineseTrophyDef } from "../../subjects/chinese/trophies";
import { TrophyIcon } from "../../components/TrophyIcon";
import type { MasteryScore, Term } from "../../core/types";
import { TermSwitcher, termToSemester, ensureDefaultTerm } from "../../components/TermSwitcher";
import { SubjectTodayRings, type RingSpec } from "../../components/SubjectTodayRings";
import { loadDaily, type DailyState } from "../../lib/dailyTarget";
import { loadCharProgress, calcOldStyleStats as charCalcOldStyleStats } from "../../lib/chineseCharProgress";
import { G4A_CHARS, G4B_CHARS } from "../../subjects/chinese/charLibrary";

export function ChineseHomePage() {
  const subject = useSubject();
  const totalQuestions = subject.seedQuestions.length;
  const totalSkills = subject.skills.length;
  const days = daysUntil(MIDTERM.date);

  const student = useLiveQuery(async () => (await db.students.toArray())[0]);
  const [totalXp, setTotalXp] = useState<number>(0);
  const [trophyState, setTrophyState] = useState<{
    defsById: Map<string, ChineseTrophyDef>;
    ownedCounts: Map<string, number>;
  } | null>(null);
  const [mastery, setMastery] = useState<MasteryScore[]>([]);
  const [openMistakes, setOpenMistakes] = useState<number>(0);
  const [mockCooldown, setMockCooldown] = useState<{
    available: boolean;
    daysUntilNext: number;
  }>({ available: true, daysUntilNext: 0 });
  const [currentTerm, setCurrentTerm] = useState<Term>("下册");
  const [charDaily, setCharDaily] = useState<DailyState | null>(null);
  const [charWrongCount, setCharWrongCount] = useState(0);

  useEffect(() => {
    if (!student?.id) return;
    let cancelled = false;
    (async () => {
      await ensureDefaultTerm();
      setCurrentTerm((student.currentTerm as Term) ?? "下册");
      const [xp, trophies, m, mistakeCount, mock, charProg, charDailyState] = await Promise.all([
        getChineseTotalXp(student.id),
        getChineseTrophies(student.id),
        getChineseSkillMastery(student.id),
        countChineseUnresolvedMistakes(student.id),
        getChineseMockExamCooldown(student.id),
        loadCharProgress(student.id),
        loadDaily("chinese_chars", student.id, 20),
      ]);
      if (cancelled) return;
      setTotalXp(xp);
      setTrophyState({ defsById: trophies.defsById, ownedCounts: trophies.ownedCounts });
      setMastery(m);
      setOpenMistakes(mistakeCount);
      setMockCooldown({ available: mock.available, daysUntilNext: mock.daysUntilNext });
      setCharDaily(charDailyState);
      setCharWrongCount(charCalcOldStyleStats(charProg).wrongChars.length);
    })();
    return () => {
      cancelled = true;
    };
  }, [student?.id, student?.currentTerm]);

  const level = chineseLevelInfo(totalXp);
  const ownedCount = trophyState
    ? Array.from(trophyState.ownedCounts.values()).reduce((s, n) => s + n, 0)
    : 0;
  const masteryAvg =
    mastery.length === 0
      ? 0
      : Math.round(mastery.reduce((s, m) => s + m.score, 0) / mastery.length);
  const xpProgress = Math.min(100, Math.round((level.xpThisLevel / level.xpNextLevel) * 100));

  return (
    <div className="space-y-5">
      {/* 期中冲刺 banner — v0.36.6 framer-motion 入场 + PLAY pulse */}
      <motion.div
        className="card-glow bg-gradient-to-br from-amber-500/20 to-rose-500/20 border border-amber-400/30"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 120, damping: 14 }}
      >
        <div className="flex items-center gap-3">
          <motion.div
            className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-rose-400 text-white flex items-center justify-center font-display font-bold shadow-glow"
            animate={{ rotate: [0, -3, 3, -3, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            语
          </motion.div>
          <div className="flex-1">
            <div className="font-display font-bold text-xl">期中冲刺</div>
            <div className="text-xs text-slate-300 mt-0.5">
              人教版四下 1-4 单元 · 字音字形 / 古诗 / 词语 / 修辞 / 听写
            </div>
          </div>
          {days >= 0 && (
            <motion.div
              className="text-right"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            >
              <div className="text-xs text-slate-400">距期中</div>
              <div className="text-2xl font-display font-bold text-rose-300">
                {days} <span className="text-sm">天</span>
              </div>
            </motion.div>
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <motion.div
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.96 }}
          >
            <Link
              to={`/chinese/train?fresh=${Date.now()}`}
              className="btn-primary text-base px-5 py-2.5 inline-block"
            >
              <motion.span
                animate={{ x: [0, 3, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                className="inline-block"
              >
                ▶
              </motion.span>{" "}
              开始今日挑战
            </Link>
          </motion.div>
        </div>
      </motion.div>

      {/* 等级 / XP / 整体掌握度 / 错题数 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="card text-center">
          <div className="text-[11px] text-slate-400">称号</div>
          <div className="font-display font-bold text-xl text-amber-300 mt-1">{level.title}</div>
          <div className="text-[10px] text-slate-500 mt-1">Lv {level.level}</div>
        </div>
        <div className="card text-center">
          <div className="text-[11px] text-slate-400">总 XP</div>
          <div className="font-display font-bold text-xl text-violet-300 mt-1">{totalXp}</div>
          <div className="mt-1 h-1 bg-ink-700/60 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-400 to-pink-400"
              style={{ width: `${xpProgress}%` }}
            />
          </div>
        </div>
        <div className="card text-center">
          <div className="text-[11px] text-slate-400">平均掌握度</div>
          <div
            className={`font-display font-bold text-xl mt-1 ${
              masteryAvg >= 80 ? "text-emerald-300" : masteryAvg >= 60 ? "text-amber-300" : "text-rose-300"
            }`}
          >
            {mastery.length > 0 ? masteryAvg : "—"}
          </div>
          <div className="text-[10px] text-slate-500 mt-1">{mastery.length} 个技能</div>
        </div>
        <div className="card text-center">
          <div className="text-[11px] text-slate-400">勋章</div>
          <div className="font-display font-bold text-xl text-rose-300 mt-1">{ownedCount}</div>
          <div className="text-[10px] text-slate-500 mt-1">
            / {CHINESE_TROPHIES.length} 类型
          </div>
        </div>
      </div>

      {/* v0.31.42：学期切换（赛季制 — 写 student.currentTerm，与数学一致） */}
      <TermSwitcher currentTerm={currentTerm} onChange={(t) => setCurrentTerm(t)} />

      {/* v0.31.42：今日 3 环（字词大冒险 / 错题复活 / 模拟测试） */}
      <SubjectTodayRings
        rings={buildChineseRings({
          charDaily,
          openMistakes,
          mockAvailable: mockCooldown.available,
          mockDaysUntilNext: mockCooldown.daysUntilNext,
          // v0.31.48: 加载完才传 true，让初次环 progress 从 0 填到实际值
          loaded: charDaily !== null,
        })}
      />

      {/* v0.31.42：字词大冒险（手写 + 辨字 + 打字 三模式） */}
      <Link
        to="/chinese/char-practice"
        className="card-glow bg-gradient-to-br from-amber-500/15 to-orange-500/10 border-amber-400/40 hover:scale-[1.01] transition-transform block"
      >
        <div className="flex items-center gap-3">
          <div className="text-3xl">🗡️</div>
          <div className="flex-1">
            <div className="font-display font-bold text-amber-100">
              字词大冒险 · 当前赛季 {currentTerm}
            </div>
            <div className="text-xs text-slate-300 mt-0.5">
              ✍️ 手写挑战 (Canvas + AI 视觉判) · 🎯 辨字选择 · ⌨️ 打字回忆
            </div>
            <div className="text-[11px] text-amber-300/80 mt-1">
              5-tier 等级 · 间隔重现 · 错字本 · 今日目标 · 连击 XP
            </div>
          </div>
          <div className="text-amber-300 text-2xl">→</div>
        </div>
      </Link>

      {/* 错题复活 + 模拟测试（与数学功能对齐） */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 错题复活 */}
        {openMistakes > 0 ? (
          <Link
            to={`/chinese/train?mode=review&fresh=${Date.now()}`}
            className="card-glow bg-rose-500/10 border-rose-400/30 hover:scale-[1.01] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="text-3xl">🪄</div>
              <div className="flex-1">
                <div className="font-display font-bold text-rose-100">错题复活</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  {openMistakes} 道错题等你来攻克 · 答对 3 次彻底掌握
                </div>
              </div>
              <div className="text-rose-300 text-2xl">→</div>
            </div>
          </Link>
        ) : (
          <div className="card text-center text-slate-400">
            <div className="text-2xl mb-1">✨</div>
            <div className="text-sm">暂无未消化错题</div>
            <div className="text-[11px] text-slate-500 mt-1">答错的题会自动出现在这里</div>
          </div>
        )}

        {/* 模拟测试（mock exam） */}
        {mockCooldown.available ? (
          <Link
            to={`/chinese/train?mode=mock_exam&fresh=${Date.now()}`}
            className="card-glow bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 border-violet-400/40 hover:scale-[1.01] transition-transform"
          >
            <div className="flex items-center gap-3">
              <div className="text-3xl">📝</div>
              <div className="flex-1">
                <div className="font-display font-bold text-violet-100">期中模拟测试</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  跨 4 单元 20 题 · 难度梯度 D1-D4 · 一周一次
                </div>
              </div>
              <div className="text-violet-300 text-2xl">→</div>
            </div>
          </Link>
        ) : (
          <div className="card text-slate-400 opacity-60">
            <div className="flex items-center gap-3">
              <div className="text-2xl grayscale">📝</div>
              <div className="flex-1">
                <div className="font-semibold">期中模拟测试</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  下次开放还要 {mockCooldown.daysUntilNext} 天（每周一次）
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* v0.36.2 (爸爸 2026-05-19): 新玩法入口 — 4 cluster minigame prototype
          (Sprint C1-C4). Selena 之前找不到, 这里加入口 */}
      {/* v0.36.6 (爸爸 2026-05-19): framer-motion 入场 stagger + hover spring,
          降低 SaaS 感, Selena 反馈 "动态多看着有意思了" */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.08 } },
        }}
      >
        <div className="text-sm text-slate-400 mb-2">🎮 新玩法 (体验)</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { to: "/chinese/poem-lantern-preview", emoji: "🏮", title: "古诗拍灯笼", desc: "元宵补字", bg: "from-red-500/15 to-amber-500/15", border: "border-red-400/40" },
            { to: "/chinese/glyph-detective-preview", emoji: "🔍", title: "字形侦探", desc: "偏旁部首", bg: "from-amber-700/15 to-orange-600/15", border: "border-amber-400/40" },
            { to: "/chinese/sentence-dragon-preview", emoji: "🐉", title: "病句龙训", desc: "句子重组", bg: "from-emerald-600/15 to-amber-500/15", border: "border-emerald-400/40" },
            { to: "/chinese/rhetoric-scroll-preview", emoji: "📜", title: "修辞画卷", desc: "比喻拟人", bg: "from-stone-600/15 to-rose-700/15", border: "border-amber-600/40" },
            { to: "/chinese/reading-library-preview", emoji: "📖", title: "阅读图书馆", desc: "短文+多问", bg: "from-red-900/20 to-amber-700/15", border: "border-amber-500/40" },
            { to: "/chinese/imitate-painter-preview", emoji: "🎨", title: "仿写画师", desc: "临摹+AI点评", bg: "from-indigo-600/15 to-amber-600/15", border: "border-indigo-400/40" },
          ].map((c) => (
            <motion.div
              key={c.to}
              variants={{
                hidden: { opacity: 0, y: 24, scale: 0.85 },
                show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 20 } },
              }}
              whileHover={{ y: -4, scale: 1.05, transition: { type: "spring", stiffness: 400, damping: 12 } }}
              whileTap={{ scale: 0.96 }}
            >
              <Link
                to={c.to}
                className={`card-glow bg-gradient-to-br ${c.bg} ${c.border} block`}
              >
                <motion.div
                  className="text-3xl mb-1"
                  whileHover={{ rotate: [0, -8, 8, -4, 0], transition: { duration: 0.5 } }}
                >
                  {c.emoji}
                </motion.div>
                <div className="font-display font-bold text-amber-100 text-sm">{c.title}</div>
                <div className="text-[10px] text-amber-200/70 mt-0.5 leading-tight">{c.desc}</div>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* 单元卡 */}
      <div>
        <div className="text-sm text-slate-400 mb-2">按单元练习</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {subject.units.map((u) => {
            const unitQ = subject.seedQuestions.filter((q) => q.unit_id === u.id).length;
            const unitSk = subject.skills.filter((s) => s.unitId === u.id).length;
            // 该单元 mastery 平均
            const unitMastery = mastery.filter((m) => {
              const skill = subject.skills.find((s) => s.id === m.skillId);
              return skill?.unitId === u.id;
            });
            const unitAvg =
              unitMastery.length > 0
                ? Math.round(unitMastery.reduce((s, x) => s + x.score, 0) / unitMastery.length)
                : null;
            return (
              <Link
                key={u.id}
                to={`/chinese/free-practice?unitId=${encodeURIComponent(u.id)}&fresh=${Date.now()}`}
                className="card hover:bg-ink-700/60 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <div className="text-amber-300 text-lg leading-none mt-0.5">📖</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold flex items-center justify-between gap-2">
                      <span className="truncate">{u.name}</span>
                      {unitAvg !== null && (
                        <span
                          className={`text-[10px] chip border ${
                            unitAvg >= 80
                              ? "bg-emerald-500/20 text-emerald-200 border-emerald-400/40"
                              : unitAvg >= 60
                                ? "bg-amber-500/20 text-amber-200 border-amber-400/40"
                                : "bg-rose-500/20 text-rose-200 border-rose-400/40"
                          }`}
                        >
                          {unitAvg}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                      {u.description}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-2">
                      {unitSk} 个技能 · {unitQ} 道题
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 勋章墙 */}
      <div>
        <div className="text-sm text-slate-400 mb-2 flex items-center justify-between">
          <span>勋章墙</span>
          <span className="text-[11px] text-slate-500">
            {ownedCount > 0 ? `已解锁 ${ownedCount} 枚` : "还没有勋章，做题就能拿"}
          </span>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {CHINESE_TROPHIES.map((def) => {
            const owned = trophyState?.ownedCounts.get(def.id) ?? 0;
            const isOwned = owned > 0;
            return (
              <div
                key={def.id}
                className={`relative aspect-square rounded-xl border flex flex-col items-center justify-center text-center p-1 ${
                  isOwned
                    ? "bg-gradient-to-br from-amber-500/20 to-rose-500/20 border-amber-400/40"
                    : "bg-ink-800/40 border-ink-700/60 opacity-50"
                }`}
                title={`${def.name}：${def.description}`}
              >
                <TrophyIcon
                  trophyId={def.id}
                  subjectId="chinese"
                  emoji={def.icon}
                  size="md"
                  unlocked={isOwned}
                />

                <div className="text-[9px] font-semibold mt-0.5 leading-tight">
                  {def.name}
                </div>
                {owned > 1 && (
                  <div className="absolute top-0.5 right-0.5 text-[9px] bg-rose-500/40 text-rose-50 rounded-full px-1 leading-none py-0.5">
                    ×{owned}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 听写说明 */}
      <div className="card text-sm text-slate-300">
        <div className="font-semibold mb-1">🎧 听写题怎么做</div>
        <div className="text-xs text-slate-400 leading-relaxed">
          看到 ▶ 按钮，先点一下听一遍小进读的词，再从下面四个写法里选正确的。
          可以多次播放，但要靠耳朵分辨。
        </div>
      </div>

      <div className="text-center text-[11px] text-slate-500 mt-2 space-y-1">
        <div>题库：{totalQuestions} 道题 · {totalSkills} 个技能 · 4 个单元（人教版四下）</div>
        <div>期中后会扩到 200+ 题 + 课内阅读 + 错题复活专项</div>
      </div>
    </div>
  );
}

function buildChineseRings(args: {
  charDaily: DailyState | null;
  openMistakes: number;
  mockAvailable: boolean;
  mockDaysUntilNext: number;
  loaded: boolean;
}): RingSpec[] {
  const amberA = "#fcd34d";
  const amberB = "#d97706";
  const violetA = "#a78bfa";
  const violetB = "#7c3aed";
  const cyanA = "#22d3ee";
  const cyanB = "#0891b2";

  // v0.31.48: 数据加载完之前所有环 progress=0/done=false，加载完才填充。
  // 让 stroke-dashoffset transition 跟数学一样顺畅播出"填充"动画，且 sparkle 能正常 trigger。
  const targetCount = args.charDaily?.target ?? 20;
  const todayCount = args.charDaily?.todayCount ?? 0;
  const charProg = !args.loaded ? 0 : Math.min(1, todayCount / Math.max(1, targetCount));
  const charDone = args.loaded && todayCount >= targetCount;

  const mistakeProg = !args.loaded
    ? 0
    : args.openMistakes === 0
      ? 1
      : Math.max(0.1, 1 - Math.min(args.openMistakes / 20, 0.9));
  const mistakeDone = args.loaded && args.openMistakes === 0;

  return [
    {
      id: "char_quest",
      icon: "🗡️",
      shortLabel: "字词大冒险",
      progress: charProg,
      statusText: charDone ? `今日完成 ✓` : `${todayCount} / ${targetCount} 字次`,
      to: "/chinese/char-practice",
      hue: amberA,
      hue2: amberB,
      done: charDone,
    },
    {
      id: "mistakes",
      icon: "🪄",
      shortLabel: "错题复活",
      progress: mistakeProg,
      statusText: mistakeDone ? "无未消化错题" : `${args.openMistakes} 道待练`,
      to: "/chinese/train?mode=review",
      hue: violetA,
      hue2: violetB,
      done: mistakeDone,
    },
    {
      id: "mock",
      icon: "📝",
      shortLabel: "模拟测试",
      progress: !args.loaded ? 0 : args.mockAvailable ? 0.05 : 1,
      statusText: !args.loaded
        ? "—"
        : args.mockAvailable
          ? "本周已开放 · 跨单元 20 题"
          : `${args.mockDaysUntilNext} 天后再开`,
      to: args.mockAvailable ? "/chinese/train?mode=mock_exam" : "/chinese",
      hue: cyanA,
      hue2: cyanB,
      done: args.loaded && !args.mockAvailable,
    },
  ];
}
