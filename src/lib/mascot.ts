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
 * 让小进的 prompt 生成不走 buildTrophyPrompt 的 trophy 格式。
 * 我们直接覆盖 prompt 走 generateImage。
 */
const MASCOT_PROMPT = [
  `Sticker / icon 风格的可爱卡通角色：四川大熊猫宝宝形象的"AI 学习小精灵"。`,
  `角色：圆滚滚的小熊猫，戴一顶紫色学士帽，眼睛闪闪发亮充满智慧，一只小爪握着发光的魔法棒。`,
  `表情：友善温暖、鼓励的笑容（不要严肃、不要凶）。`,
  `姿态：胸前抱着一本紫色魔法书，背景有少量数学符号 + 中文笔画飘浮（淡淡的，不抢主体）。`,
  `主色调：黑白熊猫毛 + 紫罗兰 + 樱花粉点缀 + 金色魔法光晕。`,
  `画面构成：圆形头肩特写居中，深紫罗兰纯色背景，主体占画面 75%，便于 UI 圆形遮罩裁剪。`,
  `禁止出现：任何文字、字母、数字、签名、水印、其他角色。`,
  `风格：扁平 3D 插画 + 柔光内发光，4 年级女生审美：超萌、超精致、超可爱。`,
  `画面尺寸：512×512 正方形，主体严格居中，四周留 12% 边距。`,
].join(" ");

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
    console.error("[mascot] failed to generate:", e);
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
