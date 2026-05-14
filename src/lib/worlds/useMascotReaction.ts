/**
 * v0.32.41 (Ep17): mini-game 中小进 PIP 反应 hook — 丰富化 line 池 + reaction 联动。
 *
 * v0.32.6 之前每池 3-4 句，Codex 三轮 review 都推第一优先（D Mascot line 丰富化）。
 * Ring Fit Adventure 风格：encourage / 倒数 / 偶尔搞笑 / 错误鼓励而非批评。
 *
 * 6 池：welcome / playing / correct / wrong / orderDone / allDone
 * 每池 8 句，循环递增 idx 避免重复。
 *
 * reaction 联动（来自 useWorldFeedback.lastReaction）：
 *   - reaction.seq 变化 + kind === "wrong" → 短暂走 wrong line（1.8s）
 *   - reaction.seq 变化 + kind === "correct" → 短暂走 correct line
 *   - 否则按 mood 默认
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  MascotEmotion,
  MascotGesture,
  MascotOutfit,
  MascotSkin,
} from "../../components/Mascot3D";
import type { FeedbackKind } from "./useWorldFeedback";

export type MascotMood =
  | "welcome"
  | "playing"
  | "correct"
  | "wrong"
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
  /**
   * v0.32.41: useWorldFeedback.lastReaction 联动。
   * seq 变化 + kind 为 wrong/correct → 短暂 1.8s 覆盖 mood，让 Mascot 实时反应。
   */
  reaction?: { kind: FeedbackKind; seq: number } | null;
}

interface MoodConfig {
  gesture: MascotGesture;
  emotion: MascotEmotion;
  line: string[];
}

const MOOD_TABLE: Record<MascotMood, MoodConfig> = {
  welcome: {
    gesture: "wave",
    emotion: "happy",
    line: [
      "欢迎光临～",
      "今天的小帮手是你呀！",
      "客人来啦，加油！",
      "Hi Selena，店里就交给你啦",
      "今天阳光真好，开张～",
      "试试看，我陪你！",
      "Selena 上线！客人都来了～",
      "深呼吸，咱们开始！",
    ],
  },
  playing: {
    gesture: "point",
    emotion: "neutral",
    line: [
      "看看价签的小数～",
      "想想等于多少？",
      "加油慢慢来",
      "你可以的！",
      "拖错了也没关系，再试就好",
      "心算一下应该不难～",
      "我相信你～",
      "认真看清楚再放",
    ],
  },
  correct: {
    gesture: "thumbsUp",
    emotion: "happy",
    line: [
      "对啦！",
      "棒棒！",
      "继续～",
      "做得好！",
      "Selena 真聪明！",
      "我就知道你行！",
      "完美！下一个～",
      "节奏不错呀～",
    ],
  },
  wrong: {
    gesture: "wave",
    emotion: "sad",
    line: [
      "再想想～",
      "不急不急，慢慢来",
      "我知道你会的，再试一次！",
      "差一点点，再看清楚",
      "没事的，重新来",
      "深呼吸，咱们再来一次",
      "Selena 一定能做对！",
      "题目读懂了吗？我等你～",
    ],
  },
  orderDone: {
    gesture: "cheer",
    emotion: "happy",
    line: [
      "客人很满意！",
      "做得真好！",
      "下一位客人～",
      "超棒，Selena！",
      "节奏稳稳的！",
      "继续保持～",
      "客人笑啦～",
      "又过一关！",
    ],
  },
  allDone: {
    gesture: "dance",
    emotion: "happy",
    line: [
      "今天的客人都开心啦！",
      "你太棒了 Selena！",
      "店里都被你照顾好啦！",
      "完美营业！收工～",
      "Selena 满分上岗！",
      "今天的小老板就是你 🎉",
      "明天再开张吧～",
      "我都看呆了！",
    ],
  },
};

/** reaction 覆盖 mood 的窗口（短暂） */
const OVERRIDE_DURATION_MS = 1800;

export function useMascotReaction({
  mood,
  accent,
  lineOverride,
  reaction,
}: UseMascotReactionInput): MascotReactionProps {
  // 同一 mood 多次切换，line 可循环
  const lineCycleRef = useRef<Record<MascotMood, number>>({
    welcome: 0,
    playing: 0,
    correct: 0,
    wrong: 0,
    orderDone: 0,
    allDone: 0,
  });

  // reaction 触发的短暂 override
  const [overrideMood, setOverrideMood] = useState<MascotMood | null>(null);
  useEffect(() => {
    if (!reaction) return;
    let override: MascotMood | null = null;
    if (reaction.kind === "wrong") override = "wrong";
    else if (reaction.kind === "correct") override = "correct";
    // pickup / drop / complete 不覆盖（complete 用 page 级 mood=allDone 自然切换）
    if (!override) return;
    setOverrideMood(override);
    const t = window.setTimeout(() => setOverrideMood(null), OVERRIDE_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [reaction?.seq, reaction?.kind]);

  return useMemo(() => {
    const effectiveMood: MascotMood = overrideMood ?? mood;
    const cfg = MOOD_TABLE[effectiveMood];
    const idx = lineCycleRef.current[effectiveMood] ?? 0;
    const line = lineOverride ?? cfg.line[idx % cfg.line.length]!;
    lineCycleRef.current[effectiveMood] = (idx + 1) % cfg.line.length;
    return {
      gesture: cfg.gesture,
      emotion: cfg.emotion,
      outfit: "default" as MascotOutfit,
      skin: "default" as MascotSkin,
      line,
      accent,
    };
  }, [mood, overrideMood, accent, lineOverride]);
}
