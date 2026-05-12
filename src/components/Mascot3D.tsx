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
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { VRM, VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import * as THREE from "three";
import type { Group, Object3D } from "three";

export type MascotSkin = "default" | "graduation" | "wizard" | "legendary";
export type MascotView = "portrait" | "full";
export type MascotGesture =
  | "idle"
  | "wave"
  | "nod"
  | "shake"
  | "point"
  | "thumbsUp"
  | "cheer"
  | "clap" // v0.31.111：拍手（答对一组题 / Selena 帮自己加油）
  | "dance"; // v0.31.111：跳舞（通关 / 大成就庆祝）
export type MascotEmotion = "neutral" | "happy" | "sad" | "surprised" | "confused" | "angry";

export type MascotOutfit = "default" | "sandi" | "zhou" | "mint" | "ren";

interface Mascot3DProps {
  audioLevel?: number;
  skin?: MascotSkin;
  spin?: boolean;
  className?: string;
  /** 默认 /avatars/xiaojin.vrm，外面可以覆写换 outfit */
  vrmUrl?: string;
  /** portrait = 头+胸，full = 全身（看到裙子和腿）*/
  view?: MascotView;
  /** 一次性动作。设回 'idle' 让她回到自然状态 */
  gesture?: MascotGesture;
  /** 持续表情。叠加在 idle 微笑 / lipsync 之上 */
  emotion?: MascotEmotion;
  /** 衣服 outfit：'default' 用 Xiaojin 原校服；其他从同作者的 donor VRM 移植 CLOTH primitives */
  outfit?: MascotOutfit;
}

const OUTFIT_VRM_URLS: Record<MascotOutfit, string | null> = {
  default: null,
  sandi: "/avatars/outfit-sandi.vrm",
  zhou: "/avatars/outfit-zhou.vrm",
  mint: "/avatars/outfit-mint.vrm",
  ren: "/avatars/outfit-ren.vrm",
};

const DEFAULT_VRM_URL = "/avatars/xiaojin.vrm";

// 相机预设：根据 view 决定 framing
const CAMERA_PRESETS: Record<MascotView, { position: [number, number, number]; target: [number, number, number]; fov: number }> = {
  portrait: { position: [0, 1.35, 1.8], target: [0, 1.25, 0], fov: 30 },
  // 全身：fov 42 + 距离 4.2 → 视高范围 [-0.74, 2.30]，头脚都有 padding（即便挥手到斜上方也进画）
  full: { position: [0, 0.78, 4.2], target: [0, 0.78, 0], fov: 42 },
};

export default function Mascot3D({
  audioLevel = 0,
  skin = "default",
  spin = false,
  className,
  vrmUrl = DEFAULT_VRM_URL,
  view = "portrait",
  gesture = "idle",
  emotion = "neutral",
  outfit = "default",
}: Mascot3DProps) {
  const cam = CAMERA_PRESETS[view];
  // outfit != default → 主角永远是 Xiaojin，从对应 donor VRM 移植衣服 mesh。
  // 这条路径会要求 graftClothing 成功；失败时控制台会 warn，画面继续显示 Xiaojin 默认校服。
  const donorUrl = outfit === "default" ? null : OUTFIT_VRM_URLS[outfit];
  return (
    <div className={className ?? "w-full h-full"}>
      <Canvas
        key={view}
        camera={{ position: cam.position, fov: cam.fov }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        resize={{ debounce: 0 }}
      >
        <Suspense fallback={null}>
          <SceneLighting skin={skin} />

          {/* 按 skin 切换背景场景 */}
          <SceneBackground skin={skin} />

          <VRMScene
            url={vrmUrl}
            outfitUrl={donorUrl}
            audioLevel={audioLevel}
            skin={skin}
            spin={spin}
            gesture={gesture}
            emotion={emotion}
            view={view}
          />

          <OrbitControls
            enablePan={false}
            enableZoom={false}
            target={cam.target}
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
  /** 可选 donor VRM —— 从中提取衣服 primitives 移植到 Xiaojin */
  outfitUrl: string | null;
  audioLevel: number;
  skin: MascotSkin;
  spin: boolean;
  gesture: MascotGesture;
  emotion: MascotEmotion;
  view: MascotView;
}

/** 每个 skin 独立的灯光 + envmap + fog 主题 */
function SceneLighting({ skin }: { skin: MascotSkin }) {
  const cfg = {
    default: {
      fog: "#1e1b4b" as const, fogStart: 5.5, fogEnd: 11,
      ambient: 0.4, keyColor: "#fff7ed", keyInt: 0.95,
      fillColor: "#bae6fd", fillInt: 0.35,
      rimColor: "#f5d0fe", rimInt: 0.55,
      preset: "studio" as const,
    },
    graduation: {
      fog: "#2a1a0a" as const, fogStart: 5.5, fogEnd: 11,
      ambient: 0.4, keyColor: "#fef3c7", keyInt: 1.0,
      fillColor: "#fed7aa", fillInt: 0.45,
      rimColor: "#fbbf24", rimInt: 0.55,
      preset: "apartment" as const,
    },
    wizard: {
      fog: "#1e1b4b" as const, fogStart: 4.5, fogEnd: 10,
      ambient: 0.3, keyColor: "#c4b5fd", keyInt: 0.95,
      fillColor: "#f5d0fe", fillInt: 0.45,
      rimColor: "#fde047", rimInt: 0.7,
      preset: "sunset" as const,
    },
    legendary: {
      fog: "#0c0a1e" as const, fogStart: 5.0, fogEnd: 10,
      ambient: 0.3, keyColor: "#fef3c7", keyInt: 1.1,
      fillColor: "#7dd3fc", fillInt: 0.45,
      rimColor: "#fde047", rimInt: 0.85,
      preset: "night" as const,
    },
  }[skin];
  return (
    <>
      <fog attach="fog" args={[cfg.fog, cfg.fogStart, cfg.fogEnd]} />
      <ambientLight intensity={cfg.ambient} />
      <directionalLight position={[2.5, 3.5, 3]} intensity={cfg.keyInt} color={cfg.keyColor} />
      <directionalLight position={[-3, 2, 1]} intensity={cfg.fillInt} color={cfg.fillColor} />
      <directionalLight position={[0, 2.5, -3]} intensity={cfg.rimInt} color={cfg.rimColor} />
      <Environment preset={cfg.preset} />
    </>
  );
}

/** 4 个场景背景：教室 / 图书馆 / 魔法塔 / 星空，对应 default/grad/wizard/legendary */
function SceneBackground({ skin }: { skin: MascotSkin }) {
  switch (skin) {
    case "default":
      return <ClassroomBackdrop />;
    case "graduation":
      return <LibraryBackdrop />;
    case "wizard":
      return <MagicTowerBackdrop />;
    case "legendary":
      return <CosmosBackdrop />;
  }
}

/** 飞船教室：深空背景 + 悬浮全息黑板 + 远处飞船管道暗示 */
function ClassroomBackdrop() {
  const hologramRef = useRef<Group>(null);
  const stars = useMemo(
    () =>
      Array.from({ length: 90 }, () => ({
        x: -6 + Math.random() * 12,
        y: -1 + Math.random() * 5,
        z: -3.5 - Math.random() * 0.4,
        size: 0.006 + Math.random() * 0.015,
        color: Math.random() > 0.7 ? "#fde68a" : Math.random() > 0.5 ? "#7dd3fc" : "#ffffff",
      })),
    [],
  );
  // 悬浮黑板：上下飘 + 微旋
  useFrame((state) => {
    if (!hologramRef.current) return;
    const t = state.clock.getElapsedTime();
    hologramRef.current.position.y = 1.5 + Math.sin(t * 0.8) * 0.04;
    hologramRef.current.rotation.y = Math.sin(t * 0.3) * 0.05;
  });
  return (
    <group position={[0, 0, -2.0]}>
      {/* 深空大背景墙（满覆盖、纯黑紫色）*/}
      <mesh position={[0, 1.2, -1.5]}>
        <planeGeometry args={[20, 12]} />
        <meshBasicMaterial color="#06061a" />
      </mesh>
      {/* 星云层：3 层柔和大圆 */}
      <mesh position={[-1.2, 1.6, -1.3]}>
        <circleGeometry args={[2.4, 32]} />
        <meshBasicMaterial color="#7c3aed" transparent opacity={0.18} />
      </mesh>
      <mesh position={[1.5, 1.0, -1.2]}>
        <circleGeometry args={[1.8, 32]} />
        <meshBasicMaterial color="#ec4899" transparent opacity={0.12} />
      </mesh>
      <mesh position={[0.3, 2.0, -1.1]}>
        <circleGeometry args={[1.6, 32]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.14} />
      </mesh>
      {/* 90 颗星点散布 */}
      {stars.map((s, i) => (
        <mesh key={i} position={[s.x, s.y, s.z]}>
          <sphereGeometry args={[s.size, 6, 4]} />
          <meshStandardMaterial color={s.color} emissive={s.color} emissiveIntensity={1.8} />
        </mesh>
      ))}

      {/* 中央悬浮全息黑板：cyan 边框 + 半透深蓝玻璃面 + 公式痕迹 */}
      <group ref={hologramRef} position={[0, 1.5, -0.3]}>
        <mesh>
          <planeGeometry args={[2.4, 1.2]} />
          <meshStandardMaterial
            color="#0c4a6e"
            emissive="#0891b2"
            emissiveIntensity={0.45}
            transparent
            opacity={0.5}
            roughness={0.3}
          />
        </mesh>
        {/* 4 条边发光 */}
        <mesh position={[0, 0.62, 0.005]}>
          <planeGeometry args={[2.46, 0.025]} />
          <meshStandardMaterial color="#67e8f9" emissive="#67e8f9" emissiveIntensity={2.5} />
        </mesh>
        <mesh position={[0, -0.62, 0.005]}>
          <planeGeometry args={[2.46, 0.025]} />
          <meshStandardMaterial color="#67e8f9" emissive="#67e8f9" emissiveIntensity={2.5} />
        </mesh>
        <mesh position={[-1.225, 0, 0.005]}>
          <planeGeometry args={[0.025, 1.24]} />
          <meshStandardMaterial color="#67e8f9" emissive="#67e8f9" emissiveIntensity={2.5} />
        </mesh>
        <mesh position={[1.225, 0, 0.005]}>
          <planeGeometry args={[0.025, 1.24]} />
          <meshStandardMaterial color="#67e8f9" emissive="#67e8f9" emissiveIntensity={2.5} />
        </mesh>
        {/* 4 个角落小装饰 */}
        {[
          { x: -1.18, y: 0.58 },
          { x: 1.18, y: 0.58 },
          { x: -1.18, y: -0.58 },
          { x: 1.18, y: -0.58 },
        ].map((c, i) => (
          <mesh key={i} position={[c.x, c.y, 0.006]}>
            <circleGeometry args={[0.025, 8]} />
            <meshStandardMaterial color="#a5f3fc" emissive="#a5f3fc" emissiveIntensity={2.5} />
          </mesh>
        ))}
        {/* 公式光痕（模拟黑板上的数学符号）*/}
        {[
          { x: -0.85, y: 0.3, w: 0.35 },
          { x: -0.3, y: 0.22, w: 0.5 },
          { x: 0.4, y: 0.32, w: 0.4 },
          { x: 0.85, y: 0.22, w: 0.3 },
          { x: -0.7, y: -0.05, w: 0.6 },
          { x: 0.15, y: -0.1, w: 0.5 },
          { x: 0.85, y: -0.05, w: 0.35 },
          { x: -0.45, y: -0.32, w: 0.5 },
          { x: 0.4, y: -0.35, w: 0.45 },
        ].map((c, i) => (
          <mesh key={i} position={[c.x, c.y, 0.006]}>
            <planeGeometry args={[c.w, 0.022]} />
            <meshStandardMaterial color="#a5f3fc" emissive="#a5f3fc" emissiveIntensity={1.7} />
          </mesh>
        ))}
      </group>

      {/* 飞船管道暗示（左右远处几道暗 cyan tech 线条）*/}
      {[
        { x: -3.2, y: 2.6, w: 1.2 },
        { x: -3.2, y: 0.1, w: 1.2 },
        { x: 3.2, y: 2.6, w: 1.2 },
        { x: 3.2, y: 0.1, w: 1.2 },
      ].map((t, i) => (
        <mesh key={i} position={[t.x, t.y, -0.8]}>
          <planeGeometry args={[t.w, 0.03]} />
          <meshStandardMaterial color="#67e8f9" emissive="#67e8f9" emissiveIntensity={1.2} transparent opacity={0.7} />
        </mesh>
      ))}
      {/* 左右各一条竖向 tech 立柱（暗示飞船舱壁） */}
      <mesh position={[-3.0, 1.3, -0.7]}>
        <planeGeometry args={[0.04, 3.0]} />
        <meshStandardMaterial color="#67e8f9" emissive="#67e8f9" emissiveIntensity={0.8} transparent opacity={0.5} />
      </mesh>
      <mesh position={[3.0, 1.3, -0.7]}>
        <planeGeometry args={[0.04, 3.0]} />
        <meshStandardMaterial color="#67e8f9" emissive="#67e8f9" emissiveIntensity={0.8} transparent opacity={0.5} />
      </mesh>

      {/* 飞船地板：暗深空蓝 + 中央 cyan 网格线（淡 emissive） */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 1.5]}>
        <planeGeometry args={[16, 5]} />
        <meshStandardMaterial color="#06091a" roughness={0.95} metalness={0} />
      </mesh>
      {[-1.5, -0.8, 0, 0.8, 1.5].map((x, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.005, 1.5]}>
          <planeGeometry args={[0.015, 4.5]} />
          <meshStandardMaterial color="#67e8f9" emissive="#67e8f9" emissiveIntensity={1.4} transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/** 图书馆：书架 + 暖黄吊灯 */
function LibraryBackdrop() {
  // 6 个书架，4 排书
  const shelves = useMemo(() => {
    const arr: { x: number; y: number; books: { c: string; w: number }[] }[] = [];
    const palette = ["#7f1d1d", "#1e3a8a", "#92400e", "#0f172a", "#365314", "#7c2d12", "#581c87"];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 7; col++) {
        const books: { c: string; w: number }[] = [];
        let used = 0;
        while (used < 0.9) {
          const w = 0.07 + Math.random() * 0.06;
          if (used + w > 0.95) break;
          books.push({
            c: palette[Math.floor(Math.random() * palette.length)]!,
            w,
          });
          used += w;
        }
        arr.push({ x: -2.4 + col * 0.85, y: 0.3 + row * 0.55, books });
      }
    }
    return arr;
  }, []);
  return (
    <group position={[0, 0, -2.4]}>
      {/* 木墙 */}
      <mesh position={[0, 1.2, -0.2]}>
        <planeGeometry args={[14, 6]} />
        <meshStandardMaterial color="#451a03" roughness={0.95} />
      </mesh>
      {/* 4 排书架横板 */}
      {[0.2, 0.75, 1.3, 1.85, 2.4].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <boxGeometry args={[6, 0.04, 0.18]} />
          <meshStandardMaterial color="#78350f" roughness={0.7} />
        </mesh>
      ))}
      {/* 书 */}
      {shelves.map((sh, i) => {
        let offset = -0.42;
        return (
          <group key={i} position={[sh.x, sh.y, 0.05]}>
            {sh.books.map((b, j) => {
              const x = offset + b.w / 2;
              offset += b.w;
              return (
                <mesh key={j} position={[x, 0.18, 0]}>
                  <boxGeometry args={[b.w, 0.38, 0.08]} />
                  <meshStandardMaterial color={b.c} roughness={0.6} />
                </mesh>
              );
            })}
          </group>
        );
      })}
      {/* 顶部 2 个暖黄吊灯（emissive 球）*/}
      <mesh position={[-1.6, 2.9, 0.4]}>
        <sphereGeometry args={[0.16, 16, 12]} />
        <meshStandardMaterial color="#fef3c7" emissive="#fbbf24" emissiveIntensity={1.6} />
      </mesh>
      <mesh position={[1.6, 2.9, 0.4]}>
        <sphereGeometry args={[0.16, 16, 12]} />
        <meshStandardMaterial color="#fef3c7" emissive="#fbbf24" emissiveIntensity={1.6} />
      </mesh>
    </group>
  );
}

/** 魔法塔：拱形彩窗 + 飘浮 runes */
function MagicTowerBackdrop() {
  const runesRef = useRef<Group>(null);
  const runes = useMemo(
    () => Array.from({ length: 10 }, () => ({
      x: -2.5 + Math.random() * 5,
      y: 0.3 + Math.random() * 2.5,
      z: -1 - Math.random() * 0.5,
      symbol: ["✦", "✧", "⌬", "✶", "✸"][Math.floor(Math.random() * 5)]!,
      speed: 0.3 + Math.random() * 0.4,
      phase: Math.random() * Math.PI * 2,
    })),
    [],
  );
  useFrame((state) => {
    if (!runesRef.current) return;
    const t = state.clock.getElapsedTime();
    runesRef.current.children.forEach((c, i) => {
      const r = runes[i];
      if (!r) return;
      c.position.y = r.y + Math.sin(t * r.speed + r.phase) * 0.2;
      c.rotation.z = Math.sin(t * 0.4 + r.phase) * 0.4;
    });
  });
  return (
    <group position={[0, 0, -2.4]}>
      {/* 深紫墙 */}
      <mesh position={[0, 1.2, -0.2]}>
        <planeGeometry args={[14, 6]} />
        <meshStandardMaterial color="#1e1b4b" roughness={0.9} />
      </mesh>
      {/* 中央拱形彩窗（用扁圆 + 长方形堆出哥特拱）*/}
      <mesh position={[0, 1.8, 0]}>
        <circleGeometry args={[0.85, 32, 0, Math.PI]} />
        <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <planeGeometry args={[1.7, 1.7]} />
        <meshStandardMaterial color="#7c3aed" emissive="#7c3aed" emissiveIntensity={0.5} roughness={0.4} />
      </mesh>
      {/* 拱窗内分隔线（铅条样式） */}
      <mesh position={[0, 1.2, 0.01]}>
        <planeGeometry args={[0.04, 2.6]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[-0.4, 1.2, 0.01]}>
        <planeGeometry args={[0.025, 2.6]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      <mesh position={[0.4, 1.2, 0.01]}>
        <planeGeometry args={[0.025, 2.6]} />
        <meshStandardMaterial color="#0f172a" />
      </mesh>
      {/* 两侧立柱 */}
      <mesh position={[-1.4, 1.2, 0]}>
        <boxGeometry args={[0.18, 2.6, 0.18]} />
        <meshStandardMaterial color="#312e81" roughness={0.7} />
      </mesh>
      <mesh position={[1.4, 1.2, 0]}>
        <boxGeometry args={[0.18, 2.6, 0.18]} />
        <meshStandardMaterial color="#312e81" roughness={0.7} />
      </mesh>
      {/* 飘浮的金色 runes 符号（用小圆盘 + 不同颜色代替文本，更稳定）*/}
      <group ref={runesRef}>
        {runes.map((r, i) => (
          <mesh key={i} position={[r.x, r.y, r.z]}>
            <torusGeometry args={[0.05, 0.012, 6, 16]} />
            <meshStandardMaterial
              color="#fde047"
              emissive="#fde047"
              emissiveIntensity={1.8}
              roughness={0.4}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** 星空：星星 + 星云 + 远方螺旋 */
function CosmosBackdrop() {
  const starsRef = useRef<Group>(null);
  const stars = useMemo(
    () => Array.from({ length: 80 }, () => ({
      x: -6 + Math.random() * 12,
      y: -2 + Math.random() * 7,
      z: -3 - Math.random() * 4,
      size: 0.012 + Math.random() * 0.025,
      color: Math.random() > 0.7 ? "#fde68a" : Math.random() > 0.5 ? "#bae6fd" : "#ffffff",
      blink: Math.random() * Math.PI * 2,
    })),
    [],
  );
  useFrame((state) => {
    if (!starsRef.current) return;
    const t = state.clock.getElapsedTime();
    starsRef.current.children.forEach((c, i) => {
      const s = stars[i];
      if (!s) return;
      const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 1.5 + Math.sin(t * 2 + s.blink) * 0.9;
    });
  });
  return (
    <group position={[0, 0, -2.5]}>
      {/* 深蓝紫墙 */}
      <mesh position={[0, 1, -0.5]}>
        <planeGeometry args={[16, 8]} />
        <meshStandardMaterial color="#0c0a1e" />
      </mesh>
      {/* 中心星云（用 3 层不同透明度的 plane 模拟）*/}
      <mesh position={[0.5, 1.5, -0.4]}>
        <circleGeometry args={[1.8, 32]} />
        <meshBasicMaterial color="#7c3aed" transparent opacity={0.18} />
      </mesh>
      <mesh position={[-0.3, 1.0, -0.3]}>
        <circleGeometry args={[1.4, 32]} />
        <meshBasicMaterial color="#ec4899" transparent opacity={0.12} />
      </mesh>
      <mesh position={[1.0, 0.7, -0.2]}>
        <circleGeometry args={[1.0, 32]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.15} />
      </mesh>
      {/* 80 颗星星 */}
      <group ref={starsRef}>
        {stars.map((s, i) => (
          <mesh key={i} position={[s.x, s.y, s.z]}>
            <sphereGeometry args={[s.size, 8, 6]} />
            <meshStandardMaterial
              color={s.color}
              emissive={s.color}
              emissiveIntensity={1.5}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function VRMScene({ url, outfitUrl, audioLevel, skin, spin, gesture, emotion, view }: VRMSceneProps) {
  void view;
  const rootRef = useRef<Group>(null);
  const [vrm, setVrm] = useState<VRM | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const blinkRef = useRef({ phase: 0, next: 3 + Math.random() * 2 });
  const gestureRef = useRef<{ kind: MascotGesture; start: number }>({ kind: "idle", start: 0 });
  // 当前移植上的衣服 clone 引用（用于切换时清理 + 每帧同步骨架）
  const graftedRef = useRef<{
    url: string;
    root: THREE.Object3D;
    bonePairs: { from: THREE.Object3D; to: THREE.Object3D }[];
  } | null>(null);

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
        VRMUtils.removeUnnecessaryVertices(loaded.scene);
        VRMUtils.combineSkeletons(loaded.scene);
        VRMUtils.rotateVRM0(loaded);
        loaded.scene.traverse((obj: Object3D) => {
          obj.frustumCulled = false;
        });
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

  // === Outfit 移植：从 donor VRM 提取 CLOTH primitives，绑定到 Xiaojin 骨架 ===
  useEffect(() => {
    if (!vrm) return;
    // 先还原：把之前移植的 cloth + secondaries 移除 + 把 Xiaojin 自己的 CLOTH primitives 显示出来
    if (graftedRef.current) {
      const rt = graftedRef.current.root as THREE.Group;
      const secs = (rt.userData?.ownedSecondaryBones ?? []) as THREE.Bone[];
      for (const b of secs) b.removeFromParent();
      rt.removeFromParent();
      graftedRef.current = null;
    }
    setVRMOutfitVisibility(vrm, true);

    if (!outfitUrl) return;

    let cancelled = false;
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));
    loader.load(
      outfitUrl,
      (gltf) => {
        if (cancelled) return;
        const donor: VRM = gltf.userData.vrm;
        VRMUtils.removeUnnecessaryVertices(donor.scene);
        VRMUtils.combineSkeletons(donor.scene);
        VRMUtils.rotateVRM0(donor);
        try {
          const grafted = graftClothing(donor, vrm);
          setVRMOutfitVisibility(vrm, false);
          graftedRef.current = { url: outfitUrl, ...grafted };
          console.log("[outfit] grafted from " + outfitUrl + ", bonePairs=" + grafted.bonePairs.length);
        } catch (e) {
          console.warn("[outfit] graft failed:", e);
        }
      },
      undefined,
      (err) => {
        if (cancelled) return;
        console.warn("[outfit] donor VRM load failed:", err);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [vrm, outfitUrl]);

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

    // gesture 状态追踪（外部 prop 切换时重置计时）
    if (gestureRef.current.kind !== gesture) {
      gestureRef.current = { kind: gesture, start: t };
    }
    const gElapsed = t - gestureRef.current.start;
    // 每个 gesture 的总时长可以不同：挥手要更长才有真人感，跳舞 loop 多
    const GESTURE_DUR =
      gesture === "wave"
        ? 3.6
        : gesture === "cheer"
          ? 2.8
          : gesture === "dance"
            ? 4.5 // 跳舞要够长，让人感受 1-2 个完整动作 loop
            : gesture === "clap"
              ? 2.6
              : 2.4;
    // 在 prop 还是非 idle 时持续保持 gesture（test page 的 setTimeout 会回 idle）
    // gElapsed 仅用作 easeIn/easeOut 包络
    const isGesturing = gesture !== "idle";

    // 说话时手部 micro-gesture（gesture==idle 才生效；gesture 时让位）
    const speakAmp = isGesturing ? 0 : Math.min(1, audioLevel * 3.5);
    const rUpper = vrm.humanoid?.getNormalizedBoneNode("rightUpperArm");
    const rLower = vrm.humanoid?.getNormalizedBoneNode("rightLowerArm");
    const lUpper = vrm.humanoid?.getNormalizedBoneNode("leftUpperArm");
    const lLower = vrm.humanoid?.getNormalizedBoneNode("leftLowerArm");

    if (rUpper) {
      const base = THREE.MathUtils.degToRad(-72);
      const lift = THREE.MathUtils.degToRad(32) * speakAmp;
      const sway = Math.sin(t * 2.2) * 0.06 * speakAmp;
      rUpper.rotation.z = base + lift + sway;
      rUpper.rotation.x = THREE.MathUtils.degToRad(-22) * speakAmp + Math.sin(t * 1.8) * 0.05 * speakAmp;
      rUpper.rotation.y = THREE.MathUtils.degToRad(15) * speakAmp;
    }
    if (rLower) {
      rLower.rotation.y = THREE.MathUtils.degToRad(10) + THREE.MathUtils.degToRad(-70) * speakAmp;
      rLower.rotation.x = Math.sin(t * 2.4) * 0.08 * speakAmp;
    }
    if (lUpper) {
      const base = THREE.MathUtils.degToRad(72);
      const sway = Math.sin(t * 1.1 + 0.7) * 0.025;
      lUpper.rotation.z = base + sway;
    }
    // 每帧重置手指（让前一个 gesture 的弯曲恢复成正常张开）
    curlFingers(vrm, "right", 0);
    curlFingers(vrm, "left", 0);
    // 每帧重置手腕（避免 wave 手腕残留摆动到 idle）
    const lHandReset = vrm.humanoid?.getNormalizedBoneNode("leftHand");
    const rHandReset = vrm.humanoid?.getNormalizedBoneNode("rightHand");
    if (lHandReset) {
      lHandReset.rotation.x = 0;
      lHandReset.rotation.y = 0;
      lHandReset.rotation.z = 0;
    }
    if (rHandReset) {
      rHandReset.rotation.x = 0;
      rHandReset.rotation.y = 0;
      rHandReset.rotation.z = 0;
    }
    // 每帧重置前臂的非 base 轴（避免上一 gesture 的 x/z 残留）
    if (lLower) {
      lLower.rotation.x = 0;
      lLower.rotation.z = 0;
    }
    if (rLower) {
      rLower.rotation.x = 0;
      rLower.rotation.z = 0;
    }

    // === Gesture overlay ===
    const deg = THREE.MathUtils.degToRad;
    if (isGesturing) {
      // 自然缓动公式：smoothstep (S-curve) 让 pose 不"突然到位"，更像真人肌肉发力曲线
      // 进入阶段 0→1（约 350ms），退出阶段 1→0（约 400ms）
      const smoothstep = (x: number) => {
        const c = Math.max(0, Math.min(1, x));
        return c * c * (3 - 2 * c);
      };
      // 挥手 / 欢呼这种"大幅胳膊抡起来"的动作 fade 更长，看起来才不像 pop-in
      const FADE_IN = gesture === "wave" ? 0.7 : gesture === "cheer" ? 0.55 : 0.4;
      const FADE_OUT = gesture === "wave" ? 0.7 : gesture === "cheer" ? 0.55 : 0.45;
      const rawIn = gElapsed / FADE_IN;
      const rawOut = (GESTURE_DUR - gElapsed) / FADE_OUT;
      // 增加微小 anticipation（前 100ms 反向 -0.08），让 pose 起手有真人"先弹再发力"感
      const antic = gElapsed < 0.12 ? -0.08 * (1 - gElapsed / 0.12) : 0;
      const w = Math.max(0, smoothstep(rawIn) * Math.max(0, Math.min(1, rawOut)) + antic);
      // 肩-肘 phase offset：肩先抬，肘随后弯（更接近真人胳膊抬起的肌肉发力顺序）
      // 用一个独立的、延迟 0.15s 的 weight 给肘部 / 前臂使用
      const wElbow = (() => {
        const elapsedDelayed = gElapsed - 0.15;
        if (elapsedDelayed <= 0) return 0;
        const rawInE = elapsedDelayed / FADE_IN;
        return Math.max(0, smoothstep(rawInE) * Math.max(0, Math.min(1, rawOut)));
      })();

      // 持续动作时钟（活跃期 oscillation 用，从 anticipation 结束开始计时避免起手不和谐）
      const tActive = Math.max(0, gElapsed - 0.2);

      // 拿身体核心骨头（gesture 都要给点身体协同，光胳膊动太机械）
      const chestBone = vrm.humanoid?.getNormalizedBoneNode("chest");
      const upperChestBone = vrm.humanoid?.getNormalizedBoneNode("upperChest");
      const neck = vrm.humanoid?.getNormalizedBoneNode("neck");

      // VRM bone direction reminder：
      // - leftUpperArm:  z=0 ≈ T-pose 横举, z=+72° = 自然下垂, z=-60° = 上举到斜上方
      // - rightUpperArm: z=0 ≈ T-pose 横举, z=-72° = 自然下垂, z=+60° = 上举到斜上方
      switch (gesture) {
        case "wave": {
          // 真人友好挥手节奏：
          //  - 0.0-0.7s: 肩先开始抬（用主 w），上臂往斜上 56° 抬
          //  - 0.15s 之后肘部跟上（wElbow 延迟）开始弯
          //  - 0.55s 之后前臂水平面摆动启动（手抬到位才扇）
          //  - 2.9-3.6s: 反向 fade out 收回
          if (lUpper) {
            lUpper.rotation.z = deg(72) + w * deg(-128); // 72° → -56°（约 56° 抬过肩）
            lUpper.rotation.x = deg(-15) * w;
            lUpper.rotation.y = deg(-8) * w;
          }
          if (lLower) {
            // 肘部用延迟 0.15s 的 wElbow（肩肘 phase offset）
            lLower.rotation.x = deg(-85) * wElbow;
            lLower.rotation.z = 0;
            // 摆动只在手抬到位后启动，幅度 ramp in
            const swingPhase = Math.max(0, gElapsed - 0.55);
            const swingAmp = 0.75 * smoothstep(Math.min(1, swingPhase / 0.4));
            lLower.rotation.y = Math.sin(swingPhase * 5.5) * swingAmp * w;
          }
          const lHand = vrm.humanoid?.getNormalizedBoneNode("leftHand");
          if (lHand) {
            const swingPhase = Math.max(0, gElapsed - 0.55);
            const swingAmp = 0.32 * smoothstep(Math.min(1, swingPhase / 0.4));
            lHand.rotation.y = Math.sin(swingPhase * 5.5 + 0.2) * swingAmp * w;
          }
          if (head) {
            head.rotation.z = deg(8) * w;
            head.rotation.x = deg(-4) * w;
          }
          if (chestBone) chestBone.rotation.z = deg(-3) * w;
          if (upperChestBone) upperChestBone.rotation.z = deg(-2) * w;
          break;
        }
        case "nod": {
          // 真人点头：头部 + 颈部 + 上胸节奏配合，幅度递减（头最多，胸最少）
          const phase = Math.sin(tActive * 5.5);
          if (head) head.rotation.x = phase * 0.32 * w;
          if (neck) neck.rotation.x = phase * 0.12 * w;
          if (upperChestBone) upperChestBone.rotation.x = phase * 0.05 * w;
          break;
        }
        case "shake": {
          // 摇头：头、颈联动，节奏比 nod 快一点（不耐烦感）
          const phase = Math.sin(tActive * 7);
          if (head) head.rotation.y = phase * 0.4 * w;
          if (neck) neck.rotation.y = phase * 0.15 * w;
          // 肩膀微微反向（更生动）
          if (upperChestBone) upperChestBone.rotation.y = -phase * 0.04 * w;
          break;
        }
        case "point": {
          // 自然指向：肩抬到接近水平 + 中等前推；躯干 + 头一起向同侧轻微转，
          // 真人指题目时身体会"参与"，不是单胳膊孤立动作
          if (rUpper) {
            rUpper.rotation.z = deg(-72) + w * deg(75); // -72° → +3°
            rUpper.rotation.x = deg(-65) * w;
            rUpper.rotation.y = deg(5) * w;
          }
          if (rLower) {
            rLower.rotation.y = deg(-15) * w;
            rLower.rotation.z = 0;
            rLower.rotation.x = 0;
          }
          // 头微微看向指向方向（右侧），躯干微转
          if (head) {
            head.rotation.y = deg(-6) * w;
            head.rotation.x = deg(-3) * w;
          }
          if (upperChestBone) upperChestBone.rotation.y = deg(-5) * w;
          if (chestBone) chestBone.rotation.y = deg(-3) * w;
          break;
        }
        case "thumbsUp": {
          // 棒棒：上臂横举 + 肘弯 → 拳头脸颊侧 + **拇指必须朝上**
          // 拇指方向通过 forearm 长轴 twist (.y) + 手腕翻转控制
          if (rUpper) {
            rUpper.rotation.z = deg(-72) + w * deg(60); // -72° → -12°
            rUpper.rotation.x = deg(-30) * w;
            rUpper.rotation.y = 0;
          }
          if (rLower) {
            rLower.rotation.z = deg(95) * w;
            rLower.rotation.x = 0;
            rLower.rotation.y = 0;
          }
          // 手腕沿自身长轴翻 180° (supination) → 把手心翻向胸前，拇指自然朝上
          const rHand = vrm.humanoid?.getNormalizedBoneNode("rightHand");
          if (rHand) {
            rHand.rotation.x = 0;
            rHand.rotation.y = deg(180) * w;
            rHand.rotation.z = 0;
          }
          curlFingers(vrm, "right", w);
          if (chestBone) chestBone.rotation.x = deg(-4) * w;
          if (head) head.rotation.z = deg(-5) * w;
          break;
        }
        case "cheer": {
          // 欢呼：Y 字双臂 + 持续上下 bounce + 头微仰看天 + 胸打开（兴奋感）
          if (rUpper) {
            rUpper.rotation.z = deg(-72) + w * deg(115);
            rUpper.rotation.x = deg(-18) * w;
            rUpper.rotation.y = 0;
          }
          if (lUpper) {
            lUpper.rotation.z = deg(72) + w * deg(-115);
            lUpper.rotation.x = deg(-18) * w;
            lUpper.rotation.y = 0;
          }
          if (rLower) rLower.rotation.y = deg(10) + deg(-20) * w;
          if (lLower) lLower.rotation.y = deg(-10) + deg(20) * w;
          // bounce: 真人欢呼时上下跳动，节奏 ~3Hz，前期幅度小后期大
          const bounceAmp = 0.045 * smoothstep(Math.min(1, tActive / 0.25));
          if (rootRef.current) {
            rootRef.current.position.y += Math.abs(Math.sin(tActive * 6)) * bounceAmp * w;
          }
          break;
        }
        case "clap": {
          // v0.31.112：拍手 — 双臂胸前合击 + 大幅开合让动作 visible
          const beat = Math.sin(tActive * 8); // 8Hz 拍手 (快节奏)
          if (rUpper) {
            // 上臂抬到水平 + 朝胸前推
            rUpper.rotation.z = deg(-72) + w * deg(60);
            rUpper.rotation.x = deg(-80) * w; // 大幅前推 (-80° = 几乎水平)
            rUpper.rotation.y = deg(25) * w; // 内 twist 让前臂朝中线
          }
          if (lUpper) {
            lUpper.rotation.z = deg(72) + w * deg(-60);
            lUpper.rotation.x = deg(-80) * w;
            lUpper.rotation.y = deg(-25) * w;
          }
          // 前臂大幅弯肘 + 节奏开合 (幅度加 2x)
          if (rLower) {
            rLower.rotation.y = deg(85) * w + beat * 0.4 * w;
            rLower.rotation.x = 0;
            rLower.rotation.z = 0;
          }
          if (lLower) {
            lLower.rotation.y = deg(-85) * w - beat * 0.4 * w;
            lLower.rotation.x = 0;
            lLower.rotation.z = 0;
          }
          // 头跟节奏点头 + bounce 加大
          if (head) head.rotation.x = beat * 0.08 * w;
          if (chestBone) chestBone.rotation.x = deg(-5) * w;
          if (rootRef.current) {
            rootRef.current.position.y +=
              Math.abs(Math.sin(tActive * 8)) * 0.025 * w;
          }
          break;
        }
        case "dance": {
          // v0.31.112：跳舞 — 加大幅度 (visual impact)
          // 节奏 4.5 Hz，让 4.5s 内有充足循环 + 大幅扭/挥
          const beat = tActive * 4.5;
          // Hips Y 扭（左右）— 大幅扭 0.45 rad (~26°)
          if (hips) {
            hips.rotation.y = Math.sin(beat) * 0.45 * w;
          }
          // chest 反向扭 + 侧倾，"扭"出节奏感
          if (chestBone) {
            chestBone.rotation.y = -Math.sin(beat) * 0.32 * w;
            chestBone.rotation.z = Math.sin(beat * 0.5) * 0.18 * w;
          }
          if (upperChestBone) {
            upperChestBone.rotation.y = -Math.sin(beat) * 0.15 * w;
            upperChestBone.rotation.z = Math.sin(beat * 0.5) * 0.08 * w;
          }
          // 头跟节奏大幅侧摆 + 上下点
          if (head) {
            head.rotation.y = Math.cos(beat) * 0.3 * w;
            head.rotation.x = Math.sin(beat * 2) * 0.12 * w;
            head.rotation.z = Math.sin(beat * 0.7) * 0.08 * w;
          }
          // 双臂左右大幅挥（disco hand-up），左右反相
          if (rUpper) {
            // -72 是自然下垂；+ 70° 让臂抬到斜上 + 60° 摆动幅度
            rUpper.rotation.z =
              deg(-72) + w * (deg(70) + Math.sin(beat + 0.6) * deg(55));
            rUpper.rotation.x = deg(-30) * w;
          }
          if (lUpper) {
            lUpper.rotation.z =
              deg(72) + w * (deg(-70) + Math.sin(beat - 0.6) * deg(-55));
            lUpper.rotation.x = deg(-30) * w;
          }
          // 前臂略弯 + 跟节奏
          if (rLower) {
            rLower.rotation.y =
              deg(-40) * w + Math.sin(beat) * 0.3 * w;
            rLower.rotation.x = 0;
          }
          if (lLower) {
            lLower.rotation.y =
              deg(40) * w + Math.sin(beat + Math.PI) * 0.3 * w;
            lLower.rotation.x = 0;
          }
          // bounce: 跟节奏明显跳动 (0.08 vs 0.04)
          if (rootRef.current) {
            rootRef.current.position.y +=
              Math.abs(Math.sin(beat)) * 0.08 * w;
          }
          break;
        }
        default:
          break;
      }
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

      // === 表情系统 ===
      // 把所有非视位表情先归零；再按 emotion 设值
      const allExpressions = ["happy", "angry", "sad", "surprised", "relaxed", "neutral"];
      const targetMap: Record<string, number> = {};
      // 基础：idle 0.45 微笑 + 说话再加 0.3
      const baseHappy = 0.45 + rawAmp * 0.3;
      // 手势"情绪助攻"：wave/thumbsUp/cheer 三个开心向手势会自动加 happy，让表情和动作一致
      const gestureHappyBoost =
        gesture === "cheer"
          ? 0.5
          : gesture === "dance"
            ? 0.45
            : gesture === "thumbsUp"
              ? 0.35
              : gesture === "clap"
                ? 0.3
                : gesture === "wave"
                  ? 0.25
                  : 0;
      switch (emotion) {
        case "happy":
          targetMap.happy = 0.95;
          break;
        case "sad":
          targetMap.sad = 0.85;
          targetMap.happy = 0;
          break;
        case "surprised":
          targetMap.surprised = 0.85;
          targetMap.happy = 0.2;
          break;
        case "confused":
          targetMap.sad = 0.35;
          targetMap.happy = 0.2;
          // 头微倾
          if (head) head.rotation.z += 0.15;
          break;
        case "angry":
          targetMap.angry = 0.85;
          targetMap.happy = 0;
          break;
        case "neutral":
        default:
          targetMap.happy = baseHappy;
          break;
      }
      // 手势 happy boost 叠加（不替换 emotion 主基调，只是加点亮度）
      if (gestureHappyBoost > 0) {
        targetMap.happy = Math.min(0.98, (targetMap.happy ?? 0) + gestureHappyBoost);
      }
      // 平滑过渡到 target
      for (const exp of allExpressions) {
        const cur = em.getValue(exp) ?? 0;
        const tgt = targetMap[exp] ?? 0;
        em.setValue(exp, cur + (tgt - cur) * 0.18);
      }

      em.update();
    }

    vrm.update(delta);

    // === Outfit：新方案下 cloth.skeleton.bones 直接引用 target 的真骨头，
    // target.humanoid 动 → 骨头动 → cloth 自动跟随，**不需要 per-frame sync**。===
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
      {/* v0.31.111：AI 副手——真正的红熊猫 OBJ 模型（Tripo3D 8 part）。
          Suspense 包裹避免 OBJ 加载时 Canvas 黑屏；fallback 用 procedural 占位
          (Loading 期间显示几何拼的红熊猫继续工作)。 */}
      <Suspense fallback={<SidekickPlaceholder gesture={gesture} emotion={emotion} />}>
        <RedPandaSidekick gesture={gesture} emotion={emotion} />
      </Suspense>
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

/**
 * 判断一个材质名是否属于"换装目标"（衣服 + 身体皮肤），不包含脸 / 头发。
 * kuroro 系列 VRoid 命名规律：
 *   N00_..._Tops/Bottoms/Onepiece/Shoes/Accessory_..._CLOTH
 *   N00_..._Body_00_SKIN   ← 身体皮肤，需要一起换（donor 的 body 才有匹配衣服剪裁的胳膊/腿/腹）
 *   N00_..._Face_00_SKIN   ← 脸皮肤，**保留 target 的**
 *   N00_..._Hair / HairBack ← 头发，保留 target
 */
function isOutfitMaterialName(name: string | undefined | null): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  // 头发不要
  if (lower.includes("hair")) return false;
  // 脸不要（Face_SKIN / FaceMouth / FaceBrow / FaceEyeline / Eye*）
  if (lower.includes("face") || lower.includes("eye")) return false;
  // body skin 要（donor body 才有匹配 outfit 的剪裁）
  if (lower.includes("body") && lower.includes("skin")) return true;
  // 衣服 / 鞋 / 配饰
  return (
    lower.includes("tops") ||
    lower.includes("bottoms") ||
    lower.includes("onepiece") ||
    lower.includes("shoes") ||
    lower.includes("accessory")
  );
}

/** 切换 VRM scene 里所有 cloth primitives 的 visible（true=显示原 outfit / false=隐藏让位给移植 outfit）。
 * 跳过 userData.grafted 标记的 mesh —— 那些是从其他 VRM 移植过来的衣服，不能跟着 target 一起被隐藏。 */
function setVRMOutfitVisibility(vrm: VRM, visible: boolean) {
  vrm.scene.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    if (obj.userData?.grafted) return; // 别动移植上来的 cloth
    const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    if (mats.some((m) => isOutfitMaterialName(m.name))) {
      mesh.visible = visible;
    }
  });
}

/**
 * 把 donor VRM 的 CLOTH SkinnedMesh primitives 移植到 target VRM。
 *
 * 真正的"换衣"逻辑（不是 clone donor scene + 每帧抄 quaternion）：
 * 1. 取 donor 的 cloth SkinnedMesh + 它的 skeleton.bones 名字列表
 * 2. 对每个 cloth 引用的 bone：在 target 找同名 bone（找到就复用 target 的真骨头），
 *    找不到的（donor 独有的 SkirtSide / 额外 Hair 等）就**把 donor 那根 bone 直接克隆**到
 *    target 对应父骨头下（这样 cloth 既跟着 target humanoid 动，又保留 donor 的次级骨架）
 * 3. 给 cloth 构造一个新的 Skeleton，bones 来自上面查出来的 target/cloned-secondary 混合列表，
 *    boneInverses 沿用 donor 原值（同 VRoid template 下 bind pose 等价 → 直接复用）
 * 4. cloth.bind(newSkeleton, donor 原 bindMatrix)
 * 5. 把 cloth mesh（不是整个 donor scene）reparent 到 target.scene 下
 *
 * 这样每帧 target.humanoid 动 → target bones 动 → cloth.skeleton 内的 target bones 就动了
 * → cloth.skinning 自动跟随，**不需要任何手动 per-frame sync**。
 *
 * 返回 { roots, ownedSecondaryBones }：
 *   - roots：移植进来的 cloth mesh 列表（切换时 remove from parent + dispose geometry/material）
 *   - ownedSecondaryBones：移植进来的次级骨头（切换时也要 remove）
 */
function graftClothing(
  donor: VRM,
  target: VRM,
): { root: THREE.Object3D; bonePairs: { from: THREE.Object3D; to: THREE.Object3D }[] } {
  // === 收集 donor 的 CLOTH SkinnedMesh 原型 ===
  const clothPrototypes: THREE.SkinnedMesh[] = [];
  donor.scene.traverse((obj) => {
    const m = obj as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    if (mats.some((mt) => isOutfitMaterialName(mt.name))) {
      clothPrototypes.push(m);
    }
  });

  // === 找 target 自己的 Body_SKIN 材质（用来给 grafted 身体皮肤换上 Xiaojin 的肤色）===
  // 跨 VRM 各自的 body skin 材质颜色略有差异。注意：**不能整套替换**，否则 Xiaojin 校服遮盖
  // 区域（肩到腕）在材质里是 alpha=0 透明，应用到 donor 全裸胳膊几何 → 胳膊消失。
  // 正确做法：clone donor 材质，只把 diffuse color 复制成 Xiaojin 的，texture / alpha 保留 donor 的。
  let targetSkinColors: THREE.Color[] = [];
  target.scene.traverse((obj) => {
    if (targetSkinColors.length > 0) return;
    const m = obj as THREE.SkinnedMesh;
    if (!m.isSkinnedMesh) return;
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    const hasBodySkin = mats.some((mt) => {
      const n = (mt.name || "").toLowerCase();
      return n.includes("body") && n.includes("skin");
    });
    if (hasBodySkin) {
      targetSkinColors = mats.map((mt) => {
        const c = (mt as unknown as { color?: THREE.Color }).color;
        return c ? c.clone() : new THREE.Color(1, 1, 1);
      });
    }
  });

  /** Clone donor's material array, override .color with target's skin color (保留 texture/alpha) */
  function tintToTargetSkin(donorMat: THREE.Material | THREE.Material[]): THREE.Material | THREE.Material[] {
    if (targetSkinColors.length === 0) return donorMat;
    const tintOne = (m: THREE.Material, idx: number): THREE.Material => {
      const cloned = m.clone();
      const tc = targetSkinColors[Math.min(idx, targetSkinColors.length - 1)];
      const cur = (cloned as unknown as { color?: THREE.Color }).color;
      if (cur && tc) cur.copy(tc);
      return cloned;
    };
    if (Array.isArray(donorMat)) return donorMat.map(tintOne);
    return tintOne(donorMat, 0);
  }

  // === 建立 target 的 bone-by-name 表 ===
  const targetByName = new Map<string, THREE.Object3D>();
  target.scene.traverse((o) => {
    if (o.name) targetByName.set(o.name, o);
  });

  // === 解析 donor cloth 引用的每根 bone：
  //   - target 有同名 → 直接用 target 的真骨头（cloth 自动跟随 target humanoid 动）
  //   - donor 独有（裙骨 / extra hair / ...）→ 把 donor 那根骨头本地 transform 克隆，挂到
  //     target 上对应父骨头下（保留 donor 次级骨架）
  const resolvedBones = new Map<string, THREE.Bone>();
  const ownedSecondaryBones: THREE.Bone[] = []; // 用于切换时清理

  function resolveBone(donorBone: THREE.Bone): THREE.Bone {
    const name = donorBone.name;
    const cached = resolvedBones.get(name);
    if (cached) return cached;
    // 1. target 有同名（即使不是 Bone instance 也能用作 transform 父级）
    const tgt = targetByName.get(name);
    if (tgt) {
      // 把 Object3D 当作 Bone 用（three.js skinning 不严格 check isBone）
      resolvedBones.set(name, tgt as THREE.Bone);
      return tgt as THREE.Bone;
    }
    // 2. donor 独有 → 复制 transform + parent 链
    const cloned = new THREE.Bone();
    cloned.name = name;
    cloned.position.copy(donorBone.position);
    cloned.quaternion.copy(donorBone.quaternion);
    cloned.scale.copy(donorBone.scale);
    resolvedBones.set(name, cloned);
    ownedSecondaryBones.push(cloned);
    // 找父亲：donor 那根骨头的 parent 在 target 里对应的节点
    const donorParent = donorBone.parent;
    if (donorParent && (donorParent as THREE.Bone).isBone) {
      const resolvedParent = resolveBone(donorParent as THREE.Bone);
      resolvedParent.add(cloned);
    } else {
      // 没父亲（或父亲不是 bone）→ 挂在 target.scene 根上（不会有用，但不至于崩）
      target.scene.add(cloned);
    }
    return cloned;
  }

  // 预解析所有 cloth 引用的骨头，建好骨架树
  for (const cloth of clothPrototypes) {
    for (const b of cloth.skeleton.bones) {
      resolveBone(b);
    }
  }

  // 找到 target 自己的第一个 SkinnedMesh，把 cloth 放在它的相同父级下。
  // 原因：three.js skinning 假设 SkinnedMesh.matrixWorld 与 bones 的 world frame 一致，
  // 而 GLTF VRM 通常把 SkinnedMesh 放在 scene 内某层 group 下，不一定是 scene root。
  let targetMeshParent: THREE.Object3D = target.scene;
  target.scene.traverse((obj) => {
    if (targetMeshParent !== target.scene) return;
    const m = obj as THREE.SkinnedMesh;
    if (m.isSkinnedMesh && m.parent) {
      targetMeshParent = m.parent;
    }
  });

  // === 为每个 cloth 重建 SkinnedMesh：复用 geometry+material，但 skeleton 指向 target/合并骨架 ===
  const graftedRoot = new THREE.Group();
  graftedRoot.name = "grafted_outfit";
  graftedRoot.userData.grafted = true;
  for (const proto of clothPrototypes) {
    const newBones = proto.skeleton.bones.map((b) => resolvedBones.get(b.name)!);
    const newInverses = proto.skeleton.boneInverses.map((m) => m.clone());
    const newSkeleton = new THREE.Skeleton(newBones, newInverses);

    // 判断这个 cloth 是否是 body skin —— 是的话 clone donor 材质并把 color 复制成 Xiaojin 的，
    // 这样肤色统一但保留 donor 的 texture/alpha（胳膊/腿等区域不会因为 Xiaojin 校服遮盖产生 alpha=0 → 消失）
    const protoMats = Array.isArray(proto.material) ? proto.material : proto.material ? [proto.material] : [];
    const isBodySkin = protoMats.some((mt) => {
      const n = (mt.name || "").toLowerCase();
      return n.includes("body") && n.includes("skin");
    });
    const materialToUse = isBodySkin ? tintToTargetSkin(proto.material) : proto.material;

    const cloth = new THREE.SkinnedMesh(proto.geometry, materialToUse);
    cloth.name = proto.name + "_grafted";
    cloth.frustumCulled = false;
    cloth.userData.grafted = true; // setVRMOutfitVisibility 据此跳过
    cloth.bind(newSkeleton, proto.bindMatrix.clone());
    graftedRoot.add(cloth);
  }
  targetMeshParent.add(graftedRoot);

  // 把 secondary bones 也放到一个 cleanup 集合上挂在 graftedRoot 的 userData
  (graftedRoot.userData as Record<string, unknown>).ownedSecondaryBones = ownedSecondaryBones;

  return { root: graftedRoot, bonePairs: [] };
}

/** 把指头按 amount (0-1) 弯曲成拳，拇指保持伸直 */
function curlFingers(vrm: VRM, side: "left" | "right", amount: number) {
  const h = vrm.humanoid;
  if (!h) return;
  const deg = THREE.MathUtils.degToRad;
  // VRM 标准手指 humanoid 名：
  // <side>Index/Middle/Ring/Little 各 Proximal / Intermediate / Distal 3 节
  const fingers = ["Index", "Middle", "Ring", "Little"] as const;
  const segs = ["Proximal", "Intermediate", "Distal"] as const;
  // 每节弯曲约 60-80°（拳头形状）。VRM 手指弯曲围绕 Z 轴，
  // 左手 +Z 弯（手心朝向 -X），右手 -Z 弯（手心朝向 +X）
  const sign = side === "left" ? 1 : -1;
  for (const f of fingers) {
    for (const s of segs) {
      const boneName = `${side}${f}${s}` as Parameters<typeof h.getNormalizedBoneNode>[0];
      const bone = h.getNormalizedBoneNode(boneName);
      if (bone) bone.rotation.z = sign * deg(70) * amount;
    }
  }
  // 拇指：往外/上张开一点（保持竖直）
  const thumbProx = h.getNormalizedBoneNode(`${side}ThumbMetacarpal`);
  if (thumbProx) {
    thumbProx.rotation.z = -sign * deg(10) * amount;
    thumbProx.rotation.y = sign * deg(15) * amount;
  }
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

/** AI 副手"小番" —— procedural 红熊猫，chibi 比例（大头小身） */
function SidekickPlaceholder({ gesture, emotion }: { gesture: MascotGesture; emotion: MascotEmotion }) {
  const groupRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const tailRef = useRef<Group>(null);
  const lEarRef = useRef<THREE.Mesh>(null);
  const rEarRef = useRef<THREE.Mesh>(null);
  const reactionRef = useRef<{ kind: MascotGesture; start: number }>({ kind: "idle", start: 0 });

  useFrame((state) => {
    if (!groupRef.current || !headRef.current) return;
    const t = state.clock.getElapsedTime();
    // 漂在右肩前侧，scale 0.32 "手心大小"小宠物
    let baseY = 1.35;
    let baseX = 0.4;
    let bounce = 0;
    let tailSpeed = 2.2;
    let tailAmp = 0.25;

    // 检测主人 gesture 变化触发反应
    if (reactionRef.current.kind !== gesture) {
      reactionRef.current = { kind: gesture, start: t };
    }
    const re = t - reactionRef.current.start;
    const reactive = gesture !== "idle" && re < 2.5;

    if (reactive) {
      switch (gesture) {
        case "wave":
          // 跟着挥手：兴奋摇摆 + 尾巴狂摆
          baseX += Math.sin(t * 8) * 0.06;
          tailSpeed = 6;
          tailAmp = 0.5;
          break;
        case "nod":
          // 也跟着点头：上下 bob
          bounce = Math.abs(Math.sin(re * 6)) * 0.08;
          break;
        case "shake":
          // 跟着摇头：左右晃
          baseX += Math.sin(re * 7) * 0.06;
          break;
        case "point":
          // 主人指题目：小番转过去看
          if (headRef.current) headRef.current.rotation.y = 0.4;
          break;
        case "thumbsUp":
        case "cheer":
          // 大欢腾：高高跳 + 尾巴狂摆
          bounce = Math.abs(Math.sin(re * 7)) * 0.18;
          tailSpeed = 7;
          tailAmp = 0.6;
          break;
        case "clap":
          // 拍手：小步弹 + 尾巴跟节奏
          bounce = Math.abs(Math.sin(re * 7)) * 0.06;
          tailSpeed = 8;
          tailAmp = 0.55;
          break;
        case "dance":
          // 跳舞：左右扭 + 大 bounce + 尾巴扭得欢
          baseX += Math.sin(re * 4) * 0.05;
          bounce = Math.abs(Math.sin(re * 4)) * 0.1;
          tailSpeed = 5;
          tailAmp = 0.75;
          break;
        default:
          break;
      }
    }
    // 表情也影响（持续）：sad/angry 时垂头丧气
    if (emotion === "sad") {
      bounce = -0.05;
      tailAmp = 0.08;
    } else if (emotion === "happy") {
      tailAmp = 0.4;
    }

    groupRef.current.position.y = baseY + Math.sin(t * 1.4) * 0.04 + bounce;
    groupRef.current.position.x = baseX + Math.sin(t * 0.5) * 0.02;
    // 头微晃
    if (!reactive || (gesture !== "point")) {
      headRef.current.rotation.z = Math.sin(t * 0.8) * 0.08;
      headRef.current.rotation.y = Math.sin(t * 0.6) * 0.1;
    }
    // 尾巴
    if (tailRef.current) {
      tailRef.current.rotation.z = Math.sin(t * tailSpeed) * tailAmp;
    }
    // 耳朵
    if (lEarRef.current) lEarRef.current.rotation.z = 0.18 + Math.sin(t * 3.1) * 0.04;
    if (rEarRef.current) rEarRef.current.rotation.z = -0.18 - Math.sin(t * 3.1) * 0.04;
  });

  const RUST = "#d97706";
  const RUST_DARK = "#92400e";
  const CREAM = "#fef3c7";
  const FACE_WHITE = "#fef9e7";
  const NOSE_PINK = "#f472b6";
  const EYE_BLACK = "#0c0a09";

  return (
    <group ref={groupRef} position={[0.4, 1.35, 0.1]} scale={0.32}>
      {/* === 身体（短胖椭球） === */}
      <mesh position={[0, -0.06, 0]} scale={[0.95, 0.85, 0.95]}>
        <sphereGeometry args={[0.18, 32, 24]} />
        <meshStandardMaterial color={RUST} roughness={0.85} />
      </mesh>
      {/* 肚皮 cream 色（用更小的 sphere 推到前面） */}
      <mesh position={[0, -0.07, 0.13]} scale={[0.7, 0.6, 0.3]}>
        <sphereGeometry args={[0.16, 24, 18]} />
        <meshStandardMaterial color={CREAM} roughness={0.85} />
      </mesh>

      {/* === 头（大头 chibi） === */}
      <group ref={headRef} position={[0, 0.18, 0]}>
        {/* 主头球 */}
        <mesh>
          <sphereGeometry args={[0.2, 32, 24]} />
          <meshStandardMaterial color={RUST} roughness={0.85} />
        </mesh>
        {/* 脸面板（更浅的卵形） */}
        <mesh position={[0, -0.03, 0.13]} scale={[0.85, 0.75, 0.35]}>
          <sphereGeometry args={[0.18, 24, 18]} />
          <meshStandardMaterial color={FACE_WHITE} roughness={0.85} />
        </mesh>

        {/* === 耳朵 === */}
        <mesh ref={lEarRef} position={[-0.16, 0.16, -0.02]}>
          <sphereGeometry args={[0.07, 16, 12]} />
          <meshStandardMaterial color={RUST_DARK} roughness={0.85} />
        </mesh>
        <mesh ref={rEarRef} position={[0.16, 0.16, -0.02]}>
          <sphereGeometry args={[0.07, 16, 12]} />
          <meshStandardMaterial color={RUST_DARK} roughness={0.85} />
        </mesh>
        {/* 耳内 cream */}
        <mesh position={[-0.16, 0.16, 0.04]} scale={[0.55, 0.6, 0.5]}>
          <sphereGeometry args={[0.07, 14, 10]} />
          <meshStandardMaterial color={CREAM} roughness={0.7} />
        </mesh>
        <mesh position={[0.16, 0.16, 0.04]} scale={[0.55, 0.6, 0.5]}>
          <sphereGeometry args={[0.07, 14, 10]} />
          <meshStandardMaterial color={CREAM} roughness={0.7} />
        </mesh>

        {/* === 眼睛 === */}
        <mesh position={[-0.06, -0.01, 0.17]}>
          <sphereGeometry args={[0.028, 16, 12]} />
          <meshStandardMaterial color={EYE_BLACK} roughness={0.2} />
        </mesh>
        <mesh position={[0.06, -0.01, 0.17]}>
          <sphereGeometry args={[0.028, 16, 12]} />
          <meshStandardMaterial color={EYE_BLACK} roughness={0.2} />
        </mesh>
        {/* 眼神光（小白点） */}
        <mesh position={[-0.052, 0.005, 0.195]}>
          <sphereGeometry args={[0.008, 10, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0.068, 0.005, 0.195]}>
          <sphereGeometry args={[0.008, 10, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* === 鼻子（粉色） === */}
        <mesh position={[0, -0.05, 0.18]}>
          <sphereGeometry args={[0.018, 14, 10]} />
          <meshStandardMaterial color={NOSE_PINK} roughness={0.5} />
        </mesh>

        {/* === 嘴（小小弧线） === */}
        <mesh position={[0, -0.085, 0.175]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.018, 0.005, 6, 12, Math.PI]} />
          <meshStandardMaterial color={EYE_BLACK} roughness={0.5} />
        </mesh>

        {/* === 腮红（小粉点） === */}
        <mesh position={[-0.14, -0.04, 0.13]} scale={[1, 1, 0.3]}>
          <sphereGeometry args={[0.025, 14, 10]} />
          <meshStandardMaterial color="#fda4af" transparent opacity={0.6} />
        </mesh>
        <mesh position={[0.14, -0.04, 0.13]} scale={[1, 1, 0.3]}>
          <sphereGeometry args={[0.025, 14, 10]} />
          <meshStandardMaterial color="#fda4af" transparent opacity={0.6} />
        </mesh>
      </group>

      {/* === 四肢（小爪子） === */}
      <mesh position={[-0.12, -0.16, 0.08]}>
        <sphereGeometry args={[0.04, 14, 10]} />
        <meshStandardMaterial color={RUST_DARK} roughness={0.85} />
      </mesh>
      <mesh position={[0.12, -0.16, 0.08]}>
        <sphereGeometry args={[0.04, 14, 10]} />
        <meshStandardMaterial color={RUST_DARK} roughness={0.85} />
      </mesh>

      {/* === 尾巴（多段条纹） === */}
      <group ref={tailRef} position={[-0.12, -0.06, -0.1]} rotation={[0, 0, -0.6]}>
        {[
          { y: 0, color: RUST },
          { y: -0.06, color: CREAM },
          { y: -0.12, color: RUST_DARK },
          { y: -0.18, color: CREAM },
          { y: -0.24, color: RUST_DARK },
        ].map((seg, i) => (
          <mesh key={i} position={[0, seg.y, 0]}>
            <sphereGeometry args={[0.05 - i * 0.005, 14, 10]} />
            <meshStandardMaterial color={seg.color} roughness={0.85} />
          </mesh>
        ))}
      </group>

      {/* === 头顶悬浮小光环（"AI 状态指示"） === */}
      <mesh position={[0, 0.42, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.07, 0.008, 8, 24]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={2.0}
          roughness={0.4}
        />
      </mesh>
    </group>
  );
}

/**
 * v0.31.111：真正的红熊猫副手——Tripo3D 8-part OBJ 模型。
 *
 * 资源：public/avatars/red-panda/model_{0..7}.obj + texture.png
 *   - model_5 是主 mesh (1227 verts)，含完整身体+头+尾
 *   - 其它 7 个是小部件（嘴/牙/眼睛细节），跟 model_5 重叠
 *   - 所以 part-level 动画不可行（不知道哪个是尾巴），只能整组反应
 *
 * 动画策略：整体 transform（position/rotation/scale）跟主人 gesture/emotion 联动。
 * 反应种类映射 SidekickPlaceholder 同款（cheer 跳 / nod 头点 / shake 摇 / wave 摇晃 / point 转向）。
 */
const RED_PANDA_OBJ_URLS = [
  "/avatars/red-panda/model_0.obj",
  "/avatars/red-panda/model_1.obj",
  "/avatars/red-panda/model_2.obj",
  "/avatars/red-panda/model_3.obj",
  "/avatars/red-panda/model_4.obj",
  "/avatars/red-panda/model_5.obj",
  "/avatars/red-panda/model_6.obj",
  "/avatars/red-panda/model_7.obj",
];

function RedPandaSidekick({
  gesture,
  emotion,
}: {
  gesture: MascotGesture;
  emotion: MascotEmotion;
}) {
  const groupRef = useRef<Group>(null);
  const innerRef = useRef<Group>(null); // 用来做摇头摆动（整组的局部 transform）
  const reactionRef = useRef<{ kind: MascotGesture; start: number }>({
    kind: "idle",
    start: 0,
  });

  // useLoader array 一次拉 8 个 OBJ；R3F 自动缓存 + Suspense
  const objs = useLoader(OBJLoader, RED_PANDA_OBJ_URLS) as Object3D[];
  const texture = useLoader(THREE.TextureLoader, "/avatars/red-panda/texture.png");

  // 给 texture 配置颜色空间（three r152+ 默认 LinearSRGB，贴图要 SRGB 才正色）
  useEffect(() => {
    if (texture && "colorSpace" in texture) {
      (texture as THREE.Texture).colorSpace = THREE.SRGBColorSpace;
    }
  }, [texture]);

  // 给每个 mesh 套上 standard material + 纹理（OBJ 自带 phong 不够 PBR）
  // 也算一下整组的 bbox 用于自动 normalize
  const { recenter, normalizeScale } = useMemo(() => {
    const box = new THREE.Box3();
    let inited = false;
    objs.forEach((obj) => {
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          mesh.material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.78,
            metalness: 0.0,
            // 没法分前后耳，统一双面
            side: THREE.DoubleSide,
          });
          mesh.geometry.computeBoundingBox();
          mesh.castShadow = false;
          mesh.receiveShadow = false;
          const meshBox = mesh.geometry.boundingBox;
          if (meshBox) {
            if (!inited) {
              box.copy(meshBox);
              inited = true;
            } else {
              box.union(meshBox);
            }
          }
        }
      });
    });
    if (!inited) {
      return { recenter: new THREE.Vector3(0, 0, 0), normalizeScale: 1 };
    }
    const center = new THREE.Vector3();
    box.getCenter(center);
    const size = new THREE.Vector3();
    box.getSize(size);
    // 用 max 维度归一化 — model_5 size y=5.73 是身高最大维度，
    // 但模型自带朝向可能 y 是 left-right，所以保险起见用 maxDim
    const maxDim = Math.max(size.x, size.y, size.z);
    // 0.55 → 视觉占比够大让 Bruce/Selena 看得到细节，又不挡 Selena
    const targetSize = 0.55;
    const ns = maxDim > 0 ? targetSize / maxDim : 1;
    return { recenter: center.multiplyScalar(-1), normalizeScale: ns };
  }, [objs, texture]);

  useFrame((state) => {
    if (!groupRef.current || !innerRef.current) return;
    const t = state.clock.getElapsedTime();

    // 副手位置 — portrait camera fov 30° 距离 1.8，frustum 半宽 ~0.48；
    // 取 0.45 让 portrait 刚好露全身 + full view 独立站立
    let baseY = 1.3;
    let baseX = 0.45;
    let bounce = 0;
    let scaleMod = 1;
    let rotY = 0;
    let rotZ = 0;
    let rotX = 0;

    // 检测 gesture 变化触发反应
    if (reactionRef.current.kind !== gesture) {
      reactionRef.current = { kind: gesture, start: t };
    }
    const re = t - reactionRef.current.start;
    const reactive = gesture !== "idle" && re < 2.5;

    if (reactive) {
      // smoothstep 包络：进场 0.3s, 退场 0.4s（让反应不 pop-in）
      const fadeIn = Math.min(1, re / 0.3);
      const fadeOut = Math.max(0, Math.min(1, (2.5 - re) / 0.4));
      const w = fadeIn * fadeOut;
      switch (gesture) {
        case "wave":
          // 跟着挥手：左右晃 + 兴奋
          baseX += Math.sin(t * 8) * 0.06 * w;
          rotZ = Math.sin(t * 8) * 0.15 * w;
          scaleMod = 1 + 0.05 * w;
          break;
        case "nod":
          // 跟着点头：整体上下 bob
          bounce = Math.abs(Math.sin(re * 6)) * 0.08 * w;
          rotX = Math.sin(re * 6) * 0.18 * w;
          break;
        case "shake":
          // 跟着摇头：左右摇 + 整体扭
          rotY = Math.sin(re * 7) * 0.3 * w;
          baseX += Math.sin(re * 7) * 0.04 * w;
          break;
        case "point":
          // 主人指题目：小番转过去看
          rotY = 0.5 * w;
          break;
        case "thumbsUp":
          // 大棒：跳 + 旋转一圈
          bounce = Math.abs(Math.sin(re * 5)) * 0.12 * w;
          rotY = Math.sin(re * 3) * 0.4 * w;
          scaleMod = 1 + 0.08 * w;
          break;
        case "cheer":
          // 大欢腾：高跳 + scale 放大 + 摇摆
          bounce = Math.abs(Math.sin(re * 7)) * 0.18 * w;
          rotZ = Math.sin(re * 6) * 0.15 * w;
          scaleMod = 1 + 0.12 * w;
          break;
        case "clap":
          // 跟拍手：bounce 跟节奏 + 微 z 摆
          bounce = Math.abs(Math.sin(re * 7)) * 0.08 * w;
          rotZ = Math.sin(re * 7) * 0.08 * w;
          break;
        case "dance":
          // 跟跳舞：左右大扭 + 跳 + scale 跳
          rotY = Math.sin(re * 4) * 0.5 * w;
          bounce = Math.abs(Math.sin(re * 4)) * 0.12 * w;
          scaleMod = 1 + 0.08 * Math.abs(Math.sin(re * 4)) * w;
          break;
        default:
          break;
      }
    }

    // 情绪覆层（持续，不靠 fade）
    if (emotion === "sad") {
      bounce -= 0.04;
      scaleMod *= 0.92;
      rotZ += 0.08; // 微微歪头
    } else if (emotion === "happy") {
      scaleMod *= 1.03;
    } else if (emotion === "angry") {
      rotZ -= 0.05;
    }

    // idle 浮动（始终）
    groupRef.current.position.y =
      baseY + Math.sin(t * 1.4) * 0.04 + bounce;
    groupRef.current.position.x = baseX + Math.sin(t * 0.5) * 0.02;
    groupRef.current.position.z = 0.25; // 略前 — 避免衣服 z-fight 但不要悬空感
    // idle 时也微微转身（让模型不僵）
    innerRef.current.rotation.y = rotY + Math.sin(t * 0.6) * 0.1;
    innerRef.current.rotation.z = rotZ + Math.sin(t * 0.8) * 0.04;
    innerRef.current.rotation.x = rotX;
    innerRef.current.scale.setScalar(scaleMod);
  });

  return (
    <group ref={groupRef} position={[0.4, 1.35, 0.1]}>
      <group ref={innerRef}>
        {/* 包一层做归一化：scale 到 ~0.5 高 + 平移让 bbox 中心在原点
            Tripo3D 默认 +Z forward；camera 在 +Z 看 -Z → +Z 面对 camera 一定程度上正好；
            如果脸是背对的，把 rotation.y 设 PI 让它转 180° 面对 camera。 */}
        <group
          scale={normalizeScale}
          position={[recenter.x, recenter.y, recenter.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          {objs.map((obj, i) => (
            <primitive key={i} object={obj} />
          ))}
        </group>
      </group>

      {/* v0.31.111：移除 placeholder 时代的"AI 状态光环"——红熊猫本身就是
          AI 副手 mascot，没必要再加一圈视觉装饰，而且 group origin 上方很容易
          跟 Selena 头顶重叠 */}
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
