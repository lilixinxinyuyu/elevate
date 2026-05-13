/**
 * v0.32.3: Procedural 钱币 —— 薄 CylinderGeometry + drei Text。
 *
 * GPT-5.5 peer-review 建议：KayKit 没钱币，自画 CylinderGeometry 金银铜三色，
 * 比 emoji 美比 box 真实，scale 跟 KayKit food_ingredient 协调。
 */

import { useMemo } from "react";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import type { Coin } from "../../../lib/worlds/storeOrders";

interface Coin3DProps {
  coin: Coin;
  position?: [number, number, number];
  /** Y 旋转 (弧度) */
  rotationY?: number;
}

export function Coin3D({ coin, position = [0, 0, 0], rotationY = 0 }: Coin3DProps) {
  const matProps = useMemo(
    () => ({
      color: coin.color,
      metalness: 0.7,
      roughness: 0.25,
      emissive: coin.color,
      emissiveIntensity: 0.15,
    }),
    [coin.color],
  );

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* 钱币主体 - 薄圆柱躺平（朝向 +Y） */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[coin.radius, coin.radius, 0.02, 32]} />
        <meshStandardMaterial {...matProps} />
      </mesh>
      {/* 上面文字 */}
      <Text
        position={[0, 0.012, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={coin.radius * 0.7}
        color="#1f2937"
        outlineWidth={0.002}
        outlineColor="#000"
        anchorX="center"
        anchorY="middle"
      >
        {coin.label}
      </Text>
    </group>
  );
}
