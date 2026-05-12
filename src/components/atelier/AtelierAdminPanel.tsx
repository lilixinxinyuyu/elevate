/**
 * Admin → 🏠 工坊沙箱 tab。
 * 入口链接 + 进度概览 + reset 按钮。
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ATELIER_REALMS } from "../../content/atelier/realms";
import {
  addInspiration,
  getAllRealmProgress,
  getAtelierStage,
  getInspiration,
  INSPIRATION_THRESHOLDS,
  resetAtelierProgress,
  type RealmProgress,
} from "../../lib/atelier/atelierProgress";

export function AtelierAdminPanel() {
  const [inspiration, setInspiration] = useState(0);
  const [realmProgress, setRealmProgress] = useState<Record<string, RealmProgress>>({});
  const [resetBusy, setResetBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [insp, all] = await Promise.all([
        getInspiration(),
        getAllRealmProgress(ATELIER_REALMS.map((r) => r.id)),
      ]);
      if (!cancelled) {
        setInspiration(insp);
        setRealmProgress(all);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const stage = getAtelierStage(inspiration);
  const nextThreshold = INSPIRATION_THRESHOLDS.find((t) => inspiration < t.at);

  const onReset = async () => {
    if (!window.confirm("确认重置工坊沙箱进度？\n所有 atelier:: db.meta key 会被清空（不动主路径）。")) return;
    setResetBusy(true);
    try {
      await resetAtelierProgress();
      setRefreshKey((k) => k + 1);
    } finally {
      setResetBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* 沙箱声明 + 入口 link */}
      <div className="card-glow border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-rose-500/5">
        <div className="font-display font-bold text-amber-100 text-lg">
          🏠 小进的星海工坊（沙箱实验）
        </div>
        <div className="text-xs text-amber-200/80 mt-1 leading-relaxed">
          独立路径 <code>/math/atelier</code>，完全跟主路径隔离。Xiaojin 是中心，5 个维度传送门，
          每答题加灵感，灵感升级解锁工坊装饰 / outfit / 副手 / 完整态。
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Link to="/math/atelier" className="btn-primary text-sm">
            🚀 进入工坊
          </Link>
          <a
            href="/docs/p2-atelier-concept.md"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost text-sm"
          >
            📘 看概念文档
          </a>
        </div>
      </div>

      {/* 进度概览 */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-display font-bold text-base text-slate-100">总进度</div>
            <div className="text-xs text-slate-400 mt-0.5">基于 db.meta atelier::* key 实时读</div>
          </div>
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="chip text-[11px] px-2 py-1 bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
          >
            🔄 refresh
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-violet-500/10 border border-violet-400/20 p-3">
            <div className="text-[11px] text-violet-200/70">累积灵感</div>
            <div className="font-display font-bold text-2xl text-violet-100 tabular-nums">{inspiration}</div>
          </div>
          <div className="rounded-xl bg-amber-500/10 border border-amber-400/20 p-3">
            <div className="text-[11px] text-amber-200/70">工坊阶段</div>
            <div className="font-display font-bold text-2xl text-amber-100 tabular-nums">
              {stage}/{INSPIRATION_THRESHOLDS.length}
            </div>
          </div>
          <div className="rounded-xl bg-cyan-500/10 border border-cyan-400/20 p-3">
            <div className="text-[11px] text-cyan-200/70">已访问 realm</div>
            <div className="font-display font-bold text-2xl text-cyan-100 tabular-nums">
              {Object.values(realmProgress).filter((p) => p.visited > 0).length}/{ATELIER_REALMS.length}
            </div>
          </div>
        </div>
        {nextThreshold && (
          <div className="text-xs text-slate-400 mt-3 text-center">
            ↑ 下一个里程碑：<span className="text-amber-300 font-mono">{nextThreshold.at}</span> 灵感 →{" "}
            <span className="text-amber-200">{nextThreshold.label}</span>
            <span className="text-slate-500 ml-2">（还差 {nextThreshold.at - inspiration}）</span>
          </div>
        )}
      </div>

      {/* 5 realm 明细 */}
      <div className="card">
        <div className="font-display font-bold text-base text-slate-100 mb-2">维度进度明细</div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400 border-b border-white/10">
              <th className="text-left py-1.5 px-1">Realm</th>
              <th className="text-center px-1">进入次数</th>
              <th className="text-center px-1">完成次数</th>
              <th className="text-center px-1">星等</th>
              <th className="text-center px-1">门槛灵感</th>
            </tr>
          </thead>
          <tbody>
            {ATELIER_REALMS.map((r) => {
              const p = realmProgress[r.id] ?? { visited: 0, completed: 0, stars: 0 };
              const locked = inspiration < r.inspirationGate;
              return (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="py-1.5 px-1">
                    <span className="mr-2">{r.emoji}</span>
                    <span className="text-slate-200">{r.name}</span>
                  </td>
                  <td className="text-center text-slate-300 tabular-nums">{p.visited}</td>
                  <td className="text-center text-slate-300 tabular-nums">{p.completed}</td>
                  <td className="text-center text-amber-300 font-mono">
                    {"⭐".repeat(p.stars)}{"☆".repeat(Math.max(0, 3 - p.stars))}
                  </td>
                  <td className="text-center text-slate-400 tabular-nums">
                    {r.inspirationGate === 0 ? "默认解锁" : locked ? `${r.inspirationGate} 🔒` : `${r.inspirationGate} ✓`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* DEBUG 灵感快进 — 用来测试 Stage C 装饰阈值 */}
      <div className="card border border-violet-500/30 bg-violet-950/20">
        <div className="font-display font-bold text-base text-violet-200 mb-2">⚙️ Debug: 灵感快进</div>
        <div className="text-xs text-violet-200/70 mb-3 leading-relaxed">
          直接给灵感加值（沙箱测试用）。点击后 hub 页装饰会跟着 stage 升级。
        </div>
        <div className="flex flex-wrap gap-2">
          {[5, 10, 25, 50, 100].map((delta) => (
            <button
              key={delta}
              type="button"
              onClick={async () => {
                await addInspiration(delta);
                setRefreshKey((k) => k + 1);
              }}
              className="chip px-3 py-1.5 bg-violet-500/20 border border-violet-400/40 text-violet-100 hover:bg-violet-500/30 text-sm"
            >
              +{delta} 灵感
            </button>
          ))}
        </div>
      </div>

      {/* 危险区 */}
      <div className="card border border-rose-500/30 bg-rose-950/20">
        <div className="font-display font-bold text-base text-rose-200 mb-2">沙箱重置</div>
        <div className="text-xs text-rose-200/70 leading-relaxed mb-3">
          删除所有 <code>db.meta `atelier::*`</code> key（灵感 / 访问次数 / 星等 / 解锁状态）。
          <br />
          <span className="text-rose-300/80">不影响</span>主路径 mascot / mastery / attempts 数据。
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={resetBusy}
          className="px-4 py-2 rounded-xl bg-rose-500/30 border border-rose-400/60 text-rose-100 text-sm hover:bg-rose-500/40 disabled:opacity-50"
        >
          {resetBusy ? "重置中…" : "🗑️ 重置工坊沙箱进度"}
        </button>
      </div>
    </div>
  );
}
