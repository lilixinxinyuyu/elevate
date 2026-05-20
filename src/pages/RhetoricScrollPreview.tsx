/**
 * v0.35.99 — Sprint C4: 📜 修辞画卷 (Rhetoric Scroll) Chinese cluster prototype.
 *
 * Chinese Cluster 4/7. 覆盖 修辞辨认 / 比喻 / 拟人 / 排比 / 反问.
 *
 * 核心洞察: G4B 期中考第 14-15 题 "修辞辨认 (老黄牛/小蜜蜂 对应人)" 是必考点.
 * 把 "找修辞" → "鉴赏山水画卷上的诗句, 辨别画家用了什么手法". 文人画 metaphor.
 *
 * 设计 DNA (中国山水画 / 文人画卷主题, 墨黑+朱砂+米黄, 跟其他 cluster 全区别):
 * - 米黄 (画卷) + 墨黑 (山水) + 朱砂红 (印章) + 暗灰云 (留白)
 * - 大画卷 SVG (米黄底 + 黑墨山 + 飞鹤 + 朱砂印章 + 题字)
 * - 远山 + 飘云 + 竹林剪影 装饰
 * - Mascot 🐼 戴 🎓 文人帽 + 持 ✒ 毛笔 (左下)
 * - 助手 = 🦢 仙鹤 (右上, 优雅, 答对盘旋)
 * - 中央: 大画卷 + 题诗 + 4 修辞 chip
 * - 答对 → 印章盖落 + 仙鹤盘旋 + "妙! 此为 X 也!"
 * - 答错 → 画卷轻颤 + 鼓励 "再细品, 古人意趣"
 *
 * 3 mock cases (覆盖期中第 14-15 题):
 * - 案一: "老黄牛 / 小蜜蜂 / 百灵鸟 / 领头羊" 对应人物 (比喻/拟人 辨认)
 * - 案二: 排比 "山在动, 海在笑, 森林在歌唱" 辨认
 * - 案三: 反问 "难道我们不应该爱护花草吗?" 辨认
 *
 * 入口: `/chinese/rhetoric-scroll-preview`
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

type RhetoricCase = {
  id: string;
  scrollLabel: string;
  poem: string;
  poemSource: string;
  question: string;
  options: { text: string; emoji?: string }[];
  correctIdx: number;
  solution: string;
};

const DEMO_CASES: RhetoricCase[] = [
  {
    id: "r1",
    scrollLabel: "卷一 · 牛蜂鸟羊",
    poem: "勤劳老黄牛, 采蜜小蜜蜂, 报春百灵鸟, 引路领头羊。",
    poemSource: "课文《猫》《麻雀》延伸 — 期中第 15 题原文",
    question: "上面诗句用了哪种修辞?",
    options: [
      { text: "比喻 (用动物比人)", emoji: "🐂" },
      { text: "拟人 (物当人写)", emoji: "🐝" },
      { text: "排比 (3+ 相同结构)", emoji: "📜" },
      { text: "反问 (问句强调)", emoji: "❓" },
    ],
    correctIdx: 0,
    solution: "比喻 — 老黄牛比勤劳人, 小蜜蜂比辛勤人, 百灵鸟比报春人, 领头羊比引路人. 4 个比喻并列.",
  },
  {
    id: "r2",
    scrollLabel: "卷二 · 山海森林",
    poem: "山在动, 海在笑, 森林在歌唱。",
    poemSource: "现代诗课文 — 期中第 17 题原文",
    question: "这句话用了哪种修辞?",
    options: [
      { text: "比喻 (像 / 似)", emoji: "🌊" },
      { text: "夸张 (放大特征)", emoji: "🌋" },
      { text: "排比 (3+ 同结构)", emoji: "📜" },
      { text: "对偶 (字数相等)", emoji: "⚖️" },
    ],
    correctIdx: 2,
    solution: "排比 — 3 个 \"X 在 V\" 结构相同, 内容相关. 山 / 海 / 森林 并列描写.",
  },
  {
    id: "r3",
    scrollLabel: "卷三 · 爱护花草",
    poem: "难道我们不应该爱护这片美丽的花草吗？",
    poemSource: "课文《在天晴了的时候》 — 期中第 16 题型",
    question: "这句话用了哪种修辞?",
    options: [
      { text: "拟人 (物当人)", emoji: "🌸" },
      { text: "反问 (无疑而问)", emoji: "❓" },
      { text: "夸张 (扩大表现)", emoji: "🌟" },
      { text: "比喻 (X 像 Y)", emoji: "💐" },
    ],
    correctIdx: 1,
    solution: "反问 — 用问句强调肯定意思 (我们应该爱护花草). 比直接陈述更有力.",
  },
  {
    id: "r4",
    scrollLabel: "卷四 · 春风唱歌",
    poem: "春风轻轻地唱着歌, 唤醒了沉睡的大地。",
    poemSource: "现代诗 — 期中第 14 题型",
    question: "这句话用了哪种修辞?",
    options: [
      { text: "比喻 (像 / 似)", emoji: "🌬️" },
      { text: "拟人 (物当人写)", emoji: "🎵" },
      { text: "排比 (3+ 同结构)", emoji: "📜" },
      { text: "夸张 (放大特征)", emoji: "🌟" },
    ],
    correctIdx: 1,
    solution: "拟人 — '唱歌''唤醒'是人的动作, 把春风当人写. 不是'像'所以不是比喻.",
  },
  {
    id: "r5",
    scrollLabel: "卷五 · 银色小河",
    poem: "弯弯的小河像一条银色的带子, 静静地流向远方。",
    poemSource: "写景文 — 期中第 15 题型",
    question: "划线句'小河像银色的带子'用了什么修辞?",
    options: [
      { text: "拟人 (人的动作)", emoji: "🌊" },
      { text: "排比 (并列句)", emoji: "📜" },
      { text: "比喻 (本体+喻体)", emoji: "🎀" },
      { text: "反问 (无疑而问)", emoji: "❓" },
    ],
    correctIdx: 2,
    solution: "比喻 — 本体'小河'+ 喻体'银色带子', 用'像'连接, 相似点是又长又弯又亮.",
  },
  {
    id: "r6",
    scrollLabel: "卷六 · 读书使人",
    poem: "读书使人明智, 读书使人聪慧, 读书使人高尚。",
    poemSource: "议论文 — 期中第 17 题型",
    question: "这段话用了哪种修辞?",
    options: [
      { text: "比喻 (像/是)", emoji: "📖" },
      { text: "夸张 (放大)", emoji: "🌟" },
      { text: "拟人 (物当人)", emoji: "👤" },
      { text: "排比 (3+ 同结构)", emoji: "📜" },
    ],
    correctIdx: 3,
    solution: "排比 — 3 个'读书使人 X'结构相同并列, 增强气势. 注意不是比喻.",
  },
  {
    id: "r7",
    scrollLabel: "卷七 · 心提嗓子",
    poem: "听到这个消息, 我的心一下子提到了嗓子眼。",
    poemSource: "记叙文 — 期中第 16 题型",
    question: "'心提到嗓子眼'用了什么修辞?",
    options: [
      { text: "夸张 (故意放大)", emoji: "😱" },
      { text: "比喻 (像/似)", emoji: "❤️" },
      { text: "排比 (3+句)", emoji: "📜" },
      { text: "反问 (问句)", emoji: "❓" },
    ],
    correctIdx: 0,
    solution: "夸张 — 心不可能真提到嗓子, 故意放大表现紧张害怕. 这是夸张手法.",
  },
];

const ENCOURAGE_PHRASES = [
  "再细品, 古人意趣",
  "看修辞规律: 像? 物当人? 3 排?",
  "仙鹤提示: 慢慢看结构",
  "墨香深远, 不急",
];

export function RhetoricScrollPreviewPage() {
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
      }, 2200);
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
      className="fixed inset-0 z-50 overflow-hidden text-stone-100"
      style={{
        height: "100dvh",
        background: "radial-gradient(ellipse at top, #292524 0%, #1c1917 50%, #0c0a09 100%)",
      }}
    >
      {/* 墨黑 ambience */}
      <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-amber-700/15 blur-[120px] pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-stone-500/15 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full bg-rose-900/15 blur-[120px] pointer-events-none" />

      {/* 山水画背景 SVG */}
      <svg className="absolute inset-0 w-full h-full opacity-40 pointer-events-none" viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice">
        {/* 远山 (墨黑层次) */}
        <path d="M 0 480 L 100 350 L 200 420 L 300 320 L 420 400 L 540 310 L 680 390 L 820 320 L 940 400 L 1000 360 L 1000 800 L 0 800 Z" fill="#1c1917" opacity="0.6" />
        <path d="M 0 550 L 150 460 L 300 510 L 450 440 L 620 500 L 780 460 L 940 510 L 1000 480 L 1000 800 L 0 800 Z" fill="#0c0a09" opacity="0.5" />
        {/* 飘云 (留白) */}
        {Array.from({ length: 8 }).map((_, i) => {
          const x = (i * 137) % 100;
          const y = ((i * 47) % 30) + 5;
          const w = 40 + (i % 3) * 20;
          return (
            <g key={i} className="animate-cloud-mist" style={{ animationDelay: `${i * 1.2}s` } as React.CSSProperties}>
              <ellipse cx={`${x}%`} cy={`${y}%`} rx={w} ry={10} fill="#f5f5f4" opacity="0.12" />
              <ellipse cx={`${x + 5}%`} cy={`${y + 1}%`} rx={w * 0.7} ry={6} fill="#f5f5f4" opacity="0.08" />
            </g>
          );
        })}
        {/* 仙鹤剪影 (飘) */}
        <g transform="translate(800, 200)" className="animate-crane-fly">
          <path d="M 0 0 Q -8 -3 -16 0 Q -10 5 0 4 Q 10 5 16 0 Q 8 -3 0 0 Z" fill="#f5f5f4" opacity="0.5" />
          <line x1="0" y1="0" x2="0" y2="10" stroke="#f5f5f4" strokeWidth="1" opacity="0.5" />
        </g>
        {/* 竹林 (left bottom) */}
        <g transform="translate(50, 580)" opacity="0.4">
          {[0, 12, 24, 36, 48].map((x, i) => (
            <line key={i} x1={x} y1="0" x2={x - 5} y2="-120" stroke="#1c1917" strokeWidth={2 + (i % 2)} />
          ))}
          {[8, 20, 32, 44].map((x, i) => (
            <ellipse key={i} cx={x} cy={-60 - i * 10} rx="6" ry="2" fill="#1c1917" />
          ))}
        </g>
        {/* 朱砂印章 (top-right) */}
        <g transform="translate(900, 130)" className="animate-seal-pulse">
          <rect x="-20" y="-20" width="40" height="40" rx="2" fill="#991b1b" opacity="0.7" stroke="#dc2626" strokeWidth="1" />
          <text x="0" y="5" fontSize="16" fill="#fef3c7" textAnchor="middle" fontWeight="bold" opacity="0.9">墨</text>
        </g>
      </svg>

      {/* 角落装饰 emoji */}
      <div className="absolute top-16 left-6 text-3xl opacity-60 select-none">🖌️</div>
      <div className="absolute top-16 right-6 text-3xl opacity-60 select-none">🪞</div>
      <div className="absolute bottom-44 left-6 text-3xl opacity-60 select-none">🎋</div>
      <div className="absolute bottom-44 right-6 text-3xl opacity-60 select-none">☁️</div>

      {/* ─── 顶部 HUD ─── */}
      <div className="absolute top-3 left-0 right-0 px-4 z-20 flex items-center justify-between">
        <Link to="/chinese" className="px-3 py-1.5 rounded-xl bg-stone-800/85 backdrop-blur-md border border-amber-600/50 text-xs font-bold text-amber-100">
          ← 离开画堂
        </Link>
        <div className="px-4 py-1.5 rounded-xl bg-stone-800/85 backdrop-blur-md border border-amber-600/50 text-center">
          <div className="text-[10px] text-amber-400 uppercase tracking-widest">📜 修辞画卷堂</div>
          <div className="text-sm font-display font-bold text-amber-100">{cur.scrollLabel}</div>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-stone-800/85 backdrop-blur-md border border-amber-600/50 text-xs font-bold text-amber-100 tabular-nums">
          {caseIdx + 1} / {DEMO_CASES.length}
        </div>
      </div>

      {/* ─── 中央 大画卷 ─── */}
      <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 z-10 w-full max-w-3xl px-4">
        <div className="relative">
          {/* 画卷 body */}
          <div
            className={`relative rounded-2xl border-4 border-amber-800 shadow-2xl px-8 py-8 transition-all duration-300 ${result === "wrong" ? "animate-rhetoric-shake" : ""}`}
            style={{
              animation: result === "wrong" ? "rhetoric-shake 0.5s ease-in-out" : undefined,
              // v0.36.5: 先 cream 底 (amber-50) + 再叠 repeating lines, 不再透明
              backgroundColor: "#fef3c7",
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 22px, rgba(146,64,14,0.18) 22px, rgba(146,64,14,0.18) 23px)",
            }}
          >
            {/* 卷轴顶部装饰 */}
            <div className="absolute -top-2 left-8 right-8 h-1 bg-amber-700/40" />
            <div className="absolute -bottom-2 left-8 right-8 h-1 bg-amber-700/40" />

            {/* 题诗 source */}
            <div className="text-[10px] text-amber-700 uppercase tracking-widest mb-2 text-center italic">{cur.poemSource}</div>
            {/* 大诗 (Kaiti 字体) */}
            <div className="text-2xl sm:text-3xl text-stone-900 text-center leading-loose font-display" style={{ fontFamily: "'STKaiti', 'KaiTi', 'Songti SC', serif" }}>
              {cur.poem}
            </div>
            {/* 印章 (右下) */}
            <div className="absolute -bottom-1 right-4">
              <div className="w-12 h-12 rounded bg-red-700 border-2 border-red-900 shadow-lg flex items-center justify-center" style={{ transform: "rotate(-3deg)" }}>
                <span className="text-amber-100 font-display font-bold text-xs">{result === "correct" ? "✓" : "墨"}</span>
              </div>
            </div>

            {/* 答对 stamp */}
            {result === "correct" && (
              <div className="absolute top-4 right-4 text-2xl font-display font-black text-red-700 rotate-12" style={{ animation: "rhetoric-stamp 0.6s ease-out" }}>
                ✦ 妙! ✦
              </div>
            )}
          </div>
          {/* 卷轴左右 roll */}
          <div className="absolute -left-3 top-2 bottom-2 w-3 rounded-l-full bg-gradient-to-b from-amber-900 via-amber-800 to-amber-900 shadow-lg" />
          <div className="absolute -right-3 top-2 bottom-2 w-3 rounded-r-full bg-gradient-to-b from-amber-900 via-amber-800 to-amber-900 shadow-lg" />
        </div>

        {/* 解析 (答对后显示) */}
        {result === "correct" && (
          <div className="mt-4 max-w-xl mx-auto px-4 py-2 bg-emerald-900/80 backdrop-blur-md border border-emerald-300/40 rounded-xl text-emerald-100 text-xs text-center" style={{ animation: "rhetoric-pop 0.5s ease-out 0.3s both" }}>
            💡 {cur.solution}
          </div>
        )}
      </div>

      {/* ─── 左下 Mascot 戴 文人帽 ─── */}
      <div className="absolute left-4 bottom-44 sm:left-8 sm:bottom-48 flex flex-col items-center gap-1 pointer-events-none z-10">
        <div className="relative">
          <div
            className="text-[72px] sm:text-[88px] leading-none"
            style={{
              animation: result === "correct" ? "rhetoric-paint 0.8s ease-in-out" : "rhetoric-float 3s ease-in-out infinite",
            }}
          >🐼</div>
          {/* 文人帽 */}
          <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 text-3xl">🎓</div>
        </div>
        {encouragePhrase && (
          <div className="px-3 py-1.5 rounded-2xl bg-amber-100/95 text-stone-900 text-xs font-bold shadow-lg max-w-[180px] text-center" style={{ animation: "rhetoric-pop 0.4s ease-out" }}>
            {encouragePhrase}
          </div>
        )}
      </div>

      {/* ─── 右上 仙鹤 ─── */}
      <div className="absolute right-4 top-16 sm:right-8 sm:top-20 flex flex-col items-center pointer-events-none z-10">
        <div
          className="text-[58px] sm:text-[72px] leading-none"
          style={{
            animation: result === "correct" ? "rhetoric-crane 0.8s ease-in-out" : "rhetoric-float-slow 4s ease-in-out infinite",
          }}
        >🦢</div>
        <div className="text-[10px] text-amber-400/70 mt-1">仙鹤</div>
      </div>

      {/* ─── 题目 + 4 修辞 chip ─── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pb-[max(8px,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-[#0c0a09] via-[#0c0a09]/85 to-transparent">
        <div className="text-center mb-3 px-4">
          <div className="inline-block px-4 py-2 rounded-2xl bg-stone-800/85 backdrop-blur-md border border-amber-600/50 max-w-[92vw]">
            <span className="text-amber-100 text-sm sm:text-base font-display font-bold">
              📜 {cur.question}
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
                    isOther ? "bg-stone-800/40 border-stone-700 text-stone-400 opacity-50" :
                    "bg-stone-800/60 backdrop-blur-md border-amber-600/50 text-amber-100 hover:scale-[1.02] active:scale-95 shadow-lg"}
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
      <div className="fixed bottom-1 left-2 text-[9px] text-amber-400/30 z-40 pointer-events-auto">
        Sprint C4 📜 修辞画卷 · <Link className="underline" to="/chinese">语文 hub</Link> · <Link className="underline" to="/chinese/sentence-dragon-preview">C3 龙</Link>
      </div>

      <style>{`
        @keyframes rhetoric-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes rhetoric-float-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes rhetoric-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        @keyframes rhetoric-paint { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-12deg); } 75% { transform: rotate(12deg); } }
        @keyframes rhetoric-crane { 0% { transform: translateX(0) translateY(0) rotate(0deg); } 50% { transform: translateX(-40px) translateY(-20px) rotate(15deg) scale(1.3); } 100% { transform: translateX(0) translateY(0) rotate(0deg); } }
        @keyframes rhetoric-stamp { 0% { transform: scale(0) rotate(-30deg); opacity: 0; } 60% { transform: scale(1.3) rotate(8deg); opacity: 1; } 100% { transform: scale(1) rotate(12deg); opacity: 1; } }
        @keyframes rhetoric-pop { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes cloud-mist { 0%, 100% { transform: translateX(0); opacity: 0.12; } 50% { transform: translateX(20px); opacity: 0.18; } }
        @keyframes crane-fly { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(40px, -10px) scale(1.1); } }
        @keyframes seal-pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        .animate-cloud-mist { animation: cloud-mist 8s ease-in-out infinite; }
        .animate-crane-fly { animation: crane-fly 10s ease-in-out infinite; }
        .animate-seal-pulse { animation: seal-pulse 4s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
