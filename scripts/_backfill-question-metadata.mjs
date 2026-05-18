/**
 * v0.35.20 iter 49 (retrospective backlog: "AI prompt 系统化补 keyNumbers"):
 * 一次性 backfill 旧题库 metadata.
 *
 * 现状: 961 题 100% 缺 metadata (speedEligible / requiresEstimation /
 * requiresScratch / requiresMultiStep / keyNumbers), 全走 heuristic.
 * heuristic 保守 → EstimationGate 4.8% / SpeedMatch 6.8% / MultiStep 12.8%.
 *
 * 策略: 用 token-plan-cn qwen3.6-flash 批量打 metadata, 写到 overlay JSON
 * `src/content/questions-backfilled-metadata.json`. questions.ts 运行时 merge.
 *
 * 0 BAILIAN, 走月订阅. 估算成本 ~ 0.25 元 (961 题 × 250 token avg × 0.001/1k).
 *
 * Idempotent: 已 backfill 的题不重跑 (overlay file 有则 skip).
 * Resume-safe: 中断后重跑只补缺的.
 *
 * 用法:
 *   1. 装 esbuild 已经在 devDeps
 *   2. export TOKEN_PLAN_CN_API_KEY=$(grep ... .dev.vars | cut -d= -f2-)
 *   3. node scripts/_backfill-question-metadata.mjs [--limit=N] [--dry-run] [--batch=N]
 *   4. 结果写到 src/content/questions-backfilled-metadata.json
 */
import { build } from "esbuild";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OVERLAY_PATH = resolve(ROOT, "src/content/questions-backfilled-metadata.json");
const TMP_BUNDLE = resolve(tmpdir(), `questions-bundle-${Date.now()}.mjs`);

const TOKEN_PLAN_BASE_URL = "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1";
const MODEL = "qwen3.6-flash";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
    return m ? [m[1], m[2] ?? true] : [a, true];
  }),
);
const LIMIT = args.limit ? parseInt(args.limit, 10) : Infinity;
const DRY_RUN = !!args["dry-run"];
const BATCH_SIZE = args.batch ? parseInt(args.batch, 10) : 10;
const CONCURRENCY = 3; // 3 parallel batches max

const API_KEY = process.env.TOKEN_PLAN_CN_API_KEY;
if (!API_KEY && !DRY_RUN) {
  console.error("ERROR: TOKEN_PLAN_CN_API_KEY env not set. export it from /Users/yong/Desktop/xy/.dev.vars");
  process.exit(1);
}

// ──────────────────── 1. Bundle questions.ts → load SEED_QUESTIONS ────────────────────

