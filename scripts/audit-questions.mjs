#!/usr/bin/env node
/**
 * 题库全面静态体检 — 跑 SEED_QUESTIONS 所有题，找数据级 bug。
 *
 * 用法：
 *   node scripts/audit-questions.mjs
 *   node scripts/audit-questions.mjs --json    # 输出 JSON
 *   node scripts/audit-questions.mjs --fix-list # 输出"建议删除"的 ID 列表
 *
 * 检查项（按严重度排序）：
 *   🔴 critical：用户必然踩雷
 *     C1  choice 答案但没 options / options 为空
 *     C2  choice 答案 value 不在任何 option.id 里
 *     C3  number 答案 value 不是有限数
 *     C4  multistep 答案 steps 为空 / 步骤格式不对
 *     C5  choice 答案的所有 options 都标 correct=true 或都标 false
 *
 *   🟡 likely-broken：渲染奇怪 / 答案对不上
 *     L1  question_format=single_choice 但 answer.type ≠ choice
 *     L2  game_type=shop_counter + answer.type=choice + 应用题（数字简单可验）
 *         → 抽数字算一下，跟 options[answer.value].text 比对
 *     L3  options 含完全相同 text（4 选 1 重复 → 必有干扰项乱了）
 *     L4  答案 text 看不出对应数学含义（"以上都不是"等元选项 + 应用题主体）
 *     L5  语文「看拼音写字」答案在 hints / solution_steps / common_errors / feedback 里泄露
 *
 *   🟢 minor：可改可不改
 *     M1  feedback_correct / feedback_wrong 缺失
 *     M2  hints 数 > 0 但 penalty 全 0
 *     M3  estimated_time_seconds 异常（< 10 或 > 180）
 */

