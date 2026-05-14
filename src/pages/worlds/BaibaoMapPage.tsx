/**
 * v0.32.0: 百宝港 (数学地图) 主场景 —— 俯视小镇 + 6 个建筑 + 装饰。
 *
 * 路径: /worlds/baibao
 *
 * Sprint 1: 小卖部/银行/面包店 active；其他 3 建设中。
 * 装饰物：完成 1 / 5 / 10 / 20 / 50 单分别加灯/亮/树/彩灯/飞鸟。
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { OrbitControls } from "@react-three/drei";
import { WorldsCanvas } from "../../components/worlds/WorldsCanvas";
import { BaibaoTownMap } from "../../components/worlds/BaibaoTownMap";
import {
  BAIBAO_BUILDINGS,
  type BaibaoBuilding,
} from "../../content/worlds/baibao";
import {
  getBuildingCompleteCount,
  getDecorationShards,
} from "../../lib/worlds/worldsProgress";

export function BaibaoMapPage() {
  const navigate = useNavigate();
  const [hoverBuilding, setHoverBuilding] = useState<BaibaoBuilding | null>(null);
  const [decorations, setDecorations] = useState(0);
  // v0.32.57 (Ep33 M): per-building 完成次数 → hero 进度横幅 + medal row
  const [buildingStats, setBuildingStats] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = await getDecorationShards();
      // 并行拉 active building 的完成次数
      const active = BAIBAO_BUILDINGS.filter((b) => b.active);
      const counts = await Promise.all(active.map((b) => getBuildingCompleteCount(b.id)));
      const stats: Record<string, number> = {};
      active.forEach((b, i) => {
        stats[b.id] = counts[i] ?? 0;
      });
      if (!cancelled) {
        setDecorations(c);
        setBuildingStats(stats);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      document.body.style.cursor = "default";
    };
  }, []);

  const handleSelectBuilding = (b: BaibaoBuilding) => {
    if (!b.active) return;
    navigate(b.route);
  };

  return (
    <div className="fixed inset-0 bg-sky-200 world-page-enter" style={{ zIndex: 50 }}>
      <WorldsCanvas
        camera={{ position: [0, 14, 20], fov: 50, near: 0.1, far: 200 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        loadingBg="#87ceeb"
        loadingEmoji="🏪"
        loadingTitle="百宝港加载中…"
      >
        {/* 背景 + 雾 */}
        <color attach="background" args={["#87ceeb"]} />
        <fog attach="fog" args={["#bce7f9", 30, 100]} />

        {/* 灯光 */}
        <hemisphereLight args={["#fff7e0", "#88aa88", 1.2]} />
        <directionalLight position={[10, 15, 8]} intensity={1.4} color="#fff5da" />
        <ambientLight intensity={0.35} />

        {/* 小镇（KayKit GLTF；WorldsCanvas 顶层 Suspense 接管 loading） */}
        <BaibaoTownMap
          onSelectBuilding={handleSelectBuilding}
          onHoverBuilding={setHoverBuilding}
          decorationCount={decorations}
        />

        {/* OrbitControls：拖动旋转，限制范围 */}
        <OrbitControls
          enablePan={false}
          enableZoom
          minDistance={10}
          maxDistance={28}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.1}
          target={[0, 1, 0]}
          enableDamping
          dampingFactor={0.08}
        />
      </WorldsCanvas>

      {/* HUD */}
      <HUD
        decorations={decorations}
        hoverBuilding={hoverBuilding}
        buildingStats={buildingStats}
      />
    </div>
  );
}

interface HUDProps {
  decorations: number;
  hoverBuilding: BaibaoBuilding | null;
  buildingStats: Record<string, number>;
}

