/**
 * v0.32.0: P3 Worlds 主入口 —— 3 学科悬空选择。
 *
 * 路径: /worlds
 *
 * 设计（爸爸 GDD v3 拍板）：
 *  - 3 个学科地图悬浮，low-poly 简化加载（procedural box/sphere/cone）
 *  - 名字游戏化：百宝港 / 星帆岛 / 墨溪镇（不直接说"数学/英语/语文"）
 *  - 中央 emoji + 大字台词作为小进占位（VRM lazy，性能优先）
 *  - 推荐按钮"开始" → 百宝港
 *  - Sprint 1: 百宝港 unlocked，其他 2 个 locked
 */

import { Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Stars, OrbitControls } from "@react-three/drei";
import { WorldsCanvas } from "../../components/worlds/WorldsCanvas";
import { WORLDS, type WorldDef } from "../../content/worlds/worlds";
import { WorldOrb } from "../../components/worlds/WorldOrb";

// 3 orb 在 X 轴上等距分布（左 / 中 / 右），间距拉大避免拥挤
const ORB_POSITIONS: [number, number, number][] = [
  [-4.8, 0, 0],
  [0, 0, 0],
  [4.8, 0, 0],
];

export function WorldsHomePage() {
  const navigate = useNavigate();
  const [hoverWorld, setHoverWorld] = useState<WorldDef | null>(null);
  const recommended = WORLDS.find((w) => w.unlocked) ?? WORLDS[0]!;

  const handleSelect = (world: WorldDef) => {
    if (!world.unlocked) return;
    navigate(world.route);
  };

  useEffect(() => {
    return () => {
      document.body.style.cursor = "default";
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-gradient-to-b from-indigo-950 via-purple-900 to-pink-950 world-page-enter" style={{ zIndex: 50 }}>
      <WorldsCanvas
        camera={{ position: [0, 1.8, 8], fov: 55, near: 0.1, far: 200 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true }}
        loadingBg="#1e1b4b"
        loadingEmoji="🎡"
        loadingTitle="奇遇乐园加载中…"
      >
        {/* 星空 */}
        <Stars radius={50} depth={50} count={1500} factor={3} fade speed={0.5} />

        {/* 灯光 */}
        <ambientLight intensity={0.4} />
        <hemisphereLight args={["#fff7e0", "#1e1b4b", 0.6]} />
        <directionalLight position={[5, 8, 5]} intensity={1.0} color="#fff5da" />
        <pointLight position={[-3, 2, 3]} intensity={0.4} color="#a78bfa" />

        {/* 3 orb（KayKit GLTF lazy load 用 Suspense 包） */}
        <Suspense fallback={null}>
          {WORLDS.map((world, i) => (
            <WorldOrb
              key={world.id}
              world={world}
              position={ORB_POSITIONS[i]!}
              onSelect={handleSelect}
            />
          ))}
        </Suspense>

        {/* 用户可微调视角（限制范围） */}
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 2}
          minAzimuthAngle={-Math.PI / 4}
          maxAzimuthAngle={Math.PI / 4}
          enableDamping
          dampingFactor={0.08}
        />
      </WorldsCanvas>

      {/* ===== HUD ===== */}
      <HUD />

      {/* v0.32.59 (Ep35 N): SVG 装饰星座 + 上方 hero ribbon */}
      <WorldsHomeDecor />

      {/* ===== 中央台词 / 推荐按钮 ===== */}
      <CenterPanel
        recommended={recommended}
        hoverWorld={hoverWorld}
        onStart={() => navigate(recommended.route)}
      />

      {/* v0.32.59 (Ep35 N): 底部 dock — 3 world 缩略 chip，永远可见，提示玩家全图 */}
      <WorldDock
        focusId={(hoverWorld ?? recommended).id}
        onHover={setHoverWorld}
        onSelect={handleSelect}
      />

      {/* ===== Hover overlay (不可见，仅捕获 hover 状态用于 CenterPanel) ===== */}
      <HoverCapture
        onHover={(id) => {
          const w = WORLDS.find((w) => w.id === id);
          setHoverWorld(w ?? null);
        }}
      />
    </div>
  );
}

function HUD() {
  const navigate = useNavigate();
  return (
    <div
      className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none"
      style={{ zIndex: 60 }}
    >
      <button
        type="button"
        onClick={() => navigate("/math")}
        className="world-chip world-chip-dark"
      >
        <span className="world-top-back-arrow">←</span> 返回主页
      </button>
      <div className="world-chip" style={{ background: "linear-gradient(180deg, #fff 0%, #ddd6fe 100%)", borderColor: "#a78bfa", color: "#1e1b4b" }}>
        🎡 奇遇乐园
      </div>
      <div className="w-[90px]" />
    </div>
  );
}

// v0.32.59 (Ep35 N): SVG 星座装饰 — 不抢戏，纯背景点缀
function WorldsHomeDecor() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 51 }}>
      {/* hero ribbon: 顶部副标题 */}
      <div className="absolute top-14 left-1/2 -translate-x-1/2 pointer-events-none">
        <div
          className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-amber-200/90 border border-amber-200/40"
          style={{
            background: "rgba(30,27,75,0.5)",
            backdropFilter: "blur(6px)",
            textShadow: "0 0 12px rgba(251,191,36,0.5)",
          }}
        >
          ✦ Worlds of Adventure ✦
        </div>
      </div>

      {/* 装饰 SVG: 顶部 + 两侧的星座线 + 散点星星 */}
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ opacity: 0.5 }}
      >
        {/* 星座连线（左上）*/}
        <polyline
          points="6,18 14,12 22,20 30,14"
          stroke="rgba(167,139,250,0.7)"
          strokeWidth="0.18"
          strokeDasharray="0.6,0.4"
          fill="none"
        />
        {/* 星座连线（右上）*/}
        <polyline
          points="78,16 86,24 94,18"
          stroke="rgba(251,191,36,0.7)"
          strokeWidth="0.18"
          strokeDasharray="0.6,0.4"
          fill="none"
        />
        {/* 4 个小星 */}
        {[
          [6, 18, "#a78bfa"],
          [22, 20, "#a78bfa"],
          [78, 16, "#fbbf24"],
          [94, 18, "#fbbf24"],
          [10, 70, "#f0abfc"],
          [92, 80, "#fde68a"],
        ].map(([cx, cy, color], i) => (
          <circle key={i} cx={cx as number} cy={cy as number} r="0.45" fill={color as string} opacity="0.9">
            <animate attributeName="opacity" values="0.4;1;0.4" dur={`${2.5 + (i % 3) * 0.5}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </svg>
    </div>
  );
}

// v0.32.59 (Ep35 N): 底部 3 world dock chip
function WorldDock({
  focusId,
  onHover,
  onSelect,
}: {
  focusId: string;
  onHover: (w: WorldDef | null) => void;
  onSelect: (w: WorldDef) => void;
}) {
  return (
    <div
      className="absolute left-0 right-0 bottom-32 flex justify-center gap-2 pointer-events-none"
      style={{ zIndex: 58 }}
    >
      {WORLDS.map((w) => {
        const isFocus = w.id === focusId;
        return (
          <button
            key={w.id}
            type="button"
            disabled={!w.unlocked}
            onMouseEnter={() => onHover(w)}
            onMouseLeave={() => onHover(null)}
            onClick={() => w.unlocked && onSelect(w)}
            className={`pointer-events-auto group relative overflow-hidden rounded-2xl border-[3px] px-3 pt-2 pb-3 shadow-xl transition-all duration-200 ${
              isFocus ? "scale-110 -translate-y-1" : "scale-100"
            } ${!w.unlocked ? "grayscale opacity-50 cursor-not-allowed" : "hover:scale-110 hover:-translate-y-1"}`}
            style={{
              borderColor: isFocus ? w.accent : "rgba(255,255,255,0.4)",
              background: isFocus
                ? `linear-gradient(180deg, #fff, ${w.accent}33)`
                : "rgba(255,255,255,0.88)",
              minWidth: isFocus ? 132 : 112,
              boxShadow: isFocus ? `0 6px 20px ${w.accent}88` : undefined,
            }}
          >
            <div className="text-2xl leading-none">{w.emoji}</div>
            <div
              className="text-[11px] font-black mt-1 leading-tight"
              style={{ color: isFocus ? "#0f172a" : "#334155" }}
            >
              {w.name}
            </div>
            {/* v0.32.64 (Ep40 AA): inline tagline — focus 2 行展开，常态 1 行截断 */}
            <div
              className="text-[9px] font-bold leading-tight mt-0.5 mx-auto"
              style={{
                color: isFocus ? w.accent : "#64748b",
                maxWidth: isFocus ? 118 : 96,
                display: "-webkit-box",
                WebkitLineClamp: isFocus ? 2 : 1,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {w.unlocked ? w.tagline : (w.lockHint ?? "敬请期待")}
            </div>
            {!w.unlocked && (
              <div className="text-[9px] font-bold text-slate-500 mt-0.5">🔒 锁定</div>
            )}
            {/* v0.32.89 (Ep65 EEEEEE): focus chip 主题色发光下划线 indicator
                hover 时其他 chip 也 preview 一道暗淡线（仅 unlocked） */}
            {w.unlocked && (
              <span
                aria-hidden
                className={`absolute bottom-1 left-4 right-4 h-1 rounded-full origin-center transition-all duration-220 ${
                  isFocus
                    ? "opacity-100 scale-x-100"
                    : "opacity-0 scale-x-50 group-hover:opacity-70 group-hover:scale-x-80"
                }`}
                style={{
                  background: `linear-gradient(90deg, transparent, ${w.accent}, transparent)`,
                  boxShadow: `0 0 12px ${w.accent}`,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

interface CenterPanelProps {
  recommended: WorldDef;
  hoverWorld: WorldDef | null;
  onStart: () => void;
}

function CenterPanel({ recommended, hoverWorld, onStart }: CenterPanelProps) {
  // 鼠标 hover 一个 orb 时显示该 world 的信息；否则显示推荐
  const focus = hoverWorld ?? recommended;
  return (
    <div
      className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-3 pointer-events-none"
      style={{ zIndex: 55 }}
    >
      {/* v0.32.69 (Ep45 MM): 小进 emoji + chunky world-panel 风格台词卡
          (替代 v32.0 朴素 bg-white/95) */}
      <div className="flex items-end gap-3 max-w-[92%]">
        <div
          className="text-5xl"
          style={{ filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.4))" }}
        >
          👩‍🏫
        </div>
        <div
          className="relative pointer-events-none"
          style={{
            ["--world-accent" as string]: focus.accent,
          } as React.CSSProperties}
        >
          <div
            className="world-panel"
            style={{
              maxWidth: "min(92vw, 480px)",
              padding: "0.75rem 1.1rem",
              borderColor: focus.accent,
            }}
          >
            <div
              className="world-panel-title"
              style={{ color: focus.accent }}
            >
              <span className="mr-1">{focus.emoji}</span>
              {focus.unlocked ? "推荐前往" : "建设中"}
            </div>
            <div className="text-slate-900 text-base font-black leading-tight mt-0.5">
              {focus.name}
            </div>
            <div className="mt-1 text-xs font-extrabold text-slate-600 leading-snug">
              {focus.unlocked ? focus.tagline : (focus.lockHint ?? "敬请期待")}
            </div>
          </div>
          {/* 对话气泡尾巴 - accent 描边 + 白填充, 双层 */}
          <span
            className="absolute"
            style={{
              left: -14,
              bottom: 22,
              width: 0,
              height: 0,
              borderTop: "10px solid transparent",
              borderBottom: "10px solid transparent",
              borderRight: `14px solid ${focus.accent}`,
            }}
          />
          <span
            className="absolute"
            style={{
              left: -9,
              bottom: 23,
              width: 0,
              height: 0,
              borderTop: "9px solid transparent",
              borderBottom: "9px solid transparent",
              borderRight: "11px solid #ffffff",
            }}
          />
        </div>
      </div>
      {/* 推荐 / 开始按钮 — v0.32.59 (Ep35 N): chunky cta + accent glow */}
      <button
        type="button"
        onClick={onStart}
        className="pointer-events-auto world-cta-btn"
        style={{
          ["--world-accent" as string]: recommended.accent,
          boxShadow: `0 4px 0 rgba(0,0,0,0.2), 0 0 32px ${recommended.accent}aa, inset 0 1px 0 rgba(255,255,255,0.4)`,
        } as React.CSSProperties}
      >
        {recommended.emoji} 出发去 {recommended.name}
      </button>
    </div>
  );
}

/**
 * R3F orb hover 状态没法直接冒泡到外面 React HTML，
 * 临时用 window 事件桥接。Day 1 简化，足够用。
 */
function HoverCapture({ onHover }: { onHover: (id: string | null) => void }) {
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ id: string | null }>;
      onHover(ce.detail?.id ?? null);
    };
    window.addEventListener("worlds-orb-hover", handler);
    return () => window.removeEventListener("worlds-orb-hover", handler);
  }, [onHover]);
  return null;
}
