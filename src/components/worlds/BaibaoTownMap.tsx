/**
 * v0.32.1: 百宝港俯视小镇地图 —— KayKit GLTF 真素材建筑 + procedural 地面。
 *
 * v0.32.0 → v0.32.1：6 个 procedural box 全部换成 KayKit Medieval Hexagon Pack 的
 * GLTF 建筑（market_blue / blacksmith_blue / tavern_blue / lumbermill_blue /
 * home_A_blue / tower_base_blue / scaffolding-for-locked）。
 *
 * 地面 + 街道 + 中央广场 + 装饰云朵保留 procedural（绿圆草坪 + 灰色十字 + 黄色广场圆）
 * — 给建筑当统一底座，跟 KayKit 风格不冲突（KayKit 自身也是低多边形可爱风）。
 *
 * 装饰物（barrel/tent/sack/flag）随完成数解锁。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import type { Group } from "three";
import {
  BAIBAO_BUILDINGS,
  type BaibaoBuilding,
} from "../../content/worlds/baibao";
import { KayBuilding, KayProp } from "./KayBuilding";

// v0.33.29 (Ep105 baibao-time-of-day): 时段主题色 — 按本地时间切换 day / sunset / night
type TimeMode = "day" | "sunset" | "night";
interface ThemePalette {
  grass: string;
  plaza: string;
  road: string;
  mascotEmissive: string;
  mascotEmissiveIntensity: number;
  /** 额外环境氛围光（dim 整体） */
  ambient: number; // 0-1 用于色调饱和度补偿
}
const THEMES: Record<TimeMode, ThemePalette> = {
  day: {
    grass: "#84cc16",
    plaza: "#fcd34d",
    road: "#a8a29e",
    mascotEmissive: "#fcd34d",
    mascotEmissiveIntensity: 1.6,
    ambient: 1.0,
  },
  sunset: {
    grass: "#65a30d",
    plaza: "#fb923c",
    road: "#a16207",
    mascotEmissive: "#fb923c",
    mascotEmissiveIntensity: 2.0,
    ambient: 0.85,
  },
  night: {
    grass: "#1e3a2e",
    plaza: "#3730a3",
    road: "#1e293b",
    mascotEmissive: "#fde68a",
    mascotEmissiveIntensity: 2.8,
    ambient: 0.55,
  },
};

function detectTimeMode(): TimeMode {
  // URL override: ?baibao_mode=day|sunset|night （方便测试）
  if (typeof window !== "undefined") {
    const m = new URLSearchParams(window.location.search).get("baibao_mode");
    if (m === "day" || m === "sunset" || m === "night") return m;
  }
  const h = new Date().getHours();
  if (h >= 6 && h < 17) return "day";
  if (h >= 17 && h < 19) return "sunset";
  return "night";
}

interface BaibaoTownMapProps {
  onSelectBuilding: (b: BaibaoBuilding) => void;
  onHoverBuilding?: (b: BaibaoBuilding | null) => void;
  /** 装饰碎片数量（决定地图视觉成长） */
  decorationCount?: number;
}

