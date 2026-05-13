/**
 * v0.32.12: 甜心面包店 mini-game —— 12-slice 蛋糕分块 + 飞片动画。
 *
 * 玩法（双 CLI Episode 2 P1 修复）：
 *   - 点击 slice → 立刻从蛋糕上消失 + spawn 一个飞片 ghost wedge
 *   - flying wedge 在 ~380ms 内从蛋糕位置 lerp 到盘子上方 + scale 缩小
 *   - 动画完成 → collected++ → 盘子 stack +1
 *   - 数量到 needSlices → 整单完成（trigger complete 由 Page 处理）
 *
 * 解决 codex review "假点击" 反馈：原来点了就 +1 没有"切的过程"
 */

import { useRef, useState } from "react";
import { Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Group } from "three";
import type { BakeryOrder } from "../../../lib/worlds/bakeryOrders";
import { Cake, Plate } from "./Cake3D";
import { sfx } from "../../../lib/sfx";

interface BakeryMiniGameProps {
  order: BakeryOrder;
  onOrderComplete: () => void;
  /** v0.32.13: 内层反馈 trigger */
  onFeedback?: (kind: "pickup" | "drop" | "wrong", label?: string) => void;
}

const COUNTER_Y = 1.0;
const CAKE_POS: [number, number, number] = [-0.4, COUNTER_Y + 0.1, -0.25];
const PLATE_POS: [number, number, number] = [0.5, COUNTER_Y + 0.04, 0.3];

interface FlyingSlice {
  /** 蛋糕的 slice index（决定起飞角度） */
  idx: number;
  key: number;
  startedAt: number;
}

const FLY_DURATION_MS = 380;

export function BakeryMiniGame({ order, onOrderComplete, onFeedback }: BakeryMiniGameProps) {
  /** cake 上不再渲染的 slice（点了就立刻 add） */
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  /** 已飞到盘子上的数量（影响 plate stack 渲染 + 完成判定） */
  const [collected, setCollected] = useState(0);
  /** 正在飞行的 slice */
  const [flying, setFlying] = useState<FlyingSlice[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  const wasNotifiedRef = useRef(false);

  const enough = collected >= order.needSlices;
  const exact = collected === order.needSlices;

  if (exact && !wasNotifiedRef.current) {
    wasNotifiedRef.current = true;
    setTimeout(() => onOrderComplete(), 900);
  }

  const handleSliceClick = (idx: number) => {
    if (enough) {
      // v0.32.13: 切够了还点 → wrong 反馈
      onFeedback?.("wrong", "已经切够啦，多了客人吃不下");
      return;
    }
    if (removed.has(idx)) return;
    setRemoved((prev) => {
      const n = new Set(prev);
      n.add(idx);
      return n;
    });
    const fkey = Date.now() + Math.random();
    setFlying((prev) => [
      ...prev,
      { idx, key: fkey, startedAt: performance.now() },
    ]);
    onFeedback?.("pickup");
    sfx.tick(); // 切下的轻 tick 音
    window.setTimeout(() => {
      setFlying((prev) => prev.filter((f) => f.key !== fkey));
      setCollected((c) => c + 1);
      sfx.go(); // 落盘的"嗒"音
      onFeedback?.("drop");
    }, FLY_DURATION_MS);
  };

  return (
    <group>
      {/* 蛋糕本体 */}
      <group position={CAKE_POS}>
        <Cake
          topColor={order.cakeTopColor}
          accentColor={order.cakeAccentColor}
          removedSlices={removed}
          onSlicePointerDown={(idx) => handleSliceClick(idx)}
          hoverSliceIndex={hover}
          onHoverChange={setHover}
        />
      </group>

      {/* 飞行中的 slice ghost wedges */}
      {flying.map((f) => (
        <FlyingSliceWedge
          key={f.key}
          sliceIdx={f.idx}
          startedAt={f.startedAt}
          fromPos={CAKE_POS}
          toPos={PLATE_POS}
          topColor={order.cakeTopColor}
          accentColor={order.cakeAccentColor}
        />
      ))}

      {/* 顾客盘子 */}
      <Plate
        position={PLATE_POS}
        collectedSlices={collected}
        needSlices={order.needSlices}
        topColor={order.cakeTopColor}
        accentColor={order.cakeAccentColor}
      />

      {/* 标题 */}
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

/**
 * 飞行中的 slice ghost wedge — 从蛋糕位置抛物线飞向盘子，期间缩小 + 微旋转。
 */
function FlyingSliceWedge({
  sliceIdx,
  startedAt,
  fromPos,
  toPos,
  topColor,
  accentColor,
}: {
  sliceIdx: number;
  startedAt: number;
  fromPos: [number, number, number];
  toPos: [number, number, number];
  topColor: string;
  accentColor: string;
}) {
  const groupRef = useRef<Group>(null);
  const thetaLength = (Math.PI * 2) / 12;
  const thetaStart = sliceIdx * thetaLength;
  const gap = thetaLength * 0.04;
  const drawTheta = thetaLength - gap;

  useFrame(() => {
    if (!groupRef.current) return;
    const elapsed = performance.now() - startedAt;
    const t = Math.min(1, elapsed / FLY_DURATION_MS);
    // 平滑（easeOutCubic）
    const e = 1 - Math.pow(1 - t, 3);
    // 抛物线高度
    const arc = Math.sin(t * Math.PI) * 0.35;
    const x = fromPos[0] + (toPos[0] - fromPos[0]) * e;
    const y = fromPos[1] + (toPos[1] + 0.05 - fromPos[1]) * e + arc;
    const z = fromPos[2] + (toPos[2] - fromPos[2]) * e;
    groupRef.current.position.set(x, y, z);
    // scale: 起始 1.0 → 末尾 0.55
    const s = 1 - 0.45 * e;
    groupRef.current.scale.setScalar(s);
    // 微旋转（沿 Y 轴）
    groupRef.current.rotation.y = t * Math.PI * 0.8;
  });

  return (
    <group ref={groupRef} position={fromPos}>
      <group rotation={[0, gap / 2, 0]}>
        <mesh>
          <cylinderGeometry
            args={[0.42, 0.42, 0.18, 16, 1, false, thetaStart, drawTheta]}
          />
          <meshStandardMaterial color={accentColor} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.09 + 0.005, 0]}>
          <cylinderGeometry
            args={[0.41, 0.41, 0.04, 16, 1, false, thetaStart, drawTheta]}
          />
          <meshStandardMaterial
            color={topColor}
            emissive={topColor}
            emissiveIntensity={0.25}
          />
        </mesh>
      </group>
    </group>
  );
}
