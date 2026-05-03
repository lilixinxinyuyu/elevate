#!/usr/bin/env python3
"""每次辅导第一步：拉 Selena 学习上下文，输出 agent 易懂的中文摘要。"""

import sys
from datetime import datetime, timedelta, timezone
from collections import Counter, defaultdict

from _common import get_snapshot, get_questions_index, get_skills_index


def fmt_ts(ms: int) -> str:
    if not ms:
        return "未知"
    return datetime.fromtimestamp(ms / 1000).strftime("%Y-%m-%d")


def main():
    snap = get_snapshot()
    if not snap:
        print("⚠️  云端没有进度数据。Selena 可能还没用过 App，或同步失败。")
        return 0

    payload = snap["payload"]
    attempts = payload.get("attempts", [])
    mastery = payload.get("mastery", [])
    mistakes = payload.get("mistakes", [])
    sessions = payload.get("sessions", [])
    trophies = payload.get("trophies", [])
    students = payload.get("students", [])
    name = (students[0] or {}).get("name", "Selena") if students else "Selena"

    questions = {q["question_id"]: q for q in get_questions_index()}
    skills = {s["id"]: s for s in get_skills_index()}

    now = datetime.now()
    seven_days_ago_ms = (now - timedelta(days=7)).timestamp() * 1000
    thirty_days_ago_ms = (now - timedelta(days=30)).timestamp() * 1000

    recent7 = [a for a in attempts if a.get("createdAt", 0) >= seven_days_ago_ms]
    recent7_correct = sum(1 for a in recent7 if a.get("isCorrect"))

    # 弱 skill：mastery < 70 + 至少做过 3 题
    weak_skills = sorted(
        [m for m in mastery if m.get("score", 100) < 70 and m.get("attemptsCount", 0) >= 3],
        key=lambda m: m["score"],
    )

    # 待复活错题：未解决，按 nextReviewAt 排序
    open_mistakes = [m for m in mistakes if not m.get("resolved")]
    due_mistakes = [m for m in open_mistakes if m.get("nextReviewAt", 0) <= now.timestamp() * 1000]
    open_mistakes.sort(key=lambda m: m.get("nextReviewAt", 0))

    # 最后一次 session 的题目 + 答题情况
    sessions_sorted = sorted(sessions, key=lambda s: s.get("startedAt") or 0, reverse=True)
    last_session = sessions_sorted[0] if sessions_sorted else None
    last_session_summary = None
    if last_session:
        sid = last_session["id"]
        sa = [a for a in attempts if a.get("sessionId") == sid]
        last_session_summary = {
            "dateKey": last_session.get("dateKey"),
            "mode": last_session.get("mode"),
            "total": len(sa),
            "correct": sum(1 for x in sa if x.get("isCorrect")),
            "items": [
                {
                    "question_id": x["questionId"],
                    "stem": questions.get(x["questionId"], {}).get("stem", "?")[:80],
                    "isCorrect": x.get("isCorrect"),
                    "userAnswer": x.get("answer"),
                    "skill_name": skills.get(x.get("skillId"), {}).get("name", "?"),
                }
                for x in sa[:8]
            ],
        }

    # 每个 skill 的 attempts/correct 比例
    skill_acc = defaultdict(lambda: [0, 0])  # [correct, total]
    for a in attempts:
        sid = a.get("skillId")
        if not sid:
            continue
        skill_acc[sid][1] += 1
        if a.get("isCorrect"):
            skill_acc[sid][0] += 1

    # 输出（agent 直接吸收的中文摘要）
    out = []
    out.append(f"# {name} 当前学习状态")
    out.append(f"\n_数据时间：{fmt_ts(snap.get('version', 0))}（{snap.get('attemptsCount', 0)} 答题 / {snap.get('totalXp', 0)} XP）_")

    # 最近活跃
    out.append(f"\n## 最近 7 天")
    if recent7:
        acc = recent7_correct / len(recent7) * 100
        out.append(f"- 共 {len(recent7)} 题，正确率 {acc:.0f}%")
        # 最近 3 天每天答题
        days = Counter(fmt_ts(a["createdAt"]) for a in recent7)
        for d, n in sorted(days.items(), reverse=True)[:5]:
            out.append(f"  - {d}: {n} 题")
    else:
        out.append("- ⚠️ 7 天没练过了！可以用这个切入：『最近怎么没玩呀？』")

    # 弱 skill
    out.append(f"\n## 薄弱知识点（mastery < 70 + 做过 ≥3 次）")
    if weak_skills:
        for m in weak_skills[:5]:
            sname = skills.get(m["skillId"], {}).get("name", m["skillId"])
            unit = skills.get(m["skillId"], {}).get("unitId", "?")
            acc_data = skill_acc.get(m["skillId"], [0, 0])
            acc_pct = (acc_data[0] / acc_data[1] * 100) if acc_data[1] else 0
            out.append(
                f"- **{sname}**（{unit}）：mastery={int(m['score'])}，"
                f"做过 {m.get('attemptsCount', 0)} 次，正确率 {acc_pct:.0f}%"
            )
    else:
        out.append("- 没有明显薄弱点（所有练过的 skill mastery≥70）")

    # 待复活错题
    out.append(f"\n## 错题（未解决 {len(open_mistakes)}，今日到期 {len(due_mistakes)}）")
    for m in open_mistakes[:5]:
        q = questions.get(m["questionId"], {})
        # 找她当时答案
        last_attempt = None
        for a in reversed(attempts):
            if a.get("questionId") == m["questionId"]:
                last_attempt = a
                break
        wrong_ans = last_attempt.get("answer") if last_attempt else "?"
        right_ans = q.get("answer", {})
        right_str = right_ans.get("value") if isinstance(right_ans, dict) else right_ans
        if isinstance(right_str, str) and len(right_str) == 1 and q.get("options"):
            for opt in q["options"]:
                if opt["id"] == right_str:
                    right_str = f"{opt['id']}. {opt['text']}"
                    break
        out.append(
            f"- **{q.get('stem', '?')[:60]}**\n"
            f"  - 她当时写：`{wrong_ans}` ❌  正确：`{right_str}`\n"
            f"  - skill：{skills.get(q.get('skill_id'), {}).get('name', q.get('skill_id', '?'))}"
        )
        if q.get("parent_tip"):
            out.append(f"  - 家长提示：{q['parent_tip']}")

    # 最近一次 session 详细
    if last_session_summary:
        out.append(f"\n## 最近一次挑战（{last_session_summary['dateKey']} · {last_session_summary['mode']}）")
        out.append(f"完成 {last_session_summary['correct']} / {last_session_summary['total']}")
        for it in last_session_summary["items"][:6]:
            mark = "✓" if it["isCorrect"] else "✗"
            out.append(f"- {mark} [{it['skill_name']}] {it['stem']}（她答：{it['userAnswer']}）")

    out.append("\n---")
    out.append("\n**给 Selena 数学私教 Agent 的下一步建议**：")
    if due_mistakes:
        out.append(f"1. 先开个温暖的玩笑，再把「今日到期的 {len(due_mistakes)} 道错题」中最简单的一道拿出来一起做。")
    elif weak_skills:
        out.append(f"1. 找一个 weak skill（{skills.get(weak_skills[0]['skillId'], {}).get('name', '?')}）切入，问她「还记得这块怎么做吗」。")
    elif recent7:
        acc = recent7_correct / len(recent7) * 100
        if acc > 90:
            out.append("1. 她最近做得很好（正确率 > 90%）！可以推一道挑战题或换个新知识点。")
        else:
            out.append("1. 复盘最近一次挑战中的错题。")
    else:
        out.append("1. 她最近没练。先聊聊学校 / 心情，然后随便挑一个轻松的小题切入。")
    out.append("2. **绝对不要**直接讲解 / 给答案。**苏格拉底式提问**，每次只一个小问题。")
    out.append("3. 用她答错过的真实数字举例（不要无中生有的题）。")

    print("\n".join(out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
