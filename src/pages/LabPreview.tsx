/**
 * v0.35.81 — Sprint 8: 几何实验室 (Geometry Lab) cluster prototype.
 *
 * Cluster 4/7. 覆盖 TriangleJudge / ShapeCourt / CubeViewer / DotGridDraw 4 个 template.
 *
 * 核心洞察: 几何题需要"看清楚图". Lab 主题让"图"变成"仪器全息投影", 鼓励仔细观察.
 * 不像方程神殿是等式 metaphor, 这里是把"图形分类"翻译成"科学家鉴定标本".
 *
 * 设计 DNA (实验室 / 科学馆主题):
 * - 深绿 + cyan gradient (实验室冷色调, 区别于温暖侦探/神殿/战场)
 * - **全息投影台** 中央 — 几何图形悬浮其上 (用 SVG 画 + cyan glow)
 * - 实验台 SVG (台面 + 4 角支柱 + 仪器装饰)
 * - 烧瓶 🧪 / 显微镜 🔬 / DNA 🧬 / 磁铁 🧲 装饰角落
 * - Mascot 🐼 戴 🥼 lab coat (用 🥽 护目镜 emoji 头顶)
 * - 助手 = 🤖 Lab Bot (非敌人, 是观察员)
 * - 题目: "这个图形是: 锐角三角形 / 直角三角形 / 钝角三角形 / 等边三角形"
 * - 4 选项 (实验台下方 chip)
 * - 答对 → 全息投影绿光 + Bot 鞠躬 + ✓ 印章
 * - 答错 → 投影闪红 + 提示 "再观察一次" (不羞辱)
 *
 * 入口: `/math/lab-preview`
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

type LabCase = {
  id: string;
  scrollLabel: string;
  question: string;
  shape: "triangle" | "quadrilateral" | "cube";
  // 三角形: 3 角 (顶点) 坐标
  trianglePoints?: [number, number][];
  triangleTypeHint?: string; // for visual clarity if needed
  // 四边形: 4 角坐标
  quadPoints?: [number, number][];
  // 立方体: 边长
  cubeSide?: number;
  options: string[];
  correctIdx: number;
};

const DEMO_CASES: LabCase[] = [
  {
    id: "l1",
    scrollLabel: "标本一 · 三角形鉴定",
    question: "这是哪种三角形?",
    shape: "triangle",
    // 锐角三角形 (各角 < 90°)
    trianglePoints: [[100, 30], [40, 140], [160, 140]],
    options: ["锐角三角形", "直角三角形", "钝角三角形", "等边三角形"],
    correctIdx: 0,
  },
  {
    id: "l2",
    scrollLabel: "标本二 · 四边形鉴定",
    question: "这是哪种四边形?",
    shape: "quadrilateral",
    // 平行四边形 (非矩形, 非菱形)
    quadPoints: [[40, 50], [150, 50], [180, 140], [70, 140]],
    options: ["矩形", "平行四边形", "梯形", "正方形"],
    correctIdx: 1,
  },
  {
    id: "l3",
    scrollLabel: "标本三 · 立方体体积",
    question: "棱长 3cm 的立方体体积是?",
    shape: "cube",
    cubeSide: 3,
    options: ["9 cm³", "12 cm³", "27 cm³", "81 cm³"],
    correctIdx: 2,
  },
];

const ENCOURAGE_PHRASES = [
  "再观察一次, 角度看仔细",
  "Bot 也想看你慢点儿",
  "标本不会跑, 拿放大镜看清",
  "几何要冷静, 不急",
];

export function LabPreviewPage() {
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
      }, 1400);
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
      className="fixed inset-0 z-50 overflow-hidden text-cyan-50"
      style={{
        height: "100dvh",
        background: "radial-gradient(ellipse at top, #064e3b 0%, #022c22 50%, #021015 100%)",
      }}
    >
      {/* 实验室 ambience: 角落 soft cyan blob */}
      <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-cyan-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-emerald-500/15 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full bg-teal-500/15 blur-[120px] pointer-events-none" />

      {/* 实验室背景: 仪器剪影 + 网格 */}
      <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice">
        {/* 网格地板 */}
        {Array.from({ length: 20 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={500 + i * 15} x2="1000" y2={500 + i * 15} stroke="#22d3ee" strokeWidth="0.5" />
        ))}
        {Array.from({ length: 30 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 33} y1="500" x2={i * 33 - 100} y2="800" stroke="#22d3ee" strokeWidth="0.5" />
        ))}
        {/* 实验柜剪影 */}
        <rect x="20" y="380" width="80" height="120" fill="#022c22" stroke="#22d3ee" strokeOpacity="0.4" />
        <rect x="900" y="380" width="80" height="120" fill="#022c22" stroke="#22d3ee" strokeOpacity="0.4" />
        {/* 烧瓶剪影 */}
        <path d="M 50 380 L 50 360 L 70 360 L 70 380 Z" fill="#22d3ee" fillOpacity="0.3" />
        <path d="M 920 380 L 920 350 L 950 350 L 950 380 Z" fill="#10b981" fillOpacity="0.3" />
      </svg>

      {/* 角落装饰 emoji */}
      <div className="absolute top-16 left-8 text-3xl opacity-30 select-none">🧪</div>
      <div className="absolute top-16 right-8 text-3xl opacity-30 select-none">🔬</div>
      <div className="absolute bottom-32 left-8 text-3xl opacity-30 select-none">🧲</div>
      <div className="absolute bottom-32 right-8 text-3xl opacity-30 select-none">🧬</div>

      {/* ─── 顶部 HUD ─── */}
      <div className="absolute top-3 left-0 right-0 px-4 z-20 flex items-center justify-between">
        <Link to="/math" className="px-3 py-1.5 rounded-xl bg-emerald-900/60 backdrop-blur-md border border-cyan-300/40 text-xs font-bold">
          ← 离开实验室
        </Link>
        <div className="px-4 py-1.5 rounded-xl bg-emerald-900/60 backdrop-blur-md border border-cyan-300/40 text-center">
          <div className="text-[10px] text-cyan-300 uppercase tracking-widest">几何鉴定室</div>
          <div className="text-sm font-display font-bold text-cyan-100">{cur.scrollLabel}</div>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-emerald-900/60 backdrop-blur-md border border-cyan-300/40 text-xs font-bold tabular-nums">
          {caseIdx + 1} / {DEMO_CASES.length}
        </div>
      </div>

      {/* ─── 中央: 全息投影台 + 几何标本 ─── */}
      <div className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2">
        {/* 实验台底座 SVG */}
        <svg viewBox="0 0 280 280" width="280" height="280" className="drop-shadow-[0_0_30px_rgba(34,211,238,0.4)]">
          <defs>
            {/* 投影台 glow */}
            <radialGradient id="lab-stage-glow" cx="50%" cy="60%" r="60%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.6" />
              <stop offset="50%" stopColor="#22d3ee" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="lab-shape-fill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#67e8f9" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
            <linearGradient id="lab-shape-correct" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#86efac" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
            <linearGradient id="lab-shape-wrong" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fca5a5" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>

          {/* 投影台光晕 */}
          <ellipse cx="140" cy="220" rx="120" ry="40" fill="url(#lab-stage-glow)" />

          {/* 投影台底盘 */}
          <ellipse cx="140" cy="240" rx="100" ry="14" fill="#022c22" stroke="#22d3ee" strokeWidth="2" />
          <ellipse cx="140" cy="232" rx="100" ry="14" fill="#064e3b" stroke="#22d3ee" strokeWidth="1.5" strokeOpacity="0.5" />

          {/* 4 角支柱 */}
          {[[50, 250], [230, 250], [80, 260], [200, 260]].map(([x, y], i) => (
            <rect key={i} x={x! - 3} y={y!} width={6} height={20} fill="#022c22" stroke="#22d3ee" strokeOpacity="0.4" />
          ))}

          {/* 标本 — 浮在投影台上方 */}
          <g
            className="transition-all duration-300"
            style={{
              transform: result === "wrong" ? "translate(0px, 0px) scale(0.95)" : "translate(0px, 0px) scale(1)",
              transformOrigin: "140px 120px",
              animation: result === "wrong" ? "lab-shake 0.5s ease-in-out" : undefined,
            }}
          >
            {cur.shape === "triangle" && cur.trianglePoints && (
              <>
                <polygon
                  points={cur.trianglePoints.map(([x, y]) => `${x + 40},${y + 30}`).join(" ")}
                  fill={result === "correct" ? "url(#lab-shape-correct)" : result === "wrong" ? "url(#lab-shape-wrong)" : "url(#lab-shape-fill)"}
                  stroke="#67e8f9"
                  strokeWidth="2.5"
                  opacity="0.85"
                />
                {/* 标 3 个顶点 */}
                {cur.trianglePoints.map(([x, y], i) => (
                  <g key={i}>
                    <circle cx={x + 40} cy={y + 30} r="3" fill="#fef3c7" />
                    <text x={x + 40 + 8} y={y + 30 + 4} fontSize="12" fill="#fef3c7">{String.fromCharCode(65 + i)}</text>
                  </g>
                ))}
              </>
            )}
            {cur.shape === "quadrilateral" && cur.quadPoints && (
              <>
                <polygon
                  points={cur.quadPoints.map(([x, y]) => `${x + 30},${y + 30}`).join(" ")}
                  fill={result === "correct" ? "url(#lab-shape-correct)" : result === "wrong" ? "url(#lab-shape-wrong)" : "url(#lab-shape-fill)"}
                  stroke="#67e8f9"
                  strokeWidth="2.5"
                  opacity="0.85"
                />
                {cur.quadPoints.map(([x, y], i) => (
                  <g key={i}>
                    <circle cx={x + 30} cy={y + 30} r="3" fill="#fef3c7" />
                    <text x={x + 30 + 8} y={y + 30 + 4} fontSize="12" fill="#fef3c7">{String.fromCharCode(65 + i)}</text>
                  </g>
                ))}
              </>
            )}
            {cur.shape === "cube" && cur.cubeSide && (
              <g transform="translate(85, 60)">
                {/* 立方体 3D 投影 */}
                <polygon
                  points="0,40 80,40 80,120 0,120"
                  fill={result === "correct" ? "url(#lab-shape-correct)" : result === "wrong" ? "url(#lab-shape-wrong)" : "url(#lab-shape-fill)"}
                  stroke="#67e8f9"
                  strokeWidth="2"
                  opacity="0.7"
                />
                <polygon
                  points="0,40 30,10 110,10 80,40"
                  fill="#0e7490"
                  stroke="#67e8f9"
                  strokeWidth="2"
                  opacity="0.85"
                />
                <polygon
                  points="80,40 110,10 110,90 80,120"
                  fill="#155e75"
                  stroke="#67e8f9"
                  strokeWidth="2"
                  opacity="0.9"
                />
                {/* 棱长标签 */}
                <text x="40" y="135" fontSize="14" fill="#fef3c7" textAnchor="middle" fontWeight="bold">{cur.cubeSide} cm</text>
              </g>
            )}

            {/* 答对时 ✓ 印章 */}
            {result === "correct" && (
              <g style={{ animation: "lab-stamp 0.6s ease-out" }}>
                <circle cx="140" cy="120" r="40" fill="#10b981" fillOpacity="0.3" />
                <text x="140" y="140" fontSize="60" fill="#fef3c7" textAnchor="middle">✓</text>
              </g>
            )}
          </g>
        </svg>
      </div>

      {/* ─── 左下 Mascot (戴 lab coat / 护目镜) ─── */}
      <div className="absolute left-4 bottom-44 sm:left-8 sm:bottom-48 flex flex-col items-center gap-1 pointer-events-none">
        <div className="relative">
          <div
            className="text-[80px] sm:text-[100px] leading-none"
            style={{
              animation: result === "correct" ? "lab-bow 0.8s ease-in-out" : "lab-float 3s ease-in-out infinite",
            }}
          >🐼</div>
          {/* 护目镜 */}
          <div className="absolute top-2 sm:top-4 left-1/2 -translate-x-1/2 text-2xl">🥽</div>
        </div>
        {/* 鼓励气泡 */}
        {encouragePhrase && (
          <div className="px-3 py-1.5 rounded-2xl bg-amber-200/95 text-emerald-900 text-xs font-bold shadow-lg max-w-[160px] text-center" style={{ animation: "lab-pop 0.4s ease-out" }}>
            {encouragePhrase}
          </div>
        )}
      </div>

      {/* ─── 右上 Lab Bot (观察员) ─── */}
      <div className="absolute right-4 top-16 sm:right-8 sm:top-20 flex flex-col items-center pointer-events-none">
        <div
          className="text-[64px] sm:text-[80px] leading-none"
          style={{
            animation: result === "correct" ? "lab-bot-celebrate 0.8s ease-in-out" : "lab-float-slow 4s ease-in-out infinite",
          }}
        >🤖</div>
        <div className="text-[10px] text-cyan-300/70 mt-1">Lab Bot</div>
      </div>

      {/* ─── 题目 + 选项 (下方) ─── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pb-[max(8px,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-[#021015] via-[#021015]/85 to-transparent">
        {/* 题目 */}
        <div className="text-center mb-3 px-4">
          <div className="inline-block px-4 py-2 rounded-2xl bg-emerald-900/80 backdrop-blur-md border border-cyan-300/40 max-w-[92vw]">
            <span className="text-cyan-200 text-sm sm:text-base font-display font-bold">
              🔬 {cur.question}
            </span>
          </div>
        </div>

        {/* 4 选项 chip */}
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
                  ${isCorrect ? "bg-emerald-400 border-emerald-200 text-emerald-950 scale-105 shadow-lg shadow-emerald-500/50" :
                    isWrong ? "bg-rose-500 border-rose-200 text-rose-950 animate-pulse" :
                    isOther ? "bg-slate-800/50 border-slate-600 text-slate-400 opacity-50" :
                    "bg-cyan-900/60 backdrop-blur-md border-cyan-300/50 text-cyan-100 hover:scale-[1.02] active:scale-95 shadow-lg"}
                `}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 评审 footer (左下角) ─── */}
      <div className="fixed bottom-1 left-2 text-[9px] text-cyan-300/30 z-40 pointer-events-auto">
        Sprint 8 几何实验室 prototype · <Link className="underline" to="/math">老首页</Link> · <Link className="underline" to="/math/temple-preview">temple</Link>
      </div>

      <style>{`
        @keyframes lab-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes lab-float-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes lab-shake { 0%, 100% { transform: translateX(0) scale(0.95); } 25% { transform: translateX(-6px) scale(0.95); } 75% { transform: translateX(6px) scale(0.95); } }
        @keyframes lab-bow { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-15deg); } }
        @keyframes lab-bot-celebrate { 0%, 100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-10px) rotate(10deg); } 75% { transform: translateY(-10px) rotate(-10deg); } }
        @keyframes lab-stamp { 0% { transform: scale(0) rotate(-30deg); opacity: 0; } 60% { transform: scale(1.2) rotate(5deg); opacity: 1; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
        @keyframes lab-pop { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}
