#!/usr/bin/env node
/**
 * 清理 D1 里因为旧 prompt 反面示范导致的 leak 题目。
 *
 * 修复策略（与 quality-principles.md 的 P 原则对齐）：
 *
 * UPDATE（机械改写，不动数学和题面）：
 *   - P1 clue 元注解：去掉 clue text 里的 "（无关）/（非已知）/（解题设定）" 等标注
 *   - P1 option errorTag：把 errorTag 字段从 student-visible options 移到顶层
 *     `_internal_option_diagnostics` 数组（admin-only 命名约定）
 *
 * DELETE（数学错的、整数情境给小数答案的，不能保存）：
 *   - P2 数学不闭合：和倍/差倍题不整除
 *   - P2 整数情境答小数：果树/人数/个数 unit 但 value 是小数
 *
 * 用法：
 *   node scripts/_cleanup-leak-patterns.mjs            # dry-run，输出 /tmp/cleanup-plan.json
 *   node scripts/_cleanup-leak-patterns.mjs --apply    # 真推（先 update，再 delete）
 *
 * 前置：/tmp/aiqs.json 必须是最新拉的快照。
 */
import { readFileSync, writeFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const APP_PASSWORD = process.env.APP_PASSWORD;
if (APPLY && !APP_PASSWORD) {
  console.error("ERROR: --apply 需要 APP_PASSWORD env 变量");
  process.exit(1);
}

const PROD = "https://selena-elevate.pages.dev";

const aj = JSON.parse(readFileSync("/tmp/aiqs.json", "utf8"));
const rows = aj.rows ?? [];

const META_PATTERNS = [
  "（解题设定，非已知）",
  "（解题设定）",
  "(解题设定)",
  "（非已知）",
  "(非已知)",
  "（无关条件）",
  "（无关）",
  "(无关)",
  "（提示）",
  "（干扰）",
  "（混淆）",
];

function stripMetaAnnotations(text) {
  if (typeof text !== "string") return text;
  let cleaned = text;
  for (const p of META_PATTERNS) cleaned = cleaned.split(p).join("");
  // 清理 annotation 删除后的残留尾部标点 + 仅 trim 首尾，保留内部空格（数字间空格不能动）
  return cleaned
    .replace(/[，,。、:：]\s*$/g, "")
    .trim();
}

function clueHasAnnotation(c) {
  return typeof c === "string" && META_PATTERNS.some((p) => c.includes(p));
}

// ============================================================
// Build plan
// ============================================================

const integerUnits = new Set([
  "棵","人","个","本","只","张","件","朵","支","把","瓶","盒",
  "辆","双","副","串","根","条","头","匹","名","位",
]);

function isMathBroken(q) {
  // 整数情境答小数
  for (const sub of q.subquestions ?? []) {
    if (sub.kind === "numeric" && integerUnits.has(sub.unit)) {
      if (typeof sub.value === "number" && !Number.isInteger(sub.value)) {
        return { reason: "non_integer_count", unit: sub.unit, value: sub.value };
      }
    }
  }
  // 和倍/差倍不闭合（只看 equation_sum_difference skill）
  if (q.skill_id === "equation_sum_difference") {
    const stem = q.stem ?? "";
    const nums = (stem.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
    const beiMatch = stem.match(/(\d+)\s*倍/);
    if (beiMatch && nums.length >= 2) {
      const multiplier = Number(beiMatch[1]);
      if (multiplier >= 2) {
        const total = Math.max(...nums);
        const sumOk = Number.isInteger(total / (multiplier + 1));
        const diffOk = Number.isInteger(total / (multiplier - 1));
        if (!sumOk && !diffOk) {
          return { reason: "math_not_closed_sum", multiplier, total };
        }
      }
    }
  }
  return null;
}

function applyMechanicalFix(q) {
  // 深 clone — 不要原地改 source
  const next = JSON.parse(JSON.stringify(q));
  const changes = [];

  // 1. clue 元注解清洗
  for (const sub of next.subquestions ?? []) {
    if (sub.kind === "clue_pick" && Array.isArray(sub.clues)) {
      const before = sub.clues.slice();
      sub.clues = sub.clues.map((c) => {
        if (clueHasAnnotation(c)) {
          const cleaned = stripMetaAnnotations(c);
          if (cleaned !== c) changes.push(`clue: "${c}" → "${cleaned}"`);
          return cleaned;
        }
        return c;
      });
      // 如果清理后 clue 变空字符串，过滤掉，并相应调整 correct 索引
      const keepIdx = sub.clues.map((c, i) => (c && c.length > 0 ? i : -1)).filter((i) => i >= 0);
      if (keepIdx.length < sub.clues.length) {
        const oldClues = sub.clues;
        sub.clues = keepIdx.map((i) => oldClues[i]);
        if (Array.isArray(sub.correct)) {
          // remap correct indices
          const idxMap = new Map();
          keepIdx.forEach((oldI, newI) => idxMap.set(oldI, newI));
          sub.correct = sub.correct
            .map((oldI) => idxMap.get(oldI))
            .filter((x) => typeof x === "number");
        }
        changes.push(`removed empty clues (compacted ${before.length} → ${sub.clues.length})`);
      }
    }
  }

  // 2. options.errorTag 移到 _internal_option_diagnostics
  const diagnostics = [];
  for (const sub of next.subquestions ?? []) {
    if (sub.kind === "choose" && Array.isArray(sub.options)) {
      for (const opt of sub.options) {
        if (opt && typeof opt === "object" && "errorTag" in opt) {
          diagnostics.push({ id: opt.id, errorTag: opt.errorTag });
          delete opt.errorTag;
          changes.push(`moved errorTag from option ${opt.id} → _internal`);
        }
      }
    }
  }
  // 顶层 options（plain_choice 等）
  if (Array.isArray(next.options)) {
    for (const opt of next.options) {
      if (opt && typeof opt === "object" && "errorTag" in opt) {
        diagnostics.push({ id: opt.id, errorTag: opt.errorTag });
        delete opt.errorTag;
        changes.push(`moved errorTag from top-level option ${opt.id} → _internal`);
      }
    }
  }
  if (diagnostics.length > 0) {
    next._internal_option_diagnostics = (next._internal_option_diagnostics ?? []).concat(
      diagnostics,
    );
  }

  return { next, changes };
}

const plan = {
  toUpdate: [],   // {id, original, fixed, changes}
  toDelete: [],   // {id, reason}
  unchanged: 0,
};

for (const q of rows) {
  const broken = isMathBroken(q);
  if (broken) {
    plan.toDelete.push({ id: q.question_id, ...broken, stem: q.stem.slice(0, 80) });
    continue;
  }
  // Try mechanical fix
  const { next, changes } = applyMechanicalFix(q);
  if (changes.length > 0) {
    plan.toUpdate.push({
      id: q.question_id,
      changes,
      fixed: next,
    });
  } else {
    plan.unchanged++;
  }
}

// ============================================================
// Report
// ============================================================
console.log(`\n══════ Cleanup Plan ══════\n`);
console.log(`Total scanned: ${rows.length}`);
console.log(`To DELETE (math broken):  ${plan.toDelete.length}`);
console.log(`To UPDATE (mechanical fix): ${plan.toUpdate.length}`);
console.log(`Unchanged: ${plan.unchanged}`);
console.log();

console.log("=== DELETE list (will be removed from D1） ===");
for (const d of plan.toDelete) {
  console.log(`  ${d.id} [${d.reason}]: ${d.stem}…`);
}

console.log(`\n=== UPDATE sample (first 8) ===`);
for (const u of plan.toUpdate.slice(0, 8)) {
  console.log(`  ${u.id}:`);
  for (const c of u.changes.slice(0, 3)) {
    console.log(`    ${c}`);
  }
}

const summary = {
  total: rows.length,
  deleteCount: plan.toDelete.length,
  updateCount: plan.toUpdate.length,
  unchangedCount: plan.unchanged,
  deletes: plan.toDelete,
  updates: plan.toUpdate.map((u) => ({ id: u.id, changes: u.changes })),
};
writeFileSync("/tmp/cleanup-plan.json", JSON.stringify(summary, null, 2));
writeFileSync(
  "/tmp/cleanup-updates-payload.json",
  JSON.stringify({ rows: plan.toUpdate.map((u) => u.fixed) }, null, 2),
);
console.error(`\n✓ Plan written to /tmp/cleanup-plan.json`);
console.error(`✓ Update payloads written to /tmp/cleanup-updates-payload.json`);

// ============================================================
// Apply
// ============================================================
if (!APPLY) {
  console.log(`\n✓ Dry run complete. To apply: node ${process.argv[1]} --apply`);
  process.exit(0);
}

console.log(`\n══════ Applying changes ══════\n`);

// 1. UPDATE — POST 到 /api/sync/ai-questions（UPSERT）
const BATCH = 30;   // 与 endpoint MAX_BATCH 一致（实际 50，但 30 更稳）
let pushed = 0, failed = 0;
for (let i = 0; i < plan.toUpdate.length; i += BATCH) {
  const batch = plan.toUpdate.slice(i, i + BATCH).map((u) => u.fixed);
  try {
    const r = await fetch(`${PROD}/api/sync/ai-questions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${APP_PASSWORD}`,
      },
      body: JSON.stringify({ rows: batch }),
    });
    if (!r.ok) {
      console.error(`  batch ${i}: HTTP ${r.status}`);
      failed += batch.length;
      continue;
    }
    const j = await r.json();
    pushed += j.accepted ?? 0;
    process.stderr.write(`.`);
  } catch (e) {
    console.error(`\n  batch ${i} threw: ${e.message}`);
    failed += batch.length;
  }
}
console.error();
console.log(`UPDATE: ${pushed} pushed, ${failed} failed`);

// 2. DELETE — wrangler d1 execute SQL
if (plan.toDelete.length > 0) {
  const ids = plan.toDelete.map((d) => `'${d.id}'`).join(",");
  const sql = `DELETE FROM ai_questions WHERE user_key='selena' AND question_id IN (${ids});`;
  // wrangler d1 execute selena-elevate-db --remote --command "..."
  const { execFileSync } = await import("node:child_process");
  try {
    const out = execFileSync(
      "npx",
      [
        "wrangler",
        "d1",
        "execute",
        "selena-elevate-db",
        "--remote",
        "--command",
        sql,
      ],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    console.log(`DELETE: ${plan.toDelete.length} rows removed via wrangler d1`);
    console.log(out.split("\n").slice(-5).join("\n"));
  } catch (e) {
    console.error(`DELETE failed: ${e.message}`);
  }
}

console.log(`\n✓ Cleanup complete.`);
