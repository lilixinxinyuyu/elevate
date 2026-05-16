/**
 * /api/admin/* —— 管理接口（报题 / 看举报列表）
 *
 * v0.34.26 (Ep155): 移植 report-question + list-reports 到 OSS 存储。
 *
 * 简化版：不在请求里做 AI 修题（老版本调 LLM 25s 容易超 ESA 11s 限制）。
 * 报题立即落 OSS。后续可加单独 fix-report endpoint 异步修。
 *
 * OSS 路径：
 *   users/{userId}/reports/{reportId}.json   — 单条
 *   users/{userId}/reports/index.json        — 索引 [{id, qid, reason, ts}]
 *
 * 客户端 UX：之前点"🐛 报告"会即时拿到 AI 修后的题，现在改为先确认收到。
 * 修题流程移到 super-admin 后台 batch 处理。
 */

import { Hono } from "hono";
import type { Env } from "../lib/env";
import { requireAuth, getUserId } from "../lib/auth";
import { getOssConfig, ossGet, ossPut } from "../lib/oss";

const admin = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

admin.use("*", requireAuth);

interface ReportBody {
  question?: Record<string, unknown>;
  reason?: string;
  reasonText?: string;
  userAnswer?: unknown;
}

interface ReportRecord {
  id: string;
  questionId: string;
  reason: string;
  reasonText: string | null;
  userId: string;
  originalPayload: Record<string, unknown>;
  userAnswer: unknown;
  createdAt: number;
  // 后续 fix-report 流程会回填：
  fixedPayload: Record<string, unknown> | null;
  changesSummary: string | null;
  fixStatus: "pending" | "fixed" | "failed" | null;
  fixedAt: number | null;
  llmError: string | null;
}

interface ReportsIndex {
  schemaVersion: 1;
  updatedAt: number;
  entries: Array<{
    id: string;
    questionId: string;
    reason: string;
    fixStatus: ReportRecord["fixStatus"];
    createdAt: number;
  }>;
}

function reportKey(userId: string, reportId: string): string {
  return `users/${userId}/reports/${reportId}.json`;
}

function reportsIndexKey(userId: string): string {
  return `users/${userId}/reports/index.json`;
}

function randomId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i]!.toString(16).padStart(2, "0");
  }
  return s + "-" + Date.now().toString(36);
}

/**
 * POST /api/admin/report-question
 *
 * Body: { question, reason, reasonText?, userAnswer? }
 * 立即落 OSS，不调 LLM。返 {ok, reportId}。
 */
admin.post("/report-question", async (c) => {
  const userId = getUserId(c);
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);

  let body: ReportBody;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ ok: false, error: "invalid_json" }, 400);
  }
  const q = body.question;
  if (!q || typeof q !== "object" || typeof q.question_id !== "string") {
    return c.json({ ok: false, error: "missing_question" }, 400);
  }
  const reason = (body.reason ?? "other").slice(0, 32);
  const reasonText = body.reasonText ? body.reasonText.slice(0, 500) : null;

  const id = randomId();
  const record: ReportRecord = {
    id,
    questionId: q.question_id as string,
    reason,
    reasonText,
    userId,
    originalPayload: q,
    userAnswer: body.userAnswer ?? null,
    createdAt: Date.now(),
    fixedPayload: null,
    changesSummary: null,
    fixStatus: "pending",
    fixedAt: null,
    llmError: null,
  };

  // 写单条 report
  const put = await ossPut(cfg, reportKey(userId, id), JSON.stringify(record, null, 2), {
    contentType: "application/json; charset=utf-8",
  });
  if (!put.ok) {
    return c.json({ ok: false, error: "store_failed", detail: put.error }, 502);
  }

  // 更新索引（read-merge-write，best-effort）
  try {
    let index: ReportsIndex = { schemaVersion: 1, updatedAt: Date.now(), entries: [] };
    const idxGet = await ossGet(cfg, reportsIndexKey(userId));
    if (idxGet.ok && idxGet.text) {
      try { index = JSON.parse(idxGet.text); } catch { /* */ }
    }
    index.entries.unshift({
      id, questionId: record.questionId, reason, fixStatus: "pending", createdAt: record.createdAt,
    });
    // 截到最近 200 条
    if (index.entries.length > 200) index.entries = index.entries.slice(0, 200);
    index.updatedAt = Date.now();
    await ossPut(cfg, reportsIndexKey(userId), JSON.stringify(index, null, 2), {
      contentType: "application/json; charset=utf-8",
    });
  } catch (e) {
    console.warn("[admin/report-question] index update failed:", (e as Error).message);
  }

  return c.json({
    ok: true,
    reportId: id,
    questionId: record.questionId,
    fixStatus: "pending",
    note: "已记录。AI 修题改为后台异步处理（super-admin 可在 reports 列表查/触发）",
  });
});

/**
 * GET /api/admin/list-reports[?limit=50&onlyFailed=1&since=<ms>]
 *
 * 列当前 userId 的报告。super-admin 可后续加 ?userId 参数看别人的。
 */
admin.get("/list-reports", async (c) => {
  const userId = getUserId(c);
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);

  const limit = Math.min(200, Math.max(1, Number(c.req.query("limit") ?? 50)));
  const onlyFailed = c.req.query("onlyFailed") === "1";
  const since = Number(c.req.query("since") ?? 0);

  const idxGet = await ossGet(cfg, reportsIndexKey(userId));
  if (!idxGet.ok || !idxGet.text) {
    return c.json({ ok: true, count: 0, reports: [], note: "no reports yet" });
  }
  let index: ReportsIndex;
  try {
    index = JSON.parse(idxGet.text);
  } catch {
    return c.json({ ok: false, error: "corrupt_index" }, 500);
  }

  let entries = index.entries ?? [];
  if (onlyFailed) entries = entries.filter((e) => e.fixStatus === "failed");
  if (since > 0) entries = entries.filter((e) => e.createdAt > since);
  entries = entries.slice(0, limit);

  return c.json({
    ok: true,
    count: entries.length,
    indexUpdatedAt: index.updatedAt,
    reports: entries,
  });
});

/**
 * GET /api/admin/report/:id  — 拉单条报告详情（含 originalPayload）
 */
admin.get("/report/:id", async (c) => {
  const userId = getUserId(c);
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);
  const id = c.req.param("id");
  const got = await ossGet(cfg, reportKey(userId, id));
  if (!got.ok || !got.text) {
    return c.json({ ok: false, error: got.error ?? "not_found", status: got.status }, got.status === 404 ? 404 : 502);
  }
  try {
    return c.json({ ok: true, report: JSON.parse(got.text) });
  } catch {
    return c.json({ ok: false, error: "corrupt_report" }, 500);
  }
});

export default admin;