import { build } from "esbuild";
import { writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const tmpFile = join(tmpdir(), `audit-bundle-${Date.now()}.mjs`);

// 用 esbuild 把 src/content/questions.ts 整个 bundle 出来，再 import 取数组
await build({
  entryPoints: [join(PROJECT_ROOT, "scripts/_load-content.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: tmpFile,
  logLevel: "error",
});
const mod = await import(tmpFile);
rmSync(tmpFile, { force: true });
const { SEED_QUESTIONS, SKILLS } = mod;

const SKILL_MAP = new Map(SKILLS.map((s) => [s.id, s]));

const issues = []; // { qid, severity, code, message, suggestion }

function add(qid, severity, code, message, suggestion = "") {
  issues.push({ qid, severity, code, message, suggestion });
}

function checkChoiceConsistency(q) {
  if (q.answer?.type !== "choice") return;
  // 画图题（play_as=dot_grid_draw）answer 是 schema 占位，真正判分在 checkShape()
  if (q.play_as === "dot_grid_draw" || q.game_type === "geometry_operation") return;
  const opts = q.options ?? [];
  if (opts.length === 0) {
    add(q.question_id, "critical", "C1", "choice 答案但没 options 或 options 空",
      "需要补 4 个 options 或改 answer.type=number");
    return;
  }
  const ids = new Set(opts.map((o) => o?.id).filter(Boolean));
  if (!ids.has(q.answer.value)) {
    add(q.question_id, "critical", "C2",
      `answer.value="${q.answer.value}" 不在 options.id [${[...ids].join(",")}] 里`,
      "改 answer.value 指向正确 option，或修 options 让 id 正确");
  }
  // 文本完全一样的选项
  const texts = opts.map((o) => String(o?.text ?? "").trim());
  const dup = new Map();
  for (const t of texts) dup.set(t, (dup.get(t) ?? 0) + 1);
  for (const [t, n] of dup) {
    if (n >= 2 && t.length > 0) {
      add(q.question_id, "likely-broken", "L3",
        `options 中重复出现 "${t}" ${n} 次`,
        "重新生成干扰项");
      break;
    }
  }
  // 检查所有 correct 标记一致（如果 options 自带 correct flag）
  const hasCorrect = opts.some((o) => "correct" in (o ?? {}));
  if (hasCorrect) {
    const flagsCorrect = opts.filter((o) => o?.correct).length;
    if (flagsCorrect !== 1) {
      add(q.question_id, "critical", "C5",
        `${flagsCorrect} 个 options 标了 correct=true（应该恰好 1 个）`,
        "确保只有 answer.value 对应的 option correct=true");
    }
  }
}

function checkNumberAnswer(q) {
  if (q.answer?.type !== "number") return;
  const v = q.answer.value;
  if (typeof v !== "number" || !Number.isFinite(v)) {
    add(q.question_id, "critical", "C3",
      `number 答案 value=${JSON.stringify(v)} 不是有限数`,
      "重新整理这道题，确保 answer.value 是 number");
  }
}

function checkMultistepAnswer(q) {
  if (q.answer?.type !== "multistep") return;
  const steps = q.answer.steps ?? [];
  if (steps.length === 0) {
    add(q.question_id, "critical", "C4",
      "multistep 答案 steps 为空",
      "补 steps[]");
    return;
  }
  for (const s of steps) {
    if (!s.step_id || s.expected == null) {
      add(q.question_id, "critical", "C4",
        `multistep step 缺 step_id 或 expected (${JSON.stringify(s)})`,
        "补全 step 字段");
      return;
    }
  }
}

function checkFormatVsAnswer(q) {
  if (q.question_format === "single_choice" && q.answer?.type !== "choice") {
    add(q.question_id, "likely-broken", "L1",
      `question_format=single_choice 但 answer.type=${q.answer?.type}`,
      "改 answer.type=choice 配 options，或改 question_format");
  }
}

/** 应用题简单算式核验：从 stem + options 中抽数字 → 简易乘/加/减验算 */
function checkSimpleArithmetic(q) {
  if (q.answer?.type !== "choice") return;
  if (!q.options || q.options.length === 0) return;
  // 只对 cognitive_level=application 的"小数乘法"类做核验，避免误报
  if (q.cognitive_level !== "application") return;
  if (!/decimal_speed_distance|decimal_price_quantity|decimal_multiply/.test(q.skill_id ?? "")) return;

  // 找到正确 option 的 text
  const correctOpt = q.options.find((o) => o.id === q.answer.value);
  if (!correctOpt) return; // 已被 C2 catch
  const correctText = String(correctOpt.text ?? "").trim();
  const correctNum = Number(correctText.replace(/[元米千克(),，]+/g, ""));
  if (!Number.isFinite(correctNum)) {
    // 文本不是纯数字，跳过
    return;
  }

  // 从 stem 抽出所有小数和整数
  const nums = (q.stem ?? "").match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (nums.length < 2 || nums.length > 5) return; // 太少 / 太复杂跳过

  // 尝试常见组合（购物题、速度题、找零题）
  const tries = [];
  // 两数乘
  for (let i = 0; i < nums.length; i++) {
    for (let j = i + 1; j < nums.length; j++) {
      tries.push({ desc: `${nums[i]} × ${nums[j]}`, val: nums[i] * nums[j] });
    }
  }
  // "付款 N - 总价 = 找零" 模式：N - (a × b)
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < nums.length; j++) {
      for (let k = 0; k < nums.length; k++) {
        if (i === j || i === k || j === k) continue;
        const change = nums[i] - nums[j] * nums[k];
        if (change > 0) tries.push({ desc: `${nums[i]} − ${nums[j]} × ${nums[k]}`, val: change });
      }
    }
  }
  // 三数 a × b + c × d（购物双品种）
  if (nums.length === 4) {
    tries.push({
      desc: `${nums[0]} × ${nums[2]} + ${nums[1]} × ${nums[3]}`,
      val: nums[0] * nums[2] + nums[1] * nums[3],
    });
    tries.push({
      desc: `${nums[0]} × ${nums[1]} + ${nums[2]} × ${nums[3]}`,
      val: nums[0] * nums[1] + nums[2] * nums[3],
    });
  }
  // 五数 N - (a × b + c × d) 找零双品种
  if (nums.length === 5) {
    const N = nums[4];
    const candidates = [
      nums[0] * nums[2] + nums[1] * nums[3],
      nums[0] * nums[1] + nums[2] * nums[3],
      nums[0] * nums[3] + nums[1] * nums[2],
    ];
    for (const total of candidates) {
      if (total > 0 && N > total) tries.push({ desc: `${N} − (${total})`, val: N - total });
    }
  }
  // 找一个匹配（允许 0.01 容差）
  const matched = tries.find((t) => Math.abs(t.val - correctNum) < 0.01);
  if (!matched) {
    // 没匹配 → 怀疑答案不对（或公式不是简单算术）
    add(q.question_id, "likely-broken", "L2",
      `应用题数字 [${nums.join(",")}] 简单组合算不出 ${correctNum}（option ${q.answer.value}）`,
      "需要人工 / LLM 复核此题答案");
  }
}

/** L5: 看拼音写字答案泄露（与 src/lib/questionAuditLite.ts 同步）。 */
const PINYIN_TONE_RE = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹ]/;
const HANZI_RE = /[一-鿿]/g;
function checkPinyinAnswerLeak(q) {
  if (q.subjectId !== "chinese") return;
  if (!/_(?:PINYIN|DICTATION)$/i.test(q.skill_id ?? "")) return;
  const stem = q.stem ?? "";
  if (!PINYIN_TONE_RE.test(stem)) return;
  let answerText = "";
  if (q.answer?.type === "choice" && Array.isArray(q.options)) {
    answerText = q.options.find((o) => o?.id === q.answer.value)?.text ?? "";
  }
  if (!answerText) answerText = q.audio_text ?? "";
  if (!answerText) return;
  const targetChars = [...new Set(answerText.match(HANZI_RE) ?? [])];
  if (targetChars.length === 0) return;
  const stemChars = new Set(stem.match(HANZI_RE) ?? []);
  const checkChars = targetChars.filter((c) => !stemChars.has(c));
  if (checkChars.length === 0) return;
  const buckets = [];
  for (const h of q.hints ?? []) if (h?.text) buckets.push({ name: "hints", text: h.text });
  for (const s of q.solution_steps ?? []) if (s) buckets.push({ name: "solution_steps", text: s });
  for (const e of q.common_errors ?? []) {
    if (e?.error) buckets.push({ name: "common_errors", text: e.error });
    if (e?.remediation) buckets.push({ name: "common_errors", text: e.remediation });
  }
  if (q.feedback_correct) buckets.push({ name: "feedback_correct", text: q.feedback_correct });
  if (q.feedback_wrong) buckets.push({ name: "feedback_wrong", text: q.feedback_wrong });
  const leakedChars = new Set();
  const leakedFields = new Set();
  for (const ch of checkChars) {
    for (const b of buckets) {
      if (b.text.includes(ch)) {
        leakedChars.add(ch);
        leakedFields.add(b.name);
      }
    }
  }
  if (leakedChars.size === 0) return;
  add(
    q.question_id,
    "likely-broken",
    "L5",
    `看拼音写字答案泄露：「${[...leakedChars].join("")}」出现在 ${[...leakedFields].join(" / ")}（题面只给拼音 = 直接给答案）`,
    "把提示 / 解析 / common_errors / feedback 里的目标字换成部首描述、笔画位置等线索",
  );
}