export function BaibaoTownMap({
  onSelectBuilding,
  onHoverBuilding,
  decorationCount = 0,
}: BaibaoTownMapProps) {
  // v0.33.29 (Ep105 baibao-time-of-day): 一次性读时段，整 session 不变（避免地图色不停跳）
  const timeMode = useMemo<TimeMode>(() => detectTimeMode(), []);
  const theme = THEMES[timeMode];
  const isNight = timeMode === "night";
  const isSunsetOrNight = timeMode === "sunset" || timeMode === "night";
  return (
    <group>
      {/* === 地面：大圆草坪 + 沙土广场 + 十字街 ===
         v0.33.29 (Ep105 baibao-time-of-day): color 走 theme palette */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[18, 64]} />
        <meshStandardMaterial color={theme.grass} roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[3.5, 32]} />
        <meshStandardMaterial
          color={theme.plaza}
          emissive={isNight ? theme.plaza : "#000"}
          emissiveIntensity={isNight ? 0.18 : 0}
          roughness={0.85}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[16, 1.4]} />
        <meshStandardMaterial color={theme.road} roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[0, 0.01, 0]}>
        <planeGeometry args={[16, 1.4]} />
        <meshStandardMaterial color={theme.road} roughness={0.95} />
      </mesh>
      {/* v0.33.13 (Ep89 DDDDDD): 街道 emissive glow trail — 4 段流光在十字路上流动 */}
      <RoadGlowTrails />

      {/* v0.33.29 (Ep105 baibao-time-of-day): 夜晚 4 角灯笼 + pointLight；
         sunset/night 都开 ambient 暖色补光 */}
      {isSunsetOrNight && <NightLanterns night={isNight} />}
      {isNight && <NightStars />}

      {/* === 6 个 KayKit 建筑 === */}
      {BAIBAO_BUILDINGS.map((b) => (
        <KayBuilding
          key={b.id}
          gltfUrl={b.gltfUrl}
          position={b.position}
          scale={1.4}
          rotationY={b.rotationY ?? 0}
          active={b.active}
          accentColor={b.color}
          label={`${b.emoji} ${b.name}`}
          sublabel={b.active ? b.skillHint : b.tagline}
          onSelect={() => onSelectBuilding(b)}
          onHoverChange={(hov) => onHoverBuilding?.(hov ? b : null)}
        />
      ))}

      {/* === 中央小进站位（占位光球） === */}
      <CenterMascot
        emissive={theme.mascotEmissive}
        emissiveIntensity={theme.mascotEmissiveIntensity}
      />

      {/* v0.33.33 (Ep109 mascot-dialog-bubble): mascot 头顶 speech 泡，按 timeMode + 进度切换 */}
      <MascotDialogBubble timeMode={timeMode} decorationCount={decorationCount} />

      {/* === 永远在的装饰: 用 KayKit 自带云 + 山丘装饰 === */}
      <KayProp gltfUrl="/env/kaykit/medieval/deco/cloud_big.gltf" position={[12, 6, -12]} scale={1.2} />
      <KayProp gltfUrl="/env/kaykit/medieval/deco/cloud_small.gltf" position={[-13, 7, 8]} scale={1.0} />
      <KayProp gltfUrl="/env/kaykit/medieval/deco/cloud_big.gltf" position={[-10, 5.5, -14]} scale={1.0} rotationY={Math.PI} />

      {/* === 进度装饰: 完成 1/3/10/20 单分别加 === */}
      {decorationCount >= 1 && (
        <KayProp gltfUrl="/env/kaykit/medieval/deco/barrel.gltf" position={[-3, 0, 3]} scale={1.0} />
      )}
      {decorationCount >= 3 && (
        <KayProp gltfUrl="/env/kaykit/medieval/deco/barrel.gltf" position={[3, 0, 3]} scale={1.0} rotationY={Math.PI / 4} />
      )}
      {decorationCount >= 5 && (
        <KayProp gltfUrl="/env/kaykit/medieval/deco/flag_blue.gltf" position={[0, 0, -3]} scale={1.0} />
      )}
      {decorationCount >= 10 && (
        <>
          <KayProp gltfUrl="/env/kaykit/medieval/deco/sack.gltf" position={[-4, 0, -2]} scale={1.0} />
          <KayProp gltfUrl="/env/kaykit/medieval/deco/sack.gltf" position={[4, 0, -2]} scale={1.0} rotationY={Math.PI / 6} />
        </>
      )}
      {decorationCount >= 20 && (
        <KayProp gltfUrl="/env/kaykit/medieval/deco/tent.gltf" position={[-12, 0, 0]} scale={1.2} />
      )}
      {decorationCount >= 30 && (
        <KayProp gltfUrl="/env/kaykit/medieval/deco/tent.gltf" position={[12, 0, 0]} scale={1.2} rotationY={Math.PI} />
      )}

      {/* === 周围山丘（永远有） === */}
      <KayProp gltfUrl="/env/kaykit/medieval/deco/hill_single_C.gltf" position={[16, 0, -10]} scale={1.5} />
      <KayProp gltfUrl="/env/kaykit/medieval/deco/hill_single_C.gltf" position={[-16, 0, -10]} scale={1.3} rotationY={Math.PI / 3} />
      <KayProp gltfUrl="/env/kaykit/medieval/deco/hill_single_C.gltf" position={[16, 0, 10]} scale={1.4} rotationY={Math.PI} />
      <KayProp gltfUrl="/env/kaykit/medieval/deco/hill_single_C.gltf" position={[-16, 0, 10]} scale={1.5} rotationY={-Math.PI / 2} />
    </group>
  );
}

