/**
 * v0.32.7: 星帆岛俯视小岛地图 —— 4 个建筑 + 海岸 hex tiles + 装饰。
 *
 * 主题：远航/海岛/旅游。用 KayKit 黄色 buildings (sand/sun beach feel)。
 * Sprint 2 Day 1: 登机口 active；其他 3 建设中。
 */

import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import type { Group } from "three";
import {
  XINGFAN_BUILDINGS,
  type XingfanBuilding,
} from "../../content/worlds/xingfan";
import { KayBuilding, KayProp } from "./KayBuilding";

interface XingfanIslandMapProps {
  onSelectBuilding: (b: XingfanBuilding) => void;
  onHoverBuilding?: (b: XingfanBuilding | null) => void;
}

export function XingfanIslandMap({
  onSelectBuilding,
  onHoverBuilding,
}: XingfanIslandMapProps) {
  return (
    <group>
      {/* 大海蓝色圆 (作背景) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <circleGeometry args={[26, 64]} />
        <meshStandardMaterial color="#0ea5e9" roughness={0.8} />
      </mesh>
      {/* 沙滩圆 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[16, 64]} />
        <meshStandardMaterial color="#fde68a" roughness={0.95} />
      </mesh>
      {/* 中央草地圆 (岛中心) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[10, 32]} />
        <meshStandardMaterial color="#86efac" roughness={0.9} />
      </mesh>

      {/* 4 个建筑 */}
      {XINGFAN_BUILDINGS.map((b) => (
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

      {/* 中央 mascot 占位 */}
      <CenterMascot />

      {/* 装饰：barrel / flag / 山 / 云 / 沙滩 buoys */}
      <KayProp gltfUrl="/env/kaykit/medieval/deco/barrel.gltf" position={[-3, 0, 2]} scale={1.0} />
      <KayProp gltfUrl="/env/kaykit/medieval/deco/flag_blue.gltf" position={[3, 0, 2]} scale={1.0} rotationY={Math.PI / 4} />
      <KayProp gltfUrl="/env/kaykit/medieval/deco/cloud_big.gltf" position={[12, 6, -10]} scale={1.2} />
      <KayProp gltfUrl="/env/kaykit/medieval/deco/cloud_small.gltf" position={[-13, 7, 8]} scale={1.0} />
      <KayProp gltfUrl="/env/kaykit/medieval/deco/hill_single_C.gltf" position={[-13, 0, -8]} scale={1.0} />
      <KayProp gltfUrl="/env/kaykit/medieval/deco/hill_single_C.gltf" position={[14, 0, 8]} scale={1.2} rotationY={Math.PI / 2} />
    </group>
  );
}

function CenterMascot() {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.position.y = 0.7 + Math.sin(t * 1.2) * 0.15;
    ref.current.rotation.y = t * 0.4;
  });
  return (
    <group ref={ref} position={[0, 0.7, 0]}>
      <mesh>
        <octahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial
          color="#a5f3fc"
          emissive="#06b6d4"
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
