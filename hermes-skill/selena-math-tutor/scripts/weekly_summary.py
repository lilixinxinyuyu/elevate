#!/usr/bin/env python3
"""周日晚的"小进"周报：综合分变化 + 段位 + 这周亮点 / 软肋。

由 Hermes cron 周日 19:30 调用。
- 拉云端快照（attempts 7 天 + 全量 mastery）
- 用一份与前端 rating.ts 等价的简化算法重算综合分
- 比对上周末的缓存分数，给出涨幅
- macOS 通知 + Tingting 语音

用法：
  weekly_summary.py        # 自动判定状况
  weekly_summary.py --dry  # 只打印不发通知
"""

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

from _common import get_snapshot

CACHE_DIR = Path.home() / ".hermes" / "selena-cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
LAST_RATING_FILE = CACHE_DIR / "last_weekly_rating.json"

# 与 src/core/scheduler.ts 一致
EXAM_PRIORITY_WEIGHT = {
    "MUST_BIG": 1.0,
    "HIGH_BIG": 0.85,
    "MUST_SMALL": 0.75,
    "VERY_HIGH_SMALL": 0.7,
    "HIGH_SMALL": 0.6,
    "NORMAL": 0.4,
    "LOW_SMALL": 0.25,
    "LOW": 0.2,
    "EXTENSION": 0.1,
}

TIERS = [
    # v5 pyramid: 学期赛季内分布，4 月 perfect = 全国
    ("school", "和平街小学", 0, 600, "🏫"),
    ("district", "锦江区", 600, 780, "🏛️"),
    ("city", "成都市", 780, 880, "🌆"),
    ("province", "四川省", 880, 960, "🐼"),
    ("country", "全国", 960, 1000, "🇨🇳"),
]

# v5 校准常量（和 src/core/rating.ts 同步）
ACCURACY_BASELINE = 0.5
ACCURACY_MAX = 250
ACCURACY_WARMUP = 100
MASTERY_MAX = 400
MASTERY_MULT = 4
MASTERY_BASE_CAP = 40
UNIQUE_Q_PER_LEVEL = 5
MASTERY_BREADTH_TARGET = 25
CONTINUITY_MAX = 200
VOLUME_MAX = 150


def tier_for_score(score: int):
    for t in TIERS:
        if t[2] <= score < t[3]:
            return t
    return TIERS[-1]


