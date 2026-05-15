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
import { WorldTopHUD } from "../../components/worlds/WorldTopHUD";
import { CustomerBubble } from "../../components/worlds/CustomerBubble";

type Phase = "intro" | "slicing";

export function BakeryPage() {
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
      className="fixed inset-0 bg-pink-50 world-theme-bakery world-page-enter"
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

      <WorldTopHUD
        title="🥖 甜心面包店"
        current={completedCount + (orderIdx === completedCount ? 0 : 1)}
        total={BAKERY_ORDERS.length}
        accent="#ec4899"
        onBack={() => navigate("/worlds/baibao")}
      />

      <CustomerBubble
        emoji={order.customerEmoji}
        mood={justCompleted ? "happy" : phase === "intro" ? "hello" : "focus"}
        hint={
          phase === "slicing"
            ? order.requireContiguous !== false
              ? `要 ${order.needSlices} 块连成一片（共 12 块）`
              : `要 ${order.needSlices} 块（共 12 块）`
            : undefined
        }
        ribbon={{
          text: `${order.fractionLabel} 个 ${order.emoji}`,
          accent: "#ec4899",
        }}
      >
        {order.customerLine}
      </CustomerBubble>

      {phase === "intro" && !showReward && (
        <div className={introExiting ? "world-intro-exit" : ""}>
          <IntroPanel
            order={order}
            orderIdx={orderIdx}
            onStart={() => startPhase("slicing")}
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

      <BgmMuteButton accent="#ec4899" />

      <WorldFeedbackOverlay pulses={pulses} />
    </div>
  );
}

// v0.32.58 (Ep34 L): TopHUD 抽到 WorldTopHUD

// v0.33.30 (Ep106 customer-ribbon): 已抽到 src/components/worlds/CustomerBubble.tsx

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
      <div className="pointer-events-auto world-panel world-order-card">
        <div className="world-order-head">
          <div>
            <div className="world-order-num">#{orderIdx + 1}</div>
            <span className="world-order-num-label">分数</span>
          </div>
          <div className="world-order-title-block">
            <div className="world-panel-title">甜心面包店 · 12 等分</div>
            <div className="world-order-line">
              <HighlightFractions text={order.customerLine} />
            </div>
          </div>
          <div className="world-order-emoji">{order.emoji}</div>
        </div>
        <div className="world-order-body">
          {/* v0.33.38 (Ep114 bakery-orderline-glow): 分数视觉化 — 12 等分饼图 + chunky 数字 + 进度 hint */}
          <div className="flex items-center gap-3 mb-3">
            <FractionPieChip
              needSlices={order.needSlices}
              total={12}
              fractionLabel={order.fractionLabel}
            />
            <div className="flex-1">
              <div className="world-panel-stat text-pink-700">
                <div className="font-bold text-[11px] uppercase tracking-wider mb-1">
                  要 <FractionBadge label={order.fractionLabel} /> 个 {order.emoji}
                </div>
                <div className="font-mono text-pink-900 text-base">
                  = {order.needSlices} / 12 块
                </div>
              </div>
            </div>
          </div>
          {order.hint && (
            <div className="text-xs text-slate-500 italic mb-3">💡 {order.hint}</div>
          )}
          <button type="button" onClick={onStart} className="world-cta-btn w-full">
            🍰 开始切块
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
        background: "radial-gradient(circle, rgba(251,113,133,0.3) 0%, rgba(0,0,0,0) 70%)",
      }}
    >
      <div className="text-center world-reward-content">
        <div className="text-8xl mb-3 animate-bounce">🎂</div>
        <div className="world-reward-badge">+5 XP · +1 装饰碎片</div>
        <div className="mt-3 text-pink-900 text-sm font-bold drop-shadow">
          客人们都满意～回到百宝港
        </div>
      </div>
    </div>
  );
}

/**
 * v0.33.38 (Ep114 bakery-orderline-glow): 12 等分饼图视觉化
 *  - 12 个 SVG 扇形，前 needSlices 个填粉色 gradient，剩下浅灰
 *  - 中心显示分数 label (如 "1/3")
 *  - 圆周外加 chunky 白边 + 粉边阴影
 *  - 已切槽 idle pulse (filter brightness 1±0.06)
 */
