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
            className="rounded-2xl border-[3px] border-amber-400 px-5 py-3 shadow-2xl"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,251,235,0.92))",
              backdropFilter: "blur(10px)",
              minWidth: 280,
              maxWidth: 420,
            }}
          >
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

            {/* 进度条 */}
            <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: "linear-gradient(90deg, #fbbf24, #f97316)",
                }}
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

        <div className="pointer-events-none px-3 py-2 rounded-xl bg-amber-500/85 text-white text-xs font-bold backdrop-blur-md border border-amber-200/40 shadow-lg whitespace-nowrap">
          ✨ {decorations}
        </div>
      </div>

      {/* 底部提示 */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl bg-black/55 text-white text-xs backdrop-blur-md border border-white/20 pointer-events-none shadow-lg max-w-[92%] text-center"
        style={{ zIndex: 55 }}
      >
        {hoverBuilding ? (
          hoverBuilding.active ? (
            <span>
              <span className="text-base mr-1">{hoverBuilding.emoji}</span>
              点击进入 <b>{hoverBuilding.name}</b>
              <span className="text-amber-200 ml-1">· {hoverBuilding.skillHint}</span>
            </span>
          ) : (
            <span>
              <span className="text-base mr-1">🔒</span>
              <b>{hoverBuilding.name}</b>
              <span className="text-slate-300 ml-1">· {hoverBuilding.tagline}</span>
            </span>
          )
        ) : (
          <span>🖱️ 拖动旋转 · 滚轮缩放 · 点亮 3 栋建筑（小卖部 / 银行 / 面包店）出发</span>
        )}
      </div>
    </>
  );
}
