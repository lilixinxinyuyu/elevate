/**
 * v0.32.7: 登机口 第一人称柜台 mini-game page。
 *
 * 路径: /worlds/xingfan/airport
 *
 * 玩法: 3 单装行李 cycle (英语量词+复数) → +XP + 装饰碎片 → 回 xingfan 地图
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorldsCanvas } from "../../components/worlds/WorldsCanvas";
import { StoreEnvironment } from "../../components/worlds/store/StoreScene";
import { AirportMiniGame } from "../../components/worlds/airport/AirportMiniGame";
import { AIRPORT_ORDERS, type AirportOrder, LUGGAGE } from "../../lib/worlds/airportOrders";
import { incrementBuildingComplete } from "../../lib/worlds/worldsProgress";
import { MascotPIP } from "../../components/atelier/MascotPIP";
import { useMascotReaction, type MascotMood } from "../../lib/worlds/useMascotReaction";
import { useWorldFeedback } from "../../lib/worlds/useWorldFeedback";
import { WorldFeedbackOverlay } from "../../components/worlds/WorldFeedbackOverlay";
import { useBgm } from "../../lib/worlds/useBGM";
import { BgmMuteButton } from "../../components/worlds/BgmMuteButton";
import { WorldTopHUD } from "../../components/worlds/WorldTopHUD";
import { CustomerBubble } from "../../components/worlds/CustomerBubble";

type Phase = "intro" | "loading";

export function AirportPage() {
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

  const order = AIRPORT_ORDERS[orderIdx]!;

  // R3F cold start 由 WorldsCanvas 接管

  // v0.32.41: useWorldFeedback 提前
  const { trigger, pulses, lastReaction, rootRef } = useWorldFeedback();

  // v0.33.50 (Ep124 customer-reaction-propagate): 顾客反馈表情
  const [reactionEmoji, setReactionEmoji] = useState<string | null>(null);
  const reactionTimerRef = useRef<number | null>(null);
  const triggerWithReaction: typeof trigger = (kind, label, hint) => {
    trigger(kind, label, hint);
    const emoji =
      kind === "complete"
        ? "🥳"
        : kind === "correct" || kind === "drop"
          ? "😋"
          : kind === "pickup"
            ? "👌"
            : kind === "wrong"
              ? "😟"
              : null;
    if (emoji) {
      if (reactionTimerRef.current) window.clearTimeout(reactionTimerRef.current);
      setReactionEmoji(emoji);
      reactionTimerRef.current = window.setTimeout(() => {
        setReactionEmoji(null);
      }, 1200);
    }
  };

  const mood: MascotMood = showReward
    ? "allDone"
    : justCompleted
      ? "orderDone"
      : phase === "intro"
        ? "welcome"
        : "playing";
  const mascotProps = useMascotReaction({ mood, accent: "#06b6d4", reaction: lastReaction });
  // v0.32.21: BGM
  useBgm("airport");

  const handleOrderComplete = async () => {
    const newCount = completedCount + 1;
    setCompletedCount(newCount);
    setJustCompleted(true);
    window.setTimeout(() => setJustCompleted(false), 1800);
    if (newCount >= AIRPORT_ORDERS.length) {
      trigger("complete", "+5 XP · 旅客顺利登机！");
      await incrementBuildingComplete("airport");
      setShowReward(true);
      window.setTimeout(() => navigate("/worlds/xingfan"), 2800);
    } else {
      trigger("correct", `${newCount}/${AIRPORT_ORDERS.length} 单完成`);
      setOrderIdx(newCount);
      setPhase("intro");
    }
  };

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 bg-cyan-50 world-theme-airport world-page-enter"
      style={{ zIndex: 50 }}
    >
      <WorldsCanvas
        camera={{ position: [0, 1.6, 2.2], fov: 55, near: 0.05, far: 50 }}
        onCreated={({ camera }) => camera.lookAt(0, 1.3, -0.6)}
        dpr={[1, 1.5]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        loadingBg="#cffafe"
        loadingEmoji="✈️"
        loadingTitle="登机口开放中…"
      >
        <color attach="background" args={["#cffafe"]} />
        <ambientLight intensity={0.5} />
        <hemisphereLight args={["#cffafe", "#155e75", 1.0]} />
        <directionalLight position={[3, 4, 2]} intensity={1.3} color="#fff5da" />
        <pointLight position={[0, 2.5, -1]} intensity={0.5} color="#06b6d4" />

        <StoreEnvironment variant="airport" />

        {phase === "loading" && (
          <AirportMiniGame
            order={order}
            onOrderComplete={handleOrderComplete}
            onFeedback={triggerWithReaction}
          />
        )}
      </WorldsCanvas>

      <WorldTopHUD
        title="✈️ 登机口 · Gate"
        current={completedCount + (orderIdx === completedCount ? 0 : 1)}
        total={AIRPORT_ORDERS.length}
        unitLabel="旅客"
        accent="#06b6d4"
        onBack={() => navigate("/worlds/xingfan")}
        currentOrderEmoji={order.customerEmoji}
        budgetSeconds={55}
        orderKey={orderIdx}
      />

      {/* v0.33.51 (Ep125 airport-departure-board): 机场风格 departure status board */}
      <AirportDepartureBoard
        phase={phase}
        orderIdx={orderIdx}
        order={order}
        justCompleted={justCompleted}
      />

      <CustomerBubble
        emoji={order.customerEmoji}
        mood={justCompleted ? "happy" : phase === "intro" ? "hello" : "focus"}
        reactionEmoji={reactionEmoji}
        hintIcon="🛄 装:"
        hint={
          phase === "loading"
            ? order.requests
                .map((r) => `${r.quantity} ${r.quantity > 1 ? LUGGAGE[r.itemId].englishPlural : LUGGAGE[r.itemId].english}`)
                .join(", ")
            : undefined
        }
        ribbon={{
          text: order.requests
            .map((r) => `${LUGGAGE[r.itemId].emoji}×${r.quantity}`)
            .join(" + "),
          accent: "#06b6d4",
        }}
      >
        <div className="font-bold text-cyan-700">{order.customerLineEn}</div>
        <div className="text-xs text-slate-500 mt-0.5 font-medium">{order.customerLineZh}</div>
      </CustomerBubble>

      {phase === "intro" && !showReward && (
        <div className={introExiting ? "world-intro-exit" : ""}>
          <IntroPanel order={order} orderIdx={orderIdx} onStart={() => startPhase("loading")} />
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

      <BgmMuteButton accent="#06b6d4" />

      <WorldFeedbackOverlay pulses={pulses} />
    </div>
  );
}

