/**
 * v0.32.7: 星帆岛 (英语地图) 主场景 —— 俯视小岛 + 4 个建筑。
 *
 * 路径: /worlds/xingfan
 *
 * Sprint 2 Day 1: 登机口 active; 海关/咖啡馆/报刊亭 建设中。
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OrbitControls } from "@react-three/drei";
import { WorldsCanvas } from "../../components/worlds/WorldsCanvas";
import { XingfanIslandMap } from "../../components/worlds/XingfanIslandMap";
import { type XingfanBuilding } from "../../content/worlds/xingfan";

export function XingfanMapPage() {
  const navigate = useNavigate();
  const [hoverBuilding, setHoverBuilding] = useState<XingfanBuilding | null>(null);

  useEffect(() => {
    return () => {
      document.body.style.cursor = "default";
    };
  }, []);

  const handleSelect = (b: XingfanBuilding) => {
    if (!b.active) return;
    navigate(b.route);
  };

  return (
    <div className="fixed inset-0 bg-cyan-100" style={{ zIndex: 50 }}>
      <WorldsCanvas
        camera={{ position: [0, 14, 20], fov: 50, near: 0.1, far: 200 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        loadingBg="#a5f3fc"
        loadingEmoji="⛵"
        loadingTitle="星帆岛起航…"
      >
        <color attach="background" args={["#a5f3fc"]} />
        <fog attach="fog" args={["#bae6fd", 30, 100]} />
        <hemisphereLight args={["#fff7e0", "#0e7490", 1.2]} />
        <directionalLight position={[10, 15, 8]} intensity={1.4} color="#fff5da" />
        <ambientLight intensity={0.4} />

        <XingfanIslandMap
          onSelectBuilding={handleSelect}
          onHoverBuilding={setHoverBuilding}
        />

        <OrbitControls
          enablePan={false}
          enableZoom
          minDistance={10}
          maxDistance={28}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.1}
          target={[0, 1, 0]}
          enableDamping
          dampingFactor={0.08}
        />
      </WorldsCanvas>

      <HUD hoverBuilding={hoverBuilding} />
    </div>
  );
}

function HUD({ hoverBuilding }: { hoverBuilding: XingfanBuilding | null }) {
  const navigate = useNavigate();
  return (
    <>
      <div
        className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none"
        style={{ zIndex: 60 }}
      >
        <button
          type="button"
          onClick={() => navigate("/worlds")}
          className="pointer-events-auto px-3 py-2 rounded-xl bg-black/55 text-white text-sm font-bold backdrop-blur-md hover:bg-black/70 border border-white/25 shadow-lg"
        >
          ← 奇遇乐园
        </button>
        <div className="px-4 py-2 rounded-full bg-cyan-500/90 text-white text-xs font-bold backdrop-blur-md border border-white/30 shadow-lg">
          ⛵ 星帆岛
        </div>
        <div className="w-[100px]" />
      </div>

      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-black/55 text-white text-xs backdrop-blur-md border border-white/20 pointer-events-none shadow-lg max-w-[92%] text-center"
        style={{ zIndex: 55 }}
      >
        {hoverBuilding ? (
          hoverBuilding.active ? (
            <span>
              <span className="text-base mr-1">{hoverBuilding.emoji}</span>
              点击进入 <b>{hoverBuilding.name}</b>
              <span className="text-cyan-200 ml-1">· {hoverBuilding.skillHint}</span>
            </span>
          ) : (
            <span>
              <span className="text-base mr-1">🔒</span>
              <b>{hoverBuilding.name}</b>
              <span className="text-slate-300 ml-1">· {hoverBuilding.tagline}</span>
            </span>
          )
        ) : (
          <span>🖱️ 拖动旋转 · 滚轮缩放 · 点登机口出发</span>
        )}
      </div>
    </>
  );
}
