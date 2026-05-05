/**
 * 单元解锁庆祝弹窗（v0.30.10）。
 *
 * 触发场景：
 *  1. 用户在 UnitProgress 面板手动点"解锁"按钮
 *  2. Layout boot 时检测到 UNIT_UNLOCK_SCHEDULE 自动解锁
 *
 * 视觉：
 *  - 全屏 backdrop 半透明
 *  - 居中卡片：图标 + "解锁了 UN：单元名" + 描述 + 两个 CTA
 *  - 卡片 bounce 入场动画 + 周围 6 个 sparkle 旋转闪烁
 *  - "去练一练" → /math/free-practice 顺手让她试试新解锁的 skill
 *  - "暂不练习" → 关闭 modal
 *
 * 自动解锁场景下，标题前缀是"⏰ 时间到啦！"；手动解锁前缀是"🎉"。
 */

import { Link } from "react-router-dom";

interface Props {
  unitName: string;
  unitDescription?: string;
  /** 自动解锁 = true（系统帮你打开了），手动 = false（用户自己点的） */
  isScheduled?: boolean;
  onClose: () => void;
}

export function UnitUnlockCelebration({
  unitName,
  unitDescription,
  isScheduled = false,
  onClose,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/85 backdrop-blur-sm animate-flash"
      onClick={onClose}
    >
      <div
        className="relative w-[min(420px,92vw)] rounded-3xl bg-gradient-to-br from-violet-500/30 via-fuchsia-500/20 to-pink-500/25 border border-violet-400/50 p-6 shadow-glow animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* sparkle 装饰：6 颗围着卡片 */}
        {[
          { top: "-8px", left: "10%" },
          { top: "10%", right: "-8px" },
          { bottom: "-8px", left: "20%" },
          { top: "30%", left: "-8px" },
          { bottom: "10%", right: "-8px" },
          { top: "-8px", right: "30%" },
        ].map((pos, i) => (
          <span
            key={i}
            className="absolute text-amber-300 text-xl pointer-events-none animate-sparkle"
            style={{ ...pos, animationDelay: `${i * 0.18}s` }}
            aria-hidden="true"
          >
            ✦
          </span>
        ))}

        <div className="text-center">
          <div className="text-5xl mb-2 animate-pop">
            {isScheduled ? "⏰" : "🎉"}
          </div>
          <div className="text-xs uppercase tracking-widest text-violet-200/80">
            {isScheduled ? "时间到啦！自动解锁" : "新单元解锁"}
          </div>
          <div className="font-display font-bold text-2xl text-white mt-2 leading-tight drop-shadow-glow">
            {unitName}
          </div>
          {unitDescription && (
            <div className="mt-2 text-sm text-violet-100/90 leading-relaxed">
              {unitDescription}
            </div>
          )}
          <div className="mt-3 text-xs text-violet-200/70">
            {isScheduled
              ? "课表到这天啦——这个单元已经在每日挑战和自由练里出现啦。"
              : "现在每日挑战 / 自由练会出这个单元的题啦。"}
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-xl border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 transition-colors text-sm"
          >
            知道啦
          </button>
          <Link
            to="/math/free-practice"
            onClick={onClose}
            className="flex-1 btn-primary text-sm py-2 text-center"
          >
            去练一练 →
          </Link>
        </div>
      </div>
    </div>
  );
}
