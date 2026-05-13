/**
 * v0.32.12: 奇遇乐园统一反馈层 hook（双 CLI Episode 2 review 选定 P1）。
 *
 * 提供 5 个反馈语义：
 *   - pickup: 抓物 / 选中（轻 tick + 短震动 10ms）
 *   - drop:   放下 / 进入区域（tick + 弱 pulse）
 *   - correct: 答对 / 提交成功（sfx.correct + 绿色 flash + scale pulse）
 *   - wrong:   答错 / 数字错（sfx.wrong + 红色 flash + 强震 [20,50,20]）
 *   - complete: 整单 / 全部完成（sfx.chest + 金色 flash + 中央大 "+5" pulse）
 *
 * 用法：
 *   const { trigger, pulses, OverlayElement } = useWorldFeedback();
 *   <OverlayElement />
 *   <MiniGame onSuccess={() => trigger("correct")} />
 *
 * 设计：
 *   - 不增加 bundle 大小 — 复用现有 src/lib/sfx.ts（Web Audio）
 *   - vibrate fallback：iOS Safari 不支持就 no-op
 *   - DOM-only overlay：不进 R3F Canvas，避免 z-fighting
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { sfx } from "../sfx";

export type FeedbackKind =
  | "pickup"
  | "drop"
  | "correct"
  | "wrong"
  | "complete";

export interface FeedbackPulse {
  id: number;
  kind: FeedbackKind;
  /** 屏幕中央显示的文字（仅 correct / wrong / complete） */
  label?: string;
  /** 创建时间戳，cleanup 用 */
  createdAt: number;
}

let pulseIdSeq = 0;

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* iOS 不支持 vibrate */
    }
  }
}

export function useWorldFeedback() {
  const [pulses, setPulses] = useState<FeedbackPulse[]>([]);
  /**
   * v0.32.14: 最新反馈类型 + 轮次 seq，给 MascotPIP 联动用。
   * seq 每 trigger 递增 — 让 useEffect 在相同 kind 重触发也能感知。
   */
  const [lastReaction, setLastReaction] = useState<{
    kind: FeedbackKind;
    seq: number;
  } | null>(null);

  const trigger = useCallback(
    (kind: FeedbackKind, label?: string) => {
      // 1. SFX + 触感
      switch (kind) {
        case "pickup":
          sfx.tick();
          vibrate(8);
          break;
        case "drop":
          sfx.tick();
          vibrate(12);
          break;
        case "correct":
          sfx.correct();
          vibrate([12, 40, 12]);
          break;
        case "wrong":
          sfx.wrong();
          vibrate([24, 60, 24, 60, 24]);
          break;
        case "complete":
          sfx.chest();
          vibrate([10, 60, 10, 60, 10, 60, 24]);
          break;
      }
      // 2. 视觉 pulse — 加入队列
      const id = ++pulseIdSeq;
      const pulse: FeedbackPulse = {
        id,
        kind,
        label,
        createdAt: Date.now(),
      };
      setPulses((prev) => [...prev, pulse]);
      const ttl = kind === "complete" ? 1500 : 900;
      window.setTimeout(() => {
        setPulses((prev) => prev.filter((p) => p.id !== id));
      }, ttl);

      // 3. Mascot reaction（同步 lastReaction state）
      setLastReaction({ kind, seq: id });
    },
    [],
  );

  /**
   * v0.32.23：把 ref 挂到 page outer div，hook 自动给 div 加 / 移除
   * worlds-screen-shake (correct) / worlds-screen-zoom (complete) CSS class，
   * 全屏轻抖 + 缩放冲击力。
   * CSS keyframes 定义在 WorldFeedbackOverlay <style> 块内（一并 ship）。
   */
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!lastReaction || !rootRef.current) return;
    let cls: string | null = null;
    let dur = 400;
    if (lastReaction.kind === "correct") {
      cls = "worlds-screen-shake";
      dur = 350;
    } else if (lastReaction.kind === "complete") {
      cls = "worlds-screen-zoom";
      dur = 800;
    }
    if (!cls) return;
    const node = rootRef.current;
    node.classList.add(cls);
    const t = window.setTimeout(() => {
      node.classList.remove(cls);
    }, dur);
    return () => window.clearTimeout(t);
    // 监听 seq 让相同 kind 重复触发也能 re-trigger
  }, [lastReaction?.seq, lastReaction?.kind]);

  return { trigger, pulses, lastReaction, rootRef };
}
