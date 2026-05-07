/**
 * 小进姐姐 3D 形象 — **女性熊猫毛绒玩偶**（plushie panda）。
 *
 * v0.31.25：revert v0.31.24 的"裸版"路线 — 用户说裸版不好看，回到 v0.31.22
 * 的装饰版本（默认带粉蝴蝶结 + 抱着紫色魔法书 + 周围飘 π / + / ★ 数学符号）。
 * 4 档 skin 切换头顶装饰：蝴蝶结 / 学位帽 / 巫师帽 / 皇冠。
 *
 * 设计原则：
 *  - 圆润 chibi 比例，毛绒玩偶质感（roughness 0.95+）
 *  - 标志特征：椭圆黑眼圈、圆形黑耳朵、白脸白肚黑手脚
 *  - 女性化 cue：长睫毛、粉鼻头、腮红
 *
 * 几何细节做了 v0.31.24 polish 留下来的改进：
 *  - 教泪滴形眼圈（外下端有 tip）
 *  - 心形粉色鼻头（cleft 朝上）
 *  - 4 根扇形长弯睫毛
 *  - ∪ 形微笑嘴（旋转 PI 让 arc 朝下）
 *  - 面部缝合线细节
 */

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { Group, Mesh } from "three";

export type MascotSkin = "default" | "graduation" | "wizard" | "legendary";

const SKIN_THEMES: Record<MascotSkin, {
  hatStyle: "bow" | "graduation" | "wizard" | "crown";
  accent: string;
  accent2: string;
  glow: string;
  scarf?: string;
}> = {
  default: {
    hatStyle: "bow",
    accent: "#f9a8d4", // 粉蝴蝶结
    accent2: "#fce7f3",
    glow: "#a78bfa",
  },
  graduation: {
    hatStyle: "graduation",
    accent: "#0f172a",
    accent2: "#fbbf24",
    glow: "#fbbf24",
  },
  wizard: {
    hatStyle: "wizard",
    accent: "#5b21b6",
    accent2: "#fde047",
    glow: "#a78bfa",
  },
  legendary: {
    hatStyle: "crown",
    accent: "#fbbf24",
    accent2: "#dc2626",
    glow: "#dc2626",
    scarf: "#dc2626",
  },
};

// 熊猫主色（永远黑白）
const PANDA_WHITE = "#fafaf9";
const PANDA_BLACK = "#1c1917";
const PANDA_INNER_EAR = "#fce7f3";
const PANDA_NOSE = "#ec4899";
const PANDA_BLUSH = "#fda4af";
const PANDA_MOUTH = "#7f1d1d";

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
      <Canvas camera={{ position: [0, 0.3, 3.4], fov: 36 }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.55} />
          <directionalLight position={[3, 5, 4]} intensity={0.85} />
          <directionalLight position={[-3, 2, 3]} intensity={0.4} color="#f5d0fe" />
          <pointLight position={[0, -2, 3]} intensity={0.3} color="#fff" />
          <PandaPlushie audioLevel={audioLevel} skin={skin} spin={spin} />
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 1.8}
            target={[0, 0.2, 0]}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

interface PandaProps {
  audioLevel: number;
  skin: MascotSkin;
  spin: boolean;
}

