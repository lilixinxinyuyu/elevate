import { useEffect, useState } from "react";
import {
  flushPushNow,
  pullIfStale,
  subscribeSyncState,
  type SyncState,
} from "../db/cloudSync";

/**
 * v0.31.71：header 右上小芯片，显示同步状态。
 *  - 正在 push / pull → 旋转图 + "同步中"
 *  - 有 pending 还没飞 → 黄点 + "待同步"
 *  - 全部完事 → 绿点 + "已同步 N 分钟前"
 *  - 失败 → 红点 + 错误简写（点 chip 强制重试）
 *
 * 点 chip = 立即 push + pull（force）。给爸爸/Selena 切设备时用。
 */
export function SyncStatusIndicator() {
  const [state, setState] = useState<SyncState | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const unsub = subscribeSyncState(setState);
    return unsub;
  }, []);

  // 每 30s 重渲一次让 "N 分钟前" 跟着走
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  if (!state) return null;

  const lastSync = Math.max(state.lastPushAt, state.lastPullAt);
  const ageMs = lastSync > 0 ? now - lastSync : Infinity;

  let dotClass = "bg-emerald-400";
  let label = "已同步";
  let title = "数据已同步到云端";

  if (state.pushing || state.pulling) {
    dotClass = "bg-violet-300 animate-pulse";
    label = "同步中";
    title = state.pushing ? "正在上传到云端…" : "正在拉取最新进度…";
  } else if (state.lastError && state.lastError !== "no_password") {
    dotClass = "bg-rose-400";
    label = "同步异常";
    title = `上次失败：${state.lastError}（点击重试）`;
  } else if (state.pendingPush) {
    dotClass = "bg-amber-300";
    label = "待同步";
    title = "有未上传的本地写入，几秒后自动上传（或点击立即同步）";
  } else if (lastSync === 0) {
    dotClass = "bg-slate-400";
    label = "未同步";
    title = "还没有云端记录";
  } else if (ageMs < 60_000) {
    label = "已同步";
    title = "刚刚同步";
  } else if (ageMs < 60 * 60_000) {
    const mins = Math.floor(ageMs / 60_000);
    label = `${mins}分钟前`;
    title = `上次同步：${new Date(lastSync).toLocaleTimeString()}`;
  } else if (ageMs < 24 * 60 * 60_000) {
    const hrs = Math.floor(ageMs / (60 * 60_000));
    label = `${hrs}小时前`;
    title = `上次同步：${new Date(lastSync).toLocaleString()}`;
  } else {
    label = "已陈旧";
    title = `上次同步：${new Date(lastSync).toLocaleString()}（点击立即同步）`;
  }

  function handleClick() {
    // 立即 push + pull，给"切设备前"用
    flushPushNow();
    void pullIfStale({ minIntervalMs: 0 });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={title}
      className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-ink-700/60 text-[11px] text-slate-300 transition-colors"
      aria-label={`同步状态: ${label}, 点击立即同步`}
    >
      <span
        aria-hidden
        className={`w-1.5 h-1.5 rounded-full ${dotClass} shrink-0`}
      />
      <span className="opacity-80">{label}</span>
    </button>
  );
}
