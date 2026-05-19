/**
 * v0.35.83 — Sprint 9: 数据探险 (Data Adventure) cluster prototype.
 *
 * Cluster 5/7. 覆盖 BarChart / LineChart / PieChart / DataTable / Pictograph templates.
 *
 * 核心洞察: 数据题需要"看懂图". 把 chart 翻成"探险地图标记", 把分析翻成"探险家发现".
 * 不像 Geometry Lab 强调"仔细观察", Data Adventure 强调"找规律 + 标记重点".
 *
 * 设计 DNA (探险地图 / 野外考察主题):
 * - 老羊皮纸黄绿 + 卡其色 (跟 lab cyan / temple 蓝白 / battle 紫红 区别)
 * - 大羊皮纸卡 中央 — chart 画在卷轴上, 像探险笔记
 * - 罗盘 🧭 / 望远镜 🔭 / 地图 🗺️ / 帐篷 ⛺ 装饰
 * - Mascot 🐼 戴 🎩 探险帽 (用 🎩 emoji 头顶)
 * - 助手 = 🦜 Compass Parrot (鹦鹉给提示)
 * - 题目: 看 chart 找特征 (最高/最低/趋势)
 * - 4 选项 (chart 下方 chip)
 * - 答对 → 地图 X 标记 + Parrot 飞过 + 卷轴展开"发现!"
 * - 答错 → 罗盘旋转 + 鼓励 "再看看数据, 大胆探险"
 *
 * 入口: `/math/data-preview`
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

type DataCase = {
  id: string;
  scrollLabel: string;
  question: string;
  chart: "bar" | "line" | "pie";
  // BarChart: label + value 列表
  bars?: { label: string; value: number; color: string }[];
  // LineChart: 月份 (x) + 值 (y) 折线点
  linePoints?: { x: string; y: number }[];
  // PieChart: label + percent
  pieSlices?: { label: string; pct: number; color: string }[];
  options: string[];
  correctIdx: number;
};

const DEMO_CASES: DataCase[] = [
  {
    id: "d1",
    scrollLabel: "卷一 · 水果调查",
    question: "学校最多人喜欢哪种水果?",
    chart: "bar",
    bars: [
      { label: "苹果", value: 12, color: "#ef4444" },
      { label: "香蕉", value: 18, color: "#fbbf24" },
      { label: "葡萄", value: 9, color: "#a855f7" },
      { label: "草莓", value: 15, color: "#ec4899" },
    ],
    options: ["苹果", "香蕉", "葡萄", "草莓"],
    correctIdx: 1,
  },
  {
    id: "d2",
    scrollLabel: "卷二 · 气温变化",
    question: "哪个月气温最高?",
    chart: "line",
    linePoints: [
      { x: "3 月", y: 12 },
      { x: "4 月", y: 18 },
      { x: "5 月", y: 24 },
      { x: "6 月", y: 28 },
      { x: "7 月", y: 32 },
      { x: "8 月", y: 30 },
    ],
    options: ["5 月", "6 月", "7 月", "8 月"],
    correctIdx: 2,
  },
  {
    id: "d3",
    scrollLabel: "卷三 · 体育偏好",
    question: "饼图哪块占比最大?",
    chart: "pie",
    pieSlices: [
      { label: "篮球", pct: 35, color: "#f97316" },
      { label: "足球", pct: 30, color: "#22d3ee" },
      { label: "游泳", pct: 20, color: "#8b5cf6" },
      { label: "羽毛球", pct: 15, color: "#10b981" },
    ],
    options: ["篮球", "足球", "游泳", "羽毛球"],
    correctIdx: 0,
  },
];

const ENCOURAGE_PHRASES = [
  "再看看数据, 大胆探险",
  "鹦鹉提示: 比较高度看看?",
  "罗盘转了, 不急, 慢慢找",
  "数据不会骗人, 仔细看",
];

export function DataPreviewPage() {
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
      }, 1500);
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
        background: "radial-gradient(ellipse at top, #78350f 0%, #44230a 50%, #1a0e05 100%)",
      }}
    >
      {/* 探险 ambience: 角落 soft warm blob */}
      <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-amber-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-orange-700/15 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full bg-yellow-800/15 blur-[120px] pointer-events-none" />

      {/* 探险背景: 远山剪影 + 营地 + 星空 */}
      <svg className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice">
        {/* 远山 */}
        <path d="M 0 500 L 150 350 L 300 450 L 450 320 L 600 420 L 750 380 L 900 460 L 1000 400 L 1000 800 L 0 800 Z" fill="#3f1f08" stroke="#92400e" strokeWidth="0.5" />
        <path d="M 0 580 L 200 480 L 400 540 L 600 460 L 800 520 L 1000 480 L 1000 800 L 0 800 Z" fill="#1a0e05" opacity="0.7" />
        {/* 月亮 */}
        <circle cx="850" cy="120" r="32" fill="#fef3c7" opacity="0.9" />
        <circle cx="858" cy="115" r="22" fill="#78350f" opacity="0.4" />
        {/* 星星 */}
        {Array.from({ length: 30 }).map((_, i) => {
          const x = (i * 41) % 100;
          const y = ((i * 67) % 35) + 5;
          return <circle key={i} cx={`${x}%`} cy={`${y}%`} r={0.8} fill="#fef3c7" opacity={((i * 13) % 100) / 100 * 0.7 + 0.3} />;
        })}
        {/* 营火 (centered bottom) */}
        <g transform="translate(50, 700)">
          <path d="M 0 0 Q 5 -20 10 0 Q 15 -15 20 0 Z" fill="#f97316" opacity="0.8" />
          <ellipse cx="10" cy="5" rx="15" ry="4" fill="#ea580c" opacity="0.6" />
        </g>
        <g transform="translate(940, 700)">
          <path d="M 0 0 Q 5 -20 10 0 Q 15 -15 20 0 Z" fill="#f97316" opacity="0.8" />
          <ellipse cx="10" cy="5" rx="15" ry="4" fill="#ea580c" opacity="0.6" />
        </g>
      </svg>

      {/* 角落探险装饰 emoji */}
      <div className="absolute top-16 left-8 text-3xl opacity-40 select-none">🧭</div>
      <div className="absolute top-16 right-8 text-3xl opacity-40 select-none">🔭</div>
      <div className="absolute bottom-44 left-8 text-3xl opacity-40 select-none">🗺️</div>
      <div className="absolute bottom-44 right-8 text-3xl opacity-40 select-none">⛺</div>

      {/* ─── 顶部 HUD ─── */}
      <div className="absolute top-3 left-0 right-0 px-4 z-20 flex items-center justify-between">
        <Link to="/math" className="px-3 py-1.5 rounded-xl bg-amber-900/70 backdrop-blur-md border border-amber-400/40 text-xs font-bold text-amber-100">
          ← 离开营地
        </Link>
        <div className="px-4 py-1.5 rounded-xl bg-amber-900/70 backdrop-blur-md border border-amber-400/40 text-center">
          <div className="text-[10px] text-amber-300 uppercase tracking-widest">数据考察站</div>
          <div className="text-sm font-display font-bold text-amber-100">{cur.scrollLabel}</div>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-amber-900/70 backdrop-blur-md border border-amber-400/40 text-xs font-bold text-amber-100 tabular-nums">
          {caseIdx + 1} / {DEMO_CASES.length}
        </div>
      </div>

      {/* ─── 中央: 羊皮卷 + Chart ─── */}
      <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2">
        <div className="relative">
          {/* 羊皮卷背景 */}
          <svg viewBox="0 0 380 280" width="clamp(280px,42vmin,440px)" className="drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
            <defs>
              <linearGradient id="data-scroll" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#fef3c7" />
                <stop offset="50%" stopColor="#fde68a" />
                <stop offset="100%" stopColor="#fcd34d" />
              </linearGradient>
              <linearGradient id="data-scroll-correct" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#d9f99d" />
                <stop offset="100%" stopColor="#84cc16" />
              </linearGradient>
            </defs>

            {/* 卷轴 body */}
            <rect
              x="20"
              y="30"
              width="340"
              height="220"
              rx="8"
              fill={result === "correct" ? "url(#data-scroll-correct)" : "url(#data-scroll)"}
              stroke="#92400e"
              strokeWidth="2"
              className="transition-all duration-300"
              style={{ animation: result === "wrong" ? "data-shake 0.5s ease-in-out" : undefined }}
            />
            {/* 卷轴边缘装饰 */}
            <rect x="20" y="30" width="340" height="14" fill="#92400e" opacity="0.3" />
            <rect x="20" y="236" width="340" height="14" fill="#92400e" opacity="0.3" />
            {/* 卷轴左右 roll */}
            <rect x="14" y="22" width="14" height="236" rx="7" fill="#78350f" />
            <rect x="352" y="22" width="14" height="236" rx="7" fill="#78350f" />

            {/* === BarChart === */}
            {cur.chart === "bar" && cur.bars && (
              <g transform="translate(50, 70)">
                {/* y axis */}
                <line x1="20" y1="0" x2="20" y2="160" stroke="#78350f" strokeWidth="1.5" />
                {/* x axis */}
                <line x1="20" y1="160" x2="280" y2="160" stroke="#78350f" strokeWidth="1.5" />
                {/* bars */}
                {cur.bars.map((b, i) => {
                  const maxVal = Math.max(...cur.bars!.map((x) => x.value));
                  const h = (b.value / maxVal) * 140;
                  const barW = 50;
                  const x = 40 + i * 60;
                  return (
                    <g key={i}>
                      <rect
                        x={x}
                        y={160 - h}
                        width={barW}
                        height={h}
                        fill={b.color}
                        stroke="#78350f"
                        strokeWidth="1"
                        opacity="0.85"
                      />
                      <text x={x + barW / 2} y={156 - h} fontSize="12" fontWeight="bold" fill="#78350f" textAnchor="middle">
                        {b.value}
                      </text>
                      <text x={x + barW / 2} y={178} fontSize="11" fill="#78350f" textAnchor="middle">
                        {b.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}

            {/* === LineChart === */}
            {cur.chart === "line" && cur.linePoints && (
              <g transform="translate(50, 70)">
                <line x1="20" y1="0" x2="20" y2="160" stroke="#78350f" strokeWidth="1.5" />
                <line x1="20" y1="160" x2="280" y2="160" stroke="#78350f" strokeWidth="1.5" />
                {(() => {
                  const maxY = Math.max(...cur.linePoints!.map((p) => p.y));
                  const minY = Math.min(...cur.linePoints!.map((p) => p.y));
                  const range = maxY - minY || 1;
                  const points = cur.linePoints!.map((p, i) => {
                    const px = 40 + (i / (cur.linePoints!.length - 1)) * 240;
                    const py = 160 - ((p.y - minY) / range) * 140 - 10;
                    return { px, py, label: p.x, temp: p.y };
                  });
                  return (
                    <>
                      <polyline
                        points={points.map((p) => `${p.px},${p.py}`).join(" ")}
                        fill="none"
                        stroke="#dc2626"
                        strokeWidth="2.5"
                      />
                      {points.map((p, i) => (
                        <g key={i}>
                          <circle cx={p.px} cy={p.py} r="4" fill="#dc2626" stroke="#fef3c7" strokeWidth="1.5" />
                          <text x={p.px} y={p.py - 10} fontSize="10" fontWeight="bold" fill="#78350f" textAnchor="middle">
                            {p.temp}°
                          </text>
                          <text x={p.px} y={178} fontSize="10" fill="#78350f" textAnchor="middle">
                            {p.label.replace(/^\d+\s/, "")}
                          </text>
                        </g>
                      ))}
                    </>
                  );
                })()}
              </g>
            )}

            {/* === PieChart === */}
            {cur.chart === "pie" && cur.pieSlices && (
              <g transform="translate(190, 145)">
                {(() => {
                  let cumAngle = 0;
                  const r = 70;
                  return cur.pieSlices!.map((s, i) => {
                    const angle = (s.pct / 100) * 2 * Math.PI;
                    const x1 = Math.cos(cumAngle - Math.PI / 2) * r;
                    const y1 = Math.sin(cumAngle - Math.PI / 2) * r;
                    const x2 = Math.cos(cumAngle + angle - Math.PI / 2) * r;
                    const y2 = Math.sin(cumAngle + angle - Math.PI / 2) * r;
                    const large = angle > Math.PI ? 1 : 0;
                    const path = `M 0 0 L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
                    // label position
                    const midAngle = cumAngle + angle / 2 - Math.PI / 2;
                    const lx = Math.cos(midAngle) * (r * 0.65);
                    const ly = Math.sin(midAngle) * (r * 0.65);
                    cumAngle += angle;
                    return (
                      <g key={i}>
                        <path d={path} fill={s.color} stroke="#78350f" strokeWidth="1.5" opacity="0.9" />
                        <text x={lx} y={ly} fontSize="11" fontWeight="bold" fill="#fef3c7" textAnchor="middle">
                          {s.pct}%
                        </text>
                        <text x={lx} y={ly + 12} fontSize="9" fill="#fef3c7" textAnchor="middle">
                          {s.label}
                        </text>
                      </g>
                    );
                  });
                })()}
              </g>
            )}

            {/* 答对 X mark stamp */}
            {result === "correct" && (
              <g style={{ animation: "data-stamp 0.6s ease-out", transformOrigin: "190px 140px" }}>
                <text x="190" y="155" fontSize="80" fill="#dc2626" textAnchor="middle" opacity="0.85" fontWeight="bold">×</text>
                <text x="190" y="200" fontSize="14" fill="#78350f" textAnchor="middle" fontWeight="bold">发现!</text>
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* ─── 左下 Mascot 戴探险帽 ─── */}
      <div className="absolute left-4 bottom-44 sm:left-8 sm:bottom-48 flex flex-col items-center gap-1 pointer-events-none">
        <div className="relative">
          <div
            className="text-[80px] sm:text-[100px] leading-none"
            style={{
              animation: result === "correct" ? "data-celebrate 0.8s ease-in-out" : "data-float 3s ease-in-out infinite",
            }}
          >🐼</div>
          {/* 探险帽 */}
          <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 text-3xl">🎩</div>
        </div>
        {encouragePhrase && (
          <div className="px-3 py-1.5 rounded-2xl bg-amber-100/95 text-amber-900 text-xs font-bold shadow-lg max-w-[160px] text-center" style={{ animation: "data-pop 0.4s ease-out" }}>
            {encouragePhrase}
          </div>
        )}
      </div>

      {/* ─── 右上 Compass Parrot ─── */}
      <div className="absolute right-4 top-16 sm:right-8 sm:top-20 flex flex-col items-center pointer-events-none">
        <div
          className="text-[64px] sm:text-[80px] leading-none"
          style={{
            animation: result === "correct" ? "data-parrot-fly 0.8s ease-in-out" : "data-float-slow 4s ease-in-out infinite",
          }}
        >🦜</div>
        <div className="text-[10px] text-amber-300/70 mt-1">Compass Parrot</div>
      </div>

      {/* ─── 题目 + 选项 ─── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pb-[max(8px,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-[#1a0e05] via-[#1a0e05]/85 to-transparent">
        <div className="text-center mb-3 px-4">
          <div className="inline-block px-4 py-2 rounded-2xl bg-amber-900/85 backdrop-blur-md border border-amber-400/40 max-w-[92vw]">
            <span className="text-amber-100 text-sm sm:text-base font-display font-bold">
              🧭 {cur.question}
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
                  px-3 py-3 rounded-2xl border-2 font-display font-bold text-sm sm:text-base
                  transition-all
                  ${isCorrect ? "bg-lime-400 border-lime-200 text-lime-950 scale-105 shadow-lg shadow-lime-500/50" :
                    isWrong ? "bg-rose-500 border-rose-200 text-rose-950 animate-pulse" :
                    isOther ? "bg-amber-950/50 border-amber-800 text-amber-300/50 opacity-50" :
                    "bg-amber-900/60 backdrop-blur-md border-amber-400/50 text-amber-100 hover:scale-[1.02] active:scale-95 shadow-lg"}
                `}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 评审 footer ─── */}
      <div className="fixed bottom-1 left-2 text-[9px] text-amber-300/30 z-40 pointer-events-auto">
        Sprint 9 数据探险 prototype · <Link className="underline" to="/math">老首页</Link> · <Link className="underline" to="/math/lab-preview">lab</Link>
      </div>

      <style>{`
        @keyframes data-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes data-float-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes data-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        @keyframes data-celebrate { 0%, 100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-12px) rotate(8deg); } 75% { transform: translateY(-12px) rotate(-8deg); } }
        @keyframes data-parrot-fly { 0% { transform: translateX(0) translateY(0); } 50% { transform: translateX(-100px) translateY(-30px) scale(1.2); } 100% { transform: translateX(0) translateY(0); } }
        @keyframes data-stamp { 0% { transform: scale(0) rotate(-30deg); opacity: 0; } 60% { transform: scale(1.3) rotate(8deg); opacity: 1; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
        @keyframes data-pop { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}
