/**
 * v0.35.27 (爸爸第 3 次反馈): CanvasScratch 全面重写, 修 8 个 UX bug.
 *
 * 爸爸反馈原文:
 *   - 写了草稿没意义, 不参与记分
 *   - 写了草稿后答错还弹"草稿/心算" dialog
 *   - 选草稿又弹 textarea, 输入了不能做什么
 *   - "列算式写了草稿就默认是写草稿了, 还要再问一次是什么意思?"
 *   - 写了草稿是发给模型判定草稿写的对吗, 有让模型分析草稿逻辑哪里不对吗?
 *   - 鼠标移动就自动画 (没按住也画)
 *   - 点清空 / 撤回笔没用
 *   - 草稿不能擦, 撤回笔把刚写的正确的也撤了, 必须要有擦子
 *
 * 修复:
 *   1. mouse hover 不画: onPointerDown 加 button check (e.button === 0 主键)
 *   2. 撤回/清空 button 任何时候都能点 (不再被 strokes.length === 0 disable)
 *   3. **加擦子工具** (tool toggle: "✍️ 笔" / "🧽 擦子"), 划过的 stroke 删掉
 *   4. canvas_scratch 模板 = 草稿默认已用 (GameShell 跳过 ScratchInsurance dialog)
 *   5. 提交时 canvasScratch.insured = strokes >= 2 自动 (写了就算用了草稿)
 *   6. **vision judge 按钮**: "🤖 让小进检查我的列式" → 调 vision FC →
 *      显示 "✅ 列式对" / "⚠️ 第二步少进位" 等智能反馈
 *   7. ScratchInsurance dialog / ScratchPanel 跟 canvas_scratch 模板互斥 (GameShell 已改)
 *   8. UI 加 mode chip 让 Selena 清楚自己在写 / 在擦
 */
import { useRef, useState, useEffect, useCallback } from "react";
import type { TemplateRenderProps } from "../GameShell";
import { gradeAttempt } from "../../../core/grading";
import { logFcCall } from "../../../lib/fcCallLog";
import { getStoredPassword } from "../../../db/cloudSync";

interface Point {
  x: number;
  y: number;
}
type Stroke = Point[];

type Tool = "pen" | "eraser";

const CANVAS_W = 640;
const CANVAS_H = 320;
const ERASER_RADIUS = 18; // canvas units

