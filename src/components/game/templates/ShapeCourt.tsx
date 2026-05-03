import { useMemo, useState } from "react";
import type { TemplateRenderProps } from "../GameShell";
import type { Question } from "../../../core/types";

/**
 * 图形法庭：题面给三根木棒（cm 数）；用 SVG 把它们画出来；
 * 用户判断"能 / 不能"组成三角形。
 *
 * tags 配置: ["sticks:3,4,8"]   answer.value 应是 "T" 或 "F"
 */
export function ShapeCourtPanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const sticks = useMemo(() => parseSticks(question), [question.question_id]);
  const [picked, setPicked] = useState<"T" | "F" | null>(null);
  const [locked, setLocked] = useState(false);
  const correct: "T" | "F" =
    question.answer.type === "choice" && (question.answer.value === "T" || question.answer.value === "F")
      ? question.answer.value
      : canFormTriangle(sticks)
        ? "T"
        : "F";

  // 计算 SVG 中三根木棒的展示。让"能围成"的可视化三角形成立，"不能围成"的展开/张不开。
  const visual = useMemo(() => layoutSticks(sticks), [sticks]);

  const click = (v: "T" | "F", ev: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || locked) return;
    setPicked(v);
    setLocked(true);
    const ok = v === correct;
    const rect = ev.currentTarget.getBoundingClientRect();
    if (ok) triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "✓");
    else triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
    window.setTimeout(() => {
      onFinish({
        answer: v,
        isCorrect: ok,
        partialCorrect: false,
        matchedErrorTags: ok ? [] : ["triangle_condition_error"],
      });
    }, 280);
  };

  const showAnswer = disabled || locked;
  const tBtnClass = (v: "T" | "F", base: string) => {
    const isPicked = picked === v;
    const isCorrect = correct === v;
    if (isCorrect && (isPicked || showAnswer)) return base + " bubble-correct";
    if (isPicked && !isCorrect) return base + " bubble-wrong";
    if (showAnswer) return base + " bubble-dimmed";
    return base;
  };

  return (
    <div>
      <div className="font-display font-bold text-xl mb-3 text-slate-100 whitespace-pre-wrap">
        {question.stem}
      </div>

      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 mb-4 flex justify-center">
        <SticksSvg layout={visual} sticks={sticks} />
      </div>
      <div className="text-xs text-slate-400 text-center mb-4">
        三根木棒长度：{sticks.map((s) => `${s} cm`).join("、")}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          disabled={disabled || locked}
          onClick={(e) => click("F", e)}
          className={tBtnClass("F", "bubble py-6 text-3xl font-bold border-rose-400/30")}
        >
          <span className="text-rose-300">✗ 不能</span>
        </button>
        <button
          type="button"
          disabled={disabled || locked}
          onClick={(e) => click("T", e)}
          className={tBtnClass("T", "bubble py-6 text-3xl font-bold border-emerald-400/30")}
        >
          <span className="text-emerald-300">✓ 能围成</span>
        </button>
      </div>
    </div>
  );
}

function parseSticks(q: Question): number[] {
  for (const t of q.tags ?? []) {
    if (t.startsWith("sticks:")) {
      return t.slice(7).split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
    }
  }
  // 退路：从题干抓数字
  const m = Array.from(q.stem.matchAll(/(\d+(?:\.\d+)?)/g)).map((x) => Number(x[1]));
  return m.length >= 3 ? m.slice(0, 3) : [3, 4, 5];
}

function canFormTriangle(s: number[]): boolean {
  if (s.length < 3) return false;
  const [a, b, c] = s.slice(0, 3).sort((x, y) => x - y);
  return a! + b! > c!;
}

interface Layout {
  triangle: { x: number; y: number }[] | null;
  flat: { x: number; y: number }[][] | null; // 不能围成时显示一字摊开
}

function layoutSticks(s: number[]): Layout {
  const [a, b, c] = s.slice(0, 3).sort((x, y) => y - x); // 大到小
  if (a == null || b == null || c == null) return { triangle: null, flat: null };
  const can = b + c > a;
  const W = 360, H = 200;
  if (can) {
    // 三角形坐标：以最长边在底部
    // 用余弦定理算夹角
    const cosA = (b * b + c * c - a * a) / (2 * b * c);
    const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
    const cosB = (a * a + c * c - b * b) / (2 * a * c);
    const B = Math.acos(Math.max(-1, Math.min(1, cosB)));
    // 缩放比，最大边映射到 240px
    const scale = Math.min(240 / a, 100 / Math.max(1, Math.sin(B) * c));
    const aPx = a * scale, bPx = b * scale, cPx = c * scale;
    // 顶点 P0 = (0,0)，沿 x 轴 P1 = (aPx, 0)；P2 在 P0 角度 B 处
    const p0 = { x: -aPx / 2, y: 50 };
    const p1 = { x: aPx / 2, y: 50 };
    const p2 = { x: p0.x + Math.cos(B) * cPx, y: p0.y - Math.sin(B) * cPx };
    // 平移到画布中心
    const cx = W / 2, cy = H / 2 + 30;
    const tri = [p0, p1, p2].map((p) => ({ x: p.x + cx, y: p.y + cy - 10 }));
    return { triangle: tri, flat: null };
  } else {
    // 不能围成 → 把三段一字摆开演示"摊不到一起"
    const totalShort = b + c;
    const scale = Math.min(280 / a, 200 / Math.max(totalShort, 1));
    const aPx = a * scale;
    const bPx = b * scale;
    const cPx = c * scale;
    const startX = (W - aPx) / 2;
    const yA = H / 2 - 20;
    const yB = H / 2 + 30;
    return {
      triangle: null,
      flat: [
        // a 棒
        [{ x: startX, y: yA }, { x: startX + aPx, y: yA }],
        // b + c 上下排开
        [{ x: startX, y: yB }, { x: startX + bPx, y: yB }],
        [{ x: startX + bPx + 8, y: yB }, { x: startX + bPx + 8 + cPx, y: yB }],
      ],
    };
  }
}

function SticksSvg({ layout, sticks }: { layout: Layout; sticks: number[] }) {
  const W = 360, H = 200;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[440px]" aria-label="木棒视图">
      {layout.triangle && (
        <>
          <polygon
            points={layout.triangle.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="rgba(167,139,250,0.18)"
            stroke="#a78bfa"
            strokeWidth={3}
          />
          {[0, 1, 2].map((i) => {
            const a = layout.triangle![i]!;
            const b = layout.triangle![(i + 1) % 3]!;
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2 - 6;
            return (
              <text key={i} x={mx} y={my} fill="#fde68a" fontSize="14" textAnchor="middle">
                {sticks.slice().sort((x, y) => y - x)[(i + 2) % 3]}
              </text>
            );
          })}
        </>
      )}
      {layout.flat && layout.flat.map((seg, i) => {
        const colors = ["#fb7185", "#fbbf24", "#34d399"];
        return (
          <g key={i}>
            <line
              x1={seg[0]!.x}
              y1={seg[0]!.y}
              x2={seg[1]!.x}
              y2={seg[1]!.y}
              stroke={colors[i] ?? "#fff"}
              strokeWidth={6}
              strokeLinecap="round"
            />
            <text
              x={(seg[0]!.x + seg[1]!.x) / 2}
              y={seg[0]!.y - 8}
              fill={colors[i] ?? "#fff"}
              fontSize="12"
              textAnchor="middle"
            >
              {sticks[0] && i === 0 ? Math.max(...sticks) : i === 1 ? sticks.slice().sort((x, y) => y - x)[1] : sticks.slice().sort((x, y) => y - x)[2]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
