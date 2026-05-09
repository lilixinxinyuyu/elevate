#!/usr/bin/env node
/**
 * 一次性脏数据扫描 — 把已落库的「看拼音写字 / 听写」答案泄露题标 status=needs_review，
 * 不直接删，让管理员人工 review。
 *
 * 走 prod /api/sync/ai-questions 端点：GET 拉全部，本地跑 leak 检测，命中的把
 * status 改成 "needs_review"，再 POST 回去（upsert by question_id）。
 *
 * 用法：
 *   APP_PASSWORD=$(grep ^APP_PASSWORD= ../.dev.vars | cut -d= -f2-) \
 *     node scripts/_scan-pinyin-leak.mjs              # dry-run（默认）
 *   APP_PASSWORD=... node scripts/_scan-pinyin-leak.mjs --apply  # 真的写回 D1
 *
 * 检测规则与 src/lib/questionAuditLite.ts:detectPinyinAnswerLeak 同步。
 * 只动 chinese 学科 + _PINYIN/_DICTATION 后缀的 skill + stem 含拼音声调字符的题。
 */

const PWD = process.env.APP_PASSWORD;
if (!PWD) {
  console.error("✗ APP_PASSWORD env required（参考 ~/.claude memory: APP_PASSWORD 在 ../.dev.vars）");
  process.exit(1);
}
const PROD = process.env.PROD_URL ?? "https://selena-elevate.pages.dev";
const APPLY = process.argv.includes("--apply");

// ---- leak detector（与 questionAuditLite.ts 同步实现）-------------------
const PINYIN_TONE_RE = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹ]/;
const HANZI_RE = /[一-鿿]/g;

function detectPinyinAnswerLeak(q) {
  if (q.subjectId !== "chinese") return null;
  if (!/_(?:PINYIN|DICTATION)$/i.test(q.skill_id ?? "")) return null;
  const stem = q.stem ?? "";
  if (!PINYIN_TONE_RE.test(stem)) return null;

  let answerText = "";
  if (q.answer?.type === "choice" && Array.isArray(q.options)) {
    answerText = q.options.find((o) => o?.id === q.answer.value)?.text ?? "";
  }
  if (!answerText) answerText = q.audio_text ?? "";
  if (!answerText) return null;

  const targetChars = [...new Set(answerText.match(HANZI_RE) ?? [])];
  if (targetChars.length === 0) return null;

  const stemChars = new Set(stem.match(HANZI_RE) ?? []);
  const checkChars = targetChars.filter((c) => !stemChars.has(c));
  if (checkChars.length === 0) return null;

  const buckets = [];
  for (const h of q.hints ?? []) if (h?.text) buckets.push({ name: "hints", text: h.text });
  for (const s of q.solution_steps ?? []) if (s) buckets.push({ name: "solution_steps", text: s });
  for (const e of q.common_errors ?? []) {
    if (e?.error) buckets.push({ name: "common_errors.error", text: e.error });
    if (e?.remediation) buckets.push({ name: "common_errors.remediation", text: e.remediation });
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
  if (leakedChars.size === 0) return null;
  return { chars: [...leakedChars], fields: [...leakedFields] };
}

// ---- main ---------------------------------------------------------------
console.error(`▶ Pull AI questions from ${PROD}/api/sync/ai-questions`);
const r = await fetch(`${PROD}/api/sync/ai-questions`, {
  headers: { Authorization: `Bearer ${PWD}` },
});
if (!r.ok) {
  console.error(`✗ HTTP ${r.status}`);
  process.exit(1);
}
const dj = await r.json();
const rows = Array.isArray(dj?.rows) ? dj.rows : [];
console.error(`  got ${rows.length} questions`);

const flagged = [];
for (const q of rows) {
  if (q.status === "needs_review" || q.status === "rejected" || q.status === "retired") continue;
  const leak = detectPinyinAnswerLeak(q);
  if (leak) flagged.push({ q, leak });
}

console.error(`▶ Leak hits: ${flagged.length} / ${rows.length}`);
for (const { q, leak } of flagged.slice(0, 20)) {
  const stemPreview = (q.stem ?? "").slice(0, 50).replace(/\n/g, " ");
  console.error(
    `  ${q.question_id} [${q.skill_id}]  leak「${leak.chars.join("")}」in ${leak.fields.join(",")}\n    stem: ${stemPreview}…`,
  );
}
if (flagged.length > 20) console.error(`  …还有 ${flagged.length - 20} 条`);

if (!APPLY) {
  console.error(`\n(dry-run) 加 --apply 真的把这些题改成 status=needs_review 写回 D1`);
  console.log(JSON.stringify({ scanned: rows.length, flagged: flagged.length, ids: flagged.map((x) => x.q.question_id) }, null, 2));
  process.exit(0);
}

if (flagged.length === 0) {
  console.error(`✓ 没有需要 flag 的题，退出`);
  process.exit(0);
}

console.error(`\n▶ Push ${flagged.length} flagged 题（status=needs_review）回 /api/sync/ai-questions`);
const BATCH = 30;
let pushed = 0;
for (let i = 0; i < flagged.length; i += BATCH) {
  const slice = flagged.slice(i, i + BATCH).map(({ q, leak }) => ({
    ...q,
    status: "needs_review",
    tags: Array.from(new Set([...(q.tags ?? []), "answer_leak_flagged"])),
    audit_note: `pinyin_answer_leak: 「${leak.chars.join("")}」 in ${leak.fields.join(", ")}`,
  }));
  const resp = await fetch(`${PROD}/api/sync/ai-questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${PWD}` },
    body: JSON.stringify({ rows: slice }),
  });
  if (!resp.ok) {
    console.error(`  batch ${i / BATCH + 1}: HTTP ${resp.status}`);
    continue;
  }
  const j = await resp.json();
  pushed += j.accepted ?? 0;
  process.stderr.write(`  batch ${i / BATCH + 1}/${Math.ceil(flagged.length / BATCH)}: ✓ ${j.accepted}\n`);
}

console.error(`✓ updated ${pushed}/${flagged.length}（管理员去 SkillBankDashboard 走 needs_review 队列人工 review）`);
console.log(JSON.stringify({ scanned: rows.length, flagged: flagged.length, updated: pushed }, null, 2));
