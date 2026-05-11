/**
 * AI 生成勋章图的获取 + 持久化。
 *
 * 设计：
 *  - 调 /api/generate/image → 拿到 dashscope OSS URL
 *  - URL 24h 过期 → 立刻 fetch 下载成 base64 data URL，存进 db.trophyImages
 *  - 后续 trophy wall 都从 db 读 base64 直接渲染，没有时回到 emoji 兜底
 *
 * "盲盒"：rare trophy 解锁时调 generateTrophyImage(trophyId, prompt, {force: true})
 *  → 不管缓存是否存在都重新生成 → 写入 db isLottery=true
 *
 * 批量：generateAllMissing() 给 admin 用 — 跑过所有 trophy，已有的跳过
 */

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db/dexie";
import { generateImage } from "./tutor";
import type { TrophyImageRow } from "../db/dexie";
import type { TrophyTier } from "../core/types";

/** trophy 元数据（math + chinese 都能用） */
export interface TrophyMeta {
  id: string;
  subjectId: "math" | "chinese";
  name: string;
  /** 默认 emoji icon */
  icon: string;
  description?: string;
  /** 是否是 rare（单次成就），rare 才走盲盒抽奖 */
  rare?: boolean;
  /** v0.29: 勋章分类（影响 AI 图风格） */
  category?: "daily" | "milestone" | "ability" | "skill" | "commemorative" | "boss";
  /** v0.29: tier-leveled 勋章在哪个等级（影响 AI 图底色） */
  tier?: "bronze" | "silver" | "gold" | "platinum";
}

/**
 * v0.29.1 B++ 方案：每枚勋章 **一张 AI 图**（不分 tier），让 AI 自由发挥独特配色。
 *
 * 设计哲学（对齐 Apple Fitness）：
 *  - 每枚勋章 = 一份独特的多彩插画，主体丰富 + 配色独特
 *  - tier (铜银金钻) 的视觉表达 **不进 AI 图**，而是 CSS 在外层加：
 *      1. 1-2px 金属外环（铜橙 / 银白 / 真金 / 钻彩）
 *      2. 右下角小角标 ★ / ★★ / ★★★ / 💎
 *      3. tier 色 glow / drop-shadow
 *      4. 钻档专属：CSS conic-gradient 全息光晕动画
 *  - 这样 17 张图够用（vs 68），主体有 Apple 级丰富，tier 升级靠"加 buff"语言
 *
 * 注意：TrophyMeta.tier 字段虽还在但本函数 **不读取**——所有 tier 在 CSS 处理。
 */

/** 段位勋章特殊处理（5 个 tier 段位需要不同地标，不走通用流程） */
function isSegmentTier(t: TrophyMeta): boolean {
  return /_tier_/.test(t.id) || (t.id.includes("tier_") && t.subjectId === "math");
}

/**
 * 给 trophy 拼出生成 prompt（v0.29.9 回归独立精修路线）。
 *
 * 设计：每枚 trophy 都有手写的 motif + signature palette，确保独特创意。
 * 对 tiered trophy（milestone/ability/skill），同 motif 用 4 种金属调（铜银金钻）
 * 各生成一张，构成"同一作品的 4 个珍藏版本"。
 *
 * 用户反馈痛点回顾：
 *  - v0.29.0-v0.29.7 "AI 自由发挥多彩 motif" → 颜色漂移，多数偏绿
 *  - v0.29.8 "单色+CSS 染色" → 一致但单调没质感，像 SVG 不像奖牌
 *  - v0.29.9 "每枚独立精修+手写 prompt" → 独立创意 + 一致质感
 */
export function buildTrophyPrompt(t: TrophyMeta): string {
  if (isSegmentTier(t)) {
    return buildTierBadgePrompt(t);
  }
  if (t.category === "commemorative") {
    return buildCommemorativePrompt(t);
  }
  // 非 commemorative：从 spec 取 motif + tier 金属调拼 prompt
  return buildRichTrophyPrompt(t);
}

/**
 * v0.29.9: 每个非 commemorative trophy 的手写 motif spec。
 *
 * key = 不带 tier 后缀的纯 trophyId（如 "math_answer_master"）
 * value = motif 描述 + 主调色板提示（tier 会再叠加金属调）
 */
