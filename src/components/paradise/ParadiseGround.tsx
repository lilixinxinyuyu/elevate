/**
 * v0.32.x: 轻量级地面 —— 不依赖外部 OBJ 资产，always-render。
 *
 * 设计：
 *  - 大圆形草坪（60 单位半径，覆盖玩家走动范围）
 *  - 散布的小山丘（cone）+ 树木（cone+cylinder）+ 石头（icosa）让场景不空
 *  - 全部 procedural，加载 0 ms
 *
 * 之前用 paradise-1 OBJ scene 的问题：Suspense 期间 Canvas 全黑；asset 失败时整个
 * 游戏不可玩。这一版完全 procedural，asset 失败也不影响。
 */

import { useMemo } from "react";
import * as THREE from "three";

const TREE_POSITIONS: Array<[number, number]> = [
  [10, -8], [-12, -10], [15, 6], [-15, 8], [8, 15],
  [-9, 14], [18, -2], [-20, 0], [22, 12], [-22, -12],
  [6, -20], [-6, 22], [25, -15], [-25, 18], [12, 25],
];

const ROCK_POSITIONS: Array<[number, number]> = [
  [5, -5], [-7, -3], [9, 4], [-4, 9], [11, -12],
  [-13, 11], [16, 16], [-16, -16],
];

const HILL_POSITIONS: Array<[number, number, number]> = [
  // [x, z, scale]
  [30, 25, 1.5],
  [-32, 28, 1.8],
  [28, -30, 1.4],
  [-30, -28, 1.6],
  [40, 0, 2.0],
  [-40, 5, 1.7],
  [0, 40, 2.2],
  [5, -40, 1.9],
];

const FLOWER_COLORS = ["#f472b6", "#fb7185", "#fbbf24", "#a78bfa", "#fff"];

export function ParadiseGround() {
  // 花朵位置（小，多）— 用 instanced 但简化为多个 mesh 也 OK，数量不大
  const flowers = useMemo(() => {
    const arr: Array<{ x: number; z: number; color: string }> = [];
    for (let i = 0; i < 80; i++) {
      const a = (i / 80) * Math.PI * 2 + Math.random() * 0.3;
      const r = 4 + Math.random() * 25;
      arr.push({
        x: Math.cos(a) * r,
        z: Math.sin(a) * r,
        color: FLOWER_COLORS[Math.floor(Math.random() * FLOWER_COLORS.length)]!,
      });
    }
    return arr;
  }, []);

  return (
    <group>
      {/* 主草地（大圆） */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[60, 64]} />
        <meshStandardMaterial color="#5fd56c" roughness={0.95} />
      </mesh>

      {/* 中央铺地小广场（更深绿，标记 portal 区中心） */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[8, 32]} />
        <meshStandardMaterial color="#4ade80" roughness={0.85} />
      </mesh>

      {/* 远山（背景圆环） */}
      {HILL_POSITIONS.map(([x, z, s], i) => (
        <mesh key={`hill-${i}`} position={[x, 0, z]}>
          <coneGeometry args={[6 * s, 8 * s, 12]} />
          <meshStandardMaterial color="#86efac" roughness={0.9} />
        </mesh>
      ))}

      {/* 树木 */}
      {TREE_POSITIONS.map(([x, z], i) => (
        <Tree key={`tree-${i}`} position={[x, 0, z]} variant={i % 3} />
      ))}

      {/* 石头 */}
      {ROCK_POSITIONS.map(([x, z], i) => (
        <mesh key={`rock-${i}`} position={[x, 0.3, z]} rotation={[0, i * 0.7, 0]}>
          <icosahedronGeometry args={[0.5 + (i % 3) * 0.2, 0]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.8} flatShading />
        </mesh>
      ))}

      {/* 小花朵装饰 */}
      {flowers.map((f, i) => (
        <mesh key={`flower-${i}`} position={[f.x, 0.05, f.z]}>
          <sphereGeometry args={[0.15, 6, 6]} />
          <meshStandardMaterial
            color={f.color}
            emissive={f.color}
            emissiveIntensity={0.3}
            roughness={0.5}
          />
        </mesh>
      ))}

      {/* 装饰云朵（高空，浮动） */}
      <Cloud position={[10, 12, -15]} />
      <Cloud position={[-15, 14, -10]} />
      <Cloud position={[5, 16, 20]} />
      <Cloud position={[-20, 13, 12]} />
    </group>
  );
}

interface TreeProps {
  position: [number, number, number];
  variant?: number;
}
function Tree({ position, variant = 0 }: TreeProps) {
  // variant 0/1/2 - 不同形状（圆/锥/丛）
  const [x, y, z] = position;
  const leafColors = ["#16a34a", "#22c55e", "#15803d"];
  const leaf = leafColors[variant % leafColors.length]!;
  const trunkH = 1.5;
  return (
    <group position={[x, y, z]}>
      {/* 树干 */}
      <mesh position={[0, trunkH / 2, 0]}>
        <cylinderGeometry args={[0.2, 0.28, trunkH, 8]} />
        <meshStandardMaterial color="#92400e" roughness={0.85} />
      </mesh>
      {/* 树冠 */}
      {variant === 0 && (
        <mesh position={[0, trunkH + 1, 0]}>
          <sphereGeometry args={[1.2, 12, 10]} />
          <meshStandardMaterial color={leaf} roughness={0.9} />
        </mesh>
      )}
      {variant === 1 && (
        <mesh position={[0, trunkH + 1.2, 0]}>
          <coneGeometry args={[1.1, 2.5, 10]} />
          <meshStandardMaterial color={leaf} roughness={0.9} />
        </mesh>
      )}
      {variant === 2 && (
        <>
          <mesh position={[0, trunkH + 0.7, 0]}>
            <sphereGeometry args={[0.9, 10, 8]} />
            <meshStandardMaterial color={leaf} roughness={0.9} />
          </mesh>
          <mesh position={[0.5, trunkH + 1.2, 0.1]}>
            <sphereGeometry args={[0.7, 10, 8]} />
            <meshStandardMaterial color={leaf} roughness={0.9} />
          </mesh>
          <mesh position={[-0.4, trunkH + 1.1, -0.2]}>
            <sphereGeometry args={[0.65, 10, 8]} />
            <meshStandardMaterial color={leaf} roughness={0.9} />
          </mesh>
        </>
      )}
    </group>
  );
}

function Cloud({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[1.5, 12, 10]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </mesh>
      <mesh position={[1.3, 0.2, 0]}>
        <sphereGeometry args={[1.1, 12, 10]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </mesh>
      <mesh position={[-1.2, 0.1, 0.2]}>
        <sphereGeometry args={[1.2, 12, 10]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </mesh>
    </group>
  );
}
