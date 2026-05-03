/**
 * ComingSoon：学科 / 子路由还没建好时的占位页。
 *
 * Phase 1：chinese 子路由全部走这里；用 useSubject() 拿当前学科的 status
 * 信息（comingSoonLabel / releaseAt），渲染倒计时和切回数学的快捷按钮。
 *
 * Phase 2 chinese 内容到位后，SubjectShell 的"contentReady"判断会让大部分
 * chinese 子路由不再回到这个页面；这个组件留作"未来某个还没做完的子模块"
 * 的占位。
 */

import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useSubject } from "../subjects/context";

function useCountdown(targetMs: number | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!targetMs) return;
    const id = setInterval(() => setNow(Date.now()), 60_000); // 分钟级别足够
    return () => clearInterval(id);
  }, [targetMs]);
  if (!targetMs) return null;
  const ms = targetMs - now;
  if (ms <= 0) return { days: 0, hours: 0, ready: true };
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return { days, hours, ready: false };
}

export function ComingSoonPage() {
  const subject = useSubject();
  const location = useLocation();
  const countdown = useCountdown(subject.status.releaseAt);

  return (
    <div className="max-w-2xl mx-auto py-12 text-center">
      <div className="text-6xl mb-4">🚧</div>
      <div
        className={`inline-block w-20 h-20 rounded-2xl bg-gradient-to-br ${subject.themeColor} flex items-center justify-center font-display font-bold text-4xl text-white shadow-glow mb-4 mx-auto`}
      >
        {subject.shortLabel}
      </div>
      <div className="font-display font-bold text-3xl text-brand mb-2">
        {subject.label}
      </div>
      <div className="text-sm text-slate-400 mb-1">
        {subject.homeTagline}
      </div>
      {subject.status.comingSoonLabel && (
        <div className="text-amber-300 mt-2 text-base">
          🛠️ {subject.status.comingSoonLabel}
        </div>
      )}

      {countdown && !countdown.ready && (
        <div className="card-glow mt-6 inline-block">
          <div className="text-xs text-slate-400">距离开放还有</div>
          <div className="text-3xl font-display font-bold text-violet-300 mt-1">
            {countdown.days} 天 {countdown.hours} 小时
          </div>
        </div>
      )}

      <div className="text-sm text-slate-500 mt-8 max-w-md mx-auto leading-relaxed">
        {subject.id === "chinese"
          ? "语文版本会在期中考试后上线：拼音 / 字词 / 古诗 / 阅读 / 听写五大类游戏，配合 Qwen 童声朗读。期中加油，期末再战！"
          : "这个模块还在搭建中，先在数学里继续练习吧。"}
      </div>

      <div className="mt-6 flex justify-center gap-3 flex-wrap">
        <Link to="/math" className="btn-primary">
          回数学
        </Link>
        <Link to="/" className="btn-secondary">
          切换学科
        </Link>
      </div>

      <div className="text-[11px] text-slate-600 mt-6">
        当前路径：{location.pathname}
      </div>
    </div>
  );
}
