/**
 * v0.36.65 — 客户端实时抠图 (Hub v6 全身立绘重做, Bruce 2026-05-21 拍板)。
 *
 * 全身立绘由 wan 实时生成, 落在一块**深 navy 纯色底** (prompt 锁的, ≈#0a0e2c) 上。
 * 这里在浏览器 canvas 里把这个底**实时抠成透明** + 自动裁掉四周空白, 拿到一张紧凑的
 * 全身透明 PNG, 可以干净地"站进"主界面场景 —— 不再走离线 python CV。
 *
 * 算法 = 移植 scripts/_gen-tier-avatars.mjs 里 python 的 corner flood-fill:
 *  - 从 4 个角 BFS 漫水, 把"跟角同色 (navy ± tolerance)"且连通到边界的像素 alpha 清 0;
 *  - 只清连通到边界的 → 人物内部就算有深色 (头发/阴影) 也不会被误抠;
 *  - 抠完按 alpha 求 bounding box, 裁掉 square 的大片空白 (全身图四周通常 ~80% 是空的)。
 *
 * 实测 (2026-05-21): 2048² 图 flood-fill ≈ 400ms, 边缘干净无蓝边。
 */

export interface CutoutResult {
  /** 透明 + 已裁边的 PNG dataURL */
  dataUrl: string;
  /** 裁后宽高 (人物 bounding box) */
  width: number;
  height: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

/**
 * 把深 navy 底的全身立绘抠成透明 + 裁边。
 *
 * @param src        图片 URL (生成出来的全身立绘, navy 底)
 * @param tolerance  每通道容差 (默认 30; navy 底很均匀, 人物色跟它差很多, 30 安全)
 * @param alphaThreshold bounding box 判定: alpha 高于它才算"人物像素" (默认 40, 滤抗锯齿半透边)
 */
export async function removeNavyBgToTrimmedPng(
  src: string,
  { tolerance = 30, alphaThreshold = 40 }: { tolerance?: number; alphaThreshold?: number } = {},
): Promise<CutoutResult> {
  const img = await loadImage(src);
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  if (!W || !H) throw new Error("image has no dimensions");

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(img, 0, 0);

  const id = ctx.getImageData(0, 0, W, H);
  const d = id.data;

  // navy 取左上角像素 (prompt 锁了纯色底, 角必是底色)
  const navyR = d[0]!, navyG = d[1]!, navyB = d[2]!;
  const isBg = (i: number) =>
    Math.abs(d[i]! - navyR) <= tolerance &&
    Math.abs(d[i + 1]! - navyG) <= tolerance &&
    Math.abs(d[i + 2]! - navyB) <= tolerance;

  // 4 角 BFS flood-fill (栈式, 避免递归爆栈)
  const visited = new Uint8Array(W * H);
  const stack: number[] = [];
  const pushIf = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const p = y * W + x;
    if (visited[p] || !isBg(p * 4)) return;
    visited[p] = 1;
    stack.push(p);
  };
  pushIf(0, 0);
  pushIf(W - 1, 0);
  pushIf(0, H - 1);
  pushIf(W - 1, H - 1);
  while (stack.length) {
    const p = stack.pop()!;
    d[p * 4 + 3] = 0; // 透明
    const x = p % W;
    const y = (p / W) | 0;
    pushIf(x + 1, y);
    pushIf(x - 1, y);
    pushIf(x, y + 1);
    pushIf(x, y - 1);
  }

  // bounding box (alpha > threshold 的像素)
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (d[(y * W + x) * 4 + 3]! > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  // 全透明 (生成失败/全被抠) → 兜底返原图全幅
  if (maxX < minX || maxY < minY) {
    ctx.putImageData(id, 0, 0);
    return { dataUrl: canvas.toDataURL("image/png"), width: W, height: H };
  }

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  ctx.putImageData(id, 0, 0); // 写回透明结果到原 canvas
  const out = document.createElement("canvas");
  out.width = bw;
  out.height = bh;
  const octx = out.getContext("2d");
  if (!octx) throw new Error("no 2d context (trim)");
  octx.drawImage(canvas, minX, minY, bw, bh, 0, 0, bw, bh);
  return { dataUrl: out.toDataURL("image/png"), width: bw, height: bh };
}
