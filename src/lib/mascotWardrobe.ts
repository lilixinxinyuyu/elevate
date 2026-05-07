/**
 * 小进衣柜 — Selena 用"装扮卡"AI 生成的造型 outfit。
 *
 * 数据模型：
 *  - 单条 row = 一个完整熊猫造型（blob + prompt + 元数据），存 db.mascotWardrobe
 *  - 同时只能 equip 一件；切换时旧的 equipped=0
 *  - 每件 outfit 是 AI 生成的完整画像（不是分件 hat/hair）—— 简单可控
 *
 * 装扮卡 currency：
 *  - 存 db.meta::wardrobeCards::math::<studentId>，整数
 *  - earn：finalizeSession 后 +1（在 service.ts 里 hook）
 *  - spend：生成一张 outfit 扣 1（成功生成无论用户选不选都扣，避免反复刷）
 *
 * 生成流程：
 *  1. 用户给个文字 prompt（"戴红色蝴蝶结的小熊猫"）
 *  2. 后端调 qwen-image-2.0-pro 生成（n=2 给 2 张候选）
 *  3. 用户挑 1 张存衣柜 / 全拒（不退卡，但保留 prompt 供下次重用）
 *
 * 跨设备同步：mascotWardrobe 表暂时不进 cloudSync —— blob 总和可能很大，
 * 等用户实际用起来再决定是否同步（参考 trophyImages 走独立 endpoint 的方案）。
 */

import { db } from "../db/dexie";
import { generateImage } from "./tutor";
import type { MascotWardrobeRow } from "../db/dexie";

const SUBJECT = "math";

const cardsKey = (studentId: string) => `wardrobeCards::${SUBJECT}::${studentId}`;