const TROPHY_MOTIF_SPEC: Record<string, { motif: string; palette: string }> = {
  // === daily（无 tier，1 张图）===
  math_daily_complete: {
    motif: "a glowing checkmark sticker placed on a paper calendar page, with a soft happy aura",
    palette: "fresh emerald green + golden yellow + cream highlights",
  },
  math_speed_demon: {
    motif: "a cute hand silhouette zooming forward with electric lightning trails behind, dynamic motion blur",
    palette: "electric sapphire blue + lemon yellow + silver lightning",
  },
  math_no_hint_run: {
    motif: "a bright cartoon brain wearing a tiny halo of stars and shimmering thought sparkles",
    palette: "lavender purple + warm peach + silver star highlights",
  },
  math_mistake_reborn: {
    motif: "a magical book bursting open with a tiny phoenix rising out of the pages, golden flame trail",
    palette: "fiery ruby red + warm amber + golden flame",
  },

  // v0.31.92: 难题猎人（weekly D4 hunter）— 一周内完成 ≥N 道 D4 难题
  math_weekly_d4_hunter: {
    motif: "a cute cartoon archer's bow with a glowing arrow knocked, aimed at a tiny star-shaped target floating among small math symbol particles (×, ÷, %), dynamic action pose",
    palette: "deep crimson bow + golden arrow + emerald target + cream backdrop",
  },

  // === milestone（4 tier 变体）===
  math_answer_master: {
    motif: "a target with a perfectly placed arrow in the bullseye, surrounded by tiny burst sparkles and small ribbon flag",
    palette: "deep ruby red bullseye + cream rings + 闪亮 metallic arrow",
  },
  math_combo_king: {
    motif: "a stylized lightning bolt strike with combo number trail dissolving into sparks, dynamic energy",
    palette: "electric blue energy + amber lightning core",
  },
  math_streak_keeper: {
    // v0.31.6 重写：之前 motif "flame + heart inside" 渲染出来不对题，看着像 valentine
    // 心，跟"连续打卡"主题脱节。改成 calendar + flame crown 组合，明显是"日"的概念。
    motif:
      "a flame-shaped crown floating above a stack of small calendar tiles, each tile marked with a tiny golden checkmark, soft warm sun rays radiating outward — symbolizing kingship over consecutive days of practice",
    palette: "warm amber flame crown + cream tiles + emerald checkmarks + golden rays",
  },
  math_mastery_climber: {
    motif: "tiered mountain peaks with a small triangular flag planted on the highest summit, soft cloud at base",
    palette: "deep teal mountains + cream snow + crimson flag",
  },

  // === ability（8 个，4 tier 变体）===
  math_ability_calculation: {
    motif: "a charming abacus with glowing colorful beads, viewed at a slight angle for depth",
    palette: "jade green frame + ruby + sapphire + warm amber beads",
  },
  math_ability_concept: {
    motif: "a cute lightbulb wearing a tiny graduation cap, with idea-sparks radiating around",
    palette: "sunshine yellow bulb + navy cap + silver sparks",
  },
  math_ability_reasoning: {
    motif: "a magnifying glass hovering over interlocking puzzle pieces, one piece glowing gold",
    palette: "deep sapphire blue + cream paper + golden glow",
  },
  math_ability_modeling: {
    motif: "a triangular ruler crossed with a brass compass, small geometric shapes floating around them",
    palette: "teal blue + rose gold + soft cream",
  },
  math_ability_spatial: {
    motif: "an isometric Rubik's cube floating with one face exploding into colorful tiles",
    palette: "vivid rainbow cube faces + dark space backdrop",
  },
  math_ability_data: {
    motif: "a 3D bar chart with colorful bars rising from a base, sparkle particles around the tallest bar",
    palette: "violet + fuchsia + cyan bars + magenta sparkle",
  },
  math_ability_strategy: {
    motif: "a chess knight piece standing on a glowing tile, soft starry tile pattern around",
    palette: "dusty rose marble knight + golden tile + indigo backdrop",
  },
  math_ability_habit: {
    motif: "a stylized heart with a small steady flame burning inside, soft golden ring around the heart",
    palette: "ruby heart + cream flame + rose gold ring",
  },

  // === skill（5 个，4 tier 变体）===
  math_decimal_hero: {
    motif: "a tiny superhero kid in a flowing cape, holding a shield with a glowing decimal point, in a heroic pose",
    palette: "sky blue cape + lemon yellow shield + cream skin",
  },
  math_equation_hero: {
    motif: "a balance scale with a glowing 'X' variable on one tray and a number stack on the other, perfect equilibrium",
    palette: "warm orange variable + turquoise scales + brass arms",
  },
  math_average_hero: {
    motif: "a magnifying glass over a small bar chart, with a tiny detective deerstalker hat resting on the magnifier",
    palette: "mauve hat + honey gold magnifier + cream bars",
  },
  math_triangle_hero: {
    motif: "a sturdy triangle shape with a tiny gavel placed across its base, like a courtroom symbol",
    palette: "deep purple triangle + amber gavel + cream backdrop",
  },
  math_shop_hero: {
    motif: "a cheerful shopping bag with a glowing coin spilling out the top, surrounded by tiny price-tag sparkles",
    palette: "mint green bag + rose gold coin + cream tags",
  },

  // === Phase 2 boss 印章（11 枚）— "闯关印章" 风格：庄重的玺印 / 战旗 / 王冠
  // 跟 medal 区分一下，更"印章/勋绩"感。统一用 amber/orange 战斗色调。
  math_boss_first_pass: {
    motif:
      "an ornate golden battle banner planted on a small castle keep, soft sun rays radiating, victorious mood with tiny floating stars — symbolizing the very first conquered challenge",
    palette: "deep amber + warm crimson banner + cream stars",
  },
  math_boss_no_hint: {
    motif:
      "a confident cartoon brain wearing a samurai-style headband, eyes closed in deep focus, surrounded by a calm halo of light — symbolizing solo thinking without help",
    palette: "rich indigo brain + amber headband + soft cream halo",
  },
  math_boss_win_streak_5: {
    motif:
      "five small golden flags on tiny mountain peaks arranged in a row, connected by a glowing trail, festive bunting feel",
    palette: "warm amber flags + emerald hills + cream trail",
  },
  math_boss_win_streak_10: {
    motif:
      "ten golden mini-banners chained together in a wreath-like ring around a bright central star, festival celebration mood",
    palette: "amber + ruby + cream + bright gold star",
  },
  math_boss_final_master: {
    motif:
      "a regal jeweled crown floating above an ornate seal, with two crossed scepters behind, bursting sun rays — the ultimate boss conquest emblem",
    palette: "royal purple + gold crown + ruby jewels + cream scepters",
  },

  // 6 单元闯关印章 — 每个 unit 一个独特视觉主题（数学符号 + 战旗/印章感）
  math_boss_G4B_U1_DECIMAL_ADD_SUB_master: {
    // v0.31.7：上一版生成出来底部 banner 带英文 "1 CONQUET SEAL" → NO TEXT 违规。
    // 删除 ribbon banner（AI 一画 banner 就忍不住塞文字），改用纯几何元素。
    motif:
      "an embossed circular medallion divided into four quadrants by a glowing decimal point at the very center; top-left quadrant shows a stylized golden plus sign, top-right shows a minus sign, bottom-left shows another plus, bottom-right shows another minus — symmetrical decimal arithmetic seal. NO ribbons, NO banners, NO text panels",
    palette: "deep amber + warm cream + glowing gold decimal point center",
  },
  math_boss_G4B_U2_TRI_QUAD_master: {
    motif:
      "an embossed triangular seal, the triangle frame holding a smaller four-sided shape inside, geometric corners highlighted, small ribbon at the base — unit 2 geometry conquest",
    palette: "amber triangle + emerald inner shape + cream ribbon",
  },
  math_boss_G4B_U3_DECIMAL_MULTIPLY_master: {
    motif:
      "a circular seal with a stylized multiplication × symbol at the center, three small decimal points orbiting it as if planets, faint motion trail — unit 3 multiplication conquest",
    palette: "fiery amber × symbol + ruby decimals + cream backdrop",
  },
  math_boss_G4B_U4_OBSERVE_OBJECTS_master: {
    motif:
      "an isometric cube floating inside a golden circular frame, with three tiny eye icons positioned at front/top/left to symbolize three viewpoints — unit 4 observation conquest",
    palette: "warm amber frame + sapphire cube + cream eyes",
  },
  math_boss_G4B_U5_EQUATIONS_master: {
    motif:
      "a perfectly balanced scale with a glowing X variable on the left tray and an equals sign hovering above the fulcrum, ribbon at base — unit 5 equation conquest",
    palette: "amber scale + ruby X variable + cream equals + emerald ribbon",
  },
  math_boss_G4B_U6_DATA_master: {
    motif:
      "an ornate seal frame containing three rising bar chart bars with a horizontal mean line cutting through them, small star at the top of the tallest bar — unit 6 data conquest",
    palette: "amber frame + sapphire bars + ruby mean line + gold star",
  },

  // === Phase 2 横切勋章（4 枚）===
  math_perfect_day: {
    motif:
      "three concentric glowing rings (cyan, violet, amber) all completely closed, with a tiny crown floating above and sparkles around — symbolizing a perfect single day where all three goals were achieved",
    palette: "vibrant cyan + violet + amber rings + gold crown + cream sparkles",
  },
  math_perfect_week: {
    motif:
      "seven small calendar tiles in a row, each with a glowing checkmark, ringed by a flame trail and a single bright star at the end — symbolizing a perfect 7-day streak",
    palette: "warm amber flame trail + cream tiles + emerald checkmarks + bright gold star",
  },
  math_canvas_master: {
    motif:
      "a stylized artist palette with a small dot grid pattern overlaid, a glowing pencil drawing a triangle shape, soft paint splash background — symbolizing mastery of geometric drawing on dot paper",
    palette: "rose pink palette + cream paper + emerald pencil + violet paint splash",
  },

  // === Phase 2 v0.31.8 tutor 学习深度勋章 — 小进 + 学习闭环 ===
  math_tutor_companion: {
    motif:
      "a friendly cartoon panda mentor figure (representing the tutor) gently guiding a small glowing lightbulb upward into a constellation of connected stars, an open book floating beside them — symbolizing 'asked + truly understood' learning loop with the tutor",
    palette: "warm cream panda + golden lightbulb + violet star constellation + rose-gold book accents",
  },
};

