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
import { TIERS } from "../core/tiers";

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
 * v0.35.91 (Phase C): 哪些 tier 已经 ship 了 per-(archetype×gender) 立绘 PNG.
 *
 * 现在只 ship 了 school 段 (`public/character/base-<arch>-<gender>-school-v1.png`).
 * 等以后批量生成并 ship district/city/province/country 的 PNG, 把对应 tier id
 * 加进这个 Set 即可 — resolver 的 walk-down 会自动开始用它们, 不用改别的代码.
 */
// v0.36.56: district 全 12 张已生成 (6 archetype × 2 gender) → 接通。
// city/province/country 各 12 张生成补齐后再依次加入。
export const AVAILABLE_AVATAR_TIERS = new Set<string>(["school", "district"]);

/**
 * Build avatar URL for current tier + character choice.
 *
 * **tier-walk-down resolver** (Phase C): tier 立绘是 per (archetype × gender × tier)
 * 的预生成静态资产, 但还没全部 ship. 高段同学 (如 country) 在缺自己段位 PNG 时,
 * 不该直接没头像 — 而是沿 TIERS 顺序 **往下走** (country → province → city →
 * district → school) 找最近一个已 ship 的 tier, 用那张图. school 永远 ship,
 * 所以保底总有图.
 *
 * choice 为空 (onboarding 未做) → 回到老的单张 tier-<id>-v1.png demo / null 行为.
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
  // Has choice → walk DOWN the TIERS order from tierId to the nearest tier
  // that actually has shipped per-(archetype×gender) assets.
  const startIdx = TIERS.findIndex((t) => t.id === tierId);
  // Unknown tierId → start from the top so we still walk the whole list down.
  const fromIdx = startIdx >= 0 ? startIdx : TIERS.length - 1;
  for (let i = fromIdx; i >= 0; i--) {
    const candidate = TIERS[i]!.id;
    if (AVAILABLE_AVATAR_TIERS.has(candidate)) {
      return `/character/base-${choice.archetype}-${choice.gender}-${candidate}-v1.png`;
    }
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
