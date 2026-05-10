/**
 * v0.31.65: AI 生成的题独立同步端点（仿 trophy-images）。
 *
 * 背景：v0.31.52 把 aiQuestions 加进主 sync payload。问题：每次 push 都附带
 * **完整 aiQuestions 数组**。526 道 ≈ 1.3 MB + 其他数据 = 主 snapshot 接近
 * D1 单参数 ~2 MB 上限 → 上传 500。
 *
 * 解法：每道 AI 题存一行 ai_questions 表（每行 ~2-3 KB），跟主 sync 解耦。
 * cloudSync 客户端从两端拉合并。
 *
 * Schema:
 *   CREATE TABLE ai_questions (
 *     user_key TEXT NOT NULL,
 *     question_id TEXT NOT NULL,
 *     payload TEXT NOT NULL,  -- 完整 Question JSON
 *     updated_at INTEGER NOT NULL,
 *     PRIMARY KEY (user_key, question_id)
 *   )
 *
 * Endpoints:
 *   POST /api/sync/ai-questions
 *     Body: { rows: [Question, ...] }   // 单批最多 50
 *     → upsert each by question_id
 *   GET /api/sync/ai-questions[?since=<ms>]
 *     → 返回 { rows: [Question, ...] }
 *   POST /api/sync/ai-questions/delete
 *     Body: { ids: ["AI_xxx", ...] }
 *     → 用于 admin 删 AI 题（写到 deleted 列表，跨设备同步删除）
 */

import { checkAuth, corsHeaders, jsonResponse, USER_KEY, type Env } from "../../_shared";