function HUD({ decorations, hoverBuilding, buildingStats }: HUDProps) {
  const navigate = useNavigate();
  // v0.32.57 (Ep33 M): hero 进度数据
  const active = BAIBAO_BUILDINGS.filter((b) => b.active);
  const doneCount = active.filter((b) => (buildingStats[b.id] ?? 0) > 0).length;
  const totalRuns = active.reduce((sum, b) => sum + (buildingStats[b.id] ?? 0), 0);
  const pct = Math.round((doneCount / Math.max(active.length, 1)) * 100);

  return (
    <>
      {/* v0.32.70 (Ep46 YY): done medal chip 持续 glow pulse + icon pop */}
      <style>{`
        @keyframes baibao-medal-glow {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 2px 0 rgba(0,0,0,0.08), 0 0 0 rgba(251,191,36,0);
          }
          50% {
            transform: scale(1.055);
            box-shadow: 0 3px 0 rgba(0,0,0,0.1), 0 0 18px rgba(251,191,36,0.7);
          }
        }
        @keyframes baibao-medal-icon-pop {
          0%, 100% { transform: scale(1) rotate(-4deg); }
          50%      { transform: scale(1.18) rotate(6deg); }
        }
        .baibao-medal-chip-done {
          background: linear-gradient(180deg, #fff7ed, #fde68a) !important;
          border-color: #f59e0b !important;
          color: #78350f !important;
          animation: baibao-medal-glow 2.6s ease-in-out infinite;
          will-change: transform, box-shadow;
        }
        .baibao-medal-chip-done .baibao-medal-icon {
          display: inline-block;
          animation: baibao-medal-icon-pop 2.6s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .baibao-medal-chip-done,
          .baibao-medal-chip-done .baibao-medal-icon {
            animation: none;
          }
        }
        /* v0.32.71 (Ep47 BBB): hover tooltip chunky 化 — 3 态：idle / active / locked
           替代 bg-black/55 + white text 朴素 chip */
        .baibao-tooltip {
          position: absolute;
          bottom: 1rem;
          left: 50%;
          transform: translateX(-50%);
          max-width: min(92vw, 460px);
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.65rem 1rem 0.65rem 0.75rem;
          border-radius: 1.1rem;
          border: 3px solid var(--tooltip-accent, #38bdf8);
          background: linear-gradient(180deg, #ffffff 0%, #fffbeb 100%);
          color: #0f172a;
          font-weight: 900;
          font-size: 12.5px;
          letter-spacing: 0.01em;
          text-align: left;
          box-shadow:
            0 4px 0 rgba(0,0,0,0.14),
            0 14px 28px rgba(0,0,0,0.28),
            inset 0 1px 0 rgba(255,255,255,0.95);
          animation: baibao-tooltip-pop 240ms cubic-bezier(.34,1.56,.64,1);
          z-index: 55;
        }
        .baibao-tooltip-badge {
          flex: 0 0 auto;
          width: 2.1rem;
          height: 2.1rem;
          border-radius: 50%;
          background: var(--tooltip-accent, #38bdf8);
          color: #fff;
          display: grid;
          place-items: center;
          font-size: 1.15rem;
          box-shadow: 0 3px 0 rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.4);
        }
        .baibao-tooltip-copy {
          display: flex;
          flex-direction: column;
          gap: 0.05rem;
          line-height: 1.25;
          min-width: 0;
        }
        .baibao-tooltip-title {
          font-size: 13px;
          font-weight: 900;
          color: #0f172a;
        }
        .baibao-tooltip-sub {
          font-size: 11px;
          font-weight: 800;
          color: var(--tooltip-accent, #0e7490);
          letter-spacing: 0.02em;
        }
        @keyframes baibao-tooltip-pop {
          0%   { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.96); }
          60%  { opacity: 1; transform: translateX(-50%) translateY(-2px) scale(1.02); }
          100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .baibao-tooltip { animation: none; }
        }
        /* v0.32.76 (Ep52 CCC): hero progress bar gradient shimmer 横扫
           替代原 h-2 rounded-full slate-200 朴素进度条 */
        .baibao-progress-track {
          position: relative;
          margin-top: 0.55rem;
          height: 12px;
          border-radius: 999px;
          overflow: hidden;
          background: linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%);
          border: 2px solid rgba(251, 191, 36, 0.45);
          box-shadow: inset 0 1px 2px rgba(0,0,0,0.08);
        }
        .baibao-progress-fill {
          position: relative;
          height: 100%;
          width: var(--baibao-pct, 0%);
          background: linear-gradient(
            90deg,
            #fbbf24 0%,
            #fb923c 35%,
            #f472b6 70%,
            #38bdf8 100%
          );
          border-radius: 999px;
          box-shadow:
            0 0 14px rgba(251, 191, 36, 0.75),
            inset 0 1px 0 rgba(255, 255, 255, 0.5);
          transition: width 600ms cubic-bezier(.34, 1.56, .64, 1);
          overflow: hidden;
        }
        .baibao-progress-fill::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            100deg,
            transparent 30%,
            rgba(255, 255, 255, 0.85) 50%,
            transparent 70%
          );
          background-size: 200% 100%;
          animation: baibao-progress-sweep 1.8s linear infinite;
        }
        @keyframes baibao-progress-sweep {
          0%   { background-position: -100% 0; }
          100% { background-position: 200% 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .baibao-progress-fill::after { animation: none; }
        }
        /* v0.32.77 (Ep53 SS): decorations chip chunky 化 — 替代右上角 bg-amber/85 朴素 */
        .baibao-deco-chip {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.55rem 0.95rem 0.55rem 0.75rem;
          border-radius: 999px;
          border: 3px solid #fbbf24;
          background: linear-gradient(180deg, #fffbeb 0%, #fcd34d 100%);
          color: #78350f;
          font-weight: 900;
          font-size: 13px;
          letter-spacing: 0.02em;
          box-shadow:
            0 4px 0 rgba(0, 0, 0, 0.16),
            0 0 22px rgba(251, 191, 36, 0.6),
            inset 0 1px 0 rgba(255, 255, 255, 0.65);
          animation: baibao-deco-chip-glow 2.8s ease-in-out infinite;
          white-space: nowrap;
        }
        @keyframes baibao-deco-chip-glow {
          0%, 100% { box-shadow: 0 4px 0 rgba(0,0,0,0.16), 0 0 16px rgba(251,191,36,0.5), inset 0 1px 0 rgba(255,255,255,0.65); }
          50%      { box-shadow: 0 4px 0 rgba(0,0,0,0.16), 0 0 30px rgba(251,191,36,0.9), inset 0 1px 0 rgba(255,255,255,0.7); }
        }
        .baibao-deco-chip-icon {
          display: inline-block;
          font-size: 14px;
          line-height: 1;
          animation: baibao-deco-spark-pop 2.8s ease-in-out infinite;
        }
        @keyframes baibao-deco-spark-pop {
          0%, 100% { transform: scale(1) rotate(-8deg); }
          50%      { transform: scale(1.25) rotate(8deg); }
        }
        .baibao-deco-chip-num {
          font-variant-numeric: tabular-nums;
          font-size: 14px;
        }
        .baibao-deco-chip-label {
          font-size: 9.5px;
          opacity: 0.75;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }
        @media (prefers-reduced-motion: reduce) {
          .baibao-deco-chip,
          .baibao-deco-chip-icon {
            animation: none;
          }
        }
        /* v0.33.6 (Ep82 KKKKKKK): baibao hero card 顶部 chunky banner —
           突出"航海冒险"主题，hero card 顶端浮一道带 emoji 的 ribbon。 */
        .baibao-hero-card {
          position: relative;
          overflow: visible;
          padding-top: 1.4rem !important;
        }
        .baibao-hero-banner {
          position: absolute;
          left: 50%;
          top: 0;
          transform: translate(-50%, -52%);
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.32rem 0.85rem;
          border-radius: 999px;
          background: linear-gradient(180deg, #fbbf24 0%, #f97316 100%);
          color: #ffffff;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.22);
          border: 2.5px solid #ffffff;
          box-shadow:
            0 3px 0 rgba(0, 0, 0, 0.16),
            0 8px 18px rgba(245, 158, 11, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.55);
          white-space: nowrap;
          max-width: 86%;
          animation: baibao-hero-banner-pulse 2.6s ease-in-out infinite;
        }
        .baibao-hero-banner-icon {
          font-size: 13px;
          line-height: 1;
          filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.6));
        }
        @keyframes baibao-hero-banner-pulse {
          0%, 100% { box-shadow: 0 3px 0 rgba(0,0,0,0.16), 0 6px 14px rgba(245,158,11,0.45), inset 0 1px 0 rgba(255,255,255,0.55); }
          50%      { box-shadow: 0 3px 0 rgba(0,0,0,0.16), 0 10px 24px rgba(245,158,11,0.7),  inset 0 1px 0 rgba(255,255,255,0.55); }
        }
        @media (prefers-reduced-motion: reduce) {
          .baibao-hero-banner { animation: none; }
        }
      `}</style>
      <div
        className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none"
        style={{ zIndex: 60 }}
      >
        <button
          type="button"
          onClick={() => navigate("/worlds")}
          className="pointer-events-auto px-3 py-2 rounded-xl bg-black/55 text-white text-sm font-bold backdrop-blur-md hover:bg-black/70 border border-white/25 shadow-lg"
        >
          ← 奇遇乐园
        </button>

        {/* v0.32.57 (Ep33 M): Hero 横幅 — 标题 + 进度条 + 各店奖牌 */}
        <div className="pointer-events-none flex-1 mx-3 flex justify-center">
          <div
            className="baibao-hero-card rounded-2xl border-[3px] border-amber-400 px-5 py-3 shadow-2xl"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,251,235,0.92))",
              backdropFilter: "blur(10px)",
              minWidth: 280,
              maxWidth: 420,
            }}
          >
            {/* v0.33.6 (Ep82 KKKKKKK): chunky 锚⚓ banner — 浮在 hero card 上沿 */}
            <div className="baibao-hero-banner" aria-hidden>
              <span className="baibao-hero-banner-icon">⚓</span>
              <span>{pct >= 100 ? "Harbor Lit" : "Harbor Quest"}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                  Math Harbor
                </div>
                <div className="text-xl font-black text-slate-900 leading-tight">
                  🏪 百宝港
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase text-slate-500">
                  已点亮
                </div>
                <div className="text-base font-black text-amber-700 leading-tight">
                  {doneCount}/{active.length}
                </div>
              </div>
            </div>

            {/* v0.32.76 (Ep52 CCC): hero progress bar w/ gradient shimmer 横扫 */}
            <div
              className="baibao-progress-track"
              role="meter"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`百宝港点亮进度 ${pct}%`}
            >
              <div
                className="baibao-progress-fill"
                style={{ ["--baibao-pct" as string]: `${pct}%` } as React.CSSProperties}
              />
            </div>

            {/* 各店奖牌 + 完成次数 chip */}
            <div className="mt-2 flex flex-wrap gap-1.5 justify-center">
              {active.map((b, i) => {
                const cnt = buildingStats[b.id] ?? 0;
                const done = cnt > 0;
                return (
                  <span
                    key={b.id}
                    className={`rounded-full px-2 py-1 text-[11px] font-bold border ${
                      done
                        ? "baibao-medal-chip-done"
                        : "bg-slate-100 border-slate-300 text-slate-500"
                    }`}
                    style={done ? { animationDelay: `${i * 200}ms` } : undefined}
                    title={b.name}
                  >
                    <span className="mr-0.5">{b.emoji}</span>
                    <span className={`mr-0.5${done ? " baibao-medal-icon" : ""}`}>
                      {done ? "🏅" : "○"}
                    </span>
                    <span className="font-mono">{cnt}</span>
                  </span>
                );
              })}
              {totalRuns > 0 && (
                <span className="rounded-full bg-orange-100 border border-orange-300 px-2 py-1 text-[11px] font-bold text-orange-800">
                  总单 {totalRuns}
                </span>
              )}
            </div>
          </div>
        </div>

        <div
          className="pointer-events-none baibao-deco-chip"
          aria-label={`百宝港装饰 ${decorations} 个`}
          title={`已积累 ${decorations} 个装饰碎片`}
        >
          <span className="baibao-deco-chip-icon">✨</span>
          <span className="baibao-deco-chip-label hidden sm:inline">Decor</span>
          <span className="baibao-deco-chip-num">{decorations}</span>
        </div>
      </div>

      {/* v0.32.71 (Ep47 BBB): chunky 底部 hover tooltip — idle / active / locked 三态 */}
      <BaibaoHoverTooltip hoverBuilding={hoverBuilding} />
    </>
  );
}