/**
 * tier 金属调修饰：避开"24K GOLD"/"DIAMOND PLATINUM"等品牌词（wan2.7 会当文字漏入图）。
 * 用纯描述性语言。
 */
const TIER_FLAVOR: Record<TrophyTier, string> = {
  bronze:
    "Tier finish: warm antique copper-bronze metallic surface, aged patina with hints of amber, weathered vintage charm, soft greenish oxidation in shadows.",
  silver:
    "Tier finish: polished cool silver-white metallic mirror, crisp pearl highlights, brushed metal striations, faint prismatic shine on the edges.",
  gold:
    "Tier finish: warm honey-amber metallic shine, deep embossed relief, regal warm glow, sun-kissed edges that catch the light.",
  platinum:
    "Tier finish: iridescent rainbow-holographic metallic surface, crystalline prismatic facets, soft aurora glow, sparkly fairy-dust particles drifting around the medal.",
};

function buildRichTrophyPrompt(t: TrophyMeta): string {
  // 取出无 tier 后缀的 trophyId 用于查 spec
  const baseId = t.id
    .replace(/^math_/, "math_")
    .replace(/_(bronze|silver|gold|platinum)$/, "");
  const spec = TROPHY_MOTIF_SPEC[baseId];
  // v0.31.92 fix：默认 fallback 不再传中文 name 给 AI（AI 会渲染成图里的中文字
  // 违反 NO TEXT 规则，weekly_d4_hunter 第一次重生就栽这）。改用纯通用描述。
  const motif =
    spec?.motif ?? "a generic award subject — a glowing star, ribbon, or trophy cup centered on a clean enamel face";
  const palette =
    spec?.palette ?? "rich 2-3 color signature palette";
  const tierFlavor = t.tier ? TIER_FLAVOR[t.tier] : "Tier finish: classic colorful enamel palette.";

  // v0.31.94 重新设计（Bruce 反馈 v0.31.92 的 cream+flood-fill 不匹配老风格）：
  //
  // 历史：
  //   - v0.31.14：AI 不画外框 → CSS clip-path + tier 环外贴。某些 motif AI 自发画框
  //     (answer_master 有银框)，某些没画 (ability_data 完全无框) → 风格不一致。
  //   - v0.31.92：cream bg + flood-fill 透明 + AI 画 frame → 但 cream 风格跟老的
  //     深紫渐变完全不同，3 新 trophy 看着突兀；且金框 + 透明 + 80% canvas 比例 vs
  //     老的银框 + 深紫 + 95% canvas 不一致。
  //
  // v0.31.94 策略：
  //   1. 强制 AI 画"完整圆形金属外框"（之前老 prompt 禁止画 frame 是 root cause）
  //   2. 背景**回到深紫径向渐变**（匹配老 90%+ 已存图风格）
  //   3. 框颜色按 tier（铜银金钻），无 tier 默认银
  //   4. 框占满 95%+ canvas，让 CSS clip-path + tier 薄环叠加效果好
  //   5. **不再用 flood-fill**（深色渐变 bg 跟页面 dark bg 完美融合，无需透明化）
  return [
    `Premium 3D rendered luxury medal — designed for a 4th-grade girl to treasure. Must visually MATCH the existing trophy collection aesthetic precisely.`,
    `**Medal anatomy (MUST include all parts, frame is REQUIRED):**`,
    `  - Outer metallic frame ring: smooth polished ${frameColorFor(t.tier)} beveled rim with subtle highlights at top-left corner, simple clean (NOT overly ornate, NO heavy laurel/leaf engraving, NO ribbons, NO crests on top). Occupies outer ~10-12% of canvas width.`,
    `  - Optional: a thin (~2px) lighter metallic inner accent ring just inside the outer rim for depth`,
    `  - Inner medallion face: **DEEP VIOLET enamel center** (rich royal purple, glossy reflective surface — NEVER cream, NEVER ivory, NEVER white)`,
    `  - Subject motif (centered in inner face): ${motif}`,
    `  - Soft inner glow + tiny star sparkles around the motif (decorative, not text)`,
    `Signature palette for motif (the motif itself, NOT the enamel background): ${palette}.`,
    tierFlavor,
    `**Background (outside the medal rim):**`,
    `  - DEEP SPACE-PURPLE radial gradient — deep violet center, fading to near-black at canvas edges`,
    `  - **The medal completely fills the canvas — outer rim touches all 4 canvas edges** with at most 2-3 pixel margin`,
    `  - The 4 canvas corners are part of the gradient (NOT empty black / NOT cream / NOT white)`,
    `**Critical style requirements (matching collection):**`,
    `  - Inner enamel = deep violet (matches answer_master_silver, ability_calculation_silver style)`,
    `  - Frame = smooth polished metallic (not engraved laurel — too ornate)`,
    `  - 95%+ canvas fill — NO large empty margins`,
    `  - Premium 3D tactile feel with embossed relief on motif`,
    `**ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO LOGOS, NO ENGLISH SCRIPT, NO CHINESE CHARACTERS, NO NUMBERS, NO SIGNATURES, NO WATERMARKS, NO STAMPS, NO RIBBONS WITH WRITING** — entirely pictorial, zero typography.`,
    `Output: 512×512 square. Centered.`,
  ].join(" ");
}

