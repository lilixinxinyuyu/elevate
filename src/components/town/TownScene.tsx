/**
 * 小镇 3D 俯视场景 —— Three.js / R3F。
 *
 * 设计：
 *  - 俯视 30° 角，看到小村庄全貌
 *  - 草地 ground plane (大 plane + 绿色)
 *  - 主街道（横十字柏油 box）
 *  - 4 个建筑：low-poly box + 屋顶斜面 + emoji 牌
 *  - 远景：几棵树 + 太阳/星空（按 inspiration stage 切日/夜）
 *  - 建筑 hover 时整体微微抬升 + emit glow，click 触发 onSelect callback
 *  - Xiaojin (Mascot3D 缩小) 站在十字路口 idle
 */
import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { BUILDINGS, type Building } from "../../content/town/buildings";

interface TownSceneProps {
  onSelectBuilding: (id: Building["id"]) => void;
  /** 镇子阶段 0-4 — 影响光照 / 装饰密度 */
  stage?: number;
  buildingProgress?: Record<string, { visits: number; tasksDone: number }>;
}

export function TownScene({ onSelectBuilding, stage = 0, buildingProgress }: TownSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 12, 14], fov: 42 }}
      shadows
      gl={{ alpha: false, antialias: true }}
    >
      <color attach="background" args={stage >= 2 ? ["#1e1b4b"] : ["#7dd3fc"]} />
      <SceneLights stage={stage} />
      <Environment preset={stage >= 2 ? "night" : "sunset"} />

      {/* 地面 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#84cc16" roughness={0.95} />
      </mesh>

      {/* 主街道 — 十字交叉 */}
      <RoadSlab x={0} z={0} w={14} h={1.4} />
      <RoadSlab x={0} z={0} w={1.4} h={11} rotated />

      {/* 装饰：路边树 */}
      <Tree x={-6} z={-5} />
      <Tree x={6} z={-5} />
      <Tree x={-6} z={5} />
      <Tree x={6} z={5} />
      <Tree x={-7} z={0} />
      <Tree x={7} z={0} />

      {/* 4 个建筑 */}
      {BUILDINGS.map((b) => (
        <BuildingMesh
          key={b.id}
          building={b}
          onClick={() => onSelectBuilding(b.id)}
          taskCount={buildingProgress?.[b.id]?.tasksDone ?? 0}
        />
      ))}

      {/* 中心十字路口标记（小进站这里的占位） */}
      <SpiritMarker />

      {/* 可拖动相机 */}
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={9}
        maxDistance={18}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.3}
      />
    </Canvas>
  );
}

function SceneLights({ stage }: { stage: number }) {
  const ambientI = stage >= 2 ? 0.35 : 0.55;
  const sunI = stage >= 2 ? 0.4 : 1.0;
  const sunColor = stage >= 2 ? "#a78bfa" : "#fff4d6";
  return (
    <>
      <ambientLight intensity={ambientI} />
      <directionalLight
        position={[6, 10, 6]}
        intensity={sunI}
        color={sunColor}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-6, 6, -4]} intensity={0.25} color="#bae6fd" />
    </>
  );
}

function RoadSlab({ x, z, w, h, rotated }: { x: number; z: number; w: number; h: number; rotated?: boolean }) {
  return (
    <mesh
      position={[x, 0.02, z]}
      rotation={[-Math.PI / 2, 0, rotated ? Math.PI / 2 : 0]}
      receiveShadow
    >
      <planeGeometry args={[w, h]} />
      <meshStandardMaterial color="#475569" roughness={0.9} />
    </mesh>
  );
}

function Tree({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      {/* trunk */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.16, 0.8, 8]} />
        <meshStandardMaterial color="#78350f" roughness={0.9} />
      </mesh>
      {/* leaves */}
      <mesh position={[0, 1.1, 0]} castShadow>
        <sphereGeometry args={[0.7, 12, 10]} />
        <meshStandardMaterial color="#15803d" roughness={0.7} />
      </mesh>
    </group>
  );
}

function SpiritMarker() {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.position.y = 0.7 + Math.sin(t * 1.2) * 0.15;
    ref.current.rotation.y = t * 0.4;
  });
  return (
    <group ref={ref} position={[0, 0.7, 0]}>
      <mesh castShadow>
        <octahedronGeometry args={[0.18, 0]} />
        <meshStandardMaterial color="#fef3c7" emissive="#fcd34d" emissiveIntensity={1.4} roughness={0.3} />
      </mesh>
    </group>
  );
}

function BuildingMesh({
  building,
  onClick,
  taskCount,
}: {
  building: Building;
  onClick: () => void;
  taskCount: number;
}) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef<THREE.Group>(null);
  const [x, z] = building.position;
  const [w, h, d] = building.size;

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    // 小幅 idle bob + hover lift
    const targetY = hovered ? 0.25 : 0;
    ref.current.position.y += (targetY - ref.current.position.y) * 0.15;
    // 屋顶轻微浮动（hovered 时强一点）
    ref.current.children[1] &&
      (ref.current.children[1].position.y = h + 0.1 + Math.sin(t * 1.3) * (hovered ? 0.04 : 0.015));
  });

  return (
    <group
      ref={ref}
      position={[x, 0, z]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "default";
      }}
    >
      {/* 主体墙 */}
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial
          color={building.color}
          roughness={0.6}
          emissive={hovered ? building.accent : "#000"}
          emissiveIntensity={hovered ? 0.18 : 0}
        />
      </mesh>
      {/* 屋顶 — 用 cone 做坡顶 */}
      <mesh position={[0, h + 0.4, 0]} castShadow>
        <coneGeometry args={[Math.max(w, d) * 0.78, 0.85, 4]} />
        <meshStandardMaterial color={building.accent} roughness={0.7} />
      </mesh>
      {/* 大门 */}
      <mesh position={[0, 0.45, d / 2 + 0.01]}>
        <planeGeometry args={[0.5, 0.9]} />
        <meshStandardMaterial color="#3f2410" />
      </mesh>
      {/* 窗户 emoji 牌（HTML 浮在建筑上方） */}
      <Html
        position={[0, h + 1.05, 0]}
        center
        distanceFactor={8}
        style={{ pointerEvents: "none" }}
      >
        <div className="flex flex-col items-center gap-0.5 select-none">
          <div
            className={`px-2 py-1 rounded-xl bg-black/70 backdrop-blur-sm text-white text-xs font-bold whitespace-nowrap shadow-lg transition-transform ${
              hovered ? "scale-110" : ""
            }`}
            style={{ borderLeft: `3px solid ${building.accent}` }}
          >
            <span className="text-lg mr-1">{building.emoji}</span>
            {building.name}
          </div>
          {hovered && (
            <div className="px-2 py-0.5 rounded-lg bg-amber-500/90 text-amber-50 text-[10px] font-medium whitespace-nowrap">
              {building.desc}
              {taskCount > 0 && <span className="ml-2 opacity-80">✓ {taskCount}</span>}
            </div>
          )}
        </div>
      </Html>
    </group>
  );
}
