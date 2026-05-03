/**
 * Agent 出题接口：把 Hermes 生成的新题入库到 D1，再通过 GET 拉给 Web App。
 *
 * POST /api/agent/questions
 *   Body: { questions: Question[], source?: string }
 *   每道题走 ZodSchema 校验（前端通过统一的 schema.ts），失败的不入库返回错误清单。
 *
 * GET /api/agent/questions
 *   返回所有 agent 入库的题（Web App 启动时拉一次和 SEED 合并）。
 */

import { checkAuth, corsHeaders, ensureSchema, jsonResponse, type Env } from "../../_shared";

async function ensureAgentSchema(db: D1Database) {
  await db.exec(
    `CREATE TABLE IF NOT EXISTS agent_questions (
      question_id TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      source TEXT,
      skill_id TEXT,
      unit_id TEXT,
      difficulty INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`.replace(/\s+/g, " ").trim(),
  );
  await db.exec(`CREATE INDEX IF NOT EXISTS idx_aq_skill ON agent_questions (skill_id)`);
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  // GET 不要求 auth：题库内容本身不敏感（同 /agent/questions.json）
  await ensureSchema(env.DB);
  await ensureAgentSchema(env.DB);
  const result = await env.DB
    .prepare(
      `SELECT payload, source, created_at FROM agent_questions ORDER BY created_at DESC`,
    )
    .all<{ payload: string; source: string | null; created_at: number }>();
  const rows = result.results ?? [];
  const questions = rows
    .map((r) => {
      try {
        const q = JSON.parse(r.payload);
        return { ...q, _agent_source: r.source, _added_at: r.created_at };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  return jsonResponse({ ok: true, questions, count: questions.length });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;
  await ensureSchema(env.DB);
  await ensureAgentSchema(env.DB);

  let body: { questions?: unknown[]; source?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body.questions || !Array.isArray(body.questions) || body.questions.length === 0) {
    return jsonResponse({ ok: false, error: "missing_questions_array" }, 400);
  }
  const source = body.source ?? "agent";
  const now = Date.now();

  const accepted: string[] = [];
  const rejected: { question_id?: string; issues: string[] }[] = [];

  for (const raw of body.questions) {
    // 服务端做最低限度校验（避免重新 import zod schema 把 bundle 弄大；
    // 这里只校验最关键的字段在 + 唯一 ID，不重复 client 端的 zod 全量校验）
    const q = raw as Record<string, unknown>;
    const issues: string[] = [];
    if (typeof q?.question_id !== "string" || (q.question_id as string).length < 3) {
      issues.push("question_id 缺失或太短");
    }
    if (typeof q?.stem !== "string" || (q.stem as string).length < 3) {
      issues.push("stem 缺失");
    }
    if (typeof q?.skill_id !== "string") issues.push("skill_id 缺失");
    if (typeof q?.unit_id !== "string") issues.push("unit_id 缺失");
    if (![1, 2, 3, 4, 5].includes(q?.difficulty as number)) issues.push("difficulty 必须 1-5");
    const fmt = q?.question_format as string;
    if (!["numeric", "single_choice", "multi_choice", "multi_step", "fill_blank", "drag_drop", "sort_ladder", "geometry_operation", "numeric_choice"].includes(fmt)) {
      issues.push(`question_format 非法: ${fmt}`);
    }
    if (!q?.answer || typeof q.answer !== "object") {
      issues.push("answer 缺失");
    }
    if (!Array.isArray(q?.solution_steps)) issues.push("solution_steps 必须数组");
    if (!Array.isArray(q?.common_errors)) issues.push("common_errors 必须数组");

    if (issues.length > 0) {
      rejected.push({ question_id: typeof q?.question_id === "string" ? (q.question_id as string) : undefined, issues });
      continue;
    }

    // 准备入库
    const payload = JSON.stringify(q);
    try {
      await env.DB
        .prepare(
          `INSERT INTO agent_questions (question_id, payload, source, skill_id, unit_id, difficulty, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(question_id) DO UPDATE SET payload=excluded.payload, source=excluded.source, updated_at=excluded.updated_at`,
        )
        .bind(
          q.question_id as string,
          payload,
          source,
          q.skill_id as string,
          q.unit_id as string,
          q.difficulty as number,
          now,
          now,
        )
        .run();
      accepted.push(q.question_id as string);
    } catch (e) {
      rejected.push({
        question_id: q.question_id as string,
        issues: [`db_error: ${(e as Error).message}`],
      });
    }
  }

  return jsonResponse({
    ok: true,
    accepted: accepted.length,
    rejected: rejected.length,
    accepted_ids: accepted,
    failures: rejected,
  });
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  const fail = checkAuth(request, env);
  if (fail) return fail;
  await ensureAgentSchema(env.DB);
  const url = new URL(request.url);
  const qid = url.searchParams.get("question_id");
  if (!qid) return jsonResponse({ ok: false, error: "question_id query param required" }, 400);
  await env.DB.prepare(`DELETE FROM agent_questions WHERE question_id = ?`).bind(qid).run();
  return jsonResponse({ ok: true, deleted: qid });
};

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
