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

import { useCallback, useState } from "react";
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
      // 2. 视觉 pulse — 加入队列，让 Overlay 渲染并 800-1200ms 后自动清理
      const id = ++pulseIdSeq;
      const pulse: FeedbackPulse = {
        id,
        kind,
        label,
        createdAt: Date.now(),
      };
      setPulses((prev) => [...prev, pulse]);
      // 1200ms 后清理（足够动画播完）
      const ttl = kind === "complete" ? 1500 : 900;
      window.setTimeout(() => {
        setPulses((prev) => prev.filter((p) => p.id !== id));
      }, ttl);
    },
    [],
  );

  return { trigger, pulses };
}
