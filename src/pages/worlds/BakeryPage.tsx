/**
 * v0.32.5: 甜心面包店 第一人称柜台 mini-game page。
 *
 * 路径: /worlds/baibao/bakery
 *
 * 玩法: 3 单切蛋糕 cycle (¼/⅓/½) → +XP + 装饰碎片 → 回 baibao 地图
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorldsCanvas } from "../../components/worlds/WorldsCanvas";
import { StoreEnvironment } from "../../components/worlds/store/StoreScene";
import { BakeryMiniGame } from "../../components/worlds/bakery/BakeryMiniGame";
import { BAKERY_ORDERS, type BakeryOrder } from "../../lib/worlds/bakeryOrders";
import { incrementBuildingComplete } from "../../lib/worlds/worldsProgress";
import { MascotPIP } from "../../components/atelier/MascotPIP";
import { useMascotReaction, type MascotMood } from "../../lib/worlds/useMascotReaction";
import { useWorldFeedback } from "../../lib/worlds/useWorldFeedback";
import { WorldFeedbackOverlay } from "../../components/worlds/WorldFeedbackOverlay";
import { useBgm } from "../../lib/worlds/useBGM";
import { BgmMuteButton } from "../../components/worlds/BgmMuteButton";

type Phase = "intro" | "slicing";

export function BakeryPage() {
  const navigate = useNavigate();
  const [orderIdx, setOrderIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("intro");
  const [completedCount, setCompletedCount] = useState(0);
  const [showReward, setShowReward] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const order = BAKERY_ORDERS[orderIdx]!;

  // R3F cold start 由 WorldsCanvas 接管

  const mood: MascotMood = showReward
    ? "allDone"
    : justCompleted
      ? "orderDone"
      : phase === "intro"
        ? "welcome"
        : "playing";
  const mascotProps = useMascotReaction({ mood, accent: "#ec4899" });
  // v0.32.12-14：反馈层 + Mascot 联动
  // v0.32.23: rootRef → screen shake / zoom
  const { trigger, pulses, lastReaction, rootRef } = useWorldFeedback();
  // v0.32.21: BGM
  useBgm("bakery");

  const handleOrderComplete = async () => {
    const newCount = completedCount + 1;
    setCompletedCount(newCount);
    setJustCompleted(true);
    window.setTimeout(() => setJustCompleted(false), 1800);
    if (newCount >= BAKERY_ORDERS.length) {
      trigger("complete", "+5 XP · 客人都满意！");
      await incrementBuildingComplete("bakery");
      setShowReward(true);
      window.setTimeout(() => navigate("/worlds/baibao"), 2800);
    } else {
      trigger("correct", `${newCount}/${BAKERY_ORDERS.length} 单完成`);
      setOrderIdx(newCount);
      setPhase("intro");
    }
  };

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 bg-pink-50"
      style={{ zIndex: 50 }}
    >
      <WorldsCanvas
        camera={{ position: [0, 1.55, 1.6], fov: 50, near: 0.05, far: 50 }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 1.0, -0.5);
        }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        loadingBg="#fce7f3"
        loadingEmoji="🥖"
        loadingTitle="面包店烘焙中…"
      >
        <color attach="background" args={["#fce7f3"]} />
        {/* 灯光: 暖粉色面包店氛围 */}
        <ambientLight intensity={0.6} />
        <hemisphereLight args={["#fce7f3", "#831843", 1.0]} />
        <directionalLight position={[3, 4, 2]} intensity={1.3} color="#fff5da" />
        <pointLight position={[0, 2.5, -1]} intensity={0.7} color="#fda4af" />

        <StoreEnvironment variant="bakery" />

        {phase === "slicing" && (
          <BakeryMiniGame
            order={order}
            onOrderComplete={handleOrderComplete}
            onFeedback={trigger}
          />
        )}
      </WorldsCanvas>

      <TopHUD
        orderIdx={orderIdx}
        completedCount={completedCount}
        onBack={() => navigate("/worlds/baibao")}
      />

      <CustomerBubble
        emoji={order.customerEmoji}
        line={order.customerLine}
        hint={
          phase === "slicing"
            ? order.requireContiguous !== false
              ? `要 ${order.needSlices} 块连成一片（共 12 块）`
              : `要 ${order.needSlices} 块（共 12 块）`
            : undefined
        }
      />

      {phase === "intro" && !showReward && (
        <IntroPanel
          order={order}
          orderIdx={orderIdx}
          onStart={() => setPhase("slicing")}
        />
      )}

      {showReward && <RewardOverlay />}

      <MascotPIP
        gesture={mascotProps.gesture}
        emotion={mascotProps.emotion}
        outfit={mascotProps.outfit}
        skin={mascotProps.skin}
        line={mascotProps.line}
        accent={mascotProps.accent}
        reaction={lastReaction}
      />

      <BgmMuteButton accent="#ec4899" />

      <WorldFeedbackOverlay pulses={pulses} />
    </div>
  );
}

