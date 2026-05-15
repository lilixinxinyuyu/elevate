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
    // v0.32.93 (Ep69 BBBBB): dispatch hover bridge → WorldsHomePage CenterPanel
    window.dispatchEvent(
      new CustomEvent("worlds-orb-hover", { detail: { id: world.id } }),
    );
  };
  const handleOut = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setHovered(false);
    document.body.style.cursor = "default";
    window.dispatchEvent(
      new CustomEvent("worlds-orb-hover", { detail: { id: null } }),
    );
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
      {/* v0.33.42 (Ep116 moxi-locked-tease): locked 世界加 construction tease */}
      {!world.unlocked && <LockedOrbTease seed={position[0]} />}
      {/* v0.32.93 (Ep69 BBBBB): 名字标签 + chunky badge 背景 (替代裸 Text) */}
      <OrbNameBadge world={world} hovered={hovered} />
      {/* tagline / lock hint */}
      <Billboard position={[0, 1.85, 0]}>
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

/**
 * v0.32.93 (Ep69 BBBBB): WorldOrb 名字 label chunky badge —
 *   accent 色 plane 背景 + 白色 cream 主卡 + Text + hover scale/lift。
 *   替代之前裸 Billboard + Text（裸文字 + 描边显得不够 chunky）。
 */
function OrbNameBadge({ world, hovered }: { world: WorldDef; hovered: boolean }) {
  const group = useRef<Group>(null);
  const text = `${world.emoji} ${world.name}`;
  // 字符按 1 char ≈ 0.32 unit 估宽，限定 max
  const badgeWidth = Math.min(3.4, Math.max(1.4, text.length * 0.34));
  const badgeHeight = 0.55;
  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.elapsedTime;
    const hot = hovered && world.unlocked;
    const targetScale = hot ? 1.08 : 1.0;
    const cur = group.current.scale.x;
    group.current.scale.setScalar(cur + (targetScale - cur) * 0.15);
    group.current.position.y = (hot ? 0.08 : 0) + Math.sin(t * 2) * 0.012;
  });
  const accent = world.accent;
  const locked = !world.unlocked;
  return (
    <Billboard position={[0, 2.42, 0]}>
      <group ref={group}>
        {/* accent 阴影背板（稍大、偏下） */}
        <mesh position={[0, -0.04, -0.02]}>
          <planeGeometry args={[badgeWidth + 0.18, badgeHeight + 0.16]} />
          <meshBasicMaterial
            color={accent}
            transparent
            opacity={locked ? 0.32 : 0.9}
          />
        </mesh>
        {/* 主卡片 — 奶油底 */}
        <mesh>
          <planeGeometry args={[badgeWidth, badgeHeight]} />
          <meshBasicMaterial
            color={locked ? "#e2e8f0" : "#fff7ed"}
            transparent
            opacity={0.96}
          />
        </mesh>
        {/* 文字 */}
        <Text
          fontSize={0.34}
          color={locked ? "#475569" : "#0f172a"}
          outlineWidth={0.014}
          outlineColor="#ffffff"
          anchorX="center"
          anchorY="middle"
          position={[0, 0, 0.005]}
          maxWidth={badgeWidth - 0.2}
        >
          {text}
        </Text>
      </group>
    </Billboard>
  );
}

/**
 * v0.33.42 (Ep116 moxi-locked-tease): locked 世界的"建设中"视觉预告
 *  - 3 颗 construction emoji (🚧 🔨 ⚙️) 绕 orb 轨道环绕
 *  - 上方"建设中"chunky badge ribbon（cyan accent）
 *  - 底部 progress-bar 风格的 4 颗暗 sparkle 慢闪
 *  - prefers-reduced-motion: emoji 静止站位，badge / sparkle 关呼吸
 */
