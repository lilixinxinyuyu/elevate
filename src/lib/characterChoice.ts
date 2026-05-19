/**
 * v0.35.90 — Character Choice persistence helpers.
 *
 * Bruce 拍板: onboarding 时同学选 gender + archetype + 回答 3 题 personalization.
 * 选择存 db.meta 里 (per-student), 后续 升段 时复用 prompt.
 *
 * keys:
 * - `characterChoice::math::<studentId>` → { archetype, gender, chosenAt }
 * - `characterPersonalization::math::<studentId>` → { hardestUnit, encouragement, etc. }
 */
import { db } from "../db/dexie";

export type Archetype = "scholar" | "scientist" | "explorer" | "mage" | "warrior" | "artist";
export type Gender = "female" | "male";

export interface CharacterChoice {
  archetype: Archetype;
  gender: Gender;
  chosenAt: number;
}

export interface CharacterPersonalization {
  // Bruce 同意可以问 3-5 题. 这里 store 答案 (open-ended structure for future Q)
  answers: Record<string, string>;
  answeredAt: number;
}

function choiceKey(studentId: string): string {
  return `characterChoice::math::${studentId}`;
}

function personalizationKey(studentId: string): string {
  return `characterPersonalization::math::${studentId}`;
}

export async function getCharacterChoice(studentId: string): Promise<CharacterChoice | null> {
  const row = await db.meta.get(choiceKey(studentId));
  if (!row) return null;
  return row.value as CharacterChoice;
}

export async function setCharacterChoice(
  studentId: string,
  choice: Omit<CharacterChoice, "chosenAt">,
): Promise<void> {
  await db.meta.put({
    key: choiceKey(studentId),
    value: { ...choice, chosenAt: Date.now() },
  });
}

export async function getPersonalization(studentId: string): Promise<CharacterPersonalization | null> {
  const row = await db.meta.get(personalizationKey(studentId));
  if (!row) return null;
  return row.value as CharacterPersonalization;
}

export async function setPersonalization(
  studentId: string,
  answers: Record<string, string>,
): Promise<void> {
  await db.meta.put({
    key: personalizationKey(studentId),
    value: { answers, answeredAt: Date.now() },
  });
}

/**
 * Build avatar URL for current tier + character choice.
 * Phase A (now): only Lv1 学校段 base available per archetype × gender.
 * 其他段位 still uses tier-<id>-v1.png (single Lv5 国家英雄 demo for now).
 */
export function characterAvatarUrl(
  tierId: string,
  choice: CharacterChoice | null,
): string | null {
  if (!choice) {
    // No onboarding done → fallback to old single tier-<id> PNG
    if (tierId === "school" || tierId === "country") {
      return `/character/tier-${tierId}-v1.png`;
    }
    return null;
  }
  // Has choice → use archetype-gender base for school tier
  if (tierId === "school") {
    return `/character/base-${choice.archetype}-${choice.gender}-school-v1.png`;
  }
  // For other tiers, still use old default (until Phase 2b gen Lv2-5)
  if (tierId === "country") {
    return `/character/tier-country-v1.png`;
  }
  return null;
}

export const ARCHETYPE_META: Record<Archetype, { emoji: string; label: string; desc: string; outfit: string }> = {
  scholar: { emoji: "📚", label: "学者", desc: "勤奋认真的学习者", outfit: "蓝开衫 + 笔记本 + 铅笔徽章" },
  scientist: { emoji: "🔬", label: "科学家", desc: "好奇心爆棚的探究者", outfit: "白大褂 + 烧瓶 + 护目镜" },
  explorer: { emoji: "🗺️", label: "探险家", desc: "勇敢的发现者", outfit: "冒险背心 + 罗盘 + 地图" },
  mage: { emoji: "🧙", label: "魔法师", desc: "数字咒语大师", outfit: "巫师袍 + 魔杖 + 巫师帽" },
  warrior: { emoji: "⚔️", label: "武士", desc: "专注沉稳的修行者", outfit: "道服 + 红头带 + 木剑" },
  artist: { emoji: "🎨", label: "艺术家", desc: "数字与色彩的创造者", outfit: "围裙 + 调色板 + 画笔" },
};
