/**
 * TodayRings — Phase 2 v0.31.2 重写：Apple Watch 同心 3 环。
 *
 * 之前 v0.31.1 用 3 张并排卡片，丢失了"环"的视觉冲击力。Apple Watch 的核心
 * 是 **3 个同心圆叠在一起** —— 一眼看 3 环全圆 = 完美。
 *
 * 设计：
 *   - 大 SVG 同心 3 环（200×200 桌面 / 160×160 移动）
 *   - 每环不同半径 + 不同主色，按统一 12px stroke 画
 *   - 中心：动态——3 环全闭 → ✨✓ + sparkle；未闭 → 已闭 X/3 大字
 *   - 下方 3 个 legend chip：点哪个跳哪个模式
 *
 * 调色板（v0.31.2 视觉统一）：
 *   - 外环 闪电口算：cyan-300 → cyan-500
 *   - 中环 今日挑战：violet-400 → violet-600
 *   - 内环 今日重点：amber-300 → amber-500（和段位徽章金色呼应）
 *
 * Phase 2 doc: docs/phase2-plan.md (Axis 3) + 设计师 3 视角 critique 修复 #2
 */

import { Link } from "react-router-dom";
import { isPhase2Live } from "../lib/featureFlags";

interface RingSpec {
  id: "fluency" | "challenge" | "focus";
  icon: string;
  shortLabel: string;
  longLabel: string;
  /** 进度 0-1 */
  progress: number;
  /** chip 上显示的状态文字 */
  statusText: string;
  to: string;
  /** 主色 hex（gradient 起点） */
  hue: string;
  /** gradient 终点 */
  hue2: string;
  done: boolean;
}

export interface TodayRingsInput {
  fluencyTodayCount: number;
  challengeTodayCount: number;
  challengeTarget: number;
  focus:
    | { kind: "boss_close"; unitName: string; gap: number; targetGate: number }
    | { kind: "mistakes_due"; count: number }
    | { kind: "exam_countdown"; examName: string; days: number }
    | { kind: "all_done" }
    | { kind: "idle" };
}

