/**
 * 小进 — 未来感 AI 数学老师 3D 形象（v0.31.26 重设计）。
 *
 * 设计灵感：Wall-E 里的 EVE + 一点点熊猫可爱元素。
 * 整体调性：sleek / futuristic / 漂浮 / 高光泽白壳 + 冷青蓝 LED + 暗黑面板。
 *
 * 关键造型语言：
 *  - 椭蛋形身体 + 椭蛋形头，头身分离，悬浮姿态（没有腿）
 *  - 头部正面暗色弧面 visor（"屏幕"），visor 上两枚青蓝 LED 眼
 *  - 眼下小条状 LED audio bar 作"嘴"，跟 audioLevel 同步
 *  - 顶部小天线（含发光球，呼吸感）
 *  - 两只悬浮断臂（disconnected hands，EVE 招牌）
 *  - 底部反重力光环（cyan/violet 透明 ring 堆叠）
 *  - 胸前小 holo 圆环（数学符号当胸标）
 *
 * 熊猫呼应（很 subtle，整体仍是 EVE）：
 *  - 头顶两侧小黑色圆盘 panel —— 熊猫耳的位置 cue
 *  - 双颊小粉色 LED dot —— 熊猫腮红 cue
 *
 * Skin 切换在头顶悬浮一顶帽子（hover-above，不真戴）：
 *  default(无装饰) / graduation(博士帽) / wizard(巫师帽) / legendary(金皇冠+金边)。
 */

