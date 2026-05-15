/**
 * v0.32.3: 和平小卖部第一人称柜台 mini-game page。
 *
 * 路径: /worlds/baibao/store
 *
 * 流程: 3 单 cycle (扫码 → 找零) → +XP + 装饰碎片 → 回 baibao 地图
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { WorldsCanvas } from "../../components/worlds/WorldsCanvas";
import { StoreEnvironment } from "../../components/worlds/store/StoreScene";
import {
  StoreMiniGame,
  type StorePhase,
} from "../../components/worlds/store/StoreMiniGame";
import {
  ORDERS,
  STORE_ITEMS,
  calcOrderTotalCent,
  calcOrderChangeCent,
  formatYuan,
  type Order,
} from "../../lib/worlds/storeOrders";
import { incrementBuildingComplete } from "../../lib/worlds/worldsProgress";
import { MascotPIP } from "../../components/atelier/MascotPIP";
import { useMascotReaction, type MascotMood } from "../../lib/worlds/useMascotReaction";
import { useWorldFeedback } from "../../lib/worlds/useWorldFeedback";
import { WorldFeedbackOverlay } from "../../components/worlds/WorldFeedbackOverlay";
import { useBgm } from "../../lib/worlds/useBGM";
import { BgmMuteButton } from "../../components/worlds/BgmMuteButton";
import { WorldTopHUD } from "../../components/worlds/WorldTopHUD";
import { CustomerBubble } from "../../components/worlds/CustomerBubble";

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

  // v0.33.50 (Ep124 customer-reaction-propagate): 顾客反馈表情 (mirror Ep123 bakery)
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

  // v0.33.46 (Ep120 store-receipt-summary): 弹"购物小票"再 advance
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const handleOrderComplete = async () => {
    const newCount = completedCount + 1;
    setCompletedCount(newCount);
    setJustCompleted(true);
    window.setTimeout(() => setJustCompleted(false), 1800);
    // v0.33.46: 先弹小票，由 onDismiss 推进
    setReceiptOrder(order);
    const isFinal = newCount >= ORDERS.length;
    if (isFinal) {
      await incrementBuildingComplete("store");
    }
  };
  const dismissReceipt = () => {
    setReceiptOrder(null);
    const newCount = completedCount;
    const isFinal = newCount >= ORDERS.length;
    if (isFinal) {
      trigger("complete", "+5 XP · 客人都满意！");
      setShowReward(true);
      window.setTimeout(() => {
        navigate("/worlds/baibao");
      }, 2200);
    } else {
      trigger("correct", `${newCount}/${ORDERS.length} 单完成`);
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
            onFeedback={triggerWithReaction}
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
        currentOrderEmoji="🛒"
        budgetSeconds={60}
        orderKey={orderIdx}
        skillName={
          phase === "scan"
            ? "扫码 · 小数乘加 · 总价"
            : phase === "change"
              ? "找零 · 小数减法 · 货币"
              : "购物 · 总价与找零"
        }
      />

      {/* 顾客 NPC overlay（HTML，不进 Canvas，避免 Z-fighting） */}
      <CustomerBubble
        emoji={order.customerEmoji}
        mood={justCompleted ? "happy" : phase === "intro" ? "hello" : "focus"}
        reactionEmoji={reactionEmoji}
        hint={
          phase === "scan"
            ? `要扫: ${order.requests
                .map((r) => `${r.quantity}× ${r.itemId}`)
                .join(", ")}`
            : phase === "change"
              ? `付 ${formatYuan(order.paidCent)} → 找零 ${formatYuan(changeCent)}`
              : undefined
        }
        ribbon={{
          text:
            phase === "change"
              ? `找零 ${formatYuan(changeCent)}`
              : `付 ${formatYuan(order.paidCent)}`,
          accent: "#f59e0b",
        }}
      >
        {order.customerLine}
      </CustomerBubble>

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

      {/* v0.33.46 (Ep120 store-receipt-summary): 单完成弹小票 → 用户确认推进 */}
      {receiptOrder && (
        <ReceiptOverlay order={receiptOrder} onDismiss={dismissReceipt} />
      )}

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

// v0.33.30 (Ep106 customer-ribbon): CustomerBubble 已抽到 src/components/worlds/CustomerBubble.tsx

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

/**
 * v0.33.46 (Ep120 store-receipt-summary): 购物小票 modal
 *  - paper texture amber/cream 背景 + dashed 切边 (rect chunky)
 *  - itemized list: emoji + name + 单价×数量 = 小计
 *  - total + paid + change due 三行分账
 *  - 入场 paper-unroll-style scale-y animation (0 → 1, 380ms)
 *  - 下方按钮"继续 →" 用户主动 dismiss
 *  - prefers-reduced-motion: 关入场动画，直接 fade-in
 */
