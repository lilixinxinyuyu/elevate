#!/usr/bin/env python3
"""记录一次辅导：写到 ~/.hermes/selena-cache/tutor-log.jsonl，本地文件。

家长以后可以跑 cat ~/.hermes/selena-cache/tutor-log.jsonl | jq 看历次辅导记录。
"""

import argparse
import json
import time
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--notes", default="", help="这次辅导的笔记")
    parser.add_argument("--learned", action="append", default=[], help="本次搞懂的 skill_id（可多次）")
    parser.add_argument("--practiced", action="append", default=[], help="本次练过的题 question_id")
    parser.add_argument("--mood", default="", help="她的状态：开心/想睡/疲倦/认真")
    args = parser.parse_args()

    log_dir = Path.home() / ".hermes" / "selena-cache"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "tutor-log.jsonl"
    entry = {
        "ts": int(time.time() * 1000),
        "ts_human": time.strftime("%Y-%m-%d %H:%M:%S"),
        "notes": args.notes,
        "learned": args.learned,
        "practiced": args.practiced,
        "mood": args.mood,
    }
    with log_file.open("a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    print(f"✓ 已记录：{log_file}")
    if args.learned:
        print(f"  搞懂：{', '.join(args.learned)}")
    if args.practiced:
        print(f"  练习：{', '.join(args.practiced)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
