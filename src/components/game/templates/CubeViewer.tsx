import { useMemo, useState } from "react";
import type { TemplateRenderProps } from "../GameShell";

/**
 * 立体观察 · CubeViewer
 *
 * 题目通过 tags 配置可视化：
 *
 *   solid:0,0,0|1,0,0|0,1,0|0,0,1
 *     一组 (x,y,z) 单位立方体坐标。x=右、y=上、z=后。
 *     渲染为等轴侧视图。
 *
 *   grid-front:3x2:1,1,1|0,1,0
 *   grid-top:3x2:1,1,1|0,0,1
 *   grid-left:2x2:1,1|0,1
 *     从正/上/左面看到的 2D 投影。WxH，行内逗号分，行间 |。
 *     1=有方块、0=空。
 *
 *   opt-solid:A=0,0,0|1,0,0+B=0,0,0|0,1,0+...
 *     单选题选项中每个选项绑定一个 3D solid。用 + 分割不同选项。
 *
 * 答案类型：number（计数题）或 choice（视图配对）。
 *
 * 用法（在 questions.ts 里）：
 *
 *   makeChoice({
 *     ...,
 *     play_as: "cube_view",
 *     tags: ["grid-front:3x2:1,1,1|1,0,0"],
 *     stem: "下面立体图形从正面看到的形状如图。最少由几个正方体搭成？",
 *     ...
 *   })
 */
export function CubeViewerPanel(props: TemplateRenderProps) {
  const { question, onFinish, triggerFx, disabled } = props;
  const tags = question.tags ?? [];
  const visuals = useMemo(() => parseVisuals(tags), [question.question_id]);
  const optionVisuals = useMemo(() => parseOptionSolids(tags), [question.question_id]);

  // 题型 1：numeric 答案
  if (question.answer.type === "number") {
    return <NumericCubeView {...props} visuals={visuals} />;
  }
  // 题型 2：choice 答案（每个选项是文本，或附带 3D 视图，或 2D 视图）
  const optionGrids = parseOptionGrids(tags);
  return (
    <ChoiceCubeView
      {...props}
      visuals={visuals}
      optionVisuals={optionVisuals}
      optionGrids={optionGrids}
      onFinish={onFinish}
      triggerFx={triggerFx}
      disabled={disabled}
      question={question}
    />
  );
}

