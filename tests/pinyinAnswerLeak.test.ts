import { describe, expect, it } from "vitest";
import { auditQuestion, detectPinyinAnswerLeak } from "../src/lib/questionAuditLite";
import type { Question } from "../src/core/types";

function baseQ(over: Partial<Question>): Question {
  return {
    question_id: "AI_test_001",
    subjectId: "chinese",
    version: 1,
    status: "approved",
    grade: 4,
    term: "下册",
    unit_id: "C4B_U1_NATURE",
    skill_id: "C4B_U1_PINYIN",
    ability_dimension: ["concept"],
    exam_priority: "HIGH_BIG",
    game_type: "plain_choice",
    play_as: "plain_choice",
    cognitive_level: "recall",
    difficulty: 2,
    estimated_time_seconds: 20,
    stem: "读拼音写词语：sù xīn shì xú gōng diàn → ___",
    question_format: "single_choice",
    options: [
      { id: "A", text: "宿新市徐公店" },
      { id: "B", text: "夙新市徐公店" },
      { id: "C", text: "宿新巿徐公店" },
      { id: "D", text: "宿心市徐公店" },
    ],
    answer: { type: "choice", value: "A" },
    solution_steps: ["第一字声母 s + 韵母 ù，注意翘舌"],
    common_errors: [
      { tag: "wrong_radical", error: "部首写错", remediation: "第一字宝盖头下面是百" },
      { tag: "homophone", error: "同音字混", remediation: "看部首记意义" },
    ],
    feedback_correct: "完全正确，五个字都对啦！",
    feedback_wrong: "再想想第一字的部首",
    hints: [{ text: "第一字宝盖头", penalty: 1 }],
    ...over,
  };
}

describe("detectPinyinAnswerLeak", () => {
  it("detects leak when answer 字 appears in hints (stem only has pinyin)", () => {
    const q = baseQ({
      hints: [{ text: "宿是宝盖头加百", penalty: 1 }],
    });
    const leak = detectPinyinAnswerLeak(q);
    expect(leak).not.toBeNull();
    expect(leak?.chars).toContain("宿");
    expect(leak?.fields).toContain("hints");
  });

  it("detects leak in solution_steps", () => {
    const q = baseQ({
      solution_steps: ["先写宿，再写新市徐公店"],
    });
    const leak = detectPinyinAnswerLeak(q);
    expect(leak).not.toBeNull();
    expect(leak?.fields).toContain("solution_steps");
  });

  it("detects leak in common_errors.remediation", () => {
    const q = baseQ({
      common_errors: [
        { tag: "x", error: "易错字", remediation: "宿不要写成夙" },
        { tag: "y", error: "拼写错", remediation: "看部首" },
      ],
    });
    const leak = detectPinyinAnswerLeak(q);
    expect(leak).not.toBeNull();
    expect(leak?.fields).toContain("common_errors");
  });

  it("detects leak in feedback_correct", () => {
    const q = baseQ({
      feedback_correct: "对！是宿新市徐公店！",
    });
    const leak = detectPinyinAnswerLeak(q);
    expect(leak).not.toBeNull();
    expect(leak?.fields).toContain("feedback_correct");
  });

  it("does not flag clean question (hints describe radical only)", () => {
    const q = baseQ({
      hints: [{ text: "第一字宝盖头下面是百字底", penalty: 1 }],
      solution_steps: ["逐字按声母韵母写"],
      common_errors: [
        { tag: "wrong_radical", error: "部首写错", remediation: "再确认部首" },
        { tag: "homophone", error: "同音字混", remediation: "看部首记意义" },
      ],
      feedback_correct: "完全正确！",
      feedback_wrong: "再想想第一字的部首",
    });
    expect(detectPinyinAnswerLeak(q)).toBeNull();
  });

  it("does NOT flag 辨字题 (target char already in stem)", () => {
    // 这种题 stem 已经写出"宿"字，hints 提"宿"不算泄露
    const q = baseQ({
      stem: '下面哪个词的"宿"字读音是 sù？',
      options: [
        { id: "A", text: "宿舍（sù shè）" },
        { id: "B", text: "一宿（yī xiǔ）" },
        { id: "C", text: "星宿（xīng xiù）" },
        { id: "D", text: "三宿（sān xiǔ）" },
      ],
      answer: { type: "choice", value: "A" },
      hints: [{ text: "宿是多音字，住宿读 sù", penalty: 1 }],
    });
    expect(detectPinyinAnswerLeak(q)).toBeNull();
  });

  it("does NOT flag math questions", () => {
    const q = baseQ({
      subjectId: "math",
      skill_id: "decimal_meaning_place",
      stem: "0.6 里面有几个 0.1？",
      options: [
        { id: "A", text: "6" },
        { id: "B", text: "60" },
        { id: "C", text: "0.6" },
        { id: "D", text: "0.06" },
      ],
      answer: { type: "choice", value: "A" },
    });
    expect(detectPinyinAnswerLeak(q)).toBeNull();
  });

  it("does NOT flag non-pinyin chinese skills (e.g. RHETORIC)", () => {
    const q = baseQ({
      skill_id: "C4B_U3_RHETORIC",
      stem: "「弯弯的月亮像一只小船」用了什么修辞？",
      options: [
        { id: "A", text: "比喻" },
        { id: "B", text: "拟人" },
        { id: "C", text: "排比" },
        { id: "D", text: "反复" },
      ],
      answer: { type: "choice", value: "A" },
      hints: [{ text: "比喻句通常含「像 / 是 / 仿佛」", penalty: 1 }],
    });
    expect(detectPinyinAnswerLeak(q)).toBeNull();
  });

  it("does NOT flag stems without pinyin tone marks (regular dictation 4 选 1)", () => {
    // 听写题 stem 是"听一听，选出正确的写法" — 没有拼音声调字符 → 不触发
    // (这种题 audio 是通过 TTS 播报的，孩子已经看到选项了，hints 提目标字不是泄露)
    const q = baseQ({
      skill_id: "C4B_U1_DICTATION",
      stem: "听一听，选出正确的写法",
      audio_text: "蜻蜓",
      options: [
        { id: "A", text: "蜻蜓" },
        { id: "B", text: "清庭" },
        { id: "C", text: "青亭" },
        { id: "D", text: "晴蜓" },
      ],
      answer: { type: "choice", value: "A" },
      solution_steps: ["蜻蜓都是虫字旁"],
    });
    expect(detectPinyinAnswerLeak(q)).toBeNull();
  });

  it("triggers L5 in auditQuestion for leaky question", () => {
    const q = baseQ({
      hints: [{ text: "宿是宝盖头", penalty: 1 }],
    });
    const r = auditQuestion(q);
    expect(r.pass).toBe(false);
    expect(r.issues.some((i) => i.code === "L5")).toBe(true);
  });
});
