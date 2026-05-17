/**
 * Resurrection: 把 Selena snapshot 里因 grader bug (Q3 fix #1 v0.34.60) 误判
 * isCorrect=false 但实际答对的 attempts 复活, 同时 resolve 对应假错题.
 *
 * 背景: ShopCounter 把单步答案包成 [answer] 数组 / multi_step 用位置数组,
 * 老 grader 不接受 → 强迫记错题。修后 grader 接受了 (commit 64ca191), 但
 * Selena snapshot 里已有 244 误判 + 178+ 伪错题。手动 reset 太麻烦, 写脚本.
 *
 * 算法:
 *   1. pull OSS users/selena/snapshot.json
 *   2. 用新 grader (移植到 Node) 重判每个 isCorrect=false 的 attempt
 *      - 如果 raw 是 single-element array → unwrap
 *      - 然后 number/choice/multi_step 各自规则
 *   3. 找出 "should have been correct" 的 attempt 列表
 *   4. 翻 attempt.isCorrect = true
 *   5. 对应 mistakes 行 (按 questionId 匹配) - 把 stage 推到 5, resolved=true
 *      (相当于 grader 早就对的话, SR 早结束了)
 *   6. safety copy 当前 snapshot → _backups/{ts}-pre-resurrection/
 *   7. write 修过的 snapshot 回 OSS
 *
 * Run: cd aliyun-deploy && node scripts/_resurrect-misjudged-attempts.mjs [--apply]
 *      默认 dry-run (报告影响范围); --apply 才动手.
 */