import { Suspense, forwardRef, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { Group, Mesh } from "three";

export type MascotSkin = "default" | "graduation" | "wizard" | "legendary";

const SKIN_THEMES: Record<MascotSkin, {
  hatStyle: "none" | "graduation" | "wizard" | "crown";
  ledMain: string;
  ledAccent: string;
  haloColor: string;
  trim?: string;
}> = {
  default: {
    hatStyle: "none",
    ledMain: "#67e8f9",
    ledAccent: "#a5f3fc",
    haloColor: "#7dd3fc",
  },
  graduation: {
    hatStyle: "graduation",
    ledMain: "#67e8f9",
    ledAccent: "#fbbf24",
    haloColor: "#fbbf24",
  },
  wizard: {
    hatStyle: "wizard",
    ledMain: "#c4b5fd",
    ledAccent: "#fde047",
    haloColor: "#a78bfa",
  },
  legendary: {
    hatStyle: "crown",
    ledMain: "#fde68a",
    ledAccent: "#fbbf24",
    haloColor: "#fbbf24",
    trim: "#f59e0b",
  },
};

const SHELL_WHITE = "#f5f7fb";
const SHELL_SHADOW = "#cbd5e1";
const VISOR_DARK = "#0b1220";
const PANDA_BLACK = "#1c1917";
const PANDA_BLUSH = "#f9a8d4";

interface Mascot3DProps {
  audioLevel?: number;
  skin?: MascotSkin;
  spin?: boolean;
  className?: string;
}

export default function Mascot3D({
  audioLevel = 0,
  skin = "default",
  spin = false,
  className,
}: Mascot3DProps) {
  return (
    <div className={className ?? "w-full h-full"}>
      <Canvas camera={{ position: [0, 0.15, 4.6], fov: 38 }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[3, 5, 4]} intensity={1.0} color="#ffffff" />
          <directionalLight position={[-3, 2, 3]} intensity={0.5} color="#7dd3fc" />
          <pointLight
            position={[0, -1.5, 2]}
            intensity={0.4}
            color={SKIN_THEMES[skin].ledMain}
          />
          <hemisphereLight args={["#bae6fd", "#1e1b4b", 0.35]} />

          <XiaoJin audioLevel={audioLevel} skin={skin} spin={spin} />

          <OrbitControls
            enablePan={false}
            enableZoom={false}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 1.8}
            target={[0, 0.1, 0]}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

interface XiaoJinProps {
  audioLevel: number;
  skin: MascotSkin;
  spin: boolean;
}

function XiaoJin({ audioLevel, skin, spin }: XiaoJinProps) {
  const rootRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const leftHandRef = useRef<Group>(null);
  const rightHandRef = useRef<Group>(null);
  const mouthRef = useRef<Mesh>(null);
  const leftEyeRef = useRef<Mesh>(null);
  const rightEyeRef = useRef<Mesh>(null);
  const haloRef = useRef<Group>(null);
  const antennaTipRef = useRef<Mesh>(null);
  const theme = SKIN_THEMES[skin];

  const blinkRef = useRef({ phase: 0, next: 3 + Math.random() * 2 });

  useFrame((state, delta) => {
    if (!rootRef.current || !bodyRef.current || !headRef.current || !mouthRef.current) return;
    const t = state.clock.getElapsedTime();

    rootRef.current.position.y = -0.15 + Math.sin(t * 1.3) * 0.04;
    if (spin) {
      rootRef.current.rotation.y += delta * 0.45;
    } else {
      rootRef.current.rotation.y = Math.sin(t * 0.45) * 0.16;
    }

    headRef.current.rotation.z = Math.sin(t * 0.7) * 0.05;
    headRef.current.rotation.x = Math.sin(t * 0.55) * 0.04;
    headRef.current.position.y = 0.72 + Math.sin(t * 1.6 + 0.5) * 0.02;

    bodyRef.current.scale.y = 1 + Math.sin(t * 1.0) * 0.012;

    if (leftHandRef.current) {
      leftHandRef.current.position.y = -0.05 + Math.sin(t * 1.5) * 0.05;
      leftHandRef.current.rotation.z = Math.sin(t * 0.9) * 0.12 - 0.12;
    }
    if (rightHandRef.current) {
      rightHandRef.current.position.y = -0.05 + Math.sin(t * 1.5 + Math.PI / 2) * 0.05;
      rightHandRef.current.rotation.z = -Math.sin(t * 0.9) * 0.12 + 0.12;
    }

    if (haloRef.current) {
      haloRef.current.rotation.z += delta * 0.6;
    }

    if (antennaTipRef.current) {
      const pulse = 1 + Math.sin(t * 3.2) * 0.18;
      antennaTipRef.current.scale.setScalar(pulse);
    }

    // 嘴 LED bar 跟 audioLevel
    const mouthXTarget = 0.6 + Math.min(1.5, audioLevel * 4.0);
    mouthRef.current.scale.x =
      mouthRef.current.scale.x + (mouthXTarget - mouthRef.current.scale.x) * 0.4;
    mouthRef.current.scale.y = 0.6 + Math.min(0.9, audioLevel * 3.0);

    // 眨眼
    blinkRef.current.phase += delta;
    let eyeScaleY = 1;
    if (blinkRef.current.phase > blinkRef.current.next) {
      const local = blinkRef.current.phase - blinkRef.current.next;
      if (local < 0.18) {
        eyeScaleY = local < 0.09 ? 1 - local / 0.09 : (local - 0.09) / 0.09;
        eyeScaleY = Math.max(0.06, eyeScaleY);
      } else {
        blinkRef.current.phase = 0;
        blinkRef.current.next = 3 + Math.random() * 3;
        eyeScaleY = 1;
      }
    }
    if (leftEyeRef.current) leftEyeRef.current.scale.y = eyeScaleY;
    if (rightEyeRef.current) rightEyeRef.current.scale.y = eyeScaleY;
  });

  return (
    <group ref={rootRef}>
      {/* 背景柔光环 */}
      <mesh position={[0, 0.5, -0.7]}>
        <ringGeometry args={[1.35, 1.6, 64]} />
        <meshBasicMaterial color={theme.haloColor} transparent opacity={0.18} />
      </mesh>

      {/* === 头部 === */}
      <group ref={headRef} position={[0, 0.72, 0]}>
        {/* 主头壳 */}
        <mesh>
          <sphereGeometry args={[0.62, 64, 48]} />
          <meshStandardMaterial
            color={SHELL_WHITE}
            roughness={0.18}
            metalness={0.25}
            envMapIntensity={1.2}
          />
        </mesh>
        {/* 头壳底面伪 AO 暗环 */}
        <mesh position={[0, -0.55, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.08, 0.18, 24]} />
          <meshBasicMaterial color={SHELL_SHADOW} transparent opacity={0.35} />
        </mesh>

        {/* 暗色 visor 屏幕 —— 覆盖头壳前半球的 hemisphere（EVE 招牌脸罩） */}
        <mesh>
          <sphereGeometry
            args={[
              0.628,        // 比头壳 0.62 略大，保证完全覆盖
              64,
              48,
              0,            // phiStart：Three.js 里 phi=PI/2 是 +z（前方），从 0 起
              Math.PI,      // phiLength：扫到 PI → 覆盖 +z 前半球
              0,
              Math.PI,
            ]}
          />
          {/* 低 metalness + 微暗紫蓝 emissive：在暗 scene 里依然能"读"出形状 */}
          <meshStandardMaterial
            color={VISOR_DARK}
            roughness={0.15}
            metalness={0.45}
            emissive="#1e293b"
            emissiveIntensity={0.5}
          />
        </mesh>
        {/* visor 与头壳交界处的银色边线（plate seam）—— 竖直方向 */}
        <mesh rotation={[0, 0, 0]}>
          <torusGeometry args={[0.628, 0.006, 8, 64]} />
          <meshStandardMaterial color={SHELL_SHADOW} roughness={0.4} metalness={0.7} />
        </mesh>
        {/* visor 顶部反光高光带 */}
        <mesh position={[0, 0.38, 0.45]} rotation={[0, 0, 0]} scale={[1.4, 0.06, 0.04]}>
          <sphereGeometry args={[0.28, 24, 12]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.22} />
        </mesh>

        {/* 双 LED 眼（贴在 visor 表面） */}
        <LedEye ref={leftEyeRef} position={[-0.18, 0.04, 0.6]} color={theme.ledMain} />
        <LedEye ref={rightEyeRef} position={[0.18, 0.04, 0.6]} color={theme.ledMain} />

        {/* 嘴 LED bar */}
        <mesh ref={mouthRef} position={[0, -0.22, 0.6]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.014, 0.12, 6, 16]} />
          <meshStandardMaterial
            color={theme.ledAccent}
            emissive={theme.ledAccent}
            emissiveIntensity={2.4}
            roughness={0.4}
          />
        </mesh>

        {/* 头顶两侧小黑圆盘（熊猫耳 cue）—— 稍稍外突，落在头壳后上方 */}
        <PandaEarDisc position={[-0.5, 0.42, -0.02]} />
        <PandaEarDisc position={[0.5, 0.42, -0.02]} />

        {/* 双颊粉 LED dot —— 落在 visor 下方两侧（小诊断灯 + 熊猫腮红 cue） */}
        <CheekDot position={[-0.36, -0.2, 0.48]} />
        <CheekDot position={[0.36, -0.2, 0.48]} />

        {/* 头顶天线 */}
        <group position={[0, 0.6, 0.02]}>
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.012, 0.016, 0.16, 12]} />
            <meshStandardMaterial color={SHELL_SHADOW} roughness={0.4} metalness={0.7} />
          </mesh>
          <mesh ref={antennaTipRef} position={[0, 0.18, 0]}>
            <sphereGeometry args={[0.038, 20, 16]} />
            <meshStandardMaterial
              color={theme.ledMain}
              emissive={theme.ledMain}
              emissiveIntensity={2.2}
              roughness={0.3}
            />
          </mesh>
        </group>

        {/* 头顶悬浮装饰 */}
        {theme.hatStyle === "graduation" && <GraduationHat />}
        {theme.hatStyle === "wizard" && <WizardHat color="#5b21b6" star={theme.ledAccent} />}
        {theme.hatStyle === "crown" && <Crown color="#fbbf24" gem={theme.ledAccent} />}
      </group>

      {/* === 身体 === */}
      <group ref={bodyRef} position={[0, -0.18, 0]}>
        <mesh scale={[0.95, 1.05, 0.92]}>
          <sphereGeometry args={[0.5, 64, 48]} />
          <meshStandardMaterial
            color={SHELL_WHITE}
            roughness={0.2}
            metalness={0.22}
            envMapIntensity={1.2}
          />
        </mesh>

        {theme.trim && (
          <>
            <mesh position={[-0.46, 0, 0]} scale={[0.04, 0.85, 0.04]}>
              <sphereGeometry args={[0.5, 16, 12]} />
              <meshStandardMaterial
                color={theme.trim}
                emissive={theme.trim}
                emissiveIntensity={0.6}
                metalness={0.8}
                roughness={0.25}
              />
            </mesh>
            <mesh position={[0.46, 0, 0]} scale={[0.04, 0.85, 0.04]}>
              <sphereGeometry args={[0.5, 16, 12]} />
              <meshStandardMaterial
                color={theme.trim}
                emissive={theme.trim}
                emissiveIntensity={0.6}
                metalness={0.8}
                roughness={0.25}
              />
            </mesh>
          </>
        )}

        {/* 胸前 holo 圆环 + π */}
        <group position={[0, 0.08, 0.46]}>
          <mesh>
            <torusGeometry args={[0.13, 0.012, 12, 36]} />
            <meshStandardMaterial
              color={theme.ledMain}
              emissive={theme.ledMain}
              emissiveIntensity={1.6}
              roughness={0.35}
            />
          </mesh>
          <ChestSymbol color={theme.ledMain} />
        </group>

        {/* 身体底部缝隙线 */}
        <mesh position={[0, -0.48, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.32, 0.34, 32]} />
          <meshBasicMaterial color={VISOR_DARK} transparent opacity={0.5} />
        </mesh>
      </group>

      {/* === 悬浮双手 === */}
      <group ref={leftHandRef} position={[-0.7, -0.05, 0.12]}>
        <FloatingHand color={SHELL_WHITE} />
      </group>
      <group ref={rightHandRef} position={[0.7, -0.05, 0.12]}>
        <FloatingHand color={SHELL_WHITE} mirror />
      </group>

      {/* === 反重力光环 === */}
      <group ref={haloRef} position={[0, -0.82, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.5, 64]} />
          <meshBasicMaterial color={theme.ledMain} transparent opacity={0.55} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
          <ringGeometry args={[0.55, 0.62, 64]} />
          <meshBasicMaterial color={theme.ledMain} transparent opacity={0.25} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
          <ringGeometry args={[0.7, 0.76, 64]} />
          <meshBasicMaterial color={theme.ledMain} transparent opacity={0.12} />
        </mesh>
      </group>

      {/* === 飘浮数学符号 === */}
      <FloatingSymbol position={[1.12, 0.7, 0.2]} symbol="π" color={theme.ledMain} />
      <FloatingSymbol position={[-1.18, 0.95, 0.1]} symbol="+" color={theme.ledAccent} />
      <FloatingSymbol position={[0.95, -0.55, 0.3]} symbol="★" color={theme.ledAccent} small />
      <FloatingSymbol position={[-0.95, -0.35, 0.4]} symbol="=" color={theme.ledMain} small />
    </group>
  );
}

