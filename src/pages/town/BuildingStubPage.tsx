/**
 * 公交站 / 小卖部 / 学校 暂时占位 —— Stage A 只先做银行的 3D 玩法。
 * 这些建筑 Stage B 会一个一个补上。
 */
import { Link, useLocation } from "react-router-dom";
import { getBuildingById } from "../../content/town/buildings";

export function BuildingStubPage() {
  const loc = useLocation();
  // 从 /math/town/<id> 提取建筑 id
  const id = loc.pathname.split("/").filter(Boolean).pop();
  const b = getBuildingById(id);
  if (!b) {
    return (
      <div className="p-4">
        <div className="card text-rose-200">未找到该建筑。</div>
        <Link to="/math/town" className="btn-secondary text-sm mt-3 inline-block">← 回小镇</Link>
      </div>
    );
  }
  return (
    <div className="space-y-3 p-4">
      <div
        className="card-glow border-2"
        style={{ borderColor: b.accent + "66" }}
      >
        <div className="flex items-center gap-3">
          <div className="text-4xl">{b.emoji}</div>
          <div className="flex-1">
            <div className="font-display font-bold text-xl text-slate-100">{b.name}</div>
            <div className="text-xs text-slate-300 mt-0.5">{b.desc}</div>
            <div className="text-[11px] text-slate-500 mt-1 font-mono">{b.mathFocus}</div>
          </div>
        </div>
      </div>
      <div className="card text-center py-12">
        <div className="text-4xl mb-3">🚧</div>
        <div className="font-display font-bold text-lg text-slate-200">这个建筑还在搭建</div>
        <div className="text-xs text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
          Stage A 只先把 🏦 银行的 3D 玩法做完了。{b.name} 的玩法 Stage B 接着做 ——
          每个建筑会有跟它职能匹配的 3D 互动（不是 popup 出题）。
        </div>
        <div className="flex gap-3 justify-center mt-5">
          <Link to="/math/town/bank" className="btn-primary text-sm">🏦 先去银行</Link>
          <Link to="/math/town" className="btn-secondary text-sm">🏘️ 回小镇</Link>
        </div>
      </div>
    </div>
  );
}
