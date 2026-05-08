/**
 * 小进吉祥物 — 全应用通用的 AI 老师形象。
 *
 * 设计理念：
 *   - 名字：小进（"小小进步"，鼓励 Selena 每天前进一点）
 *   - 形象：可爱熊猫（四川元素）+ 学士帽 + 小魔棒，亲切友善
 *   - 出现位置：BgGenIndicator / LotteryBoxModal generating 阶段 / TutorPanel
 *     header / AutoGenerateOnEmpty / 任何"AI 在帮你"的场景
 *
 * 实现：把小进存进 db.trophyImages（trophyId="_mascot_xiaojin"），
 * 跟勋章共用一套缓存 + 重新生成机制。
 */

import { db } from "../db/dexie";
import { type TrophyMeta } from "./trophyImages";
import { generateImage } from "./tutor";
import { PROMPTS } from "./_prompts.generated";

/** 小进 trophy meta（id 加下划线前缀避免和 trophyId 撞） */
export const MASCOT_XIAOJIN: TrophyMeta = {
  id: "_mascot_xiaojin",
  // mascot 不属于任何学科 — 强制 math 走数学风格 prompt
  subjectId: "math",
  name: "小进",
  icon: "👩‍🏫",
  description: "Selena 的 AI 学习伙伴",
  rare: true,
};

/**
 * mascot prompt 从 prompts/mascot/xiaojin.md 读，不再硬编码。
 * 改 prompt 直接编辑 .md 文件，跑 `pnpm build` 即可。
 */
const MASCOT_PROMPT = PROMPTS.mascotXiaojin;

/** 拿 mascot 图：缓存命中直接 return，缺失就生成 + 持久化 */
export async function ensureMascotImage(): Promise<string | null> {
  const cached = await db.trophyImages.get(MASCOT_XIAOJIN.id);
  if (cached?.imageDataUrl) return cached.imageDataUrl;

  // 走 ensureTrophyImage 但用自定义 prompt（覆盖 buildTrophyPrompt）
  // 临时 hack：把 mascot 的 description 设成 prompt 串，让 buildTrophyPrompt 拼出来差不多
  // 更干净的做法：暴露 generateImage 直调。这里走 trophyImages 路径但传 mascot meta + force=false
  try {
    const row = await ensureTrophyImageWithCustomPrompt(MASCOT_XIAOJIN, MASCOT_PROMPT);
    return row.imageDataUrl;
  } catch (e) {
    // v0.31.57: dev server 没 API endpoint 时会返 404，调用方已有 fallback emoji，
    // 这里降到 warn 级别避免控制台被无限红字刷屏
    console.warn("[mascot] failed to generate (using emoji fallback):", e);
    return null;
  }
}

/**
 * 重新生成小进（admin 用，比如不喜欢这次抽到的样子）。
 */
export async function regenerateMascot(): Promise<string | null> {
  await db.trophyImages.delete(MASCOT_XIAOJIN.id);
  return ensureMascotImage();
}

/**
 * trophyImages.ts 里没暴露自定义 prompt 路径，这里复用核心逻辑：
 * 调 generateImage → 下载成 base64 → 写 db。和 ensureTrophyImage 等价但用我们的 prompt。
 */
async function ensureTrophyImageWithCustomPrompt(
  meta: TrophyMeta,
  customPrompt: string,
) {
  const cached = await db.trophyImages.get(meta.id);
  if (cached?.imageDataUrl) return cached;
  const r = await generateImage({ prompt: customPrompt, size: "512*512", n: 1 });
  const url = r.urls[0];
  if (!url) throw new Error("generateImage returned 0 urls");
  // 下载成 base64
  const dataResp = await fetch(url);
  if (!dataResp.ok) throw new Error(`fetch image failed: ${dataResp.status}`);
  const blob = await dataResp.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("FileReader result not string"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const row = {
    trophyId: meta.id,
    subjectId: meta.subjectId,
    imageDataUrl: dataUrl,
    sourceUrl: url,
    prompt: customPrompt,
    model: r.model,
    generatedAt: Date.now(),
    isLottery: false,
  };
  await db.trophyImages.put(row);
  return row;
}
