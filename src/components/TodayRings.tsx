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
import { useEffect, useRef, useState } from "react";
import { isPhase2Live } from "../lib/featureFlags";
import { DAILY_REVIVE_TARGET } from "../lib/mistakeSchedule";

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
    /**
     * v0.31.58: boss_close 老逻辑（mastery 接近解锁阈值才显示）已删 —
     * Selena 已经解锁所有 boss 后这环就消失。换成"今日闯关赢 ≥1 星"，
     * 真正每天可做：随便挑一关再打，得 1 颗星即闭环。
     */
    | { kind: "boss_star_today"; starsToday: number; target: number }
    /**
     * v0.31.69: 每日复活配额 + 自动分散积压。
     *  - count: 当前到期数（已经过 service.spreadOverflowDueMistakes 规整，
     *    一般 ≤ DAILY_REVIVE_TARGET，除非新进错题刚好让总量回升）
     *  - revivedToday: 今日已推进的到期错题数
     *  - encourageMore: 闭环后是否鼓励继续做（>70% accuracy + 比 estimated 快 ≥20%）
     * 闭环规则：revivedToday >= min(target, totalDueToday)；不再要求"清零所有"。
     */
    | { kind: "mistakes_due"; count: number; revivedToday: number; encourageMore: boolean }
    | { kind: "exam_countdown"; examName: string; days: number }
    | { kind: "all_done" }
    | { kind: "idle" };
}

