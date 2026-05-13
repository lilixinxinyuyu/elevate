/**
 * v0.32.28: 奇遇乐园柜台场景 — variant 分化版。
 *
 * Ep11 双 CLI 一致建议（Codex F = A-lite + C）:
 * 之前 4 个 mini-game (store / bank / bakery / airport) 100% 共用
 * StoreEnvironment，导致截图叠起来一模一样。本轮 prop variant 分化。
 *
 * 共用部分：KayKit kitchencounter_straight_A 柜台 + floor + 简单背景
 * 移除：中间丑的 menu.gltf（爸爸明确说"垃圾桶造型"）
 *
 * 各 variant 专属道具（KayKit GLTF + Three.js primitive 组合）:
 *   - store:   食材 crate 堆 (carrots/tomatoes/potatoes/buns/cheese) + jars
 *   - bank:    保险柜 box (dark gray + 金黄门) + 钞票堆 (绿/紫小 box) + sack 麻袋
 *   - bakery:  粉色三层蛋糕架 cylinder + buns + cheese + 烤箱 box (橙发光面)
 *   - airport: 灰色传送带长 box + 行李堆 (彩色 box) + 登机门 frame
 *
 * 验收：不看 HUD 也能认店。
 */

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const KAY_RB = "/env/kaykit/restaurant";
const KAY_DECO = "/env/kaykit/medieval/deco";

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

export type EnvironmentVariant = "store" | "bank" | "bakery" | "airport";

/**
 * 主环境：单个 counter 放在玩家面前 + variant 专属装饰。
 * 玩家相机在 Z=+1.6，counter 中心在 origin (X=Y=Z=0)，台面 Y=1.0。
 */
export function StoreEnvironment({
  variant = "store",
}: {
  variant?: EnvironmentVariant;
}) {
  return (
    <group>
      {/* 主柜台 — 共用 */}
      <KayMesh
        url={`${KAY_RB}/kitchencounter_straight_A.gltf`}
        position={[0, 0, 0]}
        scale={1.0}
      />
      {variant === "store" && <StoreDecor />}
      {variant === "bank" && <BankDecor />}
      {variant === "bakery" && <BakeryDecor />}
      {variant === "airport" && <AirportDecor />}
    </group>
  );
}

/** 小卖部装饰：食材 crate 堆 + 货架 */
function StoreDecor() {
  return (
    <group>
      <KayMesh url={`${KAY_RB}/crate_carrots.gltf`} position={[-2.0, 0, 0.2]} scale={0.9} />
      <KayMesh url={`${KAY_RB}/crate_tomatoes.gltf`} position={[-2.0, 0.55, 0.2]} scale={0.9} rotationY={Math.PI / 6} />
      <KayMesh url={`${KAY_RB}/crate_potatoes.gltf`} position={[2.0, 0, 0.2]} scale={0.9} />
      <KayMesh url={`${KAY_RB}/crate_buns.gltf`} position={[2.0, 0.55, 0.2]} scale={0.9} rotationY={-Math.PI / 6} />
      {/* 柜台后方 jars，店内装饰 */}
      <KayMesh url={`${KAY_RB}/jar_A_small.gltf`} position={[-0.75, 1.0, -0.7]} scale={1.0} />
      <KayMesh url={`${KAY_RB}/jar_B_small.gltf`} position={[0.75, 1.0, -0.7]} scale={1.0} />
      {/* 招牌：黄底"和平小卖部" plane（替代丑的 menu.gltf） */}
      <Sign label="🛒 和平小卖部" color="#f59e0b" />
    </group>
  );
}

