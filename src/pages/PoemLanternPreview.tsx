/**
 * v0.35.92 — Sprint C1: 🏮 古诗拍灯笼 (Poem Lantern) Chinese cluster prototype.
 *
 * Chinese Cluster 1/7. 覆盖 PoemRecite / PoemCloze 类古诗补字题型.
 *
 * 核心洞察: 古诗背诵补字, 把"缺字" → "灯笼上的字飞走了, 帮忙找回来".
 * 元宵节意象 (灯笼 + 月光 + 鞭炮) 给中国传统美感, 比 math 数字题更文化.
 *
 * 设计 DNA (元宵节灯笼主题, 跟 math 7 cluster 完全区别 — chinese 走传统文化):
 * - 深红 + 金 + 夜空蓝 (元宵喜庆配色)
 * - 红灯笼 SVG 3-4 个飘空中 + 金色流苏 + 蜡烛光
 * - 月亮 + 远山剪影 + 飘落樱花/雪花
 * - Mascot 🐼 戴 🧧 红包 / 唐装 (传统节庆)
 * - 助手 = 🐉 福龙 (右上, 友善, 不是怪兽)
 * - 答对 → 灯笼炸金光 + 鞭炮 emoji + Dragon dance + "对了!" 飞字
 * - 答错 → 灯笼轻摇 + 鼓励 "再想想, 古诗有节奏" (不羞辱)
 *
 * 3 mock cases (覆盖期中考 G4B 古诗 3 首):
 * - 卷一 《独坐敬亭山》 李白 — 众鸟高___尽, 相看两不___ (飞/厌)
 * - 卷二 《望洞庭》 刘禹锡 — 湖光秋月两相___, 潭面无风镜未___ (和/磨)
 * - 卷三 《清平乐·村居》 辛弃疾 — 茅___低小, 白发谁家___媪 (檐/翁)
 *
 * 入口: `/chinese/poem-lantern-preview`
 */
import { useState, useEffect } from "react";
import { awardClusterXp } from "../lib/clusterXp";
import { Link } from "react-router-dom";

type PoemCase = {
  id: string;
  scrollLabel: string;
  poemTitle: string;
  poet: string;
  lines: string[]; // 用 ___ 表示空, 多个空依次对应 blanks
  blanks: string[]; // 正确答案 (按顺序)
  pool: string[]; // 候选字池 (含答案 + 干扰)
};

const DEMO_CASES: PoemCase[] = [
  {
    id: "p1",
    scrollLabel: "卷一 · 李白",
    poemTitle: "独坐敬亭山",
    poet: "唐 · 李白",
    lines: [
      "众鸟高___尽, 孤云独去闲.",
      "相看两不___, 只有敬亭山.",
    ],
    blanks: ["飞", "厌"],
    pool: ["飞", "厌", "去", "看", "山", "倦"],
  },
  {
    id: "p2",
    scrollLabel: "卷二 · 刘禹锡",
    poemTitle: "望洞庭",
    poet: "唐 · 刘禹锡",
    lines: [
      "湖光秋月两相___, 潭面无风镜未___.",
      "遥望洞庭山水翠, 白银盘里一青螺.",
    ],
    blanks: ["和", "磨"],
    pool: ["和", "磨", "明", "亮", "好", "圆"],
  },
  {
    id: "p3",
    scrollLabel: "卷三 · 辛弃疾",
    poemTitle: "清平乐 · 村居",
    poet: "宋 · 辛弃疾",
    lines: [
      "茅___低小, 溪上青青草.",
      "醉里吴音相媚好, 白发谁家___媪?",
    ],
    blanks: ["檐", "翁"],
    pool: ["檐", "翁", "屋", "婆", "家", "顶"],
  },
  {
    id: "p4",
    scrollLabel: "卷四 · 杨万里",
    poemTitle: "宿新市徐公店",
    poet: "宋 · 杨万里",
    lines: [
      "篱落疏疏一径深, 树头新绿未成___.",
      "儿童急走追黄蝶, 飞入菜花无处___.",
    ],
    blanks: ["阴", "寻"],
    pool: ["阴", "寻", "荫", "村", "林", "踪"],
  },
  {
    id: "p5",
    scrollLabel: "卷五 · 卢纶",
    poemTitle: "塞下曲",
    poet: "唐 · 卢纶",
    lines: [
      "月黑雁飞高, 单于夜___逃.",
      "欲将轻骑___, 大雪满弓刀.",
    ],
    blanks: ["遁", "逐"],
    pool: ["遁", "逐", "潜", "追", "奔", "驱"],
  },
  {
    id: "p6",
    scrollLabel: "卷六 · 王冕",
    poemTitle: "墨梅",
    poet: "元 · 王冕",
    lines: [
      "我家洗砚池头树, 朵朵花开淡墨___.",
      "不要人夸好颜色, 只留清气满乾___.",
    ],
    blanks: ["痕", "坤"],
    pool: ["痕", "坤", "斑", "天", "迹", "空"],
  },
  {
    id: "p7",
    scrollLabel: "卷七 · 王昌龄",
    poemTitle: "芙蓉楼送辛渐",
    poet: "唐 · 王昌龄",
    lines: [
      "寒雨连江夜入吴, 平明送客楚山___.",
      "洛阳亲友如相问, 一片冰心在玉___.",
    ],
    blanks: ["孤", "壶"],
    pool: ["孤", "壶", "高", "瓶", "寒", "杯"],
  },
];

