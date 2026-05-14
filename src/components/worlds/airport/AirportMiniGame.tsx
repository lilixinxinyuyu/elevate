/**
 * v0.32.51 (Ep27 D): 登机口 mini-game 玩法差异化 —— **传送带 + 时机点击**。
 *
 * 玩法升级：原来是桌上摆 emoji 拖到 cart（跟 store v0.32.48 之前 / bank 重复）。
 * 现在：行李在传送带 (z 方向) 持续移动，旅客气泡说要 X backpack + Y suitcase。
 * Selena 必须在行李经过发光抓取区 (cyan ring) 时点击 → 才能装上 cart。
 * 校验仍是: 每种 itemId 数量精确匹配 requests，多了/类型错弹 hint 卡。
 *
 * 数学+英语训练 (暗在游戏后面):
 *   - 数量词 + plural -s
 *   - 时机判定 = 视觉空间感知（区分 store 点击 + bank 键盘 + bakery 扇形切）
 */

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
// v0.32.22: BillboardText 替代 drei Text — 防遮挡
import { Text } from "../BillboardText";
import * as THREE from "three";
import type { AirportOrder, LuggageId } from "../../../lib/worlds/airportOrders";
import { LUGGAGE } from "../../../lib/worlds/airportOrders";

const COUNTER_Y = 1.0;
// v0.32.43: radius 0.28 → 0.35
const CART_ZONE = { id: "cart", x: 0.45, z: 0.4, radius: 0.35 };

// v0.32.51 传送带几何：从柜台后方 z=-0.7 流向前方 z=+0.55，靠左侧 (x=-0.45)
const BELT = {
  startZ: -0.7,
  endZ: 0.55,
  x: -0.45,
  width: 0.5,
  grabZ: 0.15,
  /** 抓取窗口半宽（z 维度），0.18 ≈ 0.36m 总宽 */
  grabWindow: 0.18,
  /** 移动速度 m/s */
  speed: 0.28,
};
const BELT_LOOP = BELT.endZ - BELT.startZ;

interface AirportMiniGameProps {
  order: AirportOrder;
  onOrderComplete: () => void;
  /** v0.32.13: 内层反馈 trigger */
  onFeedback?: (kind: "pickup" | "drop" | "wrong", label?: string, hint?: string) => void;
}

interface LuggageInstance {
  instanceId: string;
  itemId: LuggageId;
  emoji: string;
  /** 传送带横向 lane 微偏 (避免重叠) */
  laneOffset: number;
  /** 起始延迟（秒）— 让多件错开滚动 */
  spawnDelay: number;
}

