/**
 * v0.32.4: 百宝银行 换零 mini-game。
 *
 * 单 phase: exchange. 玩家把桌上零钱拖到托盘，累计 = target 完成。
 * 任意 valid combination 都接受（培养"灵活换算"思维）。
 */

import { useMemo, useRef, useState } from "react";
// v0.32.22: BillboardText 替代 drei Text — 防遮挡
import { Text } from "../BillboardText";
import * as THREE from "three";
import { formatYuan } from "../../../lib/worlds/storeOrders";
import type { BankOrder } from "../../../lib/worlds/bankOrders";
import { DraggableObject } from "../store/DraggableObject";
import { Coin3D } from "../store/Coin3D";

const COUNTER_Y = 1.0;
const TRAY_ZONE = { id: "tray", x: 0, z: 0.35, radius: 0.28 };

interface BankMiniGameProps {
  order: BankOrder;
  onOrderComplete: () => void;
  /** v0.32.13: 内层反馈 trigger */
  onFeedback?: (kind: "pickup" | "drop" | "wrong", label?: string) => void;
}

interface CoinInstance {
  instanceId: string;
  valueCent: number;
  color: string;
  label: string;
  radius: number;
  origin: [number, number];
}

export function BankMiniGame({ order, onOrderComplete, onFeedback }: BankMiniGameProps) {
  // 把 poolCoins 展开成单个 coin 实例
  const coinInstances = useMemo<CoinInstance[]>(() => {
    const out: CoinInstance[] = [];
    // 每个面额一个 group，左中右铺开，避免堆在一侧
    const groupCount = order.poolCoins.length;
    const groupSpan = 1.4; // 总宽度
    const groupStart = -groupSpan / 2 + groupSpan / (groupCount * 2);
    order.poolCoins.forEach((pool, gi) => {
      const gx = groupStart + (gi * groupSpan) / groupCount;
      const cols = Math.ceil(pool.count / 4);
      const colStartX = gx - ((cols - 1) * 0.13) / 2;
      for (let i = 0; i < pool.count; i++) {
        const colIdx = Math.floor(i / 4);
        const rowIdx = i % 4;
        out.push({
          instanceId: `${pool.coin.label}-${i}`,
          valueCent: pool.coin.valueCent,
          color: pool.coin.color,
          label: pool.coin.label,
          radius: pool.coin.radius,
          origin: [colStartX + colIdx * 0.13, -0.45 + rowIdx * 0.06],
        });
      }
    });
    return out;
  }, [order]);

  const [trayCent, setTrayCent] = useState(0);
  const [coinsUsed, setCoinsUsed] = useState<Set<string>>(new Set());
  const wasNotifiedRef = useRef(false);

  const target = order.targetCent;
  const match = trayCent === target;

  if (match && !wasNotifiedRef.current) {
    wasNotifiedRef.current = true;
    setTimeout(() => onOrderComplete(), 700);
  }

  const handleDrop = (instanceId: string, valueCent: number): boolean => {
    const newTotal = trayCent + valueCent;
    if (newTotal > target) {
      onFeedback?.("wrong", `放多了！再放就 ${formatYuan(newTotal)}`);
      return false;
    }
    setCoinsUsed((prev) => new Set(prev).add(instanceId));
    setTrayCent(newTotal);
    onFeedback?.("drop");
    return true;
  };

  return (
    <group>
      {/* 换零托盘 */}
      <group position={[TRAY_ZONE.x, COUNTER_Y + 0.005, TRAY_ZONE.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[TRAY_ZONE.radius - 0.04, TRAY_ZONE.radius, 32]} />
          <meshStandardMaterial
            color={match ? "#10b981" : "#3b82f6"}
            emissive={match ? "#10b981" : "#3b82f6"}
            emissiveIntensity={1.3}
            side={THREE.DoubleSide}
            transparent
            opacity={0.9}
          />
        </mesh>
        <Text
          position={[0, 0.18, 0]}
          fontSize={0.035}
          color={match ? "#10b981" : "#3b82f6"}
          outlineWidth={0.005}
          outlineColor="#000"
          anchorX="center"
          anchorY="middle"
        >
          {`托盘 ${formatYuan(trayCent)} / 目标 ${formatYuan(target)}`}
        </Text>
        {match && (
          <Text
            position={[0, 0.1, 0]}
            fontSize={0.04}
            color="#fbbf24"
            outlineWidth={0.006}
            outlineColor="#000"
            anchorX="center"
            anchorY="middle"
          >
            🎉 金额一致！
          </Text>
        )}
      </group>

      {/* 钱币堆 */}
      {coinInstances.map((inst) => {
        if (coinsUsed.has(inst.instanceId)) return null;
        return (
          <DraggableObject
            key={inst.instanceId}
            origin={inst.origin}
            planeY={COUNTER_Y}
            dropZones={[TRAY_ZONE]}
            onDrop={() => handleDrop(inst.instanceId, inst.valueCent)}
            onPickup={() => onFeedback?.("pickup")}
          >
            <Coin3D
              coin={{
                valueCent: inst.valueCent,
                color: inst.color,
                label: inst.label,
                radius: inst.radius,
              }}
            />
          </DraggableObject>
        );
      })}
    </group>
  );
}
