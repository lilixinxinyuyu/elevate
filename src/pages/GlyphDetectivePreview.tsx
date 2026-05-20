/**
 * v0.35.94 — Sprint C2: 🔍 字形侦探 (Glyph Detective) Chinese cluster prototype.
 *
 * Chinese Cluster 2/7. 覆盖 偏旁部首 / 形声字辨识 题型.
 *
 * 核心洞察: G4B 期中考第 9 题型 "形声字 + 偏旁部首" 是大考点 (饮食类 偏旁规律).
 * 把 "找部首" → "侦探破案, 找证据 (偏旁) 推断字义". 民国侦探 + 放大镜 metaphor.
 *
 * 设计 DNA (民国侦探事务所主题, 跟 math Detective 暗紫 + chinese C1 元宵红 都区别):
 * - 深棕咖啡色 + 暗黄 + 暖灯光 (老书桌 / 民国怀旧)
 * - 老式书桌 + 油灯 + 放大镜 + 卷轴案卷
 * - Mascot 🐼 戴 🎩 礼帽 (左下, 侦探装)
 * - 助手 = 🕵️ Sherlock 侦探 (右上, 用 emoji)
 * - 中央: 大汉字 SVG + 圈出 "需鉴定" 区域 + 放大镜叠加
 * - 4 选项: 候选偏旁 (字旁 / 字头 / 字底)
 * - 答对 → 放大镜 zoom + 字爆光 + Sherlock bow + "破案!"
 * - 答错 → 案卷 shake + 鼓励 "再仔细看, 偏旁有规律"
 *
 * 3 mock cases (覆盖 G4B 期中考典型偏旁题):
 * - 案一: "蜻蜓" 都是 虫字旁 (G4B U1)
 * - 案二: "桦" 木字旁 (G4B U3 白桦)
 * - 案三: "猫" 反犬旁 (G4B U4)
 *
 * 入口: `/chinese/glyph-detective-preview`
 */
import { useState, useEffect, useMemo } from "react";
import { awardClusterXp } from "../lib/clusterXp";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { Question } from "../core/types";
import { db } from "../db/dexie";
import { SEED_QUESTIONS_CHINESE_GLYPH } from "../subjects/chinese/glyphPack";

type DetectiveCase = {
  id: string;
  scrollLabel: string;
  hanzi: string; // 待鉴定汉字 (主显 char)
  hanziDesc: string; // 字的描述 / 来源
  question: string;
  options: { text: string; emoji?: string }[];
  correctIdx: number;
  solution: string;
};

