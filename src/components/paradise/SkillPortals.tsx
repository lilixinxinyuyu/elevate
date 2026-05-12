/**
 * v0.31.113: 学习入口 portal —— 知识乐园里的 4 个发光柱子，走近触发对应科目。
 *
 * 位置散布在 paradise 场景中（scale=0.5 后场景大概 120 单位见方）。
 * 每个 portal:
 *  - 几何：发光 cylinder 上 + 浮动文字标签
 *  - 颜色按学科：数学=蓝、英语=黄、语文=红、boss=紫
 *  - 走近 (< 2.5 单位) 时高亮 + 弹出"按 E 进入"提示
 */

import { useMemo, useRef, useState } from "react";
import { Text, Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Group } from "three";
import type { PlayerVRMHandle } from "./PlayerVRM";

export interface SkillPortalDef {
  id: string;
  label: string;
  emoji: string;
  /** world position [x, y, z] */
  position: [number, number, number];
  /** glow 颜色 */
  color: string;
  /** 跳转路径 */
  route: string;
}

/** 4 个学习入口分布在场景里（XZ plane，y=0 是地面）— Selena spawn 在 (0,0,0) 周围
    portals 离她 7-10 单位（不要太远不然找不到，也不要太近一开始就触发） */
export const PARADISE_PORTALS: SkillPortalDef[] = [
  {
    id: "math",
    label: "数学屋",
    emoji: "🔢",
    position: [-6, 0.5, -8],
    color: "#3b82f6", // blue
    route: "/math",
  },
  {
    id: "english",
    label: "英语花园",
    emoji: "🌍",
    position: [-2.2, 0.5, -10.5],
    color: "#fbbf24", // amber
    route: "/english",
  },
  {
    id: "chinese",
    label: "语文山顶",
    emoji: "📚",
    position: [2.2, 0.5, -10.5],
    color: "#ef4444", // red
    route: "/chinese",
  },
  {
    id: "boss",
    label: "火山挑战",
    emoji: "🔥",
    position: [6, 0.5, -8],
    color: "#a855f7", // purple
    route: "/math/big-problems",
  },
];

interface SkillPortalsProps {
  playerRef: React.RefObject<PlayerVRMHandle | null>;
  /** 走近 portal 时触发回调（外面接 keyboard E 或 UI 按钮跳转） */
  onNearPortal?: (portal: SkillPortalDef | null) => void;
}

export function SkillPortals({ playerRef, onNearPortal }: SkillPortalsProps) {
  const [nearId, setNearId] = useState<string | null>(null);
  const tempVec = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const p = playerRef.current;
    if (!p) return;
    const pos = p.getPosition();
    let closest: SkillPortalDef | null = null;
    let minDistSq = 6.25; // 触发半径平方 (2.5 单位)
    for (const portal of PARADISE_PORTALS) {
      tempVec.set(...portal.position);
      const dx = tempVec.x - pos.x;
      const dz = tempVec.z - pos.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < minDistSq) {
        minDistSq = dSq;
        closest = portal;
      }
    }
    const newId = closest?.id ?? null;
    if (newId !== nearId) {
      setNearId(newId);
      onNearPortal?.(closest);
    }
  });

  return (
    <group>
      {PARADISE_PORTALS.map((portal) => (
        <PortalPillar
          key={portal.id}
          portal={portal}
          active={portal.id === nearId}
        />
      ))}
    </group>
  );
}

interface PortalPillarProps {
  portal: SkillPortalDef;
  active: boolean;
}

function PortalPillar({ portal, active }: PortalPillarProps) {
  const groupRef = useRef<Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    // portal group origin = portal.position[1] + idle bobbing
    // (bug fix v0.31.117: 之前用 sin alone 覆盖了 portal.position[1] 让 portal 沉到地下)
    groupRef.current.position.y = portal.position[1] + Math.sin(t * 1.2) * 0.1;
    groupRef.current.rotation.y = t * 0.3;
    // 高亮时 scale up
    const targetScale = active ? 1.2 : 1;
    const cur = groupRef.current.scale.x;
    groupRef.current.scale.setScalar(cur + (targetScale - cur) * 0.1);
  });

  return (
    <group
      ref={groupRef}
      position={portal.position}
    >
      {/* 主柱体 — 3.5m 高，细身（被远移到 ±9，不再阻挡视线） */}
      <mesh position={[0, 1.75, 0]}>
        <cylinderGeometry args={[0.35, 0.5, 3.5, 16]} />
        <meshStandardMaterial
          color={portal.color}
          emissive={portal.color}
          emissiveIntensity={active ? 2.5 : 1.5}
          roughness={0.3}
          metalness={0.4}
        />
      </mesh>
      {/* 顶端浮动球（光球） */}
      <mesh ref={glowRef} position={[0, 4, 0]}>
        <sphereGeometry args={[0.5, 24, 16]} />
        <meshStandardMaterial
          color={portal.color}
          emissive={portal.color}
          emissiveIntensity={active ? 4 : 2.5}
          roughness={0.1}
        />
      </mesh>
      {/* 底座光圈 (大) */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.0, 1.4, 32]} />
        <meshStandardMaterial
          color={portal.color}
          emissive={portal.color}
          emissiveIntensity={active ? 2.5 : 1.5}
          side={THREE.DoubleSide}
          transparent
          opacity={0.85}
        />
      </mesh>
      {/* 文字标签（billboard 一直朝向 camera）— 小字体不裁切边缘 */}
      <Billboard position={[0, 5.0, 0]}>
        <Text
          fontSize={0.5}
          color="#ffffff"
          outlineWidth={0.055}
          outlineColor="#000000"
          anchorX="center"
          anchorY="middle"
        >
          {`${portal.emoji} ${portal.label}`}
        </Text>
      </Billboard>
    </group>
  );
}