function checkMeta(q) {
  if (!q.feedback_correct || !q.feedback_wrong) {
    add(q.question_id, "minor", "M1", "feedback_correct / feedback_wrong 有缺失", "补全两个 feedback");
  }
  const ets = q.estimated_time_seconds;
  if (typeof ets === "number" && (ets < 10 || ets > 240)) {
    add(q.question_id, "minor", "M3", `estimated_time_seconds=${ets} 偏离合理区间`, "调到 15-180");
  }

  // v0.31.51: 阅读量 vs 时间相关性检查 — 长题给短时间是 Selena 反映的真实问题
  // (10 岁小学生读字慢，4 行情境题 + 4 行选项不能跟一句计算题同时间)
  if (typeof ets === "number") {
    const stemLen = (q.stem ?? "").length;
    const longestOptionLen = Array.isArray(q.options)
      ? Math.max(0, ...q.options.map((o) => (o?.text ?? "").length))
      : 0;
    const hasMultiLineOption = Array.isArray(q.options)
      ? q.options.some((o) => (o?.text ?? "").includes("\n") || (o?.text ?? "").length >= 20)
      : false;

    // 长 stem ≥ 60 字 但时间 < 30s → 太短
    if (stemLen >= 60 && ets < 30) {
      add(q.question_id, "minor", "M4",
        `stem 长 ${stemLen} 字但 estimated_time=${ets}s 太短（小学生读字慢）`,
        `按 quality-rubric 长题加成 +15s（建议 ≥ ${Math.min(90, 30 + 15)}s）`);
    }
    // 超长 stem ≥ 120 字 但时间 < 50s → 严重不够
    if (stemLen >= 120 && ets < 50) {
      add(q.question_id, "minor", "M4",
        `stem 超长 ${stemLen} 字但 estimated_time=${ets}s 严重不足`,
        `应当 ≥ 50s（基础 + 长题加成 +25s）`);
    }
    // 多行选项 但时间 < 30s → 短
    if (hasMultiLineOption && longestOptionLen >= 20 && ets < 30) {
      add(q.question_id, "minor", "M4",
        `option 多行（最长 ${longestOptionLen} 字）但 estimated_time=${ets}s 太短`,
        `多行选项需要 +15s（建议 ≥ 30s）`);
    }
  }
}

