/**
 * v0.35.15 iter 45 P3-1 (爸爸反馈 retrospective P2-3.2): Selena 端 paper mistakes 拉取.
 *
 * 爸爸 admin 端 (POST /api/super-admin/papers/save) 写到 OSS:
 *   `users/{cadetUid}/paper-mistakes/{paperId}.json`
 * 现在 cadet (Selena) 自己用她的 password 拉自己的 paper 错题:
 *   GET /api/paper-mistakes          → list all papers (OSS list-type=2)
 *   GET /api/paper-mistakes/:paperId → get single paper record
 *
 * userId scope: requireAuth resolve 出 cadet 自己的 userId, 只读
 * `users/{userId}/paper-mistakes/` 下的东西. 拉不到别人的.
 *
 * 不进 db.mistakes / mastery. Selena 端 src/lib/paperMistakesSync.ts
 * upsert 到独立的 db.paperMistakes 表 (v8 schema).
 */
import { Hono } from "hono";
import type { Env } from "../lib/env";
import { requireAuth, getUserId } from "../lib/auth";
import { getOssConfig, ossGet } from "../lib/oss";

const paperMistakes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
paperMistakes.use("*", requireAuth);

/**
 * GET /api/paper-mistakes
 * 返回当前 cadet 的所有 paper 列表 (OSS list, max 1000)
 *
 * Response: { ok, items: [{ paperId, lastModifiedMs, bytes }] }
 */
paperMistakes.get("/", async (c) => {
  const userId = getUserId(c);
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);
  const prefix = `users/${userId}/paper-mistakes/`;

  // 复用 sync.ts trophy-images list 同样的 OSS REST list 实现
  const date = new Date().toUTCString();
  const stringToSign = ["GET", "", "", date, `/${cfg.bucket}/`].join("\n");
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw", enc.encode(cfg.accessKeySecret),
    { name: "HMAC", hash: "SHA-1" }, false, ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(stringToSign));
  let bin = "";
  const bytes = new Uint8Array(sigBuf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  const sig = btoa(bin);
  const host = `${cfg.bucket}.${cfg.region}.aliyuncs.com`;
  const url = `https://${host}/?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=1000`;

  const items: Array<{ paperId: string; lastModifiedMs: number; bytes: number }> = [];
  try {
    const r = await fetch(url, {
      method: "GET",
      headers: { Host: host, Date: date, Authorization: `OSS ${cfg.accessKeyId}:${sig}` },
    });
    if (r.ok) {
      const xml = await r.text();
      for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
        const block = m[1] ?? "";
        const key = block.match(/<Key>([^<]+)<\/Key>/)?.[1] ?? "";
        const paperId = key.slice(prefix.length, -".json".length);
        if (!paperId) continue;
        const lm = block.match(/<LastModified>([^<]+)<\/LastModified>/)?.[1] ?? "";
        const sz = parseInt(block.match(/<Size>(\d+)<\/Size>/)?.[1] ?? "0", 10);
        items.push({ paperId, lastModifiedMs: Date.parse(lm) || 0, bytes: sz });
      }
    } else {
      return c.json({ ok: false, error: `oss_list_${r.status}` }, 502);
    }
  } catch (e) {
    return c.json({ ok: false, error: "list_failed: " + (e as Error).message }, 502);
  }

  return c.json({ ok: true, count: items.length, items });
});

/**
 * GET /api/paper-mistakes/:paperId
 * 返回单份 paper record 全文 (PaperRecord JSON, 见 src/core/paperMistakes.ts)
 */
paperMistakes.get("/:paperId", async (c) => {
  const userId = getUserId(c);
  const cfg = getOssConfig(c.env);
  if (!cfg) return c.json({ ok: false, error: "oss_not_configured" }, 503);
  const paperId = c.req.param("paperId");
  if (!paperId || !/^[\w-]+$/.test(paperId)) {
    return c.json({ ok: false, error: "invalid_paperId" }, 400);
  }
  const key = `users/${userId}/paper-mistakes/${paperId}.json`;
  const got = await ossGet(cfg, key);
  if (got.status === 404) {
    return c.json({ ok: false, error: "not_found" }, 404);
  }
  if (got.status >= 400) {
    return c.json({ ok: false, error: "oss_error", status: got.status }, 502);
  }
  if (!got.text) {
    return c.json({ ok: false, error: "empty_record" }, 502);
  }
  try {
    return c.json({ ok: true, record: JSON.parse(got.text) });
  } catch {
    return c.json({ ok: false, error: "corrupt_record" }, 500);
  }
});

export default paperMistakes;