/**
 * v0.31.94: tier → frame metal color hint。
 * 没 tier 时默认 silver-tone（既不太亮也不太暗，配 enamel 都好看）。
 */
function frameColorFor(tier: TrophyMeta["tier"]): string {
  switch (tier) {
    case "bronze":
      return "antique copper / bronze";
    case "silver":
      return "polished sterling silver";
    case "gold":
      return "rich yellow gold";
    case "platinum":
      return "iridescent rainbow platinum with subtle pearlescent shimmer";
    default:
      return "polished silver"; // 无 tier 默认银
  }
}

/**
 * v0.29.2: 纪念勋章专属 prompt — "传家宝"级仪式感。
 *
 * commemorative 类是"一辈子只拿一次"的事件勋章（第一步 / 期中加冕 / 新学年起航 / 生日 等），
 * 应该明显比 daily / milestone / ability / skill 更精致、更有奖章质感、更值得珍藏。
 *
 * 设计要点：
 *  - 形状：六角星（六芒星）—— 跟其他勋章形状有明显区分
 *  - 质感：传家宝奖章 (heirloom medallion) / 浮雕 / 厚重金属感
 *  - 缎带 + 月桂枝 / 棕榈叶 等仪式装饰元素
 *  - 配色仍多彩，但可加金色高光（不是 tier 锁死的金）
 *  - 强调"独一无二""值得永久珍藏"的氛围
 */
/**
 * v0.30.12: 4 个 commemorative trophy 的纯英文视觉 motif（不带中文名！）。
 *
 * 之前 prompt 直接说「${t.name}」概念的卡通图标 → AI 把 "第一步"/"期中加冕"
 * 等中文名当 TEXT 渲染进图里（4/4 全失败）。fix：完全不提中文名，用纯视觉
 * 描述告诉 AI 该画什么。
 */
/**
 * 形状二级 = 视觉等级。
 * - "pentagram"（五角星）= 单次事件纪念（第一步 / 期中 / 期末 / 新学年 / 生日），
 *   一个 moment 一枚，标准纪念
 * - "hexagram"（六角星）= 跨段位长期累积纪念（破晓登阶 / 蓉城启航 / 天府跃升 / 凤翔九天），
 *   要努力很多天才能拿一枚 → 多一个角，视觉权重更重
 *
 * 默认 pentagram；hexagram 在 spec 里显式标。
 * TrophyIcon 通过 getCommemorativeShape() 拿到 shape 来选 clip-path，跟 prompt 同步。
 */
export type CommemorativeShape = "pentagram" | "hexagram";

const COMMEMORATIVE_MOTIF_SPEC: Record<
  string,
  { motif: string; palette: string; shape?: CommemorativeShape }
