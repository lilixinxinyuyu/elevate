/**
 * 顶部漂浮指示器：显示"小进正在后台为你出题…"。
 *
 * 挂在 Layout 顶部。当 bgGen 状态非 idle 时显示。
 *  - running: 紫色 pulse + skill 名 + 已用秒数
 *  - success: 绿色，显示几秒后自动隐藏
 *  - failed: 红色，让用户去管理页
 */

import { useEffect, useState } from "react";
import { useBgGenStatus } from "../lib/bgGen";
import { MascotAvatar } from "./MascotAvatar";

export function BgGenIndicator() {
  const status = useBgGenStatus();
  const [elapsed, setElapsed] = useState(0);

  // running 时每秒更新计时
  useEffect(() => {
    if (status.state !== "running") return;
    const startedAt = status.startedAt;
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [status]);

  if (status.state === "idle") return null;

  if (status.state === "running") {
    return (
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-40 max-w-[92%] sm:max-w-md">
        <div className="rounded-full pl-1 pr-4 py-1 bg-violet-500/25 backdrop-blur-md border border-violet-400/50 text-violet-100 text-xs sm:text-sm shadow-glow flex items-center gap-2 animate-pulse">
          {/* 小进头像在最前 */}
          <MascotAvatar size="sm" autoEnsure glow />
          <span className="truncate">
            小进正在为「{status.skillName}」出题
          </span>
          <span className="text-[10px] text-violet-300 tabular-nums shrink-0">
            {elapsed}s
          </span>
        </div>
      </div>
    );
  }

  if (status.state === "success") {
    return (
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-40 max-w-[92%] sm:max-w-md animate-slide-up">
        <div className="rounded-full pl-1 pr-4 py-1 bg-emerald-500/25 backdrop-blur-md border border-emerald-400/50 text-emerald-100 text-xs sm:text-sm shadow-glow flex items-center gap-2">
          <MascotAvatar size="sm" />
          <span>
            小进已准备好 <strong>{status.count}</strong> 道「{status.skillName}」新题 ✨
          </span>
        </div>
      </div>
    );
  }

  if (status.state === "failed") {
    return (
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-40 max-w-[92%] sm:max-w-md">
        <div className="rounded-full px-4 py-2 bg-rose-500/25 backdrop-blur-md border border-rose-400/40 text-rose-100 text-xs sm:text-sm flex items-center gap-2">
          <span className="text-base">⚠</span>
          <span className="truncate">
            后台出题失败：{status.reason}
          </span>
        </div>
      </div>
    );
  }
  return null;
}
