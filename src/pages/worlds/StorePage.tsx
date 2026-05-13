/**
 * v0.32.3: 和平小卖部第一人称柜台 mini-game page。
 *
 * 路径: /worlds/baibao/store
 *
 * 流程: 3 单 cycle (扫码 → 找零) → +XP + 装饰碎片 → 回 baibao 地图
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorldsCanvas } from "../../components/worlds/WorldsCanvas";
import { StoreEnvironment } from "../../components/worlds/store/StoreScene";
import {
  StoreMiniGame,
  type StorePhase,
} from "../../components/worlds/store/StoreMiniGame";
import {
  ORDERS,
  calcOrderTotalCent,
  calcOrderChangeCent,
  formatYuan,
} from "../../lib/worlds/storeOrders";
import { incrementBuildingComplete } from "../../lib/worlds/worldsProgress";
import { MascotPIP } from "../../components/atelier/MascotPIP";
import { useMascotReaction, type MascotMood } from "../../lib/worlds/useMascotReaction";
import { useWorldFeedback } from "../../lib/worlds/useWorldFeedback";
import { WorldFeedbackOverlay } from "../../components/worlds/WorldFeedbackOverlay";

export function StorePage() {
  const navigate = useNavigate();
  const [orderIdx, setOrderIdx] = useState(0);
  const [phase, setPhase] = useState<StorePhase>("intro");
  const [completedCount, setCompletedCount] = useState(0);
  const [showReward, setShowReward] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const order = ORDERS[orderIdx]!;
  const totalCent = calcOrderTotalCent(order);
  const changeCent = calcOrderChangeCent(order);

  // R3F cold start 由 WorldsCanvas 内部 ResizeObserver + invalidate 接管

  // Mascot 反应：mood 由 game state 决定
  const mood: MascotMood = showReward
    ? "allDone"
    : justCompleted
      ? "orderDone"
      : phase === "intro"
        ? "welcome"
        : "playing";
  const mascotProps = useMascotReaction({ mood, accent: "#f59e0b" });

  // v0.32.12：统一反馈层（声 + 震 + 闪 + 文案）
  const { trigger, pulses } = useWorldFeedback();

  const handleOrderComplete = async () => {
    const newCount = completedCount + 1;
    setCompletedCount(newCount);
    setJustCompleted(true);
    window.setTimeout(() => setJustCompleted(false), 1800);
    if (newCount >= ORDERS.length) {
      // 3 单完成 → 入库 + 奖励 + 回地图
      trigger("complete", "+5 XP · 客人都满意！");
      await incrementBuildingComplete("store");
      setShowReward(true);
      window.setTimeout(() => {
        navigate("/worlds/baibao");
      }, 2800);
    } else {
      trigger("correct", `${newCount}/${ORDERS.length} 单完成`);
      // 进入下一单 intro
      setOrderIdx(newCount);
      setPhase("intro");
    }
  };

  return (
    <div className="fixed inset-0 bg-amber-50" style={{ zIndex: 50 }}>
      <WorldsCanvas
        camera={{ position: [0, 1.55, 1.6], fov: 50, near: 0.05, far: 50 }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 1.0, -0.5);
        }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        loadingBg="#fef3c7"
        loadingEmoji="🏪"
        loadingTitle="小卖部开门中…"
      >
        <color attach="background" args={["#fef3c7"]} />
        {/* 灯光：暖色室内 */}
        <ambientLight intensity={0.5} />
        <hemisphereLight args={["#fff7e0", "#a78bfa", 1.0]} />
        <directionalLight position={[3, 4, 2]} intensity={1.3} color="#fff5da" />
        <pointLight position={[0, 2.5, -1]} intensity={0.6} color="#fbbf24" />

        {/* 背景：柜台+地板+装饰；WorldsCanvas 顶层 Suspense 接管 loading */}
        <StoreEnvironment />

        {(phase === "scan" || phase === "change") && (
          <StoreMiniGame
            order={order}
            phase={phase}
            onPhaseChange={setPhase}
            onOrderComplete={handleOrderComplete}
          />
        )}
      </WorldsCanvas>

      {/* HUD overlays */}
      <TopHUD
        orderIdx={orderIdx}
        completedCount={completedCount}
        onBack={() => navigate("/worlds/baibao")}
      />

      {/* 顾客 NPC overlay（HTML，不进 Canvas，避免 Z-fighting） */}
      <CustomerBubble
        emoji={order.customerEmoji}
        line={order.customerLine}
        hint={
          phase === "scan"
            ? `要扫: ${order.requests
                .map((r) => `${r.quantity}× ${r.itemId}`)
                .join(", ")}`
            : phase === "change"
              ? `付 ${formatYuan(order.paidCent)} → 找零 ${formatYuan(changeCent)}`
              : undefined
        }
      />

      {/* Intro / phase 切换按钮 */}
      {phase === "intro" && !showReward && (
        <IntroPanel
          order={order}
          orderIdx={orderIdx}
          totalCent={totalCent}
          changeCent={changeCent}
          onStart={() => setPhase("scan")}
        />
      )}

      {/* 完成奖励弹窗 */}
      {showReward && <RewardOverlay />}

      {/* 老师小进 PIP — 实时反应玩家进度 */}
      <MascotPIP
        gesture={mascotProps.gesture}
        emotion={mascotProps.emotion}
        outfit={mascotProps.outfit}
        skin={mascotProps.skin}
        line={mascotProps.line}
        accent={mascotProps.accent}
      />

      {/* v0.32.12：反馈层 overlay */}
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
      <div className="px-4 py-2 rounded-full bg-amber-500/90 text-white text-xs font-bold backdrop-blur-md border border-white/30 shadow-lg">
        🏪 和平小卖部
      </div>
      <div className="px-3 py-2 rounded-xl bg-black/55 text-white text-xs font-bold backdrop-blur-md border border-white/25 shadow-lg">
        客人 {completedCount + (orderIdx === completedCount ? 0 : 1)}/{ORDERS.length}
      </div>
    </div>
  );
}

