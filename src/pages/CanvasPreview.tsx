/**
 * v0.35.87 — Sprint 10b: 符文绘制 (Rune Drawing Canvas) cluster prototype.
 *
 * Cluster 7/7 (final). 覆盖 HandDrawRune / TraceShape / DotConnect / DigitWrite templates.
 *
 * 核心洞察: 手写/手绘是低龄数学题最自然的输入方式 (写数字 / 描形状 / 连点).
 * Canvas 真手绘 → 不只是选择题, 是 hands-on. 提升认知 engagement.
 *
 * 设计 DNA (魔法符文学院 / 古卷主题, 跟 carnival 暖粉 / lab cyan / temple 蓝 / data 黄 / detective 暗紫 / battle 紫红 都区别):
 * - 深紫 + 古金 + 暗墨绿 (occult / 神秘)
 * - **古卷展开** 中央 — 用户在卷上画符文
 * - 浮空星象图 + 蜡烛 + 古书装饰
 * - Mascot 🐼 戴 🧙 巫师帽 (左下)
 * - 助手 = 🦉 wise owl (顶部, 不动给提示)
 * - 答对 → 符文金光闪 + 古书页翻 + Owl 鞠躬 "符文激活!"
 * - 答错 → 卷轴 shake + 提示 "再画一遍, 笔画要连"
 *
 * 3 案例:
 * - 卷一: 描三角形符文 (TraceShape) — 显示半透明引导线, 用户描. 判定: bounding box 接近 + 点数 > 阈
 * - 卷二: 连点画矩形 (DotConnect) — 4 角点, 按 1→2→3→4→1 顺序点
 * - 卷三: 手写数字 "5" (DigitWrite) — 自由画, 简单判定 stroke 长度 + 在 canvas 中心
 *
 * 入口: `/math/canvas-preview`
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";

type CanvasCase = {
  id: string;
  scrollLabel: string;
  question: string;
  hint: string;
  kind: "trace-triangle" | "connect-dots" | "free-digit";
};

const DEMO_CASES: CanvasCase[] = [
  {
    id: "r1",
    scrollLabel: "卷一 · 三角符文",
    question: "用手指沿着虚线描出三角符文",
    hint: "从顶点开始, 一笔画到底",
    kind: "trace-triangle",
  },
  {
    id: "r2",
    scrollLabel: "卷二 · 四星连线",
    question: "按顺序连接 4 颗星, 画成矩形",
    hint: "1 → 2 → 3 → 4 → 回到 1",
    kind: "connect-dots",
  },
  {
    id: "r3",
    scrollLabel: "卷三 · 自由符文 '5'",
    question: "在卷上写一个数字 5",
    hint: "笔画连贯, 占据中央",
    kind: "free-digit",
  },
];

const ENCOURAGE_PHRASES = [
  "再画一遍, 笔画要连",
  "Owl 等你, 慢慢描",
  "符文有耐心, 不急",
  "墨水还很多, 试试看",
];

// Canvas size (内部 px, 用 CSS 缩放)
const CANVAS_W = 360;
const CANVAS_H = 280;

export function CanvasPreviewPage() {
  const [caseIdx, setCaseIdx] = useState(0);
  const [result, setResult] = useState<"idle" | "correct" | "wrong">("idle");
  const [encouragePhrase, setEncouragePhrase] = useState<string | null>(null);
  const [dotsHit, setDotsHit] = useState<number[]>([]); // for connect-dots

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const path = useRef<{ x: number; y: number }[]>([]);

  const cur = DEMO_CASES[caseIdx]!;

  // 重置 canvas + 题目
  const resetCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    drawGuide(ctx, cur.kind);
    path.current = [];
    setDotsHit([]);
  }, [cur.kind]);

  useEffect(() => {
    resetCanvas();
  }, [caseIdx, resetCanvas]);

  // 题目切换后 1.5s 自动 reset
  useEffect(() => {
    if (result === "correct") {
      const t = setTimeout(() => {
        setCaseIdx((i) => (i + 1) % DEMO_CASES.length);
        setResult("idle");
        setEncouragePhrase(null);
      }, 1800);
      return () => clearTimeout(t);
    }
  }, [result]);

  // 画引导线 (虚线 + 星点)
  function drawGuide(ctx: CanvasRenderingContext2D, kind: CanvasCase["kind"]) {
    ctx.save();
    if (kind === "trace-triangle") {
      // 三角形虚线
      ctx.strokeStyle = "rgba(252,211,77,0.4)";
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(180, 50);
      ctx.lineTo(70, 230);
      ctx.lineTo(290, 230);
      ctx.closePath();
      ctx.stroke();
      // 顶点圆
      ctx.fillStyle = "rgba(252,211,77,0.6)";
      ctx.setLineDash([]);
      [[180, 50], [70, 230], [290, 230]].forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x!, y!, 5, 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (kind === "connect-dots") {
      // 4 个 star 点 (1 上左, 2 上右, 3 下右, 4 下左)
      const dots = [[80, 70], [280, 70], [280, 210], [80, 210]];
      ctx.fillStyle = "rgba(252,211,77,0.9)";
      dots.forEach(([x, y], i) => {
        ctx.beginPath();
        ctx.arc(x!, y!, 10, 0, Math.PI * 2);
        ctx.fill();
        // label 数字
        ctx.fillStyle = "#1e1b4b";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${i + 1}`, x!, y! + 1);
        ctx.fillStyle = "rgba(252,211,77,0.9)";
      });
    } else if (kind === "free-digit") {
      // 大引导 "5"
      ctx.strokeStyle = "rgba(252,211,77,0.3)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      // 数字 5 的轮廓 (大致)
      ctx.moveTo(220, 70);
      ctx.lineTo(140, 70);
      ctx.lineTo(140, 130);
      ctx.quadraticCurveTo(220, 130, 220, 175);
      ctx.quadraticCurveTo(220, 220, 160, 220);
      ctx.lineTo(140, 220);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 用户绘画
  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (result === "correct") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    drawing.current = true;
    path.current = [{ x, y }];

    // connect-dots: 检测点击的是哪个 dot
    if (cur.kind === "connect-dots") {
      const dots = [[80, 70], [280, 70], [280, 210], [80, 210]];
      dots.forEach(([dx, dy], i) => {
        const dist = Math.hypot(x - dx!, y - dy!);
        if (dist < 20 && !dotsHit.includes(i)) {
          setDotsHit((prev) => {
            const next = [...prev, i];
            // 当点完 4 个连成矩形 (顺序 0→1→2→3 或 anyclockwise) 判对
            if (next.length === 4) {
              const correctOrder = [0, 1, 2, 3];
              const reverseOrder = [0, 3, 2, 1];
              if (JSON.stringify(next) === JSON.stringify(correctOrder) ||
                  JSON.stringify(next) === JSON.stringify(reverseOrder)) {
                setResult("correct");
              }
            }
            return next;
          });
        }
      });
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || result === "correct") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H;

    const last = path.current[path.current.length - 1]!;
    path.current.push({ x, y });

    // draw stroke
    ctx.save();
    ctx.strokeStyle = "#fcd34d";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.shadowColor = "#fbbf24";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();

    // connect-dots: draw line during move triggers when crossing dots
    if (cur.kind === "connect-dots") {
      const dots = [[80, 70], [280, 70], [280, 210], [80, 210]];
      dots.forEach(([dx, dy], i) => {
        const dist = Math.hypot(x - dx!, y - dy!);
        if (dist < 20 && !dotsHit.includes(i)) {
          setDotsHit((prev) => {
            if (prev.includes(i)) return prev;
            const next = [...prev, i];
            if (next.length === 4) {
              const okOrder = JSON.stringify(next) === JSON.stringify([0, 1, 2, 3]);
              const okRev = JSON.stringify(next) === JSON.stringify([0, 3, 2, 1]);
              if (okOrder || okRev) setResult("correct");
            }
            return next;
          });
        }
      });
    }
  }

  function handlePointerUp() {
    drawing.current = false;
  }

  // 判定按钮
  function judge() {
    if (result === "correct") return;
    const pts = path.current;
    let pass = false;

    if (cur.kind === "trace-triangle") {
      // 简单判定: 总路径长度 > 300px + 至少经过 3 个顶点附近
      const dist = pathLength(pts);
      const vertices: [number, number][] = [[180, 50], [70, 230], [290, 230]];
      const hitVertices = vertices.filter(([vx, vy]) =>
        pts.some((p) => Math.hypot(p.x - vx, p.y - vy) < 35),
      ).length;
      pass = dist > 300 && hitVertices >= 3;
    } else if (cur.kind === "free-digit") {
      // 简单判定: 路径长度 > 200 + 在 canvas 中心 60% 区域有大部分点
      const dist = pathLength(pts);
      const centerHits = pts.filter((p) => p.x > 60 && p.x < CANVAS_W - 60 && p.y > 40 && p.y < CANVAS_H - 40).length;
      pass = dist > 200 && centerHits / Math.max(1, pts.length) > 0.7;
    } else if (cur.kind === "connect-dots") {
      // 已经在 pointer 里处理过, 这里只检测全连
      pass = dotsHit.length === 4;
    }

    if (pass) {
      setResult("correct");
      setEncouragePhrase(null);
    } else {
      setResult("wrong");
      setEncouragePhrase(ENCOURAGE_PHRASES[Math.floor(Math.random() * ENCOURAGE_PHRASES.length)] ?? null);
      setTimeout(() => {
        setResult("idle");
        resetCanvas();
      }, 1000);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden text-amber-50"
      style={{
        height: "100dvh",
        background: "radial-gradient(ellipse at top, #2e1065 0%, #1e1b4b 50%, #050315 100%)",
      }}
    >
      {/* 神秘 ambience */}
      <div className="absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full bg-violet-700/30 blur-[120px] pointer-events-none" />
      <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-amber-700/20 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-[420px] h-[420px] rounded-full bg-emerald-800/15 blur-[120px] pointer-events-none" />

      {/* 星象图 + 蜡烛 */}
      <svg className="absolute inset-0 w-full h-full opacity-25 pointer-events-none" viewBox="0 0 1000 800" preserveAspectRatio="xMidYMid slice">
        {/* 星象圆 (顶部中央) */}
        <g transform="translate(500, 150)">
          <circle cx="0" cy="0" r="100" fill="none" stroke="#fcd34d" strokeWidth="1" />
          <circle cx="0" cy="0" r="60" fill="none" stroke="#fcd34d" strokeWidth="0.5" />
          {/* 12 宫位刻度 */}
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * 2 * Math.PI;
            return <line key={i} x1={Math.cos(a) * 60} y1={Math.sin(a) * 60} x2={Math.cos(a) * 100} y2={Math.sin(a) * 100} stroke="#fcd34d" strokeWidth="0.8" />;
          })}
          {/* 内五角星 */}
          <polygon
            points={Array.from({ length: 5 }).map((_, i) => {
              const a = (i / 5) * 2 * Math.PI - Math.PI / 2;
              return `${Math.cos(a) * 50},${Math.sin(a) * 50}`;
            }).map((_, i) => {
              const a = ((i * 2) / 5) * 2 * Math.PI - Math.PI / 2;
              return `${Math.cos(a) * 50},${Math.sin(a) * 50}`;
            }).join(" ")}
            fill="none"
            stroke="#fcd34d"
            strokeWidth="0.8"
            opacity="0.8"
          />
        </g>
        {/* 蜡烛 (left + right bottom) */}
        <g transform="translate(80, 660)">
          <rect x="-4" y="0" width="8" height="40" fill="#a16207" />
          <path d="M 0 0 Q -3 -12 0 -16 Q 3 -12 0 0 Z" fill="#fcd34d" opacity="0.9" />
          <ellipse cx="0" cy="-5" rx="5" ry="2" fill="#fef3c7" opacity="0.5" />
        </g>
        <g transform="translate(920, 660)">
          <rect x="-4" y="0" width="8" height="40" fill="#a16207" />
          <path d="M 0 0 Q -3 -12 0 -16 Q 3 -12 0 0 Z" fill="#fcd34d" opacity="0.9" />
          <ellipse cx="0" cy="-5" rx="5" ry="2" fill="#fef3c7" opacity="0.5" />
        </g>
        {/* 星点 (背景) */}
        {Array.from({ length: 30 }).map((_, i) => {
          const x = (i * 41) % 100;
          const y = ((i * 67) % 90);
          return <circle key={i} cx={`${x}%`} cy={`${y}%`} r={0.8} fill="#fef3c7" opacity={((i * 13) % 100) / 100 * 0.6 + 0.2} />;
        })}
      </svg>

      {/* 角落装饰 */}
      <div className="absolute top-16 left-8 text-3xl opacity-40 select-none">📖</div>
      <div className="absolute top-16 right-8 text-3xl opacity-40 select-none">🔮</div>
      <div className="absolute bottom-44 left-8 text-3xl opacity-40 select-none">🕯️</div>
      <div className="absolute bottom-44 right-8 text-3xl opacity-40 select-none">✨</div>

      {/* ─── 顶部 HUD ─── */}
      <div className="absolute top-3 left-0 right-0 px-4 z-20 flex items-center justify-between">
        <Link to="/math" className="px-3 py-1.5 rounded-xl bg-violet-900/80 backdrop-blur-md border border-amber-400/40 text-xs font-bold text-amber-100">
          ← 离开学院
        </Link>
        <div className="px-4 py-1.5 rounded-xl bg-violet-900/80 backdrop-blur-md border border-amber-400/40 text-center">
          <div className="text-[10px] text-amber-300 uppercase tracking-widest">🧙 符文学院</div>
          <div className="text-sm font-display font-bold text-amber-100">{cur.scrollLabel}</div>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-violet-900/80 backdrop-blur-md border border-amber-400/40 text-xs font-bold text-amber-100 tabular-nums">
          {caseIdx + 1} / {DEMO_CASES.length}
        </div>
      </div>

      {/* ─── 中央 古卷 + Canvas ─── */}
      <div className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="relative">
          {/* 卷轴 frame */}
          <div
            className={`p-3 rounded-2xl shadow-[0_0_30px_rgba(252,211,77,0.4)] border-4 border-amber-700 transition-all duration-300 ${result === "wrong" ? "animate-canvas-shake" : ""} ${result === "correct" ? "border-amber-300 bg-gradient-to-br from-amber-100 to-amber-200" : "bg-gradient-to-br from-amber-50 to-amber-100"}`}
            style={{ animation: result === "wrong" ? "canvas-shake 0.5s ease-in-out" : undefined }}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="block touch-none rounded-lg"
              style={{ width: "min(82vw, 400px)", aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
            {result === "correct" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-7xl font-bold text-amber-600 drop-shadow-[0_0_12px_rgba(252,211,77,0.8)]" style={{ animation: "canvas-stamp 0.6s ease-out" }}>
                  ✦ 激活 ✦
                </div>
              </div>
            )}
          </div>
          {/* 卷轴左右 roll */}
          <div className="absolute -left-3 top-2 bottom-2 w-3 rounded-l-full bg-gradient-to-b from-amber-900 via-amber-800 to-amber-900 shadow-lg" />
          <div className="absolute -right-3 top-2 bottom-2 w-3 rounded-r-full bg-gradient-to-b from-amber-900 via-amber-800 to-amber-900 shadow-lg" />
        </div>

        {/* 按钮组 */}
        <div className="mt-3 flex justify-center gap-2">
          <button
            onClick={resetCanvas}
            disabled={result === "correct"}
            className="px-4 py-2 rounded-xl bg-violet-900/80 backdrop-blur-md border border-violet-300/40 text-amber-100 text-sm font-bold hover:scale-[1.02] active:scale-95 transition disabled:opacity-50"
          >
            ↺ 重画
          </button>
          {cur.kind !== "connect-dots" && (
            <button
              onClick={judge}
              disabled={result === "correct"}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-amber-950 text-sm font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition disabled:opacity-50"
            >
              ✦ 激活符文
            </button>
          )}
        </div>
      </div>

      {/* ─── 左下 Mascot 戴 巫师帽 ─── */}
      <div className="absolute left-4 bottom-32 sm:left-8 sm:bottom-36 flex flex-col items-center gap-1 pointer-events-none z-10">
        <div className="relative">
          <div
            className="text-[72px] sm:text-[88px] leading-none"
            style={{
              animation: result === "correct" ? "canvas-cast 0.8s ease-in-out" : "canvas-float 3s ease-in-out infinite",
            }}
          >🐼</div>
          <div className="absolute -top-3 sm:-top-4 left-1/2 -translate-x-1/2 text-3xl">🧙</div>
        </div>
        {encouragePhrase && (
          <div className="px-3 py-1.5 rounded-2xl bg-amber-100/95 text-violet-900 text-xs font-bold shadow-lg max-w-[160px] text-center" style={{ animation: "canvas-pop 0.4s ease-out" }}>
            {encouragePhrase}
          </div>
        )}
      </div>

      {/* ─── 右上 Owl ─── */}
      <div className="absolute right-4 top-16 sm:right-8 sm:top-20 flex flex-col items-center pointer-events-none z-10">
        <div
          className="text-[58px] sm:text-[72px] leading-none"
          style={{
            animation: result === "correct" ? "canvas-owl-bow 0.8s ease-in-out" : "canvas-float-slow 4s ease-in-out infinite",
          }}
        >🦉</div>
        <div className="text-[10px] text-amber-300/70 mt-1">Wise Owl</div>
      </div>

      {/* ─── 题目 + 提示 ─── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pb-[max(8px,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-[#050315] via-[#050315]/85 to-transparent">
        <div className="text-center px-4">
          <div className="inline-block px-4 py-2 rounded-2xl bg-violet-900/85 backdrop-blur-md border border-amber-300/50 max-w-[92vw]">
            <div className="text-amber-100 text-sm sm:text-base font-display font-bold">
              ✦ {cur.question}
            </div>
            <div className="text-amber-200/70 text-[10px] sm:text-xs mt-0.5">{cur.hint}</div>
          </div>
        </div>
      </div>

      {/* footer */}
      <div className="fixed bottom-1 left-2 text-[9px] text-amber-300/30 z-40 pointer-events-auto">
        Sprint 10b 符文绘制 (Canvas) prototype · <Link className="underline" to="/math">老</Link> · <Link className="underline" to="/math/carnival-preview">carnival</Link>
      </div>

      <style>{`
        @keyframes canvas-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes canvas-float-slow { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
        @keyframes canvas-shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        @keyframes canvas-cast { 0%, 100% { transform: translateY(0) rotate(0deg); } 25% { transform: translateY(-10px) rotate(-12deg); } 75% { transform: translateY(-10px) rotate(12deg); } }
        @keyframes canvas-owl-bow { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(-20deg) translateY(-5px); } }
        @keyframes canvas-stamp { 0% { transform: scale(0) rotate(-20deg); opacity: 0; } 60% { transform: scale(1.3) rotate(8deg); opacity: 1; } 100% { transform: scale(1) rotate(0deg); opacity: 1; } }
        @keyframes canvas-pop { 0% { transform: scale(0.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
      `}</style>
    </div>
  );
}

function pathLength(pts: { x: number; y: number }[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    d += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return d;
}
