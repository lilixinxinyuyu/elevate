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

  // v0.32.41: useWorldFeedback 提前
  const { trigger, pulses, lastReaction, rootRef } = useWorldFeedback();

  const mood: MascotMood = showReward
    ? "allDone"
    : justCompleted
      ? "orderDone"
      : phase === "intro"
        ? "welcome"
        : "playing";
  const mascotProps = useMascotReaction({ mood, accent: "#ec4899", reaction: lastReaction });
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
      className="fixed inset-0 bg-pink-50 world-theme-bakery"
      style={{ zIndex: 50 }}
    >
      <WorldsCanvas
        camera={{ position: [0, 1.6, 2.2], fov: 55, near: 0.05, far: 50 }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 1.3, -0.6);
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
      <button type="button" onClick={onBack} className="world-chip world-chip-dark">
        ← 离开
      </button>
      <div className="world-chip">🥖 甜心面包店</div>
      <div className="world-chip world-chip-dark">
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
      <div className="world-customer-bubble-avatar">{emoji}</div>
      <div className="max-w-md">
        <div className="world-customer-bubble-card">
          {line}
          {hint && <div className="world-customer-bubble-hint">💡 {hint}</div>}
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
      <div className="pointer-events-auto world-panel max-w-md text-center">
        <div className="world-panel-title">订单 #{orderIdx + 1}</div>
        <div className="text-slate-900 text-sm leading-relaxed mb-3">
          {order.customerLine}
        </div>
        <div className="text-xs mb-3">
          <div className="world-panel-stat text-pink-700">
            <div className="font-bold text-[11px] uppercase">
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
        <button type="button" onClick={onStart} className="world-cta-btn">
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
        <div className="world-reward-badge">+5 XP · +1 装饰碎片</div>
        <div className="mt-3 text-pink-900 text-sm font-bold drop-shadow">
          客人们都满意～回到百宝港
        </div>
      </div>
    </div>
  );
}
