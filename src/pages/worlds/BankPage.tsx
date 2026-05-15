/**
 * v0.32.4: 百宝银行 第一人称柜台 mini-game page。
 *
 * 路径: /worlds/baibao/bank
 *
 * 玩法: 3 单换零 cycle (单位换算 1元=10角=100分) → +XP + 装饰碎片 → 回 baibao 地图
 *
 * 跟 StorePage 共用 KayKit StoreEnvironment（柜台+装饰），只换 mini-game 内容。
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorldsCanvas } from "../../components/worlds/WorldsCanvas";
import { StoreEnvironment } from "../../components/worlds/store/StoreScene";
// v0.32.50 (Ep26 C): Bank 改用 DOM 键盘玩法差异化；旧的拖币 mini-game 暂留代码不渲染
// import { BankMiniGame } from "../../components/worlds/bank/BankMiniGame";
import { BankKeypadMiniGame } from "../../components/worlds/bank/BankKeypadMiniGame";
import { BANK_ORDERS, type BankOrder } from "../../lib/worlds/bankOrders";
import { formatYuan } from "../../lib/worlds/storeOrders";
import { incrementBuildingComplete } from "../../lib/worlds/worldsProgress";
import { MascotPIP } from "../../components/atelier/MascotPIP";
import { useMascotReaction, type MascotMood } from "../../lib/worlds/useMascotReaction";
import { useWorldFeedback } from "../../lib/worlds/useWorldFeedback";
import { WorldFeedbackOverlay } from "../../components/worlds/WorldFeedbackOverlay";
import { useBgm } from "../../lib/worlds/useBGM";
import { BgmMuteButton } from "../../components/worlds/BgmMuteButton";
import { WorldTopHUD } from "../../components/worlds/WorldTopHUD";
import { CustomerBubble } from "../../components/worlds/CustomerBubble";

type Phase = "intro" | "exchange";

export function BankPage() {
  const navigate = useNavigate();
  const [orderIdx, setOrderIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("intro");
  const [completedCount, setCompletedCount] = useState(0);
  const [showReward, setShowReward] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);
  // v0.32.53 (Ep29 H): phase transition
  const [introExiting, setIntroExiting] = useState(false);
  const startPhase = (next: Phase) => {
    setIntroExiting(true);
    window.setTimeout(() => {
      setPhase(next);
      setIntroExiting(false);
    }, 220);
  };

  const order = BANK_ORDERS[orderIdx]!;

  // R3F cold start 由 WorldsCanvas 接管

  // v0.32.41: useWorldFeedback 提前给 useMascotReaction 用
  const { trigger, pulses, lastReaction, rootRef } = useWorldFeedback();

  const mood: MascotMood = showReward
    ? "allDone"
    : justCompleted
      ? "orderDone"
      : phase === "intro"
        ? "welcome"
        : "playing";
  const mascotProps = useMascotReaction({ mood, accent: "#3b82f6", reaction: lastReaction });
  // v0.32.21: BGM
  useBgm("bank");

  const handleOrderComplete = async () => {
    const newCount = completedCount + 1;
    setCompletedCount(newCount);
    setJustCompleted(true);
    window.setTimeout(() => setJustCompleted(false), 1800);
    if (newCount >= BANK_ORDERS.length) {
      trigger("complete", "+5 XP · 银行客人都满意！");
      await incrementBuildingComplete("bank");
      setShowReward(true);
      window.setTimeout(() => navigate("/worlds/baibao"), 2800);
    } else {
      trigger("correct", `${newCount}/${BANK_ORDERS.length} 单完成`);
      setOrderIdx(newCount);
      setPhase("intro");
    }
  };

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 bg-blue-50 world-theme-bank world-page-enter"
      style={{ zIndex: 50 }}
    >
      <WorldsCanvas
        camera={{ position: [0, 1.6, 2.2], fov: 55, near: 0.05, far: 50 }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 1.3, -0.6);
        }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        loadingBg="#dbeafe"
        loadingEmoji="🏦"
        loadingTitle="百宝银行开张…"
      >
        <color attach="background" args={["#dbeafe"]} />
        {/* 灯光：冷色 (银行氛围 vs store 暖色) */}
        <ambientLight intensity={0.55} />
        <hemisphereLight args={["#dbeafe", "#1e3a8a", 1.0]} />
        <directionalLight position={[3, 4, 2]} intensity={1.2} color="#fff5da" />
        <pointLight position={[0, 2.5, -1]} intensity={0.5} color="#60a5fa" />

        <StoreEnvironment variant="bank" />

        {/* v0.32.50: Bank 不再在 3D Canvas 内放可拖硬币；改 DOM 键盘 overlay（柜台场景保留） */}
      </WorldsCanvas>

      {phase === "exchange" && !showReward && (
        <BankKeypadMiniGame
          order={order}
          onOrderComplete={handleOrderComplete}
          onFeedback={trigger}
        />
      )}

      <WorldTopHUD
        title="🏦 百宝银行"
        current={completedCount + (orderIdx === completedCount ? 0 : 1)}
        total={BANK_ORDERS.length}
        accent="#3b82f6"
        onBack={() => navigate("/worlds/baibao")}
      />

      <CustomerBubble
        emoji={order.customerEmoji}
        mood={justCompleted ? "happy" : phase === "intro" ? "hello" : "focus"}
        hint={
          phase === "exchange"
            ? `需要换零: ${formatYuan(order.targetCent)}`
            : undefined
        }
        ribbon={{
          text: `换 ${formatYuan(order.targetCent)}`,
          accent: "#3b82f6",
        }}
      >
        {order.customerLine}
      </CustomerBubble>

      {phase === "intro" && !showReward && (
        <div className={introExiting ? "world-intro-exit" : ""}>
          <IntroPanel
            order={order}
            orderIdx={orderIdx}
            onStart={() => startPhase("exchange")}
          />
        </div>
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

      <BgmMuteButton accent="#3b82f6" />

      <WorldFeedbackOverlay pulses={pulses} />
    </div>
  );
}

