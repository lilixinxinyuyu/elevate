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

import { Suspense, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Stars, OrbitControls } from "@react-three/drei";
import { WorldsCanvas } from "../../components/worlds/WorldsCanvas";
import { WORLDS, type WorldDef } from "../../content/worlds/worlds";
import {
  getAllBaibaoStats,
  getAllXingfanStats,
} from "../../lib/worlds/worldsProgress";
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
  // v0.33.36 (Ep112 dock-progress-stars): 加载 per-world 完成总数，给 dock chip 显示 1-3 颗 ⭐ 进度
  const worldsProgress = useWorldsProgress();

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

      {/* v0.33.32 (Ep108 worlds-bg-particles): 14 颗飘浮 sparkle 粒子，主入口 hub 活气 */}
      <WorldsBgParticles />

      {/* ===== 中央台词 / 推荐按钮 ===== */}
      <CenterPanel
        recommended={recommended}
        hoverWorld={hoverWorld}
        onStart={() => {
          // v0.33.54 (Ep128 world-cta-particle-burst): 点 CTA 时延迟 320ms navigate，给粒子爆裂时间
          // 实际 burst 由 CenterPanel 内部触发（不需要从外面 prop drilling state）
          window.setTimeout(() => navigate(recommended.route), 320);
        }}
        progressByWorld={worldsProgress}
      />

      {/* v0.32.59 (Ep35 N): 底部 dock — 3 world 缩略 chip，永远可见，提示玩家全图 */}
      <WorldDock
        focusId={(hoverWorld ?? recommended).id}
        onHover={setHoverWorld}
        onSelect={handleSelect}
        progressByWorld={worldsProgress}
      />

      {/* ===== Hover overlay (不可见，仅捕获 hover 状态用于 CenterPanel) ===== */}
      <HoverCapture
        onHover={(id) => {
          const w = WORLDS.find((w) => w.id === id);
          setHoverWorld(w ?? null);
        }}
      />

      {/* v0.33.48 (Ep122 worlds-home-tour-prompt): 首次进 worlds 4 步引导 */}
      <WorldsHomeTour />
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
      {/* hero ribbon: 顶部副标题 — v0.33.14 (Ep90 AAAAAAAA) 渐变金边 + 双侧 sparkle 散光 */}
      <style>{`
        .worlds-hero-ribbon-wrap {
          position: absolute;
          top: 3.5rem;
          left: 50%;
          transform: translateX(-50%);
          pointer-events: none;
          padding: 0 1.8rem;
        }
        .worlds-hero-ribbon {
          position: relative;
          padding: 0.45rem 1.3rem;
          border-radius: 999px;
          background: rgba(30, 27, 75, 0.62);
          backdrop-filter: blur(8px);
          color: #fef3c7;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.34em;
          text-transform: uppercase;
          text-shadow: 0 0 12px rgba(251, 191, 36, 0.7);
          /* gold gradient border via background-clip mask */
          border: 2.5px solid transparent;
          background-image:
            linear-gradient(rgba(30, 27, 75, 0.62), rgba(30, 27, 75, 0.62)),
            linear-gradient(120deg, #fde68a 0%, #f59e0b 30%, #fef08a 50%, #f59e0b 70%, #fde68a 100%);
          background-origin: border-box;
          background-clip: padding-box, border-box;
          background-size: 100% 100%, 220% 100%;
          animation: worlds-hero-ribbon-shimmer 3.5s linear infinite;
          box-shadow:
            0 4px 20px rgba(245, 158, 11, 0.32),
            inset 0 0 18px rgba(251, 191, 36, 0.18);
        }
        @keyframes worlds-hero-ribbon-shimmer {
          0%   { background-position: 0 0, 0 0; }
          100% { background-position: 0 0, 220% 0; }
        }
        .worlds-hero-ribbon-sparkle {
          position: absolute;
          top: 50%;
          font-size: 18px;
          color: #fde68a;
          text-shadow: 0 0 10px rgba(251, 191, 36, 0.85);
          pointer-events: none;
          transform: translateY(-50%);
        }
        .worlds-hero-ribbon-sparkle.left  { right: 100%; margin-right: 0.65rem; animation: worlds-hero-sparkle-twinkle 2.2s ease-in-out infinite; }
        .worlds-hero-ribbon-sparkle.right { left:  100%; margin-left:  0.65rem; animation: worlds-hero-sparkle-twinkle 2.2s ease-in-out infinite 1.1s; }
        @keyframes worlds-hero-sparkle-twinkle {
          0%, 100% { opacity: 0.55; transform: translateY(-50%) scale(0.78) rotate(0deg); }
          50%      { opacity: 1;    transform: translateY(-50%) scale(1.25) rotate(25deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .worlds-hero-ribbon,
          .worlds-hero-ribbon-sparkle { animation: none; }
        }
        /* v0.33.22 (Ep98 FFFFFFFF): 星座连线 idle drift —
           stroke-dashoffset 让虚线沿连线"能量流动"，左/右两条反方向跑，
           节奏一长一短，配合现有 SMIL twinkle 让背景活起来。 */
        @media (prefers-reduced-motion: no-preference) {
          .worlds-constellation-line {
            animation: worlds-constellation-flow 4.8s linear infinite;
          }
          .worlds-constellation-line.alt {
            animation-duration: 6.2s;
            animation-direction: reverse;
          }
          @keyframes worlds-constellation-flow {
            0%   { stroke-dashoffset: 0; }
            100% { stroke-dashoffset: -2; }
          }
          /* 整 SVG 极慢漂移 — 0.6° 倾斜回摆，模拟夜空缓行 */
          .worlds-constellation-svg {
            transform-origin: 50% 30%;
            animation: worlds-constellation-sway 14s ease-in-out infinite;
          }
          @keyframes worlds-constellation-sway {
            0%, 100% { transform: rotate(-0.4deg) translateY(0); }
            50%      { transform: rotate(0.4deg)  translateY(-0.6px); }
          }
        }
      `}</style>
      <div className="worlds-hero-ribbon-wrap">
        <span className="worlds-hero-ribbon-sparkle left" aria-hidden>✦</span>
        <div className="worlds-hero-ribbon">Worlds of Adventure</div>
        <span className="worlds-hero-ribbon-sparkle right" aria-hidden>✦</span>
      </div>

      {/* 装饰 SVG: 顶部 + 两侧的星座线 + 散点星星
         v0.33.22 (Ep98 FFFFFFFF): 整 SVG 加 sway class — 左右轻摆模拟夜空缓行 */}
      <svg
        className="worlds-constellation-svg absolute inset-0 w-full h-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ opacity: 0.5 }}
      >
        {/* 星座连线（左上）— stroke-dashoffset 流动 */}
        <polyline
          className="worlds-constellation-line"
          points="6,18 14,12 22,20 30,14"
          stroke="rgba(167,139,250,0.7)"
          strokeWidth="0.18"
          strokeDasharray="0.6,0.4"
          fill="none"
        />
        {/* 星座连线（右上）— 反方向、更慢 */}
        <polyline
          className="worlds-constellation-line alt"
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

