#!/usr/bin/env python3
"""把 stdin 的 JSON 数组（agent 生成的题）校验 + POST 到云端入库。

用法：
  echo '[{...}, {...}]' | save_questions.py [--source agent-name]

或：
  cat /tmp/new-questions.json | save_questions.py
"""

import argparse
import json
import sys

from _common import post_json


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", default="hermes-tutor", help="出题来源标记")
    args = ap.parse_args()

    raw = sys.stdin.read().strip()
    if not raw:
        print("❌ 没有从 stdin 读到 JSON", file=sys.stderr)
        return 1
    # 尝试剥掉常见的 ```json ... ``` 包装
    if raw.startswith("```"):
        lines = raw.split("\n")
        if len(lines) > 2:
            raw = "\n".join(lines[1:-1] if lines[-1].strip() in ("```", "") else lines[1:])
    try:
        questions = json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"❌ JSON 解析失败：{e}", file=sys.stderr)
        return 1
    if not isinstance(questions, list):
        if isinstance(questions, dict):
            questions = [questions]
        else:
            print("❌ 输入应是 JSON 数组", file=sys.stderr)
            return 1

    print(f"📤 上传 {len(questions)} 道题到云端 …")
    try:
        resp = post_json("/api/agent/questions", {"questions": questions, "source": args.source})
    except Exception as e:
        print(f"❌ 上传失败：{e}", file=sys.stderr)
        return 1

    if resp.get("ok"):
        print(f"✓ 接受 {resp.get('accepted', 0)} 道，拒绝 {resp.get('rejected', 0)} 道")
        if resp.get("accepted_ids"):
            print("  入库 ID:", ", ".join(resp["accepted_ids"][:10]))
        if resp.get("failures"):
            print("\n失败详情：")
            for f in resp["failures"][:10]:
                print(f"  - {f.get('question_id', '?')}: {'; '.join(f.get('issues', []))}")
        print()
        print(f"💡 Selena 下次刷新 https://selena-elevate.pages.dev 就能在题库看到这些新题。")
        return 0 if resp.get("rejected", 0) == 0 else 2

    print(f"❌ 服务端返回失败：{resp}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
