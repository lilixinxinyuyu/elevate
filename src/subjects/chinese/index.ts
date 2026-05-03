/**
 * chineseSubject：语文学科 Phase 1 占位骨架。
 *
 * 当前 status.available = true 但所有内容为空。SubjectShell 会读 status 决定
 * 是不是直接 render ComingSoon 页（即使 available=true，子页面也会因为 units
 * 为空 + 守卫逻辑回到 ComingSoon）。期中后填实内容。
 *
 * Phase 2 落地清单：
 *  - units / skills / seedQuestions 真实数据（人教版 2025 版四下，至少前 4 单元）
 *  - 拼音/字音/字形/词汇/句子/阅读/表达/积累 7 个 ability
 *  - 听写题接 src/lib/tts.ts 的 speakText (Qwen Cherry)
 *  - 6+ 个语文专用游戏模板（pinyin_match、dictation_listen、cloze 等）
 *  - 错题标签字典（错字混淆、声韵母混淆、平翘舌混淆等）
 */

import type {
  Subject,
  SubjectAbilityDef,
  SubjectNavItem,
} from "../types";

const CHINESE_ABILITIES: SubjectAbilityDef[] = [
  // 占位：期中后细化。先放 6 个常见维度让 ability 雷达图能渲染骨架。
  { id: "phonics", label: "字音" },
  { id: "glyph", label: "字形" },
  { id: "vocabulary", label: "词汇" },
  { id: "sentence", label: "句子" },
  { id: "reading", label: "阅读" },
  { id: "expression", label: "表达" },
  { id: "accumulation", label: "积累" },
];

const CHINESE_NAV_ITEMS: SubjectNavItem[] = [
  { to: "", label: "首页", exact: true },
  { to: "train", label: "今日挑战" },
  { to: "vocab", label: "字词游戏" },
  { to: "poems", label: "古诗角" },
  { to: "writing", label: "写字本" },
];

/** 期中后开放：5月7日 0:00 当地时间 */
const RELEASE_AT = new Date(2026, 4, 7, 0, 0, 0).getTime();

export const chineseSubject: Subject = {
  id: "chinese",
  label: "语文",
  shortLabel: "语",
  homeTagline: "人教版四年级下册 · 期中后开放",
  themeColor: "from-amber-400 to-rose-400",
  status: {
    available: true,
    comingSoonLabel: "期中后开放（5月7日）",
    releaseAt: RELEASE_AT,
  },

  units: [],
  skills: [],
  seedQuestions: [],

  abilities: CHINESE_ABILITIES,
  errorTags: [],
  examPriorities: [],

  navItems: CHINESE_NAV_ITEMS,

  // Phase 1 不会被实际调用（subject 内没题）
  resolveGameTemplate: () => "plain_choice",
};