function CustomerBubble({ emoji, line, hint }: { emoji: string; line: string; hint?: string }) {
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
        <div className="px-4 py-2.5 rounded-2xl bg-white/95 text-slate-900 text-sm font-medium shadow-2xl border-2 border-amber-200 relative">
          {line}
          {hint && (
            <div className="mt-1 text-xs text-amber-700 font-bold">💡 {hint}</div>
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
  totalCent,
  changeCent,
  onStart,
}: {
  order: ReturnType<typeof getOrder>;
  orderIdx: number;
  totalCent: number;
  changeCent: number;
  onStart: () => void;
}) {
  return (
    <div
      className="absolute pointer-events-none inset-0 flex items-end justify-center pb-12"
      style={{ zIndex: 60 }}
    >
      <div className="pointer-events-auto card bg-white/95 backdrop-blur-md p-5 shadow-2xl border-2 border-amber-300 max-w-md text-center">
        <div className="text-amber-700 text-xs font-bold mb-1">客人 #{orderIdx + 1}</div>
        <div className="text-slate-900 text-sm leading-relaxed mb-3">{order.customerLine}</div>
        <div className="text-xs text-slate-600 mb-3 grid grid-cols-2 gap-2">
          <div className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200">
            <div className="text-emerald-700 font-bold">应收</div>
            <div className="font-mono text-emerald-900">{formatYuan(totalCent)}</div>
          </div>
          <div className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200">
            <div className="text-amber-700 font-bold">找零</div>
            <div className="font-mono text-amber-900">{formatYuan(changeCent)}</div>
          </div>
        </div>
        {order.hint && (
          <div className="text-xs text-slate-500 italic mb-3">💡 {order.hint}</div>
        )}
        <button
          type="button"
          onClick={onStart}
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-base font-bold shadow-xl border-2 border-white/40 hover:scale-105 transition-transform"
        >
          🎯 开始扫码
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
        background: "radial-gradient(circle, rgba(252, 211, 77, 0.3) 0%, rgba(0, 0, 0, 0) 70%)",
      }}
    >
      <div className="text-center animate-bounce">
        <div className="text-8xl mb-3">🎉</div>
        <div className="px-6 py-3 rounded-2xl bg-emerald-500 text-white text-2xl font-bold shadow-2xl border-2 border-white">
          +5 XP · +1 装饰碎片
        </div>
        <div className="mt-2 text-amber-900 text-sm font-medium drop-shadow">
          客人们都满意～回到百宝港
        </div>
      </div>
    </div>
  );
}

// helper for typing
function getOrder() {
  return ORDERS[0]!;
}
