#!/usr/bin/env python3
"""详细时间线：最近 N 道题的完整动作流（开提示？花了多久？错了几次？）。

用法：
  timeline.py [n=20] [--skill SKILL_ID]

agent 用这个看"她到底是怎么错的、卡在哪一步"，比 fetch_context 的高维统计更细。
"""

import argparse
from datetime import datetime
from collections import defaultdict

from _common import get_snapshot, get_questions_index


def fmt_time(ms: int) -> str:
    return datetime.fromtimestamp(ms / 1000).strftime("%m-%d %H:%M")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("n", type=int, nargs="?", default=20)
    parser.add_argument("--skill", default=None, help="只看这个 skill 的题")
    parser.add_argument("--wrong-only", action="store_true", help="只看做错的")
    parser.add_argument("--with-hint-only", action="store_true", help="只看开过提示的")
    args = parser.parse_args()

    snap = get_snapshot()
    if not snap:
        print("⚠️  云端无数据")
        return 0

    attempts = snap["payload"].get("attempts", [])
    questions = {q["question_id"]: q for q in get_questions_index()}

    # 按时间倒序
    attempts.sort(key=lambda a: a.get("createdAt", 0), reverse=True)

    # 过滤
    if args.skill:
        attempts = [a for a in attempts if a.get("skillId") == args.skill]
    if args.wrong_only:
        attempts = [a for a in attempts if not a.get("isCorrect")]
    if args.with_hint_only:
        attempts = [a for a in attempts if a.get("hintsOpened", 0) > 0]

    attempts = attempts[: args.n]
    if not attempts:
        print("📭 没有匹配的记录")
        return 0

    # 每题被尝试过几次（看模式：反复错？秒答？）
    by_q = defaultdict(list)
    for a in snap["payload"]["attempts"]:
        by_q[a["questionId"]].append(a)
    for arr in by_q.values():
        arr.sort(key=lambda a: a.get("createdAt", 0))

    title = f"# 最近 {len(attempts)} 道题动作流"
    if args.skill:
        title += f"（skill={args.skill}）"
    if args.wrong_only:
        title += "（仅错题）"
    print(title)

    for a in attempts:
        qid = a.get("questionId")
        q = questions.get(qid, {})
        mark = "✓" if a.get("isCorrect") else "✗"
        partial = "（部分对）" if a.get("partialCorrect") and not a.get("isCorrect") else ""
        elapsed = a.get("elapsedSeconds", 0)
        hints = a.get("hintsOpened", 0)
        combo = a.get("comboAtEnd", 0)
        score = a.get("scoreDelta", {}).get("total", 0)
        when = fmt_time(a.get("createdAt", 0))
        # 这道题历史尝试次数 + 之前结果
        history = by_q.get(qid, [])
        prev_marks = "".join("✓" if x.get("isCorrect") else "✗" for x in history)
        prev_summary = f"（这题第 {len(history)} 次做，历史：{prev_marks}）" if len(history) > 1 else ""

        # 答案对照
        ua = a.get("answer")
        ra = q.get("answer", {})
        if isinstance(ra, dict):
            if ra.get("type") == "number":
                right = f"{ra.get('value')}{ra.get('unit', '')}"
            elif ra.get("type") == "choice":
                right = ra.get("value")
                for opt in q.get("options", []):
                    if opt["id"] == right:
                        right = f"{right}. {opt['text']}"
            else:
                right = str(ra)
        else:
            right = "?"

        skill_name = q.get("skill_name", "?")
        stem_short = q.get("stem", "?")[:60]
        if len(q.get("stem", "")) > 60:
            stem_short += "…"

        print(f"\n## {mark}{partial} {when} · [{skill_name}] · {elapsed}s · {hints} 次提示 · 连击 {combo} · +{score} XP")
        print(f"题：{stem_short}")
        print(f"她答：`{ua}`  正解：`{right}`")
        if prev_summary:
            print(prev_summary)
        if a.get("errorTags"):
            print(f"错因 tag：{', '.join(a['errorTags'])}")

    # 模式洞察
    print("\n---")
    print("\n## 模式提醒")
    insights = []
    # 高频提示
    high_hint = [a for a in attempts if a.get("hintsOpened", 0) >= 2]
    if high_hint:
        insights.append(f"- {len(high_hint)} 道开了 ≥2 次提示——可能这些 skill 真的还没建立直觉。")
    # 慢题
    slow = [a for a in attempts if a.get("elapsedSeconds", 0) >= 60]
    if slow:
        insights.append(f"- {len(slow)} 道用了 ≥60 秒。慢题 vs 错题对照看：是想很久但答对（深度思考）还是想很久还错（卡住）？")
    # 反复错
    repeat_wrong = [qid for qid, arr in by_q.items() if sum(1 for x in arr if not x.get("isCorrect")) >= 2]
    if repeat_wrong:
        insights.append(f"- 这些题 ≥2 次错了：{', '.join(repeat_wrong[:5])} → 是真知识漏洞，不是粗心。")
    if insights:
        print("\n".join(insights))
    else:
        print("- 看不出明显问题模式。")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
