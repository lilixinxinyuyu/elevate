import { useMemo, useState } from "react";
import type { TemplateRenderProps } from "../GameShell";

/**
 * 三角形法庭 · TriangleJudge
 *
 * 比 ShapeCourt（专做"三边能否围成"判断）更通用：
 * 支持任意三角形分类、求边、求角等单选/数值题。
 *
 * 题目通过 tags 配置可视化：
 *
 *   tri-angles:60,60,60
 *     给三个内角度数 → 渲染按角度构造的三角形，并在三角上标注角度
 *
 *   tri-sides:5,5,8
 *     给三条边长（cm）→ 渲染按比例缩放的三角形，标注边长
 *     若三边不能围成（5+5≤8），渲染"摊开"示意。
 *
 *   tri-iso:apex=110,base=8       (顶角 110°，底边 8cm)
 *     等腰三角形特殊渲染：标注顶角和底边
 *
 *   tri-mark:right    在三角形上标记直角符号
 *   tri-mark:isoceles 在两条腰边上标记等腰刻度
 *
 * 答案类型：number 或 choice。
 */
export function TriangleJudgePanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const tags = question.tags ?? [];
  const tri = useMemo(() => parseTriangle(tags), [question.question_id]);

  if (question.answer.type === "number") {
    return <NumericTriangle {...props} tri={tri} onFinish={onFinish} triggerFx={triggerFx} disabled={disabled} />;
  }
  return <ChoiceTriangle {...props} tri={tri} onFinish={onFinish} triggerFx={triggerFx} disabled={disabled} />;
}