> = {
  math_first_step: {
    motif:
      "a small glowing footprint on a path of starlight, with a single bright guiding star above, surrounded by tiny sparkles — symbolizing the very first step of a learning journey",
    palette: "warm sunrise pink + soft cream + gold star highlight",
  },
  math_midterm_done: {
    motif:
      "a regal golden laurel wreath crown floating above a curled scroll with golden seal, soft sun rays radiating outward, ribbon banners on either side — symbolizing successful completion of midterm exams",
    palette: "rich gold laurel + cream scroll + deep ruby ribbon + warm honey backdrop",
  },
  math_final_done: {
    motif:
      "a tall ornate golden victory cup with elegant handles, rising rays of light behind it, two flowing ribbon banners on either side, sparkling stars around — symbolizing triumphant final exam completion",
    palette: "polished gold cup + ivory ribbons + amber light rays",
  },
  math_new_semester: {
    motif:
      "a small wooden sailboat with full sails, sailing on gentle waves, a bright sunrise behind it, with a flying open book transforming into the sail — symbolizing setting sail on a new academic year",
    palette: "deep ocean blue + warm sunrise gold + cream sail + leaf green",
  },
  math_birthday_2026: {
    motif:
      "a beautifully decorated birthday cake with flickering candles on top, a small floating party hat to one side, ribbon banners and confetti sparkles all around — celebratory and warm, symbolizing a birthday milestone",
    palette: "soft rose pink frosting + cream cake + warm candle gold + violet ribbons + rainbow confetti",
  },
  // === 段位跨段纪念 v0.31.11：六角星 commemorative ===
  // 跟段位徽章圆形 emblem + 普通五角星纪念都视觉分开。
  // 主题：登山/登阶/起航/翱翔，捕捉"努力很多天，终于跨段"的瞬间。
  // 每段调色板呼应该段 tier 主色（district=emerald / city=violet / province=amber / country=ruby）。
  math_enter_district: {
    shape: "hexagram",
    motif:
      "a heroic young silhouette in dynamic motion mid-stride, climbing a rising spiral of luminous crystal stepping stones that ascend through soft mist, arriving at a glowing dawn arch at the top, golden sparkle footprints trailing behind, three small treasure orbs (gem, scroll, leaf) orbiting the figure — symbolizing reaching a new realm through dedicated effort",
    palette: "vivid emerald jade + amber dawn gold + deep violet sky + cream sparkles + gold halos",
  },
  math_enter_city: {
    shape: "hexagram",
    motif:
      "a heroic silhouette standing triumphantly atop a rising platform overlooking a vast violet cityscape with stylized traditional Chinese eaves and a glowing teacup beacon, banners of accomplishment streaming overhead, fireflies of light spiraling upward — symbolizing arriving at a major capital after a long climb",
    palette: "deep violet + brushed silver + warm fuchsia + gold light beams + cream banners",
  },
  math_enter_province: {
    shape: "hexagram",
    motif:
      "a heroic silhouette astride a soaring stylized cloud trail, sweeping past misty Sichuan mountain peaks with a tiny panda companion below cheering, a brilliant amber sun rising behind everything, golden stars dotting the path of flight — symbolizing soaring above an entire province",
    palette: "amber to honey gold + emerald mountain mist + warm orange sun + cream stars",
  },
  math_enter_country: {
    shape: "hexagram",
    motif:
      "a phoenix-form silhouette in mid-flight rising through cosmic clouds with a glowing comet tail, with abstract layers of mountain ranges and a starburst halo behind, scattering tiny ruby light petals into the sky — symbolizing legendary national-tier ascent",
    palette: "deep ruby + radiant gold + cosmic violet + cream phoenix glow + scattered ruby petals",
  },
};

/**
 * v0.31.11 暴露给 TrophyIcon：决定 commemorative 用五角星还是六角星 clip-path。
 * 跟 prompt 必须同步——AI 生成什么形状，CSS 就 clip 什么形状。
 *
 * 接受：
 *   - 带 subject 前缀（"math_enter_district"）→ 直接查
 *   - 不带前缀（"enter_district"）→ 兜底 math_ 前缀（chinese 没有 commemorative）
 */
export function getCommemorativeShape(trophyId: string): CommemorativeShape {
  const direct = COMMEMORATIVE_MOTIF_SPEC[trophyId];
  if (direct?.shape) return direct.shape;
  const withMath = COMMEMORATIVE_MOTIF_SPEC[`math_${trophyId}`];
  if (withMath?.shape) return withMath.shape;
  return "pentagram";
}

function buildCommemorativePrompt(t: TrophyMeta): string {
  const spec = COMMEMORATIVE_MOTIF_SPEC[t.id];
  const motif =
    spec?.motif ?? `a ceremonial heirloom medal motif representing achievement and celebration`;
  const palette = spec?.palette ?? "rich 2-3 color harmonious palette + gold or silver highlights";

  // v0.31.12 关键架构：commemorative 不让 AI 画星形外框，星形完全由前端 CSS clip-path
  // 切出来（PENTAGRAM_CLIP / HEXAGRAM_CLIP）。AI 只负责画 "里面的图"——丰富的浮雕场景 +
  // 深色径向渐变背景，铺满 512×512 整张画布。这样数学上 100% 对齐，永远不会再出现
  // "星图比 frame 大/小、底边没顶满、四角漏色"等问题。
  //
  // 取舍：失去 AI 画的"3D 浮雕星形边缘"质感，但换来绝对对齐。框架边缘改由前端 CSS
  // 添加 ring + glow 表达。整体看上去仍然像奖章，只是边缘锐利度由 CSS 决定。
  return [
    `Premium 3D rendered luxury commemorative scene illustration, treasure-class quality, designed for a 4th-grade girl to treasure forever.`,
    // motif（核心）—— 占满整个画面而不是星形内部
    `Subject (rich illustrated motif, occupies ~70% of the canvas, strictly centered, vertically and horizontally balanced): ${motif}.`,
    // 关键：AI 不画星形外框
    `**CRITICAL FRAMING INSTRUCTION:** DO NOT draw any star outline, medallion frame, metallic rim, or shape boundary in this image. The final star-shape framing will be applied externally by the rendering layer. This image must be a square illustration where the motif sits naturally on a deep gradient background that extends seamlessly to all four canvas edges.`,
    `Background: deep violet-to-near-black radial gradient (motif glows from the center), the gradient must fill the ENTIRE 512×512 canvas edge-to-edge with no border, no rim, no frame, no decorative ring of any kind. The four canvas corners are just the dark gradient — no embellishment there.`,
    `Surrounding decorative elements (around the motif, NOT at canvas edges): subtle laurel branches / palm leaves / star sparkles / ribbon flecks tastefully accenting the central motif — keep these at less than 60% of canvas radius from center, leaving the outer ~40% as clean gradient background.`,
    `Signature palette: ${palette}.`,
    `Surface treatment: glossy 3D embossed relief on the motif itself + soft inner glow + dramatic light-and-shadow, premium ceremonial feel.`,
    // v0.30.12: 多重反 text 嘱托
    `**ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO LOGOS, NO ENGLISH SCRIPT, NO CHINESE CHARACTERS, NO HANZI, NO KANJI, NO NUMBERS, NO SIGNATURES, NO WATERMARKS, NO TYPOGRAPHY, NO CALLIGRAPHY, NO INSCRIPTIONS** — the medal must be ENTIRELY pictorial. Any glyph-like marks must be replaced by pure decorative shapes (sparkles, stars, ribbons, leaves).`,
    `Style: refined 3D embossed + soft inner glow + ceremonial dignity — magical but not childish.`,
    `Output: 512×512 square, motif strictly centered, gradient background filling all 4 edges with no boundary visible.`,
  ].join(" ");
}

