/**
 * v0.35.86 — Sprint 10a: 金钱时间游乐场 (Money & Time Carnival) cluster prototype.
 *
 * Cluster 6/7. 覆盖 MoneyCalculator / TimeReading / TimeArithmetic / UnitConversion.
 *
 * 核心洞察: 钱和时间是生活数学, 用复古游乐场 (carnival) 主题让 abstract 量化变 tangible.
 * 钱 = 售票亭找零, 时间 = 摩天轮班次, 单位换算 = 兑奖券.
 *
 * 设计 DNA (复古游乐场 / 80s arcade 主题, 跟 carnival/battle/detective/temple/lab/data 区别):
 * - 复古暖粉 + teal pastel + 黄灯泡 (retro 80s 配色)
 * - 摩天轮剪影 (SVG) + 帐篷尖顶 + 彩灯泡串
 * - 中央 大票亭 / 钟表 — 题目载体 (SVG composition)
 * - 角落 🎟️ / 🎪 / 🎡 / 🍿 emoji 装饰
 * - Mascot 🐼 戴 🎩 carnival barker 帽 (左下)
 * - 助手 = 🎪 Carnival Barker (友善小丑, 非 scary)
 * - 答对 → 彩灯闪 + 撒金币 + Barker 鞠躬 + "中奖!" tag
 * - 答错 → 钟表 shake + 灯暗 + 鼓励 "再算一遍, 不急" (不羞辱)
 *
 * 入口: `/math/carnival-preview`
 */
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

type CarnivalCase = {
  id: string;
  scrollLabel: string;
  question: string;
  scene: "money" | "clock" | "time-arith";
  // money: 商品价格 + 付钱
  moneyItems?: { emoji: string; name: string; price: number }[];
  moneyPaid?: number;
  // clock: 钟表时间
  clockHour?: number;
  clockMinute?: number;
  // time-arith: 起始 + 时长
  startHour?: number;
  startMinute?: number;
  addMinutes?: number;
  options: string[];
  correctIdx: number;
};

const DEMO_CASES: CarnivalCase[] = [
  {
    id: "c1",
    scrollLabel: "票亭一 · 售票找零",
    question: "买 1 张儿童票 + 1 张爆米花, 付 10 元, 找多少?",
    scene: "money",
    moneyItems: [
      { emoji: "🎟️", name: "儿童票", price: 3.5 },
      { emoji: "🍿", name: "爆米花", price: 2.8 },
    ],
    moneyPaid: 10,
    options: ["3.7 元", "3.3 元", "4.2 元", "3.5 元"],
    correctIdx: 0, // 10 - 3.5 - 2.8 = 3.7
  },
  {
    id: "c2",
    scrollLabel: "摩天轮二 · 看表班次",
    question: "时针在哪里, 现在几点几分?",
    scene: "clock",
    clockHour: 4,
    clockMinute: 15,
    options: ["4:15", "3:15", "4:45", "5:15"],
    correctIdx: 0,
  },
  {
    id: "c3",
    scrollLabel: "票亭三 · 班次时长",
    question: "9:30 出发, 坐了 50 分钟, 几点到?",
    scene: "time-arith",
    startHour: 9,
    startMinute: 30,
    addMinutes: 50,
    options: ["10:00", "10:20", "10:10", "9:80"],
    correctIdx: 1, // 9:30 + 50 = 10:20
  },
];

const ENCOURAGE_PHRASES = [
  "再算一遍, 不急",
  "Barker 等你, 慢慢来",
  "票亭 24 小时开门",
  "灯泡还亮着, 再试一次",
];

