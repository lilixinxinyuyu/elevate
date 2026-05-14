/**
 * v0.32.2: 悬空入口单个学科 orb —— KayKit 真素材组合（hex tile + 招牌建筑 + 装饰）。
 *
 * v0.32.0 → v0.32.2：
 *  - 之前 procedural box / 半球 / 塔 被爸爸否决（"难看 / 资源包里已有小镇小岛"）。
 *  - 现在每个 orb 是 1 个 hex tile 底盘 + 1-3 个 KayKit GLTF 建筑/装饰组合，
 *    像一个迷你浮岛村庄。来源数据：world.orbAssets。
 *  - Active vs Locked 视觉对比：active = 全色;locked = 灰度 ground + 🔒
 */

import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { Group } from "three";
import type { OrbAsset, WorldDef } from "../../content/worlds/worlds";

interface WorldOrbProps {
  world: WorldDef;
  position: [number, number, number];
  onSelect?: (w: WorldDef) => void;
}

export function WorldOrb({ world, position, onSelect }: WorldOrbProps) {
  const ref = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    // 缓慢自转 + 浮动
    ref.current.rotation.y = t * (world.unlocked ? 0.25 : 0.08);
    ref.current.position.y = position[1] + Math.sin(t * 1.0 + position[0]) * 0.15;
    // hover 上抬
    const targetLift = hovered && world.unlocked ? 0.35 : 0;
    ref.current.position.y += targetLift;
    // hover 时放大
    const targetScale = hovered && world.unlocked ? 1.15 : 1.0;
    const cur = ref.current.scale.x;
    ref.current.scale.setScalar(cur + (targetScale - cur) * 0.15);
  });

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (!world.unlocked) return;
    onSelect?.(world);
  };
  const handleOver = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = world.unlocked ? "pointer" : "not-allowed";
  };
  const handleOut = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setHovered(false);
    document.body.style.cursor = "default";
  };

  return (
    <group
      ref={ref}
      position={position}
      onClick={handleClick}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
    >
      {/* v0.32.74 (Ep50 Z): 底座 glow + 双 ring + accent particles，仅 unlocked */}
      {world.unlocked && (
        <OrbBaseAura accent={world.accent} hovered={hovered} seed={position[0]} />
      )}
      {/* KayKit 真素材组合（hex tile + 建筑 + 装饰） */}
      <OrbMiniScene assets={world.orbAssets} locked={!world.unlocked} />

      {/* 锁定状态加 🔒 漂浮在建筑上方 */}
      {!world.unlocked && (
        <Billboard position={[0, 1.5, 0]}>
          <Text fontSize={0.7} anchorX="center" anchorY="middle">🔒</Text>
        </Billboard>
      )}
      {/* 名字标签（建筑上方） */}
      <Billboard position={[0, 2.4, 0]}>
        <Text
          fontSize={0.42}
          color={world.unlocked ? "#ffffff" : "#cbd5e1"}
          outlineWidth={0.05}
          outlineColor="#000000"
          anchorX="center"
          anchorY="middle"
        >
          {`${world.emoji} ${world.name}`}
        </Text>
      </Billboard>
      {/* tagline / lock hint */}
      <Billboard position={[0, 1.95, 0]}>
        <Text
          fontSize={0.22}
          color={world.unlocked ? "#fef3c7" : "#94a3b8"}
          outlineWidth={0.03}
          outlineColor="#000000"
          anchorX="center"
          anchorY="middle"
        >
          {world.unlocked ? world.tagline : (world.lockHint ?? "敬请期待")}
        </Text>
      </Billboard>
    </group>
  );
}

/** 把一组 KayKit GLTF 摆在一个 hex tile 上 */
function OrbMiniScene({
  assets,
  locked,
}: {
  assets: { tile: string; items: OrbAsset[] };
  locked: boolean;
}) {
  const tileGltf = useGLTF(assets.tile);
  return (
    <group>
      {/* tile 底盘 */}
      <ClonedPrimitive scene={tileGltf.scene} position={[0, 0, 0]} scale={0.85} locked={locked} />
      {/* tile 上的 items */}
      {assets.items.map((item, i) => (
        <OrbItem key={i} item={item} locked={locked} />
      ))}
    </group>
  );
}

function OrbItem({ item, locked }: { item: OrbAsset; locked: boolean }) {
  const { scene } = useGLTF(item.gltf);
  return (
    <ClonedPrimitive
      scene={scene}
      position={item.offset}
      rotationY={item.rotationY ?? 0}
      scale={item.scale ?? 1}
      locked={locked}
    />
  );
}

