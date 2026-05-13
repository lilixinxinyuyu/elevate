/**
 * v0.32.3: 和平小卖部环境 —— 第一人称柜台 mini-game。
 *
 * 实测 KayKit kitchencounter_straight_A 是 2m×1m×2m, 台面 Y=1.0。
 * 单 counter 放原点，camera 在 Z=+1.6 朝向 counter (人物视角)。
 */

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const KAY_RB = "/env/kaykit/restaurant";

function KayMesh({
  url,
  position = [0, 0, 0],
  rotationY = 0,
  scale = 1,
}: {
  url: string;
  position?: [number, number, number];
  rotationY?: number;
  scale?: number;
}) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.castShadow = false;
        m.receiveShadow = false;
        m.frustumCulled = true;
      }
    });
    return c;
  }, [scene]);
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
 * 主环境：单个 counter 放在玩家面前。
 * 玩家相机在 Z=+1.6，counter 中心在 origin (X=Y=Z=0)。
 * Counter 占 X:[-1,+1] Y:[0,+1] Z:[-1,+1.04]，台面 Y=1.0。
 *
 * 货架箱在 counter 两侧 (X=±2.5)，离玩家较远但可见。
 */
export function StoreEnvironment() {
  return (
    <group>
      {/* 主柜台 */}
      <KayMesh url={`${KAY_RB}/kitchencounter_straight_A.gltf`} position={[0, 0, 0]} scale={1.0} />

      {/* 左侧货架箱 (堆叠 2 个) */}
      <KayMesh url={`${KAY_RB}/crate_carrots.gltf`} position={[-2.0, 0, 0.2]} scale={0.9} />
      <KayMesh url={`${KAY_RB}/crate_tomatoes.gltf`} position={[-2.0, 0.55, 0.2]} scale={0.9} rotationY={Math.PI / 6} />

      {/* 右侧货架箱 */}
      <KayMesh url={`${KAY_RB}/crate_potatoes.gltf`} position={[2.0, 0, 0.2]} scale={0.9} />
      <KayMesh url={`${KAY_RB}/crate_buns.gltf`} position={[2.0, 0.55, 0.2]} scale={0.9} rotationY={-Math.PI / 6} />

      {/* 柜台后方装饰: jar + menu */}
      <KayMesh url={`${KAY_RB}/jar_A_small.gltf`} position={[-0.75, 1.0, -0.7]} scale={1.0} />
      <KayMesh url={`${KAY_RB}/jar_B_small.gltf`} position={[0.75, 1.0, -0.7]} scale={1.0} />
      <KayMesh url={`${KAY_RB}/menu.gltf`} position={[0, 1.0, -0.9]} scale={1.0} />
    </group>
  );
}

// Preload restaurant assets
useGLTF.preload(`${KAY_RB}/kitchencounter_straight_A.gltf`);
useGLTF.preload(`${KAY_RB}/crate_carrots.gltf`);
useGLTF.preload(`${KAY_RB}/crate_tomatoes.gltf`);
useGLTF.preload(`${KAY_RB}/crate_potatoes.gltf`);
useGLTF.preload(`${KAY_RB}/crate_buns.gltf`);
useGLTF.preload(`${KAY_RB}/jar_A_small.gltf`);
useGLTF.preload(`${KAY_RB}/jar_B_small.gltf`);
useGLTF.preload(`${KAY_RB}/menu.gltf`);

/** 单个 KayKit 商品 mesh (拖拽用) */
export function StoreItemMesh({
  gltfUrl,
  scale = 1,
}: {
  gltfUrl: string;
  scale?: number;
}) {
  return <KayMesh url={gltfUrl} scale={scale} />;
}

// Preload food ingredients
useGLTF.preload(`${KAY_RB}/food_ingredient_carrot.gltf`);
useGLTF.preload(`${KAY_RB}/food_ingredient_tomato.gltf`);
useGLTF.preload(`${KAY_RB}/food_ingredient_bun.gltf`);
useGLTF.preload(`${KAY_RB}/food_ingredient_potato.gltf`);
useGLTF.preload(`${KAY_RB}/food_ingredient_cheese.gltf`);
useGLTF.preload(`${KAY_RB}/food_ingredient_onion.gltf`);
