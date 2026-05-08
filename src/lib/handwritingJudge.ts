/**
 * 调 /api/tutor/judge-handwriting 视觉判定手写汉字 (v0.31.42)
 */

import { getStoredPassword } from "../db/cloudSync";

export interface HandwritingJudgeResult {
  isCorrect: boolean;
  confidence: "high" | "medium" | "low";
  observed?: string;
  comment?: string;
  model?: string;
}

function authHeader(): Record<string, string> {
  const pwd = getStoredPassword();
  return pwd ? { Authorization: `Bearer ${pwd}` } : {};
}

export async function judgeHandwriting(args: {
  targetChar: string;
  pinyin?: string;
  imageBase64: string;
}): Promise<HandwritingJudgeResult> {
  const r = await fetch("/api/tutor/judge-handwriting", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader() },
    body: JSON.stringify({
      targetChar: args.targetChar,
      pinyin: args.pinyin,
      imageBase64: args.imageBase64,
    }),
  });
  type Body = {
    ok: boolean;
    isCorrect?: boolean;
    confidence?: "high"|"medium"|"low";
    observed?: string;
    comment?: string;
    model?: string;
    error?: string;
    detail?: string;
  };
  let body: Body | null = null;
  try {
    body = (await r.json()) as Body;
  } catch {
    /* */
  }
  if (!r.ok || !body?.ok) {
    throw new Error(`judge_failed: ${body?.error ?? r.status} ${body?.detail ?? ""}`.trim());
  }
  return {
    isCorrect: !!body.isCorrect,
    confidence: body.confidence ?? "medium",
    observed: body.observed,
    comment: body.comment,
    model: body.model,
  };
}