/** LED 椭圆眼 */
const LedEye = forwardRef<Mesh, { position: [number, number, number]; color: string }>(
  function LedEye({ position, color }, ref) {
    return (
      <mesh ref={ref} position={position} scale={[1, 1, 0.4]}>
        <sphereGeometry args={[0.075, 32, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={2.8}
          roughness={0.25}
        />
      </mesh>
    );
  },
);

function PandaEarDisc({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.12, 24, 18]} />
        <meshStandardMaterial color={PANDA_BLACK} roughness={0.35} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.05]} scale={[0.6, 0.6, 0.2]}>
        <sphereGeometry args={[0.12, 18, 14]} />
        <meshStandardMaterial color="#374151" roughness={0.5} metalness={0.3} />
      </mesh>
    </group>
  );
}

function CheekDot({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position} scale={[1, 1, 0.5]}>
      <sphereGeometry args={[0.05, 18, 14]} />
      <meshStandardMaterial
        color={PANDA_BLUSH}
        emissive={PANDA_BLUSH}
        emissiveIntensity={1.3}
        roughness={0.5}
      />
    </mesh>
  );
}

function FloatingHand({ color, mirror }: { color: string; mirror?: boolean }) {
  return (
    <group rotation={[0, 0, mirror ? -0.2 : 0.2]}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.085, 0.12, 12, 24]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0.22} />
      </mesh>
      <mesh position={[mirror ? 0.1 : -0.1, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <ringGeometry args={[0.04, 0.08, 24]} />
        <meshBasicMaterial color={VISOR_DARK} />
      </mesh>
    </group>
  );
}

