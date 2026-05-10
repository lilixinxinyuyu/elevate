/**
 * Agent 出题接口（v0.31.86 起仅保留 GET）。
 *
 * 历史：早期 Hermes 通过 POST 把新题打到 agent_questions 表 → seed 启动时 GET 合并。
 * 现状（v0.31.65 起）：AI 题走 /api/generate/questions → /api/sync/ai-questions D1 表。
 * agent_questions 表只剩 seed.ts:509 的 GET 调用（拉早期老 agent 题，没有就空）。
 *
 * POST/DELETE 在 v0.31.86 移除（Pages Function 文件保留以维持 GET 路由）。
 */

import { corsHeaders, ensureSchema, jsonResponse, type Env } from "../../_shared";

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

// v0.31.86: POST / DELETE 已废 — 早期 Hermes 入库路径，现在所有 AI 题走
// /api/sync/ai-questions D1 表。两个 endpoint 返回 410 Gone 而非 404，
// 提示调用方迁移到新路径。
export const onRequestPost: PagesFunction<Env> = async () =>
  jsonResponse({ ok: false, error: "deprecated", detail: "use /api/sync/ai-questions" }, 410);

export const onRequestDelete: PagesFunction<Env> = async () =>
  jsonResponse(
    { ok: false, error: "deprecated", detail: "delete via admin tooling, not this endpoint" },
    410,
  );

export const onRequestOptions: PagesFunction<Env> = async () =>
  new Response(null, { status: 204, headers: corsHeaders });