async function ensureSchema(db: D1Database) {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS ai_questions (
      user_key TEXT NOT NULL,
      question_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_key, question_id)
    )`.replace(/\s+/g, " ").trim(),
  );
  await db.exec(
    `CREATE INDEX IF NOT EXISTS idx_ai_questions_updated ON ai_questions (user_key, updated_at)`,
  );
}

const MAX_BATCH = 50;
const MAX_ROW_BYTES = 30 * 1024; // 30 KB per question row（充分大，正常题 2-3KB）

interface UploadRow {
  question_id?: string;
  [k: string]: unknown;
}

/**
 * v0.31.80：服务端 sanitize — 任何写入 D1 的题在落盘前都过这函数，
 * 把 P1 leak 模式自动 strip。这是终极防线 —— 即使 Selena 的 stale PWA 把
 * 旧 (无关) 数据 push 回来，server 也会自动剥掉，永远不会污染 D1。
 *
 * 处理：
 *   1. clue_pick 的 clues[] 字符串去掉"（无关）/（非已知）/（解题设定）/（错误干扰）/（干扰）/（混淆）/（提示）"
 *   2. choose 的 options[].errorTag 移到顶层 _internal_option_diagnostics（不在 student-visible）
 *   3. 顶层 options[].errorTag 同上
 *
 * 不动的：stem / answer / 其他字段 — 那些需要 AI 修题，机械 strip 只清显式标注。
 */
const META_PATTERNS = [
  "（解题设定，非已知）",
  "（解题设定）",
  "(解题设定)",
  "（非已知）",
  "(非已知)",
  "（无关条件）",
  "（无关）",
  "(无关)",
  "（错误干扰）",
  "（干扰）",
  "（混淆）",
  "（提示）",
];

function stripMetaAnnotations(text: string): string {
  let cleaned = text;
  for (const p of META_PATTERNS) cleaned = cleaned.split(p).join("");
  // 删除 annotation 后残留的尾部标点 + trim
  return cleaned.replace(/[，,。、:：]\s*$/g, "").trim();
}

function sanitizeRow(row: UploadRow): UploadRow {
  // 深 clone（避免改外部对象）
  const cloned = JSON.parse(JSON.stringify(row)) as UploadRow;
  const internalDiagnostics: Array<{ id: string; errorTag: string }> = [];

  // subquestions 处理
  const subqs = cloned.subquestions as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(subqs)) {
    for (const sub of subqs) {
      // clue_pick：strip（无关）等元注解
      if (sub.kind === "clue_pick" && Array.isArray(sub.clues)) {
        sub.clues = (sub.clues as unknown[]).map((c) =>
          typeof c === "string" ? stripMetaAnnotations(c) : c,
        );
        // 过滤完全空的 clue（注解删掉后只剩空字符串的）— 同步调整 correct 索引
        const oldClues = sub.clues as string[];
        const keepIdx = oldClues
          .map((c, i) => (c && typeof c === "string" && c.length > 0 ? i : -1))
          .filter((i) => i >= 0);
        if (keepIdx.length < oldClues.length) {
          sub.clues = keepIdx.map((i) => oldClues[i]);
          if (Array.isArray(sub.correct)) {
            const idxMap = new Map<number, number>();
            keepIdx.forEach((oldI, newI) => idxMap.set(oldI, newI));
            sub.correct = (sub.correct as number[])
              .map((oldI) => idxMap.get(oldI))
              .filter((x): x is number => typeof x === "number");
          }
        }
      }
      // choose options：errorTag 移到 internal
      if (sub.kind === "choose" && Array.isArray(sub.options)) {
        for (const opt of sub.options as Array<Record<string, unknown>>) {
          if (opt && typeof opt === "object" && "errorTag" in opt) {
            internalDiagnostics.push({
              id: String(opt.id),
              errorTag: String(opt.errorTag),
            });
            delete opt.errorTag;
          }
        }
      }
    }
  }

  // 顶层 options（plain_choice 等）的 errorTag 也移
  const topOpts = cloned.options as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(topOpts)) {
    for (const opt of topOpts) {
      if (opt && typeof opt === "object" && "errorTag" in opt) {
        internalDiagnostics.push({
          id: String(opt.id),
          errorTag: String(opt.errorTag),
        });
        delete opt.errorTag;
      }
    }
  }

  if (internalDiagnostics.length > 0) {
    const existing =
      (cloned._internal_option_diagnostics as Array<{ id: string; errorTag: string }> | undefined) ??
      [];
    cloned._internal_option_diagnostics = [...existing, ...internalDiagnostics];
  }

  return cloned;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;
  await ensureSchema(env.DB);

  let body: { rows?: UploadRow[] };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return jsonResponse({ ok: false, error: "missing_rows" }, 400);
  }
  if (body.rows.length > MAX_BATCH) {
    return jsonResponse(
      { ok: false, error: `batch_too_large: max ${MAX_BATCH}, got ${body.rows.length}` },
      400,
    );
  }

  const now = Date.now();
  const accepted: string[] = [];
  const rejected: { question_id: string; reason: string }[] = [];

  for (const rawRow of body.rows) {
    const qid = typeof rawRow.question_id === "string" ? rawRow.question_id : "";
    if (!qid) {
      rejected.push({ question_id: String(rawRow.question_id), reason: "missing_question_id" });
      continue;
    }
    // v0.31.80：服务端 sanitize — strip leak 模式（无关 / errorTag 等）
    const row = sanitizeRow(rawRow);
    const payloadJson = JSON.stringify(row);
    if (payloadJson.length > MAX_ROW_BYTES) {
      rejected.push({
        question_id: qid,
        reason: `row_too_big_${payloadJson.length}B (max ${MAX_ROW_BYTES})`,
      });
      continue;
    }
    try {
      await env.DB
        .prepare(
          `INSERT INTO ai_questions (user_key, question_id, payload, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(user_key, question_id) DO UPDATE SET
             payload = excluded.payload,
             updated_at = excluded.updated_at`,
        )
        .bind(USER_KEY, qid, payloadJson, now)
        .run();
      accepted.push(qid);
    } catch (e) {
      rejected.push({ question_id: qid, reason: `db_error: ${(e as Error).message}` });
    }
  }

  return jsonResponse({ ok: true, accepted: accepted.length, rejected, version: now });
};

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;
  await ensureSchema(env.DB);

  const url = new URL(request.url);
  const since = Number(url.searchParams.get("since") ?? 0);

  const result = await env.DB
    .prepare(
      `SELECT question_id, payload, updated_at FROM ai_questions
       WHERE user_key = ? AND updated_at > ?
       ORDER BY question_id`,
    )
    .bind(USER_KEY, since)
    .all<{ question_id: string; payload: string; updated_at: number }>();

  const rows = (result.results ?? [])
    .map((r) => {
      try {
        return JSON.parse(r.payload);
      } catch {
        return null;
      }
    })
    .filter((r): r is Record<string, unknown> => r !== null);

  return jsonResponse({ ok: true, rows, latestVersion: Date.now() });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
