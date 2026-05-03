#!/usr/bin/env python3
"""按 question_id 拿一道题（含选项、解答、提示、家长提示）。"""

import json
import sys

from _common import get_questions_index


def main():
    if len(sys.argv) < 2:
        print("usage: get_question.py <question_id>", file=sys.stderr)
        return 1
    qid = sys.argv[1]
    qs = {q["question_id"]: q for q in get_questions_index()}
    q = qs.get(qid)
    if not q:
        print(f"❌ 找不到题 {qid}")
        return 1

    out = [f"# 题 {qid}",
           f"- 单元：{q.get('unit_name')}",
           f"- 知识点：{q.get('skill_name')}",
           f"- 难度：{q.get('difficulty')}（1-4）",
           f"- 认知层级：{q.get('cognitive_level')}",
           "",
           "## 题面",
           q.get("stem", "")]

    if q.get("options"):
        out.append("\n## 选项")
        for o in q["options"]:
            out.append(f"- {o['id']}. {o['text']}")

    a = q.get("answer", {})
    if isinstance(a, dict):
        if a.get("type") == "number":
            out.append(f"\n## 正解\n{a.get('value')}{a.get('unit', '')}")
        elif a.get("type") == "choice":
            out.append(f"\n## 正解\n选项 {a.get('value')}")

    if q.get("hints"):
        out.append("\n## 提示（按顺序给）")
        for i, h in enumerate(q["hints"], 1):
            out.append(f"{i}. {h.get('text', '')}（扣 {h.get('penalty', 1)} 分）")

    if q.get("solution_steps"):
        out.append("\n## 解题步骤")
        for s in q["solution_steps"]:
            out.append(f"- {s}")

    if q.get("parent_tip"):
        out.append(f"\n## 家长提示\n{q['parent_tip']}")

    print("\n".join(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