def percent_in_tier(score: int, tier) -> int:
    lo, hi = tier[2], tier[3]
    p = max(0.0, min(1.0, (score - lo) / max(1, hi - lo)))
    is_top = tier[0] == "country"
    return round(50 + p * (49 if is_top else 39))


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def compute_rating(attempts, mastery, skills_index_by_id):
    """与前端 src/core/rating.ts 同算法（简化）。"""
    now = datetime.now().timestamp() * 1000
    cutoff_7d = now - 7 * 24 * 60 * 60 * 1000

    recent = [a for a in attempts if a.get("createdAt", 0) >= cutoff_7d]
    acc7d = (sum(1 for a in recent if a.get("isCorrect")) / len(recent)) if recent else 0.0

    # 独立题数 / skill（用于 mastery cap）
    unique_q_by_skill = {}
    for a in attempts:
        sk = a.get("skillId")
        qid = a.get("questionId")
        if not sk or not qid:
            continue
        unique_q_by_skill.setdefault(sk, set()).add(qid)

    # 加权 effective mastery（按独立题数封顶）
    total_w, weighted_sum = 0.0, 0.0
    skills_practiced = 0
    for m in mastery:
        sk_id = m.get("skillId")
        skill = skills_index_by_id.get(sk_id)
        if not skill:
            continue
        skills_practiced += 1
        uniq = len(unique_q_by_skill.get(sk_id, set()))
        cap = min(100, MASTERY_BASE_CAP + uniq * UNIQUE_Q_PER_LEVEL)
        eff_score = min(m.get("score", 0), cap)
        w = EXAM_PRIORITY_WEIGHT.get(skill.get("examPriority"), 0.4)
        total_w += w
        weighted_sum += eff_score * w
    weighted_mastery = (weighted_sum / total_w) if total_w > 0 else 0.0
    breadth = min(1.0, skills_practiced / MASTERY_BREADTH_TARGET)

    # streak / cum days
    days = set()
    for a in attempts:
        d = datetime.fromtimestamp(a.get("createdAt", 0) / 1000)
        days.add(d.strftime("%Y-%m-%d"))
    cum_days = len(days)

    streak = 0
    cur = datetime.now()
    if cur.strftime("%Y-%m-%d") not in days:
        cur -= timedelta(days=1)
    while cur.strftime("%Y-%m-%d") in days:
        streak += 1
        cur -= timedelta(days=1)

    # v5 校准（和 src/core/rating.ts 同步）
    warmup = min(1, len(attempts) / ACCURACY_WARMUP)
    accuracy_comp = clamp((acc7d - ACCURACY_BASELINE) / (1 - ACCURACY_BASELINE) * ACCURACY_MAX * warmup, 0, ACCURACY_MAX)
    mastery_comp = clamp(weighted_mastery * breadth * MASTERY_MULT, 0, MASTERY_MAX)
    continuity_comp = clamp(streak * 5 + cum_days * 1.5, 0, CONTINUITY_MAX)
    volume_comp = clamp(math.log10(len(attempts) + 1) * 60 - 50, 0, VOLUME_MAX)

    score = round(clamp(accuracy_comp + mastery_comp + continuity_comp + volume_comp, 0, 1000))
    tier = tier_for_score(score)
    return {
        "score": score,
        "tier": tier,
        "percentSurpassed": percent_in_tier(score, tier),
        "deltaToNext": max(0, tier[3] - score) if tier[0] != "country" else 0,
        "raw": {
            "acc7d": acc7d,
            "streak": streak,
            "cumDays": cum_days,
            "totalAttempts": len(attempts),
            "weightedMastery": weighted_mastery,
        },
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
    args = ap.parse_args()

    snap = get_snapshot()
    if not snap:
        print("没有云端快照", file=sys.stderr)
        return 1

    attempts = snap["payload"].get("attempts", [])
    mastery = snap["payload"].get("mastery", [])

    # 拉技能元数据
    try:
        from _common import get_skills_index
        skills = {s["id"]: s for s in get_skills_index()}
    except Exception:
        skills = {}

    cur = compute_rating(attempts, mastery, skills)
    last = load_last()
    delta = cur["score"] - (last["score"] if last else cur["score"])

    tier_name = cur["tier"][1]
    tier_icon = cur["tier"][0]  # tier ID
    badge_icon = cur["tier"][4]
    pct = cur["percentSurpassed"]

    # 文本
    if last is None:
        title = "小进的第一周报"
        message = f"{badge_icon} {tier_name} · {cur['score']} 分 · 超过 {pct}%"
        voice_text = (
            f"塞莱娜，我是小进。这是你第一份周报，"
            f"你现在是{tier_name}四年级的{cur['score']}分，超过了{pct}%的同学，继续努力哦！"
        )
    elif delta > 0:
        # 升了
        moved_tier = (last and last.get("tierId") != cur["tier"][0])
        if moved_tier:
            title = f"🎉 {badge_icon} 升入{tier_name}！"
        else:
            title = f"📈 这周涨了 {delta} 分！"
        message = f"{cur['score']} 分 · {tier_name} · 超过 {pct}%"
        voice_text = (
            f"塞莱娜，我是小进，这周你从{last['score']}分涨到了{cur['score']}分，"
            + (f"升入了{tier_name}！太厉害了！" if moved_tier
               else f"现在是{tier_name}的前{100-pct}%。")
            + (f"再加油{cur['deltaToNext']}分就能解锁下一段啦！" if cur['deltaToNext'] > 0 and cur['deltaToNext'] < 100 else "")
        )
    elif delta < 0:
        title = "本周有点掉分，下周一起追回来！"
        message = f"{cur['score']} 分（下降 {-delta} 分） · {tier_name}"
        voice_text = (
            f"塞莱娜，我是小进。这周分数稍微动了一点，没关系，"
            f"下周我们一起做几道熟练的题就能涨回来！"
        )
    else:
        title = "本周稳住啦！"
        message = f"{cur['score']} 分 · {tier_name} · 超过 {pct}%"
        voice_text = (
            f"塞莱娜，本周稳稳保持{cur['score']}分。"
            f"下周冲一冲下一段位吧！"
        )

    # 友好亮点：streak / cumDays / acc7d
    raw = cur["raw"]
    extras = []
    if raw["streak"] >= 3:
        extras.append(f"🔥 连续 {raw['streak']} 天")
    if raw["acc7d"] >= 0.85:
        extras.append(f"🎯 准确率 {round(raw['acc7d']*100)}%")
    if extras:
        message += " · " + " · ".join(extras)

    print(f"[{datetime.now()}] {title}\n  {message}")
    print(f"  voice: {voice_text}")
    if args.dry:
        return 0

    macos_notify(title, message)
    if not args.no_voice:
        macos_speak(voice_text)

    # 保存当前状态供下周比对
    save_last({
        "score": cur["score"],
        "tierId": cur["tier"][0],
        "percentSurpassed": pct,
        "computedAt": datetime.now().isoformat(),
    })
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
