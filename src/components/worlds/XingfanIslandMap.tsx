/**
 * v0.32.7: 星帆岛俯视小岛地图 —— 4 个建筑 + 海岸 hex tiles + 装饰。
 *
 * 主题：远航/海岛/旅游。用 KayKit 黄色 buildings (sand/sun beach feel)。
 * Sprint 2 Day 1: 登机口 active；其他 3 建设中。
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import type { Group } from "three";
import {
  XINGFAN_BUILDINGS,
  type XingfanBuilding,
} from "../../content/worlds/xingfan";
import { KayBuilding, KayProp } from "./KayBuilding";

interface XingfanIslandMapProps {
  onSelectBuilding: (b: XingfanBuilding) => void;
  onHoverBuilding?: (b: XingfanBuilding | null) => void;
}

export function XingfanIslandMap({
  onSelectBuilding,
  onHoverBuilding,
}: XingfanIslandMapProps) {
  return (
    <group>
      {/* 大海蓝色圆 (作背景) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <circleGeometry args={[26, 64]} />
        <meshStandardMaterial color="#0ea5e9" roughness={0.8} />
      </mesh>
      {/* 沙滩圆 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[16, 64]} />
        <meshStandardMaterial color="#fde68a" roughness={0.95} />
      </mesh>
      {/* 中央草地圆 (岛中心) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[10, 32]} />
        <meshStandardMaterial color="#86efac" roughness={0.9} />
      </mesh>

      {/* v0.33.37 (Ep113 xingfan-glow-paths): 海面 wave 流环 + 建筑 → 中心 path 流光 */}
      <OceanWaves />
      <HarborPaths />

      {/* 4 个建筑 */}
      {XINGFAN_BUILDINGS.map((b) => (
        <KayBuilding
          key={b.id}
          gltfUrl={b.gltfUrl}
          position={b.position}
          scale={1.4}
          rotationY={b.rotationY ?? 0}
          active={b.active}
          accentColor={b.color}
          label={`${b.emoji} ${b.name}`}
          sublabel={b.active ? b.skillHint : b.tagline}
          onSelect={() => onSelectBuilding(b)}
          onHoverChange={(hov) => onHoverBuilding?.(hov ? b : null)}
        />
      ))}

      {/* 中央 mascot 占位 */}
      <CenterMascot />

      {/* 装饰：barrel / flag / 山 / 云 / 沙滩 buoys */}
      <KayProp gltfUrl="/env/kaykit/medieval/deco/barrel.gltf" position={[-3, 0, 2]} scale={1.0} />
      <KayProp gltfUrl="/env/kaykit/medieval/deco/flag_blue.gltf" position={[3, 0, 2]} scale={1.0} rotationY={Math.PI / 4} />
      <KayProp gltfUrl="/env/kaykit/medieval/deco/cloud_big.gltf" position={[12, 6, -10]} scale={1.2} />
      <KayProp gltfUrl="/env/kaykit/medieval/deco/cloud_small.gltf" position={[-13, 7, 8]} scale={1.0} />
      <KayProp gltfUrl="/env/kaykit/medieval/deco/hill_single_C.gltf" position={[-13, 0, -8]} scale={1.0} />
      <KayProp gltfUrl="/env/kaykit/medieval/deco/hill_single_C.gltf" position={[14, 0, 8]} scale={1.2} rotationY={Math.PI / 2} />
    </group>
  );
}

function CenterMascot() {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.position.y = 0.7 + Math.sin(t * 1.2) * 0.15;
    ref.current.rotation.y = t * 0.4;
  });
  return (
    <group ref={ref} position={[0, 0.7, 0]}>
      <mesh>
        <octahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial
          color="#a5f3fc"
          emissive="#06b6d4"
          emissiveIntensity={1.6}
          roughness={0.3}
        />
      </mesh>
      <Billboard position={[0, 0.55, 0]}>
        <Text fontSize={0.35} anchorX="center" anchorY="middle">👩‍🏫</Text>
      </Billboard>
    </group>
  );
}

/**
 * v0.33.37 (Ep113 xingfan-glow-paths): 海面 3 圈 emissive 波浪
 *  - 3 圈 ringGeometry 在海洋圆上方反向慢转 + scale 微脉动
 *  - 中圈最亮 cyan，内外圈较弱
 *  - prefers-reduced-motion: 静态显示，opacity 减半
 */