// v0.36.7 (Selena 反馈 "字形侦探太简单, 不适合 G4"):
// - 原 3 题改难: 干扰项更接近 (不能一眼排除)
// - 新增 4 难题: 形声字 + 会意字 + 易混偏旁
// - 难度梯度: 简 → 中 → 难 → 烧脑
const DEMO_CASES: DetectiveCase[] = [
  {
    id: "g1",
    scrollLabel: "案一 · 蜻蜓之谜",
    hanzi: "蜻",
    hanziDesc: "形声字: 形旁表义 + 声旁表音. 出自《宿新市徐公店》",
    question: "下面哪个不是 \"蜻\" 字的特点?",
    options: [
      { text: "虫字旁表义 (跟虫有关)", emoji: "🐛" },
      { text: "\"青\" 是声旁 (qīng)", emoji: "🔊" },
      { text: "\"青\" 是形旁 (跟青色有关)", emoji: "❌" },
      { text: "形声字结构 左形右声", emoji: "✏️" },
    ],
    correctIdx: 2,
    solution: "\"蜻\" 的 \"青\" 只是声旁 (表音), 不是形旁 (跟颜色无关). 蜻蜓不一定青色, 但都是昆虫.",
  },
  {
    id: "g2",
    scrollLabel: "案二 · 桦树家族",
    hanzi: "桦",
    hanziDesc: "形声字: 木字旁 + 华. 出自《白桦》",
    question: "下面哪一组字都是 \"木字旁\" 表义?",
    options: [
      { text: "桦 / 林 / 森 (都跟树有关)", emoji: "🌳" },
      { text: "桦 / 华 / 哗 (都同声旁)", emoji: "📣" },
      { text: "桦 / 木 / 本 (字根都是木)", emoji: "🪵" },
      { text: "桦 / 树 / 枝 (都用木旁)", emoji: "🌲" },
    ],
    correctIdx: 3,
    solution: "桦/树/枝 左边都是 木字旁 (形旁), 表示与木 / 树有关. \"林/森\" 是会意字 (木×2/×3), 不算形声字偏旁. \"华/哗\" 是声旁同源, 不跟树有关.",
  },
  {
    id: "g3",
    scrollLabel: "案三 · 猫的秘密",
    hanzi: "猫",
    hanziDesc: "形声字: 反犬旁 + 苗. 跟反犬旁的字都是动物吗?",
    question: "下面哪个 \"猫\" 字的偏旁辨认对?",
    options: [
      { text: "草字头 + 苗 (\"猫\" 跟草有关)", emoji: "🌿" },
      { text: "反犬旁 (犭) + 苗 (跟动物有关)", emoji: "🐕" },
      { text: "苗字旁 (跟植物有关)", emoji: "🌱" },
      { text: "苗 是部首 (字典查 苗)", emoji: "🪴" },
    ],
    correctIdx: 1,
    solution: "\"猫\" 部首是 反犬旁 (犭), 表义 (动物). \"苗\" 是声旁 (miáo). 跟苗类似偏旁: 狗/狼/狐 都是反犬旁.",
  },
  {
    id: "g4",
    scrollLabel: "案四 · 饭桌之谜",
    hanzi: "饭",
    hanziDesc: "形声字: 饣字旁 + 反. 易跟 \"反\" 字混",
    question: "\"饭 / 饺 / 饼 / 饿\" 四字共同的偏旁是?",
    options: [
      { text: "反字旁 (跟反字相关)", emoji: "❌" },
      { text: "饣 (食字旁, 跟饮食有关)", emoji: "🍚" },
      { text: "钅 (金字旁)", emoji: "🥢" },
      { text: "亻 (单立人旁)", emoji: "👤" },
    ],
    correctIdx: 1,
    solution: "饣 = 食字旁 (简化, 跟饮食). 所有 \"饭/饺/饼/饿\" 都形声字: 饣表义 (食物) + 右半声旁. 期中考第 9 题型核心.",
  },
  {
    id: "g5",
    scrollLabel: "案五 · 明月之会",
    hanzi: "明",
    hanziDesc: "会意字: 由两个独立字 组合表义",
    question: "\"明\" 字是由什么组成的?",
    options: [
      { text: "日 + 月 (太阳和月亮都明亮)", emoji: "🌞" },
      { text: "日 + 力 (太阳的力量)", emoji: "❌" },
      { text: "月 + 月 (两个月亮)", emoji: "🌙" },
      { text: "白 + 月 (月亮发白)", emoji: "⚪" },
    ],
    correctIdx: 0,
    solution: "\"明\" = 日 + 月. 古人把发光的太阳 + 月亮 合在一起表示 \"光亮\". 这是会意字 (跟形声字不同).",
  },
  {
    id: "g6",
    scrollLabel: "案六 · 森林奥秘",
    hanzi: "森",
    hanziDesc: "会意字: 数量决定意义",
    question: "\"木 / 林 / 森\" 三字分别代表?",
    options: [
      { text: "一棵 / 一片 / 很多 (数量递增表 树多)", emoji: "🌲" },
      { text: "树根 / 树枝 / 树叶", emoji: "🍃" },
      { text: "都是形声字, 声旁是木", emoji: "🔊" },
      { text: "都是部首字, 不能拆", emoji: "🪵" },
    ],
    correctIdx: 0,
    solution: "木 (1 棵) → 林 (2 棵, 树丛) → 森 (3 棵, 茂密森林). 这是会意字的数量叠加表义.",
  },
  {
    id: "g7",
    scrollLabel: "案七 · 烧脑·偏旁陷阱",
    hanzi: "蓝",
    hanziDesc: "形近字陷阱: 草字头 vs 竹字头",
    question: "下面对 \"蓝 / 篮\" 的辨认哪个对?",
    options: [
      { text: "都用草字头 (跟植物有关)", emoji: "🌿" },
      { text: "\"蓝\" 草字头 (蓝色花) / \"篮\" 竹字头 (装球的竹篓)", emoji: "🎋" },
      { text: "都用竹字头 (古代竹简文化)", emoji: "🎍" },
      { text: "\"蓝\" 竹字头 / \"篮\" 草字头", emoji: "❌" },
    ],
    correctIdx: 1,
    solution: "\"蓝\" (草字头 艹) 是颜色, 古染料从蓝草提取. \"篮\" (竹字头 ⺮) 是用竹编的装东西的容器, 后来引申 \"篮球\". 期中常错!",
  },
];

