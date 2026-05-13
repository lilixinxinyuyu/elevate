/**
 * v0.31.120: 学习入口 portal —— paradise 的 4 个发光柱子。
 *
 * 设计改版：从 v0.31.119 的"走近 + 按 E"改为 town/atelier 已验证过的
 * "鼠标 hover 高亮 + 点击进入"。原因：小进是老师不是主角，paradise 是俯视的
 * 小世界 (orbit + zoom)，不需要 WASD 走来走去。
 *
 * 每个 portal:
 *  - 几何：发光 cylinder + 浮动光球 + 底座光圈 + 浮顶 emoji 牌
 *  - hover 时整体 scale up + glow 加强
 *  - click 触发 onSelectPortal（parent navigate 到对应路由）
 *  - cursor 自动切 pointer
 */

import { useRef, useState } from "react";
import { Text, Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Group } from "three";

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
  /** hover 时的副标题 */
  desc?: string;
}

/** 4 个学习入口分布在场景里（XZ plane，y=0 是地面）。
    保留 v0.31.119 的位置 — 爸爸说"不要去改变街区或乡镇的基本结构"。
    Selena 现在不会走来走去 (orbit camera 替代 WASD)，所以远近不影响可玩性。 */
export const PARADISE_PORTALS: SkillPortalDef[] = [
  {
    id: "math",
    label: "数学屋",
    emoji: "🔢",
    desc: "口算 / 闯关 / 闪电",
    position: [-6, 0.5, -8],
    color: "#3b82f6", // blue
    route: "/math",
  },
  {
    id: "english",
    label: "英语花园",
    emoji: "🌍",
    desc: "单词 / 语法",
    position: [-2.2, 0.5, -10.5],
    color: "#fbbf24", // amber
    route: "/english",
  },
  {
    id: "chinese",
    label: "语文山顶",
    emoji: "📚",
    desc: "古诗 / 拼写",
    position: [2.2, 0.5, -10.5],
    color: "#ef4444", // red
    route: "/chinese",
  },
  {
    id: "boss",
    label: "火山挑战",
    emoji: "🔥",
    desc: "Boss 大题战",
    position: [6, 0.5, -8],
    color: "#a855f7", // purple
    route: "/math/big-problems",
  },
];

interface SkillPortalsProps {
  /** 点击 portal 时触发（parent 用 navigate 跳路由） */
  onSelectPortal: (portal: SkillPortalDef) => void;
  /** hover portal 时通知 parent（可选，用来显示 HUD 副标题） */
  onHoverPortal?: (portal: SkillPortalDef | null) => void;
}

export function SkillPortals({ onSelectPortal, onHoverPortal }: SkillPortalsProps) {
  return (
    <group>
      {PARADISE_PORTALS.map((portal) => (
        <PortalPillar
          key={portal.id}
          portal={portal}
          onSelect={() => onSelectPortal(portal)}
          onHoverChange={(hov) => onHoverPortal?.(hov ? portal : null)}
        />
      ))}
    </group>
  );
}

interface PortalPillarProps {
  portal: SkillPortalDef;
  onSelect: () => void;
  onHoverChange: (hovered: boolean) => void;
}

function PortalPillar({ portal, onSelect, onHoverChange }: PortalPillarProps) {
  const groupRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    // bobbing + 旋转（保留 v0.31.119 视觉）
    groupRef.current.position.y = portal.position[1] + Math.sin(t * 1.2) * 0.1;
    groupRef.current.rotation.y = t * 0.3;
    // hover 时 scale up
    const targetScale = hovered ? 1.25 : 1;
    const cur = groupRef.current.scale.x;
    groupRef.current.scale.setScalar(cur + (targetScale - cur) * 0.15);
  });

  const handleOver = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setHovered(true);
    onHoverChange(true);
    document.body.style.cursor = "pointer";
  };
  const handleOut = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setHovered(false);
    onHoverChange(false);
    document.body.style.cursor = "default";
  };
  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onSelect();
  };

  return (
    <group
      ref={groupRef}
      position={portal.position}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
      onClick={handleClick}
    >
      {/* 主柱体 — 3.5m 高 */}
      <mesh position={[0, 1.75, 0]}>
        <cylinderGeometry args={[0.35, 0.5, 3.5, 16]} />
        <meshStandardMaterial
          color={portal.color}
          emissive={portal.color}
          emissiveIntensity={hovered ? 2.8 : 1.5}
          roughness={0.3}
          metalness={0.4}
        />
      </mesh>
      {/* 顶端光球 */}
      <mesh position={[0, 4, 0]}>
        <sphereGeometry args={[0.5, 24, 16]} />
        <meshStandardMaterial
          color={portal.color}
          emissive={portal.color}
          emissiveIntensity={hovered ? 4.5 : 2.5}
          roughness={0.1}
        />
      </mesh>
      {/* 底座光圈 */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.0, 1.4, 32]} />
        <meshStandardMaterial
          color={portal.color}
          emissive={portal.color}
          emissiveIntensity={hovered ? 2.8 : 1.5}
          side={THREE.DoubleSide}
          transparent
          opacity={0.85}
        />
      </mesh>
      {/* 隐形点击靶子 — 让光柱整体都好点（移动端手指容易戳） */}
      <mesh position={[0, 2, 0]} visible={false}>
        <cylinderGeometry args={[1.2, 1.2, 5, 8]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
      {/* 文字标签 + 副标题 */}
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
      {hovered && portal.desc && (
        <Billboard position={[0, 4.4, 0]}>
          <Text
            fontSize={0.28}
            color="#fef3c7"
            outlineWidth={0.04}
            outlineColor="#000000"
            anchorX="center"
            anchorY="middle"
          >
            {portal.desc}
          </Text>
        </Billboard>
      )}
    </group>
  );
}
