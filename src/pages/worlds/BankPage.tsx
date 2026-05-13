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
import { BankMiniGame } from "../../components/worlds/bank/BankMiniGame";
import { BANK_ORDERS, type BankOrder } from "../../lib/worlds/bankOrders";
import { formatYuan } from "../../lib/worlds/storeOrders";
import { incrementBuildingComplete } from "../../lib/worlds/worldsProgress";
import { MascotPIP } from "../../components/atelier/MascotPIP";
import { useMascotReaction, type MascotMood } from "../../lib/worlds/useMascotReaction";
import { useWorldFeedback } from "../../lib/worlds/useWorldFeedback";
import { WorldFeedbackOverlay } from "../../components/worlds/WorldFeedbackOverlay";
import { useBgm } from "../../lib/worlds/useBGM";
import { BgmMuteButton } from "../../components/worlds/BgmMuteButton";

type Phase = "intro" | "exchange";

export function BankPage() {
  const navigate = useNavigate();
  const [orderIdx, setOrderIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("intro");
  const [completedCount, setCompletedCount] = useState(0);
  const [showReward, setShowReward] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const order = BANK_ORDERS[orderIdx]!;

  // R3F cold start 由 WorldsCanvas 接管

  const mood: MascotMood = showReward
    ? "allDone"
    : justCompleted
      ? "orderDone"
      : phase === "intro"
        ? "welcome"
        : "playing";
  const mascotProps = useMascotReaction({ mood, accent: "#3b82f6" });
  // v0.32.12-14：反馈层 + Mascot 联动
  // v0.32.23: rootRef → screen shake / zoom
  const { trigger, pulses, lastReaction, rootRef } = useWorldFeedback();
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
      className="fixed inset-0 bg-blue-50"
      style={{ zIndex: 50 }}
    >
      <WorldsCanvas
        camera={{ position: [0, 1.55, 1.6], fov: 50, near: 0.05, far: 50 }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 1.0, -0.5);
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

        {phase === "exchange" && (
          <BankMiniGame
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
          phase === "exchange"
            ? `需要换零: ${formatYuan(order.targetCent)}`
            : undefined
        }
      />

      {phase === "intro" && !showReward && (
        <IntroPanel
          order={order}
          orderIdx={orderIdx}
          onStart={() => setPhase("exchange")}
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

      <BgmMuteButton accent="#3b82f6" />

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
      <div className="px-4 py-2 rounded-full bg-blue-500/90 text-white text-xs font-bold backdrop-blur-md border border-white/30 shadow-lg">
        🏦 百宝银行
      </div>
      <div className="px-3 py-2 rounded-xl bg-black/55 text-white text-xs font-bold backdrop-blur-md border border-white/25 shadow-lg">
        客人 {completedCount + (orderIdx === completedCount ? 0 : 1)}/{BANK_ORDERS.length}
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
        <div className="px-4 py-2.5 rounded-2xl bg-white/95 text-slate-900 text-sm font-medium shadow-2xl border-2 border-blue-200 relative">
          {line}
          {hint && (
            <div className="mt-1 text-xs text-blue-700 font-bold">💡 {hint}</div>
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
  order: BankOrder;
  orderIdx: number;
  onStart: () => void;
}) {
  return (
    <div
      className="absolute pointer-events-none inset-0 flex items-end justify-center pb-12"
      style={{ zIndex: 60 }}
    >
      <div className="pointer-events-auto card bg-white/95 backdrop-blur-md p-5 shadow-2xl border-2 border-blue-300 max-w-md text-center">
        <div className="text-blue-700 text-xs font-bold mb-1">换零 #{orderIdx + 1}</div>
        <div className="text-slate-900 text-sm leading-relaxed mb-3">{order.customerLine}</div>
        <div className="text-xs text-slate-600 mb-3">
          <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
            <div className="text-blue-700 font-bold mb-0.5">需要换零</div>
            <div className="font-mono text-blue-900 text-lg">
              {formatYuan(order.targetCent)}
            </div>
          </div>
        </div>
        {order.hint && (
          <div className="text-xs text-slate-500 italic mb-3">💡 {order.hint}</div>
        )}
        <button
          type="button"
          onClick={onStart}
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-base font-bold shadow-xl border-2 border-white/40 hover:scale-105 transition-transform"
        >
          🪙 开始换零
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
        background: "radial-gradient(circle, rgba(147,197,253,0.3) 0%, rgba(0,0,0,0) 70%)",
      }}
    >
      <div className="text-center animate-bounce">
        <div className="text-8xl mb-3">💰</div>
        <div className="px-6 py-3 rounded-2xl bg-blue-500 text-white text-2xl font-bold shadow-2xl border-2 border-white">
          +5 XP · +1 装饰碎片
        </div>
        <div className="mt-2 text-blue-900 text-sm font-medium drop-shadow">
          银行的客人都满意～回到百宝港
        </div>
      </div>
    </div>
  );
}
