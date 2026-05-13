/**
 * v0.32.7: 登机口 mini-game —— 数量词 + 复数训练。
 *
 * 玩法: 桌上摆 mixed 行李 emoji (拖拽对象)，旅客气泡说要 X backpack + Y suitcase。
 * Selena 拖正确数量的行李到 "Cart" 区域。校验:
 *   - 每种 itemId 数量精确匹配 requests
 *   - 多了/少了/类型错都不通过
 */

import { useMemo, useRef, useState } from "react";
// v0.32.22: BillboardText 替代 drei Text — 防遮挡
import { Text } from "../BillboardText";
import * as THREE from "three";
import type { AirportOrder, LuggageId } from "../../../lib/worlds/airportOrders";
import { LUGGAGE } from "../../../lib/worlds/airportOrders";
import { DraggableObject } from "../store/DraggableObject";

const COUNTER_Y = 1.0;
const CART_ZONE = { id: "cart", x: 0.45, z: 0.4, radius: 0.28 };

interface AirportMiniGameProps {
  order: AirportOrder;
  onOrderComplete: () => void;
  /** v0.32.13: 内层反馈 trigger */
  onFeedback?: (kind: "pickup" | "drop" | "wrong", label?: string) => void;
}

interface LuggageInstance {
  instanceId: string;
  itemId: LuggageId;
  emoji: string;
  origin: [number, number];
}

export function AirportMiniGame({ order, onOrderComplete, onFeedback }: AirportMiniGameProps) {
  const luggageInstances = useMemo<LuggageInstance[]>(() => {
    const out: LuggageInstance[] = [];
    const groupCount = order.pool.length;
    const groupSpan = 1.4;
    order.pool.forEach((p, gi) => {
      const gx = -groupSpan / 2 + groupSpan / (groupCount * 2) + (gi * groupSpan) / groupCount;
      for (let i = 0; i < p.count; i++) {
        out.push({
          instanceId: `${p.itemId}-${i}`,
          itemId: p.itemId,
          emoji: LUGGAGE[p.itemId].emoji,
          origin: [gx + (i % 2 === 0 ? -0.07 : 0.07), -0.4 + Math.floor(i / 2) * 0.18],
        });
      }
    });
    return out;
  }, [order]);

  // 已装到 cart 的行李 id 集合，分别按 itemId 统计
  const [loadedIds, setLoadedIds] = useState<Set<string>>(new Set());
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const inst of luggageInstances) {
      if (loadedIds.has(inst.instanceId)) {
        c[inst.itemId] = (c[inst.itemId] ?? 0) + 1;
      }
    }
    return c;
  }, [loadedIds, luggageInstances]);

  // 校验: 每种 itemId 数量等于 requests 中对应 quantity
  const exact = useMemo(() => {
    const wanted: Record<string, number> = {};
    for (const req of order.requests) wanted[req.itemId] = req.quantity;
    // 全部 requests 满足，且没多放未要求的
    for (const id of Object.keys(wanted)) {
      if ((counts[id] ?? 0) !== wanted[id]) return false;
    }
    for (const id of Object.keys(counts)) {
      if (!(id in wanted)) return false;
    }
    return true;
  }, [counts, order]);

  const wasNotifiedRef = useRef(false);
  if (exact && !wasNotifiedRef.current) {
    wasNotifiedRef.current = true;
    setTimeout(() => onOrderComplete(), 800);
  }

  const handleDrop = (instanceId: string): boolean => {
    // v0.32.13: 装错类（订单里没要求这个 itemId）/ 超量 → wrong + reject
    const inst = luggageInstances.find((i) => i.instanceId === instanceId);
    if (!inst) return false;
    const wanted = order.requests.find((r) => r.itemId === inst.itemId);
    if (!wanted) {
      onFeedback?.("wrong", `客人没要 ${LUGGAGE[inst.itemId].english}`);
      return false;
    }
    const currentCount = counts[inst.itemId] ?? 0;
    if (currentCount >= wanted.quantity) {
      onFeedback?.(
        "wrong",
        `${LUGGAGE[inst.itemId].english} 已经够 ${wanted.quantity} 件了`,
      );
      return false;
    }
    setLoadedIds((prev) => new Set(prev).add(instanceId));
    onFeedback?.("drop");
    return true;
  };

  // requested 列表 progress 显示
  const progressText = order.requests
    .map((r) => `${counts[r.itemId] ?? 0}/${r.quantity} ${LUGGAGE[r.itemId].english}`)
    .join("  ·  ");

  return (
    <group>
      {/* Cart 区域（接收行李） */}
      <group position={[CART_ZONE.x, COUNTER_Y + 0.005, CART_ZONE.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[CART_ZONE.radius - 0.04, CART_ZONE.radius, 32]} />
          <meshStandardMaterial
            color={exact ? "#10b981" : "#06b6d4"}
            emissive={exact ? "#10b981" : "#06b6d4"}
            emissiveIntensity={1.2}
            side={THREE.DoubleSide}
            transparent
            opacity={0.9}
          />
        </mesh>
        <Text
          position={[0, 0.2, 0]}
          fontSize={0.035}
          color={exact ? "#10b981" : "#0e7490"}
          outlineWidth={0.005}
          outlineColor="#000"
          anchorX="center"
          anchorY="middle"
        >
          🛒 Cart
        </Text>
        <Text
          position={[0, 0.14, 0]}
          fontSize={0.028}
          color="#0e7490"
          outlineWidth={0.004}
          outlineColor="#000"
          anchorX="center"
          anchorY="middle"
        >
          {progressText}
        </Text>
      </group>

      {/* 行李 emoji 拖拽对象 */}
      {luggageInstances.map((inst) => {
        if (loadedIds.has(inst.instanceId)) return null;
        return (
          <DraggableObject
            key={inst.instanceId}
            origin={inst.origin}
            planeY={COUNTER_Y}
            dropZones={[CART_ZONE]}
            onDrop={() => handleDrop(inst.instanceId)}
            onPickup={() => onFeedback?.("pickup")}
          >
            <group>
              {/* emoji 用 3D text 模拟（drei Text supports emoji） */}
              <Text
                fontSize={0.16}
                anchorX="center"
                anchorY="middle"
              >
                {inst.emoji}
              </Text>
              {/* 英文标签 */}
              <Text
                position={[0, -0.1, 0]}
                fontSize={0.04}
                color="#ffffff"
                outlineWidth={0.005}
                outlineColor="#000"
                anchorX="center"
                anchorY="middle"
              >
                {LUGGAGE[inst.itemId].english}
              </Text>
            </group>
          </DraggableObject>
        );
      })}
    </group>
  );
}
