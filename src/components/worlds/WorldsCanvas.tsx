/**
 * v0.32.9: 共用 Canvas 包装 —— 修 R3F 冷启动空白 P0 issue。
 *
 * Codex CLI + Gemini CLI 双方 Episode 1 review 共同标记为 P0 的最高优先级修复：
 *  - 不再用 setTimeout dispatch resize workaround
 *  - onCreated 内强制 gl.setSize + camera.updateProjectionMatrix + invalidate
 *  - 父容器 ResizeObserver 等到非零尺寸再 mount Canvas（避免 0×0 启动）
 *  - 顶层 Suspense fallback 用 drei useProgress 显示加载进度
 *  - 30s 未 ready 显示重试按钮
 */

import { useEffect, useRef, useState, Suspense } from "react";
import type { ReactNode } from "react";
import { Canvas, type CanvasProps, useThree } from "@react-three/fiber";
import { useProgress, Html } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";

interface WorldsCanvasProps extends CanvasProps {
  children: ReactNode;
  /** 加载界面背景色 */
  loadingBg?: string;
  /** 加载界面 emoji */
  loadingEmoji?: string;
  /** 加载界面标题 */
  loadingTitle?: string;
  /** v0.32.60 (Ep36 Q): 加载界面 rotating hints */
  loadingHints?: string[];
  /**
   * v0.32.17：是否启用后处理（Bloom + Vignette），默认 true。
   * Bloom 给柜台高光、emoji、emissive 材质添加柔光晕；
   * Vignette 给边缘加暗角，强化绘本沉浸感。
   */
  postFx?: boolean;
}

// v0.32.65 (Ep41 W): loading 背景从纯色 → layered gradient + grid + dot pattern
// 加 visual depth 同时不抢主视觉。accent 根据 bg 推断（深紫色→紫光，浅色→琥珀光）。
function getLoadingBackdrop(bg: string): import("react").CSSProperties {
  const isDark = bg && bg.startsWith("#0") || (bg && bg.startsWith("#1"));
  const accent = isDark ? "#a78bfa" : "#f59e0b";
  return {
    backgroundColor: bg,
    backgroundImage: `
      radial-gradient(circle at 20% 22%, ${accent}55, transparent 30%),
      radial-gradient(circle at 82% 76%, rgba(255,255,255,0.18), transparent 28%),
      linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px),
      radial-gradient(circle, rgba(255,255,255,0.16) 1px, transparent 1.5px)
    `,
    backgroundSize: "100% 100%, 100% 100%, 28px 28px, 28px 28px, 10px 10px",
  };
}

// v0.32.60 (Ep36 Q): 默认加载提示，5-7s 内 rotate
const DEFAULT_LOADING_HINTS = [
  "看清客人的订单，再开始操作",
  "发光区域就是可交互目标",
  "做完一单就解锁地图装饰",
  "答错也能学到东西，看下面的提示",
  "拖拽 + 时机点击 + 键盘 — 每店玩法不同",
];

/**
 * Canvas 启动稳定版：
 *  1. 父容器 ResizeObserver 等非零 size
 *  2. onCreated 内 force render + invalidate
 *  3. Suspense fallback 3D 进度页
 */
export function WorldsCanvas({
  children,
  loadingBg = "#0f172a",
  loadingEmoji = "🎡",
  loadingTitle = "加载中…",
  loadingHints = DEFAULT_LOADING_HINTS,
  postFx = true,
  onCreated,
  ...rest
}: WorldsCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const check = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setReady(true);
    };
    check();
    if (ready) return;
    const ob = new ResizeObserver(check);
    ob.observe(el);
    return () => ob.disconnect();
  }, [ready]);

  return (
    <div ref={containerRef} className="absolute inset-0">
      {ready && (
        <Canvas
          {...rest}
          onCreated={(state) => {
            // 父来源的 onCreated 先执行（设 camera lookAt 等）
            onCreated?.(state);
            // 强制 update + 渲染一帧
            const { gl, camera, size, invalidate } = state;
            gl.setSize(size.width, size.height, false);
            if ("updateProjectionMatrix" in camera) {
              camera.updateProjectionMatrix();
            }
            invalidate();
          }}
        >
          <Suspense
            fallback={
              <LoadingScreen
                bg={loadingBg}
                emoji={loadingEmoji}
                title={loadingTitle}
                hints={loadingHints}
              />
            }
          >
            {children}
            {/* v0.32.17：后处理 — Bloom 柔光 + Vignette 暗角。
                参数低强度，避免文字 / drei Text 被 bloom 模糊。
                multisampling=0 跟 R3F 默认抗锯齿配合。 */}
            {postFx && (
              <EffectComposer multisampling={0}>
                <Bloom
                  intensity={0.42}
                  luminanceThreshold={0.88}
                  luminanceSmoothing={0.04}
                  mipmapBlur
                />
                <Vignette
                  eskil={false}
                  offset={0.22}
                  darkness={0.42}
                />
              </EffectComposer>
            )}
          </Suspense>
          <ForceFirstFrame />
        </Canvas>
      )}
      {!ready && (
        <div className="w-full h-full" style={getLoadingBackdrop(loadingBg)}>
          <WorldLoadingBody
            bg={loadingBg}
            emoji={loadingEmoji}
            title={loadingTitle}
            progress={8}
            hints={loadingHints}
            detail="正在准备画布..."
          />
        </div>
      )}
    </div>
  );
}

