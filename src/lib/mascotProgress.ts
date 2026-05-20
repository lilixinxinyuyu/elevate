/**
 * 小进姐姐养成系统 — XP / 等级 / 音色解锁 / 隐藏技能。
 *
 * 设计理念：让小进从"工具"变成"伙伴"。Selena 跟小进互动越多越深，
 * 解锁的越多 → 自然就更想用。
 *
 * XP 持久化：db.meta key = `mascotXp::math::<studentId>`，跨设备 sync。
 *
 * 等级表（thresholds 可调；理论上 Selena 用 1-2 个月达到 Lv 8 解锁唱歌）：
 *   Lv 1   0 XP   实习老师小进 — 默认 Serena (v0.36.22 跟 TTS 统一, 原 Tina 挪到 Lv8)
 *   Lv 3  60      校园老师 — 解锁 Cindy（甜软）
 *   Lv 5  150     数学小老师 — 解锁 Sunny（活泼）
 *   Lv 8  320     数学高手 — 解锁 Serena + 唱乘法口诀技能
 *   Lv 12 600     数学大师 — 解锁 Mia + 数学冷笑话
 *   Lv 15 900     校园传奇 — 解锁 Hana + 3D 形象（Phase C）
 *   Lv 20 1500    神级老师 — 终极皮肤 + 多语言唱歌
 */

import { db } from "../db/dexie";

const SUBJECT = "math";

export type MascotXpReason =
  /** 每次开场对话（按 panel 计） */
  | "session_start"
  /** 成功讲解后再做对（错题 → 讲 → 重做对） */
  | "successful_retry"
  /** 用 review_session 跟小进总结当日 */
  | "session_review"
  /** 主动找小进聊（home 浮动按钮、技能树） */
  | "proactive_chat"
  /** 当日首次跟小进开口 */
  | "daily_first"
  /** 错题复活 (mistakes 页) 进入小进讲完 */
  | "mistake_revival"
  /** 隐藏技能首次解锁触发 */
  | "talent_unlocked"
  /**
   * v0.31.90: 完成 session（任意模式）— 不开口聊也涨。
   *
   * 之前 bug：所有 reason 都需要 TutorPanel 开口才触发，Selena 主要走 fluency /
   * 闯关 / 挑战，从不打开 tutor，小进就一直不升级。爸爸反馈"最近小进都没升级"。
   * 现在 finalizeSession 后给一点点经验，让小进跟随 Selena 一起成长。
   *
   * 经验值刻意做小（4 XP）— 不让小进单靠刷题就升到顶（那样会丢失"跟小进互动
   * 才长技能"的叙事）。Selena 真正想升级还是要主动开口跟小进聊。
   */
  | "session_complete";

const XP_PER_REASON: Record<MascotXpReason, number> = {
  session_start: 5,
  successful_retry: 15,
  session_review: 20,
  proactive_chat: 5,
  daily_first: 15,
  mistake_revival: 25,
  talent_unlocked: 30,
  session_complete: 4,
};

export interface MascotLevel {
  level: number;
  /** 进入此 lv 需要的累计 XP */
  threshold: number;
  /** 等级名号 */
  title: string;
  /** 此等级解锁的内容 */
  unlocks: {
    /** 音色 ID（accumulative — 高 lv 也保留低 lv 的） */
    voices?: string[];
    /** 隐藏技能 */
    talents?: ("sing_multiplication" | "math_jokes" | "birthday_song" | "rap_pi")[];
    /** Skin 名 */
    skins?: string[];
    /** 是否解锁 3D 形象 */
    unlocks3d?: boolean;
  };
}

