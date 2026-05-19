/**
 * v0.36.8 (爸爸 P0): MiniDrawingPad — 替代 ScratchPanel 里的 textarea.
 *
 * 起源 (爸爸原话):
 *   "所有的草稿都不能出现输入框textarea都情况了"
 *
 * 之前: requiresScratch heuristic 触发但题没 route 到 canvas_scratch 模板时,
 * 走 ScratchPanel.textarea, 又是输入框, Selena 不能列竖式.
 *
 * 现在: 任何"开草稿"的 UI 都用 canvas (像 chinese HandwriteCanvas).
 * 这个组件抽 CanvasScratch.tsx 的 stroke 逻辑 (pen + eraser + undo + clear)
 * 成 reusable widget, 不含 vision judge / answer input — 那俩属于 canvas_scratch
 * 模板专属.
 *
 * 跟 CanvasScratch 一致的实现要点:
 *   - 抄 HandwriteCanvas plain function 模式: setStrokes functional update +
 *     useEffect [strokes] 触发 redraw. 不 useCallback 不 ref-sync.
 *   - eraser 删整条 stroke (radius 18)
 *   - pointerDown 检 mouse button === 0 (hover 不画)
 */
import { useRef, useState, useEffect } from "react";

interface Point {
  x: number;
  y: number;
}
type Stroke = Point[];
type Tool = "pen" | "eraser";

const CANVAS_W = 640;
const CANVAS_H = 200; // 比 CanvasScratch 的 320 矮 (mini)
const ERASER_RADIUS = 18;

interface Props {
  disabled?: boolean;
  /** 笔画总数变化时回调 (用于 insurance 判断: ≥2 笔 = 有意义的草稿) */
  onStrokeCountChange?: (count: number) => void;
  /** 初始笔画 (复用 mount 时, 题切换会 reset) */
  resetKey?: string | number;
}

export function MiniDrawingPad({ disabled, onStrokeCountChange, resetKey }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<Stroke>([]);
  const [tool, setTool] = useState<Tool>("pen");

  // Reset on resetKey change (题切换)
  useEffect(() => {
    setStrokes([]);
    currentStrokeRef.current = [];
  }, [resetKey]);

  // 通知 parent
  useEffect(() => {
    onStrokeCountChange?.(strokes.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes.length]);

  // redraw — plain function, 抄 HandwriteCanvas 模式
  function redraw() {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
    for (const stroke of strokes) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0]!.x, stroke[0]!.y);
      for (let i = 1; i < stroke.length; i++) {
        const p = stroke[i]!;
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    if (currentStrokeRef.current.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(currentStrokeRef.current[0]!.x, currentStrokeRef.current[0]!.y);
      for (let i = 1; i < currentStrokeRef.current.length; i++) {
        const p = currentStrokeRef.current[i]!;
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
  }

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const cv = canvasRef.current;
    if (!cv) return { x: 0, y: 0 };
    const rect = cv.getBoundingClientRect();
    const sx = cv.width / rect.width;
    const sy = cv.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  function eraseAt(pt: Point) {
    setStrokes((all) =>
      all.filter((stroke) => {
        for (let i = 0; i < stroke.length; i++) {
          const p = stroke[i]!;
          const dx = p.x - pt.x;
          const dy = p.y - pt.y;
          if (dx * dx + dy * dy <= ERASER_RADIUS * ERASER_RADIUS) {
            return false;
          }
        }
        return true;
      }),
    );
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (!e.isPrimary) return;
    e.preventDefault();
    const pt = getPoint(e);
    if (tool === "eraser") {
      drawingRef.current = true;
      eraseAt(pt);
    } else {
      drawingRef.current = true;
      currentStrokeRef.current = [pt];
    }
    canvasRef.current?.setPointerCapture(e.pointerId);
    redraw();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled) return;
    if (e.pointerType === "mouse" && e.buttons === 0) {
      drawingRef.current = false;
      currentStrokeRef.current = [];
      return;
    }
    e.preventDefault();
    const pt = getPoint(e);
    if (tool === "eraser") {
      eraseAt(pt);
    } else {
      currentStrokeRef.current.push(pt);
      redraw();
    }
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    e.preventDefault();
    drawingRef.current = false;
    if (tool === "pen" && currentStrokeRef.current.length >= 2) {
      const stroke = currentStrokeRef.current;
      currentStrokeRef.current = [];
      setStrokes((s) => [...s, stroke]);
    } else {
      currentStrokeRef.current = [];
      redraw();
    }
    canvasRef.current?.releasePointerCapture(e.pointerId);
  }

  function clearAll() {
    if (disabled) return;
    setStrokes([]);
    currentStrokeRef.current = [];
  }

  function undoLast() {
    if (disabled) return;
    setStrokes((s) => s.slice(0, -1));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setTool("pen")}
          disabled={disabled}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
            tool === "pen"
              ? "bg-amber-500 text-white"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          } disabled:opacity-40`}
        >
          ✍️ 笔
        </button>
        <button
          type="button"
          onClick={() => setTool("eraser")}
          disabled={disabled}
          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
            tool === "eraser"
              ? "bg-pink-500 text-white"
              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
          } disabled:opacity-40`}
        >
          🧽 擦
        </button>
        <span className="text-[10px] text-emerald-200/60">{strokes.length} 笔</span>
        <div className="flex-1"></div>
        <button
          type="button"
          onClick={undoLast}
          disabled={disabled}
          className="px-2.5 py-1 rounded-lg bg-ink-700/40 text-slate-200 text-xs font-semibold hover:bg-ink-700/60 disabled:opacity-40 transition-colors"
          title="撤回最后一笔"
        >
          ↶ 撤回
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={disabled}
          className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-400/30 text-rose-200 text-xs font-semibold hover:bg-rose-500/30 disabled:opacity-40 transition-colors"
          title="清空所有"
        >
          🗑 清空
        </button>
      </div>

      <div
        className="relative mx-auto rounded-lg border-2 border-emerald-400/40 bg-white overflow-hidden touch-none select-none"
        style={{ width: "100%", maxWidth: CANVAS_W, aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
      >
        {/* 浅色横线 (像作业本) */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
          preserveAspectRatio="none"
        >
          {[0.25, 0.5, 0.75].map((r) => (
            <line
              key={r}
              x1="0"
              y1={CANVAS_H * r}
              x2={CANVAS_W}
              y2={CANVAS_H * r}
              stroke="#cbd5e1"
              strokeWidth="1"
              strokeDasharray="6 6"
              opacity="0.6"
            />
          ))}
        </svg>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`block w-full h-full touch-none ${tool === "eraser" ? "cursor-cell" : "cursor-crosshair"}`}
          style={{ touchAction: "none" }}
        />
      </div>
    </div>
  );
}