/**
 * 段位勋章专用 prompt：每段位有自己的"地点 + 主色 + 标志"。
 * t.id 形如 "tier_school" / "tier_district" / "tier_city" / "tier_province" / "tier_country"。
 */
function buildTierBadgePrompt(t: TrophyMeta): string {
  // 抽取 tier id（去掉前缀）
  const rawId = t.id.replace(/^math_/, "").replace(/^chinese_/, "").replace(/^tier_/, "");
  const tierTheme: Record<string, { motif: string; rim: string; bg: string }> = {
    school: {
      motif:
        "a friendly stylized primary school crest: an open book at center with a tiny rising sun above, two small green leaves curling around the book, soft pastel sky-blue palette",
      rim: "polished pale silver with soft blue inner glow",
      bg: "warm pastel cream-to-sky-blue radial gradient",
    },
    district: {
      // v0.31.11: 重做 motif —— 之前是 "竹 + 水波"，被反馈太通用、跟纪念勋章撞。
      // 现在用成都市花"芙蓉花" + 锦江河"锦缎丝带波" 双重符号 ——
      // 锦江 = "锦水" = 古代以丝绸织锦命名的河，此处是文化锚点。
      // 花朵主体 + 锦缎边纹 → 比通用山水更精致、更地标。
      motif:
        "an exquisite single hibiscus blossom in full bloom at the exact center, petals rendered in luminous jade-emerald with shimmering gold-traced edges and soft pink inner heart, surrounded by elegant concentric brocade silk ribbon wave patterns rippling outward filling the rim space, regional refined emblem",
      rim: "polished gold with emerald inner glow",
      bg: "deep emerald to jade radial gradient with subtle pink center bloom",
    },
    // v0.31.11 段位渐进精致：city > district / province > city / country > province
    // 设计层级（用户明确要求，越往后越想要）：
    //   school   = 简洁童趣（pastel + 校徽 emblem 单元素）
    //   district = 精致地标（emerald 芙蓉 + 锦缎 双层）
    //   city     = 灵动古典（双元素 fuchsia/teal + 鎏金细节）
    //   province = 宏伟壮阔（守护者 + 多层鎏金边纹 + 12 星宿）
    //   country  = 传奇尊贵（凤凰 + 七彩翼 + 12 道日芒 + 多层鎏金宝石嵌边）
    city: {
      motif:
        "a violet-and-fuchsia city emblem of refined elegance: a graceful crane silhouette in flight rising above a stylized traditional Chinese pavilion eave (Wuhou Shrine inspired) with a glowing teacup at its base, framed by a delicate ring of small hibiscus blossoms with four cardinal-direction constellation stars, brushed silver rim accented with thin gilded gold inlay lines, a touch more ornate than the district emblem",
      rim: "brushed silver with thin gilded gold inlay lines, violet inner glow",
      bg: "deep violet to fuchsia radial gradient with subtle teacup-glow center",
    },
    province: {
      motif:
        "a magnificent provincial grandeur emblem: a majestic guardian panda holding a glowing peach blossom branch, seated atop layered misty Sichuan dragon-shaped mountain peaks, with a brilliant golden sunburst halo radiating behind, surrounded by twelve small ornate constellation stars at the rim, multi-layered ornate gilded rim with embossed cloud patterns and tiny embossed bamboo leaves — distinctly more elaborate and richer than the city emblem",
      rim: "thick multi-layered polished gold with embossed cloud-and-bamboo decorative band, deep amber inner glow",
      bg: "amber to honey-gold radial gradient with sunburst halo center",
    },
    country: {
      // ⚠️ 不写 "中国地图" / "五星" —— 阿里云图像模型对国家地图和国旗符号有内容
      // 过滤，会返回 InvalidParameter。改用通用的"凤凰 + 山河 + 星辰"传奇意象。
      motif:
        "an imperial national legendary treasure-class emblem: a soaring crowned phoenix with iridescent rainbow wings rising from cosmic ruby clouds, surrounded by a brilliant starburst halo with twelve radiating gilded sun rays, layered stylized mountain ranges and a constellation of stars at the rim, multi-tiered ornate gilded rim with intricate jewel inlays (rubies, sapphires, emeralds set into the gold band), the most ornate and majestic emblem in the entire collection — distinctly more grand and treasured than the province emblem",
      rim: "multi-tiered radiant gold with jewel-encrusted band (rubies + sapphires + emeralds inlaid), ruby and gold inner glow",
      bg: "deep cosmic ruby to radiant gold radial gradient with phoenix-glow center",
    },
  };
  const theme = tierTheme[rawId] ?? {
    motif: t.name,
    rim: "polished gold",
    bg: "deep violet radial gradient",
  };
  return [
    // === 主体描述 ===
    `A premium Apple Fitness style achievement medal, circular embossed relief, clean centered composition.`,
    `Subject: ${theme.motif}.`,
    // === 框架填满（修 v0.30.3 黑边大问题） ===
    `**The circular medal fills the entire frame edge-to-edge — the rim touches all four sides of the square canvas with at most 1-2 pixel margin.** No visible empty background border, no thick padding, no halo of dark space around the medal.`,
    `Rim: ${theme.rim}, smooth thin metallic ring 2-3% of the frame width, exactly at the canvas edge.`,
    // === 内部背景，跟金属环呼应（不要纯黑！） ===
    `Inside the rim: ${theme.bg}, soft and dimensional, makes the central motif glow naturally. Absolutely **NOT a flat black or near-black background** — the inner color should be saturated and rich.`,
    `Surface: precise 3D embossed relief, silky inner glow, premium hyperrealistic detail, like the very best Apple Fitness award icons.`,
    // === 严格禁止 ===
    `**ABSOLUTELY NO TEXT, NO LETTERS, NO WORDS, NO LOGOS, NO ENGLISH SCRIPT, NO CHINESE CHARACTERS, NO NUMBERS, NO SIGNATURES, NO WATERMARKS, NO STAMPS, NO TYPOGRAPHY, NO CALLIGRAPHY OF ANY KIND.**`,
    // === 输出尺寸 ===
    `Output: 512×512 square, the circular medal occupies 98%+ of the canvas with only a 1-2 pixel margin on each side.`,
  ].join(" ");
}