function PandaPlushie({ audioLevel, skin, spin }: PandaProps) {
  const rootRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const mouthRef = useRef<Mesh>(null);
  const leftEarRef = useRef<Mesh>(null);
  const rightEarRef = useRef<Mesh>(null);
  const theme = SKIN_THEMES[skin];

  useFrame((state, delta) => {
    if (!rootRef.current || !headRef.current || !mouthRef.current) return;
    const t = state.clock.getElapsedTime();
    rootRef.current.scale.y = 1 + Math.sin(t * 1.2) * 0.012;
    if (spin) rootRef.current.rotation.y += delta * 0.4;
    else rootRef.current.rotation.y = Math.sin(t * 0.5) * 0.18;
    headRef.current.rotation.z = Math.sin(t * 0.7) * 0.04;
    headRef.current.rotation.x = Math.sin(t * 0.55) * 0.04;
    if (leftEarRef.current) leftEarRef.current.rotation.z = Math.sin(t * 1.6) * 0.03 + 0.08;
    if (rightEarRef.current) rightEarRef.current.rotation.z = -Math.sin(t * 1.6) * 0.03 - 0.08;
    // 嘴型同步
    const target = 0.55 + Math.min(0.85, audioLevel * 3.5);
    const cur = mouthRef.current.scale.y;
    mouthRef.current.scale.y = cur + (target - cur) * 0.35;
  });

  return (
    <group ref={rootRef} position={[0, -0.2, 0]}>
      {/* 背景柔光环（颜色随 skin）*/}
      <mesh position={[0, 0.5, -0.7]}>
        <ringGeometry args={[1.3, 1.55, 48]} />
        <meshBasicMaterial color={theme.glow} transparent opacity={0.16} />
      </mesh>

      {/* === 头部 === */}
      <group ref={headRef} position={[0, 0.7, 0]}>
        {/* 主头球 */}
        <mesh scale={[1.0, 1.02, 0.95]}>
          <sphereGeometry args={[0.72, 64, 48]} />
          <meshStandardMaterial color={PANDA_WHITE} roughness={0.97} />
        </mesh>

        {/* 面部中心淡缝合线（plushie 细节） */}
        <mesh position={[0, 0.3, 0.69]} scale={[0.0035, 0.4, 0.005]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#d1d5db" roughness={1} opacity={0.7} transparent />
        </mesh>

        {/* === 黑耳朵 === */}
        <mesh ref={leftEarRef} position={[-0.5, 0.7, -0.02]}>
          <sphereGeometry args={[0.24, 32, 24]} />
          <meshStandardMaterial color={PANDA_BLACK} roughness={0.98} />
        </mesh>
        <mesh ref={rightEarRef} position={[0.5, 0.7, -0.02]}>
          <sphereGeometry args={[0.24, 32, 24]} />
          <meshStandardMaterial color={PANDA_BLACK} roughness={0.98} />
        </mesh>
        {/* 内耳粉 */}
        <mesh position={[-0.5, 0.7, 0.12]}>
          <sphereGeometry args={[0.13, 24, 18]} />
          <meshStandardMaterial color={PANDA_INNER_EAR} roughness={0.85} />
        </mesh>
        <mesh position={[0.5, 0.7, 0.12]}>
          <sphereGeometry args={[0.13, 24, 18]} />
          <meshStandardMaterial color={PANDA_INNER_EAR} roughness={0.85} />
        </mesh>

        {/* === 教泪滴形黑眼圈 === */}
        <TeardropEyePatch
          position={[-0.22, 0.03, 0.6]}
          scale={[1.15, 1.25, 0.55]}
          rotateZ={-0.22}
        />
        <TeardropEyePatch
          position={[0.22, 0.03, 0.6]}
          scale={[1.15, 1.25, 0.55]}
          rotateZ={0.22}
          flipX
        />

        {/* === 大亮眼睛 === */}
        <Eye position={[-0.22, 0.1, 0.76]} flipX />
        <Eye position={[0.22, 0.1, 0.76]} />

        {/* === 长弯睫毛 === */}
        <Eyelashes position={[-0.22, 0.25, 0.76]} flipX />
        <Eyelashes position={[0.22, 0.25, 0.76]} />

        {/* === 心形粉色小鼻头（cleft 朝上）=== */}
        <HeartNose position={[0, -0.05, 0.76]} />

        {/* === 椭圆粉腮红 === */}
        <mesh position={[-0.46, -0.1, 0.55]} rotation={[0, -0.2, 0]}>
          <circleGeometry args={[0.1, 24]} />
          <meshBasicMaterial color={PANDA_BLUSH} transparent opacity={0.55} />
        </mesh>
        <mesh position={[0.46, -0.1, 0.55]} rotation={[0, 0.2, 0]}>
          <circleGeometry args={[0.1, 24]} />
          <meshBasicMaterial color={PANDA_BLUSH} transparent opacity={0.55} />
        </mesh>

        {/* === 微笑 ∪ 嘴 === */}
        <mesh
          ref={mouthRef}
          position={[0, -0.22, 0.72]}
          rotation={[0, 0, Math.PI]}
          scale={[1.4, 0.55, 1]}
        >
          <torusGeometry args={[0.07, 0.014, 8, 32, Math.PI]} />
          <meshStandardMaterial color={PANDA_MOUTH} roughness={0.6} />
        </mesh>

        {/* === 头顶装饰（按 skin 不同）=== */}
        {theme.hatStyle === "bow" && <PinkBow color={theme.accent} accent={theme.accent2} />}
        {theme.hatStyle === "graduation" && <GraduationCap accent={theme.accent2} />}
        {theme.hatStyle === "wizard" && <WizardHat color={theme.accent} accent={theme.accent2} />}
        {theme.hatStyle === "crown" && <Crown color={theme.accent} accent={theme.accent2} />}
      </group>

      {/* === 身体 + 抱着的紫色魔法书 === */}
      <group position={[0, -0.3, 0]}>
        {/* 主体白球 */}
        <mesh scale={[1.05, 0.95, 0.92]}>
          <sphereGeometry args={[0.55, 48, 36]} />
          <meshStandardMaterial color={PANDA_WHITE} roughness={0.97} />
        </mesh>
        {/* 围巾（仅 legendary） */}
        {theme.scarf && (
          <mesh position={[0, 0.42, 0]} rotation={[0.1, 0, 0]}>
            <torusGeometry args={[0.42, 0.08, 12, 32]} />
            <meshStandardMaterial color={theme.scarf} roughness={0.7} />
          </mesh>
        )}
        {/* 黑色前肢交叉胸前 */}
        <mesh position={[-0.4, -0.05, 0.32]} rotation={[0.3, -0.2, 0.55]}>
          <sphereGeometry args={[0.18, 24, 20]} />
          <meshStandardMaterial color={PANDA_BLACK} roughness={0.98} />
        </mesh>
        <mesh position={[0.4, -0.05, 0.32]} rotation={[0.3, 0.2, -0.55]}>
          <sphereGeometry args={[0.18, 24, 20]} />
          <meshStandardMaterial color={PANDA_BLACK} roughness={0.98} />
        </mesh>
        {/* 抱在胸前的紫色魔法书 */}
        <mesh position={[0, 0, 0.42]} rotation={[0.35, 0, 0]}>
          <boxGeometry args={[0.36, 0.26, 0.06]} />
          <meshStandardMaterial color="#7c3aed" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0, 0.455]} rotation={[0.35, 0, 0]} scale={[0.85, 0.85, 1]}>
          <boxGeometry args={[0.36, 0.26, 0.005]} />
          <meshStandardMaterial color="#fde047" roughness={0.5} />
        </mesh>
        {/* 黑色后脚（藏底部）*/}
        <mesh position={[-0.24, -0.5, 0.18]}>
          <sphereGeometry args={[0.16, 20, 16]} />
          <meshStandardMaterial color={PANDA_BLACK} roughness={0.98} />
        </mesh>
        <mesh position={[0.24, -0.5, 0.18]}>
          <sphereGeometry args={[0.16, 20, 16]} />
          <meshStandardMaterial color={PANDA_BLACK} roughness={0.98} />
        </mesh>
      </group>

      {/* === 飘浮装饰：π / + / ★ === */}
      <FloatingSymbol position={[1.05, 0.6, 0.2]} symbol="π" color={theme.glow} />
      <FloatingSymbol position={[-1.1, 0.85, 0.1]} symbol="+" color={theme.accent2} />
      <FloatingSymbol position={[0.85, -0.6, 0.3]} symbol="★" color={theme.accent} small />
    </group>
  );
}

