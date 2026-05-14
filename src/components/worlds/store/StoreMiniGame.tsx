/**
 * v0.32.3: 小卖部 mini-game 状态机 —— 3 单 cycle (扫码+找零)。
 *
 * 流程:
 *   intro → scan → change → reward → next order / finish
 *
 * 数学训练 (暗在游戏后面):
 *   - 扫码: 总价 = sum(item.priceCent × quantity) → 小数乘 + 加
 *   - 找零: change = paidCent - totalCent → 小数减
 *   - 全程用 cent 整数运算，避免 0.1+0.2 浮点坑
 */

import { useMemo, useRef, useState } from "react";
// v0.32.22: 用 BillboardText 替代 drei Text — 默认关 depthTest 防遮挡
import { Text } from "../BillboardText";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import * as THREE from "three";
import {
  COINS,
  ORDERS,
  STORE_ITEMS,
  calcOrderChangeCent,
  calcOrderTotalCent,
  formatYuan,
  type Coin,
  type Order,
} from "../../../lib/worlds/storeOrders";
import { DraggableObject } from "./DraggableObject";
import { StoreItemMesh } from "./StoreScene";
import { Coin3D } from "./Coin3D";

export type StorePhase = "intro" | "scan" | "change" | "reward";

interface StoreMiniGameProps {
  order: Order;
  phase: StorePhase;
  onPhaseChange: (phase: StorePhase) => void;
  onOrderComplete: () => void;
  /** v0.32.13: 内层反馈层 trigger（pickup/drop/wrong） */
  onFeedback?: (kind: "pickup" | "drop" | "wrong", label?: string, hint?: string) => void;
}

// KayKit kitchencounter_straight_A 台面 Y=1.0（实测 bbox）
const COUNTER_Y = 1.0;
// 扫码篮 / 找零托盘 都在柜台台面前部（靠近 camera）
// v0.32.43: radius 0.22 → 0.30，zone 更显眼
const SCAN_ZONE = { id: "scan", x: -0.5, z: 0.4, radius: 0.30 };
const TRAY_ZONE = { id: "tray", x: 0.5, z: 0.4, radius: 0.30 };

