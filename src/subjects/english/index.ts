/**
 * englishSubject — v0.31.39 minimum-viable
 *
 * 范围：
 *  - 207 个 G4 单词（A 上 + B 下，去重）— src/subjects/english/wordList.ts
 *  - 单词记忆练习页 /english/vocab —— 加权随机 + 迁移老 english/data.json 进度
 *
 * 还没做（需要的话期中后再加）：
 *  - 句子 / 听力 / 写作部分
 *  - units / skills / mastery / trophy 那一整套（math 全套）
 *  - 进入主 daily challenge ring
 *
 * 设计：先把 250 词练习起来，单独存 db.meta::english_vocab_progress，
 * 不污染 math/chinese mastery/attempts。日后可把它折叠进通用每日挑战。
 */

import type { Subject, SubjectAbilityDef, SubjectNavItem } from "../types";

const ENGLISH_ABILITIES: SubjectAbilityDef[] = [
  { id: "vocabulary", label: "词汇" },
  { id: "listening", label: "听读" },
  { id: "speaking", label: "口语" },
  { id: "reading", label: "阅读" },
];

const ENGLISH_NAV_ITEMS: SubjectNavItem[] = [
  { to: "", label: "首页", exact: true },
  { to: "vocab", label: "单词" },
];

export const englishSubject: Subject = {
  id: "english",
  label: "英语",
  shortLabel: "英",
  homeTagline: "外研版四年级 · 单词记忆",
  themeColor: "from-cyan-400 to-blue-500",
  status: {
    available: true,
  },

  units: [],
  skills: [],
  seedQuestions: [],

  abilities: ENGLISH_ABILITIES,
  errorTags: [],
  examPriorities: [],

  navItems: ENGLISH_NAV_ITEMS,

  // english 不走主题模板系统（vocab 自己有专属 UI），placeholder 即可
  resolveGameTemplate: () => "plain_choice",
};
