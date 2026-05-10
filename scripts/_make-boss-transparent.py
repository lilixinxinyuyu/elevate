#!/usr/bin/env python3
"""
v0.31.74：把 D1 里所有 math_boss_* 图的白色背景去掉，重存为透明 PNG。

策略：
  - 用 OpenCV + flood fill from 4 个角，把"角落连通的接近白的区域"标为 alpha=0
  - 仅角落连通才算背景；怪物身上的白色（眼睛高光等）不会被误删
  - 结果是 PNG with alpha channel（cleaner visual on dark game background）

用法:
  APP_PASSWORD=... python3 scripts/_make-boss-transparent.py
    [--dry-run]              # 不上传，仅生成 /tmp/boss-transparent/*.png
    [--dest=both|normal|enraged]
        normal   = 仅替换原 trophyId
        enraged  = 替换 trophyId+'_enraged'（hue 处理一下）
        both (默认) = 两者都生成

约束：
  - 输入是 base64 dataURL，从 D1 拉
  - 输出 PNG 大小约 ~80KB（透明会比原 JPG 略大但更清晰）
  - upload back to D1 via /api/sync/trophy-images
"""

import os
import sys
import json
import base64
import urllib.request
import urllib.error
import argparse
from pathlib import Path
import numpy as np
import cv2

PROD = "https://selena-elevate.pages.dev"
APP_PASSWORD = os.environ.get("APP_PASSWORD")
if not APP_PASSWORD:
    print("ERROR: APP_PASSWORD env required", file=sys.stderr)
    sys.exit(1)

ap = argparse.ArgumentParser()
ap.add_argument("--dry-run", action="store_true", help="不上传 D1，仅本地生成 PNG")
ap.add_argument("--dest", choices=["both", "normal", "enraged"], default="both")
ap.add_argument("--threshold", type=int, default=240,
                help="像素 RGB 任意通道 ≥ 此值视为接近白（默认 240）")
ap.add_argument("--feather", type=int, default=2, help="边缘羽化像素半径（默认 2）")
args = ap.parse_args()

OUTDIR = Path("/tmp/boss-transparent")
OUTDIR.mkdir(exist_ok=True)


UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) selena-tools"

def fetch_trophy_images() -> list[dict]:
    req = urllib.request.Request(
        f"{PROD}/api/sync/trophy-images?since=0",
        headers={
            "Authorization": f"Bearer {APP_PASSWORD}",
            "User-Agent": UA,
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read())
    return [r for r in data.get("rows", []) if r.get("trophyId", "").startswith("math_boss_")]


def remove_white_bg(img_bgr: np.ndarray, threshold: int = 240, feather: int = 2) -> np.ndarray:
    """
    Returns BGRA image with alpha channel.
    Strategy: flood fill from 4 corners; pixels reachable from corners that
    are 'close to white' get alpha=0. Other pixels keep alpha=255.
    """
    h, w = img_bgr.shape[:2]
    # Build a mask: True = "near white" pixel
    near_white = np.all(img_bgr >= threshold, axis=2)

    # Visited mask via flood fill from each corner
    visited = np.zeros((h, w), dtype=bool)
    queue = []
    for cy, cx in [(0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)]:
        if near_white[cy, cx] and not visited[cy, cx]:
            queue.append((cy, cx))
            visited[cy, cx] = True

    # 4-connected BFS using numpy-only is slow; use OpenCV floodFill
    # Trick: use cv2.floodFill on the near_white mask itself
    nw_uint = (near_white.astype(np.uint8)) * 255
    # cv2.floodFill needs +2 size mask
    ff_mask = np.zeros((h + 2, w + 2), dtype=np.uint8)
    bg_mask = np.zeros((h, w), dtype=np.uint8)
    for cy, cx in [(0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)]:
        if near_white[cy, cx]:
            # Flood-fill on a working copy to mark connected near-white pixels
            tmp = nw_uint.copy()
            cv2.floodFill(tmp, ff_mask.copy(), (cx, cy), newVal=128, loDiff=10, upDiff=10)
            # Pixels that became 128 are connected to this corner
            bg_mask = np.maximum(bg_mask, (tmp == 128).astype(np.uint8) * 255)

    # Optional: erode the bg_mask slightly so we keep a thin halo around the subject
    if feather > 0:
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (feather * 2 + 1, feather * 2 + 1))
        bg_mask = cv2.erode(bg_mask, kernel, iterations=1)

    # Build BGRA output
    bgra = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2BGRA)
    bgra[:, :, 3] = 255 - bg_mask  # bg → alpha 0; subject → alpha 255

    # Soft alpha edge: blur the alpha channel a bit
    if feather > 0:
        bgra[:, :, 3] = cv2.GaussianBlur(bgra[:, :, 3], (feather * 2 + 1, feather * 2 + 1), 0)

    return bgra


def make_enraged_variant(bgra: np.ndarray) -> np.ndarray:
    """
    v0.31.74：从普通图变出狂怒态变体。
    用 HSV 色调旋转 + 增饱和 + 局部红色叠加 — 视觉立即不同，但保留主体形态。
    """
    rgb = cv2.cvtColor(bgra[:, :, :3], cv2.COLOR_BGR2RGB)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV).astype(np.int32)
    # 把整体 hue 朝红色方向 shift
    hsv[:, :, 0] = (hsv[:, :, 0] - 10) % 180  # OpenCV H 是 0-179
    # 提饱和
    hsv[:, :, 1] = np.clip(hsv[:, :, 1].astype(np.int32) + 40, 0, 255)
    # 提亮度
    hsv[:, :, 2] = np.clip(hsv[:, :, 2].astype(np.int32) + 10, 0, 255)
    # 加全局红色 overlay (15% 强度)
    rgb_back = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB)
    overlay = np.full_like(rgb_back, [220, 30, 30])
    blended = cv2.addWeighted(rgb_back, 0.85, overlay, 0.15, 0)
    bgr_out = cv2.cvtColor(blended, cv2.COLOR_RGB2BGR)
    out = np.dstack([bgr_out, bgra[:, :, 3]])
    return out