export function StoreMiniGame({
  order,
  phase,
  onPhaseChange,
  onOrderComplete,
  onFeedback,
}: StoreMiniGameProps) {
  // ============ scan phase 状态 ============
  // 把订单展开成单个商品列表 (e.g. carrot×3 → 3 个 carrot 实例)
  const itemInstances = useMemo(() => {
    const out: { instanceId: string; itemId: string; emoji: string; price: number; gltf: string }[] = [];
    for (const req of order.requests) {
      const item = STORE_ITEMS[req.itemId];
      if (!item) continue;
      for (let i = 0; i < req.quantity; i++) {
        out.push({
          instanceId: `${req.itemId}-${i}`,
          itemId: req.itemId,
          emoji: item.emoji,
          price: item.priceCent,
          gltf: item.gltf,
        });
      }
    }
    return out;
  }, [order]);

  const [scannedIds, setScannedIds] = useState<Set<string>>(new Set());
  const scannedTotalCent = useMemo(() => {
    let total = 0;
    for (const inst of itemInstances) {
      if (scannedIds.has(inst.instanceId)) total += inst.price;
    }
    return total;
  }, [scannedIds, itemInstances]);

  // v0.32.49 (Ep25 B-2): 点击扫码 — 飞行中商品 ghost 队列
  interface FlyingItemState {
    instanceId: string;
    gltfUrl: string;
    fromX: number;
    fromZ: number;
    startedAt: number;
  }
  const [flyingItems, setFlyingItems] = useState<FlyingItemState[]>([]);

  // 商品摆放位置 — 柜台台面中后部（远离玩家的扫码篮）
  const itemPositions = useMemo(() => {
    const n = itemInstances.length;
    const out: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / Math.max(n, 1);
      const x = -0.6 + t * 1.2;
      const z = -0.3; // 柜台中后部
      out.push([x, z]);
    }
    return out;
  }, [itemInstances]);

  // ============ change phase 状态 ============
  const [trayCent, setTrayCent] = useState(0);
  const [coinsUsed, setCoinsUsed] = useState<Set<string>>(new Set());
  const needChangeCent = useMemo(() => calcOrderChangeCent(order), [order]);

  // 钱币摆放位置 (每个面额放 3 个，柜台中部铺开)
  type CoinInstance = { instanceId: string; coin: Coin; origin: [number, number] };
  const coinInstances = useMemo<CoinInstance[]>(() => {
    const out: CoinInstance[] = [];
    COINS.forEach((coin, ci) => {
      for (let i = 0; i < 3; i++) {
        out.push({
          instanceId: `${coin.label}-${i}`,
          coin,
          origin: [-0.55 + ci * 0.55, -0.3 + i * 0.06],
        });
      }
    });
    return out;
  }, []);

  const handleScanDrop = (instanceId: string): boolean => {
    setScannedIds((prev) => new Set(prev).add(instanceId));
    onFeedback?.("drop");
    return true;
  };

  // v0.32.49 (Ep25 B-2): 点击商品 → ghost 飞向 SCAN_ZONE → 落定后才标 scanned
  const FLY_DURATION_MS = 320;
  const handleScanClick = (instanceId: string, pos: [number, number]) => {
    // 已在飞行 / 已扫过 — 忽略
    if (scannedIds.has(instanceId)) return;
    if (flyingItems.some((f) => f.instanceId === instanceId)) return;
    const inst = itemInstances.find((i) => i.instanceId === instanceId);
    if (!inst) return;
    setFlyingItems((prev) => [
      ...prev,
      {
        instanceId,
        gltfUrl: inst.gltf,
        fromX: pos[0],
        fromZ: pos[1],
        startedAt: performance.now(),
      },
    ]);
    onFeedback?.("pickup");
    window.setTimeout(() => {
      setFlyingItems((prev) => prev.filter((f) => f.instanceId !== instanceId));
      handleScanDrop(instanceId);
    }, FLY_DURATION_MS);
  };

  // 检测 scan 阶段完成
  const allScanned = scannedIds.size === itemInstances.length;

  /** v0.32.13: 超额放币 → wrong + reject（DraggableObject 自动 snap 回） */
  const handleCoinDrop = (instanceId: string, valueCent: number): boolean => {
    const newTotal = trayCent + valueCent;
    if (newTotal > needChangeCent) {
      onFeedback?.(
        "wrong",
        `找多了！再放就 ${formatYuan(newTotal)} 啦`,
        order.hint ?? `应找零 ${formatYuan(needChangeCent)}；先看现在托盘里还差多少。`,
      );
      return false;
    }
    setCoinsUsed((prev) => new Set(prev).add(instanceId));
    setTrayCent(newTotal);
    onFeedback?.("drop");
    return true;
  };

  // 检测 change 阶段完成（金额相等）
  const changeMatch = trayCent === needChangeCent;
  const wasNotifiedRef = useRef(false);
  if (phase === "change" && changeMatch && !wasNotifiedRef.current) {
    wasNotifiedRef.current = true;
    setTimeout(() => onOrderComplete(), 600);
  }
  // reset ref when order changes
  if (phase === "intro") wasNotifiedRef.current = false;

  // ===== Render =====
  return (
    <group>
      {/* 扫码篮 (柜台左侧发光圆环) — scan phase 可见 */}
      {phase === "scan" && (
        <DropZoneRing
          x={SCAN_ZONE.x}
          z={SCAN_ZONE.z}
          radius={SCAN_ZONE.radius}
          color="#10b981"
          label={`总价 ${formatYuan(scannedTotalCent)}`}
          sweep
        />
      )}
      {/* 找零托盘 (柜台右侧) — change phase 可见 */}
      {phase === "change" && (
        <DropZoneRing
          x={TRAY_ZONE.x}
          z={TRAY_ZONE.z}
          radius={TRAY_ZONE.radius}
          color={changeMatch ? "#10b981" : "#fbbf24"}
          label={`已放 ${formatYuan(trayCent)} / 需 ${formatYuan(needChangeCent)}`}
        />
      )}

      {/* v0.32.49 (Ep25 B-2): Scan phase 改成"点击扫码" — 跟 Bakery 扇形切机制差异化 */}
      {phase === "scan" &&
        itemInstances.map((inst, i) => {
          if (scannedIds.has(inst.instanceId)) return null;
          const pos = itemPositions[i]!;
          // 飞行中的商品不渲染原位 mesh
          const flying = flyingItems.some((f) => f.instanceId === inst.instanceId);
          if (flying) return null;
          return (
            <ScannableStoreItem
              key={inst.instanceId}
              x={pos[0]}
              z={pos[1]}
              gltfUrl={inst.gltf}
              price={inst.price}
              onClick={() => handleScanClick(inst.instanceId, pos)}
            />
          );
        })}

      {/* 飞行中的商品 ghost — 从原位飞向 SCAN_ZONE */}
      {flyingItems.map((f) => (
        <FlyingItem
          key={f.instanceId}
          instanceId={f.instanceId}
          gltfUrl={f.gltfUrl}
          fromX={f.fromX}
          fromZ={f.fromZ}
          toX={SCAN_ZONE.x}
          toZ={SCAN_ZONE.z}
          startedAt={f.startedAt}
        />
      ))}

      {/* === Scan-done 按钮: 全部扫码完后显示 "完成扫码" === */}
      {phase === "scan" && allScanned && (
        <ProceedButton
          position={[0, COUNTER_Y + 0.25, -0.15]}
          label={`✅ 扫码完成 ${formatYuan(scannedTotalCent)} - 去找零`}
          onClick={() => onPhaseChange("change")}
        />
      )}

      {/* === Change phase: 钱币桌前 === */}
      {phase === "change" &&
        coinInstances.map((inst) => {
          if (coinsUsed.has(inst.instanceId)) return null;
          return (
            <DraggableObject
              key={inst.instanceId}
              origin={inst.origin}
              planeY={COUNTER_Y}
              dropZones={[TRAY_ZONE]}
              onDrop={() => handleCoinDrop(inst.instanceId, inst.coin.valueCent)}
              onPickup={() => onFeedback?.("pickup")}
            >
              <Coin3D coin={inst.coin} />
            </DraggableObject>
          );
        })}
    </group>
  );
}

