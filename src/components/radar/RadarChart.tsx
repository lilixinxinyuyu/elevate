/**
 * v0.35.5 (iter 39 P1-4): 脑力雷达 SVG 五边形 chart.
 * 0 依赖, 自写. 5 顶点 = 5 维度.
 */
import type { RadarDimension } from "../../core/brainpowerRadar";

interface Props {
  dimensions: RadarDimension[];
  size?: number;
}

export function RadarChart({ dimensions, size = 280 }: Props) {
  const n = dimensions.length;
  if (n < 3) return null; // 需要至少 3 个顶点
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 40; // 留 padding 给 label

  // 每个顶点的角度 (从顶部开始, 逆时针)
  function point(idx: number, ratio: number): [number, number] {
    const angle = (idx / n) * Math.PI * 2 - Math.PI / 2; // -π/2 = 12 点钟方向
    return [
      cx + Math.cos(angle) * radius * ratio,
      cy + Math.sin(angle) * radius * ratio,
    ];
  }

  // 网格 5 层 (20%/40%/60%/80%/100%)
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1.0];

  // value polygon 各顶点
  const valuePolygon = dimensions.map((d, i) => point(i, Math.max(0.05, d.value))).map(([x, y]) => `${x},${y}`).join(" ");

  return (
    <div className="flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="脑力雷达图">
        {/* 网格五边形 */}
        {gridLevels.map((level, gi) => {
          const pts = dimensions.map((_, i) => point(i, level)).map(([x, y]) => `${x},${y}`).join(" ");
          return (
            <polygon
              key={gi}
              points={pts}
              fill="none"
              stroke="rgba(99, 102, 241, 0.2)"
              strokeWidth={gi === gridLevels.length - 1 ? 1.5 : 1}
            />
          );
        })}
        {/* 从中心到各顶点的辐射线 */}
        {dimensions.map((_, i) => {
          const [px, py] = point(i, 1);
          return (
            <line
              key={`spoke-${i}`}
              x1={cx} y1={cy} x2={px} y2={py}
              stroke="rgba(99, 102, 241, 0.15)"
              strokeWidth={1}
            />
          );
        })}
        {/* 数据多边形 */}
        <polygon
          points={valuePolygon}
          fill="rgba(99, 102, 241, 0.4)"
          stroke="rgb(129, 140, 248)"
          strokeWidth={2}
        />
        {/* 顶点 + icon + label */}
        {dimensions.map((d, i) => {
          const [px, py] = point(i, 1.18); // label 在轮廓外
          const [dpx, dpy] = point(i, Math.max(0.05, d.value));
          return (
            <g key={d.id}>
              <circle cx={dpx} cy={dpy} r={4} fill="rgb(129, 140, 248)" />
              <text
                x={px}
                y={py}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="22"
              >
                {d.icon}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
