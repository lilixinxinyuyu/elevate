#!/usr/bin/env python3
"""
v0.31.96：把 D1 里指定 trophy_images 的**深色背景** flood-fill 透明化。

跟 v1 (浅色 bg) 镜像：
  - v1 阈值 ≥ 230 (cream/white 角)
  - v2 阈值 ≤ 60 (deep navy/near-black 角)

适配 v0.31.96 prompt — AI 出深色 bg + motif，CV 吃掉 bg → 透明 PNG，CSS
overlay 统一边框。即使 CV 残留 1-2px 也是深色，跟 app bg #0b0f1f 融合，不漏白。

用法：
  APP_PASSWORD=... python3 scripts/_make-trophy-transparent-v2.py
    [--dry-run]                       # 只生成 /tmp/trophy-transparent-v2/*.png
    [--ids math_answer_master_silver,math_combo_king_gold]
    [--input-dir /tmp/trophies]       # 从本地 /tmp/trophies 读 png（regenerate 输出），
                                       # 默认 D1 拉
    [--threshold 60]                  # near-dark 阈值（BGR 各通道 ≤ 此值）
    [--feather 2]                     # 边缘羽化（默认 2）
    [--no-upload]                     # 跟 --dry-run 同义，本地生成不 push
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
ap.add_argument("--dry-run", action="store_true")
ap.add_argument("--no-upload", action="store_true")
ap.add_argument("--ids", default="")
ap.add_argument("--input-dir", default="",
                help="本地输入目录（含 <trophyId>.png）；不传则从 D1 拉")
ap.add_argument("--threshold", type=int, default=100,
                help="BGR 各通道 ≤ 此值视为接近 deep navy / 黑（默认 100，pilot 调出）")
ap.add_argument("--feather", type=int, default=2)
args = ap.parse_args()

OUTDIR = Path("/tmp/trophy-transparent-v2")
OUTDIR.mkdir(exist_ok=True)

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) selena-tools"


def fetch_d1_rows() -> list[dict]:
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


def remove_dark_bg(img_bgr: np.ndarray, threshold: int = 60, feather: int = 2) -> np.ndarray:
    """
    BGR → BGRA：flood-fill 4 个角连通的 deep-dark 像素，alpha 设 0。
    比 v1 镜像：v1 吃浅色 (>=230)，v2 吃深色 (<=threshold)。

    seed 用 inset=5 而非 (0,0)：AI 输出的 PNG 经常在最外圈 1-2 px 有亮色伪影
    （编码 padding 或 wan2.7 自己加的边），但 5 px 内就是干净 bg 色了。
    """
    h, w = img_bgr.shape[:2]
    near_dark = np.all(img_bgr <= threshold, axis=2)

    nd_uint = (near_dark.astype(np.uint8)) * 255
    ff_mask = np.zeros((h + 2, w + 2), dtype=np.uint8)
    bg_mask = np.zeros((h, w), dtype=np.uint8)
    inset = 5
    seeds = [(inset, inset), (inset, w - 1 - inset), (h - 1 - inset, inset), (h - 1 - inset, w - 1 - inset)]
    for cy, cx in seeds:
        if near_dark[cy, cx]:
            tmp = nd_uint.copy()
            cv2.floodFill(tmp, ff_mask.copy(), (cx, cy), newVal=128, loDiff=20, upDiff=20)
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
explicit_ids = [s.strip() for s in args.ids.split(",") if s.strip()]
sources: list[tuple[str, bytes, dict]] = []  # (trophyId, raw_bytes, existing_row_or_empty)

if args.input_dir:
    # 本地模式：从 /tmp/trophies/<id>.png 读
    in_dir = Path(args.input_dir)
    if not in_dir.is_dir():
        print(f"ERROR: input-dir {in_dir} not a dir", file=sys.stderr)
        sys.exit(1)
    print(f"▶ Reading from local {in_dir}", file=sys.stderr)
    # 拉一份 D1 已有 row 用于保留 prompt/model 等字段
    d1_rows_by_id = {r["trophyId"]: r for r in fetch_d1_rows()}
    files = sorted(in_dir.glob("*.png"))
    for f in files:
        tid = f.stem
        if tid.startswith("_"):
            continue
        if explicit_ids and tid not in explicit_ids:
            continue
        sources.append((tid, f.read_bytes(), d1_rows_by_id.get(tid, {})))
else:
    # D1 模式
    print(f"▶ Fetching trophy images from D1 …", file=sys.stderr)
    d1_rows = fetch_d1_rows()
    print(f"  total {len(d1_rows)} rows", file=sys.stderr)
    for r in d1_rows:
        tid = r.get("trophyId", "")
        if not tid.startswith("math_"):
            continue
        if explicit_ids and tid not in explicit_ids:
            continue
        data_url = r.get("imageDataUrl", "")
        if not data_url.startswith("data:image"):
            continue
        raw = base64.b64decode(data_url.split(",", 1)[1])
        sources.append((tid, raw, r))

print(f"  processing {len(sources)} trophies", file=sys.stderr)
if not sources:
    print("  (nothing to do)", file=sys.stderr)
    sys.exit(0)

new_rows: list[dict] = []
for tid, raw, existing_row in sources:
    img = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        print(f"  skip {tid}: decode failed", file=sys.stderr)
        continue
    h, w = img.shape[:2]

    transparent = remove_dark_bg(img, threshold=args.threshold, feather=args.feather)
    norm_url = encode_data_url(transparent)
    out_path = OUTDIR / f"{tid}.png"
    out_path.write_bytes(base64.b64decode(norm_url.split(",", 1)[1]))

    # 估算 alpha 覆盖率（透明像素占比，太低表示 motif 都被吃了 → 警告）
    alpha = transparent[:, :, 3]
    transparent_ratio = float((alpha < 64).sum()) / (h * w)
    motif_ratio = float((alpha > 200).sum()) / (h * w)
    warn = ""
    if motif_ratio < 0.20:
        warn = " ⚠ motif <20%, threshold 可能太高"
    elif transparent_ratio < 0.05:
        warn = " ⚠ 透明区 <5%, threshold 可能太低（深色 bg 没吃到）"

    print(f"  {tid}: {w}×{h} → bg={transparent_ratio*100:.0f}% motif={motif_ratio*100:.0f}% [{out_path.stat().st_size // 1024}KB]{warn}", file=sys.stderr)

    subj = existing_row.get("subjectId") if existing_row else ("chinese" if tid.startswith("chinese_") else "math")
    new_rows.append({
        "trophyId": tid,
        "subjectId": subj or "math",
        "imageDataUrl": norm_url,
        "prompt": existing_row.get("prompt", "") if existing_row else "",
        "model": existing_row.get("model", "wan2.7-image-pro") if existing_row else "wan2.7-image-pro",
        "sourceUrl": existing_row.get("sourceUrl", "") if existing_row else "",
        "generatedAt": int(__import__("time").time() * 1000),
    })

print(f"\n▶ Generated {len(new_rows)} processed images in {OUTDIR}/", file=sys.stderr)
if args.dry_run or args.no_upload:
    print("  (skipping upload)", file=sys.stderr)
    sys.exit(0)

BATCH = 10
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
