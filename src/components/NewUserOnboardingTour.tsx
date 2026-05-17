/**
 * NewUserOnboardingTour — v0.34.73 iter 7
 *
 * 第一次登录 + 0 道 attempts 的新同学进 SubjectPicker 时弹一个 3 步引导卡:
 *   1. 怎么开始 (点学科卡)
 *   2. 怎么得分 (⚡ 速度奖励, 勋章解锁)
 *   3. 错题怎么办 (间隔重做, 不死记)
 *
 * 关掉后 localStorage 记 xiaojinapp.tutorial.shown=ts, 24h 内不再弹.
 * 用户也可以 "跳过" 立即关.
 *
 * 不阻塞 — overlay 显示在 SubjectPicker 之上, 关掉就能正常用.
 *
 * 触发条件 (任一不满足都不弹):
 *   - LS xiaojinapp.tutorial.shown 没有, 或 timestamp > 30 天 (重新教)
 *   - db.attempts 空 (新用户没做过题)
 */

import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { useDisplayName } from "../lib/displayName";

const SHOWN_KEY = "xiaojinapp.tutorial.shown";
const REVISIT_AFTER_MS = 30 * 86_400_000; // 30 天

interface Step {
  emoji: string;
  title: string;
  body: string;
}

function buildSteps(displayName: string): Step[] {
  return [
    {
      emoji: "👋",
      title: `${displayName === "同学" ? "" : displayName + ", "}欢迎来到小进`,
      body: "下面 3 个学科卡 — 数学 / 语文 / 英语 — 点一个就能开始练。先随便玩, 不会扣分。",
    },
    {
      emoji: "⚡",
      title: "速度 + 准确 = 闪电勋章",
      body: "答对越快 ⚡ 越多 (3⚡ 闪电 +5 / 2⚡ 迅速 +3 / 1⚡ 及时 +2)。连续答对会叠 combo, 解锁特别勋章 🏅。",
    },
    {
      emoji: "📚",
      title: "答错不可怕 — 错题本帮你复习",
      body: "做错的题自动进 错题本, 第 1/3/7/14/30 天间隔出现让你再做。再答对 = 真学会, 不是死记。",
    },
  ];
}

function shouldShowTour(): boolean {
  try {
    const v = localStorage.getItem(SHOWN_KEY);
    if (!v) return true;
    const ts = Number(v);
    if (!Number.isFinite(ts)) return true;
    return Date.now() - ts > REVISIT_AFTER_MS;
  } catch {
    return false;
  }
}

function markTourShown() {
  try {
    localStorage.setItem(SHOWN_KEY, String(Date.now()));
  } catch { /* */ }
}

export function NewUserOnboardingTour() {
  const displayName = useDisplayName();
  const [open, setOpen] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);

  // 检查 attempts 数, 0 才弹 (老用户即使清 LS 也不会再弹)
  const attemptsCount = useLiveQuery(() => db.attempts.count(), [], 0);

  useEffect(() => {
    if (attemptsCount == null) return;
    if (attemptsCount > 0) return;
    if (!shouldShowTour()) return;
    // v0.34.74: 延迟 1800ms 弹 — 让 ProfileGate 先弹 (它 800ms+网络拉 ~500ms);
    // 之前 600ms 抢了 ProfileGate 焦点, e2e 验证发现两个 modal 重叠. 现在
    // ProfileGate 先弹, 用户填完 / 跳过后 Tour 再出现.
    const t = window.setTimeout(() => setOpen(true), 1800);
    return () => window.clearTimeout(t);
  }, [attemptsCount]);

  if (!open) return null;

  const steps = buildSteps(displayName);
  const step = steps[stepIdx]!;
  const isLast = stepIdx === steps.length - 1;
  const finish = () => {
    markTourShown();
    setOpen(false);
  };
  const next = () => {
    if (isLast) finish();
    else setStepIdx((i) => i + 1);
  };
  // v0.34.74: 用户从任何路径关 Tour (跳过 / 开始练习 / 后面所有 dismiss) 都标 shown.
  // 之前只有点 "开始练习 →" 才 markTourShown, 用户跳过后再回来又弹一次很烦.
  const skipAndMark = () => {
    markTourShown();
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[900] bg-black/70 flex items-center justify-center p-4 animate-slide-up"
      style={{ backdropFilter: "blur(4px)" }}
    >
      <div className="card-glow max-w-sm w-full bg-slate-900/95 border-violet-400/40 p-5">
        {/* Step 进度 dots */}
        <div className="flex justify-center gap-1.5 mb-3">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === stepIdx
                  ? "w-8 bg-violet-300"
                  : i < stepIdx
                    ? "w-2 bg-emerald-400/60"
                    : "w-2 bg-slate-700"
              }`}
            />
          ))}
        </div>

        <div className="text-5xl text-center mb-3">{step.emoji}</div>
        <div className="font-display font-bold text-violet-100 text-xl text-center mb-2">
          {step.title}
        </div>
        <div className="text-sm text-slate-200 text-center leading-relaxed mb-4">
          {step.body}
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={skipAndMark}
            className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1.5"
          >
            跳过
          </button>
          <div className="text-[10px] text-slate-500">
            {stepIdx + 1} / {steps.length}
          </div>
          <button
            type="button"
            onClick={next}
            className="text-sm px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-400 text-white font-bold transition-colors"
          >
            {isLast ? "开始练习 →" : "下一步 →"}
          </button>
        </div>
      </div>
    </div>
  );
}