/**
 * v0.29.5: 把任意 URL 下载并 **压缩** 成 base64 data URL。
 *
 * 之前直接 readAsDataURL(blob) 把 AI 返回的原始 PNG 整张存进 IDB —— 实测每张
 * ~7 MB，2 张就 14 MB，导致 cloudSync 上传 14 MB JSON 给 Cloudflare 直接 500。
 *
 * 现在通过 canvas 重绘 + JPEG 压缩。**v0.30.6**：分两档：
 *   - "default" 256×256 q=0.85 （普通 trophy，最大显示 lg=80 / xl=128，~30-60KB）
 *   - "large"   512×512 q=0.92 （tier badge / mascot，hero 显示 210px × retina = 420，~80-150KB）
 *
 * 走 "large" 档的判断：trophyId 形如 `math_tier_*` / `chinese_tier_*` / `_mascot_*`
 */
const COMPRESS_TARGET_PX_DEFAULT = 256;
const COMPRESS_TARGET_PX_LARGE = 512;
const COMPRESS_JPEG_QUALITY_DEFAULT = 0.85;
const COMPRESS_JPEG_QUALITY_LARGE = 0.92;

function shouldUseLargeCompression(trophyId: string): boolean {
  return (
    /^(math|chinese)_tier_/.test(trophyId) ||
    /^_mascot_/.test(trophyId)
  );
}

async function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image decode failed"));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Canvas 重绘 + JPEG 压缩。返回 data URL。 */
async function compressBlobToDataUrl(
  blob: Blob,
  opts: { large?: boolean } = {},
): Promise<string> {
  const targetPx = opts.large ? COMPRESS_TARGET_PX_LARGE : COMPRESS_TARGET_PX_DEFAULT;
  const quality = opts.large ? COMPRESS_JPEG_QUALITY_LARGE : COMPRESS_JPEG_QUALITY_DEFAULT;
  const img = await blobToImage(blob);
  const canvas = document.createElement("canvas");
  canvas.width = targetPx;
  canvas.height = targetPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  // 黑底（JPEG 不支持透明，留个底色避免空白边缘）
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, targetPx, targetPx);
  // 等比缩放居中绘制
  const scale = Math.min(targetPx / img.width, targetPx / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const dx = (targetPx - w) / 2;
  const dy = (targetPx - h) / 2;
  ctx.drawImage(img, dx, dy, w, h);
  return canvas.toDataURL("image/jpeg", quality);
}

