/**
 * v0.32.0: 锁定的学科世界占位页（星帆岛 / 墨溪镇）。
 *
 * Sprint 1 只解锁百宝港；点这两个世界直接显示"建设中"提示。
 */

import { useNavigate, useParams } from "react-router-dom";
import { getWorld, type WorldId } from "../../content/worlds/worlds";

export function WorldLockedPage() {
  const navigate = useNavigate();
  const params = useParams<{ worldId?: WorldId }>();
  const world = params.worldId ? getWorld(params.worldId) : undefined;

  return (
    <div
      className="fixed inset-0 bg-gradient-to-b from-indigo-950 to-pink-950 flex items-center justify-center"
      style={{ zIndex: 50 }}
    >
      <div className="text-center max-w-md mx-4">
        <div className="text-8xl mb-4">{world?.emoji ?? "🔒"}</div>
        <h1 className="text-2xl font-bold text-white mb-2">{world?.name ?? "建设中"}</h1>
        <p className="text-sm text-slate-300 mb-6">{world?.tagline}</p>

        <div className="card bg-white/10 backdrop-blur-md p-4 mb-4 border border-white/20 text-white">
          <p className="text-base font-medium mb-1">🚧 还在装修</p>
          <p className="text-sm text-slate-200 leading-relaxed">
            {world?.lockHint ?? "Sprint 1 后开放"}。<br />
            先去 百宝港 帮顾客算账～
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/worlds")}
          className="px-5 py-2.5 rounded-xl bg-amber-400 text-amber-900 font-bold shadow-lg hover:bg-amber-300 border-2 border-amber-200"
        >
          ← 回奇遇乐园
        </button>
      </div>
    </div>
  );
}
