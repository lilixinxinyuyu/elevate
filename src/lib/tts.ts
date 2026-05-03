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
    // Error.message 包含 detail，admin UI 直接显示 e.message 就有完整上下文
    const suffix = detail ? `: ${detail.slice(0, 200)}` : "";
    super(`tts_${code}_${status}${suffix}`);
  }
}

/**
 * 拿到一段文本对应的 audio blob。失败抛 TtsError。
 *
 * 服务端如果 502 返回 JSON {error,detail}，detail 会进 TtsError.detail 给 admin
 * 看真实的 DashScope upstream 错误。
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
    type ErrShape = { error?: string; detail?: string };
    let parsed: ErrShape | null = null;
    try {
      parsed = (await r.json()) as ErrShape;
    } catch { /* 上游可能不是 JSON */ }
    throw new TtsError(
      parsed?.error ?? "request_failed",
      r.status,
      parsed?.detail,
    );
  }
  // 兜底：如果 200 返回 JSON 而不是音频，也当错处理（理论上服务端已经拦了，这里二次防御）
  const ctype = r.headers.get("content-type") ?? "";
  if (ctype.includes("application/json")) {
    const body = await r.text();
    throw new TtsError("got_json_not_audio", 200, body.slice(0, 300));
  }
  return await r.blob();
}

/**
 * 朗读文本。返回 HTMLAudioElement，调用方可以 .pause() 提前停。
 *
 * 失败兜底：如果 /api/tts 服务端 502（"no_model_worked" 等），不抛错而是用浏览器
 * speechSynthesis 朗读（中文 zh-CN voice）。这样 Selena 即使 Qwen/CosyVoice/Sambert
 * 全挂也至少有声音听写。
 *
 * 浏览器 TTS 没有"返回 HTMLAudioElement"的概念，我们包成一个 fake AudioElement
 * 子集，让调用方的 onEnded 等仍能工作。
 */
export async function speakText(
  text: string,
  opts: TtsOptions = {},
): Promise<HTMLAudioElement> {
  const key = cacheKey(text, opts);
  let url = audioCache.get(key);
  if (!url) {
    try {
      const blob = await generateTtsBlob(text, opts);
      url = URL.createObjectURL(blob);
      audioCache.set(key, url);
    } catch (e) {
      // 兜底：浏览器 speechSynthesis
      console.warn("[tts] server failed, falling back to browser speechSynthesis", e);
      return speakWithBrowser(text);
    }
  }
  const audio = new Audio(url);
  await audio.play();
  return audio;
}

/**
 * 浏览器 speechSynthesis 兜底。
 * 优先选 zh-CN 女声，没有就 zh-TW，再没有就默认 voice。
 * 包成 HTMLAudioElement-like 对象，让调用方的 .addEventListener("ended", ...) 可用。
 */
function speakWithBrowser(text: string): HTMLAudioElement {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    throw new TtsError("no_browser_tts", 0, "speechSynthesis 不可用");
  }
  const synth = window.speechSynthesis;
  const utt = new SpeechSynthesisUtterance(text);
  const voices = synth.getVoices();
  const pick =
    voices.find((v) => v.lang === "zh-CN" && /female|woman|child/i.test(v.name)) ??
    voices.find((v) => v.lang === "zh-CN") ??
    voices.find((v) => v.lang.startsWith("zh")) ??
    null;
  if (pick) utt.voice = pick;
  utt.lang = "zh-CN";
  utt.rate = 0.95;
  utt.pitch = 1.05;

  // 包装成 HTMLAudioElement-like
  const listeners: Record<string, ((e: Event) => void)[]> = { ended: [], error: [] };
  utt.addEventListener("end", () => {
    for (const fn of listeners.ended ?? []) fn(new Event("ended"));
  });
  utt.addEventListener("error", () => {
    for (const fn of listeners.error ?? []) fn(new Event("error"));
  });

  const fakeAudio = {
    pause: () => synth.cancel(),
    addEventListener: (type: string, fn: (e: Event) => void) => {
      (listeners[type] ??= []).push(fn);
    },
    removeEventListener: () => {},
    play: async () => synth.speak(utt),
  } as unknown as HTMLAudioElement;

  synth.cancel(); // 取消正在朗读的，确保新一段能播
  synth.speak(utt);
  return fakeAudio;
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
