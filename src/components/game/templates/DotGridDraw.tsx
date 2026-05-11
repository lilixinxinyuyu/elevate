/**
 * DotGridDraw — Phase 2 Axis 2 起步：点子图画图。
 *
 * 用户在 W×H 格点上点击添加顶点，自动按顺序连线。点击第一个顶点闭合多边形。
 * "完成"按钮提交，按 question.dot_grid.targetShape 校验。
 *
 * 起步只支持 5 种目标形状：parallelogram / rectangle / trapezoid /
 * isosceles_triangle / any_triangle。后续可扩 right_triangle / equilateral。
 */

import { useMemo, useState } from "react";
import type { TemplateRenderProps } from "../GameShell";
import type { DotGridSpec } from "../../../core/types";

interface Point { x: number; y: number; }

const SVG_PADDING = 28;
const DOT_SPACING = 48; // px

export function DotGridDrawPanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const spec: DotGridSpec | undefined = question.dot_grid;

  const [vertices, setVertices] = useState<Point[]>([]);
  const [closed, setClosed] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!spec) {
    return <div className="text-rose-300 p-4">题目缺 dot_grid 配置。</div>;
  }

  const W = spec.gridWidth;
  const H = spec.gridHeight;
  const svgW = SVG_PADDING * 2 + (W - 1) * DOT_SPACING;
  const svgH = SVG_PADDING * 2 + (H - 1) * DOT_SPACING;

  const dotPx = (p: Point) => ({
    cx: SVG_PADDING + p.x * DOT_SPACING,
    cy: SVG_PADDING + p.y * DOT_SPACING,
  });

  const clickDot = (p: Point) => {
    if (disabled || submitted) return;
    if (closed) return; // 已闭合不能再加
    // 点中第一个顶点 → 闭合
    if (vertices.length >= 3 && p.x === vertices[0]!.x && p.y === vertices[0]!.y) {
      setClosed(true);
      return;
    }
    // 已经在数组里（非第一个）→ 撤销到这个点之后
    const existing = vertices.findIndex((v) => v.x === p.x && v.y === p.y);
    if (existing >= 0) return; // 重复点忽略（除了首点闭合）
    setVertices([...vertices, p]);
  };

  const reset = () => {
    if (disabled || submitted) return;
    setVertices([]);
    setClosed(false);
  };

  const undo = () => {
    if (disabled || submitted || vertices.length === 0) return;
    setClosed(false);
    setVertices(vertices.slice(0, -1));
  };

  const submit = (ev: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || submitted) return;
    if (!closed && vertices.length >= 3) {
      // 也允许"画完后未点首点闭合就提交" — 自动闭合
      setClosed(true);
    }
    const ok = checkShape(vertices, spec.targetShape);
    setSubmitted(true);
    const rect = ev.currentTarget.getBoundingClientRect();
    if (ok) triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "✓");
    else triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
    window.setTimeout(() => {
      onFinish({
        answer: vertices.map((v) => `(${v.x},${v.y})`).join(";"),
        isCorrect: ok,
        partialCorrect: false,
        matchedErrorTags: ok ? [] : ["geometry_shape_mismatch"],
      });
    }, 300);
  };

  // 渲染辅助
  const dots: Point[] = useMemo(() => {
    const list: Point[] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) list.push({ x, y });
    }
    return list;
  }, [W, H]);

  const polylinePoints = vertices
    .map((v) => {
      const { cx, cy } = dotPx(v);
      return `${cx},${cy}`;
    })
    .concat(closed && vertices[0] ? [`${dotPx(vertices[0]).cx},${dotPx(vertices[0]).cy}`] : [])
    .join(" ");

  return (
    <div>
      <div className="text-slate-200 text-base mb-3 whitespace-pre-wrap">{question.stem}</div>
      <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3 mb-3">
        <div className="text-xs text-violet-200 mb-2">
          目标：<span className="font-bold">{spec.targetLabel}</span>
        </div>
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width={svgW}
          height={svgH}
          className="max-w-full mx-auto block"
          style={{ touchAction: "manipulation" }}
        >
          {/* 网格点 — v0.31.88: 每个点叠一个透明 r=20 hit area 防"点不到" */}
          {dots.map((p) => {
            const { cx, cy } = dotPx(p);
            const isVertex = vertices.some((v) => v.x === p.x && v.y === p.y);
            const isFirst = vertices[0] && vertices[0].x === p.x && vertices[0].y === p.y;
            return (
              <g key={`${p.x},${p.y}`}>
                {/* 可见点 */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isFirst ? 9 : isVertex ? 7 : 4}
                  fill={isFirst ? "#fbbf24" : isVertex ? "#a78bfa" : "#475569"}
                  opacity={isVertex ? 1 : 0.5}
                  pointerEvents="none"
                />
                {/* 透明 hit area — 半径 20px 覆盖手指 44px 触摸目标。
                    放后面让它覆盖可见点的点击。 */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={20}
                  fill="transparent"
                  style={{ cursor: disabled || submitted ? "default" : "pointer" }}
                  onClick={() => clickDot(p)}
                />
              </g>
            );
          })}
          {/* 顶点连线 */}
          {polylinePoints && (
            <polyline
              points={polylinePoints}
              fill={closed ? "rgba(167,139,250,0.18)" : "none"}
              stroke="#a78bfa"
              strokeWidth={3}
              strokeLinejoin="round"
            />
          )}
        </svg>
        <div className="text-[11px] text-slate-400 mt-2 text-center">
          点格点添加顶点；点回第一个顶点（金色）闭合；提交后判形状。
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={undo}
          disabled={disabled || submitted || vertices.length === 0}
          className="btn-ghost text-sm border border-ink-700"
        >
          ↶ 撤一步
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={disabled || submitted || vertices.length === 0}
          className="btn-ghost text-sm border border-ink-700"
        >
          ✕ 重画
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={disabled || submitted || vertices.length < 3}
          className="btn-primary text-sm ml-auto"
        >
          完成 ✓
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 几何判分
// ---------------------------------------------------------------------------

function dist2(a: Point, b: Point): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function vec(a: Point, b: Point): Point {
  return { x: b.x - a.x, y: b.y - a.y };
}

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

/** 两向量平行（叉积 0） */
function isParallel(v1: Point, v2: Point): boolean {
  return Math.abs(cross(v1, v2)) < 1e-6;
}

/** 两向量是否成直角（点积 0） */
function isRight(v1: Point, v2: Point): boolean {
  return Math.abs(dot(v1, v2)) < 1e-6;
}

/** 多边形是否简单（边不自交、面积非零）— 精简版：检查面积非零 */
function polygonArea(verts: Point[]): number {
  let s = 0;
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i]!;
    const b = verts[(i + 1) % verts.length]!;
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

export function checkShape(verts: Point[], target: DotGridSpec["targetShape"]): boolean {
  if (verts.length < 3) return false;
  if (polygonArea(verts) < 0.5) return false; // 三点共线 / 退化

  // 三角形类
  if (verts.length === 3) {
    if (target === "any_triangle") return true;
    const [a, b, c] = verts as [Point, Point, Point];
    const d_ab = dist2(a, b);
    const d_bc = dist2(b, c);
    const d_ca = dist2(c, a);
    if (target === "isosceles_triangle") {
      return d_ab === d_bc || d_bc === d_ca || d_ab === d_ca;
    }
    if (target === "equilateral_triangle") {
      return d_ab === d_bc && d_bc === d_ca;
    }
    if (target === "right_triangle") {
      // 任意一组邻边垂直
      const v1 = vec(a, b), v2 = vec(a, c);
      const v3 = vec(b, a), v4 = vec(b, c);
      const v5 = vec(c, a), v6 = vec(c, b);
      return isRight(v1, v2) || isRight(v3, v4) || isRight(v5, v6);
    }
    return false;
  }

  // 四边形类
  if (verts.length !== 4) return false;
  const [a, b, c, d] = verts as [Point, Point, Point, Point];
  const ab = vec(a, b);
  const bc = vec(b, c);
  const cd = vec(c, d);
  const da = vec(d, a);
  const par1 = isParallel(ab, cd); // ab 平行 cd
  const par2 = isParallel(bc, da); // bc 平行 da
  const right1 = isRight(ab, bc);
  const right2 = isRight(bc, cd);
  const right3 = isRight(cd, da);

  if (target === "rectangle") {
    return par1 && par2 && right1 && right2 && right3;
  }
  if (target === "parallelogram") {
    // 两组对边平行 + 至少一个角不是直角（否则就是矩形）
    if (!(par1 && par2)) return false;
    const isRect = right1 && right2 && right3;
    return !isRect; // 严格平行四边形（非矩形）
    // 若想宽松（矩形也算平行四边形），改成 return par1 && par2;
  }
  if (target === "trapezoid") {
    // 恰好一组对边平行（不是平行四边形）
    return (par1 && !par2) || (par2 && !par1);
  }
  return false;
}
