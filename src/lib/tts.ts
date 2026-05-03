/**
 * TTS 客户端：调 /api/tts/generate 拿 mp3 blob，播放并内存缓存。
 *
 * 多学科 Phase 1：管道铺好但默认不接 UI（除了 /math/admin 的 smoke 按钮）。
 * Phase 2 chinese 听写题、拼音卡、古诗朗读直接调 speakText()。
 *
 * 缓存策略：
 *  - 浏览器内存里 Map<key, ObjectURL>，key = `voice|speed|text`
 *  - 同一会话内重复同一文本不重新请求
 *  - 切页 / 重启不复用（不存 IndexedDB；单题文本短，重新生成成本不高）
 */

import { getStoredPassword } from "../db/cloudSync";

export interface TtsOptions {
  /** DashScope voice id；默认 longxiaochun（童声） */
  voice?: string;
  /** 0.5 ~ 2.0，默认 1.0 */
  speed?: number;
  /** "mp3" | "wav"，默认 mp3 */
  format?: "mp3" | "wav";
}

const audioCache = new Map<string, string>(); // key → blob ObjectURL

function cacheKey(text: string, opts: TtsOptions): string {
  return `${opts.voice ?? ""}|${opts.speed ?? 1}|${opts.format ?? "mp3"}|${text}`;
}

function authHeader(): Record<string, string> {
  const pwd = getStoredPassword();
  return pwd ? { Authorization: `Bearer ${pwd}` } : {};
}

export class TtsError extends Error {
  constructor(public code: string, public status: number, public detail?: string) {
    super(`tts_${code}_${status}`);
  }
}

/**
 * 拿到一段文本对应的 audio blob。失败抛 TtsError。
 */
export async function generateTtsBlob(
  text: string,
  opts: TtsOptions = {},
): Promise<Blob> {
  const r = await fetch("/api/tts/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
    },
    body: JSON.stringify({ text, ...opts }),
  });
  if (!r.ok) {
    let detail: string | undefined;
    try {
      const j = (await r.json()) as { error?: string; detail?: string };
      detail = j.detail ?? j.error;
      throw new TtsError(j.error ?? "request_failed", r.status, detail);
    } catch (e) {
      if (e instanceof TtsError) throw e;
      throw new TtsError("request_failed", r.status);
    }
  }
  return await r.blob();
}

/**
 * 朗读文本。返回 HTMLAudioElement，调用方可以 .pause() 提前停。
 */
export async function speakText(
  text: string,
  opts: TtsOptions = {},
): Promise<HTMLAudioElement> {
  const key = cacheKey(text, opts);
  let url = audioCache.get(key);
  if (!url) {
    const blob = await generateTtsBlob(text, opts);
    url = URL.createObjectURL(blob);
    audioCache.set(key, url);
  }
  const audio = new Audio(url);
  await audio.play();
  return audio;
}

/**
 * Smoke：服务端是否配置好了 DASHSCOPE_API_KEY。
 * /math/admin 的 TTS 测试卡片用来显示"未配置"灰按钮。
 */
export async function isTtsAvailable(): Promise<{
  ok: boolean;
  configured: boolean;
  reason?: string;
}> {
  try {
    const r = await fetch("/api/tts/generate", {
      method: "GET",
      headers: { ...authHeader() },
    });
    if (r.status === 401) return { ok: false, configured: false, reason: "unauthorized" };
    if (!r.ok) return { ok: false, configured: false, reason: `http_${r.status}` };
    const j = (await r.json()) as { configured?: boolean };
    return { ok: true, configured: !!j.configured };
  } catch (e) {
    return {
      ok: false,
      configured: false,
      reason: e instanceof Error ? e.message : String(e),
    };
  }
}
