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

/**
 * POST /api/admin/report/:id/fix  — AI 修题（异步触发，~5-10s）
 *
 * v0.34.28 (Ep157): 接 Ep155 留的"AI 修题 future" 坑。
 * 调 TOKEN_PLAN_CN qwen3.6-flash + enable_thinking:false 修题。
 *
 * 流程：
 *   1. 读 report record
 *   2. 构 prompt (含 originalPayload + reason + userAnswer)
 *   3. 调 LLM 拿修后 JSON
 *   4. 更新 report record: fixedPayload, fixStatus="fixed", fixedAt, changesSummary
 *   5. 更新 reports index 对应 entry status
 *   6. 返回修后题
 *
 * 用户场景：Selena 报告坏题 → 自动入 OSS pending → super-admin 在 dashboard
 * 看到 → 点 🔧 修 → 5-10s 出修后题 → 选择写回 ai-questions 让客户端拉新。
 */
const REASON_HINT: Record<string, string> = {
  answer_wrong: "用户报告：答案不对",
  stem_unclear: "用户报告：题面看不懂 / 措辞不清",
  options_same: "用户报告：4 个选项看起来一样或区分度太低",
  options_no_correct: "用户报告：4 个选项里没有正确答案",
  math_error: "用户报告：数字 / 计算有错",
  other: "用户报告：其他问题",
};

const FIX_SYSTEM_PROMPT = `你是题库修复 AI。给你一道有问题的小学题 + 用户报告的具体问题。
你只输出修后的整道题 JSON，结构完全跟原题一样，只改有问题的字段。

## 修复原则

1. **保 enum 字段** 不变：subjectId / skill_id / grade / difficulty / game_type /
   question_format / cognitive_level / ability_dimension / exam_priority / status / version
2. **数学闭合**：换数字时必须算得通、答案合常识（实物 → 整数；钱 → 2 位小数等）
3. **题面纯净**：clue / option / hint / feedback 不写"（无关）/（误算）"等元注解
4. **distractor 区分度**：错误选项必须源自"学生具体误解"思路，不是随机数字
5. **保题型保结构**：选项数量 / subquestion 顺序 / 字段名都不动

## 输出协议

返回顶层 \`{ "question": {...}, "changesSummary": "一句话说改了啥" }\` JSON。
不要 markdown 代码块，不要解释文字。`;

