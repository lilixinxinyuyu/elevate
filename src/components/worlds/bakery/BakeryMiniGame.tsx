/**
 * v0.32.5: 甜心面包店 mini-game —— 12-slice 蛋糕分块。
 *
 * 玩法: 点击 cake slice → slice removed + 顾客盘子 +1 块 → 数量到 needSlices → 完成。
 * 点击式（比拖拽 simpler，10 岁友好）。
 */

import { useRef, useState } from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import type { BakeryOrder } from "../../../lib/worlds/bakeryOrders";
import { Cake, Plate } from "./Cake3D";

interface BakeryMiniGameProps {
  order: BakeryOrder;
  onOrderComplete: () => void;
}

const COUNTER_Y = 1.0;

export function BakeryMiniGame({ order, onOrderComplete }: BakeryMiniGameProps) {
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [hover, setHover] = useState<number | null>(null);
  const wasNotifiedRef = useRef(false);

  const collected = removed.size;
  const enough = collected >= order.needSlices;
  const exact = collected === order.needSlices;

  if (exact && !wasNotifiedRef.current) {
    wasNotifiedRef.current = true;
    setTimeout(() => onOrderComplete(), 900);
  }

  const handleSliceClick = (idx: number) => {
    if (enough) return; // 别 overshoot
    setRemoved((prev) => {
      const n = new Set(prev);
      n.add(idx);
      return n;
    });
  };

  return (
    <group>
      {/* 蛋糕本体 — 桌台中后部 */}
      <group position={[-0.4, COUNTER_Y + 0.1, -0.25]}>
        <Cake
          topColor={order.cakeTopColor}
          accentColor={order.cakeAccentColor}
          removedSlices={removed}
          onSlicePointerDown={(idx) => handleSliceClick(idx)}
          hoverSliceIndex={hover}
          onHoverChange={setHover}
        />
      </group>

      {/* 顾客盘子 — 桌台前部 */}
      <Plate
        position={[0.5, COUNTER_Y + 0.04, 0.3]}
        collectedSlices={collected}
        needSlices={order.needSlices}
        topColor={order.cakeTopColor}
        accentColor={order.cakeAccentColor}
      />

      {/* 标题：当前分数目标 — 调小 + 远离 camera */}
      <Text
        position={[0, COUNTER_Y + 0.85, -0.6]}
        fontSize={0.05}
        color="#f59e0b"
        outlineWidth={0.006}
        outlineColor="#000"
        anchorX="center"
        anchorY="middle"
      >
        {`目标: ${order.fractionLabel} 个 ${order.emoji} (${order.needSlices}/12 块)`}
      </Text>
      {exact && (
        <Text
          position={[0, COUNTER_Y + 0.75, -0.6]}
          fontSize={0.05}
          color="#10b981"
          outlineWidth={0.006}
          outlineColor="#000"
          anchorX="center"
          anchorY="middle"
        >
          🎉 正好！送给客人～
        </Text>
      )}

      {/* 提示性"已切下"音效占位 — 用一个发光 ring 在蛋糕脚下表示活跃 */}
      <mesh position={[-0.4, COUNTER_Y - 0.04, -0.25]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.46, 0.5, 24]} />
        <meshStandardMaterial
          color={order.cakeAccentColor}
          emissive={order.cakeAccentColor}
          emissiveIntensity={0.6}
          side={THREE.DoubleSide}
          transparent
          opacity={0.7}
        />
      </mesh>
    </group>
  );
}
