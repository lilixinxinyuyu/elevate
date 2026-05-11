/**
 * 小进 — 真正的 anime VRM avatar（v0.32 主线转向）。
 *
 * 主形象：VRoid Hub 短发蓝开衫小姐姐，通过 @pixiv/three-vrm 加载 .vrm 文件。
 * 副手：暂用浮动光环占位，Phase 2 再做拟人红熊猫。
 *
 * Pipeline：
 *  - GLTFLoader + VRMLoaderPlugin 加载 /avatars/xiaojin.vrm
 *  - drei <Environment preset="apartment" /> 提供 HDRI envmap → 头发/眼睛/衣服反光
 *  - useFrame 每帧推 vrm.update(delta) + 嘴型同步 + idle 动画
 *  - viseme 'aa' 跟 audioLevel；'blink' 自然眨眼
 *  - skin 变体先用头顶 R3F 几何 accessory（帽子/皇冠）覆盖在头骨上
 *
 * 加载失败 / 文件缺失 fallback：显示一个友好提示卡片，不挡其他功能。
 */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import * as THREE from "three";
import type { Group, Object3D } from "three";

export type MascotSkin = "default" | "graduation" | "wizard" | "legendary";

interface Mascot3DProps {
  audioLevel?: number;
  skin?: MascotSkin;
  spin?: boolean;
  className?: string;
  /** 默认 /avatars/xiaojin.vrm，外面可以覆写换 outfit */
  vrmUrl?: string;
}

const DEFAULT_VRM_URL = "/avatars/xiaojin.vrm";