function CenterMascot({
  emissive = "#fcd34d",
  emissiveIntensity = 1.6,
}: {
  emissive?: string;
  emissiveIntensity?: number;
}) {
  const ref = useRef<Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.getElapsedTime();
    ref.current.position.y = 0.8 + Math.sin(t * 1.2) * 0.15;
    ref.current.rotation.y = t * 0.4;
  });
  return (
    <group ref={ref} position={[0, 0.8, 0]}>
      <mesh>
        <octahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial
          color="#fef3c7"
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          roughness={0.3}
        />
      </mesh>
      <Billboard position={[0, 0.55, 0]}>
        <Text fontSize={0.35} anchorX="center" anchorY="middle">👩‍🏫</Text>
      </Billboard>
    </group>
  );
}

/**
 * v0.33.29 (Ep105 baibao-time-of-day): 黄昏 / 夜晚的 4 角灯笼。
 *  - 沿广场圆周外缘（半径 4）放 4 个，每个=小柱子+顶部 emissive 灯笼球+pointLight
 *  - night 时 emissive intensity 满，sunset 时半亮（"刚点上"感）
 *  - pointLight 仅 night 开启（性能：4 盏小 distance 灯，能接受）
 *  - 灯球轻微脉动 (sin)
 */
function NightLanterns({ night }: { night: boolean }) {
  const positions: [number, number, number][] = [
    [4, 0, 4],
    [-4, 0, 4],
    [4, 0, -4],
    [-4, 0, -4],
  ];
  const intensity = night ? 1.0 : 0.55;
  return (
    <group>
      {positions.map((p, i) => (
        <Lantern key={i} position={p} intensity={intensity} night={night} phaseOffset={i * 0.7} />
      ))}
    </group>
  );
}

function Lantern({
  position,
  intensity,
  night,
  phaseOffset,
}: {
  position: [number, number, number];
  intensity: number;
  night: boolean;
  phaseOffset: number;
}) {
  const lightRef = useRef<THREE.PointLight>(null);
  const glowMatRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((state) => {
    const t = state.clock.getElapsedTime() + phaseOffset;
    const pulse = 1 + Math.sin(t * 2.1) * 0.18;
    if (glowMatRef.current) {
      glowMatRef.current.emissiveIntensity = intensity * 2.4 * pulse;
    }
    if (lightRef.current) {
      lightRef.current.intensity = intensity * 0.8 * pulse;
    }
  });
  return (
    <group position={position}>
      {/* 柱子 */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 1.2, 8]} />
        <meshStandardMaterial color="#3f3f46" roughness={0.7} />
      </mesh>
      {/* 灯笼球 */}
      <mesh position={[0, 1.3, 0]}>
        <sphereGeometry args={[0.16, 16, 12]} />
        <meshStandardMaterial
          ref={glowMatRef}
          color="#fef3c7"
          emissive="#fde68a"
          emissiveIntensity={intensity * 2.4}
          roughness={0.4}
          toneMapped={false}
        />
      </mesh>
      {/* 微光点光源（仅 night 加） */}
      {night && (
        <pointLight
          ref={lightRef}
          position={[0, 1.3, 0]}
          color="#fde68a"
          intensity={intensity * 0.8}
          distance={3.5}
          decay={1.8}
        />
      )}
    </group>
  );
}