function LockedOrbTease({ seed }: { seed: number }) {
  const groupRef = useRef<Group>(null);
  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const emojiData = useMemo(
    () => [
      { emoji: "🚧", phase: 0, baseY: 0.6 },
      { emoji: "🔨", phase: (Math.PI * 2) / 3, baseY: 0.85 },
      { emoji: "⚙️", phase: (Math.PI * 4) / 3, baseY: 0.45 },
    ],
    [],
  );
  const orbitR = 1.1;
  useFrame((state) => {
    if (!groupRef.current) return;
    if (reduceMotion) return;
    const t = state.clock.getElapsedTime();
    groupRef.current.children.forEach((child, i) => {
      const d = emojiData[i];
      if (!d) return;
      const angle = t * 0.5 + d.phase + seed * 0.3;
      child.position.set(
        Math.cos(angle) * orbitR,
        d.baseY + Math.sin(t * 1.4 + d.phase) * 0.06,
        Math.sin(angle) * orbitR,
      );
    });
  });
  // sparkle 数据
  const sparkleData = useMemo(
    () =>
      [0, 1, 2, 3].map((i) => ({
        x: -0.6 + i * 0.4,
        phase: i * 0.7,
      })),
    [],
  );
  return (
    <group>
      {/* 3 颗 construction emoji 绕轨道 */}
      <group ref={groupRef}>
        {emojiData.map((d, i) => (
          <Billboard key={i} position={[0, d.baseY, 0]}>
            <Text
              fontSize={0.22}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.01}
              outlineColor="#000000"
            >
              {d.emoji}
            </Text>
          </Billboard>
        ))}
      </group>
      {/* "建设中" chunky badge —— mascot-dialog 同款双 plane */}
      <Billboard position={[0, 2.25, 0]}>
        <BuildingSoonBadge />
      </Billboard>
      {/* progress sparkle row 在 orb 底部 */}
      <group position={[0, 0.1, 0]}>
        {sparkleData.map((s, i) => (
          <ProgressSparkle key={i} x={s.x} phase={s.phase} reduceMotion={reduceMotion} />
        ))}
      </group>
    </group>
  );
}

function BuildingSoonBadge() {
  const bgMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const borderMatRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const pulse = 0.78 + Math.sin(t * 1.8) * 0.16;
    if (bgMatRef.current) bgMatRef.current.opacity = pulse;
    if (borderMatRef.current) borderMatRef.current.opacity = pulse;
  });
  return (
    <group>
      <mesh position={[0, 0, -0.002]}>
        <planeGeometry args={[1.5, 0.4]} />
        <meshBasicMaterial
          ref={borderMatRef}
          color="#facc15"
          transparent
          opacity={0.9}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh>
        <planeGeometry args={[1.42, 0.32]} />
        <meshBasicMaterial
          ref={bgMatRef}
          color="#1f2937"
          transparent
          opacity={0.92}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <Text
        position={[0, 0, 0.002]}
        fontSize={0.16}
        color="#fef3c7"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.008}
        outlineColor="#1f2937"
      >
        🏗️ 建设中
      </Text>
    </group>
  );
}

function ProgressSparkle({
  x,
  phase,
  reduceMotion,
}: {
  x: number;
  phase: number;
  reduceMotion: boolean;
}) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (reduceMotion) {
      if (matRef.current) matRef.current.opacity = 0.45;
      return;
    }
    const t = state.clock.getElapsedTime();
    const pulse = 0.3 + (Math.sin(t * 2 + phase) + 1) * 0.3; // 0.3 - 0.9
    if (matRef.current) matRef.current.opacity = pulse;
    if (meshRef.current) {
      const sc = 1 + Math.sin(t * 2 + phase) * 0.18;
      meshRef.current.scale.setScalar(sc);
    }
  });
  return (
    <mesh ref={meshRef} position={[x, 0, 0]} raycast={() => null}>
      <sphereGeometry args={[0.045, 8, 6]} />
      <meshBasicMaterial
        ref={matRef}
        color="#facc15"
        transparent
        opacity={0.6}
        depthWrite={false}
        toneMapped={false}
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
