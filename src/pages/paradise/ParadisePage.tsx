/**
 * v0.31.122: 知识乐园 3D —— town-3 真素材村庄底座 + 小进 PIP 教学。
 *
 * 设计变更（v121 → v122）：
 *  - 场景底座从 procedural ParadiseGround（草地+花+procedural 山）换成 town-3
 *    真素材村庄 (Synty-style low-poly OBJ + atlas，peer-review 双投票)。爸爸说
 *    "现在这个被你改的有些难看，里面有很多原素材就很棒的布置"——这一版直接用现成素材。
 *  - Suspense 期间 fallback 是 ParadiseGround（procedural 草地保底），所以 OBJ 加载
 *    慢也不会黑屏。
 *  - 小进 PIP overlay + portal 点击 + OrbitControls 都不变 (v121 已 ship 的好东西)。
 *
 * 路径: /math/paradise
 */

import { Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sky } from "@react-three/drei";
import { SkillPortals, type SkillPortalDef } from "../../components/paradise/SkillPortals";
import { ParadiseGround } from "../../components/paradise/ParadiseGround";
import { ParadiseTown } from "../../components/paradise/ParadiseTown";
import { MascotPIP } from "../../components/atelier/MascotPIP";
import type { MascotEmotion, MascotGesture } from "../../components/Mascot3D";
import { useDisplayName } from "../../lib/displayName";

interface PipState {
  gesture: MascotGesture;
  emotion: MascotEmotion;
  line: string;
}

const IDLE_PIP: PipState = {
  gesture: "idle",
  emotion: "happy",
  line: "🖱️ 拖动旋转 · 滚轮缩放 · 点 4 个发光柱进入",
};

export function ParadisePage() {
  const navigate = useNavigate();
  const displayName = useDisplayName();
  const [hoverPortal, setHoverPortal] = useState<SkillPortalDef | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [pipState, setPipState] = useState<PipState>(() => ({
    gesture: "wave",
    emotion: "happy",
    line: `👋 嗨 ${displayName}！点亮发光柱进入对应学科～`,
  }));

  // 进场 wave 动作播完后切 idle（4 秒后），但 hover 状态会立即覆盖
  useEffect(() => {
    const id = window.setTimeout(() => {
      setPipState((cur) => (cur.gesture === "wave" ? IDLE_PIP : cur));
    }, 4000);
    return () => window.clearTimeout(id);
  }, []);

  // hoverPortal 驱动 PIP：hover 时小进指向 + 提示进入；不 hover 时回 idle
  useEffect(() => {
    if (hoverPortal) {
      setPipState({
        gesture: "point",
        emotion: "happy",
        line: `${hoverPortal.emoji} 进入 ${hoverPortal.label}？${hoverPortal.desc ? `（${hoverPortal.desc}）` : ""}`,
      });
    } else {
      setPipState(IDLE_PIP);
    }
  }, [hoverPortal]);

  const handleSelectPortal = (portal: SkillPortalDef) => {
    // 点击瞬间给个 thumbsUp 反馈（虽然 navigate 立即跳走，但 next page 加载时还能看到）
    setPipState({
      gesture: "thumbsUp",
      emotion: "happy",
      line: `加油 ${displayName}！进入 ${portal.label}～`,
    });
    // 短延迟再 navigate，让 thumbsUp 来得及播出
    window.setTimeout(() => navigate(portal.route), 250);
  };

  useEffect(() => {
    return () => {
      document.body.style.cursor = "default";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 bg-sky-200"
      style={{ zIndex: 50 }}
    >
      <Canvas
        camera={{ position: [0, 11, 18], fov: 50, near: 0.1, far: 500 }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 1, -5);
          requestAnimationFrame(() => {
            requestAnimationFrame(() => setCanvasReady(true));
          });
        }}
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

        {/* === 灯光 === */}
        <hemisphereLight args={["#fff7e0", "#88aa88", 1.4]} />
        <directionalLight position={[10, 15, 8]} intensity={1.5} color="#fff5da" />
        <directionalLight position={[-8, 6, -5]} intensity={0.6} color="#bcd8ff" />
        <ambientLight intensity={0.4} />

        {/* === 场景底座（v122: town-3 真素材村庄；Suspense 期间 procedural 草地保底） === */}
        <Suspense fallback={<ParadiseGround />}>
          <ParadiseTown />
        </Suspense>

        {/* === 4 个学科入口 (可点击) === */}
        <SkillPortals
          onSelectPortal={handleSelectPortal}
          onHoverPortal={setHoverPortal}
        />

        {/* === Orbit camera === */}
        <OrbitControls
          enablePan={false}
          enableZoom
          minDistance={8}
          maxDistance={30}
          minPolarAngle={Math.PI / 8}
          maxPolarAngle={Math.PI / 2.05}
          target={[0, 1, -3]}
          enableDamping
          dampingFactor={0.08}
        />
      </Canvas>

      {/* Loading overlay */}
      <ParadiseLoadingOverlay hide={canvasReady} />

      {/* HUD */}
      <ParadiseHUD />

      {/* === 小进老师 PIP（lazy Mascot3D — 拥有完整 gesture 系统） === */}
      <MascotPIP
        gesture={pipState.gesture}
        emotion={pipState.emotion}
        outfit="default"
        skin="graduation"
        line={pipState.line}
        accent="#a78bfa"
      />
    </div>
  );
}

function ParadiseLoadingOverlay({ hide }: { hide: boolean }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{
        zIndex: 70,
        background:
          "radial-gradient(circle at center, rgba(135,206,235,0.0) 30%, rgba(135,206,235,0.75) 100%)",
        opacity: hide ? 0 : 1,
        visibility: hide ? "hidden" : "visible",
        transition: "opacity 0.6s ease-out, visibility 0.6s",
      }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="text-5xl animate-bounce">🌍</div>
        <div className="px-4 py-2 rounded-xl bg-black/40 text-white text-sm font-bold backdrop-blur-md border border-white/20 shadow-lg">
          知识乐园加载中...
        </div>
      </div>
    </div>
  );
}

function ParadiseHUD() {
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
        ← 返回
      </button>
      <div className="px-4 py-2 rounded-full bg-black/45 text-white text-xs font-bold backdrop-blur-md border border-white/20 shadow-lg">
        🌍 知识乐园
      </div>
      <div className="w-[80px]" />
    </div>
  );
}
