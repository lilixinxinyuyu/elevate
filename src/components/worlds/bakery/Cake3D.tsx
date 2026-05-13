/**
 * v0.32.5: 12-slice procedural 蛋糕 —— 每块是 CylinderGeometry 的扇形 wedge。
 *
 * Three.js `cylinderGeometry(r, r, h, segments, _, _, thetaStart, thetaLength)`
 * 支持 partial cylinder，刚好做 1/12 扇形蛋糕块。
 */

import { useRef, useState } from "react";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";

interface CakeSliceProps {
  /** 块 index 0-11 */
  index: number;
  /** 总块数 */
  total: number;
  /** 蛋糕半径 */
  radius?: number;
  /** 块厚度 */
  height?: number;
  /** 顶颜色 */
  topColor?: string;
  /** 装饰色（边、底） */
  accentColor?: string;
}

export function CakeSlice({
  index,
  total,
  radius = 0.42,
  height = 0.18,
  topColor = "#fda4af",
  accentColor = "#dc2626",
}: CakeSliceProps) {
  const thetaLength = (Math.PI * 2) / total;
  const thetaStart = index * thetaLength;
  // 间隙：每块 wedge 比理论小 5%，留出"切痕"
  const gap = thetaLength * 0.04;
  const drawTheta = thetaLength - gap;
  // 交替顶色（深浅） 让相邻块视觉可区分
  const altTop = index % 2 === 0 ? topColor : shiftColor(topColor, -0.12);
  return (
    <group rotation={[0, gap / 2, 0]}>
      {/* 蛋糕体（侧 + 底）— 用 accent color */}
      <mesh>
        <cylinderGeometry
          args={[radius, radius, height, 16, 1, false, thetaStart, drawTheta]}
        />
        <meshStandardMaterial color={accentColor} roughness={0.7} />
      </mesh>
      {/* 顶层奶油 */}
      <mesh position={[0, height / 2 + 0.005, 0]}>
        <cylinderGeometry
          args={[radius * 0.98, radius * 0.98, 0.04, 16, 1, false, thetaStart, drawTheta]}
        />
        <meshStandardMaterial color={altTop} roughness={0.5} emissive={altTop} emissiveIntensity={0.05} />
      </mesh>
    </group>
  );
}

/** 简单 hex 颜色调色 (deltaR/G/B in [-1,1]) */
function shiftColor(hex: string, delta: number): string {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return hex;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(parseInt(m[1]!, 16) * (1 + delta));
  const g = clamp(parseInt(m[2]!, 16) * (1 + delta));
  const b = clamp(parseInt(m[3]!, 16) * (1 + delta));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

interface CakeProps {
  topColor?: string;
  accentColor?: string;
  /** 已取走的块 indices */
  removedSlices?: Set<number>;
  /** 每块的 onPointerDown 触发拖拽 (返回 false 表示不响应) */
  onSlicePointerDown?: (sliceIndex: number, e: PointerEvent) => void;
  /** hover 当前 index */
  hoverSliceIndex?: number | null;
  onHoverChange?: (idx: number | null) => void;
}

/** 完整 12-slice 蛋糕（每块独立可点） */
export function Cake({
  topColor = "#fda4af",
  accentColor = "#dc2626",
  removedSlices = new Set(),
  onSlicePointerDown,
  hoverSliceIndex = null,
  onHoverChange,
}: CakeProps) {
  return (
    <group>
      {Array.from({ length: 12 }, (_, i) => i).map((i) => {
        if (removedSlices.has(i)) return null;
        const hovered = hoverSliceIndex === i;
        return (
          <group
            key={i}
            position={[0, hovered ? 0.05 : 0, 0]}
            onPointerOver={(e) => {
              e.stopPropagation();
              onHoverChange?.(i);
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              onHoverChange?.(null);
              document.body.style.cursor = "default";
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSlicePointerDown?.(i, e.nativeEvent);
            }}
          >
            <CakeSlice index={i} total={12} topColor={topColor} accentColor={accentColor} />
          </group>
        );
      })}
      {/* 蛋糕分块圈数标识 */}
      <Text
        position={[0, -0.15, 0]}
        fontSize={0.05}
        color="#ffffff"
        outlineWidth={0.008}
        outlineColor="#000"
        anchorX="center"
        anchorY="middle"
      >
        12 块整蛋糕
      </Text>
    </group>
  );
}

/** 顾客盘子 —— 接收 slice 的 ring zone */
interface PlateProps {
  position: [number, number, number];
  collectedSlices: number;
  needSlices: number;
  topColor: string;
  accentColor: string;
}

export function Plate({ position, collectedSlices, needSlices, topColor, accentColor }: PlateProps) {
  const enough = collectedSlices >= needSlices;
  const ref = useRef<Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.position.y = position[1] + (enough ? Math.sin(t * 3) * 0.02 : 0);
  });
  return (
    <group position={position}>
      {/* 盘子主体 */}
      <mesh ref={ref}>
        <cylinderGeometry args={[0.22, 0.18, 0.03, 32]} />
        <meshStandardMaterial color="#f5f5f4" roughness={0.4} metalness={0.1} />
      </mesh>
      {/* 盘内边 */}
      <mesh position={[0, 0.018, 0]}>
        <ringGeometry args={[0.14, 0.21, 32]} />
        <meshStandardMaterial color="#e5e5e4" side={2} />
      </mesh>
      {/* 收集到的 slice 堆 */}
      {Array.from({ length: collectedSlices }, (_, i) => i).map((i) => {
        const a = (i / 12) * Math.PI * 2;
        const r = 0.12;
        return (
          <mesh key={i} position={[Math.cos(a) * r, 0.035 + i * 0.006, Math.sin(a) * r]}>
            <cylinderGeometry args={[0.05, 0.05, 0.03, 8]} />
            <meshStandardMaterial color={topColor} emissive={accentColor} emissiveIntensity={0.1} />
          </mesh>
        );
      })}
      {/* 提示文字 */}
      <Text
        position={[0, 0.25, 0]}
        fontSize={0.035}
        color={enough ? "#10b981" : "#92400e"}
        outlineWidth={0.005}
        outlineColor="#000"
        anchorX="center"
        anchorY="middle"
      >
        {`${collectedSlices}/${needSlices} 块`}
      </Text>
    </group>
  );
}
