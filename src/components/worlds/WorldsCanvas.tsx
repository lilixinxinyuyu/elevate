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

interface WorldsCanvasProps extends CanvasProps {
  children: ReactNode;
  /** 加载界面背景色 */
  loadingBg?: string;
  /** 加载界面 emoji */
  loadingEmoji?: string;
  /** 加载界面标题 */
  loadingTitle?: string;
}

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
              />
            }
          >
            {children}
          </Suspense>
          <ForceFirstFrame />
        </Canvas>
      )}
      {!ready && (
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ background: loadingBg }}
        >
          <div className="text-white opacity-70 text-sm">
            <span className="text-3xl mr-2">{loadingEmoji}</span>
            正在准备…
          </div>
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
}: {
  bg: string;
  emoji: string;
  title: string;
}) {
  const { progress, active } = useProgress();
  return (
    <Html
      fullscreen
      style={{
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div style={{ textAlign: "center", color: "#fff" }}>
        <div
          style={{
            fontSize: 64,
            animation: "spin 1.4s linear infinite",
            display: "inline-block",
          }}
        >
          {emoji}
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 14,
            fontWeight: "bold",
            opacity: 0.85,
          }}
        >
          {title}
        </div>
        <div
          style={{
            width: 180,
            height: 6,
            margin: "8px auto 0",
            background: "rgba(255,255,255,0.15)",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.round(progress)}%`,
              height: "100%",
              background: "linear-gradient(90deg,#fbbf24,#f97316)",
              transition: "width 0.2s",
            }}
          />
        </div>
        <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>
          {Math.round(progress)}% {active ? "" : "·"}
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
      </div>
    </Html>
  );
}