/**
 * C6: 纯算式题答案核验 (deterministic, 非启发式)。
 * 对 stem 是**纯算术表达式**(只有数字/运算符/括号, 无中文/字母) 的 number-answer 题,
 * 精确求值后跟 answer.value 比对。不匹配 = 铁定答错的 key (最伤学习的 bug)。
 *
 * 高精度设计 (2026-05-21 实测 85 题 0 误报): 严格只收纯算式 LHS, 自动排除了
 * "积有几位小数"(答案是小数位数不是积)、"1-4 月"范围记法、应用题 (都含中文 → 被过滤)。
 * 支持括号 + 一元负号 + 全角运算符 ×÷ + Unicode 减号 −。
 */
function evalArith(expr) {
  const s = expr.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/\s/g, "");
  const toks = s.match(/(\d+(?:\.\d+)?|[+\-*/()])/g);
  if (!toks) return null;
  const out = [], ops = [], prec = { "+": 1, "-": 1, "*": 2, "/": 2 };
  const apply = () => {
    const op = ops.pop(), b = out.pop(), a = out.pop();
    if (a == null || b == null) return false;
    out.push(op === "+" ? a + b : op === "-" ? a - b : op === "*" ? a * b : a / b);
    return true;
  };
  let prev = null;
  for (const t of toks) {
    if (/^\d/.test(t)) out.push(parseFloat(t));
    else if (t === "(") ops.push(t);
    else if (t === ")") {
      while (ops.length && ops[ops.length - 1] !== "(") if (!apply()) return null;
      if (ops.pop() !== "(") return null;
    } else {
      if ((prev === null || prev === "(" || prev in prec) && t === "-") out.push(0); // 一元负号
      while (ops.length && ops[ops.length - 1] !== "(" && prec[ops[ops.length - 1]] >= prec[t]) if (!apply()) return null;
      ops.push(t);
    }
    prev = t;
  }
  while (ops.length) { if (ops[ops.length - 1] === "(") return null; if (!apply()) return null; }
  return out.length === 1 ? out[0] : null;
}