/**
 * v0.33.29 (Ep105 baibao-time-of-day): 夜空星星 —— 散点 emissive 小球，
 * 高高挂在天上 (y=10~16)，scale 不脉动以省 useFrame。
 */
function NightStars() {
  const stars = useMemo(() => {
    // 24 颗星 — 用 PRNG seed-like 散点
    const out: { pos: [number, number, number]; size: number }[] = [];
    for (let i = 0; i < 24; i++) {
      const seed = (i + 1) * 9301 + 49297;
      const r = ((seed * 233280) % 1) / 1;
      const angle = (i / 24) * Math.PI * 2 + r * 0.3;
      const radius = 13 + ((seed % 5) * 0.7);
      const y = 10 + ((i * 0.6) % 6);
      out.push({
        pos: [Math.cos(angle) * radius, y, Math.sin(angle) * radius],
        size: 0.08 + ((seed % 7) * 0.012),
      });
    }
    return out;
  }, []);
  return (
    <group>
      {stars.map((s, i) => (
        <mesh key={i} position={s.pos}>
          <sphereGeometry args={[s.size, 6, 4]} />
          <meshBasicMaterial color="#fef9c3" toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * v0.33.13 (Ep89 DDDDDD): 街道流光 — 在十字路两轴上各 2 道光段循环移动，
 * 给百宝港地图加一点活气，不干扰交互（raycast: () => null）。
 */
function RoadGlowTrails() {
  return (
    <group renderOrder={3}>
      <RoadGlowSegment axis="x" offset={0} color="#fde68a" />
      <RoadGlowSegment axis="x" offset={0.5} color="#38bdf8" />
      <RoadGlowSegment axis="z" offset={0.25} color="#fde68a" />
      <RoadGlowSegment axis="z" offset={0.75} color="#38bdf8" />
    </group>
  );
}

function RoadGlowSegment({
  axis,
  offset,
  color,
}: {
  axis: "x" | "z";
  offset: number;
  color: string;
}) {
  const ref = useRef<Group>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(({ clock }) => {
    if (!ref.current || !matRef.current) return;
    const t = (clock.elapsedTime * 0.18 + offset) % 1;
    const pos = -6.8 + t * 13.6;
    if (axis === "x") {
      ref.current.position.x = pos;
      ref.current.position.z = 0;
    } else {
      ref.current.position.z = pos;
      ref.current.position.x = 0;
    }
    // 边缘渐隐 — 流光接近视野边界时变淡
    const edgeFade = 1 - Math.min(1, Math.abs(pos) / 7.2);
    matRef.current.opacity = 0.14 + edgeFade * 0.28;
  });
  return (
    <group ref={ref} position={[0, 0.035, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={axis === "x" ? [3.1, 0.18] : [0.18, 3.1]} />
        <meshBasicMaterial
          ref={matRef}
          color={color}
          transparent
          opacity={0.28}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

/**
 * v0.33.33 (Ep109 mascot-dialog-bubble): mascot 头顶 speech 泡。
 *  - 每 11s 轮换一条 line，line 池按 timeMode 分（day/sunset/night 三套）
 *  - 完成进度高时混入 progress-aware 鼓励语
 *  - 渲染：Billboard 锁朝向相机；2 层 plane (border + bg) + Text 浮在上方
 *  - 切换时 400ms fade-in (opacity 0→1)，避免硬切
 *  - prefers-reduced-motion: 关 fade，直接显示新 line
 */
const DIALOG_LINES: Record<TimeMode, string[]> = {
  day: [
    "今天先选哪家？",
    "选个建筑试试 ✨",
    "扫码店总有惊喜",
    "你今天好棒！",
    "面包店等你切蛋糕",
    "再做 3 单解锁新装饰",
    "百宝银行教你换零",
    "机场带你装行李",
  ],
  sunset: [
    "夕阳真美 🌇",
    "晚饭前来一单？",
    "灯笼快亮了",
    "选个店吧，慢慢做",
    "今天差不多收工咯",
    "再做一单就奖励",
  ],
  night: [
    "晚上好 🌙",
    "灯笼亮了，挑个店",
    "夜场也有惊喜",
    "做完早点睡哦",
    "今天辛苦了",
    "再加一单就更棒",
    "灯笼下做题特别静",
  ],
};
const PROGRESS_LINES: { min: number; lines: string[] }[] = [
  { min: 10, lines: ["✨ 你已经完成 10+ 单啦！", "Selena 你越来越厉害"] },
  { min: 5, lines: ["💪 5 单达成，继续！", "再来！"] },
  { min: 1, lines: ["很好的开始！", "继续加油 ✨"] },
];

function MascotDialogBubble({
  timeMode,
  decorationCount,
}: {
  timeMode: TimeMode;
  decorationCount: number;
}) {
  // 组装当前时段可用 line 池（混入 progress-aware 1-2 条）
  const lines = useMemo(() => {
    const base = [...DIALOG_LINES[timeMode]];
    for (const tier of PROGRESS_LINES) {
      if (decorationCount >= tier.min) {
        base.push(...tier.lines);
        break;
      }
    }
    return base;
  }, [timeMode, decorationCount]);
  const [lineIdx, setLineIdx] = useState(() => Math.floor(Math.random() * Math.max(1, lines.length)));
  // 切换 line — 11s 周期，避免连续同一条用 shuffle 步长
  useEffect(() => {
    if (lines.length <= 1) return;
    const id = window.setInterval(() => {
      setLineIdx((i) => {
        const step = 1 + Math.floor(Math.random() * (lines.length - 1));
        return (i + step) % lines.length;
      });
    }, 11000);
    return () => clearInterval(id);
  }, [lines.length]);
  const currentLine = lines[lineIdx % lines.length] ?? "";
  // fade-in: 切换后 400ms 内 opacity 0 → 1
  const fadeStartRef = useRef(performance.now());
  useEffect(() => {
    fadeStartRef.current = performance.now();
  }, [lineIdx]);
  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const borderMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const bgMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const groupRef = useRef<Group>(null);
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    const elapsed = performance.now() - fadeStartRef.current;
    const k = reduceMotion ? 1 : Math.min(1, elapsed / 400);
    if (borderMatRef.current) borderMatRef.current.opacity = 0.95 * k;
    if (bgMatRef.current) bgMatRef.current.opacity = 0.96 * k;
    // 整体微浮 (跟 mascot bob 错峰，速度差异，2.4s 周期)
    if (groupRef.current) {
      groupRef.current.position.y = 2.05 + Math.sin(t * 1.6 + 0.7) * 0.08;
    }
  });
  return (
    <group ref={groupRef} position={[0, 2.05, 0]}>
      <Billboard>
        {/* border (大一点的 plane) */}
        <mesh position={[0, 0, -0.002]}>
          <planeGeometry args={[1.92, 0.62]} />
          <meshBasicMaterial
            ref={borderMatRef}
            color="#f59e0b"
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        {/* bg */}
        <mesh>
          <planeGeometry args={[1.84, 0.54]} />
          <meshBasicMaterial
            ref={bgMatRef}
            color="#fffbeb"
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        {/* text */}
        <Text
          key={lineIdx}
          position={[0, 0, 0.002]}
          fontSize={0.18}
          maxWidth={1.7}
          textAlign="center"
          color="#7c2d12"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.012}
          outlineColor="#fffbeb"
        >
          {currentLine}
        </Text>
      </Billboard>
    </group>
  );
}