/** 柜台上某 zone 的发光圆环 + 上方提示文字 */
function DropZoneRing({
  x,
  z,
  radius,
  color,
  label,
  sweep = false,
}: {
  x: number;
  z: number;
  radius: number;
  color: string;
  label: string;
  /** v0.32.81 (Ep57 VVVV): 扫码灯条来回扫，仅在 scan zone 用 */
  sweep?: boolean;
}) {
  return (
    <group position={[x, COUNTER_Y + 0.005, z]}>
      {/* v0.32.43: 加实体浅碗（cylinder）+ 保留 emissive ring 高亮 */}
      <mesh position={[0, -0.015, 0]}>
        <cylinderGeometry args={[radius * 1.02, radius * 0.88, 0.035, 32]} />
        <meshStandardMaterial
          color="#f5f5f4"
          roughness={0.55}
          metalness={0.15}
        />
      </mesh>
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius - 0.04, radius, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.2}
          side={THREE.DoubleSide}
          transparent
          opacity={0.9}
        />
      </mesh>
      {/* v0.32.81 (Ep57 VVVV): 扫描线 sweep — 像超市扫码枪的红线来回扫 */}
      {sweep && <ScanSweepBar radius={radius} color={color} />}
      <Text
        position={[0, 0.18, 0]}
        fontSize={0.045}
        color={color}
        outlineWidth={0.006}
        outlineColor="#000"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}

function ProceedButton({
  position,
  label,
  onClick,
}: {
  position: [number, number, number];
  label: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <group
      position={position}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = "default";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <mesh>
        <planeGeometry args={[0.8, 0.16]} />
        <meshBasicMaterial color={hovered ? "#22c55e" : "#16a34a"} transparent opacity={0.95} />
      </mesh>
      <Text
        position={[0, 0, 0.01]}
        fontSize={0.06}
        color="#ffffff"
        outlineWidth={0.006}
        outlineColor="#000"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  );
}

/**
 * v0.32.81 (Ep57 VVVV): 扫描线 sweep — 在扫码篮内来回滑动 emissive bar，
 * 视觉上像超市扫码枪扫描，强化"现在在扫码"的玩法感。
 */
