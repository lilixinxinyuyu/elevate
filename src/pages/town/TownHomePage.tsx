/**
 * 小镇主页 —— 3D 俯视场景 + 4 个可点建筑 + 灵感条 + 进度概览。
 *
 * 跟 atelier 完全独立，路由 /math/town。
 */
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BUILDINGS, type BuildingId } from "../../content/town/buildings";
import { TownScene } from "../../components/town/TownScene";
import {
  getAllBuildingProgress,
  getInspiration,
  getTownStage,
  TOWN_STAGES,
  type BuildingProgress,
} from "../../lib/town/townProgress";
import { getBuildingById } from "../../content/town/buildings";

export function TownHomePage() {
  const navigate = useNavigate();
  const [inspiration, setInspiration] = useState(0);
  const [progress, setProgress] = useState<Record<string, BuildingProgress>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [insp, all] = await Promise.all([
        getInspiration(),
        getAllBuildingProgress(BUILDINGS.map((b) => b.id)),
      ]);
      if (!cancelled) {
        setInspiration(insp);
        setProgress(all);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stage = getTownStage(inspiration);
  const stageIndex = TOWN_STAGES.findIndex((s) => s.at === stage.at);
  const nextStage = TOWN_STAGES[stageIndex + 1];

  const onSelectBuilding = (id: BuildingId) => {
    const b = getBuildingById(id);
    if (b) navigate(b.route);
  };

  return (
    <div className="space-y-3 p-4">
      {/* 顶 hint + 灵感 + 镇子状态 */}
      <div className="card-glow border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-green-500/5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="font-display font-bold text-amber-100 text-lg flex items-center gap-2">
              {stage.emoji} 小进的{stage.name}
              <span className="text-xs text-amber-300/60 font-normal">（沙箱实验）</span>
            </div>
            <div className="text-xs text-amber-200/80 mt-1 leading-relaxed">
              点 3D 场景里的建筑进入。每个建筑有自己的玩法 — 银行找零、公交时刻表、超市购物、学校等式…
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[11px] text-slate-400">灵感</div>
            <div className="font-display font-bold text-2xl text-amber-300 tabular-nums">{inspiration}</div>
            {nextStage && (
              <div className="text-[10px] text-slate-500">
                {nextStage.at - inspiration} → {nextStage.emoji} {nextStage.name}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3D 场景 */}
      <div className="relative rounded-3xl overflow-hidden border border-emerald-400/30 bg-gradient-to-b from-sky-900 to-ink-950 h-[440px] sm:h-[560px] shadow-2xl">
        <TownScene onSelectBuilding={onSelectBuilding} stage={stageIndex} buildingProgress={progress} />
        {/* 浮顶 helper text */}
        <div className="absolute top-3 left-3 right-3 pointer-events-none flex items-center justify-between">
          <div className="px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-[10px] text-amber-200 border border-amber-300/30">
            💡 鼠标拖动旋转 · 滚轮缩放 · 点建筑进入
          </div>
        </div>
      </div>

      {/* 4 building 状态行（textual） */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {BUILDINGS.map((b) => {
          const p = progress[b.id] ?? { visits: 0, tasksDone: 0 };
          return (
            <Link
              key={b.id}
              to={b.route}
              className="card-flat p-2.5 hover:bg-white/[0.04] flex flex-col items-center gap-1 transition border border-white/5 hover:border-amber-300/40"
            >
              <div className="text-2xl">{b.emoji}</div>
              <div className="text-xs font-medium text-slate-200 text-center">{b.name}</div>
              <div className="text-[10px] text-slate-500 tabular-nums">
                完成 {p.tasksDone}
              </div>
            </Link>
          );
        })}
      </div>

      {/* 沙箱说明 */}
      <div className="card-flat text-[11px] text-slate-500 leading-relaxed">
        🌍 沙箱版小镇，独立路径 <code>/math/town</code>，跟主路径完全隔离。
        进度仅存在 <code>db.meta `town::*`</code>，可随时
        <Link to="/math/admin#atelier" className="text-violet-300 ml-1 underline">从 admin reset</Link>
        。日常练习请回
        <Link to="/math" className="text-violet-300 ml-1 underline">数学主页</Link>。
      </div>
    </div>
  );
}