/** 银行装饰：保险柜 + 钞票堆 + 麻袋 */
function BankDecor() {
  return (
    <group>
      {/* 左侧大保险柜 (深灰 box + 金边圆门) */}
      <group position={[-1.9, 0, -0.1]}>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[0.95, 1.1, 0.75]} />
          <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.45} />
        </mesh>
        {/* 圆形金门 */}
        <mesh position={[0, 0.55, 0.38]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.04, 32]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.7} roughness={0.25} emissive="#92400e" emissiveIntensity={0.15} />
        </mesh>
        {/* 中心旋钮 */}
        <mesh position={[0, 0.55, 0.42]}>
          <cylinderGeometry args={[0.07, 0.07, 0.05, 16]} />
          <meshStandardMaterial color="#fde68a" metalness={0.9} roughness={0.15} />
        </mesh>
      </group>

      {/* 右侧 sack 钱袋（KayKit）+ 钞票堆 */}
      <KayMesh url={`${KAY_DECO}/sack.gltf`} position={[1.85, 0, 0.15]} scale={1.1} />
      <KayMesh url={`${KAY_DECO}/sack.gltf`} position={[2.15, 0, -0.05]} scale={0.95} rotationY={Math.PI / 5} />

      {/* 柜台上钞票堆（绿色小 box 堆叠） */}
      {[0, 0.04, 0.08, 0.12].map((y, i) => (
        <mesh key={i} position={[-0.7, 1.02 + y, -0.4]} rotation={[0, i * 0.06, 0]}>
          <boxGeometry args={[0.32, 0.04, 0.16]} />
          <meshStandardMaterial color={i % 2 === 0 ? "#22c55e" : "#16a34a"} />
        </mesh>
      ))}
      {/* 金币柱 (堆 3 个) */}
      <group position={[0.6, 1.02, -0.55]}>
        {[0, 0.06, 0.12].map((y, i) => (
          <mesh key={i} position={[0, y, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.06, 24]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.18} />
          </mesh>
        ))}
      </group>

      <Sign label="🏦 百宝银行" color="#3b82f6" />
    </group>
  );
}

/** 面包店装饰：粉色三层蛋糕架 + 烤箱 + buns */
function BakeryDecor() {
  return (
    <group>
      {/* 左侧蛋糕架 — 粉色三层 cylinder */}
      <group position={[-1.9, 0, 0.1]}>
        {/* 底盘 */}
        <mesh position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.36, 0.4, 0.1, 24]} />
          <meshStandardMaterial color="#f9a8d4" roughness={0.5} />
        </mesh>
        {/* 第一层 cake */}
        <mesh position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.18, 24]} />
          <meshStandardMaterial color="#fbcfe8" />
        </mesh>
        <mesh position={[0, 0.31, 0]}>
          <cylinderGeometry args={[0.31, 0.31, 0.04, 24]} />
          <meshStandardMaterial color="#fdf2f8" emissive="#fdf2f8" emissiveIntensity={0.08} />
        </mesh>
        {/* 第二层 cake */}
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.16, 24]} />
          <meshStandardMaterial color="#f472b6" />
        </mesh>
        <mesh position={[0, 0.59, 0]}>
          <cylinderGeometry args={[0.23, 0.23, 0.03, 24]} />
          <meshStandardMaterial color="#fef3c7" />
        </mesh>
        {/* 顶部草莓 */}
        <mesh position={[0, 0.66, 0]}>
          <coneGeometry args={[0.06, 0.1, 12]} />
          <meshStandardMaterial color="#dc2626" emissive="#7f1d1d" emissiveIntensity={0.2} />
        </mesh>
      </group>

      {/* 右侧烤箱 box（深灰 + 橙色发光门） */}
      <group position={[1.9, 0, 0.1]}>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.9, 1.0, 0.75]} />
          <meshStandardMaterial color="#525252" roughness={0.6} metalness={0.3} />
        </mesh>
        {/* 烤箱玻璃门（橙色发光） */}
        <mesh position={[0, 0.45, 0.38]}>
          <boxGeometry args={[0.65, 0.45, 0.04]} />
          <meshStandardMaterial
            color="#fb923c"
            emissive="#ea580c"
            emissiveIntensity={0.8}
            roughness={0.2}
          />
        </mesh>
        {/* 烤箱旋钮 ×2 */}
        {[-0.25, 0.25].map((x, i) => (
          <mesh key={i} position={[x, 0.85, 0.38]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.04, 12]} />
            <meshStandardMaterial color="#fde68a" metalness={0.5} />
          </mesh>
        ))}
      </group>

      {/* 柜台上面包堆（KayKit buns / cheese） — scale 大幅缩小（v0.32.29 fix） */}
      <KayMesh url={`${KAY_RB}/food_ingredient_bun.gltf`} position={[-0.5, 1.02, -0.5]} scale={0.4} />
      <KayMesh url={`${KAY_RB}/food_ingredient_bun.gltf`} position={[-0.3, 1.02, -0.55]} scale={0.35} rotationY={Math.PI / 4} />
      <KayMesh url={`${KAY_RB}/food_ingredient_cheese.gltf`} position={[0.6, 1.02, -0.55]} scale={0.38} />

      <Sign label="🥖 甜心面包店" color="#ec4899" />
    </group>
  );
}

