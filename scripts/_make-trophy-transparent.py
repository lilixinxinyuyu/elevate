#!/usr/bin/env python3
"""
v0.31.92：把 D1 里指定 trophy_images 的浅色背景 flood-fill 透明化。

跟 _make-boss-transparent.py 同款 OpenCV 思路，差异：
  - 阈值更低（trophy 用 cream/ivory 背景 #f5f0e6 ~ #ffffff，不是纯白）
  - 不做 enraged 变体（trophy 没有狂怒态）
  - 默认只处理"主图" trophy（v0.31.92 重生成的 medallion 型），不动 commemorative
    （commemorative 已经用 CSS 五/六角 clip-path + 暖金 ring，工作得很好）

用法：
  APP_PASSWORD=... python3 scripts/_make-trophy-transparent.py
    [--dry-run]                              # 仅本地生成 /tmp/trophy-transparent/*.png
    [--ids math_speed_demon,weekly_d4_hunter] # 显式 ids（逗号分隔）
    [--auto-frameless]                       # 自动选"应该有 frame 但当前没 frame"的 trophy
    [--threshold 230]                        # cream 阈值（默认 230）
    [--feather 2]                            # 边缘羽化（默认 2）

约束：
  - 跳过 commemorative / tier badge（它们的 CSS frame 工作得很好）
  - 不动 boss / chinese 等非 math 主线 trophy
  - 输出 PNG 上传回 /api/sync/trophy-images
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
ap.add_argument("--dry-run", action="store_true", help="不上传，仅生成 /tmp/trophy-transparent/*.png")
ap.add_argument("--ids", default="", help="逗号分隔的 trophyId 列表（不传则用 --auto-frameless）")
ap.add_argument("--auto-frameless", action="store_true",
                help="自动找应该 frame 的 trophy（非 commemorative / 非 tier badge）")
ap.add_argument("--threshold", type=int, default=230,
                help="像素 RGB 各通道 ≥ 此值视为接近 cream / 白（默认 230，比 boss 的 240 低）")
ap.add_argument("--feather", type=int, default=2, help="边缘羽化像素（默认 2）")
args = ap.parse_args()

OUTDIR = Path("/tmp/trophy-transparent")
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
    return data.get("rows", [])


def remove_pale_bg(img_bgr: np.ndarray, threshold: int = 230, feather: int = 2) -> np.ndarray:
    """BGR → BGRA：flood-fill 4 个角，把 corner-connected 的浅色像素 alpha 设 0。"""
    h, w = img_bgr.shape[:2]
    near_pale = np.all(img_bgr >= threshold, axis=2)

    nw_uint = (near_pale.astype(np.uint8)) * 255
    ff_mask = np.zeros((h + 2, w + 2), dtype=np.uint8)
    bg_mask = np.zeros((h, w), dtype=np.uint8)
    for cy, cx in [(0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)]:
        if near_pale[cy, cx]:
            tmp = nw_uint.copy()
            cv2.floodFill(tmp, ff_mask.copy(), (cx, cy), newVal=128, loDiff=15, upDiff=15)
            bg_mask = np.maximum(bg_mask, (tmp == 128).astype(np.uint8) * 255)

    if feather > 0:
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (feather * 2 + 1, feather * 2 + 1))
        bg_mask = cv2.erode(bg_mask, kernel, iterations=1)

    bgra = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2BGRA)
    bgra[:, :, 3] = 255 - bg_mask

    if feather > 0:
        bgra[:, :, 3] = cv2.GaussianBlur(bgra[:, :, 3], (feather * 2 + 1, feather * 2 + 1), 0)

    return bgra


def encode_data_url(bgra: np.ndarray, max_size: int = 384) -> str:
    h, w = bgra.shape[:2]
    if max(h, w) > max_size:
        scale = max_size / max(h, w)
        bgra = cv2.resize(bgra, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    success, buf = cv2.imencode(".png", bgra, [int(cv2.IMWRITE_PNG_COMPRESSION), 9])
    if not success:
        raise RuntimeError("png encode failed")
    return f"data:image/png;base64,{base64.b64encode(buf.tobytes()).decode()}"


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
print(f"▶ Fetching trophy images from D1 …", file=sys.stderr)
all_imgs = fetch_trophy_images()
print(f"  total {len(all_imgs)} rows", file=sys.stderr)

# 决定处理哪些 trophyId
explicit_ids = [s.strip() for s in args.ids.split(",") if s.strip()]
if explicit_ids:
    targets = [r for r in all_imgs if r.get("trophyId") in explicit_ids]
elif args.auto_frameless:
    # commemorative / tier badge 用 CSS frame 工作得好 → 跳过
    # 主路径：milestone / ability / skill / fluency / 其他 ad-hoc trophy
    SKIP_PREFIX = ("math_tier_", "math_first_step", "math_midterm",
                   "math_final_done", "math_new_semester", "math_birthday",
                   "math_subrank_up")
    SKIP_CONTAINS = ("_boss_",)  # boss 已经透明化
    targets = [
        r for r in all_imgs
        if r.get("trophyId", "").startswith("math_")
        and not any(r["trophyId"].startswith(p) for p in SKIP_PREFIX)
        and not any(c in r["trophyId"] for c in SKIP_CONTAINS)
    ]
else:
    print("ERROR: 需要 --ids 或 --auto-frameless 之一", file=sys.stderr)
    sys.exit(1)

print(f"  processing {len(targets)} trophies", file=sys.stderr)

new_rows: list[dict] = []
for r in targets:
    tid = r["trophyId"]
    data_url = r.get("imageDataUrl", "")
    if not data_url.startswith("data:image"):
        print(f"  skip {tid}: not a data url", file=sys.stderr)
        continue
    raw = base64.b64decode(data_url.split(",", 1)[1])
    img = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        print(f"  skip {tid}: decode failed", file=sys.stderr)
        continue
    h, w = img.shape[:2]

    transparent = remove_pale_bg(img, threshold=args.threshold, feather=args.feather)
    norm_url = encode_data_url(transparent)
    out_path = OUTDIR / f"{tid}.png"
    out_path.write_bytes(base64.b64decode(norm_url.split(",", 1)[1]))
    print(f"  {tid}: {w}×{h} → transparent {out_path.stat().st_size // 1024}KB", file=sys.stderr)

    new_rows.append({
        **r,
        "imageDataUrl": norm_url,
        "generatedAt": int(__import__("time").time() * 1000),
    })

print(f"\n▶ Generated {len(new_rows)} processed images in {OUTDIR}/", file=sys.stderr)
if args.dry_run:
    print("  (--dry-run, not uploading)", file=sys.stderr)
    sys.exit(0)

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

print(f"\n✓ Uploaded {pushed} transparent trophies to D1.", file=sys.stderr)
