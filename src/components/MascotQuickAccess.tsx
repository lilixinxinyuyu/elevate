/**
 * v0.35.12 iter 42 (爸爸反馈): 小进 quick-access 浮动按钮.
 *
 * 爸爸: "把小进的按钮或形象放在 mini-games 里面, 再需要的时候可以快速唤醒小进"
 *   → 每个 mini-game 页右下角放这个浮动按钮.
 *
 * 行为:
 *   - 默认收起态: 圆形 panda 头像 (MascotAvatar sm), 浮在右下
 *   - 点开: popover 显示
 *       · 小进 avatar + 一句招呼 (按 context 不同)
 *       · 2-3 个快速动作:
 *           - "做几道暖身题"  → /math/train?mode=normal&fresh=...
 *           - "🐼 看小进 3D"  → /math/mascot3d
 *           - "回首页 / 备考中心"
 *   - 不放任何 LLM call (省钱, MVP), 后续若装 hooks 再扩
 *
 * Usage: 任何 mini-game 页底部 <MascotQuickAccess context="strengthen" />
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MascotAvatar } from "./MascotAvatar";

export type MascotContext =
  | "strengthen"      // 强化挑战
  | "find_mistakes"   // 错题侦探
  | "base_systems"    // 进制小课堂
  | "tricks"          // 巧算工具箱
  | "radar"           // 脑力雷达
  | "exam_prep"       // 期末备考
  | "mock_report"     // mock 报告
  | "boss"            // 闯关
  | "default";

const GREETINGS: Record<MascotContext, string> = {
  strengthen: "强化挑战是练弱点, 稳一点 ✊",
  find_mistakes: "侦探题练眼力, 慢慢看细节 🔍",
  base_systems: "进制要画出来才记得住, 别只看 📐",
  tricks: "巧算秘技用 1-2 个就够, 不必全记 🧮",
  radar: "雷达不是分数, 是看哪儿需要练 📊",
  exam_prep: "备考不焦虑, 一次 30 题就够 📝",
  mock_report: "看错题就好, 不用纠结分数 💪",
  boss: "Boss 题难, 错了不扣 streak 🐺",
  default: "需要我陪你做几道题?",
};

interface Props {
  context?: MascotContext;
  /** 可选: 浮动位置覆盖 (默认 bottom-right) */
  position?: "bottom-right" | "bottom-left";
}

export function MascotQuickAccess({ context = "default", position = "bottom-right" }: Props) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const posClass =
    position === "bottom-right"
      ? "bottom-4 right-4"
      : "bottom-4 left-4";

  return (
    <>
      {/* 浮动收起按钮 */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="唤起小进"
          className={`fixed ${posClass} z-40 w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-500/40 border-2 border-white/30 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform`}
        >
          <MascotAvatar size="sm" fallback="🐼" />
          <span className="sr-only">唤起小进姐姐</span>
        </button>
      )}

      {/* 展开 popover */}
      {open && (
        <div className={`fixed ${posClass} z-40 w-72 rounded-2xl bg-slate-900/95 backdrop-blur border-2 border-purple-400/40 shadow-xl shadow-purple-500/30 p-3 space-y-3`}>
          <div className="flex items-start gap-2">
            <MascotAvatar size="md" fallback="🐼" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-purple-100">小进姐姐</div>
              <div className="text-xs text-purple-200/80 leading-snug">{GREETINGS[context]}</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="收起"
              className="text-slate-400 hover:text-slate-200 text-lg leading-none px-1"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate(`/math/train?fresh=${Date.now()}`);
              }}
              className="text-xs text-left px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-400/30 text-emerald-100 hover:bg-emerald-500/30 transition-colors"
            >
              ✨ 做几道暖身题 (今日挑战)
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/math/mascot3d");
              }}
              className="text-xs text-left px-3 py-2 rounded-lg bg-purple-500/15 border border-purple-400/30 text-purple-100 hover:bg-purple-500/30 transition-colors"
            >
              🐼 看小进 3D (打打招呼)
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/math/exam-prep");
              }}
              className="text-xs text-left px-3 py-2 rounded-lg bg-indigo-500/15 border border-indigo-400/30 text-indigo-100 hover:bg-indigo-500/30 transition-colors"
            >
              📝 去期末备考中心
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate("/math");
              }}
              className="text-xs text-left px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-500/30 text-slate-200 hover:bg-slate-800 transition-colors"
            >
              🏠 回首页
            </button>
          </div>

          <div className="text-[10px] text-slate-500 text-center">
            浮动按钮可点 × 收起 · 不挡操作
          </div>
        </div>
      )}
    </>
  );
}
