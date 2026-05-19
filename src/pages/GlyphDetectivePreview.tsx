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
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

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

const DEMO_CASES: DetectiveCase[] = [
  {
    id: "g1",
    scrollLabel: "案一 · 蜻蜓之谜",
    hanzi: "蜻",
    hanziDesc: "出自《宿新市徐公店》— \"飞入菜花无处寻\"",
    question: "这个字的部首是什么?",
    options: [
      { text: "虫字旁 (蟲)", emoji: "🐛" },
      { text: "草字头", emoji: "🌿" },
      { text: "日字旁", emoji: "🌞" },
      { text: "月字旁", emoji: "🌙" },
    ],
    correctIdx: 0,
    solution: "\"蜻\" 是虫字旁 (跟昆虫有关). 右半 \"青\" 是声旁.",
  },
  {
    id: "g2",
    scrollLabel: "案二 · 白桦之谜",
    hanzi: "桦",
    hanziDesc: "出自《白桦》— 叶赛宁诗 \"白桦树姑娘披着雪白衬衫\"",
    question: "这个字的部首是什么?",
    options: [
      { text: "白字头", emoji: "⚪" },
      { text: "木字旁", emoji: "🌳" },
      { text: "口字旁", emoji: "👄" },
      { text: "水字旁", emoji: "💧" },
    ],
    correctIdx: 1,
    solution: "\"桦\" 是木字旁 (树名, 跟木有关). 右半 \"华\" 是声旁.",
  },
  {
    id: "g3",
    scrollLabel: "案三 · 猫的秘密",
    hanzi: "猫",
    hanziDesc: "出自老舍《猫》— \"我家的猫真有趣\"",
    question: "这个字的部首是什么?",
    options: [
      { text: "苗字旁", emoji: "🌱" },
      { text: "草字头", emoji: "🌿" },
      { text: "反犬旁 (犭)", emoji: "🐕" },
      { text: "口字旁", emoji: "👄" },
    ],
    correctIdx: 2,
    solution: "\"猫\" 是反犬旁 (犭, 跟动物有关). 右半 \"苗\" 是声旁.",
  },
];

const ENCOURAGE_PHRASES = [
  "再仔细看, 偏旁有规律",
  "放大镜下慢慢找",
  "Sherlock 提示: 看左半还是右半?",
  "形声字的形旁告诉你字义",
];

export function GlyphDetectivePreviewPage() {
  const [caseIdx, setCaseIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [encouragePhrase, setEncouragePhrase] = useState<string | null>(null);

  const cur = DEMO_CASES[caseIdx]!;

  useEffect(() => {
    if (result === "correct") {
      const t = setTimeout(() => {
        setCaseIdx((i) => (i + 1) % DEMO_CASES.length);
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
      setResult("correct");
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
          {caseIdx + 1} / {DEMO_CASES.length}
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
            {/* 大汉字 */}
            <div className="text-[150px] sm:text-[180px] font-display text-amber-900 text-center leading-none select-none" style={{ fontFamily: "'STKaiti', 'KaiTi', 'Songti SC', serif" }}>
              {cur.hanzi}
            </div>
            {/* 字描述 */}
            <div className="text-xs text-amber-700/80 mt-2 text-center italic">{cur.hanziDesc}</div>

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

        <div className="px-4 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-3xl mx-auto">
          {cur.options.map((opt, i) => {
            const isCorrect = result === "correct" && i === cur.correctIdx;
            const isWrong = result === "wrong" && i === selectedIdx;
            const isOther = result !== "idle" && i !== cur.correctIdx && i !== selectedIdx;
            return (
              <button
                key={i}
                onClick={() => handleChoice(i)}
                disabled={result === "correct"}
                className={`
                  px-3 py-3 rounded-2xl border-2 font-display font-bold text-sm sm:text-base flex items-center justify-center gap-2
                  transition-all
                  ${isCorrect ? "bg-emerald-400 border-emerald-200 text-emerald-950 scale-105 shadow-lg shadow-emerald-500/50" :
                    isWrong ? "bg-rose-500 border-rose-200 text-rose-950 animate-pulse" :
                    isOther ? "bg-amber-950/40 border-amber-800 text-amber-300/50 opacity-50" :
                    "bg-amber-900/60 backdrop-blur-md border-amber-300/50 text-amber-100 hover:scale-[1.02] active:scale-95 shadow-lg"}
                `}
              >
                {opt.emoji && <span className="text-xl">{opt.emoji}</span>}
                <span>{opt.text}</span>
              </button>
            );
          })}
        </div>
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