function ChestSymbol({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[0.12, 0.018, 0.018]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} />
      </mesh>
      <mesh position={[-0.035, -0.025, 0]}>
        <boxGeometry args={[0.018, 0.1, 0.018]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} />
      </mesh>
      <mesh position={[0.035, -0.025, 0]}>
        <boxGeometry args={[0.018, 0.1, 0.018]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} />
      </mesh>
    </group>
  );
}

function GraduationHat() {
  return (
    <group position={[0, 0.75, 0]}>
      <mesh>
        <boxGeometry args={[0.85, 0.04, 0.85]} />
        <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.26, 0.28, 0.18, 24]} />
        <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0.3, 0.02, 0.3]} scale={[0.04, 0.2, 0.04]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[0.3, -0.08, 0.3]}>
        <sphereGeometry args={[0.04, 14, 12]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.6} />
      </mesh>
    </group>
  );
}

function WizardHat({ color, star }: { color: string; star: string }) {
  return (
    <group position={[0, 0.55, 0]}>
      {/* 帽檐 */}
      <mesh>
        <cylinderGeometry args={[0.5, 0.56, 0.05, 24]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.2} />
      </mesh>
      {/* 锥体（控制在视野内） */}
      <mesh position={[0, 0.22, 0]} rotation={[0, 0, -0.08]}>
        <coneGeometry args={[0.22, 0.42, 18]} />
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.2} />
      </mesh>
      <FloatingSymbol position={[0.18, 0.3, 0.22]} symbol="★" color={star} small />
      <FloatingSymbol position={[-0.18, 0.35, 0.15]} symbol="★" color={star} small />
    </group>
  );
}

