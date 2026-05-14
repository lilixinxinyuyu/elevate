/**
 * 题目页右下角小进 PIP —— 工坊 + worlds session 共用。
 *
 * v0.32.14（双 CLI Episode 3 review 一致建议）：
 *  - 去硬框：rounded-3xl border bg → 软边浮动半身像（仅底部 shadow）
 *  - idle 浮动：CSS keyframe sin 上下浮动 ±4px
 *  - 反馈联动：reaction prop（pickup/drop/correct/wrong/complete）
 *    - correct → bounce 缩放 + 上跳
 *    - wrong   → 左右摇头 + 微旋
 *    - complete → 大幅 bounce + glow
 *  - 气泡 ease：line 出现/消失 fade + scale + 滑入
 *
 * Lazy 加载：避免主路径 train 用户也下载 R3F / VRM bundle。
 */
import { Suspense, lazy, useEffect, useState } from "react";
import type { MascotEmotion, MascotGesture, MascotOutfit, MascotSkin } from "../Mascot3D";
import type { FeedbackKind } from "../../lib/worlds/useWorldFeedback";

const Mascot3D = lazy(() => import("../Mascot3D"));

interface Props {
  gesture: MascotGesture;
  emotion: MascotEmotion;
  outfit: MascotOutfit;
  skin: MascotSkin;
  /** 可选浮窗台词 */
  line?: string;
  /** 可选 accent color (matches realm) */
  accent?: string;
  /**
   * v0.32.14: 反馈联动 — 跟 useWorldFeedback.lastReaction 配对。
   * 传 { kind, seq }，seq 变化触发重播动画。
   */
  reaction?: { kind: FeedbackKind; seq: number } | null;
}

