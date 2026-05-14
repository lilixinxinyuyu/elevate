/**
 * v0.32.0: 百宝港 (数学地图) 主场景 —— 俯视小镇 + 6 个建筑 + 装饰。
 *
 * 路径: /worlds/baibao
 *
 * Sprint 1: 小卖部/银行/面包店 active；其他 3 建设中。
 * 装饰物：完成 1 / 5 / 10 / 20 / 50 单分别加灯/亮/树/彩灯/飞鸟。
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OrbitControls } from "@react-three/drei";
import { WorldsCanvas } from "../../components/worlds/WorldsCanvas";
import { BaibaoTownMap } from "../../components/worlds/BaibaoTownMap";
import {
  type BaibaoBuilding,
} from "../../content/worlds/baibao";
import { getDecorationShards } from "../../lib/worlds/worldsProgress";

export function BaibaoMapPage() {
  const navigate = useNavigate();
  const [hoverBuilding, setHoverBuilding] = useState<BaibaoBuilding | null>(null);
  const [decorations, setDecorations] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await getDecorationShards();
      if (!cancelled) setDecorations(c);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      document.body.style.cursor = "default";
    };
  }, []);

  const handleSelectBuilding = (b: BaibaoBuilding) => {
    if (!b.active) return;
    navigate(b.route);
  };

  return (
    <div className="fixed inset-0 bg-sky-200 world-page-enter" style={{ zIndex: 50 }}>
      <WorldsCanvas
        camera={{ position: [0, 14, 20], fov: 50, near: 0.1, far: 200 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        loadingBg="#87ceeb"
        loadingEmoji="🏪"
        loadingTitle="百宝港加载中…"
      >
        {/* 背景 + 雾 */}
        <color attach="background" args={["#87ceeb"]} />
        <fog attach="fog" args={["#bce7f9", 30, 100]} />

        {/* 灯光 */}
        <hemisphereLight args={["#fff7e0", "#88aa88", 1.2]} />
        <directionalLight position={[10, 15, 8]} intensity={1.4} color="#fff5da" />
        <ambientLight intensity={0.35} />

        {/* 小镇（KayKit GLTF；WorldsCanvas 顶层 Suspense 接管 loading） */}
        <BaibaoTownMap
          onSelectBuilding={handleSelectBuilding}
          onHoverBuilding={setHoverBuilding}
          decorationCount={decorations}
        />

        {/* OrbitControls：拖动旋转，限制范围 */}
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

      {/* HUD */}
      <HUD decorations={decorations} hoverBuilding={hoverBuilding} />
    </div>
  );
}

interface HUDProps {
  decorations: number;
  hoverBuilding: BaibaoBuilding | null;
}

function HUD({ decorations, hoverBuilding }: HUDProps) {
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
        <div className="px-4 py-2 rounded-full bg-black/45 text-white text-xs font-bold backdrop-blur-md border border-white/20 shadow-lg">
          🏪 百宝港
        </div>
        <div className="pointer-events-none px-3 py-2 rounded-xl bg-amber-500/85 text-white text-xs font-bold backdrop-blur-md border border-amber-200/40 shadow-lg">
          ✨ {decorations}
        </div>
      </div>

      {/* 底部提示 */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-black/55 text-white text-xs backdrop-blur-md border border-white/20 pointer-events-none shadow-lg max-w-[92%] text-center"
        style={{ zIndex: 55 }}
      >
        {hoverBuilding ? (
          hoverBuilding.active ? (
            <span>
              <span className="text-base mr-1">{hoverBuilding.emoji}</span>
              点击进入 <b>{hoverBuilding.name}</b>
              <span className="text-amber-200 ml-1">· {hoverBuilding.skillHint}</span>
            </span>
          ) : (
            <span>
              <span className="text-base mr-1">🔒</span>
              <b>{hoverBuilding.name}</b>
              <span className="text-slate-300 ml-1">· {hoverBuilding.tagline}</span>
            </span>
          )
        ) : (
          <span>🖱️ 拖动旋转 · 滚轮缩放 · 点亮 3 栋建筑（小卖部 / 银行 / 面包店）出发</span>
        )}
      </div>
    </>
  );
}