function NumericTriangle(props: TemplateRenderProps & { tri: TriangleSpec | null }) {
  const { question, onFinish, triggerFx, disabled, tri } = props;
  const [picked, setPicked] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const correctValue = question.answer.type === "number" ? question.answer.value : 0;
  const distractors = (question.distractors ?? []) as number[];
  const options = useMemo(() => {
    const arr = [correctValue, ...distractors.filter((x) => x !== correctValue)].slice(0, 4);
    return arr.sort((a, b) => a - b);
  }, [correctValue, distractors.join(",")]);

  const showAnswer = disabled || locked;
  const pick = (val: number, ev: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || locked) return;
    setPicked(val);
    setLocked(true);
    const ok = val === correctValue;
    const rect = ev.currentTarget.getBoundingClientRect();
    if (ok) triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "✓");
    else triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
    window.setTimeout(() => {
      onFinish({
        answer: String(val),
        isCorrect: ok,
        partialCorrect: false,
        matchedErrorTags: ok ? [] : ["triangle_calc_error"],
      });
    }, 280);
  };

  const unit = question.answer.type === "number" ? question.answer.unit : undefined;

  return (
    <div>
      <div className="font-display text-xl leading-snug mb-3 whitespace-pre-wrap">{question.stem}</div>
      {tri && <TriangleSvg tri={tri} />}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
        {options.map((o) => {
          const isPicked = picked === o;
          const isCorrect = o === correctValue;
          let klass = "bubble py-4 text-2xl font-bold";
          if (isCorrect && (isPicked || showAnswer)) klass += " bubble-correct";
          else if (isPicked && !isCorrect) klass += " bubble-wrong";
          else if (showAnswer) klass += " bubble-dimmed";
          return (
            <button key={o} disabled={disabled || locked} onClick={(e) => pick(o, e)} className={klass}>
              {o}
              {unit && <span className="ml-1 text-sm font-normal opacity-70">{unit}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChoiceTriangle(props: TemplateRenderProps & { tri: TriangleSpec | null }) {
  const { question, onFinish, triggerFx, disabled, tri } = props;
  const [picked, setPicked] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const options = question.options ?? [];
  const correctId = question.answer.type === "choice" ? question.answer.value : null;

  const pick = (id: string, ev: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || locked) return;
    setPicked(id);
    setLocked(true);
    const ok = id === correctId;
    const rect = ev.currentTarget.getBoundingClientRect();
    if (ok) triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "✓");
    else triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
    const opt = options.find((o) => o.id === id);
    window.setTimeout(() => {
      onFinish({
        answer: id,
        isCorrect: ok,
        partialCorrect: false,
        matchedErrorTags: ok ? [] : opt?.errorTag ? [opt.errorTag] : [],
      });
    }, 280);
  };

  const showAnswer = disabled || locked;

  return (
    <div>
      <div className="font-display text-xl leading-snug mb-3 whitespace-pre-wrap">{question.stem}</div>
      {tri && <TriangleSvg tri={tri} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {options.map((o) => {
          const isPicked = picked === o.id;
          const isCorrect = o.id === correctId;
          let klass = "bubble";
          if (isCorrect && (isPicked || showAnswer)) klass += " bubble-correct";
          else if (isPicked && !isCorrect) klass += " bubble-wrong";
          else if (showAnswer) klass += " bubble-dimmed";
          return (
            <button key={o.id} disabled={disabled || locked} onClick={(e) => pick(o.id, e)} className={klass}>
              <span className="mr-2 text-violet-200 font-bold">{o.id}.</span>
              {o.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============= Triangle visual ============= */

interface TriangleSpec {
  // 三个顶点（屏幕坐标系，y 朝下）
  pts: { x: number; y: number }[];
  // 三边长度（与 pts[i]-pts[(i+1)%3] 对应）
  sideLabels: (string | null)[];
  // 三个角度数文字
  angleLabels: (string | null)[];
  // 是否是"不能围成"的摊开示意
  flat?: { segments: { x1: number; y1: number; x2: number; y2: number; label?: string }[] };
  // 标记
  rightAngle?: number; // 顶点 index
  isoceles?: boolean;
}

export function parseTriangle(tags: string[]): TriangleSpec | null {
  for (const t of tags) {
    if (t.startsWith("tri-angles:")) {
      const angles = t.slice("tri-angles:".length).split(",").map((s) => Number(s.trim()));
      if (angles.length === 3 && angles.every((a) => a > 0)) {
        return triangleFromAngles(angles as [number, number, number], tags);
      }
    }
    if (t.startsWith("tri-sides:")) {
      const sides = t.slice("tri-sides:".length).split(",").map((s) => Number(s.trim()));
      if (sides.length === 3 && sides.every((a) => a > 0)) {
        return triangleFromSides(sides as [number, number, number], tags);
      }
    }
    if (t.startsWith("tri-iso:")) {
      return triangleIsoceles(t.slice("tri-iso:".length), tags);
    }
  }
  return null;
}

const W = 360;
const H = 240;

function triangleFromAngles(angles: [number, number, number], tags: string[]): TriangleSpec {
  // 用前两个角放在底边上构造
  const [A, B, C] = angles;
  // 顶点 P0 在左，P1 在右，P2 由 A、B 决定。我们给一个固定底边长 base=240 px。
  const base = 240;
  const Arad = (A * Math.PI) / 180;
  const Brad = (B * Math.PI) / 180;
  // 边 a = 对 A 的边 = P1-P2；b = 对 B = P0-P2；c = 对 C = P0-P1 = base
  // 由正弦定理：b / sinB = c / sinC → b = base * sinB / sinC
  const Crad = Math.PI - Arad - Brad;
  const b = (base * Math.sin(Brad)) / Math.sin(Crad);
  const p0 = { x: W / 2 - base / 2, y: H / 2 + 50 };
  const p1 = { x: W / 2 + base / 2, y: H / 2 + 50 };
  const p2 = {
    x: p0.x + Math.cos(Arad) * b,
    y: p0.y - Math.sin(Arad) * b,
  };
  const fit = fitTriangle([p0, p1, p2]);
  const rightIdx = angles.findIndex((a) => Math.abs(a - 90) < 0.01);
  return {
    pts: fit,
    sideLabels: [null, null, null],
    angleLabels: angles.map((a) => `${a}°`),
    rightAngle: rightIdx >= 0 ? rightIdx : undefined,
    isoceles: tags.includes("tri-mark:isoceles") || isIsocelesAngles(angles),
  };
}

function isIsocelesAngles(a: number[]): boolean {
  const s = a.slice().sort((x, y) => x - y);
  return Math.abs(s[0]! - s[1]!) < 0.5 || Math.abs(s[1]! - s[2]!) < 0.5;
}

function triangleFromSides(sides: [number, number, number], tags: string[]): TriangleSpec {
  const [a, b, c] = sides;
  // 检查能否围成
  const sorted = sides.slice().sort((x, y) => y - x);
  const longest = sorted[0]!;
  const sumOthers = sorted[1]! + sorted[2]!;
  if (sumOthers <= longest) {
    // 摊开
    return makeFlatLayout(sides);
  }
  // 用余弦定理求顶角
  const cosA = (b * b + c * c - a * a) / (2 * b * c);
  const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
  // 把最长的边映射到 240px 底
  const targetBase = 240;
  const baseSide = Math.max(a, b, c);
  const scale = targetBase / baseSide;
  // 先按正弦定理算所有顶点（让最长边在底部）
  // 重新指定：让 sides 中最长的为底（c'=longest）
  const idxMax = sides.indexOf(longest);
  const others = sides.filter((_, i) => i !== idxMax);
  const s2 = others[0]!;
  const s3 = others[1]!;
  // 余弦：底两端角
  const cosB = (longest * longest + s2 * s2 - s3 * s3) / (2 * longest * s2);
  const B = Math.acos(Math.max(-1, Math.min(1, cosB)));
  const p0 = { x: 0, y: 0 };
  const p1 = { x: longest * scale, y: 0 };
  const p2 = {
    x: Math.cos(B) * s2 * scale,
    y: -Math.sin(B) * s2 * scale,
  };
  const fit = fitTriangle([p0, p1, p2]);
  // 边标签按 fit 后的顶点对回原边长（粗略：底=longest，左=s2，右=s3）
  return {
    pts: fit,
    sideLabels: [`${longest}cm`, `${s3}cm`, `${s2}cm`],
    angleLabels: [null, null, null],
    isoceles: tags.includes("tri-mark:isoceles") || hasEqualPair(sides),
  };
}

function hasEqualPair(s: number[]): boolean {
  const u = new Set(s);
  return u.size < s.length;
}

function makeFlatLayout(sides: [number, number, number]): TriangleSpec {
  const sorted = sides.slice().sort((x, y) => y - x);
  const longest = sorted[0]!;
  const others = sorted.slice(1);
  const total = others[0]! + others[1]!;
  const scale = Math.min(280 / longest, 200 / Math.max(total, 1));
  const startX = (W - longest * scale) / 2;
  const yA = H / 2 - 20;
  const yB = H / 2 + 30;
  return {
    pts: [],
    sideLabels: [],
    angleLabels: [],
    flat: {
      segments: [
        { x1: startX, y1: yA, x2: startX + longest * scale, y2: yA, label: `${longest}` },
        { x1: startX, y1: yB, x2: startX + others[0]! * scale, y2: yB, label: `${others[0]}` },
        {
          x1: startX + others[0]! * scale + 8,
          y1: yB,
          x2: startX + others[0]! * scale + 8 + others[1]! * scale,
          y2: yB,
          label: `${others[1]}`,
        },
      ],
    },
  };
}

function triangleIsoceles(spec: string, _tags: string[]): TriangleSpec {
  // apex=110,base=8
  const params = Object.fromEntries(spec.split(",").map((p) => p.split("=")));
  const apex = Number(params.apex ?? 60);
  const base = Number(params.base ?? 6);
  const baseAngle = (180 - apex) / 2;
  const targetBase = 240;
  const apexRad = (apex * Math.PI) / 180;
  // 左下、右下、顶点
  const baseAngleRad = (baseAngle * Math.PI) / 180;
  // 等腰：腿长 = base / (2 * sin(apex/2))
  const legLen = base / (2 * Math.sin(apexRad / 2));
  const scale = targetBase / base;
  const p0 = { x: -targetBase / 2, y: 50 };
  const p1 = { x: targetBase / 2, y: 50 };
  const p2 = {
    x: 0,
    y: 50 - Math.sin(baseAngleRad) * legLen * scale,
  };
  const fit = fitTriangle([p0, p1, p2].map((p) => ({ x: p.x + W / 2, y: p.y + 30 })));
  // p0=左底、p1=右底、p2=顶点；apex 角在 p2
  return {
    pts: fit,
    sideLabels: [`${base}`, null, null],
    angleLabels: [null, null, `${apex}°`],
    rightAngle: undefined,
    isoceles: true,
  };
}

function fitTriangle(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  // 平移并按需缩放使三角形完整居中（留 30px 边距给角度标签）
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;
  const margin = 30;
  const sx = w > 0 ? (W - margin * 2) / w : 1;
  const sy = h > 0 ? (H - margin * 2) / h : 1;
  const s = Math.min(1, sx, sy);
  // 先缩放再居中
  const scaled = pts.map((p) => ({ x: p.x * s, y: p.y * s }));
  const sMinX = Math.min(...scaled.map((p) => p.x));
  const sMinY = Math.min(...scaled.map((p) => p.y));
  const sw = Math.max(...scaled.map((p) => p.x)) - sMinX;
  const sh = Math.max(...scaled.map((p) => p.y)) - sMinY;
  const padX = (W - sw) / 2 - sMinX;
  const padY = (H - sh) / 2 - sMinY;
  return scaled.map((p) => ({ x: p.x + padX, y: p.y + padY }));
}

function TriangleSvg({ tri }: { tri: TriangleSpec }) {
  if (tri.flat) {
    return (
      <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col items-center">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[440px]">
          {tri.flat.segments.map((s, i) => {
            const colors = ["#fb7185", "#fbbf24", "#34d399"];
            return (
              <g key={i}>
                <line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={colors[i] ?? "#fff"} strokeWidth={6} strokeLinecap="round" />
                {s.label && (
                  <text x={(s.x1 + s.x2) / 2} y={s.y1 - 8} fill={colors[i] ?? "#fff"} fontSize="13" textAnchor="middle">
                    {s.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        <div className="text-xs text-rose-300 mt-2">两条短边相加 ≤ 最长边 → 摊不到一起</div>
      </div>
    );
  }
  if (tri.pts.length !== 3) return null;
  const [p0, p1, p2] = tri.pts as [
    { x: number; y: number },
    { x: number; y: number },
    { x: number; y: number },
  ];
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex justify-center">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[440px]">
        <polygon
          points={`${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`}
          fill="rgba(167,139,250,0.18)"
          stroke="#a78bfa"
          strokeWidth={3}
          strokeLinejoin="round"
        />
        {/* 边长标签：sideLabels[0] 在 p0-p1（底）；sideLabels[1] 在 p1-p2；sideLabels[2] 在 p2-p0 */}
        {tri.sideLabels.map((lab, i) => {
          if (!lab) return null;
          const a = tri.pts[i]!;
          const b = tri.pts[(i + 1) % 3]!;
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2 - 10;
          return (
            <text key={`s${i}`} x={mx} y={my} fill="#fde68a" fontSize="13" textAnchor="middle">
              {lab}
            </text>
          );
        })}
        {/* 角度标签：angleLabels[i] 在 pts[i] 处 */}
        {tri.angleLabels.map((lab, i) => {
          if (!lab) return null;
          const p = tri.pts[i]!;
          // 偏向三角形内部
          const cx = (tri.pts[0]!.x + tri.pts[1]!.x + tri.pts[2]!.x) / 3;
          const cy = (tri.pts[0]!.y + tri.pts[1]!.y + tri.pts[2]!.y) / 3;
          const dx = cx - p.x;
          const dy = cy - p.y;
          const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const off = 20;
          return (
            <text
              key={`a${i}`}
              x={p.x + (dx / len) * off}
              y={p.y + (dy / len) * off + 4}
              fill="#86efac"
              fontSize="13"
              textAnchor="middle"
            >
              {lab}
            </text>
          );
        })}
        {/* 直角符号 */}
        {tri.rightAngle != null && tri.rightAngle >= 0 && (
          <RightAngleMark p0={tri.pts[tri.rightAngle]!} p1={tri.pts[(tri.rightAngle + 1) % 3]!} p2={tri.pts[(tri.rightAngle + 2) % 3]!} />
        )}
        {/* 等腰刻度（左右两条腰） */}
        {tri.isoceles && <IsocelesMarks pts={tri.pts as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }]} />}
      </svg>
    </div>
  );
}

function RightAngleMark({ p0, p1, p2 }: { p0: { x: number; y: number }; p1: { x: number; y: number }; p2: { x: number; y: number } }) {
  const size = 12;
  const v1 = norm({ x: p1.x - p0.x, y: p1.y - p0.y });
  const v2 = norm({ x: p2.x - p0.x, y: p2.y - p0.y });
  const a = { x: p0.x + v1.x * size, y: p0.y + v1.y * size };
  const c = { x: p0.x + v2.x * size, y: p0.y + v2.y * size };
  const b = { x: a.x + v2.x * size, y: a.y + v2.y * size };
  return (
    <path
      d={`M ${a.x} ${a.y} L ${b.x} ${b.y} L ${c.x} ${c.y}`}
      stroke="#fde68a"
      strokeWidth={1.5}
      fill="none"
    />
  );
}

function IsocelesMarks({ pts }: { pts: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }] }) {
  // 在两条腰（顶点为 p2 的两条边）中点画一个小垂直刻度
  const [p0, p1, p2] = pts;
  const marks = [
    { a: p2, b: p0 },
    { a: p2, b: p1 },
  ];
  return (
    <>
      {marks.map((m, i) => {
        const mx = (m.a.x + m.b.x) / 2;
        const my = (m.a.y + m.b.y) / 2;
        const dx = m.b.x - m.a.x;
        const dy = m.b.y - m.a.y;
        const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const nx = -dy / len;
        const ny = dx / len;
        const s = 5;
        return (
          <line
            key={i}
            x1={mx + nx * s}
            y1={my + ny * s}
            x2={mx - nx * s}
            y2={my - ny * s}
            stroke="#fde68a"
            strokeWidth={2}
          />
        );
      })}
    </>
  );
}

function norm(v: { x: number; y: number }): { x: number; y: number } {
  const len = Math.max(0.001, Math.sqrt(v.x * v.x + v.y * v.y));
  return { x: v.x / len, y: v.y / len };
}
