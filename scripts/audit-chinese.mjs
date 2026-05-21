#!/usr/bin/env node
/**
 * 语文题库正确性体检 — 扫 chineseSubject.seedQuestions (8 个 pack 合并, 见
 * src/subjects/chinese/index.ts) 找数据级 bug。math 侧有 scripts/audit-questions.mjs,
 * 但它只看 SEED_QUESTIONS(数学); 语文题在另一个 subject, 此前**没有任何 audit 覆盖**。
 *
 * 用法:
 *   node scripts/audit-chinese.mjs            # 人读报告, 有 critical 时 exit 1
 *   node scripts/audit-chinese.mjs --json     # JSON
 *
 * ── 设计要点 (2026-05-21 实测验证后定的, 防止重复踩坑) ──
 *  语文题两类容易被机械检查误报, 这里明确处理:
 *
 *  1) **minigame 题 (poem_cloze / glyph_detective 等)**: question_format='single_choice'
 *     但 answer.value='__game_correct__' 且带 game_data, options 为空 —— 这是**正常设计**
 *     (由对应 minigame 组件渲染, 不走 plain_choice 选项模板)。→ 对这类**跳过**选项类检查,
 *     只校验它确实带了 game_data。
 *
 *  2) **"找错的"题型**: 题干问"哪个写错了/有错别字/用错的是/哪个不是…", 正确答案**就是**那个
 *     错误项, 所以正确选项**合法地**带 errorTag(描述它错在哪)。→ errorTag-on-correct 对这类
 *     **不算 bug** (实测 27 道全是此类)。故 errorTag 检查仅作 INFO, 且对"找错"题干跳过。
 *
 * ── 阻断级检查 (critical, 命中 exit 1) ──
 *   X1  choice 题(非 minigame)options 为空 / 缺失
 *   X2  answer.type=choice 但 answer.value 不在任何 option.id 里 (题没法答对)
 *   X3  选项 text 完全重复 (4 选 1 出现相同项 → 干扰项坏了)
 *   X4  question_format=single_choice 但 answer.type 既非 choice 也非 minigame 占位
 *   X5  minigame 题 (answer.value='__game_correct__') 却没有 game_data
 *
 * ── 提示级 (info, 不阻断) ──
 *   I1  非"找错"题干, 但正确选项带 errorTag (可能是标错; 人工瞄一眼)
 */
import { build } from "esbuild";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const ENTRY = join(PROJECT_ROOT, "src/subjects/chinese/index.ts");

const GAME_CORRECT = "__game_correct__";
// "找错的"题型: 正确答案=错误项, errorTag 合法。
// 涵盖"找错字/选病句"两大类题干 (含各种病句错型名: 搭配不当/成分残缺/前后矛盾/重复啰嗦…)。
const FIND_WRONG_RE = /(写错|错别字|用错|不正确|不是|哪个错|错的|有错|不对|错误|毛病|语病|病句|修改|有.{0,4}问题|搭配不当|残缺|矛盾|啰嗦|重复|用词不当|语序)/;

async function loadChineseSubject() {
  const tmp = join(tmpdir(), `audit-cn-${Date.now()}.mjs`);
  await build({ entryPoints: [ENTRY], bundle: true, format: "esm", outfile: tmp, platform: "node", logLevel: "silent" });
  const mod = await import(tmp);
  rmSync(tmp, { force: true });
  return { qs: mod.chineseSubject.seedQuestions, skills: mod.chineseSubject.skills ?? [] };
}

function isMinigame(q) {
  return q?.answer?.value === GAME_CORRECT || !!q?.game_data;
}

function audit(qs, skills) {
  const crit = { X1_no_options: [], X2_answer_not_in_options: [], X3_dup_option: [], X4_fmt_mismatch: [], X5_minigame_no_data: [], X6_orphan_skill: [] };
  const info = { I1_correct_has_errorTag: [] };
  // X6: question.skill_id 必须在 SKILLS_CHINESE 里。孤儿 skill_id → mastery 追踪/能力映射/
  //   per-ability mock 覆盖 对该题全失效 (v0.36.78: 加 U6-U8 后用此守新单元/未来并发加题)。
  const skillIds = new Set(skills.map((s) => s.id));
  for (const q of qs) {
    const id = q.question_id;
    const fmt = q.question_format;
    const ans = q.answer;
    const opts = Array.isArray(q.options) ? q.options : [];

    if (q.skill_id && skillIds.size > 0 && !skillIds.has(q.skill_id)) {
      crit.X6_orphan_skill.push(`${id} (skill=${q.skill_id})`);
    }

    if (isMinigame(q)) {
      if (!q.game_data) crit.X5_minigame_no_data.push(id);
      continue; // minigame 题不走选项模板, 跳过选项类检查
    }

    const isChoice = fmt === "single_choice" || ans?.type === "choice";
    if (!isChoice) continue;

    if (opts.length === 0) { crit.X1_no_options.push(id); continue; }
    const ids = opts.map((o) => o.id);
    if (ans?.type === "choice" && !ids.includes(ans.value)) {
      crit.X2_answer_not_in_options.push(`${id} (ans=${ans.value} ids=${ids.join("/")})`);
    }
    const seen = new Set();
    for (const o of opts) {
      const t = (o?.text ?? "").trim();
      if (t && seen.has(t)) { crit.X3_dup_option.push(`${id} ("${t}")`); break; }
      seen.add(t);
    }
    if (fmt === "single_choice" && ans?.type && ans.type !== "choice") {
      crit.X4_fmt_mismatch.push(`${id} (ans.type=${ans.type})`);
    }
    const correct = opts.find((o) => o.id === ans?.value);
    if (correct && correct.errorTag && !FIND_WRONG_RE.test(q.stem ?? "")) {
      info.I1_correct_has_errorTag.push(`${id} (tag=${correct.errorTag})`);
    }
  }
  return { crit, info };
}

const { qs, skills } = await loadChineseSubject();
const { crit, info } = audit(qs, skills);
const critCount = Object.values(crit).reduce((n, a) => n + a.length, 0);
const infoCount = Object.values(info).reduce((n, a) => n + a.length, 0);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ total: qs.length, critCount, infoCount, crit, info }, null, 2));
} else {
  console.log(`\n📕 语文题库审计 (共 ${qs.length} 道)\n`);
  console.log(`🔴 阻断级: ${critCount} 道`);
  for (const [k, a] of Object.entries(crit)) {
    if (a.length) { console.log(`  ${k}: ${a.length}`); a.slice(0, 10).forEach((x) => console.log(`     - ${x}`)); }
  }
  console.log(`\n🟦 提示级 (人工瞄, 不阻断): ${infoCount} 道`);
  for (const [k, a] of Object.entries(info)) {
    if (a.length) { console.log(`  ${k}: ${a.length}`); a.slice(0, 10).forEach((x) => console.log(`     - ${x}`)); }
  }
  console.log("");
}

process.exit(critCount > 0 ? 1 : 0);