export function CarnivalPreviewPage() {
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
      className="fixed inset-0 z-50 overflow-hidden text-pink-50"
      style={{
        height: "100dvh",
        background: "radial-gradient(ellipse at top, #831843 0%, #4c0519 50%, #1f0210 100%)",
      }}
    >
      {/* 复古暖色 ambience */}
      <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-pink-500/25 blur-[120px] pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-amber-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full bg-rose-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[420px] h-[420px] rounded-full bg-teal-500/15 blur-[120px] pointer-events-none" />

      {/* 摩天轮 + 帐篷 SVG */}
      <svg className="absolute inset-0 w-full h-full opacity-30 pointer-events-none" viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice">
        {/* 远摩天轮 (left) */}
        <g transform="translate(120, 240)">
          <circle cx="0" cy="0" r="80" fill="none" stroke="#fcd34d" strokeWidth="1.5" opacity="0.7" />
          <circle cx="0" cy="0" r="4" fill="#fcd34d" />
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * 2 * Math.PI;
            const x = Math.cos(angle) * 80;
            const y = Math.sin(angle) * 80;
            return (
              <g key={i}>
                <line x1="0" y1="0" x2={x} y2={y} stroke="#fcd34d" strokeWidth="0.8" opacity="0.5" />
                <circle cx={x} cy={y} r="4" fill="#ec4899" opacity="0.8" />
              </g>
            );
          })}
          {/* 支柱 */}
          <line x1="0" y1="0" x2="-40" y2="120" stroke="#fcd34d" strokeWidth="2" opacity="0.6" />
          <line x1="0" y1="0" x2="40" y2="120" stroke="#fcd34d" strokeWidth="2" opacity="0.6" />
        </g>

        {/* 帐篷尖顶 (right) */}
        <g transform="translate(820, 260)">
          <polygon points="-80,80 0,-40 80,80" fill="#dc2626" opacity="0.5" stroke="#fef3c7" strokeWidth="1.5" />
          {/* 条纹 */}
          {[1, 3, 5].map((i) => (
            <polygon key={i} points={`${-80 + i * 20},80 ${i * 20 - 30},${-40 + i * 15} ${-50 + i * 20},80`} fill="#fef3c7" opacity="0.3" />
          ))}
          {/* 旗 */}
          <line x1="0" y1="-40" x2="0" y2="-60" stroke="#fef3c7" strokeWidth="1.5" />
          <polygon points="0,-60 12,-55 0,-50" fill="#fcd34d" opacity="0.8" />
        </g>

        {/* 灯泡彩灯串 (横跨 top) */}
        <path d="M 0 120 Q 250 80 500 120 Q 750 160 1000 120" stroke="#fef3c7" strokeWidth="1" fill="none" opacity="0.4" />
        {Array.from({ length: 15 }).map((_, i) => {
          const t = i / 14;
          const x = t * 1000;
          // approximate path y
          const y = 120 + Math.sin(t * Math.PI) * (-40 + (t > 0.5 ? 80 : 0));
          const colors = ["#fcd34d", "#ec4899", "#22d3ee", "#a3e635", "#f97316"];
          return <circle key={i} cx={x} cy={y} r="3" fill={colors[i % 5]!} opacity="0.7" className="animate-twinkle-slow" style={{ animationDelay: `${i * 0.15}s` } as React.CSSProperties} />;
        })}
      </svg>

      {/* 角落装饰 emoji */}
      <div className="absolute top-16 left-8 text-3xl opacity-50 select-none">🎟️</div>
      <div className="absolute top-16 right-8 text-3xl opacity-50 select-none">🎡</div>
      <div className="absolute bottom-44 left-8 text-3xl opacity-50 select-none">🎪</div>
      <div className="absolute bottom-44 right-8 text-3xl opacity-50 select-none">🍿</div>

      {/* ─── 顶部 HUD ─── */}
      <div className="absolute top-3 left-0 right-0 px-4 z-20 flex items-center justify-between">
        <Link to="/math" className="px-3 py-1.5 rounded-xl bg-pink-900/80 backdrop-blur-md border border-pink-300/40 text-xs font-bold text-pink-100">
          ← 离开游乐场
        </Link>
        <div className="px-4 py-1.5 rounded-xl bg-pink-900/80 backdrop-blur-md border border-amber-300/50 text-center">
          <div className="text-[10px] text-amber-300 uppercase tracking-widest">🎪 游乐场票亭</div>
          <div className="text-sm font-display font-bold text-pink-100">{cur.scrollLabel}</div>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-pink-900/80 backdrop-blur-md border border-pink-300/40 text-xs font-bold text-pink-100 tabular-nums">
          {caseIdx + 1} / {DEMO_CASES.length}
        </div>
      </div>

      {/* ─── 中央 scene SVG ─── */}
      <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2">
        <div className="relative">
          {cur.scene === "money" && cur.moneyItems && (
            <svg viewBox="0 0 360 280" width="clamp(280px,42vmin,420px)" className="drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
              <defs>
                <linearGradient id="carnival-booth" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#fef3c7" />
                  <stop offset="100%" stopColor="#fbbf24" />
                </linearGradient>
              </defs>
              {/* 票亭 */}
              <rect x="20" y="60" width="320" height="200" rx="6" fill="url(#carnival-booth)" stroke="#92400e" strokeWidth="2" className="transition-all duration-300" style={{ animation: result === "wrong" ? "carnival-shake 0.5s ease-in-out" : undefined }} />
              {/* 顶帆 */}
              <polygon points="20,60 340,60 320,30 40,30" fill="#dc2626" stroke="#92400e" strokeWidth="2" />
              {/* 红白条纹 */}
              {[60, 120, 180, 240, 300].map((x) => (
                <polygon key={x} points={`${x},60 ${x + 30},60 ${x + 20},30 ${x - 10},30`} fill="#fef3c7" />
              ))}
              {/* 商品行 */}
              {cur.moneyItems.map((item, i) => (
                <g key={i} transform={`translate(50, ${100 + i * 50})`}>
                  <text x="0" y="20" fontSize="32" textAnchor="start">{item.emoji}</text>
                  <text x="55" y="15" fontSize="14" fill="#78350f" fontWeight="bold">{item.name}</text>
                  <text x="220" y="20" fontSize="18" fill="#dc2626" fontWeight="bold" textAnchor="end">{item.price.toFixed(2)} 元</text>
                </g>
              ))}
              {/* 付款 */}
              <line x1="40" y1="210" x2="320" y2="210" stroke="#92400e" strokeWidth="1.5" strokeDasharray="4 3" />
              <text x="50" y="240" fontSize="14" fill="#78350f" fontWeight="bold">付:</text>
              <text x="100" y="240" fontSize="20" fill="#16a34a" fontWeight="bold">💴 {cur.moneyPaid} 元</text>
              <text x="220" y="240" fontSize="14" fill="#78350f">找零 = ?</text>

              {result === "correct" && (
                <g style={{ animation: "carnival-stamp 0.6s ease-out", transformOrigin: "180px 145px" }}>
                  <text x="180" y="155" fontSize="80" fill="#dc2626" textAnchor="middle" opacity="0.85" fontWeight="bold">★</text>
                  <text x="180" y="195" fontSize="16" fill="#16a34a" textAnchor="middle" fontWeight="bold">中奖!</text>
                </g>
              )}
            </svg>
          )}

          {cur.scene === "clock" && (
            <svg viewBox="0 0 280 280" width="clamp(260px,38vmin,360px)" className="drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
              <defs>
                <radialGradient id="carnival-clock-face" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fef3c7" />
                  <stop offset="80%" stopColor="#fde68a" />
                  <stop offset="100%" stopColor="#fbbf24" />
                </radialGradient>
              </defs>
              {/* 钟外圈 */}
              <circle cx="140" cy="140" r="110" fill="#dc2626" />
              <circle cx="140" cy="140" r="100" fill="url(#carnival-clock-face)" stroke="#92400e" strokeWidth="2" className="transition-all duration-300" style={{ animation: result === "wrong" ? "carnival-shake 0.5s ease-in-out" : undefined }} />

              {/* 12 个刻度 */}
              {Array.from({ length: 12 }).map((_, i) => {
                const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
                const x1 = 140 + Math.cos(angle) * 88;
                const y1 = 140 + Math.sin(angle) * 88;
                const x2 = 140 + Math.cos(angle) * 96;
                const y2 = 140 + Math.sin(angle) * 96;
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#78350f" strokeWidth={i % 3 === 0 ? "3" : "1.5"} />;
              })}

              {/* 数字 */}
              {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((num, i) => {
                const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
                const x = 140 + Math.cos(angle) * 75;
                const y = 140 + Math.sin(angle) * 75 + 6;
                return <text key={num} x={x} y={y} fontSize="18" fill="#78350f" fontWeight="bold" textAnchor="middle">{num}</text>;
              })}

              {/* 时针 (短粗) */}
              {(() => {
                const hourAngle = ((cur.clockHour ?? 0) % 12 + (cur.clockMinute ?? 0) / 60) / 12 * 2 * Math.PI - Math.PI / 2;
                const hx = 140 + Math.cos(hourAngle) * 50;
                const hy = 140 + Math.sin(hourAngle) * 50;
                return <line x1="140" y1="140" x2={hx} y2={hy} stroke="#1e293b" strokeWidth="6" strokeLinecap="round" />;
              })()}

              {/* 分针 (长细) */}
              {(() => {
                const minAngle = (cur.clockMinute ?? 0) / 60 * 2 * Math.PI - Math.PI / 2;
                const mx = 140 + Math.cos(minAngle) * 75;
                const my = 140 + Math.sin(minAngle) * 75;
                return <line x1="140" y1="140" x2={mx} y2={my} stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />;
              })()}

              {/* 中心点 */}
              <circle cx="140" cy="140" r="6" fill="#1e293b" />
              <circle cx="140" cy="140" r="3" fill="#fef3c7" />

              {result === "correct" && (
                <g style={{ animation: "carnival-stamp 0.6s ease-out", transformOrigin: "140px 140px" }}>
                  <text x="140" y="150" fontSize="60" fill="#16a34a" textAnchor="middle" fontWeight="bold" opacity="0.85">✓</text>
                </g>
              )}
            </svg>
          )}

          {cur.scene === "time-arith" && (
            <svg viewBox="0 0 360 240" width="clamp(280px,42vmin,420px)" className="drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
              <rect x="20" y="30" width="320" height="180" rx="6" fill="#fef3c7" stroke="#92400e" strokeWidth="2" className="transition-all duration-300" style={{ animation: result === "wrong" ? "carnival-shake 0.5s ease-in-out" : undefined }} />
              {/* 顶部条 */}
              <rect x="20" y="30" width="320" height="32" fill="#dc2626" />
              <text x="180" y="52" fontSize="16" fill="#fef3c7" textAnchor="middle" fontWeight="bold">🎢 班次时间表</text>

              {/* 起始时间 */}
              <text x="50" y="100" fontSize="14" fill="#78350f">出发:</text>
              <text x="50" y="135" fontSize="40" fill="#1e293b" fontWeight="bold" fontFamily="monospace">
                {String(cur.startHour ?? 0).padStart(2, "0")}:{String(cur.startMinute ?? 0).padStart(2, "0")}
              </text>

              {/* + 时长 */}
              <text x="180" y="115" fontSize="28" fill="#dc2626" textAnchor="middle" fontWeight="bold">+</text>
              <text x="180" y="145" fontSize="16" fill="#78350f" textAnchor="middle">{cur.addMinutes} 分钟</text>

              {/* 到达 ? */}
              <text x="260" y="100" fontSize="14" fill="#78350f">到达:</text>
              <text x="260" y="135" fontSize="40" fill="#16a34a" fontWeight="bold" fontFamily="monospace">?:??</text>

              {/* 小图标 */}
              <text x="180" y="190" fontSize="32" textAnchor="middle">🎡</text>

              {result === "correct" && (
                <g style={{ animation: "carnival-stamp 0.6s ease-out", transformOrigin: "260px 130px" }}>
                  <text x="260" y="135" fontSize="36" fill="#16a34a" textAnchor="middle" fontWeight="bold" fontFamily="monospace">
                    {String((cur.startHour ?? 0) + Math.floor(((cur.startMinute ?? 0) + (cur.addMinutes ?? 0)) / 60)).padStart(2, "0")}:{String(((cur.startMinute ?? 0) + (cur.addMinutes ?? 0)) % 60).padStart(2, "0")}
                  </text>
                </g>
              )}
            </svg>
          )}
        </div>
      </div>

      {/* ─── 左下 Mascot 戴 carnival 帽 ─── */}
      <div className="absolute left-4 bottom-44 sm:left-8 sm:bottom-48 flex flex-col items-center gap-1 pointer-events-none">
        <div className="relative">
          <div
            className="text-[80px] sm:text-[100px] leading-none"
            style={{
              animation: result === "correct" ? "carnival-celebrate 0.8s ease-in-out" : "carnival-float 3s ease-in-out infinite",
            }}
          >🐼</div>
          {/* carnival barker 帽 */}
          <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 text-3xl">🎩</div>
        </div>
        {encouragePhrase && (
          <div className="px-3 py-1.5 rounded-2xl bg-pink-100/95 text-pink-900 text-xs font-bold shadow-lg max-w-[160px] text-center" style={{ animation: "carnival-pop 0.4s ease-out" }}>
            {encouragePhrase}
          </div>
        )}
      </div>

      {/* ─── 右上 Carnival Barker ─── */}
      <div className="absolute right-4 top-16 sm:right-8 sm:top-20 flex flex-col items-center pointer-events-none">
        <div
          className="text-[64px] sm:text-[80px] leading-none"
          style={{
            animation: result === "correct" ? "carnival-barker-flip 0.8s ease-in-out" : "carnival-float-slow 4s ease-in-out infinite",
          }}
        >🎪</div>
        <div className="text-[10px] text-amber-300/70 mt-1">Barker</div>
      </div>

      {/* ─── 题目 + 选项 ─── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pb-[max(8px,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-[#1f0210] via-[#1f0210]/85 to-transparent">
        <div className="text-center mb-3 px-4">
          <div className="inline-block px-4 py-2 rounded-2xl bg-pink-900/85 backdrop-blur-md border border-amber-300/50 max-w-[92vw]">
            <span className="text-pink-100 text-sm sm:text-base font-display font-bold">
              🎟️ {cur.question}
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
                  ${isCorrect ? "bg-amber-300 border-amber-200 text-amber-950 scale-105 shadow-lg shadow-amber-500/50" :
                    isWrong ? "bg-rose-500 border-rose-200 text-rose-950 animate-pulse" :
                    isOther ? "bg-pink-950/50 border-pink-800 text-pink-300/50 opacity-50" :
                    "bg-pink-900/60 backdrop-blur-md border-amber-300/50 text-pink-100 hover:scale-[1.02] active:scale-95 shadow-lg"}
                `}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* footer */}
      <div className="fixed bottom-1 left-2 text-[9px] text-pink-300/30 z-40 pointer-events-auto">
        Sprint 10a 金钱时间游乐场 · <Link className="underline" to="/math">老首页</Link> · <Link className="underline" to="/math/data-preview">data</Link>
      </div>

      <style>{`
        @keyframes carnival-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        @keyframes carnival-float-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
        @keyframes carnival-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        @keyframes carnival-celebrate { 0%, 100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-12px) rotate(8deg); } 75% { transform: translateY(-12px) rotate(-8deg); } }
        @keyframes carnival-barker-flip { 0% { transform: rotate(0deg); } 50% { transform: rotate(360deg) scale(1.3); } 100% { transform: rotate(720deg); } }
        @keyframes carnival-stamp { 0% { transform: scale(0) rotate(-30deg); opacity: 0; } 60% { transform: scale(1.3) rotate(8deg); opacity: 1; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
        @keyframes carnival-pop { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
        @keyframes twinkle-slow { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        .animate-twinkle-slow { animation: twinkle-slow 2.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
