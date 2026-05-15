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

import { useMemo, useRef, useState } from "react";
// v0.32.22: BillboardText 替代 drei Text — 防遮挡
import { Text } from "../BillboardText";
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
  onFeedback?: (kind: "pickup" | "drop" | "wrong", label?: string, hint?: string) => void;
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
/** v0.33.27 (Ep103 bakery-cake-particles): 蛋糕切下时 8 颗 spark 粒子 */
interface SparkBurst {
  idx: number;
  key: number;
  startedAt: number;
}
/** v0.33.27 (Ep103 bakery-cake-particles): 切片落盘时 dust puff */
interface DustPuff {
  key: number;
  startedAt: number;
}

const FLY_DURATION_MS = 380;
const SPARK_DURATION_MS = 620;
const DUST_DURATION_MS = 480;
const SPARK_COUNT = 8;

export function BakeryMiniGame({ order, onOrderComplete, onFeedback }: BakeryMiniGameProps) {
  /** cake 上不再渲染的 slice（点了就立刻 add） */
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  /** 已飞到盘子上的数量（影响 plate stack 渲染 + 完成判定） */
  const [collected, setCollected] = useState(0);
  /** 正在飞行的 slice */
  const [flying, setFlying] = useState<FlyingSlice[]>([]);
  /** v0.32.99 (Ep75 QQQQQ): 切块瞬间的 confirm flash overlay */
  const [sliceFlashes, setSliceFlashes] = useState<FlyingSlice[]>([]);
  /** v0.33.23 (Ep99 UUUU): 切错红光 — 非相邻 / 切多的 slice red emissive 闪 + 摇 */
  const [wrongFlashes, setWrongFlashes] = useState<FlyingSlice[]>([]);
  /** v0.33.27 (Ep103 bakery-cake-particles): 切下时 8 颗向外迸的 spark */
  const [sparks, setSparks] = useState<SparkBurst[]>([]);
  /** v0.33.27 (Ep103 bakery-cake-particles): 落盘时 dust puff */
  const [dustPuffs, setDustPuffs] = useState<DustPuff[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  const wasNotifiedRef = useRef(false);

  // v0.33.27 (Ep103): 一次性读 prefers-reduced-motion → R3F useFrame 内用，
  // 同时清掉 Ep99 carry-over 的 reduce-motion debt (SliceWrongFlash shake gate)
  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  const enough = collected >= order.needSlices;
  const exact = collected === order.needSlices;

  if (exact && !wasNotifiedRef.current) {
    wasNotifiedRef.current = true;
    setTimeout(() => onOrderComplete(), 900);
  }

  // v0.32.19：扇形切判定 — 切片必须相邻已切的 slice（第 1 块除外）
  // 数学意义：1/N 蛋糕 = 连续 N/12 块，不是随便挑 N 块
  const isAdjacent = (idx: number, removedSet: Set<number>): boolean => {
    if (removedSet.size === 0) return true; // 第 1 块随便切
    for (const r of removedSet) {
      if ((r + 1) % 12 === idx) return true;
      if ((r - 1 + 12) % 12 === idx) return true;
    }
    return false;
  };

  // v0.33.23 (Ep99 UUUU): wrong flash 触发器 — 在 slice idx 上立 600ms red emissive ring
  const pushWrongFlash = (idx: number) => {
    const key = Date.now() + Math.random();
    setWrongFlashes((prev) => [...prev, { idx, key, startedAt: performance.now() }]);
    window.setTimeout(() => {
      setWrongFlashes((prev) => prev.filter((f) => f.key !== key));
    }, 620);
  };

  const handleSliceClick = (idx: number) => {
    if (enough) {
      // v0.32.13: 切够了还点 → wrong 反馈
      onFeedback?.(
        "wrong",
        "已经切够啦，多了客人吃不下",
        order.hint ?? `${order.fractionLabel} 只要 ${order.needSlices} 块，已经切到啦。`,
      );
      pushWrongFlash(idx);
      return;
    }
    if (removed.has(idx)) return;
    // v0.32.19：扇形切判定 — 必须相邻
    if (order.requireContiguous !== false && !isAdjacent(idx, removed)) {
      onFeedback?.(
        "wrong",
        "要切连成一片！点已切的旁边那块",
        `${order.fractionLabel} = 连续 ${order.needSlices} 块（扇形），不能东切一块西切一块。`,
      );
      // v0.33.23 (Ep99 UUUU): 红色 mesh 闪 + 摇 — 该 slice 上 SliceWrongFlash overlay
      pushWrongFlash(idx);
      return;
    }
    setRemoved((prev) => {
      const n = new Set(prev);
      n.add(idx);
      return n;
    });
    // v0.32.99 (Ep75 QQQQQ): 切块确认 emissive flash overlay — 500ms ring 散开
    const flashKey = Date.now() + Math.random();
    setSliceFlashes((prev) => [
      ...prev,
      { idx, key: flashKey, startedAt: performance.now() },
    ]);
    window.setTimeout(() => {
      setSliceFlashes((prev) => prev.filter((f) => f.key !== flashKey));
    }, 520);
    // v0.33.27 (Ep103 bakery-cake-particles): 切下瞬间 8 颗 spark 向外迸
    if (!reduceMotion) {
      const sparkKey = Date.now() + Math.random();
      setSparks((prev) => [
        ...prev,
        { idx, key: sparkKey, startedAt: performance.now() },
      ]);
      window.setTimeout(() => {
        setSparks((prev) => prev.filter((s) => s.key !== sparkKey));
      }, SPARK_DURATION_MS);
    }
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
      // v0.33.27 (Ep103 bakery-cake-particles): 落盘 dust puff
      if (!reduceMotion) {
        const dustKey = Date.now() + Math.random();
        setDustPuffs((prev) => [
          ...prev,
          { key: dustKey, startedAt: performance.now() },
        ]);
        window.setTimeout(() => {
          setDustPuffs((prev) => prev.filter((d) => d.key !== dustKey));
        }, DUST_DURATION_MS);
      }
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
        {/* v0.32.99 (Ep75 QQQQQ): 切块瞬间 confirm flash (附着在蛋糕坐标系) */}
        {sliceFlashes.map((f) => (
          <SliceConfirmFlash
            key={f.key}
            index={f.idx}
            startedAt={f.startedAt}
            accentColor={order.cakeAccentColor}
          />
        ))}
        {/* v0.33.23 (Ep99 UUUU): 切错红光闪 + 抖 — 非相邻 / 切多时叠在该 slice 上
           v0.33.27 (Ep103): debt 偿还 — reduceMotion 时关 shake，保留 color 信息 */}
        {wrongFlashes.map((f) => (
          <SliceWrongFlash
            key={f.key}
            index={f.idx}
            startedAt={f.startedAt}
            reduceMotion={reduceMotion}
          />
        ))}
        {/* v0.33.27 (Ep103 bakery-cake-particles): 切下时 8 颗 spark 向外迸 */}
        {sparks.map((s) => (
          <SliceSparks
            key={s.key}
            index={s.idx}
            startedAt={s.startedAt}
            accentColor={order.cakeAccentColor}
          />
        ))}
      </group>

      {/* v0.33.27 (Ep103 bakery-cake-particles): 落盘 dust puff —— Plate 坐标 */}
      {dustPuffs.map((d) => (
        <PlateDust key={d.key} startedAt={d.startedAt} />
      ))}

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

/**
 * v0.32.99 (Ep75 QQQQQ): 切块确认 flash — 在被切下的扇形位置画一道发光环 0.5s 散开。
 * 强化"我刚切了这块"的视觉反馈（before slice 飞向盘子）。
 */
function SliceConfirmFlash({
  index,
  startedAt,
  accentColor,
}: {
  index: number;
  startedAt: number;
  accentColor: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const FLASH_MS = 500;
  const thetaLength = (Math.PI * 2) / 12;
  const thetaStart = index * thetaLength;
  const gap = thetaLength * 0.04;
  const drawTheta = thetaLength - gap;
  useFrame(() => {
    if (!ref.current || !matRef.current) return;
    const elapsed = performance.now() - startedAt;
    const k = Math.min(1, elapsed / FLASH_MS);
    const e = 1 - Math.pow(1 - k, 2); // ease-out quad
    const scale = 1 + e * 0.4;
    ref.current.scale.setScalar(scale);
    matRef.current.opacity = 0.9 * (1 - e);
  });
  return (
    <group rotation={[0, gap / 2, 0]}>
      <mesh ref={ref} position={[0, 0.135, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 0.5, 32, 1, thetaStart, drawTheta]} />
        <meshBasicMaterial
          ref={matRef}
          color={accentColor}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/**
 * v0.33.23 (Ep99 UUUU): 切错时蓝标闪一道"红光 wedge"叠在该 slice 上
 *  - 600ms 全周期：前 80ms 拉到 1.05 倍 scale + 红 emissive，后 520ms 衰减
 *  - x 轴 ±0.018 抖一下，模拟 "no!"
 */
function SliceWrongFlash({
  index,
  startedAt,
  reduceMotion = false,
}: {
  index: number;
  startedAt: number;
  reduceMotion?: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const FLASH_MS = 600;
  const thetaLength = (Math.PI * 2) / 12;
  const thetaStart = index * thetaLength;
  const gap = thetaLength * 0.04;
  const drawTheta = thetaLength - gap;
  useFrame(() => {
    if (!groupRef.current || !meshRef.current || !matRef.current) return;
    const elapsed = performance.now() - startedAt;
    const k = Math.min(1, elapsed / FLASH_MS);
    // 0~0.15 拉到峰值, 0.15~1 衰减
    const peakIn = Math.min(1, elapsed / (FLASH_MS * 0.15));
    const decay = k < 0.15 ? 1 : 1 - (k - 0.15) / 0.85;
    const intensity = peakIn * decay;
    matRef.current.opacity = 0.95 * intensity;
    // wedge 整体放大一点
    const scale = 1 + intensity * 0.08;
    meshRef.current.scale.setScalar(scale);
    // x 轴抖 — 高频 sin 模拟 "震"；reduceMotion 关掉
    const shake = reduceMotion
      ? 0
      : Math.sin(elapsed * 0.06) * 0.018 * intensity;
    groupRef.current.position.x = shake;
  });
  return (
    <group ref={groupRef} rotation={[0, gap / 2, 0]}>
      <mesh
        ref={meshRef}
        position={[0, 0.14, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.18, 0.55, 32, 1, thetaStart, drawTheta]} />
        <meshBasicMaterial
          ref={matRef}
          color="#ef4444"
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/**
 * v0.33.27 (Ep103 bakery-cake-particles): 切下时 8 颗 spark 向外迸
 *  - mount 时按 slice 中心角度生成 8 颗均匀分布的速度向量（含小 jitter）
 *  - useFrame 用 elapsed 计算 position + gravity，spark 在 SPARK_DURATION_MS 内
 *    沿初始方向飞出 + 受 0.6 重力下坠
 *  - opacity 平方衰减；scale 0.025 → 0
 *  - additiveBlending + accentColor → "糖屑迸发"质感
 */
function SliceSparks({
  index,
  startedAt,
  accentColor,
}: {
  index: number;
  startedAt: number;
  accentColor: string;
}) {
  const groupRef = useRef<Group>(null);
  const thetaLength = (Math.PI * 2) / 12;
  // slice 中心角度（蛋糕中心 → slice 中点方向）
  const baseAngle = index * thetaLength + thetaLength / 2;
  const radius = 0.42; // slice 中点距蛋糕中心的半径（蛋糕半径 ≈ 0.5）
  // 8 颗 spark 初始数据：从 slice 中点向外 + 上扇形迸出
  const sparkData = useMemo(() => {
    const arr: { vx: number; vy: number; vz: number; phase: number }[] = [];
    for (let i = 0; i < SPARK_COUNT; i++) {
      // 在 slice 朝向 ±40° 内随机散开
      const spread = (Math.random() - 0.5) * 0.7; // ±0.35 rad ≈ ±20°
      const a = baseAngle + spread;
      // 向心 → 沿 a 方向飞，速度 0.6 ~ 1.0 m/s
      const speed = 0.6 + Math.random() * 0.4;
      arr.push({
        vx: Math.cos(a) * speed,
        vz: Math.sin(a) * speed,
        vy: 0.6 + Math.random() * 0.4, // 向上速度
        phase: Math.random(),
      });
    }
    return arr;
  }, [baseAngle]);
  const startX = Math.cos(baseAngle) * radius;
  const startZ = Math.sin(baseAngle) * radius;
  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const elapsed = (performance.now() - startedAt) / 1000; // sec
    const tMax = SPARK_DURATION_MS / 1000;
    const k = Math.min(1, elapsed / tMax);
    const fade = Math.max(0, 1 - k);
    g.children.forEach((child, i) => {
      const data = sparkData[i];
      if (!data) return;
      const mesh = child as THREE.Mesh;
      // position: 初速 + 1.6 重力下坠
      mesh.position.set(
        startX + data.vx * elapsed,
        0.14 + data.vy * elapsed - 1.6 * elapsed * elapsed,
        startZ + data.vz * elapsed,
      );
      mesh.scale.setScalar(0.025 * fade);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.95 * fade * fade;
    });
  });
  return (
    <group ref={groupRef}>
      {sparkData.map((_, i) => (
        <mesh key={i} raycast={() => null} renderOrder={2}>
          <sphereGeometry args={[1, 6, 4]} />
          <meshBasicMaterial
            color={accentColor}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/**
 * v0.33.27 (Ep103 bakery-cake-particles): 切片落盘的 dust puff —— Plate 位置 ring + 几粒尘
 *  - 主 ring 0.05 → 0.18 半径散开，opacity 0.7 → 0
 *  - 6 颗 dust 球随机方向稍稍弹起再落
 */
function PlateDust({ startedAt }: { startedAt: number }) {
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const ringMeshRef = useRef<THREE.Mesh>(null);
  const dustGroupRef = useRef<Group>(null);
  const dustData = useMemo(() => {
    const arr: { vx: number; vz: number; phase: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.random() * 0.4;
      const speed = 0.18 + Math.random() * 0.12;
      arr.push({
        vx: Math.cos(a) * speed,
        vz: Math.sin(a) * speed,
        phase: Math.random(),
      });
    }
    return arr;
  }, []);
  useFrame(() => {
    const ringMat = ringMatRef.current;
    const ringMesh = ringMeshRef.current;
    const dustGroup = dustGroupRef.current;
    if (!ringMat || !ringMesh || !dustGroup) return;
    const elapsed = (performance.now() - startedAt) / 1000;
    const tMax = DUST_DURATION_MS / 1000;
    const k = Math.min(1, elapsed / tMax);
    const ease = 1 - Math.pow(1 - k, 3);
    ringMesh.scale.setScalar(0.5 + ease * 2.4);
    ringMat.opacity = 0.7 * (1 - ease);
    dustGroup.children.forEach((child, i) => {
      const d = dustData[i];
      if (!d) return;
      const mesh = child as THREE.Mesh;
      mesh.position.set(
        d.vx * elapsed,
        0.05 * elapsed * 4 - 1.4 * elapsed * elapsed,
        d.vz * elapsed,
      );
      mesh.scale.setScalar(0.018 * (1 - ease));
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.65 * (1 - ease) * (1 - ease);
    });
  });
  return (
    <group position={PLATE_POS}>
      <mesh
        ref={ringMeshRef}
        position={[0, 0.012, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={() => null}
        renderOrder={3}
      >
        <ringGeometry args={[0.05, 0.08, 24]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color="#fde68a"
          transparent
          opacity={0.7}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <group ref={dustGroupRef}>
        {dustData.map((_, i) => (
          <mesh key={i} raycast={() => null}>
            <sphereGeometry args={[1, 6, 4]} />
            <meshBasicMaterial
              color="#fef3c7"
              transparent
              opacity={0}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