// v0.31.54: 真实学术职业阶梯 — 助教 → 讲师 → 副教授 → 教授 → 副校长 → 校长。
// 7 级整条都是中国真实职称，孩子能直观感受到等级跃迁。校长正好落 Lv 20 顶点。
// 视觉层换名，不动 XP 阈值 / 解锁逻辑。
export const MASCOT_LEVELS: MascotLevel[] = [
  { level: 1, threshold: 0, title: "实习老师小进", unlocks: { voices: ["Serena"] } },
  { level: 3, threshold: 60, title: "助教小进", unlocks: { voices: ["Cindy"] } },
  { level: 5, threshold: 150, title: "讲师小进", unlocks: { voices: ["Sunny"], skins: ["graduation"] } },
  {
    level: 8,
    threshold: 320,
    title: "副教授小进",
    unlocks: { voices: ["Tina"], talents: ["sing_multiplication"] },
  },
  {
    level: 12,
    threshold: 600,
    title: "教授小进",
    unlocks: { voices: ["Mia"], talents: ["math_jokes"], skins: ["wizard"] },
  },
  {
    level: 15,
    threshold: 900,
    title: "副校长小进",
    unlocks: { voices: ["Hana"], unlocks3d: true },
  },
  {
    level: 20,
    threshold: 1500,
    title: "校长小进",
    unlocks: { skins: ["legendary"], talents: ["birthday_song"] },
  },
];

export interface MascotState {
  xp: number;
  level: MascotLevel;
  nextLevel: MascotLevel | null;
  /** 距离下一级还差多少 XP（最高级 = 0） */
  deltaToNext: number;
  /** 当前等级内进度 [0..1] */
  progressInLevel: number;
  /** 已解锁的音色（包括所有低等级） */
  unlockedVoices: string[];
  /** 已解锁的隐藏技能 */
  unlockedTalents: string[];
  /** 已解锁的 skin */
  unlockedSkins: string[];
  /** 是否已解锁 3D 形象 */
  unlocked3d: boolean;
}

export function levelFromXp(xp: number): MascotLevel {
  let curr = MASCOT_LEVELS[0]!;
  for (const lv of MASCOT_LEVELS) {
    if (xp >= lv.threshold) curr = lv;
    else break;
  }
  return curr;
}

function nextLevelAfter(level: MascotLevel): MascotLevel | null {
  const idx = MASCOT_LEVELS.findIndex((l) => l.level === level.level);
  return MASCOT_LEVELS[idx + 1] ?? null;
}

export function buildMascotState(xp: number): MascotState {
  const level = levelFromXp(xp);
  const next = nextLevelAfter(level);
  const deltaToNext = next ? Math.max(0, next.threshold - xp) : 0;
  const span = next ? next.threshold - level.threshold : 1;
  const progressInLevel = next ? Math.min(1, (xp - level.threshold) / span) : 1;

  // 把所有 ≤ level.level 的 unlocks 累加
  const voices = new Set<string>();
  const talents = new Set<string>();
  const skins = new Set<string>();
  let has3d = false;
  for (const lv of MASCOT_LEVELS) {
    if (lv.level > level.level) break;
    lv.unlocks.voices?.forEach((v) => voices.add(v));
    lv.unlocks.talents?.forEach((t) => talents.add(t));
    lv.unlocks.skins?.forEach((s) => skins.add(s));
    if (lv.unlocks.unlocks3d) has3d = true;
  }

  return {
    xp,
    level,
    nextLevel: next,
    deltaToNext,
    progressInLevel,
    unlockedVoices: Array.from(voices),
    unlockedTalents: Array.from(talents),
    unlockedSkins: Array.from(skins),
    unlocked3d: has3d,
  };
}

const xpKey = (studentId: string) => `mascotXp::${SUBJECT}::${studentId}`;
const equippedVoiceKey = (studentId: string) => `mascotVoice::${SUBJECT}::${studentId}`;
const lastDailyKey = (studentId: string) => `mascotLastDaily::${SUBJECT}::${studentId}`;