import OSS from "ali-oss";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("/Users/yong/Desktop/xy/.dev.vars", "utf-8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const USER_ID = "selena";
const SNAPSHOT_KEY = `users/${USER_ID}/snapshot.json`;
const APPLY = process.argv.includes("--apply");

const oss = new OSS({
  endpoint: `https://${env.ALIYUN_OSS_REGION}.aliyuncs.com`,
  bucket: env.ALIYUN_OSS_BUCKET,
  accessKeyId: env.ALIYUN_OSS_ACCESS_KEY_ID,
  accessKeySecret: env.ALIYUN_OSS_ACCESS_KEY_SECRET,
  secure: true,
});

// ─── 移植 src/core/grading.ts 的 new-grader 逻辑 (跟 64ca191 commit 一致) ─

function normalizeText(s) {
  return String(s)
    .replace(/\s+/g, "").replace(/×/g, "*").replace(/÷/g, "/")
    .replace(/（/g, "(").replace(/）/g, ")").toLowerCase();
}

function tryEvaluateExpression(text) {
  // 简化版: 只接受单纯 a*b / a+b / a-b / a/b
  const cleaned = String(text).replace(/\s+/g, "");
  if (!/^-?\d+(\.\d+)?\s*[+\-*/]\s*-?\d+(\.\d+)?$/.test(cleaned)) return null;
  try { return Function(`return (${cleaned})`)(); } catch { return null; }
}

function coerceChineseMoney(text) {
  const yuanJiao = text.match(/(-?\d+(?:\.\d+)?)\s*元\s*(\d+(?:\.\d+)?)\s*角/);
  if (yuanJiao) return Number(yuanJiao[1]) + Number(yuanJiao[2]) / 10;
  return null;
}

function coerceNumber(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const direct = Number(trimmed);
  if (Number.isFinite(direct)) return direct;
  const money = coerceChineseMoney(trimmed);
  if (money != null) return money;
  const evaled = tryEvaluateExpression(trimmed);
  if (evaled != null) return evaled;
  const stripped = trimmed.replace(/[^\d.\-+]/g, "");
  if (stripped && stripped !== "-" && stripped !== "+" && stripped !== ".") {
    const n = Number(stripped);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function compareStep(expected, given) {
  if (typeof expected === "number") {
    const n = coerceNumber(given);
    return n != null && Math.abs(n - expected) <= 1e-6;
  }
  const expN = normalizeText(expected);
  if (typeof given === "number") return normalizeText(String(given)) === expN;
  if (typeof given === "string") {
    const gN = normalizeText(given);
    if (gN === expN) return true;
    const eVal = tryEvaluateExpression(expected);
    const gVal = tryEvaluateExpression(given);
    if (eVal != null && gVal != null) return Math.abs(eVal - gVal) <= 1e-6;
  }
  return false;
}

function newGrade(question, userAnswer) {
  const spec = question.answer;
  if (!spec) return null;
  let raw = userAnswer;
  if (spec.type !== "multi_step" && Array.isArray(raw) && raw.length === 1) raw = raw[0];
  if (spec.type === "number") {
    const n = coerceNumber(raw);
    if (n == null) return false;
    const tol = spec.acceptable_error ?? 0;
    return Math.abs(n - spec.value) <= Math.max(tol, 1e-6);
  }
  if (spec.type === "choice") {
    return typeof raw === "string" && raw === spec.value;
  }
  if (spec.type === "multi_step") {
    const isArr = Array.isArray(raw);
    const obj = isArr ? null : ((raw ?? {}));
    const results = spec.steps.map((step, i) => {
      const given = isArr ? raw[i] : obj?.[step.step_id];
      return compareStep(step.expected, given);
    });
    const lastStepId = spec.steps[spec.steps.length - 1]?.step_id;
    const answerStep = spec.steps.findIndex((s) => s.step_id === lastStepId || s.step_id === "answer");
    return answerStep >= 0 ? results[answerStep] : results.every((r) => r);
  }
  return null;
}

// ─── Main ─

(async () => {
  // Snapshot 不带 questions (cloudSync PUSH_TABLES 故意排除). 从 4 个源加载:
  //   1. backup/heping-backup-FULL-2026-05-16.json (1877, 含历史 AI 出过的)
  //   2. OSS users/selena/ai-questions.json (老 v1 blob, Selena 设备早期 push)
  //   3. OSS users/selena/ai-questions/*.json (v0.34.65 server-side per-key, 救新出的题)
  //   4. public/agent/questions.json (静态 seed 池 961)
  console.log("loading question pool from 4 sources...");
  const qPool = new Map();
  let countSeed = 0, countBackup = 0, countOssAi = 0, countOssPerKey = 0;
  try {
    const seed = JSON.parse(readFileSync("/Users/yong/Desktop/xy/heping-math-trainer/public/agent/questions.json", "utf-8"));
    for (const q of (Array.isArray(seed) ? seed : Object.values(seed))) {
      if (q?.question_id && !qPool.has(q.question_id)) { qPool.set(q.question_id, q); countSeed++; }
    }
  } catch (e) { console.warn("  seed pool fail:", e.message); }
  try {
    const bk = JSON.parse(readFileSync("/Users/yong/Desktop/xy/backup/heping-backup-FULL-2026-05-16.json", "utf-8"));
    for (const q of (bk.questions ?? [])) {
      if (q?.question_id && !qPool.has(q.question_id)) { qPool.set(q.question_id, q); countBackup++; }
    }
  } catch (e) { console.warn("  backup file fail:", e.message); }
  try {
    const aiR = await oss.get(`users/${USER_ID}/ai-questions.json`);
    const aiArr = JSON.parse(aiR.content.toString("utf-8"));
    for (const q of (Array.isArray(aiArr) ? aiArr : (aiArr.questions ?? aiArr.rows ?? []))) {
      if (q?.question_id && !qPool.has(q.question_id)) { qPool.set(q.question_id, q); countOssAi++; }
    }
  } catch (e) { console.warn("  OSS ai-questions (blob) fail:", e.code ?? e.message); }
  // v0.34.65: per-key prefix load (server-side persist 后写的)
  try {
    let marker = null;
    while (true) {
      const list = await oss.list({
        prefix: `users/${USER_ID}/ai-questions/`,
        marker,
        "max-keys": 1000,
      });
      for (const obj of (list.objects ?? [])) {
        if (!obj.name.endsWith(".json")) continue;
        try {
          const g = await oss.get(obj.name);
          const q = JSON.parse(g.content.toString("utf-8"));
          if (q?.question_id && !qPool.has(q.question_id)) {
            qPool.set(q.question_id, q);
            countOssPerKey++;
          }
        } catch (e) { /* skip bad object */ }
      }
      if (!list.nextMarker) break;
      marker = list.nextMarker;
    }
  } catch (e) { console.warn("  OSS ai-questions per-key fail:", e.code ?? e.message); }
  console.log(`  pool: ${qPool.size} (seed=+${countSeed} backup=+${countBackup} ai-questions-blob=+${countOssAi} ai-questions-per-key=+${countOssPerKey})`);

  console.log(`pulling ${SNAPSHOT_KEY}...`);
  const r = await oss.get(SNAPSHOT_KEY);
  const raw = JSON.parse(r.content.toString("utf-8"));
  // Selena 设备 push 可能两种 shape:
  //   v1 (我 Ep38 import 用的): { attempts, mistakes, questions, ... } 直接
  //   v2 (client cloudSync dumpLocal 用的): { payload: { attempts, ... }, attemptsCount, totalXp, ... }
  // 兼容两种
  const isWrapped = raw.payload && typeof raw.payload === "object";
  const snap = isWrapped ? raw.payload : raw;
  const root = raw; // 写回时要保持原 shape
  const attempts = snap.attempts ?? [];
  const mistakes = snap.mistakes ?? [];
  const questions = snap.questions ?? [];
  console.log(`  shape: ${isWrapped ? "v2 wrapped {payload}" : "v1 flat"}`);

  // also merge snapshot.questions if present (现在没存，但兼容未来)
  for (const q of questions) {
    if (q?.question_id && !qPool.has(q.question_id)) qPool.set(q.question_id, q);
  }
  console.log(`  attempts: ${attempts.length}, mistakes: ${mistakes.length}, pool now: ${qPool.size}`);

  // Re-grade every isCorrect=false attempt
  let inspected = 0, wouldFlip = 0, missingQ = 0;
  const flipsByQ = new Map(); // qid → count of flips
  for (const a of attempts) {
    if (a.isCorrect) continue;
    inspected++;
    const q = qPool.get(a.questionId);
    if (!q) { missingQ++; continue; }
    const newResult = newGrade(q, a.answer);
    if (newResult === true) {
      wouldFlip++;
      flipsByQ.set(a.questionId, (flipsByQ.get(a.questionId) ?? 0) + 1);
    }
  }
  console.log(`\n=== analysis ===`);
  console.log(`  inspected (isCorrect=false attempts): ${inspected}`);
  console.log(`  would flip to true: ${wouldFlip}`);
  console.log(`  unique questions affected: ${flipsByQ.size}`);
  console.log(`  attempts where question missing from snapshot.questions: ${missingQ}`);

  // mistakes to resolve: questionId 在 flipsByQ 且 mistake.resolved=false
  const REVIEW_STAGES = 5;
  const mistakesToResolve = mistakes.filter((m) => flipsByQ.has(m.questionId) && !m.resolved);
  console.log(`  伪 mistake rows that should be resolved: ${mistakesToResolve.length}`);

  if (!APPLY) {
    console.log(`\n[dry-run] add --apply to write changes.`);
    // 显示前 5 个例子
    console.log(`\nexamples (first 5):`);
    let shown = 0;
    for (const a of attempts) {
      if (a.isCorrect || shown >= 5) continue;
      const q = qPool.get(a.questionId);
      if (!q) continue;
      if (newGrade(q, a.answer) === true) {
        console.log(`  ✓ ${a.questionId} ans=${JSON.stringify(a.answer)} → correct=${JSON.stringify(q.answer?.value)}`);
        shown++;
      }
    }
    return;
  }

  if (wouldFlip === 0 && mistakesToResolve.length === 0) {
    console.log("\n[apply] nothing to do.");
    return;
  }

  // Safety: copy current snapshot first
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const ts = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z-pre-resurrection`;
  const safetyKey = `_backups/${ts}/users/${USER_ID}/snapshot.json`;
  console.log(`\n[apply] safety backup → ${safetyKey}`);
  await oss.copy(safetyKey, SNAPSHOT_KEY);

  // Mutate snapshot
  let flipped = 0;
  for (const a of attempts) {
    if (a.isCorrect) continue;
    const q = qPool.get(a.questionId);
    if (!q) continue;
    if (newGrade(q, a.answer) === true) {
      a.isCorrect = true;
      // 清相关 error tags (grader 本来就该对 — 标的 "careless_reading" 之类是 noise)
      if (Array.isArray(a.errorTags)) {
        a.errorTags = a.errorTags.filter((t) => t !== "careless_reading" && t !== "decimal_point_error");
      }
      flipped++;
    }
  }
  let resolved = 0;
  for (const m of mistakes) {
    if (flipsByQ.has(m.questionId) && !m.resolved) {
      m.stage = REVIEW_STAGES;
      m.resolved = true;
      m.lastAttemptAt = m.lastAttemptAt ?? Date.now();
      resolved++;
    }
  }
  console.log(`  flipped ${flipped} attempts, resolved ${resolved} mistakes`);

  // Write back (preserve wrapper)
  const newBody = JSON.stringify(root);
  console.log(`  uploading ${(newBody.length / 1024 / 1024).toFixed(2)} MB...`);
  const wr = await oss.put(SNAPSHOT_KEY, Buffer.from(newBody), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
  console.log(`  ✓ uploaded. etag=${wr.res.headers.etag}`);

  console.log(`\n[done] safety: ${safetyKey}`);
  console.log(`Selena 设备下次 pull (Layout.tsx interval) 会 merge attempts.isCorrect=true 和`);
  console.log(`mistake.resolved=true 进 IDB. 错题列表立即少 ${resolved} 行.`);
})().catch((e) => {
  console.error("fatal:", e.message, e.stack);
  process.exit(1);
});
