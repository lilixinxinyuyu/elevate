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
import { useBgm } from "../../lib/worlds/useBGM";
import { BgmMuteButton } from "../../components/worlds/BgmMuteButton";
import { WorldTopHUD } from "../../components/worlds/WorldTopHUD";

export function StorePage() {
  const navigate = useNavigate();
  const [orderIdx, setOrderIdx] = useState(0);
  const [phase, setPhase] = useState<StorePhase>("intro");
  const [completedCount, setCompletedCount] = useState(0);
  const [showReward, setShowReward] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  // v0.32.53 (Ep29 H): phase transition — intro slide-out 完才真正切 phase
  const [introExiting, setIntroExiting] = useState(false);
  const startPhase = (next: StorePhase) => {
    setIntroExiting(true);
    window.setTimeout(() => {
      setPhase(next);
      setIntroExiting(false);
    }, 220);
  };

  const order = ORDERS[orderIdx]!;
  const totalCent = calcOrderTotalCent(order);
  const changeCent = calcOrderChangeCent(order);

  // R3F cold start 由 WorldsCanvas 内部 ResizeObserver + invalidate 接管

  // v0.32.12-14：统一反馈层（声 + 震 + 闪 + 文案 + Mascot 联动）
  // v0.32.23: rootRef → screen shake / zoom on reaction
  // v0.32.41: useWorldFeedback 提前，给 useMascotReaction 用 lastReaction
  const { trigger, pulses, lastReaction, rootRef } = useWorldFeedback();

  // Mascot 反应：mood 由 game state 决定 + reaction 短暂覆盖
  const mood: MascotMood = showReward
    ? "allDone"
    : justCompleted
      ? "orderDone"
      : phase === "intro"
        ? "welcome"
        : "playing";
  const mascotProps = useMascotReaction({ mood, accent: "#f59e0b", reaction: lastReaction });
  // v0.32.21: BGM
  useBgm("store");

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
    <div
      ref={rootRef}
      className="fixed inset-0 bg-amber-50 world-theme-store world-page-enter"
      style={{ zIndex: 50 }}
    >
      <WorldsCanvas
        camera={{ position: [0, 1.6, 2.2], fov: 55, near: 0.05, far: 50 }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 1.3, -0.6);
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
        <StoreEnvironment variant="store" />

        {(phase === "scan" || phase === "change") && (
          <StoreMiniGame
            order={order}
            phase={phase}
            onPhaseChange={setPhase}
            onOrderComplete={handleOrderComplete}
            onFeedback={trigger}
          />
        )}
      </WorldsCanvas>

      {/* HUD overlays */}
      <WorldTopHUD
        title="🏪 和平小卖部"
        current={completedCount + (orderIdx === completedCount ? 0 : 1)}
        total={ORDERS.length}
        accent="#f59e0b"
        onBack={() => navigate("/worlds/baibao")}
      />

      {/* 顾客 NPC overlay（HTML，不进 Canvas，避免 Z-fighting） */}
      <CustomerBubble
        emoji={order.customerEmoji}
        line={order.customerLine}
        mood={justCompleted ? "happy" : phase === "intro" ? "hello" : "focus"}
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
        <div className={introExiting ? "world-intro-exit" : ""}>
          <IntroPanel
            order={order}
            orderIdx={orderIdx}
            totalCent={totalCent}
            changeCent={changeCent}
            onStart={() => startPhase("scan")}
          />
        </div>
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
        reaction={lastReaction}
      />

      <BgmMuteButton accent="#f59e0b" />

      {/* v0.32.12：反馈层 overlay */}
      <WorldFeedbackOverlay pulses={pulses} />
    </div>
  );
}

// v0.32.58 (Ep34 L): TopHUD 抽到 WorldTopHUD（src/components/worlds/WorldTopHUD.tsx）

function CustomerBubble({
  emoji,
  line,
  hint,
  mood = "hello",
}: {
  emoji: string;
  line: string;
  hint?: string;
  mood?: "hello" | "focus" | "happy";
}) {
  const emote = mood === "happy" ? "🎉" : mood === "focus" ? "👀" : "💬";
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        zIndex: 55,
        left: "50%",
        transform: "translateX(-50%)",
        top: "12%",
      }}
    >
      <div className={`world-customer-bubble world-customer-bubble-${mood}`}>
        <div className="world-customer-bubble-avatar-wrap">
          <div className="world-customer-bubble-avatar">{emoji}</div>
          <span className="world-customer-emote">{emote}</span>
        </div>
        <div className="max-w-md">
          <div className="world-customer-bubble-card">
            {line}
            {hint && <div className="world-customer-bubble-hint">💡 {hint}</div>}
          </div>
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
      <div className="pointer-events-auto world-panel world-order-card">
        <div className="world-order-head">
          <div>
            <div className="world-order-num">#{orderIdx + 1}</div>
            <span className="world-order-num-label">订单</span>
          </div>
          <div className="world-order-title-block">
            <div className="world-panel-title">小卖部 · 扫码 + 找零</div>
            <div className="world-order-line">{order.customerLine}</div>
          </div>
          <div className="world-order-emoji">🛒</div>
        </div>
        <div className="world-order-body">
          <div className="text-xs mb-3 grid grid-cols-2 gap-2">
            <div className="world-panel-stat text-emerald-700">
              <div className="font-bold text-[11px] uppercase">应收</div>
              <div className="font-mono text-emerald-900 text-base">{formatYuan(totalCent)}</div>
            </div>
            <div className="world-panel-stat text-amber-700">
              <div className="font-bold text-[11px] uppercase">找零</div>
              <div className="font-mono text-amber-900 text-base">{formatYuan(changeCent)}</div>
            </div>
          </div>
          {order.hint && (
            <div className="text-xs text-slate-500 italic mb-3">💡 {order.hint}</div>
          )}
          <button type="button" onClick={onStart} className="world-cta-btn w-full">
            🎯 开始扫码
          </button>
        </div>
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
      <div className="text-center world-reward-content">
        <div className="text-8xl mb-3 animate-bounce">🎉</div>
        <div className="world-reward-badge">+5 XP · +1 装饰碎片</div>
        <div className="mt-3 text-amber-900 text-sm font-bold drop-shadow">
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
