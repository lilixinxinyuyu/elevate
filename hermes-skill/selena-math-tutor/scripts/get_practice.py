#!/usr/bin/env python3
"""按 skill_id 拿 N 道她还没掌握的练习题。"""

import sys
import random
from datetime import datetime, timedelta

from _common import get_snapshot, get_questions_index, get_skills_index


def main():
    if len(sys.argv) < 2:
        print("usage: get_practice.py <skill_id> [n=3]", file=sys.stderr)
        return 1
    skill_id = sys.argv[1]
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 3

    questions = get_questions_index()
    snap = get_snapshot()

    candidates = [q for q in questions if q.get("skill_id") == skill_id]
    if not candidates:
        print(f"❌ skill `{skill_id}` 没有题")
        return 1

    skill_obj = {s["id"]: s for s in get_skills_index()}.get(skill_id)
    skill_name = skill_obj["name"] if skill_obj else skill_id

    # 排除最近 30 天答对过的题 + 单题级 mastered
    exclude = set()
    if snap:
        attempts = snap["payload"].get("attempts", [])
        cutoff = (datetime.now() - timedelta(days=30)).timestamp() * 1000
        recent_correct = {a["questionId"] for a in attempts if a.get("isCorrect") and a.get("createdAt", 0) >= cutoff}
        exclude |= recent_correct
        # mastered = 最近 3 次都对
        from collections import defaultdict
        by_q = defaultdict(list)
        for a in attempts:
            by_q[a["questionId"]].append(a)
        for qid, lst in by_q.items():
            lst.sort(key=lambda x: x.get("createdAt", 0))
            if len(lst) >= 3 and all(x.get("isCorrect") for x in lst[-3:]):
                exclude.add(qid)

    fresh = [q for q in candidates if q["question_id"] not in exclude]
    pool = fresh if fresh else candidates  # 实在没新题用做过的兜底
    random.shuffle(pool)
    picks = pool[:n]

    print(f"# 「{skill_name}」练习题（{len(picks)}/{n}）")
    if not fresh:
        print("\n_⚠️ 这个 skill 没有新题了，从做过的里挑了几道_")
    for q in picks:
        print(f"\n## {q['question_id']}（难度 {q.get('difficulty')}）")
        print(q.get("stem", ""))
        if q.get("options"):
            for o in q["options"]:
                print(f"- {o['id']}. {o['text']}")
        a = q.get("answer", {})
        if isinstance(a, dict):
            print(f"\n_正解：{a.get('value')}{a.get('unit', '')}_")
        if q.get("parent_tip"):
            print(f"_家长提示：{q['parent_tip']}_")
    return 0


if __name__ == "__main__":
    sys.exit(main())