def encode_data_url(bgra: np.ndarray, max_size: int = 384) -> str:
    """
    Encode BGRA → PNG data URL, with size cap.
    若图片大于 max_size×max_size，先 resize（保持 aspect ratio）。
    用 PNG_COMPRESSION 9 + PIL 优化 → 单图通常 ≤ 200KB（base64 ≤ 270KB）。
    """
    h, w = bgra.shape[:2]
    if max(h, w) > max_size:
        scale = max_size / max(h, w)
        new_w = int(w * scale)
        new_h = int(h * scale)
        bgra = cv2.resize(bgra, (new_w, new_h), interpolation=cv2.INTER_AREA)
    success, buf = cv2.imencode(
        ".png", bgra, [int(cv2.IMWRITE_PNG_COMPRESSION), 9],
    )
    if not success:
        raise RuntimeError("png encode failed")
    b64 = base64.b64encode(buf.tobytes()).decode()
    return f"data:image/png;base64,{b64}"


def upload_rows(rows: list[dict]):
    body = json.dumps({"rows": rows}).encode()
    req = urllib.request.Request(
        f"{PROD}/api/sync/trophy-images",
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {APP_PASSWORD}",
            "Content-Type": "application/json",
            "User-Agent": UA,
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"ok": False, "error": f"http_{e.code}", "detail": e.read().decode()[:200]}


# ============================================================
# Main
# ============================================================
print(f"▶ Fetching boss images from D1 …", file=sys.stderr)
all_imgs = fetch_trophy_images()
# 仅处理 7 张主 boss 图（master variants 不动 — 那些是 "trophy" 图）
main_imgs = [
    r for r in all_imgs
    if r["trophyId"].startswith("math_boss_")
    and not r["trophyId"].endswith("_master")
    and not r["trophyId"].endswith("_enraged")
    and not r["trophyId"].startswith("math_boss_first_")
    and not r["trophyId"].startswith("math_boss_no_")
    and not r["trophyId"].startswith("math_boss_win_")
    and not r["trophyId"].startswith("math_boss_final_")
]
print(f"  found {len(all_imgs)} boss-related, processing {len(main_imgs)} main bosses", file=sys.stderr)

new_rows: list[dict] = []
for r in main_imgs:
    tid = r["trophyId"]
    data_url = r.get("imageDataUrl", "")
    if not data_url.startswith("data:image"):
        print(f"  skip {tid}: not a data url", file=sys.stderr)
        continue
    # decode
    b64 = data_url.split(",", 1)[1]
    raw = base64.b64decode(b64)
    arr = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        print(f"  skip {tid}: decode failed", file=sys.stderr)
        continue
    h, w = img.shape[:2]
    print(f"  {tid}: {w}×{h}", file=sys.stderr)

    # Make transparent normal
    transparent = remove_white_bg(img, threshold=args.threshold, feather=args.feather)
    norm_url = encode_data_url(transparent)
    # 写本地 PNG 也用 resized 版本 (跟实际上传一致)
    # decode 一遍 base64 写入
    norm_b64 = norm_url.split(",", 1)[1]
    out_path = OUTDIR / f"{tid}.png"
    out_path.write_bytes(base64.b64decode(norm_b64))
    print(f"    normal: {len(norm_url) // 1024}KB data url ({out_path.stat().st_size // 1024}KB png)", file=sys.stderr)

    if args.dest in ("normal", "both"):
        new_rows.append({
            **r,
            "imageDataUrl": norm_url,
            "generatedAt": int(__import__("time").time() * 1000),
        })

    if args.dest in ("enraged", "both"):
        enraged = make_enraged_variant(transparent)
        enr_url = encode_data_url(enraged)
        out_e = OUTDIR / f"{tid}_enraged.png"
        enr_b64 = enr_url.split(",", 1)[1]
        out_e.write_bytes(base64.b64decode(enr_b64))
        print(f"    enraged: {len(enr_url) // 1024}KB data url ({out_e.stat().st_size // 1024}KB png)", file=sys.stderr)
        new_rows.append({
            "trophyId": f"{tid}_enraged",
            "subjectId": r.get("subjectId", "math"),
            "imageDataUrl": enr_url,
            "prompt": (r.get("prompt", "") + " [enraged variant: red tint, saturated, intimidating]")[:500],
            "model": r.get("model", ""),
            "generatedAt": int(__import__("time").time() * 1000),
        })

print(f"\n▶ Generated {len(new_rows)} processed images in {OUTDIR}/", file=sys.stderr)
if args.dry_run:
    print("\n  (--dry-run, not uploading)", file=sys.stderr)
    sys.exit(0)

# Upload in batches of 20
BATCH = 20
pushed = 0
for i in range(0, len(new_rows), BATCH):
    batch = new_rows[i:i + BATCH]
    print(f"  uploading batch {i // BATCH + 1} ({len(batch)} rows) …", file=sys.stderr)
    res = upload_rows(batch)
    if res.get("ok"):
        pushed += res.get("accepted", 0)
    else:
        print(f"    FAILED: {res}", file=sys.stderr)

print(f"\n✓ Uploaded {pushed} processed images to D1.", file=sys.stderr)
