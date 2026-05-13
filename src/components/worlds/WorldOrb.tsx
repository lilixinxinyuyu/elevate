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
      {/* 底座光环（仅 unlocked） */}
      {world.unlocked && (
        <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.0, 1.3, 32]} />
          <meshBasicMaterial
            color={world.accent}
            transparent
            opacity={hovered ? 0.6 : 0.35}
            side={THREE.DoubleSide}
          />
        </mesh>
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

// preload 入口 orb 需要的 KayKit assets
useGLTF.preload("/env/kaykit/medieval/tiles/hex_coast_A.gltf");
useGLTF.preload("/env/kaykit/medieval/tiles/hex_coast_D.gltf");
useGLTF.preload("/env/kaykit/medieval/tiles/hex_grass.gltf");
useGLTF.preload("/env/kaykit/medieval/yellow/building_windmill_yellow.gltf");
useGLTF.preload("/env/kaykit/medieval/yellow/building_home_A_yellow.gltf");
useGLTF.preload("/env/kaykit/medieval/red/building_watermill_red.gltf");
useGLTF.preload("/env/kaykit/medieval/red/building_church_red.gltf");