function FractionPieChip({
  needSlices,
  total,
  fractionLabel,
}: {
  needSlices: number;
  total: number;
  fractionLabel: string;
}) {
  const sectors = [];
  const cx = 50;
  const cy = 50;
  const r = 38;
  for (let i = 0; i < total; i++) {
    const startAngle = (i / total) * Math.PI * 2 - Math.PI / 2; // 从 12 点钟方向开始
    const endAngle = ((i + 1) / total) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + Math.cos(startAngle) * r;
    const y1 = cy + Math.sin(startAngle) * r;
    const x2 = cx + Math.cos(endAngle) * r;
    const y2 = cy + Math.sin(endAngle) * r;
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    const filled = i < needSlices;
    sectors.push(
      <path
        key={i}
        d={d}
        fill={filled ? "url(#pie-fill-pink)" : "#fce7f3"}
        stroke="#ffffff"
        strokeWidth="1.4"
      />,
    );
  }
  return (
    <div className="bakery-fraction-pie">
      <style>{`
        .bakery-fraction-pie {
          width: 78px;
          height: 78px;
          position: relative;
          filter: drop-shadow(0 4px 10px rgba(236, 72, 153, 0.32));
          animation: bakery-pie-pulse 2.4s ease-in-out infinite;
        }
        .bakery-fraction-pie svg { display: block; width: 100%; height: 100%; }
        .bakery-fraction-pie-label {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: ui-monospace, monospace;
          font-size: 17px;
          font-weight: 900;
          color: #831843;
          text-shadow:
            0 0 4px rgba(255, 255, 255, 0.9),
            0 0 8px rgba(255, 255, 255, 0.7);
          pointer-events: none;
        }
        @keyframes bakery-pie-pulse {
          0%, 100% { transform: scale(1); }
          50%      { transform: scale(1.04); }
        }
        @media (prefers-reduced-motion: reduce) {
          .bakery-fraction-pie { animation: none; }
        }
      `}</style>
      <svg viewBox="0 0 100 100" aria-label={`${fractionLabel}, ${needSlices} of ${total}`}>
        <defs>
          <linearGradient id="pie-fill-pink" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f9a8d4" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        {/* 外框圈 */}
        <circle cx={cx} cy={cy} r={r + 2} fill="#fff" />
        {sectors}
        <circle cx={cx} cy={cy} r="14" fill="#fff" stroke="#fbcfe8" strokeWidth="1.5" />
      </svg>
      <div className="bakery-fraction-pie-label">{fractionLabel}</div>
    </div>
  );
}

/**
 * v0.33.38 (Ep114 bakery-orderline-glow): 分数 chunky badge
 *  - 用于强调 "1/3" 这种内联分数：粉色渐变背景 + 白边 + chunky shadow
 */
function FractionBadge({ label }: { label: string }) {
  return (
    <>
      <style>{`
        .bakery-fraction-badge {
          display: inline-flex;
          align-items: center;
          padding: 0.08rem 0.42rem;
          margin: 0 0.12rem;
          border-radius: 999px;
          background: linear-gradient(180deg, #fbcfe8, #ec4899);
          color: #ffffff;
          font-family: ui-monospace, monospace;
          font-weight: 900;
          font-size: 12px;
          letter-spacing: 0.02em;
          border: 1.5px solid #ffffff;
          box-shadow:
            0 2px 0 rgba(0, 0, 0, 0.18),
            0 4px 10px rgba(236, 72, 153, 0.5),
            inset 0 1px 0 rgba(255, 255, 255, 0.55);
          text-shadow: 0 1px 0 rgba(0, 0, 0, 0.25);
          line-height: 1.2;
          vertical-align: 0.05em;
        }
      `}</style>
      <span className="bakery-fraction-badge">{label}</span>
    </>
  );
}

/**
 * v0.33.38 (Ep114 bakery-orderline-glow): 文本内 `N/M` 模式高亮
 *  - 正则 /(\d+\/\d+)/ 把每个分数包成 FractionBadge
 *  - 周围文字保持常态
 */
function HighlightFractions({ text }: { text: string }) {
  const parts = text.split(/(\d+\/\d+)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (/^\d+\/\d+$/.test(p)) return <FractionBadge key={i} label={p} />;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}
