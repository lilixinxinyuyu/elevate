/**
 * v0.35.23 iter 52: FC 调用监控 client-side fire-and-forget logger.
 *
 * 任何 FC bypass call (image gen / paper OCR) 完成后调一下 logFcCall(...).
 * ESA append OSS `_logs/fc-calls/{date}/{ts}-{kind}-{uid}.json`.
 * SuperAdmin 监控面板拉这些聚合显示.
 *
 * Fire-and-forget: 不 await, 失败也不 throw. log 失败 ≠ user-facing 失败.
 */
import { getStoredPassword } from "../db/cloudSync";

export type FcCallKind = "image_gen" | "paper_ocr";

export interface FcCallStat {
  kind: FcCallKind;
  success: boolean;
  elapsedMs: number;
  model?: string;
  error?: string;
  /** Optional client context — e.g., trigger source (mascot/trophy/admin-ocr) */
  source?: string;
}

export function logFcCall(stat: FcCallStat): void {
  const pwd = getStoredPassword();
  if (!pwd) return;
  // Fire and forget — don't await, swallow errors
  void fetch("/api/super-admin/log-fc-call", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${pwd}` },
    body: JSON.stringify({ ...stat, ts: Date.now() }),
  }).catch(() => {
    /* don't propagate log errors */
  });
}