function ScanSweepBar({ radius, color }: { radius: number; color: string }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    // 来回扫：用 sin 周期 1.8s, amplitude = radius * 0.72
    const amp = radius * 0.72;
    const z = Math.sin(t * 1.6) * amp;
    group.current.position.z = z;
    // bar 长度也轻微 wobble，看起来不死板
    const sx = 0.92 + Math.sin(t * 6) * 0.04;
    group.current.scale.x = sx;
  });
  return (
    <group ref={group} position={[0, 0.025, 0]}>
      {/* 主 bar */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[radius * 1.7, 0.05]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* 副 bar — 在主 bar 左侧拖尾 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -0.04]}>
        <planeGeometry args={[radius * 1.5, 0.03]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* 副 bar — 右侧 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.04]}>
        <planeGeometry args={[radius * 1.5, 0.03]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.4}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * v0.32.49 (Ep25 B-2): 飞行中商品 ghost — 从原位抛物线飞向扫码篮，途中缩小 + 微旋转。
 */
function FlyingItem({
  gltfUrl,
  fromX,
  fromZ,
  toX,
  toZ,
  startedAt,
}: {
  instanceId: string;
  gltfUrl: string;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  startedAt: number;
}) {
  const groupRef = useRef<Group>(null);
  const FLY_DURATION_MS = 320;
  useFrame(() => {
    if (!groupRef.current) return;
    const elapsed = performance.now() - startedAt;
    const t = Math.min(1, elapsed / FLY_DURATION_MS);
    const e = 1 - Math.pow(1 - t, 3);
    const arc = Math.sin(t * Math.PI) * 0.25;
    const x = fromX + (toX - fromX) * e;
    const y = COUNTER_Y + 0.05 + arc;
    const z = fromZ + (toZ - fromZ) * e;
    groupRef.current.position.set(x, y, z);
    const s = 0.35 * (1 - 0.35 * e);
    groupRef.current.scale.setScalar(s);
    groupRef.current.rotation.y = t * Math.PI * 0.9;
  });
  return (
    <group ref={groupRef} position={[fromX, COUNTER_Y, fromZ]} scale={0.35}>
      <StoreItemMesh gltfUrl={gltfUrl} scale={1} />
    </group>
  );
}

/**
 * v0.32.79 (Ep55 XXX): 扫码阶段商品 mesh — idle bob + hover scale/lift + amber ring。
 * 价格标签不动画（防文字抖动），只动 mesh wrapper。
 */
function ScannableStoreItem({
  x,
  z,
  gltfUrl,
  price,
  onClick,
}: {
  x: number;
  z: number;
  gltfUrl: string;
  price: number;
  onClick: () => void;
}) {
  const meshRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const seedRef = useRef(Math.random() * Math.PI * 2);
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime + seedRef.current;
    const targetScale = hovered ? 0.43 : 0.35;
    const cur = meshRef.current.scale.x;
    meshRef.current.scale.setScalar(cur + (targetScale - cur) * 0.18);
    meshRef.current.position.y =
      Math.sin(t * 2.4) * 0.012 + (hovered ? 0.05 : 0);
    meshRef.current.rotation.y =
      Math.sin(t * 1.6) * 0.05 + (hovered ? 0.18 : 0);
  });
  return (
    <group
      position={[x, COUNTER_Y, z]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        document.body.style.cursor = "default";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {/* hover amber ring */}
      {hovered && (
        <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.13, 0.17, 24]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#fbbf24"
            emissiveIntensity={1.4}
            side={THREE.DoubleSide}
            transparent
            opacity={0.85}
          />
        </mesh>
      )}
      {/* mesh wrapper (受动画) */}
      <group ref={meshRef} scale={0.35}>
        <StoreItemMesh gltfUrl={gltfUrl} scale={1} />
      </group>
      {/* 价签 — 锚定不抖动 */}
      <Text
        position={[0, 0.15, 0]}
        fontSize={0.06}
        color="#ffffff"
        outlineWidth={0.008}
        outlineColor="#000"
        anchorX="center"
        anchorY="middle"
      >
        {formatYuan(price)}
      </Text>
    </group>
  );
}

// Re-export for parent
export { calcOrderTotalCent, calcOrderChangeCent, formatYuan, ORDERS };