console.log("[bundle] esbuild bundling questions.ts...");
await build({
  entryPoints: [resolve(ROOT, "src/content/questions.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: TMP_BUNDLE,
  target: "es2022",
  logLevel: "error",
});
const mod = await import(TMP_BUNDLE);
const QUESTIONS = mod.SEED_QUESTIONS;
console.log(`[bundle] loaded ${QUESTIONS.length} questions`);

// ──────────────────── 2. Load existing overlay (resume support) ────────────────────

let overlay = {};
if (existsSync(OVERLAY_PATH)) {
  try {
    overlay = JSON.parse(readFileSync(OVERLAY_PATH, "utf8"));
    console.log(`[overlay] loaded existing ${Object.keys(overlay).length} entries`);
  } catch (e) {
    console.warn(`[overlay] parse failed, starting fresh:`, e.message);
  }
}

// ──────────────────── 3. Decide which questions need backfill ────────────────────

const toProcess = QUESTIONS.filter((q) => {
  // 已 backfilled
  if (overlay[q.question_id]) return false;
  // 已有显式 metadata 都填了 → skip
  if (
    q.speedEligible != null &&
    q.requiresEstimation != null &&
    q.requiresScratch != null &&
    q.requiresMultiStep != null &&
    q.keyNumbers != null
  ) {
    return false;
  }
  return true;
}).slice(0, LIMIT);

console.log(`[plan] ${toProcess.length} questions need backfill (limit=${LIMIT === Infinity ? "all" : LIMIT})`);
console.log(`[plan] batch=${BATCH_SIZE}, concurrency=${CONCURRENCY}, model=${MODEL}, dry-run=${DRY_RUN}`);

if (toProcess.length === 0) {
  console.log("[done] nothing to do");
  process.exit(0);
}

// ──────────────────── 4. LLM prompt builder ────────────────────

const SYS_PROMPT = `你是小学数学题库标注助手. 给你 N 道四年级数学题, 你给每道题打 5 个字段:

字段定义:
- speedEligible (bool): 是否适合 SpeedMatch (闪电匹配 4 选 1, 一步速算).
  true 仅当: 一步运算 + 2 位以内数字 + 没有应用场景 + 没有单位换算. 例: "23 + 47 = ?".
  false: 多步 / 多位 / 应用题 / 单位换算 / 概念题.
- requiresEstimation (bool): 是否应该触发"估算门" (Phase 1 估算 + Phase 2 算).
  true 仅当: 多位 +-×÷ (digits ≥ 3) 且非单位换算非应用题. 例: "234 × 67 = ?".
  false: 简单口算 / 概念题 / 单位 / 应用题 (应用题走 multiStep).
- requiresScratch (bool): 是否需要列草稿 (3+ 位竖式 / 多步).
  true: 3 位以上 + - × ÷ 算式 / 多步式. 例: "1234 + 5678" 或 "23 × 47".
  false: 1-2 位 / 概念 / 单选.
- requiresMultiStep (bool): 是否触发应用题 4 步框架.
  true 仅当: 文字应用题 (有故事 + 问题), 难度 ≥ 3. 例: "小明买苹果 5 千克, 每千克 8 元, 一共多少元?".
  false: 纯算式 / 单位换算 / 选择.
- keyNumbers (number[]): 题面里的关键数字 (用于估算 phase 显示). 提取 2-4 个核心数字.
  例: "234 × 67 = ?" → [234, 67]. 应用题 "5 千克 × 8 元" → [5, 8].
  纯概念题没数字 → [].

输出格式: 严格 JSON 数组, 元素 { "question_id": "Q123", "speedEligible": false, "requiresEstimation": true, "requiresScratch": true, "requiresMultiStep": false, "keyNumbers": [234, 67] }.
不要解释, 不要 markdown, 不要 \`\`\` 代码块. 只输出数组.`;

function makeUserPrompt(batch) {
  const lines = batch.map((q, i) => `${i + 1}. question_id=${q.question_id} | difficulty=${q.difficulty} | game_type=${q.game_type} | stem=${q.stem.replace(/\n/g, " ").slice(0, 200)}`);
  return `请给下面 ${batch.length} 道题打 metadata:\n\n${lines.join("\n")}`;
}

// ──────────────────── 5. LLM call ────────────────────

async function callLLM(batch, attempt = 0) {
  if (DRY_RUN) {
    // Mock response for dry-run
    return batch.map((q) => ({
      question_id: q.question_id,
      speedEligible: false,
      requiresEstimation: false,
      requiresScratch: false,
      requiresMultiStep: false,
      keyNumbers: [],
    }));
  }
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 60_000);
  try {
    const r = await fetch(`${TOKEN_PLAN_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYS_PROMPT },
          { role: "user", content: makeUserPrompt(batch) },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(to);
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      throw new Error(`http_${r.status}: ${text.slice(0, 200)}`);
    }
    const j = await r.json();
    const content = j.choices?.[0]?.message?.content ?? "";
    // Parse JSON array (strip markdown code fence just in case)
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      throw new Error(`json_parse_fail: ${cleaned.slice(0, 200)}`);
    }
    if (!Array.isArray(parsed)) throw new Error(`not_array: ${typeof parsed}`);
    return parsed;
  } catch (e) {
    clearTimeout(to);
    if (attempt < 2) {
      console.warn(`  retry (attempt ${attempt + 1}) batch ${batch[0]?.question_id}.. ${e.message.slice(0, 80)}`);
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      return callLLM(batch, attempt + 1);
    }
    throw e;
  }
}

// ──────────────────── 6. Process batches with concurrency ────────────────────

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const batches = chunk(toProcess, BATCH_SIZE);
console.log(`[plan] ${batches.length} batches`);

let done = 0;
let failed = 0;
const startMs = Date.now();

// Save progress every N batches
function saveOverlay() {
  if (DRY_RUN) return;
  writeFileSync(OVERLAY_PATH, JSON.stringify(overlay, null, 2));
}

async function processBatch(batch, idx) {
  try {
    const results = await callLLM(batch);
    // Validate + merge into overlay
    const byId = new Map(results.map((r) => [r.question_id, r]));
    for (const q of batch) {
      const r = byId.get(q.question_id);
      if (!r) {
        console.warn(`  miss ${q.question_id} in LLM response`);
        continue;
      }
      // Sanitize types
      const entry = {
        speedEligible: typeof r.speedEligible === "boolean" ? r.speedEligible : undefined,
        requiresEstimation: typeof r.requiresEstimation === "boolean" ? r.requiresEstimation : undefined,
        requiresScratch: typeof r.requiresScratch === "boolean" ? r.requiresScratch : undefined,
        requiresMultiStep: typeof r.requiresMultiStep === "boolean" ? r.requiresMultiStep : undefined,
        keyNumbers: Array.isArray(r.keyNumbers) ? r.keyNumbers.filter((n) => typeof n === "number") : undefined,
      };
      // Drop undefined fields
      for (const k of Object.keys(entry)) {
        if (entry[k] === undefined) delete entry[k];
      }
      if (Object.keys(entry).length > 0) {
        overlay[q.question_id] = entry;
      }
    }
    done += batch.length;
    const pct = ((done / toProcess.length) * 100).toFixed(1);
    const elapsed = Math.round((Date.now() - startMs) / 1000);
    const eta = Math.round((elapsed / done) * (toProcess.length - done));
    console.log(`  ✓ batch ${idx + 1}/${batches.length} (${pct}% / ${elapsed}s elapsed / ${eta}s ETA)`);
    // Save every 5 batches
    if ((idx + 1) % 5 === 0) saveOverlay();
  } catch (e) {
    failed += batch.length;
    console.error(`  ✗ batch ${idx + 1} FAIL: ${e.message.slice(0, 150)}`);
  }
}

// Simple concurrency pool
async function runPool() {
  const queue = batches.map((b, i) => ({ batch: b, idx: i }));
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;
      await processBatch(task.batch, task.idx);
    }
  });
  await Promise.all(workers);
}

await runPool();
saveOverlay();

const elapsed = Math.round((Date.now() - startMs) / 1000);
console.log(`\n[done] processed ${done}/${toProcess.length} questions in ${elapsed}s (${failed} failed)`);
console.log(`[done] overlay written: ${OVERLAY_PATH} (${Object.keys(overlay).length} total entries)`);
console.log(`\nNext: re-run audit: node scripts/_audit-question-templates.mjs`);
