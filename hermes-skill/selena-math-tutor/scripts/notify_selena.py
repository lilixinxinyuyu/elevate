#!/usr/bin/env python3
"""每日提醒：到了点查 Selena 数据，弹 macOS 通知 + 语音播报。

由 Hermes cron（或 macOS launchd）调度。
- 没到期错题：温馨问候
- 有 1+ 到期错题：「Selena 今天 N 道错题等你 🌟」+ 语音提示
- ≥3 天没练：「Selena 好久没见啦」

用法：
  notify_selena.py        # 自动判定状况
  notify_selena.py --dry  # 只打印不弹通知
"""

import argparse
import os
import shutil
import subprocess
import sys
from datetime import datetime, timedelta

from _common import get_snapshot


def macos_notify(title: str, message: str, sound: str = "Glass") -> None:
    """macOS 通知中心（NSUserNotification）"""
    try:
        # 用 osascript 触发原生通知
        applescript = (
            f'display notification "{message}" with title "{title}" sound name "{sound}"'
        )
        subprocess.run(["osascript", "-e", applescript], check=False, timeout=5)
    except Exception as e:
        print(f"通知失败：{e}", file=sys.stderr)


def macos_speak(text: str, voice: str = "Tingting") -> None:
    """macOS say 播报。Tingting 是中文女声。"""
    if not shutil.which("say"):
        return
    try:
        subprocess.run(["say", "-v", voice, text], check=False, timeout=20)
    except Exception:
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true", help="只打印不发通知")
    ap.add_argument("--no-voice", action="store_true", help="不语音播报")
    args = ap.parse_args()

    snap = get_snapshot()
    if not snap:
        msg = ("数据没拉到", "云端没数据，可能 Selena 还没用过 App。")
        title, message = msg
    else:
        payload = snap["payload"]
        attempts = payload.get("attempts", [])
        mistakes = payload.get("mistakes", [])
        now_ms = datetime.now().timestamp() * 1000

        due = [m for m in mistakes if not m.get("resolved") and m.get("nextReviewAt", 0) <= now_ms]
        n_due = len(due)

        # 最近一次答题时间
        last_attempt_ms = max((a.get("createdAt", 0) for a in attempts), default=0)
        days_since = (now_ms - last_attempt_ms) / (24 * 60 * 60 * 1000) if last_attempt_ms else 999

        # 今天有没有练
        today_key = datetime.now().strftime("%Y-%m-%d")
        practiced_today = any(
            datetime.fromtimestamp(a.get("createdAt", 0) / 1000).strftime("%Y-%m-%d") == today_key
            for a in attempts
        )

        if practiced_today:
            # 今天已经练过 → 鼓励，不烦她
            title = "Selena 你今天数学很努力！"
            message = "再做几道挑战题继续保持！"
            voice_text = "塞莱娜你今天很棒，再坚持一会儿就更棒啦！"
        elif n_due >= 3:
            title = "Selena，数学时间到啦 🌟"
            message = f"今天有 {n_due} 道错题等你复活，5 分钟搞定～"
            voice_text = f"塞莱娜，我是小进，今天有 {n_due} 道错题等着你，我们一起搞定它好不好？"
        elif n_due >= 1:
            title = "Selena，来挑战一下"
            message = f"有 {n_due} 道错题到期了，快来打个卡。"
            voice_text = f"塞莱娜，今天还剩 {n_due} 道错题，要不要一起搞定？"
        elif days_since >= 3:
            title = "Selena，好久没见啦！"
            message = "小进在这里等你回来玩 🌟"
            voice_text = "塞莱娜，我是小进，好几天没见啦，今天来玩一下数学好吗？"
        else:
            title = "Selena，今天来打几关？"
            message = "做几道题保持手感！"
            voice_text = "塞莱娜，今天我们来玩几道数学题吧！"

    print(f"[{datetime.now()}] 通知：{title} → {message}")
    if args.dry:
        return 0

    macos_notify(title, message)
    if not args.no_voice and snap:
        # 写个文件让用户能看到日志
        log_dir = os.path.expanduser("~/.hermes/selena-cache")
        os.makedirs(log_dir, exist_ok=True)
        with open(os.path.join(log_dir, "notify.log"), "a") as f:
            f.write(f"{datetime.now().isoformat()}\t{title}\t{message}\n")
        macos_speak(voice_text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
