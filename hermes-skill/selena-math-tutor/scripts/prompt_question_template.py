#!/usr/bin/env python3
"""产出"为某 skill 出 N 道题"的完整 prompt 给 Hermes 的 LLM。

包含：schema 字段说明、该 skill 现有 1-2 道示例（让 LLM 仿照）、约束（避免重复 ID 等）。
agent 读完这个 prompt 后会生成 JSON 数组，传给 save_questions.py 入库。

用法：
  prompt_question_template.py <skill_id> [n=5] [--difficulty 3]
"""

import argparse
import json
import random
import sys

from _common import get_questions_index, get_skills_index


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("skill_id")
    ap.add_argument("n", type=int, nargs="?", default=5)
    ap.add_argument("--difficulty", type=int, default=None, help="目标难度 1-4，默认与该 skill 已有题平均")
    args = ap.parse_args()

    skills = {s["id"]: s for s in get_skills_index()}
    skill = skills.get(args.skill_id)
    if not skill:
        print(f"❌ skill `{args.skill_id}` 不存在", file=sys.stderr)
        return 1

    questions = [q for q in get_questions_index() if q.get("skill_id") == args.skill_id]
    examples = random.sample(questions, k=min(2, len(questions))) if questions else []
    avg_diff = (
        round(sum(q.get("difficulty", 3) for q in questions) / len(questions))
        if questions
        else 3
    )
    target_diff = args.difficulty or avg_diff

    out = []
    out.append(f"# 任务：为「{skill['name']}」生成 {args.n} 道新题")
    out.append("")
    out.append(f"- skill_id: `{args.skill_id}`")
    out.append(f"- unit_id: `{skill['unitId']}`")
    out.append(f"- ability: {', '.join(skill.get('ability', []))}")
    out.append(f"- 难度: {target_diff} (1-4 范围内可微调)")
    out.append(f"- examPriority: `{skill['examPriority']}`")
    out.append("")
    out.append("## 输出格式（**严格 JSON 数组，不要 markdown 代码块**）")
    out.append("```json")
    out.append("[\n  { ... },\n  { ... }\n]")
    out.append("```")
    out.append("")
    out.append("每道题必须有这些字段：")
    out.append("```")
    out.append("question_id        : 全局唯一，用 \"AG_<skill前缀>_<时间戳后4位>_<序号>\" 格式")
    out.append("version            : 1")
    out.append("status             : \"approved\"")
    out.append("grade              : 4")
    out.append("term               : \"下册\" 或 \"上册\"")
    out.append(f"unit_id            : \"{skill['unitId']}\"")
    out.append(f"skill_id           : \"{args.skill_id}\"")
    out.append(f"unit_name          : \"<对应单元中文名>\"")
    out.append(f"skill_name         : \"{skill['name']}\"")
    out.append(f"ability_dimension  : {json.dumps(skill.get('ability', []))}")
    out.append(f"exam_priority      : \"{skill['examPriority']}\"")
    out.append("game_type          : \"speed_calc\" | \"word_problem_lab\" | \"concept_judge\" 等（按题型选）")
    out.append("play_as            : \"speed_match\" | \"plain_choice\" | \"shop_counter\" | \"true_false_swipe\"")
    out.append("cognitive_level    : \"recall\" | \"procedural\" | \"application\" | \"reasoning\"")
    out.append(f"difficulty         : {target_diff}（数字）")
    out.append("estimated_time_seconds : 数字（一般 15-90）")
    out.append("stem               : 题面，纯中文，校园生活场景")
    out.append("question_format    : \"numeric\" | \"single_choice\" | \"multi_step\"")
    out.append("answer             : { type: \"number\", value: <数字>, unit?: \"...\" }")
    out.append("                     OR { type: \"choice\", value: \"A\" }（选择题）")
    out.append("                     OR { type: \"multi_step\", steps: [...] }（应用题）")
    out.append("options            : 选择题必填，数组 [{id:\"A\",text:\"...\"}, ...]")
    out.append("distractors        : numeric 题必填，3 个非答案数字")
    out.append("solution_steps     : 数组，1-3 句解题步骤")
    out.append("hints              : 数组，1-3 级 [{text:\"...\", penalty:1}, ...]")
    out.append("common_errors      : 数组，至少 2 个 [{tag:\"...\", error:\"...\", remediation:\"...\"}]")
    out.append("feedback_correct   : \"干得漂亮！\" 之类")
    out.append("feedback_wrong     : \"再想想看\" 之类（**不能**说\"错了\"\"失败\"）")
    out.append("parent_tip         : 可选，给爸妈的辅导提示")
    out.append("source             : { curriculum:\"BNU_2013_G4\", basis:\"agent_generated\", copyright_safe:true, original:true }")
    out.append("safety_check       : { no_real_child_name:true, no_personal_data:true, age_appropriate:true, no_ads:true, no_payment_inducement:true, no_unrelated_link:true }")
    out.append("```")
    out.append("")

    if examples:
        out.append("## 现有示例题（仿照此格式 + 风格）")
        for ex in examples:
            out.append("```json")
            out.append(json.dumps(ex, ensure_ascii=False, indent=2))
            out.append("```")
            out.append("")

    out.append("## 关键约束")
    out.append("- ❌ **不要**：使用真实人名 / 手机号 / 邮箱 / 付费 / 抽奖")
    out.append("- ❌ **不要**：超纲（比例、函数、方程组、平方根、二次方程）")
    out.append("- ❌ **不要**：负面文案（\"笨\"\"粗心鬼\"\"差\"\"失败\"）")
    out.append("- ✅ **要**：四年级生活场景（文具店、校园、跳绳、家务、书店等）")
    out.append("- ✅ **要**：question_id 全局唯一，前缀 `AG_` 后跟 skill 缩写 + 4 位时间戳后缀 + 序号")
    out.append("- ✅ **要**：4 选 1 题的 distractors 写得"看起来像"，让粗心的小孩可能选错")
    out.append("- ✅ **要**：parent_tip 写明这道题的常见错因或教学切入点")
    out.append("")
    out.append("## 生成完后")
    out.append(f"把整个 JSON 数组通过管道传给：")
    out.append("```bash")
    out.append("echo '<JSON 数组>' | python ~/.hermes/skills/selena-math-tutor/scripts/save_questions.py")
    out.append("```")
    out.append("脚本会校验 + POST 到云端 D1。返回 `accepted` 数和失败明细。")

    print("\n".join(out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
