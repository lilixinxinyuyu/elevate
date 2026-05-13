/**
 * v0.32.1: KayKit GLTF 建筑通用 component。
 *
 * 用 drei `useGLTF` 加载，clone scene（保证多个 building 共享 cache 但独立位置）。
 * KayKit GLTF 是 Y-up + origin 在底部中心，直接 position=[x,0,z] 即可贴地。
 *
 * Hover 时整体抬升 + emissive 高亮。
 * 不可点击时（locked）灰度处理或者用 scaffolding 模型替换（caller 决定）。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useGLTF, Billboard, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Group } from "three";

interface KayBuildingProps {
  /** GLTF 文件 URL */
  gltfUrl: string;
  /** XZ 位置 */
  position: [number, number];
  /** scale (KayKit 默认 1m hex，每个 building 约占 1×1.5×1) */
  scale?: number;
  /** 朝向 Y 旋转 (弧度) */
  rotationY?: number;
  /** 是否可点击 */
  active?: boolean;
  /** 浮顶标签 */
  label?: string;
  /** 浮顶副标题 */
  sublabel?: string;
  /** 主色（active 建筑顶端的状态光球） */
  accentColor?: string;
  onSelect?: () => void;
  onHoverChange?: (hov: boolean) => void;
}

export function KayBuilding({
  gltfUrl,
  position,
  scale = 1,
  rotationY = 0,
  active = true,
  label,
  sublabel,
  accentColor = "#10b981",
  onSelect,
  onHoverChange,
}: KayBuildingProps) {
  const groupRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const { scene } = useGLTF(gltfUrl);

  // clone 一份避免多个实例共用 transform
  const clonedScene = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.castShadow = false;
        m.receiveShadow = false;
        m.frustumCulled = true;
      }
    });
    return c;
  }, [scene]);

  useFrame(() => {
    if (!groupRef.current) return;
    const targetLift = hovered && active ? 0.25 : 0;
    groupRef.current.position.y += (targetLift - groupRef.current.position.y) * 0.15;
  });

  const handleOver = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setHovered(true);
    onHoverChange?.(true);
    document.body.style.cursor = active ? "pointer" : "not-allowed";
  };
  const handleOut = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setHovered(false);
    onHoverChange?.(false);
    document.body.style.cursor = "default";
  };
  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (!active) return;
    onSelect?.();
  };

  return (
    <group
      ref={groupRef}
      position={[position[0], 0, position[1]]}
      rotation={[0, rotationY, 0]}
      onClick={handleClick}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
    >
      <primitive object={clonedScene} scale={scale} />

      {/* 状态光球 (active 才显示) */}
      {active && (
        <mesh position={[0, 2.2, 0]}>
          <sphereGeometry args={[0.13, 12, 8]} />
          <meshStandardMaterial
            color={accentColor}
            emissive={accentColor}
            emissiveIntensity={hovered ? 1.4 : 0.7}
          />
        </mesh>
      )}

      {/* 名字标签 (always shown) */}
      {label && (
        <Billboard position={[0, 2.7, 0]}>
          <Text
            fontSize={0.32}
            color={active ? "#ffffff" : "#cbd5e1"}
            outlineWidth={0.05}
            outlineColor="#000000"
            anchorX="center"
            anchorY="middle"
          >
            {label}
          </Text>
        </Billboard>
      )}

      {/* hover 时副标题 */}
      {hovered && sublabel && (
        <Billboard position={[0, 2.35, 0]}>
          <Text
            fontSize={0.22}
            color={active ? "#fef3c7" : "#94a3b8"}
            outlineWidth={0.04}
            outlineColor="#000000"
            anchorX="center"
            anchorY="middle"
          >
            {sublabel}
          </Text>
        </Billboard>
      )}
    </group>
  );
}

/**
 * 装饰品（无交互、不挂 label）—— barrel/tent/sack/flag 等。
 */
interface KayPropProps {
  gltfUrl: string;
  position: [number, number, number];
  scale?: number;
  rotationY?: number;
}

export function KayProp({
  gltfUrl,
  position,
  scale = 1,
  rotationY = 0,
}: KayPropProps) {
  const { scene } = useGLTF(gltfUrl);
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.castShadow = false;
        m.receiveShadow = false;
        m.frustumCulled = true;
      }
    });
    return c;
  }, [scene]);
  return <primitive object={cloned} position={position} rotation={[0, rotationY, 0]} scale={scale} />;
}

/**
 * 在场景初始化前预加载 GLTF，避免 Suspense bouncing。
 * 调用方在文件 module load 时调用一次即可。
 */
export function preloadKayBuildings(urls: string[]): void {
  for (const u of urls) {
    useGLTF.preload(u);
  }
}

useGLTF.preload("/env/kaykit/medieval/blue/building_market_blue.gltf");
useGLTF.preload("/env/kaykit/medieval/blue/building_blacksmith_blue.gltf");
useGLTF.preload("/env/kaykit/medieval/blue/building_tavern_blue.gltf");
useGLTF.preload("/env/kaykit/medieval/blue/building_lumbermill_blue.gltf");
useGLTF.preload("/env/kaykit/medieval/blue/building_home_A_blue.gltf");
useGLTF.preload("/env/kaykit/medieval/blue/building_tower_base_blue.gltf");
useGLTF.preload("/env/kaykit/medieval/neutral/building_scaffolding.gltf");