// v0.32.58 (Ep34 L): TopHUD 抽到 src/components/worlds/WorldTopHUD.tsx

// v0.33.30 (Ep106 customer-ribbon): CustomerBubble 已抽到 src/components/worlds/CustomerBubble.tsx

function IntroPanel({
  order,
  orderIdx,
  onStart,
}: {
  order: AirportOrder;
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
            <span className="world-order-num-label">旅客</span>
          </div>
          <div className="world-order-title-block">
            <div className="world-panel-title">登机口 · 量词 + 复数</div>
            <div className="world-order-line">
              <span className="font-bold text-cyan-800">{order.customerLineEn}</span>
            </div>
            <div className="text-xs text-slate-500">{order.customerLineZh}</div>
          </div>
          <div className="world-order-emoji">🛄</div>
        </div>
        <div className="world-order-body">
          <div className="text-xs mb-3">
            <div className="world-panel-stat text-cyan-700">
              <div className="font-bold text-[11px] uppercase mb-1">装载清单</div>
              {order.requests.map((r) => (
                <div key={r.itemId} className="font-mono text-cyan-900 text-base">
                  {r.quantity} × {LUGGAGE[r.itemId].emoji}{" "}
                  <span className="text-cyan-700">
                    {r.quantity > 1 ? LUGGAGE[r.itemId].englishPlural : LUGGAGE[r.itemId].english}
                  </span>
                  <span className="text-slate-500 ml-1">({LUGGAGE[r.itemId].zh})</span>
                </div>
              ))}
            </div>
          </div>
          {order.hint && (
            <div className="text-xs text-slate-500 italic mb-3">💡 {order.hint}</div>
          )}
          <button type="button" onClick={onStart} className="world-cta-btn w-full">
            🛄 开始装行李
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
        background: "radial-gradient(circle, rgba(103,232,249,0.3) 0%, rgba(0,0,0,0) 70%)",
      }}
    >
      <div className="text-center world-reward-content">
        <div className="text-8xl mb-3 animate-bounce">✈️</div>
        <div className="world-reward-badge">
          +5 XP · +1 装饰碎片
        </div>
        <div className="mt-2 text-cyan-900 text-sm font-medium drop-shadow">
          旅客们都顺利登机～回到星帆岛
        </div>
      </div>
    </div>
  );
}

/**
 * v0.33.51 (Ep125 airport-departure-board): 机场风格 departure status board
 *  - 顶部偏下、HUD 下方位置，3 个状态 chip：准备 / 装载中 / 已完成
 *  - 当前 phase 对应 chip 高亮 cyan + glow，其他 dim slate
 *  - 切换时 flip-y 翻牌动画（机场翻牌效果）
 *  - 航班号 (FL### 自动生成) + 旅客 emoji + 目的地（随机海岛 emoji）
 *  - prefers-reduced-motion: 关 flip，直接显示
 */
