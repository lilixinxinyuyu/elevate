/**
 * AI 生成勋章图的获取 + 持久化。
 *
 * 设计：
 *  - 调 /api/generate/image → 拿到 dashscope OSS URL
 *  - URL 24h 过期 → 立刻 fetch 下载成 base64 data URL，存进 db.trophyImages
 *  - 后续 trophy wall 都从 db 读 base64 直接渲染，没有时回到 emoji 兜底
 *
 * "盲盒"：rare trophy 解锁时调 generateTrophyImage(trophyId, prompt, {force: true})
 *  → 不管缓存是否存在都重新生成 → 写入 db isLottery=true
 *
 * 批量：generateAllMissing() 给 admin 用 — 跑过所有 trophy，已有的跳过
 */

import { useEffect, useState } from "react";
import { db } from "../db/dexie";
import { generateImage } from "./tutor";
import type { TrophyImageRow } from "../db/dexie";

/** trophy 元数据（math + chinese 都能用） */
export interface TrophyMeta {
  id: string;
  subjectId: "math" | "chinese";
  name: string;
  /** 默认 emoji icon */
  icon: string;
  description?: string;
  /** 是否是 rare（单次成就），rare 才走盲盒抽奖 */
  rare?: boolean;
}

/**
 * 给 trophy 拼出生成 prompt：
 *  - 通用模板 + trophy.name + 风格要求（卡通可爱 / 4 年级女生）
 *  - 不同 subject 用不同主色：math 紫粉，chinese 金红
 */
export function buildTrophyPrompt(t: TrophyMeta): string {
  const subjectFlavor =
    t.subjectId === "math"
      ? "数学风：紫色和粉色渐变，背景星空和数学符号闪烁"
      : "语文风：金色和暖红色，背景中国风云纹和水墨笔触";
  const lottery = t.rare ? "稀有金边光晕、独一无二闪耀质感、带宝石点缀" : "";
  const desc = t.description ? `这枚勋章纪念「${t.description}」。` : "";
  return [
    `一枚精美的卡通圆形勋章 (badge medal)，正中央是「${t.name}」主题图标。`,
    desc,
    subjectFlavor,
    lottery,
    "整体扁平 3D 插画风格，柔和光泽，纯色背景突出主体。",
    "适合 4 年级女生喜欢的可爱风，没有任何文字、字母、数字。",
    "高清 1024x1024，居中构图，圆形勋章占据大部分画面。",
  ]
    .filter(Boolean)
    .join(" ");
}

/** 把任意 URL 下载成 base64 data URL（持久化到 IndexedDB） */
async function fetchAsDataUrl(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch image failed: ${r.status}`);
  const blob = await r.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("FileReader result not string"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** 直接读取已缓存的图（不会触发生成） */
export async function getTrophyImage(trophyId: string): Promise<TrophyImageRow | undefined> {
  return await db.trophyImages.get(trophyId);
}

/**
 * 拿勋章图：先从 cache 读，没有就生成 + 下载 + 存。
 * @param force 强制重新生成（盲盒抽奖用）
 */
export async function ensureTrophyImage(
  t: TrophyMeta,
  options: { force?: boolean; isLottery?: boolean } = {},
): Promise<TrophyImageRow> {
  if (!options.force) {
    const cached = await getTrophyImage(t.id);
    if (cached?.imageDataUrl) return cached;
  }
  const prompt = buildTrophyPrompt(t);
  const r = await generateImage({
    prompt,
    size: "1024*1024",
    n: 1,
  });
  const url = r.urls[0];
  if (!url) throw new Error("generateImage returned 0 urls");
  // 立刻下载成 base64 (URL 24h 过期)
  const dataUrl = await fetchAsDataUrl(url);
  const row: TrophyImageRow = {
    trophyId: t.id,
    subjectId: t.subjectId,
    imageDataUrl: dataUrl,
    sourceUrl: url,
    prompt,
    model: r.model,
    generatedAt: Date.now(),
    isLottery: options.isLottery,
  };
  await db.trophyImages.put(row);
  return row;
}

/** Hook：组件订阅某个 trophy 的图，cache 命中即给图，否则给 null（用 emoji 兜底） */
export function useTrophyImage(trophyId: string | undefined): TrophyImageRow | null {
  const [row, setRow] = useState<TrophyImageRow | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!trophyId) {
      setRow(null);
      return;
    }
    void (async () => {
      const r = await db.trophyImages.get(trophyId);
      if (!cancelled) setRow(r ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [trophyId]);

  return row;
}

/** Hook：监听整个 trophyImages 表，一旦表更新（put）就重新拉 */
export function useAllTrophyImages(): Map<string, TrophyImageRow> {
  const [map, setMap] = useState<Map<string, TrophyImageRow>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const all = await db.trophyImages.toArray();
      if (!cancelled) setMap(new Map(all.map((r) => [r.trophyId, r])));
    };
    void refresh();
    // 简单方式：用一个 polling（5 秒间隔），dexie hooks 复杂避免依赖
    const id = window.setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return map;
}

/**
 * 批量生成所有缺失的勋章图（admin 用）。
 * 一张张串行 (避免 quota 雪崩)，回调汇报进度。
 */
export async function generateAllMissingTrophyImages(
  trophies: TrophyMeta[],
  onProgress?: (
    done: number,
    total: number,
    currentName: string,
    status: "running" | "skipped" | "done" | "failed",
    error?: string,
  ) => void,
): Promise<{ generated: number; skipped: number; failed: number }> {
  let generated = 0;
  let skipped = 0;
  let failed = 0;
  for (let i = 0; i < trophies.length; i++) {
    const t = trophies[i]!;
    onProgress?.(i, trophies.length, t.name, "running");
    try {
      const cached = await getTrophyImage(t.id);
      if (cached?.imageDataUrl) {
        skipped++;
        onProgress?.(i + 1, trophies.length, t.name, "skipped");
        continue;
      }
      await ensureTrophyImage(t);
      generated++;
      onProgress?.(i + 1, trophies.length, t.name, "done");
    } catch (e) {
      failed++;
      onProgress?.(
        i + 1,
        trophies.length,
        t.name,
        "failed",
        e instanceof Error ? e.message : String(e),
      );
    }
  }
  return { generated, skipped, failed };
}

/** 清掉所有缓存（admin 重置勋章图用） */
export async function clearAllTrophyImages(): Promise<number> {
  const count = await db.trophyImages.count();
  await db.trophyImages.clear();
  return count;
}