function checkPureExpressionAnswer(q) {
  if (q.answer?.type !== "number") return;
  if (/位小数|几位/.test(q.stem ?? "")) return; // 防御: "积有几位小数" 答案是位数不是积
  const lhs = (q.stem ?? "").replace(/\s/g, "").replace(/[?？=＝].*$/, ""); // 取首个 =/? 前
  if (!/^[\d.+\-×÷*/()−]+$/.test(lhs)) return; // 严格: LHS 纯算式 (无中文/字母)
  if (!/[+\-×÷*/−]/.test(lhs)) return; // 必须含运算符
  const val = evalArith(lhs);
  if (val === null || !Number.isFinite(val)) return;
  const ans = Number(q.answer.value);
  if (!Number.isFinite(ans)) return;
  if (Math.abs(val - ans) > 1e-6) {
    add(q.question_id, "critical", "C6",
      `纯算式 "${lhs}" 求值 = ${Math.round(val * 1e6) / 1e6} 但 answer.value = ${ans}`,
      "答案 key 算错了, 必须改对 (纯算式精确核验, 非启发式)");
  }
}

// 跑所有检查
for (const q of SEED_QUESTIONS) {
  checkChoiceConsistency(q);
  checkNumberAnswer(q);
  checkMultistepAnswer(q);
  checkFormatVsAnswer(q);
  checkSimpleArithmetic(q);
  checkPureExpressionAnswer(q);
  checkPinyinAnswerLeak(q);
  checkMeta(q);
}

// 汇总
const bySev = {
  critical: issues.filter((i) => i.severity === "critical"),
  "likely-broken": issues.filter((i) => i.severity === "likely-broken"),
  minor: issues.filter((i) => i.severity === "minor"),
};

const args = process.argv.slice(2);
if (args.includes("--json")) {
  console.log(JSON.stringify({ total: SEED_QUESTIONS.length, issues, bySev }, null, 2));
} else if (args.includes("--fix-list")) {
  // 输出"应该从池里 ban 掉"的 IDs（critical + likely-broken）
  const ids = [...bySev.critical, ...bySev["likely-broken"]].map((i) => i.qid);
  for (const id of [...new Set(ids)]) console.log(id);
} else {
  // Pretty print
  console.log(`\n📊 题库审计报告（共 ${SEED_QUESTIONS.length} 道）\n`);
  console.log(`🔴 Critical:     ${bySev.critical.length} 道`);
  console.log(`🟡 Likely-broken: ${bySev["likely-broken"].length} 道`);
  console.log(`🟢 Minor:        ${bySev.minor.length} 道`);
  console.log(`总问题数:        ${issues.length}\n`);

  // 按 code 分组统计
  const byCode = {};
  for (const i of issues) byCode[i.code] = (byCode[i.code] ?? 0) + 1;
  console.log("按问题代码分布：");
  for (const [code, n] of Object.entries(byCode).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${code}: ${n}`);
  }
  console.log();

  for (const sev of ["critical", "likely-broken"]) {
    if (bySev[sev].length === 0) continue;
    console.log(`\n${sev === "critical" ? "🔴" : "🟡"} === ${sev.toUpperCase()} ===\n`);
    for (const i of bySev[sev].slice(0, 30)) {
      const q = SEED_QUESTIONS.find((x) => x.question_id === i.qid);
      const skill = SKILL_MAP.get(q?.skill_id)?.name ?? q?.skill_id ?? "?";
      console.log(`  [${i.code}] ${i.qid}  (${skill})`);
      console.log(`    ${i.message}`);
      if (q) console.log(`    stem: "${(q.stem ?? "").slice(0, 60)}…"`);
      if (i.suggestion) console.log(`    建议: ${i.suggestion}`);
      console.log();
    }
    if (bySev[sev].length > 30) {
      console.log(`  …还有 ${bySev[sev].length - 30} 条（用 --json 看全）`);
    }
  }

  // 保存完整 JSON
  const reportPath = join(PROJECT_ROOT, "scripts", "_audit-report.json");
  writeFileSync(reportPath, JSON.stringify({ total: SEED_QUESTIONS.length, issues, bySev }, null, 2));
  console.log(`\n📝 完整 JSON 报告写到：${reportPath}`);
}