function TopHUD({
  orderIdx,
  completedCount,
  onBack,
}: {
  orderIdx: number;
  completedCount: number;
  onBack: () => void;
}) {
  return (
    <div
      className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none"
      style={{ zIndex: 60 }}
    >
      <button
        type="button"
        onClick={onBack}
        className="pointer-events-auto px-3 py-2 rounded-xl bg-black/55 text-white text-sm font-bold backdrop-blur-md hover:bg-black/70 border border-white/25 shadow-lg"
      >
        ← 离开
      </button>
      <div className="px-4 py-2 rounded-full bg-pink-500/90 text-white text-xs font-bold backdrop-blur-md border border-white/30 shadow-lg">
        🥖 甜心面包店
      </div>
      <div className="px-3 py-2 rounded-xl bg-black/55 text-white text-xs font-bold backdrop-blur-md border border-white/25 shadow-lg">
        客人 {completedCount + (orderIdx === completedCount ? 0 : 1)}/{BAKERY_ORDERS.length}
      </div>
    </div>
  );
}

function CustomerBubble({
  emoji,
  line,
  hint,
}: {
  emoji: string;
  line: string;
  hint?: string;
}) {
  return (
    <div
      className="absolute pointer-events-none flex items-end gap-3"
      style={{
        zIndex: 55,
        left: "50%",
        transform: "translateX(-50%)",
        top: "12%",
      }}
    >
      <div className="text-7xl drop-shadow-2xl">{emoji}</div>
      <div className="max-w-md">
        <div className="px-4 py-2.5 rounded-2xl bg-white/95 text-slate-900 text-sm font-medium shadow-2xl border-2 border-pink-200 relative">
          {line}
          {hint && (
            <div className="mt-1 text-xs text-pink-700 font-bold">💡 {hint}</div>
          )}
          <span className="absolute -left-2 bottom-3 w-0 h-0 border-y-8 border-y-transparent border-r-8 border-r-white/95" />
        </div>
      </div>
    </div>
  );
}

function IntroPanel({
  order,
  orderIdx,
  onStart,
}: {
  order: BakeryOrder;
  orderIdx: number;
  onStart: () => void;
}) {
  return (
    <div
      className="absolute pointer-events-none inset-0 flex items-end justify-center pb-12"
      style={{ zIndex: 60 }}
    >
      <div className="pointer-events-auto card bg-white/95 backdrop-blur-md p-5 shadow-2xl border-2 border-pink-300 max-w-md text-center">
        <div className="text-pink-700 text-xs font-bold mb-1">订单 #{orderIdx + 1}</div>
        <div className="text-slate-900 text-sm leading-relaxed mb-3">
          {order.customerLine}
        </div>
        <div className="text-xs text-slate-600 mb-3">
          <div className="px-3 py-2 rounded-lg bg-pink-50 border border-pink-200">
            <div className="text-pink-700 font-bold mb-0.5">
              要 {order.fractionLabel} 个 {order.emoji}
            </div>
            <div className="font-mono text-pink-900 text-base">
              = {order.needSlices} / 12 块
            </div>
          </div>
        </div>
        {order.hint && (
          <div className="text-xs text-slate-500 italic mb-3">💡 {order.hint}</div>
        )}
        <button
          type="button"
          onClick={onStart}
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white text-base font-bold shadow-xl border-2 border-white/40 hover:scale-105 transition-transform"
        >
          🍰 开始切块
        </button>
      </div>
    </div>
  );
}

function RewardOverlay() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{
        zIndex: 70,
        background: "radial-gradient(circle, rgba(251,113,133,0.3) 0%, rgba(0,0,0,0) 70%)",
      }}
    >
      <div className="text-center animate-bounce">
        <div className="text-8xl mb-3">🎂</div>
        <div className="px-6 py-3 rounded-2xl bg-pink-500 text-white text-2xl font-bold shadow-2xl border-2 border-white">
          +5 XP · +1 装饰碎片
        </div>
        <div className="mt-2 text-pink-900 text-sm font-medium drop-shadow">
          客人们都满意～回到百宝港
        </div>
      </div>
    </div>
  );
}