/**
 * 在 R3F 内部强制触发一帧渲染。Mount 后立即 invalidate + 短延迟再 invalidate。
 * 兜底"挂在 Suspense fallback 后不重画"的边缘情况。
 */
function ForceFirstFrame() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
    const t1 = setTimeout(() => invalidate(), 50);
    const t2 = setTimeout(() => invalidate(), 300);
    const t3 = setTimeout(() => invalidate(), 1000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [invalidate]);
  return null;
}

/** 3D 内进度加载页 (用 drei useProgress) */
function LoadingScreen({
  bg,
  emoji,
  title,
  hints,
}: {
  bg: string;
  emoji: string;
  title: string;
  hints: string[];
}) {
  const { progress, active, item } = useProgress();
  return (
    <Html
      fullscreen
      style={{
        ...getLoadingBackdrop(bg),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <WorldLoadingBody
        bg={bg}
        emoji={emoji}
        title={title}
        progress={active ? progress : 100}
        hints={hints}
        detail={item ? "正在装入素材..." : active ? "" : "马上进入"}
      />
    </Html>
  );
}

/**
 * v0.32.60 (Ep36 Q): 共用 loading shell — chunky 玩家友好版。
 * - 大 emoji + 头顶 sparkle 光环
 * - chunky 进度条带 shimmer
 * - 旋转 hint：每 2.6s 切一条
 * - 数字百分比 + detail 副文案
 */
function WorldLoadingBody({
  bg,
  emoji,
  title,
  progress,
  hints,
  detail,
}: {
  bg: string;
  emoji: string;
  title: string;
  progress: number;
  hints: string[];
  detail?: string;
}) {
  const [hintIdx, setHintIdx] = useState(0);
  useEffect(() => {
    if (hints.length <= 1) return;
    const id = window.setInterval(() => {
      setHintIdx((i) => (i + 1) % hints.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, [hints.length]);
  const pct = Math.min(100, Math.max(0, Math.round(progress)));
  // 简单根据 bg 推断 accent
  const accent = bg && bg.startsWith("#1") ? "#a78bfa" : "#f59e0b";
  const hint = hints.length > 0 ? hints[hintIdx % hints.length] : null;
  return (
    <div
      style={{
        textAlign: "center",
        color: "#fff",
        maxWidth: 360,
        padding: "0 1rem",
        margin: "0 auto",
      }}
    >
      {/* emoji + sparkle 光环 */}
      <div
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 120,
          height: 120,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: `radial-gradient(circle at 50% 50%, ${accent}55 0%, transparent 65%)`,
            animation: "world-load-halo 2.4s ease-in-out infinite",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: -6,
            borderRadius: "50%",
            border: `3px solid ${accent}cc`,
            borderTopColor: "transparent",
            borderRightColor: "transparent",
            animation: "world-load-spin 1.6s linear infinite",
          }}
        />
        <div
          style={{
            fontSize: 56,
            animation: "world-load-emoji-bob 2.2s ease-in-out infinite",
            filter: `drop-shadow(0 4px 12px ${accent}aa)`,
          }}
        >
          {emoji}
        </div>
      </div>

      {/* 标题 */}
      <div
        style={{
          marginTop: 18,
          fontSize: 18,
          fontWeight: 900,
          letterSpacing: 1.5,
          textShadow: "0 2px 8px rgba(0,0,0,0.45)",
        }}
      >
        {title}
      </div>

      {/* chunky 进度条 + shimmer */}
      <div
        style={{
          position: "relative",
          width: 220,
          height: 12,
          margin: "14px auto 0",
          background: "rgba(255,255,255,0.16)",
          borderRadius: 999,
          overflow: "hidden",
          border: "2px solid rgba(255,255,255,0.25)",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${accent}, #f97316)`,
            transition: "width 0.25s ease-out",
            boxShadow: `0 0 12px ${accent}aa, inset 0 -2px 0 rgba(0,0,0,0.18)`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.45) 50%, transparent 65%)",
            backgroundSize: "200% 100%",
            animation: "world-load-shimmer 1.6s linear infinite",
            mixBlendMode: "overlay",
          }}
        />
      </div>

      <div
        style={{
          fontSize: 12,
          opacity: 0.85,
          marginTop: 6,
          fontVariantNumeric: "tabular-nums",
          fontWeight: 700,
          letterSpacing: 0.5,
        }}
      >
        {pct}%
        {detail ? <span style={{ opacity: 0.6, marginLeft: 8 }}>· {detail}</span> : null}
      </div>

      {/* rotating hint */}
      {hint && (
        <div
          key={hintIdx}
          style={{
            marginTop: 16,
            fontSize: 12,
            fontWeight: 600,
            color: "rgba(255,255,255,0.82)",
            background: "rgba(0,0,0,0.28)",
            borderRadius: 999,
            padding: "6px 14px",
            display: "inline-block",
            border: "1.5px solid rgba(255,255,255,0.18)",
            animation: "world-load-hint-fade 360ms ease-out",
            maxWidth: 320,
          }}
        >
          💡 {hint}
        </div>
      )}

      <style>{`
        @keyframes world-load-spin { to { transform: rotate(360deg); } }
        @keyframes world-load-emoji-bob {
          0%, 100% { transform: translateY(0) rotate(-3deg); }
          50%      { transform: translateY(-6px) rotate(3deg); }
        }
        @keyframes world-load-halo {
          0%, 100% { transform: scale(0.92); opacity: 0.6; }
          50%      { transform: scale(1.12); opacity: 0.95; }
        }
        @keyframes world-load-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes world-load-hint-fade {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