/** 登机口装饰：传送带 + 行李堆 + 登机门 */
function AirportDecor() {
  return (
    <group>
      {/* 左侧传送带（灰色长 box + 黑色滚轮） */}
      <group position={[-1.9, 0, 0.1]}>
        {/* 主带身 */}
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[0.7, 0.1, 1.5]} />
          <meshStandardMaterial color="#1f2937" roughness={0.7} />
        </mesh>
        {/* 传送带表面（深灰） */}
        <mesh position={[0, 0.61, 0]}>
          <boxGeometry args={[0.65, 0.02, 1.5]} />
          <meshStandardMaterial color="#374151" roughness={0.9} />
        </mesh>
        {/* 支架 */}
        {[-0.6, 0.6].map((z, i) => (
          <mesh key={i} position={[0, 0.27, z]}>
            <boxGeometry args={[0.6, 0.5, 0.1]} />
            <meshStandardMaterial color="#52525b" metalness={0.4} />
          </mesh>
        ))}
        {/* 行李 1 — 黄色 */}
        <mesh position={[0, 0.72, -0.3]} rotation={[0, 0.2, 0]}>
          <boxGeometry args={[0.34, 0.24, 0.5]} />
          <meshStandardMaterial color="#facc15" roughness={0.55} />
        </mesh>
        {/* 行李 2 — 蓝色 */}
        <mesh position={[0, 0.72, 0.45]} rotation={[0, -0.3, 0]}>
          <boxGeometry args={[0.34, 0.24, 0.5]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.5} />
        </mesh>
      </group>

      {/* 右侧登机门 frame — 蓝色高门 + 顶部 GATE 牌 */}
      <group position={[1.9, 0, -0.1]}>
        {/* 两侧门柱 */}
        {[-0.5, 0.5].map((x, i) => (
          <mesh key={i} position={[x, 0.9, 0]}>
            <boxGeometry args={[0.12, 1.8, 0.12]} />
            <meshStandardMaterial color="#1e40af" metalness={0.4} />
          </mesh>
        ))}
        {/* 顶部横梁 */}
        <mesh position={[0, 1.85, 0]}>
          <boxGeometry args={[1.2, 0.18, 0.18]} />
          <meshStandardMaterial color="#1e3a8a" />
        </mesh>
        {/* GATE 牌（橙色发光） */}
        <mesh position={[0, 1.55, 0.05]}>
          <boxGeometry args={[0.65, 0.22, 0.06]} />
          <meshStandardMaterial
            color="#fb923c"
            emissive="#ea580c"
            emissiveIntensity={1.0}
          />
        </mesh>
        {/* 底部红毯 */}
        <mesh position={[0, 0.01, 0.5]}>
          <boxGeometry args={[0.9, 0.02, 0.8]} />
          <meshStandardMaterial color="#b91c1c" />
        </mesh>
      </group>

      {/* 柜台上行李 tag */}
      <mesh position={[-0.5, 1.04, -0.5]} rotation={[0, 0.3, 0]}>
        <boxGeometry args={[0.18, 0.04, 0.12]} />
        <meshStandardMaterial color="#fcd34d" />
      </mesh>
      <mesh position={[0.6, 1.04, -0.55]} rotation={[0, -0.3, 0]}>
        <boxGeometry args={[0.18, 0.04, 0.12]} />
        <meshStandardMaterial color="#a7f3d0" />
      </mesh>

      <Sign label="✈️ 登机口" color="#06b6d4" />
    </group>
  );
}

/**
 * 柜台后方招牌 — 替代之前丑的 menu.gltf
 * 普通 box plane + emissive 颜色，背景挂在 Y=1.6 高处。
 */
function Sign({ label, color }: { label: string; color: string }) {
  // 招牌纯几何，文字由 mini-game HUD 内的 drei Text 显示（不在此处重复）
  // 这里只放一个 emissive 板做"店招"视觉锚点
  return (
    <group position={[0, 1.6, -0.9]}>
      <mesh>
        <boxGeometry args={[1.6, 0.45, 0.08]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.4} />
      </mesh>
      {/* 装饰边框 */}
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[1.65, 0.5, 0.02]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      {/* label 仅用于 debug — 通过 group userData 注释；实际 store/bank 等 HUD 显示这个 label */}
      <group userData={{ signLabel: label }} />
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
useGLTF.preload(`${KAY_RB}/food_ingredient_bun.gltf`);
useGLTF.preload(`${KAY_RB}/food_ingredient_cheese.gltf`);
useGLTF.preload(`${KAY_DECO}/sack.gltf`);

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
useGLTF.preload(`${KAY_RB}/food_ingredient_potato.gltf`);
useGLTF.preload(`${KAY_RB}/food_ingredient_onion.gltf`);
