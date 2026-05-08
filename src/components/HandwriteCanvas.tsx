/**
 * HandwriteCanvas — 汉字手写画板（v0.31.42）
 *
 * 修 v0.31.41 的大 bug：之前用 input 框 + IME 拼音直接打字 = 没真在写。
 * 改成 canvas 手画 → POST /api/tutor/judge-handwriting → qwen-vl 视觉判定。
 *
 * 特性：
 *   - touch + mouse + pen 都支持
 *   - 笔画数组（每笔独立），支持"撤回上一笔"
 *   - 顶层透明 grid 辅助线（米字格）
 *   - 平滑笔触（quadratic curve）
 *   - 提交按钮 + 清空按钮
 *
 * Props:
 *   width / height: 画布尺寸 px
 *   onSubmit(blob, base64): 用户点提交时调；blob 用于显示，base64 给 API
 *   onClear: 清空回调（可选）
 */

import { useEffect, useRef, useState } from "react";

interface Point {
  x: number;
  y: number;
}
type Stroke = Point[];

export interface HandwriteCanvasProps {
  width: number;
  height: number;
  /** 用户提交时 - 返回 base64 (无 data: 前缀) */
  onSubmit: (base64: string) => void;
  disabled?: boolean;
  showGuide?: boolean;
}

export function HandwriteCanvas({
  width,
  height,
  onSubmit,
  disabled = false,
  showGuide = true,
}: HandwriteCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<Stroke>([]);

  // 画一遍所有笔画（清屏 + 重画）
  function redraw() {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    // 黑色笔
    ctx.lineWidth = Math.max(4, Math.round(width / 60));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0a0a0a";
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
    // 当前正在画的笔画
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
  }, [strokes, width, height]);

  // 把白色背景填上（PNG 透明对 LLM 不友好），返回 base64 PNG
  function exportBase64(): string {
    const cv = canvasRef.current;
    if (!cv) return "";
    // 复制到一个新 canvas 加白底
    const tmp = document.createElement("canvas");
    tmp.width = cv.width;
    tmp.height = cv.height;
    const tctx = tmp.getContext("2d");
    if (!tctx) return "";
    tctx.fillStyle = "#ffffff";
    tctx.fillRect(0, 0, tmp.width, tmp.height);
    tctx.drawImage(cv, 0, 0);
    const data = tmp.toDataURL("image/png");
    return data.replace(/^data:image\/[a-z]+;base64,/, "");
  }

  function getCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const cv = canvasRef.current;
    if (!cv) return { x: 0, y: 0 };
    const rect = cv.getBoundingClientRect();
    const scaleX = cv.width / rect.width;
    const scaleY = cv.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.preventDefault();
    drawingRef.current = true;
    currentStrokeRef.current = [getCanvasPoint(e)];
    canvasRef.current?.setPointerCapture(e.pointerId);
    redraw();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled) return;
    e.preventDefault();
    currentStrokeRef.current.push(getCanvasPoint(e));
    redraw();
  }

  function onPointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    e.preventDefault();
    drawingRef.current = false;
    if (currentStrokeRef.current.length >= 2) {
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
    setStrokes([]);
    currentStrokeRef.current = [];
  }

  function undoLast() {
    setStrokes((s) => s.slice(0, -1));
  }

  function submit() {
    if (strokes.length === 0) return;
    const b64 = exportBase64();
    if (b64) onSubmit(b64);
  }

  return (
    <div className="space-y-2">
      <div
        className="relative mx-auto rounded-2xl border-2 border-amber-400/40 bg-white overflow-hidden touch-none select-none"
        style={{ width, height }}
      >
        {/* 米字格辅助线（透明叠层） */}
        {showGuide && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${width} ${height}`}
          >
            {/* 外框已由 border 提供；只画十字 + 米字斜线 */}
            <line x1={width / 2} y1="0" x2={width / 2} y2={height} stroke="#fda4af" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
            <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke="#fda4af" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
            <line x1="0" y1="0" x2={width} y2={height} stroke="#fda4af" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
            <line x1={width} y1="0" x2="0" y2={height} stroke="#fda4af" strokeWidth="1" strokeDasharray="4 4" opacity="0.3" />
          </svg>
        )}
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="block w-full h-full cursor-crosshair touch-none"
          style={{ touchAction: "none" }}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={undoLast}
          disabled={disabled || strokes.length === 0}
          className="px-3 py-2 rounded-lg bg-ink-700/40 text-slate-200 text-xs font-semibold hover:bg-ink-700/60 disabled:opacity-30 transition-colors"
        >
          ↶ 撤回笔
        </button>
        <button
          type="button"
          onClick={clearAll}
          disabled={disabled || strokes.length === 0}
          className="px-3 py-2 rounded-lg bg-rose-500/15 border border-rose-400/30 text-rose-200 text-xs font-semibold hover:bg-rose-500/30 disabled:opacity-30 transition-colors"
        >
          🗑 清空
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={disabled || strokes.length === 0}
          className="px-3 py-2 rounded-lg bg-violet-500 text-white text-xs font-semibold hover:bg-violet-600 disabled:opacity-30 transition-colors"
        >
          提交手写
        </button>
      </div>
      <div className="text-[10px] text-slate-500 text-center">
        {strokes.length} 笔 · 用手指或鼠标在白板上写
      </div>
    </div>
  );
}