const DESTINATIONS = ["🏝️ Bali", "🗼 Tokyo", "🌴 Maui", "🏛️ Athens", "🌋 Iceland", "🏔️ Banff"];

function AirportDepartureBoard({
  phase,
  orderIdx,
  order,
  justCompleted,
}: {
  phase: Phase;
  orderIdx: number;
  order: AirportOrder;
  justCompleted: boolean;
}) {
  const flightNo = `FL${(101 + orderIdx * 7) % 999}`;
  const dest = DESTINATIONS[orderIdx % DESTINATIONS.length]!;
  // 状态推导
  const activeStatus: "ready" | "loading" | "done" = justCompleted
    ? "done"
    : phase === "loading"
      ? "loading"
      : "ready";
  return (
    <div className="airport-departure-board" aria-label="航班状态板">
      <style>{`
        .airport-departure-board {
          position: absolute;
          top: 5.2rem;
          left: 50%;
          transform: translateX(-50%);
          z-index: 56;
          pointer-events: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.45rem;
        }
        .airport-flight-line {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.36rem 0.95rem;
          border-radius: 12px;
          background: linear-gradient(180deg, #0f172a 0%, #1e293b 100%);
          color: #e0f2fe;
          border: 2px solid rgba(6, 182, 212, 0.55);
          box-shadow:
            0 4px 12px rgba(0, 0, 0, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.12);
          font-family: ui-monospace, monospace;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.06em;
        }
        .airport-flight-no { color: #67e8f9; }
        .airport-flight-emoji { font-size: 16px; line-height: 1; }
        .airport-flight-arrow { color: #94a3b8; }
        .airport-flight-dest { color: #fef3c7; }
        .airport-status-row {
          display: inline-flex;
          gap: 0.32rem;
          font-family: ui-monospace, monospace;
        }
        .airport-status-chip {
          padding: 0.32rem 0.7rem;
          border-radius: 10px;
          background: rgba(15, 23, 42, 0.78);
          border: 2px solid rgba(148, 163, 184, 0.45);
          color: #94a3b8;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          opacity: 0.6;
          transition: opacity 220ms ease-out, color 220ms ease-out, border 220ms ease-out, background 220ms ease-out;
          transform-style: preserve-3d;
        }
        .airport-status-chip.is-active {
          background: linear-gradient(180deg, #0e7490 0%, #155e75 100%);
          border-color: #06b6d4;
          color: #ecfeff;
          opacity: 1;
          box-shadow:
            0 0 0 2px rgba(6, 182, 212, 0.3),
            0 0 14px rgba(6, 182, 212, 0.55),
            inset 0 1px 0 rgba(255, 255, 255, 0.25);
          animation: airport-chip-flip 520ms cubic-bezier(.34, 1.56, .64, 1);
        }
        @keyframes airport-chip-flip {
          0%   { transform: rotateX(-92deg); opacity: 0.2; }
          55%  { transform: rotateX(8deg); opacity: 1; }
          100% { transform: rotateX(0deg); opacity: 1; }
        }
        .airport-status-chip.is-done {
          background: linear-gradient(180deg, #047857 0%, #065f46 100%);
          border-color: #10b981;
          color: #d1fae5;
          box-shadow:
            0 0 0 2px rgba(16, 185, 129, 0.3),
            0 0 12px rgba(16, 185, 129, 0.55);
        }
        @media (prefers-reduced-motion: reduce) {
          .airport-status-chip.is-active { animation: none; }
        }
      `}</style>
      <div className="airport-flight-line">
        <span className="airport-flight-no">{flightNo}</span>
        <span className="airport-flight-emoji" aria-hidden>
          {order.customerEmoji}
        </span>
        <span className="airport-flight-arrow">→</span>
        <span className="airport-flight-dest">{dest}</span>
      </div>
      <div className="airport-status-row">
        <span
          key={`ready-${activeStatus === "ready" ? orderIdx : "off"}`}
          className={`airport-status-chip${activeStatus === "ready" ? " is-active" : ""}`}
        >
          ✈️ 准备
        </span>
        <span
          key={`loading-${activeStatus === "loading" ? orderIdx : "off"}`}
          className={`airport-status-chip${activeStatus === "loading" ? " is-active" : ""}`}
        >
          🛄 装载中
        </span>
        <span
          key={`done-${activeStatus === "done" ? orderIdx : "off"}`}
          className={`airport-status-chip${activeStatus === "done" ? " is-active is-done" : ""}`}
        >
          ✅ 已起飞
        </span>
      </div>
    </div>
  );
}