function NumericCubeView(props: TemplateRenderProps & { visuals: ParsedVisuals }) {
  const { question, onFinish, triggerFx, disabled, visuals } = props;
  const [picked, setPicked] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const correctValue =
    question.answer.type === "number" ? question.answer.value : 0;
  const distractors = (question.distractors ?? []) as number[];
  const options = useMemo(() => {
    const arr = [correctValue, ...distractors.filter((x) => x !== correctValue)].slice(0, 4);
    return arr.sort((a, b) => a - b);
  }, [correctValue, distractors.join(",")]);

  const pick = (val: number, ev: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || locked) return;
    const ok = val === correctValue;
    setPicked(val);
    setLocked(true);
    const rect = ev.currentTarget.getBoundingClientRect();
    if (ok) triggerFx.correctAt(rect.left + rect.width / 2, rect.top, "✓");
    else triggerFx.wrongAt(rect.left + rect.width / 2, rect.top);
    window.setTimeout(() => {
      onFinish({
        answer: String(val),
        isCorrect: ok,
        partialCorrect: false,
        matchedErrorTags: ok ? [] : ["spatial_count_error"],
      });
    }, 280);
  };

  const showAnswer = disabled || locked;

  return (
    <div>
      <div className="font-display text-xl leading-snug mb-3 whitespace-pre-wrap">{question.stem}</div>
      <CubeVisuals visuals={visuals} />
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
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChoiceCubeView({
  question,
  visuals,
  optionVisuals,
  optionGrids,
  onFinish,
  triggerFx,
  disabled,
}: TemplateRenderProps & {
  visuals: ParsedVisuals;
  optionVisuals: Map<string, Cube[]>;
  optionGrids: Map<string, Grid2D>;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const options = question.options ?? [];
  const correctId = question.answer.type === "choice" ? question.answer.value : null;

  const pick = (id: string, ev: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || locked) return;
    const ok = id === correctId;
    setPicked(id);
    setLocked(true);
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
      <CubeVisuals visuals={visuals} />
      <div className="grid grid-cols-2 gap-3 mt-4">
        {options.map((o) => {
          const isPicked = picked === o.id;
          const isCorrect = o.id === correctId;
          let klass = "bubble py-3 text-left";
          if (isCorrect && (isPicked || showAnswer)) klass += " bubble-correct";
          else if (isPicked && !isCorrect) klass += " bubble-wrong";
          else if (showAnswer) klass += " bubble-dimmed";
          const optSolid = optionVisuals.get(o.id);
          const optGrid = optionGrids.get(o.id);
          return (
            <button key={o.id} disabled={disabled || locked} onClick={(e) => pick(o.id, e)} className={klass}>
              <div className="flex items-center gap-3">
                <span className="text-violet-200 font-bold">{o.id}.</span>
                {optSolid ? <SolidIso cubes={optSolid} unit={18} className="shrink-0" /> : null}
                {optGrid ? <GridSvg grid={optGrid} cell={18} /> : null}
                <span className="flex-1">{o.text}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============== Visuals ============== */

interface ParsedVisuals {
  solid?: Cube[];
  gridFront?: Grid2D;
  gridTop?: Grid2D;
  gridLeft?: Grid2D;
}

interface Cube {
  x: number;
  y: number;
  z: number;
}

interface Grid2D {
  cols: number;
  rows: number;
  cells: number[][]; // rows of 0/1
}

export function parseVisuals(tags: string[]): ParsedVisuals {
  const out: ParsedVisuals = {};
  for (const t of tags) {
    if (t.startsWith("solid:")) {
      out.solid = parseCubes(t.slice(6));
    } else if (t.startsWith("grid-front:")) {
      out.gridFront = parseGrid(t.slice("grid-front:".length));
    } else if (t.startsWith("grid-top:")) {
      out.gridTop = parseGrid(t.slice("grid-top:".length));
    } else if (t.startsWith("grid-left:")) {
      out.gridLeft = parseGrid(t.slice("grid-left:".length));
    }
  }
  return out;
}

function parseCubes(s: string): Cube[] {
  return s.split("|")
    .map((t) => t.split(",").map((n) => Number(n.trim())))
    .filter((arr) => arr.length === 3 && arr.every((n) => Number.isFinite(n)))
    .map(([x, y, z]) => ({ x: x!, y: y!, z: z! }));
}

export function parseOptionSolids(tags: string[]): Map<string, Cube[]> {
  const out = new Map<string, Cube[]>();
  for (const t of tags) {
    // opt-solid-A:0,0,0|1,0,0
    const m = /^opt-solid-([A-Z]):(.+)$/.exec(t);
    if (!m) continue;
    const cubes = parseCubes(m[2]!);
    if (cubes.length > 0) out.set(m[1]!, cubes);
  }
  return out;
}

export function parseOptionGrids(tags: string[]): Map<string, Grid2D> {
  const out = new Map<string, Grid2D>();
  for (const t of tags) {
    // opt-grid-A:2x2:1,1|1,0
    const m = /^opt-grid-([A-Z]):(.+)$/.exec(t);
    if (!m) continue;
    const g = parseGrid(m[2]!);
    if (g) out.set(m[1]!, g);
  }
  return out;
}

function parseGrid(s: string): Grid2D | undefined {
  // 形如 3x2:1,1,1|0,1,0
  const colon = s.indexOf(":");
  if (colon < 0) return undefined;
  const dim = s.slice(0, colon);
  const m = /^(\d+)x(\d+)$/.exec(dim);
  if (!m) return undefined;
  const cols = Number(m[1]);
  const rows = Number(m[2]);
  const body = s.slice(colon + 1);
  const cells = body.split("|").map((row) => row.split(",").map((n) => (Number(n) ? 1 : 0)));
  if (cells.length !== rows) return undefined;
  return { cols, rows, cells };
}

function CubeVisuals({ visuals }: { visuals: ParsedVisuals }) {
  const has = visuals.solid || visuals.gridFront || visuals.gridTop || visuals.gridLeft;
  if (!has) return null;
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-wrap items-center justify-center gap-6">
      {visuals.solid && <LabeledVisual label="立体图形"><SolidIso cubes={visuals.solid} /></LabeledVisual>}
      {visuals.gridFront && <LabeledVisual label="正面看"><GridSvg grid={visuals.gridFront} /></LabeledVisual>}
      {visuals.gridTop && <LabeledVisual label="上面看"><GridSvg grid={visuals.gridTop} /></LabeledVisual>}
      {visuals.gridLeft && <LabeledVisual label="左面看"><GridSvg grid={visuals.gridLeft} /></LabeledVisual>}
    </div>
  );
}

function LabeledVisual({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="text-xs text-slate-400 uppercase tracking-wide">{label}</div>
      {children}
    </div>
  );
}

function GridSvg({ grid, cell = 22 }: { grid: Grid2D; cell?: number }) {
  const W = grid.cols * cell + 6;
  const H = grid.rows * cell + 6;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block">
      {grid.cells.map((row, r) =>
        row.map((c, ci) => (
          <rect
            key={`${r}-${ci}`}
            x={3 + ci * cell}
            y={3 + r * cell}
            width={cell - 1}
            height={cell - 1}
            fill={c ? "rgba(167,139,250,0.45)" : "rgba(255,255,255,0.05)"}
            stroke={c ? "#a78bfa" : "rgba(255,255,255,0.15)"}
            strokeWidth={c ? 1.5 : 1}
            rx={2}
          />
        )),
      )}
    </svg>
  );
}

/**
 * 等轴侧视图：x 向右、y 向上、z 向"屏幕里"（往后）。
 * 屏幕坐标：sx = (x - z) * cos30 * u；sy = (x + z) * sin30 * u - y * u
 *
 * 每个 cube 只画"暴露在外"的面（邻居不存在 → 画；邻居存在 → 不画）。
 * 这样无论形状如何，看上去都是完整闭合的立体——内部不会出现"洞"。
 */
export function SolidIso({ cubes, unit = 28, className = "" }: { cubes: Cube[]; unit?: number; className?: string }) {
  if (cubes.length === 0) return null;
  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = Math.sin(Math.PI / 6);
  const xs = cubes.map((c) => (c.x - c.z) * cos30 * unit);
  const ys = cubes.map((c) => (c.x + c.z) * sin30 * unit - c.y * unit);
  const minX = Math.min(...xs) - cos30 * unit;
  const maxX = Math.max(...xs) + cos30 * unit;
  const minY = Math.min(...ys) - unit;
  const maxY = Math.max(...ys) + sin30 * unit + unit;
  const W = maxX - minX + 8;
  const H = maxY - minY + 8;

  const cubeSet = new Set(cubes.map((c) => `${c.x},${c.y},${c.z}`));
  const has = (x: number, y: number, z: number) => cubeSet.has(`${x},${y},${z}`);

  // 画顺序（painter）：先画后/下/左面（背朝观察者），再画前/上/右面（朝观察者）。
  // 跨 cube 排序：z 大的先 → 朝观察者方向后画（覆盖效果正确）。
  const sorted = cubes.slice().sort((a, b) => {
    if (b.z !== a.z) return b.z - a.z;
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  return (
    <svg
      viewBox={`${minX - 4} ${minY - 4} ${W} ${H}`}
      width={W}
      height={H}
      className={`block ${className}`}
    >
      {sorted.map((c, i) => (
        <CubeShape
          key={i}
          c={c}
          unit={unit}
          showTop={!has(c.x, c.y + 1, c.z)}
          showBottom={!has(c.x, c.y - 1, c.z)}
          showFront={!has(c.x, c.y, c.z - 1)}
          showBack={!has(c.x, c.y, c.z + 1)}
          showRight={!has(c.x + 1, c.y, c.z)}
          showLeft={!has(c.x - 1, c.y, c.z)}
        />
      ))}
    </svg>
  );
}

function CubeShape({
  c,
  unit,
  showTop = true,
  showBottom = false,
  showFront = true,
  showBack = false,
  showRight = true,
  showLeft = false,
}: {
  c: Cube;
  unit: number;
  showTop?: boolean;
  showBottom?: boolean;
  showFront?: boolean;
  showBack?: boolean;
  showRight?: boolean;
  showLeft?: boolean;
}) {
  const cos30 = Math.cos(Math.PI / 6);
  const sin30 = Math.sin(Math.PI / 6);
  const ox = (c.x - c.z) * cos30 * unit;
  const oy = (c.x + c.z) * sin30 * unit - c.y * unit;

  const v = (dx: number, dy: number, dz: number) => ({
    x: ox + (dx - dz) * cos30 * unit,
    y: oy + (dx + dz) * sin30 * unit - dy * unit,
  });

  // 6 个面的顶点
  const top = [v(0, 1, 0), v(1, 1, 0), v(1, 1, 1), v(0, 1, 1)];        // y=1, 朝上
  const bottom = [v(0, 0, 0), v(1, 0, 0), v(1, 0, 1), v(0, 0, 1)];     // y=0, 朝下
  const front = [v(0, 0, 0), v(1, 0, 0), v(1, 1, 0), v(0, 1, 0)];      // z=0, 朝前
  const back = [v(0, 0, 1), v(1, 0, 1), v(1, 1, 1), v(0, 1, 1)];       // z=1, 朝后
  const right = [v(1, 0, 0), v(1, 0, 1), v(1, 1, 1), v(1, 1, 0)];      // x=1, 朝右
  const left = [v(0, 0, 0), v(0, 0, 1), v(0, 1, 1), v(0, 1, 0)];       // x=0, 朝左

  const pts = (arr: { x: number; y: number }[]) =>
    arr.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const stroke = "#1e1b4b";

  // 颜色：朝向观察者的 3 个面亮，背面 3 个面暗（统一暗紫，不再区分细节）
  return (
    <g>
      {/* 暗面：先画（被前面盖住的不会显示） */}
      {showBack && <polygon points={pts(back)} fill="#3b1e7a" stroke={stroke} strokeWidth={1} />}
      {showBottom && <polygon points={pts(bottom)} fill="#3b1e7a" stroke={stroke} strokeWidth={1} />}
      {showLeft && <polygon points={pts(left)} fill="#5b21b6" stroke={stroke} strokeWidth={1} />}
      {/* 亮面：后画（覆盖在暗面之上） */}
      {showTop && <polygon points={pts(top)} fill="#c4b5fd" stroke={stroke} strokeWidth={1} />}
      {showFront && <polygon points={pts(front)} fill="#a78bfa" stroke={stroke} strokeWidth={1} />}
      {showRight && <polygon points={pts(right)} fill="#7c3aed" stroke={stroke} strokeWidth={1} />}
    </g>
  );
}

