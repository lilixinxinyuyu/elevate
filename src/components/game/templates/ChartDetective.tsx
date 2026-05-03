import { useMemo, useRef, useState, useEffect } from "react";
import type { TemplateRenderProps } from "../GameShell";
import type { Question } from "../../../core/types";

/**
 * 数据侦探：屏幕上画一组柱形图，加一条横线（"平均线"）。
 * 用 ↑/↓ 按钮上下移动横线，目标是把它停在正确的平均数位置。
 *
 * tags 配置:
 *   bars:120,128,124,132,126   // 柱形图数据
 *   step:1                     // 每次按钮移动多少（默认 1）
 *
 * answer.value 是真实平均数。允许 ±step/2 容差。
 */
export function ChartDetectivePanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const cfg = useMemo(() => parseConfig(question), [question.question_id]);
  const [lineVal, setLineVal] = useState(cfg.startVal);
  const [locked, setLocked] = useState(false);
  const lastDragRef = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const tol = Math.max(cfg.step / 2, 0.0001);
  const correct = cfg.target;

  const bump = (delta: number) => {
    if (disabled || locked) return;
    setLineVal((v) => clampVal(round(v + delta * cfg.step, cfg.step), cfg.yMin, cfg.yMax));
  };

  const submit = (ev: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || locked) return;
    setLocked(true);
    const ok = Math.abs(lineVal - correct) <= tol;
    const rect = ev.currentTarget.getBoundingClientRect();
    if (ok) triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "✓");
    else triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
    onFinish({
      answer: lineVal,
      isCorrect: ok,
      partialCorrect: !ok && Math.abs(lineVal - correct) <= cfg.step,
      matchedErrorTags: ok ? [] : ["average_formula_error"],
    });
  };

  // 拖拽支持（鼠标 / 触控）
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const onMove = (clientY: number) => {
      if (locked || disabled) return;
      const rect = svg.getBoundingClientRect();
      const localY = (clientY - rect.top) * (cfg.svgH / rect.height);
      const v = yToVal(localY, cfg);
      setLineVal(clampVal(round(v, cfg.step), cfg.yMin, cfg.yMax));
    };
    const onMouseMove = (e: MouseEvent) => {
      if (lastDragRef.current == null) return;
      onMove(e.clientY);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) onMove(e.touches[0].clientY);
    };
    const onUp = () => {
      lastDragRef.current = null;
    };
    svg.addEventListener("mouseleave", onUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onUp);
    return () => {
      svg.removeEventListener("mouseleave", onUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [cfg, locked, disabled]);

  return (
    <div>
      <div className="font-display font-bold text-xl mb-2 text-slate-100 whitespace-pre-wrap">
        {question.stem}
      </div>
      <div className="text-xs text-slate-400 mb-2">用 ↑/↓ 或拖动黄色虚线，停在你估的平均数位置：</div>

      <div className="rounded-2xl bg-white/5 border border-white/10 p-3 mb-3 relative">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${cfg.svgW} ${cfg.svgH}`}
          className="w-full max-w-[520px] mx-auto block touch-none"
          onMouseDown={(e) => {
            if (locked || disabled) return;
            lastDragRef.current = e.clientY;
          }}
        >
          {/* y 轴刻度 */}
          {cfg.gridTicks.map((tick) => {
            const y = valToY(tick, cfg);
            return (
              <g key={tick}>
                <line x1={36} x2={cfg.svgW - 12} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                <text x={32} y={y + 4} fill="#94a3b8" fontSize="11" textAnchor="end">
                  {tick}
                </text>
              </g>
            );
          })}

          {/* 柱形 */}
          {cfg.bars.map((v, i) => {
            const top = valToY(v, cfg);
            const bottom = valToY(cfg.yMin, cfg);
            const x = 50 + i * cfg.barSlot;
            const w = cfg.barWidth;
            return (
              <g key={i}>
                <rect x={x} y={top} width={w} height={Math.max(2, bottom - top)} rx={6}
                  fill="url(#barGrad)" />
                <text x={x + w / 2} y={top - 6} fill="#e0e7ff" fontSize="11" textAnchor="middle">
                  {v}
                </text>
              </g>
            );
          })}

          {/* 平均线 */}
          <g>
            <line
              x1={36}
              x2={cfg.svgW - 12}
              y1={valToY(lineVal, cfg)}
              y2={valToY(lineVal, cfg)}
              stroke="#fbbf24"
              strokeWidth={3}
              strokeDasharray="6,4"
            />
            <circle
              cx={cfg.svgW - 24}
              cy={valToY(lineVal, cfg)}
              r={9}
              fill="#fbbf24"
              stroke="#fff8e1"
              strokeWidth={2}
              style={{ cursor: locked || disabled ? "default" : "ns-resize", filter: "drop-shadow(0 0 6px rgba(251,191,36,0.7))" }}
              onMouseDown={(e) => {
                if (locked || disabled) return;
                e.preventDefault();
                lastDragRef.current = e.clientY;
              }}
              onTouchStart={(e) => {
                if (locked || disabled) return;
                if (e.touches[0]) lastDragRef.current = e.touches[0].clientY;
              }}
            />
            <text
              x={cfg.svgW - 40}
              y={valToY(lineVal, cfg) - 10}
              fill="#fbbf24"
              fontSize="13"
              fontWeight="700"
              textAnchor="end"
            >
              我估 {prettyNumber(lineVal)}
            </text>
          </g>

          <defs>
            <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#a78bfa" />
              <stop offset="1" stopColor="#6d28d9" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="flex items-center justify-center gap-3 mb-3">
        <button
          type="button"
          disabled={disabled || locked || lineVal <= cfg.yMin}
          onClick={() => bump(-1)}
          className="bubble py-2 px-5 text-xl"
        >
          ↓ −{cfg.step}
        </button>
        <div className="font-display font-bold text-3xl text-amber-300 min-w-[5rem] text-center"
          style={{ textShadow: "0 0 12px rgba(251,191,36,0.5)" }}
        >
          {prettyNumber(lineVal)}
        </div>
        <button
          type="button"
          disabled={disabled || locked || lineVal >= cfg.yMax}
          onClick={() => bump(1)}
          className="bubble py-2 px-5 text-xl"
        >
          ↑ +{cfg.step}
        </button>
      </div>

      <div className="flex justify-end">
        <button type="button" className="btn-primary" disabled={disabled || locked} onClick={submit}>
          确定
        </button>
      </div>
    </div>
  );
}

interface Cfg {
  bars: number[];
  yMin: number;
  yMax: number;
  step: number;
  startVal: number;
  target: number;
  svgW: number;
  svgH: number;
  barSlot: number;
  barWidth: number;
  padTop: number;
  padBottom: number;
  gridTicks: number[];
}

function parseConfig(q: Question): Cfg {
  let bars: number[] = [];
  let step = 1;
  for (const t of q.tags ?? []) {
    if (t.startsWith("bars:")) {
      bars = t.slice(5).split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
    } else if (t.startsWith("step:")) {
      const n = Number(t.slice(5));
      if (Number.isFinite(n) && n > 0) step = n;
    }
  }
  if (bars.length === 0) bars = [10, 20, 30, 40];
  const max = Math.max(...bars);
  const min = Math.min(...bars);
  const range = max - min;
  const margin = Math.max(range * 0.25, step * 3);
  const yMin = Math.max(0, Math.floor((min - margin) / step) * step);
  const yMax = Math.ceil((max + margin) / step) * step;
  const target = q.answer.type === "number" ? q.answer.value : (max + min) / 2;
  // 起点偏离目标
  const startVal = clampVal(round((yMin + yMax) / 2, step), yMin, yMax);
  // 6 个 grid tick
  const tickStep = step * Math.max(1, Math.round((yMax - yMin) / step / 6));
  const gridTicks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += tickStep) gridTicks.push(round(v, step));

  const svgW = 480;
  const svgH = 240;
  const padTop = 28;
  const padBottom = 24;
  const usable = svgW - 70; // 留 y 轴
  const slot = usable / bars.length;
  const barWidth = Math.max(20, slot * 0.6);

  return {
    bars,
    yMin,
    yMax,
    step,
    startVal,
    target,
    svgW,
    svgH,
    barSlot: slot,
    barWidth,
    padTop,
    padBottom,
    gridTicks,
  };
}

function valToY(v: number, cfg: Cfg): number {
  const usableH = cfg.svgH - cfg.padTop - cfg.padBottom;
  const ratio = (v - cfg.yMin) / (cfg.yMax - cfg.yMin);
  return cfg.padTop + (1 - ratio) * usableH;
}

function yToVal(y: number, cfg: Cfg): number {
  const usableH = cfg.svgH - cfg.padTop - cfg.padBottom;
  const ratio = 1 - (y - cfg.padTop) / usableH;
  return cfg.yMin + ratio * (cfg.yMax - cfg.yMin);
}

function clampVal(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function round(v: number, step: number): number {
  return Math.round(v / step) * step;
}

function prettyNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 1000) / 1000);
}