export default function Mascot3D({
  audioLevel = 0,
  skin = "default",
  spin = false,
  className,
  vrmUrl = DEFAULT_VRM_URL,
}: Mascot3DProps) {
  return (
    <div className={className ?? "w-full h-full"}>
      <Canvas
        camera={{ position: [0, 1.35, 1.8], fov: 30 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.45} />
          <directionalLight position={[2, 4, 3]} intensity={0.9} color="#ffffff" />
          <directionalLight position={[-3, 2, 1]} intensity={0.35} color="#bae6fd" />
          {/* HDRI envmap：质感的灵魂；apartment 给柔和暖白 */}
          <Environment preset="apartment" />

          <VRMScene
            url={vrmUrl}
            audioLevel={audioLevel}
            skin={skin}
            spin={spin}
          />

          <OrbitControls
            enablePan={false}
            enableZoom={false}
            target={[0, 1.25, 0]}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 1.8}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

interface VRMSceneProps {
  url: string;
  audioLevel: number;
  skin: MascotSkin;
  spin: boolean;
}

function VRMScene({ url, audioLevel, skin, spin }: VRMSceneProps) {
  const rootRef = useRef<Group>(null);
  const [vrm, setVrm] = useState<VRM | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const blinkRef = useRef({ phase: 0, next: 3 + Math.random() * 2 });

  // 加载 VRM
  useEffect(() => {
    let cancelled = false;
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loader.load(
      url,
      (gltf) => {
        if (cancelled) return;
        const loaded: VRM = gltf.userData.vrm;
        // 清理优化
        VRMUtils.removeUnnecessaryVertices(loaded.scene);
        VRMUtils.combineSkeletons(loaded.scene);
        // 朝向相机（VRoid 默认朝 -Z，翻过来）
        VRMUtils.rotateVRM0(loaded);
        // 关闭 frustum culling（小屏幕里抠骨容易误判）
        loaded.scene.traverse((obj: Object3D) => {
          obj.frustumCulled = false;
        });
        // 一次性把 T-pose 改成自然站姿（双臂下垂 + 微微弯肘）
        applyRestPose(loaded);
        setVrm(loaded);
      },
      undefined,
      (err) => {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn("[mascot3d] VRM load failed:", msg);
        setLoadError(msg);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url]);

  // 每帧更新 VRM + idle 动画 + lipsync + blink
  useFrame((state, delta) => {
    if (!vrm) return;
    const t = state.clock.getElapsedTime();

    // 整体浮动
    if (rootRef.current) {
      rootRef.current.position.y = Math.sin(t * 1.2) * 0.012;
      if (spin) rootRef.current.rotation.y += delta * 0.35;
      else rootRef.current.rotation.y = Math.sin(t * 0.4) * 0.08;
    }

    // 呼吸：胸腔轻微缩放（找 chest 骨）
    const chest = vrm.humanoid?.getNormalizedBoneNode("chest");
    if (chest) {
      const breath = 1 + Math.sin(t * 1.3) * 0.012;
      chest.scale.setScalar(breath);
    }
    // 头：微微左右晃 + 上下点头节奏
    const head = vrm.humanoid?.getNormalizedBoneNode("head");
    if (head) {
      head.rotation.z = Math.sin(t * 0.7) * 0.04;
      head.rotation.x = Math.sin(t * 0.55) * 0.03;
    }

    // 嘴型：audioLevel → 'aa' viseme
    const em = vrm.expressionManager;
    if (em) {
      const aa = Math.min(0.95, audioLevel * 4.5);
      em.setValue("aa", aa);

      // 眨眼调度
      blinkRef.current.phase += delta;
      if (blinkRef.current.phase > blinkRef.current.next) {
        const local = blinkRef.current.phase - blinkRef.current.next;
        if (local < 0.16) {
          // 0..0.08 闭 / 0.08..0.16 开
          const v = local < 0.08 ? local / 0.08 : 1 - (local - 0.08) / 0.08;
          em.setValue("blink", Math.max(0, Math.min(1, v)));
        } else {
          em.setValue("blink", 0);
          blinkRef.current.phase = 0;
          blinkRef.current.next = 3 + Math.random() * 3;
        }
      }

      // 默认微笑（让她看起来友好）
      em.setValue("happy", 0.25);

      em.update();
    }

    vrm.update(delta);
  });

  if (loadError) {
    return <FallbackPlaceholder reason={loadError} />;
  }
  if (!vrm) {
    return <LoadingPlaceholder />;
  }

  return (
    <group ref={rootRef}>
      <primitive object={vrm.scene} />
      {/* skin 配饰挂在头骨上 */}
      <SkinAccessory skin={skin} vrm={vrm} />
      {/* AI 副手占位光环（Phase 2 替换成红熊猫）*/}
      <SidekickPlaceholder />
    </group>
  );
}

/** 把 VRM 默认 T-pose 改成自然站姿 —— 双臂下垂、微弯肘 */
function applyRestPose(vrm: VRM) {
  const h = vrm.humanoid;
  if (!h) return;
  const deg = THREE.MathUtils.degToRad;
  // 上臂 Z 旋转把手臂从平举（+X / -X）放下来
  const lU = h.getNormalizedBoneNode("leftUpperArm");
  const rU = h.getNormalizedBoneNode("rightUpperArm");
  if (lU) lU.rotation.z = deg(72);
  if (rU) rU.rotation.z = deg(-72);
  // 小臂略弯（让手肘不死板）
  const lL = h.getNormalizedBoneNode("leftLowerArm");
  const rL = h.getNormalizedBoneNode("rightLowerArm");
  if (lL) lL.rotation.y = deg(-10);
  if (rL) rL.rotation.y = deg(10);
  // 手轻微往前合（更自然）
  const lH = h.getNormalizedBoneNode("leftHand");
  const rH = h.getNormalizedBoneNode("rightHand");
  if (lH) lH.rotation.z = deg(-5);
  if (rH) rH.rotation.z = deg(5);
}

/** Phase 2 placeholder：AI 副手位置悬浮一个发光小球 */
function SidekickPlaceholder() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.position.y = 1.0 + Math.sin(t * 1.6) * 0.06;
    ref.current.position.x = 0.55 + Math.sin(t * 0.8) * 0.04;
    ref.current.rotation.y += 0.02;
  });
  return (
    <group>
      {/* 主光球 */}
      <mesh ref={ref} position={[0.55, 1.0, 0.2]}>
        <sphereGeometry args={[0.07, 24, 18]} />
        <meshStandardMaterial
          color="#f97316"
          emissive="#f97316"
          emissiveIntensity={1.6}
          roughness={0.4}
        />
      </mesh>
      {/* 外圈柔光环 */}
      <mesh position={[0.55, 1.0, 0.2]}>
        <sphereGeometry args={[0.11, 24, 18]} />
        <meshBasicMaterial color="#fed7aa" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

/** skin 头顶配饰 —— 挂在 VRM head 骨上 */
function SkinAccessory({ skin, vrm }: { skin: MascotSkin; vrm: VRM }) {
  const groupRef = useRef<Group>(null);
  const headBone = useMemo(() => vrm.humanoid?.getNormalizedBoneNode("head"), [vrm]);

  // 每帧把配饰位置跟到 head 骨上
  useFrame(() => {
    if (!groupRef.current || !headBone) return;
    headBone.getWorldPosition(groupRef.current.position);
    headBone.getWorldQuaternion(groupRef.current.quaternion);
  });

  if (!headBone || skin === "default") return null;

  return (
    <group ref={groupRef}>
      {skin === "graduation" && <GraduationCap />}
      {skin === "wizard" && <WizardHat />}
      {skin === "legendary" && <Crown />}
    </group>
  );
}

function GraduationCap() {
  return (
    <group position={[0, 0.18, 0]}>
      <mesh>
        <boxGeometry args={[0.32, 0.018, 0.32]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[0, -0.05, 0]}>
        <cylinderGeometry args={[0.1, 0.11, 0.08, 20]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[0.11, 0.01, 0.11]} scale={[0.015, 0.08, 0.015]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0.11, -0.04, 0.11]}>
        <sphereGeometry args={[0.018, 12, 10]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

function WizardHat() {
  return (
    <group position={[0, 0.16, 0]}>
      <mesh>
        <cylinderGeometry args={[0.17, 0.2, 0.02, 20]} />
        <meshStandardMaterial color="#5b21b6" roughness={0.6} metalness={0.15} />
      </mesh>
      <mesh position={[0, 0.16, 0]} rotation={[0, 0, -0.08]}>
        <coneGeometry args={[0.1, 0.32, 16]} />
        <meshStandardMaterial color="#5b21b6" roughness={0.6} metalness={0.15} />
      </mesh>
      <mesh position={[0.05, 0.2, 0.08]}>
        <sphereGeometry args={[0.018, 12, 10]} />
        <meshStandardMaterial color="#fde047" emissive="#fde047" emissiveIntensity={1.2} />
      </mesh>
    </group>
  );
}

function Crown() {
  return (
    <group position={[0, 0.17, 0]}>
      <mesh>
        <cylinderGeometry args={[0.14, 0.16, 0.05, 16]} />
        <meshStandardMaterial color="#fbbf24" metalness={0.95} roughness={0.18} />
      </mesh>
      {[...Array(6)].map((_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.14, 0.05, Math.sin(a) * 0.14]}>
            <coneGeometry args={[0.02, 0.06, 8]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.95} roughness={0.18} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.015, 0.14]}>
        <sphereGeometry args={[0.018, 14, 12]} />
        <meshStandardMaterial
          color="#dc2626"
          emissive="#dc2626"
          emissiveIntensity={0.6}
          metalness={0.4}
          roughness={0.25}
        />
      </mesh>
    </group>
  );
}

/** VRM 还在加载时的占位（简单旋转圈） */
function LoadingPlaceholder() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.z = state.clock.getElapsedTime() * 1.5;
  });
  return (
    <mesh ref={ref} position={[0, 1.3, 0]}>
      <torusGeometry args={[0.18, 0.012, 8, 32, Math.PI * 1.4]} />
      <meshStandardMaterial
        color="#a78bfa"
        emissive="#a78bfa"
        emissiveIntensity={1.5}
      />
    </mesh>
  );
}

/** 加载失败时的占位 + 提示 */
function FallbackPlaceholder({ reason }: { reason: string }) {
  console.warn("[mascot3d] showing fallback because:", reason);
  return (
    <group>
      <mesh position={[0, 1.3, 0]}>
        <sphereGeometry args={[0.18, 24, 16]} />
        <meshStandardMaterial
          color="#94a3b8"
          emissive="#475569"
          emissiveIntensity={0.3}
          roughness={0.6}
        />
      </mesh>
    </group>
  );
}