export function TodayRings(input: TodayRingsInput) {
  const phase2 = isPhase2Live();
  const rings = buildRings(input, phase2);
  const closedCount = rings.filter((r) => r.done).length;
  const allDone = closedCount === 3;

  return (
    <div className="rounded-3xl border border-ink-700/40 bg-ink-900/30 px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-bold text-sm text-slate-200">今日打卡</h3>
        <span className="text-xs text-slate-400 tabular-nums">{closedCount} / 3</span>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
        {/* 同心环 SVG */}
        <ConcentricRings rings={rings} allDone={allDone} />

        {/* Legend 3 chips（点这里跳） */}
        <div className="flex-1 w-full grid grid-cols-3 sm:grid-cols-1 gap-2">
          {rings.map((r) => (
            <Link
              key={r.id}
              to={r.to}
              className={`group flex items-center gap-2 rounded-xl px-2.5 py-2 transition-colors ${
                r.done
                  ? "bg-white/[0.06] hover:bg-white/[0.10]"
                  : "bg-ink-800/40 hover:bg-white/[0.06]"
              }`}
              style={{
                borderLeft: `3px solid ${r.done ? r.hue : "transparent"}`,
              }}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0"
                style={{
                  background: `linear-gradient(135deg, ${r.hue}, ${r.hue2})`,
                }}
              >
                {r.done ? "✓" : ""}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-slate-100 truncate">
                  {r.icon} {r.shortLabel}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {r.statusText}
                </div>
              </div>
              <div className="text-slate-500 text-xs shrink-0 group-hover:text-slate-300 transition-colors">
                →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConcentricRings({ rings, allDone }: { rings: RingSpec[]; allDone: boolean }) {
  // 200x200 桌面，移动端 CSS 缩到 160
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const stroke = 14;
  const gap = 4;

  // 三层半径：外大内小，中心留 ~28px 给文字
  const radii = [
    cx - stroke / 2 - 4, // 外环 r ≈ 89
    cx - stroke - gap - stroke / 2 - 4, // 中环 r ≈ 71
    cx - 2 * (stroke + gap) - stroke / 2 - 4, // 内环 r ≈ 53
  ];

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-[160px] h-[160px] sm:w-[200px] sm:h-[200px] block"
      >
        <defs>
          {rings.map((r) => (
            <linearGradient
              key={r.id}
              id={`tr-${r.id}`}
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor={r.hue} />
              <stop offset="100%" stopColor={r.hue2} />
            </linearGradient>
          ))}
        </defs>
        {rings.map((r, i) => {
          const radius = radii[i] ?? 50;
          const c = 2 * Math.PI * radius;
          const offset = c * (1 - Math.max(0.02, r.progress)); // 至少留 2% 露弧度
          return (
            <g key={r.id}>
              {/* 底圆（暗）*/}
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth={stroke}
              />
              {/* 进度弧 */}
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={`url(#tr-${r.id})`}
                strokeWidth={stroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${cx} ${cy})`}
                className="transition-[stroke-dashoffset] duration-700"
              />
            </g>
          );
        })}
      </svg>
      {/* 中心数字 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
        {allDone ? (
          <>
            <div className="text-3xl sm:text-4xl">🎉</div>
            <div className="text-[11px] sm:text-xs text-amber-200 font-bold mt-0.5">
              今日满分
            </div>
          </>
        ) : (
          <>
            <div className="font-display font-bold text-2xl sm:text-3xl text-slate-100 leading-none tabular-nums">
              {rings.filter((r) => r.done).length}
              <span className="text-slate-400 text-base sm:text-lg">/3</span>
            </div>
            <div className="text-[10px] sm:text-xs text-slate-400 mt-0.5">
              环已闭
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function buildRings(input: TodayRingsInput, phase2: boolean): RingSpec[] {
  const fluencyDone = input.fluencyTodayCount >= 1;
  const challengeDone = input.challengeTodayCount >= input.challengeTarget;

  const fluency: RingSpec = {
    id: "fluency",
    icon: "⚡",
    shortLabel: "闪电口算",
    longLabel: "闪电口算",
    progress: Math.min(1, input.fluencyTodayCount / 1),
    statusText: fluencyDone ? "今日已练" : "60s 速算 · 今日还没",
    to: phase2 ? "/math/fluency" : "/math",
    // cyan
    hue: "#22d3ee",
    hue2: "#0891b2",
    done: fluencyDone,
  };

  const challenge: RingSpec = {
    id: "challenge",
    icon: "🎯",
    shortLabel: "今日挑战",
    longLabel: "今日挑战",
    progress: Math.min(
      1,
      input.challengeTodayCount / Math.max(1, input.challengeTarget),
    ),
    statusText: challengeDone
      ? `已完成 ${input.challengeTodayCount} 题 ✓`
      : `${input.challengeTodayCount} / ${input.challengeTarget} 题`,
    to: "/math/train",
    // violet
    hue: "#a78bfa",
    hue2: "#7c3aed",
    done: challengeDone,
  };

  const focus = buildFocus(input.focus, phase2);
  return [fluency, challenge, focus];
}

function buildFocus(
  f: TodayRingsInput["focus"],
  phase2: boolean,
): RingSpec {
  // amber 主色（呼应段位徽章）
  const amber1 = "#fcd34d";
  const amber2 = "#d97706";
  switch (f.kind) {
    case "boss_close":
      return {
        id: "focus",
        icon: "⚔️",
        shortLabel: "解锁闯关",
        longLabel: "解锁闯关",
        progress: Math.max(0, Math.min(0.85, 1 - f.gap / f.targetGate)),
        statusText: `${f.unitName} · 距开战差 ${f.gap}`,
        to: phase2 ? "/math/big-problems" : "/math/skills",
        hue: amber1,
        hue2: amber2,
        done: false,
      };
    case "mistakes_due":
      return {
        id: "focus",
        icon: "🪄",
        shortLabel: "错题复活",
        longLabel: "错题复活",
        progress: f.count > 0 ? 0.1 : 1,
        statusText: f.count > 0 ? `今日到期 ${f.count} 道` : "今日已清",
        to: "/math/mistakes",
        hue: amber1,
        hue2: amber2,
        done: f.count === 0,
      };
    case "exam_countdown":
      return {
        id: "focus",
        icon: "📅",
        shortLabel: f.examName,
        longLabel: `${f.examName}倒计`,
        progress: f.days <= 1 ? 0.95 : f.days <= 7 ? 0.6 : 0.3,
        statusText:
          f.days === 0
            ? "就是今天！"
            : f.days === 1
              ? "明天考试"
              : `还有 ${f.days} 天`,
        to: "/math/train",
        hue: amber1,
        hue2: amber2,
        done: false,
      };
    case "all_done":
      return {
        id: "focus",
        icon: "🌟",
        shortLabel: "今日满分",
        longLabel: "今日满分",
        progress: 1,
        statusText: "三环已闭，明天再来",
        to: "/math",
        hue: amber1,
        hue2: amber2,
        done: true,
      };
    case "idle":
    default:
      return {
        id: "focus",
        icon: "✨",
        shortLabel: "今日打卡",
        longLabel: "今日打卡",
        progress: 0.05,
        statusText: "随时来 · 无紧急任务",
        to: "/math",
        hue: amber1,
        hue2: amber2,
        done: false,
      };
  }
}
