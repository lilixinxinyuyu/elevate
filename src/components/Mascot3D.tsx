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
          {/* 远景紫黑色雾 —— 让背景不是死黑，有"教室深处"的层次 */}
          <fog attach="fog" args={["#1e1b4b", 3, 7]} />
          {/* 三点布光：暖白 key + 冷蓝 fill + 后方紫粉 rim（头发轮廓）*/}
          <ambientLight intensity={0.35} />
          <directionalLight position={[2.5, 3.5, 3]} intensity={0.95} color="#fff7ed" />
          <directionalLight position={[-3, 2, 1]} intensity={0.35} color="#bae6fd" />
          <directionalLight position={[0, 2.5, -3]} intensity={0.55} color="#f5d0fe" />
          {/* HDRI envmap：studio 给中性白基底（让肤色不偏色） */}
          <Environment preset="studio" />

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

    // 呼吸：胸腔轻微缩放（多频混合，看起来更生物）
    const chest = vrm.humanoid?.getNormalizedBoneNode("chest");
    if (chest) {
      const breath = 1 + Math.sin(t * 1.3) * 0.01 + Math.sin(t * 0.41) * 0.005;
      chest.scale.setScalar(breath);
    }
    // 重心偏移：髋骨慢慢左右摆（自然 weight shift，约 20 秒周期）
    const hips = vrm.humanoid?.getNormalizedBoneNode("hips");
    if (hips) {
      hips.rotation.z = Math.sin(t * 0.32) * 0.04;
      hips.position.x = Math.sin(t * 0.32) * 0.015;
    }
    // 肩膀反向补偿（躯干稳定的错位 sway）
    const spine = vrm.humanoid?.getNormalizedBoneNode("spine");
    if (spine) {
      spine.rotation.z = -Math.sin(t * 0.32) * 0.025;
    }
    // 头：微微左右晃 + 上下点头节奏
    const head = vrm.humanoid?.getNormalizedBoneNode("head");
    if (head) {
      head.rotation.z = Math.sin(t * 0.7) * 0.04;
      head.rotation.x = Math.sin(t * 0.55) * 0.03;
    }

    // 说话时手部 micro-gesture：右手抬到胸前 + 节奏摆动（解说 / 介绍 的感觉）
    const speakAmp = Math.min(1, audioLevel * 3.5);
    const rUpper = vrm.humanoid?.getNormalizedBoneNode("rightUpperArm");
    const rLower = vrm.humanoid?.getNormalizedBoneNode("rightLowerArm");
    const lUpper = vrm.humanoid?.getNormalizedBoneNode("leftUpperArm");
    if (rUpper) {
      const base = THREE.MathUtils.degToRad(-72);
      // peak speak 时再抬 32° → 角度变 -40°，肩膀打开，手肘斜向上
      const lift = THREE.MathUtils.degToRad(32) * speakAmp;
      const sway = Math.sin(t * 2.2) * 0.06 * speakAmp;
      rUpper.rotation.z = base + lift + sway;
      // 往前推（X 轴）+ Y 轴往中线收一点，避免手往身体外伸
      rUpper.rotation.x = THREE.MathUtils.degToRad(-22) * speakAmp + Math.sin(t * 1.8) * 0.05 * speakAmp;
      rUpper.rotation.y = THREE.MathUtils.degToRad(15) * speakAmp;
    }
    if (rLower) {
      // 弯肘 70°，把前臂收到胸前
      rLower.rotation.y = THREE.MathUtils.degToRad(10) + THREE.MathUtils.degToRad(-70) * speakAmp;
      rLower.rotation.x = Math.sin(t * 2.4) * 0.08 * speakAmp;
    }
    if (lUpper) {
      const base = THREE.MathUtils.degToRad(72);
      const sway = Math.sin(t * 1.1 + 0.7) * 0.025;
      lUpper.rotation.z = base + sway;
    }

    // 嘴型 + viseme 多样化（不只 aa）
    const em = vrm.expressionManager;
    if (em) {
      // audioLevel 用 sin 波加调制，让嘴形看起来更"有节奏"，不死板
      const rawAmp = Math.min(1, audioLevel * 4.0);
      const aaWave = rawAmp * (0.7 + 0.3 * Math.sin(t * 18));
      const ihWave = rawAmp * 0.45 * (0.5 + 0.5 * Math.sin(t * 14 + 1.2));
      const ouWave = rawAmp * 0.35 * (0.5 + 0.5 * Math.sin(t * 11 + 2.4));
      em.setValue("aa", Math.min(0.95, aaWave));
      em.setValue("ih", Math.min(0.7, ihWave));
      em.setValue("ou", Math.min(0.6, ouWave));

      // 眨眼调度（保留）
      blinkRef.current.phase += delta;
      if (blinkRef.current.phase > blinkRef.current.next) {
        const local = blinkRef.current.phase - blinkRef.current.next;
        if (local < 0.16) {
          const v = local < 0.08 ? local / 0.08 : 1 - (local - 0.08) / 0.08;
          em.setValue("blink", Math.max(0, Math.min(1, v)));
        } else {
          em.setValue("blink", 0);
          blinkRef.current.phase = 0;
          blinkRef.current.next = 3 + Math.random() * 3;
        }
      }

      // 默认微笑：idle 0.55 暖暖；说话时拉到 0.8（开心交流）
      const happyTarget = 0.55 + rawAmp * 0.3;
      // 用一个小的平滑过渡，避免硬切
      const currentHappy = em.getValue("happy") ?? happyTarget;
      em.setValue("happy", currentHappy + (happyTarget - currentHappy) * 0.18);

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
      {/* 背景大气：漂浮光粒子（数学灵感的小火花） */}
      <AmbientParticles count={14} />
    </group>
  );
}