/** 把任意 URL 下载、压缩成 base64 data URL（持久化到 IndexedDB）。trophyId 决定压缩档位 */
async function fetchAsDataUrl(url: string, trophyId?: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch image failed: ${r.status}`);
  const blob = await r.blob();
  return await compressBlobToDataUrl(blob, {
    large: trophyId ? shouldUseLargeCompression(trophyId) : false,
  });
}

/**
 * v0.29.5: 一次性迁移 — 把已存的过大勋章图重新压缩。
 * v0.29.7 修两个 bug：
 *   - 老版本 `new Blob([bytes])` 没传 MIME type，<img> 加载偶尔失败 → 静默
 *     跳过 → 老 7 MB 图不被压缩 → push 上传 14+ MB → cloud 500
 *   - 老版本 marker 设了之后再也不重跑，即使本地仍有大图
 *
 * 修法：
 *   - 解 base64 时保留 MIME type（"image/png"），blob 创建时传过去
 *   - 迁移结束后扫一遍剩余大图：还有 → 不设 marker（下次开 app 再跑）
 *
 * 阈值降到 200 KB（更激进）：实测合理 JPEG ~30-60 KB；> 200 KB 也是 PNG 没压缩
 * 的痕迹。
 *
 * 在 trophyImages 表里扫所有 imageDataUrl 长度 > 200KB 的 row，按现在的压缩
 * 管道重处理。每张耗时 < 100 ms（纯 canvas 操作，无 AI 调用）。
 */
const COMPRESSION_MIGRATION_KEY = "trophyImagesCompressedAt";
const COMPRESSION_THRESHOLD = 200 * 1024; // 200 KB

export async function migrateCompressOversizedTrophyImages(): Promise<{ processed: number; freedMb: number; remainingOversized: number } | null> {
  const meta = await db.meta.get(COMPRESSION_MIGRATION_KEY);
  // v0.29.7: 即使 marker 已设，也再扫一次。如果本地确实没大图，这一遍 ~5 ms 直接退出。
  // 这避免了"v0.29.5 bug 把 marker 设了但没真的压缩"的死局。
  const all = await db.trophyImages.toArray();
  const oversized = all.filter((row) => (row.imageDataUrl?.length ?? 0) >= COMPRESSION_THRESHOLD);
  if (oversized.length === 0) {
    if (!meta?.value) await db.meta.put({ key: COMPRESSION_MIGRATION_KEY, value: Date.now() });
    return null;
  }

  let processed = 0;
  let freedBytes = 0;
  let failed = 0;
  let skippedPng = 0;
  for (const row of oversized) {
    try {
      // v0.31.81：保留意图 PNG（admin 上传的透明 boss 图等）— 不再自动 JPEG 黑底化
      // 透明 PNG 在深色背景上看起来好得多。500KB 以下的 PNG 都跳过。
      if (
        typeof row.imageDataUrl === "string" &&
        row.imageDataUrl.startsWith("data:image/png") &&
        row.imageDataUrl.length < 500 * 1024
      ) {
        skippedPng += 1;
        continue;
      }
      // data URL → blob → recompress
      const m = row.imageDataUrl!.match(/^data:([^;]+);base64,(.+)$/);
      if (!m) {
        failed += 1;
        continue;
      }
      const mime = m[1] ?? "image/png";
      const bin = atob(m[2]!);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const beforeLen = row.imageDataUrl!.length;
      const compressed = await compressBlobToDataUrl(blob);
      freedBytes += beforeLen - compressed.length;
      await db.trophyImages.put({ ...row, imageDataUrl: compressed });
      processed += 1;
    } catch (e) {
      failed += 1;
      console.warn(`[trophyImages] compress migration failed for ${row.trophyId}`, e);
    }
  }
  if (skippedPng > 0) {
    console.log(`[trophyImages] migration: skipped ${skippedPng} intentional PNG(s)`);
  }

  // 检查迁移后还剩多少大图（应该 = failed 数）
  const stillOversized = (await db.trophyImages.toArray()).filter(
    (row) => (row.imageDataUrl?.length ?? 0) >= COMPRESSION_THRESHOLD,
  );

  // 只有当真的全部清干净了才设 marker — 否则下次启动会再尝试
  if (stillOversized.length === 0) {
    await db.meta.put({ key: COMPRESSION_MIGRATION_KEY, value: Date.now() });
  }

  return { processed, freedMb: freedBytes / 1024 / 1024, remainingOversized: stillOversized.length };
}

/**
 * v0.29.7: push 前的安全检查 — 总图大小超 5 MB 就强制再压一遍。
 *
 * 防止边界情况：用户在压缩 migration 完成前就触发 push。
 */
export async function ensureTrophyImagesUnderSizeLimit(maxTotalMb = 5): Promise<{ recompressed: number } | null> {
  const all = await db.trophyImages.toArray();
  const total = all.reduce((s, r) => s + (r.imageDataUrl?.length ?? 0), 0);
  if (total <= maxTotalMb * 1024 * 1024) return null;
  // 清 marker 让 migration 重跑
  await db.meta.delete(COMPRESSION_MIGRATION_KEY);
  const r = await migrateCompressOversizedTrophyImages();
  return { recompressed: r?.processed ?? 0 };
}

/** 直接读取已缓存的图（不会触发生成） */
export async function getTrophyImage(trophyId: string): Promise<TrophyImageRow | undefined> {
  return await db.trophyImages.get(trophyId);
}

/**
 * 拿勋章图：先从 cache 读，没有就生成 + 下载 + 存。
 * @param force 强制重新生成（盲盒抽奖用）
 */
export async function ensureTrophyImage(
  t: TrophyMeta,
  options: { force?: boolean; isLottery?: boolean } = {},
): Promise<TrophyImageRow> {
  if (!options.force) {
    const cached = await getTrophyImage(t.id);
    if (cached?.imageDataUrl) return cached;
  }
  const prompt = buildTrophyPrompt(t);
  // Round 6: 默认 512×512（最小尺寸 + 省 token + 主体严格居中）
  const r = await generateImage({
    prompt,
    size: "512*512",
    n: 1,
  });
  const url = r.urls[0];
  if (!url) throw new Error("generateImage returned 0 urls");
  // 立刻下载成 base64 (URL 24h 过期)。trophyId 决定压缩档位（tier badge 走 512）
  const dataUrl = await fetchAsDataUrl(url, t.id);
  const row: TrophyImageRow = {
    trophyId: t.id,
    subjectId: t.subjectId,
    imageDataUrl: dataUrl,
    sourceUrl: url,
    prompt,
    model: r.model,
    generatedAt: Date.now(),
    isLottery: options.isLottery,
  };
  await db.trophyImages.put(row);
  return row;
}

/** Hook：组件订阅某个 trophy 的图，cache 命中即给图，否则给 null（用 emoji 兜底） */
export function useTrophyImage(trophyId: string | undefined): TrophyImageRow | null {
  // v0.31.8 修关键 sync bug：之前是 useEffect 一次性读，cloud sync 后 IndexedDB
  // 更新但 React 组件不会 re-render，导致刷新页面后新勋章图死活不显示
  // （主奖杯柜里的所有 trophy 都中招）。
  // 改成 useLiveQuery — Dexie 对该行任何写入都触发组件重渲染。
  // 段位徽章 TierBadgeImg 早就这么干了，主勋章柜 TrophyIcon 漏了一直没修。
  const cached = useLiveQuery(
    async () => (trophyId ? await db.trophyImages.get(trophyId) : undefined),
    [trophyId],
  );
  return cached ?? null;
}

/** Hook：监听整个 trophyImages 表，一旦表更新（put）就重新拉。
 * v0.31.8：从 5s polling 改成 useLiveQuery 真响应式 — cloud sync 写入立刻生效，
 * 不必等 5 秒。 */
export function useAllTrophyImages(): Map<string, TrophyImageRow> {
  const rows = useLiveQuery(() => db.trophyImages.toArray(), []) ?? [];
  return new Map(rows.map((r) => [r.trophyId, r]));
}

/**
 * 批量生成所有缺失的勋章图（admin 用）。
 * 一张张串行 (避免 quota 雪崩)，回调汇报进度。
 */
export async function generateAllMissingTrophyImages(
  trophies: TrophyMeta[],
  onProgress?: (
    done: number,
    total: number,
    currentName: string,
    status: "running" | "skipped" | "done" | "failed",
    error?: string,
  ) => void,
): Promise<{ generated: number; skipped: number; failed: number }> {
  let generated = 0;
  let skipped = 0;
  let failed = 0;
  for (let i = 0; i < trophies.length; i++) {
    const t = trophies[i]!;
    onProgress?.(i, trophies.length, t.name, "running");
    try {
      const cached = await getTrophyImage(t.id);
      if (cached?.imageDataUrl) {
        skipped++;
        onProgress?.(i + 1, trophies.length, t.name, "skipped");
        continue;
      }
      await ensureTrophyImage(t);
      generated++;
      onProgress?.(i + 1, trophies.length, t.name, "done");
    } catch (e) {
      failed++;
      onProgress?.(
        i + 1,
        trophies.length,
        t.name,
        "failed",
        e instanceof Error ? e.message : String(e),
      );
    }
  }
  return { generated, skipped, failed };
}

/** 清掉所有缓存（admin 重置勋章图用） */
export async function clearAllTrophyImages(): Promise<number> {
  const count = await db.trophyImages.count();
  await db.trophyImages.clear();
  return count;
}