/** Clone gltf scene + 应用 transform + locked 灰度 */
function ClonedPrimitive({
  scene,
  position,
  rotationY = 0,
  scale = 1,
  locked,
}: {
  scene: THREE.Object3D;
  position: [number, number, number];
  rotationY?: number;
  scale?: number;
  locked: boolean;
}) {
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.castShadow = false;
        m.receiveShadow = false;
        m.frustumCulled = true;
        if (locked) {
          // 灰度滤镜：必须 clone 材质，否则会影响原 scene + 其他 orb
          const origMat = m.material as THREE.MeshStandardMaterial;
          const newMat = origMat.clone();
          newMat.color = new THREE.Color(0.45, 0.45, 0.5);
          newMat.emissive = new THREE.Color(0, 0, 0);
          m.material = newMat;
        }
      }
    });
    return c;
  }, [scene, locked]);
  return (
    <primitive
      object={cloned}
      position={position}
      rotation={[0, rotationY, 0]}
      scale={scale}
    />
  );
}

/**
 * v0.32.74 (Ep50 Z): orb 底座光晕 — 双 ring + 10 个 accent 粒子绕环旋转。
 * hover 时整体放大 + 内 ring 加亮，强化首屏吸引力。
 */
function OrbBaseAura({
  accent,
  hovered,
  seed,
}: {
  accent: string;
  hovered: boolean;
  seed: number;
}) {
  const group = useRef<Group>(null);
  // 10 deterministic dots around outer ring (避免 SSR 抖动)
  const particles = useMemo(() => {
    const N = 10;
    return Array.from({ length: N }, (_, i) => {
      const angle = (i / N) * Math.PI * 2 + (seed * 0.3);
      const radius = 1.45 + ((i * 7 + Math.abs(seed * 13)) % 5) * 0.018;
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        size: 0.045 + ((i * 3) % 5) * 0.008,
        phase: (i / N) * Math.PI * 2,
      };
    });
  }, [seed]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    // 缓慢自转
    group.current.rotation.y = t * (hovered ? 0.35 : 0.15);
    // hover 时整体微脉动
    const base = hovered ? 1.06 : 1.0;
    const pulse = hovered ? 1 + Math.sin(t * 3) * 0.025 : 1;
    group.current.scale.setScalar(base * pulse);
  });

  return (
    <group ref={group} position={[0, -0.12, 0]}>
      {/* 内环：主色发光 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.0, 1.3, 48]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={hovered ? 0.7 : 0.4}
          side={THREE.DoubleSide}
        />
      </mesh>
      {/* 外环：柔光晕（更宽更淡） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]}>
        <ringGeometry args={[1.32, 1.75, 64]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={hovered ? 0.28 : 0.16}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* 中央 disc 浅 glow 给底盘垫色 */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <circleGeometry args={[0.98, 36]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={hovered ? 0.18 : 0.1}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* 10 颗围绕粒子（小 sphere） */}
      {particles.map((p, i) => (
        <OrbAuraParticle
          key={i}
          x={p.x}
          z={p.z}
          size={p.size}
          phase={p.phase}
          accent={accent}
          hovered={hovered}
        />
      ))}
    </group>
  );
}

function OrbAuraParticle({
  x,
  z,
  size,
  phase,
  accent,
  hovered,
}: {
  x: number;
  z: number;
  size: number;
  phase: number;
  accent: string;
  hovered: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() * 2 + phase;
    const yOff = Math.sin(t) * (hovered ? 0.08 : 0.04);
    ref.current.position.set(x, yOff, z);
    const s = (hovered ? 1.4 : 1) * (1 + Math.sin(t * 1.5) * 0.18);
    ref.current.scale.setScalar(s);
  });
  return (
    <mesh ref={ref} position={[x, 0, z]}>
      <sphereGeometry args={[size, 10, 10]} />
      <meshBasicMaterial
        color={accent}
        transparent
        opacity={hovered ? 0.95 : 0.7}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

// preload 入口 orb 需要的 KayKit assets
useGLTF.preload("/env/kaykit/medieval/tiles/hex_coast_A.gltf");
useGLTF.preload("/env/kaykit/medieval/tiles/hex_coast_D.gltf");
useGLTF.preload("/env/kaykit/medieval/tiles/hex_grass.gltf");
useGLTF.preload("/env/kaykit/medieval/yellow/building_windmill_yellow.gltf");
useGLTF.preload("/env/kaykit/medieval/yellow/building_home_A_yellow.gltf");
useGLTF.preload("/env/kaykit/medieval/red/building_watermill_red.gltf");
useGLTF.preload("/env/kaykit/medieval/red/building_church_red.gltf");