function OceanWaves() {
  const inner = useRef<THREE.Mesh>(null);
  const mid = useRef<THREE.Mesh>(null);
  const outer = useRef<THREE.Mesh>(null);
  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  useFrame(({ clock }) => {
    if (reduceMotion) return;
    const t = clock.elapsedTime;
    if (inner.current) inner.current.rotation.z = t * 0.06;
    if (mid.current) mid.current.rotation.z = -t * 0.05;
    if (outer.current) outer.current.rotation.z = t * 0.04;
    const pulse = 1 + Math.sin(t * 0.7) * 0.012;
    if (mid.current) mid.current.scale.setScalar(pulse);
  });
  return (
    <group>
      {/* outer wave (最外，海岸边) */}
      <mesh
        ref={outer}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.04, 0]}
        raycast={() => null}
        renderOrder={1}
      >
        <ringGeometry args={[22, 23.5, 96]} />
        <meshBasicMaterial
          color="#22d3ee"
          transparent
          opacity={reduceMotion ? 0.18 : 0.32}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {/* mid wave */}
      <mesh
        ref={mid}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.035, 0]}
        raycast={() => null}
        renderOrder={1}
      >
        <ringGeometry args={[19, 21, 96]} />
        <meshBasicMaterial
          color="#67e8f9"
          transparent
          opacity={reduceMotion ? 0.25 : 0.46}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      {/* inner wave (沙滩边) */}
      <mesh
        ref={inner}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.03, 0]}
        raycast={() => null}
        renderOrder={1}
      >
        <ringGeometry args={[16.2, 17.2, 96]} />
        <meshBasicMaterial
          color="#a5f3fc"
          transparent
          opacity={reduceMotion ? 0.18 : 0.36}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

/**
 * v0.33.37 (Ep113 xingfan-glow-paths): 每栋建筑 → 中心 cyan path 流光
 *  - 用 boxGeometry 沿 X 拉长 + rotation 转到 from→to 方向
 *  - 4 段 path 用 additiveBlending + stroke-dash-style opacity 流动（背景一条灰底 + 上层一段流光段）
 *  - active 建筑 path 亮，locked 建筑 path 暗（信号"哪条线开通了"）
 */
function HarborPaths() {
  const segs = useMemo(
    () =>
      XINGFAN_BUILDINGS.map((b, i) => {
        const dx = b.position[0];
        const dz = b.position[1];
        const length = Math.hypot(dx, dz);
        const midX = dx / 2;
        const midZ = dz / 2;
        const yaw = -Math.atan2(dz, dx);
        return {
          id: b.id,
          length,
          midX,
          midZ,
          yaw,
          active: b.active,
          color: b.color,
          phase: i * 0.7,
        };
      }),
    [],
  );
  const flowRefs = useRef<(THREE.Mesh | null)[]>([]);
  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  useFrame(({ clock }) => {
    if (reduceMotion) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const mesh = flowRefs.current[i];
      if (!seg || !mesh) continue;
      // 流光段沿 path 内外往复 (active 才动，locked 慢爬)
      const speed = seg.active ? 0.7 : 0.2;
      const phase = ((t * speed + seg.phase) % 1);
      // 段在 path 局部坐标内沿 X 方向移动；length 减 0.8 给段长留空间
      const segLen = 0.8;
      const localX = -seg.length / 2 + segLen / 2 + phase * (seg.length - segLen);
      mesh.position.x = localX;
    }
  });
  return (
    <group>
      {segs.map((seg, i) => (
        <group
          key={seg.id}
          position={[seg.midX, 0.01, seg.midZ]}
          rotation={[0, seg.yaw, 0]}
        >
          {/* path 底层 (浅灰常态) */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0]}
            raycast={() => null}
            renderOrder={2}
          >
            <planeGeometry args={[seg.length, 0.22]} />
            <meshBasicMaterial
              color={seg.active ? "#cbd5e1" : "#94a3b8"}
              transparent
              opacity={seg.active ? 0.62 : 0.36}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          {/* 流光段 (active 主题色，locked 灰) */}
          <mesh
            ref={(m) => {
              flowRefs.current[i] = m;
            }}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[-seg.length / 2 + 0.4, 0.005, 0]}
            raycast={() => null}
            renderOrder={3}
          >
            <planeGeometry args={[0.8, 0.26]} />
            <meshBasicMaterial
              color={seg.active ? seg.color : "#94a3b8"}
              transparent
              opacity={seg.active ? 0.85 : 0.32}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
