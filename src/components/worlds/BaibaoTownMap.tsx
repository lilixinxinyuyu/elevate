/**
 * v0.32.1: 百宝港俯视小镇地图 —— KayKit GLTF 真素材建筑 + procedural 地面。
 *
 * v0.32.0 → v0.32.1：6 个 procedural box 全部换成 KayKit Medieval Hexagon Pack 的
 * GLTF 建筑（market_blue / blacksmith_blue / tavern_blue / lumbermill_blue /
 * home_A_blue / tower_base_blue / scaffolding-for-locked）。
 *
 * 地面 + 街道 + 中央广场 + 装饰云朵保留 procedural（绿圆草坪 + 灰色十字 + 黄色广场圆）
 * — 给建筑当统一底座，跟 KayKit 风格不冲突（KayKit 自身也是低多边形可爱风）。
 *
 * 装饰物（barrel/tent/sack/flag）随完成数解锁。
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import type { Group } from "three";
import {
  BAIBAO_BUILDINGS,
  type BaibaoBuilding,
} from "../../content/worlds/baibao";
import { KayBuilding, KayProp } from "./KayBuilding";

interface BaibaoTownMapProps {
  onSelectBuilding: (b: BaibaoBuilding) => void;
  onHoverBuilding?: (b: BaibaoBuilding | null) => void;
  /** 装饰碎片数量（决定地图视觉成长） */
  decorationCount?: number;
}

export function BaibaoTownMap({
  onSelectBuilding,
  onHoverBuilding,
  decorationCount = 0,
}: BaibaoTownMapProps) {
  return (
    <group>
      {/* === 地面：大圆草坪 + 沙土广场 + 十字街 === */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[18, 64]} />
        <meshStandardMaterial color="#84cc16" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[3.5, 32]} />
        <meshStandardMaterial color="#fcd34d" roughness={0.85} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[16, 1.4]} />
        <meshStandardMaterial color="#a8a29e" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, 0.01, 0]}>
        <planeGeometry args={[16, 1.4]} />
        <meshStandardMaterial color="#a8a29e" roughness={0.95} />
      </mesh>
      {/* v0.33.13 (Ep89 DDDDDD): 街道 emissive glow trail — 4 段流光在十字路上流动 */}
      <RoadGlowTrails />

      {/* === 6 个 KayKit 建筑 === */}
      {BAIBAO_BUILDINGS.map((b) => (
        <KayBuilding
          key={b.id}
          gltfUrl={b.gltfUrl}
          position={b.position}
          scale={1.4}
          rotationY={b.rotationY ?? 0}
          active={b.active}
          accentColor={b.color}
          label={`${b.emoji} ${b.name}`}
          sublabel={b.active ? b.skillHint : b.tagline}
          onSelect={() => onSelectBuilding(b)}
          onHoverChange={(hov) => onHoverBuilding?.(hov ? b : null)}
        />
      ))}

      {/* === 中央小进站位（占位光球） === */}
      <CenterMascot />

      {/* === 永远在的装饰: 用 KayKit 自带云 + 山丘装饰 === */}
      <KayProp gltfUrl="/env/kaykit/medieval/deco/cloud_big.gltf" position={[12, 6, -12]} scale={1.2} />
      <KayProp gltfUrl="/env/kaykit/medieval/deco/cloud_small.gltf" position={[-13, 7, 8]} scale={1.0} />
      <KayProp gltfUrl="/env/kaykit/medieval/deco/cloud_big.gltf" position={[-10, 5.5, -14]} scale={1.0} rotationY={Math.PI} />

      {/* === 进度装饰: 完成 1/3/10/20 单分别加 === */}
      {decorationCount >= 1 && (
        <KayProp gltfUrl="/env/kaykit/medieval/deco/barrel.gltf" position={[-3, 0, 3]} scale={1.0} />
      )}
      {decorationCount >= 3 && (
        <KayProp gltfUrl="/env/kaykit/medieval/deco/barrel.gltf" position={[3, 0, 3]} scale={1.0} rotationY={Math.PI / 4} />
      )}
      {decorationCount >= 5 && (
        <KayProp gltfUrl="/env/kaykit/medieval/deco/flag_blue.gltf" position={[0, 0, -3]} scale={1.0} />
      )}
      {decorationCount >= 10 && (
        <>
          <KayProp gltfUrl="/env/kaykit/medieval/deco/sack.gltf" position={[-4, 0, -2]} scale={1.0} />
          <KayProp gltfUrl="/env/kaykit/medieval/deco/sack.gltf" position={[4, 0, -2]} scale={1.0} rotationY={Math.PI / 6} />
        </>
      )}
      {decorationCount >= 20 && (
        <KayProp gltfUrl="/env/kaykit/medieval/deco/tent.gltf" position={[-12, 0, 0]} scale={1.2} />
      )}
      {decorationCount >= 30 && (
        <KayProp gltfUrl="/env/kaykit/medieval/deco/tent.gltf" position={[12, 0, 0]} scale={1.2} rotationY={Math.PI} />
      )}

      {/* === 周围山丘（永远有） === */}
      <KayProp gltfUrl="/env/kaykit/medieval/deco/hill_single_C.gltf" position={[16, 0, -10]} scale={1.5} />
      <KayProp gltfUrl="/env/kaykit/medieval/deco/hill_single_C.gltf" position={[-16, 0, -10]} scale={1.3} rotationY={Math.PI / 3} />
      <KayProp gltfUrl="/env/kaykit/medieval/deco/hill_single_C.gltf" position={[16, 0, 10]} scale={1.4} rotationY={Math.PI} />
      <KayProp gltfUrl="/env/kaykit/medieval/deco/hill_single_C.gltf" position={[-16, 0, 10]} scale={1.5} rotationY={-Math.PI / 2} />
    </group>
  );
}

