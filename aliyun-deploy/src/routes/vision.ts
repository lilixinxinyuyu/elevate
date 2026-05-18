/**
 * v0.35.27 (爸爸第 3 次反馈): vision endpoints for cadet (Selena 等).
 *
 * Background: super-admin/paper-ocr 限 admin.xiaojin.app host, 但 Selena
 * 答 canvas_scratch 题时也需要 vision judge. 这里 expose cadet-facing alias
 * 返同样的 FC URL (FC 自己 auth password). 任意 logged-in cadet/admin 都能用.
 *
 * 不暴露 admin-only 数据 — 只返 FC URL + provider info, FC 调用 cadet 自己拿
 * password header 鉴权.
 */
import { Hono } from "hono";
import type { Env } from "../lib/env";
import { requireAuth } from "../lib/auth";

const vision = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
vision.use("*", requireAuth);

/**
 * POST /api/vision/fc-url
 * Return the FC paper-ocr URL for client-side vision call.
 * Same fc-bypass pattern as super-admin/paper-ocr but cadet-callable.
 */
vision.post("/fc-url", async (c) => {
  const env = c.env as { FC_PAPER_OCR_URL?: string };
  const fcUrl = env.FC_PAPER_OCR_URL;
  if (!fcUrl) {
    return c.json({
      ok: false,
      error: "fc_paper_ocr_not_configured",
      reason: "FC_PAPER_OCR_URL 未 baked.",
    }, 503);
  }
  return c.json({
    ok: true,
    fcUrl,
    provider: "fc-bypass",
    modes: ["extract_mistakes", "ocr_raw", "canvas_judge"],
    note: "client POST fcUrl with { image_base64, mode, ...modeSpecificFields }, same Authorization. ~11-25s.",
  });
});

export default vision;