export async function getMascotXp(studentId: string): Promise<number> {
  const row = await db.meta.get(xpKey(studentId));
  const v = row?.value;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export async function getMascotState(studentId: string): Promise<MascotState> {
  const xp = await getMascotXp(studentId);
  return buildMascotState(xp);
}

/**
 * 加 XP。返回更新后的 state + 是否升了级（含新解锁的内容）。
 * - daily_first 每天最多触发一次（按本地日历日）
 * - 同 reason 短时间内重复忽略（防止 panel 重新挂载多次重发）
 */
export async function awardMascotXp(
  studentId: string,
  reason: MascotXpReason,
): Promise<{
  state: MascotState;
  awarded: number;
  leveledUp: boolean;
  newLevel?: MascotLevel;
  newUnlocks?: { voices: string[]; talents: string[]; skins: string[]; unlocks3d: boolean };
}> {
  const before = await getMascotState(studentId);

  // daily_first 节流
  if (reason === "daily_first") {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const last = await db.meta.get(lastDailyKey(studentId));
    if (last?.value === todayKey) {
      return { state: before, awarded: 0, leveledUp: false };
    }
    await db.meta.put({ key: lastDailyKey(studentId), value: todayKey });
  }

  const award = XP_PER_REASON[reason] ?? 0;
  if (award <= 0) return { state: before, awarded: 0, leveledUp: false };

  const newXp = before.xp + award;
  await db.meta.put({ key: xpKey(studentId), value: newXp });
  const after = buildMascotState(newXp);

  const leveledUp = after.level.level > before.level.level;
  let newUnlocks: { voices: string[]; talents: string[]; skins: string[]; unlocks3d: boolean } | undefined;
  if (leveledUp) {
    const beforeV = new Set(before.unlockedVoices);
    const beforeT = new Set(before.unlockedTalents);
    const beforeS = new Set(before.unlockedSkins);
    newUnlocks = {
      voices: after.unlockedVoices.filter((v) => !beforeV.has(v)),
      talents: after.unlockedTalents.filter((t) => !beforeT.has(t)),
      skins: after.unlockedSkins.filter((s) => !beforeS.has(s)),
      unlocks3d: after.unlocked3d && !before.unlocked3d,
    };
  }

  return {
    state: after,
    awarded: award,
    leveledUp,
    newLevel: leveledUp ? after.level : undefined,
    newUnlocks,
  };
}

/** 当前佩戴的音色（v0.36.22 默认 Serena — 跟 TTS 统一；切到没解锁的会被忽略） */
export async function getEquippedVoice(studentId: string): Promise<string> {
  const row = await db.meta.get(equippedVoiceKey(studentId));
  const v = typeof row?.value === "string" ? row.value : null;
  if (!v) return "Serena";
  // 校验：是否已解锁
  const state = await getMascotState(studentId);
  return state.unlockedVoices.includes(v) ? v : "Serena";
}

export async function setEquippedVoice(studentId: string, voice: string): Promise<boolean> {
  const state = await getMascotState(studentId);
  if (!state.unlockedVoices.includes(voice)) return false;
  await db.meta.put({ key: equippedVoiceKey(studentId), value: voice });
  return true;
}

/** 把 talent id 翻译成给孩子看的名字 */
export function talentDisplayName(id: string): string {
  switch (id) {
    case "sing_multiplication":
      return "🎵 唱乘法口诀";
    case "math_jokes":
      return "😆 数学冷笑话";
    case "birthday_song":
      return "🎂 生日歌";
    case "rap_pi":
      return "🎤 圆周率 rap";
    default:
      return id;
  }
}

/** voice id → 给孩子看的特征描述 */
export function voiceDescription(voice: string): string {
  switch (voice) {
    case "Tina":
      return "温柔耐心（默认）";
    case "Cindy":
      return "甜软可爱";
    case "Sunny":
      return "活泼阳光";
    case "Serena":
      return "温柔学姐";
    case "Mia":
      return "甜美知性";
    case "Hana":
      return "清亮快乐";
    default:
      return voice;
  }
}