/** 教泪滴形眼圈 */
function TeardropEyePatch({
  position,
  scale,
  rotateZ,
  flipX,
}: {
  position: [number, number, number];
  scale: [number, number, number];
  rotateZ: number;
  flipX?: boolean;
}) {
  return (
    <group position={position} rotation={[0, 0, rotateZ]}>
      <mesh scale={scale}>
        <sphereGeometry args={[0.16, 28, 22]} />
        <meshStandardMaterial color={PANDA_BLACK} roughness={0.95} />
      </mesh>
      <mesh
        position={[flipX ? -0.04 : 0.04, -0.18, -0.02]}
        scale={[scale[0] * 0.55, scale[1] * 0.6, scale[2] * 0.5]}
      >
        <sphereGeometry args={[0.16, 20, 16]} />
        <meshStandardMaterial color={PANDA_BLACK} roughness={0.95} />
      </mesh>
    </group>
  );
}

function Eye({ position, flipX }: { position: [number, number, number]; flipX?: boolean }) {
  const sign = flipX ? -1 : 1;
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.085, 24, 18]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.12} metalness={0.15} />
      </mesh>
      <mesh position={[0.025 * sign, 0.04, 0.07]}>
        <sphereGeometry args={[0.026, 12, 10]} />
        <meshBasicMaterial color="white" />
      </mesh>
      <mesh position={[-0.025 * sign, -0.012, 0.075]}>
        <sphereGeometry args={[0.013, 10, 8]} />
        <meshBasicMaterial color="white" />
      </mesh>
    </group>
  );
}

