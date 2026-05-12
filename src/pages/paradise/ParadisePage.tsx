/**
 * v0.32.x: 知识乐园 3D —— 重写为可靠版本。
 *
 * 设计原则：
 *  - Canvas 必须 render（即使 character 加载失败也能看到 sky + ground + portals）
 *  - 不被外层 Layout 的 header / nav 遮挡（z-50 + 自己控制顶部按钮）
 *  - WASD + 触屏摇杆，简单 chase camera，4 个 portal
 *
 * 路径: /math/paradise
 */

import { Suspense, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import { PlayerVRM, type PlayerVRMHandle } from "../../components/paradise/PlayerVRM";
import { RedPandaFollower } from "../../components/paradise/RedPandaFollower";
import { ChaseCamera } from "../../components/paradise/ChaseCamera";
import { SkillPortals, type SkillPortalDef } from "../../components/paradise/SkillPortals";
import { TouchJoystick } from "../../components/paradise/TouchJoystick";
import { usePlayerControls } from "../../components/paradise/usePlayerControls";
import { ParadiseGround } from "../../components/paradise/ParadiseGround";

export function ParadisePage() {
  const navigate = useNavigate();
  const playerRef = useRef<PlayerVRMHandle | null>(null);
  const { state: controls, setJoystick } = usePlayerControls();
  const [nearPortal, setNearPortal] = useState<SkillPortalDef | null>(null);
  const [showHint, setShowHint] = useState(true);

  // 进 page 6 秒后自动隐藏 WASD 提示（玩过一次就别再提示）
  useEffect(() => {
    const id = window.setTimeout(() => setShowHint(false), 6000);
    return () => window.clearTimeout(id);
  }, []);

  // 玩家走动起来也自动隐藏提示
  useEffect(() => {
    if (controls.walking) setShowHint(false);
  }, [controls.walking]);

  // 键盘 E / Enter / Space 触发 portal 进入
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!nearPortal) return;
      if (e.key === "e" || e.key === "E" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        navigate(nearPortal.route);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [nearPortal, navigate]);

  return (
    <div
      className="fixed inset-0 bg-sky-200"
      // z-50 让我们盖住外层 Layout 的 sticky header / bottom nav
      style={{ zIndex: 50 }}
    >
      <Canvas
        camera={{ position: [0, 5, 10], fov: 80, near: 0.1, far: 500 }}
        shadows={false}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        {/* === 背景 + 雾 === */}
        <color attach="background" args={["#87ceeb"]} />
        <fog attach="fog" args={["#bce7f9", 35, 110]} />
        <Sky
          distance={450000}
          sunPosition={[5, 4, 2]}
          inclination={0.45}
          azimuth={0.25}
          turbidity={3}
          rayleigh={0.6}
          mieCoefficient={0.005}
          mieDirectionalG={0.8}
        />

        {/* === 灯光（hemisphere + sun + ambient）=== */}
        <hemisphereLight args={["#fff7e0", "#88aa88", 1.4]} />
        <directionalLight position={[10, 15, 8]} intensity={1.5} color="#fff5da" />
        <directionalLight position={[-8, 6, -5]} intensity={0.6} color="#bcd8ff" />
        <ambientLight intensity={0.4} />

        {/* === 地面 (always-render，不依赖 OBJ asset 加载) === */}
        <ParadiseGround />

        {/* === Player VRM (Suspense fallback = placeholder cylinder) === */}
        <Suspense fallback={<PlayerPlaceholder />}>
          <PlayerVRM ref={playerRef} controls={controls} initialPosition={[0, 0, 2]} />
        </Suspense>

        {/* === Red Panda follower (optional, Suspense fallback = null) === */}
        <Suspense fallback={null}>
          <RedPandaFollower playerRef={playerRef} walking={controls.walking} />
        </Suspense>

        {/* === Skill portals === */}
        <SkillPortals playerRef={playerRef} onNearPortal={setNearPortal} />

        {/* === Camera === */}
        <ChaseCamera playerRef={playerRef} />
      </Canvas>

      {/* ===== HUD ===== */}
      <ParadiseHUD
        nearPortal={nearPortal}
        showHint={showHint}
        onEnter={() => nearPortal && navigate(nearPortal.route)}
      />

      {/* 触屏摇杆（移动端 + 桌面） */}
      <TouchJoystick onChange={setJoystick} />
    </div>
  );
}

/** Suspense fallback：player 加载中显示占位 cylinder + 走路逻辑保留 */
function PlayerPlaceholder() {
  return (
    <mesh position={[0, 0.75, 5]}>
      <cylinderGeometry args={[0.25, 0.3, 1.5, 16]} />
      <meshStandardMaterial color="#a78bfa" roughness={0.6} />
    </mesh>
  );
}

interface ParadiseHUDProps {
  nearPortal: SkillPortalDef | null;
  showHint: boolean;
  onEnter: () => void;
}

function ParadiseHUD({ nearPortal, showHint, onEnter }: ParadiseHUDProps) {
  const navigate = useNavigate();
  return (
    <>
      {/* 顶部返回按钮 + 标题（自己控制，不依赖 Layout 的 header） */}
      <div
        className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none"
        style={{ zIndex: 60 }}
      >
        <button
          type="button"
          onClick={() => navigate("/math")}
          className="pointer-events-auto px-3 py-2 rounded-xl bg-black/55 text-white text-sm font-bold backdrop-blur-md hover:bg-black/70 border border-white/25 shadow-lg"
        >
          ← 返回
        </button>
        <div className="px-4 py-2 rounded-full bg-black/45 text-white text-xs font-bold backdrop-blur-md border border-white/20 shadow-lg">
          🌍 知识乐园
        </div>
        <div className="w-[80px]" />
      </div>

      {/* 操作提示（idle 6 秒内显示，或玩家未走动） */}
      {showHint && !nearPortal && (
        <div
          className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-black/45 text-white text-xs backdrop-blur-md border border-white/15 pointer-events-none shadow-lg transition-opacity duration-500"
          style={{ zIndex: 55 }}
        >
          WASD / 摇杆 走动 · 走近发光柱按{" "}
          <kbd className="px-1.5 py-0.5 rounded bg-white/25 text-[10px] mx-0.5">E</kbd>{" "}
          进入
        </div>
      )}

      {/* 走近 portal 时弹出大按钮 */}
      {nearPortal && (
        <div
          className="absolute bottom-40 left-1/2 -translate-x-1/2 animate-pulse"
          style={{ zIndex: 60 }}
        >
          <button
            type="button"
            onClick={onEnter}
            className="pointer-events-auto px-7 py-4 rounded-2xl text-white text-xl font-bold shadow-2xl border-2 border-white/50"
            style={{
              background: `linear-gradient(135deg, ${nearPortal.color}, ${nearPortal.color}aa)`,
              boxShadow: `0 0 50px ${nearPortal.color}99`,
            }}
          >
            {nearPortal.emoji} 进入 {nearPortal.label}
          </button>
        </div>
      )}
    </>
  );
}