/**
 * v0.33.32 (Ep108 worlds-bg-particles): 14 颗飘浮 sparkle 粒子
 *  - PRNG seed 一次性生成位置 / size / phase（不每帧 new）
 *  - 6 种 emoji glyph 循环用
 *  - 3 套独立 CSS 动画 keyframe（float Y / spin / twinkle 透明度），每颗独立 duration + delay
 *  - z-index 50（hero ribbon=51 之下，世界 canvas 之上）
 *  - prefers-reduced-motion: reduce → 全静态显示，仅低 opacity
 */
function WorldsBgParticles() {
  const PARTICLES = 14;
  const GLYPHS = ["✨", "⭐", "💫", "🌟", "🪐", "☄️"];
  const particles = useMemo(() => {
    const out: {
      glyph: string;
      left: number;
      top: number;
      size: number;
      floatDur: number;
      spinDur: number;
      twinkleDur: number;
      delay: number;
    }[] = [];
    for (let i = 0; i < PARTICLES; i++) {
      // PRNG seed 风格 — 跟 Ep105 NightStars 同套路
      const s1 = (i * 9301 + 49297) % 233280;
      const s2 = ((i + 7) * 4093 + 31477) % 233280;
      const s3 = ((i + 13) * 6151 + 12289) % 233280;
      const r1 = s1 / 233280;
      const r2 = s2 / 233280;
      const r3 = s3 / 233280;
      // 8% inset 避开边缘
      const left = 6 + r1 * 88;
      const top = 8 + r2 * 84;
      const size = 14 + r3 * 14; // 14-28 px
      const floatDur = 6 + (i % 5) * 1.3; // 6-11s
      const spinDur = 14 + (i % 4) * 3.5; // 14-25s
      const twinkleDur = 2.4 + (i % 3) * 0.8; // 2.4-4s
      const delay = r1 * 6;
      const glyph = GLYPHS[i % GLYPHS.length]!;
      out.push({ glyph, left, top, size, floatDur, spinDur, twinkleDur, delay });
    }
    return out;
  }, []);
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      aria-hidden
      style={{ zIndex: 50, overflow: "hidden" }}
    >
      <style>{`
        .worlds-bg-particle {
          position: absolute;
          line-height: 1;
          filter: drop-shadow(0 0 6px rgba(253, 224, 71, 0.55));
          will-change: transform, opacity;
        }
        .worlds-bg-particle-inner {
          display: inline-block;
          animation-name: worlds-bg-particle-spin, worlds-bg-particle-twinkle;
          animation-iteration-count: infinite, infinite;
          animation-timing-function: linear, ease-in-out;
        }
        @keyframes worlds-bg-particle-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-22px); }
        }
        @keyframes worlds-bg-particle-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes worlds-bg-particle-twinkle {
          0%, 100% { opacity: 0.22; }
          50%      { opacity: 0.78; }
        }
        @media (prefers-reduced-motion: reduce) {
          .worlds-bg-particle,
          .worlds-bg-particle-inner {
            animation: none !important;
            opacity: 0.35 !important;
          }
        }
      `}</style>
      {particles.map((p, i) => (
        <span
          key={i}
          className="worlds-bg-particle"
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            fontSize: `${p.size}px`,
            animation: `worlds-bg-particle-float ${p.floatDur}s ease-in-out ${p.delay}s infinite`,
          }}
        >
          <span
            className="worlds-bg-particle-inner"
            style={{
              animationDuration: `${p.spinDur}s, ${p.twinkleDur}s`,
              animationDelay: `${p.delay * 0.5}s, ${p.delay * 0.7}s`,
            }}
          >
            {p.glyph}
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * v0.33.36 (Ep112 dock-progress-stars): 加载所有世界总完成数
 *  - baibao: sum(getAllBaibaoStats)
 *  - xingfan: sum(getAllXingfanStats)
 *  - 其他世界（如 moxi 待解锁）: 0
 *  - 用 dexie meta 读，async 一次性 mount load
 */
function useWorldsProgress(): Record<string, number> {
  const [progress, setProgress] = useState<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [baibao, xingfan] = await Promise.all([
          getAllBaibaoStats(),
          getAllXingfanStats(),
        ]);
        if (cancelled) return;
        setProgress({
          baibao: Object.values(baibao).reduce((a, b) => a + b, 0),
          xingfan: Object.values(xingfan).reduce((a, b) => a + b, 0),
        });
      } catch {
        // 静默 — 失败就保持 0
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return progress;
}

/**
 * v0.33.36 (Ep112 dock-progress-stars): 完成数 → 星级 (0-3)
 *  - 0:  0 单（新手 / 未玩）
 *  - 1+: 1 ⭐
 *  - 5+: 2 ⭐
 *  - 15+: 3 ⭐ (满级)
 */
function progressToStarTier(n: number): number {
  if (n >= 15) return 3;
  if (n >= 5) return 2;
  if (n >= 1) return 1;
  return 0;
}

// v0.32.59 (Ep35 N): 底部 3 world dock chip
function WorldDock({
  focusId,
  onHover,
  onSelect,
  progressByWorld,
}: {
  focusId: string;
  onHover: (w: WorldDef | null) => void;
  onSelect: (w: WorldDef) => void;
  progressByWorld: Record<string, number>;
}) {
  return (
    <div
      className="absolute left-0 right-0 bottom-32 flex justify-center gap-2 pointer-events-none"
      style={{ zIndex: 58 }}
    >
      {/* v0.33.12 (Ep88 PPPPPPP): dock chip 右上角 idle accent dot */}
      <style>{`
        .worlds-dock-accent-dot {
          position: absolute;
          top: 7px;
          right: 8px;
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: radial-gradient(
            circle at 35% 35%,
            #ffffff 0 22%,
            #fef3c7 23% 55%,
            var(--dock-accent, #f59e0b) 56%
          );
          box-shadow: 0 0 10px var(--dock-accent, #f59e0b);
          opacity: 0.85;
          animation: worlds-dock-dot-pulse 2.1s ease-in-out infinite;
          pointer-events: none;
        }
        .worlds-dock-accent-dot.is-focus {
          opacity: 1;
          width: 9px;
          height: 9px;
          box-shadow: 0 0 14px var(--dock-accent, #f59e0b), 0 0 0 2px rgba(255, 255, 255, 0.55);
        }
        @keyframes worlds-dock-dot-pulse {
          0%, 100% { transform: scale(0.85); opacity: 0.7; }
          50%      { transform: scale(1.12); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .worlds-dock-accent-dot { animation: none; }
        }
        /* v0.33.18 (Ep94 WWWWW): dock chip hover glow halo via box-shadow stack
           （button overflow-hidden 限制 ::after halo, 改用 box-shadow + outline 实现） */
        .worlds-dock-chip {
          transition:
            transform 220ms cubic-bezier(.34, 1.56, .64, 1),
            box-shadow 220ms ease-out,
            filter 220ms ease-out;
        }
        .worlds-dock-chip:not(:disabled):hover,
        .worlds-dock-chip.is-focus {
          box-shadow:
            0 10px 26px var(--dock-accent-glow, rgba(245, 158, 11, 0.65)),
            0 0 0 5px var(--dock-accent-soft, rgba(245, 158, 11, 0.22)),
            inset 0 1px 0 rgba(255, 255, 255, 0.5);
          filter: brightness(1.06) saturate(1.08);
        }
        @media (prefers-reduced-motion: reduce) {
          .worlds-dock-chip { transition: none; }
        }
        /* v0.33.36 (Ep112 dock-progress-stars): chip 内 ⭐ 行 — 1-3 颗按完成数显示 */
        .worlds-dock-stars-row {
          display: inline-flex;
          gap: 1px;
          margin-top: 0.18rem;
          line-height: 1;
        }
        .worlds-dock-star {
          font-size: 10.5px;
          display: inline-block;
          line-height: 1;
          filter: drop-shadow(0 0 4px var(--star-glow, rgba(251, 191, 36, 0.85)));
          animation: worlds-dock-star-twinkle 1.9s ease-in-out infinite;
        }
        .worlds-dock-star.empty {
          opacity: 0.18;
          filter: none;
          animation: none;
        }
        @keyframes worlds-dock-star-twinkle {
          0%, 100% { transform: scale(0.92); opacity: 0.82; }
          50%      { transform: scale(1.18); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .worlds-dock-star { animation: none; }
        }
      `}</style>
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
            className={`worlds-dock-chip ${isFocus ? "is-focus" : ""} pointer-events-auto group relative overflow-hidden rounded-2xl border-[3px] px-3 pt-2 pb-3 shadow-xl transition-all duration-200 ${
              isFocus ? "scale-110 -translate-y-1" : "scale-100"
            } ${!w.unlocked ? "grayscale opacity-50 cursor-not-allowed" : "hover:scale-110 hover:-translate-y-1"}`}
            style={
              {
                borderColor: isFocus ? w.accent : "rgba(255,255,255,0.4)",
                background: isFocus
                  ? `linear-gradient(180deg, #fff, ${w.accent}33)`
                  : "rgba(255,255,255,0.88)",
                minWidth: isFocus ? 132 : 112,
                boxShadow: isFocus ? `0 6px 20px ${w.accent}88` : undefined,
                ["--dock-accent" as string]: w.accent,
                ["--dock-accent-glow" as string]: `${w.accent}aa`,
                ["--dock-accent-soft" as string]: `${w.accent}33`,
              } as React.CSSProperties
            }
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
            {/* v0.33.36 (Ep112 dock-progress-stars): unlocked chip 显示 1-3 颗 ⭐ 进度勋章
               永远渲染 3 个槽（已得点亮，未得灰），保持 chip 高度恒定 */}
            {w.unlocked && (
              <div
                className="worlds-dock-stars-row"
                aria-label={`完成 ${progressByWorld[w.id] ?? 0} 单`}
                style={
                  {
                    ["--star-glow" as string]: `${w.accent}cc`,
                  } as React.CSSProperties
                }
              >
                {Array.from({ length: 3 }).map((_, i) => {
                  const tier = progressToStarTier(progressByWorld[w.id] ?? 0);
                  const lit = i < tier;
                  return (
                    <span
                      key={i}
                      className={`worlds-dock-star${lit ? "" : " empty"}`}
                      style={{ animationDelay: `${i * 0.32}s` }}
                      aria-hidden
                    >
                      ⭐
                    </span>
                  );
                })}
              </div>
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
            {/* v0.33.12 (Ep88 PPPPPPP): unlocked dock chip 右上角 idle accent dot */}
            {w.unlocked && (
              <span
                aria-hidden
                className={`worlds-dock-accent-dot ${isFocus ? "is-focus" : ""}`}
                style={
                  {
                    ["--dock-accent" as string]: w.accent,
                  } as React.CSSProperties
                }
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
  progressByWorld: Record<string, number>;
}

function CenterPanel({ recommended, hoverWorld, onStart, progressByWorld }: CenterPanelProps) {
  // 鼠标 hover 一个 orb 时显示该 world 的信息；否则显示推荐
  const focus = hoverWorld ?? recommended;
  return (
    <div
      className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-3 pointer-events-none"
      style={{ zIndex: 55 }}
    >
      {/* v0.32.69 (Ep45 MM): 小进 emoji + chunky world-panel 风格台词卡
          (替代 v32.0 朴素 bg-white/95)
          v0.33.10 (Ep86 NNNNNNN): mascot 周围浮 3 颗 sparkle + bob 动画 */}
      <style>{`
        .worlds-home-mascot-wrap {
          position: relative;
          width: 4rem;
          height: 4rem;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
        }
        .worlds-home-mascot {
          font-size: 3rem;
          line-height: 1;
          filter: drop-shadow(0 6px 10px rgba(0,0,0,0.4));
          animation: worlds-home-mascot-bob 2.8s ease-in-out infinite;
        }
        .worlds-home-mascot-sparkle {
          position: absolute;
          color: #fde68a;
          font-size: 0.95rem;
          text-shadow: 0 0 10px rgba(251, 191, 36, 0.85);
          pointer-events: none;
          animation: worlds-home-sparkle-float 2.4s ease-in-out infinite;
        }
        .worlds-home-mascot-sparkle.sparkle-a { left: -0.4rem; top: 0.1rem; animation-delay: 0ms; }
        .worlds-home-mascot-sparkle.sparkle-b { right: -0.3rem; top: 1.1rem; animation-delay: 450ms; color: #fbbf24; }
        .worlds-home-mascot-sparkle.sparkle-c { right: 0.2rem; bottom: -0.15rem; animation-delay: 900ms; color: #fef08a; }
        @keyframes worlds-home-mascot-bob {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50%      { transform: translateY(-5px) rotate(2deg); }
        }
        @keyframes worlds-home-sparkle-float {
          0%, 100% { opacity: 0.4; transform: translateY(0) scale(0.78) rotate(0deg); }
          50%      { opacity: 1;   transform: translateY(-8px) scale(1.18) rotate(20deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .worlds-home-mascot,
          .worlds-home-mascot-sparkle { animation: none; }
        }
      `}</style>
      <div className="flex items-end gap-3 max-w-[92%]">
        <div className="worlds-home-mascot-wrap" aria-hidden>
          <span className="worlds-home-mascot-sparkle sparkle-a">✦</span>
          <span className="worlds-home-mascot-sparkle sparkle-b">✨</span>
          <span className="worlds-home-mascot-sparkle sparkle-c">✦</span>
          <div className="worlds-home-mascot">👩‍🏫</div>
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
            {/* v0.33.52 (Ep126 worlds-orb-tooltip): 进度 chip + 3 ⭐ tier */}
            {focus.unlocked && (
              <CenterPanelProgress
                accent={focus.accent}
                done={progressByWorld[focus.id] ?? 0}
              />
            )}
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
      {/* 推荐 / 开始按钮 — v0.32.59 (Ep35 N): chunky cta + accent glow
         v0.33.54 (Ep128 world-cta-particle-burst): 点击 burst 12 颗 sparkle */}
      <CtaStartButton
        recommended={recommended}
        onStart={onStart}
      />
    </div>
  );
}

/**
 * v0.33.52 (Ep126 worlds-orb-tooltip): CenterPanel 进度 chip 行
 *  - "✅ 已完成 N 单" chip （N=0 时显示 "还没开始 - 点击出发"）
 *  - 3 颗 ⭐ tier（沿用 Ep112 阈值：1+/5+/15+）
 *  - hover 不同 world 切换时 chip 内容随之更新
 */
/**
 * v0.33.54 (Ep128 world-cta-particle-burst): "出发去 X" CTA 按钮 + 点击 burst
 *  - 点击瞬间在按钮中心 spawn 12 颗 sparkle emoji 向外飞 + fade
 *  - 320ms 后 navigate (与外部 setTimeout 配套)
 *  - 单次性 burst：用 burstKey 递增触发 React re-render
 *  - prefers-reduced-motion: 跳过 burst，直接 navigate
 */
function CtaStartButton({
  recommended,
  onStart,
}: {
  recommended: WorldDef;
  onStart: () => void;
}) {
  const [burstKey, setBurstKey] = useState(0);
  const handleClick = () => {
    setBurstKey((k) => k + 1);
    onStart();
  };
  return (
    <div className="relative inline-block pointer-events-auto">
      <style>{`
        .cta-burst-particle {
          position: absolute;
          left: 50%;
          top: 50%;
          font-size: 16px;
          line-height: 1;
          pointer-events: none;
          filter: drop-shadow(0 0 6px var(--cta-glow, rgba(251, 191, 36, 0.85)));
          animation: cta-burst-fly 520ms cubic-bezier(.22, 1, .36, 1) forwards;
        }
        @keyframes cta-burst-fly {
          0%   { transform: translate(-50%, -50%) scale(0.4) rotate(0deg); opacity: 0; }
          18%  { transform: translate(calc(-50% + var(--burst-mx) * 0.3), calc(-50% + var(--burst-my) * 0.3)) scale(1.2) rotate(60deg); opacity: 1; }
          100% { transform: translate(calc(-50% + var(--burst-mx)), calc(-50% + var(--burst-my))) scale(0.6) rotate(220deg); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cta-burst-particle { animation: none; opacity: 0; }
        }
      `}</style>
      <button
        type="button"
        onClick={handleClick}
        className="world-cta-btn"
        style={
          {
            ["--world-accent" as string]: recommended.accent,
            boxShadow: `0 4px 0 rgba(0,0,0,0.2), 0 0 32px ${recommended.accent}aa, inset 0 1px 0 rgba(255,255,255,0.4)`,
          } as React.CSSProperties
        }
      >
        {recommended.emoji} 出发去 {recommended.name}
      </button>
      {/* burst particles —— key 变才 re-mount 触发 animation */}
      {burstKey > 0 && (
        <CtaBurst key={burstKey} accent={recommended.accent} />
      )}
    </div>
  );
}

function CtaBurst({ accent }: { accent: string }) {
  const glyphs = ["✨", "⭐", "💫", "🌟", "✦", "✧"];
  const N = 12;
  const particles = Array.from({ length: N }, (_, i) => {
    const angle = (i / N) * Math.PI * 2 + (i % 2) * 0.18;
    const dist = 80 + (i % 4) * 14; // 80-122px
    const mx = Math.cos(angle) * dist;
    const my = Math.sin(angle) * dist;
    const g = glyphs[i % glyphs.length]!;
    const delay = (i % 3) * 35;
    return { mx, my, g, delay, i };
  });
  return (
    <span
      aria-hidden
      style={
        {
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          ["--cta-glow" as string]: `${accent}d0`,
        } as React.CSSProperties
      }
    >
      {particles.map((p) => (
        <span
          key={p.i}
          className="cta-burst-particle"
          style={
            {
              ["--burst-mx" as string]: `${p.mx}px`,
              ["--burst-my" as string]: `${p.my}px`,
              animationDelay: `${p.delay}ms`,
            } as React.CSSProperties
          }
        >
          {p.g}
        </span>
      ))}
    </span>
  );
}

function CenterPanelProgress({
  accent,
  done,
}: {
  accent: string;
  done: number;
}) {
  const tier = done >= 15 ? 3 : done >= 5 ? 2 : done >= 1 ? 1 : 0;
  return (
    <div
      className="mt-1.5 flex items-center gap-2"
      style={
        { ["--cp-accent" as string]: accent } as React.CSSProperties
      }
    >
      <style>{`
        .cp-progress-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.32rem;
          padding: 0.18rem 0.52rem;
          border-radius: 999px;
          font-family: ui-monospace, monospace;
          font-size: 10.5px;
          font-weight: 900;
          letter-spacing: 0.04em;
          background: linear-gradient(180deg, #ffffff 0%, color-mix(in srgb, var(--cp-accent, #fbbf24) 18%, #ffffff) 100%);
          color: #0f172a;
          border: 1.5px solid var(--cp-accent, #fbbf24);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.18);
        }
        .cp-stars-row {
          display: inline-flex;
          gap: 1px;
          line-height: 1;
        }
        .cp-star {
          font-size: 11px;
          line-height: 1;
          filter: drop-shadow(0 0 4px var(--cp-accent, rgba(251, 191, 36, 0.8)));
          animation: cp-star-twinkle 2.1s ease-in-out infinite;
        }
        .cp-star.empty { opacity: 0.22; filter: none; animation: none; }
        @keyframes cp-star-twinkle {
          0%, 100% { transform: scale(0.92); opacity: 0.82; }
          50%      { transform: scale(1.18); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cp-star { animation: none; }
        }
      `}</style>
      <span className="cp-progress-chip">
        {done > 0 ? (
          <>
            <span aria-hidden>✅</span>
            <span>{done} 单</span>
          </>
        ) : (
          <>
            <span aria-hidden>🚀</span>
            <span>未开始</span>
          </>
        )}
      </span>
      <span className="cp-stars-row" aria-label={`${tier}/3 星`}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`cp-star${i < tier ? "" : " empty"}`}
            style={{ animationDelay: `${i * 280}ms` }}
            aria-hidden
          >
            ⭐
          </span>
        ))}
      </span>
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

/**
 * v0.33.48 (Ep122 worlds-home-tour-prompt): 首次进 worlds 4 步引导
 *  - localStorage `worlds_tour_done` 只触发一次
 *  - 4 步：标题 / 中央 mascot 推荐 / dock 进度 ⭐ / 开始按钮
 *  - 每步：spotlight ring + 箭头 + chunky speech bubble + Next/跳过
 *  - 最后一步只 "Got it"
 *  - URL `?tour=force` 强制再触发（dev/test）
 *  - prefers-reduced-motion: 关 spotlight 呼吸，仅显示 chunky bubble
 */
const TOUR_STORAGE_KEY = "worlds_tour_done_v1";

interface TourStep {
  title: string;
  body: string;
  /** spotlight 矩形（百分比） — 高亮区域，null 则不画 ring */
  spot?: { left: string; top: string; width: string; height: string };
  /** 文字 bubble 位置 */
  bubble: { left?: string; top?: string; right?: string; bottom?: string };
  /** bubble 朝向（决定箭头方向） */
  arrow: "up" | "down";
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "✦ 奇遇乐园",
    body: "欢迎来到 Selena 的 worlds！这里有 3 个魔法世界等你冒险。",
    bubble: { left: "50%", top: "55%" },
    arrow: "up",
  },
  {
    title: "👩‍🏫 中央推荐",
    body: "中间小老师会告诉你建议玩哪个世界。点开始就直接进。",
    spot: { left: "20%", top: "30%", width: "60%", height: "30%" },
    bubble: { left: "50%", top: "70%" },
    arrow: "up",
  },
  {
    title: "⭐ 进度勋章",
    body: "下面 dock 上面每个世界都有 ⭐ 进度章。做单越多，亮的星越多！",
    spot: { left: "5%", top: "70%", width: "90%", height: "20%" },
    bubble: { left: "50%", top: "40%" },
    arrow: "down",
  },
  {
    title: "🚀 开始冒险",
    body: "随时点 dock chip 进入任意世界。准备好了吗？",
    bubble: { left: "50%", top: "50%" },
    arrow: "up",
  },
];

function WorldsHomeTour() {
  const [stepIdx, setStepIdx] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const forced =
      new URLSearchParams(window.location.search).get("tour") === "force";
    if (forced) return 0;
    try {
      if (localStorage.getItem(TOUR_STORAGE_KEY)) return null;
    } catch {
      /* SSR / no storage */
    }
    return 0;
  });
  if (stepIdx == null) return null;
  const step = TOUR_STEPS[stepIdx];
  if (!step) return null;
  const isLast = stepIdx === TOUR_STEPS.length - 1;
  const finish = () => {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setStepIdx(null);
  };
  const next = () => {
    if (isLast) finish();
    else setStepIdx(stepIdx + 1);
  };
  return (
    <div
      className="absolute inset-0 pointer-events-auto"
      style={{ zIndex: 90 }}
      aria-modal="true"
      role="dialog"
    >
      <style>{`
        .worlds-tour-bg {
          position: absolute;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(2px);
        }
        .worlds-tour-spot {
          position: absolute;
          border: 3px dashed #fde68a;
          border-radius: 18px;
          box-shadow:
            0 0 0 9999px rgba(15, 23, 42, 0.55),
            0 0 24px rgba(253, 224, 71, 0.7);
          pointer-events: none;
          animation: worlds-tour-spot-pulse 2.2s ease-in-out infinite;
        }
        @keyframes worlds-tour-spot-pulse {
          0%, 100% { box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.55), 0 0 18px rgba(253, 224, 71, 0.6); }
          50%      { box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.55), 0 0 32px rgba(253, 224, 71, 0.92); }
        }
        .worlds-tour-bubble {
          position: absolute;
          transform: translate(-50%, -50%);
          max-width: min(86vw, 360px);
          padding: 1rem 1.2rem 1rem;
          background: linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%);
          color: #451a03;
          border: 3px solid #f59e0b;
          border-radius: 16px;
          box-shadow:
            0 0 0 4px rgba(245, 158, 11, 0.28),
            0 16px 36px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.65);
          animation: worlds-tour-bubble-in 320ms cubic-bezier(.34, 1.56, .64, 1);
        }
        @keyframes worlds-tour-bubble-in {
          0%   { transform: translate(-50%, -50%) scale(0.6); opacity: 0; }
          70%  { transform: translate(-50%, -50%) scale(1.05); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
        .worlds-tour-arrow {
          position: absolute;
          left: 50%;
          width: 0;
          height: 0;
          border-left: 14px solid transparent;
          border-right: 14px solid transparent;
          transform: translateX(-50%);
        }
        .worlds-tour-arrow.up {
          top: -14px;
          border-bottom: 14px solid #f59e0b;
        }
        .worlds-tour-arrow.down {
          bottom: -14px;
          border-top: 14px solid #f59e0b;
        }
        .worlds-tour-title {
          font-size: 16px;
          font-weight: 900;
          color: #7c2d12;
          letter-spacing: 0.04em;
          margin-bottom: 0.4rem;
        }
        .worlds-tour-body {
          font-size: 13px;
          line-height: 1.5;
          color: #451a03;
          margin-bottom: 0.95rem;
        }
        .worlds-tour-progress {
          display: flex;
          gap: 6px;
          margin-bottom: 0.85rem;
        }
        .worlds-tour-dot {
          width: 8px; height: 8px; border-radius: 999px;
          background: rgba(120, 53, 15, 0.28);
        }
        .worlds-tour-dot.is-active {
          background: #f59e0b;
          box-shadow: 0 0 8px rgba(245, 158, 11, 0.7);
        }
        .worlds-tour-actions {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
        }
        .worlds-tour-btn {
          padding: 0.5rem 0.9rem;
          border-radius: 10px;
          font-weight: 900;
          font-size: 12.5px;
          letter-spacing: 0.05em;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 0 rgba(0, 0, 0, 0.15);
        }
        .worlds-tour-btn-primary {
          background: linear-gradient(180deg, #fbbf24, #f59e0b);
          color: #ffffff;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.25);
          box-shadow:
            0 3px 0 rgba(0, 0, 0, 0.15),
            0 6px 14px rgba(245, 158, 11, 0.45);
        }
        .worlds-tour-btn-primary:hover { filter: brightness(1.08); transform: translateY(-1px); }
        .worlds-tour-btn-ghost {
          background: rgba(120, 53, 15, 0.06);
          color: #92400e;
          border-color: rgba(120, 53, 15, 0.3);
        }
        .worlds-tour-btn-ghost:hover { background: rgba(120, 53, 15, 0.12); }
        @media (prefers-reduced-motion: reduce) {
          .worlds-tour-spot { animation: none; }
          .worlds-tour-bubble { animation: none; }
        }
      `}</style>
      <div className="worlds-tour-bg" />
      {step.spot && (
        <div
          className="worlds-tour-spot"
          style={{
            left: step.spot.left,
            top: step.spot.top,
            width: step.spot.width,
            height: step.spot.height,
          }}
        />
      )}
      <div
        className="worlds-tour-bubble"
        style={{
          left: step.bubble.left,
          top: step.bubble.top,
          right: step.bubble.right,
          bottom: step.bubble.bottom,
        }}
      >
        <div className={`worlds-tour-arrow ${step.arrow}`} aria-hidden />
        <div className="worlds-tour-title">{step.title}</div>
        <div className="worlds-tour-body">{step.body}</div>
        <div className="worlds-tour-progress" aria-hidden>
          {TOUR_STEPS.map((_, i) => (
            <span
              key={i}
              className={`worlds-tour-dot${i === stepIdx ? " is-active" : ""}`}
            />
          ))}
        </div>
        <div className="worlds-tour-actions">
          {!isLast && (
            <button
              type="button"
              className="worlds-tour-btn worlds-tour-btn-ghost"
              onClick={finish}
            >
              跳过
            </button>
          )}
          <button
            type="button"
            className="worlds-tour-btn worlds-tour-btn-primary"
            onClick={next}
          >
            {isLast ? "知道啦 ✨" : `下一步 → ${stepIdx + 2}/${TOUR_STEPS.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}
