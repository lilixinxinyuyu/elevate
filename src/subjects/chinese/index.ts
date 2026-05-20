/**
 * chineseSubject — Phase 2 MVP 真实接入。
 *
 * 已就绪：
 *  - 4 单元 / 12 技能 / 60+ 题（src/subjects/chinese/{units,skills,questions}.ts）
 *  - 听写题接 src/lib/tts.ts（Qwen Cherry / longxiaochun）
 *  - 独立 ChineseHome / ChineseTrain 页面，不复用 math 的 GameShell
 *
 * 还没做（期中后）：
 *  - mastery / trophy / 错题复活
 *  - 句子排序 / 病句修改 / 课内阅读 多步题
 *  - 内容扩展到 200+ 题、覆盖第 5-8 单元
 */

import { SKILLS_CHINESE } from "./skills";
import { UNITS_CHINESE } from "./units";
import { SEED_QUESTIONS_CHINESE } from "./questions";
import { SEED_QUESTIONS_CHINESE_V2 } from "./questionPack2";
import { SEED_QUESTIONS_CHINESE_V3 } from "./questionPack3";
import { SEED_QUESTIONS_CHINESE_TYPOS } from "./typoPack";
import { SEED_QUESTIONS_CHINESE_BADSENT } from "./badSentPack";
import { SEED_QUESTIONS_CHINESE_IMITATE } from "./imitatePack";
import { SEED_QUESTIONS_CHINESE_READING } from "./readingPack";
import { SEED_QUESTIONS_CHINESE_GLYPH } from "./glyphPack";
import type {
  Subject,
  SubjectAbilityDef,
  SubjectNavItem,
} from "../types";

const CHINESE_ABILITIES: SubjectAbilityDef[] = [
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
  // v0.31.43: 字词大冒险加进顶部主菜单（与数学 UX 一致）
  { to: "char-practice", label: "字词大冒险" },
  { to: "free-practice", label: "选单元" },
  // v0.35.26: 管理移到 landing (SubjectPicker), nav 不再重复
];

export const chineseSubject: Subject = {
  id: "chinese",
  label: "语文",
  shortLabel: "语",
  homeTagline: "人教版四年级下册 · 期中冲刺",
  themeColor: "from-amber-400 to-rose-400",
  status: {
    // Phase 2 MVP：上线
    available: true,
  },

  units: UNITS_CHINESE,
  skills: SKILLS_CHINESE,
  seedQuestions: [
    ...SEED_QUESTIONS_CHINESE,
    ...SEED_QUESTIONS_CHINESE_V2,
    ...SEED_QUESTIONS_CHINESE_V3,
    ...SEED_QUESTIONS_CHINESE_TYPOS,
    ...SEED_QUESTIONS_CHINESE_BADSENT,
    ...SEED_QUESTIONS_CHINESE_IMITATE,
    ...SEED_QUESTIONS_CHINESE_READING,
    ...SEED_QUESTIONS_CHINESE_GLYPH,
  ],

  abilities: CHINESE_ABILITIES,
  errorTags: [],
  examPriorities: [],

  navItems: CHINESE_NAV_ITEMS,

  // chinese 用独立的 plain_choice 模板；听写题靠 audio_text 字段触发 ▶ 按钮
  resolveGameTemplate: () => "plain_choice",
};
