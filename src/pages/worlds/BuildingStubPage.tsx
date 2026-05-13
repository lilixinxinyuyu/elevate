/**
 * v0.32.0: Sprint 1 Day 1 占位页 —— Day 2/3/4 填实际 mini-game。
 *
 * 共用此组件给 store / bank / bakery 路由用，等真实 mini-game 写完再替换。
 */

import { useNavigate, useParams } from "react-router-dom";
import { getBaibaoBuilding, type BaibaoBuildingId } from "../../content/worlds/baibao";

interface BuildingStubPageProps {
  /** 显式传 buildingId，或者从路由 :buildingId 取 */
  buildingId?: BaibaoBuildingId;
}

export function BuildingStubPage({ buildingId }: BuildingStubPageProps) {
  const navigate = useNavigate();
  const params = useParams<{ buildingId?: BaibaoBuildingId }>();
  const id = (buildingId ?? params.buildingId) as BaibaoBuildingId | undefined;
  const building = id ? getBaibaoBuilding(id) : undefined;

  return (
    <div
      className="fixed inset-0 bg-gradient-to-b from-sky-200 to-amber-100 flex items-center justify-center"
      style={{ zIndex: 50 }}
    >
      <div className="text-center max-w-md mx-4">
        <div className="text-7xl mb-4">{building?.emoji ?? "🏗️"}</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          {building?.name ?? "建筑"}
        </h1>
        <p className="text-sm text-slate-700 mb-1">{building?.tagline ?? "建设中"}</p>
        <p className="text-xs text-amber-700 mb-6">{building?.skillHint ?? ""}</p>

        <div className="card bg-white/80 backdrop-blur-md p-4 mb-4 border border-amber-300">
          <p className="text-sm text-slate-800 font-medium mb-1">🚧 Sprint 1 开发中</p>
          <p className="text-xs text-slate-600 leading-relaxed">
            mini-game 还在搭建。等下次更新就能玩了～
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate("/worlds/baibao")}
          className="px-5 py-2.5 rounded-xl bg-amber-500 text-white font-bold shadow-lg hover:bg-amber-600 border-2 border-white/40"
        >
          ← 回 百宝港
        </button>
      </div>
    </div>
  );
}