export function CanvasScratchPanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const drawingRef = useRef(false);
  const currentStrokeRef = useRef<Stroke>([]);
  const [tool, setTool] = useState<Tool>("pen");
  const [value, setValue] = useState("");
  const [locked, setLocked] = useState(false);

  // 重画 canvas — useCallback 让 useEffect deps 稳定
  const redraw = useCallback(() => {
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
  }, [strokes]);

  useEffect(() => {
    redraw();
  }, [redraw]);

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

  // 擦: 用 segment-to-circle 距离判断哪些 stroke 经过 eraser 中心半径内
  function eraseAt(pt: Point) {
    setStrokes((all) => {
      return all.filter((stroke) => {
        // 任一 segment / 顶点距 pt 小于 ERASER_RADIUS → 整条 stroke 删掉 (简化)
        for (let i = 0; i < stroke.length; i++) {
          const p = stroke[i]!;
          const dx = p.x - pt.x;
          const dy = p.y - pt.y;
          if (dx * dx + dy * dy <= ERASER_RADIUS * ERASER_RADIUS) {
            return false; // 删整条 stroke
          }
        }
        return true;
      });
    });
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled || locked) return;
    // v0.35.27 fix: mouse / pen 必须真按下才画 (hover 不画)
    // touch 没 button 概念, isPrimary 兜底
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
    if (!drawingRef.current || disabled || locked) return;
    if (e.pointerType === "mouse" && e.buttons === 0) {
      // mouse 在 capture 中但没按住 (e.g., 鼠标按一下松开后还在 capture)
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
    if (locked || disabled) return;
    setStrokes([]);
    currentStrokeRef.current = [];
  }

  function undoLast() {
    if (locked || disabled) return;
    setStrokes((s) => s.slice(0, -1));
  }

  // ────────── Vision judge (爸爸 explicit): submit 后 fire-and-forget ──────────
  const [visionStatus, setVisionStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok"; processOk: boolean; feedback: string; model: string; elapsedMs: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function runVisionJudge(canvasBase64: string, finalAnswer: string, isCorrect: boolean) {
    const startedAt = Date.now();
    setVisionStatus({ kind: "loading" });
    const pwd = getStoredPassword();
    if (!pwd) {
      setVisionStatus({ kind: "error", message: "no_password" });
      return;
    }
    try {
      // Step 1: 拿 FC URL from ESA (cadet-facing endpoint, 任意 logged-in user 可调)
      const esaR = await fetch("/api/vision/fc-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${pwd}` },
        body: JSON.stringify({}),
      });
      if (!esaR.ok) {
        // 非 admin 用户 (Selena cadet) 也没问题 — fc-bypass endpoint 走通 even for cadets, 因为只返 URL
        const detail = await esaR.text().catch(() => "");
        setVisionStatus({ kind: "error", message: `ESA ${esaR.status}: ${detail.slice(0, 80)}` });
        return;
      }
      const esaJ = (await esaR.json()) as { ok: boolean; fcUrl?: string };
      if (!esaJ.ok || !esaJ.fcUrl) {
        setVisionStatus({ kind: "error", message: "no_fc_url" });
        return;
      }
      // Step 2: POST FC vision with canvas + 题面 + 学生答案
      const fcR = await fetch(esaJ.fcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${pwd}` },
        body: JSON.stringify({
          image_base64: canvasBase64,
          mode: "canvas_judge",
          stem: question.stem.slice(0, 200),
          finalAnswer,
          isCorrect,
        }),
      });
      if (!fcR.ok) {
        setVisionStatus({ kind: "error", message: `FC ${fcR.status}` });
        logFcCall({ kind: "paper_ocr", success: false, elapsedMs: Date.now() - startedAt, error: `fc_${fcR.status}`, source: "canvas_judge" });
        return;
      }
      const fcJ = (await fcR.json()) as {
        ok: boolean;
        canvasJudge?: { processOk: boolean; feedback: string };
        model?: string;
        elapsedMs?: number;
        rawContent?: string;
      };
      logFcCall({ kind: "paper_ocr", success: !!fcJ.ok, elapsedMs: Date.now() - startedAt, model: fcJ.model, source: "canvas_judge" });
      if (!fcJ.ok || !fcJ.canvasJudge) {
        setVisionStatus({ kind: "error", message: "no_judge: " + (fcJ.rawContent?.slice(0, 80) ?? "") });
        return;
      }
      setVisionStatus({
        kind: "ok",
        processOk: fcJ.canvasJudge.processOk,
        feedback: fcJ.canvasJudge.feedback,
        model: fcJ.model ?? "unknown",
        elapsedMs: fcJ.elapsedMs ?? 0,
      });
    } catch (e) {
      setVisionStatus({ kind: "error", message: (e as Error).message.slice(0, 80) });
    }
  }

  function submit(ev: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLInputElement>) {
    if (disabled || locked || !value.trim()) return;
    const result = gradeAttempt(question, value);
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    if (result.isCorrect) triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "✓");
    else triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
    setLocked(true);
    const imageBase64 = strokes.length > 0 ? exportBase64() : "";
    const hasWork = strokes.length >= 2; // 2 笔+ 算"列了式"
    onFinish({
      answer: value,
      isCorrect: result.isCorrect,
      partialCorrect: result.partialCorrect,
      matchedErrorTags: result.matchedErrorTags,
      canvasScratch: {
        imageBase64,
        strokeCount: strokes.length,
        hasWork,
      },
      // v0.35.27 (爸爸): 写了草稿 = 自动 insured (跟 ScratchInsurance 体系兼容,
      // 答错不扣 XP/mastery, 因为她是认真列了式)
      scratch: hasWork
        ? { tool: "scratch", charCount: strokes.length, insured: true, mentalOverrideUsed: false }
        : undefined,
    });
    // 自动 vision judge — 没 work 就不调 (省 token)
    if (hasWork && imageBase64) {
      void runVisionJudge(imageBase64, value, result.isCorrect);
    }
  }

  return (
    <div className="space-y-3">
      <div className="font-display text-2xl leading-tight whitespace-pre-wrap">{question.stem}</div>

      {/* 列算式区 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-300">
          <span>✍️ 列算式区 (像在纸上一样写)</span>
          <span className="text-slate-400">{strokes.length} 笔</span>
        </div>

        {/* 工具选择 chip 在 canvas 上方, 明确当前 mode */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTool("pen")}
            disabled={disabled || locked}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
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
            disabled={disabled || locked}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              tool === "eraser"
                ? "bg-pink-500 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            } disabled:opacity-40`}
          >
            🧽 擦子
          </button>
          <div className="flex-1"></div>
          <button
            type="button"
            onClick={undoLast}
            disabled={disabled || locked}
            className="px-3 py-1 rounded-lg bg-ink-700/40 text-slate-200 text-xs font-semibold hover:bg-ink-700/60 disabled:opacity-40 transition-colors"
            title="撤回最后一笔"
          >
            ↶ 撤回
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={disabled || locked}
            className="px-3 py-1 rounded-lg bg-rose-500/15 border border-rose-400/30 text-rose-200 text-xs font-semibold hover:bg-rose-500/30 disabled:opacity-40 transition-colors"
            title="清空所有"
          >
            🗑 清空
          </button>
        </div>

        <div
          className="relative mx-auto rounded-xl border-2 border-amber-400/40 bg-white overflow-hidden touch-none select-none"
          style={{ width: "100%", maxWidth: CANVAS_W, aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
        >
          {/* 浅色横线 (像作业本) */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            preserveAspectRatio="none"
          >
            {[0.2, 0.4, 0.6, 0.8].map((r) => (
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
            提示: 先在白板上列一下式子, 写了草稿就不会扣分 ✍️
          </div>
        )}
        {strokes.length >= 2 && !locked && (
          <div className="text-[10px] text-emerald-300/80">
            ✅ 已写 {strokes.length} 笔, 即使答错也不扣 (写草稿就保护了)
          </div>
        )}
      </div>

      {/* Vision judge 反馈 chip */}
      {visionStatus.kind !== "idle" && (
        <div
          className={`rounded-lg px-3 py-2 text-xs ${
            visionStatus.kind === "loading"
              ? "bg-slate-800/60 border border-slate-500/30 text-slate-300"
              : visionStatus.kind === "ok" && visionStatus.processOk
                ? "bg-emerald-500/15 border border-emerald-400/40 text-emerald-100"
                : visionStatus.kind === "ok" && !visionStatus.processOk
                  ? "bg-amber-500/15 border border-amber-400/40 text-amber-100"
                  : "bg-rose-500/10 border border-rose-400/30 text-rose-200"
          }`}
        >
          {visionStatus.kind === "loading" && "🤖 小进在看你的列式 (10-20s)..."}
          {visionStatus.kind === "ok" && (
            <>
              <div className="font-semibold">
                {visionStatus.processOk ? "✅ 列式没问题" : "⚠️ 列式有可改进"}
              </div>
              <div className="text-[11px] mt-0.5 whitespace-pre-wrap">{visionStatus.feedback}</div>
              <div className="text-[9px] text-slate-400 mt-1">
                {visionStatus.model} · {(visionStatus.elapsedMs / 1000).toFixed(1)}s
              </div>
            </>
          )}
          {visionStatus.kind === "error" && (
            <>🤖 检查失败 ({visionStatus.message})</>
          )}
        </div>
      )}
    </div>
  );
}