const ENCOURAGE_PHRASES = [
  "再仔细看, 偏旁有规律",
  "放大镜下慢慢找",
  "Sherlock 提示: 看左半还是右半?",
  "形声字的形旁告诉你字义",
];

// ── 真题库接入: glyphPack 的 glyph_detective 题 (偏旁/形声/会意) ──
// game_data 带 hanzi/hanziDesc/optionEmojis, 选项/答案/解析走标准 Question 字段.
function adaptGlyph(q: Question): DetectiveCase | null {
  const gd = q.game_data;
  if (!gd || gd.kind !== "glyph_detective") return null;
  const opts = q.options ?? [];
  if (opts.length < 2) return null;
  const correctVal = q.answer?.type === "choice" ? q.answer.value : undefined;
  const correctIdx = opts.findIndex((o) => o.id === correctVal);
  if (correctIdx < 0) return null;
  return {
    id: q.question_id,
    scrollLabel: gd.hanzi ? `真题 · ${gd.hanzi} 字之谜` : "真题卷",
    hanzi: gd.hanzi,
    hanziDesc: gd.hanziDesc,
    question: q.stem,
    options: opts.map((o, i) => ({ text: o.text, emoji: gd.optionEmojis?.[i] })),
    correctIdx,
    solution: (Array.isArray(q.solution_steps) && q.solution_steps.length > 0 ? q.solution_steps.join(" ") : q.feedback_correct) || "",
  };
}
const REAL_GLYPH_CASES: DetectiveCase[] = SEED_QUESTIONS_CHINESE_GLYPH
  .map(adaptGlyph)
  .filter((c): c is DetectiveCase => c !== null);
// 静态 pack 已有的 question_id，用于 db 去重（pack 也可能被 seed 进 db）
const STATIC_GLYPH_IDS = new Set(REAL_GLYPH_CASES.map((c) => c.id));