export function MascotPIP({
  gesture,
  emotion,
  outfit,
  skin,
  line,
  accent,
  reaction,
}: Props) {
  // 当前反应动画 class — 由 reaction.seq 触发重播
  const [animClass, setAnimClass] = useState<string>("");
  useEffect(() => {
    if (!reaction) return;
    let cls = "";
    let dur = 600;
    switch (reaction.kind) {
      case "correct":
        cls = "mascot-bounce-correct";
        dur = 700;
        break;
      case "wrong":
        cls = "mascot-shake-wrong";
        dur = 600;
        break;
      case "complete":
        cls = "mascot-bounce-complete";
        dur = 1100;
        break;
      // pickup / drop: 不做整体动画（频率太高，会闪烁）
      default:
        return;
    }
    // 切到 "" 再切到 cls 让 CSS animation 重新触发
    setAnimClass("");
    const t1 = window.setTimeout(() => setAnimClass(cls), 16);
    const t2 = window.setTimeout(() => setAnimClass(""), dur);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [reaction?.seq, reaction?.kind]);

  const accentColor = accent ?? "#a78bfa";

  return (
    <div
      className="fixed bottom-3 right-3 pointer-events-none mascot-pip-float"
      style={
        {
          zIndex: 30,
          width: 196,
          height: 232,
          // v0.32.56 (Ep32 P): CSS var → 子节点能用 var(--pip-accent)
          ["--pip-accent" as string]: accentColor,
        } as React.CSSProperties
      }
    >
      {/* v0.32.56 (Ep32 P): 呼吸光晕 — 在 mascot 圆框背后 */}
      <div className="mascot-pip-halo" />

      {/* 底部软阴影底座（圆形 radial gradient） */}
      <div
        className="absolute"
        style={{
          left: "50%",
          bottom: 18,
          width: 130,
          height: 18,
          transform: "translateX(-50%)",
          background: `radial-gradient(ellipse, ${accentColor}80 0%, transparent 70%)`,
          filter: "blur(6px)",
          opacity: 0.7,
          zIndex: 0,
        }}
      />

      {/* 半身像（带 reaction 动画） */}
      <div
        className={`absolute inset-0 mascot-pip-inner ${animClass}`}
        style={{
          // soft edge：上半 fade out，底部柔化
          maskImage:
            "linear-gradient(to bottom, transparent 0%, #000 18%, #000 88%, transparent 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, #000 18%, #000 88%, transparent 100%)",
          // accent 光晕背景（淡 radial glow）
          background: `radial-gradient(circle at 50% 60%, ${accentColor}25 0%, transparent 65%)`,
          zIndex: 1,
        }}
      >
        <Suspense
          fallback={
            <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
              …
            </div>
          }
        >
          <Mascot3D
            view="portrait"
            skin={skin}
            outfit={outfit}
            gesture={gesture}
            emotion={emotion}
          />
        </Suspense>
      </div>

      {/* v0.32.56 (Ep32 P): online 绿点 — 表示老师在线 */}
      <span className="mascot-pip-online" />

      {/* v0.32.56 (Ep32 P): 底部 label chip — "小进 · 在线" */}
      <div className="mascot-pip-label">
        <span className="mascot-pip-label-dot" />
        小进 · 在线
      </div>

      {/* 对话气泡 — 在 mascot 左侧，朝右指向 mascot */}
      {line && (
        <div
          key={line}
          className="absolute mascot-bubble-in"
          style={{
            right: 196,
            top: 28,
            maxWidth: 220,
            zIndex: 2,
          }}
        >
          <div
            className="px-3 py-2 rounded-2xl text-[11px] font-medium shadow-2xl relative"
            style={{
              background: "rgba(255,255,255,0.96)",
              color: "#0f172a",
              border: `2px solid ${accentColor}66`,
              backdropFilter: "blur(8px)",
            }}
          >
            {line}
            {/* 三角指向 mascot */}
            <span
              className="absolute"
              style={{
                right: -8,
                top: "50%",
                transform: "translateY(-50%)",
                width: 0,
                height: 0,
                borderTop: "7px solid transparent",
                borderBottom: "7px solid transparent",
                borderLeft: "9px solid rgba(255,255,255,0.96)",
              }}
            />
          </div>
        </div>
      )}

      <style>{`
        /* 整个 PIP 闲时浮动 */
        @keyframes mascot-pip-float-kf {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-4px); }
        }
        .mascot-pip-float {
          animation: mascot-pip-float-kf 3.6s ease-in-out infinite;
        }
        /* v0.32.56 (Ep32 P): 呼吸光晕 — 在 mascot 背后扩张收缩 */
        .mascot-pip-halo {
          position: absolute;
          left: 50%;
          bottom: 28px;
          transform: translateX(-50%) scale(1);
          width: 168px;
          height: 168px;
          border-radius: 999px;
          background: var(--pip-accent, #a78bfa);
          opacity: 0.18;
          filter: blur(14px);
          z-index: 0;
          pointer-events: none;
          animation: mascot-pip-halo-breathe 2.8s ease-in-out infinite;
        }
        @keyframes mascot-pip-halo-breathe {
          0%, 100% { transform: translateX(-50%) scale(0.94); opacity: 0.14; }
          50%      { transform: translateX(-50%) scale(1.08); opacity: 0.30; }
        }
        /* 右上角 online 绿点 */
        .mascot-pip-online {
          position: absolute;
          right: 14px;
          top: 14px;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: #22c55e;
          border: 2.5px solid #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3), 0 0 0 0 rgba(34, 197, 94, 0.6);
          z-index: 3;
          animation: mascot-pip-online-pulse 1.8s ease-in-out infinite;
        }
        @keyframes mascot-pip-online-pulse {
          0%   { box-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 0 0 0 rgba(34,197,94,0.55); }
          70%  { box-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 0 0 8px rgba(34,197,94,0); }
          100% { box-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 0 0 0 rgba(34,197,94,0); }
        }
        /* 底部 label chip */
        .mascot-pip-label {
          position: absolute;
          left: 50%;
          bottom: 4px;
          transform: translateX(-50%);
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 11px 3px 8px;
          border-radius: 999px;
          background: linear-gradient(180deg, #ffffff, #f1f5f9);
          border: 2px solid var(--pip-accent, #a78bfa);
          font-size: 10.5px;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: 0.5px;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.9);
          z-index: 3;
          white-space: nowrap;
        }
        .mascot-pip-label-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #22c55e;
          box-shadow: 0 0 4px rgba(34, 197, 94, 0.7);
        }
        /* 答对：弹跳 + scale up */
        @keyframes mascot-bounce-correct-kf {
          0%   { transform: scale(1) translateY(0); }
          35%  { transform: scale(1.18) translateY(-14px); }
          65%  { transform: scale(0.96) translateY(3px); }
          100% { transform: scale(1) translateY(0); }
        }
        .mascot-bounce-correct {
          animation: mascot-bounce-correct-kf 700ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        /* 答错：左右摇头 + 微旋 */
        @keyframes mascot-shake-wrong-kf {
          0%, 100% { transform: translateX(0) rotate(0); }
          18%      { transform: translateX(-8px) rotate(-4deg); }
          42%      { transform: translateX(7px) rotate(3deg); }
          68%      { transform: translateX(-5px) rotate(-2deg); }
          88%      { transform: translateX(3px) rotate(1deg); }
        }
        .mascot-shake-wrong {
          animation: mascot-shake-wrong-kf 600ms ease-in-out;
        }
        /* 整单完成：大幅 bounce + 持续 glow */
        @keyframes mascot-bounce-complete-kf {
          0%   { transform: scale(1) translateY(0); filter: brightness(1); }
          20%  { transform: scale(1.28) translateY(-22px); filter: brightness(1.3); }
          45%  { transform: scale(0.92) translateY(2px); filter: brightness(1.15); }
          70%  { transform: scale(1.12) translateY(-8px); filter: brightness(1.2); }
          100% { transform: scale(1) translateY(0); filter: brightness(1); }
        }
        .mascot-bounce-complete {
          animation: mascot-bounce-complete-kf 1100ms cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        /* 对话气泡入场 */
        @keyframes mascot-bubble-in-kf {
          0%   { opacity: 0; transform: scale(0.7) translateX(12px); }
          60%  { opacity: 1; transform: scale(1.04) translateX(-2px); }
          100% { opacity: 1; transform: scale(1) translateX(0); }
        }
        .mascot-bubble-in {
          animation: mascot-bubble-in-kf 320ms ease-out;
        }
      `}</style>
    </div>
  );
}