function BaibaoHoverTooltip({ hoverBuilding }: { hoverBuilding: BaibaoBuilding | null }) {
  const mode: "idle" | "active" | "locked" = !hoverBuilding
    ? "idle"
    : hoverBuilding.active
      ? "active"
      : "locked";
  // accent 色：idle cyan / active 该店色 / locked 灰
  const accent =
    mode === "active"
      ? (hoverBuilding!.color ?? "#f59e0b")
      : mode === "locked"
        ? "#94a3b8"
        : "#0ea5e9";
  return (
    <div
      key={hoverBuilding?.id ?? "idle"}
      className={`baibao-tooltip baibao-tooltip-${mode}`}
      style={{ ["--tooltip-accent" as string]: accent } as React.CSSProperties}
    >
      <span className="baibao-tooltip-badge">
        {mode === "idle" ? "🧭" : mode === "locked" ? "🔒" : hoverBuilding!.emoji}
      </span>
      <span className="baibao-tooltip-copy">
        {mode === "active" ? (
          <>
            <span className="baibao-tooltip-title">
              点击进入 {hoverBuilding!.name}
            </span>
            <span className="baibao-tooltip-sub">
              {hoverBuilding!.skillHint}
            </span>
          </>
        ) : mode === "locked" ? (
          <>
            <span className="baibao-tooltip-title">{hoverBuilding!.name}</span>
            <span className="baibao-tooltip-sub">{hoverBuilding!.tagline}</span>
          </>
        ) : (
          <>
            <span className="baibao-tooltip-title">拖动旋转 · 滚轮缩放</span>
            <span className="baibao-tooltip-sub">
              点亮 3 栋建筑（小卖部 / 银行 / 面包店）出发
            </span>
          </>
        )}
      </span>
    </div>
  );
}