// v0.32.58 (Ep34 L): TopHUD 抽到 src/components/worlds/WorldTopHUD.tsx

// v0.33.30 (Ep106 customer-ribbon): 已抽到 src/components/worlds/CustomerBubble.tsx

function IntroPanel({
  order,
  orderIdx,
  onStart,
}: {
  order: BankOrder;
  orderIdx: number;
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
            <span className="world-order-num-label">换零</span>
          </div>
          <div className="world-order-title-block">
            <div className="world-panel-title">百宝银行 · 单位换算</div>
            <div className="world-order-line">{order.customerLine}</div>
          </div>
          <div className="world-order-emoji">🪙</div>
        </div>
        <div className="world-order-body">
          <div className="text-xs mb-3">
            <div className="world-panel-stat text-blue-700">
              <div className="font-bold text-[11px] uppercase">需要换零</div>
              <div className="font-mono text-blue-900 text-lg">
                {formatYuan(order.targetCent)}
              </div>
            </div>
          </div>
          {order.hint && (
            <div className="text-xs text-slate-500 italic mb-3">💡 {order.hint}</div>
          )}
          <button type="button" onClick={onStart} className="world-cta-btn w-full">
            🪙 开始换零
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
        background: "radial-gradient(circle, rgba(147,197,253,0.3) 0%, rgba(0,0,0,0) 70%)",
      }}
    >
      <div className="text-center world-reward-content">
        <div className="text-8xl mb-3 animate-bounce">💰</div>
        <div className="world-reward-badge">+5 XP · +1 装饰碎片</div>
        <div className="mt-3 text-blue-900 text-sm font-bold drop-shadow">
          银行的客人都满意～回到百宝港
        </div>
      </div>
    </div>
  );
}