function CenterMascot() {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.position.y = 0.8 + Math.sin(t * 1.2) * 0.15;
    ref.current.rotation.y = t * 0.4;
  });
  return (
    <group ref={ref} position={[0, 0.8, 0]}>
      <mesh>
        <octahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial
          color="#fef3c7"
          emissive="#fcd34d"
          emissiveIntensity={1.6}
          roughness={0.3}
        />
      </mesh>
      <Billboard position={[0, 0.55, 0]}>
        <Text fontSize={0.35} anchorX="center" anchorY="middle">👩‍🏫</Text>
      </Billboard>
    </group>
  );
}

/**
 * v0.33.13 (Ep89 DDDDDD): 街道流光 — 在十字路两轴上各 2 道光段循环移动，
 * 给百宝港地图加一点活气，不干扰交互（raycast: () => null）。
 */
function RoadGlowTrails() {
  return (
    <group renderOrder={3}>
      <RoadGlowSegment axis="x" offset={0} color="#fde68a" />
      <RoadGlowSegment axis="x" offset={0.5} color="#38bdf8" />
      <RoadGlowSegment axis="z" offset={0.25} color="#fde68a" />
      <RoadGlowSegment axis="z" offset={0.75} color="#38bdf8" />
    </group>
  );
}

function RoadGlowSegment({
  axis,
  offset,
  color,
}: {
  axis: "x" | "z";
  offset: number;
  color: string;
}) {
  const ref = useRef<Group>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!ref.current || !matRef.current) return;
    const t = (clock.elapsedTime * 0.18 + offset) % 1;
    const pos = -6.8 + t * 13.6;
    if (axis === "x") {
      ref.current.position.x = pos;
      ref.current.position.z = 0;
    } else {
      ref.current.position.z = pos;
      ref.current.position.x = 0;
    }
    // 边缘渐隐 — 流光接近视野边界时变淡
    const edgeFade = 1 - Math.min(1, Math.abs(pos) / 7.2);
    matRef.current.opacity = 0.14 + edgeFade * 0.28;
  });
  return (
    <group ref={ref} position={[0, 0.035, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={axis === "x" ? [3.1, 0.18] : [0.18, 3.1]} />
        <meshBasicMaterial
          ref={matRef}
          color={color}
          transparent
          opacity={0.28}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
