/**
 * v0.32.0: P3 Worlds 主入口 —— 3 学科悬空选择。
 *
 * 路径: /worlds
 *
 * 设计（爸爸 GDD v3 拍板）：
 *  - 3 个学科地图悬浮，low-poly 简化加载（procedural box/sphere/cone）
 *  - 名字游戏化：百宝港 / 星帆岛 / 墨溪镇（不直接说"数学/英语/语文"）
 *  - 中央 emoji + 大字台词作为小进占位（VRM lazy，性能优先）
 *  - 推荐按钮"开始" → 百宝港
 *  - Sprint 1: 百宝港 unlocked，其他 2 个 locked
 */

import { Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Stars, OrbitControls } from "@react-three/drei";
import { WorldsCanvas } from "../../components/worlds/WorldsCanvas";
import { WORLDS, type WorldDef } from "../../content/worlds/worlds";
import { WorldOrb } from "../../components/worlds/WorldOrb";

// 3 orb 在 X 轴上等距分布（左 / 中 / 右），间距拉大避免拥挤
const ORB_POSITIONS: [number, number, number][] = [
  [-4.8, 0, 0],
  [0, 0, 0],
  [4.8, 0, 0],
];

export function WorldsHomePage() {
  const navigate = useNavigate();
  const [hoverWorld, setHoverWorld] = useState<WorldDef | null>(null);
  const recommended = WORLDS.find((w) => w.unlocked) ?? WORLDS[0]!;

  const handleSelect = (world: WorldDef) => {
    if (!world.unlocked) return;
    navigate(world.route);
  };

  useEffect(() => {
    return () => {
      document.body.style.cursor = "default";
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-indigo-950 via-purple-900 to-pink-950" style={{ zIndex: 50 }}>
      <WorldsCanvas
        camera={{ position: [0, 1.8, 8], fov: 55, near: 0.1, far: 200 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true }}
        loadingBg="#1e1b4b"
        loadingEmoji="🎡"
        loadingTitle="奇遇乐园加载中…"
      >
        {/* 星空 */}
        <Stars radius={50} depth={50} count={1500} factor={3} fade speed={0.5} />

        {/* 灯光 */}
        <ambientLight intensity={0.4} />
        <hemisphereLight args={["#fff7e0", "#1e1b4b", 0.6]} />
        <directionalLight position={[5, 8, 5]} intensity={1.0} color="#fff5da" />
        <pointLight position={[-3, 2, 3]} intensity={0.4} color="#a78bfa" />

        {/* 3 orb（KayKit GLTF lazy load 用 Suspense 包） */}
        <Suspense fallback={null}>
          {WORLDS.map((world, i) => (
            <WorldOrb
              key={world.id}
              world={world}
              position={ORB_POSITIONS[i]!}
              onSelect={handleSelect}
            />
          ))}
        </Suspense>

        {/* 用户可微调视角（限制范围） */}
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 2}
          minAzimuthAngle={-Math.PI / 4}
          maxAzimuthAngle={Math.PI / 4}
          enableDamping
          dampingFactor={0.08}
        />
      </WorldsCanvas>

      {/* ===== HUD ===== */}
      <HUD />

      {/* ===== 中央台词 / 推荐按钮 ===== */}
      <CenterPanel
        recommended={recommended}
        hoverWorld={hoverWorld}
        onStart={() => navigate(recommended.route)}
      />

      {/* ===== Hover overlay (不可见，仅捕获 hover 状态用于 CenterPanel) ===== */}
      <HoverCapture
        onHover={(id) => {
          const w = WORLDS.find((w) => w.id === id);
          setHoverWorld(w ?? null);
        }}
      />
    </div>
  );
}

function HUD() {
  const navigate = useNavigate();
  return (
    <div
      className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none"
      style={{ zIndex: 60 }}
    >
      <button
        type="button"
        onClick={() => navigate("/math")}
        className="pointer-events-auto px-3 py-2 rounded-xl bg-black/55 text-white text-sm font-bold backdrop-blur-md hover:bg-black/70 border border-white/25 shadow-lg"
      >
        ← 返回主页
      </button>
      <div className="px-4 py-2 rounded-full bg-black/45 text-white text-xs font-bold backdrop-blur-md border border-white/20 shadow-lg">
        🎡 奇遇乐园
      </div>
      <div className="w-[90px]" />
    </div>
  );
}

interface CenterPanelProps {
  recommended: WorldDef;
  hoverWorld: WorldDef | null;
  onStart: () => void;
}

function CenterPanel({ recommended, hoverWorld, onStart }: CenterPanelProps) {
  // 鼠标 hover 一个 orb 时显示该 world 的信息；否则显示推荐
  const focus = hoverWorld ?? recommended;
  return (
    <div
      className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-2 pointer-events-none"
      style={{ zIndex: 55 }}
    >
      {/* 小进 emoji + 台词 */}
      <div className="flex items-end gap-2 max-w-[90%]">
        <div className="text-4xl">👩‍🏫</div>
        <div className="px-4 py-2 rounded-2xl bg-white/95 text-slate-900 text-sm font-medium backdrop-blur-md shadow-2xl border border-white/40 relative">
          {focus.unlocked
            ? `${focus.emoji} ${focus.name}：${focus.tagline}`
            : `${focus.emoji} ${focus.name} 还在装修中... ${focus.lockHint ?? ""}`}
          {/* 对话气泡尾巴 */}
          <span className="absolute -left-2 bottom-3 w-0 h-0 border-y-8 border-y-transparent border-r-8 border-r-white/95" />
        </div>
      </div>
      {/* 推荐 / 开始按钮 */}
      <button
        type="button"
        onClick={onStart}
        className="pointer-events-auto px-7 py-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-white text-base font-bold shadow-2xl border-2 border-white/40 hover:scale-105 transition-transform animate-pulse"
        style={{
          boxShadow: `0 0 40px ${recommended.accent}99`,
        }}
      >
        {recommended.emoji} 出发去 {recommended.name}
      </button>
    </div>
  );
}

/**
 * R3F orb hover 状态没法直接冒泡到外面 React HTML，
 * 临时用 window 事件桥接。Day 1 简化，足够用。
 */
function HoverCapture({ onHover }: { onHover: (id: string | null) => void }) {
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ id: string | null }>;
      onHover(ce.detail?.id ?? null);
    };
    window.addEventListener("worlds-orb-hover", handler);
    return () => window.removeEventListener("worlds-orb-hover", handler);
  }, [onHover]);
  return null;
}
