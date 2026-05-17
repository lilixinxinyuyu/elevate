/**
 * v0.34.98 (iter 32 P0-0b/c): SpeedMatch 白名单 + Choice→Fill 政策
 *
 * 起因: Selena 43% 期中事件三方分析 — SpeedMatch 强化反射, 但真题需 System-2.
 *   爸爸明确"不是所有题都需要 SpeedMatch — 简单速算 / 单一逻辑 OK,
 *   复杂题 (多位 / 应用题 / 单位换算) 应该禁".
 *
 * 三方共识:
 *   - Gemini: 正则 + 简单 AST 跑全量, 边缘 case 丢 LLM
 *   - GPT: metadata 字段 `speedEligible / opCount / digitsMax / hasUnit / hasStory`
 *     未知 metadata 默认禁
 *
 * 本模块实现:
 *   1. isSpeedEligible(q): 显式 `q.speedEligible` 优先, 否则 heuristic
 *   2. shouldForceNumericFill(q): 简单 single_choice + numeric answer → 强制填空
 *   3. classifyStem(stem): 提供给 heuristic 的题目特征 (字符级正则)
 *
 * 调用方:
 *   - src/components/game/templates/resolve.ts: 决定 GameTemplate 时检查
 *   - tests/speedMatchPolicy.test.ts: heuristic 覆盖率 sanity check
 */
import type { Question } from "./types";
import {
  isSpeedMatchWhitelistV1,
  isForceFillSimpleV1,
} from "../lib/featureFlags";

export interface StemFeatures {
  /** 题面字符数 (粗略阅读负担) */
  charLen: number;
  /** 题面里运算符个数 (+/-/×/÷ 或 *、/、加减乘除) */
  opCount: number;
  /** 题面里数字的最大位数 (3 = 三位数, 4 = 四位数) */
  digitsMax: number;
  /** 是否带单位 (元/角/分/米/千米/厘米/毫米/克/千克/吨/秒/分钟/小时/天/升/毫升 ...) */
  hasUnit: boolean;
  /** 是否带故事场景 (含人名/动词/有/共/...) */
  hasStory: boolean;
  /** 是否多步 (含"再"/"又"/"剩"/"一共"/"还"/"=...=" 等) */
  hasMultiStep: boolean;
}

const UNIT_CHARS = /(元|角|分|圆|块|毛|米|千米|公里|厘米|毫米|分米|克|千克|公斤|吨|秒|分钟|小时|时|天|周|月|年|升|毫升|度|平方|立方|个|只|条|张|本|件|岁|度|斤|两)/;
// 排除 "1 分钟" 里的 "分" — 通过 dictionary 顺序 match 优先长 token

const STORY_CUES = /(小明|小红|小华|小丽|小军|小芳|妈妈|爸爸|老师|同学|商店|工厂|花园|学校|公园|果园|池塘|图书馆|有|共|买|卖|吃|送|借|还|跑|走|装|搬|剩|每|一共|总共|至少|至多|多少|几|几个|平均)/;

const MULTISTEP_CUES = /(再|又|然后|接着|然后又|剩下|还剩|一共|总共|平均|相当于|比.*多|比.*少|.*的.+倍|占.+的)/;

function countMatches(s: string, re: RegExp): number {
  // count non-overlapping matches of a non-global regex by re-running with /g
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  const g = new RegExp(re.source, flags);
  const matches = s.match(g);
  return matches ? matches.length : 0;
}

export function classifyStem(stem: string): StemFeatures {
  const opCount = countMatches(stem, /[+\-*/×÷加减乘除]/);
  const digitGroups = stem.match(/\d+/g) ?? [];
  const digitsMax = digitGroups.reduce((m, g) => Math.max(m, g.length), 0);
  return {
    charLen: stem.length,
    opCount,
    digitsMax,
    hasUnit: UNIT_CHARS.test(stem),
    hasStory: STORY_CUES.test(stem),
    hasMultiStep: MULTISTEP_CUES.test(stem),
  };
}

/**
 * Heuristic — 不靠 explicit metadata 时判断是否适合 SpeedMatch (闪电 4 选 1).
 *
 * 适合 (return true) 条件:
 *   - 题面 ≤ 30 字
 *   - 没单位 / 没故事 / 没多步线索
 *   - 数字最大 2 位 (≤ 99)
 *   - 运算符 ≤ 1 (单步)
 *   - 难度 ≤ 2
 *
 * 不满足 → 不适合 SpeedMatch (return false).
 */
export function speedEligibleByHeuristic(q: Question): boolean {
  if (q.difficulty >= 3) return false;
  const f = classifyStem(q.stem);
  if (f.charLen > 30) return false;
  if (f.hasUnit) return false;
  if (f.hasStory) return false;
  if (f.hasMultiStep) return false;
  if (f.digitsMax > 2) return false;
  if (f.opCount > 1) return false;
  // 应用题 / 多步答案永远禁
  if (q.question_format === "multi_step") return false;
  if ((q.subquestions ?? []).length > 0) return false;
  if (q.word_problem_steps) return false;
  return true;
}

/**
 * Public: 题目是否允许进入 SpeedMatch 模板.
 * 优先 explicit `q.speedEligible`, 否则 heuristic.
 * Flag isSpeedMatchWhitelistV1=false 时永远 true (回到老逻辑, 紧急回滚).
 */
export function isSpeedEligible(q: Question): boolean {
  if (!isSpeedMatchWhitelistV1()) return true;
  if (typeof q.speedEligible === "boolean") return q.speedEligible;
  return speedEligibleByHeuristic(q);
}

/**
 * Public: 简单 single_choice + numeric answer 题是否强制 plain_numeric 填空.
 *
 * 判断条件:
 *   - question_format = single_choice 或 numeric_choice
 *   - answer.type = "number" (非 text)
 *   - heuristic 判定为 "简单"  (≤ 2 位 / 单步 / 无 story / 无 unit / difficulty ≤ 2)
 *
 * Flag isForceFillSimpleV1=false → 关闭, 老选择题渲染.
 */
export function shouldForceNumericFill(q: Question): boolean {
  if (!isForceFillSimpleV1()) return false;
  if (q.answer.type !== "number") return false;
  const isChoice = q.question_format === "single_choice" || q.question_format === "numeric_choice";
  if (!isChoice) return false;
  // simple = heuristic 认为可以走 SpeedMatch — 这种简单题不允许"看选项猜"
  return speedEligibleByHeuristic(q);
}
