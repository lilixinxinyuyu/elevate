/**
 * Boss 角色数据 + 救场系统配置 (v0.31.49)
 *
 * 6 个单元 boss + 1 个期末大魔王。每个 boss 有 emoji 标识、名字、台词、HP 主色调。
 * 救场次数与数学段位绑定（school → country），随 XP 涨段位自动解锁更多救场。
 */

import { tierById, type Tier } from "./tiers";

export interface BossPersona {
  unitId: string;
  emoji: string;
  name: string;
  tagline: string;
  /** Tailwind color tokens (e.g. cyan, violet) — 用于 HP 条 / 主题 */
  color: "cyan" | "violet" | "amber" | "rose" | "emerald" | "sky" | "fuchsia";
}

export const UNIT_BOSSES: BossPersona[] = [
  {
    unitId: "G4B_U1_DECIMAL_ADD_SUB",
    emoji: "🌊",
    name: "小数浪潮怪",
    tagline: "我的小数比你的多一位！",
    color: "cyan",
  },
  {
    unitId: "G4B_U2_TRI_QUAD",
    emoji: "📐",
    name: "三角魔兽",
    tagline: "180 度内角和你算清楚没？",
    color: "violet",
  },
  {
    unitId: "G4B_U3_DECIMAL_MULTIPLY",
    emoji: "✖️",
    name: "倍数巨人",
    tagline: "我能让任何小数翻倍！",
    color: "amber",
  },
  {
    unitId: "G4B_U4_OBSERVE_OBJECTS",
    emoji: "👁️",
    name: "视角恶魔",
    tagline: "你看到的不是真的我！",
    color: "rose",
  },
  {
    unitId: "G4B_U5_EQUATIONS",
    emoji: "⚖️",
    name: "平衡魔王",
    tagline: "天平两端要相等，敢挑战吗？",
    color: "emerald",
  },
  {
    unitId: "G4B_U6_DATA",
    emoji: "📊",
    name: "统计巨怪",
    tagline: "我的平均数你算得出？",
    color: "sky",
  },
];

export const FINAL_BOSS: BossPersona = {
  unitId: "FINAL",
  emoji: "👑",
  name: "数学大魔王",
  tagline: "终极 boss 在此！集齐 6 单元 4 星才能见我！",
  color: "fuchsia",
};

export function bossForUnit(unitId: string): BossPersona | null {
  return UNIT_BOSSES.find((b) => b.unitId === unitId) ?? null;
}

/**
 * 救场次数 + perk 配置（动态 — 跟数学段位绑定）
 *
 * 段位 5 档（不含期末状元 — 数学只到 country）：
 *   school (和平街小学)   → 1 次基础救场
 *   district (锦江区)     → 1 次 + 答对救场后回 1 颗心
 *   city (成都市)         → 2 次 + 救场免 XP 扣分
 *   province (四川省)     → 2 次 + 可让小进讲完整解题
 *   country (全国)        → 3 次 + boss 起始 HP -10%
 */
export interface RescueAllowance {
  count: number;
  freeXpPenalty: boolean; // city+ 起免扣分
  refillHeartOnUse: boolean; // district+ 起 答对救场题回血
  fullExplain: boolean; // province+ 起救场可请小进讲完整解题
  bossHpDiscount: number; // 0..0.1 — country 段 -10%
}

export function rescueAllowanceForTier(tier: Tier | null): RescueAllowance {
  if (!tier) return { count: 1, freeXpPenalty: false, refillHeartOnUse: false, fullExplain: false, bossHpDiscount: 0 };
  switch (tier.id) {
    case "school":
      return { count: 1, freeXpPenalty: false, refillHeartOnUse: false, fullExplain: false, bossHpDiscount: 0 };
    case "district":
      return { count: 1, freeXpPenalty: false, refillHeartOnUse: true, fullExplain: false, bossHpDiscount: 0 };
    case "city":
      return { count: 2, freeXpPenalty: true, refillHeartOnUse: true, fullExplain: false, bossHpDiscount: 0 };
    case "province":
      return { count: 2, freeXpPenalty: true, refillHeartOnUse: true, fullExplain: true, bossHpDiscount: 0 };
    case "country":
      return { count: 3, freeXpPenalty: true, refillHeartOnUse: true, fullExplain: true, bossHpDiscount: 0.1 };
    default:
      return { count: 1, freeXpPenalty: false, refillHeartOnUse: false, fullExplain: false, bossHpDiscount: 0 };
  }
}

export function rescuePerksDescription(allowance: RescueAllowance): string[] {
  const parts: string[] = [`${allowance.count} 次/场`];
  if (allowance.freeXpPenalty) parts.push("免 XP 扣分");
  if (allowance.refillHeartOnUse) parts.push("救场答对回血");
  if (allowance.fullExplain) parts.push("可听小进完整解题");
  if (allowance.bossHpDiscount > 0) parts.push(`Boss HP -${Math.round(allowance.bossHpDiscount * 100)}%`);
  return parts;
}

/** Tailwind class 映射 — 给 BossPanel / HP 条用 */
export const COLOR_CLASSES: Record<BossPersona["color"], { from: string; to: string; text: string; border: string; hpFrom: string; hpTo: string }> = {
  cyan: { from: "from-cyan-500/30", to: "to-cyan-700/15", text: "text-cyan-100", border: "border-cyan-400/50", hpFrom: "from-cyan-400", hpTo: "to-cyan-600" },
  violet: { from: "from-violet-500/30", to: "to-violet-700/15", text: "text-violet-100", border: "border-violet-400/50", hpFrom: "from-violet-400", hpTo: "to-violet-600" },
  amber: { from: "from-amber-500/30", to: "to-amber-700/15", text: "text-amber-100", border: "border-amber-400/50", hpFrom: "from-amber-400", hpTo: "to-amber-600" },
  rose: { from: "from-rose-500/30", to: "to-rose-700/15", text: "text-rose-100", border: "border-rose-400/50", hpFrom: "from-rose-400", hpTo: "to-rose-600" },
  emerald: { from: "from-emerald-500/30", to: "to-emerald-700/15", text: "text-emerald-100", border: "border-emerald-400/50", hpFrom: "from-emerald-400", hpTo: "to-emerald-600" },
  sky: { from: "from-sky-500/30", to: "to-sky-700/15", text: "text-sky-100", border: "border-sky-400/50", hpFrom: "from-sky-400", hpTo: "to-sky-600" },
  fuchsia: { from: "from-fuchsia-500/30", to: "to-fuchsia-700/15", text: "text-fuchsia-100", border: "border-fuchsia-400/50", hpFrom: "from-fuchsia-400", hpTo: "to-rose-600" },
};