export function AirportMiniGame({ order, onOrderComplete, onFeedback }: AirportMiniGameProps) {
  const luggageInstances = useMemo<LuggageInstance[]>(() => {
    const out: LuggageInstance[] = [];
    // 把所有 pool 件数集中到传送带；用 spawnDelay 错开
    let runningIdx = 0;
    const total = order.pool.reduce((s, p) => s + p.count, 0);
    // 让 total 个行李均匀分布在 BELT_LOOP 的时间周期上
    const period = BELT_LOOP / BELT.speed; // 秒 / 满圈
    const dt = period / Math.max(total, 1);
    order.pool.forEach((p) => {
      for (let i = 0; i < p.count; i++) {
        out.push({
          instanceId: `${p.itemId}-${i}`,
          itemId: p.itemId,
          emoji: LUGGAGE[p.itemId].emoji,
          // 同 itemId 同 lane (奇偶差 ±0.08) 防完全重叠
          laneOffset: ((runningIdx % 3) - 1) * 0.08,
          spawnDelay: runningIdx * dt,
        });
        runningIdx++;
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

  /**
   * v0.32.51 (Ep27 D): 点击行李 — 必须在抓取窗口内 + 类型/数量校验。
   * 返回 true 才标记 loaded（其余情况已弹 wrong/hint）。
   */
  const tryGrab = (instanceId: string, inWindow: boolean): boolean => {
    if (!inWindow) {
      onFeedback?.(
        "wrong",
        "时机不对！再等一下",
        "等行李滑到 cyan 圈圈里再点 — 这就是机场扫描区。",
      );
      return false;
    }
    return handleDrop(instanceId);
  };

  const handleDrop = (instanceId: string): boolean => {
    // v0.32.13: 装错类（订单里没要求这个 itemId）/ 超量 → wrong + reject
    const inst = luggageInstances.find((i) => i.instanceId === instanceId);
    if (!inst) return false;
    const wanted = order.requests.find((r) => r.itemId === inst.itemId);
    if (!wanted) {
      const requested = order.requests
        .map((r) =>
          `${r.quantity} ${r.quantity > 1 ? LUGGAGE[r.itemId].englishPlural : LUGGAGE[r.itemId].english}`,
        )
        .join(" + ");
      onFeedback?.(
        "wrong",
        `客人没要 ${LUGGAGE[inst.itemId].english}`,
        order.hint ?? `客人的清单：${requested}。这件不在清单上。`,
      );
      return false;
    }
    const currentCount = counts[inst.itemId] ?? 0;
    if (currentCount >= wanted.quantity) {
      onFeedback?.(
        "wrong",
        `${LUGGAGE[inst.itemId].english} 已经够 ${wanted.quantity} 件了`,
        order.hint ?? `${LUGGAGE[inst.itemId].english} 客人只要 ${wanted.quantity} 件 — 再装就超量了。`,
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
      {/* Cart 区域（接收行李）— v0.32.43: 加实体 box cart + 栏杆 + 轮子 */}
      <group position={[CART_ZONE.x, COUNTER_Y + 0.005, CART_ZONE.z]}>
        {/* cart 底板 */}
        <mesh position={[0, -0.005, 0]}>
          <boxGeometry args={[CART_ZONE.radius * 2 * 0.9, 0.05, CART_ZONE.radius * 2 * 0.7]} />
          <meshStandardMaterial color="#52525b" metalness={0.4} roughness={0.5} />
        </mesh>
        {/* 两侧栏杆 */}
        {[-1, 1].map((s, i) => (
          <mesh key={i} position={[s * CART_ZONE.radius * 0.85, 0.09, 0]}>
            <boxGeometry args={[0.04, 0.18, CART_ZONE.radius * 2 * 0.7]} />
            <meshStandardMaterial color="#a1a1aa" metalness={0.5} />
          </mesh>
        ))}
        {/* 4 个小轮 */}
        {([
          [-1, -1], [1, -1], [-1, 1], [1, 1],
        ] as const).map(([sx, sz], i) => (
          <mesh
            key={i}
            position={[sx * CART_ZONE.radius * 0.75, -0.04, sz * CART_ZONE.radius * 0.55]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.035, 0.035, 0.02, 16]} />
            <meshStandardMaterial color="#18181b" metalness={0.3} />
          </mesh>
        ))}
        {/* emissive ring 高亮（保留） */}
        <mesh position={[0, 0.025, 0]} rotation={[-Math.PI / 2, 0, 0]}>
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

      {/* 传送带表面 (v0.32.51) */}
      <mesh
        position={[BELT.x, COUNTER_Y - 0.01, (BELT.startZ + BELT.endZ) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[BELT.width, BELT_LOOP]} />
        <meshStandardMaterial color="#27272a" roughness={0.7} metalness={0.3} />
      </mesh>
      {/* 传送带边缘 / 滚轴提示横条 */}
      {Array.from({ length: 7 }).map((_, i) => {
        const z = BELT.startZ + (BELT_LOOP / 6) * i;
        return (
          <mesh
            key={i}
            position={[BELT.x, COUNTER_Y + 0.005, z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[BELT.width, 0.015]} />
            <meshStandardMaterial color="#52525b" />
          </mesh>
        );
      })}
      {/* v0.32.80 (Ep56 TTTT): 抓取区动态变色 — 有行李在窗口内时 cyan→amber + 快脉动 */}
      <GrabZoneRing instances={luggageInstances} loadedIds={loadedIds} />
      <Text
        position={[BELT.x, COUNTER_Y + 0.18, BELT.grabZ]}
        fontSize={0.04}
        color="#0e7490"
        outlineWidth={0.005}
        outlineColor="#fff"
        anchorX="center"
        anchorY="middle"
      >
        ✨ 抓取区
      </Text>

      {/* 行李在传送带上滚动 (v0.32.51) */}
      {luggageInstances.map((inst) => {
        if (loadedIds.has(inst.instanceId)) return null;
        return (
          <MovingLuggage
            key={inst.instanceId}
            instance={inst}
            onGrab={(inWindow) => tryGrab(inst.instanceId, inWindow)}
            onHover={() => onFeedback?.("pickup")}
          />
        );
      })}
    </group>
  );
}

/**
 * v0.32.51: 单个行李在传送带上循环移动 — useFrame 更新 z 位置。
 * 点击时把当前 z 是否在 grabWindow 内传给 onGrab。
 */
/**
 * v0.32.80 (Ep56 TTTT): 抓取区 ring 动态变色 — 有行李进窗口时切 cyan→amber + 快脉动。
 * 用 useFrame 实时检测，不接 React state（避免每帧重渲）。
 */
function GrabZoneRing({
  instances,
  loadedIds,
}: {
  instances: LuggageInstance[];
  loadedIds: Set<string>;
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const tmpColor = useMemo(() => new THREE.Color(), []);
  const tmpEmissive = useMemo(() => new THREE.Color(), []);
  useFrame(({ clock }) => {
    const mat = matRef.current;
    if (!mat) return;
    const t = clock.elapsedTime;
    // 检查是否有未装的行李正在 grab window 内
    const active = instances.some((inst) => {
      if (loadedIds.has(inst.instanceId)) return false;
      const tt = t + inst.spawnDelay;
      const z = BELT.startZ + ((tt * BELT.speed) % BELT_LOOP);
      return Math.abs(z - BELT.grabZ) <= BELT.grabWindow;
    });
    // active: amber pulse 8Hz, idle: cyan pulse 3Hz
    const baseIntensity = active ? 2.2 : 1.5;
    const pulse = Math.sin(t * (active ? 8 : 3)) * (active ? 0.55 : 0.25);
    mat.color.copy(tmpColor.set(active ? "#fbbf24" : "#22d3ee"));
    mat.emissive.copy(tmpEmissive.set(active ? "#f59e0b" : "#06b6d4"));
    mat.emissiveIntensity = baseIntensity + pulse;
    mat.opacity = active ? 0.98 : 0.85;
  });
  return (
    <mesh
      position={[BELT.x, COUNTER_Y + 0.025, BELT.grabZ]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry args={[BELT.grabWindow + 0.04, BELT.grabWindow + 0.1, 32]} />
      <meshStandardMaterial
        ref={matRef}
        color="#22d3ee"
        emissive="#06b6d4"
        emissiveIntensity={1.5}
        side={THREE.DoubleSide}
        transparent
        opacity={0.85}
      />
    </mesh>
  );
}

function MovingLuggage({
  instance,
  onGrab,
  onHover,
}: {
  instance: LuggageInstance;
  onGrab: (inWindow: boolean) => void;
  onHover: () => void;
}) {
  const ref = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime + instance.spawnDelay;
    const z = BELT.startZ + ((t * BELT.speed) % BELT_LOOP);
    ref.current.position.set(BELT.x + instance.laneOffset, COUNTER_Y + 0.08, z);
  });
  return (
    <group
      ref={ref}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
        onHover();
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "default";
      }}
      onClick={(e) => {
        e.stopPropagation();
        const z = ref.current?.position.z ?? 0;
        const inWindow = Math.abs(z - BELT.grabZ) <= BELT.grabWindow;
        onGrab(inWindow);
      }}
    >
      <Text fontSize={0.16} anchorX="center" anchorY="middle">
        {instance.emoji}
      </Text>
      <Text
        position={[0, -0.1, 0]}
        fontSize={0.04}
        color="#ffffff"
        outlineWidth={0.005}
        outlineColor="#000"
        anchorX="center"
        anchorY="middle"
      >
        {LUGGAGE[instance.itemId].english}
      </Text>
    </group>
  );
}