export function TodayRings(input: TodayRingsInput) {
  const phase2 = isPhase2Live();
  const rings = buildRings(input, phase2);
  const closedCount = rings.filter((r) => r.done).length;
  const allDone = closedCount === 3;

  // v0.31.4：检测哪些环本次刷新刚刚闭合 — 触发 sparkle 庆祝
  const justClosedRef = useRef<Set<string>>(new Set());
  const lastDoneSetRef = useRef<Set<string>>(new Set());
  // v0.31.43: 首次 render 不算"新闭" — 否则页面初次加载已 done 的环会持续 sparkle
  const initializedRef = useRef(false);
  const [pulseId, setPulseId] = useState<string | null>(null);
  useEffect(() => {
    const cur = new Set(rings.filter((r) => r.done).map((r) => r.id));
    if (!initializedRef.current) {
      lastDoneSetRef.current = cur;
      initializedRef.current = true;
      return;
    }
    const prev = lastDoneSetRef.current;
    for (const id of cur) {
      if (!prev.has(id)) justClosedRef.current.add(id);
    }
    lastDoneSetRef.current = cur;
    // 取第一个新闭合的环触发动画
    const newly = rings.find((r) => r.done && justClosedRef.current.has(r.id));
    if (newly) {
      setPulseId(newly.id);
      const t = window.setTimeout(() => {
        setPulseId(null);
        justClosedRef.current.delete(newly.id);
      }, 900);
      return () => window.clearTimeout(t);
    }
  }, [rings.map((r) => `${r.id}:${r.done}`).join(",")]);

  return (
    <div className="rounded-3xl border border-ink-700/40 bg-ink-900/30 px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display font-bold text-sm text-slate-200">今日打卡</h3>
        <span className="text-xs text-slate-400 tabular-nums">{closedCount} / 3</span>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
        {/* 同心环 SVG */}
        <ConcentricRings rings={rings} allDone={allDone} pulseId={pulseId} />

        {/* Legend 3 chips（点这里跳） — v0.31.44 改成 flex column 防止 mobile 被截断 */}
        <div className="flex-1 w-full flex flex-col gap-2">
          {rings.map((r) => (
            <Link
              key={r.id}
              to={r.to}
              // v0.31.3：未完成的 chip 视觉权重更高（让 Selena 注意到剩下的事）
              //   - 已完成：低饱和 + 极弱 ✓ 提示
              //   - 未完成：染主色淡背景 + 实心左色条 + 更亮文字
              className={`group flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors ${
                r.done
                  ? "bg-white/[0.03] hover:bg-white/[0.06]"
                  : "hover:bg-white/[0.05]"
              }`}
              style={{
                borderLeft: `3px solid ${r.hue}`,
                background: r.done
                  ? undefined
                  : `linear-gradient(90deg, ${r.hue}1F, transparent 70%)`,
              }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] shrink-0"
                style={{
                  background: r.done
                    ? `${r.hue}30`
                    : `linear-gradient(135deg, ${r.hue}, ${r.hue2})`,
                  color: r.done ? r.hue : "#fff",
                }}
              >
                {r.done ? "✓" : r.icon}
              </div>
              <div className="flex-1 min-w-0">
                {/* v0.31.4: 完成态 chip 文字从 slate-400/500 提到 slate-200/300，
                    避免读不清像 bug；用 ✓ 高亮 + 主色 icon 球区分而非靠文字暗化 */}
                <div className={`text-xs font-bold truncate ${r.done ? "text-slate-200" : "text-slate-100"}`}>
                  {r.shortLabel}
                </div>
                <div className={`text-[10px] truncate ${r.done ? "text-slate-300" : "text-slate-300"}`}>
                  {r.statusText}
                </div>
              </div>
              <div className={`text-xs shrink-0 group-hover:text-slate-200 transition-colors ${r.done ? "text-slate-500" : "text-slate-400"}`}>
                →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function ConcentricRings({
  rings,
  allDone,
  pulseId,
}: {
  rings: RingSpec[];
  allDone: boolean;
  pulseId: string | null;
}) {
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
          // v0.31.4：min progress 提到 9% — 6% 时 round cap 还是看着像"小帽子"。
          // 同时 cap 改 butt（平直），让短弧不再像断头。
          const offset = c * (1 - Math.max(0.09, r.progress));
          // v0.31.3：底圈染主色（10% 透明度）让每环都有"自己的颜色识别"，
          // 不再统一暗灰——视觉上 3 环始终可辨认
          return (
            <g key={r.id}>
              {/* 底圆（染主色弱光）*/}
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={r.hue}
                strokeOpacity={0.18}
                strokeWidth={stroke}
              />
              {/* 进度弧 — v0.31.4：r.progress >= 0.5 才用 round cap，否则用 butt
                   避免短弧的圆头看起来像断了的小帽子 */}
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={`url(#tr-${r.id})`}
                strokeWidth={stroke}
                strokeLinecap={r.progress >= 0.5 ? "round" : "butt"}
                strokeDasharray={c}
                strokeDashoffset={offset}
                transform={`rotate(-90 ${cx} ${cy})`}
                className={`transition-[stroke-dashoffset] duration-700 ${
                  pulseId === r.id ? "animate-pulse-bar" : ""
                }`}
                opacity={r.done ? 0.85 : 1}
              />
              {/* v0.31.4：环刚闭合时撒 12 颗 sparkle 绕一圈 */}
              {pulseId === r.id && (
                <g>
                  {Array.from({ length: 12 }).map((_, k) => {
                    const angle = (k / 12) * 2 * Math.PI - Math.PI / 2;
                    const px = cx + Math.cos(angle) * radius;
                    const py = cy + Math.sin(angle) * radius;
                    return (
                      <circle
                        key={k}
                        cx={px}
                        cy={py}
                        r={3}
                        fill={r.hue2}
                        className="animate-sparkle"
                        style={{ animationDelay: `${(k / 12) * 0.4}s` }}
                      />
                    );
                  })}
                </g>
              )}
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
    // v0.31.3：完成时不再露累计 N 题（404 题这种数字反而像 bug）—— 简化为 "今日完成 ✓"
    statusText: challengeDone
      ? `今日完成 ✓`
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
    case "boss_star_today": {
      // v0.31.58: 每日可做 — 闯关任意一关，拿 ≥1 星就闭环。
      // 如果今日已 ≥target 星：done=true，进度满，celebratory 文案；
      // 否则：去闯关赢星，进度 0（避免假光圈骗孩子）。
      const done = f.starsToday >= f.target;
      return {
        id: "focus",
        icon: done ? "🏆" : "⚔️",
        shortLabel: "闯关赢星",
        longLabel: "闯关赢星",
        progress: done ? 1 : 0,
        statusText: done
          ? `今日已得 ${f.starsToday} ⭐`
          : `去闯关赢 ${f.target} 颗星`,
        to: phase2 ? "/math/big-problems" : "/math/skills",
        hue: amber1,
        hue2: amber2,
        done,
      };
    }
    case "mistakes_due": {
      // v0.31.69: 每日复活目标 = min(10, totalDueToday)。多余到期题已被
      // spreadOverflowDueMistakes 推到未来 7 天，这里只算今日工作量。
      const totalToday = f.count + f.revivedToday;
      const targetToday = Math.min(DAILY_REVIVE_TARGET, totalToday);
      const done = f.revivedToday >= targetToday && targetToday > 0;
      const ratio = targetToday > 0 ? f.revivedToday / targetToday : 1;
      const statusText = (() => {
        if (totalToday === 0) return "今日已清";
        if (done && f.encourageMore) return `🔥 状态超好！再来 10 道？`;
        if (done) return `今日已闭 ✓（队列还有 ${f.count} 道，明天再战）`;
        if (f.revivedToday > 0)
          return `复活 ${f.revivedToday} / ${targetToday} 道`;
        return `今日目标 ${targetToday} 道`;
      })();
      return {
        id: "focus",
        icon: done ? "✨" : "🪄",
        shortLabel: "错题复活",
        longLabel: "错题复活",
        progress: done ? 1 : Math.max(0.1, ratio),
        statusText,
        to: "/math/mistakes",
        hue: amber1,
        hue2: amber2,
        done,
      };
    }
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
