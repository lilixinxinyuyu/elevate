/**
 * 语文 Question 构造 helper。
 *
 * 数学 mustBigPack 也用了同款思路（speed/choice/app）；这边专门给语文 4 选 1
 * 单选题做一层封装，省掉大量样板字段，让 questions.ts 接近数据表。
 *
 * 三种 helper：
 *   - pickChoice: 通用 4 选 1（拼音字形 / 古诗补字 / 修辞辨认 / 词语搭配 通用）
 *   - dictation:  听写题（带 audio_text，用 DictationPick 模板）
 */

import type {
  AbilityId,
  GameTemplate,
  Question,
} from "../../core/types";

interface Opt {
  /** 选项内部 id (a/b/c/d 即可) */
  id: string;
  text: string;
  /** 错题标签（错选这个时归类到哪种错误） */
  errorTag?: string;
}

interface PickArgs {
  id: string;
  unit_id: string;
  skill_id: string;
  ability: string[]; // 接受 chinese 自己的 ability 字符串
  difficulty: 1 | 2 | 3 | 4 | 5;
  stem: string;
  options: Opt[];
  /** 选项 id（必须出现在 options 里） */
  correct: string;
  feedback?: { ok?: string; bad?: string };
  /** 解题/记忆要点；不传时给个通用回退 */
  solution?: string[];
  /** Phase 2 MVP 默认 plain_choice；听写题外部传 dictation_pick */
  template?: GameTemplate;
  /** 听写题的播报文本 */
  audio_text?: string;
  /** 题目时间估算秒数；默认 8 */
  estimated_time?: number;
  exam_priority?: "MUST_BIG" | "HIGH_BIG" | "MUST_SMALL" | "HIGH_SMALL" | "NORMAL";
}

export function pickChoice(args: PickArgs): Question {
  const correctOpt = args.options.find((o) => o.id === args.correct);
  if (!correctOpt) {
    throw new Error(`pickChoice ${args.id}: correct id "${args.correct}" not in options`);
  }
  return {
    question_id: args.id,
    subjectId: "chinese",
    version: 1,
    status: "active",
    grade: 4,
    term: "下册",
    unit_id: args.unit_id,
    skill_id: args.skill_id,
    ability_dimension: args.ability as AbilityId[], // 见 skills.ts ab() 注释
    exam_priority: args.exam_priority ?? "HIGH_BIG",
    game_type: "single_choice",
    play_as: args.template ?? "plain_choice",
    cognitive_level: "recall",
    difficulty: args.difficulty,
    // v0.28.2：默认从 8s 改 20s（拼音字音单选题），需要听写类传 estimated_time=28；
    // 其他题型（poem_cloze / pair_match / sentence_shuffle）走自己的 helper。
    // 8s 太短让任何答题都 100% 拿不到 ⚡⚡ 闪电奖励——既不公平也不教育。
    estimated_time_seconds: args.estimated_time ?? 20,
    stem: args.stem,
    question_format: "single_choice",
    options: args.options.map((o) => ({
      id: o.id,
      text: o.text,
      errorTag: o.errorTag,
    })),
    answer: { type: "choice", value: args.correct },
    audio_text: args.audio_text,
    solution_steps: args.solution ?? [`正确答案：${correctOpt.text}`],
    common_errors: args.options
      .filter((o) => o.id !== args.correct && o.errorTag)
      .map((o) => ({
        tag: o.errorTag!,
        error: `选了 "${o.text}"`,
        remediation: "回到课本对照原字形/拼音再确认。",
      })),
    feedback_correct: args.feedback?.ok ?? `对！是 "${correctOpt.text}"。`,
    feedback_wrong: args.feedback?.bad ?? `正确答案是 "${correctOpt.text}"。`,
  };
}

/**
 * 听写题：给 audio_text 用 TTS 朗读，user 从 4 个选项里选正确字 / 词。
 * stem 通常是固定的"听一听，选出正确的字 / 词"。
 */
export function dictation(args: Omit<PickArgs, "template" | "stem"> & {
  stem?: string;
  audio_text: string;
}): Question {
  return pickChoice({
    ...args,
    stem: args.stem ?? "🎧 听一听，选出正确的写法",
    template: "plain_choice", // Phase 2 MVP 复用 plain_choice + 头部加 ▶ 按钮（DictationPick 包它）
    estimated_time: args.estimated_time ?? 12,
  });
}