const ENCOURAGE_PHRASES = [
  "再想想, 古诗有节奏",
  "灯笼还亮着, 慢慢念",
  "诗仙也会等你",
  "字飞回来了, 试试看",
];

const PLACEHOLDER = "___";

export function PoemLanternPreviewPage() {
  const [caseIdx, setCaseIdx] = useState(0);
  const [filled, setFilled] = useState<(string | null)[]>([]);
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [encouragePhrase, setEncouragePhrase] = useState<string | null>(null);

  const cur = DEMO_CASES[caseIdx]!;

  useEffect(() => {
    // 切换题目时重置
    setFilled(Array.from({ length: cur.blanks.length }, () => null));
    setResult("idle");
    setEncouragePhrase(null);
  }, [caseIdx, cur.blanks.length]);

  useEffect(() => {
    if (result === "correct") {
      const t = setTimeout(() => {
        setCaseIdx((i) => (i + 1) % DEMO_CASES.length);
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [result]);

  // 已填入 chip 的 pool index (避免重复选)
  const usedPoolChars = new Set(filled.filter((x): x is string => x !== null));

  function handlePoolClick(char: string) {
    if (result === "correct") return;
    // 找第一个空格填入
    const firstEmpty = filled.findIndex((f) => f === null);
    if (firstEmpty === -1) return;
    const newFilled = [...filled];
    newFilled[firstEmpty] = char;
    setFilled(newFilled);
    // Auto-judge 当 filled 全部填好时
    if (newFilled.every((f) => f !== null)) {
      // judge
      const allCorrect = newFilled.every((f, i) => f === cur.blanks[i]);
      if (allCorrect) {
        setResult("correct"); void awardClusterXp(1);
      } else {
        setResult("wrong");
        setEncouragePhrase(ENCOURAGE_PHRASES[Math.floor(Math.random() * ENCOURAGE_PHRASES.length)] ?? null);
        setTimeout(() => {
          setFilled(Array.from({ length: cur.blanks.length }, () => null));
          setResult("idle");
        }, 1200);
      }
    }
  }

  function handleBlankClick(idx: number) {
    if (result === "correct") return;
    if (filled[idx] === null) return;
    const newFilled = [...filled];
    newFilled[idx] = null;
    setFilled(newFilled);
    setResult("idle");
  }

  // Render lines with blanks filled
  const renderedLines = cur.lines.map((line, lineIdx) => {
    const parts = line.split(PLACEHOLDER);
    // Count blanks before this line
    const blanksBeforeThisLine = cur.lines.slice(0, lineIdx).reduce((sum, l) => sum + (l.match(/___/g)?.length ?? 0), 0);
    const segments: React.ReactNode[] = [];
    parts.forEach((part, i) => {
      segments.push(<span key={`t-${lineIdx}-${i}`}>{part}</span>);
      if (i < parts.length - 1) {
        const blankIdx = blanksBeforeThisLine + i;
        const ch = filled[blankIdx];
        segments.push(
          <button
            key={`b-${lineIdx}-${i}`}
            onClick={() => handleBlankClick(blankIdx)}
            disabled={result === "correct" || ch === null}
            className={`inline-flex items-center justify-center w-10 sm:w-12 h-10 sm:h-12 mx-0.5 rounded-lg border-2 border-dashed font-display font-black text-xl sm:text-2xl align-middle transition-all ${
              ch
                ? result === "correct"
                  ? "bg-amber-400 border-amber-200 text-amber-950 scale-105 shadow-lg"
                  : "bg-red-700 border-amber-300 text-amber-100 shadow"
                : "bg-black/40 border-amber-400/50 text-amber-300/50"
            }`}
          >
            {ch ?? "?"}
          </button>,
        );
      }
    });
    return (
      <div key={lineIdx} className="text-amber-100 text-xl sm:text-2xl font-display flex items-center justify-center flex-wrap leading-relaxed">
        {segments}
      </div>
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden text-amber-50"
      style={{
        height: "100dvh",
        background: "radial-gradient(ellipse at top, #7f1d1d 0%, #450a0a 50%, #0c0306 100%)",
      }}
    >
      {/* 元宵 ambience */}
      <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-red-600/25 blur-[120px] pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-amber-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full bg-rose-700/20 blur-[120px] pointer-events-none" />

      {/* 远山剪影 + 月亮 + 飘雪 */}
      <svg className="absolute inset-0 w-full h-full opacity-35 pointer-events-none" viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice">
        {/* 月亮 (top-right) */}
        <circle cx="860" cy="120" r="40" fill="#fef3c7" opacity="0.9" />
        <circle cx="850" cy="115" r="8" fill="#fcd34d" opacity="0.5" />
        <circle cx="875" cy="130" r="5" fill="#fcd34d" opacity="0.4" />
        {/* 远山 */}
        <path d="M 0 540 L 150 380 L 320 480 L 480 360 L 620 460 L 780 420 L 920 500 L 1000 440 L 1000 800 L 0 800 Z" fill="#3f0a0a" />
        <path d="M 0 620 L 200 520 L 400 580 L 600 500 L 800 560 L 1000 520 L 1000 800 L 0 800 Z" fill="#1a0303" opacity="0.8" />
        {/* 飘落樱花/雪花 */}
        {Array.from({ length: 24 }).map((_, i) => {
          const x = (i * 71) % 100;
          const y = ((i * 47) % 60) + 5;
          const r = (i % 3) * 0.6 + 0.6;
          return (
            <g key={i} className="animate-petal-fall" style={{ animationDelay: `${i * 0.5}s` } as React.CSSProperties}>
              <circle cx={`${x}%`} cy={`${y}%`} r={r} fill="#fda4af" opacity={((i * 13) % 100) / 100 * 0.8 + 0.2} />
            </g>
          );
        })}
      </svg>

      {/* 红灯笼 SVG 4 个 (left, right, top-mid, bottom-mid) */}
      <svg className="absolute inset-0 w-full h-full opacity-90 pointer-events-none" viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice">
        {[
          { x: 90, y: 200, scale: 1, delay: 0 },
          { x: 910, y: 240, scale: 0.85, delay: 0.7 },
          { x: 200, y: 480, scale: 0.7, delay: 1.4 },
          { x: 800, y: 500, scale: 0.75, delay: 2.1 },
        ].map((l, i) => (
          <g key={i} transform={`translate(${l.x}, ${l.y}) scale(${l.scale})`} className="animate-lantern-sway" style={{ animationDelay: `${l.delay}s` } as React.CSSProperties}>
            {/* 灯笼绳 (顶) */}
            <line x1="0" y1="-30" x2="0" y2="-50" stroke="#fcd34d" strokeWidth="1.5" />
            {/* 顶帽 */}
            <rect x="-15" y="-30" width="30" height="6" rx="2" fill="#92400e" />
            {/* 灯笼体 (椭圆 + 红 + 金圈) */}
            <ellipse cx="0" cy="0" rx="40" ry="32" fill={result === "correct" && i === 0 ? "#fcd34d" : "#dc2626"} stroke="#92400e" strokeWidth="2" />
            <ellipse cx="0" cy="0" rx="40" ry="32" fill="none" stroke="#fcd34d" strokeWidth="1.5" />
            {/* 横向金筋 */}
            <line x1="-38" y1="-10" x2="38" y2="-10" stroke="#fcd34d" strokeWidth="1" opacity="0.7" />
            <line x1="-38" y1="10" x2="38" y2="10" stroke="#fcd34d" strokeWidth="1" opacity="0.7" />
            {/* 福 字 (中心) */}
            <text x="0" y="6" fontSize="22" fill="#fef3c7" textAnchor="middle" fontWeight="bold">福</text>
            {/* 流苏 */}
            <line x1="0" y1="32" x2="0" y2="50" stroke="#fcd34d" strokeWidth="1.5" />
            <circle cx="0" cy="55" r="4" fill="#fcd34d" />
            <line x1="-5" y1="55" x2="-8" y2="65" stroke="#fcd34d" strokeWidth="1" />
            <line x1="5" y1="55" x2="8" y2="65" stroke="#fcd34d" strokeWidth="1" />
            <line x1="0" y1="55" x2="0" y2="68" stroke="#fcd34d" strokeWidth="1" />
            {/* 蜡烛光晕 */}
            <circle cx="0" cy="0" r="50" fill="#fcd34d" opacity={result === "correct" && i === 0 ? "0.4" : "0.15"} />
          </g>
        ))}
      </svg>

      {/* 角落装饰 emoji */}
      <div className="absolute top-16 left-6 text-3xl opacity-50 select-none">🧧</div>
      <div className="absolute top-16 right-6 text-3xl opacity-50 select-none">🎆</div>
      <div className="absolute bottom-44 left-6 text-3xl opacity-50 select-none">🥢</div>
      <div className="absolute bottom-44 right-6 text-3xl opacity-50 select-none">🌸</div>

      {/* ─── 顶部 HUD ─── */}
      <div className="absolute top-3 left-0 right-0 px-4 z-20 flex items-center justify-between">
        <Link to="/chinese" className="px-3 py-1.5 rounded-xl bg-red-900/85 backdrop-blur-md border border-amber-400/40 text-xs font-bold text-amber-100">
          ← 离开庙会
        </Link>
        <div className="px-4 py-1.5 rounded-xl bg-red-900/85 backdrop-blur-md border border-amber-400/40 text-center">
          <div className="text-[10px] text-amber-300 uppercase tracking-widest">🏮 元宵诗会</div>
          <div className="text-sm font-display font-bold text-amber-100">{cur.scrollLabel}</div>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-red-900/85 backdrop-blur-md border border-amber-400/40 text-xs font-bold text-amber-100 tabular-nums">
          {caseIdx + 1} / {DEMO_CASES.length}
        </div>
      </div>

      {/* ─── 中央 古诗 + 缺字格 ─── */}
      <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 z-10 w-full max-w-2xl px-4">
        {/* 诗 title + 作者 */}
        <div className="text-center mb-4">
          <h2 className="font-display font-black text-amber-200 text-2xl sm:text-3xl">{cur.poemTitle}</h2>
          <p className="text-amber-300/80 text-sm mt-1">{cur.poet}</p>
        </div>
        {/* 诗句 with 缺字 */}
        <div className="space-y-3 bg-black/30 backdrop-blur-md rounded-2xl border border-amber-300/30 px-4 sm:px-8 py-6 shadow-2xl">
          {renderedLines}
        </div>

        {result === "correct" && (
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-3xl font-bold text-amber-300 z-30" style={{ animation: "poem-correct 1.5s ease-out" }}>
            🎆 对了! 🎆
          </div>
        )}
      </div>

      {/* ─── 左下 Mascot 戴 唐装 ─── */}
      <div className="absolute left-4 bottom-44 sm:left-8 sm:bottom-48 flex flex-col items-center gap-1 pointer-events-none z-10">
        <div className="relative">
          <div
            className="text-[72px] sm:text-[88px] leading-none"
            style={{
              animation: result === "correct" ? "poem-celebrate 0.8s ease-in-out" : "poem-float 3s ease-in-out infinite",
            }}
          >🐼</div>
          {/* 红包 / 唐装 head 标 */}
          <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 text-3xl">🧧</div>
        </div>
        {encouragePhrase && (
          <div className="px-3 py-1.5 rounded-2xl bg-amber-100/95 text-red-900 text-xs font-bold shadow-lg max-w-[160px] text-center" style={{ animation: "poem-pop 0.4s ease-out" }}>
            {encouragePhrase}
          </div>
        )}
      </div>

      {/* ─── 右上 福龙 ─── */}
      <div className="absolute right-4 top-16 sm:right-8 sm:top-20 flex flex-col items-center pointer-events-none z-10">
        <div
          className="text-[58px] sm:text-[72px] leading-none"
          style={{
            animation: result === "correct" ? "poem-dragon-dance 0.8s ease-in-out" : "poem-float-slow 4s ease-in-out infinite",
          }}
        >🐉</div>
        <div className="text-[10px] text-amber-300/70 mt-1">福龙</div>
      </div>

      {/* ─── 字池 (底部) ─── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pb-[max(8px,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-[#0c0306] via-[#0c0306]/85 to-transparent">
        <div className="text-center mb-2 px-4">
          <div className="inline-block px-4 py-1.5 rounded-2xl bg-red-900/85 backdrop-blur-md border border-amber-300/40">
            <span className="text-amber-100 text-xs sm:text-sm font-display font-bold">
              🏮 点字填入诗中
            </span>
          </div>
        </div>
        <div className="px-4 pb-2 flex flex-wrap justify-center gap-2 max-w-3xl mx-auto">
          {cur.pool.map((char, i) => {
            const used = usedPoolChars.has(char);
            return (
              <button
                key={`${char}-${i}`}
                onClick={() => handlePoolClick(char)}
                disabled={used || result === "correct"}
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl border-2 font-display font-black text-xl sm:text-2xl transition-all ${
                  used
                    ? "bg-slate-800/30 border-slate-700 text-slate-600 opacity-40 cursor-not-allowed"
                    : "bg-amber-50 border-amber-300 text-red-900 hover:scale-110 active:scale-95 shadow-lg shadow-amber-500/30"
                }`}
              >
                {char}
              </button>
            );
          })}
        </div>
      </div>

      {/* footer */}
      <div className="fixed bottom-1 left-2 text-[9px] text-amber-300/30 z-40 pointer-events-auto">
        Sprint C1 🏮 古诗拍灯笼 prototype · <Link className="underline" to="/chinese">语文 hub</Link>
      </div>

      <style>{`
        @keyframes poem-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes poem-float-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes poem-celebrate { 0%, 100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-12px) rotate(-10deg); } 75% { transform: translateY(-12px) rotate(10deg); } }
        @keyframes poem-dragon-dance { 0% { transform: rotate(0deg) scale(1); } 50% { transform: rotate(360deg) scale(1.3); } 100% { transform: rotate(720deg) scale(1); } }
        @keyframes poem-correct { 0% { transform: translateX(-50%) scale(0) rotate(-15deg); opacity: 0; } 50% { transform: translateX(-50%) scale(1.3) rotate(5deg); opacity: 1; } 100% { transform: translateX(-50%) scale(1) rotate(0deg); opacity: 1; } }
        @keyframes poem-pop { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes lantern-sway { 0%, 100% { transform: translate(0,0) rotate(-2deg); } 50% { transform: translate(0,-4px) rotate(2deg); } }
        @keyframes petal-fall { 0% { transform: translateY(0) translateX(0); opacity: 0.8; } 100% { transform: translateY(60px) translateX(8px); opacity: 0.3; } }
        .animate-lantern-sway { animation: lantern-sway 4s ease-in-out infinite; transform-origin: center top; }
        .animate-petal-fall { animation: petal-fall 6s ease-in infinite; }
      `}</style>
    </div>
  );
}