export async function getWardrobeCards(studentId: string): Promise<number> {
  const row = await db.meta.get(cardsKey(studentId));
  const v = row?.value;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export async function awardWardrobeCard(studentId: string, n = 1): Promise<number> {
  const cur = await getWardrobeCards(studentId);
  const next = cur + n;
  await db.meta.put({ key: cardsKey(studentId), value: next });
  return next;
}

export async function spendWardrobeCard(studentId: string, n = 1): Promise<number | null> {
  const cur = await getWardrobeCards(studentId);
  if (cur < n) return null;
  const next = cur - n;
  await db.meta.put({ key: cardsKey(studentId), value: next });
  return next;
}

/** 列出某 student 的衣柜 outfits（按 createdAt 降序） */
export async function listWardrobe(studentId: string): Promise<MascotWardrobeRow[]> {
  const all = await db.mascotWardrobe.where({ studentId }).toArray();
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function getEquippedWardrobe(studentId: string): Promise<MascotWardrobeRow | null> {
  const all = await db.mascotWardrobe.where({ studentId }).toArray();
  return all.find((r) => r.equipped === 1) ?? null;
}

/** 切换 equipped — 同 student 只允许一件 equipped */
export async function setEquippedWardrobe(
  studentId: string,
  rowId: string | null,
): Promise<void> {
  await db.transaction("rw", db.mascotWardrobe, async () => {
    const all = await db.mascotWardrobe.where({ studentId }).toArray();
    for (const r of all) {
      const shouldEquip = r.id === rowId ? 1 : 0;
      if (r.equipped !== shouldEquip) {
        r.equipped = shouldEquip as 0 | 1;
        await db.mascotWardrobe.put(r);
      }
    }
  });
}

export async function deleteWardrobeItem(rowId: string): Promise<void> {
  await db.mascotWardrobe.delete(rowId);
}

/** 把 url 下载成 Blob（dashscope OSS 出来的 url 直接 fetch 即可）*/
async function urlToBlob(url: string): Promise<{ blob: Blob; mime: string }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download_failed_${r.status}`);
  const blob = await r.blob();
  return { blob, mime: blob.type || "image/png" };
}

/** 用 Canvas 把 blob 解码读 width/height，并按需压缩到 512×512 q=0.9 */
async function decodeAndCompress(blob: Blob): Promise<{
  blob: Blob;
  mime: string;
  width: number;
  height: number;
}> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = (e) => reject(e);
      image.src = url;
    });
    const targetSize = 512;
    const scale = Math.min(1, targetSize / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no_canvas_ctx");
    ctx.drawImage(img, 0, 0, w, h);
    const out: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("blob_null"))),
        "image/jpeg",
        0.9,
      ),
    );
    return { blob: out, mime: "image/jpeg", width: w, height: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * 基础熊猫形象 — 这是所有衣装变体共同的"地基"。
 * 设计目标：让熊猫看起来像一个**真实毛绒玩偶**（plushie），不是平面 cartoon。
 * 跨次生成时风格一致，让 Selena 觉得是"同一只小熊猫换装"，而不是每次都不同。
 *
 * 关键 prompt 要素（顺序很重要 —— 越前面权重越大）：
 *  1. plushie 主体定位（"毛绒玩偶"、"plush toy"、"stuffed animal"）
 *  2. 体型比例（chibi / 大头短身 / 圆润）
 *  3. 熊猫特征（黑眼圈、黑耳朵、白脸白肚）
 *  4. 性别 cue（柔和、女性向、长睫毛、少女系）
 *  5. 材质质感（毛绒、立体光影、缝线、反光高光）
 *  6. 表情（温暖微笑、亲切）
 *  7. 构图（正面胸像、512×512、纯色柔光背景）
 *  8. 风格（高质量插画、商业玩偶摄影感）
 *  9. 用户的 outfit 变体在最后追加（保 base 稳定）
 */
// v0.31.24：用户选定 plushie 风格作为地基（mascot-compare 页结果）。
// 这条描述符是所有 wardrobe 衣装变体的共同前缀 —— 让 AI 生成的每一件衣装
// 都基于"同一只玩偶熊猫"，只换装饰，不换主体。
export const BASE_MASCOT_DESCRIPTOR =
  "一只可爱的女性熊猫毛绒玩偶（cute female panda plushie / stuffed animal）," +
  "Jellycat / Build-A-Bear 商业玩具摄影质感；" +
  "chibi 圆润比例（大头小身约 1:1.1），胖胖肉乎乎、圆滚滚的体型；" +
  "**真实毛绒玩具质感**：明显绒毛纹理、立体光影、缝线细节、面部中心有一道淡淡的缝合线、高光反光；" +
  "标志熊猫特征：胖胖圆圆的脸、教泪滴形的大黑眼圈（贴近脸中心、向外微微倾斜）、" +
  "毛茸茸圆耳朵在头顶两侧、白色脸蛋和肚子、黑色短小四肢；" +
  "女性化温暖：明显的长弯睫毛（黑色细线）、闪亮的大黑眼珠（眼睛在眼圈偏上位置，带白色高光点）、" +
  "粉色心形小鼻头、椭圆粉嫩腮红圆斑、温柔的小弧度微笑（绣线感）；" +
  "正面胸像构图（露出头 + 上半身），居中、对称；" +
  "深紫罗兰到淡粉色柔光渐变背景；" +
  "商业级玩具官方摄影风格，光线柔和均匀，景深虚化背景，3D 渲染般立体感；" +
  "色彩鲜明明快，高质量、童真可爱、温暖治愈。";

/**
 * 给 user prompt 包装成熊猫 mascot 风格的完整 prompt。
 * 必备元素：基础形象描述 + 用户描述（仅作为造型 accent，不改变 base）。
 */
export function buildMascotPrompt(userText: string): string {
  const cleaned = userText.trim();
  const accent = cleaned
    ? `造型 accent（不改变熊猫主体外观，只是穿戴/装饰）：${cleaned}`
    : `造型 accent：头上戴一个粉色蝴蝶结。`;
  return [
    BASE_MASCOT_DESCRIPTOR,
    accent,
    "再次强调：保持熊猫毛绒玩偶 plushie 质感、女性化温暖气质、chibi 圆润比例。",
  ].join(" ");
}

/**
 * "Canonical" 基础形象 prompt（无任何 accent）。
 * 用来生成 day-1 的默认头像，让 Selena 还没解锁衣柜时也有一个一致的熊猫面孔。
 */
export function buildBaseMascotPrompt(): string {
  return [
    BASE_MASCOT_DESCRIPTOR,
    "造型：最朴素、不带任何额外装饰，干净的女性熊猫毛绒玩偶本体。",
    "再次强调：保持熊猫毛绒玩偶 plushie 质感、女性化温暖气质、chibi 圆润比例。",
  ].join(" ");
}

export interface GenerateCandidate {
  /** 临时下载下来的图（待 Selena 选）*/
  blob: Blob;
  mime: string;
  width: number;
  height: number;
  /** dashscope 原始 url（后备）*/
  sourceUrl: string;
}

/** 调 dashscope 生成 N 张候选；扣卡片在外面控制（成功才扣） */
export async function generateCandidates(args: {
  prompt: string;
  n?: number;
}): Promise<{ ok: true; candidates: GenerateCandidate[] } | { ok: false; error: string }> {
  try {
    const fullPrompt = buildMascotPrompt(args.prompt);
    const r = await generateImage({
      prompt: fullPrompt,
      size: "512*512",
      n: args.n ?? 2,
    });
    if (!r.urls || r.urls.length === 0) return { ok: false, error: "no_urls_returned" };
    const candidates: GenerateCandidate[] = [];
    for (const url of r.urls) {
      try {
        const raw = await urlToBlob(url);
        const compressed = await decodeAndCompress(raw.blob);
        candidates.push({ ...compressed, sourceUrl: url });
      } catch (e) {
        console.warn("[wardrobe] one candidate download failed:", e);
      }
    }
    if (candidates.length === 0) return { ok: false, error: "all_downloads_failed" };
    return { ok: true, candidates };
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? "gen_failed" };
  }
}

/** 把选中的候选存进衣柜，equip 成默认。 */
export async function saveWardrobeOutfit(args: {
  studentId: string;
  name: string;
  prompt: string;
  candidate: GenerateCandidate;
  equipImmediately?: boolean;
}): Promise<MascotWardrobeRow> {
  const id = `w_${args.studentId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const row: MascotWardrobeRow = {
    id,
    studentId: args.studentId,
    subjectId: SUBJECT,
    name: args.name,
    prompt: args.prompt,
    blob: args.candidate.blob,
    mime: args.candidate.mime,
    width: args.candidate.width,
    height: args.candidate.height,
    equipped: 0,
    createdAt: Date.now(),
  };
  await db.mascotWardrobe.put(row);
  if (args.equipImmediately) {
    await setEquippedWardrobe(args.studentId, id);
    row.equipped = 1;
  }
  return row;
}

/** 给 UI 用的快捷函数：blob → object URL（caller 负责 revoke）*/
export function wardrobeImageUrl(row: MascotWardrobeRow): string {
  return URL.createObjectURL(row.blob);
}