export function GlyphDetectivePreviewPage() {
  const [caseIdx, setCaseIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [encouragePhrase, setEncouragePhrase] = useState<string | null>(null);
  // AI 补题: 从 db.questions 拉 chinese glyph_detective 题, 过掉静态已有的, adapt 后 merge
  const [dbCases, setDbCases] = useState<DetectiveCase[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const dbQs = (await db.questions.where("subjectId").equals("chinese").toArray()) as unknown as Question[];
        const adapted = dbQs
          .filter((q) => q.game_type === "glyph_detective" && !STATIC_GLYPH_IDS.has(q.question_id))
          .map(adaptGlyph)
          .filter((c): c is DetectiveCase => c !== null);
        if (!cancelled) setDbCases(adapted);
      } catch (e) {
        console.error("[GlyphDetective] 加载 db 题失败", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 静态真题 + db AI 题合并去重; 不足 4 道回退 DEMO
  const CASES = useMemo<DetectiveCase[]>(() => {
    const seen = new Set<string>();
    const merged: DetectiveCase[] = [];
    for (const c of [...REAL_GLYPH_CASES, ...dbCases]) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      merged.push(c);
    }
    return merged.length >= 4 ? merged : DEMO_CASES;
  }, [dbCases]);

  const cur = CASES[caseIdx] ?? DEMO_CASES[0]!;

  useEffect(() => {
    if (result === "correct") {
      const t = setTimeout(() => {
        setCaseIdx((i) => (i + 1) % CASES.length);
        setSelectedIdx(null);
        setResult("idle");
        setEncouragePhrase(null);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [result]);

  function handleChoice(idx: number) {
    if (result === "correct") return;
    setSelectedIdx(idx);
    if (idx === cur.correctIdx) {
      setResult("correct"); void awardClusterXp(1);
      setEncouragePhrase(null);
    } else {
      setResult("wrong");
      setEncouragePhrase(ENCOURAGE_PHRASES[Math.floor(Math.random() * ENCOURAGE_PHRASES.length)] ?? null);
      setTimeout(() => setResult("idle"), 700);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden text-amber-50"
      style={{
        height: "100dvh",
        background: "radial-gradient(ellipse at top, #44291a 0%, #2c1810 50%, #110a04 100%)",
      }}
    >
      {/* 民国怀旧 ambience */}
      <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-amber-700/25 blur-[120px] pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-orange-800/20 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full bg-yellow-700/15 blur-[120px] pointer-events-none" />

      {/* 老式书桌 + 油灯 + 卷轴书背景 */}
      <svg className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice">
        {/* 木地板 */}
        {Array.from({ length: 14 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={550 + i * 18} x2="1000" y2={555 + i * 18} stroke="#92400e" strokeWidth="0.6" opacity="0.4" />
        ))}
        {/* 书架剪影 (左 + 右) */}
        <rect x="0" y="120" width="80" height="430" fill="#3f1f08" stroke="#92400e" strokeWidth="1" />
        <rect x="920" y="120" width="80" height="430" fill="#3f1f08" stroke="#92400e" strokeWidth="1" />
        {/* 书架的书 */}
        {[150, 200, 250, 320, 380, 440].map((y, i) => (
          <rect key={`l${i}`} x="10" y={y} width="60" height={26 + (i % 3) * 6} fill={["#a16207", "#b45309", "#854d0e", "#92400e", "#7c2d12", "#6b1d04"][i % 6]} stroke="#fcd34d" strokeWidth="0.5" opacity="0.85" />
        ))}
        {[150, 210, 270, 340, 400, 460].map((y, i) => (
          <rect key={`r${i}`} x="930" y={y} width="60" height={28 + (i % 3) * 5} fill={["#92400e", "#7c2d12", "#a16207", "#b45309", "#6b1d04", "#854d0e"][i % 6]} stroke="#fcd34d" strokeWidth="0.5" opacity="0.85" />
        ))}
        {/* 油灯 (中央偏左) */}
        <g transform="translate(150, 480)">
          {/* 灯座 */}
          <ellipse cx="0" cy="0" rx="22" ry="6" fill="#854d0e" />
          <rect x="-12" y="-25" width="24" height="25" rx="3" fill="#92400e" stroke="#fcd34d" strokeWidth="1" />
          {/* 玻璃灯罩 */}
          <path d="M -10 -25 L -8 -55 Q 0 -65 8 -55 L 10 -25 Z" fill="#fef3c7" opacity="0.4" stroke="#fcd34d" strokeWidth="1" />
          {/* 火焰 */}
          <path d="M 0 -55 Q -4 -65 0 -75 Q 4 -65 0 -55 Z" fill="#fcd34d" opacity="0.9" />
          <circle cx="0" cy="-65" r="3" fill="#fef3c7" opacity="0.8" />
          {/* 灯光晕 */}
          <circle cx="0" cy="-50" r="80" fill="#fcd34d" opacity="0.08" />
        </g>
        {/* 散落卷轴 (右) */}
        <g transform="translate(820, 510)">
          <ellipse cx="0" cy="0" rx="42" ry="8" fill="#a16207" />
          <rect x="-30" y="-12" width="60" height="12" rx="6" fill="#854d0e" />
          <line x1="-15" y1="-6" x2="15" y2="-6" stroke="#fef3c7" strokeWidth="0.5" />
        </g>
      </svg>

      {/* 角落侦探装饰 emoji */}
      <div className="absolute top-16 left-6 text-3xl opacity-50 select-none">🔍</div>
      <div className="absolute top-16 right-6 text-3xl opacity-50 select-none">📜</div>
      <div className="absolute bottom-44 left-6 text-3xl opacity-50 select-none">🕯️</div>
      <div className="absolute bottom-44 right-6 text-3xl opacity-50 select-none">📖</div>

      {/* ─── 顶部 HUD ─── */}
      <div className="absolute top-3 left-0 right-0 px-4 z-20 flex items-center justify-between">
        <Link to="/chinese" className="px-3 py-1.5 rounded-xl bg-amber-900/85 backdrop-blur-md border border-amber-400/40 text-xs font-bold text-amber-100">
          ← 离开事务所
        </Link>
        <div className="px-4 py-1.5 rounded-xl bg-amber-900/85 backdrop-blur-md border border-amber-400/40 text-center">
          <div className="text-[10px] text-amber-300 uppercase tracking-widest">🔍 字形侦探事务所</div>
          <div className="text-sm font-display font-bold text-amber-100">{cur.scrollLabel}</div>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-amber-900/85 backdrop-blur-md border border-amber-400/40 text-xs font-bold text-amber-100 tabular-nums">
          {caseIdx + 1} / {CASES.length}
        </div>
      </div>

      {/* ─── 中央: 大汉字 + 放大镜 ─── */}
      <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="relative">
          {/* 卷轴底 */}
          <div
            className={`relative px-12 py-10 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100 border-4 border-amber-700 shadow-2xl transition-all duration-300 ${result === "wrong" ? "animate-glyph-shake" : ""}`}
            style={{
              animation: result === "wrong" ? "glyph-shake 0.5s ease-in-out" : undefined,
              minWidth: "280px",
            }}
          >
            {/* 案件 caption */}
            <div className="text-[10px] text-amber-700 uppercase tracking-widest mb-2 text-center">待鉴定汉字</div>
            {/* 大汉字 — v0.36.7 framer-motion: 切换题时大汉字 spring entrance */}
            <AnimatePresence mode="wait">
              <motion.div
                key={cur.id}
                initial={{ scale: 0, rotate: -180, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: "spring", stiffness: 180, damping: 16 }}
                className="text-[150px] sm:text-[180px] font-display text-amber-900 text-center leading-none select-none"
                style={{ fontFamily: "'STKaiti', 'KaiTi', 'Songti SC', serif" }}
              >
                {cur.hanzi}
              </motion.div>
            </AnimatePresence>
            {/* 字描述 */}
            <motion.div
              key={cur.id + "-desc"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="text-xs text-amber-700/80 mt-2 text-center italic"
            >
              {cur.hanziDesc}
            </motion.div>

            {/* 放大镜 — 答对时 zoom */}
            {result === "correct" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ animation: "glyph-magnify 0.9s ease-out" }}>
                <div className="text-9xl">🔍</div>
              </div>
            )}

            {/* "破案!" stamp */}
            {result === "correct" && (
              <div className="absolute -top-4 -right-4 text-2xl font-display font-black text-red-600 rotate-12" style={{ animation: "glyph-stamp 0.6s ease-out" }}>
                ✦ 破案 ✦
              </div>
            )}
          </div>
          {/* 卷轴左右 roll */}
          <div className="absolute -left-3 top-2 bottom-2 w-3 rounded-l-full bg-gradient-to-b from-amber-900 via-amber-800 to-amber-900 shadow-lg" />
          <div className="absolute -right-3 top-2 bottom-2 w-3 rounded-r-full bg-gradient-to-b from-amber-900 via-amber-800 to-amber-900 shadow-lg" />
        </div>

        {/* 解析 (答对后显示) */}
        {result === "correct" && (
          <div className="mt-4 max-w-md mx-auto px-4 py-2 bg-emerald-900/80 backdrop-blur-md border border-emerald-300/40 rounded-xl text-emerald-100 text-xs text-center" style={{ animation: "glyph-pop 0.5s ease-out 0.3s both" }}>
            💡 {cur.solution}
          </div>
        )}
      </div>

      {/* ─── 左下 Mascot 戴 礼帽 ─── */}
      <div className="absolute left-4 bottom-44 sm:left-8 sm:bottom-48 flex flex-col items-center gap-1 pointer-events-none z-10">
        <div className="relative">
          <div
            className="text-[72px] sm:text-[88px] leading-none"
            style={{
              animation: result === "correct" ? "glyph-bow 0.8s ease-in-out" : "glyph-float 3s ease-in-out infinite",
            }}
          >🐼</div>
          {/* 礼帽 */}
          <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 text-3xl">🎩</div>
        </div>
        {encouragePhrase && (
          <div className="px-3 py-1.5 rounded-2xl bg-amber-100/95 text-amber-900 text-xs font-bold shadow-lg max-w-[160px] text-center" style={{ animation: "glyph-pop 0.4s ease-out" }}>
            {encouragePhrase}
          </div>
        )}
      </div>

      {/* ─── 右上 Sherlock 侦探 ─── */}
      <div className="absolute right-4 top-16 sm:right-8 sm:top-20 flex flex-col items-center pointer-events-none z-10">
        <div
          className="text-[58px] sm:text-[72px] leading-none"
          style={{
            animation: result === "correct" ? "glyph-sherlock-tip 0.8s ease-in-out" : "glyph-float-slow 4s ease-in-out infinite",
          }}
        >🕵️</div>
        <div className="text-[10px] text-amber-300/70 mt-1">Sherlock</div>
      </div>

      {/* ─── 题目 + 4 选项 ─── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pb-[max(8px,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-[#110a04] via-[#110a04]/85 to-transparent">
        <div className="text-center mb-3 px-4">
          <div className="inline-block px-4 py-2 rounded-2xl bg-amber-900/85 backdrop-blur-md border border-amber-300/40 max-w-[92vw]">
            <span className="text-amber-100 text-sm sm:text-base font-display font-bold">
              🔍 {cur.question}
            </span>
          </div>
        </div>

        {/* v0.36.7 framer-motion: 切换题时 4 选项 stagger 入场 */}
        <motion.div
          key={cur.id + "-options"}
          className="px-4 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-3xl mx-auto"
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } },
          }}
        >
          {cur.options.map((opt, i) => {
            const isCorrect = result === "correct" && i === cur.correctIdx;
            const isWrong = result === "wrong" && i === selectedIdx;
            const isOther = result !== "idle" && i !== cur.correctIdx && i !== selectedIdx;
            return (
              <motion.button
                key={i}
                onClick={() => handleChoice(i)}
                disabled={result === "correct"}
                variants={{
                  hidden: { opacity: 0, y: 16 },
                  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 18 } },
                }}
                whileHover={result === "idle" ? { y: -3, scale: 1.03 } : undefined}
                whileTap={result === "idle" ? { scale: 0.96 } : undefined}
                className={`
                  px-3 py-3 rounded-2xl border-2 font-display font-bold text-sm sm:text-base flex items-center justify-center gap-2
                  ${isCorrect ? "bg-emerald-400 border-emerald-200 text-emerald-950 scale-105 shadow-lg shadow-emerald-500/50" :
                    isWrong ? "bg-rose-500 border-rose-200 text-rose-950 animate-pulse" :
                    isOther ? "bg-amber-950/40 border-amber-800 text-amber-300/50 opacity-50" :
                    "bg-amber-900/60 backdrop-blur-md border-amber-300/50 text-amber-100 shadow-lg"}
                `}
              >
                {opt.emoji && <span className="text-xl">{opt.emoji}</span>}
                <span>{opt.text}</span>
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      {/* footer */}
      <div className="fixed bottom-1 left-2 text-[9px] text-amber-300/30 z-40 pointer-events-auto">
        Sprint C2 🔍 字形侦探 prototype · <Link className="underline" to="/chinese">语文 hub</Link> · <Link className="underline" to="/chinese/poem-lantern-preview">C1 灯笼</Link>
      </div>

      <style>{`
        @keyframes glyph-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes glyph-float-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes glyph-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        @keyframes glyph-bow { 0%, 100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(0) rotate(-20deg); } }
        @keyframes glyph-sherlock-tip { 0%, 100% { transform: rotate(0deg) scale(1); } 25% { transform: rotate(-15deg) scale(1.2); } 75% { transform: rotate(15deg) scale(1.2); } }
        @keyframes glyph-magnify { 0% { transform: scale(0.3) rotate(-30deg); opacity: 0; } 60% { transform: scale(1.5) rotate(15deg); opacity: 0.8; } 100% { transform: scale(1.2) rotate(0deg); opacity: 0.5; } }
        @keyframes glyph-stamp { 0% { transform: scale(0) rotate(-30deg); opacity: 0; } 60% { transform: scale(1.3) rotate(20deg); opacity: 1; } 100% { transform: scale(1) rotate(12deg); opacity: 1; } }
        @keyframes glyph-pop { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}