function ReceiptOverlay({
  order,
  onDismiss,
}: {
  order: Order;
  onDismiss: () => void;
}) {
  const total = calcOrderTotalCent(order);
  const change = calcOrderChangeCent(order);
  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-auto"
      style={{
        zIndex: 75,
        background: "rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(4px)",
      }}
    >
      <style>{`
        .store-receipt {
          position: relative;
          width: min(86vw, 380px);
          padding: 1.4rem 1.2rem 1.1rem;
          background:
            repeating-linear-gradient(
              0deg,
              rgba(120, 53, 15, 0.04) 0px,
              rgba(120, 53, 15, 0.04) 1px,
              transparent 1px,
              transparent 24px
            ),
            linear-gradient(180deg, #fffbeb 0%, #fef3c7 100%);
          color: #451a03;
          border: 3px solid #f59e0b;
          border-radius: 14px;
          box-shadow:
            0 0 0 4px rgba(245, 158, 11, 0.22),
            0 18px 40px rgba(0, 0, 0, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.65);
          transform-origin: top center;
          animation: store-receipt-unroll 380ms cubic-bezier(.34, 1.56, .64, 1);
        }
        @keyframes store-receipt-unroll {
          0%   { transform: scaleY(0.02); opacity: 0; }
          60%  { transform: scaleY(1.06); opacity: 1; }
          100% { transform: scaleY(1); opacity: 1; }
        }
        .store-receipt-title {
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0.2em;
          text-align: center;
          color: #7c2d12;
          text-transform: uppercase;
          margin-bottom: 0.3rem;
        }
        .store-receipt-subtitle {
          font-size: 10.5px;
          text-align: center;
          color: #92400e;
          letter-spacing: 0.12em;
          margin-bottom: 0.85rem;
          padding-bottom: 0.65rem;
          border-bottom: 1.5px dashed #d97706;
        }
        .store-receipt-row {
          display: flex;
          align-items: center;
          font-family: ui-monospace, monospace;
          font-size: 13px;
          font-weight: 700;
          padding: 0.3rem 0;
          border-bottom: 1px dotted rgba(217, 119, 6, 0.4);
        }
        .store-receipt-row-emoji { font-size: 18px; line-height: 1; margin-right: 0.45rem; }
        .store-receipt-row-name { flex: 1; color: #451a03; }
        .store-receipt-row-calc { color: #7c2d12; }
        .store-receipt-totals {
          margin-top: 0.7rem;
          padding-top: 0.65rem;
          border-top: 2px dashed #d97706;
          font-family: ui-monospace, monospace;
          font-size: 13px;
        }
        .store-receipt-totals-row {
          display: flex;
          justify-content: space-between;
          padding: 0.18rem 0;
          font-weight: 800;
        }
        .store-receipt-totals-row.grand {
          font-size: 16px;
          margin-top: 0.35rem;
          padding-top: 0.45rem;
          border-top: 1px solid rgba(120, 53, 15, 0.35);
          color: #15803d;
        }
        .store-receipt-dismiss {
          margin-top: 1.1rem;
          width: 100%;
          padding: 0.7rem 1rem;
          background: linear-gradient(180deg, #fbbf24, #f59e0b);
          color: #ffffff;
          border-radius: 14px;
          border: 3px solid #ffffff;
          box-shadow:
            0 4px 0 rgba(0, 0, 0, 0.18),
            0 8px 20px rgba(245, 158, 11, 0.55),
            inset 0 1px 0 rgba(255, 255, 255, 0.55);
          font-weight: 900;
          font-size: 16px;
          letter-spacing: 0.05em;
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.28);
          cursor: pointer;
        }
        .store-receipt-dismiss:hover {
          filter: brightness(1.08);
          transform: translateY(-1px);
        }
        @media (prefers-reduced-motion: reduce) {
          .store-receipt { animation: none; }
        }
      `}</style>
      <div className="store-receipt" role="dialog" aria-label="购物小票">
        <div className="store-receipt-title">🧾 和平小卖部</div>
        <div className="store-receipt-subtitle">
          客人 · {order.customerEmoji} · 第 {order.index} 单
        </div>
        {order.requests.map((req) => {
          const item = STORE_ITEMS[req.itemId];
          if (!item) return null;
          const subtotal = item.priceCent * req.quantity;
          return (
            <div key={req.itemId} className="store-receipt-row">
              <span className="store-receipt-row-emoji" aria-hidden>
                {item.emoji}
              </span>
              <span className="store-receipt-row-name">
                {item.name} × {req.quantity}
              </span>
              <span className="store-receipt-row-calc">
                {formatYuan(item.priceCent)} → {formatYuan(subtotal)}
              </span>
            </div>
          );
        })}
        <div className="store-receipt-totals">
          <div className="store-receipt-totals-row">
            <span>总价</span>
            <span>{formatYuan(total)}</span>
          </div>
          <div className="store-receipt-totals-row">
            <span>客付</span>
            <span>{formatYuan(order.paidCent)}</span>
          </div>
          <div className="store-receipt-totals-row grand">
            <span>找零 ✅</span>
            <span>{formatYuan(change)}</span>
          </div>
        </div>
        <button
          type="button"
          className="store-receipt-dismiss"
          onClick={onDismiss}
        >
          继续 → 下一单
        </button>
      </div>
    </div>
  );
}
