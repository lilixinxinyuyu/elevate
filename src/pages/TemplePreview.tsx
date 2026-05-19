/**
 * v0.35.78 — Sprint 7: 方程神殿 (Equation Temple) cluster prototype.
 *
 * 覆盖 EquationBuilder + BalanceLab 2 个 template.
 *
 * 核心洞察: 天平 (balance) 是方程的强 metaphor. 左 pan = 右 pan 就是等式. 视觉化让
 * 抽象代数变具体, 不是装饰.
 *
 * 设计 DNA (古希腊神殿主题):
 * - 大理石柱 (4 根 SVG, Doric style) + 三角顶饰
 * - 蓝白金配色 (古希腊配色)
 * - **天平 SVG 中央** — 两盘子可视化等式两边
 * - Mascot 🐼 戴月桂冠 (Athena 风) — 用 🌿 emoji 在头顶
 * - 怪兽 = 🦉 Chaos Owl (智慧/谜题神兽, 非攻击性)
 * - 题目: "5x + 3 = 23" 类, 找 x
 * - 4 数字选项 (天平下方)
 * - 答对 → 天平摆平 (动画从倾斜→水平) + 神殿柱发光 + Owl 鞠躬
 * - 答错 → 天平歪 + 提示 "还没平衡"
 *
 * 入口: `/math/temple-preview`
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

type EquationCase = {
  id: string;
  scrollLabel: string;
  leftExpr: string;
  rightValue: number;
  unknown: string;
  options: number[];
  correctIdx: number;
};

const DEMO_CASES: EquationCase[] = [
  {
    id: "e1",
    scrollLabel: "卷一 · 简单等式",
    leftExpr: "5x + 3",
    rightValue: 23,
    unknown: "x",
    options: [4, 5, 6, 3],
    correctIdx: 0, // (23-3)/5 = 4
  },
  {
    id: "e2",
    scrollLabel: "卷二 · 减法平衡",
    leftExpr: "30 − y",
    rightValue: 18,
    unknown: "y",
    options: [12, 13, 11, 22],
    correctIdx: 0, // 30-12=18
  },
  {
    id: "e3",
    scrollLabel: "卷三 · 倍数迷题",
    leftExpr: "4n − 2",
    rightValue: 14,
    unknown: "n",
    options: [3, 4, 5, 6],
    correctIdx: 1, // (14+2)/4 = 4
  },
];

const HINT_PHRASES = [
  "天平还没平 ⚖️",
  "代入算一下两边相等吗?",
  "Owl 摇头, 再想想",
  "差一点点, 离平衡很近",
];

export function TemplePreviewPage() {
  const [caseIdx, setCaseIdx] = useState(0);
  const [solved, setSolved] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [won, setWon] = useState(false);

  const c = DEMO_CASES[caseIdx]!;

  useEffect(() => {
    setSelected(null);
    setResult(null);
    setHint(null);
  }, [caseIdx]);

  // 天平 tilt 角度 (correct=0 平衡, wrong=-8 倾斜, idle 看 selected 是否近)
  const tilt = result === "correct" ? 0 : result === "wrong" ? -8 : selected !== null ? 4 : 0;

  function handleOption(val: number, idx: number) {
    if (result === "correct" || won) return;
    setSelected(val);
    if (idx === c.correctIdx) {
      setResult("correct");
      setHint(null);
      setTimeout(() => {
        const ns = solved + 1;
        setSolved(ns);
        if (ns >= DEMO_CASES.length) {
          setWon(true);
        } else {
          setCaseIdx((i) => Math.min(DEMO_CASES.length - 1, i + 1));
        }
      }, 2000);
    } else {
      setResult("wrong");
      setHint(HINT_PHRASES[Math.floor(Math.random() * HINT_PHRASES.length)] ?? "再想想");
      setTimeout(() => {
        setResult(null);
        setSelected(null);
      }, 1500);
    }
  }

  function handleReset() {
    setCaseIdx(0);
    setSolved(0);
    setWon(false);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-hidden text-amber-50" style={{ height: "100dvh", background: "linear-gradient(180deg, #1e3a8a 0%, #2563eb 40%, #3730a3 100%)" }}>

      {/* 神殿场景 SVG */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-60" preserveAspectRatio="none" viewBox="0 0 600 800">
        {/* 天空云 */}
        {[...Array(20)].map((_, i) => (
          <circle key={i} cx={(i * 73) % 600} cy={(i * 37) % 200} r={(i % 3) + 1} fill="white" opacity="0.5" />
        ))}
        {/* 三角顶饰 (神殿屋顶) */}
        <polygon points="60,150 540,150 300,30" fill="#fef3c7" opacity="0.6" stroke="#facc15" strokeWidth="2" />
        <polygon points="100,150 500,150 300,80" fill="#fde68a" opacity="0.7" />
        <text x="300" y="125" textAnchor="middle" fill="#1e3a8a" fontSize="18" fontWeight="bold">ΣΟΦΙΑ</text>
        {/* 屋檐 */}
        <rect x="50" y="150" width="500" height="14" fill="#e7e5e4" />
        {/* 4 根 Doric 柱 */}
        {[100, 220, 380, 500].map((x, i) => (
          <g key={`col-${i}`}>
            {/* 柱头 */}
            <rect x={x - 22} y="164" width="44" height="10" fill="#f5f5f4" />
            <rect x={x - 28} y="174" width="56" height="6" fill="#e7e5e4" />
            {/* 柱身 */}
            <rect x={x - 14} y="180" width="28" height="400" fill="#f5f5f4" opacity="0.9" />
            {/* 柱身凹槽 */}
            {[-9, -3, 3, 9].map((dx, j) => (
              <rect key={j} x={x + dx - 0.5} y="180" width="1" height="400" fill="#d6d3d1" opacity="0.5" />
            ))}
            {/* 柱底 */}
            <rect x={x - 18} y="580" width="36" height="8" fill="#e7e5e4" />
            <rect x={x - 24} y="588" width="48" height="6" fill="#d6d3d1" />
          </g>
        ))}
        {/* 地面台阶 */}
        <rect x="20" y="594" width="560" height="8" fill="#d6d3d1" />
        <rect x="0" y="602" width="600" height="6" fill="#a8a29e" />
        <rect x="0" y="608" width="600" height="200" fill="#78716c" opacity="0.7" />
      </svg>

      <div className="relative h-full max-w-3xl mx-auto px-4 py-3 flex flex-col">

        {/* 顶 HUD */}
        <div className="flex items-center gap-3 mb-2 shrink-0">
          <div className="flex-1 bg-blue-900/60 border-2 border-amber-300/40 rounded-2xl px-4 py-2 backdrop-blur">
            <div className="text-[10px] text-amber-200/80 uppercase tracking-widest">⚖️ 神殿任务</div>
            <div className="font-display font-bold text-amber-100 text-sm">{c.scrollLabel}</div>
          </div>
          <div className="bg-blue-900/60 border-2 border-amber-300/40 rounded-2xl px-3 py-2 flex items-center gap-1.5">
            <span className="text-xl">📜</span>
            <span className="font-display font-black text-2xl tabular-nums">{solved}<span className="text-sm opacity-60"> / {DEMO_CASES.length}</span></span>
          </div>
        </div>

        {/* 神殿场景 + Mascot + Owl */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 relative">

          {/* 顶部 Chaos Owl (右) */}
          {!won && (
            <div className="absolute top-2 right-12">
              <div className={`text-[clamp(40px,7vh,80px)] leading-none ${result === "correct" ? "animate-bow" : "animate-float-slow"}`}>🦉</div>
              {result === "correct" && (
                <div className="absolute -bottom-2 -left-10 text-[10px] text-amber-200 whitespace-nowrap font-bold animate-fade-in">智慧!</div>
              )}
            </div>
          )}

          {/* Mascot 🐼 + 月桂冠 (左) */}
          <div className="absolute bottom-32 left-4">
            <div className="relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl">🌿</div>
              <div className={`text-[clamp(60px,11vh,120px)] leading-none ${result === "correct" ? "animate-bounce" : result === "wrong" ? "animate-pulse" : "animate-float"}`}>🐼</div>
            </div>
            {hint && (
              <div className="absolute -top-10 left-full ml-2 bg-amber-50 text-blue-900 px-3 py-1.5 rounded-2xl rounded-bl-none shadow-lg text-xs font-bold whitespace-nowrap animate-fade-in">
                {hint}
              </div>
            )}
          </div>

          {/* 天平 (中央) */}
          <div className="relative my-2">
            <svg width="380" height="220" viewBox="0 0 380 220" className="drop-shadow-2xl">
              {/* 底座 */}
              <rect x="160" y="190" width="60" height="20" rx="4" fill="#facc15" stroke="#92400e" strokeWidth="2" />
              <rect x="170" y="200" width="40" height="6" fill="#92400e" />
              {/* 立柱 */}
              <rect x="186" y="60" width="8" height="135" fill="#facc15" stroke="#92400e" strokeWidth="1.5" />
              {/* 中心结 */}
              <circle cx="190" cy="60" r="10" fill="#facc15" stroke="#92400e" strokeWidth="2" />
              <circle cx="190" cy="60" r="3" fill="#92400e" />
              {/* 横梁 (tilt 角度) */}
              <g transform={`rotate(${tilt} 190 60)`} style={{ transition: "transform 0.5s ease-out" }}>
                <rect x="40" y="56" width="300" height="8" rx="2" fill="#facc15" stroke="#92400e" strokeWidth="2" />
                {/* 左盘绳 */}
                <line x1="60" y1="60" x2="60" y2="100" stroke="#78716c" strokeWidth="2" />
                <line x1="80" y1="60" x2="60" y2="100" stroke="#78716c" strokeWidth="1.5" />
                {/* 左盘 */}
                <ellipse cx="60" cy="115" rx="55" ry="12" fill="#e7e5e4" stroke="#92400e" strokeWidth="2" />
                <ellipse cx="60" cy="110" rx="55" ry="10" fill="#f5f5f4" />
                <text x="60" y="116" textAnchor="middle" fill="#1e3a8a" fontSize="22" fontWeight="bold" fontFamily="Georgia">
                  {c.leftExpr}
                </text>
                {/* 右盘绳 */}
                <line x1="320" y1="60" x2="320" y2="100" stroke="#78716c" strokeWidth="2" />
                <line x1="300" y1="60" x2="320" y2="100" stroke="#78716c" strokeWidth="1.5" />
                {/* 右盘 */}
                <ellipse cx="320" cy="115" rx="55" ry="12" fill="#e7e5e4" stroke="#92400e" strokeWidth="2" />
                <ellipse cx="320" cy="110" rx="55" ry="10" fill="#f5f5f4" />
                <text x="320" y="118" textAnchor="middle" fill="#1e3a8a" fontSize="26" fontWeight="bold" fontFamily="Georgia">
                  {c.rightValue}
                </text>
              </g>
            </svg>
            <div className="text-center font-display font-bold text-amber-200 text-lg mt-1">
              {c.unknown} = ?
            </div>
          </div>

          {/* 选项 (4 数字) 或 胜利 */}
          {!won ? (
            <div className="grid grid-cols-4 gap-2 w-full max-w-md pb-2">
              {c.options.map((val, i) => {
                const isSel = selected === val;
                const isCorrect = isSel && result === "correct";
                const isWrong = isSel && result === "wrong";
                return (
                  <button
                    key={i}
                    onClick={() => handleOption(val, i)}
                    disabled={result === "correct"}
                    className={`aspect-square rounded-2xl font-display font-black text-3xl shadow-xl border-4 transition-all hover:scale-105 active:scale-95 tabular-nums
                      ${isCorrect ? "bg-emerald-500 border-emerald-200 text-white animate-bounce" :
                        isWrong ? "bg-rose-500 border-rose-300 text-white animate-shake" :
                        "bg-gradient-to-br from-amber-200 to-amber-400 border-amber-100 text-blue-900"
                      }`}
                  >
                    {val}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center pb-2 animate-fade-in">
              <div className="text-6xl mb-3">🏛️</div>
              <div className="font-display font-black text-2xl text-amber-100 mb-1">神殿任务完成!</div>
              <div className="text-amber-200/80 text-sm mb-4">Owl 鞠躬, 神殿柱齐亮 · {DEMO_CASES.length} 卷已解</div>
              <div className="flex gap-3 justify-center">
                <button onClick={handleReset} className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-300 to-orange-500 text-slate-900 font-display font-black text-base shadow-xl">
                  ▶ 再战神殿
                </button>
                <Link to="/math/hub-v4" className="px-6 py-3 rounded-2xl bg-blue-900 border-2 border-blue-600 text-slate-100 font-display font-bold text-base">
                  ← 回 Hub
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="text-center text-[10px] text-amber-300/40 pt-2 shrink-0">
          🏛️ 方程神殿 (Equation Temple) — Sprint 7 prototype ·{" "}
          <Link className="underline" to="/math/battle-preview">⚔️ 数字</Link> ·{" "}
          <Link className="underline" to="/math/detective-preview">🔍 侦探</Link> ·{" "}
          <Link className="underline" to="/math/hub-v4">Hub</Link>
        </div>
      </div>

      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes float-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-6px); } 75% { transform: translateX(6px); } }
        @keyframes bow { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(20deg) translateY(8px); } }
        @keyframes fade-in { 0% { opacity: 0; transform: translateY(8px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-float { animation: float 3s ease-in-out infinite; }
        .animate-float-slow { animation: float-slow 4s ease-in-out infinite; }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        .animate-bow { animation: bow 1.2s ease-in-out; }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
      `}</style>
    </div>
  );
}
