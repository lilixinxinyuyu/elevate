/**
 * v0.32.6: mini-game 中小进 PIP 反应 hook —— 把 game state 翻成 gesture/emotion/line。
 *
 * 3 个 mini-game 共用：
 *   - intro (phase=intro): wave + 欢迎台词
 *   - playing (phase=action 中)：idle/point + 提示
 *   - correct action (e.g. 扫码新商品 / 拖币 / 切块): thumbsUp + 简短鼓励
 *   - order complete (单完成): cheer + 表扬
 *   - all complete (3 单完成 reward 阶段): dance + 大表扬
 */

import { useMemo, useRef } from "react";
import type {
  MascotEmotion,
  MascotGesture,
  MascotOutfit,
  MascotSkin,
} from "../../components/Mascot3D";

export type MascotMood =
  | "welcome"
  | "playing"
  | "correct"
  | "orderDone"
  | "allDone";

export interface MascotReactionProps {
  gesture: MascotGesture;
  emotion: MascotEmotion;
  outfit: MascotOutfit;
  skin: MascotSkin;
  line: string;
  accent: string;
}

interface UseMascotReactionInput {
  mood: MascotMood;
  /** 主题色 (建筑) */
  accent: string;
  /** 自定义 line override */
  lineOverride?: string;
}

const MOOD_TABLE: Record<MascotMood, { gesture: MascotGesture; emotion: MascotEmotion; line: string[] }> = {
  welcome: {
    gesture: "wave",
    emotion: "happy",
    line: ["欢迎光临～", "今天的小帮手是你呀！", "客人来啦，加油！"],
  },
  playing: {
    gesture: "point",
    emotion: "neutral",
    line: ["看看价签的小数～", "想想等于多少？", "加油慢慢来", "你可以的！"],
  },
  correct: {
    gesture: "thumbsUp",
    emotion: "happy",
    line: ["对啦！", "棒棒！", "继续～", "做得好！"],
  },
  orderDone: {
    gesture: "cheer",
    emotion: "happy",
    line: ["客人很满意！", "做得真好！", "下一位客人～"],
  },
  allDone: {
    gesture: "dance",
    emotion: "happy",
    line: ["今天的客人都开心啦！", "你太棒了 Selena！", "店里都被你照顾好啦！"],
  },
};

export function useMascotReaction({
  mood,
  accent,
  lineOverride,
}: UseMascotReactionInput): MascotReactionProps {
  // 同一 mood 多次切换，line 可循环 (用 ref 记 cycle index 避免反复重置)
  const lineCycleRef = useRef<Record<MascotMood, number>>({
    welcome: 0,
    playing: 0,
    correct: 0,
    orderDone: 0,
    allDone: 0,
  });

  return useMemo(() => {
    const cfg = MOOD_TABLE[mood];
    const idx = lineCycleRef.current[mood] ?? 0;
    const line = lineOverride ?? cfg.line[idx % cfg.line.length]!;
    lineCycleRef.current[mood] = (idx + 1) % cfg.line.length;
    return {
      gesture: cfg.gesture,
      emotion: cfg.emotion,
      outfit: "default" as MascotOutfit,
      skin: "default" as MascotSkin,
      line,
      accent,
    };
  }, [mood, accent, lineOverride]);
}