/** 周围漂浮的微小光粒子 —— 增加"灵感火花"的氛围感 */
function AmbientParticles({ count }: { count: number }) {
  const groupRef = useRef<Group>(null);
  // 给每颗粒子一个固定的"轨道"参数（在挂载时随机生成）
  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      // 椭圆轨道半径
      rX: 0.8 + Math.random() * 1.0,
      rY: 0.4 + Math.random() * 0.6,
      rZ: 0.4 + Math.random() * 0.6,
      speed: 0.15 + Math.random() * 0.25,
      phase: Math.random() * Math.PI * 2,
      // 中心高度
      cy: 0.5 + Math.random() * 1.2,
      // 颜色：白 / 暖橙 / 浅青 三色随机
      color: ["#fef3c7", "#fed7aa", "#a5f3fc"][Math.floor(Math.random() * 3)],
      size: 0.008 + Math.random() * 0.012,
      blink: Math.random() * Math.PI * 2,
    }));
  }, [count]);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    particles.forEach((p, i) => {
      const m = meshRefs.current[i];
      if (!m) return;
      const a = t * p.speed + p.phase;
      m.position.x = Math.cos(a) * p.rX;
      m.position.z = Math.sin(a) * p.rZ - 0.2;
      m.position.y = p.cy + Math.sin(t * 0.5 + p.phase) * 0.15;
      // emissive 强度脉冲（呼吸感）
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.5 + Math.sin(t * 1.5 + p.blink) * 0.8;
    });
  });

  return (
    <group ref={groupRef}>
      {particles.map((p, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
        >
          <sphereGeometry args={[p.size, 8, 6]} />
          <meshStandardMaterial
            color={p.color}
            emissive={p.color}
            emissiveIntensity={1.5}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}
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

/** Phase 2 placeholder：AI 副手光球 —— orbit 粒子 + pulse */
function SidekickPlaceholder() {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  // 3 颗 orbit 粒子（不同相位、不同轨道半径/速度）
  const orbitRefs = [useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null), useRef<THREE.Mesh>(null)];

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.getElapsedTime();
    // 群组整体浮动 —— 漂在她肩膀右侧
    groupRef.current.position.y = 1.45 + Math.sin(t * 1.4) * 0.05;
    groupRef.current.position.x = 0.45 + Math.sin(t * 0.5) * 0.03;
    // 核心 pulse
    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 2.8) * 0.18;
      coreRef.current.scale.setScalar(pulse);
    }
    // 柔光环 counter-pulse
    if (haloRef.current) {
      const p = 1 + Math.sin(t * 2.8 + Math.PI) * 0.12;
      haloRef.current.scale.setScalar(p);
    }
    // orbit 粒子环绕
    const orbitConfig = [
      { r: 0.16, speed: 2.5, phase: 0, tilt: 0 },
      { r: 0.19, speed: 1.7, phase: 2.1, tilt: 0.6 },
      { r: 0.13, speed: 3.2, phase: 4.2, tilt: -0.4 },
    ];
    orbitRefs.forEach((ref, i) => {
      if (!ref.current) return;
      const cfg = orbitConfig[i];
      if (!cfg) return;
      const a = t * cfg.speed + cfg.phase;
      ref.current.position.x = Math.cos(a) * cfg.r;
      ref.current.position.z = Math.sin(a) * cfg.r * Math.cos(cfg.tilt);
      ref.current.position.y = Math.sin(a) * cfg.r * Math.sin(cfg.tilt);
    });
  });

  return (
    <group ref={groupRef} position={[0.45, 1.45, 0.15]}>
      {/* 核心：暖琥珀色 emissive 球 */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.06, 32, 24]} />
        <meshStandardMaterial
          color="#fb923c"
          emissive="#fb923c"
          emissiveIntensity={2.4}
          roughness={0.3}
        />
      </mesh>
      {/* 内圈柔光 */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.1, 24, 18]} />
        <meshBasicMaterial color="#fed7aa" transparent opacity={0.28} />
      </mesh>
      {/* 外圈淡光（让它看起来"有 aura"） */}
      <mesh>
        <sphereGeometry args={[0.16, 24, 18]} />
        <meshBasicMaterial color="#fdba74" transparent opacity={0.1} />
      </mesh>
      {/* 3 颗 orbit 粒子 */}
      {orbitRefs.map((ref, i) => (
        <mesh key={i} ref={ref}>
          <sphereGeometry args={[0.012, 12, 10]} />
          <meshStandardMaterial
            color="#fef3c7"
            emissive="#fef3c7"
            emissiveIntensity={2.2}
          />
        </mesh>
      ))}
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
