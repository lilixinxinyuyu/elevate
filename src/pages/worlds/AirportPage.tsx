/**
 * v0.32.7: 登机口 第一人称柜台 mini-game page。
 *
 * 路径: /worlds/xingfan/airport
 *
 * 玩法: 3 单装行李 cycle (英语量词+复数) → +XP + 装饰碎片 → 回 xingfan 地图
 */

import { useEffect, useState } from "react";
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

type Phase = "intro" | "loading";

export function AirportPage() {
  const navigate = useNavigate();
  const [orderIdx, setOrderIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("intro");
  const [completedCount, setCompletedCount] = useState(0);
  const [showReward, setShowReward] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  const order = AIRPORT_ORDERS[orderIdx]!;

  // R3F cold start 由 WorldsCanvas 接管

  const mood: MascotMood = showReward
    ? "allDone"
    : justCompleted
      ? "orderDone"
      : phase === "intro"
        ? "welcome"
        : "playing";
  const mascotProps = useMascotReaction({ mood, accent: "#06b6d4" });
  // v0.32.12：反馈层
  const { trigger, pulses } = useWorldFeedback();

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
    <div className="fixed inset-0 bg-cyan-50" style={{ zIndex: 50 }}>
      <WorldsCanvas
        camera={{ position: [0, 1.55, 1.6], fov: 50, near: 0.05, far: 50 }}
        onCreated={({ camera }) => camera.lookAt(0, 1.0, -0.5)}
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

        <StoreEnvironment />

        {phase === "loading" && (
          <AirportMiniGame
            order={order}
            onOrderComplete={handleOrderComplete}
            onFeedback={trigger}
          />
        )}
      </WorldsCanvas>

      <TopHUD
        orderIdx={orderIdx}
        completedCount={completedCount}
        onBack={() => navigate("/worlds/xingfan")}
      />

      <CustomerBubble
        emoji={order.customerEmoji}
        lineEn={order.customerLineEn}
        lineZh={order.customerLineZh}
        hint={
          phase === "loading"
            ? order.requests
                .map((r) => `${r.quantity} ${r.quantity > 1 ? LUGGAGE[r.itemId].englishPlural : LUGGAGE[r.itemId].english}`)
                .join(", ")
            : undefined
        }
      />

      {phase === "intro" && !showReward && (
        <IntroPanel order={order} orderIdx={orderIdx} onStart={() => setPhase("loading")} />
      )}

      {showReward && <RewardOverlay />}

      <MascotPIP
        gesture={mascotProps.gesture}
        emotion={mascotProps.emotion}
        outfit={mascotProps.outfit}
        skin={mascotProps.skin}
        line={mascotProps.line}
        accent={mascotProps.accent}
      />

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
      <div className="px-4 py-2 rounded-full bg-cyan-500/90 text-white text-xs font-bold backdrop-blur-md border border-white/30 shadow-lg">
        ✈️ 登机口 · Gate
      </div>
      <div className="px-3 py-2 rounded-xl bg-black/55 text-white text-xs font-bold backdrop-blur-md border border-white/25 shadow-lg">
        旅客 {completedCount + (orderIdx === completedCount ? 0 : 1)}/{AIRPORT_ORDERS.length}
      </div>
    </div>
  );
}

function CustomerBubble({
  emoji,
  lineEn,
  lineZh,
  hint,
}: {
  emoji: string;
  lineEn: string;
  lineZh: string;
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
        <div className="px-4 py-2.5 rounded-2xl bg-white/95 text-slate-900 text-sm font-medium shadow-2xl border-2 border-cyan-200 relative">
          <div className="font-bold text-cyan-700">{lineEn}</div>
          <div className="text-xs text-slate-500 mt-0.5">{lineZh}</div>
          {hint && (
            <div className="mt-1 text-xs text-cyan-700 font-bold">🛄 装: {hint}</div>
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
  order: AirportOrder;
  orderIdx: number;
  onStart: () => void;
}) {
  return (
    <div
      className="absolute pointer-events-none inset-0 flex items-end justify-center pb-12"
      style={{ zIndex: 60 }}
    >
      <div className="pointer-events-auto card bg-white/95 backdrop-blur-md p-5 shadow-2xl border-2 border-cyan-300 max-w-md text-center">
        <div className="text-cyan-700 text-xs font-bold mb-1">旅客 #{orderIdx + 1}</div>
        <div className="text-slate-900 text-sm leading-relaxed mb-1">
          <div className="font-bold text-cyan-800">{order.customerLineEn}</div>
        </div>
        <div className="text-xs text-slate-500 mb-3">{order.customerLineZh}</div>
        <div className="text-xs text-slate-600 mb-3">
          <div className="px-3 py-2 rounded-lg bg-cyan-50 border border-cyan-200">
            <div className="text-cyan-700 font-bold mb-1">装载清单</div>
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
        <button
          type="button"
          onClick={onStart}
          className="px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-sky-500 text-white text-base font-bold shadow-xl border-2 border-white/40 hover:scale-105 transition-transform"
        >
          🛄 开始装行李
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
        background: "radial-gradient(circle, rgba(103,232,249,0.3) 0%, rgba(0,0,0,0) 70%)",
      }}
    >
      <div className="text-center animate-bounce">
        <div className="text-8xl mb-3">✈️</div>
        <div className="px-6 py-3 rounded-2xl bg-cyan-500 text-white text-2xl font-bold shadow-2xl border-2 border-white">
          +5 XP · +1 装饰碎片
        </div>
        <div className="mt-2 text-cyan-900 text-sm font-medium drop-shadow">
          旅客们都顺利登机～回到星帆岛
        </div>
      </div>
    </div>
  );
}
