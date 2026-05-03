#!/usr/bin/env python3
"""周日晚的"小进"周报：本学期 XP 累计 + 段位 + 这周亮点 / 软肋。

由 Hermes cron 周日 19:30 调用。
- 拉云端快照（attempts + mastery + skills 元数据）
- 按"下册"过滤，累加 attempts 的 scoreDelta.total = 学期 XP
- 比对上周末缓存，给出 XP 涨幅
- macOS 通知 + 小进 Cherry 嗓子语音播报

用法：
  weekly_summary.py        # 自动判定状况
  weekly_summary.py --dry  # 只打印不发通知
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

from _common import get_snapshot, get_skills_index

CACHE_DIR = Path.home() / ".hermes" / "selena-cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
LAST_RATING_FILE = CACHE_DIR / "last_weekly_rating.json"

# v6 段位区间（XP 尺度，与 src/core/tiers.ts 同步）
TIERS = [
    ("school", "和平街小学", 0, 10000, "🏫"),
    ("district", "锦江区", 10000, 22000, "🏛️"),
    ("city", "成都市", 22000, 32000, "🌆"),
    ("province", "四川省", 32000, 40000, "🐼"),
    ("country", "全国", 40000, 999999, "🇨🇳"),
]


def tier_for_score(score: int):
    for t in TIERS:
        if t[2] <= score < t[3]:
            return t
    return TIERS[-1]


def percent_in_tier(score: int, tier) -> int:
    lo, hi = tier[2], tier[3]
    if tier[0] == "country":
        # 无上限：log 渐近 99%
        over = max(0, score - lo)
        return min(99, round(50 + 49 * (1 - 1 / (1 + over / 10000))))
    p = max(0.0, min(1.0, (score - lo) / max(1, hi - lo)))
    return round(50 + p * 39)


def sub_rank_stars(score: int, tier) -> str:
    lo, hi = tier[2], tier[3]
    if tier[0] == "country":
        return "★★★★"
    p = max(0.0, min(1.0, (score - lo) / max(1, hi - lo)))
    n = min(4, max(1, int(p * 4) + 1))
    return "★" * n + "☆" * (4 - n)


def compute_season_xp(attempts, term_filter, skills_index_by_id, units_by_id):
    """学期 XP = 该学期 attempts 的 scoreDelta.total 之和"""
    total = 0
    n = 0
    correct = 0
    days = set()
    for a in attempts:
        sk = skills_index_by_id.get(a.get("skillId"))
        if not sk:
            continue
        unit = units_by_id.get(sk.get("unitId"))
        if not unit or unit.get("term") != term_filter:
            continue
        delta = a.get("scoreDelta", {}).get("total", 0)
        total += delta
        n += 1
        if a.get("isCorrect"):
            correct += 1
        ts = a.get("createdAt", 0) / 1000
        days.add(datetime.fromtimestamp(ts).strftime("%Y-%m-%d"))

    streak = 0
    cur = datetime.now()
    if cur.strftime("%Y-%m-%d") not in days:
        cur -= timedelta(days=1)
    while cur.strftime("%Y-%m-%d") in days:
        streak += 1
        cur -= timedelta(days=1)

    return {
        "xp": total,
        "attempts": n,
        "correct": correct,
        "accuracy": correct / n if n > 0 else 0,
        "streak": streak,
        "cum_days": len(days),
    }


def load_last():
    if not LAST_RATING_FILE.exists():
        return None
    try:
        return json.loads(LAST_RATING_FILE.read_text())
    except Exception:
        return None


def save_last(payload: dict):
    LAST_RATING_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2))


def macos_notify(title: str, message: str, sound: str = "Glass"):
    try:
        subprocess.run(
            ["osascript", "-e", f'display notification "{message}" with title "{title}" sound name "{sound}"'],
            check=False, timeout=5,
        )
    except Exception as e:
        print(f"通知失败：{e}", file=sys.stderr)


def macos_speak(text: str, voice: str = "Cherry"):
    """优先用小进 Cherry 嗓子；失败回退 macOS Tingting。"""
    qwen_script = os.path.expanduser("~/.hermes/scripts/qwen_tts.py")
    if os.path.exists(qwen_script) and shutil.which("afplay"):
        try:
            import tempfile
            with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as t:
                t.write(text)
                txt = t.name
            wav = txt.replace(".txt", ".wav")
            env = os.environ.copy()
            env["QWEN_TTS_VOICE"] = voice
            r = subprocess.run(["python3", qwen_script, txt, wav], env=env, capture_output=True, timeout=20)
            if r.returncode == 0 and os.path.exists(wav):
                subprocess.run(["afplay", wav], check=False, timeout=30)
                try:
                    os.unlink(txt); os.unlink(wav)
                except Exception:
                    pass
                return
        except Exception:
            pass
    if shutil.which("say"):
        try:
            subprocess.run(["say", "-v", "Tingting", text], check=False, timeout=20)
        except Exception:
            pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--no-voice", action="store_true")
    ap.add_argument("--term", default="下册", help="学期：上册 / 下册 / 综合复习")
    args = ap.parse_args()

    snap = get_snapshot()
    if not snap:
        print("没有云端快照", file=sys.stderr)
        return 1

    attempts = snap["payload"].get("attempts", [])
    skills_idx = {s["id"]: s for s in get_skills_index()}
    # 拉 units 元数据
    try:
        from _common import fetch_json
        units_list = fetch_json("/agent/units.json")
        units_idx = {u["id"]: u for u in units_list}
    except Exception:
        units_idx = {}

    cur = compute_season_xp(attempts, args.term, skills_idx, units_idx)
    tier = tier_for_score(cur["xp"])
    tier_id, tier_name, tier_lo, tier_hi, tier_icon = tier
    pct = percent_in_tier(cur["xp"], tier)
    stars = sub_rank_stars(cur["xp"], tier)

    last = load_last()
    delta = cur["xp"] - (last.get("xp", 0) if last else 0)

    # 文本
    if last is None:
        title = f"小进的第一周报（{args.term}）"
        message = f"{tier_icon} {tier_name} {stars} · {cur['xp']:,} XP · 超过 {pct}%"
        voice_text = (
            f"塞莱娜，我是小进。这是你这学期的第一份周报，"
            f"你现在是{tier_name}{stars}，累计{cur['xp']}经验，超过了{pct}%的同学，继续加油！"
        )
    elif delta > 0:
        moved_tier = (last.get("tierId") != tier_id)
        if moved_tier:
            title = f"🎉 {tier_icon} 升入{tier_name}！"
            voice_text = (
                f"塞莱娜，我是小进，恭喜你升入{tier_name}啦！这周涨了{delta}经验，太厉害了！"
            )
        else:
            title = f"📈 这周涨了 {delta:,} XP！"
            voice_text = (
                f"塞莱娜，我是小进。这周你涨了{delta}经验，"
                f"现在累计{cur['xp']}，{tier_name}{stars}，继续保持！"
            )
        message = f"{tier_icon} {tier_name} {stars} · {cur['xp']:,} XP · 超过 {pct}%"
    elif delta == 0:
        title = "本周没练数学呢"
        message = f"{tier_icon} {tier_name} · {cur['xp']:,} XP（持平）"
        voice_text = "塞莱娜，本周还没怎么练数学，要不周末来打几道题？"
    else:
        # 不应该发生（XP 不会减），但兜底
        title = "本周状态"
        message = f"{tier_icon} {tier_name} · {cur['xp']:,} XP"
        voice_text = f"塞莱娜，本周累计{cur['xp']}经验，再坚持就能升档。"

    # 友好亮点
    extras = []
    if cur["streak"] >= 3:
        extras.append(f"🔥 连续 {cur['streak']} 天")
    if cur["accuracy"] >= 0.85:
        extras.append(f"🎯 准确率 {round(cur['accuracy']*100)}%")
    if extras:
        message += " · " + " · ".join(extras)

    print(f"[{datetime.now()}] {title}")
    print(f"  {message}")
    print(f"  voice: {voice_text}")
    if args.dry:
        return 0

    macos_notify(title, message)
    if not args.no_voice:
        macos_speak(voice_text)

    save_last({
        "xp": cur["xp"],
        "tierId": tier_id,
        "term": args.term,
        "computedAt": datetime.now().isoformat(),
    })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
