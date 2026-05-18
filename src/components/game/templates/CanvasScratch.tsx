/**
 * v0.35.10 iter 41 (爸爸反馈): CanvasScratch template.
 *
 * "列算式" 类题型: 学生在 canvas 上手写列式 + 下方输入最终数字答.
 *   - 列算式区 = 大白板 (touch+pen+mouse), 撤回 / 清空 / 笔画数提示
 *   - 数字答区 = 紧凑 inline numeric input + 确定按钮
 *   - 提交时: 数字答交给 gradeAttempt (跟 plain_numeric 一致), canvas PNG base64 + strokeCount
 *     落 attempt.metadata.canvasScratch — mistake 复盘时可还原 Selena 当时怎么列式.
 *
 * 触发: q.play_as === "canvas_scratch" (admin / AI 显式标), 见 resolve.ts.
 * 跟 MultiStepApplication 互斥: 有完整 4 步框架的应用题优先 multi_step_application;
 *   单纯需要"先列式再算"的多位算式 / 部分应用题用 canvas_scratch.
 *
 * 软引导 (不强制): 没画就直接提交答案 → 视为 hasWork=false, 但仍可提交;
 *   feedback 时显示"建议下次先列式 ✍️" 软提示 (Mistakes 页可见).
 */
import { useRef, useState, useEffect } from "react";
import type { TemplateRenderProps } from "../GameShell";
import { gradeAttempt } from "../../../core/grading";

interface Point {
  x: number;
  y: number;
}
type Stroke = Point[];

const CANVAS_W = 640;
const CANVAS_H = 280;

export function CanvasScratchPanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<Stroke>([]);
  const [value, setValue] = useState("");
  const [locked, setLocked] = useState(false);

  // 重画 canvas 所有 stroke
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
    const drawStroke = (s: Stroke) => {
      if (s.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(s[0]!.x, s[0]!.y);
      for (let i = 1; i < s.length; i++) ctx.lineTo(s[i]!.x, s[i]!.y);
      ctx.stroke();
    };
    for (const s of strokes) drawStroke(s);
    if (currentStrokeRef.current.length >= 2) drawStroke(currentStrokeRef.current);
  }

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  // 加白底 export base64 (LLM / mistake 复盘看)
  function exportBase64(): string {
    const cv = canvasRef.current;
    if (!cv) return "";
    const tmp = document.createElement("canvas");
    tmp.width = cv.width;
    tmp.height = cv.height;
    const tctx = tmp.getContext("2d");
    if (!tctx) return "";
    tctx.fillStyle = "#ffffff";
    tctx.fillRect(0, 0, tmp.width, tmp.height);
    tctx.drawImage(cv, 0, 0);
    return tmp.toDataURL("image/png").replace(/^data:image\/[a-z]+;base64,/, "");
  }

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const cv = canvasRef.current;
    if (!cv) return { x: 0, y: 0 };
    const rect = cv.getBoundingClientRect();
    const sx = cv.width / rect.width;
    const sy = cv.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled || locked) return;
    e.preventDefault();
    drawingRef.current = true;
    currentStrokeRef.current = [getPoint(e)];
    canvasRef.current?.setPointerCapture(e.pointerId);
    redraw();
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current || disabled || locked) return;
    e.preventDefault();
    currentStrokeRef.current.push(getPoint(e));
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
    if (locked) return;
    setStrokes([]);
    currentStrokeRef.current = [];
  }

  function undoLast() {
    if (locked) return;
    setStrokes((s) => s.slice(0, -1));
  }

  function submit(ev: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLInputElement>) {
    if (disabled || locked || !value.trim()) return;
    const result = gradeAttempt(question, value);
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    if (result.isCorrect) triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "✓");
    else triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
    setLocked(true);
    const imageBase64 = strokes.length > 0 ? exportBase64() : "";
    onFinish({
      answer: value,
      isCorrect: result.isCorrect,
      partialCorrect: result.partialCorrect,
      matchedErrorTags: result.matchedErrorTags,
      canvasScratch: {
        imageBase64,
        strokeCount: strokes.length,
        hasWork: strokes.length >= 2, // 2 笔以上才算"列了式" (1 笔很可能是误触)
      },
    });
  }

  return (
    <div className="space-y-3">
      <div className="font-display text-2xl leading-tight whitespace-pre-wrap">{question.stem}</div>

      {/* 列算式区: 大白板 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>✍️ 列算式区 (像在纸上一样写)</span>
          <span className="text-slate-400">{strokes.length} 笔</span>
        </div>
        <div
          className="relative mx-auto rounded-xl border-2 border-amber-400/40 bg-white overflow-hidden touch-none select-none"
          style={{ width: "100%", maxWidth: CANVAS_W, aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
        >
          {/* 浅色横线辅助 (像作业本) */}
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
            className="block w-full h-full cursor-crosshair touch-none"
            style={{ touchAction: "none" }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={undoLast}
            disabled={disabled || locked || strokes.length === 0}
            className="px-3 py-1.5 rounded-lg bg-ink-700/40 text-slate-200 text-xs font-semibold hover:bg-ink-700/60 disabled:opacity-30 transition-colors"
          >
            ↶ 撤回笔
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={disabled || locked || strokes.length === 0}
            className="px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-400/30 text-rose-200 text-xs font-semibold hover:bg-rose-500/30 disabled:opacity-30 transition-colors"
          >
            🗑 清空
          </button>
        </div>
      </div>

      {/* 数字答区 */}
      <div className="space-y-1">
        <div className="text-xs text-slate-300">🎯 最终答案 (数字)</div>
        <div className="flex items-center gap-2">
          <input
            inputMode="decimal"
            className="field text-2xl font-display"
            value={value}
            disabled={disabled || locked}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit(e);
            }}
            placeholder="算出来填这"
          />
          <button
            type="button"
            className="btn-primary"
            disabled={disabled || locked || !value.trim()}
            onClick={submit}
          >
            确定
          </button>
        </div>
        {strokes.length === 0 && !locked && (
          <div className="text-[10px] text-amber-300/80">
            提示: 在白板上列一下式子, 计算更稳 ✍️
          </div>
        )}
      </div>
    </div>
  );
}