function Eyelashes({ position, flipX }: { position: [number, number, number]; flipX?: boolean }) {
  const sign = flipX ? -1 : 1;
  const lashes = useMemo(
    () => [
      { dx: -0.07 * sign, dy: -0.015, rotZ: sign * -0.7, len: 0.1 },
      { dx: -0.025 * sign, dy: 0.005, rotZ: sign * -0.45, len: 0.115 },
      { dx: 0.025 * sign, dy: 0.005, rotZ: sign * -0.18, len: 0.115 },
      { dx: 0.075 * sign, dy: -0.015, rotZ: sign * 0.05, len: 0.1 },
    ],
    [sign],
  );
  return (
    <group position={position}>
      {lashes.map((l, i) => (
        <mesh key={i} position={[l.dx, l.dy, 0]} rotation={[0, 0, l.rotZ]}>
          <cylinderGeometry args={[0.0008, 0.005, l.len, 8]} />
          <meshStandardMaterial color={PANDA_BLACK} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function HeartNose({ position }: { position: [number, number, number] }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const s = 0.05;
    shape.moveTo(0, -1.0 * s);
    shape.bezierCurveTo(-1.0 * s, -0.4 * s, -1.0 * s, 0.7 * s, 0, 0.3 * s);
    shape.bezierCurveTo(1.0 * s, 0.7 * s, 1.0 * s, -0.4 * s, 0, -1.0 * s);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.04,
      bevelEnabled: true,
      bevelSize: 0.012,
      bevelThickness: 0.012,
      bevelSegments: 4,
      curveSegments: 24,
    });
    geo.center();
    return geo;
  }, []);
  return (
    <mesh position={position} geometry={geometry}>
      <meshStandardMaterial color={PANDA_NOSE} roughness={0.45} metalness={0.05} />
    </mesh>
  );
}

function PinkBow({ color, accent }: { color: string; accent: string }) {
  return (
    <group position={[0.32, 0.62, 0]} rotation={[0, 0, 0.15]}>
      <mesh>
        <boxGeometry args={[0.18, 0.12, 0.06]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <sphereGeometry args={[0.04, 12, 10]} />
        <meshStandardMaterial color={accent} roughness={0.55} />
      </mesh>
    </group>
  );
}

function GraduationCap({ accent }: { accent: string }) {
  return (
    <group position={[0, 0.65, 0]}>
      <mesh>
        <boxGeometry args={[0.95, 0.04, 0.95]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.13, 0]}>
        <cylinderGeometry args={[0.32, 0.32, 0.2, 24]} />
        <meshStandardMaterial color="#0f172a" roughness={0.5} />
      </mesh>
      <mesh position={[0.34, 0.02, 0.34]} scale={[0.04, 0.2, 0.04]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={accent} roughness={0.4} />
      </mesh>
    </group>
  );
}

function WizardHat({ color, accent }: { color: string; accent: string }) {
  return (
    <group position={[0, 0.55, 0]}>
      <mesh>
        <cylinderGeometry args={[0.65, 0.7, 0.05, 24]} />
        <meshStandardMaterial color={color} roughness={0.65} />
      </mesh>
      <mesh position={[0, 0.6, 0]} rotation={[0, 0, -0.04]}>
        <coneGeometry args={[0.32, 1.05, 16]} />
        <meshStandardMaterial color={color} roughness={0.65} />
      </mesh>
      <FloatingSymbol position={[0.18, 0.65, 0.3]} symbol="★" color={accent} small />
    </group>
  );
}

function Crown({ color, accent }: { color: string; accent: string }) {
  return (
    <group position={[0, 0.6, 0]}>
      <mesh>
        <cylinderGeometry args={[0.5, 0.55, 0.18, 16]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.2} />
      </mesh>
      {[...Array(5)].map((_, i) => {
        const a = (i / 5) * Math.PI * 2;
        return (
          <mesh
            key={i}
            position={[Math.cos(a) * 0.5, 0.18, Math.sin(a) * 0.5]}
          >
            <coneGeometry args={[0.07, 0.22, 8]} />
            <meshStandardMaterial color={color} metalness={0.9} roughness={0.2} />
          </mesh>
        );
      })}
      <mesh position={[0, 0.18, 0]}>
        <sphereGeometry args={[0.06, 14, 12]} />
        <meshStandardMaterial color={accent} metalness={0.5} roughness={0.2} />
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
    ref.current.position.y = position[1] + Math.sin(t * 1.5 + position[0]) * 0.08;
    ref.current.rotation.z = Math.sin(t * 0.8) * 0.2;
  });
  return (
    <group ref={ref} position={position}>
      <SymbolGlyph symbol={symbol} color={color} small={small} />
    </group>
  );
}

function SymbolGlyph({ symbol, color, small }: { symbol: string; color: string; small?: boolean }) {
  const s = small ? 0.5 : 1;
  if (symbol === "+") {
    return (
      <group scale={s}>
        <mesh>
          <boxGeometry args={[0.28, 0.06, 0.06]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
        </mesh>
        <mesh>
          <boxGeometry args={[0.06, 0.28, 0.06]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
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
              <boxGeometry args={[0.22, 0.045, 0.045]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
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
          <boxGeometry args={[0.28, 0.05, 0.05]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[-0.08, -0.05, 0]}>
          <boxGeometry args={[0.05, 0.24, 0.05]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0.08, -0.05, 0]}>
          <boxGeometry args={[0.05, 0.24, 0.05]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
        </mesh>
      </group>
    );
  }
  return (
    <mesh scale={s}>
      <sphereGeometry args={[0.08, 12, 8]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
    </mesh>
  );
}
