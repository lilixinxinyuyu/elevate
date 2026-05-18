/**
 * v0.35.22 iter 51 (爸爸 explicit): 试卷 OCR client lib.
 *
 * Flow: file → base64 → POST ESA /api/super-admin/paper-ocr (拿 fcUrl)
 *   → POST fcUrl with { image_base64 } → 返结构化 papers 数组.
 *
 * vision call 11-25s, 跨 ESA 11s 限制走 FC bypass.
 * 0 BAILIAN — qwen3.6-plus / kimi-k2.6 via TOKEN_PLAN_CN 月订阅.
 */
import { getStoredPassword } from "../db/cloudSync";

export interface OcrMistake {
  stem: string;
  correctAnswer: string;
  studentAnswer: string;
  errorTag?: string;
  confidence?: number;
}

export interface OcrResult {
  ok: true;
  papers: OcrMistake[];
  model: string;
  elapsedMs: number;
}

export interface OcrError {
  ok: false;
  error: string;
  detail?: string;
}

/** 把 File 转 base64 字符串 (不带 data: 前缀) */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return reject(new Error("FileReader not string"));
      // data:image/png;base64,XXXXX → XXXXX
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("FileReader error"));
    reader.readAsDataURL(file);
  });
}

/**
 * Run paper OCR. file 或 already-encoded base64.
 */
export async function runPaperOcr(input: { file?: File; base64?: string }): Promise<OcrResult | OcrError> {
  const pwd = getStoredPassword();
  if (!pwd) return { ok: false, error: "no_password" };
  let imageBase64 = input.base64;
  if (!imageBase64 && input.file) {
    imageBase64 = await fileToBase64(input.file);
  }
  if (!imageBase64) return { ok: false, error: "no_image" };

  // Step 1: ESA → fcUrl
  let fcUrl: string | undefined;
  try {
    const r = await fetch("/api/super-admin/paper-ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${pwd}` },
      body: JSON.stringify({}),
    });
    if (!r.ok) {
      let j: { error?: string; reason?: string } | null = null;
      try { j = await r.json(); } catch {/**/}
      return { ok: false, error: j?.error ?? `esa_${r.status}`, detail: j?.reason };
    }
    const j = (await r.json()) as { ok: boolean; fcUrl?: string; error?: string };
    if (!j.ok || !j.fcUrl) return { ok: false, error: j.error ?? "no_fc_url" };
    fcUrl = j.fcUrl;
  } catch (e) {
    return { ok: false, error: "esa_network", detail: (e as Error).message };
  }

  // Step 2: client POST FC URL with base64
  try {
    const r = await fetch(fcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${pwd}` },
      body: JSON.stringify({ image_base64: imageBase64 }),
    });
    if (!r.ok) {
      let j: { error?: string; tried?: unknown } | null = null;
      try { j = await r.json(); } catch {/**/}
      return { ok: false, error: j?.error ?? `fc_${r.status}`, detail: JSON.stringify(j?.tried ?? "") };
    }
    const j = (await r.json()) as { ok: boolean; papers?: OcrMistake[]; model?: string; elapsedMs?: number; error?: string; rawContent?: string };
    if (!j.ok) return { ok: false, error: j.error ?? "fc_failed", detail: j.rawContent?.slice(0, 200) };
    return {
      ok: true,
      papers: Array.isArray(j.papers) ? j.papers : [],
      model: j.model ?? "unknown",
      elapsedMs: j.elapsedMs ?? 0,
    };
  } catch (e) {
    return { ok: false, error: "fc_network", detail: (e as Error).message };
  }
}