function Crown({ color, gem }: { color: string; gem: string }) {
  return (
    <group position={[0, 0.66, 0]}>
      <mesh>
        <cylinderGeometry args={[0.4, 0.44, 0.14, 20]} />
        <meshStandardMaterial color={color} metalness={0.95} roughness={0.18} />
      </mesh>
      {[...Array(6)].map((_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 0.4, 0.13, Math.sin(a) * 0.4]}>
            <coneGeometry args={[0.055, 0.14, 10]} />
            <meshStandardMaterial color={color} metalness={0.95} roughness={0.18} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.04, 0.42]}>
        <sphereGeometry args={[0.05, 16, 14]} />
        <meshStandardMaterial
          color={gem}
          emissive={gem}
          emissiveIntensity={0.8}
          metalness={0.5}
          roughness={0.2}
        />
      </mesh>
    </group>
  );
}

function FloatingSymbol({
  position,
  symbol,
  color,
  small,
}: {
  position: [number, number, number];
  symbol: string;
  color: string;
  small?: boolean;
}) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.position.y = position[1] + Math.sin(t * 1.5 + position[0]) * 0.09;
    ref.current.rotation.z = Math.sin(t * 0.8) * 0.22;
  });
  return (
    <group ref={ref} position={position}>
      <SymbolGlyph symbol={symbol} color={color} small={small} />
    </group>
  );
}

function SymbolGlyph({ symbol, color, small }: { symbol: string; color: string; small?: boolean }) {
  const s = small ? 0.55 : 1;
  if (symbol === "+") {
    return (
      <group scale={s}>
        <mesh>
          <boxGeometry args={[0.26, 0.055, 0.055]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.055, 0.26, 0.055]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
        </mesh>
      </group>
    );
  }
  if (symbol === "=") {
    return (
      <group scale={s}>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.24, 0.05, 0.05]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
        </mesh>
        <mesh position={[0, -0.06, 0]}>
          <boxGeometry args={[0.24, 0.05, 0.05]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
        </mesh>
      </group>
    );
  }
  if (symbol === "★") {
    return (
      <group scale={s}>
        {[...Array(5)].map((_, i) => {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          return (
            <mesh key={i} rotation={[0, 0, a]}>
              <boxGeometry args={[0.2, 0.042, 0.042]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
            </mesh>
          );
        })}
      </group>
    );
  }
  if (symbol === "π") {
    return (
      <group scale={s}>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[0.26, 0.046, 0.046]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
        </mesh>
        <mesh position={[-0.075, -0.04, 0]}>
          <boxGeometry args={[0.045, 0.22, 0.045]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
        </mesh>
        <mesh position={[0.075, -0.04, 0]}>
          <boxGeometry args={[0.045, 0.22, 0.045]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
        </mesh>
      </group>
    );
  }
  return (
    <mesh scale={s}>
      <sphereGeometry args={[0.08, 14, 10]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
    </mesh>
  );
}
