/**
 * TodayRings — Phase 2 v0.31.1 Hero 底部"今日 3 环"。
 *
 * 取代之前 Hero 底部 4 个 chip（10 天连续 / 今日已做 / 76% 准 / 距期中 X 天），
 * 给 Selena 一个明确的"今天该做什么"指南。
 *
 * 3 环：
 *   1. ⚡ 闪电口算 — 今日是否做过 ≥ 1 局 60s 速算
 *   2. 🎯 今日挑战 — 今日已做题数 / 15 道（≥ 15 完成）
 *   3. 🏆 今日重点 — 动态切换：
 *        优先 1: 距下一个闯关解锁还差多少分（关锁着且接近时显示）
 *        优先 2: 今日错题到期 N 道
 *        优先 3: 距期中 / 期末倒计天数
 *        优先 4: 已 3 环全闭（"今日满分 ✓"）
 *
 * 视觉：3 列横排 SVG 圆环 + 标签，移动端可压缩到 48px 圆。
 * 每环可点 → 跳到对应模式。
 *
 * 关键约束（吸取上次 Hero 改造经验）：
 *   - 不破坏现有 Hero 主结构（XP 大数 + 段位徽章）
 *   - 整合进 chip 行的位置（Home.tsx 调用方负责删除原 chip 行）
 *   - 4-base grid 节奏一致
 */

import { Link } from "react-router-dom";
import { isPhase2Live } from "../lib/featureFlags";

interface RingData {
  id: "fluency" | "challenge" | "focus";
  icon: string;
  label: string;
  /** 进度比例 0-1 */
  progress: number;
  /** 中央显示的状态文字（≤ 5 字符） */
  centerText: string;
  /** 副标签（小字） */
  subtext: string;
  /** 点击跳转 URL */
  to: string;
  /** 环颜色 */
  color: string;
  /** 是否完成（决定环饱和度 + 选中样式） */
  done: boolean;
}

export interface TodayRingsInput {
  /** 闪电口算今日 session 数 */
  fluencyTodayCount: number;
  /** 今日挑战已做题数 */
  challengeTodayCount: number;
  /** 今日挑战目标题数 */
  challengeTarget: number;
  /** 今日重点 ring 上下文 */
  focus:
    | { kind: "boss_close"; unitName: string; gap: number; targetGate: number }
    | { kind: "mistakes_due"; count: number }
    | { kind: "exam_countdown"; examName: string; days: number }
    | { kind: "all_done" }
    | { kind: "idle" };
}

export function TodayRings(input: TodayRingsInput) {
  const phase2 = isPhase2Live();

  const fluency: RingData = {
    id: "fluency",
    icon: "⚡",
    label: "闪电口算",
    progress: Math.min(1, input.fluencyTodayCount / 1), // 1 局即满
    centerText: input.fluencyTodayCount >= 1 ? "✓" : "0/1",
    subtext: input.fluencyTodayCount >= 1 ? "今日已练" : "60s 速算",
    to: phase2 ? "/math/fluency" : "/math",
    color: "from-cyan-400 to-sky-400",
    done: input.fluencyTodayCount >= 1,
  };

  const challenge: RingData = {
    id: "challenge",
    icon: "🎯",
    label: "今日挑战",
    progress: Math.min(1, input.challengeTodayCount / Math.max(1, input.challengeTarget)),
    centerText:
      input.challengeTodayCount >= input.challengeTarget
        ? "✓"
        : `${input.challengeTodayCount}/${input.challengeTarget}`,
    subtext:
      input.challengeTodayCount >= input.challengeTarget ? "今日完成" : "目标 15 题",
    to: "/math/train",
    color: "from-violet-400 to-fuchsia-400",
    done: input.challengeTodayCount >= input.challengeTarget,
  };

  const focus = focusRing(input.focus, phase2);

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <RingCard ring={fluency} />
      <RingCard ring={challenge} />
      <RingCard ring={focus} />
    </div>
  );
}

function focusRing(f: TodayRingsInput["focus"], phase2: bool): RingData {
  switch (f.kind) {
    case "boss_close":
      return {
        id: "focus",
        icon: "🏆",
        label: "解锁闯关",
        progress: Math.max(0, Math.min(1, 1 - f.gap / f.targetGate)),
        centerText: `差${f.gap}`,
        subtext: f.unitName,
        to: phase2 ? "/math/big-problems" : "/math/skills",
        color: "from-amber-400 to-orange-400",
        done: false,
      };
    case "mistakes_due":
      return {
        id: "focus",
        icon: "🪄",
        label: "错题复活",
        progress: f.count > 0 ? 0 : 1,
        centerText: f.count > 0 ? `${f.count}` : "✓",
        subtext: f.count > 0 ? "今日到期" : "已复活",
        to: "/math/mistakes",
        color: "from-rose-400 to-pink-400",
        done: f.count === 0,
      };
    case "exam_countdown":
      return {
        id: "focus",
        icon: "📅",
        label: f.examName,
        progress: 0.5,
        centerText: `${f.days}天`,
        subtext: f.days === 0 ? "就是今天！" : f.days === 1 ? "明天考试" : "倒计中",
        to: "/math/train",
        color: "from-emerald-400 to-teal-400",
        done: false,
      };
    case "all_done":
      return {
        id: "focus",
        icon: "🌟",
        label: "今日满分",
        progress: 1,
        centerText: "✓",
        subtext: "三环已闭",
        to: "/math",
        color: "from-amber-400 to-yellow-300",
        done: true,
      };
    case "idle":
    default:
      return {
        id: "focus",
        icon: "✨",
        label: "今日打卡",
        progress: 0,
        centerText: "—",
        subtext: "随时来",
        to: "/math",
        color: "from-slate-500 to-slate-400",
        done: false,
      };
  }
}

// 用 alias type 避免 IIFE 写法，TS 才能 infer
type bool = boolean;

function RingCard({ ring }: { ring: RingData }) {
  const size = 64;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - ring.progress);

  return (
    <Link
      to={ring.to}
      className={`flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 transition-colors ${
        ring.done ? "bg-white/[0.06] border border-white/10" : "bg-ink-900/40 border border-ink-700/50 hover:bg-white/[0.04]"
      }`}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="absolute inset-0"
        >
          <defs>
            <linearGradient id={`ring-grad-${ring.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="currentColor" className={`text-${(ring.color.split(" ")[0] ?? "").replace("from-", "")}`} />
              <stop offset="100%" stopColor="currentColor" className={`text-${(ring.color.split(" ")[1] ?? "").replace("to-", "")}`} />
            </linearGradient>
          </defs>
          {/* 底圆（暗）*/}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={stroke}
          />
          {/* 进度弧 */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={`url(#ring-grad-${ring.id})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className={`transition-[stroke-dashoffset] duration-700 bg-gradient-to-br ${ring.color}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-base leading-none">{ring.icon}</div>
          <div className="text-[10px] tabular-nums text-slate-200 font-bold mt-0.5">
            {ring.centerText}
          </div>
        </div>
      </div>
      <div className="text-[11px] text-slate-200 font-bold leading-none text-center">{ring.label}</div>
      <div className="text-[10px] text-slate-400 leading-none text-center truncate max-w-full px-1">
        {ring.subtext}
      </div>
    </Link>
  );
}
