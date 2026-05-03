/**
 * 语文 · 人教版四年级下册（C4B）单元清单。
 *
 * 期中考一般考前 4 单元；本文件登记 4 个单元，每个单元下挂一组技能。
 *
 * 命名空间：单元 id 全部以 C4B_ 开头（C = Chinese / 4 = 四年级 / B = 下册），
 * 跟数学 G4B_* 不撞，将来加上册时用 C4A_*。
 */

import type { CurriculumUnit } from "../../core/types";

export const UNITS_CHINESE: CurriculumUnit[] = [
  {
    id: "C4B_U1_NATURE",
    subjectId: "chinese",
    term: "下册",
    orderIndex: 1,
    name: "第一单元 · 古诗 + 乡村田园",
    description:
      "古诗三首（宿新市徐公店 / 四时田园杂兴 / 清平乐·村居）+ 乡下人家 + 天窗 + 三月桃花水。",
    priority: "VERY_HIGH",
  },
  {
    id: "C4B_U2_SCIENCE",
    subjectId: "chinese",
    term: "下册",
    orderIndex: 2,
    name: "第二单元 · 自然与科技",
    description:
      "琥珀 + 飞向蓝天的恐龙 + 纳米技术就在我们身边 + 千年梦圆在今朝。",
    priority: "VERY_HIGH",
  },
  {
    id: "C4B_U3_POETRY",
    subjectId: "chinese",
    term: "下册",
    orderIndex: 3,
    name: "第三单元 · 现代诗",
    description: "短诗三首 + 绿 + 白桦 + 在天晴了的时候。",
    priority: "HIGH",
  },
  {
    id: "C4B_U4_ANIMALS",
    subjectId: "chinese",
    term: "下册",
    orderIndex: 4,
    name: "第四单元 · 动物名家",
    description: "猫（老舍）+ 母鸡（老舍）+ 白鹅（丰子恺）。",
    priority: "VERY_HIGH",
  },
];