admin.post("/report/:id/fix", async (c) => {
  const userId = getUserId(c);
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);

  const apiKey = c.env.TOKEN_PLAN_CN_API_KEY ?? c.env.BAILIAN_API_KEY;
  if (!apiKey) return c.json({ ok: false, error: "no_llm_api_key" }, 503);

  const id = c.req.param("id");
  const got = await ossGet(cfg, reportKey(userId, id));
  if (!got.ok || !got.text) {
    return c.json({ ok: false, error: got.error ?? "not_found" }, got.status === 404 ? 404 : 502);
  }
  let report: ReportRecord;
  try { report = JSON.parse(got.text); } catch { return c.json({ ok: false, error: "corrupt_report" }, 500); }

  if (report.fixStatus === "fixed" && report.fixedPayload) {
    return c.json({ ok: true, alreadyFixed: true, report });
  }

  // 构 prompt
  const reasonHint = REASON_HINT[report.reason] ?? `用户报告（${report.reason}）`;
  const reasonText = report.reasonText ? `\n用户额外补充：${report.reasonText}` : "";
  const userAnswerLine = report.userAnswer !== null && report.userAnswer !== undefined
    ? `\nSelena 这次选/答了：${JSON.stringify(report.userAnswer)}`
    : "";
  const userPrompt = `# 报告
${reasonHint}${reasonText}${userAnswerLine}

# 原题 JSON
\`\`\`json
${JSON.stringify(report.originalPayload, null, 2)}
\`\`\`

按 system 要求修这道题，输出 { "question": {...}, "changesSummary": "..." } JSON。`;

  const baseUrl = c.env.TOKEN_PLAN_CN_API_KEY
    ? "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"
    : "https://dashscope.aliyuncs.com/compatible-mode/v1";

  let fixedPayload: Record<string, unknown> | null = null;
  let changesSummary: string | null = null;
  let llmError: string | null = null;
  let llmModel = "qwen3.6-flash";
  const models = ["qwen3.6-flash", "qwen3.6-plus"];

  for (const m of models) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 9_500);
      const r = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: m,
          messages: [
            { role: "system", content: FIX_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.5,
          max_tokens: 2500,
          response_format: { type: "json_object" },
          enable_thinking: false,
        }),
        signal: ctrl.signal,
      });
      clearTimeout(to);
      const j = await r.json().catch(() => null) as { choices?: { message?: { content?: string } }[]; error?: { code?: string; message?: string } } | null;
      if (!r.ok || !j || j.error) {
        llmError = j?.error?.code ?? `http_${r.status}`;
        if (llmError === "InvalidApiKey" || llmError === "AccessDenied") break;
        continue;
      }
      const text = j.choices?.[0]?.message?.content?.trim();
      if (!text) { llmError = "empty_response"; continue; }
      let parsed: { question?: Record<string, unknown>; changesSummary?: string };
      try { parsed = JSON.parse(text); } catch { llmError = "parse_failed"; continue; }
      const q = parsed.question;
      if (!q || typeof q !== "object" || typeof q.stem !== "string") {
        llmError = "missing_question_field";
        continue;
      }
      // Force-merge enums from original
      const orig = report.originalPayload;
      fixedPayload = {
        ...q,
        question_id: orig.question_id,
        subjectId: orig.subjectId,
        skill_id: orig.skill_id,
        skill_name: orig.skill_name,
        unit_id: orig.unit_id,
        unit_name: orig.unit_name,
        term: orig.term,
        grade: orig.grade ?? 4,
        difficulty: orig.difficulty,
        game_type: orig.game_type,
        play_as: orig.play_as,
        question_format: orig.question_format,
        cognitive_level: orig.cognitive_level,
        ability_dimension: orig.ability_dimension,
        exam_priority: orig.exam_priority,
        status: "approved",
        version: (typeof orig.version === "number" ? orig.version : 1) + 1,
        tags: Array.from(new Set([
          ...((orig.tags as string[] | undefined) ?? []),
          "ai_fixed",
          `fixed_after:${report.reason}`,
        ])),
      };
      changesSummary = parsed.changesSummary ?? null;
      llmModel = m;
      llmError = null;
      break;
    } catch (e) {
      llmError = "fetch_failed: " + (e as Error).message.slice(0, 80);
    }
  }

  // 写回 report record
  const updated: ReportRecord = {
    ...report,
    fixedPayload,
    changesSummary,
    fixStatus: fixedPayload ? "fixed" : "failed",
    fixedAt: Date.now(),
    llmError,
  };
  await ossPut(cfg, reportKey(userId, id), JSON.stringify(updated, null, 2), {
    contentType: "application/json; charset=utf-8",
  });

  // 更新 index entry status
  try {
    const idxGet = await ossGet(cfg, reportsIndexKey(userId));
    if (idxGet.ok && idxGet.text) {
      const index = JSON.parse(idxGet.text) as ReportsIndex;
      const entry = (index.entries ?? []).find((e) => e.id === id);
      if (entry) {
        entry.fixStatus = updated.fixStatus;
        index.updatedAt = Date.now();
        await ossPut(cfg, reportsIndexKey(userId), JSON.stringify(index, null, 2), {
          contentType: "application/json; charset=utf-8",
        });
      }
    }
  } catch (e) {
    console.warn("[admin/fix] index update failed:", (e as Error).message);
  }

  if (!fixedPayload) {
    return c.json({ ok: false, error: "fix_failed", llmError, report: updated }, 502);
  }
  return c.json({ ok: true, fixStatus: "fixed", model: llmModel, changesSummary, fixedPayload, report: updated });
});

export default admin;
